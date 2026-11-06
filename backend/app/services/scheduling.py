"""
Scheduling resolver (deck model).

Given a doctor + date it answers: does the doctor consult that day, is the day
blocked (holiday/leave), and what consultation slots are open? Slots come from
doctor_schedule (stepped by consultation_mins), minus break windows, minus
already-booked appointments. This is what the booking + available-slots APIs and
(in Phase 4) the token engine build on.
"""
from uuid import UUID
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Appointment, Doctor, DoctorLeaveRequest, DoctorSchedule

DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
_BLOCKING_STATUSES = {"cancelled", "no_show", "rescheduled"}


def weekday_of(d: date) -> str:
    return DAY_ORDER[d.weekday()]


def fmt_time(t: time) -> str:
    h, m = t.hour, t.minute
    ap = "PM" if h >= 12 else "AM"
    hr = ((h + 11) % 12) + 1
    return f"{hr}:{m:02d} {ap}"


def active_schedules(doctor: Doctor, on_date: date, affiliation_id: UUID | None = None) -> list[DoctorSchedule]:
    wd = weekday_of(on_date)
    out = []
    for s in doctor.schedules:
        if not s.is_active or s.day_of_week != wd:
            continue
        if affiliation_id and s.affiliation_id is not None and s.affiliation_id != affiliation_id:
            continue
        if s.valid_from and on_date < s.valid_from:
            continue
        if s.valid_until and on_date > s.valid_until:
            continue
        out.append(s)
    return sorted(out, key=lambda s: s.start_time)


def is_on_holiday(doctor: Doctor, on_date: date) -> bool:
    return any(h.holiday_date == on_date and h.is_full_day for h in doctor.holidays)


def is_on_leave(db: Session, doctor: Doctor, on_date: date) -> bool:
    if doctor.status in ("inactive", "suspended"):
        return True
    return bool(
        db.scalar(
            select(DoctorLeaveRequest.leave_id).where(
                DoctorLeaveRequest.doctor_id == doctor.doctor_id,
                DoctorLeaveRequest.status == "approved",
                DoctorLeaveRequest.leave_from <= on_date,
                DoctorLeaveRequest.leave_to >= on_date,
            ).limit(1)
        )
    )


# ---- Duty (today's roster) -------------------------------------------------
# `doctors.status == "active"` is the employment record, not today's roster: a
# doctor with no session on this weekday, an approved leave, or a marked holiday
# is perfectly "active" and still not at the hospital. The front desk needs the
# second question answered — otherwise its board shows someone who was never
# expected today as "On time".
def duty_today(db: Session, doctor: Doctor, on_date: date, *, on_leave: bool | None = None) -> dict:
    """Resolve one doctor's roster state for `on_date`.

    `on_leave` lets a caller pass leave in pre-resolved (see `duty_map`) so a
    whole roster costs one leave query instead of one per doctor.
    """
    def out(state: str, label: str, detail: str = "", hours: str = "", on_duty: bool = False) -> dict:
        return {"state": state, "label": label, "detail": detail, "hours": hours, "on_duty": on_duty}

    if doctor.status == "suspended":
        return out("suspended", "Suspended")
    if doctor.status == "inactive":
        return out("inactive", "Inactive")
    if on_leave is None:
        on_leave = is_on_leave(db, doctor, on_date)
    if on_leave or doctor.status == "on_leave":
        return out("leave", "On leave")
    holiday = next(
        (h for h in doctor.holidays if h.holiday_date == on_date and h.is_full_day), None
    )
    if holiday:
        return out("holiday", "Holiday", holiday.reason or "")
    if not doctor.is_available_today:
        return out("unavailable", "Not available today")

    sessions = active_schedules(doctor, on_date)
    if not sessions:
        return out("not_scheduled", "Not consulting today", f"No {weekday_of(on_date)} session")
    # Session windows are shown as text rather than compared against the clock:
    # the server stores UTC while the hospital reads IST, so "session over" would
    # be wrong by 5½ hours on a UTC host. The desk reads the hours itself.
    hours = " · ".join(f"{fmt_time(s.start_time)} – {fmt_time(s.end_time)}" for s in sessions)

    presence = doctor.presence.status if doctor.presence else None
    if presence == "on_break":
        return out("on_break", "On break", doctor.presence.note or "", hours, True)
    return out("on_duty", "On duty", "", hours, True)


def duty_map(db: Session, doctors: list[Doctor], on_date: date) -> dict[int, dict]:
    """`duty_today` for a whole roster, with leave resolved in one query."""
    ids = [d.doctor_id for d in doctors]
    on_leave: set[int] = set()
    if ids:
        on_leave = set(
            db.scalars(
                select(DoctorLeaveRequest.doctor_id).where(
                    DoctorLeaveRequest.doctor_id.in_(ids),
                    DoctorLeaveRequest.status == "approved",
                    DoctorLeaveRequest.leave_from <= on_date,
                    DoctorLeaveRequest.leave_to >= on_date,
                )
            ).all()
        )
    return {
        d.doctor_id: duty_today(db, d, on_date, on_leave=d.doctor_id in on_leave)
        for d in doctors
    }


def _in_break(slot: time, schedule: DoctorSchedule) -> bool:
    return any(b.break_start <= slot < b.break_end for b in schedule.breaks)


def generate_slots(schedule: DoctorSchedule) -> list[time]:
    """Step from start_time to end_time by consultation_mins, skipping breaks."""
    step = max(1, schedule.consultation_mins)
    base = date(2000, 1, 1)
    cur = datetime.combine(base, schedule.start_time)
    end = datetime.combine(base, schedule.end_time)
    slots: list[time] = []
    while cur < end and len(slots) < schedule.max_tokens:
        t = cur.time()
        if not _in_break(t, schedule):
            slots.append(t)
        cur += timedelta(minutes=step)
    return slots


def booked_times(db: Session, doctor_id: UUID, on_date: date, affiliation_id: UUID | None = None) -> set[time]:
    stmt = select(Appointment.slot_time).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == on_date,
        Appointment.status.not_in(_BLOCKING_STATUSES),
    )
    if affiliation_id:
        stmt = stmt.where(
            (Appointment.affiliation_id == affiliation_id) | (Appointment.affiliation_id.is_(None))
        )
    rows = db.scalars(
        stmt
    ).all()
    return {t for t in rows if t is not None}


_IST = timezone(timedelta(hours=5, minutes=30), "IST")


def ist_now() -> datetime:
    return datetime.now(_IST).replace(tzinfo=None)


def available_slots(db: Session, doctor: Doctor, on_date: date, affiliation_id: UUID | None = None) -> dict:
    """Resolve a date → open slots (or the reason none are available).

    For TODAY, sessions that have already ended are closed, and slot times
    already gone are left out. A session still running stays bookable until its
    end time (the same rule as the walk-in desk), even once its last slot time
    has passed — token visits don't need a slot. Without this a patient could
    book a token at 10 pm for a 9-12 session, a visit nobody can attend.
    """
    if is_on_holiday(doctor, on_date):
        return {"available": False, "reason": "Doctor on holiday", "slots": []}
    if is_on_leave(db, doctor, on_date):
        return {"available": False, "reason": "Doctor on leave", "slots": []}
    schedules = active_schedules(doctor, on_date, affiliation_id)
    if not schedules:
        return {"available": False, "reason": "Doctor does not consult on " + weekday_of(on_date), "slots": []}

    now = ist_now()
    is_today = on_date == now.date()
    if is_today:
        open_sessions = [s for s in schedules if now.time() < s.end_time]
        if not open_sessions:
            hours = " · ".join(f"{fmt_time(s.start_time)} – {fmt_time(s.end_time)}" for s in schedules)
            return {"available": False, "reason": f"Today's hours are over ({hours})", "slots": []}
        schedules = open_sessions

    taken = booked_times(db, doctor.doctor_id, on_date, affiliation_id)
    free = 0
    slots = []
    for s in schedules:
        for t in generate_slots(s):
            if t in taken:
                continue
            free += 1
            if is_today and t < now.time():
                continue                      # already gone; not offered as a slot
            slots.append({
                "schedule_id": s.schedule_id,
                "time": t.strftime("%H:%M"),
                "label": fmt_time(t),
            })
    return {"available": bool(free), "reason": None if free else "Fully booked", "slots": slots}


def schedule_for_slot(doctor: Doctor, on_date: date, slot: time, affiliation_id: UUID | None = None) -> Optional[DoctorSchedule]:
    """Which active schedule (if any) contains this slot time."""
    for s in active_schedules(doctor, on_date, affiliation_id):
        if s.start_time <= slot < s.end_time:
            return s
    return None
