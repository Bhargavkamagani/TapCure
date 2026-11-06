"""Schemas for Module 10 — Subscription."""
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PlanCreate(BaseModel):
    name: str = Field(..., min_length=1)
    price_monthly: Decimal = Decimal(0)
    price_annually: Decimal = Decimal(0)
    max_doctors: int = -1
    max_departments: int = -1
    max_tokens_per_day: int = -1
    sms_quota_monthly: int = 0
    whatsapp_enabled: bool = False
    reports_enabled: bool = True
    api_access_enabled: bool = False
    features_json: Optional[dict] = None


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    price_monthly: Optional[Decimal] = None
    price_annually: Optional[Decimal] = None
    max_doctors: Optional[int] = None
    max_departments: Optional[int] = None
    max_tokens_per_day: Optional[int] = None
    sms_quota_monthly: Optional[int] = None
    whatsapp_enabled: Optional[bool] = None
    reports_enabled: Optional[bool] = None
    api_access_enabled: Optional[bool] = None
    is_active: Optional[bool] = None


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    plan_id: UUID
    name: str
    price_monthly: Decimal
    price_annually: Decimal
    max_doctors: int
    max_departments: int
    max_tokens_per_day: int
    sms_quota_monthly: int
    whatsapp_enabled: bool
    reports_enabled: bool
    api_access_enabled: bool
    features_json: Optional[dict] = None
    is_active: bool


class SubscriptionCreate(BaseModel):
    hospital_id: UUID
    plan_id: UUID
    billing_cycle: Literal["monthly", "annually"] = "monthly"
    status: Literal["trial", "active"] = "trial"
    trial_days: int = 14
    discount_pct: Decimal = Decimal(0)


class SubscriptionUpdate(BaseModel):
    plan_id: Optional[UUID] = None
    billing_cycle: Optional[Literal["monthly", "annually"]] = None
    status: Optional[Literal["trial", "active", "expired", "cancelled", "suspended"]] = None
    auto_renew: Optional[bool] = None
    discount_pct: Optional[Decimal] = None


class AssignPlanRequest(BaseModel):
    hospital_id: UUID
    plan_code: Literal["pilot", "starter", "smart_hospital", "pro", "hospital", "smart_clinic"]  # smart_clinic = old code

    @field_validator("plan_code")
    @classmethod
    def _new_plan_code(cls, v):
        return "smart_hospital" if v == "smart_clinic" else v
    billing_cycle: Literal["monthly", "annually"] = "monthly"
    extra_doctors: int = Field(0, ge=0, le=3)
    # Founding Hospital rate: e.g. 20% off Smart Hospital = ₹799.
    discount_pct: Decimal = Field(Decimal(0), ge=0, le=100)


class BookingChoiceRequest(BaseModel):
    choice: Literal["upgrade", "pack", "pay_per_booking"]
    packs: int = Field(1, ge=1, le=20)
    hospital_id: Optional[UUID] = None


class ChoosePlanRequest(BaseModel):
    """A hospital picks its own paid plan (after the pilot, or once a plan ended)."""
    plan_code: Literal["starter", "smart_hospital", "pro", "smart_clinic"]  # smart_clinic = old code

    @field_validator("plan_code")
    @classmethod
    def _new_plan_code(cls, v):
        return "smart_hospital" if v == "smart_clinic" else v


class YearlyRenewalRequest(BaseModel):
    """renew=False: move to monthly when the paid year ends. True: keep yearly."""
    renew: bool


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    subscription_id: UUID
    hospital_id: UUID
    plan_id: UUID
    status: str
    billing_cycle: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    trial_end_date: Optional[date] = None
    auto_renew: bool
    discount_pct: Decimal
    extra_doctors: int = 0


class InvoiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    invoice_id: UUID
    subscription_id: UUID
    hospital_id: UUID
    invoice_number: str
    amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str
    due_date: Optional[date] = None
    paid_date: Optional[date] = None
    status: str
    billing_month: Optional[str] = None
    lines_json: Optional[list] = None
    created_at: datetime


class PaymentConfirm(BaseModel):
    order_id: str
    payment_id: str
    signature: str
