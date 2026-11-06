"""Schemas for Module 1 — Security & Auth."""
from uuid import UUID
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..services.english_text import to_english_name
from .person import NamePartsIn, NamePartsOut
from .patient import _normalize_abha_number


# --- Password policy ---------------------------------------------------------
# Was min_length=6 and nothing else, so "123456" was a valid password for a
# hospital admin. With no lockout at the time (now fixed in services/attempts.py)
# that combination is how accounts fall over at scale.
#
# Deliberately modest: 8 characters, not all one character, and not one of the
# passwords that actually get typed. No forced symbols or mixed case — those
# push people towards "Passw0rd!" and a sticky note, and length is what
# actually matters. Existing passwords are untouched; this applies when one is
# SET or CHANGED.
MIN_PASSWORD_LENGTH = 8
COMMON_PASSWORDS = {
    "password", "password1", "password123", "passw0rd", "qwerty", "qwerty123",
    "123456", "1234567", "12345678", "123456789", "1234567890", "111111",
    "abc123", "letmein", "welcome", "welcome123", "admin", "admin123",
    "admin@123", "super@123", "recep@123", "doctor@123", "patient@123",
    "iloveyou", "changeme", "changeme123", "tapcure", "tapcure123", "tapcure@123",
    "hospital", "hospital123", "clinic123", "monkey", "dragon",
}


def validate_password(value: str) -> str:
    """Shared by every place a password is set. Raises ValueError for pydantic."""
    pw = (value or "").strip()
    if len(pw) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")
    if pw.lower() in COMMON_PASSWORDS:
        raise ValueError("That password is too common — please choose another")
    if len(set(pw)) == 1:
        raise ValueError("Password cannot be the same character repeated")
    return pw



# ---- Tokens ----
class TokenPair(BaseModel):
    access_token: str
    # None when the refresh token went into the HttpOnly cookie instead
    # (a client that sent `X-Auth-Transport: cookie`).
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    # Optional: the web app sends no body and the token travels in its cookie.
    refresh_token: Optional[str] = None


# ---- Auth flows ----
class LoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, description="email or 10-digit phone")
    password: str = Field(..., min_length=1)
    # Which sign-in page this came from, so the server can refuse an account
    # that doesn't belong there. Optional: omitted means "no portal check",
    # which keeps API clients and scripts working as before.
    portal: Optional[Literal["hospital", "doctor", "clinic"]] = None  # "clinic" = old name


def _require_city(v):
    """City is mandatory for patients: it's what puts them in reach of a hospital
    (city search, the landing picker) and what a desk uses to tell two patients
    with the same name apart. Whitespace-only is not a city."""
    text = (v or "").strip()
    if not text:
        raise ValueError("City is required")
    return text


class RegisterRequest(NamePartsIn):
    """Public self-registration (patients). Staff/doctors are created via /users."""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., pattern=r"^\d{10}$")
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    _check_password = field_validator("password")(validate_password)
    hospital_id: Optional[UUID] = None
    city: str = Field(..., min_length=1, max_length=100)
    abha_number: Optional[str] = None  # optional ABHA health ID (14 digits)
    terms_accepted: bool = False  # must be True — user agreed to Terms/Privacy/Refund

    _norm_abha = field_validator("abha_number")(_normalize_abha_number)
    _req_city = field_validator("city")(_require_city)
    # Voice sign-up in Telugu used to store the name/city as spoken (సత్య).
    _en_name = field_validator("name", "city")(to_english_name)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    _check_password = field_validator("new_password")(validate_password)


class ForgotPasswordRequest(BaseModel):
    identifier: str = Field(..., description="email or phone")
    # Same portal rule as login: a doctor can't start a reset from the hospital
    # page. Optional — omitted means no portal check.
    portal: Optional[Literal["hospital", "doctor", "clinic"]] = None  # "clinic" = old name


class ResetPasswordRequest(BaseModel):
    identifier: str
    otp: str = Field(..., min_length=4, max_length=8)
    new_password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    _check_password = field_validator("new_password")(validate_password)


class VerifyEmailRequest(BaseModel):
    token: str


# ---- Mobile-OTP auth (patient, demo OTP) ----
class OtpRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    # What the caller is trying to do, so the server can refuse BEFORE spending
    # an OTP: logging in with an unregistered number, or registering one that is
    # already taken, are both knowable without sending anything. Omitted = send
    # regardless (the old behaviour).
    mode: Optional[Literal["login", "register"]] = None


class OtpLogin(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    otp: str = Field(..., min_length=4, max_length=8)


class DeleteAccountOtpRequest(BaseModel):
    # Omitted when the patient is logged in (their own number is used).
    phone: Optional[str] = Field(None, pattern=r"^\d{10}$")


class DeleteAccountConfirm(BaseModel):
    otp: str = Field(..., min_length=4, max_length=8)


class DeleteAccountPublic(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    otp: str = Field(..., min_length=4, max_length=8)


class OtpRegister(NamePartsIn):
    phone: str = Field(..., pattern=r"^\d{10}$")
    otp: str = Field(..., min_length=4, max_length=8)
    name: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=100)
    abha_number: Optional[str] = None  # optional ABHA health ID (14 digits)
    terms_accepted: bool = False  # must be True — user agreed to Terms/Privacy/Refund

    _norm_abha = field_validator("abha_number")(_normalize_abha_number)
    _req_city = field_validator("city")(_require_city)
    _en_name = field_validator("name", "city")(to_english_name)


# ---- Users ----
class UserBase(NamePartsIn):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, pattern=r"^\d{10}$")


class UserCreate(UserBase):
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    _check_password = field_validator("password")(validate_password)
    role_id: UUID
    hospital_id: Optional[UUID] = None
    status: str = "active"


class UserUpdate(NamePartsIn):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r"^\d{10}$")
    role_id: Optional[UUID] = None
    status: Optional[str] = None


class UserOut(NamePartsOut):
    model_config = ConfigDict(from_attributes=True)
    user_id: UUID
    hospital_id: Optional[UUID] = None
    role_id: UUID
    role_name: Optional[str] = None
    name: str
    email: EmailStr
    phone: Optional[str] = None
    is_email_verified: bool
    status: str
    last_login_at: Optional[datetime] = None
    created_at: datetime


class LoginResponse(TokenPair):
    user: UserOut


# ---- Roles / permissions ----
class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    permission_id: UUID
    module: str
    action: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    role_id: UUID
    name: str
    description: str
    is_active: bool


class RoleWithPermissions(RoleOut):
    permissions: List[PermissionOut] = []


# ---- Audit views ----
class LoginHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: UUID
    user_id: Optional[UUID] = None
    ip_address: str
    user_agent: str
    status: str
    created_at: datetime


class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: UUID
    user_id: Optional[UUID] = None
    action: str
    module: str
    meta: Optional[dict] = None
    created_at: datetime
