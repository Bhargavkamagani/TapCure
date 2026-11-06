"""
Support enquiries submitted from the public Contact page.

The Contact form used to be a mock — it showed "message sent" and threw the
input away. Every enquiry is now persisted here first, so nothing is lost even
if the notification email fails or mail is disabled entirely, and the
Super-Admin console reads this table as its inbox.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base, UUIDType, new_uuid, utcnow

SUPPORT_STATUSES = ("new", "in_progress", "resolved")
# Mirrors the "I am a…" selector on the Contact form.
SUPPORT_ROLES = ("Patient", "Doctor", "Hospital", "Other")


class SupportRequest(Base):
    __tablename__ = "support_requests"

    request_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    mobile: Mapped[str] = mapped_column(String(20), default="")
    city: Mapped[str] = mapped_column(String(80), default="")
    # Who says they are writing in — free-ish, kept as text so a new option on
    # the form never rejects a submission.
    role: Mapped[str] = mapped_column(String(40), default="Patient")
    message: Mapped[str] = mapped_column(Text, default="")

    status: Mapped[str] = mapped_column(String(16), default="new", index=True)
    # Set when a super-admin marks it handled.
    handled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    handled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    admin_note: Mapped[str] = mapped_column(Text, default="")

    # Whether the "new enquiry" email actually went out. False is normal when
    # mail is disabled — the enquiry is still safe in this table.
    notified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
