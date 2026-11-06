"""Schemas for Module 6 — Appointment."""
from uuid import UUID
from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..services.english_text import to_english, to_english_name
from .person import NamePartsIn


class AppointmentCreate(BaseModel):
    doctor_id: UUID
    affiliation_id: Optional[UUID] = None
    patient_id: UUID
    appointment_date: date
    slot_time: Optional[time] = None
    family_member_id: Optional[UUID] = None
    appointment_type: Literal["online", "regular", "walkin", "emergency"] = "online"
    notes: str = ""
    source: Literal["app", "whatsapp", "csc", "walkin", "phone"] = "app"
    # Travel origin for this visit (where the patient leaves FROM). Optional —
    # powers the leave-by / "time to leave" reminder. Either pass coordinates,
    # an explicit travel_minutes, or both.
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    origin_label: str = ""
    travel_minutes: Optional[int] = Field(None, ge=0, le=24 * 60)

    # Stored English only (services/english_text.py): Telugu/Hindi script is
    # written out in English letters before it reaches the database.
    _en_notes = field_validator("notes")(to_english)
    _en_origin = field_validator("origin_label")(to_english_name)


class AppointmentUpdate(BaseModel):
    notes: Optional[str] = None
    appointment_type: Optional[Literal["online", "regular", "walkin", "emergency"]] = None

    _en_notes = field_validator("notes")(to_english)


class WalkInRequest(NamePartsIn):
    doctor_id: UUID
    affiliation_id: Optional[UUID] = None
    name: str = Field(..., min_length=1)
    phone: str = Field(..., pattern=r"^\d{10}$")
    notes: str = ""
    # Optional demographics the front desk can capture at the counter. Blank is
    # normal — a walk-in queue must never be held up by a missing blood group.
    gender: Optional[Literal["Male", "Female", "Other"]] = None
    blood_group: Optional[str] = None
    city: Optional[str] = None
    # Opt-in: a walk-in sent WhatsApp queue alerts counts as an online booking.
    whatsapp_alerts: bool = False

    _en_name = field_validator("name", "city")(to_english_name)
    _en_notes = field_validator("notes")(to_english)


class RescheduleRequest(BaseModel):
    appointment_id: UUID
    new_date: date
    new_time: Optional[time] = None
    reason: str = ""

    _en_reason = field_validator("reason")(to_english)


class CancelRequest(BaseModel):
    appointment_id: UUID
    reason: str = ""


class FeedbackRequest(BaseModel):
    appointment_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""


class CollectPaymentRequest(BaseModel):
    method: Literal["cash", "upi", "card", "other"] = "cash"


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    appointment_id: UUID
    hospital_id: UUID
    doctor_id: UUID
    affiliation_id: Optional[UUID] = None
    practice_type: Optional[str] = None
    practice_name: Optional[str] = None
    managed_by_hospital: bool = True
    patient_id: UUID
    patient_name: Optional[str] = None
    # Enriched for the patient history view (who they saw / where / for what).
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    hospital_name: Optional[str] = None
    family_member_id: Optional[UUID] = None
    family_member_name: Optional[str] = None   # set when the visit is for a dependent
    appointment_date: date
    slot_time: Optional[time] = None
    appointment_type: str
    status: str
    # "One free reschedule" — lets the UI disable the button before it's clicked
    # instead of letting the patient hit a 409.
    reschedule_count: int = 0
    reschedules_allowed: int = 1
    consultation_fee: Decimal
    booking_fee_paid: Decimal
    consultation_paid: bool = False
    consultation_payment_method: Optional[str] = None
    notes: str
    source: str
    rating: Optional[int] = None
    feedback: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    origin_label: str = ""
    travel_minutes: Optional[int] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime
    # {pass_id, earned_on, valid_until} when this visit used a free revisit.
    free_revisit: Optional[dict] = None


class StatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    history_id: UUID
    old_status: Optional[str] = None
    new_status: str
    changed_by: Optional[UUID] = None
    reason: str
    changed_at: datetime


class RescheduleHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    reschedule_id: UUID
    old_date: Optional[date] = None
    old_time: Optional[time] = None
    new_date: Optional[date] = None
    new_time: Optional[time] = None
    reason: str
    created_at: datetime


class CancellationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: UUID
    appointment_id: UUID
    cancelled_by: Optional[UUID] = None
    cancel_reason: str
    refund_status: str
    refund_amount: Decimal
    created_at: datetime
