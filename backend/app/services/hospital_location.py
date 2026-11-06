"""Keep a hospital's doctors pinned to the hospital's address.

A doctor's practice location lives on `doctor_affiliations`, not on the hospital
row — that's what public discovery serves to patients (`_affiliation_out`) and
what the leave-by estimate measures to (`token_engine._destination`). So when a
hospital moves, or finally sets a map pin, the hospital-managed affiliations have
to move with it, otherwise patients keep seeing the old address (or none at all,
since affiliations used to be created with a blank address and no coordinates).

Personal practices (`managed_by_hospital=False` — home visits, a doctor's own
hospital, online) are the doctor's own and are never touched here.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import DoctorAffiliation, Hospital


def hospital_practice_fields(hospital: Hospital) -> dict:
    """The hospital-owned half of an affiliation row."""
    return {
        "name": hospital.name or "Hospital",
        "address": hospital.address or "",
        "city": hospital.city or "",
        "latitude": hospital.latitude,
        "longitude": hospital.longitude,
    }


def sync_hospital_affiliations(db: Session, hospital: Hospital) -> int:
    """Copy the hospital's address/pin onto every doctor practising there.

    Returns the number of affiliations actually changed, so the caller can tell
    the admin how far their edit reached. Does not commit — the caller owns the
    transaction.
    """
    rows = db.scalars(
        select(DoctorAffiliation).where(
            DoctorAffiliation.hospital_id == hospital.hospital_id,
            DoctorAffiliation.managed_by_hospital.is_(True),
        )
    ).all()
    fields = hospital_practice_fields(hospital)
    changed = 0
    for aff in rows:
        if any(getattr(aff, k) != v for k, v in fields.items()):
            for k, v in fields.items():
                setattr(aff, k, v)
            changed += 1
    return changed
