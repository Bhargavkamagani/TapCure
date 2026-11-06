"""Account identity rules shared by every path that creates a login.

`users.email` is UNIQUE, but Postgres compares it byte-for-byte — so
`Ganika@gmail.com` and `ganika@gmail.com` are two different values and the
constraint waves both through. Every signup route also compared the raw string,
so the duplicate check missed for exactly the same reason. One person then owns
two accounts, and which one they reach at login depends on how they capitalised
their email that day.

Both halves of the rule live here so a new signup route can't reintroduce it:
store the normalized form, and compare case-insensitively against what's already
stored (which still includes mixed-case rows created before this existed).
"""
from __future__ import annotations
from uuid import UUID

import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import User


def normalize_email(value: str | None) -> str:
    """The canonical stored form: trimmed and lower-cased.

    Only the domain is case-insensitive per the RFCs; in practice every mailbox
    provider treats the local part that way too, and users type their address
    however their keyboard felt at the time.
    """
    return (value or "").strip().lower()


def email_owner(db: Session, email: str, *, exclude_user_id: UUID | None = None) -> User | None:
    """The user already holding this address, ignoring case. None if free."""
    normalized = normalize_email(email)
    if not normalized:
        return None
    stmt = select(User).where(func.lower(User.email) == normalized)
    if exclude_user_id is not None:
        stmt = stmt.where(User.user_id != exclude_user_id)
    return db.scalars(stmt.limit(1)).first()


def email_taken(db: Session, email: str, *, exclude_user_id: UUID | None = None) -> bool:
    return email_owner(db, email, exclude_user_id=exclude_user_id) is not None


# ---------------------------------------------------------------------------
# Synthetic emails
# ---------------------------------------------------------------------------
# A patient who signs up by mobile OTP gives no email, but `users.email` is NOT
# NULL *and* UNIQUE — so signup has to invent one. The domain is deliberately
# ours: an invented `@gmail.com` address would be a real mailbox belonging to a
# stranger, while nothing addressed here can ever leave the building.
SYNTHETIC_EMAIL_DOMAIN = "mobile.tapcure.in"


def synthetic_email(phone: str) -> str:
    """The placeholder address for an OTP-only account."""
    return f"{(phone or '').strip()}@{SYNTHETIC_EMAIL_DOMAIN}"


def is_synthetic_email(email: str | None) -> bool:
    """True only for a placeholder this app generated.

    Every rewrite of a stored email keys off this: a patient who signed up with
    their own address must never have it silently replaced, so anything not
    ending in our placeholder domain is left exactly as the person typed it.
    """
    return normalize_email(email).endswith(f"@{SYNTHETIC_EMAIL_DOMAIN}")


# ---------------------------------------------------------------------------
# Phone numbers
# ---------------------------------------------------------------------------
PHONE_RE = re.compile(r"^\d{10}$")


def phone_owner(db: Session, phone: str, *, exclude_user_id: UUID | None = None) -> User | None:
    """The user already holding this number. None if free.

    `users.phone` carries only a plain index, not a unique constraint, so
    nothing at the database level stops two accounts sharing a number — and
    login resolves a phone with `scalar()`, which returns whichever row comes
    back first. Two accounts on one number therefore means signing in to an
    arbitrary one of them, so every write of a phone checks here first.
    """
    cleaned = (phone or "").strip()
    if not cleaned:
        return None
    stmt = select(User).where(User.phone == cleaned)
    if exclude_user_id is not None:
        stmt = stmt.where(User.user_id != exclude_user_id)
    return db.scalars(stmt.limit(1)).first()


def change_phone(db: Session, user: User, new_phone: str) -> str:
    """Move a person's mobile number everywhere that number *identifies* them.

    One number is stored in several columns, and they are read by different
    features — login resolves `users.phone`, every reminder resolves
    `patients.phone` — so updating one and not the others is what produced the
    "I changed my number and messages still go to the old one" reports. This is
    the single writer; no route should set a phone column directly.

    What moves, and what deliberately does not:

    * `users.phone` and **every** `patients` row linked to this user. A person
      holds one login but one patient record per hospital they have visited, so
      the rows are found by `user_id` — matching on the old number would miss
      any row that had already drifted.
    * The synthetic email on both tables, but only when it is still a generated
      placeholder: it has the old number baked into it, and leaving it behind
      keeps the old address occupying the UNIQUE index — which is what makes a
      later signup on the freed number fail.
    * Dependents whose own number *was* the account holder's. `notify_to='own'`
      with the account's number is a copy, not a separate line, so it follows.
      A dependent with a genuinely different number is untouched.
    * `sms_logs` / `whatsapp_logs` are never touched. They record where a
      message actually went at the time, and that stays true forever.

    Returns the cleaned number. Raises 400 on a malformed number and 409 when
    the number (or the placeholder email derived from it) is already taken.
    """
    from fastapi import HTTPException, status

    from ..models import FamilyMember, Patient

    cleaned = (new_phone or "").strip()
    if not PHONE_RE.match(cleaned):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone must be exactly 10 digits")

    old_phone = (user.phone or "").strip()
    if cleaned == old_phone:
        return cleaned

    if phone_owner(db, cleaned, exclude_user_id=user.user_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered to another user")

    rows = list(db.scalars(select(Patient).where(Patient.user_id == user.user_id)).all())

    # `uq_patient_hospital_phone` would raise this as an unreadable 500 at commit
    # time. Check it up front, per hospital, so the caller gets a real message.
    hospital_ids = {r.hospital_id for r in rows if r.hospital_id is not None}
    if hospital_ids:
        clash = db.scalars(
            select(Patient).where(
                Patient.phone == cleaned,
                Patient.hospital_id.in_(hospital_ids),
                Patient.patient_id.notin_([r.patient_id for r in rows]),
            ).limit(1)
        ).first()
        if clash:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Another patient at this hospital already uses that phone number",
            )

    new_email = synthetic_email(cleaned)
    rewrite_email = is_synthetic_email(user.email) or any(is_synthetic_email(r.email) for r in rows)
    if rewrite_email and email_taken(db, new_email, exclude_user_id=user.user_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered to another user")

    user.phone = cleaned
    if is_synthetic_email(user.email):
        user.email = new_email

    for row in rows:
        row.phone = cleaned
        if is_synthetic_email(row.email):
            row.email = new_email

    # A dependent riding on the account holder's line kept a literal copy of the
    # old number, and `reminder_phone` reads it whenever notify_to='own'.
    if old_phone and rows:
        members = db.scalars(
            select(FamilyMember).where(
                FamilyMember.patient_id.in_([r.patient_id for r in rows]),
                FamilyMember.notify_to == "own",
                FamilyMember.phone == old_phone,
            )
        ).all()
        for member in members:
            member.phone = cleaned

    db.flush()
    return cleaned


def update_staff_login(
    db: Session,
    user: User,
    *,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    password: str | None = None,
) -> None:
    """Hospital admin edits a staff login (receptionist / pharmacist).

    The common case is a hand-over: someone leaves and the same account is
    given to their replacement with a new name, email, phone and password. So
    whenever the email or password changes, every existing session of the
    account is ended: refresh tokens are revoked and the session id rotated,
    which leaves the previous person unable to renew their access.

    `phone=""` clears the number (staff phones are optional). Raises 409 when
    the email or phone already belongs to another account.
    """
    from fastapi import HTTPException, status

    from ..security import hash_password

    signed_out = False
    if name is not None:
        user.name = name
    if email is not None:
        normalized = normalize_email(email)
        if normalized != normalize_email(user.email):
            if email_taken(db, normalized, exclude_user_id=user.user_id):
                raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
            user.email = normalized
            user.is_email_verified = False
            signed_out = True
    if phone is not None:
        cleaned = phone.strip()
        if cleaned and phone_owner(db, cleaned, exclude_user_id=user.user_id):
            raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")
        user.phone = cleaned or None
    if password:
        user.password_hash = hash_password(password)
        signed_out = True
    if signed_out:
        end_sessions(db, user)


def end_sessions(db: Session, user: User) -> None:
    """Sign an account out everywhere: no refresh token can be used again, and
    single-session roles lose their current access token immediately."""
    from uuid import uuid4

    from ..models import RefreshToken

    for rt in db.scalars(select(RefreshToken).where(
        RefreshToken.user_id == user.user_id,
        RefreshToken.revoked == False,  # noqa: E712
    )):
        rt.revoked = True
    user.session_id = str(uuid4())


def set_walkin_phone(db: Session, patient, new_phone: str) -> str:
    """Validate a new number for a patient row that has no login behind it.

    Reception registers walk-ins who never sign up, so `patients.user_id` is
    NULL and there is no `users` row to keep in step — this row *is* the whole
    record. It still has to clear the same shape rule and the same per-hospital
    uniqueness constraint as the linked path, so the two routes can't disagree
    about what a valid number is. Returns the cleaned number for the caller to
    assign; it deliberately writes nothing itself.
    """
    from fastapi import HTTPException, status

    from ..models import Patient

    cleaned = (new_phone or "").strip()
    if not PHONE_RE.match(cleaned):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone must be exactly 10 digits")
    if cleaned == (patient.phone or "").strip():
        return cleaned
    if patient.hospital_id is not None:
        clash = db.scalars(
            select(Patient).where(
                Patient.phone == cleaned,
                Patient.hospital_id == patient.hospital_id,
                Patient.patient_id != patient.patient_id,
            ).limit(1)
        ).first()
        if clash:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Another patient at this hospital already uses that phone number",
            )
    return cleaned
