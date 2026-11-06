from uuid import UUID
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SupportContactIn(BaseModel):
    """Public Contact-page submission. Bounded lengths because this endpoint is
    unauthenticated — it must not become a way to write unbounded rows."""
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    mobile: str = Field("", max_length=20)
    city: str = Field("", max_length=80)
    role: str = Field("Patient", max_length=40)
    message: str = Field(..., min_length=1, max_length=4000)


class SupportRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_id: UUID
    name: str
    email: str
    mobile: str
    city: str
    role: str
    message: str
    status: str
    admin_note: str
    handled_by: Optional[UUID] = None
    handled_at: Optional[datetime] = None
    notified: bool
    created_at: datetime


class SupportRequestUpdate(BaseModel):
    status: Optional[Literal["new", "in_progress", "resolved"]] = None
    admin_note: Optional[str] = Field(None, max_length=2000)
