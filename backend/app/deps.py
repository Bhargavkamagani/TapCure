"""
Auth & authorization dependencies.

  get_current_user      resolve + validate the Bearer access token
  get_optional_user     same but returns None instead of raising
  require_permission     RBAC guard: role must hold (module, action)
  require_role           coarse guard by role name
  ensure_same_tenant     multi-tenant scoping: non-super-admins are confined to
                         their own hospital_id
"""
from uuid import UUID
from typing import Callable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from .database import get_db, parse_uuid
from .models import Permission, RolePermission, User
from .rbac import ROLE_PATIENT, ROLE_RECEPTIONIST, ROLE_SUPER_ADMIN
from .security import credential_stamp, decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

# Its own message, not the generic one: this is the only 401 the app can explain
# to the person holding the phone, and "your session expired" would be a lie.
# The frontend matches on this text to show "signed out — used on another
# device" instead of the usual expiry notice.
SESSION_REPLACED = "Signed out: this account was used to sign in on another device."
_SESSION_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=SESSION_REPLACED,
    headers={"WWW-Authenticate": "Bearer"},
)

# The account's email or password was changed (usually by the hospital admin
# handing the login to someone else). Its own text so the frontend can say so.
CREDENTIALS_CHANGED = "Signed out: this account's login details were changed."
_CREDENTIALS_CHANGED_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail=CREDENTIALS_CHANGED,
    headers={"WWW-Authenticate": "Bearer"},
)

# A front desk runs one login on several machines on purpose, so enforcing a
# single session there would have two clerks logging each other out all day.
_MULTI_SESSION_ROLES = {ROLE_RECEPTIONIST}


def _check_session(user: User, payload: dict) -> None:
    """One signed-in device per account (users.session_id).

    The token carries the session it was minted for; the user row holds the one
    that is current. Logging in anywhere else rewrites the row, so an older
    token stops matching and is refused here — which is how the previous device
    gets signed out without the server having to reach it.

    A user row with no session_id yet is left alone: the column is only ever
    empty for an account that has not logged in since the feature shipped, and
    refusing those would lock out an account nobody can sign into either.

    Before any of that, and for every role including reception: a token minted
    before the account's email or password changed is refused, so the person
    who held a handed-over login is out on their next request rather than when
    the token expires. Tokens from before `cs` existed carry none and pass.
    """
    stamp = payload.get("cs")
    if stamp is not None and stamp != credential_stamp(user.email, user.password_hash):
        raise _CREDENTIALS_CHANGED_ERROR
    if not user.session_id:
        return
    if (user.role.name if user.role else None) in _MULTI_SESSION_ROLES:
        return
    if payload.get("sid") != user.session_id:
        raise _SESSION_ERROR


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise _CREDENTIALS_ERROR
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "access" or "sub" not in payload:
        raise _CREDENTIALS_ERROR
    user_id = parse_uuid(payload["sub"])
    if user_id is None:
        # Also every token issued before ids became UUIDs (integer "sub"):
        # those users simply sign in again.
        raise _CREDENTIALS_ERROR
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _CREDENTIALS_ERROR
    _check_session(user, payload)
    return user


def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "access" or "sub" not in payload:
        return None
    user_id = parse_uuid(payload["sub"])
    if user_id is None:
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active:
        return None
    # A replaced session counts as signed out here too — otherwise the old
    # device would keep being recognised on every endpoint that merely prefers
    # a logged-in user, and quietly act as them.
    try:
        _check_session(user, payload)
    except HTTPException:
        return None
    return user


def require_staff(user: User = Depends(get_current_user)) -> User:
    """Hospital-side only: refuses PATIENT outright.

    `require_permission("token", "read")` is NOT this check. Patients hold that
    permission legitimately — they need their own queue estimate — and the same
    grant then opened every staff view built on it: the full waiting list with
    names, ages, complaints and vitals, for any doctor at any hospital.

    `ensure_same_tenant` does not close it either: it returns early for PATIENT
    (a patient browses hospitals across the whole platform by design), so an
    endpoint whose only scoping is that function is unscoped for every patient
    in the system.

    Use this on anything that answers with OTHER people's data. Endpoints a
    patient legitimately reads about themselves keep their own ownership check
    instead — the point is that the caller only ever sees their own row.
    """
    if user.role and user.role.name == ROLE_PATIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not available to patient accounts",
        )
    return user


def user_has_permission(db: Session, user: User, module: str, action: str) -> bool:
    if user.role and user.role.name == ROLE_SUPER_ADMIN:
        return True
    return bool(
        db.scalar(
            select(
                exists().where(
                    RolePermission.role_id == user.role_id,
                    RolePermission.permission_id == Permission.permission_id,
                    Permission.module == module,
                    Permission.action == action,
                )
            )
        )
    )


def require_permission(module: str, action: str) -> Callable[..., User]:
    """Dependency factory: caller's role must hold (module, action)."""

    def _guard(
        user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ) -> User:
        if not user_has_permission(db, user, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {module}.{action}",
            )
        return user

    return _guard


def require_role(*role_names: str) -> Callable[..., User]:
    def _guard(user: User = Depends(get_current_user)) -> User:
        if not user.role or user.role.name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(role_names)}",
            )
        return user

    return _guard


def ensure_same_tenant(user: User, hospital_id: Optional[UUID]) -> None:
    """Confine hospital staff to their own hospital.

    No-op for SUPER_ADMIN (platform owner) and PATIENT (global marketplace user
    who browses/books across every hospital). Patient-record and patient-appointment
    endpoints enforce per-record ownership separately, so patients still can't
    read other patients' data — only catalog/queue-board data is cross-tenant.
    """
    if user.role and user.role.name in (ROLE_SUPER_ADMIN, ROLE_PATIENT):
        return
    if hospital_id is not None and user.hospital_id != hospital_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-tenant access denied",
        )
