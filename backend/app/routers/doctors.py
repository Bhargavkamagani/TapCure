"""
Module 3 — Doctor endpoints (20 APIs).

Doctors master CRUD + the scheduling sub-resources (weekly schedule, breaks,
holidays, delay logs, leave workflow, live presence status). All tenant-scoped.
"""
from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..database import get_db, utcnow
from ..deps import ensure_same_tenant, require_permission, require_role
from ..models import (
    Appointment, Department, Doctor, DoctorAffiliation, DoctorBreak, DoctorDelayLog, DoctorDocument,
    DoctorHoliday, DoctorLeaveRequest, DoctorSchedule, DoctorStatus, Hospital,
    HospitalSettings, Role, User,
)
from ..rbac import ROLE_DOCTOR, ROLE_PATIENT, ROLE_SUPER_ADMIN, is_hospital_staff
from ..schemas.doctor import (
    AffiliationCreate, AffiliationOut, AffiliationUpdate, BreakCreate, BreakOut,
    DelayCreate, DelayOut, DoctorAdminDetail, DoctorCreate, DoctorDetail, DoctorDutyOut, DoctorOnboard,
    DoctorOut, DoctorUpdate, DoctorVerificationOut, DutyOut, HolidayCreate, HolidayOut,
    HospitalLeaveCreate, LeaveCreate, LeaveDecision, LeaveOut, PresenceOut, PresenceUpdate,
    ScheduleCreate, ScheduleOut, ScheduleUpdate,
)
from ..schemas.hospital import RejectRequest
from ..security import hash_password
from ..services import person_name
from ..services import accounts
from ..services import storage
from ..services import suspension
from ..services import audit
from ..services import session_cancellation
from ..services.hospital_location import hospital_practice_fields
from ..services.reception_scope import ensure_can_see_doctor, restrict
from ..services import notifications as notify
from ..services import scheduling as sch
from ..services import token_engine as te

router = APIRouter(tags=["doctors"])


# ---- helpers ----
def _doctor(db: Session, doctor_id: UUID) -> Doctor:
    d = db.get(Doctor, doctor_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    return d


def _schedule(db: Session, schedule_id: UUID) -> DoctorSchedule:
    s = db.get(DoctorSchedule, schedule_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Schedule not found")
    return s


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return a_start < b_end and b_start < a_end


_FULL_DAY = {
    "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday", "Thu": "Thursday",
    "Fri": "Friday", "Sat": "Saturday", "Sun": "Sunday",
}


def _overlap_message(day: str, existing: DoctorSchedule) -> str:
    """Explain a session clash in the doctor's own terms.

    The old text — "Overlaps existing Thu session" — named neither which session
    was in the way nor when it runs, so a doctor with a morning and an evening
    Thursday sitting had to guess which one to go and change.
    """
    return (
        f"You already consult on {_FULL_DAY.get(day, day)} from "
        f"{sch.fmt_time(existing.start_time)} to {sch.fmt_time(existing.end_time)}, "
        f"and these timings overlap it. Choose hours outside that session, "
        f"or edit the existing one instead."
    )


def _assert_fits_hospital(db: Session, aff: DoctorAffiliation, day: str, start, end) -> None:
    """A hospital session must fall inside the hospital's own week and OP hours.

    A doctor working under a hospital doesn't set the premises' opening times —
    the hospital does. Without this a doctor could publish a Sunday session at a
    Mon-Sat hospital, or an 8 PM slot at a hospital that shuts at 5, and patients
    could book into hours when the doors are locked.

    Only applies to hospital-managed practice. A doctor's own home/personal/
    online practice is theirs to schedule however they like.
    """
    if not aff.managed_by_hospital or not aff.hospital_id:
        return
    cfg = db.scalar(select(HospitalSettings).where(HospitalSettings.hospital_id == aff.hospital_id))
    if not cfg:
        return
    # An always-open hospital names no window and no week, so there is nothing
    # here to check: the doctor's own schedule becomes the only thing deciding
    # when patients can be seen. This is the entire behavioural effect of the
    # flag — every guard below still applies to hospitals with fixed hours.
    if cfg.always_open:
        return

    days = [d.strip() for d in (cfg.working_days or "").split(",") if d.strip()]
    if days and day not in days:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{aff.name or 'This hospital'} is not open on {day}. Open days: {', '.join(days)}.",
        )
    if cfg.op_start_time and start < cfg.op_start_time:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Sessions can't start before the hospital opens at {cfg.op_start_time.strftime('%I:%M %p').lstrip('0')}.",
        )
    if cfg.op_end_time and end > cfg.op_end_time:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Sessions can't run past the hospital's closing time of {cfg.op_end_time.strftime('%I:%M %p').lstrip('0')}.",
        )


def _default_affiliation(db: Session, doctor: Doctor) -> DoctorAffiliation:
    aff = db.scalar(
        select(DoctorAffiliation).where(
            DoctorAffiliation.doctor_id == doctor.doctor_id,
            DoctorAffiliation.hospital_id == doctor.hospital_id,
            DoctorAffiliation.practice_type == "hospital",
        )
    )
    if aff:
        return aff
    hospital = db.get(Hospital, doctor.hospital_id)
    # Inherit the hospital's address AND map pin — patients read the affiliation,
    # not the hospital row, so a blank one leaves the doctor with no address and
    # no travel time. Kept in step with the hospital by hospital_location.py.
    place = hospital_practice_fields(hospital) if hospital else {}
    aff = DoctorAffiliation(
        doctor_id=doctor.doctor_id,
        hospital_id=doctor.hospital_id,
        practice_type="hospital",
        consultation_fee=doctor.consultation_fee,
        mode="slot",
        managed_by_hospital=True,
        **place,
    )
    db.add(aff)
    db.flush()
    return aff


def _ensure_may_edit_doctor(me: User, doctor: Doctor) -> None:
    """Who may write to a doctor record: the doctor themselves, or their hospital.

    A doctor editing their OWN profile is never a cross-tenant act, so it must
    not go through `ensure_same_tenant` — a solo doctor is only anchored to a
    hospital as a tenant placeholder, and that anchor can differ from their
    user's. Same ownership rule the affiliation endpoints already use. This also
    stops one doctor from writing to a colleague's record in the same hospital.
    """
    if me.role and me.role.name == ROLE_DOCTOR:
        if doctor.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own profile")
        return
    ensure_same_tenant(me, doctor.hospital_id)


def _ensure_own_or_hospital_staff(me: User, doctor: Doctor, what: str) -> None:
    """A doctor may only act on themselves; hospital staff on any of their doctors.

    Holidays, leave and presence all change whether patients can book a doctor,
    so a doctor being able to set them for a COLLEAGUE meant one doctor could
    quietly take another off the schedule. `ensure_same_tenant` alone allowed it.
    """
    if me.role and me.role.name == ROLE_DOCTOR and doctor.user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"You can only manage your own {what}")
    ensure_same_tenant(me, doctor.hospital_id)

def _fee_owned_by_hospital(db: Session, doctor: Doctor) -> bool:
    """True when a hospital runs this doctor's practice, and so owns the fee.

    A self-registered solo doctor only has personal affiliations
    (`managed_by_hospital=False`) — nobody else sets their fee, so they may.
    """
    return db.scalar(
        select(DoctorAffiliation.affiliation_id).where(
            DoctorAffiliation.doctor_id == doctor.doctor_id,
            DoctorAffiliation.managed_by_hospital.is_(True),
            DoctorAffiliation.is_active.is_(True),
        ).limit(1)
    ) is not None


def _assert_may_manage_sessions(db: Session, me: User, doctor: Doctor, aff: DoctorAffiliation | None) -> None:
    """Who may write a doctor's weekly sessions.

    A doctor writes their own. Hospital staff write only sessions that belong to
    the HOSPITAL's practice — a self-registered doctor's `personal_hospital` row has
    no hospital_id, and they're anchored to a hospital only as a tenant, so the
    hospital has no claim on their private hours.

    This existed inline in `add_schedule` but not in edit/delete, so the hospital
    console refused to ADD a session for a solo doctor while happily letting the
    same admin rewrite or DELETE their existing timetable.
    """
    if me.role and me.role.name == ROLE_DOCTOR:
        if doctor.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Can only manage your own schedule")
        return
    # No affiliation at all = legacy hospital session, predating practice rows.
    if aff is not None and not aff.hospital_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This doctor runs their own practice and sets their own timings — "
            "hospital staff cannot change them.",
        )
    ensure_same_tenant(me, (aff.hospital_id if aff else None) or doctor.hospital_id)


_CHANGED_BY = {
    "HOSPITAL_ADMIN": "Your hospital admin",
    "RECEPTIONIST": "The hospital reception",
    ROLE_SUPER_ADMIN: "TapCure admin",
}


def _tell_doctor_schedule_changed(db: Session, me: User, doctor: Doctor, change: str) -> None:
    """Someone other than the doctor changed their weekly sessions — tell them.

    Lands in the doctor's own feed (type `schedule_change`), which the doctor
    console raises as a pop-up. A doctor editing their own hours is told nothing.
    """
    if not doctor.user_id or doctor.user_id == me.user_id:
        return
    u = db.get(User, doctor.user_id)
    if not u:
        return
    who = _CHANGED_BY.get(me.role.name if me.role else "", "The hospital")
    notify.send_staff_in_app(
        db, u.user_id,
        f"{who} {change}. Please check My Availability.",
        ntype="schedule_change", title="Your availability was changed",
        # The doctor's feed is filtered by THEIR hospital, so file it there.
        hospital_id=u.hospital_id or doctor.hospital_id,
    )


def _session_text(day: str, start, end) -> str:
    return f"{_FULL_DAY.get(day, day)} {sch.fmt_time(start)} – {sch.fmt_time(end)}"


def _date_text(d: date) -> str:
    return d.strftime("%a %d %b %Y")


def _span_text(start: date, end: date) -> str:
    return _date_text(start) if start == end else f"{_date_text(start)} to {_date_text(end)}"


def _cancelled_suffix(n: int) -> str:
    return f" ({n} appointment(s) cancelled)" if n else ""


def _affiliation(db: Session, affiliation_id: UUID, doctor_id: UUID | None = None) -> DoctorAffiliation:
    aff = db.get(DoctorAffiliation, affiliation_id)
    if not aff or (doctor_id is not None and aff.doctor_id != doctor_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor affiliation not found")
    return aff


# ========================================================= Doctors ==========
@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(
    hospital_id: UUID | None = Query(None),
    department_id: UUID | None = Query(None),
    q: str | None = Query(None, description="search specialization"),
    bookable: bool = Query(False, description="only doctors who can take patients today"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission("doctor", "read")),
    db: Session = Depends(get_db),
):
    role = me.role.name if me.role else None
    stmt = select(Doctor)
    if bookable:
        # Operational screens (walk-in, queue, appointments) must only offer
        # doctors who can actually be given a patient. A self-registered doctor
        # awaiting credential verification is anchored to a hospital as a tenant
        # placeholder — issuing them a token would be a real mistake. The hospital's
        # Doctors *management* page deliberately doesn't pass this, since it has
        # to show inactive doctors in order to manage them.
        stmt = stmt.where(Doctor.status == "active", Doctor.verification_status == "verified")
    if role == ROLE_SUPER_ADMIN:
        if hospital_id:
            stmt = stmt.where(Doctor.hospital_id == hospital_id)
    elif role == ROLE_PATIENT:
        # Patients browse every active doctor across all hospitals; an optional
        # hospital_id narrows to one hospital when they pick "Find Hospital" first.
        stmt = stmt.where(Doctor.status == "active")
        if hospital_id:
            stmt = stmt.where(Doctor.hospital_id == hospital_id)
    else:
        stmt = stmt.where(Doctor.hospital_id == me.hospital_id)  # tenant scope
        stmt = restrict(stmt, Doctor.doctor_id, db, me)           # receptionist: her doctors only
    if department_id:
        stmt = stmt.where(Doctor.department_id == department_id)
    if q:
        stmt = stmt.where(Doctor.specialization.ilike(f"%{q}%"))
    stmt = stmt.order_by(Doctor.doctor_id).offset((page - 1) * size).limit(size)
    return db.scalars(stmt).all()


# NOTE: static path — must stay above "/doctors/{doctor_id}".
@router.get("/doctors/duty-today", response_model=list[DoctorDutyOut])
def doctors_duty_today(
    on_date: date | None = Query(None, alias="date"),
    hospital_id: UUID | None = Query(None),
    me: User = Depends(require_permission("doctor", "read")),
    db: Session = Depends(get_db),
):
    """Today's roster for the front desk — each doctor plus WHY they're off.

    `/doctors?bookable=true` answers "is this doctor employed and verified",
    which is why the reception board rendered a doctor on leave, on holiday, or
    with no session on this weekday as "On time". This answers the operational
    question instead: is the doctor *here today*, and if not, what should the
    desk tell the patient standing in front of it.

    Doctors who are off are returned, marked — not filtered out. A doctor who
    silently disappears from the board looks like a data bug to the desk.
    """
    role = me.role.name if me.role else None
    hid = hospital_id if role == ROLE_SUPER_ADMIN else me.hospital_id
    stmt = select(Doctor).where(Doctor.verification_status == "verified")
    if hid:
        stmt = stmt.where(Doctor.hospital_id == hid)
    # inactive/suspended are employment states, not "off today" — they belong on
    # the hospital's Doctors management page, not on the live desk board.
    stmt = stmt.where(Doctor.status.not_in(("inactive", "suspended")))
    stmt = restrict(stmt, Doctor.doctor_id, db, me)   # receptionist: her doctors only
    doctors = db.scalars(
        stmt.options(
            selectinload(Doctor.schedules),
            selectinload(Doctor.holidays),
            joinedload(Doctor.presence),
        ).order_by(Doctor.doctor_id)
    ).unique().all()

    duty = sch.duty_map(db, doctors, on_date or date.today())
    return [
        DoctorDutyOut(**DoctorOut.model_validate(d).model_dump(), duty=DutyOut(**duty[d.doctor_id]))
        for d in doctors
    ]


# ---- Solo-doctor credential verification (Super Admin) ----
# NOTE: this static path must be registered BEFORE "/doctors/{doctor_id}" so
# "pending" isn't captured as a doctor_id.
def _verification_out(db: Session, d: Doctor) -> DoctorVerificationOut:
    """DoctorOut + contact + uploaded documents, for the admin review screen."""
    out = DoctorVerificationOut.model_validate(d)
    u = db.get(User, d.user_id) if d.user_id else None
    out.email = u.email if u else None
    out.phone = u.phone if u else None
    return out


@router.get("/doctors/{doctor_id}/admin-detail", response_model=DoctorAdminDetail)
def doctor_admin_detail(doctor_id: UUID, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """One doctor in full for the Super Admin's "View details"."""
    d = _doctor(db, doctor_id)
    out = DoctorAdminDetail.model_validate(d)
    u = db.get(User, d.user_id) if d.user_id else None
    out.email = u.email if u else None
    out.phone = u.phone if u else None
    dept = db.get(Department, d.department_id) if d.department_id else None
    out.department_name = dept.name if dept else None
    hosp = db.get(Hospital, d.hospital_id) if d.hospital_id else None
    out.hospital_name = hosp.name if hosp else None
    return out


# ---- Suspend / reactivate (Super Admin) — services/suspension.py has the policy.
@router.get("/doctors/{doctor_id}/suspend-preview")
def suspend_doctor_preview(doctor_id: UUID, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """What suspending would do: bookings to cancel, login to block."""
    return suspension.preview_doctor(db, _doctor(db, doctor_id))


@router.post("/doctors/{doctor_id}/suspend")
def suspend_doctor(doctor_id: UUID, body: RejectRequest, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Take a doctor off TapCure: hidden, login blocked, upcoming bookings
    cancelled with the patients told. Reversible."""
    return suspension.suspend_doctor(db, _doctor(db, doctor_id), me, body.reason)


@router.post("/doctors/{doctor_id}/reactivate")
def reactivate_doctor(doctor_id: UUID, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Undo a suspension (cancelled bookings stay cancelled)."""
    return suspension.reactivate_doctor(db, _doctor(db, doctor_id), me)


@router.get("/doctors/{doctor_id}/registration")
def doctor_registration(doctor_id: UUID, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Everything a doctor submitted at sign-up, in one place (Super Admin).

    The verification screen showed the credentials and documents; the practice
    (name, address, map pin, fee), languages, bio, account status and consent
    were stored but never shown. Documents come through _verification_out, so
    they keep their short-lived signed links."""
    d = db.get(Doctor, doctor_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    base = jsonable_encoder(_verification_out(db, d))
    u = db.get(User, d.user_id) if d.user_id else None
    # The practice they registered: a self-registered doctor's own hospital
    # (no hospital); otherwise their first active practice.
    affs = sorted(d.affiliations or [], key=lambda a: a.affiliation_id)
    aff = next((a for a in affs if a.practice_type == "personal_practice"), None) \
        or next((a for a in affs if a.is_active), None)
    return {
        **base,
        "registered_at": d.created_at,
        "verification_status": d.verification_status,
        "languages": [x.strip() for x in (d.languages or "").split(",") if x.strip()],
        "bio": d.bio or "",
        "account": None if not u else {
            "status": u.status,
            "terms_accepted_at": u.terms_accepted_at,
            "terms_version": u.terms_version,
        },
        "practice": None if not aff else {
            "name": aff.name,
            "practice_type": aff.practice_type,
            "address": aff.address,
            "city": aff.city,
            "latitude": aff.latitude,
            "longitude": aff.longitude,
            "consultation_fee": aff.consultation_fee,
        },
    }


@router.get("/doctors/pending", response_model=list[DoctorVerificationOut])
def pending_doctors(me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Self-registered doctors awaiting manual credential verification."""
    rows = db.scalars(
        select(Doctor).where(Doctor.verification_status == "pending").order_by(Doctor.doctor_id)
    ).all()
    return [_verification_out(db, d) for d in rows]


@router.get("/doctors/verifications", response_model=list[DoctorVerificationOut])
def doctor_verifications(
    status_filter: str | None = Query(None, alias="status"),
    me: User = Depends(require_role(ROLE_SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Credential-review records for ANY verification state — the audit view.

    /doctors/pending only ever returns `pending`, so once a doctor is verified
    their uploaded documents become unreachable. This returns the same payload
    (doctor + contact + documents) filtered by state, or every doctor when no
    status is given.
    """
    stmt = select(Doctor)
    if status_filter and status_filter != "all":
        stmt = stmt.where(Doctor.verification_status == status_filter)
    rows = db.scalars(stmt.order_by(Doctor.doctor_id.desc())).all()
    return [_verification_out(db, d) for d in rows]


@router.get("/doctors/{doctor_id}", response_model=DoctorDetail)
def get_doctor(doctor_id: UUID, me: User = Depends(require_permission("doctor", "read")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)
    return d


@router.post("/doctors", response_model=DoctorOut, status_code=201)
def create_doctor(body: DoctorCreate, me: User = Depends(require_permission("doctor", "create")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, body.hospital_id)
    if not db.get(Hospital, body.hospital_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid hospital_id")
    if body.department_id and not db.get(Department, body.department_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid department_id")
    if body.user_id and not db.get(User, body.user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user_id")
    d = Doctor(**body.model_dump())
    d.presence = DoctorStatus(status="off_duty")
    db.add(d)
    db.flush()
    _default_affiliation(db, d)
    audit.log_activity(db, me.user_id, "doctor.create", "doctor")
    db.commit()
    db.refresh(d)
    return d


@router.post("/doctors/onboard", response_model=DoctorOut, status_code=201)
def onboard_doctor(body: DoctorOnboard, me: User = Depends(require_permission("doctor", "create")), db: Session = Depends(get_db)):
    """Admin adds a doctor to their own hospital and creates their login."""
    if me.role and me.role.name == ROLE_SUPER_ADMIN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Super admin must use POST /doctors with an explicit hospital_id")
    hospital_id = me.hospital_id
    if body.department_id and not db.get(Department, body.department_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid department_id")

    body.email = accounts.normalize_email(body.email)
    if accounts.email_taken(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if db.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")
    role = db.scalar(select(Role).where(Role.name == ROLE_DOCTOR))
    u = User(hospital_id=hospital_id, role_id=role.role_id, name=body.name, **person_name.parts(body),
             email=body.email, phone=body.phone, password_hash=hash_password(body.password))
    db.add(u)
    db.flush()
    user_id = u.user_id

    doc = Doctor(
        name=body.name, **person_name.parts(body), user_id=user_id, hospital_id=hospital_id, department_id=body.department_id,
        specialization=body.specialization, qualification=body.qualification,
        registration_number=body.registration_number, hpr_id=body.hpr_id,
        experience_years=body.experience_years, consultation_fee=body.consultation_fee,
        languages=body.languages, status="active",
    )
    doc.presence = DoctorStatus(status="off_duty")
    db.add(doc)
    db.flush()
    _default_affiliation(db, doc)
    audit.log_activity(db, me.user_id, "doctor.onboard", "doctor", {"name": body.name})
    db.commit()
    db.refresh(doc)
    return doc


def _check_status_change(me: User, d: Doctor, fields: dict) -> str | None:
    """Vet a status change on PUT /doctors/{id}; say what has to follow it.

    * "suspended" belongs to the Super Admin's Suspend / Reactivate (it blocks
      logins, cancels bookings and is logged); a plain edit can neither set nor
      clear it, or a hospital could undo a platform suspension.
    * A solo doctor is anchored to a placeholder hospital, so that hospital's
      admin passes the tenant check for every solo doctor. Only the Super Admin
      may switch a solo doctor off.
    * Returns "deactivate" when a hospital makes the doctor inactive (login
      blocked, bookings cancelled) and "reactivate" when it brings them back.
      A doctor changing their OWN status keeps the old behaviour.
    """
    new = fields.get("status")
    if new is None or new == d.status:
        fields.pop("status", None)
        return None
    if new == "suspended" or d.status == "suspended":
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Suspension is managed by the TapCure Super Admin.")
    role = me.role.name if me.role else None
    if role == ROLE_DOCTOR:
        return None
    if d.is_self_registered and role != ROLE_SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "This doctor runs their own practice on TapCure; only the Super Admin can change their status.")
    if new == "inactive":
        return "deactivate"
    if d.status == "inactive":
        return "reactivate"
    return None


@router.put("/doctors/{doctor_id}", response_model=DoctorOut)
def update_doctor(doctor_id: UUID, body: DoctorUpdate, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    _ensure_may_edit_doctor(me, d)
    fields = body.model_dump(exclude_unset=True)
    # The consultation fee is owned by the hospital — a hospital's doctor can't
    # change it. The profile form posts the whole record, so reject only a real
    # change: echoing back the current fee must not block the other fields.
    if me.role and me.role.name == ROLE_DOCTOR and "consultation_fee" in fields:
        new_fee = fields["consultation_fee"]
        if new_fee is None or Decimal(new_fee) == Decimal(d.consultation_fee or 0):
            fields.pop("consultation_fee")
        elif _fee_owned_by_hospital(db, d):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Consultation fee is set by the hospital")
    status_change = _check_status_change(me, d, fields)
    for k, v in fields.items():
        setattr(d, k, v)
    if status_change == "deactivate":
        suspension.hospital_deactivate_doctor(db, d, me)
    elif status_change == "reactivate":
        suspension.hospital_reactivate_doctor(db, d, me)
    # Hospital bookings read the fee from the doctor-hospital affiliation. Keep the
    # hospital's affiliation in sync when its admin edits the doctor card.
    if (not me.role or me.role.name != ROLE_DOCTOR) and "consultation_fee" in fields:
        for aff in d.affiliations:
            if aff.managed_by_hospital and aff.hospital_id == me.hospital_id:
                aff.consultation_fee = fields["consultation_fee"]
    # A solo doctor's registered hospital uses the same consultation fee as their
    # doctor profile. Keep both rows aligned so discovery, booking and the My
    # Hospital card never show an old amount after a profile edit.
    if d.is_self_registered and "consultation_fee" in fields:
        for aff in d.affiliations:
            if not aff.managed_by_hospital:
                aff.consultation_fee = fields["consultation_fee"]
    db.commit()
    db.refresh(d)
    return d


@router.post("/doctors/{doctor_id}/photo", response_model=DoctorOut)
def upload_doctor_photo(doctor_id: UUID, file: UploadFile = File(...), me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    """Set/replace a doctor's profile photo."""
    d = _doctor(db, doctor_id)
    _ensure_may_edit_doctor(me, d)
    storage.require_image(file)
    url, _ = storage.save_upload("doctors", doctor_id, file)
    d.profile_photo_url = url
    db.commit()
    db.refresh(d)
    return d


def _own_doctor_only(me: User, d: Doctor) -> None:
    """A signature is the doctor's alone: not even their hospital may set it."""
    if not (me.role and me.role.name == ROLE_DOCTOR and d.user_id == me.user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the doctor can manage their own signature")


@router.post("/doctors/{doctor_id}/signature", response_model=DoctorOut)
def upload_doctor_signature(doctor_id: UUID, file: UploadFile = File(...), me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    """Set/replace the signature printed on this doctor's prescription PDFs.
    JPG/PNG, ideally dark ink on a white or transparent background."""
    d = _doctor(db, doctor_id)
    _own_doctor_only(me, d)
    storage.require_image(file)
    url, _ = storage.save_upload("signatures", doctor_id, file)
    d.signature_url = url
    audit.log_activity(db, me.user_id, "doctor.signature", "doctor", {"doctor_id": str(doctor_id)})
    db.commit()
    db.refresh(d)
    return d


@router.get("/doctors/{doctor_id}/signature")
def view_doctor_signature(doctor_id: UUID, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    """A short-lived link to the doctor's own signature, for their profile preview."""
    d = _doctor(db, doctor_id)
    _own_doctor_only(me, d)
    return {"url": storage.public_url(d.signature_url) if d.signature_url else None}


@router.delete("/doctors/{doctor_id}/signature", response_model=DoctorOut)
def remove_doctor_signature(doctor_id: UUID, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    _own_doctor_only(me, d)
    d.signature_url = None
    db.commit()
    db.refresh(d)
    return d


@router.post("/doctors/{doctor_id}/verify", response_model=DoctorOut)
def verify_doctor(doctor_id: UUID, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Approve a pending doctor: mark verified, activate their login, notify them."""
    d = _doctor(db, doctor_id)
    if d.verification_status == "verified":
        raise HTTPException(status.HTTP_409_CONFLICT, "Doctor is already verified")
    d.verification_status = "verified"
    d.status = "active"
    d.verified_at = utcnow()
    d.verified_by = me.user_id
    d.rejection_reason = None
    if d.user_id:
        u = db.get(User, d.user_id)
        if u:
            u.status = "active"
            if u.email:
                notify.send_email(
                    db, u.email, "Your doctor account is verified",
                    f"Congratulations Dr. {d.name} — your credentials have been verified. "
                    "You can now log in to TapCure and set up your practice.",
                    ntype="general", hospital_id=d.hospital_id,
                    # Addressed to this doctor — not a hospital announcement,
                    # so it stays out of the front desk's feed.
                    audience="staff", recipient_user_id=u.user_id,
                )
    audit.log_activity(db, me.user_id, "doctor.verify", "doctor", {"doctor_id": doctor_id})
    db.commit()
    db.refresh(d)
    return d


@router.post("/doctors/{doctor_id}/reject", response_model=DoctorOut)
def reject_doctor(doctor_id: UUID, body: RejectRequest, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Reject a pending doctor with a reason; keeps their login disabled."""
    d = _doctor(db, doctor_id)
    d.verification_status = "rejected"
    d.status = "inactive"
    d.rejection_reason = body.reason
    if d.user_id:
        u = db.get(User, d.user_id)
        if u:
            u.status = "inactive"
            if u.email:
                notify.send_email(
                    db, u.email, "Doctor registration update",
                    f"Your registration was not approved. {body.reason}".strip(),
                    ntype="general", hospital_id=d.hospital_id,
                )
    audit.log_activity(db, me.user_id, "doctor.reject", "doctor", {"doctor_id": doctor_id})
    db.commit()
    db.refresh(d)
    return d


@router.delete("/doctors/{doctor_id}")
def deactivate_doctor(doctor_id: UUID, me: User = Depends(require_permission("doctor", "delete")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)
    # Same rules and consequences as setting Inactive on the edit form.
    fields = {"status": "inactive"}
    if _check_status_change(me, d, fields) == "deactivate":
        d.status = "inactive"
        suspension.hospital_deactivate_doctor(db, d, me)
    db.commit()
    return {"message": "Doctor deactivated"}


# ===================================================== Affiliations =========
@router.get("/doctor-affiliations", response_model=list[AffiliationOut])
def list_affiliations(
    doctor_id: UUID | None = Query(None),
    hospital_id: UUID | None = Query(None),
    me: User = Depends(require_permission("doctor", "read")),
    db: Session = Depends(get_db),
):
    role = me.role.name if me.role else None
    stmt = select(DoctorAffiliation)
    if doctor_id:
        stmt = stmt.where(DoctorAffiliation.doctor_id == doctor_id)
    if role == ROLE_PATIENT:
        stmt = stmt.where(DoctorAffiliation.is_active.is_(True))
        if hospital_id:
            stmt = stmt.where(DoctorAffiliation.hospital_id == hospital_id)
    elif role == ROLE_DOCTOR:
        own_doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
        if not own_doctor:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctor profile not linked")
        stmt = stmt.where(DoctorAffiliation.doctor_id == own_doctor.doctor_id)
    elif role != ROLE_SUPER_ADMIN:
        stmt = stmt.where(DoctorAffiliation.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(DoctorAffiliation.hospital_id == hospital_id)
    return db.scalars(stmt.order_by(DoctorAffiliation.doctor_id, DoctorAffiliation.affiliation_id)).all()


@router.post("/doctor-affiliations", response_model=AffiliationOut, status_code=201)
def add_affiliation(body: AffiliationCreate, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    d = _doctor(db, body.doctor_id)
    role = me.role.name if me.role else None
    if role == ROLE_DOCTOR:
        if d.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Can only manage your own practice locations")
    else:
        ensure_same_tenant(me, body.hospital_id or d.hospital_id)
        if body.practice_type != "hospital":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Hospital staff can only add hospital affiliations")
    aff = DoctorAffiliation(**body.model_dump())
    # Enforce the isolation invariant server-side rather than trusting the client:
    # ONLY a true hospital practice is hospital-managed (visible to hospital staff);
    # personal_hospital / home / online are always private to the doctor. Keeping
    # managed_by_hospital + hospital_id consistent here is what every hospital-side
    # filter (appointments, tokens, schedule, reports) relies on.
    aff.managed_by_hospital = (aff.practice_type == "hospital")
    if aff.practice_type == "hospital":
        if not aff.hospital_id:
            aff.hospital_id = d.hospital_id
    else:
        aff.hospital_id = None
    db.add(aff)
    db.commit()
    db.refresh(aff)
    return aff


@router.put("/doctor-affiliations/{affiliation_id}", response_model=AffiliationOut)
def update_affiliation(affiliation_id: UUID, body: AffiliationUpdate, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    aff = _affiliation(db, affiliation_id)
    d = _doctor(db, aff.doctor_id)
    if me.role and me.role.name == ROLE_DOCTOR:
        if d.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Can only manage your own practice locations")
    else:
        ensure_same_tenant(me, aff.hospital_id)
    fields = body.model_dump(exclude_unset=True)
    # The free-revisit window follows the fee: whoever sets the fee sets the
    # waiver. On a hospital-managed practice that is the hospital, via
    # hospital_settings.free_revisit_days — so refuse it here rather than write a
    # column `services.revisit_pass.window_days` would then ignore, which would
    # look saved in the UI and silently do nothing.
    if "free_revisit_days" in fields and aff.managed_by_hospital:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This practice is run by the hospital, so the hospital sets its free "
            "revisit window — from Hospital Profile, not here.",
        )
    for k, v in fields.items():
        setattr(aff, k, v)
    db.commit()
    db.refresh(aff)
    return aff


# ===================================================== Schedule =============
@router.get("/doctor-schedule", response_model=list[ScheduleOut])
def get_schedule(
    doctor_id: UUID = Query(...),
    affiliation_id: UUID | None = Query(None),
    me: User = Depends(require_permission("doctor", "read")),
    db: Session = Depends(get_db),
):
    d = _doctor(db, doctor_id)
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)
    stmt = select(DoctorSchedule).where(DoctorSchedule.doctor_id == doctor_id)
    if affiliation_id:
        stmt = stmt.where(DoctorSchedule.affiliation_id == affiliation_id)
    # Hospital front-desk staff must not see a doctor's personal-practice sessions —
    # only hospital-managed ones (schedules with no affiliation = legacy hospital).
    if is_hospital_staff(me.role.name if me.role else None):
        stmt = stmt.outerjoin(
            DoctorAffiliation, DoctorSchedule.affiliation_id == DoctorAffiliation.affiliation_id
        ).where(
            or_(
                DoctorSchedule.affiliation_id.is_(None),
                DoctorAffiliation.managed_by_hospital.is_(True),
            )
        )
    return db.scalars(stmt).all()


@router.post("/doctor-schedule", response_model=ScheduleOut, status_code=201)
def add_schedule(body: ScheduleCreate, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    d = _doctor(db, body.doctor_id)
    aff = _affiliation(db, body.affiliation_id, d.doctor_id) if body.affiliation_id else _default_affiliation(db, d)
    _assert_may_manage_sessions(db, me, d, aff)
    if body.start_time >= body.end_time:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_time must be before end_time")
    _assert_fits_hospital(db, aff, body.day_of_week, body.start_time, body.end_time)
    # No overlapping active session on the same weekday.
    for s in d.schedules:
        same_aff = (s.affiliation_id or aff.affiliation_id) == aff.affiliation_id
        if same_aff and s.is_active and s.day_of_week == body.day_of_week and _overlaps(body.start_time, body.end_time, s.start_time, s.end_time):
            raise HTTPException(status.HTTP_409_CONFLICT, _overlap_message(body.day_of_week, s))
    data = body.model_dump()
    data["affiliation_id"] = aff.affiliation_id
    s = DoctorSchedule(**data)
    db.add(s)
    _tell_doctor_schedule_changed(
        db, me, d, f"added a session on {_session_text(s.day_of_week, s.start_time, s.end_time)}")
    db.commit()
    db.refresh(s)
    return s


# No `response_model`: the handler returns the session PLUS what the edit
# cancelled (`cancelled`, `free_rebooks_granted`, `dates`), and ScheduleOut
# would silently strip exactly those — leaving the UI unable to report it.
@router.put("/doctor-schedule/{schedule_id}")
def edit_schedule(schedule_id: UUID, body: ScheduleUpdate,
                  confirm: bool = Query(False, description="Acknowledge cancelling stranded patients"),
                  me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    """Change a session's shape — and deal with anyone it strands.

    Deleting a session has always been guarded: preview, confirm, cancel,
    notify. Editing one does the same damage and had none of it. Shrinking
    09:00-17:00 to 09:00-12:00 left every afternoon patient booked into hours
    the doctor no longer works; moving Mon->Tue stranded every Monday booking;
    `is_active=False` or a past `valid_until` is a deletion in all but name and
    walked straight past the confirmation gate.

    Only the DIFFERENCE is cancelled. Widening the hours strands nobody and
    raises no dialog at all — cancelling everyone on any edit would make this
    worse than the delete it is meant to be gentler than.
    """
    s = _schedule(db, schedule_id)
    d = s.doctor
    # Same rule as creating one: a doctor edits only their own sessions, and
    # hospital staff only the hospital's own practice.
    _assert_may_manage_sessions(db, me, d, db.get(DoctorAffiliation, s.affiliation_id) if s.affiliation_id else None)

    # BEFORE the mutation below: `setattr` overwrites the row in place, so the
    # old shape is unrecoverable a line later and nothing could then answer
    # "who did that just strand?".
    old_shape = session_cancellation.snapshot(s)
    old_text = _session_text(s.day_of_week, s.start_time, s.end_time)

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    if s.start_time >= s.end_time:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_time must be before end_time")

    # Re-check against the hospital and the rest of the timetable — an edit can
    # move a session out of opening hours just as easily as creating one.
    aff = db.get(DoctorAffiliation, s.affiliation_id) if s.affiliation_id else _default_affiliation(db, d)
    if aff:
        _assert_fits_hospital(db, aff, s.day_of_week, s.start_time, s.end_time)
    for other in d.schedules:
        if other.schedule_id == s.schedule_id or not other.is_active:
            continue
        if (other.affiliation_id or s.affiliation_id) != s.affiliation_id:
            continue
        if other.day_of_week == s.day_of_week and _overlaps(s.start_time, s.end_time, other.start_time, other.end_time):
            raise HTTPException(status.HTTP_409_CONFLICT, _overlap_message(s.day_of_week, other))

    # Who can the OLD session serve that the NEW one cannot? Computed after the
    # validation above, so a rejected edit never reports phantom casualties.
    impact = session_cancellation.preview_edit(db, old_shape, s)
    if impact["total"] and not confirm:
        # Roll the in-place mutation back: the caller has not agreed to the
        # consequences, so the session must be left exactly as it was.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail={
            "code": "schedule_edit_strands_patients",
            "message": (
                f"{impact['total']} appointment(s) fall outside the new hours"
                + (f", including {impact['today_count']} TODAY" if impact["today_count"] else "")
                + ". Confirm to cancel them and notify those patients not to travel."
            ),
            **impact,
        })

    result = (session_cancellation.cancel_edit_and_notify(db, old_shape, s, me.user_id)
              if impact["total"] else {"cancelled": 0, "today_count": 0,
                                       "free_rebooks_granted": 0, "dates": []})
    new_text = _session_text(s.day_of_week, s.start_time, s.end_time)
    _tell_doctor_schedule_changed(
        db, me, d,
        (f"changed your {old_text} session to {new_text}" if new_text != old_text
         else f"updated your {old_text} session")
        + (f" ({result['cancelled']} appointment(s) cancelled)" if result["cancelled"] else ""))
    db.commit()
    db.refresh(s)
    # ScheduleOut would strip the counts, and the UI has to report what it just
    # cancelled — same reason add_holiday returns a plain dict.
    return JSONResponse(jsonable_encoder({**ScheduleOut.model_validate(s).model_dump(), **result}))


@router.get("/doctor-schedule/{schedule_id}/impact")
def schedule_delete_impact(schedule_id: UUID, me: User = Depends(require_permission("doctor", "read")), db: Session = Depends(get_db)):
    """Who would be affected by deleting this session. Read-only — powers the
    confirmation dialog so the doctor sees the cost before paying it."""
    s = _schedule(db, schedule_id)
    ensure_same_tenant(me, s.doctor.hospital_id)
    return session_cancellation.preview(db, s)


@router.delete("/doctor-schedule/{schedule_id}")
def delete_schedule(schedule_id: UUID, confirm: bool = Query(False, description="Acknowledge cancelling booked patients"),
                    me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    s = _schedule(db, schedule_id)
    # Deleting is the most destructive of the three — it used to be the least
    # guarded, letting a hospital admin wipe a solo doctor's whole timetable.
    _assert_may_manage_sessions(db, me, s.doctor, db.get(DoctorAffiliation, s.affiliation_id) if s.affiliation_id else None)

    # Patients are booked into this session. Deleting it used to strand them:
    # the slot disappeared while their appointment and queue token stayed live,
    # so they travelled to a hospital that wasn't expecting them. Refuse until the
    # caller has seen who is affected and confirmed.
    impact = session_cancellation.preview(db, s)
    if (impact["future_count"] or impact["today_count"]) and not confirm:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={
            "code": "session_has_bookings",
            "message": (
                f"{impact['future_count']} upcoming appointment(s) are booked in this session"
                + (f", and {impact['today_count']} patient(s) are in today's queue" if impact["today_count"] else "")
                + ". Confirm to cancel all affected appointments, including today's, and notify those patients not to travel."
            ),
            **impact,
        })

    result = session_cancellation.cancel_and_notify(db, s, me.user_id) if (impact["future_count"] or impact["today_count"]) else {
        "cancelled": 0, "today_count": impact["today_count"], "free_rebooks_granted": 0, "dates": [],
    }
    _tell_doctor_schedule_changed(
        db, me, s.doctor,
        f"removed your {_session_text(s.day_of_week, s.start_time, s.end_time)} session"
        + (f" ({result['cancelled']} appointment(s) cancelled)" if result["cancelled"] else ""))
    db.delete(s)
    db.commit()
    return {"message": "Schedule deleted", **result}


# ===================================================== Breaks ===============
@router.post("/doctor-breaks", response_model=BreakOut, status_code=201)
def add_break(body: BreakCreate, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    s = _schedule(db, body.schedule_id)
    ensure_same_tenant(me, s.doctor.hospital_id)
    if body.break_start >= body.break_end:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "break_start must be before break_end")
    b = DoctorBreak(**body.model_dump())
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


@router.delete("/doctor-breaks/{break_id}")
def remove_break(break_id: UUID, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    b = db.get(DoctorBreak, break_id)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Break not found")
    ensure_same_tenant(me, b.schedule.doctor.hospital_id)
    db.delete(b)
    db.commit()
    return {"message": "Break removed"}


# ===================================================== Holidays =============
@router.get("/doctor-holidays", response_model=list[HolidayOut])
def list_holidays(
    doctor_id: UUID = Query(...),
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = Query(None),
    me: User = Depends(require_permission("doctor", "read")),
    db: Session = Depends(get_db),
):
    d = _doctor(db, doctor_id)
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)
    rows = db.scalars(select(DoctorHoliday).where(DoctorHoliday.doctor_id == doctor_id)).all()
    if month:
        rows = [h for h in rows if h.holiday_date.month == month]
    if year:
        rows = [h for h in rows if h.holiday_date.year == year]
    return rows


# No `response_model`: the handler returns the holiday PLUS what was cancelled
# (`cancelled`, `free_rebooks_granted`, `dates`), and HolidayOut would silently
# strip exactly those fields — leaving the UI unable to report what it just did.
@router.post("/doctor-holidays", status_code=201)
def add_holiday(body: HolidayCreate, confirm: bool = Query(False),
                me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    """Mark a day off — and deal with anyone already booked on it.

    This used to add the row and stop. The appointments stayed `confirmed`,
    their tokens stayed `waiting`, nobody was told, and the clock-driven
    leave-by sweep went on telling those patients to set off for a doctor who
    would not be there. Same stranding as deleting a session, through a
    different door — so it now uses the same refuse-until-confirmed gate.
    """
    d = _doctor(db, body.doctor_id)
    _ensure_own_or_hospital_staff(me, d, "holidays")

    # A partial holiday blocks nothing today (`is_on_holiday` requires
    # `is_full_day`), so cancelling a whole day's bookings for one would be
    # wrong. Left alone until partial days are actually honoured.
    impact = (session_cancellation.preview_on_date(db, d.doctor_id, body.holiday_date)
              if body.is_full_day
              else {"total": 0, "today_count": 0, "future_count": 0, "paid_count": 0, "dates": []})
    # `total`, not today+future: a back-dated holiday is in neither bucket, and
    # summing those two silently skipped the gate for it.
    booked = impact["total"]
    if booked and not confirm:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={
            "code": "holiday_has_bookings",
            "message": (
                f"{booked} appointment(s) are booked on {body.holiday_date}. "
                "Confirm to cancel them and notify those patients not to travel."
            ),
            **impact,
        })

    h = DoctorHoliday(**body.model_dump(), created_by=me.user_id)
    db.add(h)
    result = (session_cancellation.cancel_date_and_notify(db, d.doctor_id, body.holiday_date, me.user_id)
              if booked else {"cancelled": 0, "today_count": 0, "free_rebooks_granted": 0, "dates": []})
    _tell_doctor_schedule_changed(
        db, me, d,
        f"marked {_date_text(body.holiday_date)} as a {'holiday' if body.is_full_day else 'partial holiday'}"
        + _cancelled_suffix(result["cancelled"]))
    db.commit()
    db.refresh(h)
    # HolidayOut is a plain model, so the counts ride alongside rather than in
    # it — the UI needs to report what was cancelled.
    return JSONResponse(jsonable_encoder({**HolidayOut.model_validate(h).model_dump(), **result}),
                        status_code=status.HTTP_201_CREATED)


@router.delete("/doctor-holidays/{holiday_id}")
def cancel_holiday(holiday_id: UUID, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    h = db.get(DoctorHoliday, holiday_id)
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Holiday not found")
    _ensure_own_or_hospital_staff(me, h.doctor, "holidays")
    _tell_doctor_schedule_changed(
        db, me, h.doctor,
        f"removed your holiday on {_date_text(h.holiday_date)} — patients can book you that day again")
    db.delete(h)
    db.commit()
    return {"message": "Holiday cancelled"}


# ===================================================== Delays ===============
@router.get("/doctor-delay", response_model=list[DelayOut])
def list_delays(doctor_id: UUID = Query(...), me: User = Depends(require_permission("doctor", "read")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)
    return db.scalars(
        select(DoctorDelayLog).where(DoctorDelayLog.doctor_id == doctor_id).order_by(DoctorDelayLog.delay_id.desc())
    ).all()


@router.post("/doctor-delay", response_model=DelayOut, status_code=201)
def log_delay(body: DelayCreate, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    # Logging a delay is a queue operation (it reshuffles ETAs + notifies waiting
    # patients), so it's gated on token.manage — held by the doctor, the hospital
    # admin AND the receptionist, so the front desk can update it if the doctor
    # forgets. ensure_same_tenant below still confines it to the doctor's hospital.
    d = _doctor(db, body.doctor_id)
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)
    delay_date = body.delay_date or date.today()
    log = DoctorDelayLog(
        doctor_id=body.doctor_id, delay_minutes=body.delay_minutes, reason=body.reason,
        delay_date=delay_date, logged_by=me.user_id,
        notified_patients=False,
    )
    db.add(log)
    db.flush()

    waiting = te.recompute_positions(db, body.doctor_id, delay_date)
    notified = 0
    for token in waiting:
        patient = token.patient
        if not patient or not patient.phone:
            continue
        eta = token.estimated_time.strftime("%I:%M %p") if token.estimated_time else "later than planned"
        notify.send_sms(
            db,
            patient.phone,
            f"Dr. {d.name} is running late by {body.delay_minutes} min. "
            f"Token {token.display_code} revised ETA: {eta}.",
            ntype="delay",
            title="Doctor Delayed",
            hospital_id=token.hospital_id,
            patient_id=patient.patient_id,
            appointment_id=token.appointment_id,
            token_id=token.token_id,
        )
        notified += 1

    notify.send_push(
        db,
        f"hospital:{d.hospital_id}:reception",
        "Doctor Running Late",
        f"Dr. {d.name} is running late by {body.delay_minutes} min. "
        f"{len(waiting)} pending token{'s' if len(waiting) != 1 else ''} shifted.",
        platform="web",
        payload={"doctor_id": d.doctor_id, "delay_minutes": body.delay_minutes, "pending_tokens": len(waiting)},
        ntype="delay",
        hospital_id=d.hospital_id,
    )
    log.notified_patients = notified > 0
    audit.log_activity(db, me.user_id, "doctor.delay", "doctor", {"doctor_id": body.doctor_id, "minutes": body.delay_minutes})
    db.commit()
    db.refresh(log)
    return log


# ===================================================== Leave ================
@router.get("/doctor-leave", response_model=list[LeaveOut])
def list_leave(
    doctor_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    me: User = Depends(require_permission("doctor", "read")),
    db: Session = Depends(get_db),
):
    stmt = select(DoctorLeaveRequest)
    if doctor_id:
        d = _doctor(db, doctor_id)
        ensure_same_tenant(me, d.hospital_id)
        stmt = stmt.where(DoctorLeaveRequest.doctor_id == doctor_id)
    if status_filter:
        stmt = stmt.where(DoctorLeaveRequest.status == status_filter)
    rows = db.scalars(stmt.order_by(DoctorLeaveRequest.leave_id.desc())).all()
    # Confine to tenant when not filtered by a specific doctor.
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        rows = [r for r in rows if r.doctor.hospital_id == me.hospital_id]
    return rows


@router.post("/doctor-leave", response_model=LeaveOut, status_code=201)
def submit_leave(body: LeaveCreate, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    d = _doctor(db, body.doctor_id)
    _ensure_own_or_hospital_staff(me, d, "leave")
    if body.leave_from > body.leave_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "leave_from must be on/before leave_to")
    lv = DoctorLeaveRequest(**body.model_dump(), status="pending")
    db.add(lv)
    _tell_doctor_schedule_changed(
        db, me, d, f"filed a leave request for you ({_span_text(body.leave_from, body.leave_to)}), pending approval")
    db.commit()
    db.refresh(lv)
    return lv


# ---- Leave with dates, set by the hospital (2026-10-01) ----------------------
# "On Leave" used to be a bare status on the Edit Doctor form: no end date, so
# the doctor stayed hidden until someone remembered to set Active, and patients
# already booked were never told. Leave is now a date range: scheduling refuses
# those dates (sch.available_slots -> "Doctor on leave"), the doctor is bookable
# again the day after it ends, and anyone booked inside it is cancelled and
# told — the same refuse-until-confirmed gate as holidays.

def _leave_bookings(db: Session, doctor_id: UUID, leave_from: date, leave_to: date) -> list[Appointment]:
    return list(db.scalars(select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date >= leave_from,
        Appointment.appointment_date <= leave_to,
        Appointment.status.in_(session_cancellation._ACTIVE),
    )).all())


def _leave_reason(lv) -> str:
    span = (lv.leave_from.strftime("%d %b") if lv.leave_from == lv.leave_to
            else f"{lv.leave_from.strftime('%d %b')} to {lv.leave_to.strftime('%d %b')}")
    return f"The doctor is on leave ({span})"


def _cancel_leave_bookings(db: Session, lv, me: User) -> dict:
    appts = _leave_bookings(db, lv.doctor_id, lv.leave_from, lv.leave_to)
    granted = session_cancellation._cancel_all(db, appts, me.user_id, _leave_reason(lv))
    return {"cancelled": len(appts), "free_rebooks_granted": granted}


@router.post("/doctors/{doctor_id}/leave", status_code=201)
def set_leave(doctor_id: UUID, body: HospitalLeaveCreate, confirm: bool = Query(False),
              me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    _ensure_own_or_hospital_staff(me, d, "leave")
    if d.status in ("inactive", "suspended"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This doctor is not active.")
    today = sch.ist_now().date()
    if body.leave_from > body.leave_to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The leave must end on or after the day it starts.")
    if body.leave_to < today:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That leave is already over.")
    if (body.leave_to - body.leave_from).days > 365:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Leave can be at most one year. For longer, set the doctor Inactive.")
    appts = _leave_bookings(db, d.doctor_id, body.leave_from, body.leave_to)
    if appts and not confirm:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={
            "code": "leave_has_bookings",
            "message": (f"{len(appts)} appointment(s) are booked during this leave. "
                        "Confirm to cancel them and notify those patients not to travel."),
            "total": len(appts),
            "today_count": sum(1 for a in appts if a.appointment_date == today),
            "paid_count": sum(1 for a in appts if float(a.booking_fee_paid or 0) > 0),
            "dates": sorted({a.appointment_date.isoformat() for a in appts}),
        })
    lv = DoctorLeaveRequest(doctor_id=d.doctor_id, leave_from=body.leave_from, leave_to=body.leave_to,
                            leave_type="casual", reason=(body.reason or "").strip()[:255],
                            status="approved", approved_by=me.user_id)
    db.add(lv)
    db.flush()
    result = _cancel_leave_bookings(db, lv, me)
    # The dated leave replaces the old open-ended flag.
    if d.status == "on_leave":
        d.status = "active"
    audit.log_activity(db, me.user_id, "doctor.leave_set", "doctor",
                       {"doctor_id": d.doctor_id, "leave_id": lv.leave_id, **result})
    _tell_doctor_schedule_changed(
        db, me, d, f"put you on leave {_span_text(lv.leave_from, lv.leave_to)}" + _cancelled_suffix(result["cancelled"]))
    db.commit()
    db.refresh(lv)
    return JSONResponse(jsonable_encoder({**LeaveOut.model_validate(lv).model_dump(), **result}),
                        status_code=status.HTTP_201_CREATED)


@router.post("/doctors/{doctor_id}/leave/{leave_id}/end", response_model=LeaveOut)
def end_leave(doctor_id: UUID, leave_id: UUID, me: User = Depends(require_permission("doctor", "update")),
              db: Session = Depends(get_db)):
    """Doctor is back early: bookable again from today. Cancelled visits stay cancelled."""
    d = _doctor(db, doctor_id)
    _ensure_own_or_hospital_staff(me, d, "leave")
    lv = db.get(DoctorLeaveRequest, leave_id)
    if not lv or lv.doctor_id != d.doctor_id or lv.status != "approved":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave not found")
    yesterday = sch.ist_now().date() - timedelta(days=1)
    span = _span_text(lv.leave_from, lv.leave_to)
    if lv.leave_from > yesterday:
        lv.status = "cancelled"          # had not started (or starts today): drop it
    elif lv.leave_to > yesterday:
        lv.leave_to = yesterday          # cut short: back from today
    audit.log_activity(db, me.user_id, "doctor.leave_end", "doctor", {"doctor_id": d.doctor_id, "leave_id": leave_id})
    _tell_doctor_schedule_changed(
        db, me, d,
        f"cancelled your upcoming leave ({span})" if lv.status == "cancelled"
        else f"ended your leave ({span}) — patients can book you again from today")
    db.commit()
    db.refresh(lv)
    return lv


@router.put("/doctor-leave/{leave_id}", response_model=LeaveOut)
def decide_leave(leave_id: UUID, body: LeaveDecision, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    lv = db.get(DoctorLeaveRequest, leave_id)
    if not lv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
    ensure_same_tenant(me, lv.doctor.hospital_id)
    lv.status = body.status
    lv.approved_by = me.user_id
    if body.status == "rejected":
        lv.rejection_reason = body.rejection_reason or "Not specified"
    # Approved leave used to flip doctors.status to "on_leave" and nothing ever
    # flipped it back, so the doctor stayed hidden from patients after the leave
    # ended. The leave DATES are what scheduling reads (sch.is_on_leave), so the
    # status is left alone; instead the patients booked inside it are told.
    cancelled = 0
    if body.status == "approved":
        cancelled = _cancel_leave_bookings(db, lv, me)["cancelled"]
    _tell_doctor_schedule_changed(
        db, me, lv.doctor,
        f"{body.status} your leave request ({_span_text(lv.leave_from, lv.leave_to)})"
        + (f" — reason: {lv.rejection_reason}" if body.status == "rejected" else "")
        + _cancelled_suffix(cancelled))
    audit.log_activity(db, me.user_id, f"doctor.leave_{body.status}", "doctor", {"leave_id": leave_id})
    db.commit()
    db.refresh(lv)
    return lv


# ===================================================== Presence =============
@router.get("/doctor-status", response_model=PresenceOut)
def get_status(doctor_id: UUID = Query(...), me: User = Depends(require_permission("doctor", "read")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)
    if not d.presence:
        d.presence = DoctorStatus(doctor_id=doctor_id, status="off_duty")
        db.commit()
        db.refresh(d)
    return d.presence


@router.put("/doctor-status", response_model=PresenceOut)
def set_status(doctor_id: UUID, body: PresenceUpdate, me: User = Depends(require_permission("doctor", "update")), db: Session = Depends(get_db)):
    d = _doctor(db, doctor_id)
    _ensure_own_or_hospital_staff(me, d, "availability status")
    if not d.presence:
        d.presence = DoctorStatus(doctor_id=doctor_id)
        db.flush()
    d.presence.status = body.status
    d.presence.note = body.note
    d.presence.updated_by = me.user_id
    db.commit()
    db.refresh(d.presence)
    return d.presence
