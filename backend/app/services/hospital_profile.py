"""'Complete your profile' on the server (2026-11-10).

A hospital from the short signup is hidden from patients until its owner has
added the three things signup no longer asks for:
  1. a logo or a photo,
  2. opening hours they chose (hours_confirmed — signup only saves a 24x7 default),
  3. at least one real service (not the "General OPD" every signup gets).
Once all three are there, hospitals.profile_completed_at is set and the hospital
and its doctors appear in patient search and can be booked online. It is set
once and never cleared, so removing a photo later does not hide a live hospital.
The frontend's HospitalSetupStatus.jsx counts the same three steps.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import utcnow
from ..models.hospital import Department, Hospital, HospitalSettings


def is_auto_opd(d: Department) -> bool:
    return (d.code or "") == "OPD" and (d.name or "").strip().lower() == "general opd"


def visible_to_patients():
    """WHERE conditions for a hospital patients may see."""
    return (
        Hospital.status == "active",
        Hospital.is_active.is_(True),
        Hospital.profile_completed_at.is_not(None),
    )


def is_visible(h: Hospital | None) -> bool:
    return bool(h and h.status == "active" and h.is_active and h.profile_completed_at is not None)


def steps(db: Session, hospital: Hospital) -> dict[str, bool]:
    cfg = db.scalar(select(HospitalSettings).where(HospitalSettings.hospital_id == hospital.hospital_id))
    depts = db.scalars(select(Department).where(Department.hospital_id == hospital.hospital_id)).all()
    return {
        "photo": bool(hospital.logo_url or hospital.photo_url),
        "hours": bool(cfg and cfg.hours_confirmed),
        "services": any(d.is_active and not is_auto_opd(d) for d in depts),
    }


def mark_if_complete(db: Session, hospital: Hospital | None) -> bool:
    """Set profile_completed_at when all three steps are done. Call after any
    change to the picture, hours or services; the caller commits."""
    if hospital is None or hospital.profile_completed_at is not None:
        return False
    db.flush()
    if all(steps(db, hospital).values()):
        hospital.profile_completed_at = utcnow()
        return True
    return False
