"""Patient payment history. Booking-fee checkout routes are currently disabled."""
from uuid import UUID
import json
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import require_permission
from ..models import Appointment, AppointmentPayment, Doctor, Hospital, Patient, User
from ..schemas.appointment import AppointmentCreate, AppointmentOut
from ..services import razorpay_client as rzp
from ..services import session_cancellation
from .appointments import assert_bookable, assert_reachable, booking_hospital_id, create_booking

router = APIRouter(prefix="/payments", tags=["payments"])


class PaymentRow(BaseModel):
    appointment_id: Optional[UUID] = None
    date: Optional[datetime] = None
    description: str
    amount: float
    method: str
    status: str
    kind: str                      # 'booking' | 'consultation'


class PaymentHistory(BaseModel):
    total_spent: float
    this_month: float
    transactions: int
    rows: list[PaymentRow]


class OrderRequest(BaseModel):
    booking: AppointmentCreate


class OrderResponse(BaseModel):
    payment_required: bool
    fee: float
    order_id: str | None = None
    amount: int | None = None       # in paise
    currency: str = "INR"
    key_id: str | None = None


class ConfirmRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    booking: AppointmentCreate


def _complete_booking(db: Session, me: User, pay: AppointmentPayment) -> "AppointmentOut":
    """Create the appointment+token for a paid order, idempotently. If this order
    was already booked, return the existing appointment instead of double-booking."""
    from ..models import Appointment  # local import avoids a cycle at module load
    if pay.status == "booked" and pay.appointment_id:
        return db.get(Appointment, pay.appointment_id)
    booking = AppointmentCreate(**json.loads(pay.booking_json))
    appt = create_booking(db, me, booking, booking_fee_paid=float(pay.amount or 0))
    pay.appointment_id = appt.appointment_id
    pay.status = "booked"
    db.add(pay)
    db.commit()
    return appt


# Booking-fee checkout endpoint disabled; keep the handler for future reference.
# @router.get("/config")
def payment_config():
    """Lets the frontend know whether to show a payment step, the public key, and
    the flat online booking fee (consultation is paid at the hospital, not here)."""
    return {
        "enabled": rzp.is_configured(),
        "key_id": settings.razorpay_key_id or None,
        "booking_fee": settings.booking_fee,
    }


@router.get("/my", response_model=PaymentHistory)
def my_payment_history(
    me: User = Depends(require_permission("payment", "read")),
    db: Session = Depends(get_db),
):
    """The logged-in patient's payment history — online booking fees (Razorpay)
    plus consultation fees collected at the hospital — newest first, with totals."""
    my_ids = [p.patient_id for p in db.scalars(select(Patient).where(Patient.user_id == me.user_id))]
    rows: list[PaymentRow] = []
    if my_ids:
        # Names for descriptions.
        doctors = {d.doctor_id: d for d in db.scalars(select(Doctor))}
        hospitals = {h.hospital_id: h.name for h in db.scalars(select(Hospital))}

        # 1) Consultation fees collected at the hospital.
        consults = db.scalars(
            select(Appointment).where(
                Appointment.patient_id.in_(my_ids), Appointment.consultation_paid.is_(True)
            )
        ).all()
        for a in consults:
            doc = doctors.get(a.doctor_id)
            rows.append(PaymentRow(
                appointment_id=a.appointment_id,
                date=a.consultation_paid_at or a.created_at,
                description=f"Consultation – {doc.name if doc else 'Doctor'}",
                amount=float(a.consultation_fee or 0),
                method=(a.consultation_payment_method or "cash").upper(),
                status="Paid at Hospital",
                kind="consultation",
            ))

        # 2) Online booking fees (Razorpay) that resulted in / are tied to a booking.
        pays = db.scalars(
            select(AppointmentPayment).where(
                AppointmentPayment.patient_id.in_(my_ids),
                AppointmentPayment.status.in_(("paid", "booked")),
            )
        ).all()
        for pay in pays:
            hosp = None
            if pay.appointment_id:
                a = db.get(Appointment, pay.appointment_id)
                hosp = hospitals.get(a.hospital_id) if a else None
            rows.append(PaymentRow(
                appointment_id=pay.appointment_id,
                date=pay.created_at,
                description=f"Booking Fee{f' – {hosp}' if hosp else ''}",
                amount=float(pay.amount or 0),
                method="Online",
                status="Paid Online",
                kind="booking",
            ))

    rows.sort(key=lambda r: r.date.timestamp() if r.date else 0.0, reverse=True)
    now = datetime.utcnow()
    total = sum(r.amount for r in rows)
    this_month = sum(r.amount for r in rows if r.date and r.date.year == now.year and r.date.month == now.month)
    return PaymentHistory(total_spent=total, this_month=this_month, transactions=len(rows), rows=rows)


# @router.post("/appointment/order", response_model=OrderResponse)
def create_appointment_order(
    body: OrderRequest,
    me: User = Depends(require_permission("appointment", "create")),
    db: Session = Depends(get_db),
):
    # Prove the day is bookable BEFORE taking any money. This check used to live
    # only in create_booking, which runs after the payment is confirmed — so a
    # patient could pay the booking fee in full and only then be told the doctor
    # was on leave that day. A 409 here reaches the caller with the reason, which
    # the booking screens turn into "pick another day / another doctor".
    doctor, aff = assert_bookable(db, body.booking)
    # Check reachability BEFORE taking money. create_booking checks it again,
    # but by then the fee is already collected — a 409 there would leave the
    # patient paid-and-unbooked.
    assert_reachable(db, doctor, aff, body.booking)
    # Online charge is the flat booking fee — NOT the consultation fee (that's
    # collected at the hospital). 0 or no keys → no payment step; book directly.
    fee = float(settings.booking_fee or 0)
    if fee <= 0 or not rzp.is_configured():
        return OrderResponse(payment_required=False, fee=fee)
    # A patient whose visit WE cancelled (the doctor's session was removed) holds
    # one free rebooking instead of a refund. Waive the fee here — the credit is
    # spent in create_booking, so an abandoned checkout never burns it.
    #
    # Deliberately NOT scoped to a hospital. It used to be, so that one hospital's
    # apology did not come out of another's takings — sound for independent
    # tenants, but every hospital here belongs to the same business, so the
    # restriction only ever punished the patient by sending them back to the
    # hospital that cancelled on them. Any doctor, any hospital.
    if session_cancellation.unused_credit(db, body.booking.patient_id):
        return OrderResponse(payment_required=False, fee=0)
    try:
        order = rzp.create_order(
            int(round(fee * 100)),
            receipt=f"appt-{me.user_id}-{body.booking.doctor_id}",
            notes={"doctor_id": str(body.booking.doctor_id), "patient_id": str(body.booking.patient_id), "kind": "booking_fee"},
        )
    except httpx.HTTPError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Could not create payment order: {e}")
    # Record the order + booking intent so it can be reconciled / webhook-recovered.
    db.add(AppointmentPayment(
        razorpay_order_id=order["id"], patient_id=body.booking.patient_id,
        amount=fee, currency=order["currency"], status="created",
        booking_json=body.booking.model_dump_json(),
    ))
    db.commit()
    return OrderResponse(
        payment_required=True, fee=fee, order_id=order["id"],
        amount=order["amount"], currency=order["currency"], key_id=settings.razorpay_key_id,
    )


# @router.post("/appointment/confirm", response_model=AppointmentOut)
def confirm_appointment_payment(
    body: ConfirmRequest,
    me: User = Depends(require_permission("appointment", "create")),
    db: Session = Depends(get_db),
):
    # Refuse before verifying, so an unconfigured environment says what is
    # actually wrong instead of "verification failed" — which reads like the
    # patient's payment was rejected and sends the front desk chasing Razorpay.
    if not rzp.is_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Online payment is not configured on this server, so a paid booking "
            "cannot be confirmed here. Book without payment, or set the Razorpay keys.",
        )
    if not rzp.verify_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment verification failed — booking not created")
    pay = db.scalar(select(AppointmentPayment).where(AppointmentPayment.razorpay_order_id == body.razorpay_order_id))
    if not pay:
        # No order row (e.g. created before this feature) — fall back to the request body.
        pay = AppointmentPayment(
            razorpay_order_id=body.razorpay_order_id, patient_id=body.booking.patient_id,
            amount=float(settings.booking_fee or 0), status="created",
            booking_json=body.booking.model_dump_json(),
        )
        db.add(pay)
        db.flush()
    pay.razorpay_payment_id = body.razorpay_payment_id
    if pay.status == "created":
        pay.status = "paid"
    db.add(pay)
    db.flush()
    return _complete_booking(db, me, pay)


# @router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    """Server-to-server safety net. Configure this URL + a webhook secret in the
    Razorpay dashboard. On payment.captured we record the payment and, if the
    browser confirm never completed the booking, finish it here."""
    raw = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    if not rzp.verify_webhook(raw, signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")
    event = json.loads(raw or b"{}")
    if event.get("event") not in ("payment.captured", "order.paid"):
        return {"ignored": event.get("event")}
    entity = (event.get("payload", {}).get("payment", {}) or {}).get("entity", {})
    order_id = entity.get("order_id")
    payment_id = entity.get("id")
    if not order_id:
        return {"ignored": "no order_id"}
    pay = db.scalar(select(AppointmentPayment).where(AppointmentPayment.razorpay_order_id == order_id))
    if not pay:
        return {"ignored": "unknown order"}
    if payment_id:
        pay.razorpay_payment_id = payment_id
    if pay.status == "created":
        pay.status = "paid"
    db.add(pay)
    db.commit()
    if pay.status == "booked":
        return {"ok": True, "already_booked": True}
    # Recover the booking using the patient's own user as the actor.
    patient = db.get(Patient, pay.patient_id) if pay.patient_id else None
    me = db.get(User, patient.user_id) if (patient and patient.user_id) else None
    if not me:
        return {"ok": True, "note": "paid but no user to book under; needs manual booking"}
    try:
        appt = _complete_booking(db, me, pay)
        return {"ok": True, "booked_appointment_id": appt.appointment_id}
    except Exception as e:  # noqa: BLE001 — webhook must always 200 so Razorpay won't spam retries
        return {"ok": True, "note": f"payment recorded; booking deferred: {type(e).__name__}"}
