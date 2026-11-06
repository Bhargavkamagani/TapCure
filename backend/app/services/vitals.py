"""
Vitals helpers — derive BMI and flag abnormal readings against standard adult
reference ranges, so the doctor sees a red/amber marker at a glance.

Statuses returned per measure:
    "normal"   — within healthy range          (UI: green)
    "watch"    — borderline / elevated          (UI: amber)
    "high"/"low" — clearly out of range          (UI: red)
    "critical" — dangerous, needs attention now  (UI: deep red)

These are decision-support hints for staff, NOT a diagnosis. Ranges are typical
adult values; paediatric/pregnancy cases need clinical judgement.
"""
from __future__ import annotations


def bmi(weight_kg, height_cm) -> float | None:
    """Body Mass Index = kg / m². Returns None if either input is missing."""
    if not weight_kg or not height_cm:
        return None
    m = float(height_cm) / 100.0
    if m <= 0:
        return None
    return round(float(weight_kg) / (m * m), 1)


def _bp_status(sys, dia) -> str | None:
    if sys is None and dia is None:
        return None
    s, d = sys or 0, dia or 0
    if s >= 180 or d >= 120:
        return "critical"
    if s >= 140 or d >= 90:
        return "high"
    if (sys is not None and s < 90) or (dia is not None and d < 60):
        return "low"
    if s >= 120 or d >= 80:
        return "watch"   # elevated / stage-1 borderline
    return "normal"


def _pulse_status(p) -> str | None:
    if p is None:
        return None
    if p < 50 or p > 120:
        return "critical"
    if p < 60:
        return "low"
    if p > 100:
        return "high"
    return "normal"


def _temp_status(t) -> str | None:
    if t is None:
        return None
    t = float(t)
    if t >= 104:
        return "critical"
    if t >= 101:
        return "high"
    if t >= 99.6:
        return "watch"
    if t < 95:
        return "low"
    return "normal"


def _spo2_status(s) -> str | None:
    if s is None:
        return None
    if s <= 90:
        return "critical"
    if s < 95:
        return "low"
    return "normal"


def _resp_status(r) -> str | None:
    if r is None:
        return None
    if r < 12:
        return "low"
    if r > 20:
        return "high"
    return "normal"


def _sugar_status(value, kind) -> str | None:
    if value is None:
        return None
    fasting = (kind or "").lower() == "fasting"
    if value < 70:
        return "low"
    if fasting:
        if value >= 126:
            return "high"
        if value >= 100:
            return "watch"   # pre-diabetic
        return "normal"
    # random / post-prandial
    if value >= 200:
        return "high"
    if value >= 140:
        return "watch"
    return "normal"


def _bmi_status(b) -> str | None:
    if b is None:
        return None
    if b < 18.5:
        return "low"
    if b >= 30:
        return "high"
    if b >= 25:
        return "watch"
    return "normal"


def evaluate(v) -> dict:
    """Given a PatientVital (or any object with the same attributes), return the
    computed BMI, a per-measure status map, and whether anything is abnormal."""
    g = (lambda k: getattr(v, k, None)) if not isinstance(v, dict) else v.get
    b = bmi(g("weight_kg"), g("height_cm"))
    flags = {
        "bp": _bp_status(g("bp_systolic"), g("bp_diastolic")),
        "pulse": _pulse_status(g("pulse")),
        "temperature": _temp_status(g("temperature_f")),
        "spo2": _spo2_status(g("spo2")),
        "respiratory_rate": _resp_status(g("respiratory_rate")),
        "blood_sugar": _sugar_status(g("blood_sugar"), g("sugar_type")),
        "bmi": _bmi_status(b),
    }
    flags = {k: s for k, s in flags.items() if s is not None}
    abnormal = any(s in ("watch", "low", "high", "critical") for s in flags.values())
    return {"bmi": b, "flags": flags, "abnormal": abnormal}
