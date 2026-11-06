"""
Free revisit pass — issue, look up, redeem.

Every rule about the pass lives here. The routers and the token engine call in;
none of them assemble a pass themselves. That matters most at redemption: a
redeemed visit MUST carry `consultation_fee = 0` rather than the normal fee left
unpaid, because `routers/tokens.py` SKIPS unpaid patients when calling the next
token — a patient with an unpaid fee sits in the queue being passed over, silently,
until they complain at the desk.

See docs/free-revisit-pass.md for the design and the decisions behind it.
"""
from __future__ import annotations
from uuid import UUID

from datetime import date, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import utcnow
from ..models import (
    Appointment, Doctor, DoctorAffiliation, FamilyMember, Hospital,
    HospitalSettings, Patient, RevisitPass,
)
from ..models.revisit_pass import (
    PASS_ACTIVE, PASS_EXPIRED, PASS_REDEEMED, PASS_VOID,
)


def _clean(days: Optional[int]) -> Optional[int]:
    """A stored window as the rest of the module wants it: a positive int or None.

    0 or negative reads the same as NULL, so a hospital or doctor can withdraw the
    offer by typing 0 without having to null the column.
    """
    if days is None:
        return None
    days = int(days)
    return days if days > 0 else None


def window_days(db: Session, hospital_id: Optional[UUID],
                affiliation_id: Optional[UUID] = None) -> Optional[int]:
    """How long the free revisit lasts for the practice a visit happened at.

    Whoever owns the fee owns the waiver, so the window is read from whoever that
    is:

      - a practice the doctor runs themselves (`managed_by_hospital` False) has
        no hospital to answer for it — the window is on the affiliation row
      - a hospital-run practice takes the hospital's `hospital_settings` value

    A personal practice NEVER falls through to the hospital. It has to not, and
    this is the whole reason the affiliation is consulted first. A self-registered
    doctor's personal affiliation carries `hospital_id = NULL`, but appointments
    fall back to `doctor.hospital_id` (routers/appointments.py:410), which for a
    solo doctor is the default anchor tenant `_default_hospital_id` picked — the
    lowest active hospital. Falling through would hand every solo doctor the free
    revisit policy of a hospital they do not work for, never configured, and cannot
    see; and would spend that hospital's money doing it.

    NULL means "not offered", deliberately NOT "fall back to a platform default" —
    otherwise shipping this would silently switch a free consultation on for
    everyone. `settings.free_revisit_days` is only what the settings form
    pre-fills; it is never applied to a practice that has not chosen a value.
    """
    if affiliation_id is not None:
        aff = db.get(DoctorAffiliation, affiliation_id)
        if aff is not None and not aff.managed_by_hospital:
            return _clean(aff.free_revisit_days)
    if hospital_id is None:
        return None
    row = db.scalar(select(HospitalSettings).where(HospitalSettings.hospital_id == hospital_id))
    if row is None:
        return None
    return _clean(row.free_revisit_days)


def active_pass(db: Session, patient_id: UUID, doctor_id: UUID,
                family_member_id: Optional[UUID] = None) -> Optional[RevisitPass]:
    """The patient's live pass with this doctor, or None.

    Expiry is evaluated on read rather than by a nightly job: a pass is only ever
    interesting when someone looks at it, and a row that quietly passed its date
    should never be offered at the counter.
    """
    row = db.scalar(
        select(RevisitPass).where(
            RevisitPass.patient_id == patient_id,
            RevisitPass.doctor_id == doctor_id,
            RevisitPass.family_member_id == family_member_id,
            RevisitPass.status == PASS_ACTIVE,
        )
    )
    if row is None:
        return None
    if row.valid_until < date.today():
        row.status = PASS_EXPIRED
        return None
    return row


def list_for_patient(db: Session, patient_id: UUID) -> list[RevisitPass]:
    """Every live pass this patient holds, newest expiry first (dashboard card)."""
    rows = db.scalars(
        select(RevisitPass)
        .where(RevisitPass.patient_id == patient_id, RevisitPass.status == PASS_ACTIVE)
        .order_by(RevisitPass.valid_until.asc())
    ).all()
    live = []
    for row in rows:
        if row.valid_until < date.today():
            row.status = PASS_EXPIRED      # lazily reap what we walked past
        else:
            live.append(row)
    return live


def _earned_by_a_revisit(db: Session, appt: Optional[Appointment]) -> bool:
    """Was the visit that just finished itself a redeemed pass?

    A free revisit must not earn another one, or a patient could chain free
    visits forever.
    """
    if appt is None:
        return False
    return db.scalar(
        select(RevisitPass.pass_id).where(RevisitPass.redeemed_appointment_id == appt.appointment_id)
    ) is not None


def maybe_issue(db: Session, appt: Optional[Appointment], *, on_date: Optional[date] = None) -> Optional[RevisitPass]:
    """Issue a pass for a just-completed consultation, if it qualifies.

    Returns None — silently, never raising — whenever it does not. This is called
    from `token_engine.finish_serving`, and no failure here may ever stop a
    consultation from completing.
    """
    if appt is None:
        return None
    days = window_days(db, appt.hospital_id, getattr(appt, "affiliation_id", None))
    if days is None:
        return None                                  # hospital has not opted in
    if float(appt.consultation_fee or 0) <= 0:
        return None                                  # nothing was paid for
    if _earned_by_a_revisit(db, appt):
        return None                                  # no chaining
    if active_pass(db, appt.patient_id, appt.doctor_id, appt.family_member_id):
        return None                                  # already holds one

    issued = on_date or date.today()
    row = RevisitPass(
        hospital_id=appt.hospital_id,
        doctor_id=appt.doctor_id,
        affiliation_id=getattr(appt, "affiliation_id", None),
        patient_id=appt.patient_id,
        family_member_id=getattr(appt, "family_member_id", None),
        source_appointment_id=appt.appointment_id,
        issued_on=issued,
        valid_until=issued + timedelta(days=days),
        status=PASS_ACTIVE,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        # The partial unique index caught a race — another consultation for the
        # same (patient, doctor) issued one microseconds earlier. Theirs stands.
        db.rollback()
        return None
    return row


def redeem(db: Session, row: RevisitPass, appointment_id: UUID, by: Optional[int]) -> RevisitPass:
    """Mark a pass used against a visit. Caller owns creating that visit."""
    row.status = PASS_REDEEMED
    row.redeemed_appointment_id = appointment_id
    row.redeemed_at = utcnow()
    row.redeemed_by = by
    return row


def restore(db: Session, appointment_id: UUID) -> Optional[RevisitPass]:
    """Give a pass back when the visit it was spent on is cancelled.

    Without this, a patient who books online with their free revisit and then
    cancels has silently lost it — the entitlement is gone and there is no screen
    anywhere that explains where it went. Cancelling a paid visit costs them
    nothing, so cancelling a free one must not cost them the pass.

    Restored to ACTIVE only while `valid_until` still stands; a cancellation
    after the window closed leaves it EXPIRED, because handing back a pass that
    can never be used would show a live card the counter would then refuse.

    The partial unique index means this cannot resurrect a duplicate: if the
    patient already earned a fresh pass with the same doctor while this one was
    spent, restoring would collide, so we leave the redeemed row alone and keep
    the newer pass.
    """
    row = db.scalar(
        select(RevisitPass).where(
            RevisitPass.redeemed_appointment_id == appointment_id,
            RevisitPass.status == PASS_REDEEMED,
        )
    )
    if row is None:
        return None
    if row.valid_until < date.today():
        row.status = PASS_EXPIRED
        row.redeemed_appointment_id = None
        row.redeemed_at = None
        row.redeemed_by = None
        return row
    clash = db.scalar(
        select(RevisitPass.pass_id).where(
            RevisitPass.patient_id == row.patient_id,
            RevisitPass.doctor_id == row.doctor_id,
            RevisitPass.family_member_id == row.family_member_id,
            RevisitPass.status == PASS_ACTIVE,
        )
    )
    if clash is not None:
        return None                      # they already hold a newer one
    row.status = PASS_ACTIVE
    row.redeemed_appointment_id = None
    row.redeemed_at = None
    row.redeemed_by = None
    return row


def void_for_doctor(db: Session, doctor_id: UUID, hospital_id: Optional[UUID] = None) -> int:
    """Withdraw live passes — the doctor no longer consults here.

    Not wired to anything yet; offered so the affiliation-ending path has an
    obvious call when someone builds it.
    """
    stmt = select(RevisitPass).where(
        RevisitPass.doctor_id == doctor_id, RevisitPass.status == PASS_ACTIVE
    )
    if hospital_id is not None:
        stmt = stmt.where(RevisitPass.hospital_id == hospital_id)
    rows = db.scalars(stmt).all()
    for row in rows:
        row.status = PASS_VOID
    return len(rows)


def describe(db: Session, row: RevisitPass) -> dict:
    """Flat view for the API: who the pass is FOR, which doctor, how long left.

    `for_name` is the person the free visit belongs to — the dependant when the
    earning visit was theirs, the account holder otherwise. Both the patient's
    card and the front-desk badge need it: one account can hold several passes
    with the same doctor for different people, and "Free revisit available" with
    no name invites the desk to redeem the sister's visit for the brother.
    """
    doctor = db.get(Doctor, row.doctor_id)
    hospital = db.get(Hospital, row.hospital_id) if row.hospital_id else None
    patient = db.get(Patient, row.patient_id)
    member = db.get(FamilyMember, row.family_member_id) if row.family_member_id else None
    days_left = (row.valid_until - date.today()).days
    return {
        "pass_id": row.pass_id,
        "doctor_id": row.doctor_id,
        "doctor_name": doctor.name if doctor else "",
        "hospital_id": row.hospital_id,
        "hospital_name": hospital.name if hospital else "",
        "patient_id": row.patient_id,
        "patient_name": patient.name if patient else "",
        "family_member_id": row.family_member_id,
        "family_member_name": member.name if member else None,
        "for_name": (member.name if member else (patient.name if patient else "")),
        "issued_on": row.issued_on,
        "valid_until": row.valid_until,
        "days_left": max(0, days_left),
        "status": row.status,
    }
