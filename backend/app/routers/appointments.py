"""
Module 6 — Appointment endpoints (15 APIs).

Booking is schedule-aware (validates the doctor consults that day and the slot
is free); reschedule/cancel keep full audit history. The actual queue *token* is
minted by the Token Engine (Phase 4) — here an appointment is the reservation.
"""
from uuid import UUID
import re
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db, parse_uuid, utcnow
from ..deps import ensure_same_tenant, get_current_user, require_permission, require_staff
from ..rbac import ROLE_DOCTOR, ROLE_PATIENT, is_hospital_staff
from ..models import (
    Appointment, ApptCancellationLog, ApptRescheduleHistory, ApptStatusHistory,
    Doctor, DoctorAffiliation, FamilyMember, FollowUp, Hospital, Patient, Token, User,
)
from ..models.appointment import RESCHEDULABLE_STATUSES
from ..schemas.appointment import (
    AppointmentCreate, AppointmentOut, AppointmentUpdate, CancellationOut,
    CancelRequest, CollectPaymentRequest, FeedbackRequest, RescheduleHistoryOut,
    RescheduleRequest, StatusHistoryOut, WalkInRequest,
)
from ..services import person_name
from ..services import family_link
from ..services import audit
from ..services import booking_quota as quota
from ..services import normalize
from ..services.hospital_location import hospital_practice_fields
from ..services.reception_scope import can_see_doctor, ensure_can_see_doctor, restrict
from ..services import reachability as reach
from ..services import revisit_pass as rp
from ..services import session_cancellation
from ..services import scheduling as sch
from ..services import token_engine as te
from ..services import uhid as uhid_service

router = APIRouter(prefix="/appointments", tags=["appointments"])


# ---- helpers ----
def _attach_family_names(db: Session, appts: list[Appointment]) -> list[Appointment]:
    """Tag each appointment with the dependent's name when it was booked for one,
    so lists can show 'for <member>' instead of just the account holder."""
    ids = {a.family_member_id for a in appts if a.family_member_id}
    if not ids:
        return appts
    members = {m.member_id: m.name for m in db.scalars(select(FamilyMember).where(FamilyMember.member_id.in_(ids)))}
    for a in appts:
        if a.family_member_id:
            a.family_member_name = members.get(a.family_member_id)
    return appts


def _appt(db: Session, appointment_id: UUID) -> Appointment:
    a = db.get(Appointment, appointment_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
    return a


def _assert_access(me: User, appt: Appointment, db: Session) -> None:
    if me.role and me.role.name == "PATIENT":
        if not appt.patient or appt.patient.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your appointment")
    else:
        ensure_same_tenant(me, appt.hospital_id)
        ensure_can_see_doctor(db, me, appt.doctor_id)   # receptionist: her doctors only


def _set_status(db: Session, appt: Appointment, new_status: str, by: int | None, reason: str = "") -> None:
    db.add(ApptStatusHistory(
        appointment_id=appt.appointment_id, old_status=appt.status,
        new_status=new_status, changed_by=by, reason=reason,
    ))
    appt.status = new_status


def _require_doctor(db: Session, doctor_id: UUID) -> Doctor:
    d = db.get(Doctor, doctor_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor not found")
    return d


def _hide_personal(stmt, me: User):
    """For hospital front-desk roles, drop a doctor's *personal* practice rows so
    the hospital console only ever sees its own (hospital-managed) appointments.
    Appointments with no affiliation are legacy hospital bookings → kept."""
    if not is_hospital_staff(me.role.name if me.role else None):
        return stmt
    return stmt.outerjoin(
        DoctorAffiliation, Appointment.affiliation_id == DoctorAffiliation.affiliation_id
    ).where(
        or_(
            Appointment.affiliation_id.is_(None),
            DoctorAffiliation.managed_by_hospital.is_(True),
        )
    )


def _default_affiliation(db: Session, doctor: Doctor) -> DoctorAffiliation:
    # A self-registered doctor owns a personal-hospital affiliation with no
    # hospital_id. Walk-in requests from their dashboard intentionally omit an
    # affiliation picker because they have exactly one registered hospital; use
    # that row instead of manufacturing a hospital-managed "Hospital" row whose
    # id can never match their saved availability.
    if doctor.is_self_registered:
        own_aff = db.scalar(
            select(DoctorAffiliation).where(
                DoctorAffiliation.doctor_id == doctor.doctor_id,
                DoctorAffiliation.is_active.is_(True),
                DoctorAffiliation.managed_by_hospital.is_(False),
            ).order_by(DoctorAffiliation.affiliation_id)
        )
        if own_aff:
            return own_aff
    aff = db.scalar(
        select(DoctorAffiliation).where(
            DoctorAffiliation.doctor_id == doctor.doctor_id,
            DoctorAffiliation.hospital_id == doctor.hospital_id,
            DoctorAffiliation.practice_type == "hospital",
        )
    )
    if aff:
        return aff
    # Inherit the hospital's address AND map pin. This used to mint a bare row
    # named "Hospital" with no location, so a doctor whose affiliation was first
    # created here — by a booking, not by the hospital console — ended up with a
    # practice patients could not place on a map or measure travel time to.
    # Same fields the doctors router and hospital_location.sync use.
    hospital = db.get(Hospital, doctor.hospital_id) if doctor.hospital_id else None
    place = hospital_practice_fields(hospital) if hospital else {"name": "Hospital"}
    aff = DoctorAffiliation(
        doctor_id=doctor.doctor_id,
        hospital_id=doctor.hospital_id,
        practice_type="hospital",
        consultation_fee=doctor.consultation_fee,
        mode="slot",
        managed_by_hospital=True,
        **place,
    )
    db.add(aff)
    db.flush()
    return aff


def _resolve_affiliation(db: Session, doctor: Doctor, affiliation_id: UUID | None) -> DoctorAffiliation:
    # A suspended doctor or hospital (Super Admin, services/suspension.py) takes no
    # bookings. Checked here because every booking path passes through this, and
    # _default_affiliation can mint a practice row that the suspension never saw.
    if doctor.status == "suspended":
        raise HTTPException(status.HTTP_409_CONFLICT, (doctor.name if re.match(r"(?i)dr\.?\s", doctor.name or "") else f"Dr. {doctor.name}") + " is not taking appointments on TapCure right now.")
    if affiliation_id is None:
        aff = _default_affiliation(db, doctor)
    else:
        aff = db.get(DoctorAffiliation, affiliation_id)
        if not aff or aff.doctor_id != doctor.doctor_id or not aff.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor practice location not found")
    hospital = db.get(Hospital, aff.hospital_id) if aff.hospital_id else None
    if hospital and hospital.status == "suspended":
        raise HTTPException(status.HTTP_409_CONFLICT, f"{hospital.name} is not taking appointments on TapCure right now.")
    return aff


# ===================================================== Collection ===========
def _as_date(value: str, field: str) -> date:
    """Parse a YYYY-MM-DD filter, refusing junk rather than silently ignoring it."""
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid {field} (expected YYYY-MM-DD)")


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    hospital_id: UUID | None = Query(None),
    doctor_id: UUID | None = Query(None),
    patient_id: UUID | None = Query(None),
    appointment_date: str | None = Query(None, alias="date"),
    # A range, for screens that work a window rather than a single day — the
    # front desk's upcoming list runs today → +30 days. `date` still pins one day.
    date_from: str | None = Query(None, description="YYYY-MM-DD, inclusive"),
    date_to: str | None = Query(None, description="YYYY-MM-DD, inclusive"),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission("appointment", "read")),
    db: Session = Depends(get_db),
):
    stmt = select(Appointment)
    role = me.role.name if me.role else None
    is_patient = role == ROLE_PATIENT
    if role == "SUPER_ADMIN":
        if hospital_id:
            stmt = stmt.where(Appointment.hospital_id == hospital_id)
    elif not is_patient:
        stmt = stmt.where(Appointment.hospital_id == me.hospital_id)
    if doctor_id:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if is_patient:
        # A patient's own rows, plus visits booked FOR them under a family
        # account they are confirmed to be. Derived from the token rather than
        # the `patient_id` query param, so one patient cannot read another's
        # list by passing an id — and the pair of conditions is already tight
        # enough that the tenant filter above would only get in the way (a
        # dependent's hospital need not be their own).
        own = select(Patient.patient_id).where(Patient.user_id == me.user_id)
        stmt = stmt.where(family_link.visible_condition(db, me, Appointment, own))
    elif patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if appointment_date:
        stmt = stmt.where(Appointment.appointment_date == appointment_date)
    if date_from:
        stmt = stmt.where(Appointment.appointment_date >= _as_date(date_from, "date_from"))
    if date_to:
        stmt = stmt.where(Appointment.appointment_date <= _as_date(date_to, "date_to"))
    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)
    stmt = _hide_personal(stmt, me)
    stmt = restrict(stmt, Appointment.doctor_id, db, me)   # receptionist: her doctors only
    # A forward-looking window reads best oldest-first — the next patient due is
    # the one the desk acts on. A single day or an open-ended query keeps the
    # newest-first ordering the history views rely on.
    ascending = bool(date_from) and not appointment_date
    order = (
        (Appointment.appointment_date.asc(), Appointment.slot_time.asc(), Appointment.appointment_id.asc())
        if ascending
        else (Appointment.appointment_date.desc(), Appointment.appointment_id.desc())
    )
    appts = db.scalars(stmt.order_by(*order).offset((page - 1) * size).limit(size)).all()
    return _attach_family_names(db, list(appts))


def quote_fee(db: Session, body: AppointmentCreate) -> float:
    """The booking fee for a prospective appointment (affiliation fee, else the
    doctor's). Used by the payment flow to know how much to charge."""
    doctor = _require_doctor(db, body.doctor_id)
    aff = _resolve_affiliation(db, doctor, body.affiliation_id)
    return float(aff.consultation_fee or doctor.consultation_fee or 0)


def _assert_day_open(db: Session, doctor: Doctor, aff: DoctorAffiliation, body: AppointmentCreate) -> None:
    """Refuse a day the doctor isn't actually consulting (leave / holiday / no
    session that weekday / fully booked), and a slot outside their sessions.

    A date that has already gone is refused here too, before any of that. It
    used to be accepted: a QA run booked a visit for yesterday and got a 201.
    Nothing breaks visibly, which is why it survived — the damage is quiet. A
    visit "booked" for a day already past can never be attended, so it becomes a
    no-show in the doctor's figures, sits in the revenue report, and lands in
    the follow-up lists. Every booking path (the API, the payment order, the
    walk-in desk and the voice flow) reaches this function, so one check here
    covers all of them.
    """
    if body.appointment_date < date.today():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That date has already passed. Please choose today or a later date.",
        )
    avail = sch.available_slots(db, doctor, body.appointment_date, aff.affiliation_id)
    if not avail["available"]:
        raise HTTPException(status.HTTP_409_CONFLICT, avail["reason"] or "No slots available")
    if body.slot_time is not None:
        if sch.schedule_for_slot(doctor, body.appointment_date, body.slot_time, aff.affiliation_id) is None:
            raise HTTPException(status.HTTP_409_CONFLICT, "Requested slot is outside the doctor's sessions")
        now = sch.ist_now()
        if body.appointment_date == now.date() and body.slot_time < now.time():
            raise HTTPException(status.HTTP_409_CONFLICT, "That time has already passed. Please choose a later time.")
        if body.slot_time in sch.booked_times(db, doctor.doctor_id, body.appointment_date, aff.affiliation_id):
            raise HTTPException(status.HTTP_409_CONFLICT, "Slot already booked")


def assert_bookable(db: Session, body: AppointmentCreate) -> tuple[Doctor, DoctorAffiliation]:
    """Resolve the doctor + practice and prove the requested day is bookable.

    Called by the payment-order endpoint as well as by `create_booking`. The
    booking fee is charged BEFORE the appointment row exists, so without this the
    patient pays in full and only then hears "Doctor on leave" — which is exactly
    what happened on the voice-booking flow.
    """
    doctor = _require_doctor(db, body.doctor_id)
    aff = _resolve_affiliation(db, doctor, body.affiliation_id)
    _assert_day_open(db, doctor, aff, body)
    return doctor, aff


def assert_reachable(db: Session, doctor: Doctor, aff: DoctorAffiliation, body: AppointmentCreate) -> None:
    """Refuse a booking the patient cannot physically reach in time.

    A booking that cannot be kept costs the hospital a held slot and the patient a
    wasted journey, so this raises rather than warns.

    There is deliberately NO override: an override the app can set is not a
    block, and one the patient can click is the warning we already had. The
    safety property is narrower instead — this can only fire when the request
    carried an origin, which today means the patient app. Front-desk, walk-in
    and staff bookings send none and are never affected.

    Called from create_booking AND from the payment-order route, so a patient is
    never charged the booking fee for a visit we are about to refuse.
    """
    # Token bookings carry no slot_time, so the deadline is the hospital closing,
    # i.e. the end of the last session that day.
    deadline, kind = body.slot_time, "slot"
    if deadline is None:
        sessions = sch.active_schedules(doctor, body.appointment_date, aff.affiliation_id)
        if sessions:
            deadline, kind = max(s.end_time for s in sessions), "closing"
    verdict = reach.assess(
        db, hospital_id=aff.hospital_id or doctor.hospital_id,
        affiliation_id=aff.affiliation_id, on_date=body.appointment_date,
        slot_time=deadline, origin_lat=body.origin_lat,
        origin_lng=body.origin_lng, travel_minutes=body.travel_minutes,
        deadline_kind=kind,
    )
    if verdict and not verdict["reachable"]:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={
            "code": "unreachable_slot",
            "message": reach.describe(verdict, aff.name or "This hospital"),
            **verdict,
        })


def _travel_annotations(db: Session, doctor: Doctor, aff, on_date, slots: list, origin_lat, origin_lng) -> dict:
    """Tag each slot with whether the patient can still get there, plus a summary.

    Returns `{}` — i.e. changes nothing — unless an origin was supplied AND the
    practice has a map pin. One travel lookup is done for the whole day and
    reused per slot; asking a routing provider once per slot would be slow and
    would burn the free quota for no extra accuracy.
    """
    if origin_lat is None or origin_lng is None:
        return {}
    hospital_id = aff.hospital_id or doctor.hospital_id
    dest = te.practice_coords(db, aff.affiliation_id, hospital_id)
    if dest is None:
        return {}
    minutes = te.travel_minutes_between(float(origin_lat), float(origin_lng), dest[0], dest[1])

    # Day-level verdict: can they make it AT ALL on this date — i.e. arrive
    # before the hospital closes? Token bookings have no slot to check, and this
    # is what the booking screen needs mid-flow: waiting until submit means
    # telling someone their trip is impossible only after they've filled in the
    # whole form and expect a token.
    day = None
    sessions = sch.active_schedules(doctor, on_date, aff.affiliation_id)
    if sessions:
        closing = max(session.end_time for session in sessions)
        verdict = reach.assess(
            db, hospital_id=hospital_id, affiliation_id=aff.affiliation_id,
            on_date=on_date, slot_time=closing, origin_lat=origin_lat,
            origin_lng=origin_lng, travel_minutes=minutes, deadline_kind="closing",
        )
        if verdict:
            day = {**verdict, "message": reach.describe(verdict, aff.name or "This hospital")}

    first_reachable = None
    for slot in slots:
        try:
            slot_time = datetime.strptime(slot["time"], "%H:%M").time()
        except (KeyError, ValueError):
            continue
        verdict = reach.assess(
            db, hospital_id=hospital_id, affiliation_id=aff.affiliation_id,
            on_date=on_date, slot_time=slot_time,
            origin_lat=origin_lat, origin_lng=origin_lng, travel_minutes=minutes,
        )
        if not verdict:
            continue
        slot["reachable"] = verdict["reachable"]
        slot["leave_by"] = verdict["leave_by"]
        if verdict["reachable"] and first_reachable is None:
            first_reachable = slot["time"]
    return {"travel": {
        "minutes": minutes,
        "first_reachable_slot": first_reachable,
        "any_reachable": first_reachable is not None,
        "day": day,
    }}


def booking_hospital_id(db: Session, body: AppointmentCreate) -> int | None:
    """Which hospital a prospective booking will belong to.

    `create_booking` derives it as `affiliation.hospital_id or doctor.hospital_id`
    — a solo doctor's personal practice has no hospital of its own, so it falls
    back to their anchor tenant. Anything that needs to reason about the booking
    BEFORE it exists (the payment step, the free-rebook credit) has to resolve it
    the same way, or it will look at the wrong hospital.
    """
    doctor = db.get(Doctor, body.doctor_id)
    if not doctor:
        return None
    aff = db.get(DoctorAffiliation, body.affiliation_id) if body.affiliation_id else None
    return (aff.hospital_id if aff else None) or doctor.hospital_id


def _claim_follow_up(db: Session, appt: Appointment, patient_id: UUID, doctor_id: UUID,
                     family_member_id: UUID | None) -> None:
    """Mark the pending follow-up this visit satisfies as booked, and link it.

    Called from BOTH arrival routes. It used to live only in the app-booking
    path, so a follow-up patient who simply walked up to the desk — how most
    people actually return at these hospitals — left their follow-up pending
    forever and kept being nagged for a visit they'd already made.

    Soonest-due first; `== None` becomes `IS NULL`, which is what matches a
    visit for the account holder rather than a dependent.
    """
    fu = db.scalar(
        select(FollowUp).where(
            FollowUp.patient_id == patient_id,
            FollowUp.doctor_id == doctor_id,
            FollowUp.family_member_id == family_member_id,
            FollowUp.status == "pending",
        ).order_by(FollowUp.due_date)
    )
    if fu:
        fu.status = "booked"
        fu.booked_appointment_id = appt.appointment_id

def create_booking(db: Session, me: User, body: AppointmentCreate, booking_fee_paid: float = 0) -> Appointment:
    """Validate + create an appointment and mint its queue token. Shared by the
    direct booking endpoint and the post-payment confirmation. Commits."""
    doctor = _require_doctor(db, body.doctor_id)
    aff = _resolve_affiliation(db, doctor, body.affiliation_id)
    patient = db.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    is_patient = bool(me.role and me.role.name == ROLE_PATIENT)
    if is_patient:
        # Global patient: may book at ANY active hospital. The appointment takes
        # the doctor's hospital, so no same-tenant / same-hospital constraint —
        # only that they're booking for their own profile.
        if patient.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Can only book for your own profile")
        # A patient's own booking is always an online one. source and
        # appointment_type come from the client, and "phone" / "walkin" /
        # "emergency" would skip the online-booking cutoff (pilot over, plan
        # suspended, bill 15 days unpaid) and the monthly booking quota.
        if body.source not in quota.REMOTE_SOURCES:
            body.source = "app"
        if body.appointment_type in ("walkin", "emergency"):
            body.appointment_type = "online"
    else:
        ensure_same_tenant(me, aff.hospital_id)
        ensure_can_see_doctor(db, me, doctor.doctor_id)
        if is_hospital_staff(me.role.name if me.role else None) and not aff.managed_by_hospital:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Hospital staff cannot book on a doctor's personal practice")
        # NOTE: no patient-vs-doctor hospital check. Patients are "global" — one
        # anchored to hospital A may be booked with a doctor at hospital B; the
        # appointment takes the doctor's hospital and the patient then shows up
        # in hospital B's list (see patients._at_hospital). Staff are still confined
        # to the doctor's hospital by ensure_same_tenant above.

    hospital_id = aff.hospital_id or doctor.hospital_id
    online = body.source in quota.REMOTE_SOURCES and body.appointment_type != "walkin"
    if online:
        # Pilot over without a paid plan (or plan suspended): online booking is
        # off, walk-ins at the desk keep working.
        open_, reason = quota.remote_booking_open(db, hospital_id)
        if not open_:
            raise HTTPException(status.HTTP_403_FORBIDDEN, reason)

    _assert_day_open(db, doctor, aff, body)
    assert_reachable(db, doctor, aff, body)

    # From here to the commit no other booking for this doctor + day can run, so
    # the availability check and the token number see each other's rows. Checked
    # again under the lock: the check above may have raced a booking that
    # committed while travel time was being worked out (kept outside the lock —
    # it can call an external maps API).
    te.lock_doctor_day(db, doctor.doctor_id, body.appointment_date)
    _assert_day_open(db, doctor, aff, body)

    # Free revisit: the patient earned a no-charge return with THIS doctor. The
    # pass is meant to be walked in, but nothing stops them booking normally, and
    # charging them for a visit they already own is the version of this bug that
    # reaches a complaint. Resolved BEFORE the row is built so the fee is right
    # the first time — never written full and corrected afterwards, because
    # `tokens.py` reads the fee to decide who may be called next.
    #
    # The visit must fall INSIDE the window, not merely be booked inside it:
    # booking on the 1st for the 20th when the pass dies on the 5th is a normal
    # paid visit.
    pass_row = rp.active_pass(db, patient.patient_id, doctor.doctor_id, body.family_member_id)
    if pass_row is not None and body.appointment_date > pass_row.valid_until:
        pass_row = None
    fee = 0 if pass_row is not None else (aff.consultation_fee or doctor.consultation_fee)

    appt = Appointment(
        hospital_id=aff.hospital_id or doctor.hospital_id, doctor_id=doctor.doctor_id, affiliation_id=aff.affiliation_id, patient_id=patient.patient_id,
        family_member_id=body.family_member_id, appointment_date=body.appointment_date,
        slot_time=body.slot_time, appointment_type=body.appointment_type, status="scheduled",
        consultation_fee=fee, booking_fee_paid=booking_fee_paid,
        # Voice bookings carry the spoken complaint as the note, in the patient's
        # own script (Telugu/Hindi). Translate it to English so hospital staff and
        # the doctor can read it; a no-op when the note is already Latin/English.
        notes=normalize.to_english_text(body.notes), source=body.source, booked_by=me.user_id,
        origin_lat=body.origin_lat, origin_lng=body.origin_lng,
        origin_label=body.origin_label, travel_minutes=body.travel_minutes,
    )
    db.add(appt)
    db.flush()

    if pass_row is not None:
        # Zero fee, and marked PAID — not "unpaid at ₹0". `routers/tokens.py`
        # skips unpaid patients when calling the next token, and a free visit
        # sitting in the queue being passed over silently is the exact failure
        # the walk-in redeem path was written to avoid.
        appt.consultation_paid = True
        appt.consultation_paid_at = utcnow()
        rp.redeem(db, pass_row, appt.appointment_id, me.user_id)

    _claim_follow_up(db, appt, patient.patient_id, doctor.doctor_id, body.family_member_id)

    # Spend the free rebooking, if they hold one (their previous visit was
    # cancelled by us when a doctor's session was removed). Done HERE rather
    # than at checkout so an abandoned payment screen doesn't burn the credit.
    if not booking_fee_paid:
        # No hospital_id: the credit is redeemable at any hospital with any doctor.
        session_cancellation.spend_credit(db, patient.patient_id, appt.appointment_id)

    _set_status(db, appt, "scheduled", me.user_id, "Booked")
    # Allocate the queue token immediately so the patient sees it (and their
    # estimated start / leave-by) on the dashboard without waiting on the hospital.
    te.allocate_token(db, appt, me.user_id)
    audit.log_activity(db, me.user_id, "appointment.book", "appointment", {"appointment_id": appt.appointment_id})
    db.commit()
    if online:
        # Tell the hospital admin at 80% and when the free bookings run out. The
        # booking is already saved; a failure here must not undo it.
        try:
            quota.after_booking(db, hospital_id)
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
    db.refresh(appt)
    return appt


@router.post("", response_model=AppointmentOut, status_code=201)
def book(body: AppointmentCreate, me: User = Depends(require_permission("appointment", "create")), db: Session = Depends(get_db)):
    return create_booking(db, me, body)


# ===================================================== Static paths =========
@router.get("/available-slots")
def available_slots(doctor_id: UUID = Query(...), date: str = Query(..., description="YYYY-MM-DD"),
                    affiliation_id: UUID | None = Query(None),
                    origin_lat: float | None = Query(None, description="Where the patient travels FROM"),
                    origin_lng: float | None = Query(None),
                    me: User = Depends(require_permission("appointment", "read")), db: Session = Depends(get_db)):
    doctor = _require_doctor(db, doctor_id)
    aff = _resolve_affiliation(db, doctor, affiliation_id)
    if not (me.role and me.role.name == ROLE_PATIENT):
        ensure_same_tenant(me, aff.hospital_id)
        ensure_can_see_doctor(db, me, doctor.doctor_id)
    try:
        on_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid date (YYYY-MM-DD)")
    res = sch.available_slots(db, doctor, on_date, aff.affiliation_id)
    out = {"doctor_id": doctor_id, "affiliation_id": aff.affiliation_id, "date": date, **res,
           "slot_count": len(res["slots"])}
    # Travel awareness is PURELY ADDITIVE: `slots` keeps its existing shape, and
    # a caller that sends no origin gets byte-identical output to before. Only
    # the new keys below appear, and only when we can actually work them out.
    out.update(_travel_annotations(db, doctor, aff, on_date, res.get("slots") or [], origin_lat, origin_lng))
    return out


@router.get("/next-available-dates")
def next_available_dates(
    doctor_id: UUID = Query(...),
    from_date: str = Query(..., alias="from", description="YYYY-MM-DD"),
    days: int = Query(21, ge=1, le=60, description="How far ahead to look"),
    limit: int = Query(3, ge=1, le=10),
    affiliation_id: UUID | None = Query(None),
    me: User = Depends(require_permission("appointment", "read")),
    db: Session = Depends(get_db),
):
    """The doctor's next open days AFTER `from` — what to offer a patient whose
    chosen day turned out to be a leave / holiday / non-consulting day."""
    doctor = _require_doctor(db, doctor_id)
    aff = _resolve_affiliation(db, doctor, affiliation_id)
    if not (me.role and me.role.name == ROLE_PATIENT):
        ensure_same_tenant(me, aff.hospital_id)
        ensure_can_see_doctor(db, me, doctor.doctor_id)
    start = max(_as_date(from_date, "from"), date.today())
    found: list[dict] = []
    for offset in range(1, days + 1):
        day = start + timedelta(days=offset)
        res = sch.available_slots(db, doctor, day, aff.affiliation_id)
        if res["available"]:
            found.append({
                "date": day.isoformat(),
                "weekday": sch.weekday_of(day),
                "slot_count": len(res["slots"]),
            })
            if len(found) >= limit:
                break
    return {
        "doctor_id": doctor_id, "affiliation_id": aff.affiliation_id,
        "from": start.isoformat(), "days_searched": days, "dates": found,
    }


@router.get("/day-availability")
def day_availability(
    doctor_ids: str = Query(..., description="Comma-separated doctor ids"),
    on_date: str = Query(..., alias="date", description="YYYY-MM-DD"),
    me: User = Depends(require_permission("appointment", "read")),
    db: Session = Depends(get_db),
):
    """Which of these doctors actually consult on `date`. Powers the "or would
    you like another doctor?" fallback, in one round trip instead of one call
    per doctor."""
    ids: list[UUID] = []
    for part in doctor_ids.split(","):
        value = parse_uuid(part)
        if value is not None and value not in ids:
            ids.append(value)
    if not ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "doctor_ids must list at least one id")
    day = _as_date(on_date, "date")
    is_patient = bool(me.role and me.role.name == ROLE_PATIENT)
    is_super = bool(me.role and me.role.name == "SUPER_ADMIN")

    out = []
    for doctor_id in ids[:25]:
        doctor = db.get(Doctor, doctor_id)
        if not doctor:
            continue
        # Patients are global and may look at any hospital's doctors; staff only
        # see their own tenant's, so an out-of-tenant id is skipped, not an error.
        if not (is_patient or is_super) and doctor.hospital_id != me.hospital_id:
            continue
        if not can_see_doctor(db, me, doctor_id):   # receptionist: her doctors only
            continue
        aff = db.scalar(
            select(DoctorAffiliation).where(
                DoctorAffiliation.doctor_id == doctor_id,
                DoctorAffiliation.is_active.is_(True),
            ).order_by(DoctorAffiliation.affiliation_id)
        )
        res = sch.available_slots(db, doctor, day, aff.affiliation_id if aff else None)
        out.append({
            "doctor_id": doctor_id,
            "affiliation_id": aff.affiliation_id if aff else None,
            "available": bool(res["available"]),
            "reason": res["reason"],
            "slot_count": len(res["slots"]),
        })
    return {"date": day.isoformat(), "doctors": out}


@router.get("/today", response_model=list[AppointmentOut])
def today_for_doctor(doctor_id: UUID = Query(...), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    doctor = _require_doctor(db, doctor_id)
    ensure_same_tenant(me, doctor.hospital_id)
    ensure_can_see_doctor(db, me, doctor_id)
    stmt = _hide_personal(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id, Appointment.appointment_date == date.today()
        ),
        me,
    )
    return _attach_family_names(db, list(db.scalars(stmt.order_by(Appointment.slot_time)).all()))


@router.get("/upcoming", response_model=list[AppointmentOut])
def upcoming_for_patient(patient_id: UUID = Query(...), days_ahead: int = Query(30, ge=1, le=365),
                         me: User = Depends(require_permission("appointment", "read")), db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    if me.role and me.role.name == "PATIENT" and patient.user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your profile")
    elif not (me.role and me.role.name == "PATIENT"):
        ensure_same_tenant(me, patient.hospital_id)
    horizon = date.today() + timedelta(days=days_ahead)
    stmt = select(Appointment).where(
        Appointment.patient_id == patient_id,
        Appointment.appointment_date >= date.today(),
        Appointment.appointment_date <= horizon,
        Appointment.status.in_(("scheduled", "confirmed", "in_progress")),
    )
    stmt = restrict(stmt, Appointment.doctor_id, db, me)   # receptionist: her doctors only
    appts = db.scalars(stmt.order_by(Appointment.appointment_date)).all()
    return _attach_family_names(db, list(appts))


@router.get("/cancellations", response_model=list[CancellationOut])
def cancellation_report(hospital_id: UUID | None = Query(None), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    stmt = select(ApptCancellationLog).join(Appointment, Appointment.appointment_id == ApptCancellationLog.appointment_id)
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(Appointment.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(Appointment.hospital_id == hospital_id)
    stmt = _hide_personal(stmt, me)
    stmt = restrict(stmt, Appointment.doctor_id, db, me)
    return db.scalars(stmt.order_by(ApptCancellationLog.log_id.desc())).all()


@router.post("/reschedule", response_model=AppointmentOut)
def reschedule(body: RescheduleRequest, me: User = Depends(require_permission("appointment", "update")), db: Session = Depends(get_db)):
    appt = _appt(db, body.appointment_id)
    _assert_access(me, appt, db)
    # The patient UI only offers Reschedule on upcoming, active visits — but the
    # API must not depend on a hidden button. Reopening a finished visit would
    # flip its token back to `waiting` and drop an already-seen patient into the
    # doctor's live queue. Applies to staff too: this is data integrity, not
    # permission. To correct a finished visit, cancel and book again.
    if appt.status not in RESCHEDULABLE_STATUSES:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A {appt.status.replace('_', ' ')} appointment can't be rescheduled.",
        )
    if body.new_date < date.today():
        raise HTTPException(status.HTTP_409_CONFLICT, "Pick a date from today onwards.")
    # Cancellation & Refund Policy §5: "One free reschedule may be allowed,
    # depending on the hospital's policy." Only the PATIENT is limited — reception
    # and doctors must stay free to move visits when a doctor goes on leave, and
    # reschedule_count already ignores staff-initiated moves.
    if me.role and me.role.name == ROLE_PATIENT:
        allowed = appt.reschedules_allowed
        if appt.reschedule_count >= allowed:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"This appointment has already used its {allowed} free "
                f"reschedule{'s' if allowed != 1 else ''}. Please cancel and book a new token.",
            )
    doctor = db.get(Doctor, appt.doctor_id)
    # One booking at a time on the day being moved INTO, until the commit — the
    # slot check below and the new token number must not race another booking.
    te.lock_doctor_day(db, appt.doctor_id, body.new_date)
    avail = sch.available_slots(db, doctor, body.new_date, appt.affiliation_id)
    if not avail["available"]:
        raise HTTPException(status.HTTP_409_CONFLICT, avail["reason"] or "No slots on the new date")
    if body.new_time in sch.booked_times(db, doctor.doctor_id, body.new_date, appt.affiliation_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Slot already booked")
    old_date = appt.appointment_date
    db.add(ApptRescheduleHistory(
        appointment_id=appt.appointment_id, old_date=appt.appointment_date, old_time=appt.slot_time,
        new_date=body.new_date, new_time=body.new_time, rescheduled_by=me.user_id, reason=body.reason,
    ))
    appt.appointment_date = body.new_date
    appt.slot_time = body.new_time
    _set_status(db, appt, "scheduled", me.user_id, "Rescheduled")
    # The queue token has its own date — move it too, or the patient arrives on
    # the new day with a token that isn't in that day's queue.
    te.move_token(db, appt, me.user_id, old_date)
    db.commit()
    db.refresh(appt)
    return appt


@router.post("/cancel", response_model=AppointmentOut)
def cancel(body: CancelRequest, me: User = Depends(require_permission("appointment", "update")), db: Session = Depends(get_db)):
    return _do_cancel(db, me, body.appointment_id, body.reason)


@router.post("/{appointment_id}/collect-payment", response_model=AppointmentOut)
def collect_consultation_payment(
    appointment_id: UUID,
    body: CollectPaymentRequest,
    me: User = Depends(require_permission("appointment", "update")),
    db: Session = Depends(get_db),
):
    """Record the in-person consultation fee as paid (reception or doctor). This
    is what unlocks the patient to be called as the next token."""
    appt = _appt(db, appointment_id)
    # Patients hold appointment.update so they can reschedule/cancel their own
    # visit — but this endpoint marks money as collected at the desk, and
    # ensure_same_tenant() is deliberately a no-op for them. Without this guard a
    # patient could mark their own consultation paid without paying.
    if me.role and me.role.name == ROLE_PATIENT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only hospital staff can record an in-hospital payment")
    ensure_same_tenant(me, appt.hospital_id)
    ensure_can_see_doctor(db, me, appt.doctor_id)
    appt.consultation_paid = True
    appt.consultation_payment_method = body.method
    appt.consultation_paid_at = utcnow()
    appt.consultation_paid_by = me.user_id
    audit.log_activity(db, me.user_id, "appointment.collect_payment", "appointment", {"appointment_id": appointment_id, "method": body.method})
    db.commit()
    db.refresh(appt)
    return appt


@router.post("/walk-in", response_model=AppointmentOut, status_code=201)
def walk_in(body: WalkInRequest, me: User = Depends(require_permission("appointment", "create")), db: Session = Depends(get_db)):
    doctor = _require_doctor(db, body.doctor_id)
    if me.role and me.role.name == ROLE_DOCTOR:
        own_doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
        if not own_doctor or own_doctor.doctor_id != doctor.doctor_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only register your own walk-ins")
        if not own_doctor.is_self_registered:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Hospital-added doctors must use the hospital front desk for walk-ins")
    aff = _resolve_affiliation(db, doctor, body.affiliation_id)
    ensure_same_tenant(me, aff.hospital_id)
    ensure_can_see_doctor(db, me, doctor.doctor_id)
    if is_hospital_staff(me.role.name if me.role else None) and not aff.managed_by_hospital:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Hospital staff cannot register walk-ins on a doctor's personal practice")
    # Doctor must actually be consulting today — block walk-ins when they're on
    # holiday/leave or don't consult on this weekday. (Fully-booked is fine:
    # walk-ins join the live queue beyond the bookable slots.)
    today = date.today()
    if sch.is_on_holiday(doctor, today):
        raise HTTPException(status.HTTP_409_CONFLICT, "Doctor is on holiday today — walk-in not allowed.")
    if sch.is_on_leave(db, doctor, today):
        raise HTTPException(status.HTTP_409_CONFLICT, "Doctor is on leave today — walk-in not allowed.")
    sessions = sch.active_schedules(doctor, today, aff.affiliation_id)
    if not sessions:
        has_any_schedule = any(
            schedule.is_active and (
                schedule.affiliation_id is None or schedule.affiliation_id == aff.affiliation_id
            )
            for schedule in doctor.schedules
        )
        detail = (
            "No availability is configured yet. Add your hospital hours in My Availability before accepting walk-ins."
            if not has_any_schedule
            else "No hospital hours are configured for today. Add today's hours in My Availability before accepting walk-ins."
        )
        raise HTTPException(status.HTTP_409_CONFLICT, detail)
    # Pre-opening registration is allowed: patients can receive their token
    # before the doors open. Allocation closes after the final session ends.
    now_local = datetime.now(timezone(timedelta(hours=5, minutes=30))).time().replace(tzinfo=None)
    if all(now_local > session.end_time for session in sessions):
        raise HTTPException(status.HTTP_409_CONFLICT, "Today's hospital hours have ended - token allocation is closed.")
    # Find-or-create the patient by phone within the doctor's hospital.
    patient = db.scalar(select(Patient).where(Patient.hospital_id == (aff.hospital_id or doctor.hospital_id), Patient.phone == body.phone))
    if not patient:
        patient = Patient(hospital_id=aff.hospital_id or doctor.hospital_id, name=body.name, **person_name.parts(body), phone=body.phone,
                          gender=body.gender, blood_group=body.blood_group or None,
                          city=(body.city or "").strip(),
                          registration_source="walkin", uhid=uhid_service.allocate(db))
        db.add(patient)
        db.flush()
    else:
        # Returning patient: fill in what the desk just learned, but never
        # overwrite what the record already holds — the visit shouldn't silently
        # rewrite a patient's demographics.
        if body.gender and not patient.gender:
            patient.gender = body.gender
        if body.blood_group and not patient.blood_group:
            patient.blood_group = body.blood_group
        if (body.city or "").strip() and not patient.city:
            patient.city = body.city.strip()
    appt = Appointment(
        hospital_id=aff.hospital_id or doctor.hospital_id, doctor_id=doctor.doctor_id, affiliation_id=aff.affiliation_id, patient_id=patient.patient_id,
        appointment_date=date.today(), appointment_type="walkin", status="confirmed",
        consultation_fee=aff.consultation_fee or doctor.consultation_fee,
        notes=normalize.to_english_text(body.notes), source="walkin",
        booked_by=me.user_id, confirmed_at=utcnow(), queue_alerts=body.whatsapp_alerts,
    )
    db.add(appt)
    db.flush()
    _claim_follow_up(db, appt, patient.patient_id, doctor.doctor_id, None)
    _set_status(db, appt, "confirmed", me.user_id, "Walk-in")
    db.commit()
    if body.whatsapp_alerts:
        # Opted-in walk-ins count toward the booking quota.
        try:
            quota.after_booking(db, appt.hospital_id)
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
    db.refresh(appt)
    return appt


@router.post("/feedback", response_model=AppointmentOut)
def feedback(body: FeedbackRequest, me: User = Depends(require_permission("appointment", "read")), db: Session = Depends(get_db)):
    appt = _appt(db, body.appointment_id)
    _assert_access(me, appt, db)
    appt.rating = body.rating
    appt.feedback = body.comment
    db.commit()
    db.refresh(appt)
    return appt


# ===================================================== Item paths ===========
@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: UUID, me: User = Depends(require_permission("appointment", "read")), db: Session = Depends(get_db)):
    appt = _appt(db, appointment_id)
    _assert_access(me, appt, db)
    return appt


@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(appointment_id: UUID, body: AppointmentUpdate, me: User = Depends(require_permission("appointment", "update")), db: Session = Depends(get_db)):
    appt = _appt(db, appointment_id)
    _assert_access(me, appt, db)
    fields = body.model_dump(exclude_unset=True)
    # A patient may edit their own notes, not the visit type: "emergency" jumps
    # the queue, and "walkin" takes the visit out of the hospital's booking quota.
    if me.role and me.role.name == ROLE_PATIENT and "appointment_type" in fields \
            and fields["appointment_type"] != appt.appointment_type:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the hospital can change the visit type")
    for k, v in fields.items():
        setattr(appt, k, v)
    db.commit()
    db.refresh(appt)
    return appt


@router.delete("/{appointment_id}", response_model=AppointmentOut)
def cancel_by_id(appointment_id: UUID, reason: str = Query(""), me: User = Depends(require_permission("appointment", "update")), db: Session = Depends(get_db)):
    return _do_cancel(db, me, appointment_id, reason)


@router.get("/{appointment_id}/status-history", response_model=list[StatusHistoryOut])
def status_history(appointment_id: UUID, me: User = Depends(require_permission("appointment", "read")), db: Session = Depends(get_db)):
    appt = _appt(db, appointment_id)
    _assert_access(me, appt, db)
    return db.scalars(select(ApptStatusHistory).where(ApptStatusHistory.appointment_id == appointment_id).order_by(ApptStatusHistory.history_id)).all()


@router.get("/{appointment_id}/reschedule-history", response_model=list[RescheduleHistoryOut])
def reschedule_history(appointment_id: UUID, me: User = Depends(require_permission("appointment", "read")), db: Session = Depends(get_db)):
    appt = _appt(db, appointment_id)
    _assert_access(me, appt, db)
    return db.scalars(select(ApptRescheduleHistory).where(ApptRescheduleHistory.appointment_id == appointment_id).order_by(ApptRescheduleHistory.reschedule_id)).all()


# ---- shared cancel ----
def _do_cancel(db: Session, me: User, appointment_id: UUID, reason: str) -> Appointment:
    appt = _appt(db, appointment_id)
    _assert_access(me, appt, db)
    if appt.status == "cancelled":
        raise HTTPException(status.HTTP_409_CONFLICT, "Already cancelled")
    # Refund disposition is finalised by the Payment module (Phase 5).
    refund_status = "pending" if appt.booking_fee_paid and appt.booking_fee_paid > 0 else "none"
    db.add(ApptCancellationLog(
        appointment_id=appt.appointment_id, cancelled_by=me.user_id,
        cancel_reason=reason, refund_status=refund_status, refund_amount=0,
    ))
    # Hand the free revisit back. Cancelling a paid visit costs the patient
    # nothing, so cancelling a free one must not cost them the pass.
    rp.restore(db, appt.appointment_id)
    _set_status(db, appt, "cancelled", me.user_id, reason or "Cancelled")

    # Release the queue token too. Cancelling the appointment alone left the
    # token `waiting` for ever: half the system knew the visit was off and half
    # did not. The consequences were not cosmetic — the patient stayed in the
    # doctor's queue inflating everyone else's ETA, and every clock-driven
    # alert kept firing. On 21 Sep 2026 three patients were told to start an
    # eleven-hour journey for visits they had already cancelled themselves.
    # `session_cancellation.cancel_and_notify` has always done this; only the
    # patient/staff path was missing it.
    for tok in db.scalars(select(Token).where(Token.appointment_id == appt.appointment_id)).all():
        if tok.status in ("waiting", "current"):
            te.set_status(db, tok, "cancelled", me.user_id, reason or "Appointment cancelled")
            te.log_movement(db, tok, "cancel", tok.queue_position, None, me.user_id, reason)
            tok.queue_position = 0
            # And off the doctor's screen if they were mid-consultation with
            # it, the way session_cancellation has always done.
            doctor = db.get(Doctor, tok.doctor_id)
            if doctor and doctor.presence and doctor.presence.current_token_id == tok.token_id:
                doctor.presence.current_token_id = None
            # Renumber what is left, or the cancelled patient leaves a hole and
            # everyone behind them keeps a stale position and ETA.
            te.recompute_positions(db, tok.doctor_id, tok.token_date, tok.affiliation_id)

    audit.log_activity(db, me.user_id, "appointment.cancel", "appointment", {"appointment_id": appointment_id})
    db.commit()
    db.refresh(appt)
    return appt
