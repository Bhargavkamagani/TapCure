"""The doctor's morning schedule message.

Every other WhatsApp message TapCure sends rides on something a human just did —
a booking, a queue advance, a completed consultation. This one has no such
trigger: "good morning, here is your day" has to come from a clock. That makes
two things this module owns and the others don't.

**It decides for itself whether it's time.** Hospitals run in their own timezone
(`hospital_settings.timezone`), so "8 AM" is 8 AM *there*. The caller — a cron
run, a Lambda, the in-process ticker — just asks "anything due?" as often as it
likes, and each hospital's doctors are messaged once their own local morning has
arrived. Run it at 06:00 UTC and a Kolkata hospital gets its 8 AM message; run it
every ten minutes and nothing changes, because of the second property.

**It is idempotent per doctor per day.** The guard is the notification log
(`type='doctor_daily'`), not a flag column, so overlapping runs, a restarted
ticker and a manual re-run all converge on exactly one message. This matters
more than it sounds: a doctor who gets their schedule twice stops trusting the
schedule.
"""
from __future__ import annotations
from uuid import UUID

from datetime import date as date_cls
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import utcnow
from ..models import Appointment, Doctor, DoctorAffiliation, Hospital, User
from . import notifications as notify
from . import whatsapp_templates
from .token_engine import _hospital_tz

# Appointments in these states aren't part of the doctor's day.
_DEAD_STATUSES = {"cancelled", "no_show", "rejected"}


def _local_now(db: Session, hospital_id: UUID | None) -> datetime:
    return utcnow().replace(tzinfo=timezone.utc).astimezone(_hospital_tz(db, hospital_id))


def _session_bounds(doctor: Doctor, on_date: date_cls, affiliation_id: UUID | None):
    """The doctor's first session start and last session end for the day."""
    from .scheduling import active_schedules

    sessions = active_schedules(doctor, on_date, affiliation_id) or []
    if not sessions:
        return None, None
    return sessions[0].start_time, sessions[-1].end_time


def _fmt(t) -> str:
    """A local wall-clock time as "9:05 AM". Slot times are already local."""
    return t.strftime("%I:%M %p").lstrip("0") if t else ""


def _venue(db: Session, hospital_id: UUID | None, affiliation_id: UUID | None) -> tuple[str, str]:
    """(hospital/practice name, location text) for the digest's last two fields."""
    affiliation = db.get(DoctorAffiliation, affiliation_id) if affiliation_id else None
    hospital = db.get(Hospital, hospital_id) if hospital_id else None
    src = affiliation if (affiliation and affiliation.name) else hospital
    if src is None:
        return "TapCure", ""
    return src.name or "TapCure", whatsapp_templates.location_text(
        "", getattr(src, "address", None), getattr(src, "city", None),
    )


def send_daily_schedules(db: Session, on_date: date_cls | None = None, *,
                         force: bool = False) -> dict:
    """Message every doctor whose local morning has arrived and who has a day ahead.

    `force` skips only the clock check — never the once-per-day guard, so a
    manual run to fix a missed morning still can't double-send.
    """
    on_date = on_date or date_cls.today()
    appts = db.scalars(
        select(Appointment).where(Appointment.appointment_date == on_date)
    ).all()

    # Group by the doctor AND the place: a doctor consulting at two hospitals today
    # gets one message per hospital, because the template names a single hospital
    # and merging them would report the wrong first/last time for both.
    groups: dict[tuple, list[Appointment]] = {}
    for appt in appts:
        if (appt.status or "").lower() in _DEAD_STATUSES:
            continue
        if not appt.doctor_id:
            continue
        groups.setdefault((appt.doctor_id, appt.hospital_id, appt.affiliation_id), []).append(appt)

    sent = skipped_no_phone = skipped_already = skipped_too_early = 0
    for (doctor_id, hospital_id, affiliation_id), rows in groups.items():
        doctor = db.get(Doctor, doctor_id)
        if not doctor:
            continue
        # A doctor added by a hospital admin may have no login account, and the
        # phone lives on the user. Nothing to send to, and nothing we can fix here.
        user = db.get(User, doctor.user_id) if doctor.user_id else None
        phone = (user.phone or "").strip() if user else ""
        if not user or not phone:
            skipped_no_phone += 1
            continue
        if not force and _local_now(db, hospital_id).hour < settings.doctor_digest_hour:
            skipped_too_early += 1
            continue
        if notify.sent_today(db, user.user_id, "doctor_daily", on_date):
            skipped_already += 1
            continue

        slots = sorted(a.slot_time for a in rows if a.slot_time)
        if slots:
            first_text, last_text = _fmt(slots[0]), _fmt(slots[-1])
        else:
            # Token-mode days have no slots at all: the session times are the
            # honest answer to "when does my day start and end".
            start, end = _session_bounds(doctor, on_date, affiliation_id)
            first_text, last_text = _fmt(start), _fmt(end)

        hospital_name, location = _venue(db, hospital_id, affiliation_id)
        params = whatsapp_templates.doctor_daily_params(
            doctor.name, len(rows), on_date.strftime("%d %b %Y"),
            first_text, last_text, hospital_name, location,
        )
        notify.send_whatsapp(
            db, phone,
            f"Good morning Dr. {params[0]} — {params[1]} appointment(s) today "
            f"({params[3]} to {params[4]}) at {params[5]}.",
            ntype="doctor_daily", title="Today's Appointment Schedule",
            template_name=whatsapp_templates.doctor_daily_name(), template_params=params,
            language_code=settings.whatsapp_default_lang,
            event_type=whatsapp_templates.DOCTOR_DAILY_EVENT,
            hospital_id=hospital_id, recipient_user_id=user.user_id,
        )
        sent += 1

    db.commit()
    return {
        "date": on_date.isoformat(),
        "doctor_days": len(groups),
        "sent": sent,
        "skipped_no_phone": skipped_no_phone,
        "skipped_already_sent": skipped_already,
        "skipped_before_local_hour": skipped_too_early,
    }


def send_day_complete(db: Session, on_date: date_cls | None = None, *,
                      force: bool = False) -> dict:
    """Close each doctor's day once their own session end has passed.

    The counterpart to the morning digest, and it lives here for the same
    reason: "your day is over" is a statement about the clock, not about
    anything a human just did.

    It replaces an event-driven version that fired from `finish_serving` the
    moment no token was left waiting. That read the wrong signal twice over. A
    doctor who cleared a short queue at 3pm was told their day was complete
    while the hospital stayed open until 8 — and a day whose last patient simply
    never arrived produced no completion event at all, so the message never
    came. A clock has neither problem.

    The end used is the DOCTOR's last session end, not the hospital's closing
    time: a practice may run 8-8 while this doctor's session finishes at 1, and
    it is their day the message is about.

    Sent even when nothing was completed. "0 of 3 seen" is exactly the day a
    doctor wants to hear about, and it is precisely the day the old trigger
    stayed silent on.

    `force` skips only the clock check — never the once-per-day guard, so a
    manual run to fix a missed evening still cannot double-send.
    """
    on_date = on_date or date_cls.today()
    appts = db.scalars(
        select(Appointment).where(Appointment.appointment_date == on_date)
    ).all()

    # Same grouping as the morning message: one message per doctor per venue,
    # because the template names a single hospital and the session end differs
    # between a doctor's two practices.
    groups: dict[tuple, list[Appointment]] = {}
    for appt in appts:
        if not appt.doctor_id:
            continue
        groups.setdefault((appt.doctor_id, appt.hospital_id, appt.affiliation_id), []).append(appt)

    sent = skipped_no_phone = skipped_already = skipped_too_early = skipped_no_session = 0
    for (doctor_id, hospital_id, affiliation_id), rows in groups.items():
        doctor = db.get(Doctor, doctor_id)
        if not doctor:
            continue
        user = db.get(User, doctor.user_id) if doctor.user_id else None
        phone = (user.phone or "").strip() if user else ""
        if not user or not phone:
            skipped_no_phone += 1
            continue

        _, session_end = _session_bounds(doctor, on_date, affiliation_id)
        if session_end is None:
            # No schedule for the day means no defensible "end" — staying quiet
            # beats guessing a time and closing someone's day early.
            skipped_no_session += 1
            continue
        if not force and _local_now(db, hospital_id).time() < session_end:
            skipped_too_early += 1
            continue
        if notify.sent_today(db, user.user_id, "doctor_day", on_date):
            skipped_already += 1
            continue

        # Counts come from appointment status so all three agree with each
        # other; `rows` here is every appointment of the day, dead ones included,
        # because "scheduled" means what was on the books this morning.
        completed = sum(1 for a in rows if (a.status or "").lower() == "completed")
        dropped = sum(1 for a in rows if (a.status or "").lower() in _DEAD_STATUSES)

        hospital_name, _ = _venue(db, hospital_id, affiliation_id)
        params = whatsapp_templates.doctor_day_complete_params(
            doctor.name, on_date.strftime("%d %b %Y"),
            len(rows), completed, dropped, hospital_name,
        )
        notify.send_whatsapp(
            db, phone,
            f"Well done Dr. {params[0]} — your day for {params[1]} is complete. "
            f"{params[3]} of {params[2]} seen, {params[4]} cancelled/no-show, at {params[5]}.",
            ntype="doctor_day", title="Day Complete",
            template_name=whatsapp_templates.doctor_day_complete_name(), template_params=params,
            language_code=settings.whatsapp_default_lang,
            event_type=whatsapp_templates.DOCTOR_DAY_COMPLETE_EVENT,
            hospital_id=hospital_id, recipient_user_id=user.user_id,
        )
        sent += 1

    db.commit()
    return {
        "date": on_date.isoformat(),
        "doctor_days": len(groups),
        "sent": sent,
        "skipped_no_phone": skipped_no_phone,
        "skipped_already_sent": skipped_already,
        "skipped_before_session_end": skipped_too_early,
        "skipped_no_schedule": skipped_no_session,
    }
