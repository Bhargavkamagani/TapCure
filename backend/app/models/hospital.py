"""
Module 2 — Hospital & Department (the tenancy backbone).

Every tenant-scoped table in the platform carries `hospital_id` and ultimately
points back here. A hospital owns its settings (OP hours, token prefix, booking
fee) and its departments (OPD, Cardiology, ...).
"""
import uuid
from datetime import datetime, time
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Numeric, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow


class Hospital(Base):
    __tablename__ = "hospitals"

    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    short_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # token prefix e.g. APL
    address: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    state: Mapped[str] = mapped_column(String(100), default="")
    pincode: Mapped[str] = mapped_column(String(10), default="")
    phone: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(100), default="")
    logo_url: Mapped[Optional[str]] = mapped_column(String(255))
    # Photo of the hospital, shown on the public Find Hospitals cards
    # (migration e5c1a8d3f264). Optional; the cards fall back to the logo.
    photo_url: Mapped[Optional[str]] = mapped_column(String(255))
    # The hospital's own printed letterhead, as images, for the prescription PDF
    # (migration d4e0ffee0004). Optional: without a header the PDF builds one
    # from the name, logo, address and phone above.
    letterhead_header_url: Mapped[Optional[str]] = mapped_column(String(255))
    letterhead_footer_url: Mapped[Optional[str]] = mapped_column(String(255))
    # Secret part of the waiting-room TV link (/tv/<key>), migration e5f0ffee0005.
    # Made the first time the admin opens the link box; replaced by "Make new link".
    display_key: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20))
    # Clinical-establishment licence number, issued by the state/district
    # authority. Collected at signup since day one but, until migration
    # f1a7c3e95d24, never stored — so historic hospitals have NULL here and it
    # cannot be recovered. Formats vary by state; see schemas/common.py.
    registration_number: Mapped[Optional[str]] = mapped_column(String(50))
    # HFR ID — Health Facility Registry ID (ABDM). Optional now; the hospital's
    # national facility identifier. Free-form (formats vary across facility types).
    hfr_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    # Geo-location of the hospital — the destination for the patient travel-time /
    # leave-by calculation (services/token_engine.py). Null until the hospital sets it.
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    # Onboarding lifecycle: pending (awaiting approval) | active | suspended.
    status: Mapped[str] = mapped_column(String(12), default="active", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    settings: Mapped[Optional["HospitalSettings"]] = relationship(
        back_populates="hospital", cascade="all, delete-orphan", uselist=False
    )
    departments: Mapped[list["Department"]] = relationship(
        back_populates="hospital", cascade="all, delete-orphan"
    )


class HospitalSettings(Base):
    __tablename__ = "hospital_settings"

    setting_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("hospitals.hospital_id"), unique=True, nullable=False
    )
    # Open around the clock: the hospital names no window, so its doctors are
    # limited only by their own sessions. op_start_time/op_end_time are kept
    # (and still editable) so a hospital can switch back to fixed hours without
    # having to retype them. Nothing in patient booking reads any of these —
    # see the migration note in e6c3a91f4b72.
    always_open: Mapped[bool] = mapped_column(Boolean, default=False)
    op_start_time: Mapped[time] = mapped_column(Time, default=time(8, 0))
    op_end_time: Mapped[time] = mapped_column(Time, default=time(17, 0))
    lunch_start: Mapped[Optional[time]] = mapped_column(Time)
    lunch_end: Mapped[Optional[time]] = mapped_column(Time)
    # Days the hospital actually opens, e.g. "Mon,Tue,Wed,Thu,Fri,Sat". Collected
    # at signup but previously discarded, so nothing could check a doctor's
    # sessions against it. Blank = open every day (legacy rows).
    working_days: Mapped[str] = mapped_column(String(40), default="Mon,Tue,Wed,Thu,Fri,Sat")
    token_prefix: Mapped[str] = mapped_column(String(10), default="OPD")
    booking_fee: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    # Free patient-initiated reschedules per appointment. NULL = fall back to the
    # platform default (settings.free_reschedules).
    free_reschedules: Mapped[Optional[int]] = mapped_column()
    # Days a patient may return to the SAME doctor free of charge after a paid
    # consultation. NULL = this hospital does not offer it, which is the default —
    # the feature stays dormant until a hospital opts in. See docs/free-revisit-pass.md.
    free_revisit_days: Mapped[Optional[int]] = mapped_column()
    consultation_duration: Mapped[int] = mapped_column(default=10)  # default mins per consult
    max_advance_days: Mapped[int] = mapped_column(default=7)
    emergency_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    # Hospital pharmacy preferences: {"column_map": {our field: their sheet
    # header}, "low_stock_threshold": 10}. The column map is remembered so the
    # pharmacist matches their sheet's columns once, not on every upload.
    pharmacy_config: Mapped[Optional[dict]] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    hospital: Mapped["Hospital"] = relationship(back_populates="settings")


class Department(Base):
    __tablename__ = "departments"

    department_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)   # General OPD, Cardiology
    code: Mapped[str] = mapped_column(String(20), default="")        # OPD, CARD
    description: Mapped[str] = mapped_column(Text, default="")
    floor: Mapped[str] = mapped_column(String(50), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    hospital: Mapped["Hospital"] = relationship(back_populates="departments")
