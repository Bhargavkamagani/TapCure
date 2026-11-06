"""
Token Engine core — the queue brain.

Pure-ish helpers the tokens router orchestrates: daily token numbering, the
patient-facing display code, queue-position recomputation (priority-aware),
live ETA, and the status/movement/recall audit writes.

ETA model:  estimated_time = now + (queue_position - 1) * avg_consult + active_delay
where active_delay is the sum of today's logged delays for the doctor.

Leave-by model:  the patient also carries a travel time (door → hospital). We work
*backwards* from the call ETA so they start their journey at the right moment:

    leave_by  = estimated_time - travel_minutes - ARRIVAL_BUFFER_MIN
    remind_at = leave_by - REMIND_BEFORE_MIN          (the "time to leave" alert)

travel_minutes is taken from the token if set (entered/derived at booking), else
computed from the origin + hospital coordinates via the haversine helper below.
"""
from uuid import UUID
import math
import time as _clock
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from ..config import settings
from ..database import lock_key, utcnow
from ..models import (
    Appointment, ApptStatusHistory, Doctor, DoctorAffiliation, DoctorDelayLog,
    FamilyMember, FollowUp, Hospital, Patient, Token, TokenMovementLog, TokenRecallHistory,
    TokenStatusHistory, User,
)
from . import google_maps
from . import notifications as notify
from . import routing
from . import whatsapp_templates

PRIORITY_RANK = {"emergency": 0, "urgent": 1, "normal": 2}
_DEFAULT_CONSULT = 10

# Travel / leave-by tuning. AVG_SPEED + DETOUR turn straight-line distance into a
# road-ish travel time; the two buffers add safety margin around the call ETA.
AVG_SPEED_KMPH = 30.0       # assumed door-to-hospital speed
DETOUR_FACTOR = 1.3         # roads aren't straight lines — pad ~30%
ARRIVAL_BUFFER_MIN = 30     # patient should reach the hospital 30 min before their token ETA
REMIND_BEFORE_MIN = 15      # fire the "time to leave" alert this long before leave_by
ALMOST_TURN_POSITION = 4    # "almost your turn" goes out with THREE patients still ahead
                            # (position 4 == 3 ahead). Raised from 2 on 21 Aug 2026: one
                            # patient ahead is ~10 min at the default consult length, too
                            # little notice to be worth acting on.


# ---- one booking at a time per doctor per day -------------------------------
LOCK_WAIT_SECONDS = 15


def lock_doctor_day(db: Session, doctor_id: UUID, on_date: date) -> None:
    """Make bookings for one doctor on one day happen one after another.

    Every path that checks "is this slot free?" and then books, or reads the
    day's highest token number and adds one, must hold this until it commits.
    Without it, two requests in the same instant both see #7 as the highest and
    both take #8 (or both take 10:30): neither can see the other's uncommitted row.

    A Postgres transaction-level advisory lock, so it is released automatically
    on commit or rollback, is re-entrant within one transaction (a caller that
    locks and then calls allocate_token doesn't block itself), and is keyed per
    doctor + date so other doctors and other days never wait.

    Waits at most LOCK_WAIT_SECONDS, then asks the caller to retry rather than
    hanging behind a request that is stuck. No-op on SQLite (zero-setup dev).
    """
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return
    keys = {"doctor": lock_key(doctor_id), "day": on_date.toordinal()}
    deadline = _clock.monotonic() + LOCK_WAIT_SECONDS
    while not db.scalar(text("SELECT pg_try_advisory_xact_lock(:doctor, :day)"), keys):
        if _clock.monotonic() >= deadline:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Many bookings are being made for this doctor right now. Please try again in a moment.",
            )
        _clock.sleep(0.05)


# ---- numbering / labels -----------------------------------------------------
def next_token_number(db: Session, doctor_id: UUID, token_date: date) -> int:
    current_max = db.scalar(
        select(func.max(Token.token_number)).where(
            Token.doctor_id == doctor_id, Token.token_date == token_date
        )
    )
    return (current_max or 0) + 1


def make_display_code(db: Session, hospital_id: UUID, number: int) -> str:
    hospital = db.get(Hospital, hospital_id)
    prefix = "OPD"
    if hospital:
        prefix = (hospital.settings.token_prefix if hospital.settings else None) or hospital.short_code or "OPD"
    return f"{prefix}-{number:03d}"


# ---- timing -----------------------------------------------------------------
def avg_consult_mins(doctor: Doctor, on_date: date, affiliation_id: UUID | None = None) -> int:
    from .scheduling import active_schedules
    scheds = active_schedules(doctor, on_date, affiliation_id)
    if scheds:
        return min(s.consultation_mins for s in scheds) or _DEFAULT_CONSULT
    return _DEFAULT_CONSULT


def active_delay_mins(db: Session, doctor_id: UUID, on_date: date) -> int:
    total = db.scalar(
        select(func.coalesce(func.sum(DoctorDelayLog.delay_minutes), 0)).where(
            DoctorDelayLog.doctor_id == doctor_id, DoctorDelayLog.delay_date == on_date
        )
    )
    return int(total or 0)


# ---- travel / leave-by ------------------------------------------------------
def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two lat/lng points, in kilometres."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def travel_minutes_between(o_lat: float, o_lng: float, d_lat: float, d_lng: float) -> int:
    """Driving minutes between two points, best source available.

    Tried in order of accuracy: Google Distance Matrix (live traffic) →
    OpenRouteService → a haversine estimate. Each provider fails open, so this
    always returns a number and never raises — callers can rely on getting an
    answer even with no API keys configured.

    Extracted from `travel_minutes_for` so the BOOKING flow can ask "can this
    patient physically reach this slot?" using the same numbers the leave-by
    reminder will later use. Keeping one implementation means the warning shown
    at booking and the reminder sent afterwards can never disagree.
    """
    road = (
        google_maps.driving_minutes(o_lat, o_lng, d_lat, d_lng)
        or routing.driving_minutes(o_lat, o_lng, d_lat, d_lng)   # OSRM, then ORS
    )
    if road is not None:
        return road
    km = haversine_km(o_lat, o_lng, d_lat, d_lng) * DETOUR_FACTOR
    return max(1, round(km / AVG_SPEED_KMPH * 60))


def practice_coords(db: Session, affiliation_id: UUID | None, hospital_id: UUID | None) -> tuple[float, float] | None:
    """Where the patient is actually being sent: the booked practice location,
    falling back to the parent hospital. A doctor's personal hospital or home has
    its own pin, so the affiliation wins when it has one.

    Same resolution order `travel_minutes_for` has always used — lifted out so
    the booking flow resolves the destination identically.
    """
    if affiliation_id is not None:
        aff = db.get(DoctorAffiliation, affiliation_id)
        if aff and aff.latitude is not None and aff.longitude is not None:
            return float(aff.latitude), float(aff.longitude)
    if hospital_id is not None:
        hospital = db.get(Hospital, hospital_id)
        if hospital and hospital.latitude is not None and hospital.longitude is not None:
            return float(hospital.latitude), float(hospital.longitude)
    return None


def travel_minutes_for(db: Session, token: Token) -> Optional[int]:
    """Door-to-hospital travel time for a token.

    Prefers the value stored on the token (entered/derived at booking). Falls
    back to a haversine estimate from the origin to the *booked practice
    location* — a doctor's personal hospital or home has its own coordinates, so
    we use those rather than the parent hospital; the hospital is only the
    fallback when the affiliation has no location set. Returns None when we have
    neither — the caller then omits the leave-by hints.
    """
    if token.travel_minutes is not None:
        return int(token.travel_minutes)
    if token.origin_lat is None or token.origin_lng is None:
        return None

    # Destination = the affiliation the patient actually chose, then hospital.
    dest = practice_coords(db, token.affiliation_id, token.hospital_id)
    if dest is None:
        return None
    return travel_minutes_between(
        float(token.origin_lat), float(token.origin_lng), dest[0], dest[1]
    )


# ---- queue ------------------------------------------------------------------
def _managed_only(stmt):
    """Restrict a Token query to hospital-managed practices — used to keep a
    doctor's *personal* practice tokens out of hospital-staff queue views. Tokens
    with no affiliation are legacy hospital tokens → kept."""
    return stmt.outerjoin(
        DoctorAffiliation, Token.affiliation_id == DoctorAffiliation.affiliation_id
    ).where(
        or_(
            Token.affiliation_id.is_(None),
            DoctorAffiliation.managed_by_hospital.is_(True),
        )
    )


def waiting_tokens(db: Session, doctor_id: UUID, on_date: date, affiliation_id: UUID | None = None,
                   managed_only: bool = False) -> list[Token]:
    stmt = select(Token).where(
        Token.doctor_id == doctor_id, Token.token_date == on_date, Token.status == "waiting"
    )
    if affiliation_id:
        stmt = stmt.where(Token.affiliation_id == affiliation_id)
    if managed_only:
        stmt = _managed_only(stmt)
    rows = db.scalars(stmt).all()
    return sorted(rows, key=lambda t: (PRIORITY_RANK.get(t.priority, 2), t.queue_position, t.token_number))


def current_token(db: Session, doctor_id: UUID, on_date: date, affiliation_id: UUID | None = None,
                  managed_only: bool = False) -> Optional[Token]:
    stmt = select(Token).where(
        Token.doctor_id == doctor_id, Token.token_date == on_date, Token.status == "current"
    )
    if affiliation_id:
        stmt = stmt.where(Token.affiliation_id == affiliation_id)
    if managed_only:
        stmt = _managed_only(stmt)
    return db.scalar(stmt)


def recompute_positions(db: Session, doctor_id: UUID, on_date: date, affiliation_id: UUID | None = None) -> list[Token]:
    """Re-number waiting tokens 1..N (priority floats up) and refresh ETAs."""
    ordered = waiting_tokens(db, doctor_id, on_date, affiliation_id)
    doctor = db.get(Doctor, doctor_id)
    avg = avg_consult_mins(doctor, on_date, affiliation_id) if doctor else _DEFAULT_CONSULT
    delay = active_delay_mins(db, doctor_id, on_date)
    base = utcnow()
    for i, t in enumerate(ordered, start=1):
        t.queue_position = i
        t.estimated_time = base + timedelta(minutes=(i - 1) * avg + delay)
        # As positions shift, anyone now within their leave window gets the alert,
        # and anyone who just reached the front of the queue gets the heads-up.
        maybe_send_leave_alert(db, t)
        maybe_send_almost_turn(db, t)
    return ordered


def allocate_token(db: Session, appt, by: Optional[int], priority: str = "normal") -> Token:
    """Mint the queue token for an appointment (idempotent — returns the existing
    one if already allocated). Used by patient booking and the hospital generate API
    so a token exists the moment a visit is booked.
    """
    # Taken before the "already has a token?" check too, so a double-clicked
    # Generate can't mint two tokens for one appointment.
    lock_doctor_day(db, appt.doctor_id, appt.appointment_date)
    existing = db.scalar(select(Token).where(Token.appointment_id == appt.appointment_id))
    if existing:
        return existing
    number = next_token_number(db, appt.doctor_id, appt.appointment_date)
    token = Token(
        appointment_id=appt.appointment_id, doctor_id=appt.doctor_id, patient_id=appt.patient_id,
        affiliation_id=getattr(appt, "affiliation_id", None),
        hospital_id=appt.hospital_id, token_number=number,
        display_code=make_display_code(db, appt.hospital_id, number),
        token_date=appt.appointment_date, status="waiting", priority=priority,
        queue_position=9999, is_walkin=(appt.appointment_type == "walkin"),
        origin_lat=appt.origin_lat, origin_lng=appt.origin_lng,
        origin_label=appt.origin_label, travel_minutes=appt.travel_minutes,
    )
    db.add(token)
    db.flush()
    set_status(db, token, "waiting", by, "Token generated")
    log_movement(db, token, "generate", None, token.queue_position, by, "Generated")
    appt.status = "confirmed"
    appt.confirmed_at = utcnow()
    recompute_positions(db, appt.doctor_id, appt.appointment_date, token.affiliation_id)
    send_booking_confirmation(db, appt, token)
    return token


def move_token(db: Session, appt, by: Optional[int], old_date: date) -> Optional[Token]:
    """Follow an appointment that was rescheduled onto a new date.

    The token carries its own `token_date` and queue position, so without this
    the visit moves but its token stays behind — the patient turns up on the new
    day holding a token the doctor's queue for that day doesn't contain.

    Re-issues the number for the new day (numbering is per doctor per date),
    re-opens the token as waiting, and recomputes BOTH queues so the day being
    left doesn't keep a hole in its ordering. Returns None if no token exists yet.
    """
    token = db.scalar(select(Token).where(Token.appointment_id == appt.appointment_id))
    if token is None or token.token_date == appt.appointment_date:
        return token

    lock_doctor_day(db, appt.doctor_id, appt.appointment_date)
    frm = token.queue_position
    token.token_number = next_token_number(db, appt.doctor_id, appt.appointment_date)
    token.display_code = make_display_code(db, appt.hospital_id, token.token_number)
    token.token_date = appt.appointment_date
    token.queue_position = 9999
    # The leave-by alert already fired for the old date; it has to fire again.
    token.notified_leave = False
    # A visit that was missed on the old day re-enters the queue on the new one.
    if token.status != "waiting":
        set_status(db, token, "waiting", by, "Rescheduled")
    db.flush()
    log_movement(db, token, "reorder", frm, token.queue_position, by, "Rescheduled")

    recompute_positions(db, appt.doctor_id, old_date, token.affiliation_id)
    recompute_positions(db, appt.doctor_id, appt.appointment_date, token.affiliation_id)
    return token


def _venue(db: Session, appt, token: Token) -> dict:
    """Where this visit happens: display text + a directions link.

    A doctor's own practice (the affiliation) overrides the hospital, because
    that's the address the patient must actually travel to — sending them to the
    parent hospital's address would be worse than sending nothing.
    """
    affiliation = db.get(DoctorAffiliation, getattr(appt, "affiliation_id", None)) \
        if getattr(appt, "affiliation_id", None) else None
    hospital = db.get(Hospital, appt.hospital_id) if appt.hospital_id else None
    src = affiliation if (affiliation and affiliation.name) else hospital
    if src is None:
        return {"name": "TapCure hospital", "text": "TapCure hospital",
                "directions": google_maps.directions_url()}

    name = src.name or "TapCure hospital"
    address = getattr(src, "address", None)
    city = getattr(src, "city", None)
    return {
        "name": name,
        "text": whatsapp_templates.location_text(name, address, city),
        "directions": google_maps.directions_url(
            getattr(src, "latitude", None), getattr(src, "longitude", None), name, address, city,
        ),
    }


def send_booking_confirmation(db: Session, appt, token: Token) -> bool:
    patient = db.get(Patient, appt.patient_id) if appt.patient_id else None
    if not patient:
        return False
    member = db.get(FamilyMember, appt.family_member_id) if getattr(appt, "family_member_id", None) else None
    phone = notify.reminder_phone(patient, member)
    if not phone:
        return False

    doctor = db.get(Doctor, appt.doctor_id)
    patient_name = (member.name if member else patient.name) or "Patient"
    venue = _venue(db, appt, token)
    date_text = appt.appointment_date.strftime("%d %b %Y")
    # Token-mode and walk-in bookings carry no slot: the honest answer is the
    # queue, not a made-up clock time. Never blank — Meta rejects the send.
    if getattr(appt, "slot_time", None):
        time_text = appt.slot_time.strftime("%I:%M %p").lstrip("0")
    else:
        time_text = "As per token queue"

    params = whatsapp_templates.appointment_confirmed_params(
        patient_name, date_text, time_text, doctor.name if doctor else "",
        token.display_code, venue["text"], venue["directions"],
    )
    when_text = f"at {params[2]}" if getattr(appt, "slot_time", None) else "in the token queue"
    message = (
        f"Appointment confirmed for {params[0]} on {params[1]} {when_text} "
        f"with Dr. {params[3]}. Token {params[4]} at {venue['name']}."
    )
    notify.send_whatsapp(
        db, phone, message, ntype="booking", title="Appointment Confirmed",
        template_name=whatsapp_templates.appointment_confirmed_name(),
        template_params=params,
        language_code=settings.whatsapp_default_lang,
        event_type=whatsapp_templates.APPOINTMENT_CONFIRMED_EVENT,
        hospital_id=appt.hospital_id, patient_id=appt.patient_id,
        appointment_id=appt.appointment_id, token_id=token.token_id,
    )
    return True


def hospital_tz(db: Session, hospital_id: Optional[UUID]):
    """Public alias — other services (booking reachability) need the same clock
    the queue and session hours run on."""
    return _hospital_tz(db, hospital_id)


def _hospital_tz(db: Session, hospital_id: Optional[UUID]):
    """Hospital wall-clock timezone — schedules and slots are local, not UTC."""
    from ..models import HospitalSettings
    from zoneinfo import ZoneInfo

    row = db.scalar(select(HospitalSettings).where(HospitalSettings.hospital_id == hospital_id)) if hospital_id else None
    for key in ((row.timezone if row else None), "Asia/Kolkata"):
        if not key:
            continue
        try:
            return ZoneInfo(key)
        except Exception:
            continue
    # Windows/slim containers may ship no tz database. IST has no DST.
    return timezone(timedelta(hours=5, minutes=30), "IST")


def _earliest_call_time(db: Session, token: Token) -> Optional[datetime]:
    """The soonest this token could possibly be called, as naive UTC.

    The queue ETA counts only the people ahead, so a token issued before its
    session opens reads as "your turn is now". The doctor can't call anyone
    before the booked slot, or before the session starts — whichever applies.
    """
    tz = _hospital_tz(db, token.hospital_id)

    def to_utc(t) -> datetime:
        return datetime.combine(token.token_date, t, tzinfo=tz).astimezone(timezone.utc).replace(tzinfo=None)

    appt = db.get(Appointment, token.appointment_id) if token.appointment_id else None
    slot = getattr(appt, "slot_time", None)
    if slot is not None:
        return to_utc(slot)

    # Token-mode / walk-in bookings have no slot: fall back to the start of the
    # doctor's first session that day.
    from .scheduling import active_schedules
    doctor = db.get(Doctor, token.doctor_id)
    sessions = active_schedules(doctor, token.token_date, token.affiliation_id) if doctor else []
    return to_utc(sessions[0].start_time) if sessions else None


def estimate(db: Session, token: Token) -> dict:
    """Complete patient-facing "my token" status: identity + live queue context +
    travel / leave-by. Live timing (ETA, leave-by) is computed only for *today's*
    queue; for a future date we return the token identity and let the UI show the
    booked slot time instead."""
    doctor = db.get(Doctor, token.doctor_id)
    avg = avg_consult_mins(doctor, token.token_date, token.affiliation_id) if doctor else _DEFAULT_CONSULT
    delay = active_delay_mins(db, token.doctor_id, token.token_date)
    pos = token.queue_position or 0
    now = utcnow()
    waiting = waiting_tokens(db, token.doctor_id, token.token_date, token.affiliation_id)
    cur = current_token(db, token.doctor_id, token.token_date, token.affiliation_id)
    is_today = token.token_date == date.today()
    travel = travel_minutes_for(db, token)

    out = {
        "token_id": token.token_id,
        "display_code": token.display_code,
        "token_number": token.token_number,
        "token_date": token.token_date,
        "status": token.status,
        "queue_position": pos,
        "total_waiting": len(waiting),
        "now_serving": cur.display_code if cur else None,
        "avg_consult_min": avg,
        "delay_min": delay,
        "wait_min": 0,
        "estimated_time": None,
        "arrive_by": None,
        "travel_min": travel,
        "origin_label": token.origin_label or None,
        "leave_by": None,
        "remind_at": None,
        "should_leave_now": False,
    }

    if is_today and token.status in ("waiting", "current"):
        eta = now + timedelta(minutes=max(0, (pos - 1)) * avg + delay)
        # The queue ETA only counts people ahead, so a token booked for a 3 PM
        # slot at 9 AM used to read "your turn is now". Nobody is called before
        # their slot (or before the session opens), so take the later of the two.
        earliest = _earliest_call_time(db, token)
        if earliest and earliest > eta:
            eta = earliest
        out["wait_min"] = max(0, int((eta - now).total_seconds() // 60))
        out["estimated_time"] = eta
        # Never advise a moment that has already passed. Working backwards from
        # the ETA is right when there's a queue ahead, but for the FIRST token
        # the ETA is now — so subtracting the 30-minute arrival buffer told a
        # patient booking at 12:14 to reach the hospital by 11:44. When the ideal
        # departure is already behind us the honest answer is "now".
        #
        # ...and it can never be earlier than the journey allows. For the FIRST
        # patient of the day the ETA is now, so this used to read "reach the
        # hospital by 5:00" at 5:00 to someone ten minutes away — a time they
        # physically cannot make. Floor it at now + travel: the earliest they
        # can actually be standing there.
        arrive_by = max(eta - timedelta(minutes=ARRIVAL_BUFFER_MIN), now)
        if travel is not None:
            arrive_by = max(arrive_by, now + timedelta(minutes=travel))
        out["arrive_by"] = arrive_by
        if travel is not None and token.status == "waiting":
            leave_by = max(eta - timedelta(minutes=travel + ARRIVAL_BUFFER_MIN), now)
            out.update(
                leave_by=leave_by,
                remind_at=leave_by - timedelta(minutes=REMIND_BEFORE_MIN),
                should_leave_now=now >= leave_by,
            )
    elif token.status == "waiting" and token.token_date > date.today() and travel is not None:
        # A booking for a LATER day had no travel guidance at all: `leave_by`
        # came back None because there's no live queue to work backwards from.
        # That's precisely backwards for the patients who need it most — someone
        # travelling eight hours to a 10 AM appointment tomorrow has to set off
        # TODAY, and the app was silent about it until the morning of the visit.
        #
        # There's no queue position to reason about yet, so the target is when
        # the doctor could first call them: their booked slot, else the start of
        # that day's first session — the same anchor the live ETA falls back to.
        start = _earliest_call_time(db, token)
        if start:
            leave_by = start - timedelta(minutes=travel + ARRIVAL_BUFFER_MIN)
            out.update(
                estimated_time=start,
                arrive_by=start - timedelta(minutes=ARRIVAL_BUFFER_MIN),
                leave_by=leave_by,
                remind_at=leave_by - timedelta(minutes=REMIND_BEFORE_MIN),
                # True when the departure window has already opened — which for
                # a long journey can be the day before the appointment.
                should_leave_now=now >= leave_by,
            )
    return out


def dispatch_leave_alerts(db: Session, limit: int = 300) -> dict:
    """Send every "time to leave" alert that has come due. The whole job, in one call.

    Why this exists: `maybe_send_leave_alert` is only reachable from
    `recompute_positions`, which runs ONLY inside staff actions — call next,
    complete, cancel, no-show, skip, recall, reorder, delay, generate. So the
    alert did not arrive when the patient needed to leave; it arrived whenever
    the desk next touched the queue. On a quiet morning that is late, and if
    nobody touches the queue at all it never arrives. The patient's own screen
    flips to "leave now" on the real clock, so the app and the message disagreed.

    Worse for the case this was written for: a booking for a LATER day has a
    `remind_at` that can fall today — Amalapuram to Hyderabad is a ten-hour
    drive, so the departure window opens the day before. Nobody works tomorrow's
    queue today, so those alerts were never even attempted.

    Scans today AND future dates for exactly that reason. Idempotent:
    `token.notified_leave` is set inside the same transaction as the send, so
    overlapping ticks cannot double-nudge, and a token already alerted is
    filtered out in SQL rather than re-examined.

    One bad token must not cost the rest their alert, so each is guarded
    individually.
    """
    rows = db.scalars(
        select(Token)
        .where(
            Token.status == "waiting",
            Token.notified_leave.is_(False),
            Token.token_date >= date.today(),
        )
        .order_by(Token.token_date, Token.token_id)
        .limit(limit)
    ).all()

    sent = 0
    failed = 0
    for token in rows:
        try:
            if maybe_send_leave_alert(db, token):
                sent += 1
        except Exception as exc:  # noqa: BLE001 - one token must not stop the sweep
            failed += 1
            print(f"[leave_alert] token {token.token_id} skipped: {exc}")
    if sent:
        db.commit()
    return {"considered": len(rows), "sent": sent, "failed": failed}


# Tokens that are still "in play". Anything else has already reached an end.
_STALE_OPEN_STATUSES = ("waiting", "current")


def _was_ever_called(db: Session, token: Token) -> bool:
    """Did the desk actually reach this patient before the day ended?

    This is the whole difference between a patient who failed to turn up and one
    the hospital never got to, and the movement log is the only record of it:
    `next` is the call itself, `recall` a second attempt, `skip` a deliberate
    pass-over. No entry means nobody ever called their number.
    """
    return bool(db.scalar(
        select(TokenMovementLog)
        .where(
            TokenMovementLog.token_id == token.token_id,
            TokenMovementLog.action.in_(("next", "recall", "skip")),
        )
        .limit(1)
    ))


def close_stale_visits(db: Session, limit: int = 500) -> dict:
    """Close out visits still open after their day has passed.

    Nothing has ever ended a queue: a token not reached before the session
    finished stays `waiting` for ever, and its appointment stays `confirmed`.
    The queue screen loads one date at a time, so the patient simply vanishes
    from view while both records still insist the visit is going to happen. By
    22 Sep 2026 that had built up 138 open tokens, the oldest from 12 June.

    The label is chosen per token, because "no show" is an accusation and most
    of these patients did nothing wrong — of those 138, the doctor saw NOBODY at
    all on the day for 83 of them. Calling that a no-show blames a patient for
    the hospital not opening, and `_close_follow_up` then records their follow-up
    as missed too, so the error spreads.

      * called, never attended        -> token `missed`   -> appointment `no_show`
      * never called, doctor did work -> token `cancelled` -> appointment `cancelled`
      * never called, doctor saw none -> token `cancelled` -> appointment `cancelled`

    Sends nothing, deliberately. `set_status` only writes history and mirrors the
    appointment, so clearing a three-month backlog cannot fire a message at
    someone about a visit they have long forgotten.

    Uses the SERVER date, which for an IST hospital is the same day or one behind
    — never ahead. So a visit can be closed a few hours late but never while its
    own day is still running, which is the safe direction to be wrong in.
    """
    today = date.today()
    rows = db.scalars(
        select(Token)
        .where(Token.status.in_(_STALE_OPEN_STATUSES), Token.token_date < today)
        .order_by(Token.token_date, Token.token_id)
        .limit(limit)
    ).all()

    # "Did this doctor see anyone?" has one answer per doctor-day, and those 138
    # tokens span only 71 of them — so it is cached rather than asked per token.
    worked: dict[tuple[int, date], bool] = {}

    def _doctor_worked(doctor_id: UUID, on_date: date) -> bool:
        key = (doctor_id, on_date)
        if key not in worked:
            worked[key] = bool(db.scalar(
                select(func.count(Token.token_id)).where(
                    Token.doctor_id == doctor_id,
                    Token.token_date == on_date,
                    Token.status == "completed",
                )
            ))
        return worked[key]

    missed = cancelled = failed = 0
    for token in rows:
        try:
            if _was_ever_called(db, token):
                new_status, action, reason = "missed", "skip", "Called but did not attend"
            elif _doctor_worked(token.doctor_id, token.token_date):
                new_status, action, reason = (
                    "cancelled", "cancel", "Not called before the session ended")
            else:
                new_status, action, reason = (
                    "cancelled", "cancel", "The hospital did not run this session")

            set_status(db, token, new_status, None, reason)
            log_movement(db, token, action, token.queue_position, None, None, reason)
            token.queue_position = 0
            # Off the doctor's screen too, if the day ended mid-consultation.
            doctor = db.get(Doctor, token.doctor_id)
            if doctor and doctor.presence and doctor.presence.current_token_id == token.token_id:
                doctor.presence.current_token_id = None
            # No `recompute_positions`: the day is over, so renumbering what is
            # left of a finished queue buys nothing and costs a query per token.
            if new_status == "missed":
                missed += 1
            else:
                cancelled += 1
        except Exception as exc:  # noqa: BLE001 - one token must not stop the sweep
            failed += 1
            print(f"[stale_visits] token {token.token_id} skipped: {exc}")

    if missed or cancelled:
        db.commit()
    return {"considered": len(rows), "missed": missed,
            "cancelled": cancelled, "failed": failed}


_VISIT_OFF_STATUSES = ("cancelled", "no_show", "rejected")


def _visit_is_off(db: Session, token: Token) -> bool:
    """Has this visit been called off, whatever the TOKEN still says?

    Token status alone is not a safe signal to message someone. Until 21 Sep
    2026 the patient-cancel path (`appointments._do_cancel`) marked the
    appointment cancelled and left its token `waiting` for ever, so half the
    system knew the visit was off and half did not. Nothing surfaced it while
    every alert was staff-triggered; the moment a clock-driven sweep existed,
    three patients were told to begin an eleven-hour journey for visits they
    had themselves cancelled. Eleven such orphaned tokens were found, the
    oldest from 5 August.

    That hole is now closed at source, so this is the second line of defence:
    every patient-facing alert asks the APPOINTMENT, not just the token. Shared
    rather than copied so a future alert cannot quietly miss the check.
    """
    if not token.appointment_id:
        return False
    appt = db.get(Appointment, token.appointment_id)
    return bool(appt and appt.status in _VISIT_OFF_STATUSES)


def _queue_alerts_off(db: Session, token: Token) -> bool:
    """Walk-ins get WhatsApp queue alerts only when the front desk ticked
    "Send WhatsApp alerts". A walk-in that gets them counts toward the hospital's
    online-booking quota (services/booking_quota.py), so it's opt-in."""
    if not token.appointment_id:
        return False
    appt = db.get(Appointment, token.appointment_id)
    return bool(appt and appt.queue_alerts is False)


def _alert_recipient(db: Session, token: Token):
    """(who to address, where to send, doctor, place) for a queue alert.

    Every patient-facing queue message needs the same four things, and they have
    to agree: the dependent's name has to travel with the dependent's number, or
    a family member gets a message addressed to someone else.
    """
    patient = token.patient
    if not patient:
        return None
    phone = notify.reminder_phone_for_token(db, token)
    if not phone:
        return None
    member = None
    if token.appointment_id:
        appt = db.get(Appointment, token.appointment_id)
        if appt and appt.family_member_id:
            member = db.get(FamilyMember, appt.family_member_id)
    doctor = db.get(Doctor, token.doctor_id)
    affiliation = db.get(DoctorAffiliation, token.affiliation_id) if token.affiliation_id else None
    hospital = db.get(Hospital, token.hospital_id) if token.hospital_id else None
    place = (affiliation.name if affiliation and affiliation.name else None) \
        or (hospital.name if hospital else "the hospital")
    return {
        "patient": patient,
        "phone": phone,
        "who": (member.name if member else patient.name) or "Patient",
        "doctor_name": doctor.name if doctor else "",
        "place": place,
    }


def _already_notified(db: Session, token: Token, ntype: str) -> bool:
    """Has this token already had a message of this kind?

    The leave-by alert has its own `notified_leave` column; this one is derived
    from the notification log instead, so a second one-shot alert costs no
    migration. It's exact — the row is written in the same transaction as the
    send, so a re-run of `recompute_positions` sees it.
    """
    from ..models import Notification

    return bool(db.scalar(
        select(Notification.notification_id)
        .where(
            Notification.token_id == token.token_id,
            Notification.type == ntype,
            # Scoped to the visit's own day. A token MOVED to another date keeps
            # its id, so an un-scoped check let the old day's alert suppress the
            # new day's — the patient was told once, on a date they no longer
            # had an appointment, and never again on the day they did.
            func.date(Notification.created_at) == token.token_date,
        )
        .limit(1)
    ))


def maybe_send_almost_turn(db: Session, token: Token) -> bool:
    """Tell the patient their turn is near, once THREE patients are ahead of them.

    Sent on the approved `almost_your_turn_a` template. The copy asks them to
    stay near the consultation area, so this is the at-the-hospital counterpart to
    the leave-by alert — that one gets them moving, this one catches them in the
    waiting room.

    The threshold is `<=` rather than `== ALMOST_TURN_POSITION` on purpose: when
    the people ahead cancel, a token can jump from 8th to 1st without ever
    passing through 4th, and skipping the alert entirely is worse than sending it
    a place or two late.

    Note the notice period scales with the hospital, not the patient: three ahead is
    ~30 min where a consult averages 10 min, but ~60 min at a 20-min-per-patient
    practice — and the header copy ("Almost Your Turn!") is fixed at the provider,
    so it cannot soften for the longer wait. If that starts reading as premature,
    the fix is to fire on `estimate()["wait_min"]` instead of on position.
    """
    if token.status != "waiting" or not token.patient_id:
        return False
    # Same guard as the leave alert: a cancelled visit must never be told its
    # turn is near, however the token was left. See `_visit_is_off`.
    if _visit_is_off(db, token) or _queue_alerts_off(db, token):
        return False
    # ...and only on the DAY of the visit. `recompute_positions` runs for
    # whatever date it's given — booking or rescheduling to a future day calls it
    # for that day — and a token that lands 1st or 2nd in a queue nobody has
    # joined yet would otherwise be told "you're almost next, stay near the
    # consultation area" for a visit that is days away.
    if token.token_date != date.today():
        return False
    if (token.queue_position or 0) < 1 or (token.queue_position or 0) > ALMOST_TURN_POSITION:
        return False
    if _already_notified(db, token, "almost_turn"):
        return False
    who = _alert_recipient(db, token)
    if not who:
        return False

    est = estimate(db, token)
    ahead = max(0, (token.queue_position or 1) - 1)
    params = whatsapp_templates.almost_turn_params(
        who["who"], est.get("wait_min"), ahead, token.display_code,
        who["doctor_name"], who["place"],
    )
    notify.send_whatsapp(
        db, who["phone"],
        f"Hello {params[0]}, your turn is approaching. Estimated wait {params[1]}, "
        f"{params[2]} patient(s) ahead. Token {params[3]} · Dr. {params[4]} · {params[5]}.",
        ntype="almost_turn", title="Almost Your Turn",
        template_name=whatsapp_templates.almost_turn_name(), template_params=params,
        language_code=settings.whatsapp_default_lang,
        event_type=whatsapp_templates.ALMOST_TURN_EVENT,
        hospital_id=token.hospital_id, patient_id=who["patient"].patient_id,
        token_id=token.token_id,
    )
    return True


def maybe_send_day_complete(db: Session, token: Token) -> bool:
    """RETIRED — kept only so an old caller cannot silently change behaviour.

    The day-complete message is now sent by
    `services/doctor_digest.send_day_complete`, at the doctor's own session end
    rather than the moment their queue happens to empty. Leaving both in place
    would defeat that: this one fires the instant the last waiting token clears
    — 3pm for a hospital open until 8 — and the once-per-day guard would then
    suppress the properly-timed message.

    Returns False without sending. Do not re-wire it into `finish_serving`.
    """
    return False


def _legacy_send_day_complete_unused(db: Session, token: Token) -> bool:
    """Wrap up the doctor's day, once nobody is left in their queue.

    Called from `finish_serving`, so the trigger is the completion that empties
    the queue — no clock needed, unlike the morning digest. "Empty" means no
    token still `waiting` or `current` for this doctor, date and venue; tokens
    that ended as missed or cancelled are done with, so a day that finishes on a
    no-show still closes.

    Deliberately NOT sent when the doctor's last patient simply never turns up
    and no consultation is completed afterwards — there is no event then, and
    inventing one would mean polling. The morning digest is the clock-driven
    message; this one stays event-driven.
    """
    doctor = db.get(Doctor, token.doctor_id)
    user = db.get(User, doctor.user_id) if doctor and doctor.user_id else None
    phone = (user.phone or "").strip() if user else ""
    if not user or not phone:
        return False
    if notify.sent_today(db, user.user_id, "doctor_day", token.token_date):
        return False

    still_open = db.scalar(
        select(func.count(Token.token_id)).where(
            Token.doctor_id == token.doctor_id,
            Token.token_date == token.token_date,
            Token.affiliation_id.is_(None) if token.affiliation_id is None
            else Token.affiliation_id == token.affiliation_id,
            Token.status.in_(("waiting", "current")),
        )
    ) or 0
    if still_open:
        return False

    # Appointment status mirrors the token's terminal state
    # (`_TOKEN_TO_APPT_STATUS`), so one source keeps the three counts consistent
    # with each other — mixing tokens and appointments would not.
    rows = db.scalars(
        select(Appointment).where(
            Appointment.doctor_id == token.doctor_id,
            Appointment.appointment_date == token.token_date,
            Appointment.affiliation_id.is_(None) if token.affiliation_id is None
            else Appointment.affiliation_id == token.affiliation_id,
        )
    ).all()
    completed = sum(1 for a in rows if (a.status or "").lower() == "completed")
    dropped = sum(1 for a in rows if (a.status or "").lower() in ("cancelled", "no_show", "rejected"))
    if not completed:
        return False

    hospital = db.get(Hospital, token.hospital_id) if token.hospital_id else None
    affiliation = db.get(DoctorAffiliation, token.affiliation_id) if token.affiliation_id else None
    place = (affiliation.name if affiliation and affiliation.name else None) \
        or (hospital.name if hospital else "your practice")
    params = whatsapp_templates.doctor_day_complete_params(
        doctor.name, token.token_date.strftime("%d %b %Y"),
        len(rows), completed, dropped, place,
    )
    notify.send_whatsapp(
        db, phone,
        f"Well done Dr. {params[0]} — all consultations for {params[1]} are complete. "
        f"{params[3]} of {params[2]} seen, {params[4]} cancelled/no-show, at {params[5]}.",
        ntype="doctor_day", title="All Appointments Completed",
        template_name=whatsapp_templates.doctor_day_complete_name(), template_params=params,
        language_code=settings.whatsapp_default_lang,
        event_type=whatsapp_templates.DOCTOR_DAY_COMPLETE_EVENT,
        hospital_id=token.hospital_id, recipient_user_id=user.user_id,
    )
    return True


def maybe_send_consultation_complete(db: Session, token: Token) -> bool:
    """Wrap-up message once the doctor marks the consultation done.

    Sent from `finish_serving`, so every completion path is covered — the
    front desk's "complete", and the implicit completion inside call-next.
    """
    if not token.patient_id:
        return False
    if _already_notified(db, token, "consult_done"):
        return False
    who = _alert_recipient(db, token)
    if not who:
        return False

    # The moment they were actually seen; `actual_end` is the fallback because
    # a token completed without ever being started has no start time.
    seen_at = _naive_utc(token.actual_start) or _naive_utc(token.actual_end) or utcnow()
    params = whatsapp_templates.consultation_complete_params(
        who["who"], token.token_date.strftime("%d %b %Y"),
        _local_time_text(db, seen_at, token.hospital_id),
        who["doctor_name"], who["place"], token.display_code,
    )
    notify.send_whatsapp(
        db, who["phone"],
        f"Hello {params[0]}, your consultation with Dr. {params[3]} on {params[1]} "
        f"at {params[2]} is complete. Token {params[5]} at {params[4]}. "
        f"Your prescription and visit summary are in the TapCure app.",
        ntype="consult_done", title="Consultation Completed",
        template_name=whatsapp_templates.consultation_complete_name(), template_params=params,
        language_code=settings.whatsapp_default_lang,
        event_type=whatsapp_templates.CONSULTATION_COMPLETE_EVENT,
        hospital_id=token.hospital_id, patient_id=who["patient"].patient_id,
        token_id=token.token_id,
    )
    return True


def _local_time_text(db: Session, when: Optional[datetime], hospital_id: Optional[UUID]) -> str:
    """A naive-UTC instant as hospital wall-clock time — "11:45 AM".

    Everything is stored naive UTC; a patient told to leave for a 6:15 AM turn
    when the hospital means 11:45 AM is worse than not being told at all.
    """
    if when is None:
        return ""
    tz = _hospital_tz(db, hospital_id)
    local = when.replace(tzinfo=timezone.utc).astimezone(tz)
    return local.strftime("%I:%M %p").lstrip("0")


def maybe_send_leave_alert(db: Session, token: Token) -> bool:
    """Fire the one-time "time to leave" alert once we're within REMIND_BEFORE_MIN
    of the patient's leave-by time. Returns whether an alert was sent.

    Goes out on WhatsApp under the approved `03_leave_now_` template. This used
    to be an SMS through the mock provider, which logged a delivery and reached
    nobody — the whole leave-by calculation above was being thrown away at the
    last step.
    """
    if token.notified_leave or token.status != "waiting" or not token.patient_id:
        return False
    if _visit_is_off(db, token) or _queue_alerts_off(db, token):
        return False
    est = estimate(db, token)
    remind_at = est.get("remind_at")
    if remind_at is None or utcnow() < remind_at:
        return False
    # Too late to be useful. A failed send now leaves the one-shot flag clear so
    # the next tick retries, which without a bound would keep trying until the
    # patient's turn had long passed — "start now" for a 9 AM slot arriving at
    # 2 PM is worse than saying nothing.
    leave_by = est.get("leave_by")
    if leave_by is not None and utcnow() > leave_by + timedelta(minutes=settings.leave_alert_max_late_minutes):
        return False
    patient = token.patient
    if not patient:
        return False
    # Honours a dependent who opted to receive their own reminders.
    phone = notify.reminder_phone_for_token(db, token)
    if not phone:
        return False

    # Address the person actually attending, exactly as the booking message does.
    member = None
    if token.appointment_id:
        appt = db.get(Appointment, token.appointment_id)
        if appt and appt.family_member_id:
            member = db.get(FamilyMember, appt.family_member_id)
    doctor = db.get(Doctor, token.doctor_id)
    affiliation = db.get(DoctorAffiliation, token.affiliation_id) if token.affiliation_id else None
    hospital = db.get(Hospital, token.hospital_id) if token.hospital_id else None
    who = (member.name if member else patient.name) or "Patient"
    destination = (affiliation.name if affiliation and affiliation.name else None) \
        or (hospital.name if hospital else "the hospital")
    eta_text = _local_time_text(db, est.get("estimated_time"), token.hospital_id)

    params = whatsapp_templates.leave_now_params(
        who, doctor.name if doctor else "", eta_text, token.display_code, destination,
    )
    n = notify.send_whatsapp(
        db, phone,
        f"Hi {params[0]}, your turn for Dr. {params[1]} is expected around {params[2]}. "
        f"Token {params[3]}. Please start for {params[4]} now.",
        ntype="travel_alert", title="Time to Leave",
        template_name=whatsapp_templates.leave_now_name(), template_params=params,
        language_code=settings.whatsapp_default_lang,
        event_type=whatsapp_templates.LEAVE_NOW_EVENT,
        hospital_id=token.hospital_id, patient_id=patient.patient_id, token_id=token.token_id,
    )
    # `notified_leave` is the ONE-SHOT guard, so setting it on a failed send
    # burns the only attempt this token will ever get. That is not theoretical:
    # on 21 Sep 2026 a `network_error` from the provider still set the flag, and
    # the patient was permanently silenced with the row reading as notified.
    # Leave the flag clear and the next sweep retries; the staleness check above
    # stops that retrying into uselessness. The dose engine already works this way.
    if n.status == "failed":
        code = n.whatsapp_log.error_code if n.whatsapp_log else "unknown"
        print(f"[leave_alert] token {token.token_id} send failed ({code}) - will retry")
        return False
    token.notified_leave = True
    return True


# ---- audit writes -----------------------------------------------------------
# A token reaching a terminal state drags its appointment to the matching one,
# so patient-facing views (which read appointment.status) stay in sync.
_TOKEN_TO_APPT_STATUS = {"completed": "completed", "cancelled": "cancelled", "missed": "no_show"}


def set_status(db: Session, token: Token, new_status: str, by: Optional[int], reason: str = "") -> None:
    db.add(TokenStatusHistory(
        token_id=token.token_id, old_status=token.status, new_status=new_status,
        changed_by=by, reason=reason,
    ))
    token.status = new_status
    appt_status = _TOKEN_TO_APPT_STATUS.get(new_status)
    if appt_status:
        sync_appointment_status(db, token, appt_status, by, reason)


def log_movement(db: Session, token: Token, action: str, frm: Optional[int],
                 to: Optional[int], by: Optional[int], notes: str = "") -> None:
    db.add(TokenMovementLog(
        token_id=token.token_id, action=action, from_position=frm,
        to_position=to, triggered_by=by, notes=notes,
    ))


def record_recall(db: Session, token: Token, method: str, by: Optional[int]) -> TokenRecallHistory:
    rec = token.recall
    if rec is None:
        rec = TokenRecallHistory(token_id=token.token_id, recall_count=0)
        db.add(rec)
        token.recall = rec
    rec.recall_count += 1
    rec.last_recalled_at = utcnow()
    rec.recall_method = method
    rec.recalled_by = by
    return rec


# ---- orchestrations ---------------------------------------------------------
def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Coerce a datetime to naive UTC. Postgres returns timezone-AWARE datetimes
    for our DateTime(timezone=True) columns, but utcnow() is naive — subtracting
    the two raises. Normalise before any datetime arithmetic."""
    if dt is not None and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def start_serving(db: Session, token: Token, by: Optional[int]) -> None:
    """Mark a waiting token as the one currently being seen."""
    frm = token.queue_position
    token.actual_start = utcnow()
    created = _naive_utc(token.created_at)
    token.wait_duration_mins = max(0, int((token.actual_start - created).total_seconds() // 60)) if created else 0
    token.queue_position = 0
    set_status(db, token, "current", by, "Called")
    log_movement(db, token, "next", frm, 0, by, "Now serving")
    doctor = db.get(Doctor, token.doctor_id)
    if doctor and doctor.presence:
        doctor.presence.current_token_id = token.token_id
        doctor.presence.status = "busy"

    # Calling the next patient is the signal that the previous one is finished
    # with — so any completed visit still waiting to see whether a prescription
    # arrives is wrapped up now. Swallows its own errors: a wrap-up message must
    # never stop a doctor calling their next patient.
    from . import visit_wrapup
    visit_wrapup.flush_previous(db, token.doctor_id, token.token_date,
                                except_token_id=token.token_id)


def postpone_serving(db: Session, token: Token, next_token: Token, by: Optional[int]) -> None:
    """Pause this visit and call one other patient; preserve priority ordering.

    For the patient who steps out mid-consultation. The old "skip" sent them to
    `queue_position = 99999` — behind everyone, including people who had not
    arrived yet — which in a forty-person queue is a punishment rather than a
    courtesy, and the desk could only undo it by hand. Here exactly one patient
    moves ahead, so the postponed one comes up again almost immediately.

    The elapsed minutes are BANKED rather than discarded: `actual_start` is
    cleared so the next call starts a fresh timer, and what has already been
    spent is added to `consult_duration_mins`. Otherwise a visit interrupted
    halfway would report only the second half of its length.

    Note for this tree: `start_serving` also flushes pending visit wrap-ups
    (services/visit_wrapup.py). That is harmless here — this token is set to
    `waiting`, not `completed`, so the flush cannot pick it up and no "your
    prescription is ready" message escapes for a consultation still in progress.
    """
    started = _naive_utc(token.actual_start)
    elapsed = max(0, int((utcnow() - started).total_seconds() // 60)) if started else 0
    token.consult_duration_mins = (token.consult_duration_mins or 0) + elapsed
    token.actual_start = None
    token.actual_end = None
    frm = token.queue_position
    # Existing waiting positions start at 1. Zero puts this visit first within
    # its priority group once next_token has been removed from the waiting list.
    token.queue_position = 0
    set_status(db, token, "waiting", by, "Let one patient go ahead")
    start_serving(db, next_token, by)
    # Sessions disable autoflush: persist both statuses BEFORE querying waiting
    # tokens, otherwise the old current is omitted and the new current included.
    db.flush()
    recompute_positions(db, token.doctor_id, token.token_date, token.affiliation_id)
    log_movement(db, token, "skip", frm, token.queue_position, by, "Let one patient go ahead")


def sync_appointment_status(db: Session, token: Token, new_status: str, by: Optional[int], reason: str = "") -> None:
    """Mirror a token's terminal state onto its appointment, so patient-facing
    views (which read appointment.status) stay in sync with the queue. Skips if
    the appointment is already in a terminal state."""
    if not token.appointment_id:
        return
    appt = db.get(Appointment, token.appointment_id)
    if not appt or appt.status in ("completed", "cancelled"):
        return
    db.add(ApptStatusHistory(
        appointment_id=appt.appointment_id, old_status=appt.status,
        new_status=new_status, changed_by=by, reason=reason,
    ))
    appt.status = new_status
    _close_follow_up(db, appt, new_status)


def _close_follow_up(db: Session, appt: Appointment, appt_status: str) -> None:
    """Finish the follow-up loop when the return visit actually happens.

    Booking a follow-up only moved it `pending -> booked`; nothing ever advanced
    it further, so every follow-up ever booked sat in `booked` for good — the
    patient's card never cleared and no report could tell an attended follow-up
    from one still owed.
    """
    outcome = {"completed": "completed", "no_show": "missed", "cancelled": "pending"}.get(appt_status)
    if not outcome:
        return
    fu = db.scalar(
        select(FollowUp).where(FollowUp.booked_appointment_id == appt.appointment_id)
    )
    if not fu or fu.status not in ("booked", "pending"):
        return
    # A cancelled return visit doesn't discharge the obligation — the follow-up
    # goes back to pending so the patient is asked to re-book.
    fu.status = outcome
    if outcome == "pending":
        fu.booked_appointment_id = None


def _maybe_issue_revisit_pass(db: Session, token: Token) -> None:
    """Grant the free-revisit pass earned by a consultation that just finished.

    Deliberately swallows everything. This runs inside `finish_serving`, and a
    doctor pressing "next patient" must never fail because of a perk: the worst
    acceptable outcome is a missing pass, not a queue that will not advance.

    Imported lazily — services.revisit_pass imports the models package, and a
    module-level import here would close a cycle back through token_engine.
    """
    try:
        if not token.appointment_id:
            return
        from . import revisit_pass
        appt = db.get(Appointment, token.appointment_id)
        revisit_pass.maybe_issue(db, appt)
    except Exception as exc:  # noqa: BLE001 - never break the queue over a perk
        print(f"[revisit_pass] issue skipped for token {token.token_id}: {exc}")


def finish_serving(db: Session, token: Token, by: Optional[int]) -> None:
    token.actual_end = utcnow()
    started = _naive_utc(token.actual_start)
    if started:
        token.consult_duration_mins = max(0, int((token.actual_end - started).total_seconds() // 60))
    set_status(db, token, "completed", by, "Completed")
    log_movement(db, token, "complete", None, None, by, "Consultation done")
    # Sends the prescription message only if the Rx is already written. If it
    # isn't, nothing goes out yet — the doctor may still be about to write one,
    # and `start_serving`'s flush decides when to stop waiting. See
    # services/visit_wrapup.py for why neither event sends on its own.
    from . import visit_wrapup
    visit_wrapup.on_consultation_complete(db, token)
    maybe_send_day_complete(db, token)
    _maybe_issue_revisit_pass(db, token)
    doctor = db.get(Doctor, token.doctor_id)
    if doctor and doctor.presence:
        doctor.presence.tokens_served_today = (doctor.presence.tokens_served_today or 0) + 1
        if doctor.presence.current_token_id == token.token_id:
            doctor.presence.current_token_id = None
