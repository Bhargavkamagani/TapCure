"""Can this patient physically reach this appointment in time?

A patient in Amalapuram booking a 10:00 AM slot in Hyderabad today is booking a
visit they cannot make: it's an eight-hour drive. Nothing stopped that before —
the slot was free, so the booking succeeded, and the hospital held a slot for
someone who was never going to arrive.

This answers the question at BOOKING time, using the same travel numbers the
leave-by reminder uses afterwards (`token_engine.travel_minutes_between`), so
the two can never disagree.

Design notes:

* **Fails open.** No origin, no destination pin, or no slot time → returns None
  and the caller carries on exactly as before. Travel awareness is a helpful
  extra, never a gate that can block a booking because a coordinate is missing.
* **Advisory, not a wall.** The origin is a guess: the patient may already be in
  the destination city, may be booking for a relative who lives next door to the
  hospital, or may fly. The caller decides what to do with `reachable=False`;
  `create_booking` asks for explicit confirmation rather than refusing outright.
* **Hospital-local time.** Everything is computed in the hospital's timezone, the
  same one the queue and the session hours use.
"""
from __future__ import annotations
from uuid import UUID

from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from . import token_engine as te

# How early the patient should be standing at the desk. Booked slots are not
# drive-up-at-the-exact-minute affairs — there's parking, registration and the
# token to collect.
ARRIVAL_BUFFER_MIN = 15


def _h12(when) -> str:
    """"15:10" -> "3:10 PM". Patients here read clock time the way the rest of
    the app prints it; a 24-hour string in one sentence and 12-hour everywhere
    else reads like a different app wrote it."""
    return when.strftime("%I:%M %p").lstrip("0")


def assess(
    db: Session,
    *,
    hospital_id: Optional[UUID],
    affiliation_id: Optional[UUID],
    on_date: date,
    slot_time: Optional[time],
    origin_lat: Optional[float],
    origin_lng: Optional[float],
    travel_minutes: Optional[int] = None,
    deadline_kind: str = "slot",
) -> Optional[dict]:
    """Whether the patient can still make this appointment, or None if unknown.

    `travel_minutes`, when given, is trusted over a fresh lookup — the client
    may have measured it already at booking, and re-querying a routing provider
    per slot would be both slow and wasteful.

    `deadline_kind` says what `slot_time` represents. Slot bookings pass the
    booked time ("slot"); TOKEN bookings have no slot, so the caller passes the
    day's closing time instead ("closing") — arriving after the hospital shuts is
    just as impossible, and the token flow is how patients actually book here.

    Returns:
        {
          "travel_minutes": 497,          # door to hospital
          "reachable": False,             # can they still make it?
          "leave_by": "01:43",            # hospital-local; None if already past
          "earliest_arrival": "18:47",    # if they left right now
          "slot_time": "10:00",
        }
    """
    if slot_time is None:
        return None

    minutes = travel_minutes
    if minutes is None:
        if origin_lat is None or origin_lng is None:
            return None
        dest = te.practice_coords(db, affiliation_id, hospital_id)
        if dest is None:
            return None
        minutes = te.travel_minutes_between(
            float(origin_lat), float(origin_lng), dest[0], dest[1]
        )
    minutes = int(minutes)

    tz = te.hospital_tz(db, hospital_id)
    now_local = datetime.now(tz)
    slot_dt = datetime.combine(on_date, slot_time).replace(tzinfo=tz)

    # Two different questions, and conflating them produced a message that
    # contradicted itself ("you'd arrive at 3:17 PM, after the hospital closes at
    # 3:30 PM"):
    #
    #   reachable — CAN they physically be there before the slot/closing time?
    #               This is the one that blocks a booking, so it must be the
    #               literal, defensible fact, with no padding.
    #   leave_by  — when should they set off to arrive comfortably early? That's
    #               advice, and it keeps the buffer.
    #
    # Padding the block with the buffer refused patients one minute down the
    # road, which is both wrong and the kind of thing that generates support
    # calls the app can't answer.
    leave_by_dt = slot_dt - timedelta(minutes=minutes + ARRIVAL_BUFFER_MIN)
    earliest_arrival = now_local + timedelta(minutes=minutes)
    reachable = earliest_arrival <= slot_dt
    # Makes it, but with less than the buffer to spare — worth surfacing softly,
    # never worth blocking on.
    tight = reachable and earliest_arrival > slot_dt - timedelta(minutes=ARRIVAL_BUFFER_MIN)
    spare_minutes = int((slot_dt - earliest_arrival).total_seconds() // 60)

    return {
        "travel_minutes": minutes,
        "reachable": reachable,
        "tight": tight,
        "spare_minutes": spare_minutes,
        # A leave-by in the past is noise — that's exactly the unreachable case,
        # and the message says so instead.
        "leave_by": leave_by_dt.strftime("%H:%M") if leave_by_dt >= now_local else None,
        "leave_by_label": _h12(leave_by_dt) if leave_by_dt >= now_local else None,
        # Days the journey spills over. A 17-hour drive started this evening
        # arrives at "05:54" — which reads as *this* morning, i.e. the past,
        # unless we say which day it lands on.
        "leave_by_days_before": (on_date - leave_by_dt.date()).days,
        "earliest_arrival": earliest_arrival.strftime("%H:%M"),
        "earliest_arrival_label": _h12(earliest_arrival),
        "earliest_arrival_day_offset": (earliest_arrival.date() - now_local.date()).days,
        "slot_time": slot_time.strftime("%H:%M"),
        "slot_time_label": _h12(slot_time),
        "deadline_kind": deadline_kind,
    }


def _day_word(offset: int) -> str:
    if offset <= 0:
        return ""
    return " tomorrow" if offset == 1 else f" in {offset} days"


def describe(result: dict, place: str = "this hospital") -> str:
    """One plain sentence for the patient. Kept here so the API message and the
    UI copy stay in step.

    Branches on the verdict — an earlier version asserted "after the hospital
    closes" for every result, so a patient arriving comfortably in time was told
    a flat contradiction of the arrival time in the same sentence.
    """
    hrs, mins = divmod(result["travel_minutes"], 60)
    travel = (f"{hrs} hr {mins} min" if mins else f"{hrs} hr") if hrs else f"{mins} min"
    arrives = f"{result['earliest_arrival_label']}{_day_word(result['earliest_arrival_day_offset'])}"
    slot = result["slot_time_label"]
    closing = result.get("deadline_kind") == "closing"

    if not result["reachable"]:
        missed = f"after the hospital closes at {slot}" if closing else f"after the {slot} slot"
        return f"{place} is about {travel} away. Leaving now you'd arrive around {arrives}, {missed}."

    if result.get("tight"):
        spare = result.get("spare_minutes", 0)
        margin = "just as it closes" if spare <= 0 else (
            f"only {spare} min before it closes at {slot}" if closing
            else f"only {spare} min before your {slot} slot"
        )
        return (
            f"{place} is about {travel} away. Even leaving now you'd arrive around "
            f"{arrives} — {margin}."
        )

    leave = result.get("leave_by_label")
    return (
        f"{place} is about {travel} away."
        + (f" Leave by {leave} to arrive in good time." if leave else "")
    )
