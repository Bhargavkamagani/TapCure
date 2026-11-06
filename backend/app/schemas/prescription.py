"""Schemas for Prescriptions."""
from uuid import UUID
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class PrescriptionItemIn(BaseModel):
    drug_name: str = Field(..., min_length=1)
    dosage: str = ""
    frequency: str = ""
    duration: str = ""
    instructions: str = ""
    # Set when the doctor picked the medicine from the hospital pharmacy search.
    stock_id: Optional[UUID] = None


class PrescriptionItemOut(PrescriptionItemIn):
    model_config = ConfigDict(from_attributes=True)
    item_id: UUID


class PrescriptionCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    appointment_id: Optional[UUID] = None
    family_member_id: Optional[UUID] = None
    diagnosis: str = ""
    advice: str = ""
    follow_up_date: Optional[date] = None
    items: List[PrescriptionItemIn] = []


class PrescriptionItemsAdd(BaseModel):
    """More medicines for the prescription already written at this visit."""
    items: List[PrescriptionItemIn] = Field(..., min_length=1, max_length=50)
    # Only accepted when the prescription doesn't already carry a follow-up.
    follow_up_date: Optional[date] = None


class PrescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    prescription_id: UUID
    hospital_id: UUID
    patient_id: UUID
    doctor_id: UUID
    appointment_id: Optional[UUID] = None
    family_member_id: Optional[UUID] = None
    family_member_name: Optional[str] = None
    diagnosis: str
    advice: str
    follow_up_date: Optional[date] = None
    created_at: datetime
    items: List[PrescriptionItemOut] = []
    # Enriched for display (who wrote it / where / for whom).
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    hospital_name: Optional[str] = None
    patient_name: Optional[str] = None
