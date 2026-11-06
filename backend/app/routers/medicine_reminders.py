"""Medicine-reminder endpoints.

The patient drives this: reminders only start once someone confirms the medicine
is actually in hand. Most patients buy at an outside pharmacy, so the hospital
genuinely cannot know when a course begins — asking is the only honest answer.
Hospital staff can confirm too, for the counter-dispensing case.

Permissions reuse the existing catalogue (read = `patient.read`, write =
`appointment.update`) so no re-seed is needed, exactly like prescriptions.
"""
from uuid import UUID
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db, utcnow
from ..deps import require_permission
from ..models import FamilyMember, MedicineCourse, MedicineReminder, Patient, Prescription, User
from ..models.medicine_reminder import (
    COURSE_ACTIVE, COURSE_AWAITING, COURSE_STOPPED, DOSE_FAILED, DOSE_PENDING,
    DOSE_SENT, DOSE_SKIPPED, DOSE_TAKEN,
)
from ..schemas.medicine_reminder import (
    CourseDetail, CourseOut, SetTimesRequest, StartCoursesRequest, StartResult,
    StopCourseRequest, TodayDoseOut, TodayResult,
)
from ..services import audit
from ..services import family_link
from ..services import reminder_engine as engine
from .prescriptions import _assert_access, _patient

router = APIRouter(tags=["medicine-reminders"])


def _course(db: Session, course_id: UUID) -> MedicineCourse:
    row = db.get(MedicineCourse, course_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Medicine course not found")
    return row


def _me_patient(db: Session, me: User) -> Patient:
    """The logged-in user's own patient row.

    `_patient` looks up by id and 404s on None, so it cannot answer "mine" —
    which is what the dashboard asks for. Staff hitting these endpoints must
    name a patient_id explicitly; they have no patient row of their own.
    """
    p = db.scalar(select(Patient).where(Patient.user_id == me.user_id))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No patient record for this account")
    return p


def _today_dose(db: Session, dose: MedicineReminder) -> TodayDoseOut:
    """One dose plus the bits of its course a row needs to render."""
    course = dose.course or db.get(MedicineCourse, dose.course_id)
    member_name = None
    if course and course.family_member_id:
        member = db.get(FamilyMember, course.family_member_id)
        member_name = member.name if member else None
    return TodayDoseOut(
        reminder_id=dose.reminder_id, course_id=dose.course_id, slot=dose.slot,
        send_at=dose.send_at, status=dose.status, taken_at=dose.taken_at,
        drug_name=course.drug_name if course else "",
        dosage=course.dosage if course else "",
        food_note=course.food_note if course else "",
        family_member_name=member_name,
    )


def _out(db: Session, rows: list[MedicineCourse]) -> list[CourseOut]:
    """Course + the live dose counts the UI actually needs."""
    names: dict[int, str] = {}
    member_ids = {r.family_member_id for r in rows if r.family_member_id}
    if member_ids:
        for m in db.scalars(select(FamilyMember).where(FamilyMember.member_id.in_(member_ids))).all():
            names[m.member_id] = m.name

    # `next_dose_at` drives the "time for your tablet" popup (DoseDueToaster).
    # It used to mean "the earliest dose we have not tried to send", which
    # silently stopped the popup ever appearing once the reminder ticker was
    # switched on: the ticker claims a dose about two seconds after it falls
    # due, so by the time the popup polls (every 60s) the dose is already
    # `sent` and has left the list. Measured on 23 Sep 2026 — due 13:14:00,
    # sent 13:14:02. The patient got the SMS and the bell icon, never the popup.
    #
    # It now means "the earliest dose the patient still has not TAKEN", which
    # is the question the popup is really asking. A dose that was sent, or one
    # whose send failed, is still a tablet somebody has to swallow.
    #
    # The grace window matters as much as the statuses: without it, one old
    # untaken dose would be the earliest for ever and pin `next_dose_at` to a
    # date days back, so the popup — which ignores anything more than 30
    # minutes late — would never fire again for that course. That would be
    # worse than the bug being fixed. 25 doses were in exactly that state.
    # Aware, not `utcnow()`. `send_at` is DateTime(timezone=True) and psycopg2
    # hands it back tz-aware, so comparing it with a naive value raises
    # TypeError and 500s this endpoint — which is the whole medicine list, not
    # just the popup.
    grace = datetime.now(timezone.utc) - timedelta(minutes=30)
    live_statuses = (DOSE_PENDING, DOSE_SENT, DOSE_FAILED)

    out = []
    for row in rows:
        pending = [d for d in row.doses if d.status == DOSE_PENDING]
        due_now = [d for d in row.doses
                   if d.status in live_statuses and d.send_at and d.send_at >= grace]
        item = CourseOut.model_validate(row)
        item.family_member_name = names.get(row.family_member_id)
        # Unchanged: these two are counters the UI shows as "N pending / N sent",
        # and they mean what they say. Only the popup trigger moved.
        item.doses_pending = len(pending)
        item.doses_sent = sum(1 for d in row.doses if d.status == DOSE_SENT)
        item.next_dose_at = min((d.send_at for d in due_now), default=None)
        out.append(item)
    return out


@router.get("/medicine-courses", response_model=list[CourseOut])
def list_courses(
    patient_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """A PATIENT sees their own courses; staff see a patient's, or their hospital's."""
    stmt = select(MedicineCourse).options(selectinload(MedicineCourse.doses))
    role = me.role.name if me.role else None
    if role == "PATIENT":
        mine = select(Patient.patient_id).where(Patient.user_id == me.user_id)
        stmt = stmt.where(family_link.visible_condition(db, me, MedicineCourse, mine))
    elif patient_id:
        _assert_access(db, me, _patient(db, patient_id))
        stmt = stmt.where(MedicineCourse.patient_id == patient_id)
    elif role != "SUPER_ADMIN":
        stmt = stmt.where(MedicineCourse.hospital_id == me.hospital_id)
    if status_filter:
        stmt = stmt.where(MedicineCourse.status == status_filter)
    rows = db.scalars(stmt.order_by(MedicineCourse.created_at.desc())).all()
    return _out(db, list(rows))


@router.get("/medicine-courses/{course_id}", response_model=CourseDetail)
def get_course(
    course_id: UUID,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    course = _course(db, course_id)
    _assert_access(db, me, _patient(db, course.patient_id))
    detail = CourseDetail.model_validate(course)
    base = _out(db, [course])[0]
    for field in ("family_member_name", "doses_pending", "doses_sent", "next_dose_at"):
        setattr(detail, field, getattr(base, field))
    detail.doses = sorted(course.doses, key=lambda d: d.send_at)
    return detail


@router.post("/medicine-courses/start", response_model=StartResult)
def start_courses(
    body: StartCoursesRequest,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """"Got your medicines" — begin the course(s) and schedule the doses."""
    if not body.prescription_id and not body.course_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pass prescription_id or course_id")

    if body.course_id:
        courses = [_course(db, body.course_id)]
    else:
        rx = db.get(Prescription, body.prescription_id)
        if not rx:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
        courses = list(db.scalars(
            select(MedicineCourse).where(MedicineCourse.prescription_id == rx.prescription_id)
        ).all())
        if not courses:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "No medicine on this prescription has a schedule we can remind for",
            )
    _assert_access(db, me, _patient(db, courses[0].patient_id))

    startable = [c for c in courses if c.status in (COURSE_AWAITING, COURSE_STOPPED)]
    if not startable:
        raise HTTPException(status.HTTP_409_CONFLICT, "These reminders are already running")

    scheduled = sum(engine.start_course(db, c, body.start_date) for c in startable)
    audit.log_activity(db, me.user_id, "medicine.course.start", "medicine_course",
                       {"courses": [c.course_id for c in startable], "doses": scheduled})
    db.commit()
    return StartResult(courses_started=len(startable), doses_scheduled=scheduled,
                       courses=_out(db, startable))


@router.post("/medicine-courses/{course_id}/stop", response_model=CourseOut)
def stop_course(
    course_id: UUID,
    body: StopCourseRequest,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """Stop reminders early — finished the strip, side effects, doctor changed it."""
    course = _course(db, course_id)
    _assert_access(db, me, _patient(db, course.patient_id))
    if course.status != COURSE_ACTIVE:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Course is {course.status}")
    dropped = engine.stop_course(db, course, body.reason)
    audit.log_activity(db, me.user_id, "medicine.course.stop", "medicine_course",
                       {"course_id": course_id, "doses_dropped": dropped})
    db.commit()
    return _out(db, [course])[0]


@router.post("/medicine-courses/{course_id}/times", response_model=CourseOut)
def set_course_times(
    course_id: UUID,
    body: SetTimesRequest,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """Put this course on the patient's own clock instead of the 9/2/9 defaults.

    Allowed while the course is running or still awaiting start — an un-started
    course simply records the times and uses them when it begins. A finished or
    stopped course has nothing left to re-time.
    """
    course = _course(db, course_id)
    _assert_access(db, me, _patient(db, course.patient_id))
    if course.status not in (COURSE_ACTIVE, COURSE_AWAITING):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Course is {course.status}")
    try:
        pending = engine.retime_course(db, course, body.times)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    audit.log_activity(db, me.user_id, "medicine.course.retime", "medicine_course",
                       {"course_id": course_id, "times": course.times_csv, "doses": pending})
    db.commit()
    return _out(db, [course])[0]


@router.get("/medicine-doses/today", response_model=TodayResult)
def todays_doses(
    patient_id: UUID | None = Query(None),
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """Every dose due today, in time order, for "Today's Medicines".

    Today is the HOSPITAL's day, not the server's: a dose stored as 03:30 UTC is
    a 9am Indian morning, and bracketing on UTC midnight would push the evening
    doses onto the wrong date.

    Skipped doses are left out. They are the ones a stopped course or a missed
    window retired, and listing them would read as "you failed to take this"
    when the patient was never nudged at all.
    """
    patient = _me_patient(db, me) if patient_id is None else _patient(db, patient_id)
    _assert_access(db, me, patient)

    tz = engine._tz(db, patient.hospital_id)
    today = datetime.now(tz).date()
    day_start = datetime.combine(today, time.min, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)
    day_end = day_start + timedelta(days=1)

    rows = db.scalars(
        select(MedicineReminder)
        .options(selectinload(MedicineReminder.course))
        .where(
            MedicineReminder.patient_id == patient.patient_id,
            MedicineReminder.send_at >= day_start,
            MedicineReminder.send_at < day_end,
            MedicineReminder.status != DOSE_SKIPPED,
        )
        .order_by(MedicineReminder.send_at)
    ).all()

    out = [_today_dose(db, r) for r in rows]
    return TodayResult(
        doses=out, total=len(out),
        taken=sum(1 for r in out if r.status == DOSE_TAKEN),
    )


@router.get("/medicine-doses/upcoming", response_model=list[TodayDoseOut])
def upcoming_doses(
    days: int = Query(14, ge=1, le=30),
    patient_id: UUID | None = Query(None),
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """Doses still to come, so a phone can schedule its own local alarms.

    `days` is a CEILING, not a promise. Nothing is generated here — these are
    the rows the outbox already holds, created when the course started. Ask for
    14 days of a 3-day course and you get 3 days: the rows simply run out. An
    app must therefore schedule what it receives, not what it asked for.

    Only `pending` doses: a dose already sent, taken or skipped needs no alarm.

    Why it exists: `/medicine-doses/today` answers "what now", which is the
    dashboard's question. A phone setting alarms needs the opposite — the next
    fortnight in one call, rather than one request per medicine stitched
    together on the device.
    """
    patient = _me_patient(db, me) if patient_id is None else _patient(db, patient_id)
    _assert_access(db, me, patient)

    now = utcnow()
    horizon = now + timedelta(days=days)
    rows = db.scalars(
        select(MedicineReminder)
        .options(selectinload(MedicineReminder.course))
        .join(MedicineCourse, MedicineCourse.course_id == MedicineReminder.course_id)
        .where(
            MedicineReminder.patient_id == patient.patient_id,
            MedicineReminder.status == DOSE_PENDING,
            MedicineReminder.send_at >= now,
            MedicineReminder.send_at < horizon,
            MedicineCourse.status == COURSE_ACTIVE,
        )
        .order_by(MedicineReminder.send_at)
    ).all()
    return [_today_dose(db, r) for r in rows]


@router.post("/medicine-doses/{reminder_id}/taken", response_model=TodayDoseOut)
def mark_dose_taken(
    reminder_id: UUID,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """The patient tapped "Take now" — record that they actually took it.

    Allowed from `pending` (taken before the reminder went out) and from `sent`
    (tapped after reading it). Marking a pending dose taken means the ticker
    will not send it, which is correct: there is nothing to remind about.

    Deliberately NOT allowed to un-take. An accidental tap is a wrong record
    either way, and a patient who then un-taps a dose they DID take leaves a
    worse one. If this turns out to matter, it wants its own considered flow.
    """
    dose = db.get(MedicineReminder, reminder_id)
    if not dose:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Dose not found")
    _assert_access(db, me, _patient(db, dose.patient_id))
    if dose.status == DOSE_TAKEN:
        return _today_dose(db, dose)          # idempotent: a double tap is fine
    # `failed` is allowed too. It means OUR reminder did not go out — a WhatsApp
    # the provider accepted without a message id, a patient with no number on
    # file — and none of that says anything about whether the tablet was
    # swallowed. Refusing the tap answered "Dose is failed", which reads like
    # the patient did something wrong and left a real dose unrecorded, so the
    # doctor saw a gap in adherence that never happened. The delivery failure
    # stays on the row in `last_error`; it is a separate fact from this one.
    if dose.status not in (DOSE_PENDING, DOSE_SENT, DOSE_FAILED):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Dose is {dose.status}")

    dose.status = DOSE_TAKEN
    dose.taken_at = utcnow()
    audit.log_activity(db, me.user_id, "medicine.dose.taken", "medicine_reminder",
                       {"reminder_id": reminder_id, "course_id": dose.course_id})
    db.commit()
    return _today_dose(db, dose)


@router.post("/medicine-reminders/run", response_model=dict)
def run_ticker(
    me: User = Depends(require_permission("notification", "create")),
    db: Session = Depends(get_db),
):
    """Dispatch everything due right now.

    Manual trigger for testing and for a cron/Lambda that would rather call HTTP
    than import the app. Idempotent — running it twice sends nothing twice.
    """
    return engine.dispatch_due(db, limit=500)
