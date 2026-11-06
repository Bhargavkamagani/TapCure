"""Schemas for follow-ups."""
from uuid import UUID
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FollowUpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    follow_up_id: UUID
    hospital_id: UUID
    patient_id: UUID
    family_member_id: Optional[UUID] = None
    family_member_name: Optional[str] = None
    doctor_id: UUID
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    hospital_name: Optional[str] = None
    source_prescription_id: Optional[UUID] = None
    due_date: date
    reason: str = ""
    status: str
    booked_appointment_id: Optional[UUID] = None
    # Derived, not stored: marking rows 'missed' would need a nightly job, and
    # a date comparison is always right without one.
    is_overdue: bool = False
    days_until_due: int = 0
    created_at: datetime
