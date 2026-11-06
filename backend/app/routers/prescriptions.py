"""
Prescriptions — a doctor writes an Rx (diagnosis + drugs + advice) at a visit;
the patient reads their own in the app.

Access mirrors the Patient module: a PATIENT user is confined to their own
records, staff to their tenant (or any global patient who has booked there).
Creation reuses the existing `appointment.update` permission (doctors / front
desk hold it) so no new RBAC rows need seeding; reads use `patient.read`.
"""
from uuid import UUID
import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import ensure_same_tenant, require_permission
from ..models import (
    Appointment, Doctor, DoctorAffiliation, FamilyMember, FollowUp, Hospital, MedicineCourse,
    MedicineReminder, Patient, PharmacyDispense, PharmacyStock,
    Prescription, PrescriptionItem, User,
)
from ..models.medicine_reminder import COURSE_ACTIVE, COURSE_AWAITING
from ..schemas.prescription import (
    PrescriptionCreate, PrescriptionItemIn, PrescriptionItemsAdd, PrescriptionOut,
)
from ..services import audit
from ..services import family_link
from ..services import prescription_pdf
from ..services import reception_scope
from ..services import reminder_engine
from ..services import visit_wrapup

logger = logging.getLogger(__name__)

router = APIRouter(tags=["prescriptions"])


def _patient(db: Session, patient_id: UUID) -> Patient:
    p = db.get(Patient, patient_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    return p


def _assert_access(db: Session, me: User, patient: Patient) -> None:
    """PATIENT users see only their own; staff see their tenant or any global
    patient who has booked at their hospital."""
    role = me.role.name if me.role else None
    if role == "PATIENT":
        if patient.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your record")
        return
    if role == "SUPER_ADMIN" or patient.hospital_id == me.hospital_id:
        return
    booked_here = db.scalar(
        select(Appointment.appointment_id).where(
            Appointment.patient_id == patient.patient_id,
            Appointment.hospital_id == me.hospital_id,
        )
    )
    if not booked_here:
        ensure_same_tenant(me, patient.hospital_id)  # raises 403 for other tenants


def _viewer_doctor_id(db: Session, me: User) -> int | None:
    if not (me.role and me.role.name == "DOCTOR"):
        return None
    return db.scalar(select(Doctor.doctor_id).where(Doctor.user_id == me.user_id))


def _scope_prescriptions(db: Session, stmt, me: User):
    """Patients see their own Rx; doctors see only Rx they personally issued.

    RECEPTIONIST sees Rx written at their own hospital for the hospital's own
    practice (a hospital-managed visit, or no visit and a hospital-employed
    doctor) — never a solo doctor's personal practice — and only for doctors
    they are assigned to. Hospital admins still receive no prescription
    contents.
    """
    role = me.role.name if me.role else None
    if role == "PATIENT":
        # Also the Rx written for them under someone else's account, once that
        # family link is confirmed by both sides.
        return stmt.where(family_link.visible_condition(
            db, me, Prescription,
            select(Patient.patient_id).where(Patient.user_id == me.user_id),
        ))
    if role == "DOCTOR":
        doctor_id = _viewer_doctor_id(db, me)
        return stmt.where(Prescription.doctor_id == doctor_id) if doctor_id else stmt.where(False)
    if role == "RECEPTIONIST" and me.hospital_id:
        hospital_visit = select(Appointment.appointment_id).outerjoin(
            DoctorAffiliation, DoctorAffiliation.affiliation_id == Appointment.affiliation_id,
        ).where(
            Appointment.appointment_id == Prescription.appointment_id,
            or_(Appointment.affiliation_id.is_(None), DoctorAffiliation.managed_by_hospital.is_(True)),
        ).exists()
        hospital_doctor = select(Doctor.doctor_id).where(
            Doctor.doctor_id == Prescription.doctor_id,
            Doctor.hospital_id == me.hospital_id,
            Doctor.is_self_registered.is_not(True),
        ).exists()
        stmt = stmt.where(
            Prescription.hospital_id == me.hospital_id,
            or_(hospital_visit, and_(Prescription.appointment_id.is_(None), hospital_doctor)),
        )
        return reception_scope.restrict(stmt, Prescription.doctor_id, db, me)
    return stmt.where(False)


def _enrich(db: Session, rows: list[Prescription]) -> list[PrescriptionOut]:
    doc_ids = {r.doctor_id for r in rows}
    hosp_ids = {r.hospital_id for r in rows}
    pat_ids = {r.patient_id for r in rows}
    fam_ids = {r.family_member_id for r in rows if r.family_member_id}
    doctors = {d.doctor_id: d for d in db.scalars(select(Doctor).where(Doctor.doctor_id.in_(doc_ids)))} if doc_ids else {}
    hospitals = {h.hospital_id: h for h in db.scalars(select(Hospital).where(Hospital.hospital_id.in_(hosp_ids)))} if hosp_ids else {}
    patients = {p.patient_id: p for p in db.scalars(select(Patient).where(Patient.patient_id.in_(pat_ids)))} if pat_ids else {}
    members = {m.member_id: m.name for m in db.scalars(select(FamilyMember).where(FamilyMember.member_id.in_(fam_ids)))} if fam_ids else {}
    out = []
    for r in rows:
        o = PrescriptionOut.model_validate(r)
        d = doctors.get(r.doctor_id)
        o.doctor_name = d.name if d else None
        o.doctor_specialty = d.specialization if d else None
        o.hospital_name = getattr(hospitals.get(r.hospital_id), "name", None)
        o.patient_name = getattr(patients.get(r.patient_id), "name", None)
        if r.family_member_id:
            o.family_member_name = members.get(r.family_member_id)
        out.append(o)
    return out


def _linkable_stock_ids(db: Session, body: PrescriptionCreate, doctor: Doctor) -> set[int]:
    """Stock rows a line may point at: only the pharmacy of the hospital this
    visit is at. Anything else is dropped rather than refused — the link is a
    hint for the pharmacy counter, and a stale one must never block the Rx."""
    wanted = {it.stock_id for it in body.items if it.stock_id}
    if not wanted:
        return set()
    hospitals = {doctor.hospital_id}
    if body.appointment_id:
        appt = db.get(Appointment, body.appointment_id)
        if appt and appt.doctor_id == doctor.doctor_id:
            hospitals.add(appt.hospital_id)
    return set(db.scalars(
        select(PharmacyStock.stock_id).where(
            PharmacyStock.stock_id.in_(wanted),
            PharmacyStock.hospital_id.in_(hospitals),
        )
    ))


@router.get("/prescriptions", response_model=list[PrescriptionOut])
def list_prescriptions(
    patient_id: UUID | None = Query(None),
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """List prescriptions. PATIENT → their own (any patient_id filter is ignored
    and replaced by their linked records); staff → scoped to a patient they may
    access (patient_id required, else their hospital's)."""
    stmt = select(Prescription).options(selectinload(Prescription.items))
    role = me.role.name if me.role else None
    if patient_id:
        _assert_access(db, me, _patient(db, patient_id))
        stmt = stmt.where(Prescription.patient_id == patient_id)
    stmt = _scope_prescriptions(db, stmt, me)
    rows = db.scalars(stmt.order_by(Prescription.created_at.desc())).all()
    return _enrich(db, rows)


@router.get("/patients/{patient_id}/prescriptions", response_model=list[PrescriptionOut])
def patient_prescriptions(
    patient_id: UUID,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    _assert_access(db, me, _patient(db, patient_id))
    stmt = _scope_prescriptions(
        db, select(Prescription).options(selectinload(Prescription.items))
        .where(Prescription.patient_id == patient_id)
        .order_by(Prescription.created_at.desc())
    , me)
    rows = db.scalars(stmt).all()
    return _enrich(db, rows)


@router.get("/prescriptions/{prescription_id}", response_model=PrescriptionOut)
def get_prescription(
    prescription_id: UUID,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    _assert_access(db, me, _patient(db, rx.patient_id))
    allowed = db.scalar(
        _scope_prescriptions(db, select(Prescription.prescription_id).where(
            Prescription.prescription_id == prescription_id
        ), me)
    )
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Prescription is private")
    return _enrich(db, [rx])[0]


def _readable_rx(db: Session, me: User, prescription_id: UUID) -> Prescription:
    """The prescription, if `me` may read it — the list's `_scope_prescriptions`
    rule (patient + confirmed family link, issuing doctor, own-hospital
    receptionist). A patient is not run through `_assert_access`, which would
    refuse the family-linked case the scope already allows."""
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    if not (me.role and me.role.name == "PATIENT"):
        _assert_access(db, me, _patient(db, rx.patient_id))
    allowed = db.scalar(
        _scope_prescriptions(db, select(Prescription.prescription_id).where(
            Prescription.prescription_id == prescription_id
        ), me)
    )
    if not allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Prescription is private")
    return rx


@router.get("/prescriptions/{prescription_id}/paper")
def prescription_paper(
    prescription_id: UUID,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """The letterhead, patient line and signature for the on-screen "paper" view
    — the same details the PDF is printed with. The medicines come from the
    prescription itself, which the caller already has."""
    return prescription_pdf.paper(db, _readable_rx(db, me, prescription_id))


@router.get("/prescriptions/{prescription_id}/pdf")
def prescription_pdf_download(
    prescription_id: UUID,
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    """The prescription as a PDF on the practice's letterhead, built fresh.

    Exactly the people who can read the prescription: the patient (and a
    confirmed family link), the doctor who wrote it, and that hospital's
    receptionist for their doctors — the same `_scope_prescriptions` rule as the
    list. A patient is not run through `_assert_access`, which would refuse the
    family-linked case the scope already allows.
    """
    rx = _readable_rx(db, me, prescription_id)
    pdf = prescription_pdf.build(db, rx)
    audit.log_activity(db, me.user_id, "prescription.pdf", "prescription",
                       {"prescription_id": str(prescription_id)})
    db.commit()
    name = f"prescription-{prescription_pdf.short_ref(rx.prescription_id)}.pdf"
    return Response(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{name}"',
        "Cache-Control": "no-store",
    })


@router.post("/prescriptions", response_model=PrescriptionOut, status_code=201)
def create_prescription(
    body: PrescriptionCreate,
    me: User = Depends(require_permission("appointment", "update")),
    db: Session = Depends(get_db),
):
    role = me.role.name if me.role else None
    if role != "DOCTOR":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a doctor can issue a prescription")
    patient = _patient(db, body.patient_id)
    _assert_access(db, me, patient)
    doctor = db.get(Doctor, body.doctor_id)
    if not doctor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    if doctor.user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only issue prescriptions as yourself")
    if not body.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one medicine")
    stock_ids = _linkable_stock_ids(db, body, doctor)
    rx = Prescription(
        hospital_id=doctor.hospital_id,
        patient_id=patient.patient_id,
        doctor_id=doctor.doctor_id,
        appointment_id=body.appointment_id,
        family_member_id=body.family_member_id,
        diagnosis=body.diagnosis,
        advice=body.advice,
        follow_up_date=body.follow_up_date,
        created_by=me.user_id,
        items=[
            PrescriptionItem(**{**it.model_dump(), "stock_id": it.stock_id if it.stock_id in stock_ids else None})
            for it in body.items
        ],
    )
    db.add(rx)
    db.flush()  # assign prescription_id before deriving the follow-up

    # Auto-create the follow-up when the doctor set a return date (one per Rx).
    # A date in the past can only be a typo (2026-07 for 2026-08, say) and would
    # land on the patient's card already overdue, so it's refused outright.
    if rx.follow_up_date and rx.follow_up_date < date.today():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Follow-up date {rx.follow_up_date} is in the past — pick a future date.",
        )
    if rx.follow_up_date:
        db.add(FollowUp(
            hospital_id=rx.hospital_id, patient_id=rx.patient_id,
            family_member_id=rx.family_member_id, doctor_id=rx.doctor_id,
            source_prescription_id=rx.prescription_id, source_appointment_id=rx.appointment_id,
            due_date=rx.follow_up_date, reason=(rx.diagnosis or "")[:200],
        ))

    # Plan medicine reminders for every line with a readable schedule. They sit
    # `awaiting_start` and send nothing until the patient confirms they actually
    # have the medicine — most buy it at an outside pharmacy, so the hospital can't
    # know when the course begins. Never let this block writing the Rx.
    try:
        reminder_engine.plan_courses(db, rx)
    except Exception:
        logger.exception("Could not plan medicine reminders for Rx %s", rx.prescription_id)

    # Tell the patient their prescription is ready — but only once the
    # consultation is also marked complete. When it isn't yet, this sends
    # nothing and `finish_serving` picks it up instead. Never let a message
    # cost the doctor their prescription.
    try:
        visit_wrapup.on_prescription_saved(db, rx)
    except Exception:
        logger.exception("Could not send prescription-ready message for Rx %s", rx.prescription_id)

    audit.log_activity(db, me.user_id, "prescription.create", "prescription", {"patient_id": patient.patient_id})
    db.commit()
    db.refresh(rx)
    return _enrich(db, [rx])[0]


# A doctor often prescribes again as the consultation ends. Appending is only
# offered while the visit is still going on; after that it's a new prescription.
APPEND_WINDOW_HOURS = 12


@router.post("/prescriptions/{prescription_id}/items", response_model=PrescriptionOut)
def add_prescription_items(
    prescription_id: UUID,
    body: PrescriptionItemsAdd,
    me: User = Depends(require_permission("appointment", "update")),
    db: Session = Depends(get_db),
):
    """Add medicines to the prescription already written at this visit.

    Opening the composer a second time used to create a SECOND prescription
    holding only the new tablet — which reads as "the first one disappeared"
    and splits one consultation into two prescriptions at the pharmacy counter.

    Append-only: existing lines are never changed or removed, so a medicine the
    pharmacy has already handed over stays exactly as it was.
    """
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    doctor_id = _viewer_doctor_id(db, me)
    if not doctor_id or rx.doctor_id != doctor_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only the doctor who wrote this prescription can add to it")
    # Written-at is timezone-aware from the database, naive UTC when just created.
    written = rx.created_at if rx.created_at.tzinfo else rx.created_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - written > timedelta(hours=APPEND_WINDOW_HOURS):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This prescription was written on {written.date()} — write a new prescription instead.",
        )
    if body.follow_up_date:
        if rx.follow_up_date:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"This prescription already has a follow-up on {rx.follow_up_date}.")
        if body.follow_up_date < date.today():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Follow-up date {body.follow_up_date} is in the past — pick a future date.",
            )

    doctor = db.get(Doctor, rx.doctor_id)
    stock_ids = _linkable_stock_ids(
        db,
        PrescriptionCreate(patient_id=rx.patient_id, doctor_id=rx.doctor_id,
                           appointment_id=rx.appointment_id, items=body.items),
        doctor,
    )
    added = [
        PrescriptionItem(prescription_id=rx.prescription_id,
                         **{**it.model_dump(), "stock_id": it.stock_id if it.stock_id in stock_ids else None})
        for it in body.items
    ]
    for item in added:
        db.add(item)
    db.flush()

    if body.follow_up_date:
        rx.follow_up_date = body.follow_up_date
        db.add(FollowUp(
            hospital_id=rx.hospital_id, patient_id=rx.patient_id,
            family_member_id=rx.family_member_id, doctor_id=rx.doctor_id,
            source_prescription_id=rx.prescription_id, source_appointment_id=rx.appointment_id,
            due_date=body.follow_up_date, reason=(rx.diagnosis or "")[:200],
        ))

    # Reminders for the NEW lines only; the lines already on the prescription
    # keep the courses they have. Never let this block the write.
    try:
        reminder_engine.plan_courses(db, rx, items=added)
    except Exception:
        logger.exception("Could not plan medicine reminders for added items on Rx %s", rx.prescription_id)

    # Appending is the doctor still writing the same prescription, so the same
    # one-per-visit guard applies: if the wrap-up already went out, this is
    # silently a no-op rather than a second message.
    try:
        visit_wrapup.on_prescription_saved(db, rx)
    except Exception:
        logger.exception("Could not send prescription-ready message for Rx %s", rx.prescription_id)

    audit.log_activity(db, me.user_id, "prescription.add_items", "prescription",
                       {"prescription_id": rx.prescription_id, "added": len(added)})
    db.commit()
    db.refresh(rx)
    return _enrich(db, [rx])[0]


def _editable_line(db: Session, me: User, prescription_id: UUID,
                   item_id: UUID) -> tuple[Prescription, PrescriptionItem]:
    """The guards shared by correcting and removing a single line.

    The first three are the same rules as appending — same doctor, same 12-hour
    window — deliberately, so a doctor learns one rule about today's
    prescription rather than two that differ by a few hours.

    The fourth is new here. Appending can never invalidate a medicine the
    pharmacy has already handed over; changing or deleting a line can. Once the
    counter has acted on a line the patient is holding an instruction, and
    editing the record behind their back makes the strip in their hand disagree
    with what we say we prescribed.
    """
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    doctor_id = _viewer_doctor_id(db, me)
    if not doctor_id or rx.doctor_id != doctor_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only the doctor who wrote this prescription can change it")
    written = rx.created_at if rx.created_at.tzinfo else rx.created_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - written > timedelta(hours=APPEND_WINDOW_HOURS):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This prescription was written on {written.date()} — it can no longer be changed.",
        )
    item = db.get(PrescriptionItem, item_id)
    if not item or item.prescription_id != rx.prescription_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That medicine is not on this prescription")
    # Either outcome counts as the pharmacy having acted: `given` means they
    # handed it over, `outside` means they sent the patient out to buy it. An
    # undone record doesn't count — that hand-over was taken back.
    handled = db.scalar(
        select(PharmacyDispense).where(
            PharmacyDispense.item_id == item.item_id,
            PharmacyDispense.undone_at.is_(None),
        ).limit(1)
    )
    if handled:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"The pharmacy has already dealt with {item.drug_name}. "
            f"Add a corrected line instead of changing this one.",
        )
    return rx, item


def _courses_for(db: Session, item: PrescriptionItem) -> list[MedicineCourse]:
    return db.scalars(
        select(MedicineCourse).where(MedicineCourse.item_id == item.item_id)
    ).all()


@router.patch("/prescriptions/{prescription_id}/items/{item_id}", response_model=PrescriptionOut)
def update_prescription_item(
    prescription_id: UUID,
    item_id: UUID,
    body: PrescriptionItemIn,
    me: User = Depends(require_permission("appointment", "update")),
    db: Session = Depends(get_db),
):
    """Correct one line of the prescription written at this visit.

    A doctor who mistyped a dose had no way back: the composer only ever
    appended, so the wrong line stayed on the record and a second, contradictory
    line joined it. At the pharmacy counter that reads as two prescriptions for
    the same drug.

    The reminder course is rebuilt rather than left alone, and that is the point
    of this endpoint rather than an afterthought. A dose corrected in the record
    but not in the reminders means the patient keeps being told, on their phone,
    to take the dose the doctor has just withdrawn — and a reminder that arrives
    at nine in the morning is far more likely to be obeyed than a line in an app
    nobody reopens. The old course is stopped, not deleted, so the record of
    what the patient was originally told survives.
    """
    rx, item = _editable_line(db, me, prescription_id, item_id)
    doctor = db.get(Doctor, rx.doctor_id)
    stock_ids = _linkable_stock_ids(
        db,
        PrescriptionCreate(patient_id=rx.patient_id, doctor_id=rx.doctor_id,
                           appointment_id=rx.appointment_id, items=[body]),
        doctor,
    )
    before = {
        "drug_name": item.drug_name, "dosage": item.dosage,
        "frequency": item.frequency, "duration": item.duration,
        "instructions": item.instructions,
    }
    fields = body.model_dump()
    fields["stock_id"] = body.stock_id if body.stock_id in stock_ids else None
    for field, value in fields.items():
        setattr(item, field, value)
    db.flush()

    # Never let reminder trouble block the correction itself: the prescription
    # is the record, and a doctor who has been told "saved" must not find the
    # old dose still on it. Same reasoning as the append path above.
    try:
        # Where a course the patient had ALREADY STARTED was up to. The
        # replacement resumes from that same day rather than today, so
        # correcting on day 2 of 5 still finishes on day 5 — restarting from
        # today would quietly extend the treatment by two days.
        resume_from = None
        for course in _courses_for(db, item):
            if course.status in (COURSE_AWAITING, COURSE_ACTIVE):
                if course.started_at is not None and resume_from is None:
                    resume_from = course.start_date
                reminder_engine.stop_course(db, course, "Prescription corrected by the doctor")
        replacements = reminder_engine.plan_courses(db, rx, items=[item])
        # `plan_courses` only ever creates a course `awaiting_start`, with no
        # dose rows: those are materialised by `start_course`, which fires on a
        # pharmacy hand-over or the patient's own "I've got it" tap. Neither
        # happens on a correction, and the patient answered that prompt days
        # ago — the app remembers per PRESCRIPTION and never asks twice. So
        # without this the replacement sat awaiting for ever and the patient,
        # mid-course, simply stopped being reminded. Verified: 9 doses due
        # before a correction, 0 after. Same move `retime_course` makes when a
        # patient changes their reminder times.
        if resume_from is not None:
            for course in replacements:
                reminder_engine.start_course(db, course, resume_from)
    except Exception:
        logger.exception("Could not re-plan reminders for item %s on Rx %s",
                         item.item_id, rx.prescription_id)

    # The before/after pair is the whole reason this can be an in-place edit
    # rather than a versioned record: activity_logs keeps what was overwritten.
    audit.log_activity(db, me.user_id, "prescription.update_item", "prescription",
                       {"prescription_id": rx.prescription_id, "item_id": item.item_id,
                        "before": before, "after": {k: v for k, v in fields.items() if k != "stock_id"}})
    db.commit()
    db.refresh(rx)
    return _enrich(db, [rx])[0]


@router.delete("/prescriptions/{prescription_id}/items/{item_id}", response_model=PrescriptionOut)
def remove_prescription_item(
    prescription_id: UUID,
    item_id: UUID,
    me: User = Depends(require_permission("appointment", "update")),
    db: Session = Depends(get_db),
):
    """Take one medicine off the prescription written at this visit.

    Removal exists alongside correction because a wrong DRUG cannot be fixed by
    editing a dose. Without it the doctor's only route is to retype the line as
    a different medicine — which leaves the reminder course and the pharmacy
    link attached to a row that has quietly become something else entirely.
    """
    rx, item = _editable_line(db, me, prescription_id, item_id)
    remaining = db.scalar(
        select(func.count()).select_from(PrescriptionItem)
        .where(PrescriptionItem.prescription_id == rx.prescription_id)
    )
    # An Rx with no medicines on it still shows in the patient's app as a
    # prescription, and reads as one that lost its contents. Making the doctor
    # add the replacement first costs one extra tap and avoids that state.
    if (remaining or 0) <= 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This is the only medicine on the prescription. Add the replacement "
            "first, then remove this one.",
        )
    courses = _courses_for(db, item)
    # A course the patient has already started cannot be unsaid — they have the
    # medicine and have been taking it, and the dose rows are the only record of
    # what they were told to do. Correcting keeps that history; deleting burns
    # it. So this refuses, and points at the other endpoint.
    if any(c.started_at is not None for c in courses):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"The patient has already started {item.drug_name}. "
            f"Correct the line instead of removing it.",
        )
    # medicine_courses.item_id is NOT NULL and its foreign key is ON DELETE NO
    # ACTION, so the course rows must go before the line they point at. Only
    # never-started courses reach here and a course materialises its doses when
    # it starts, so there is normally nothing to delete — the dose sweep below
    # is for a course stopped before it ever began.
    for course in courses:
        for dose in db.scalars(
            select(MedicineReminder).where(MedicineReminder.course_id == course.course_id)
        ).all():
            db.delete(dose)
        db.delete(course)
    db.flush()

    removed = {"drug_name": item.drug_name, "dosage": item.dosage,
               "frequency": item.frequency, "duration": item.duration}
    db.delete(item)
    audit.log_activity(db, me.user_id, "prescription.remove_item", "prescription",
                       {"prescription_id": rx.prescription_id, "item_id": item_id, "removed": removed})
    db.commit()
    db.refresh(rx)
    return _enrich(db, [rx])[0]


@router.delete("/prescriptions/{prescription_id}")
def delete_prescription(
    prescription_id: UUID,
    me: User = Depends(require_permission("appointment", "update")),
    db: Session = Depends(get_db),
):
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    doctor_id = _viewer_doctor_id(db, me)
    if not doctor_id or rx.doctor_id != doctor_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the issuing doctor can delete this prescription")
    db.delete(rx)
    db.commit()
    return {"message": "Prescription deleted"}
