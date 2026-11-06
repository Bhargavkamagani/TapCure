"""Schemas for Module 7 — Token Engine."""
from uuid import UUID
from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..services.english_text import to_english


# ---- requests ----
class GenerateTokenRequest(BaseModel):
    appointment_id: UUID
    priority: Literal["normal", "urgent", "emergency"] = "normal"


class TokenIdRequest(BaseModel):
    token_id: UUID


class RecallRequest(BaseModel):
    token_id: UUID
    recall_method: Literal["sms", "display", "manual", "pa_announcement"] = "display"


class CancelTokenRequest(BaseModel):
    token_id: UUID
    reason: str = ""

    _en_reason = field_validator("reason")(to_english)


class SkipRequest(BaseModel):
    token_id: UUID
    reason: str = ""

    _en_reason = field_validator("reason")(to_english)


class PriorityRequest(BaseModel):
    new_priority: Literal["normal", "urgent", "emergency"]
    reason: str = ""

    _en_reason = field_validator("reason")(to_english)


class ReorderRequest(BaseModel):
    doctor_id: UUID
    token_ids: List[UUID] = Field(..., min_length=1)


class BulkCancelRequest(BaseModel):
    doctor_id: UUID
    date: Optional[date] = None
    reason: str = ""

    _en_reason = field_validator("reason")(to_english)


class NotifyRequest(BaseModel):
    token_id: UUID
    message_type: str = "general"


class EmergencyCreate(BaseModel):
    doctor_id: UUID
    condition_description: str = ""
    priority: Literal["urgent", "emergency", "critical"] = "emergency"
    patient_id: Optional[UUID] = None
    patient_name: str = ""
    patient_phone: Optional[str] = None


# ---- responses ----
class TokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    token_id: UUID
    appointment_id: Optional[UUID] = None
    doctor_id: UUID
    affiliation_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    hospital_id: UUID
    token_number: int
    display_code: str
    token_date: date
    status: str
    priority: str
    queue_position: int
    estimated_time: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    wait_duration_mins: Optional[int] = None
    consult_duration_mins: Optional[int] = None
    is_walkin: bool
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    origin_label: str = ""
    travel_minutes: Optional[int] = None
    notified_leave: bool = False


class EstimateOut(BaseModel):
    token_id: UUID
    # Token identity (so the patient UI can render it without the queue endpoint).
    display_code: str = ""
    token_number: int = 0
    token_date: Optional[date] = None
    status: str = ""
    # Live queue context.
    queue_position: int
    total_waiting: int = 0
    now_serving: Optional[str] = None
    avg_consult_min: int
    delay_min: int
    wait_min: int
    estimated_time: Optional[datetime] = None
    arrive_by: Optional[datetime] = None
    # Travel / leave-by hints — null unless a travel time is known for the token.
    travel_min: Optional[int] = None
    origin_label: Optional[str] = None
    leave_by: Optional[datetime] = None
    remind_at: Optional[datetime] = None
    should_leave_now: bool = False


class TokenStatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    history_id: UUID
    old_status: Optional[str] = None
    new_status: str
    changed_by: Optional[UUID] = None
    reason: str
    changed_at: datetime


class MovementLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: UUID
    action: str
    from_position: Optional[int] = None
    to_position: Optional[int] = None
    notes: str
    logged_at: datetime


class EmergencyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    emergency_id: UUID
    hospital_id: UUID
    doctor_id: UUID
    patient_id: Optional[UUID] = None
    token_id: Optional[UUID] = None
    patient_name: str
    patient_phone: Optional[str] = None
    condition_description: str
    priority: str
    status: str
    created_at: datetime
