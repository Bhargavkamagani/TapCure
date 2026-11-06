"""Schemas for Module 12 — Audit."""
from uuid import UUID
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: UUID
    hospital_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    user_role: Optional[str] = None
    module: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    ip_address: Optional[str] = None
    request_id: Optional[str] = None
    created_at: datetime
