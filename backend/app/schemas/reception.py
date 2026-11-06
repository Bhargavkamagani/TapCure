"""Schemas for Module 4 — Reception."""
from uuid import UUID
from datetime import date, time
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from .person import NamePartsIn, NamePartsOut
from .security import MIN_PASSWORD_LENGTH, validate_password


class ReceptionistCreate(BaseModel):
    user_id: UUID
    hospital_id: UUID
    employee_id: Optional[str] = None
    designation: str = "Front Desk Executive"
    departments_assigned: Optional[List[UUID]] = None
    joined_date: Optional[date] = None


class ReceptionistOnboard(NamePartsIn):
    """Admin adds a receptionist to their own hospital, creating the login too."""
    name: str = Field(..., min_length=1)
    email: EmailStr
    phone: Optional[str] = Field(None, pattern=r"^\d{10}$")
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    # Staff accounts get the same policy as everyone else (schemas/security.py).
    _check_password = field_validator("password")(validate_password)
    employee_id: Optional[str] = None
    designation: str = "Front Desk Executive"
    # Empty / omitted = all doctors at the hospital.
    doctors_assigned: Optional[List[UUID]] = None

    # users.name and users.email are VARCHAR(100): longer values used to reach
    # the database and come back as a 500 instead of a message.
    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        if len(v) > 100:
            raise ValueError("Name is too long (100 characters max)")
        return v

    @field_validator("email")
    @classmethod
    def _email_fits(cls, v: str) -> str:
        if len(v) > 100:
            raise ValueError("Email is too long (100 characters max)")
        return v


class StaffOut(NamePartsOut):
    """Receptionist record enriched with their login's display fields."""
    model_config = ConfigDict(from_attributes=True)
    receptionist_id: UUID
    user_id: UUID
    hospital_id: UUID
    employee_id: Optional[str] = None
    designation: str
    is_active: bool
    joined_date: Optional[date] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    doctors_assigned: List[UUID] = []   # [] = all doctors


class StaffAccountUpdate(NamePartsIn):
    """Hospital admin edits a staff member: their login and their staff record.
    Every field is optional; only what is sent changes. `password` sets a new
    one (and signs the account out everywhere); `phone=""` clears the number."""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r"^(\d{10})?$")
    password: Optional[str] = Field(None, max_length=128)
    employee_id: Optional[str] = Field(None, max_length=50)
    designation: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    # [] = all doctors; omitted = unchanged.
    doctors_assigned: Optional[List[UUID]] = None

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        if len(v) > 100:
            raise ValueError("Name is too long (100 characters max)")
        return v

    @field_validator("email")
    @classmethod
    def _email_fits(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 100:
            raise ValueError("Email is too long (100 characters max)")
        return v

    @field_validator("password")
    @classmethod
    def _check_new_password(cls, v: Optional[str]) -> Optional[str]:
        # Blank means "keep the current password".
        return validate_password(v) if v else None

    @field_validator("employee_id")
    @classmethod
    def _clean_employee_id(cls, v: Optional[str]) -> Optional[str]:
        return v if v is None else v.strip()


class ReceptionistUpdate(BaseModel):
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    departments_assigned: Optional[List[UUID]] = None
    is_active: Optional[bool] = None


class ReceptionistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    receptionist_id: UUID
    user_id: UUID
    hospital_id: UUID
    employee_id: Optional[str] = None
    designation: str
    departments_assigned: Optional[List[UUID]] = None
    is_active: bool
    joined_date: Optional[date] = None


class ShiftCreate(BaseModel):
    receptionist_id: UUID
    hospital_id: UUID
    shift_date: date
    start_time: time
    end_time: time
    department_id: Optional[UUID] = None
    notes: str = ""


class ShiftUpdate(BaseModel):
    shift_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    department_id: Optional[UUID] = None
    notes: Optional[str] = None


class ShiftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    shift_id: UUID
    receptionist_id: UUID
    hospital_id: UUID
    shift_date: date
    start_time: time
    end_time: time
    department_id: Optional[UUID] = None
    notes: str
