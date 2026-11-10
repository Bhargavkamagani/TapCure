"""Medicine-reminder engine: plan courses, materialise doses, dispatch what's due.

Deliberately split from any scheduler. `dispatch_due()` is a plain function over
a Session, so the same code runs from an in-process ticker on the EC2 box, a
cron job, or an EventBridge-triggered Lambda — only the caller changes. Nothing
here knows how it was invoked.
"""
from uuid import UUID
import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import utcnow
from ..models import (
    FamilyMember, Hospital, HospitalSettings, MedicineCourse, MedicineReminder,
    Patient, Prescription, PrescriptionItem,
)
from ..models.medicine_reminder import (
    COURSE_ACTIVE, COURSE_AWAITING, COURSE_COMPLETED, COURSE_STOPPED,
    DOSE_FAILED, DOSE_PENDING, DOSE_SENT, DOSE_SKIPPED,
)
from . import medicine_schedule as sched
from . import notifications as notify
from . import whatsapp_templates as wa

DEFAULT_TZ = "Asia/Kolkata"
# Windows ships no tz database, and a slim container may not either. IST has no
# DST, so a fixed +05:30 is exactly right for India and keeps reminders working
# where `zoneinfo` can't load a key. `tzdata` is in requirements so this is a
# safety net, not the normal path.
IST_FALLBACK = timezone(timedelta(hours=5, minutes=30), "IST")


def _tz(db: Session, hospital_id: UUID):
    """Hospital-local timezone — dose times are wall-clock, not UTC."""
    row = db.scalar(select(HospitalSettings).where(HospitalSettings.hospital_id == hospital_id))
    for key in ((row.timezone if row else None), DEFAULT_TZ):
        if not key:
            continue
        try:
            return ZoneInfo(key)
        except Exception:
            continue
    return IST_FALLBACK


def _quiet_shift(t: time) -> time:
    """Push a dose out of the do-not-disturb window.

    Nobody wants a 3 AM 'take your tablet' buzz. A dose landing inside quiet
    hours is moved to the moment they end rather than dropped — the patient
    still needs to know about it.
    """
    start = settings.reminder_quiet_start   # e.g. 22 -> 22:00
    end = settings.reminder_quiet_end       # e.g. 7  -> 07:00
    hour = t.hour + t.minute / 60
    in_quiet = (hour >= start or hour < end) if start > end else (end > hour >= start)
    return time(end, 0) if in_quiet else t


# ---------------------------------------------------------------- planning ---
def plan_courses(db: Session, rx: Prescription, items: list[PrescriptionItem] | None = None) -> list[MedicineCourse]:
    """Create an `awaiting_start` course for every schedulable line of an Rx.

    Unreadable frequency/duration (e.g. "SOS", "continue") simply yields no
    course — see medicine_schedule for why we never guess. Does not commit.

    `items` limits planning to those lines. Passed when medicines are added to a
    prescription later, so lines that already have a course aren't planned twice.
    """
    if items is None:
        items = db.scalars(
            select(PrescriptionItem).where(PrescriptionItem.prescription_id == rx.prescription_id)
        ).all()
    created: list[MedicineCourse] = []
    for item in items:
        plan = sched.plan_for_item(item.frequency, item.duration, item.instructions)
        if not plan:
            continue
        times = [_quiet_shift(t) for t in plan["times"]]
        course = MedicineCourse(
            hospital_id=rx.hospital_id, patient_id=rx.patient_id,
            prescription_id=rx.prescription_id, item_id=item.item_id,
            family_member_id=rx.family_member_id,
            drug_name=item.drug_name, dosage=item.dosage, food_note=plan["food"],
            slots=",".join(plan["slots"]),
            times_csv=",".join(t.strftime("%H:%M") for t in times),
            days=plan["days"], status=COURSE_AWAITING,
        )
        db.add(course)
        created.append(course)
    if created:
        db.flush()
    return created


def start_course(db: Session, course: MedicineCourse, start_on: date | None = None) -> int:
    """Confirm the patient has the medicine, and materialise the dose outbox.

    `start_on` defaults to today. Doses whose time has already passed today are
    created as `skipped`, not `pending` — otherwise starting a course at 8 PM
    would immediately fire the 9 AM and 2 PM nudges in a burst.

    Returns the number of doses now pending. Does not commit.
    """
    tz = _tz(db, course.hospital_id)
    start_on = start_on or datetime.now(tz).date()
    now = utcnow()

    # Re-starting replaces any previous plan rather than layering on top of it.
    for old in list(course.doses):
        if old.status == DOSE_PENDING:
            db.delete(old)
    db.flush()

    pending = 0
    for day in range(course.days):
        dose_day = start_on + timedelta(days=day)
        for slot, at in zip(course.slot_list, course.time_list):
            # Store naive UTC like every other timestamp in the app (see
            # database.utcnow) — the DB columns are timestamptz, but mixing
            # naive and aware values makes every comparison a TypeError.
            local = datetime.combine(dose_day, at, tzinfo=tz)
            send_at = local.astimezone(timezone.utc).replace(tzinfo=None)
            due_passed = send_at <= now
            db.add(MedicineReminder(
                course_id=course.course_id, hospital_id=course.hospital_id,
                patient_id=course.patient_id, dose_date=dose_day, slot=slot,
                send_at=send_at, status=DOSE_SKIPPED if due_passed else DOSE_PENDING,
            ))
            if not due_passed:
                pending += 1

    course.status = COURSE_ACTIVE
    course.start_date = start_on
    course.started_at = now
    db.flush()
    return pending


def retime_course(db: Session, course: MedicineCourse, times: list[str]) -> int:
    """Move a course onto the patient's own clock times. Returns doses pending.

    The fixed 9 / 2 / 9 defaults suit nobody in particular — someone up at six
    gets their "morning" dose three hours late. The times were always stored per
    course (`times_csv`); only the input path was missing, so this needs no
    schema change.

    Two things it deliberately does NOT do:

    * It does not move doses that already went out. `start_course` rebuilds only
      the pending rows and marks anything already past today as skipped, so
      changing your morning time at 2pm cannot re-fire this morning's nudge.
    * It does not restart the course. `start_date` is passed back in, so a
      medicine on day 3 of 5 still finishes on day 5 — rescheduling from today
      would quietly extend the treatment by two days.

    The patient's choice also overrides the quiet-hours shift. Someone who
    deliberately sets 10:30pm means it; silently moving them to 7am would be the
    app overruling a person about their own medicine.
    """
    cleaned: list[str] = []
    for raw in times:
        text = str(raw or "").strip()
        m = re.fullmatch(r"([01]?\d|2[0-3]):([0-5]\d)", text)
        if not m:
            raise ValueError(f"'{text}' is not a time like 07:00")
        cleaned.append(f"{int(m.group(1)):02d}:{m.group(2)}")

    if len(cleaned) != len(course.slot_list):
        raise ValueError(
            f"This medicine has {len(course.slot_list)} dose(s) a day, so it needs "
            f"{len(course.slot_list)} time(s)"
        )

    course.times_csv = ",".join(cleaned)
    db.flush()

    # Nothing to re-plan until the patient has actually started the course.
    if course.status != COURSE_ACTIVE:
        return 0
    return start_course(db, course, course.start_date)


def stop_course(db: Session, course: MedicineCourse, reason: str = "") -> int:
    """End a course early; drop every dose that hasn't gone out yet."""
    stopped = 0
    for dose in course.doses:
        if dose.status == DOSE_PENDING:
            dose.status = DOSE_SKIPPED
            stopped += 1
    course.status = COURSE_STOPPED
    course.stopped_at = utcnow()
    course.stop_reason = reason[:200]
    db.flush()
    return stopped


# -------------------------------------------------------------- dispatching ---
def greeting_for(patient: Patient, member: FamilyMember | None, to_member: bool) -> tuple[str, str]:
    """`(name to greet, whose medicine it is)` for whoever is READING this.

    A dependent's course can land on the account holder's phone, and greeting
    the dependent there is wrong: a parent minding a child's course read
    "Hi Raju" on their own handset and had to work out it was theirs to act on.
    So the greeting follows the phone, and the possessive names the patient.
    """
    if member is not None and not to_member:
        greet = ((patient.name if patient else "") or "there").split()[0]
        return greet, f"{((member.name or 'their').split()[0])}'s"
    greet = (((member.name if member else (patient.name if patient else "")) or "there")).split()[0]
    return greet, "your"


def build_message(course: MedicineCourse, patient: Patient, member: FamilyMember | None,
                  to_member: bool = True) -> str:
    """Plain-text copy of the nudge — this is what SMS actually sends."""
    greet, whose = greeting_for(patient, member, to_member)
    bits = [f"Hi {greet}, time for {whose} {course.drug_name}"]
    if course.dosage:
        bits.append(f" ({course.dosage})")
    if course.food_note:
        bits.append(f" — {course.food_note}")
    return "".join(bits) + ". — TapCure"


def _recipient(db: Session, course: MedicineCourse):
    """Patient + dependent + phone, and whether that phone is the dependent's own.

    The phone still comes from the ONE resolver shared with token alerts and
    delay notices — a dependent who opted into their own number must get
    medicine nudges there too. `to_member` only reports which way it went, so
    the wording can follow the handset.
    """
    patient = db.get(Patient, course.patient_id)
    member = db.get(FamilyMember, course.family_member_id) if course.family_member_id else None
    phone, to_member = notify.reminder_recipient(patient, member, db)
    return patient, member, phone, to_member


def _send(db: Session, phone: str, message: str, course: MedicineCourse,
          patient: Patient, member: FamilyMember | None, to_member: bool = True) -> str:
    """Deliver on the hospital's preferred channel. Returns the channel used.

    WhatsApp needs the approved TEMPLATE plus its ordered parameters, not the
    `message` text: outside the 24-hour service window Meta drops anything else.
    This used to call send_whatsapp() with neither, which the provider path
    rejects as `missing_template` — the dose was recorded as sent and the patient
    was never nudged. `message` is still passed through as the human-readable
    copy of the notification record (and is what SMS actually sends).
    """
    row = db.scalar(select(HospitalSettings).where(HospitalSettings.hospital_id == course.hospital_id))
    from . import booking_quota
    # A Starter plan has no WhatsApp alerts (the pricing cards): fall back like
    # a hospital that turned WhatsApp off.
    use_whatsapp = bool(row and row.whatsapp_enabled) and booking_quota.whatsapp_allowed(db, course.hospital_id)
    refs ={"hospital_id": course.hospital_id, "patient_id": course.patient_id}
    if use_whatsapp:
        who, whose = greeting_for(patient, member, to_member)
        n = notify.send_whatsapp(
            db, phone, message, ntype="reminder", title="Medicine reminder",
            template_name=wa.medicine_reminder_name(),
            template_params=wa.medicine_reminder_params(
                who, course.drug_name, course.dosage, course.food_note, whose=whose
            ),
            language_code=settings.whatsapp_default_lang,
            event_type=wa.MEDICINE_REMINDER_EVENT, **refs,
        )
        # A rejected send must not read as a delivered dose. Raising puts the row
        # in `failed` with the provider's reason, which is what the hospital sees.
        if n.status == "failed":
            code = n.whatsapp_log.error_code if n.whatsapp_log else "unknown"
            raise RuntimeError(f"whatsapp send failed ({code})")
        return "whatsapp"
    notify.send_sms(db, phone, message, ntype="reminder", title="Medicine reminder", **refs)
    return "sms"


def dispatch_due(db: Session, now: datetime | None = None, limit: int = 200) -> dict:
    """Send every dose that has come due. The whole job, in one call.

    Idempotent: a dose is only ever picked up while `pending`, and its status is
    written in the same transaction as the send, so two overlapping ticks cannot
    double-nudge. A dose with no reachable phone is failed, not retried forever.
    """
    now = now or utcnow()

    # Retire anything too late to be useful BEFORE selecting what to send. A
    # dose nobody was nudged about at the time is not worth a message hours
    # later, and without this the first run after any outage delivers the entire
    # backlog in one burst — a month of stopped ticks would arrive at once.
    cutoff = now - timedelta(minutes=settings.reminder_max_late_minutes)
    stale = db.scalars(
        select(MedicineReminder).where(
            MedicineReminder.status == DOSE_PENDING,
            MedicineReminder.send_at < cutoff,
        )
    ).all()
    for dose in stale:
        dose.status = DOSE_SKIPPED
        dose.last_error = "not sent — missed its window"
    if stale:
        db.flush()

    due = db.scalars(
        select(MedicineReminder)
        .join(MedicineCourse, MedicineCourse.course_id == MedicineReminder.course_id)
        .where(
            MedicineReminder.status == DOSE_PENDING,
            MedicineReminder.send_at <= now,
            MedicineReminder.send_at >= cutoff,
            MedicineCourse.status == COURSE_ACTIVE,
        )
        .order_by(MedicineReminder.send_at)
        .limit(limit)
    ).all()

    sent = failed = 0
    for dose in due:
        course = db.get(MedicineCourse, dose.course_id)
        dose.attempts += 1
        try:
            patient, member, phone, to_member = _recipient(db, course)
            if not phone:
                raise ValueError("no reminder phone for this patient")
            message = build_message(course, patient, member, to_member)
            dose.channel = _send(db, phone, message, course, patient, member, to_member)
            dose.sent_to = phone
            dose.status = DOSE_SENT
            dose.sent_at = utcnow()
            sent += 1
        except Exception as exc:                     # never let one bad row stop the batch
            dose.status = DOSE_FAILED
            dose.last_error = str(exc)[:500]
            failed += 1
    _close_finished(db, now)
    db.commit()
    return {"due": len(due), "sent": sent, "failed": failed, "at": now.isoformat()}


def _close_finished(db: Session, now: datetime) -> int:
    """Mark courses complete once their last dose is behind us."""
    active = db.scalars(select(MedicineCourse).where(MedicineCourse.status == COURSE_ACTIVE)).all()
    done = 0
    for course in active:
        if any(d.status == DOSE_PENDING for d in course.doses):
            continue
        course.status = COURSE_COMPLETED
        done += 1
    return done
