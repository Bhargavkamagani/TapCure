"""Module 2 — Hospital + settings endpoints."""
from uuid import UUID
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from sqlalchemy import select as _select

from ..database import get_db, utcnow
from ..deps import ensure_same_tenant, require_permission, require_role
from ..models import Doctor, DoctorAffiliation, DoctorSchedule, Hospital, HospitalSettings, Role, User
from ..rbac import ROLE_HOSPITAL_ADMIN, ROLE_PATIENT, ROLE_SUPER_ADMIN
from ..schemas.hospital import (
    HospitalCreate, HospitalDetail, HospitalOut, HospitalSettingsOut,
    HospitalSettingsResult, HospitalSettingsUpdate, HospitalUpdate,
    HospitalUpdateResult, RejectRequest,
)
from ..services import audit
from ..services import insurers as _insurers
from ..services import booking_quota
from ..services.hospital_location import sync_hospital_affiliations
from ..services import notifications as notify
from ..services import storage
from ..services import hospital_profile
from ..services import suspension

router = APIRouter(prefix="/hospitals", tags=["hospitals"])


def _require(db: Session, hospital_id: UUID) -> Hospital:
    h = db.get(Hospital, hospital_id)
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    return h


@router.get("", response_model=list[HospitalOut])
def list_hospitals(me: User = Depends(require_permission("hospital", "read")), db: Session = Depends(get_db)):
    stmt = select(Hospital).order_by(Hospital.hospital_id)
    role = me.role.name if me.role else None
    if role == ROLE_SUPER_ADMIN:
        pass  # platform owner sees every hospital
    elif role == ROLE_PATIENT:
        # Patients are global marketplace users — browse every live hospital.
        # Only hospitals that finished "Complete your profile" (2026-11-10).
        stmt = stmt.where(*hospital_profile.visible_to_patients())
    else:
        # Hospital staff are confined to their own hospital.
        stmt = stmt.where(Hospital.hospital_id == me.hospital_id)
    return db.scalars(stmt).all()


@router.get("/pending", response_model=list[HospitalOut],
            dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def pending_hospitals(db: Session = Depends(get_db)):
    """Hospitals awaiting approval (Super Admin)."""
    return db.scalars(_select(Hospital).where(Hospital.status == "pending").order_by(Hospital.hospital_id)).all()


@router.get("/{hospital_id}/registration",
            dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def hospital_registration(hospital_id: UUID, db: Session = Depends(get_db)):
    """Everything a hospital submitted at sign-up, in one place (Super Admin).

    The approval screen showed only the name and licence number, and the
    Hospitals page part of the rest; the owner's account, opening hours,
    consultation time, chosen services and consent were never shown at all,
    though all of it is stored — across the hospital, its settings, its
    departments and the owner's user row, which this gathers."""
    h = _require(db, hospital_id)
    st = h.settings
    owner = db.scalar(
        select(User)
        .join(Role, Role.role_id == User.role_id)
        .where(User.hospital_id == hospital_id, Role.name == ROLE_HOSPITAL_ADMIN)
        .order_by(User.user_id)
        .limit(1)
    )
    hhmm = lambda t: t.strftime("%H:%M") if t else None
    return {
        "hospital_id": h.hospital_id,
        "name": h.name,
        "short_code": h.short_code,
        "status": h.status,
        "is_active": h.is_active,
        "registered_at": h.created_at,
        "registration_number": h.registration_number,
        "hfr_id": h.hfr_id,
        "gstin": h.gstin,
        "logo_url": storage.media_url(h.logo_url, "hospitals"),
        "address": h.address,
        "city": h.city,
        "state": h.state,
        "pincode": h.pincode,
        "latitude": h.latitude,
        "longitude": h.longitude,
        "phone": h.phone,
        "email": h.email,
        "timings": {
            "always_open": bool(st.always_open) if st else False,
            "working_days": [d for d in (st.working_days or "").split(",") if d] if st else [],
            "open_time": hhmm(st.op_start_time) if st else None,
            "close_time": hhmm(st.op_end_time) if st else None,
            "consultation_minutes": st.consultation_duration if st else None,
        },
        "services": sorted(d.name for d in (h.departments or [])),
        # Codes; the screen gets names/badges from GET /public/insurers.
        "insurance_partners": _insurers.known(h.insurance_partners),
        "owner": None if not owner else {
            "name": owner.name,
            "email": owner.email,
            "phone": owner.phone,
            "status": owner.status,
            "terms_accepted_at": owner.terms_accepted_at,
            "terms_version": owner.terms_version,
        },
    }


# ---- Suspend / reactivate (Super Admin) — services/suspension.py has the policy.
@router.get("/{hospital_id}/suspend-preview")
def suspend_hospital_preview(hospital_id: UUID, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """What suspending would do: bookings to cancel, logins to block."""
    return suspension.preview_hospital(db, _require(db, hospital_id))


@router.post("/{hospital_id}/suspend")
def suspend_hospital(hospital_id: UUID, body: RejectRequest, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Take a hospital off TapCure: hidden, logins blocked, upcoming bookings
    cancelled with the patients told. Reversible."""
    return suspension.suspend_hospital(db, _require(db, hospital_id), me, body.reason)


@router.post("/{hospital_id}/reactivate")
def reactivate_hospital(hospital_id: UUID, me: User = Depends(require_role(ROLE_SUPER_ADMIN)), db: Session = Depends(get_db)):
    """Undo a suspension (cancelled bookings stay cancelled)."""
    return suspension.reactivate_hospital(db, _require(db, hospital_id), me)


@router.post("/{hospital_id}/approve", response_model=HospitalOut,
             dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def approve_hospital(hospital_id: UUID, db: Session = Depends(get_db)):
    """Approve a pending hospital: activate the hospital + its owner admin, notify them."""
    h = _require(db, hospital_id)
    if h.status != "pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Hospital is already {h.status}")
    h.status = "active"
    h.is_active = True
    admins = db.scalars(_select(User).where(User.hospital_id == hospital_id, User.status == "inactive")).all()
    for u in admins:
        u.status = "active"
    owner = admins[0] if admins else db.scalar(_select(User).where(User.hospital_id == hospital_id))
    if owner and owner.email:
        notify.send_email(
            db, owner.email, "Your hospital has been approved",
            f"Welcome aboard! {h.name} is now active — you can log in and start adding doctors.",
            ntype="general", hospital_id=hospital_id,
            audience="staff", recipient_user_id=owner.user_id,
        )
    audit.log_activity(db, None, "hospital.approve", "hospital", {"hospital_id": hospital_id})
    db.commit()
    db.refresh(h)
    return h


@router.post("/{hospital_id}/reject", response_model=HospitalOut,
             dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def reject_hospital(hospital_id: UUID, body: RejectRequest, db: Session = Depends(get_db)):
    h = _require(db, hospital_id)
    h.status = "suspended"
    h.is_active = False
    owner = db.scalar(_select(User).where(User.hospital_id == hospital_id))
    if owner and owner.email:
        notify.send_email(
            db, owner.email, "Hospital registration update",
            f"Your registration for {h.name} was not approved. {body.reason}".strip(),
            ntype="general", hospital_id=hospital_id,
        )
    db.commit()
    db.refresh(h)
    return h


@router.get("/{hospital_id}", response_model=HospitalDetail)
def get_hospital(hospital_id: UUID, me: User = Depends(require_permission("hospital", "read")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, hospital_id)
    return _require(db, hospital_id)


@router.post("", response_model=HospitalDetail, status_code=201,
             dependencies=[Depends(require_permission("hospital", "create"))])
def create_hospital(body: HospitalCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Hospital).where(Hospital.short_code == body.short_code)):
        raise HTTPException(status.HTTP_409_CONFLICT, "short_code already in use")
    h = Hospital(**body.model_dump(exclude_none=True))
    h.settings = HospitalSettings(token_prefix=body.short_code[:10] or "OPD")
    db.add(h)
    db.flush()
    booking_quota.start_pilot(db, h.hospital_id)
    db.commit()
    db.refresh(h)
    return h


@router.put("/{hospital_id}", response_model=HospitalUpdateResult)
def update_hospital(hospital_id: UUID, body: HospitalUpdate, me: User = Depends(require_permission("hospital", "update")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    fields = body.model_dump(exclude_unset=True)
    # Insurance tie-ups belong to the hospital: Super Admin sees them, only the
    # hospital's own admin changes them (decided 2026-11-03).
    if "insurance_partners" in fields and me.role and me.role.name == ROLE_SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Only the hospital's admin can change its accepted insurances.")
    moved = any(
        k in fields and fields[k] != getattr(h, k)
        for k in ("name", "address", "city", "latitude", "longitude")
    )
    for k, v in fields.items():
        setattr(h, k, v)
    # The hospital is the source of truth for the practice location of every
    # doctor working there, and it's the affiliation — not the hospital row —
    # that patients see on search/booking and that travel time is measured to.
    synced = sync_hospital_affiliations(db, h) if moved else 0
    audit.log_activity(db, me.user_id, "hospital.update", "hospital",
                       {"hospital_id": hospital_id, "doctors_synced": synced})
    db.commit()
    db.refresh(h)
    out = HospitalUpdateResult.model_validate(h)
    out.doctors_synced = synced
    return out


@router.post("/{hospital_id}/logo", response_model=HospitalOut)
def upload_hospital_logo(hospital_id: UUID, file: UploadFile = File(...), me: User = Depends(require_permission("hospital", "update")), db: Session = Depends(get_db)):
    """Set/replace the hospital's logo."""
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    storage.require_image(file)
    url, _ = storage.save_upload("hospitals", hospital_id, file)
    h.logo_url = url
    hospital_profile.mark_if_complete(db, h)
    db.commit()
    db.refresh(h)
    return h


@router.post("/{hospital_id}/photo", response_model=HospitalOut)
def upload_hospital_photo(hospital_id: UUID, file: UploadFile = File(...), me: User = Depends(require_permission("hospital", "update")), db: Session = Depends(get_db)):
    """Set/replace the hospital photo shown on the public Find Hospitals cards."""
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    storage.require_image(file)
    url, _ = storage.save_upload("hospitals", hospital_id, file)
    h.photo_url = url
    hospital_profile.mark_if_complete(db, h)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{hospital_id}/photo", response_model=HospitalOut)
def remove_hospital_photo(hospital_id: UUID, me: User = Depends(require_permission("hospital", "update")), db: Session = Depends(get_db)):
    """Remove the photo; the public card falls back to the logo."""
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    h.photo_url = None
    db.commit()
    db.refresh(h)
    return h


LETTERHEAD_PARTS = {"header": "letterhead_header_url", "footer": "letterhead_footer_url"}


def _letterhead_part(part: str) -> str:
    if part not in LETTERHEAD_PARTS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Letterhead part must be header or footer")
    return LETTERHEAD_PARTS[part]


@router.post("/{hospital_id}/letterhead/{part}", response_model=HospitalOut)
def upload_letterhead(hospital_id: UUID, part: str, file: UploadFile = File(...), me: User = Depends(require_permission("hospital", "update")), db: Session = Depends(get_db)):
    """Set/replace the top (header) or bottom (footer) of the printed
    prescription. A wide JPG/PNG — the PDF scales it to the page width."""
    column = _letterhead_part(part)
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    storage.require_image(file)
    url, _ = storage.save_upload("letterheads", hospital_id, file)
    setattr(h, column, url)
    audit.log_activity(db, me.user_id, "hospital.letterhead", "hospital", {"hospital_id": str(hospital_id), "part": part})
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{hospital_id}/letterhead/{part}", response_model=HospitalOut)
def remove_letterhead(hospital_id: UUID, part: str, me: User = Depends(require_permission("hospital", "update")), db: Session = Depends(get_db)):
    """Remove it; the PDF goes back to the letterhead built from the logo and address."""
    column = _letterhead_part(part)
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    setattr(h, column, None)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/{hospital_id}", dependencies=[Depends(require_permission("hospital", "delete"))])
def deactivate_hospital(hospital_id: UUID, db: Session = Depends(get_db)):
    h = _require(db, hospital_id)
    h.is_active = False
    db.commit()
    return {"message": "Hospital deactivated"}


@router.get("/{hospital_id}/settings", response_model=HospitalSettingsOut)
def get_settings(hospital_id: UUID, me: User = Depends(require_permission("hospital", "read")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    if not h.settings:
        h.settings = HospitalSettings(hospital_id=hospital_id)
        db.commit()
        db.refresh(h)
    return h.settings


def _sessions_outside_hours(db: Session, hospital_id: UUID, cfg: HospitalSettings) -> list[str]:
    """Doctor sessions at this hospital that the new opening times no longer allow.

    Not blocked — the hospital is entitled to change its hours, and an existing
    session may be exactly what they intend to go and fix. But they must be told,
    because patients may already hold tokens in those slots.
    """
    # Nothing can fall outside hours that were never set.
    if cfg.always_open:
        return []
    days = [d.strip() for d in (cfg.working_days or "").split(",") if d.strip()]
    rows = db.scalars(
        select(DoctorSchedule)
        .join(Doctor, Doctor.doctor_id == DoctorSchedule.doctor_id)
        .outerjoin(DoctorAffiliation, DoctorAffiliation.affiliation_id == DoctorSchedule.affiliation_id)
        .where(
            Doctor.hospital_id == hospital_id,
            DoctorSchedule.is_active.is_(True),
            # Personal practice keeps its own hours — only hospital sessions.
            or_(DoctorSchedule.affiliation_id.is_(None), DoctorAffiliation.managed_by_hospital.is_(True)),
        )
    ).all()

    out = []
    for s in rows:
        why = None
        if days and s.day_of_week not in days:
            why = f"hospital now closed on {s.day_of_week}"
        elif cfg.op_start_time and s.start_time < cfg.op_start_time:
            why = "starts before opening"
        elif cfg.op_end_time and s.end_time > cfg.op_end_time:
            why = "runs past closing"
        if why:
            doctor = db.get(Doctor, s.doctor_id)
            out.append(
                f"{doctor.name if doctor else 'Doctor'} — {s.day_of_week} "
                f"{s.start_time.strftime('%H:%M')}-{s.end_time.strftime('%H:%M')} ({why})"
            )
    return out


@router.put("/{hospital_id}/settings", response_model=HospitalSettingsResult)
def update_settings(hospital_id: UUID, body: HospitalSettingsUpdate, me: User = Depends(require_permission("hospital", "update")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, hospital_id)
    h = _require(db, hospital_id)
    if not h.settings:
        h.settings = HospitalSettings(hospital_id=hospital_id)
        db.flush()
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(h.settings, k, v)
    # Saving hours = the owner chose them (signup only stores a 24x7 default).
    if changes.keys() & {"always_open", "working_days", "op_start_time", "op_end_time"}:
        h.settings.hours_confirmed = True
    hospital_profile.mark_if_complete(db, h)
    audit.log_activity(db, me.user_id, "hospital.update_settings", "hospital", {"hospital_id": hospital_id})
    db.commit()
    db.refresh(h.settings)

    conflicts = _sessions_outside_hours(db, hospital_id, h.settings)
    out = HospitalSettingsResult.model_validate(h.settings)
    out.conflicting_sessions = len(conflicts)
    out.conflicts = conflicts[:8]     # enough to act on, not a wall of text
    return out
