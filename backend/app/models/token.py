"""
Module 7 — Token Engine (the core queue).

tokens                  one queue ticket per appointment/walk-in/emergency
token_status_history    every status transition (waiting→current→completed…)
token_movement_logs     queue actions (next/complete/recall/skip/cancel/reorder)
token_recall_history    how many times + how a token was recalled
emergency_queue         priority lane for walk-in emergencies (may be unregistered)

`token_number` is a sequential per-doctor-per-day counter; `display_code` is the
patient-facing label (prefix + number, e.g. CCH-025). `queue_position` (1 = next)
and `estimated_time` are recomputed by services/token_engine.py on every change.
"""
import uuid
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

TOKEN_STATUSES = ("waiting", "current", "completed", "missed", "cancelled", "emergency")
TOKEN_PRIORITIES = ("normal", "urgent", "emergency")
RECALL_METHODS = ("sms", "display", "manual", "pa_announcement")
EMERGENCY_PRIORITIES = ("urgent", "emergency", "critical")
EMERGENCY_STATUSES = ("waiting", "attending", "completed", "referred")
MOVEMENT_ACTIONS = ("next", "complete", "recall", "skip", "cancel", "reorder", "generate")


class Token(Base):
    __tablename__ = "tokens"
    # One number per doctor per day, guaranteed by the database itself — the
    # backstop behind lock_doctor_day() in services/token_engine.py.
    __table_args__ = (
        Index("uq_tokens_doctor_date_number", "doctor_id", "token_date", "token_number", unique=True),
    )

    token_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    affiliation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("doctor_affiliations.affiliation_id"), index=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)

    token_number: Mapped[int] = mapped_column(nullable=False)
    display_code: Mapped[str] = mapped_column(String(20), default="")
    token_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(12), default="waiting", index=True)
    priority: Mapped[str] = mapped_column(String(12), default="normal")
    queue_position: Mapped[int] = mapped_column(default=0)
    estimated_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    wait_duration_mins: Mapped[Optional[int]] = mapped_column()
    consult_duration_mins: Mapped[Optional[int]] = mapped_column()
    is_walkin: Mapped[bool] = mapped_column(Boolean, default=False)
    # Travel origin for this visit (copied from the appointment) + the live
    # "leave-by" reminder flag. travel_minutes is the door-to-hospital estimate;
    # `notified_leave` flips true once the 15-min "time to leave" alert is sent.
    origin_lat: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    origin_lng: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    origin_label: Mapped[str] = mapped_column(String(120), default="")
    travel_minutes: Mapped[Optional[int]] = mapped_column()
    notified_leave: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    patient: Mapped["object"] = relationship("Patient")
    status_history: Mapped[list["TokenStatusHistory"]] = relationship(
        back_populates="token", cascade="all, delete-orphan"
    )
    movement_logs: Mapped[list["TokenMovementLog"]] = relationship(
        back_populates="token", cascade="all, delete-orphan"
    )
    recall: Mapped[Optional["TokenRecallHistory"]] = relationship(
        back_populates="token", cascade="all, delete-orphan", uselist=False
    )


class TokenStatusHistory(Base):
    __tablename__ = "token_status_history"

    history_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    token_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("tokens.token_id"), nullable=False, index=True)
    old_status: Mapped[Optional[str]] = mapped_column(String(12))
    new_status: Mapped[str] = mapped_column(String(12))
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    reason: Mapped[str] = mapped_column(Text, default="")
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    token: Mapped["Token"] = relationship(back_populates="status_history")


class TokenMovementLog(Base):
    __tablename__ = "token_movement_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    token_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("tokens.token_id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(20))
    from_position: Mapped[Optional[int]] = mapped_column()
    to_position: Mapped[Optional[int]] = mapped_column()
    triggered_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    notes: Mapped[str] = mapped_column(String(200), default="")
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    token: Mapped["Token"] = relationship(back_populates="movement_logs")


class TokenRecallHistory(Base):
    __tablename__ = "token_recall_history"

    recall_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    token_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("tokens.token_id"), unique=True, nullable=False)
    recall_count: Mapped[int] = mapped_column(default=0)
    last_recalled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    recall_method: Mapped[str] = mapped_column(String(20), default="display")
    recalled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))

    token: Mapped["Token"] = relationship(back_populates="recall")


class EmergencyQueue(Base):
    __tablename__ = "emergency_queue"

    emergency_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("patients.patient_id"))
    token_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("tokens.token_id"))
    patient_name: Mapped[str] = mapped_column(String(100), default="")  # for unregistered
    patient_phone: Mapped[Optional[str]] = mapped_column(String(15))
    condition_description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(12), default="emergency")
    status: Mapped[str] = mapped_column(String(12), default="waiting", index=True)
    attended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    logged_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
