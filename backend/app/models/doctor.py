"""
Module 3 — Doctor.

doctors                  master record (links a user → hospital + department)
doctor_schedule          recurring weekly OP sessions (drives the token engine)
doctor_breaks            intra-session breaks (tea, prayer)
doctor_holidays          one-off days off (full or partial)
doctor_delay_logs        "running late by N mins" → feeds patient SMS + ETA
doctor_leave_requests    multi-day leave with an approval workflow
doctor_status            live presence (available/busy/on_break/...) — 1:1 with doctor
"""
import uuid
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

DOCTOR_STATUSES = ("active", "inactive", "on_leave", "suspended")
PRESENCE_STATUSES = ("available", "busy", "on_break", "away", "off_duty")
LEAVE_TYPES = ("casual", "sick", "conference", "maternity")
LEAVE_STATUSES = ("pending", "approved", "rejected", "cancelled")
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
PRACTICE_TYPES = ("hospital", "personal_practice", "home", "online")
# values stored before 2026-10-25 (migration b2c0ffee0002 rewrote them); still accepted on input
LEGACY_PRACTICE_TYPES = {"clinic": "hospital", "personal_clinic": "personal_practice"}
# Manual credential verification for SELF-REGISTERED (solo) doctors. Hospital-added
# doctors are vouched for by the hospital and default to "verified".
VERIFICATION_STATUSES = ("verified", "pending", "rejected")
# Document kinds a doctor uploads for verification.
DOCTOR_DOC_TYPES = (
    "registration_certificate",  # medical registration / council certificate
    "degree_certificate",        # MBBS/BDS/MD/etc.
    "council_certificate",       # state/national medical council proof
    "id_proof",
    "other",
)


class Doctor(Base):
    __tablename__ = "doctors"

    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"), index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("departments.department_id"), index=True)
    name: Mapped[str] = mapped_column(String(120), default="")  # display name (may differ from login user)
    # first / last name (2026-10-26). `name` stays the full name; services/person_name
    # keeps the three in step on every insert and update.
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    specialization: Mapped[str] = mapped_column(String(100), default="General Physician")
    qualification: Mapped[str] = mapped_column(String(200), default="")
    registration_number: Mapped[Optional[str]] = mapped_column(String(50))
    # HPR ID — Healthcare Professionals Registry ID (ABDM). Optional now; the
    # doctor's national professional identifier (e.g. name@hpr / 14-digit HPID).
    hpr_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    experience_years: Mapped[int] = mapped_column(default=0)
    consultation_fee: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    bio: Mapped[str] = mapped_column(Text, default="")
    profile_photo_url: Mapped[Optional[str]] = mapped_column(String(255))
    # Signature image printed on prescription PDFs (migration d4e0ffee0004).
    # Kept private (signed links only); only the doctor themselves sets it.
    signature_url: Mapped[Optional[str]] = mapped_column(String(255))
    languages: Mapped[str] = mapped_column(String(200), default="")  # comma-separated
    status: Mapped[str] = mapped_column(String(12), default="active")
    is_available_today: Mapped[bool] = mapped_column(Boolean, default=True)
    # ---- Credential verification (solo self-registered doctors) ----
    # Defaults to "verified": existing rows and hospital-onboarded doctors are
    # trusted-by-hospital. Self-registration explicitly sets "pending".
    verification_status: Mapped[str] = mapped_column(String(12), default="verified", index=True)
    is_self_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    documents: Mapped[list["DoctorDocument"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan"
    )
    schedules: Mapped[list["DoctorSchedule"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan"
    )
    holidays: Mapped[list["DoctorHoliday"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan"
    )
    delay_logs: Mapped[list["DoctorDelayLog"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan"
    )
    leave_requests: Mapped[list["DoctorLeaveRequest"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan"
    )
    presence: Mapped[Optional["DoctorStatus"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan", uselist=False
    )
    affiliations: Mapped[list["DoctorAffiliation"]] = relationship(
        back_populates="doctor", cascade="all, delete-orphan"
    )
    login_user: Mapped[Optional["User"]] = relationship(foreign_keys=[user_id])

    @property
    def login_email(self) -> Optional[str]:
        return self.login_user.email if self.login_user else None

    @property
    def has_signature(self) -> bool:
        return bool(self.signature_url)

    @property
    def has_timings(self) -> bool:
        """Has at least one active weekly session at an active practice.

        Without one there is no slot to book, so the patient screens show
        "Not available" instead of a Book button that opens an empty calendar.
        Same rule the public profile uses to list timings per practice.
        """
        active = {a.affiliation_id for a in self.affiliations if a.is_active}
        return any(s.is_active and s.affiliation_id in active for s in self.schedules)


class DoctorDocument(Base):
    """Credential document a doctor uploads for manual verification
    (registration certificate, degree, council proof)."""
    __tablename__ = "doctor_documents"

    document_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    doc_type: Mapped[str] = mapped_column(String(32), default="other")
    label: Mapped[str] = mapped_column(String(120), default="")
    file_url: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_kb: Mapped[int] = mapped_column(default=0)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    doctor: Mapped["Doctor"] = relationship(back_populates="documents")


class DoctorAffiliation(Base):
    __tablename__ = "doctor_affiliations"

    affiliation_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), index=True)
    practice_type: Mapped[str] = mapped_column(String(20), default="hospital")
    name: Mapped[str] = mapped_column(String(150), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    consultation_fee: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    mode: Mapped[str] = mapped_column(String(12), default="slot")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    managed_by_hospital: Mapped[bool] = mapped_column(Boolean, default=True)
    # Free-revisit window for a practice the doctor runs themselves. Read ONLY
    # when managed_by_hospital is False: a hospital-run practice takes the window
    # from hospital_settings, because the hospital owns the fee and so owns the
    # waiver. NULL means "no free revisit offered" — never "inherit a default".
    free_revisit_days: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    doctor: Mapped["Doctor"] = relationship(back_populates="affiliations")


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedule"

    schedule_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    affiliation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("doctor_affiliations.affiliation_id"), index=True)
    day_of_week: Mapped[str] = mapped_column(String(3), nullable=False)  # Mon..Sun
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    max_tokens: Mapped[int] = mapped_column(default=40)
    consultation_mins: Mapped[int] = mapped_column(default=10)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    valid_from: Mapped[Optional[date]] = mapped_column(Date)
    valid_until: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    doctor: Mapped["Doctor"] = relationship(back_populates="schedules")
    breaks: Mapped[list["DoctorBreak"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )


class DoctorBreak(Base):
    __tablename__ = "doctor_breaks"

    break_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    schedule_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctor_schedule.schedule_id"), nullable=False, index=True)
    break_start: Mapped[time] = mapped_column(Time, nullable=False)
    break_end: Mapped[time] = mapped_column(Time, nullable=False)
    label: Mapped[str] = mapped_column(String(50), default="Break")
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    schedule: Mapped["DoctorSchedule"] = relationship(back_populates="breaks")


class DoctorHoliday(Base):
    __tablename__ = "doctor_holidays"

    holiday_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(200), default="")
    is_full_day: Mapped[bool] = mapped_column(Boolean, default=True)
    partial_start: Mapped[Optional[time]] = mapped_column(Time)
    partial_end: Mapped[Optional[time]] = mapped_column(Time)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    doctor: Mapped["Doctor"] = relationship(back_populates="holidays")


class DoctorDelayLog(Base):
    __tablename__ = "doctor_delay_logs"

    delay_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    delay_date: Mapped[date] = mapped_column(Date, nullable=False)
    delay_minutes: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(String(200), default="")
    notified_patients: Mapped[bool] = mapped_column(Boolean, default=False)
    logged_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    doctor: Mapped["Doctor"] = relationship(back_populates="delay_logs")


class DoctorLeaveRequest(Base):
    __tablename__ = "doctor_leave_requests"

    leave_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    leave_from: Mapped[date] = mapped_column(Date, nullable=False)
    leave_to: Mapped[date] = mapped_column(Date, nullable=False)
    leave_type: Mapped[str] = mapped_column(String(16), default="casual")
    reason: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    doctor: Mapped["Doctor"] = relationship(back_populates="leave_requests")


class DoctorStatus(Base):
    __tablename__ = "doctor_status"

    status_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(12), default="off_duty")
    note: Mapped[str] = mapped_column(String(200), default="")
    # FK to tokens added in Phase 4 (Token Engine); plain column until then.
    current_token_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType)
    tokens_served_today: Mapped[int] = mapped_column(default=0)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    doctor: Mapped["Doctor"] = relationship(back_populates="presence")
