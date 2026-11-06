"""Turn a doctor's free-text dosage into concrete reminder times.

`prescription_items` stores what the doctor typed — `frequency` like "1-0-1
after food" and `duration` like "5 days". Reminders need structure: which times
of day, and for how many days.

Everything here is deliberately conservative. An unrecognised frequency returns
None and NO course is created — a wrong reminder ("take your 9 PM dose") is worse
than no reminder, because the patient may act on it. Silence is recoverable; a
confidently wrong medicine instruction is not.
"""
import re
from datetime import time

# Slot -> default clock time. Chosen to sit inside normal waking hours so a dose
# never lands in the quiet window (see config.reminder_quiet_*).
SLOT_TIMES: dict[str, time] = {
    "morning": time(9, 0),
    "afternoon": time(14, 0),
    "night": time(21, 0),
}
SLOT_ORDER = ("morning", "afternoon", "night")

# Latin abbreviations still in daily use on Indian prescriptions.
_ABBREV = {
    "od": ["morning"],                            # once daily
    "qd": ["morning"],
    "bd": ["morning", "night"],                   # twice daily
    "bid": ["morning", "night"],
    "tds": ["morning", "afternoon", "night"],     # thrice daily
    "tid": ["morning", "afternoon", "night"],
    "qid": ["morning", "afternoon", "night"],     # 4x/day — we can only place 3
    "hs": ["night"],                              # at bedtime
    "nocte": ["night"],
    "mane": ["morning"],
}
# Periods this module cannot express. Every schedule it builds is DAILY, so a
# frequency carrying one of these must produce no course at all rather than a
# daily one — "once a week" parsed as `once` and scheduled 7x the intended dose.
# Never reached by the prescription composer, which builds "1-0-1" grids from
# tick-boxes, but the field has a free-text mode and weekly dosing is real
# (vitamin D 60k, methotrexate, alendronate). No reminder is safe; a daily
# reminder for a weekly drug is not. Matches what a bare "weekly" already did.
_NON_DAILY = re.compile(r"\b(week|weekly|fortnight|month|monthly|alternate|every\s+other)\b", re.I)


_WORDS = {
    "once": ["morning"],
    "twice": ["morning", "night"],
    "thrice": ["morning", "afternoon", "night"],
}
# Never schedule these — they aren't a fixed course.
_AS_NEEDED = ("sos", "prn", "as needed", "if required", "when required")

_FOOD_HINTS = (
    ("after food", "after food"), ("after meals", "after food"), ("p/c", "after food"),
    ("before food", "before food"), ("before meals", "before food"), ("a/c", "before food"),
    ("empty stomach", "on an empty stomach"), ("with food", "with food"),
    ("bedtime", "at bedtime"),
)


def food_hint(*texts: str) -> str:
    """The 'after food' style note to repeat in the reminder message."""
    blob = " ".join(t or "" for t in texts).lower()
    for needle, label in _FOOD_HINTS:
        if needle in blob:
            return label
    return ""


def parse_frequency(frequency: str) -> list[str] | None:
    """Frequency text -> ordered slot names, or None when it can't be read.

    Handles the "1-0-1" grid Indian prescriptions use (morning-afternoon-night),
    the Latin abbreviations, and plain English. A 4-slot grid ("1-1-1-1") keeps
    its first three — we have no fourth default time, and dropping the extra is
    safer than inventing 3 AM.
    """
    text = (frequency or "").strip().lower()
    if not text:
        return None
    if any(marker in text for marker in _AS_NEEDED):
        return None
    # Before the grid match, not after: "1-0-1 weekly" would otherwise read as a
    # daily grid and schedule 7x the intended doses — the same fault by another
    # route. Every schedule this module builds is daily, so anything carrying a
    # longer period gets no course rather than a wrong one.
    if _NON_DAILY.search(text):
        return None

    # "1-0-1", "1_0_1", "1 0 1", "1-1-1-1"
    grid = re.search(r"\b(\d\s*[-_/ ]\s*\d(?:\s*[-_/ ]\s*\d){1,2})\b", text)
    if grid:
        counts = [int(n) for n in re.findall(r"\d", grid.group(1))]
        slots = [SLOT_ORDER[i] for i, n in enumerate(counts[:3]) if n > 0]
        return slots or None

    for key, slots in _ABBREV.items():
        if re.search(rf"\b{key}\b", text):
            return list(slots)
    for key, slots in _WORDS.items():
        if re.search(rf"\b{key}\b", text):
            return list(slots)

    # "3 times a day" / "2 times daily"
    times_a_day = re.search(r"\b([1-4])\s*(?:times?|x)\b", text)
    if times_a_day:
        n = int(times_a_day.group(1))
        return [SLOT_ORDER[0]] if n == 1 else (
            ["morning", "night"] if n == 2 else list(SLOT_ORDER)
        )
    if re.search(r"\bdaily\b|\bevery day\b", text):
        return ["morning"]
    return None


def parse_duration_days(duration: str) -> int | None:
    """Duration text -> number of days, or None when it can't be read.

    Capped at 90 days: anything longer is a maintenance drug, not a course, and
    materialising a year of dose rows per patient is not what this table is for.
    """
    text = (duration or "").strip().lower()
    if not text:
        return None
    # "Ongoing" is what the prescription form now offers as the alternative to a
    # number of days — blood pressure, thyroid, diabetes. It means deliberately
    # no end date, so no course is scheduled: reminders that stop after an
    # invented 90 days would be worse than none for a medicine taken for life.
    if any(w in text for w in ("continue", "long term", "lifelong", "ongoing")):
        return None

    m = re.search(r"\b(\d{1,3})\s*(day|days|d|week|weeks|w|month|months|m)\b", text)
    if not m:
        bare = re.fullmatch(r"\s*(\d{1,3})\s*", text)
        if not bare:
            return None
        days = int(bare.group(1))
    else:
        n, unit = int(m.group(1)), m.group(2)
        days = n * (7 if unit.startswith("w") else 30 if unit.startswith("m") else 1)
    return max(1, min(days, 90)) if days > 0 else None


def plan_for_item(frequency: str, duration: str, instructions: str = "") -> dict | None:
    """Full schedule for one prescription line, or None if it isn't schedulable.

    Returns {slots, times, days, food}. Callers should treat None as "this drug
    gets no reminders" and carry on with the rest of the prescription.
    """
    slots = parse_frequency(frequency)
    days = parse_duration_days(duration)
    if not slots or not days:
        return None
    return {
        "slots": slots,
        "times": [SLOT_TIMES[s] for s in slots],
        "days": days,
        "food": food_hint(frequency, instructions),
    }
