"""Follow-ups — a patient's pending "come back" reminders.

Follow-ups are auto-created when a doctor sets a follow-up date on a
prescription (see routers.prescriptions) and closed when the patient re-books
(see routers.appointments.create_booking). This router exposes the patient's
own list for the dashboard card.
"""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Doctor, FamilyMember, FollowUp, Hospital, Patient, User
from ..schemas.follow_up import FollowUpOut
from ..services import family_link

router = APIRouter(prefix="/follow-ups", tags=["follow-ups"])


def _enrich(db: Session, rows: list[FollowUp]) -> list[FollowUpOut]:
    doc_ids = {r.doctor_id for r in rows}
    hosp_ids = {r.hospital_id for r in rows}
    fam_ids = {r.family_member_id for r in rows if r.family_member_id}
    doctors = {d.doctor_id: d for d in db.scalars(select(Doctor).where(Doctor.doctor_id.in_(doc_ids)))} if doc_ids else {}
    hospitals = {h.hospital_id: h for h in db.scalars(select(Hospital).where(Hospital.hospital_id.in_(hosp_ids)))} if hosp_ids else {}
    members = {m.member_id: m.name for m in db.scalars(select(FamilyMember).where(FamilyMember.member_id.in_(fam_ids)))} if fam_ids else {}
    out = []
    for r in rows:
        o = FollowUpOut.model_validate(r)
        o.days_until_due = (r.due_date - date.today()).days
        o.is_overdue = o.days_until_due < 0
        d = doctors.get(r.doctor_id)
        o.doctor_name = d.name if d else None
        o.doctor_specialty = d.specialization if d else None
        o.hospital_name = getattr(hospitals.get(r.hospital_id), "name", None)
        if r.family_member_id:
            o.family_member_name = members.get(r.family_member_id)
        out.append(o)
    return out


@router.get("/mine", response_model=list[FollowUpOut])
def my_follow_ups(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The logged-in patient's pending follow-ups, soonest first."""
    # Every patient record this user owns — someone treated at two hospitals holds
    # a row at each, and a follow-up raised at one must not disappear because a
    # different row happened to be found first.
    mine = list(db.scalars(select(Patient.patient_id).where(Patient.user_id == me.user_id)))
    linked = family_link.linked_member_ids(db, me)
    if not mine and not linked:
        return []
    rows = list(db.scalars(
        select(FollowUp)
        .where(family_link.visible_condition(db, me, FollowUp, mine),
               FollowUp.status == "pending")
        .order_by(FollowUp.due_date)
    ))
    return _enrich(db, rows)
