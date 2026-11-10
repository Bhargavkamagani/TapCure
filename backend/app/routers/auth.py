"""
Module 1 — Authentication endpoints.

login / logout / refresh (rotating refresh tokens) / change-password /
forgot-password / reset-password / verify-email / register (public patient).
Passwords are bcrypt-hashed; access tokens are short-lived JWTs, refresh tokens
are opaque and stored only as SHA-256 hashes.
"""
from uuid import UUID
import logging
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import EmailStr, TypeAdapter, ValidationError
from uuid import uuid4

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db, parse_uuid, utcnow
from ..deps import _MULTI_SESSION_ROLES, get_current_user, get_optional_user
from ..models import (
    Department, Doctor, DoctorAffiliation, DoctorDocument, DoctorStatus,
    Hospital, HospitalSettings, Patient, RefreshToken, Role, User,
)
from ..rbac import (
    ROLE_DOCTOR, ROLE_HOSPITAL_ADMIN, ROLE_PATIENT, ROLE_PHARMACIST, ROLE_RECEPTIONIST, ROLE_SUPER_ADMIN,
)
from ..schemas.doctor import validate_registration_number
from ..schemas.hospital import HospitalRegister
from ..schemas.security import (
    ChangePasswordRequest, DeleteAccountConfirm, DeleteAccountOtpRequest, DeleteAccountPublic,
    ForgotPasswordRequest, LoginRequest, LoginResponse,
    OtpLogin, OtpRegister, OtpRequest, RefreshRequest, RegisterRequest,
    ResetPasswordRequest, TokenPair, UserOut, VerifyEmailRequest,
)
from ..security import (
    create_access_token, create_purpose_token, credential_stamp, decode_access_token,
    hash_password, hash_token, new_otp, new_refresh_token, refresh_expiry,
    verify_password,
)
from ..services import person_name
from ..services import (
    accounts, attempts, audit, family_link, normalize, otp_store, storage, uhid as uhid_service,
)
from ..services import booking_quota
from ..services import notifications as notify
from ..services import whatsapp_templates

router = APIRouter(prefix="/auth", tags=["auth"])

logger = logging.getLogger("auth")

_PHONE_RE = re.compile(r"^\d{10}$")
# Same check EmailStr runs on the JSON signups; multipart form fields skip it.
_EMAIL = TypeAdapter(EmailStr)
_MAX_EMAIL = 100  # users.email is String(100)


def _require_consent(accepted: bool) -> None:
    """Reject a signup that didn't tick the mandatory Terms/Privacy/Refund box."""
    if not accepted:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Please accept the Terms & Conditions, Privacy Policy and "
            "Cancellation & Refund Policy to continue.",
        )


def _record_consent(user: User) -> None:
    """Stamp the current policy version + timestamp on the user (consent audit)."""
    user.terms_accepted_at = utcnow()
    user.terms_version = settings.terms_version


def _issue_tokens(db: Session, user: User, *, new_session: bool = True) -> TokenPair:
    """Mint an access + refresh pair, and make this the account's ONLY session.

    `new_session=False` is for /auth/refresh: renewing a token is the SAME
    session continuing, so the session id must survive. Rotating it there
    invalidated every access token the client still held — and since a
    mismatched session answers "signed in on another device", a browser with
    two requests in flight when its token expired threw the user out to the
    login screen with an alarming (and untrue) message. Caught by smoke_test.

    Every path into the app lands here — password, OTP, voice, signup — so
    claiming the session in this one place covers all of them.

    Signing in ends whatever session came before: the new `sid` goes on the user
    row and into the token, so the previous device's token no longer matches
    (deps.get_current_user) and is refused on its next request; revoking the old
    refresh tokens stops it quietly renewing itself instead.

    RECEPTIONIST is exempt from the check, not from the bookkeeping: the sid is
    still written and rotated for them, so a front desk keeps working on several
    machines while the column stays ready if that is ever reconsidered.
    """
    if new_session or not user.session_id:
        user.session_id = uuid4().hex
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    access = create_access_token(
        subject=str(user.user_id),
        role=user.role.name if user.role else "",
        extra={"sid": user.session_id, "cs": credential_stamp(user.email, user.password_hash)},
    )
    raw_refresh = new_refresh_token()
    db.add(RefreshToken(user_id=user.user_id, token_hash=hash_token(raw_refresh), expires_at=refresh_expiry()))
    return TokenPair(access_token=access, refresh_token=raw_refresh)


# ---- Refresh token in an HttpOnly cookie --------------------------------------
# The web app used to keep both tokens in localStorage, where any script running
# on the page can read them — one XSS bug and a thirty-day refresh token walks
# out of the door. A browser now asks for cookie transport with this header; the
# refresh token then goes into an HttpOnly cookie page JavaScript cannot read,
# and only the thirty-minute access token is handed to the app (kept in memory).
#
# The header doubles as the CSRF guard: the cookie is only ever READ when the
# header is present, and a custom header cannot be sent cross-origin without a
# CORS preflight that only CORS_ORIGINS pass. SameSite adds a second layer.
#
# Without the header nothing changes: the token comes back in the JSON body and
# is read from the body — scripts, tests and any non-browser client carry on.
_TRANSPORT_HEADER = "x-auth-transport"


def _cookie_mode(request: Request) -> bool:
    return request.headers.get(_TRANSPORT_HEADER, "").strip().lower() == "cookie"


def _cookie_secure(request: Request) -> bool:
    if settings.refresh_cookie_samesite == "none":
        return True  # browsers drop a SameSite=None cookie that is not Secure
    if settings.refresh_cookie_secure is not None:
        return settings.refresh_cookie_secure
    if request.headers.get("x-forwarded-proto", "").lower() == "https":
        return True
    # Plain-http localhost is the dev server; Safari refuses Secure cookies there.
    return not (request.url.scheme == "http" and request.url.hostname in ("localhost", "127.0.0.1"))


def _cookie_attrs(request: Request) -> dict:
    return dict(
        path=settings.refresh_cookie_path,
        domain=settings.refresh_cookie_domain or None,
        secure=_cookie_secure(request),
        httponly=True,
        samesite=settings.refresh_cookie_samesite,
    )


def _deliver(tokens: TokenPair, request: Request, response: Response) -> TokenPair:
    """Hand a freshly issued pair to the client in the transport it asked for."""
    if not _cookie_mode(request):
        return tokens
    response.set_cookie(
        settings.refresh_cookie_name, tokens.refresh_token,
        max_age=settings.refresh_token_expire_days * 24 * 3600,
        **_cookie_attrs(request),
    )
    return TokenPair(access_token=tokens.access_token, refresh_token=None, token_type=tokens.token_type)


def _presented_refresh_token(body: RefreshRequest | None, request: Request) -> str | None:
    """The refresh token from the body, else (cookie clients only) the cookie.

    The body wins so a browser still holding a pre-cookie token in localStorage
    can trade it once for a cookie, and nobody is signed out by the upgrade.
    """
    if body and body.refresh_token:
        return body.refresh_token
    if _cookie_mode(request):
        return request.cookies.get(settings.refresh_cookie_name) or None
    return None


def _user_by_phone(db: Session, phone: str) -> User | None:
    """The single account owning this number, or None.

    `users.phone` has an index but NOT a unique constraint, so two rows can
    hold the same number — there is one such pair in the live data today (a
    hospital admin and a patient). The old lookup took whichever row the
    database happened to return first, which for an OTP login means the code
    sent to that phone can sign the holder into an account that is not theirs.

    Ambiguity is refused rather than guessed: with more than one match this
    returns None, and the caller answers as it would for an unusable number.

    This is the ONLY thing standing between a shared number and a wrong-account
    login. A migration making `users.phone` unique was written and then dropped
    on 2026-09-22 by decision — the database does not enforce one number per
    account, so a duplicate can appear again at any time and this check is what
    catches it. Do not remove it. `python -m scripts.find_duplicate_phones`
    lists any that exist.
    """
    rows = db.scalars(select(User).where(User.phone == phone).order_by(User.user_id)).all()
    if len(rows) != 1:
        if len(rows) > 1:
            logger.error(
                "phone %s belongs to %d accounts (%s) — refusing to guess; clean the duplicates",
                phone, len(rows), ", ".join(str(r.user_id) for r in rows),
            )
        return None
    return rows[0]


def _find_by_identifier(db: Session, ident: str) -> User | None:
    ident = ident.strip()
    if _PHONE_RE.match(ident):
        # Same refusal as the OTP path: a number on two accounts must not pick
        # one of them for you.
        return _user_by_phone(db, ident)
    return db.scalar(select(User).where(User.email == ident.lower())) or db.scalar(
        select(User).where(User.email == ident)
    )


# Which roles each sign-in page is for. A doctor authenticating on the hospital
# page used to succeed and simply get redirected to their own console — the
# credentials are the same either way, so nothing was *breached*, but the desk
# login accepting a doctor is confusing and leaks which accounts exist. The OTP
# path already refused staff numbers; this makes the password path consistent.
_PORTAL_ROLES = {
    "hospital": {ROLE_HOSPITAL_ADMIN, ROLE_RECEPTIONIST, ROLE_PHARMACIST, ROLE_SUPER_ADMIN},
    "clinic": {ROLE_HOSPITAL_ADMIN, ROLE_RECEPTIONIST, ROLE_PHARMACIST, ROLE_SUPER_ADMIN},  # old name of "hospital"
    "doctor": {ROLE_DOCTOR},
}
_WRONG_PORTAL_MSG = "Unable to continue with this login method. Please use the appropriate sign-in option."


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    # Counted per identifier AND per IP: the first stops one account being
    # ground down, the second stops one machine spraying one password across
    # many accounts. Checked before the password is verified, so a locked-out
    # attacker stops costing us a bcrypt hash (218ms of CPU) per guess.
    attempts.check("login", body.identifier, attempts.LOGIN)
    attempts.check("login-ip", ip, attempts.LOGIN_PER_IP)
    user = _find_by_identifier(db, body.identifier)

    if not user or not verify_password(body.password, user.password_hash):
        attempts.record("login", body.identifier)
        attempts.record("login-ip", ip)
        audit.log_login(db, user.user_id if user else None, ip, ua, "failed")
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    attempts.clear("login", body.identifier)
    if not user.is_active:
        hosp = db.get(Hospital, user.hospital_id) if user.hospital_id else None
        if hosp and hosp.status == "pending":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your hospital registration is pending approval.")
        if user.role and user.role.name == ROLE_DOCTOR:
            doc = db.scalar(select(Doctor).where(Doctor.user_id == user.user_id))
            if doc and doc.verification_status == "pending":
                raise HTTPException(status.HTTP_403_FORBIDDEN,
                                    "Your doctor registration is pending verification. "
                                    "You'll be notified once your documents are reviewed.")
            if doc and doc.verification_status == "rejected":
                raise HTTPException(status.HTTP_403_FORBIDDEN,
                                    f"Your registration was not approved. {doc.rejection_reason or ''}".strip())
            if doc and doc.status == "inactive":
                raise HTTPException(status.HTTP_403_FORBIDDEN,
                                    "Your hospital has made your account inactive. Please contact the hospital.")
        if user.status == "suspended":
            raise HTTPException(status.HTTP_403_FORBIDDEN,
                                "This account has been suspended by TapCure. Please contact TapCure support.")
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Account {user.status}")

    # Right credentials, wrong door. Checked AFTER the password so this can't be
    # used to discover which accounts exist — a wrong password still says
    # "Invalid credentials", exactly as before.
    allowed = _PORTAL_ROLES.get(body.portal or "")
    role_name = user.role.name if user.role else None
    if allowed and role_name not in allowed:
        audit.log_login(db, user.user_id, ip, ua, "failed")
        db.commit()
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            _WRONG_PORTAL_MSG,
        )

    tokens = _issue_tokens(db, user)
    user.last_login_at = utcnow()
    audit.log_login(db, user.user_id, ip, ua, "success")
    audit.log_activity(db, user.user_id, "auth.login", "auth")
    db.commit()
    tokens = _deliver(tokens, request, response)
    return LoginResponse(**tokens.model_dump(), user=UserOut.model_validate(user))


@router.post("/register", response_model=LoginResponse, status_code=201)
def register(body: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Public self-registration — always creates a PATIENT."""
    # Per IP, not per email: the whole point of a fake-account run is that each
    # one uses a different address. Five an hour still covers a family signing
    # up on one phone; a script making hundreds does not get through.
    ip = request.client.host if request.client else ""
    attempts.check("register", ip, attempts.REGISTER)
    attempts.record("register", ip)
    _require_consent(body.terms_accepted)
    body.email = accounts.normalize_email(body.email)
    if accounts.email_taken(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if db.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")

    role = db.scalar(select(Role).where(Role.name == ROLE_PATIENT))
    if not role:
        raise HTTPException(500, "PATIENT role not seeded")

    # Self-registering patients don't pick a hospital. Anchor them to one tenant so
    # they can immediately book + view records: the explicit hospital_id if given,
    # else the first active hospital (single-tenant dev / demo default).
    hospital_id = body.hospital_id
    if hospital_id is None:
        default_hosp = db.scalar(
            select(Hospital).where(Hospital.is_active.is_(True)).order_by(Hospital.hospital_id)
        )
        hospital_id = default_hosp.hospital_id if default_hosp else None

    user = User(
        hospital_id=hospital_id, role_id=role.role_id, name=body.name, **person_name.parts(body),
        email=body.email, phone=body.phone, password_hash=hash_password(body.password),
    )
    _record_consent(user)
    db.add(user)
    db.flush()

    # Create the linked Patient record so the patient console has an identity to
    # hang appointments, records and tokens on.
    if hospital_id is not None:
        patient = Patient(
            hospital_id=hospital_id, user_id=user.user_id, name=body.name, **person_name.parts(body),
            phone=body.phone, email=body.email, city=body.city or "",
            abha_number=body.abha_number,
            is_registered=True, registration_source="app",
            uhid=uhid_service.allocate(db),
        )
        db.add(patient)
        db.flush()

    tokens = _issue_tokens(db, user)
    audit.log_activity(db, user.user_id, "auth.register", "auth")
    db.commit()
    db.refresh(user)
    tokens = _deliver(tokens, request, response)
    return LoginResponse(**tokens.model_dump(), user=UserOut.model_validate(user))


def _default_hospital_id(db: Session, given: int | None) -> int | None:
    if given is not None:
        return given
    h = db.scalar(select(Hospital).where(Hospital.is_active.is_(True)).order_by(Hospital.hospital_id))
    return h.hospital_id if h else None


def _otp_key(phone: str) -> str:
    return f"otp:{phone.strip()}"


def _send_doctor_registration_ack(db: Session, phone: str, *, doctor, user, practice: str,
                                  address: str, city: str, hospital_id: UUID | None) -> None:
    """Acknowledge a self-registered doctor's submission on WhatsApp.

    Addressed to the doctor, so it carries `recipient_user_id` — that files it
    under the "staff" audience and keeps a doctor's paperwork out of the patient
    notification feed.
    """
    if not phone:
        return
    params = whatsapp_templates.doctor_registration_params(
        doctor.name, doctor.registration_number, practice,
        whatsapp_templates.location_text("", address, city),
        utcnow().strftime("%d %b %Y"),
    )
    notify.send_whatsapp(
        db, phone,
        f"Registration received for Dr. {params[0]} (Reg. No {params[1]}) at {params[2]}, "
        f"submitted {params[4]}. Your credentials are under review.",
        ntype="doctor_reg", title="Registration Received",
        template_name=whatsapp_templates.doctor_registration_name(), template_params=params,
        language_code=settings.whatsapp_default_lang,
        event_type=whatsapp_templates.DOCTOR_REGISTRATION_EVENT,
        hospital_id=hospital_id, recipient_user_id=user.user_id,
    )


def _include_dev_otp() -> bool:
    """Whether the OTP may be echoed back in the response. Development ONLY.

    This used to be `whatsapp_return_dev_otp OR NOT whatsapp_enabled` — so the
    code handed the OTP to whoever asked whenever WhatsApp was switched off.
    Not a hypothetical: WhatsApp gets switched off for an outage, a billing
    problem or a provider migration, and on that day "forgot password" starts
    returning the reset code for any email, including the platform owner's. A
    security review walked anonymous → reset → signed in as SUPER_ADMIN.

    DEBUG must now be on as well, so a real deployment (DEBUG=false) cannot
    open this hole whatever happens to the WhatsApp settings.
    """
    return bool(settings.debug and settings.whatsapp_return_dev_otp)


def _send_otp_whatsapp(db: Session, phone: str | None, otp: str, *, hospital_id: UUID | None = None,
                       patient_id: UUID | None = None, event_type: str = "otp_login") -> None:
    if not phone:
        return
    notify.send_whatsapp(
        db, phone.strip(), f"Your TapCure OTP is {otp}. It expires in 10 minutes.",
        ntype="otp", title="TapCure OTP", template_name=settings.whatsapp_otp_template,
        otp_code=otp, language_code=settings.whatsapp_default_lang, event_type=event_type,
        hospital_id=hospital_id, patient_id=patient_id,
    )


def _send_otp_email(db: Session, user: User, otp: str) -> bool:
    """Email a one-time code, when the address is one a person actually reads.

    A patient who signed up by mobile has a synthesised `<phone>@mobile.tapcure.in`
    address that routes nowhere, so mailing it would look like a delivery and be
    a black hole. Everyone else — hospital admins, doctors, receptionists — signed
    up WITH an email and often has no phone on the account at all, which is
    exactly who a WhatsApp-only reset leaves stranded.
    """
    email = (user.email or "").strip()
    if not email or accounts.is_synthetic_email(email):
        return False
    try:
        n = notify.send_email(
            db, email, "TapCure password reset code",
            (
                f"Hello {user.name or 'there'},\n\n"
                f"Your TapCure password reset code is {otp}.\n"
                f"It expires in 10 minutes.\n\n"
                "If you did not request this you can ignore this email — "
                "your password has not been changed.\n"
            ),
            ntype="otp",
        )
        return n.status == "sent"
    except Exception:                                 # noqa: BLE001
        # Recovery must not 500 on a mail outage; WhatsApp may still carry it.
        logger.exception("Password-reset email failed for user %s", user.user_id)
        return False


# ---- Mobile-OTP auth (patient self-service). DEMO mode: the OTP is returned in
# the response (`dev_otp`) instead of being sent over SMS. Swap otp_store.put for
# a real SMS gateway call to go live. ------------------------------------------
_STAFF_PHONE_MSG = "Unable to continue with this login method. Please use the appropriate sign-in option."


def _is_review_login(phone: str) -> bool:
    """Is this THE store-review number, with the exception switched on?

    Google Play and Apple both require working credentials, and a reviewer
    cannot receive our WhatsApp OTP: they type a number and the code goes to a
    handset on another continent. Without a way in, the submission is rejected
    as "we could not access your app". `dev_otp` cannot serve — it needs DEBUG,
    and a real server runs DEBUG=false.

    Both settings must be present, so a half-filled .env leaves no exception at
    all, and neither value is in the source: the number and code are changed or
    revoked by editing the server environment, with no release.
    """
    return bool(settings.review_phone and settings.review_otp
                and phone == settings.review_phone)


def _review_otp_ok(phone: str, code: str) -> bool:
    """The fixed code for that one number, compared WITHOUT the OTP store.

    Deliberately not routed through `otp_store`, which would reintroduce three
    ways for a reviewer to be told the app is broken: it expires after ten
    minutes (they read the Play Console instructions in between), it is
    single-use (they test logging out and back in), and it lives in ONE
    process's memory (a second uvicorn worker never sees it). A plain
    comparison has none of those failure modes.

    A WRONG code on this number still falls through to the normal path, so it
    is rate-limited like any other guess — this is not an unlimited oracle.
    """
    return _is_review_login(phone) and code == settings.review_otp


@router.post("/otp/request")
def otp_request(body: OtpRequest, db: Session = Depends(get_db)):
    phone = body.phone.strip()
    review = _is_review_login(phone)
    # Every call here spends a real WhatsApp/SMS message and rings someone's
    # phone. Unlimited, it is both a bill and a way to harass a patient.
    #
    # The review number is exempt because nothing is sent for it: the reviewer
    # sees no message arrive and taps Send again, and on the fifth tap the real
    # limiter would close that number for fifteen minutes — which reads as a
    # broken app and fails the submission. Nobody else is affected.
    if not review:
        # 2026-11-02: a number locked for wrong OTPs can't verify anything for
        # 15 minutes, so sending it a fresh code only spends a WhatsApp message
        # on a code that cannot be used. Refuse the send with the same wait.
        attempts.check("otp-verify", phone, attempts.OTP_VERIFY)
        attempts.check("otp-request", phone, attempts.OTP_REQUEST)
        attempts.record("otp-request", phone)

    # Work out whether this number can be used BEFORE minting an OTP. Sending
    # first and validating afterwards spent a real WhatsApp message — and told
    # the caller nothing until they'd typed a code that could never work. A
    # doctor's number used at the patient login is the clearest case: knowable
    # up front, and the OTP was going to their phone for no reason.
    existing = _user_by_phone(db, phone)
    role_name = existing.role.name if (existing and existing.role) else None
    is_staff = existing is not None and role_name != ROLE_PATIENT
    registered = role_name == ROLE_PATIENT

    blocked = None
    if is_staff:
        blocked = _STAFF_PHONE_MSG
    elif body.mode == "login" and not registered:
        blocked = "This number isn't registered yet. Please sign up."
    elif body.mode == "register" and registered:
        blocked = "This number is already registered. Please log in instead."

    if blocked:
        # No OTP generated, nothing sent, nothing stored.
        return {"message": blocked, "otp_sent": False, "registered": registered, "is_staff": is_staff}

    # Nothing is minted or stored for the review number — the fixed code is
    # compared directly at verify time (see `_review_otp_ok`).
    otp = None
    if not review:
        otp = new_otp()
        otp_store.put(_otp_key(phone), otp)
    # Most recent visit first — a returning patient's newest record is the one
    # whose hospital should brand the OTP, not whichever row has the lowest id.
    patient = db.scalar(
        select(Patient).where(Patient.phone == phone)
        .order_by(Patient.created_at.desc(), Patient.patient_id.desc())
    )
    hospital_id = (patient.hospital_id if patient else None) or _default_hospital_id(db, getattr(body, "hospital_id", None))
    # No message for the review number: it may be an unallocated line, and a
    # reviewer has no handset of ours to receive one on either way.
    if not review:
        _send_otp_whatsapp(db, phone, otp, hospital_id=hospital_id, patient_id=patient.patient_id if patient else None)
    db.commit()
    payload = {
        "message": "An OTP has been sent to your WhatsApp number.",
        "otp_sent": True,
        "registered": registered,
        "is_staff": False,
        # Seen at a hospital desk but never signed up — registering will attach
        # those visits, so the UI can say so instead of "not registered".
        "known_patient": bool(patient and patient.user_id is None),
    }
    if otp is not None and _include_dev_otp():
        payload["dev_otp"] = otp
    return payload


# ---- Patient deletes their own account (Play Store / App Store rule) ---------
# One OTP to the patient's own phone, then services/account_deletion does the
# rest. Two ways in: from the app (logged in) and from the public web page
# /delete-account (phone + OTP, no app needed — the URL Google Play asks for).
# Patients only: staff accounts are closed by their hospital, not here.
_DEL_NOT_FOUND = "No patient account uses this number."


def _del_otp_key(phone: str) -> str:
    return f"otp-del:{phone.strip()}"


def _patient_by_phone(db: Session, phone: str) -> User | None:
    user = _user_by_phone(db, phone)
    if user is None or not user.role or user.role.name != ROLE_PATIENT or not user.is_active:
        return None
    return user


def _check_delete_otp(phone: str, code: str) -> None:
    code = code.strip()
    if _review_otp_ok(phone, code):
        return
    attempts.check("otp-verify", phone, attempts.OTP_VERIFY)
    if not otp_store.verify(_del_otp_key(phone), code):
        attempts.record("otp-verify", phone)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")
    attempts.clear("otp-verify", phone)


def _delete_account(db: Session, user: User, via: str) -> dict:
    from ..services import account_deletion
    result = account_deletion.delete_patient_account(db, user, via=via)
    db.commit()
    account_deletion.remove_files(result["files"])
    return {"message": "Your account has been deleted.",
            "cancelled_appointments": result["cancelled_appointments"]}


@router.post("/delete-account/otp")
def delete_account_otp(body: DeleteAccountOtpRequest, me: User | None = Depends(get_optional_user),
                       db: Session = Depends(get_db)):
    """Send the OTP that confirms an account deletion."""
    if me is not None:
        if not me.role or me.role.name != ROLE_PATIENT:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a patient account can be deleted here.")
        phone = (me.phone or "").strip()
    else:
        phone = (body.phone or "").strip()
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter your mobile number.")
    if _patient_by_phone(db, phone) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _DEL_NOT_FOUND)
    review = _is_review_login(phone)
    if not review:
        attempts.check("otp-verify", phone, attempts.OTP_VERIFY)   # see otp_request
        attempts.check("otp-request", phone, attempts.OTP_REQUEST)
        attempts.record("otp-request", phone)
    otp = None
    if not review:
        otp = new_otp()
        otp_store.put(_del_otp_key(phone), otp)
        patient = db.scalar(select(Patient).where(Patient.phone == phone)
                            .order_by(Patient.created_at.desc(), Patient.patient_id.desc()))
        _send_otp_whatsapp(db, phone, otp, hospital_id=patient.hospital_id if patient else None,
                           # Same OTP template/event as login: the WhatsApp sender needs no change.
                           patient_id=patient.patient_id if patient else None)
    db.commit()
    payload = {"message": "An OTP has been sent to your WhatsApp number.", "otp_sent": True,
               "phone_last4": phone[-4:]}
    if otp is not None and _include_dev_otp():
        payload["dev_otp"] = otp
    return payload


@router.delete("/me/account")
def delete_my_account(body: DeleteAccountConfirm, me: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    """In the app: the logged-in patient deletes their own account."""
    if not me.role or me.role.name != ROLE_PATIENT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a patient account can be deleted here.")
    phone = (me.phone or "").strip()
    if not phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account has no mobile number to confirm with.")
    _check_delete_otp(phone, body.otp)
    return _delete_account(db, me, "app")


@router.post("/delete-account")
def delete_account_public(body: DeleteAccountPublic, db: Session = Depends(get_db)):
    """The public web page: phone + OTP, no login."""
    phone = body.phone.strip()
    _check_delete_otp(phone, body.otp)
    user = _patient_by_phone(db, phone)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _DEL_NOT_FOUND)
    return _delete_account(db, user, "web")


@router.post("/otp/login", response_model=LoginResponse)
def otp_login(body: OtpLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    phone = body.phone.strip()
    # A 6-digit code with unlimited guesses is not a lock. Five wrong tries and
    # this number is closed for a quarter of an hour; a correct one clears the
    # count, and the code itself is single-use either way.
    # The review number's fixed code short-circuits first. A wrong code on it
    # still falls through here and is counted, so guessing is limited as usual.
    if not _review_otp_ok(phone, body.otp.strip()):
        attempts.check("otp-verify", phone, attempts.OTP_VERIFY)
        if not otp_store.verify(_otp_key(phone), body.otp.strip()):
            attempts.record("otp-verify", phone)
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")
        attempts.clear("otp-verify", phone)
    user = _user_by_phone(db, phone)
    if not user:
        raise HTTPException(status.HTTP_403_FORBIDDEN, _STAFF_PHONE_MSG)
    # Mobile-OTP login is for patients only — staff must use email + password.
    if user.role and user.role.name != ROLE_PATIENT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, _STAFF_PHONE_MSG)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Account {user.status}")
    tokens = _issue_tokens(db, user)
    user.last_login_at = utcnow()
    ip = request.client.host if request.client else ""
    audit.log_login(db, user.user_id, ip, request.headers.get("user-agent", ""), "success")
    audit.log_activity(db, user.user_id, "auth.login_otp", "auth")
    db.commit()
    tokens = _deliver(tokens, request, response)
    return LoginResponse(**tokens.model_dump(), user=UserOut.model_validate(user))


@router.post("/otp/register", response_model=LoginResponse, status_code=201)
def otp_register(body: OtpRegister, request: Request, response: Response, db: Session = Depends(get_db)):
    """Create a PATIENT from just name + mobile, verified by OTP (no password/email)."""
    _require_consent(body.terms_accepted)
    phone = body.phone.strip()
    # Registration accepts the review code too — the account has to be created
    # once before a reviewer can ever log in with it.
    # Counted on the same "otp-verify" key as /otp/login: signing up with a
    # walk-in's number claims their whole history, so this needs the same lock,
    # and moving between the two endpoints must not reset the count.
    if not _review_otp_ok(phone, body.otp.strip()):
        attempts.check("otp-verify", phone, attempts.OTP_VERIFY)
        if not otp_store.verify(_otp_key(phone), body.otp.strip()):
            attempts.record("otp-verify", phone)
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")
        attempts.clear("otp-verify", phone)
    existing_user = _user_by_phone(db, phone)
    if existing_user:
        if existing_user.role and existing_user.role.name == ROLE_PATIENT:
            raise HTTPException(status.HTTP_403_FORBIDDEN, _STAFF_PHONE_MSG)
        raise HTTPException(status.HTTP_403_FORBIDDEN, _STAFF_PHONE_MSG)
    role = db.scalar(select(Role).where(Role.name == ROLE_PATIENT))
    if not role:
        raise HTTPException(500, "PATIENT role not seeded")

    # A walk-in desk creates a Patient row with NO user account. When that person
    # later signs up, every such row must be claimed — one person is one User
    # (phone is unique) but may legitimately hold a Patient row at each hospital
    # they've visited (uq_patient_hospital_phone).
    #
    # This used to look only at `_default_hospital_id` — the lowest-id active
    # hospital — so a walk-in at hospital 8 who registered got a brand new record
    # at hospital 1 with a second UHID, while their actual visit history sat
    # orphaned at hospital 8 forever.
    unclaimed = list(db.scalars(
        select(Patient)
        .where(Patient.phone == phone, Patient.user_id.is_(None))
        .order_by(Patient.created_at.desc(), Patient.patient_id.desc())
    ).all())
    # Anchor the account to the hospital they most recently visited, not to
    # whichever hospital happens to have the lowest id.
    hospital_id = unclaimed[0].hospital_id if unclaimed else _default_hospital_id(db, None)
    # Voice registration transcribes name/city in the patient's own script
    # (Telugu/Hindi). Normalize to English before storing so records stay
    # uniformly English — name is transliterated, city snapped to a known
    # spelling. No-ops for text that is already Latin.
    known_cities = list(db.scalars(
        select(Hospital.city).where(Hospital.city != "").distinct()
    ))
    clean_name = normalize.to_english_name(body.name)
    clean_city = normalize.to_english_city(body.city or "", known_cities)
    # No email/password collected — synthesise a unique placeholder email and a
    # random password (the patient authenticates by OTP, never by password).
    synthetic_email = accounts.synthetic_email(phone)
    # `ix_users_email` is UNIQUE and this path only ever checked that the *phone*
    # was free, so a placeholder left behind by an earlier account on this number
    # surfaced as an unhandled IntegrityError — a bare 500 at signup, naming an
    # email the patient never typed. Say what is actually wrong instead.
    if accounts.email_taken(db, synthetic_email):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This mobile number is still linked to an existing account. Contact support.",
        )
    user = User(
        hospital_id=hospital_id, role_id=role.role_id, name=clean_name, **person_name.parts(body),
        email=synthetic_email, phone=phone, password_hash=hash_password(new_refresh_token()),
    )
    _record_consent(user)
    db.add(user)
    db.flush()

    # Claim every walk-in record this person already has, at every hospital. Their
    # visit history, vitals and prescriptions are hung off these rows, so linking
    # them is what actually makes "log in and see your history" true.
    for row in unclaimed:
        row.user_id = user.user_id
        row.is_registered = True
        if not row.name:
            row.name = clean_name
        if clean_city and not row.city:
            row.city = clean_city
        if body.abha_number and not row.abha_number:
            row.abha_number = body.abha_number
        if not row.uhid:
            row.uhid = uhid_service.allocate(db)

    # Only mint a new record when they've never been seen anywhere — otherwise a
    # second row (and a second UHID) for the same person at the same hospital.
    if hospital_id is not None and not any(p.hospital_id == hospital_id for p in unclaimed):
        db.add(Patient(
            hospital_id=hospital_id, user_id=user.user_id, name=clean_name, **person_name.parts(body),
            phone=phone, email=synthetic_email, city=clean_city,
            abha_number=body.abha_number,
            is_registered=True, registration_source="app",
            uhid=uhid_service.allocate(db),
        ))
    db.flush()

    # Someone may already have this person in their family list. Raise the
    # question with that account holder — nothing is linked or shown here, and
    # the new user is told nothing, because a phone match is not proof of who
    # they are.
    family_link.detect_on_register(db, user, phone)

    tokens = _issue_tokens(db, user)
    audit.log_activity(db, user.user_id, "auth.register_otp", "auth")
    db.commit()
    db.refresh(user)
    tokens = _deliver(tokens, request, response)
    return LoginResponse(**tokens.model_dump(), user=UserOut.model_validate(user))


def _unique_short_code(db: Session, name: str) -> str:
    initials = "".join(w[0] for w in name.upper().split() if w)[:6]
    alnum = "".join(ch for ch in name.upper() if ch.isalnum())[:6]
    base = (initials or alnum or "CLN")[:6]
    code, i = base, 1
    while db.scalar(select(Hospital).where(Hospital.short_code == code)):
        code = f"{base[:4]}{i}"
        i += 1
    return code


# Short codes for the services offered on the hospital signup form. Anything not
# listed (the free-text "other service" box) falls back to a derived code.
_SERVICE_DEPT_CODES = {
    "general physician": "GP",
    "general medicine": "GM",
    "pediatrics": "PED",
    "gynecology": "GYN",
    "dermatology": "DERM",
    "orthopedics": "ORTH",
    "cardiology": "CARD",
    "ent": "ENT",
    "ophthalmology": "OPTH",
    "dental": "DENT",
    "physiotherapy": "PHYT",
    "psychiatry": "PSY",
    "nutrition": "NUTR",
}


def _dept_code(name: str, used: set[str]) -> str:
    """Derive a short, unique-per-hospital department code from a service name."""
    known = _SERVICE_DEPT_CODES.get(name.strip().lower())
    if known:
        base = known
    else:
        words = [w for w in "".join(c if c.isalnum() else " " for c in name).split() if w]
        if len(words) > 1:
            base = "".join(w[0] for w in words)[:6].upper()
        elif words:
            base = words[0][:4].upper()
        else:
            base = "DEPT"
    code, i = base, 1
    while code in used:
        code = f"{base[:3]}{i}"
        i += 1
    used.add(code)
    return code


def _departments_from_services(services: list[str]) -> list[Department]:
    """One department per service picked during signup, so the hospital admin's
    Departments page is pre-populated instead of showing a lone 'General OPD'."""
    used: set[str] = set()
    depts: list[Department] = []
    for raw in services:
        name = (raw or "").strip()[:100]
        if not name or any(d.name.lower() == name.lower() for d in depts):
            continue
        depts.append(Department(name=name, code=_dept_code(name, used)))
    # Every hospital needs at least one department to hang doctors/tokens off.
    return depts or [Department(name="General OPD", code="OPD")]


@router.post("/register-hospital", status_code=201)
@router.post("/register-clinic", status_code=201, include_in_schema=False)  # old address
def register_hospital(
    payload: str = Form(..., description="The HospitalRegister fields, as JSON"),
    logo: UploadFile | None = File(None),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """Public hospital onboarding: creates a PENDING hospital + an INACTIVE owner
    admin. The account cannot log in until a Super Admin approves it.

    Multipart since 2026-10-01: the form's fields as JSON in `payload`, plus the
    hospital's LOGO, which is now required. The maps show a hospital by its
    logo, and a pending hospital can't log in to add one later, so it has to come
    with the registration."""
    try:
        body = HospitalRegister.model_validate_json(payload)
    except ValidationError as e:
        # Same 422 shape the JSON endpoint gave, so the form's errors still read.
        raise RequestValidationError(e.errors()) from None
    _require_consent(body.terms_accepted)
    if logo is None or not (logo.filename or "").strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please upload your hospital logo (JPG or PNG).")
    # Checked before anything is created: a bad file must not leave a half-made hospital.
    storage.require_image(logo)
    # Optional hospital photo (public Find Hospitals card), checked up front too.
    has_photo = photo is not None and bool((photo.filename or "").strip())
    if has_photo:
        storage.require_image(photo)
    body.email = accounts.normalize_email(body.email)
    if accounts.email_taken(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if db.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")
    role = db.scalar(select(Role).where(Role.name == ROLE_HOSPITAL_ADMIN))
    if not role:
        raise HTTPException(500, "HOSPITAL_ADMIN role not seeded")

    short = _unique_short_code(db, body.hospital_name)
    hospital = Hospital(
        name=body.hospital_name, short_code=short,
        address=body.address or body.area, city=body.city, state=body.state or "",
        pincode=body.pincode or "",
        latitude=body.latitude, longitude=body.longitude,
        phone=body.phone, email=str(body.email), hfr_id=body.hfr_id,
        # Collected at signup since day one; stored only from f1a7c3e95d24 on.
        registration_number=body.registration_number,
        insurance_partners=body.insurance_partners,
        status="pending", is_active=False,
    )
    settings = HospitalSettings(token_prefix=short, consultation_duration=body.consultation_minutes)
    settings.always_open = bool(body.always_open)
    if settings.always_open:
        # Days are a SEPARATE hard block from the hours (doctors.py), so an
        # always-open hospital has to clear the week too — otherwise a doctor at
        # a 24/7 hospital still gets "this hospital is not open on Sun", which is
        # incoherent and unexplainable to them. Times keep their defaults and
        # are simply not consulted while the flag is on.
        settings.working_days = "Mon,Tue,Wed,Thu,Fri,Sat,Sun"
    else:
        # Working days were asked for at signup and then dropped on the floor —
        # store them so doctor sessions can be checked against the hospital's week.
        if body.working_days:
            settings.working_days = ",".join(d.strip()[:3].title() for d in body.working_days if d.strip())
        if body.open_time:
            settings.op_start_time = body.open_time
        if body.close_time:
            settings.op_end_time = body.close_time
    hospital.settings = settings
    hospital.departments = _departments_from_services(body.services)
    db.add(hospital)
    db.flush()
    try:
        hospital.logo_url, _ = storage.save_upload("hospitals", hospital.hospital_id, logo)
        if has_photo:
            hospital.photo_url, _ = storage.save_upload("hospitals", hospital.hospital_id, photo)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not save the logo. Please try again.")

    admin = User(
        hospital_id=hospital.hospital_id, role_id=role.role_id, name=body.owner_name,
        first_name=person_name.clean(body.owner_first_name) or None, last_name=person_name.clean(body.owner_last_name) or None,
        email=body.email, phone=body.phone, password_hash=hash_password(body.password),
        status="inactive",  # activated on approval
    )
    _record_consent(admin)
    db.add(admin)
    booking_quota.start_pilot(db, hospital.hospital_id)
    audit.log_activity(db, None, "hospital.register", "hospital", {"hospital_id": hospital.hospital_id})
    db.commit()
    return {
        "message": "Registration received. Your hospital is pending approval — "
                   "you'll be notified once it's approved.",
        "hospital_id": hospital.hospital_id,
        "status": "pending",
    }


_ALLOWED_DOC_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf",
}
_DOC_LABELS = {
    "registration_certificate": "Medical registration certificate",
    "degree_certificate": "Degree certificate",
    "council_certificate": "Medical council proof",
    "id_proof": "ID proof",
}


def _require_credential_file(upload: UploadFile) -> None:
    if (upload.content_type or "").lower() not in _ALLOWED_DOC_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Upload a PDF or image (JPG/PNG) for credential documents",
        )


@router.post("/register-doctor", status_code=201)
def register_doctor(
    name: str = Form(""),
    first_name: str = Form(""),
    last_name: str = Form(""),
    email: str = Form(...),
    phone: str = Form(...),
    password: str = Form(...),
    registration_number: str = Form(...),
    specialization: str = Form("General Physician"),
    qualification: str = Form(""),
    hpr_id: str | None = Form(None),
    experience_years: int = Form(0),
    consultation_fee: float = Form(0),
    hospital_name: str = Form(""),
    clinic_name: str = Form(""),  # old name of hospital_name, still accepted
    city: str = Form(""),
    # Where the doctor actually practises. Patients search and sort by distance,
    # and the leave-by ETA is computed from these coordinates — a solo doctor
    # without them can't be placed on a map at all, so this is collected during
    # signup rather than left to a profile edit they may never make.
    address: str = Form(""),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    languages: str = Form(""),
    bio: str = Form(""),
    terms_accepted: bool = Form(False),
    registration_certificate: UploadFile = File(...),
    degree_certificate: UploadFile = File(...),
    council_certificate: UploadFile | None = File(None),
    id_proof: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """Public solo-doctor onboarding: creates a PENDING, INACTIVE doctor with the
    uploaded credential documents. The account can't log in until a Super Admin
    verifies the documents. Hospital-onboarded doctors don't use this path."""
    _require_consent(terms_accepted)
    email = accounts.normalize_email(email)
    if len(email) > _MAX_EMAIL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Email is too long ({_MAX_EMAIL} characters max)")
    try:
        _EMAIL.validate_python(email)
    except ValidationError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid email address") from None
    phone = phone.strip()
    if not _PHONE_RE.match(phone):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter a valid 10-digit mobile number")
    if len(password) < 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 6 characters")
    if not registration_number.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Medical council registration number is required")
    # Multipart form fields skip the Pydantic schema, so the shape check has to
    # be made explicitly here — otherwise this endpoint stays the one way to put
    # a junk registration number into the database.
    try:
        registration_number = validate_registration_number(registration_number)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    if consultation_fee <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Consultation fee must be greater than zero")
    practice_name = (hospital_name or clinic_name).strip()  # clinic_name = old form field name
    if not practice_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hospital name is required")
    address = address.strip()
    if not address:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hospital location is required")
    # Reject nonsense rather than storing a point in the sea. The picker sends
    # coordinates from the Google suggestion; a doctor who typed the address
    # without picking one is geocoded client-side before submitting.
    if latitude is not None and not (-90 <= latitude <= 90):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid latitude")
    if longitude is not None and not (-180 <= longitude <= 180):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid longitude")
    if accounts.email_taken(db, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if db.scalar(select(User).where(User.phone == phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")

    # Validate every provided file up-front (before writing anything).
    files = [
        ("registration_certificate", registration_certificate),
        ("degree_certificate", degree_certificate),
    ]
    if council_certificate is not None:
        files.append(("council_certificate", council_certificate))
    if id_proof is not None:
        files.append(("id_proof", id_proof))
    for _, upload in files:
        _require_credential_file(upload)

    role = db.scalar(select(Role).where(Role.name == ROLE_DOCTOR))
    if not role:
        raise HTTPException(500, "DOCTOR role not seeded")

    # Solo doctors aren't tied to a hospital; anchor them to the default tenant
    # (like self-registering patients) but flag the practice as personal.
    hospital_id = _default_hospital_id(db, None)

    if person_name.clean(first_name):
        name = person_name.join_name(first_name, last_name)
    if not person_name.clean(name):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "First name is required")
    doctor_name_parts = {"first_name": person_name.clean(first_name) or None, "last_name": person_name.clean(last_name) or None} \
        if person_name.clean(first_name) else {}
    user = User(
        hospital_id=hospital_id, role_id=role.role_id, name=name.strip(), **doctor_name_parts,
        email=email, phone=phone, password_hash=hash_password(password),
        status="inactive",  # activated on verification
    )
    _record_consent(user)
    db.add(user)
    db.flush()

    doctor = Doctor(
        name=name.strip(), **doctor_name_parts, user_id=user.user_id, hospital_id=hospital_id,
        specialization=specialization, qualification=qualification,
        registration_number=registration_number.strip(),
        hpr_id=(hpr_id or "").strip() or None,
        experience_years=experience_years, consultation_fee=consultation_fee,
        bio=bio, languages=languages,
        status="inactive",  # operationally hidden until verified
        verification_status="pending", is_self_registered=True,
    )
    doctor.presence = DoctorStatus(status="off_duty")
    db.add(doctor)
    db.flush()

    # Personal-practice affiliation (not managed by any hospital). This row —
    # not the anchor hospital — is the doctor's real location: it's what
    # /discovery hands the patient app for the map pin, the distance sort and
    # the leave-by ETA.
    db.add(DoctorAffiliation(
        doctor_id=doctor.doctor_id, hospital_id=None, practice_type="personal_practice",
        name=practice_name, city=city or "",
        address=address, latitude=latitude, longitude=longitude,
        consultation_fee=consultation_fee, managed_by_hospital=False, is_active=True,
    ))

    # Persist the uploaded credential documents.
    for doc_type, upload in files:
        url, size_kb = storage.save_upload("doctor_docs", doctor.doctor_id, upload)
        db.add(DoctorDocument(
            doctor_id=doctor.doctor_id, doc_type=doc_type,
            label=_DOC_LABELS.get(doc_type, doc_type), file_url=url, file_size_kb=size_kb,
        ))

    # Acknowledge on WhatsApp. Sent before the commit so the notification row is
    # part of the same transaction as the registration — a message can't promise
    # a review of an application that failed to save.
    _send_doctor_registration_ack(
        db, phone, doctor=doctor, user=user, practice=practice_name,
        address=address, city=city, hospital_id=hospital_id,
    )
    audit.log_activity(db, None, "doctor.register", "doctor", {"doctor_id": doctor.doctor_id})
    db.commit()
    return {
        "message": "Registration received. Your documents are pending verification — "
                   "you'll be notified once approved.",
        "doctor_id": doctor.doctor_id,
        "status": "pending",
    }


@router.post("/refresh", response_model=TokenPair)
def refresh(request: Request, response: Response, body: RefreshRequest | None = None,
            db: Session = Depends(get_db)):
    """Rotate: claim the presented refresh token, then issue a fresh pair.

    The claim is a single conditional UPDATE, not read-then-write. It used to
    be: fetch the row, check `revoked`, set `revoked`, commit — with no lock
    between the check and the write. Six requests carrying the SAME stolen
    token all read `revoked=False` within the same instant and all succeeded:
    one token fanned out into six live sessions, which then survived the
    victim's logout. Letting the database do the compare-and-set means exactly
    one caller can flip False->True, and the losers get a 401.

    A failed refresh deliberately leaves the cookie alone. Two tabs refreshing
    at once both send the same cookie; the loser's response clearing it would
    wipe the winner's freshly rotated one and sign the browser out.
    """
    raw_token = _presented_refresh_token(body, request)
    if not raw_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    th = hash_token(raw_token)
    claimed = db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == th,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > utcnow(),
        )
        .values(revoked=True)
    )
    if claimed.rowcount != 1:
        db.rollback()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == th))
    user = db.get(User, rt.user_id) if rt else None
    if not user or not user.is_active:
        db.rollback()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User inactive")
    tokens = _issue_tokens(db, user, new_session=False)
    db.commit()
    return _deliver(tokens, request, response)


@router.post("/logout")
def logout(request: Request, response: Response, body: RefreshRequest | None = None,
           user: User | None = Depends(get_optional_user), db: Session = Depends(get_db)):
    """End the session now, not in thirty minutes.

    Revoking the refresh token only stops NEW access being issued; the access
    token already in the browser stays valid for its full lifetime. For a phone
    left in a taxi that is the whole point of pressing Log out, so the session
    is rotated as well: every token minted for the old session stops matching
    `deps._check_session` on its next request.

    Rotated, deliberately NOT cleared. `_check_session` opens with
    `if not user.session_id: return` — that line exists for accounts which have
    not signed in since one-device-per-account shipped — so blanking the column
    would switch the guard OFF and leave the old token working, which is the
    opposite of what this endpoint promises.

    Receptionists are exempt from one-device (a shared front desk logs in on
    several screens), so rotating here would sign their colleagues out. Their
    tokens are not session-checked at all, so there is nothing to rotate.

    A cookie client is signed out even when its access token has already
    lapsed: a live refresh cookie proves the session as well as the access
    token would, and the cookie is cleared either way. Without that, Log out on
    a tab left open past thirty minutes would leave the cookie able to sign
    straight back in.
    """
    cookie_mode = _cookie_mode(request)
    raw_token = _presented_refresh_token(body, request)
    rt = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))) if raw_token else None
    if user is None and cookie_mode and rt:
        # Liveness checked in SQL, as /refresh does: expires_at reads back naive
        # on SQLite and aware on Postgres, so comparing it in Python is unsafe.
        live = db.scalar(select(RefreshToken.user_id).where(
            RefreshToken.token_hash == rt.token_hash,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > utcnow(),
        ))
        owner = db.get(User, live) if live else None
        if owner and owner.is_active:
            user = owner
    if cookie_mode:
        response.delete_cookie(settings.refresh_cookie_name, **_cookie_attrs(request))
    if user is None:
        if cookie_mode:
            return {"message": "Logged out"}
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if rt and rt.user_id == user.user_id:
        rt.revoked = True
    if (user.role.name if user.role else None) not in _MULTI_SESSION_ROLES:
        user.session_id = uuid4().hex
        db.add(user)
    audit.log_activity(db, user.user_id, "auth.logout", "auth")
    db.commit()
    return {"message": "Logged out"}


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Old password is incorrect")
    user.password_hash = hash_password(body.new_password)
    # Revoke all existing refresh tokens on password change.
    for rt in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.user_id, RefreshToken.revoked == False)):  # noqa: E712
        rt.revoked = True
    audit.log_activity(db, user.user_id, "auth.change_password", "auth")
    db.commit()
    return {"message": "Password updated"}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Counted whether or not the identifier exists, and before the lookup, so
    # the limit itself cannot be used to discover which accounts are real.
    attempts.check("password-reset", body.identifier, attempts.PASSWORD_RESET)
    attempts.record("password-reset", body.identifier)
    user = _find_by_identifier(db, body.identifier)
    # Always respond the same way (don't leak which identifiers exist).
    if user:
        allowed = _PORTAL_ROLES.get(body.portal or "")
        role_name = user.role.name if user.role else None
        # Preserve the non-disclosure response for a valid account presented at
        # the wrong portal, but do not issue a reset credential for it.
        if allowed and role_name not in allowed:
            return {"message": "OTP sent"}
        otp = new_otp()
        otp_store.put(body.identifier.strip().lower(), otp)
        patient = db.scalar(select(Patient).where(Patient.user_id == user.user_id))
        hospital_id = (patient.hospital_id if patient else None) or user.hospital_id or _default_hospital_id(db, None)
        # EMAIL ONLY. A password reset is a staff flow — patients sign in by
        # mobile OTP and never hold a password — and staff are exactly the
        # accounts that often have no phone on file. WhatsApp was silently
        # doing nothing for those 16 users: `_send_otp_whatsapp` returns early
        # on a blank number while the response still says "OTP sent".
        _send_otp_email(db, user, otp)
        db.commit()
        payload = {"message": "OTP sent"}
        if _include_dev_otp():
            payload["dev_otp"] = otp
        return payload
    return {"message": "OTP sent"}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    # Five wrong codes locks this identifier for 15 minutes. Without it the
    # 6-digit code could be guessed for its whole 10 minutes — and these are
    # staff accounts, the Super Admin included.
    identifier = body.identifier.strip().lower()
    attempts.check("reset-verify", identifier, attempts.OTP_VERIFY)
    if not otp_store.verify(identifier, body.otp):
        attempts.record("reset-verify", identifier)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")
    attempts.clear("reset-verify", identifier)
    user = _find_by_identifier(db, body.identifier)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.password_hash = hash_password(body.new_password)
    # A password reset is an account-recovery event: revoke every existing
    # refresh session so a lost or stolen device cannot remain signed in.
    for rt in db.scalars(select(RefreshToken).where(
        RefreshToken.user_id == user.user_id,
        RefreshToken.revoked == False,  # noqa: E712
    )):
        rt.revoked = True
    audit.log_activity(db, user.user_id, "auth.reset_password", "auth")
    db.commit()
    return {"message": "Password reset successful"}


@router.post("/verify-email")
def verify_email(body: VerifyEmailRequest, db: Session = Depends(get_db)):
    payload = decode_access_token(body.token)
    if not payload or payload.get("type") != "verify_email":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid verification token")
    user_id = parse_uuid(payload.get("sub"))
    user = db.get(User, user_id) if user_id else None
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.is_email_verified = True
    db.commit()
    return {"message": "Email verified"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/request-email-verification")
def request_email_verification(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Email a verification token to the address being verified.

    It used to RETURN the token in the response, with no environment gate at
    all: the whole point of verifying an address is proving you can read mail
    sent to it, and handing the proof to whoever asked defeats that. Anyone
    could mark an address they had merely typed — someone else's — as verified.

    The token now only ever travels by email. A synthetic mobile-signup address
    (`{phone}@mobile.tapcure.in`) is refused outright: nothing is deliverable
    there, so "verified" would be a lie.

    Note for whoever finishes this: no screen calls it, and the app has no page
    that accepts the token, so the mail currently carries a value with nowhere
    to paste it. The hole was worth closing now regardless.
    """
    attempts.check("verify-email", str(user.user_id), attempts.PASSWORD_RESET)
    attempts.record("verify-email", str(user.user_id))

    email = (user.email or "").strip()
    if not email or accounts.is_synthetic_email(email):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Add a real email address to your profile before verifying it.",
        )
    if user.is_email_verified:
        return {"message": "This email address is already verified."}

    token = create_purpose_token(str(user.user_id), "verify_email", minutes=60)
    notify.send_email(
        db, email, "Verify your TapCure email address",
        (
            f"Hello {user.name or 'there'},\n\n"
            "Use the code below to confirm this email address. It expires in "
            "one hour.\n\n"
            f"{token}\n\n"
            "If you did not ask for this, you can ignore this email.\n"
        ),
        ntype="general",
    )
    db.commit()
    return {"message": f"A verification email has been sent to {email}."}
