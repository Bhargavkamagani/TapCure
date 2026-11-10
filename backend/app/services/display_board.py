"""
The waiting-room TV board: every doctor working at a hospital today, with who
is being seen now, who is next, and how many are waiting.

Read through a secret link (hospitals.display_key) with no login, so it carries
NOTHING about patients — token codes and counts only. Built with a fixed number
of queries however many doctors and tokens there are: a TV asks every few
seconds, all day.

Same scope as the hospital's own OP Queue: the hospital's own doctors and its
own practice. A doctor's personal practice tokens never appear here.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..database import utcnow
from ..models import Doctor, DoctorDelayLog, Hospital, Token
from . import scheduling as sch
from . import storage
from . import token_engine as te

NEXT_SHOWN = 5
# Doctors away today are still listed (greyed) so patients aren't left looking
# for a doctor who simply isn't on the board. "Not consulting today" (no session
# on this weekday) is left out — that is most doctors on most days.
OFF_SHOWN = ("leave", "holiday", "unavailable")


def build(db: Session, hospital: Hospital, *, on_date: Optional[date] = None,
          only_doctors: Optional[set[UUID]] = None) -> dict:
    on_date = on_date or date.today()

    stmt = (
        select(Doctor)
        .where(
            Doctor.hospital_id == hospital.hospital_id,
            Doctor.verification_status == "verified",
            Doctor.status.not_in(("inactive", "suspended")),
            # A solo doctor is only anchored to a hospital as a tenant placeholder.
            Doctor.is_self_registered.is_not(True),
        )
        .options(selectinload(Doctor.schedules), selectinload(Doctor.holidays), joinedload(Doctor.presence))
    )
    if only_doctors:
        stmt = stmt.where(Doctor.doctor_id.in_(only_doctors))
    doctors = db.scalars(stmt).unique().all()
    duty = sch.duty_map(db, doctors, on_date)

    # Every one of today's hospital-practice tokens, in one query.
    tokens = db.scalars(te._managed_only(
        select(Token).where(
            Token.hospital_id == hospital.hospital_id,
            Token.token_date == on_date,
            Token.status.in_(("waiting", "current", "completed")),
        )
    )).all()
    by_doctor: dict[UUID, list[Token]] = {}
    for t in tokens:
        by_doctor.setdefault(t.doctor_id, []).append(t)

    delays = dict(db.execute(
        select(DoctorDelayLog.doctor_id, func.coalesce(func.sum(DoctorDelayLog.delay_minutes), 0))
        .where(DoctorDelayLog.delay_date == on_date,
               DoctorDelayLog.doctor_id.in_([d.doctor_id for d in doctors] or [None]))
        .group_by(DoctorDelayLog.doctor_id)
    ).all())

    rows, off_today = [], []
    for d in doctors:
        mine = by_doctor.get(d.doctor_id, [])
        state = duty.get(d.doctor_id) or {}
        if not mine and not state.get("on_duty"):
            if state.get("state") in OFF_SHOWN:
                off_today.append({"doctor_id": d.doctor_id, "name": d.name,
                                  "specialization": d.specialization, "label": state.get("label") or "Away today"})
            continue
        current = next((t for t in mine if t.status == "current"), None)
        waiting = sorted(
            (t for t in mine if t.status == "waiting"),
            key=lambda t: (te.PRIORITY_RANK.get(t.priority, 2), t.queue_position, t.token_number),
        )
        rows.append({
            "doctor_id": d.doctor_id,
            "name": d.name,
            "specialization": d.specialization,
            # Public already (Find Doctors shows it); a link the TV can open.
            "photo_url": storage.media_url(d.profile_photo_url, "doctors"),
            "duty": {"state": state.get("state"), "label": state.get("label"), "hours": state.get("hours", "")},
            "now_serving": current.display_code if current else None,
            # Changes every time a token is called (or recalled into the room), so
            # the screen knows when to flash it.
            "now_serving_since": (current.actual_start if current else None),
            "next": [t.display_code for t in waiting[:NEXT_SHOWN]],
            "waiting": len(waiting),
            "completed": sum(1 for t in mine if t.status == "completed"),
            "delay_min": int(delays.get(d.doctor_id) or 0),
        })
    # Doctors seeing patients first, then on duty, then by name.
    rows.sort(key=lambda r: (r["now_serving"] is None, not (r["duty"]["state"] == "on_duty"), (r["name"] or "").lower()))
    return {
        "hospital_name": hospital.name,
        "date": on_date.isoformat(),
        "generated_at": utcnow(),
        "doctors": rows,
        "off_today": sorted(off_today, key=lambda r: (r["name"] or "").lower()),
    }
