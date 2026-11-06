"""
Module 5 — Patient.

patients            master record (phone = primary identifier for rural patients)
family_members      dependents booked under one patient
medical_history     chronic/past conditions (ICD-coded)
allergies           allergen + severity
patient_documents   uploaded files (prescriptions, lab reports, scans, id proof)

Multi-tenant note: the deck marks patient.phone UNIQUE; here it's unique
*per hospital* (composite) so the same person can exist across tenants. An
optional user_id links a patient to their app-login account (self-service).
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

GENDERS = ("Male", "Female", "Other")
REGISTRATION_SOURCES = ("app", "whatsapp", "csc", "walkin", "phone")
ALLERGY_TYPES = ("drug", "food", "environmental", "other")
ALLERGY_SEVERITIES = ("Mild", "Moderate", "Severe", "Life-threatening")
DOCUMENT_TYPES = ("prescription", "lab_report", "scan", "id_proof", "other")


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (UniqueConstraint("hospital_id", "phone", name="uq_patient_hospital_phone"),)

    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    # Human-facing lifetime identifier (e.g. "DM-7F3K9Q2"). Globally unique,
    # generated once at creation. See services/uhid.py. Nullable at the DB level
    # only so the column could be backfilled onto existing rows.
    uhid: Mapped[Optional[str]] = mapped_column(String(20), unique=True, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"), index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    # first / last name (2026-10-26). `name` stays the full name; services/person_name
    # keeps the three in step on every insert and update.
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(15), nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(100))
    # ABHA (Ayushman Bharat Health Account) — optional now, will become the
    # national health identifier going forward. abha_number is the 14-digit ID
    # (stored digits-only); abha_address is the PHR handle (e.g. name@abdm).
    abha_number: Mapped[Optional[str]] = mapped_column(String(17), index=True)
    abha_address: Mapped[Optional[str]] = mapped_column(String(64))
    dob: Mapped[Optional[date]] = mapped_column(Date)
    age: Mapped[Optional[int]] = mapped_column()
    gender: Mapped[Optional[str]] = mapped_column(String(8))
    blood_group: Mapped[Optional[str]] = mapped_column(String(5))
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))   # profile photo (uploaded)
    address: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    pincode: Mapped[str] = mapped_column(String(10), default="")
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(100))
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(15))
    preferred_language: Mapped[str] = mapped_column(String(50), default="English")
    is_registered: Mapped[bool] = mapped_column(Boolean, default=False)  # verified vs walk-in
    registration_source: Mapped[str] = mapped_column(String(12), default="walkin")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    family_members: Mapped[list["FamilyMember"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    medical_history: Mapped[list["MedicalHistory"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    allergies: Mapped[list["Allergy"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    documents: Mapped[list["PatientDocument"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    vitals: Mapped[list["PatientVital"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )


class FamilyMember(Base):
    __tablename__ = "family_members"

    member_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # first / last name (2026-10-26). `name` stays the full name; services/person_name
    # keeps the three in step on every insert and update.
    first_name: Mapped[Optional[str]] = mapped_column(String(100))
    last_name: Mapped[Optional[str]] = mapped_column(String(100))
    relation: Mapped[str] = mapped_column(String(50), default="")
    phone: Mapped[Optional[str]] = mapped_column(String(15))
    # Where this member's reminders go: 'account' = the account holder's phone
    # (default), 'own' = this member's own `phone`. See services.notifications
    # .reminder_phone(), the single resolver used by every send.
    notify_to: Mapped[str] = mapped_column(String(8), default="account", server_default="account")
    # A dependent may also hold their own login. `linked_user_id` names that
    # account and `link_status` records how far the two-sided consent got, so a
    # phone match on its own never grants anyone sight of these records.
    linked_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDType, ForeignKey("users.user_id"), index=True)
    link_status: Mapped[str] = mapped_column(String(16), default="none", server_default="none")
    dob: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(8))
    blood_group: Mapped[Optional[str]] = mapped_column(String(5))
    photo_url: Mapped[Optional[str]] = mapped_column(String(500))   # profile photo (uploaded)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="family_members")


class MedicalHistory(Base):
    __tablename__ = "medical_history"

    history_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    condition: Mapped[str] = mapped_column(String(200), nullable=False)
    icd_code: Mapped[Optional[str]] = mapped_column(String(20))
    diagnosed_date: Mapped[Optional[date]] = mapped_column(Date)
    is_chronic: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="medical_history")


class Allergy(Base):
    __tablename__ = "allergies"

    allergy_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    allergen: Mapped[str] = mapped_column(String(100), nullable=False)
    allergy_type: Mapped[str] = mapped_column(String(16), default="other")
    severity: Mapped[str] = mapped_column(String(20), default="Mild")
    reaction: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="allergies")


class PatientVital(Base):
    """A single set of vitals captured for a patient (usually by the nurse /
    reception at check-in, tied to that day's visit). Stored over time so the
    doctor can see trends. All measures optional — staff record what they took."""
    __tablename__ = "patient_vitals"

    vital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"), index=True)
    # Set when this reading is for a dependent booked under the patient's account.
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("family_members.member_id"), index=True)
    bp_systolic: Mapped[Optional[int]] = mapped_column()        # mmHg (upper)
    bp_diastolic: Mapped[Optional[int]] = mapped_column()       # mmHg (lower)
    pulse: Mapped[Optional[int]] = mapped_column()              # bpm
    temperature_f: Mapped[Optional[float]] = mapped_column(Numeric(4, 1))  # °F
    spo2: Mapped[Optional[int]] = mapped_column()              # %
    respiratory_rate: Mapped[Optional[int]] = mapped_column()  # breaths/min
    weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(5, 1))
    height_cm: Mapped[Optional[float]] = mapped_column(Numeric(5, 1))
    blood_sugar: Mapped[Optional[int]] = mapped_column()        # mg/dL
    sugar_type: Mapped[Optional[str]] = mapped_column(String(10))  # fasting/random/pp
    notes: Mapped[str] = mapped_column(Text, default="")
    recorded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    patient: Mapped["Patient"] = relationship(back_populates="vitals")


class PatientDocument(Base):
    __tablename__ = "patient_documents"

    document_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(16), default="other")
    description: Mapped[str] = mapped_column(Text, default="")
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), default="")
    file_size_kb: Mapped[Optional[int]] = mapped_column()
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    patient: Mapped["Patient"] = relationship(back_populates="documents")
