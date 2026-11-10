"""WhatsApp Business template catalogue.

A WhatsApp business message is not free text. Outside the 24-hour customer-service
window Meta delivers only *pre-approved templates*, and the send call supplies the
ordered `{{n}}` parameters that fill the approved body. So every WhatsApp event
needs two artefacts kept in step:

  1. the copy approved at the provider (Dovesoft → Meta), and
  2. the code that fills its parameters, in the right order and count.

This module is the single place that pairs them. `docs/whatsapp-templates.md`
holds the exact copy submitted for approval — change one, change the other, or
the provider rejects the send with a parameter-mismatch error.

Rules the builders below exist to satisfy (Meta rejects the *send*, not the
template, when they're broken — so the failure only shows up in production):
  - every `{{n}}` must resolve to non-blank text;
  - a parameter may not contain a newline, a tab, or 4+ consecutive spaces;
  - the number of parameters must match the approved body exactly.

Template names are read from settings so a clinic on a different WABA can point
at its own approved copy without a code change.
"""
from __future__ import annotations

import re

from ..config import settings

# Meta rejects a parameter containing a newline, tab, or 4+ spaces in a row.
_BAD_WHITESPACE = re.compile(r"\s+")


def location_text(name: str, address, city, limit: int = 140) -> str:
    """Place name plus as much address as fits, cut on comma boundaries.

    Two things a naive join gets wrong, both seen in real rows: stored addresses
    here often already end in the city ("... Kukatpally, Hyderabad, Telangana,
    India"), so appending `city` repeats it; and a hard character truncation
    leaves the reader looking at "Hydera". Addresses run specific → general, so
    dropping whole trailing chunks loses the least useful part.
    """
    address = str(address or "").strip()
    city = str(city or "").strip()
    chunks = [c.strip() for c in address.split(",") if c.strip()]
    if city and city.lower() not in address.lower():
        chunks.append(city)
    text = str(name or "").strip()
    for chunk in chunks:
        candidate = f"{text}, {chunk}" if text else chunk
        if len(candidate) > limit:
            break
        text = candidate
    return text


def clean_param(value, fallback: str = "-", limit: int = 200) -> str:
    """One parameter, safe to send: collapsed whitespace, never blank.

    `fallback` matters more than it looks. An empty `{{2}}` doesn't render as an
    empty string — the provider rejects the whole message, so one prescription
    line with no dosage would silently cost the patient their reminder.
    """
    text = _BAD_WHITESPACE.sub(" ", str(value or "")).strip()
    return (text or fallback)[:limit]


# ---------------------------------------------------------------------------
# medicine_reminder — "Hi {{1}}, it's time for {{2}} medicine! / {{3}} / {{4}}"
# ---------------------------------------------------------------------------
def medicine_reminder_name() -> str:
    return settings.whatsapp_medicine_reminder_template


def medicine_reminder_params(
    who: str, drug: str, dosage: str = "", food_note: str = "", whose: str = "your",
) -> list[str]:
    """[greeting name, possessive, medicine (+dose), instruction].

    `who` is whoever's PHONE this is going to; `whose` says whose medicine it
    is — "your", or "Raju's" when the account holder is reminded on behalf of a
    dependent. Keeping them apart is the whole point: the message used to greet
    the dependent by name while arriving on the account holder's phone, so a
    parent minding a child's course read "Hi Raju" on their own handset and had
    to work out each time that it was theirs to act on.

    Dose and food note are optional on a prescription line, so they're folded
    into always-present parameters rather than becoming empty ones — the
    provider rejects a send whose parameter is blank.
    """
    first = clean_param(str(who or "").split(" ")[0], fallback="there", limit=40)
    owner = clean_param(whose, fallback="your", limit=40)
    medicine = clean_param(drug, fallback="medicine", limit=100)
    dose = clean_param(dosage, fallback="", limit=60)
    if dose:
        medicine = f"{medicine} ({dose})"
    # The instruction sentence carries the food note when the doctor wrote one,
    # and still reads naturally when they didn't.
    note = clean_param(food_note, fallback="", limit=60)
    instruction = f"Please take it {note}." if note else "Please take it as prescribed."
    return [first, owner, medicine, instruction]


# ---------------------------------------------------------------------------
# appointment_confirmation — "...confirmed under the name {{1}} / Date: {{2}} /
#   Time: {{3}} / Doctor: Dr. {{4}} / Token No: {{5}} / Location: {{6}} /
#   Get Directions: {{7}}"
# ---------------------------------------------------------------------------
def appointment_confirmed_name() -> str:
    return settings.whatsapp_appointment_confirmed_template


def appointment_confirmed_params(who: str, date_text: str, time_text: str, doctor: str,
                                 token_code: str, location: str, directions: str) -> list[str]:
    """[name, date, time, doctor, token, location, directions] for the booking body.

    `{{1}}` is the name the visit is booked *under*, so it keeps the full name
    rather than the first name the reminder templates use — a dependent's
    booking has to be identifiable at the front desk.
    """
    return [
        clean_param(who, fallback="Patient", limit=80),
        clean_param(date_text, fallback="-", limit=40),
        clean_param(time_text, fallback="As per token queue", limit=40),
        clean_param(_bare_doctor_name(doctor), fallback="your doctor", limit=80),
        clean_param(token_code, fallback="-", limit=20),
        clean_param(location, fallback="the clinic", limit=150),
        clean_param(directions, fallback="https://www.google.com/maps", limit=300),
    ]


# ---------------------------------------------------------------------------
# appointment_cancelled — "Hello {{1}} ... Token: {{2}} / Doctor: Dr. {{3}} /
#   Visit Date: {{4}} / {{5}}"
# ---------------------------------------------------------------------------
def appointment_cancelled_name() -> str:
    return settings.whatsapp_appointment_cancelled_template


def appointment_cancelled_params(who: str, reference: str, doctor: str,
                                 date_text: str, reason: str) -> list[str]:
    """[name, token/reference, doctor bare, visit date, reason].

    This template was the only one sending hand-assembled parameters straight
    from the call site, with no `clean_param` anywhere — so nothing collapsed
    whitespace, capped a length, or caught a blank. A blank parameter does not
    render as an empty string; Meta rejects the whole send. For a message whose
    entire job is "do not travel, the doctor is not coming", losing it is the
    worst failure of any template here.

    `{{1}}` keeps the FULL name, like the booking confirmation it mirrors: the
    patient needs to see which visit was cancelled, and a household can have
    several. `{{2}}` falls back to the appointment id when no token was ever
    issued — a cancellation can land before the queue opens.
    """
    return [
        clean_param(who, fallback="Patient", limit=80),
        clean_param(reference, fallback="-", limit=20),
        clean_param(_bare_doctor_name(doctor), fallback="your doctor", limit=80),
        clean_param(date_text, fallback="-", limit=40),
        clean_param(reason, fallback="The doctor is unexpectedly unavailable.", limit=200),
    ]


# ---------------------------------------------------------------------------
# 03_leave_now_ — "Hi {{1}}, your turn for Dr. {{2}} is expected around {{3}}.
#                 Token: {{4}} ... Please start for {{5}} now ..."
# ---------------------------------------------------------------------------
def leave_now_name() -> str:
    return settings.whatsapp_leave_now_template


def _bare_doctor_name(name) -> str:
    """Doctor's name without an honorific — the template supplies its own.

    `{{2}}` sits directly after a literal "Dr." in the approved copy, so a row
    stored as "Dr. Rahul Sharma" would reach the patient as "Dr. Dr. Rahul
    Sharma". Names are normally stored bare; this only catches the ones that
    aren't.
    """
    text = str(name or "").strip()
    for prefix in ("dr.", "dr "):
        if text.lower().startswith(prefix):
            return text[len(prefix):].strip()
    return text


def leave_now_params(who: str, doctor: str, eta_text: str, token_code: str,
                     destination: str) -> list[str]:
    """[patient, doctor, expected time, token, where to go] for the leave-now body."""
    return [
        clean_param(str(who or "").split(" ")[0], fallback="there", limit=40),
        clean_param(_bare_doctor_name(doctor), fallback="your doctor", limit=80),
        clean_param(eta_text, fallback="shortly", limit=40),
        clean_param(token_code, fallback="-", limit=20),
        clean_param(destination, fallback="the clinic", limit=100),
    ]


# ---------------------------------------------------------------------------
# doctor_day_complete — "Well done, Dr. {{1}} ... Date: {{2}} / Scheduled: {{3}}
#   / Completed: {{4}} / Cancelled-No-show: {{5}} / Hospital: {{6}}"
# ---------------------------------------------------------------------------
def doctor_day_complete_name() -> str:
    return settings.whatsapp_doctor_day_complete_template


def doctor_day_complete_params(doctor: str, date_text: str, scheduled, completed,
                               cancelled, hospital: str) -> list[str]:
    """[doctor, date, scheduled, completed, cancelled/no-show, hospital].

    Three counts, and all three are legitimately 0 — "Cancelled/No-show: 0" is
    the *good* day. They're stringified before the blank guard sees them.
    """
    return [
        clean_param(_bare_doctor_name(doctor), fallback="Doctor", limit=80),
        clean_param(date_text, fallback="today", limit=40),
        clean_param(str(max(0, int(scheduled or 0))), fallback="0", limit=10),
        clean_param(str(max(0, int(completed or 0))), fallback="0", limit=10),
        clean_param(str(max(0, int(cancelled or 0))), fallback="0", limit=10),
        clean_param(hospital, fallback="your practice", limit=100),
    ]


# ---------------------------------------------------------------------------
# doctor_daily_bookings — "Good morning Dr. {{1}} ... {{2}} appointment(s) ...
#   Date: {{3}} / First: {{4}} / Last: {{5}} / Hospital: {{6}} / Location: {{7}}"
# ---------------------------------------------------------------------------
def doctor_daily_name() -> str:
    return settings.whatsapp_doctor_daily_template


def doctor_daily_params(doctor: str, count, date_text: str, first_time: str,
                        last_time: str, hospital: str, location: str) -> list[str]:
    """[doctor, count, date, first appt, last appt, hospital, location].

    `first_time`/`last_time` are blank on a token-mode day whose doctor has no
    published session either — "Not scheduled" is the truthful filler, and a
    blank parameter would cost the doctor the whole message.
    """
    return [
        clean_param(_bare_doctor_name(doctor), fallback="Doctor", limit=80),
        clean_param(str(max(0, int(count or 0))), fallback="0", limit=10),
        clean_param(date_text, fallback="today", limit=40),
        clean_param(first_time, fallback="As per queue", limit=40),
        clean_param(last_time, fallback="As per queue", limit=40),
        clean_param(hospital, fallback="your practice", limit=100),
        clean_param(location, fallback="See TapCure dashboard", limit=150),
    ]


# ---------------------------------------------------------------------------
# doctor_registration_received — "Hello Dr. {{1}} ... Registration No: {{2}} /
#   Hospital: {{3}} / Location: {{4}} / Submitted On: {{5}}"
# ---------------------------------------------------------------------------
def doctor_registration_name() -> str:
    return settings.whatsapp_doctor_registration_template


def doctor_registration_params(doctor: str, registration_no: str, practice: str,
                               location: str, submitted_on: str) -> list[str]:
    """[doctor, registration no, practice, location, submitted date].

    The only template addressed to a doctor rather than a patient, so `{{1}}` is
    the full name — "Hello Dr. Rahul" reads as over-familiar in a formal
    acknowledgement, and the honorific still comes from the approved copy.
    """
    return [
        clean_param(_bare_doctor_name(doctor), fallback="Doctor", limit=80),
        clean_param(registration_no, fallback="-", limit=60),
        clean_param(practice, fallback="Independent practice", limit=100),
        clean_param(location, fallback="-", limit=150),
        clean_param(submitted_on, fallback="today", limit=40),
    ]


# ---------------------------------------------------------------------------
# consultation_complete — "Hello {{1}} ... Visit Date: {{2}} / Consultation
#   Time: {{3}} / Doctor: Dr. {{4}} / Hospital: {{5}} / Token No: {{6}}"
# ---------------------------------------------------------------------------
def consultation_complete_name() -> str:
    return settings.whatsapp_consultation_complete_template


def consultation_complete_params(who: str, date_text: str, time_text: str, doctor: str,
                                 hospital: str, token_code: str) -> list[str]:
    """[patient, visit date, consultation time, doctor, hospital, token]."""
    return [
        clean_param(str(who or "").split(" ")[0], fallback="there", limit=40),
        clean_param(date_text, fallback="today", limit=40),
        clean_param(time_text, fallback="today", limit=40),
        clean_param(_bare_doctor_name(doctor), fallback="your doctor", limit=80),
        clean_param(hospital, fallback="the clinic", limit=100),
        clean_param(token_code, fallback="-", limit=20),
    ]


# ---------------------------------------------------------------------------
# tapcure_prescription_ready — "Hello {{1}}, / {{2}} prescription from Dr. {{3}}
#   is ready. / Medicines: {{4}} / Visit Date: {{5}}"
# ---------------------------------------------------------------------------
def prescription_ready_name() -> str:
    return settings.whatsapp_prescription_ready_template


def medicine_summary(items, limit: int = 200) -> str:
    """The prescribed drugs as one comma-joined parameter.

    A prescription can run to a dozen lines and a parameter cannot: Meta caps
    the length, and a parameter may not contain a newline, so the list cannot be
    broken across lines the way it is on screen. Cutting at the character limit
    would leave the reader looking at "Pan-", so whole medicines are dropped
    instead and the remainder is counted: "..., +4 more". The count is the point
    — it tells the patient the list is partial, which a silent truncation does
    not.

    Dose rides inside the name in brackets rather than becoming its own
    parameter, for the same reason the reminder template folds it in: a line
    with no dosage would otherwise send a blank parameter and Meta rejects the
    whole message.
    """
    names = []
    for item in items or []:
        drug = str(getattr(item, "drug_name", "") or "").strip()
        if not drug:
            continue
        dose = str(getattr(item, "dosage", "") or "").strip()
        names.append(f"{drug} ({dose})" if dose else drug)
    if not names:
        return ""

    chosen: list[str] = []
    for name in names:
        left_after = len(names) - (len(chosen) + 1)
        suffix = f", +{left_after} more" if left_after > 0 else ""
        # Keep the first medicine even if it alone exceeds the limit — one
        # truncated name beats an empty parameter, which would cost the send.
        if len(", ".join(chosen + [name]) + suffix) > limit and chosen:
            break
        chosen.append(name)
    left = len(names) - len(chosen)
    return ", ".join(chosen) + (f", +{left} more" if left > 0 else "")


def prescription_ready_params(who: str, whose: str, doctor: str, medicines: str,
                              date_text: str) -> list[str]:
    """[greeting name, possessive, doctor, medicine list, visit date].

    `{{2}}` opens a sentence ("Your prescription ...", "Raju's prescription
    ..."), so unlike the reminder template — where the same possessive sits
    mid-sentence — it has to be capitalised here. Sending the lower-case form
    would put "your prescription" at the start of a line.
    """
    owner = clean_param(whose, fallback="Your", limit=40)
    owner = owner[:1].upper() + owner[1:]
    return [
        clean_param(str(who or "").split(" ")[0], fallback="there", limit=40),
        owner,
        clean_param(_bare_doctor_name(doctor), fallback="your doctor", limit=80),
        clean_param(medicines, fallback="See the TapCure app", limit=200),
        clean_param(date_text, fallback="today", limit=40),
    ]


# ---------------------------------------------------------------------------
# almost_your_turn_a — "Hello {{1}} ... Estimated Wait: {{2}} / Patients Ahead:
#                       {{3}} / Token No: {{4}} / Doctor: Dr. {{5}} / {{6}}"
# ---------------------------------------------------------------------------
def almost_turn_name() -> str:
    return settings.whatsapp_almost_turn_template


def almost_turn_params(who: str, wait_min, ahead, token_code: str, doctor: str,
                       place: str) -> list[str]:
    """[patient, wait, ahead, token, doctor, hospital/room] for the almost-turn body.

    `ahead` is a count that is legitimately 0 when the patient is at the front of
    the queue — and "0" must survive as the string "0". `clean_param`'s blank
    guard would otherwise be irrelevant here, but an int 0 passed through
    `str(value or "")` collapses to empty, so it's formatted before it gets there.
    """
    minutes = max(0, int(wait_min or 0))
    wait_text = f"{minutes} min" if minutes else "a few minutes"
    return [
        clean_param(str(who or "").split(" ")[0], fallback="there", limit=40),
        clean_param(wait_text, fallback="a few minutes", limit=40),
        clean_param(str(max(0, int(ahead or 0))), fallback="0", limit=10),
        clean_param(token_code, fallback="-", limit=20),
        clean_param(_bare_doctor_name(doctor), fallback="your doctor", limit=80),
        clean_param(place, fallback="the clinic", limit=100),
    ]


# ---------------------------------------------------------------------------
# tapcure_pilot_reminder — "Hello {{1}}, your TapCure free trial for {{2}} {{3}}. ..."
#   NEW (2026-11-10), needs approval. Empty setting = not sent.
# ---------------------------------------------------------------------------
def pilot_reminder_name() -> str:
    return (settings.whatsapp_pilot_reminder_template or "").strip()


def pilot_reminder_params(who: str, hospital: str, status_text: str) -> list[str]:
    """[admin name, hospital, status] e.g. ["Satya", "satya sai", "ends in 7 days (3 December)"]."""
    return [
        clean_param(who, fallback="there", limit=80),
        clean_param(hospital, fallback="your hospital", limit=100),
        clean_param(status_text, fallback="ends soon", limit=120),
    ]


# Event types published to the Lambda sender on the SQS transport. Keep in step
# with the payload keys in `notifications.send_whatsapp`.
MEDICINE_REMINDER_EVENT = "medicine_reminder"
MEDICINE_REMINDER_PAYLOAD_KEYS = ["recipient_name", "medicine", "instruction"]

LEAVE_NOW_EVENT = "leave_now"
LEAVE_NOW_PAYLOAD_KEYS = ["recipient_name", "doctor_name", "expected_time", "token", "destination"]

APPOINTMENT_CONFIRMED_EVENT = "appointment_confirmed"
APPOINTMENT_CONFIRMED_PAYLOAD_KEYS = [
    "recipient_name", "date", "appointment_time", "doctor_name", "token", "location", "directions_url",
]

APPOINTMENT_CANCELLED_EVENT = "appointment_cancelled"
APPOINTMENT_CANCELLED_PAYLOAD_KEYS = [
    "recipient_name", "token", "doctor_name", "date", "reason",
]

ALMOST_TURN_EVENT = "almost_turn"
ALMOST_TURN_PAYLOAD_KEYS = ["recipient_name", "wait_text", "ahead", "token", "doctor_name", "place"]

DOCTOR_DAY_COMPLETE_EVENT = "doctor_day_complete"
DOCTOR_DAY_COMPLETE_PAYLOAD_KEYS = [
    "doctor_name", "date", "scheduled", "completed", "cancelled_no_show", "hospital",
]

DOCTOR_DAILY_EVENT = "doctor_daily_bookings"
DOCTOR_DAILY_PAYLOAD_KEYS = [
    "doctor_name", "count", "date", "first_appointment", "last_appointment",
    "hospital", "location",
]

DOCTOR_REGISTRATION_EVENT = "doctor_registration_received"
DOCTOR_REGISTRATION_PAYLOAD_KEYS = [
    "doctor_name", "registration_no", "practice", "location", "submitted_on",
]

CONSULTATION_COMPLETE_EVENT = "consultation_complete"
CONSULTATION_COMPLETE_PAYLOAD_KEYS = [
    "recipient_name", "visit_date", "consultation_time", "doctor_name", "hospital", "token",
]

PILOT_REMINDER_EVENT = "pilot_reminder"
PILOT_REMINDER_PAYLOAD_KEYS = ["recipient_name", "hospital", "status"]

PRESCRIPTION_READY_EVENT = "prescription_ready"
PRESCRIPTION_READY_PAYLOAD_KEYS = [
    "recipient_name", "whose", "doctor_name", "medicines", "visit_date",
]
