"""
Appointment payments — the audit trail for the Razorpay booking fee.

One row is created when a Razorpay order is opened (status 'created'), holding the
booking intent (booking_json) so the booking can still be completed from a webhook
if the browser confirm never lands. On a verified payment it advances to 'paid' →
'booked' (linked to the created appointment). This gives a durable record of every
transaction: order id, payment id, amount, and the resulting appointment.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base, UUIDType, new_uuid, utcnow

PAYMENT_STATUSES = ("created", "paid", "booked", "failed")


class AppointmentPayment(Base):
    __tablename__ = "appointment_payments"

    payment_pk: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    razorpay_order_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), index=True)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(8, 2), default=0)   # rupees
    currency: Mapped[str] = mapped_column(String(8), default="INR")
    status: Mapped[str] = mapped_column(String(12), default="created", index=True)
    booking_json: Mapped[str] = mapped_column(Text, default="")        # AppointmentCreate payload (for webhook recovery)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
