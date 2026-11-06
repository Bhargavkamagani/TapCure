"""Schemas for Module 8 — Notification."""
from uuid import UUID
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

NType = Literal["booking", "reminder", "delay", "cancel", "recall", "travel_alert",
                "almost_turn", "consult_done", "doctor_reg", "doctor_daily",
                "doctor_day", "otp", "general"]


# ---- send requests ----
class SmsSend(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    message: str = Field(..., min_length=1)
    type: NType = "general"
    title: str = ""
    template_id: Optional[str] = None
    hospital_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None


class SmsBulk(BaseModel):
    phones: List[str] = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    type: NType = "general"
    hospital_id: Optional[UUID] = None


class WhatsappSend(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    message: str = Field(..., min_length=1)
    template_name: Optional[str] = None
    template_params: Optional[List[str]] = None
    otp_code: Optional[str] = None
    language_code: Optional[str] = None
    type: NType = "general"
    hospital_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None


class EmailSend(BaseModel):
    to: str
    subject: str = Field(..., min_length=1)
    body: str = ""
    hospital_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None


class PushSend(BaseModel):
    device_token: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    body: str = ""
    platform: Literal["android", "ios", "web"] = "android"
    payload: Optional[dict] = None
    hospital_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None


class PushBulk(BaseModel):
    patient_ids: List[UUID] = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    body: str = ""
    hospital_id: Optional[UUID] = None


class NotificationTest(BaseModel):
    channel: Literal["sms", "whatsapp", "email", "push"]
    phone: Optional[str] = None
    email: Optional[str] = None


class NotificationSettings(BaseModel):
    hospital_id: UUID
    sms_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None


# ---- read models ----
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    notification_id: UUID
    hospital_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    appointment_id: Optional[UUID] = None
    token_id: Optional[UUID] = None
    type: str
    channel: str
    title: str
    message: str
    status: str
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime
    # Per-user read receipt, stamped by the router for the requesting user.
    # Delivery status is NOT read status — a delivered SMS is still unread.
    is_read: bool = False


class SmsLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    sms_id: UUID
    notification_id: UUID
    phone: str
    provider: str
    provider_msg_id: Optional[str] = None
    status: str
    cost: float
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None


class WhatsappLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    wa_id: UUID
    notification_id: UUID
    phone: str
    provider: str
    status: str
    cost: float
    sent_at: Optional[datetime] = None


class EmailLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    email_id: UUID
    notification_id: UUID
    to_email: str
    subject: str
    status: str
    sent_at: Optional[datetime] = None
