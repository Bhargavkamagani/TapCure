"""
Module 8 — Notification.

notifications        the logical message (type + channel + status)
sms_logs             per-SMS provider delivery record (MSG91/Twilio, DLT template)
whatsapp_logs        per-WhatsApp delivery record (template, read receipts)
email_logs           per-email delivery record (SendGrid/SES)
push_notifications   per-push record (FCM/APNs, deep-link payload)

Dispatch is mocked in Phase 5 (services/notifications.py) — the records and
status lifecycle are real; only the actual provider call is stubbed. Swapping in
MSG91/Twilio/SES later is a single service change.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

NOTIFICATION_TYPES = ("booking", "reminder", "delay", "cancel", "recall", "travel_alert",
                      "almost_turn", "consult_done", "doctor_reg", "doctor_daily",
                      "doctor_day", "otp", "general")
CHANNELS = ("sms", "whatsapp", "email", "push")
NOTIFICATION_STATUSES = ("pending", "sent", "failed", "delivered")


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), index=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), index=True)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"))
    token_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("tokens.token_id"))
    type: Mapped[str] = mapped_column(String(16), default="general")
    # Who this message is FOR. Without it, "everything at this hospital" was the
    # only filter available, so the front desk and every doctor could read
    # messages addressed to patients — including login OTPs.
    #   patient  → only the patient it names
    #   hospital   → front-desk operational (doctor delays, announcements)
    #   staff    → one named user, via recipient_user_id
    #   private  → nobody's feed; a delivery record only (OTP and similar)
    audience: Mapped[str] = mapped_column(String(10), default="patient", index=True)
    recipient_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"), index=True)
    channel: Mapped[str] = mapped_column(String(10), default="sms")
    title: Mapped[str] = mapped_column(String(200), default="")
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    sms_log: Mapped[Optional["SmsLog"]] = relationship(back_populates="notification", cascade="all, delete-orphan", uselist=False)
    whatsapp_log: Mapped[Optional["WhatsappLog"]] = relationship(back_populates="notification", cascade="all, delete-orphan", uselist=False)
    email_log: Mapped[Optional["EmailLog"]] = relationship(back_populates="notification", cascade="all, delete-orphan", uselist=False)
    push_log: Mapped[Optional["PushNotification"]] = relationship(back_populates="notification", cascade="all, delete-orphan", uselist=False)


class SmsLog(Base):
    __tablename__ = "sms_logs"

    sms_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    notification_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("notifications.notification_id"), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(15))
    provider: Mapped[str] = mapped_column(String(50), default="mock")
    provider_msg_id: Mapped[Optional[str]] = mapped_column(String(100))
    template_id: Mapped[Optional[str]] = mapped_column(String(100))  # DLT template (India mandate)
    message_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="queued")  # queued|sent|delivered|failed
    error_code: Mapped[Optional[str]] = mapped_column(String(50))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    cost: Mapped[float] = mapped_column(Numeric(6, 4), default=0)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    notification: Mapped["Notification"] = relationship(back_populates="sms_log")


class WhatsappLog(Base):
    __tablename__ = "whatsapp_logs"

    wa_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    notification_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("notifications.notification_id"), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(15))
    provider: Mapped[str] = mapped_column(String(50), default="mock")
    provider_msg_id: Mapped[Optional[str]] = mapped_column(String(100))
    template_name: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(12), default="sent")  # sent|delivered|read|failed
    error_code: Mapped[Optional[str]] = mapped_column(String(50))
    cost: Mapped[float] = mapped_column(Numeric(6, 4), default=0)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    notification: Mapped["Notification"] = relationship(back_populates="whatsapp_log")


class EmailLog(Base):
    __tablename__ = "email_logs"

    email_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    notification_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("notifications.notification_id"), nullable=False, index=True)
    to_email: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(255), default="")
    provider: Mapped[str] = mapped_column(String(50), default="mock")
    provider_msg_id: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(12), default="queued")  # queued|sent|bounced|failed
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    notification: Mapped["Notification"] = relationship(back_populates="email_log")


class PushNotification(Base):
    __tablename__ = "push_notifications"

    push_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    notification_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("notifications.notification_id"), nullable=False, index=True)
    device_token: Mapped[str] = mapped_column(String(500), default="")
    platform: Mapped[str] = mapped_column(String(10), default="android")  # android|ios|web
    title: Mapped[str] = mapped_column(String(200), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    data_payload: Mapped[Optional[dict]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(12), default="sent")  # sent|failed
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    notification: Mapped["Notification"] = relationship(back_populates="push_log")


class NotificationRead(Base):
    """Per-user read receipt for a notification.

    Read state is per USER, not per notification: a hospital notification is
    visible to several staff at once, and reception marking it read must not
    clear it for the doctor. A row here means "this user has read it"; absence
    means unread. Stored server-side so the state follows the user across
    devices instead of living in one browser's localStorage.
    """

    __tablename__ = "notification_reads"
    __table_args__ = (UniqueConstraint("notification_id", "user_id", name="uq_notification_read"),)

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("notifications.notification_id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("users.user_id"), nullable=False, index=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
