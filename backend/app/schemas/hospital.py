"""Schemas for Module 2 — Hospital & Department."""
from uuid import UUID
from datetime import datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..services import insurers as _insurers
from ..services.storage import media_validator
from .person import OwnerNamePartsIn
from .common import validate_registration_number
from .security import MIN_PASSWORD_LENGTH, validate_password


def _trim_to_none(v: Optional[str]) -> Optional[str]:
    """Normalize an optional free-form ID: trim whitespace, blank -> None.
    Used for HFR ID (ABDM Health Facility Registry); formats vary, so no strict
    pattern is enforced."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _insurer_codes(v):
    """Insurer codes from services/insurers.py only; unknown -> 422, duplicates dropped."""
    if v is None:
        return None
    return _insurers.clean_codes(v)


def _insurer_codes_out(v):
    return _insurers.known(v)


# ---- Hospital ----
class HospitalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    short_code: str = Field(..., min_length=1, max_length=20)
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    phone: str = ""
    email: Optional[EmailStr] = None
    gstin: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    # No logo_url: it is set only by POST /hospitals/{id}/logo, which stores a
    # real image. Accepting it here let an admin point the "logo" at any stored
    # file — another hospital's patient report — and get a signed link back.
    # An old client that still sends it has it ignored, not rejected.
    gstin: Optional[str] = None
    hfr_id: Optional[str] = None
    # Lets a hospital fill in the licence number it typed at signup but which was
    # never stored before migration f1a7c3e95d24.
    registration_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None
    # Codes from GET /public/insurers. Omit = unchanged, [] = clears the list.
    insurance_partners: Optional[list[str]] = None

    _norm_hfr = field_validator("hfr_id")(_trim_to_none)
    _norm_insurers = field_validator("insurance_partners")(_insurer_codes)
    _norm_reg_no = field_validator("registration_number")(validate_registration_number)


class HospitalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    hospital_id: UUID
    name: str
    short_code: str
    address: str
    city: str
    state: str
    pincode: str
    phone: str
    email: str
    logo_url: Optional[str] = None
    gstin: Optional[str] = None
    hfr_id: Optional[str] = None
    registration_number: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: str
    is_active: bool
    photo_url: Optional[str] = None
    letterhead_header_url: Optional[str] = None
    letterhead_footer_url: Optional[str] = None
    insurance_partners: list[str] = []
    # NULL = profile not complete yet = hidden from patients (2026-11-10).
    profile_completed_at: Optional[datetime] = None

    _insurers_out = field_validator("insurance_partners", mode="before")(_insurer_codes_out)
    # Signed only when the ref really is a hospital image (storage.media_url).
    _media_logo = field_validator("logo_url", mode="before")(media_validator("hospitals"))
    _media_photo = field_validator("photo_url", mode="before")(media_validator("hospitals"))
    _media_letterhead = field_validator("letterhead_header_url", "letterhead_footer_url",
                                        mode="before")(media_validator("letterheads"))


class HospitalUpdateResult(HospitalOut):
    """PUT /hospitals/{id} — the saved hospital plus how far the change reached.

    A hospital's address is also the practice address of every doctor working
    there, so an address update fans out. `doctors_synced` lets the UI say so
    instead of leaving the admin guessing whether their doctors moved too.
    """
    doctors_synced: int = 0


# ---- Public hospital self-registration (creates a PENDING hospital + owner admin) ----
class HospitalRegister(OwnerNamePartsIn):
    # sent as "hospital_name"; "clinic_name" is the pre-2026-10-25 name, still accepted
    hospital_name: str = Field(..., min_length=1, max_length=150,
                               validation_alias=AliasChoices("hospital_name", "clinic_name"))
    # hospital_type was removed: it was required at signup and then discarded —
    # never read by register_hospital, no column on hospitals — and the services
    # picked in step 4 already describe the hospital, as real Departments.
    # Pydantic ignores unknown keys, so a client still sending it is unaffected.
    # Shape-checked, not format-matched: licence numbering varies by state (see
    # schemas/common.py). Optional here so an existing API client that omits it
    # is not suddenly rejected; the signup form requires it in the browser.
    registration_number: Optional[str] = None
    hfr_id: Optional[str] = None
    city: str = ""
    area: str = ""
    address: str = ""
    state: str = ""
    pincode: str = ""
    # Precise hospital coordinates from the Google Places picker (null when the
    # user typed a plain address without picking a suggestion).
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    owner_name: str = Field(..., min_length=1)
    phone: str = Field(..., pattern=r"^\d{10}$")
    email: EmailStr
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    # Staff accounts get the same policy as everyone else (schemas/security.py).
    _check_password = field_validator("password")(validate_password)
    # True = open 24/7. open_time/close_time are then ignored, and the hospital
    # imposes no window or week on its doctors.
    always_open: bool = False
    open_time: Optional[time] = None
    close_time: Optional[time] = None
    consultation_minutes: int = 10
    working_days: list[str] = []
    services: list[str] = []
    # Insurers / schemes accepted (codes from GET /public/insurers). Optional.
    insurance_partners: list[str] = []
    terms_accepted: bool = False  # must be True — owner agreed to Terms/Privacy/Refund

    _norm_reg_no = field_validator("registration_number")(validate_registration_number)
    _norm_insurers = field_validator("insurance_partners")(_insurer_codes)

    @field_validator("email")
    @classmethod
    def _email_fits(cls, v: str) -> str:
        # users.email is String(100); EmailStr alone lets up to 254 through.
        if len(v) > 100:
            raise ValueError("Email is too long (100 characters max)")
        return v


class RejectRequest(BaseModel):
    reason: str = ""


# ---- Settings ----
class HospitalSettingsUpdate(BaseModel):
    working_days: Optional[str] = None   # "Mon,Tue,..."
    always_open: Optional[bool] = None
    op_start_time: Optional[time] = None
    op_end_time: Optional[time] = None
    lunch_start: Optional[time] = None
    lunch_end: Optional[time] = None
    token_prefix: Optional[str] = None
    booking_fee: Optional[Decimal] = None
    consultation_duration: Optional[int] = None
    max_advance_days: Optional[int] = None
    emergency_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    timezone: Optional[str] = None
    # Free revisit window, in days. Explicit null turns the offer OFF — the
    # handler uses exclude_unset, so omitting the field leaves it untouched
    # while sending null clears it.
    free_revisit_days: Optional[int] = Field(None, ge=0, le=365)


class HospitalSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    setting_id: UUID
    hospital_id: UUID
    working_days: str = ""
    always_open: bool = False
    hours_confirmed: bool = False
    op_start_time: Optional[time] = None
    op_end_time: Optional[time] = None
    lunch_start: Optional[time] = None
    lunch_end: Optional[time] = None
    token_prefix: str
    booking_fee: Decimal
    consultation_duration: int
    max_advance_days: int
    emergency_enabled: bool
    sms_enabled: bool
    whatsapp_enabled: bool
    timezone: str
    # None = this hospital does not offer a free revisit.
    free_revisit_days: Optional[int] = None


class HospitalSettingsResult(HospitalSettingsOut):
    """Saved settings + doctor sessions the new opening times have invalidated.

    Narrowing the hospital's week or hours can strand sessions that were legal
    when they were created — patients could still hold tokens in them. The API
    reports them so the admin finds out at the moment they make the change,
    rather than from a confused patient.
    """
    conflicting_sessions: int = 0
    conflicts: list[str] = []


class HospitalDetail(HospitalOut):
    settings: Optional[HospitalSettingsOut] = None


# ---- Department ----
class DepartmentCreate(BaseModel):
    hospital_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    code: str = ""
    description: str = ""
    floor: str = ""


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    floor: Optional[str] = None
    is_active: Optional[bool] = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    department_id: UUID
    hospital_id: UUID
    name: str
    code: str
    description: str
    floor: str
    is_active: bool
