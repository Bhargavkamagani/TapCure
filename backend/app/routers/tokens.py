"""
Module 7 — Token Engine endpoints (25 APIs) + emergency queue.

The live OP queue: generate tokens from appointments, advance the queue
(call-next/complete), recall/skip/miss, reorder, priority bumps, the emergency
lane, plus read views (current/waiting/queue/stats/live-display/history) and
audit trails. Static `/tokens/...` paths are declared before `/tokens/{id}`.
"""
from uuid import UUID
from datetime import date as date_cls
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..deps import ensure_same_tenant, require_permission, require_staff
from ..rbac import ROLE_PATIENT, is_hospital_staff
from ..models import (
    Appointment, Doctor, EmergencyQueue, FamilyMember, Patient, PatientVital, Token,
    TokenMovementLog, TokenStatusHistory, User,
)
from ..schemas.token import (
    BulkCancelRequest, CancelTokenRequest, EmergencyCreate, EmergencyOut,
    EstimateOut, GenerateTokenRequest, MovementLogOut, NotifyRequest,
    PriorityRequest, RecallRequest, ReorderRequest, SkipRequest, TokenIdRequest,
    TokenOut, TokenStatusHistoryOut,
)
from ..services import audit
from ..services import family_link
from ..services.reception_scope import ensure_can_see_doctor, restrict
from ..services import notifications as notify
from ..services import vitals as vitals_service
from ..services import token_engine as te


def _notify_patient(db, token, message: str, ntype: str) -> dict:
    """Tell the patient about a queue event, on every channel we can reach.

    In-app ALWAYS lands — it needs no phone number and no provider, and it's
    waiting for them whenever they open the app (including later, once a walk-in
    registers and their record is claimed). SMS goes out on top when we have a
    usable number: the dependent's own if they opted in, else the account
    holder's, via the one shared resolver.

    Returns what actually happened so the caller can tell the front desk —
    "no phone on file" is exactly when the desk needs to shout the name instead.
    """
    out = {"in_app": False, "sms": False}
    if not token.patient_id:
        return out
    patient = db.get(Patient, token.patient_id)
    if not patient:
        return out
    refs = {"hospital_id": token.hospital_id, "patient_id": patient.patient_id,
            "token_id": token.token_id}
    notify.send_in_app(db, message, ntype=ntype, title="Queue update", **refs)
    out["in_app"] = True

    phone = notify.reminder_phone_for_token(db, token)
    if phone:
        notify.send_sms(db, phone, message, ntype=ntype, title="Queue update", **refs)
        out["sms"] = True
    return out


def _sms_patient(db, token, message: str, ntype: str) -> bool:
    """Backwards-compatible wrapper — returns whether an SMS specifically went."""
    return _notify_patient(db, token, message, ntype)["sms"]

router = APIRouter(tags=["token engine"])


# ---- helpers ----
def _token(db: Session, token_id: UUID) -> Token:
    t = db.get(Token, token_id)
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    return t


def _doctor(db: Session, doctor_id: UUID, me: User) -> Doctor:
    d = db.get(Doctor, doctor_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    ensure_same_tenant(me, d.hospital_id)
    ensure_can_see_doctor(db, me, d.doctor_id)   # receptionist limited to her doctors
    return d


def _out(t: Token) -> TokenOut:
    return TokenOut.model_validate(t)


def _out_with_patient(db: Session, t: Token) -> dict:
    """TokenOut plus the patient's display fields, for queue/list views that
    need to show *who* the token belongs to (TokenOut itself carries only ids)."""
    data = _out(t).model_dump()
    p = db.get(Patient, t.patient_id) if t.patient_id else None
    data["patient_name"] = p.name if p else None
    data["patient_uhid"] = p.uhid if p else None
    data["patient_age"] = p.age if p else None
    data["patient_gender"] = p.gender if p else None
    # Consultation-fee payment status (collected at the hospital) — drives the
    # "Collect ₹X" / "Paid" UI and the call-next gate.
    appt = db.get(Appointment, t.appointment_id) if t.appointment_id else None
    # If there's no linked appointment (emergency token / ad-hoc token),
    # treat the consultation as unpaid by default so the UI shows "Collect".
    data["consultation_paid"] = bool(appt.consultation_paid) if appt else False
    data["consultation_fee"] = float(appt.consultation_fee) if appt else 0
    data["free_revisit"] = appt.free_revisit if appt else None
    data["consultation_payment_method"] = appt.consultation_payment_method if appt else None
    # If the visit is for a dependent, surface their name so the queue shows who
    # is actually being seen (not just the account holder).
    data["family_member_id"] = appt.family_member_id if appt else None
    data["family_member_name"] = None
    if appt and appt.family_member_id:
        fm = db.get(FamilyMember, appt.family_member_id)
        data["family_member_name"] = fm.name if fm else None
    # Why the patient came, as they (or the desk) typed it at booking. Stored on
    # the appointment, but the queue reads tokens — so it has to be carried over
    # here or the doctor and the front desk never see it.
    data["reason"] = (appt.notes or "") if appt else ""
    # Latest vitals (recorded at check-in) — a compact summary so the queue card
    # can show them straight away and flag if anything is abnormal.
    lv = db.scalar(
        select(PatientVital).where(PatientVital.patient_id == t.patient_id)
        .order_by(PatientVital.recorded_at.desc())
    ) if t.patient_id else None
    if lv:
        ev = vitals_service.evaluate(lv)
        data["latest_vitals"] = {
            "bp": f"{lv.bp_systolic}/{lv.bp_diastolic}" if (lv.bp_systolic or lv.bp_diastolic) else None,
            "pulse": lv.pulse,
            "temperature_f": float(lv.temperature_f) if lv.temperature_f is not None else None,
            "spo2": lv.spo2,
            "weight_kg": float(lv.weight_kg) if lv.weight_kg is not None else None,
            "blood_sugar": lv.blood_sugar,
            "bmi": ev["bmi"],
            "abnormal": ev["abnormal"],
            "recorded_at": lv.recorded_at.isoformat(),
        }
    else:
        data["latest_vitals"] = None
    return data


def _out_with_patient_bulk(db: Session, tokens: list[Token]) -> list[dict]:
    """The same payload as `_out_with_patient`, for a whole queue, in 4 queries.

    Built one token at a time it was 3–4 queries EACH: patient, appointment,
    sometimes the family member, and the latest vitals. Measured at depth 5 →
    18 queries, 20 → 66, 40 → 123. The waiting-room display board short-polls
    this endpoint, so a 40-patient queue on 40 screens was ~5,000 queries every
    few seconds, per doctor — the first thing that falls over on a busy OP day,
    and it takes the database down with it.

    Fetching by id lists instead makes the cost flat in the number of tokens.
    """
    if not tokens:
        return []

    patient_ids = {t.patient_id for t in tokens if t.patient_id}
    appt_ids = {t.appointment_id for t in tokens if t.appointment_id}

    patients = {
        p.patient_id: p
        for p in (db.scalars(select(Patient).where(Patient.patient_id.in_(patient_ids))).all()
                  if patient_ids else [])
    }
    appts = {
        a.appointment_id: a
        for a in (db.scalars(select(Appointment).where(Appointment.appointment_id.in_(appt_ids))).all()
                  if appt_ids else [])
    }
    member_ids = {a.family_member_id for a in appts.values() if a.family_member_id}
    members = {
        m.member_id: m
        for m in (db.scalars(select(FamilyMember).where(FamilyMember.member_id.in_(member_ids))).all()
                  if member_ids else [])
    }
    # Latest vitals per patient: one ordered sweep, keeping the first row seen
    # for each patient. Cheaper than a window function and identical in result,
    # because the ordering puts the newest first.
    latest_vitals: dict[int, PatientVital] = {}
    if patient_ids:
        for v in db.scalars(
            select(PatientVital)
            .where(PatientVital.patient_id.in_(patient_ids))
            .order_by(PatientVital.patient_id, PatientVital.recorded_at.desc())
        ).all():
            latest_vitals.setdefault(v.patient_id, v)

    rows = []
    for t in tokens:
        data = _out(t).model_dump()
        p = patients.get(t.patient_id)
        data["patient_name"] = p.name if p else None
        data["patient_uhid"] = p.uhid if p else None
        data["patient_age"] = p.age if p else None
        data["patient_gender"] = p.gender if p else None
        appt = appts.get(t.appointment_id)
        data["consultation_paid"] = bool(appt.consultation_paid) if appt else False
        data["consultation_fee"] = float(appt.consultation_fee) if appt else 0
        data["free_revisit"] = appt.free_revisit if appt else None
        data["consultation_payment_method"] = appt.consultation_payment_method if appt else None
        data["family_member_id"] = appt.family_member_id if appt else None
        member = members.get(appt.family_member_id) if appt and appt.family_member_id else None
        data["family_member_name"] = member.name if member else None
        data["reason"] = (appt.notes or "") if appt else ""
        lv = latest_vitals.get(t.patient_id)
        if lv:
            ev = vitals_service.evaluate(lv)
            data["latest_vitals"] = {
                "bp": f"{lv.bp_systolic}/{lv.bp_diastolic}" if (lv.bp_systolic or lv.bp_diastolic) else None,
                "pulse": lv.pulse,
                "temperature_f": float(lv.temperature_f) if lv.temperature_f is not None else None,
                "spo2": lv.spo2,
                "weight_kg": float(lv.weight_kg) if lv.weight_kg is not None else None,
                "blood_sugar": lv.blood_sugar,
                "bmi": ev["bmi"],
                "abnormal": ev["abnormal"],
                "recorded_at": lv.recorded_at.isoformat(),
            }
        else:
            data["latest_vitals"] = None
        rows.append(data)
    return rows


def _managed(me: User) -> bool:
    """Hospital front-desk staff must not see a doctor's personal-practice tokens."""
    return is_hospital_staff(me.role.name if me.role else None)


def _parse_date(s: str | None) -> date_cls:
    if not s:
        return date_cls.today()
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid date (YYYY-MM-DD)")


# ===================================================== Generate =============
@router.post("/tokens/generate", response_model=dict, status_code=201)
def generate(body: GenerateTokenRequest, me: User = Depends(require_permission("token", "create")), db: Session = Depends(get_db)):
    appt = db.get(Appointment, body.appointment_id)
    if not appt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    ensure_same_tenant(me, appt.hospital_id)
    ensure_can_see_doctor(db, me, appt.doctor_id)
    if appt.status in ("cancelled", "no_show"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Appointment is {appt.status}")

    # Idempotent: bookings auto-allocate a token, so one may already exist — return
    # it instead of failing, so the front desk's "Generate Token" never errors.
    existing = db.scalar(select(Token).where(Token.appointment_id == appt.appointment_id))
    if existing:
        return {"token": _out(existing).model_dump(), "estimate": te.estimate(db, existing)}

    token = te.allocate_token(db, appt, me.user_id, priority=body.priority)
    audit.log_activity(db, me.user_id, "token.generate", "token", {"token_id": token.token_id})
    db.commit()
    db.refresh(token)
    return {"token": _out(token).model_dump(), "estimate": te.estimate(db, token)}


# ===================================================== Read views ==========
@router.get("/tokens/current", response_model=TokenOut | None)
def get_current(doctor_id: UUID = Query(...), affiliation_id: UUID | None = Query(None), date: str | None = Query(None), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    _doctor(db, doctor_id, me)
    return te.current_token(db, doctor_id, _parse_date(date), affiliation_id, managed_only=_managed(me))


@router.get("/tokens/waiting", response_model=list[TokenOut])
def get_waiting(doctor_id: UUID = Query(...), affiliation_id: UUID | None = Query(None), date: str | None = Query(None), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    _doctor(db, doctor_id, me)
    return te.waiting_tokens(db, doctor_id, _parse_date(date), affiliation_id, managed_only=_managed(me))


@router.get("/tokens/queue")
def get_queue(doctor_id: UUID = Query(...), affiliation_id: UUID | None = Query(None), date: str | None = Query(None), me: User = Depends(require_permission("token", "read")), db: Session = Depends(get_db)):
    _doctor(db, doctor_id, me)
    on_date = _parse_date(date)
    managed = _managed(me)
    cur = te.current_token(db, doctor_id, on_date, affiliation_id, managed_only=managed)
    waiting = te.waiting_tokens(db, doctor_id, on_date, affiliation_id, managed_only=managed)
    body = {
        "doctor_id": doctor_id, "affiliation_id": affiliation_id, "date": on_date.isoformat(),
        "total_waiting": len(waiting),
    }
    # A PATIENT gets the COUNT and nothing else. The booking screen asks this to
    # say "12 people are waiting" — that one number is all it has ever used.
    # The rows underneath carry the other patients' names, UHIDs, ages, reason
    # for visit and latest vitals, and a patient account (anyone can open one in
    # seconds) could read them for any doctor at any hospital on the platform,
    # walking doctor_id 1, 2, 3… The staff consoles get the rows as before.
    if me.role and me.role.name == ROLE_PATIENT:
        return body
    # One batch for the current token and the whole waiting list together, so
    # the cost does not grow with the length of the queue.
    rows = _out_with_patient_bulk(db, ([cur] if cur else []) + list(waiting))
    body["current"] = rows[0] if cur else None
    body["waiting"] = rows[1:] if cur else rows
    return body


@router.get("/tokens/estimate", response_model=EstimateOut)
def get_estimate(token_id: UUID | None = Query(None), appointment_id: UUID | None = Query(None),
                 me: User = Depends(require_permission("token", "read")), db: Session = Depends(get_db)):
    """Live ETA + leave-by hints for a token. Look it up by token_id, or by
    appointment_id (handy for patients, who hold the appointment, not the token)."""
    if token_id is not None:
        t = _token(db, token_id)
    elif appointment_id is not None:
        t = db.scalar(select(Token).where(Token.appointment_id == appointment_id))
        if not t:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No token generated for this appointment yet")
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pass token_id or appointment_id")
    # A global patient may read their OWN token at any hospital; hospital staff stay
    # tenant-scoped.
    if me.role and me.role.name == ROLE_PATIENT:
        pat = db.get(Patient, t.patient_id) if t.patient_id else None
        allowed = bool(pat and pat.user_id == me.user_id)
        if not allowed:
            # A visit booked FOR them under a family account they are linked to.
            # Tokens carry no family_member_id of their own, so the dependent is
            # reached through the appointment the token was issued for — without
            # this, the appointment shows on their dashboard but its live queue
            # position answers "Not your token".
            appt = db.get(Appointment, t.appointment_id) if t.appointment_id else None
            member_id = getattr(appt, "family_member_id", None)
            allowed = bool(member_id and member_id in family_link.linked_member_ids(db, me))
        if not allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your token")
    else:
        ensure_same_tenant(me, t.hospital_id)
        ensure_can_see_doctor(db, me, t.doctor_id)
    return te.estimate(db, t)


@router.get("/tokens/stats")
def get_stats(doctor_id: UUID = Query(...), affiliation_id: UUID | None = Query(None), date: str | None = Query(None), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    _doctor(db, doctor_id, me)
    on_date = _parse_date(date)
    base = select(func.count(Token.token_id)).where(Token.doctor_id == doctor_id, Token.token_date == on_date)
    if affiliation_id:
        base = base.where(Token.affiliation_id == affiliation_id)
    if _managed(me):
        base = te._managed_only(base)
    served = db.scalar(base.where(Token.status == "completed")) or 0
    waiting = db.scalar(base.where(Token.status == "waiting")) or 0
    missed = db.scalar(base.where(Token.status == "missed")) or 0
    total = db.scalar(base) or 0
    avg_stmt = select(func.avg(Token.wait_duration_mins)).where(
        Token.doctor_id == doctor_id, Token.token_date == on_date, Token.status == "completed"
    )
    if affiliation_id:
        avg_stmt = avg_stmt.where(Token.affiliation_id == affiliation_id)
    if _managed(me):
        avg_stmt = te._managed_only(avg_stmt)
    avg_wait = db.scalar(avg_stmt)
    return {
        "doctor_id": doctor_id, "affiliation_id": affiliation_id, "date": on_date.isoformat(),
        "served": served, "waiting": waiting, "missed": missed, "total": total,
        "avg_wait_mins": round(float(avg_wait), 1) if avg_wait is not None else None,
    }


@router.get("/tokens/live-display")
def live_display(doctor_id: UUID = Query(...), affiliation_id: UUID | None = Query(None), date: str | None = Query(None), me: User = Depends(require_permission("token", "read")), db: Session = Depends(get_db)):
    """Waiting-room display board: current token + next 5 + total. (Poll this.)"""
    _doctor(db, doctor_id, me)
    on_date = _parse_date(date)
    managed = _managed(me)
    cur = te.current_token(db, doctor_id, on_date, affiliation_id, managed_only=managed)
    waiting = te.waiting_tokens(db, doctor_id, on_date, affiliation_id, managed_only=managed)
    return {
        "doctor_id": doctor_id,
        "affiliation_id": affiliation_id,
        "now_serving": cur.display_code if cur else None,
        "current": _out(cur).model_dump() if cur else None,
        "next_5": [{"display_code": t.display_code, "position": t.queue_position} for t in waiting[:5]],
        "total_waiting": len(waiting),
        # Today's logged doctor delay (minutes) so the front desk sees "running late".
        "delay_min": te.active_delay_mins(db, doctor_id, on_date),
    }


@router.get("/tokens/history", response_model=list[TokenOut])
def token_history(doctor_id: UUID = Query(...), date: str | None = Query(None),
                  all_dates: bool = Query(False, description="Ignore `date` and return recent tokens across every day"),
                  limit: int = Query(500, ge=1, le=2000),
                  status_filter: str | None = Query(None, alias="status"),
                  me: User = Depends(require_staff), db: Session = Depends(get_db)):
    """Tokens issued by a doctor — one day, or (all_dates) the recent run of them.

    The appointments screen merges these in to show what ACTUALLY happened
    (token number, called-in time, wait) next to what was booked, so it needs the
    same all-dates view that list offers. Omitting `date` still means "today",
    unchanged for existing callers; `all_dates` is the opt-in.
    """
    _doctor(db, doctor_id, me)
    stmt = select(Token).where(Token.doctor_id == doctor_id)
    if not all_dates:
        stmt = stmt.where(Token.token_date == _parse_date(date))
    if status_filter:
        stmt = stmt.where(Token.status == status_filter)
    if _managed(me):
        stmt = te._managed_only(stmt)
    order = (Token.token_number,) if not all_dates else (Token.token_date.desc(), Token.token_number)
    return db.scalars(stmt.order_by(*order).limit(limit)).all()


@router.get("/tokens/no-show")
def no_show_report(hospital_id: UUID | None = Query(None), date: str | None = Query(None), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    stmt = select(Token).where(Token.status == "missed")
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(Token.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(Token.hospital_id == hospital_id)
    if date:
        stmt = stmt.where(Token.token_date == _parse_date(date))
    stmt = restrict(stmt, Token.doctor_id, db, me)
    rows = db.scalars(stmt).all()
    return {"count": len(rows), "tokens": [_out(t).model_dump() for t in rows]}


# ===================================================== Queue actions =======
@router.post("/tokens/next")
def call_next(doctor_id: UUID = Query(...), affiliation_id: UUID | None = Query(None), me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    doctor = _doctor(db, doctor_id, me)
    on_date = date_cls.today()
    cur = te.current_token(db, doctor_id, on_date, affiliation_id)
    waiting = te.waiting_tokens(db, doctor_id, on_date, affiliation_id)

    # Call the next PAID patient. Anyone whose consultation fee is still pending is
    # SKIPPED (not blocked) — they stay in the queue and get called once they pay.
    def _is_paid(w) -> bool:
        if not w.appointment_id:
            return True
        a = db.get(Appointment, w.appointment_id)
        return (not a) or a.consultation_paid or float(a.consultation_fee or 0) <= 0

    nxt = next((w for w in waiting if _is_paid(w)), None)
    pending = sum(1 for w in waiting if not _is_paid(w))

    completed = None
    if cur:
        te.finish_serving(db, cur, me.user_id)  # complete the in-progress one
        completed = cur
    te.recompute_positions(db, doctor_id, on_date, affiliation_id)
    if nxt:
        te.start_serving(db, nxt, me.user_id)
        te.recompute_positions(db, doctor_id, on_date, affiliation_id)
    db.commit()
    if completed:
        db.refresh(completed)
    if nxt:
        db.refresh(nxt)
    if nxt:
        message = f"Called {nxt.display_code}" + (f" · {pending} skipped (payment pending)" if pending else "")
    elif pending:
        message = f"{pending} waiting, all with payment pending — collect to call them"
    else:
        message = "No more waiting tokens"
    return {
        "completed": _out(completed).model_dump() if completed else None,
        "current": _out(nxt).model_dump() if nxt else None,
        "skipped_pending": pending,
        "message": message,
    }


@router.post("/tokens/complete", response_model=TokenOut)
def complete(body: TokenIdRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    t = _token(db, body.token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    if t.status not in ("current", "waiting"):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot complete a {t.status} token")
    te.finish_serving(db, t, me.user_id)
    te.recompute_positions(db, t.doctor_id, t.token_date, t.affiliation_id)
    db.commit()
    db.refresh(t)
    return t


@router.post("/tokens/recall")
def recall(body: RecallRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    t = _token(db, body.token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    rec = te.record_recall(db, t, body.recall_method, me.user_id)
    te.log_movement(db, t, "recall", t.queue_position, t.queue_position, me.user_id, f"Recall #{rec.recall_count}")
    sent = _notify_patient(db, t, f"Token {t.display_code}: please proceed to the doctor.", "recall")
    db.commit()
    # Recall changes nothing visible in the queue, so without a message back the
    # desk cannot tell a delivered nudge from a patient with no phone on file.
    where = "app + SMS" if sent["sms"] else ("app only — no phone on file, call them by name"
                                             if sent["in_app"] else "not delivered")
    return {"token_id": t.token_id, "recall_count": rec.recall_count, "method": rec.recall_method,
            "notified": sent["sms"], "delivered_in_app": sent["in_app"],
            "message": f"Recalled {t.display_code} · {where} (recall #{rec.recall_count})"}


@router.post("/tokens/cancel", response_model=TokenOut)
def cancel(body: CancelTokenRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    t = _token(db, body.token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    # Only a token still in play can be cancelled. Without this a second press
    # — a double-click at a busy desk is enough — wrote another status-history
    # row, another movement-log entry and re-ran the renumbering, so the audit
    # trail showed a token "cancelled" twice, minutes apart, by whoever happened
    # to be logged in. `missed` and the appointment path already refuse this.
    if t.status not in ("waiting", "current"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This token is already {t.status} and cannot be cancelled.",
        )
    te.set_status(db, t, "cancelled", me.user_id, body.reason or "Cancelled")
    te.log_movement(db, t, "cancel", t.queue_position, None, me.user_id, body.reason)
    t.queue_position = 0
    # If the doctor was actually seeing this token, clear it from their console
    # too — otherwise their screen keeps showing a patient who has just been
    # cancelled. `missed` does this; `cancel` did not.
    doctor = db.get(Doctor, t.doctor_id)
    if doctor and doctor.presence and doctor.presence.current_token_id == t.token_id:
        doctor.presence.current_token_id = None
    te.recompute_positions(db, t.doctor_id, t.token_date, t.affiliation_id)
    db.commit()
    db.refresh(t)
    return t


@router.post("/tokens/missed", response_model=TokenOut)
def missed(body: TokenIdRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    t = _token(db, body.token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    te.set_status(db, t, "missed", me.user_id, "No-show")
    te.log_movement(db, t, "skip", t.queue_position, None, me.user_id, "Marked no-show")
    t.queue_position = 0
    doctor = db.get(Doctor, t.doctor_id)
    if doctor and doctor.presence and doctor.presence.current_token_id == t.token_id:
        doctor.presence.current_token_id = None
    te.recompute_positions(db, t.doctor_id, t.token_date, t.affiliation_id)
    db.commit()
    db.refresh(t)
    return t


@router.post("/tokens/skip", response_model=TokenOut)
def skip(body: SkipRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    t = _token(db, body.token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    if t.status != "waiting":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only waiting tokens can be skipped")
    frm = t.queue_position
    t.queue_position = 99999  # send to the back; recompute normalises
    te.log_movement(db, t, "skip", frm, None, me.user_id, body.reason or "Skipped to end")
    te.recompute_positions(db, t.doctor_id, t.token_date, t.affiliation_id)
    db.commit()
    db.refresh(t)
    return t


@router.post("/tokens/postpone", response_model=TokenOut)
def postpone(body: TokenIdRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    """Let one eligible patient go ahead without completing the current visit.

    `skip` cannot serve this case: it only accepts a `waiting` token, and the
    patient who has stepped out is `current`. Wiring the doctor's button to
    `skip` therefore returned 409 every single time.
    """
    t = _token(db, body.token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    te.lock_doctor_day(db, t.doctor_id, t.token_date)
    # A repeated click must not postpone the same visit twice.
    db.refresh(t, with_for_update=True)
    if t.status != "current":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only the current patient can let one patient go ahead")

    waiting = te.waiting_tokens(db, t.doctor_id, t.token_date, t.affiliation_id)
    nxt = None
    for candidate in waiting:
        appt = db.get(Appointment, candidate.appointment_id) if candidate.appointment_id else None
        # Match Call Next: unpaid consultations with a fee remain waiting.
        if not appt or appt.consultation_paid or float(appt.consultation_fee or 0) <= 0:
            nxt = candidate
            break
    if nxt is None:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "No eligible waiting patient to call. The current consultation has not changed.")

    te.postpone_serving(db, t, nxt, me.user_id)
    db.commit()
    db.refresh(t)
    return t


@router.post("/tokens/reorder")
def reorder(body: ReorderRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    doctor = _doctor(db, body.doctor_id, me)
    on_date = date_cls.today()
    by_id = {t.token_id: t for t in te.waiting_tokens(db, doctor.doctor_id, on_date)}
    for idx, tid in enumerate(body.token_ids, start=1):
        t = by_id.get(tid)
        if not t:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Token {tid} not in waiting queue")
        t.queue_position = idx
        te.log_movement(db, t, "reorder", None, idx, me.user_id, "Manual reorder")
    te.recompute_positions(db, doctor.doctor_id, on_date)
    db.commit()
    return {"reordered": len(body.token_ids), "queue": [_out(t).model_dump() for t in te.waiting_tokens(db, doctor.doctor_id, on_date)]}


@router.post("/tokens/bulk-cancel")
def bulk_cancel(body: BulkCancelRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    doctor = _doctor(db, body.doctor_id, me)
    on_date = body.date or date_cls.today()
    rows = db.scalars(
        select(Token).where(
            Token.doctor_id == doctor.doctor_id, Token.token_date == on_date,
            Token.status.in_(("waiting", "current")),
        )
    ).all()
    for t in rows:
        te.set_status(db, t, "cancelled", me.user_id, body.reason or "Bulk cancel")
        te.log_movement(db, t, "cancel", t.queue_position, None, me.user_id, "Bulk cancel")
        t.queue_position = 0
    if doctor.presence:
        doctor.presence.current_token_id = None
    db.commit()
    return {"cancelled": len(rows)}


@router.post("/tokens/notify")
def notify_token(body: NotifyRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    t = _token(db, body.token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    sent = _sms_patient(db, t, f"Token {t.display_code}: {body.message_type} update from your hospital.", body.message_type)
    db.commit()
    return {"token_id": t.token_id, "message_type": body.message_type, "sent": sent}


# ===================================================== Emergency ============
@router.post("/emergency", response_model=EmergencyOut, status_code=201)
def create_emergency(body: EmergencyCreate, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    doctor = _doctor(db, body.doctor_id, me)
    on_date = date_cls.today()
    patient = db.get(Patient, body.patient_id) if body.patient_id else None
    # Mint a high-priority token so the emergency enters the live queue at front.
    number = te.next_token_number(db, doctor.doctor_id, on_date)
    token = Token(
        doctor_id=doctor.doctor_id, patient_id=patient.patient_id if patient else None,
        hospital_id=doctor.hospital_id, token_number=number,
        display_code=te.make_display_code(db, doctor.hospital_id, number),
        token_date=on_date, status="waiting", priority="emergency",
        queue_position=0, is_walkin=True,
    )
    db.add(token)
    db.flush()
    te.set_status(db, token, "waiting", me.user_id, "Emergency token")
    eq = EmergencyQueue(
        hospital_id=doctor.hospital_id, doctor_id=doctor.doctor_id,
        patient_id=patient.patient_id if patient else None, token_id=token.token_id,
        patient_name=body.patient_name or (patient.name if patient else ""),
        patient_phone=body.patient_phone or (patient.phone if patient else None),
        condition_description=body.condition_description, priority=body.priority,
        status="waiting", logged_by=me.user_id,
    )
    db.add(eq)
    te.recompute_positions(db, doctor.doctor_id, on_date)
    audit.log_activity(db, me.user_id, "emergency.create", "token", {"doctor_id": doctor.doctor_id})
    db.commit()
    db.refresh(eq)
    return eq


@router.get("/emergency", response_model=list[EmergencyOut])
def list_emergency(hospital_id: UUID | None = Query(None), doctor_id: UUID | None = Query(None), me: User = Depends(require_permission("token", "read")), db: Session = Depends(get_db)):
    stmt = select(EmergencyQueue).where(EmergencyQueue.status.in_(("waiting", "attending")))
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(EmergencyQueue.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(EmergencyQueue.hospital_id == hospital_id)
    if doctor_id:
        stmt = stmt.where(EmergencyQueue.doctor_id == doctor_id)
    stmt = restrict(stmt, EmergencyQueue.doctor_id, db, me)
    return db.scalars(stmt.order_by(EmergencyQueue.emergency_id.desc())).all()


@router.post("/emergency/{emergency_id}/complete", response_model=EmergencyOut)
def complete_emergency(emergency_id: UUID, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    eq = db.get(EmergencyQueue, emergency_id)
    if not eq:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Emergency not found")
    ensure_same_tenant(me, eq.hospital_id)
    ensure_can_see_doctor(db, me, eq.doctor_id)
    eq.status = "completed"
    eq.completed_at = utcnow()
    if eq.token_id:
        token = db.get(Token, eq.token_id)
        if token and token.status not in ("completed", "cancelled"):
            te.finish_serving(db, token, me.user_id)
            te.recompute_positions(db, token.doctor_id, token.token_date, token.affiliation_id)
    db.commit()
    db.refresh(eq)
    return eq


# ===================================================== Item paths ==========
@router.get("/tokens/{token_id}", response_model=TokenOut)
def get_token(token_id: UUID, me: User = Depends(require_staff), db: Session = Depends(get_db)):
    t = _token(db, token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    return t


@router.put("/tokens/{token_id}/priority", response_model=TokenOut)
def set_priority(token_id: UUID, body: PriorityRequest, me: User = Depends(require_permission("token", "manage")), db: Session = Depends(get_db)):
    t = _token(db, token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    t.priority = body.new_priority
    te.log_movement(db, t, "reorder", t.queue_position, None, me.user_id, f"Priority → {body.new_priority}: {body.reason}")
    te.recompute_positions(db, t.doctor_id, t.token_date, t.affiliation_id)
    db.commit()
    db.refresh(t)
    return t


@router.get("/tokens/{token_id}/status-history", response_model=list[TokenStatusHistoryOut])
def token_status_history(token_id: UUID, me: User = Depends(require_staff), db: Session = Depends(get_db)):
    t = _token(db, token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    return db.scalars(select(TokenStatusHistory).where(TokenStatusHistory.token_id == token_id).order_by(TokenStatusHistory.history_id)).all()


@router.get("/tokens/{token_id}/movement-logs", response_model=list[MovementLogOut])
def token_movement_logs(token_id: UUID, me: User = Depends(require_staff), db: Session = Depends(get_db)):
    t = _token(db, token_id)
    ensure_same_tenant(me, t.hospital_id)
    ensure_can_see_doctor(db, me, t.doctor_id)
    return db.scalars(select(TokenMovementLog).where(TokenMovementLog.token_id == token_id).order_by(TokenMovementLog.log_id)).all()
