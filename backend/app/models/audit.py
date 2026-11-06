"""
Module 12 — Audit (immutable system audit trail).

One append-only row per security/data-changing action. Distinct from Module 1's
activity_logs (lightweight) — audit_logs is entity-level with before/after JSON,
IP, user-agent and a request id for tracing. Written by the audit middleware for
every mutating request, plus targeted entries from services where before/after
state matters. Never updated or deleted.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base, UUIDType, new_uuid, utcnow


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"), index=True)
    user_role: Mapped[Optional[str]] = mapped_column(String(50))
    module: Mapped[str] = mapped_column(String(50), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50), index=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, index=True)
    # The integer entity id from before ids became UUIDs (migration a1f0c0de0001).
    legacy_entity_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    old_value: Mapped[Optional[dict]] = mapped_column(JSON)
    new_value: Mapped[Optional[dict]] = mapped_column(JSON)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    request_id: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
