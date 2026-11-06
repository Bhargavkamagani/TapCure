"""
Module 1 — Security & Authentication (RBAC + auth tables).

roles ─< role_permissions >─ permissions      (many-to-many permission grants)
users ─> roles, hospitals                      (each user has one role; tenant via hospital_id)
refresh_tokens, login_history, activity_logs   (session + audit trail)
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

USER_STATUSES = ("active", "inactive", "blocked")
LOGIN_STATUSES = ("success", "failed")


class Role(Base):
    __tablename__ = "roles"

    role_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # SUPER_ADMIN, DOCTOR...
    description: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base):
    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("module", "action", name="uq_permission_module_action"),)

    permission_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    module: Mapped[str] = mapped_column(String(50), index=True)   # token, patient, doctor...
    action: Mapped[str] = mapped_column(String(50))               # create, read, update, delete, manage
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    role_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("roles.role_id"), index=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("permissions.permission_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    role: Mapped["Role"] = relationship(back_populates="permissions")
    permission: Mapped["Permission"] = relationship()


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    # Super admins are platform-level (no hospital); everyone else is tenant-scoped.
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDType, ForeignKey("hospitals.hospital_id"), index=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("roles.role_id"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # first / last name (2026-10-26). `name` stays the full name; services/person_name
    # keeps the three in step on every insert and update.
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(15), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(12), default="active")
    # Consent audit — when the user accepted the Terms/Privacy/Refund policies at
    # signup, and which policy version they agreed to (for DPDP auditability).
    terms_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    terms_version: Mapped[Optional[str]] = mapped_column(String(20))
    # One signed-in device per account: the id of the session that is currently
    # allowed. Every login mints a new one, so the access token handed to the
    # previous device stops matching and that device is signed out on its next
    # request. Reception is exempt (see app/deps.py) — a front desk runs the
    # same login on several machines on purpose.
    session_id: Mapped[Optional[str]] = mapped_column(String(36))
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    # The hospital's own staff code. Receptionists keep theirs on their own
    # row (Receptionist.employee_id); pharmacists have no row besides this one.
    employee_id: Mapped[Optional[str]] = mapped_column(String(50))

    role: Mapped["Role"] = relationship()

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    token_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("users.user_id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LoginHistory(Base):
    __tablename__ = "login_history"

    log_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"), index=True)
    ip_address: Mapped[str] = mapped_column(String(45), default="")
    user_agent: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="success")  # success | failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"), index=True)
    action: Mapped[str] = mapped_column(String(100))
    module: Mapped[str] = mapped_column(String(50))
    meta: Mapped[Optional[dict]] = mapped_column("metadata", JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
