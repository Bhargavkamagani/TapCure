"""
Module 1 — User management + roles + audit views.

Tenant-scoped: a HOSPITAL_ADMIN only sees/creates users within their own
hospital and can never mint a SUPER_ADMIN. SUPER_ADMIN sees everything.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_permission, user_has_permission
from ..models import ActivityLog, LoginHistory, Permission, Role, RolePermission, User
from ..rbac import ROLE_SUPER_ADMIN
from ..schemas.security import (
    ActivityLogOut, LoginHistoryOut, RoleWithPermissions, UserCreate, UserOut, UserUpdate,
)
from ..security import hash_password
from ..services import person_name
from ..services import accounts, audit

router = APIRouter(tags=["users & roles"])


def _is_super(user: User) -> bool:
    return bool(user.role and user.role.name == ROLE_SUPER_ADMIN)


# ---- Users ------------------------------------------------------------------
@router.get("/users", response_model=list[UserOut])
def list_users(
    role_id: UUID | None = Query(None),
    hospital_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission("user", "read")),
    db: Session = Depends(get_db),
):
    stmt = select(User)
    if not _is_super(me):
        stmt = stmt.where(User.hospital_id == me.hospital_id)  # tenant scope
    elif hospital_id is not None:
        stmt = stmt.where(User.hospital_id == hospital_id)
    if role_id is not None:
        stmt = stmt.where(User.role_id == role_id)
    stmt = stmt.order_by(User.user_id).offset((page - 1) * size).limit(size)
    return db.scalars(stmt).all()


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: UUID, me: User = Depends(require_permission("user", "read")), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or (not _is_super(me) and user.hospital_id != me.hospital_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, me: User = Depends(require_permission("user", "create")), db: Session = Depends(get_db)):
    role = db.get(Role, body.role_id)
    if not role:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role_id")
    if role.name == ROLE_SUPER_ADMIN and not _is_super(me):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot create a SUPER_ADMIN")
    body.email = accounts.normalize_email(body.email)
    if accounts.email_taken(db, body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if body.phone and db.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")

    # Non-super-admins are pinned to their own tenant.
    hospital_id = body.hospital_id if _is_super(me) else me.hospital_id

    user = User(
        hospital_id=hospital_id, role_id=body.role_id, name=body.name, **person_name.parts(body),
        email=body.email, phone=body.phone, status=body.status or "active",
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()
    audit.log_activity(db, me.user_id, "user.create", "user", {"user_id": user.user_id})
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: UUID, body: UserUpdate, me: User = Depends(require_permission("user", "update")), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or (not _is_super(me) and user.hospital_id != me.hospital_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    data = body.model_dump(exclude_unset=True)
    # Editing an email had NO uniqueness check at all: an exact clash blew up as
    # a 500 from the DB constraint, and a case-variant slipped through and became
    # the duplicate account this guards against on create.
    if data.get("email"):
        data["email"] = accounts.normalize_email(data["email"])
        if accounts.email_taken(db, data["email"], exclude_user_id=user_id):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if "role_id" in data:
        role = db.get(Role, data["role_id"])
        if not role:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role_id")
        if role.name == ROLE_SUPER_ADMIN and not _is_super(me):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot assign SUPER_ADMIN")
    # A phone is never a plain column write: the same number identifies this
    # person in `patients` (and in the placeholder email built from it), and
    # setting it here alone is what left changed numbers half-applied — login on
    # the new number, every reminder still going to the old one.
    new_phone = data.pop("phone", None)
    if new_phone is not None:
        accounts.change_phone(db, user, new_phone)
    for k, v in data.items():
        setattr(user, k, v)
    audit.log_activity(db, me.user_id, "user.update", "user", {"user_id": user_id})
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def deactivate_user(user_id: UUID, me: User = Depends(require_permission("user", "delete")), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or (not _is_super(me) and user.hospital_id != me.hospital_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    user.status = "inactive"
    audit.log_activity(db, me.user_id, "user.deactivate", "user", {"user_id": user_id})
    db.commit()
    return {"message": "User deactivated"}


# ---- Roles ------------------------------------------------------------------
@router.get("/roles", response_model=list[RoleWithPermissions])
def list_roles(me: User = Depends(require_permission("role", "read")), db: Session = Depends(get_db)):
    roles = db.scalars(select(Role).order_by(Role.role_id)).all()
    out = []
    for r in roles:
        perms = db.scalars(
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.permission_id)
            .where(RolePermission.role_id == r.role_id)
        ).all()
        out.append(RoleWithPermissions(
            role_id=r.role_id, name=r.name, description=r.description,
            is_active=r.is_active, permissions=perms,
        ))
    return out


# ---- Audit views ------------------------------------------------------------
def _own_or_auditor(db: Session, me: User, user_id: UUID | None) -> int:
    """Whose logs the caller may read: their own, or anyone's with audit.read.

    The comment below used to promise this check while nothing enforced it —
    `target = user_id if user_id is not None else me.user_id` took whatever was
    asked for. `GET /login-history?user_id=2` therefore returned any user's
    sign-in times, IP addresses and devices to ANY logged-in account, including
    a patient anyone can self-register: surveillance of hospital staff from the
    outside. `/activity-logs` had the same shape — who did what, when, across
    the platform.
    """
    target = me.user_id if user_id is None else user_id
    if target != me.user_id and not user_has_permission(db, me, "audit", "read"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own history",
        )
    return target


@router.get("/login-history", response_model=list[LoginHistoryOut])
def login_history(
    user_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Users can see their own history; admins (audit.read) can see anyone's.
    target = _own_or_auditor(db, me, user_id)
    stmt = select(LoginHistory).where(LoginHistory.user_id == target)
    stmt = stmt.order_by(LoginHistory.log_id.desc()).offset((page - 1) * size).limit(size)
    return db.scalars(stmt).all()


@router.get("/activity-logs", response_model=list[ActivityLogOut])
def activity_logs(
    user_id: UUID | None = Query(None),
    module: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target = _own_or_auditor(db, me, user_id)
    stmt = select(ActivityLog).where(ActivityLog.user_id == target)
    if module:
        stmt = stmt.where(ActivityLog.module == module)
    stmt = stmt.order_by(ActivityLog.log_id.desc()).offset((page - 1) * size).limit(size)
    return db.scalars(stmt).all()
