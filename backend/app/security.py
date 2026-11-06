"""
Password hashing (bcrypt) and JWT access tokens.

Replaces the old demo auth that accepted any password and returned a fake
bearer string. Tokens are signed HS256 and carry the user id (`sub`) + role.
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt
from passlib.context import CryptContext

from .config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- Passwords ---------------------------------------------------------------
def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd.verify(plain, hashed)
    except ValueError:
        return False


# --- JWT ---------------------------------------------------------------------
def create_access_token(subject: str, role: str, extra: Optional[dict] = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def credential_stamp(email: Optional[str], password_hash: Optional[str]) -> str:
    """Fingerprint of an account's sign-in details, carried in its access tokens
    (`cs`). Changing the email or password changes it, so every token issued
    before the change stops matching (deps._check_session). Keyed with the
    secret so the token, which the client can read, reveals nothing usable.

    A generated placeholder email (OTP patients) is left out: it is rewritten
    whenever the patient changes their phone, and that must not sign them out."""
    from .services.accounts import is_synthetic_email

    email = "" if is_synthetic_email(email) else (email or "").strip().lower()
    msg = f"{email}\x00{password_hash or ''}".encode()
    return hmac.new(settings.secret_key.encode(), msg, hashlib.sha256).hexdigest()[:16]


def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError:
        return None


def create_purpose_token(subject: str, purpose: str, minutes: int = 60) -> str:
    """Short-lived signed token for one-off flows (e.g. email verification)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject, "type": purpose, "iat": now,
        "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


# --- Refresh tokens (opaque, stored hashed) ----------------------------------
def new_refresh_token() -> str:
    """A high-entropy opaque token handed to the client; only its hash is stored."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """SHA-256 of an opaque token, for at-rest storage (not a password — fast hash ok)."""
    return hashlib.sha256(token.encode()).hexdigest()


def refresh_expiry() -> datetime:
    # Naive UTC to match how datetimes are stored/read (see database.utcnow).
    return datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        days=settings.refresh_token_expire_days
    )


# --- OTP (password reset / verification) -------------------------------------
def new_otp() -> str:
    """6-digit numeric OTP."""
    return f"{secrets.randbelow(1_000_000):06d}"
