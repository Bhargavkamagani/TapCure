"""Schemas for Module 3 — Doctor."""
from uuid import UUID
import re
from datetime import date, datetime, time
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..services.storage import public_url
from .person import NamePartsIn, NamePartsOut

Weekday = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _trim_to_none(v: Optional[str]) -> Optional[str]:
    """Normalize an optional free-form ID: trim whitespace, blank -> None.

    Used for HPR ID (ABDM). Formats vary across professional types, so we don't
    enforce a strict pattern — just store a clean value or nothing.
    """
    if v is None:
        return None
    s = str(v).strip()
    return s or None


# The registration-number rule moved to schemas/common.py when hospitals gained
# one too (a clinical-establishment licence): same rule, two unrelated owners,
# so it no longer belongs to the doctor module. Re-exported here because
# routers/auth.py and the schemas below already import it from this module —
# repointing those would be churn for no gain.
from .common import (  # noqa: F401  (re-export for existing importers)
    MAX_REG_NO,
    MIN_REG_DIGITS,
    validate_registration_number,
)
from .security import MIN_PASSWORD_LENGTH, validate_password


# ---- Doctor ----
class DoctorCreate(NamePartsIn):
    name: str = ""
    user_id: Optional[UUID] = None
    hospital_id: UUID
    department_id: Optional[UUID] = None
    specialization: str = "General Physician"
    qualification: str = ""
    registration_number: Optional[str] = None
    hpr_id: Optional[str] = None
    experience_years: int = 0
    consultation_fee: Decimal = Decimal(0)
    bio: str = ""
    languages: str = ""

    _norm_hpr = field_validator("hpr_id")(_trim_to_none)
    _norm_reg_no = field_validator("registration_number")(validate_registration_number)


class DoctorOnboard(NamePartsIn):
    """Admin adds a doctor to their hospital and creates their login."""
    name: str = Field(..., min_length=1)
    specialization: str = "General Physician"
    qualification: str = ""
    registration_number: Optional[str] = None
    hpr_id: Optional[str] = None
    experience_years: int = 0
    consultation_fee: Decimal = Decimal(0)
    department_id: Optional[UUID] = None
    languages: str = ""
    # Required for doctor WhatsApp notifications and password recovery.
    phone: str = Field(..., pattern=r"^\d{10}$")

    _norm_hpr = field_validator("hpr_id")(_trim_to_none)
    _norm_reg_no = field_validator("registration_number")(validate_registration_number)
    create_login: Literal[True] = True
    email: EmailStr
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    # Staff accounts get the same policy as everyone else (schemas/security.py).
    _check_password = field_validator("password")(validate_password)


class DoctorUpdate(NamePartsIn):
    name: Optional[str] = None
    department_id: Optional[UUID] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    registration_number: Optional[str] = None
    hpr_id: Optional[str] = None
    experience_years: Optional[int] = None
    consultation_fee: Optional[Decimal] = None
    bio: Optional[str] = None
    profile_photo_url: Optional[str] = None
    languages: Optional[str] = None
    status: Optional[Literal["active", "inactive", "on_leave", "suspended"]] = None
    is_available_today: Optional[bool] = None

    _norm_hpr = field_validator("hpr_id")(_trim_to_none)
    _norm_reg_no = field_validator("registration_number")(validate_registration_number)


class DoctorOut(NamePartsOut):
    model_config = ConfigDict(from_attributes=True)
    doctor_id: UUID
    user_id: Optional[UUID] = None
    login_email: Optional[EmailStr] = None
    hospital_id: UUID
    department_id: Optional[UUID] = None
    name: str
    specialization: str
    qualification: str
    registration_number: Optional[str] = None
    hpr_id: Optional[str] = None
    experience_years: int
    consultation_fee: Decimal
    bio: str
    profile_photo_url: Optional[str] = None
    languages: str
    status: str
    is_available_today: bool
    verification_status: str = "verified"
    is_self_registered: bool = False
    # Whether a signature is on file for prescription PDFs. The image itself is
    # never in this (widely shared) shape — see GET /doctors/{id}/signature.
    has_signature: bool = False

    # Any active weekly session at an active practice (Doctor.has_timings).
    has_timings: bool = True

    _media_photo = field_validator("profile_photo_url", mode="before")(public_url)


class DutyOut(BaseModel):
    """Why a doctor can (or can't) be given a patient today."""
    state: str          # on_duty | on_break | leave | holiday | not_scheduled | unavailable | inactive | suspended
    label: str          # front-desk wording, e.g. "On leave"
    detail: str = ""    # holiday reason / "No Sun session" / break note
    hours: str = ""     # today's session windows, e.g. "9:00 AM – 1:00 PM"
    on_duty: bool = False


class DoctorDutyOut(DoctorOut):
    duty: DutyOut


class DoctorDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    document_id: UUID
    doc_type: str
    label: str
    file_url: str
    file_size_kb: int

    _media_file = field_validator("file_url", mode="before")(public_url)


class DoctorVerificationOut(DoctorOut):
    """Admin review payload: doctor + contact + uploaded credential documents."""
    email: Optional[str] = None
    phone: Optional[str] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    documents: List[DoctorDocumentOut] = []


class AffiliationCreate(BaseModel):
    doctor_id: UUID
    hospital_id: Optional[UUID] = None
    # "clinic" / "personal_clinic" are the pre-2026-10-25 names, still accepted
    practice_type: Literal["hospital", "personal_practice", "home", "online", "clinic", "personal_clinic"] = "hospital"

    @field_validator("practice_type")
    @classmethod
    def _new_practice_name(cls, v):
        return {"clinic": "hospital", "personal_clinic": "personal_practice"}.get(v, v)
    name: str = Field(..., min_length=1)
    address: str = ""
    city: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    consultation_fee: Decimal = Decimal(0)
    mode: Literal["slot", "token"] = "slot"
    is_active: bool = True
    managed_by_hospital: bool = True


class AffiliationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    consultation_fee: Optional[Decimal] = None
    mode: Optional[Literal["slot", "token"]] = None
    is_active: Optional[bool] = None
    # Free-revisit window, settable only on a practice the doctor runs
    # themselves. Same bounds as hospital_settings.free_revisit_days so the two
    # inputs cannot disagree; 0 withdraws the offer without nulling the column.
    free_revisit_days: Optional[int] = Field(None, ge=1, le=365)


class AffiliationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    affiliation_id: UUID
    doctor_id: UUID
    hospital_id: Optional[UUID] = None
    practice_type: str
    name: str
    address: str
    city: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    consultation_fee: Decimal
    mode: str
    is_active: bool
    managed_by_hospital: bool
    free_revisit_days: Optional[int] = None


# ---- Schedule + breaks ----
class BreakCreate(BaseModel):
    schedule_id: UUID
    break_start: time
    break_end: time
    label: str = "Break"
    is_recurring: bool = True


class BreakOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    break_id: UUID
    schedule_id: UUID
    break_start: time
    break_end: time
    label: str
    is_recurring: bool


class ScheduleCreate(BaseModel):
    doctor_id: UUID
    affiliation_id: Optional[UUID] = None
    day_of_week: Weekday
    start_time: time
    end_time: time
    max_tokens: int = 40
    consultation_mins: int = 10
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None


class ScheduleUpdate(BaseModel):
    day_of_week: Optional[Weekday] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    max_tokens: Optional[int] = None
    consultation_mins: Optional[int] = None
    is_active: Optional[bool] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None


class ScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    schedule_id: UUID
    doctor_id: UUID
    affiliation_id: Optional[UUID] = None
    day_of_week: str
    start_time: time
    end_time: time
    max_tokens: int
    consultation_mins: int
    is_active: bool
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    breaks: List[BreakOut] = []


class DoctorDetail(DoctorOut):
    schedules: List[ScheduleOut] = []


class DoctorAdminDetail(DoctorVerificationOut):
    """Everything the Super Admin sees for one doctor: profile, contact,
    documents, weekly timings, and where they sit."""
    schedules: List[ScheduleOut] = []
    department_name: Optional[str] = None
    hospital_name: Optional[str] = None


# ---- Holidays ----
class HolidayCreate(BaseModel):
    doctor_id: UUID
    holiday_date: date
    reason: str = ""
    is_full_day: bool = True
    partial_start: Optional[time] = None
    partial_end: Optional[time] = None


class HolidayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    holiday_id: UUID
    doctor_id: UUID
    holiday_date: date
    reason: str
    is_full_day: bool
    partial_start: Optional[time] = None
    partial_end: Optional[time] = None


# ---- Delay ----
class DelayCreate(BaseModel):
    doctor_id: UUID
    delay_minutes: int = Field(..., gt=0)
    reason: str = ""
    delay_date: Optional[date] = None  # defaults to today


class DelayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    delay_id: UUID
    doctor_id: UUID
    delay_date: date
    delay_minutes: int
    reason: str
    notified_patients: bool


# ---- Leave ----
class LeaveCreate(BaseModel):
    doctor_id: UUID
    leave_from: date
    leave_to: date
    leave_type: Literal["casual", "sick", "conference", "maternity"] = "casual"
    reason: str = ""


class HospitalLeaveCreate(BaseModel):
    """Leave with dates, set directly (approved) from the Edit Doctor form."""
    leave_from: date
    leave_to: date
    reason: str = ""


class LeaveDecision(BaseModel):
    status: Literal["approved", "rejected", "cancelled"]
    rejection_reason: Optional[str] = None


class LeaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    leave_id: UUID
    doctor_id: UUID
    leave_from: date
    leave_to: date
    leave_type: str
    reason: str
    status: str
    approved_by: Optional[UUID] = None
    rejection_reason: Optional[str] = None


# ---- Presence status ----
class PresenceUpdate(BaseModel):
    status: Literal["available", "busy", "on_break", "away", "off_duty"]
    note: str = ""


class PresenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    status_id: UUID
    doctor_id: UUID
    status: str
    note: str
    current_token_id: Optional[UUID] = None
    tokens_served_today: int
