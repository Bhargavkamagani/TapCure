"""
Reports aggregation — computes analytics live from tokens + appointments and
upserts snapshot rows into the report tables.

Aggregation runs in Python over the window's tokens (portable across
SQLite/MySQL/Postgres; fine at hospital scale). Revenue is a proxy: the sum of
consultation fees on completed visits (the Payment module is deferred, so there
is no settled-payment figure yet).
"""
from uuid import UUID
from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from ..database import utcnow
from ..models import (
    Appointment, DailyReport, Department, DepartmentReport, Doctor, DoctorAffiliation,
    DoctorDelayLog, DoctorReport, MonthlyReport, Patient, Token,
)
from . import scheduling

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def month_bounds(year: int, month: int) -> tuple[date, date]:
    return date(year, month, 1), date(year, month, monthrange(year, month)[1])


def tokens_in(db: Session, start: date, end: date, *, hospital_id=None, doctor_id=None, department_id=None) -> list[Token]:
    stmt = select(Token).where(Token.token_date >= start, Token.token_date <= end)
    if hospital_id:
        stmt = stmt.where(Token.hospital_id == hospital_id)
        # Hospital-scoped reporting must NOT include a doctor's personal practice
        # (its tokens inherit the hospital's hospital_id). Doctor-only aggregation
        # (no hospital_id) is left untouched — that's the doctor's own report.
        stmt = stmt.outerjoin(
            DoctorAffiliation, Token.affiliation_id == DoctorAffiliation.affiliation_id
        ).where(
            or_(
                Token.affiliation_id.is_(None),
                DoctorAffiliation.managed_by_hospital.is_(True),
            )
        )
    if doctor_id:
        stmt = stmt.where(Token.doctor_id == doctor_id)
    if department_id:
        doc_ids = db.scalars(select(Doctor.doctor_id).where(Doctor.department_id == department_id)).all()
        stmt = stmt.where(Token.doctor_id.in_(list(doc_ids) or [-1]))
    return list(db.scalars(stmt).all())


def _revenue(db: Session, tokens: list[Token]) -> dict:
    """Money actually collected for these tokens' appointments:
        consultation fees that were PAID (collected at the hospital)
      + booking fees (the ₹ collected online at booking).
    Returns a breakdown so reports can show where the money came from. The caller
    already scopes `tokens` (hospital = all doctors; a doctor = only their own), so
    this is correct for both the hospital and doctor views."""
    appt_ids = list({t.appointment_id for t in tokens if t.appointment_id})
    if not appt_ids:
        return {"total": 0.0, "consultation": 0.0, "booking": 0.0, "by_mode": by_mode([])}
    rows = db.execute(
        select(
            Appointment.consultation_fee, Appointment.consultation_paid, Appointment.booking_fee_paid,
            Appointment.consultation_payment_method,
        ).where(Appointment.appointment_id.in_(appt_ids))
    ).all()
    consultation = float(sum((fee or 0) for fee, paid, _, _ in rows if paid))
    booking = float(sum((bf or 0) for _, _, bf, _ in rows))
    return {"total": consultation + booking, "consultation": consultation, "booking": booking,
            "by_mode": by_mode([(fee, method) for fee, paid, _, method in rows if paid])}


PAYMENT_MODES = ("cash", "upi", "card", "other")


def by_mode(paid: list[tuple]) -> list[dict]:
    """Collected consultation fees split by how they were paid, so the desk can
    match Cash against the drawer and UPI/Card against the bank statement.

    `paid` is (fee, method) for each PAID consultation. A ₹0 visit (a free
    revisit) is not money collected and is left out. A paid row with no method
    predates the mode being recorded and was always taken as cash.
    """
    acc = {m: {"mode": m, "amount": 0.0, "count": 0} for m in PAYMENT_MODES}
    for fee, method in paid:
        if not fee or float(fee) <= 0:
            continue
        m = method if method in acc else "cash"
        acc[m]["amount"] += float(fee)
        acc[m]["count"] += 1
    return list(acc.values())


def _peak_hour(tokens: list[Token]) -> str | None:
    buckets: dict[int, int] = {}
    for t in tokens:
        buckets[t.created_at.hour] = buckets.get(t.created_at.hour, 0) + 1
    if not buckets:
        return None
    h = max(buckets, key=buckets.get)
    return f"{h:02d}:00-{(h + 1) % 24:02d}:00"


def aggregate(db: Session, tokens: list[Token]) -> dict:
    completed = [t for t in tokens if t.status == "completed"]
    missed = [t for t in tokens if t.status == "missed"]
    cancelled = [t for t in tokens if t.status == "cancelled"]
    waits = [t.wait_duration_mins for t in completed if t.wait_duration_mins is not None]
    consults = [t.consult_duration_mins for t in completed if t.consult_duration_mins is not None]
    rev = _revenue(db, tokens)  # collected money for ALL tokens in scope (paid consult + booking)
    return {
        "total_tokens": len(tokens),
        "tokens_completed": len(completed),
        "tokens_missed": len(missed),
        "tokens_cancelled": len(cancelled),
        "avg_wait_mins": round(sum(waits) / len(waits), 2) if waits else 0.0,
        "avg_consult_mins": round(sum(consults) / len(consults), 2) if consults else 0.0,
        "total_revenue": rev["total"],
        "consultation_revenue": rev["consultation"],
        "booking_revenue": rev["booking"],
        "collected_by_mode": rev["by_mode"],
        "peak_hour": _peak_hour(tokens),
    }


# ---- snapshot generators ----------------------------------------------------
def daily(db: Session, hospital_id: UUID, on_date: date, doctor_id: UUID | None = None) -> dict:
    tokens = tokens_in(db, on_date, on_date, hospital_id=hospital_id, doctor_id=doctor_id)
    agg = aggregate(db, tokens)
    row = db.scalar(
        select(DailyReport).where(
            DailyReport.hospital_id == hospital_id,
            DailyReport.doctor_id == doctor_id,
            DailyReport.report_date == on_date,
        )
    )
    if not row:
        row = DailyReport(hospital_id=hospital_id, doctor_id=doctor_id, report_date=on_date)
        db.add(row)
    for k, v in agg.items():
        if k == "collected_by_mode":   # a list for the API, not a snapshot column
            continue
        setattr(row, k, v)
    row.generated_at = utcnow()
    return {"hospital_id": hospital_id, "doctor_id": doctor_id, "date": on_date.isoformat(), **agg}


def monthly(db: Session, hospital_id: UUID, year: int, month: int) -> dict:
    start, end = month_bounds(year, month)
    tokens = tokens_in(db, start, end, hospital_id=hospital_id)
    agg = aggregate(db, tokens)
    total = agg["total_tokens"] or 1
    unique_patients = len({t.patient_id for t in tokens if t.patient_id})
    new_patients = db.scalar(
        select(Patient.patient_id).where(Patient.hospital_id == hospital_id).where(
            Patient.created_at >= start, Patient.created_at <= end
        ).limit(1)
    )
    new_count = len(db.scalars(
        select(Patient.patient_id).where(
            Patient.hospital_id == hospital_id, Patient.created_at >= start, Patient.created_at <= end
        )
    ).all())
    distinct_days = len({t.token_date for t in tokens}) or 1
    out = {
        "hospital_id": hospital_id, "month": month, "year": year,
        "total_tokens": agg["total_tokens"], "unique_patients": unique_patients,
        "new_patients": new_count, "total_revenue": agg["total_revenue"],
        "avg_daily_tokens": round(agg["total_tokens"] / distinct_days, 2),
        "no_show_rate": round(agg["tokens_missed"] / total * 100, 2),
        "cancellation_rate": round(agg["tokens_cancelled"] / total * 100, 2),
    }
    row = db.scalar(select(MonthlyReport).where(MonthlyReport.hospital_id == hospital_id, MonthlyReport.month == month, MonthlyReport.year == year))
    if not row:
        row = MonthlyReport(hospital_id=hospital_id, month=month, year=year)
        db.add(row)
    for k in ("total_tokens", "unique_patients", "new_patients", "total_revenue", "avg_daily_tokens", "no_show_rate", "cancellation_rate"):
        setattr(row, k, out[k])
    row.generated_at = utcnow()
    return out


def doctor(db: Session, doctor_id: UUID, year: int, month: int) -> dict:
    d = db.get(Doctor, doctor_id)
    start, end = month_bounds(year, month)
    tokens = tokens_in(db, start, end, doctor_id=doctor_id)
    agg = aggregate(db, tokens)
    ratings = db.scalars(
        select(Appointment.rating).where(
            Appointment.doctor_id == doctor_id, Appointment.rating.is_not(None)
        )
    ).all()
    satisfaction = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
    delays = db.scalars(
        select(DoctorDelayLog.delay_minutes).where(
            DoctorDelayLog.doctor_id == doctor_id,
            DoctorDelayLog.delay_date >= start, DoctorDelayLog.delay_date <= end,
        )
    ).all()
    out = {
        "doctor_id": doctor_id, "hospital_id": d.hospital_id if d else None,
        "month": month, "year": year, "total_tokens": agg["total_tokens"],
        "completed_tokens": agg["tokens_completed"], "missed_tokens": agg["tokens_missed"],
        "avg_consult_mins": agg["avg_consult_mins"], "avg_wait_mins": agg["avg_wait_mins"],
        "patient_satisfaction_avg": satisfaction, "total_delays_mins": int(sum(delays)),
    }
    row = db.scalar(select(DoctorReport).where(DoctorReport.doctor_id == doctor_id, DoctorReport.month == month, DoctorReport.year == year))
    if not row:
        row = DoctorReport(doctor_id=doctor_id, hospital_id=out["hospital_id"], month=month, year=year)
        db.add(row)
    for k in ("total_tokens", "completed_tokens", "missed_tokens", "avg_consult_mins", "avg_wait_mins", "patient_satisfaction_avg", "total_delays_mins"):
        setattr(row, k, out[k])
    row.generated_at = utcnow()
    return out


def department(db: Session, hospital_id: UUID, department_id: UUID, year: int, month: int) -> dict:
    start, end = month_bounds(year, month)
    tokens = tokens_in(db, start, end, hospital_id=hospital_id, department_id=department_id)
    agg = aggregate(db, tokens)
    active_doctors = len(db.scalars(select(Doctor.doctor_id).where(Doctor.department_id == department_id, Doctor.status == "active")).all())
    day_counts: dict[str, int] = {}
    for t in tokens:
        nm = DAY_NAMES[t.token_date.weekday()]
        day_counts[nm] = day_counts.get(nm, 0) + 1
    busiest_day = max(day_counts, key=day_counts.get) if day_counts else None
    out = {
        "department_id": department_id, "hospital_id": hospital_id, "month": month, "year": year,
        "total_tokens": agg["total_tokens"], "active_doctors": active_doctors,
        "avg_wait_mins": agg["avg_wait_mins"], "total_revenue": agg["total_revenue"],
        "busiest_day": busiest_day, "busiest_hour": agg["peak_hour"],
    }
    row = db.scalar(select(DepartmentReport).where(DepartmentReport.department_id == department_id, DepartmentReport.month == month, DepartmentReport.year == year))
    if not row:
        row = DepartmentReport(department_id=department_id, hospital_id=hospital_id, month=month, year=year)
        db.add(row)
    for k in ("total_tokens", "active_doctors", "avg_wait_mins", "total_revenue", "busiest_day", "busiest_hour"):
        setattr(row, k, out[k])
    row.generated_at = utcnow()
    return out


_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def hospital_overview(db: Session, hospital_id: UUID, year: int, month: int) -> dict:
    """Everything the hospital Reports page shows, in one payload — aggregated over
    ALL of the hospital's doctors for the given month: headline KPIs (collected
    money = paid consultations + booking fees), visits per weekday, the visit
    split by department, and the top doctors by completed consultations."""
    start, end = month_bounds(year, month)
    tokens = tokens_in(db, start, end, hospital_id=hospital_id)
    agg = aggregate(db, tokens)

    # Lookup maps for this hospital's doctors and departments.
    doctors = {d.doctor_id: d for d in db.scalars(select(Doctor).where(Doctor.hospital_id == hospital_id)).all()}
    dept_names = {dep.department_id: dep.name for dep in db.scalars(select(Department).where(Department.hospital_id == hospital_id)).all()}

    # Visits per weekday (Mon..Sun).
    week_counts = {d: 0 for d in _WEEK}
    for t in tokens:
        week_counts[_WEEK[t.token_date.weekday()]] += 1
    visits_week = [{"day": d, "value": week_counts[d]} for d in _WEEK]

    # Visit split by department (share of all tokens).
    dept_counts: dict[str, int] = {}
    for t in tokens:
        doc = doctors.get(t.doctor_id)
        label = dept_names.get(doc.department_id) if doc and doc.department_id else None
        label = label or "General"
        dept_counts[label] = dept_counts.get(label, 0) + 1
    total = len(tokens) or 1
    dept_split = sorted(
        ({"label": k, "count": v, "value": round(v / total * 100)} for k, v in dept_counts.items()),
        key=lambda x: x["count"], reverse=True,
    )

    # Top doctors by completed consultations, with average rating from feedback.
    done_by_doc: dict[int, int] = {}
    for t in tokens:
        if t.status == "completed":
            done_by_doc[t.doctor_id] = done_by_doc.get(t.doctor_id, 0) + 1
    rating_rows = db.execute(
        select(Appointment.doctor_id, Appointment.rating).where(
            Appointment.hospital_id == hospital_id,
            Appointment.appointment_date >= start, Appointment.appointment_date <= end,
            Appointment.rating.is_not(None),
        )
    ).all()
    rating_acc: dict[int, list] = {}
    for did, r in rating_rows:
        rating_acc.setdefault(did, []).append(r)
    top_doctors = []
    for did, consults in sorted(done_by_doc.items(), key=lambda x: x[1], reverse=True)[:5]:
        d = doctors.get(did)
        rs = rating_acc.get(did, [])
        top_doctors.append({
            "doctor_id": did,
            "name": (d.name if d and d.name else "Doctor"),
            "specialty": (d.specialization if d else ""),
            "photo": (d.profile_photo_url if d else None),
            "consults": consults,
            "rating": round(sum(rs) / len(rs), 1) if rs else None,
        })

    unique_patients = len({t.patient_id for t in tokens if t.patient_id})
    return {
        "hospital_id": hospital_id, "month": month, "year": year,
        "kpis": {
            "total_patients": unique_patients,
            "consultations": agg["tokens_completed"],
            "total_tokens": agg["total_tokens"],
            "revenue": agg["total_revenue"],
            "consultation_revenue": agg["consultation_revenue"],
            "booking_revenue": agg["booking_revenue"],
            "no_shows": agg["tokens_missed"],
        },
        "collected_by_mode": agg["collected_by_mode"],
        "visits_week": visits_week,
        "dept_split": dept_split,
        "top_doctors": top_doctors,
    }


def dashboard(db: Session, hospital_id: UUID, today: date, doctor_ids: set[UUID] | None = None) -> dict:
    """`doctor_ids` limits every figure to those doctors (a receptionist assigned
    to particular doctors, services/reception_scope.py); None means all."""
    start = today - timedelta(days=6)
    tok_scope = (Token.doctor_id.in_(doctor_ids),) if doctor_ids is not None else ()
    doc_scope = (Doctor.doctor_id.in_(doctor_ids),) if doctor_ids is not None else ()
    affiliation_filter = or_(
        Token.affiliation_id.is_(None),
        DoctorAffiliation.managed_by_hospital.is_(True),
    )
    token_counts = db.execute(
        select(
            func.count(Token.token_id),
            func.sum(case((Token.status == "completed", 1), else_=0)),
            func.sum(case((Token.status == "waiting", 1), else_=0)),
            func.sum(case((Token.status == "missed", 1), else_=0)),
        )
        .select_from(Token)
        .outerjoin(DoctorAffiliation, Token.affiliation_id == DoctorAffiliation.affiliation_id)
        .where(Token.token_date == today, Token.hospital_id == hospital_id, affiliation_filter, *tok_scope)
    ).first() or (0, 0, 0, 0)
    total_tokens, completed_today, waiting_now, no_shows_today = [int(x or 0) for x in token_counts]

    visits_rows = db.execute(
        select(Token.token_date, func.count(Token.token_id))
        .select_from(Token)
        .outerjoin(DoctorAffiliation, Token.affiliation_id == DoctorAffiliation.affiliation_id)
        .where(Token.token_date >= start, Token.token_date <= today, Token.hospital_id == hospital_id, affiliation_filter, *tok_scope)
        .group_by(Token.token_date)
    ).all()
    day_counts: dict[date, int] = {row[0]: int(row[1]) for row in visits_rows}
    visits_week = [
        {"day": DAY_NAMES[(start + timedelta(days=i)).weekday()][:3],
         "value": day_counts.get(start + timedelta(days=i), 0)}
        for i in range(7)
    ]

    by_doctor_rows = db.execute(
        select(Token.doctor_id, Token.status, func.count(Token.token_id))
        .select_from(Token)
        .outerjoin(DoctorAffiliation, Token.affiliation_id == DoctorAffiliation.affiliation_id)
        .where(Token.token_date == today, Token.hospital_id == hospital_id, affiliation_filter, *tok_scope)
        .group_by(Token.doctor_id, Token.status)
    ).all()
    by_doc: dict[int, dict] = {}
    for doctor_id, status, count in by_doctor_rows:
        row = by_doc.setdefault(doctor_id, {"completed": 0, "waiting": 0, "total": 0})
        row["total"] += int(count)
        if status == "completed":
            row["completed"] += int(count)
        elif status == "waiting":
            row["waiting"] += int(count)

    doctor_rows = db.execute(
        select(Doctor.doctor_id, Doctor.name).where(Doctor.hospital_id == hospital_id, *doc_scope)
    ).all()
    # Keyed by the UUID itself. This was `int(did)` from before ids were UUIDs:
    # int(UUID) is a 128-bit number, so no lookup ever matched and every row
    # read "Doctor".
    doc_names = {did: name for did, name in doctor_rows}
    by_doctor = sorted(
        (
            {"doctor_id": did, "name": doc_names.get(did, "Doctor"), **counts}
            for did, counts in by_doc.items()
        ),
        key=lambda r: (r["completed"], r["total"]),
        reverse=True,
    )

    revenue_today = float(
        db.scalar(
            select(func.coalesce(func.sum(Appointment.consultation_fee), 0))
            .select_from(Token)
            .outerjoin(DoctorAffiliation, Token.affiliation_id == DoctorAffiliation.affiliation_id)
            .join(Appointment, Token.appointment_id == Appointment.appointment_id)
            .where(
                Token.token_date == today,
                Token.hospital_id == hospital_id,
                Appointment.consultation_paid.is_(True),
                affiliation_filter,
                *tok_scope,
            )
        )
    ) or 0.0

    # Roster + registered-patient counts backing the front-desk stat tiles.
    # Count the same population the queue board lists: active AND credential-
    # verified. A self-registered doctor awaiting verification is anchored to a
    # hospital only as a tenant placeholder, so counting them here made the KPI
    # disagree with the list of doctors right underneath it.
    _bookable = (Doctor.hospital_id == hospital_id, Doctor.status == "active",
                 Doctor.verification_status == "verified")
    roster = db.scalars(select(Doctor).where(*_bookable, *doc_scope)).all()
    doctors_total = len(roster)
    # "On duty" = actually rostered today. It used to read the live presence row
    # (available/busy/on_break), which nobody toggles — so the tile disagreed
    # with the board underneath it, and a doctor on leave or with no session on
    # this weekday still counted. Same resolver the desk board uses.
    duty = scheduling.duty_map(db, roster, today)
    doctors_on_duty = sum(1 for d in roster if duty[d.doctor_id]["on_duty"])
    total_patients = int(db.scalar(
        select(func.count(Patient.patient_id)).where(Patient.hospital_id == hospital_id)
    ) or 0)

    return {
        "hospital_id": hospital_id,
        "date": today.isoformat(),
        "kpis": {
            "tokens_today": total_tokens,
            "completed_today": completed_today,
            "waiting_now": waiting_now,
            "no_shows_today": no_shows_today,
            "revenue_today": revenue_today,
            "doctors": doctors_total,
            "doctors_active": doctors_on_duty,
            "total_patients": total_patients,
        },
        "by_doctor": by_doctor,
        "visits_week": visits_week,
    }
