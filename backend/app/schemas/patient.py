"""Schemas for Module 5 — Patient."""
from uuid import UUID
import re
from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..services.english_text import to_english, to_english_name
from ..services.storage import public_url
from .person import NamePartsIn, NamePartsOut
from ..services import insurers as _insurers


class InsuranceItem(BaseModel):
    """One insurance / scheme the patient holds (2026-11-10)."""
    code: str
    policy_no: Optional[str] = Field(None, max_length=40)

    @field_validator("code")
    @classmethod
    def _known(cls, v: str) -> str:
        return _insurers.clean_codes([v])[0] if (v or "").strip() else v

    @field_validator("policy_no")
    @classmethod
    def _policy(cls, v: Optional[str]) -> Optional[str]:
        v = (v or "").strip()
        return v or None


def _clean_insurances(v):
    """De-duplicate by code (first kept), at most 10."""
    if v is None:
        return v
    out, seen = [], set()
    for item in v:
        if item.code and item.code not in seen:
            seen.add(item.code)
            out.append(item)
    if len(out) > 10:
        raise ValueError("You can add up to 10 insurances")
    return out


def _insurances_out(v):
    """Stored JSON -> list; unknown codes (insurer removed later) dropped."""
    out = []
    for item in v or []:
        code = (item or {}).get("code") if isinstance(item, dict) else None
        if code in _insurers.INSURERS:
            out.append({"code": code, "policy_no": item.get("policy_no")})
    return out

Gender = Literal["Male", "Female", "Other"]


def _normalize_abha_number(v: Optional[str]) -> Optional[str]:
    """Accept an ABHA number with or without spaces/hyphens; store digits-only.

    Optional — blank/None passes through as None. When given, it must be exactly
    14 digits (the ABHA number format), otherwise it's rejected with a clear
    message. Display formatting (XX-XXXX-XXXX-XXXX) is left to the UI.
    """
    if v is None:
        return None
    digits = "".join(ch for ch in str(v) if ch.isdigit())
    if digits == "":
        return None
    if len(digits) != 14:
        raise ValueError("ABHA number must be 14 digits")
    return digits


# ---- Patient ----
class PatientCreate(NamePartsIn):
    hospital_id: UUID
    name: str = Field(..., min_length=1, max_length=150)
    phone: str = Field(..., pattern=r"^\d{10}$")
    email: Optional[str] = None
    dob: Optional[date] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    blood_group: Optional[str] = None
    address: str = ""
    city: str = ""
    pincode: str = ""
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    preferred_language: str = "English"
    abha_number: Optional[str] = None
    abha_address: Optional[str] = None
    registration_source: Literal["app", "whatsapp", "csc", "walkin", "phone"] = "walkin"

    _norm_abha = field_validator("abha_number")(_normalize_abha_number)
    # Stored English only (services/english_text.py): Telugu/Hindi script is
    # written out in English letters before it reaches the database.
    _en_name = field_validator("name", "city", "emergency_contact_name")(to_english_name)
    _en_text = field_validator("address")(to_english)


class PatientUpdate(NamePartsIn):
    # `phone` was missing here, so PUT /patients/{id} accepted a new number,
    # dropped it via exclude_unset and answered 200 — the "phone update does
    # nothing" report. It is applied through accounts.change_phone, never set
    # straight onto the row.
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    dob: Optional[date] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    preferred_language: Optional[str] = None
    abha_number: Optional[str] = None
    abha_address: Optional[str] = None
    is_registered: Optional[bool] = None
    insurances: Optional[list[InsuranceItem]] = None

    _clean_ins = field_validator("insurances")(_clean_insurances)
    _norm_abha = field_validator("abha_number")(_normalize_abha_number)
    _en_name = field_validator("name", "city", "emergency_contact_name")(to_english_name)
    _en_text = field_validator("address")(to_english)


class PatientOut(NamePartsOut):
    model_config = ConfigDict(from_attributes=True)
    patient_id: UUID
    uhid: Optional[str] = None
    photo_url: Optional[str] = None
    hospital_id: UUID
    name: str
    phone: str
    email: Optional[str] = None
    dob: Optional[date] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: str
    city: str
    pincode: str
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    preferred_language: str
    abha_number: Optional[str] = None
    abha_address: Optional[str] = None
    is_registered: bool
    registration_source: str
    created_at: Optional[datetime] = None
    insurances: list[InsuranceItem] = []

    _ins_out = field_validator("insurances", mode="before")(_insurances_out)
    _media_photo = field_validator("photo_url", mode="before")(public_url)


# ---- Family members ----
NotifyTo = Literal["account", "own"]


def _validate_member_phone(v: Optional[str]) -> Optional[str]:
    """Blank -> None; otherwise must be a 10-digit Indian mobile number."""
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    if not re.fullmatch(r"\d{10}", v):
        raise ValueError("Enter a valid 10-digit mobile number")
    return v


class FamilyMemberCreate(NamePartsIn):
    patient_id: UUID
    name: str = Field(..., min_length=1)
    relation: str = ""
    phone: Optional[str] = None
    notify_to: NotifyTo = "account"
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[str] = None
    insurances: Optional[list[InsuranceItem]] = None

    _clean_ins = field_validator("insurances")(_clean_insurances)
    _norm_phone = field_validator("phone")(_validate_member_phone)
    _en_name = field_validator("name", "relation")(to_english_name)


class FamilyMemberUpdate(NamePartsIn):
    name: Optional[str] = None
    relation: Optional[str] = None
    phone: Optional[str] = None
    notify_to: Optional[NotifyTo] = None
    dob: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[str] = None
    is_active: Optional[bool] = None
    insurances: Optional[list[InsuranceItem]] = None

    _clean_ins = field_validator("insurances")(_clean_insurances)
    _norm_phone = field_validator("phone")(_validate_member_phone)
    _en_name = field_validator("name", "relation")(to_english_name)


class FamilyMemberOut(NamePartsOut):
    model_config = ConfigDict(from_attributes=True)
    member_id: UUID
    patient_id: UUID
    name: str
    relation: str
    phone: Optional[str] = None
    notify_to: str = "account"
    dob: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool
    insurances: list[InsuranceItem] = []
    _ins_out = field_validator("insurances", mode="before")(_insurances_out)
    # 'none' | 'pending_holder' | 'pending_member' | 'linked' | 'declined'
    link_status: str = "none"
    linked_user_id: Optional[UUID] = None
    # Who owns this entry. The dependent's own name is already `name`, so an
    # invitation shown to the dependent has no other way to say WHO is asking.
    # Attached only where it is needed; None everywhere else.
    holder_name: Optional[str] = None

    _media_photo = field_validator("photo_url", mode="before")(public_url)


# ---- Medical history ----
class MedicalHistoryCreate(BaseModel):
    patient_id: UUID
    condition: str = Field(..., min_length=1)
    icd_code: Optional[str] = None
    diagnosed_date: Optional[date] = None
    is_chronic: bool = False
    notes: str = ""

    _en_text = field_validator("condition", "notes")(to_english)


class MedicalHistoryUpdate(BaseModel):
    condition: Optional[str] = None
    icd_code: Optional[str] = None
    diagnosed_date: Optional[date] = None
    is_chronic: Optional[bool] = None
    notes: Optional[str] = None

    _en_text = field_validator("condition", "notes")(to_english)


class MedicalHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    history_id: UUID
    patient_id: UUID
    condition: str
    icd_code: Optional[str] = None
    diagnosed_date: Optional[date] = None
    is_chronic: bool
    notes: str


# ---- Allergies ----
class AllergyCreate(BaseModel):
    patient_id: UUID
    allergen: str = Field(..., min_length=1)
    allergy_type: Literal["drug", "food", "environmental", "other"] = "other"
    severity: Literal["Mild", "Moderate", "Severe", "Life-threatening"] = "Mild"
    reaction: str = ""


class AllergyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    allergy_id: UUID
    patient_id: UUID
    allergen: str
    allergy_type: str
    severity: str
    reaction: str
    is_active: bool


# ---- Vitals ----
SugarType = Literal["fasting", "random", "pp"]


class VitalsCreate(BaseModel):
    patient_id: UUID
    appointment_id: Optional[UUID] = None
    family_member_id: Optional[UUID] = None
    bp_systolic: Optional[int] = Field(None, ge=40, le=300)
    bp_diastolic: Optional[int] = Field(None, ge=20, le=200)
    pulse: Optional[int] = Field(None, ge=20, le=300)
    temperature_f: Optional[float] = Field(None, ge=85, le=115)
    spo2: Optional[int] = Field(None, ge=50, le=100)
    respiratory_rate: Optional[int] = Field(None, ge=4, le=80)
    weight_kg: Optional[float] = Field(None, ge=0.5, le=400)
    height_cm: Optional[float] = Field(None, ge=20, le=260)
    blood_sugar: Optional[int] = Field(None, ge=20, le=900)
    sugar_type: Optional[SugarType] = None
    notes: str = ""

    @field_validator("*")
    @classmethod
    def _blank_to_none(cls, v):
        return None if v == "" else v

    _en_notes = field_validator("notes")(to_english)


class VitalsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    vital_id: UUID
    patient_id: UUID
    appointment_id: Optional[UUID] = None
    family_member_id: Optional[UUID] = None
    family_member_name: Optional[str] = None
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    pulse: Optional[int] = None
    temperature_f: Optional[float] = None
    spo2: Optional[int] = None
    respiratory_rate: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    blood_sugar: Optional[int] = None
    sugar_type: Optional[str] = None
    notes: str = ""
    recorded_at: datetime
    recorded_by_name: Optional[str] = None
    # Populated for hospital-wide lists (recent readings across patients).
    patient_name: Optional[str] = None
    patient_uhid: Optional[str] = None
    # Derived (filled by the router via services/vitals.evaluate).
    bmi: Optional[float] = None
    flags: dict = {}
    abnormal: bool = False


# ---- Documents ----
class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    document_id: UUID
    patient_id: UUID
    document_type: str
    description: str = ""
    file_name: str
    file_url: str
    file_size_kb: Optional[int] = None
    mime_type: Optional[str] = None
    appointment_id: Optional[UUID] = None
    # Consultation provenance for hospital-uploaded lab reports.
    doctor_id: Optional[UUID] = None
    doctor_name: Optional[str] = None
    hospital_id: Optional[UUID] = None
    hospital_name: Optional[str] = None
    consultation_date: Optional[date] = None
    created_at: datetime

    _media_file = field_validator("file_url", mode="before")(public_url)


class PatientDetail(PatientOut):
    family_members: List[FamilyMemberOut] = []
    medical_history: List[MedicalHistoryOut] = []
    allergies: List[AllergyOut] = []

    # A removed member is kept (is_active=False) so their records survive; staff
    # views of the patient shouldn't list them as current family.
    @field_validator("family_members", mode="after")
    @classmethod
    def _active_family_only(cls, v: List[FamilyMemberOut]) -> List[FamilyMemberOut]:
        return [m for m in v if m.is_active]
