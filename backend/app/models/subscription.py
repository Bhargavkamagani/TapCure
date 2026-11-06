"""
Module 10 — Subscription (the SaaS billing layer).

plans          pricing tiers + plan limits (max doctors/departments/tokens, quotas)
subscriptions  a hospital's active plan (trial/active/expired…) + billing cycle
invoices       generated bills against a subscription
booking_months one row per hospital per month: the online-booking quota choice
               (upgrade / pack / pay per booking) and the warnings already sent

The booking rules for each plan (free bookings, per-booking fee, bill limit)
live in services/booking_quota.py, keyed by Plan.code.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

SUBSCRIPTION_STATUSES = ("trial", "active", "expired", "cancelled", "suspended")
BILLING_CYCLES = ("monthly", "annually")
INVOICE_STATUSES = ("draft", "sent", "paid", "overdue", "void")


class Plan(Base):
    __tablename__ = "plans"

    plan_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # pilot / starter / smart_hospital / pro / hospital. NULL on the old demo plans,
    # which have no booking quota and are never enforced.
    code: Mapped[Optional[str]] = mapped_column(String(30), index=True)
    price_monthly: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    price_annually: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    max_doctors: Mapped[int] = mapped_column(default=-1)        # -1 = unlimited
    max_departments: Mapped[int] = mapped_column(default=-1)
    max_tokens_per_day: Mapped[int] = mapped_column(default=-1)
    sms_quota_monthly: Mapped[int] = mapped_column(default=0)
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    reports_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    api_access_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    features_json: Mapped[Optional[dict]] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"

    subscription_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("plans.plan_id"), nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="trial", index=True)
    billing_cycle: Mapped[str] = mapped_column(String(10), default="monthly")
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    trial_end_date: Mapped[Optional[date]] = mapped_column(Date)
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=True)
    discount_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    # Doctors added on top of the plan (Pro only: ₹599/mo each, +200 bookings).
    extra_doctors: Mapped[int] = mapped_column(default=0)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    plan: Mapped["Plan"] = relationship()
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="subscription", cascade="all, delete-orphan")


class Invoice(Base):
    __tablename__ = "invoices"

    invoice_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    subscription_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("subscriptions.subscription_id"), nullable=False, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), index=True)
    plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("plans.plan_id"))
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True)
    amount: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    paid_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(12), default="sent")
    pdf_url: Mapped[Optional[str]] = mapped_column(String(500))
    # "YYYY-MM" for a monthly bill (one per hospital per month); NULL for a
    # yearly prepay invoice. lines_json = [{label, amount}] — what the bill is for.
    billing_month: Mapped[Optional[str]] = mapped_column(String(7), index=True)
    lines_json: Mapped[Optional[list]] = mapped_column(JSON)
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(100))
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(100))
    # Autopay keeps its own order: a manual Checkout order for the same invoice
    # must not overwrite it, or an autopay debit that lands later is lost.
    # autopay_attempted_at is set BEFORE Razorpay is called, so a second run
    # never debits the same invoice again; autopay_failed_at re-opens manual pay.
    autopay_order_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    autopay_attempted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    autopay_failed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Unpaid-bill reminders already sent: 1 due today, 2 three days late,
    # 3 seven days late, 4 online bookings stopped.
    reminder_stage: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    subscription: Mapped["Subscription"] = relationship(back_populates="invoices")


MANDATE_STATUSES = ("created", "active", "cancelled", "failed")


class BillingMandate(Base):
    """A hospital's UPI Autopay mandate on Razorpay (set up once).

    max_amount is the plan's bill limit incl. GST, so a month can never be
    charged more than the hospital agreed to. One live row per hospital.
    """
    __tablename__ = "billing_mandates"

    mandate_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    razorpay_customer_id: Mapped[Optional[str]] = mapped_column(String(100))
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    razorpay_token_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    max_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[str] = mapped_column(String(12), default="created", index=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class BillingEvent(Base):
    """Every Razorpay billing webhook, by Razorpay's event id.

    A repeated event is skipped; one that failed is kept with its error and
    processed again when Razorpay retries. Also the record of what Razorpay
    told us, for disputes.
    """
    __tablename__ = "billing_events"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    event_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), default="")
    status: Mapped[str] = mapped_column(String(12), default="processed")  # processed / failed
    error: Mapped[Optional[str]] = mapped_column(Text)
    payload: Mapped[Optional[dict]] = mapped_column(JSON)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


OVERAGE_CHOICES = ("upgrade", "pack", "pay_per_booking")


class BookingMonth(Base):
    """A hospital's online-booking month (IST calendar month, "YYYY-MM").

    Created the first time it's needed. Holds what the hospital chose once its
    free bookings ran out, the booking packs it bought, and when the 80% and
    100% warnings went out so each is sent once a month.
    """
    __tablename__ = "booking_months"
    __table_args__ = (UniqueConstraint("hospital_id", "month", name="uq_booking_month"),)

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    month: Mapped[str] = mapped_column(String(7), nullable=False)
    choice: Mapped[Optional[str]] = mapped_column(String(16))
    choice_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    choice_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    pack_bookings: Mapped[int] = mapped_column(default=0)
    pack_amount: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    warned_near_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    warned_full_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
