"""Module 4 — Reception endpoints (8 APIs): receptionists + shift roster."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ensure_same_tenant, require_permission
from ..models import Hospital, Receptionist, ReceptionistShift, Role, User
from ..rbac import ROLE_RECEPTIONIST
from ..schemas.reception import (
    ReceptionistCreate, ReceptionistOnboard, ReceptionistOut, ReceptionistUpdate,
    ShiftCreate, ShiftOut, ShiftUpdate, StaffAccountUpdate, StaffOut,
)
from ..security import hash_password
from ..services import person_name
from ..services import accounts, audit
from ..services.reception_scope import clean_assignment

router = APIRouter(tags=["reception"])


def _receptionist(db: Session, rid: int) -> Receptionist:
    r = db.get(Receptionist, rid)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Receptionist not found")
    return r


def _staff_out(db: Session, r: Receptionist) -> dict:
    """Receptionist record + its login's name/email/phone for list/detail views."""
    u = db.get(User, r.user_id) if r.user_id else None
    return {
        "receptionist_id": r.receptionist_id, "user_id": r.user_id,
        "hospital_id": r.hospital_id, "employee_id": r.employee_id,
        "designation": r.designation, "is_active": r.is_active,
        "joined_date": r.joined_date,
        "name": u.name if u else None,
        "email": u.email if u else None,
        "phone": u.phone if u else None,
        "doctors_assigned": r.doctors_assigned or [],
    }


def _shift(db: Session, sid: int) -> ReceptionistShift:
    s = db.get(ReceptionistShift, sid)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Shift not found")
    return s


# ================================================= Receptionists ============
@router.get("/receptionists", response_model=list[StaffOut])
def list_receptionists(
    hospital_id: UUID | None = Query(None),
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission("reception", "read")),
    db: Session = Depends(get_db),
):
    is_super = bool(me.role and me.role.name == "SUPER_ADMIN")
    stmt = select(Receptionist)
    if is_super:
        if hospital_id:
            stmt = stmt.where(Receptionist.hospital_id == hospital_id)
    else:
        stmt = stmt.where(Receptionist.hospital_id == me.hospital_id)
    if is_active is not None:
        stmt = stmt.where(Receptionist.is_active == is_active)
    rows = db.scalars(stmt.order_by(Receptionist.receptionist_id).offset((page - 1) * size).limit(size)).all()
    return [_staff_out(db, r) for r in rows]


@router.post("/receptionists/onboard", response_model=StaffOut, status_code=201)
def onboard_receptionist(body: ReceptionistOnboard, me: User = Depends(require_permission("reception", "create")), db: Session = Depends(get_db)):
    """Admin adds a receptionist to their OWN hospital: creates the RECEPTIONIST
    login + the receptionist record, both scoped to the admin's hospital."""
    if me.role and me.role.name == "SUPER_ADMIN":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Super admin must use POST /receptionists with an explicit hospital_id")
    hospital_id = me.hospital_id
    doctors_assigned = clean_assignment(db, hospital_id, body.doctors_assigned)
    body.email = accounts.normalize_email(body.email)
    if accounts.email_taken(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if body.phone and db.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")
    role = db.scalar(select(Role).where(Role.name == ROLE_RECEPTIONIST))
    if not role:
        raise HTTPException(500, "RECEPTIONIST role not seeded")
    u = User(hospital_id=hospital_id, role_id=role.role_id, name=body.name, **person_name.parts(body),
             email=body.email, phone=body.phone, password_hash=hash_password(body.password))
    db.add(u)
    db.flush()
    r = Receptionist(user_id=u.user_id, hospital_id=hospital_id,
                     employee_id=body.employee_id, designation=body.designation,
                     doctors_assigned=doctors_assigned)
    db.add(r)
    db.commit()
    db.refresh(r)
    return _staff_out(db, r)


@router.post("/receptionists", response_model=ReceptionistOut, status_code=201)
def create_receptionist(body: ReceptionistCreate, me: User = Depends(require_permission("reception", "create")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, body.hospital_id)
    if not db.get(Hospital, body.hospital_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid hospital_id")
    if not db.get(User, body.user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid user_id")
    r = Receptionist(**body.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@router.put("/receptionists/{receptionist_id}", response_model=ReceptionistOut)
def update_receptionist(receptionist_id: UUID, body: ReceptionistUpdate, me: User = Depends(require_permission("reception", "update")), db: Session = Depends(get_db)):
    r = _receptionist(db, receptionist_id)
    ensure_same_tenant(me, r.hospital_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


@router.put("/receptionists/{receptionist_id}/account", response_model=StaffOut)
def update_receptionist_account(
    receptionist_id: UUID,
    body: StaffAccountUpdate,
    me: User = Depends(require_permission("reception", "update")),
    db: Session = Depends(get_db),
):
    """Edit a receptionist's login and record together, e.g. to hand the
    account over to a replacement (new name/email/phone/password)."""
    r = _receptionist(db, receptionist_id)
    ensure_same_tenant(me, r.hospital_id)
    u = db.get(User, r.user_id) if r.user_id else None
    if not u:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Receptionist login not found")
    accounts.update_staff_login(db, u, name=body.name, email=body.email, phone=body.phone, password=body.password)
    if body.employee_id is not None:
        r.employee_id = body.employee_id or None
    if body.designation is not None:
        r.designation = body.designation.strip() or r.designation
    if body.doctors_assigned is not None:
        r.doctors_assigned = clean_assignment(db, r.hospital_id, body.doctors_assigned)
    if body.is_active is not None:
        _set_receptionist_active(db, r, u, body.is_active)
    audit.log_activity(db, me.user_id, "receptionist.update", "reception",
                       {"receptionist_id": receptionist_id, "fields": sorted(body.model_dump(exclude_unset=True))})
    db.commit()
    db.refresh(r)
    return _staff_out(db, r)


def _set_receptionist_active(db: Session, r: Receptionist, u: User | None, active: bool) -> None:
    # The login has to follow the record: this used to flip only
    # receptionists.is_active, and a "deactivated" receptionist could still sign in.
    r.is_active = active
    if u:
        u.status = "active" if active else "inactive"
        if not active:
            accounts.end_sessions(db, u)


@router.delete("/receptionists/{receptionist_id}")
def deactivate_receptionist(receptionist_id: UUID, me: User = Depends(require_permission("reception", "delete")), db: Session = Depends(get_db)):
    r = _receptionist(db, receptionist_id)
    ensure_same_tenant(me, r.hospital_id)
    _set_receptionist_active(db, r, db.get(User, r.user_id) if r.user_id else None, False)
    db.commit()
    return {"message": "Receptionist deactivated"}


# ==================================================== Shifts ================
@router.get("/receptionist-shifts", response_model=list[ShiftOut])
def list_shifts(
    receptionist_id: UUID | None = Query(None),
    hospital_id: UUID | None = Query(None),
    shift_date: str | None = Query(None),
    me: User = Depends(require_permission("reception", "read")),
    db: Session = Depends(get_db),
):
    is_super = bool(me.role and me.role.name == "SUPER_ADMIN")
    stmt = select(ReceptionistShift)
    if not is_super:
        stmt = stmt.where(ReceptionistShift.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(ReceptionistShift.hospital_id == hospital_id)
    if receptionist_id:
        stmt = stmt.where(ReceptionistShift.receptionist_id == receptionist_id)
    if shift_date:
        stmt = stmt.where(ReceptionistShift.shift_date == shift_date)
    return db.scalars(stmt.order_by(ReceptionistShift.shift_id.desc())).all()


@router.post("/receptionist-shifts", response_model=ShiftOut, status_code=201)
def create_shift(body: ShiftCreate, me: User = Depends(require_permission("reception", "update")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, body.hospital_id)
    _receptionist(db, body.receptionist_id)
    if body.start_time >= body.end_time:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "start_time must be before end_time")
    s = ReceptionistShift(**body.model_dump(), created_by=me.user_id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/receptionist-shifts/{shift_id}", response_model=ShiftOut)
def update_shift(shift_id: UUID, body: ShiftUpdate, me: User = Depends(require_permission("reception", "update")), db: Session = Depends(get_db)):
    s = _shift(db, shift_id)
    ensure_same_tenant(me, s.hospital_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/receptionist-shifts/{shift_id}")
def cancel_shift(shift_id: UUID, me: User = Depends(require_permission("reception", "update")), db: Session = Depends(get_db)):
    s = _shift(db, shift_id)
    ensure_same_tenant(me, s.hospital_id)
    db.delete(s)
    db.commit()
    return {"message": "Shift cancelled"}
