"""
Free revisit pass — patient view, front-desk lookup, redemption.

A pass is an entitlement, not a booking: the patient walks in, the desk finds the
pass on their record and issues a zero-fee token. See docs/free-revisit-pass.md.

Permissions reuse the existing matrix (`appointment.read/create`, `patient.read`),
so this router adds no new permission strings and needs no sync_permissions run.

Those permissions say what KIND of thing you may do, never WHOSE. Every endpoint
here also has to answer "whose", because `patient.read` is held by every
receptionist at every hospital and by every patient — see `_assert_may_read` and
`_assert_may_redeem`.
"""
from uuid import UUID
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..deps import ensure_same_tenant, require_permission
from ..models import Appointment, Doctor, DoctorAffiliation, Patient, RevisitPass, User
from ..rbac import ROLE_DOCTOR, ROLE_PATIENT, ROLE_SUPER_ADMIN, is_hospital_staff
from ..services import revisit_pass as rp
from ..services import scheduling as sch
from ..services import token_engine as te

router = APIRouter(tags=["revisit-passes"])


class PassOut(BaseModel):
    pass_id: UUID
    doctor_id: UUID
    doctor_name: str
    hospital_id: Optional[UUID] = None
    hospital_name: str = ""
    patient_id: UUID
    patient_name: str = ""
    family_member_id: Optional[UUID] = None
    family_member_name: Optional[str] = None
    # Who the free visit belongs to — the dependant, or the account holder.
    for_name: str = ""
    issued_on: date
    valid_until: date
    days_left: int
    status: str


class RedeemRequest(BaseModel):
    notes: str = ""


class WindowOut(BaseModel):
    """One practice's free-revisit window, and who is allowed to change it."""
    affiliation_id: Optional[UUID] = None
    practice_name: str = ""
    managed_by_hospital: bool = True
    days: Optional[int] = None          # None = this practice offers no revisit
    editable: bool = False              # may the signed-in doctor change it here
    owner: str = "hospital"             # "hospital" | "doctor" — who sets it


def _patient_for(db: Session, me: User) -> Optional[Patient]:
    """The Patient row belonging to the signed-in user, if they are one."""
    if me.phone:
        row = db.scalar(select(Patient).where(Patient.phone == me.phone))
        if row:
            return row
    if me.email:
        return db.scalar(select(Patient).where(Patient.email == me.email))
    return None


def _own_doctor(db: Session, me: User) -> Optional[Doctor]:
    return db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))


def _forbid(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_403_FORBIDDEN, detail)


def _assert_may_read(db: Session, me: User, patient_id: UUID,
                     doctor_id: Optional[UUID] = None) -> None:
    """Who may ask about a patient's passes, and about which doctor's.

    `patient.read` gates these endpoints, and that permission is held by every
    receptionist at every hospital AND by every patient — so on its own it grants
    nothing but the right to ask a question about SOMEONE. Without this, any
    front desk could read any patient's entitlements at any other hospital, and any
    patient could read another patient's.

    A pass also discloses more than its own existence: it names the doctor and
    the hospital, so leaking one leaks that this patient was treated there.

      - PATIENT      — only their own record
      - DOCTOR       — only passes naming THEM as the doctor
      - hospital staff — only passes at their own hospital, and never a doctor's
                       personal practice
      - SUPER_ADMIN  — everything
    """
    role = me.role.name if me.role else None
    if role == ROLE_SUPER_ADMIN:
        return

    if role == ROLE_PATIENT:
        own = _patient_for(db, me)
        if not own or own.patient_id != patient_id:
            raise _forbid("Not your patient record")
        return

    if role == ROLE_DOCTOR:
        doctor = _own_doctor(db, me)
        if not doctor:
            raise _forbid("Doctor profile not linked")
        # A doctor asks about their OWN passes. Answering for another doctor
        # would tell them who else this patient is seeing.
        if doctor_id is not None and doctor_id != doctor.doctor_id:
            raise _forbid("You can only look up your own free revisits")
        return

    # Hospital staff. The patient must be reachable from this hospital at all...
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    if patient.hospital_id != me.hospital_id:
        booked_here = db.scalar(
            select(Appointment.appointment_id).where(
                Appointment.patient_id == patient_id,
                Appointment.hospital_id == me.hospital_id,
            ).limit(1)
        )
        if not booked_here:
            ensure_same_tenant(me, patient.hospital_id)   # raises 403
    # ...and if a specific doctor was named, that doctor must practise here.
    if doctor_id is not None:
        here = db.scalar(
            select(DoctorAffiliation.affiliation_id).where(
                DoctorAffiliation.doctor_id == doctor_id,
                DoctorAffiliation.hospital_id == me.hospital_id,
                DoctorAffiliation.managed_by_hospital.is_(True),
            ).limit(1)
        )
        if not here:
            raise _forbid("That doctor does not consult at this hospital")


def _visible(db: Session, me: User, rows: list[RevisitPass]) -> list[RevisitPass]:
    """Drop passes the caller is not party to.

    Belt to `_assert_may_read`'s braces: that guard answers "may you ask about
    this patient", this one answers "which of their passes may you see". A
    patient legitimately reachable from two hospitals holds passes at both, and
    each front desk must see only its own.

    Hospital staff are additionally kept out of personal practices. A
    self-registered doctor's pass carries `hospital_id = doctor.hospital_id`,
    the default anchor tenant rather than a hospital they work for, so a plain
    hospital_id match would hand that hospital every solo doctor's passes — the
    same trap as `_hide_personal` in routers/appointments.
    """
    role = me.role.name if me.role else None
    if role in (ROLE_SUPER_ADMIN, ROLE_PATIENT):
        return rows
    if role == ROLE_DOCTOR:
        doctor = _own_doctor(db, me)
        return [r for r in rows if doctor and r.doctor_id == doctor.doctor_id] if rows else []

    out = []
    for r in rows:
        if r.hospital_id != me.hospital_id:
            continue
        if is_hospital_staff(role) and r.affiliation_id is not None:
            aff = db.get(DoctorAffiliation, r.affiliation_id)
            if aff is not None and not aff.managed_by_hospital:
                continue
        out.append(r)
    return out


def _assert_may_redeem(db: Session, me: User, row: RevisitPass) -> None:
    """Who may spend a pass. Stricter than reading one: this creates a visit and
    waives a fee, so it must happen where the pass actually lives.

    A patient may never redeem their own — redemption issues a token and marks
    money collected, which is a desk action. They walk in, or they book online
    (`create_booking` applies the pass for them).
    """
    role = me.role.name if me.role else None
    if role == ROLE_SUPER_ADMIN:
        return
    if role == ROLE_PATIENT:
        raise _forbid("Only hospital staff or the doctor can use a free revisit at the counter")
    if role == ROLE_DOCTOR:
        doctor = _own_doctor(db, me)
        if not doctor or doctor.doctor_id != row.doctor_id:
            raise _forbid("You can only use a free revisit earned with you")
        return
    aff = db.get(DoctorAffiliation, row.affiliation_id) if row.affiliation_id else None
    if aff is not None and not aff.managed_by_hospital:
        raise _forbid("This free revisit belongs to a doctor's own practice, not this hospital")
    ensure_same_tenant(me, row.hospital_id)


@router.get("/revisit-passes/mine", response_model=list[PassOut])
def my_passes(me: User = Depends(require_permission("appointment", "read")),
              db: Session = Depends(get_db)):
    """Live passes for the signed-in patient — powers the dashboard card."""
    patient = _patient_for(db, me)
    if not patient:
        return []
    rows = rp.list_for_patient(db, patient.patient_id)
    db.commit()          # list_for_patient lazily expires what it walked past
    return [rp.describe(db, row) for row in rows]


@router.get("/revisit-passes/lookup", response_model=Optional[PassOut])
def lookup(patient_id: UUID, doctor_id: UUID, family_member_id: Optional[UUID] = None,
           me: User = Depends(require_permission("patient", "read")),
           db: Session = Depends(get_db)):
    """Does THIS patient hold a pass with THIS doctor?

    Scoped to the doctor on purpose: a pass earned with Dr. A is not valid with
    Dr. B, and a bare "has a pass" badge would cause exactly that mistake at the
    counter.
    """
    _assert_may_read(db, me, patient_id, doctor_id)
    row = rp.active_pass(db, patient_id, doctor_id, family_member_id)
    db.commit()
    if row is not None and not _visible(db, me, [row]):
        return None
    return rp.describe(db, row) if row else None


@router.get("/revisit-passes/for-patient", response_model=list[PassOut])
def for_patient(patient_id: UUID,
                me: User = Depends(require_permission("patient", "read")),
                db: Session = Depends(get_db)):
    """Every live pass this patient holds, each naming its doctor.

    The front desk opens a patient's record without a doctor in context, so the
    doctor-scoped `/lookup` cannot answer for them. Returning the list WITH the
    doctor's name is also the safer shape: a bare "has a pass" badge invites the
    desk to honour a pass earned with Dr. A while the patient is seeing Dr. B.
    """
    _assert_may_read(db, me, patient_id)
    rows = rp.list_for_patient(db, patient_id)
    db.commit()          # list_for_patient lazily expires what it walked past
    return [rp.describe(db, row) for row in _visible(db, me, rows)]


@router.get("/revisit-passes/window", response_model=list[WindowOut])
def my_windows(me: User = Depends(require_permission("appointment", "read")),
               db: Session = Depends(get_db)):
    """The free-revisit window at each practice the signed-in doctor works at.

    One call answers both cases, because only the server knows which applies:
    a practice the doctor runs themselves reads its own column and is editable;
    a hospital-run one reads `hospital_settings` and is not.

    It lives here, on `appointment.read`, rather than on the hospital settings
    endpoint, because ROLE_DOCTOR has no `hospital.read` (rbac.py:83) — a doctor
    asking what waiver applies to their own consultations would get a 403.
    Granting them `hospital.read` to answer one number would widen every other
    hospital endpoint too, and force a sync_permissions run on deploy.
    """
    doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
    if not doctor:
        return []
    affs = db.scalars(
        select(DoctorAffiliation).where(
            DoctorAffiliation.doctor_id == doctor.doctor_id,
            DoctorAffiliation.is_active.is_(True),
        ).order_by(DoctorAffiliation.affiliation_id)
    ).all()
    out: list[WindowOut] = []
    for aff in affs:
        mine = not aff.managed_by_hospital
        out.append(WindowOut(
            affiliation_id=aff.affiliation_id,
            practice_name=aff.name or "",
            managed_by_hospital=aff.managed_by_hospital,
            # Resolved by the same function that decides at issue time, so this
            # page can never show a window the engine would not actually apply.
            days=rp.window_days(db, aff.hospital_id or doctor.hospital_id, aff.affiliation_id),
            editable=mine,
            owner="doctor" if mine else "hospital",
        ))
    return out


@router.post("/revisit-passes/{pass_id}/redeem", status_code=status.HTTP_201_CREATED)
def redeem(pass_id: UUID, body: RedeemRequest,
           me: User = Depends(require_permission("appointment", "create")),
           db: Session = Depends(get_db)):
    """Turn a pass into today's zero-fee visit, and issue the token.

    The appointment is created with `consultation_fee = 0`, NOT with the normal
    fee left unpaid: `routers/tokens.py` skips unpaid patients when calling the
    next token, so an unpaid free visit would sit in the queue being passed over
    silently.
    """
    row = db.get(RevisitPass, pass_id)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pass not found")
    live = rp.active_pass(db, row.patient_id, row.doctor_id, row.family_member_id)
    if live is None or live.pass_id != row.pass_id:
        db.commit()      # active_pass may have just marked it expired
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "pass_not_active",
            "message": "This free revisit is no longer available — it has been used or has expired.",
        })

    _assert_may_redeem(db, me, row)

    doctor = db.get(Doctor, row.doctor_id)
    if not doctor:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    aff = db.get(DoctorAffiliation, row.affiliation_id) if row.affiliation_id else None
    if aff is None:
        aff = next((a for a in doctor.affiliations if a.is_active), None)
    if aff is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This doctor has no active practice.")

    today = date.today()
    if sch.is_on_holiday(doctor, today):
        raise HTTPException(status.HTTP_409_CONFLICT, "Doctor is on holiday today.")
    if sch.is_on_leave(db, doctor, today):
        raise HTTPException(status.HTTP_409_CONFLICT, "Doctor is on leave today.")
    sessions = sch.active_schedules(doctor, today, aff.affiliation_id)
    if not sessions:
        raise HTTPException(status.HTTP_409_CONFLICT, "No hospital hours are configured for today.")
    now_local = datetime.now(timezone(timedelta(hours=5, minutes=30))).time().replace(tzinfo=None)
    if all(now_local > s.end_time for s in sessions):
        raise HTTPException(status.HTTP_409_CONFLICT, "Today's hospital hours have ended.")

    appt = Appointment(
        hospital_id=aff.hospital_id or doctor.hospital_id,
        doctor_id=doctor.doctor_id,
        affiliation_id=aff.affiliation_id,
        patient_id=row.patient_id,
        family_member_id=row.family_member_id,
        appointment_date=today,
        appointment_type="walkin",
        status="confirmed",
        # Zero, not unpaid — see the docstring.
        consultation_fee=0,
        consultation_paid=True,
        consultation_paid_at=utcnow(),
        consultation_paid_by=me.user_id,
        booking_fee_paid=0,
        notes=(body.notes or "Free revisit"),
        source="walkin",
        booked_by=me.user_id,
        confirmed_at=utcnow(),
    )
    db.add(appt)
    db.flush()
    rp.redeem(db, row, appt.appointment_id, me.user_id)
    token = te.allocate_token(db, appt, me.user_id)
    db.commit()
    db.refresh(appt)
    db.refresh(token)
    return {
        "appointment_id": appt.appointment_id,
        "token_id": token.token_id,
        "token_number": token.token_number,
        "display_code": token.display_code,
        "pass_id": row.pass_id,
        "consultation_fee": 0,
    }
