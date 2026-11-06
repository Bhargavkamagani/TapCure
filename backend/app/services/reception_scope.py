"""Which doctors a receptionist may see.

A hospital can have several receptionists, each handling particular doctors
(receptionists.doctors_assigned). An empty / NULL assignment means "every
doctor at the hospital" — how reception worked before assignments existed.

Every endpoint the reception console reads goes through `assigned_doctor_ids`:
it returns None for anyone who is not restricted (admins, doctors, patients,
unassigned receptionists), so callers only add a filter when it's a set.
"""
from uuid import UUID
from typing import Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import parse_uuid

from ..models import Doctor, Receptionist, User
from ..rbac import ROLE_RECEPTIONIST


def assigned_doctor_ids(db: Session, user: User) -> Optional[set[int]]:
    """The doctor_ids this user is limited to, or None for no limit."""
    if not user or not user.role or user.role.name != ROLE_RECEPTIONIST:
        return None
    ids = db.scalar(
        select(Receptionist.doctors_assigned).where(
            Receptionist.user_id == user.user_id,
            Receptionist.hospital_id == user.hospital_id,
        )
    )
    # Stored in JSON as strings; anything that isn't a UUID is ignored.
    found = {u for u in (parse_uuid(i) for i in ids) if u is not None} if ids else set()
    return found or None


def can_see_doctor(db: Session, user: User, doctor_id: Optional[UUID]) -> bool:
    allowed = assigned_doctor_ids(db, user)
    return allowed is None or doctor_id is None or doctor_id in allowed


def ensure_can_see_doctor(db: Session, user: User, doctor_id: Optional[UUID]) -> None:
    """403 when a restricted receptionist acts on a doctor she isn't assigned to."""
    if not can_see_doctor(db, user, doctor_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to this doctor")


def restrict(stmt, column, db: Session, user: User):
    """Add `column IN assigned` to a select when the user is restricted."""
    allowed = assigned_doctor_ids(db, user)
    return stmt if allowed is None else stmt.where(column.in_(allowed))


def clean_assignment(db: Session, hospital_id: UUID, ids: Optional[Iterable]) -> Optional[list[str]]:
    """Validate an admin-supplied list: every id must be a doctor at this
    hospital. Returns a sorted de-duplicated list of id STRINGS (it is stored
    in a JSON column), or None for "all doctors"."""
    wanted = sorted({u for u in (parse_uuid(i) for i in (ids or [])) if u is not None})
    if not wanted:
        return None
    found = set(db.scalars(
        select(Doctor.doctor_id).where(Doctor.doctor_id.in_(wanted), Doctor.hospital_id == hospital_id)
    ).all())
    missing = [i for i in wanted if i not in found]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Doctor(s) not at this hospital: {[str(i) for i in missing]}")
    return [str(i) for i in wanted]
