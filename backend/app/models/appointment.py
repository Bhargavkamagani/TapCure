"""
Module 6 — Appointment.

appointments              the booking master (doctor + patient + date/slot)
appt_status_history       every status transition (audit trail)
appt_reschedule_history   date/time changes
appt_cancellation_logs    cancellations + refund disposition

Booking resolves a (doctor, date, slot) against the doctor's schedule; the
actual *token* is minted by the Token Engine (Phase 4). rating/feedback columns
back the post-consult feedback API and feed the Reports module later.
"""
import uuid
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

# How the visit was booked, not what kind of visit it is. "online" = the patient
# booked it themselves in the app; "walkin" = the front desk raised it. "regular"
# is the historical value for app bookings, kept so existing rows stay valid.
APPOINTMENT_TYPES = ("online", "regular", "walkin", "emergency")
APPOINTMENT_STATUSES = (
    "scheduled", "confirmed", "in_progress", "completed",
    "cancelled", "no_show", "rescheduled",
)
# Statuses a visit can still be moved from. Once it's been seen, missed or
# called off there is nothing left to reschedule — reopening one would put a
# patient who was already dealt with back into the doctor's live queue.
RESCHEDULABLE_STATUSES = ("scheduled", "confirmed", "rescheduled")
SOURCES = ("app", "whatsapp", "csc", "walkin", "phone")
REFUND_STATUSES = ("none", "pending", "processed", "rejected")


class Appointment(Base):
    __tablename__ = "appointments"

    appointment_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    affiliation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("doctor_affiliations.affiliation_id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("family_members.member_id"))
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    slot_time: Mapped[Optional[time]] = mapped_column(Time)
    appointment_type: Mapped[str] = mapped_column(String(12), default="regular")
    status: Mapped[str] = mapped_column(String(12), default="scheduled", index=True)
    consultation_fee: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    booking_fee_paid: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    # Consultation fee collected in person at the hospital (NOT online). A patient
    # can't be called as the current token until this is paid (see /tokens/next).
    consultation_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    consultation_payment_method: Mapped[Optional[str]] = mapped_column(String(12))  # cash/upi/card/other
    consultation_paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    consultation_paid_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    notes: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(12), default="app")
    # WhatsApp queue alerts (Almost Your Turn / Time to Leave). NULL = on (app
    # bookings, older rows). Walk-ins are False unless the desk opts them in.
    queue_alerts: Mapped[Optional[bool]] = mapped_column(Boolean)
    booked_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    # Where the patient will travel FROM for this visit (chosen at booking). Used
    # to compute the leave-by time; copied onto the Token when it is generated.
    origin_lat: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    origin_lng: Mapped[Optional[float]] = mapped_column(Numeric(9, 6))
    origin_label: Mapped[str] = mapped_column(String(120), default="")
    travel_minutes: Mapped[Optional[int]] = mapped_column()
    rating: Mapped[Optional[int]] = mapped_column()       # post-consult feedback 1..5
    feedback: Mapped[Optional[str]] = mapped_column(Text)
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    doctor: Mapped["object"] = relationship("Doctor")
    patient: Mapped["object"] = relationship("Patient")
    affiliation: Mapped["object"] = relationship("DoctorAffiliation")
    hospital: Mapped["object"] = relationship("Hospital")
    status_history: Mapped[list["ApptStatusHistory"]] = relationship(
        back_populates="appointment", cascade="all, delete-orphan"
    )
    reschedule_history: Mapped[list["ApptRescheduleHistory"]] = relationship(
        back_populates="appointment", cascade="all, delete-orphan"
    )
    cancellation_logs: Mapped[list["ApptCancellationLog"]] = relationship(
        back_populates="appointment", cascade="all, delete-orphan"
    )
    # The free-revisit pass this visit used, if any. Read-only; loaded in one
    # batch with the appointments ("selectin") so a list never runs a query per
    # row. revisit_passes has two FKs to this table, hence the explicit join.
    used_revisit_pass: Mapped[Optional["object"]] = relationship(
        "RevisitPass",
        primaryjoin="Appointment.appointment_id == foreign(RevisitPass.redeemed_appointment_id)",
        uselist=False, viewonly=True, lazy="selectin",
    )

    @property
    def free_revisit(self) -> Optional[dict]:
        """Set when this visit is a free revisit: the desk and the doctor see WHY
        the fee is 0 — which paid visit earned it, and until when it was valid."""
        p = self.used_revisit_pass
        if p is None or p.status != "redeemed":
            return None
        return {"pass_id": p.pass_id, "earned_on": p.issued_on, "valid_until": p.valid_until}

    @property
    def patient_name(self) -> Optional[str]:
        """Convenience for read schemas: the booked patient's display name."""
        return self.patient.name if self.patient else None

    @property
    def reschedule_count(self) -> int:
        """How many times the PATIENT has moved this appointment themselves.

        Hospital- and doctor-side moves (doctor on leave, session cancelled) are
        excluded — those are not the patient's doing and must not use up their
        free reschedule.
        """
        uid = self.patient.user_id if self.patient else None
        if uid is None:
            return 0
        return sum(1 for h in self.reschedule_history if h.rescheduled_by == uid)

    @property
    def reschedules_allowed(self) -> int:
        """Free patient reschedules for this appointment's hospital (policy: one)."""
        from ..config import settings

        st = self.hospital.settings if self.hospital else None
        limit = getattr(st, "free_reschedules", None) if st else None
        return int(limit) if limit is not None else int(settings.free_reschedules)

    @property
    def practice_type(self) -> Optional[str]:
        """Which practice this visit is for: hospital / personal_hospital / home / online."""
        return self.affiliation.practice_type if self.affiliation else None

    @property
    def practice_name(self) -> Optional[str]:
        return (self.affiliation.name if self.affiliation else None) or None

    @property
    def managed_by_hospital(self) -> bool:
        """False for a doctor's personal/home practice — those are private to the
        doctor and the hospital console must never list them. Appointments with no
        affiliation are legacy hospital bookings → treated as hospital-managed."""
        return self.affiliation.managed_by_hospital if self.affiliation else True


class ApptStatusHistory(Base):
    __tablename__ = "appt_status_history"

    history_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    appointment_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"), nullable=False, index=True)
    old_status: Mapped[Optional[str]] = mapped_column(String(12))
    new_status: Mapped[str] = mapped_column(String(12))
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    reason: Mapped[str] = mapped_column(Text, default="")
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    appointment: Mapped["Appointment"] = relationship(back_populates="status_history")


class ApptRescheduleHistory(Base):
    __tablename__ = "appt_reschedule_history"

    reschedule_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    appointment_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"), nullable=False, index=True)
    old_date: Mapped[Optional[date]] = mapped_column(Date)
    old_time: Mapped[Optional[time]] = mapped_column(Time)
    new_date: Mapped[Optional[date]] = mapped_column(Date)
    new_time: Mapped[Optional[time]] = mapped_column(Time)
    rescheduled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    reason: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    appointment: Mapped["Appointment"] = relationship(back_populates="reschedule_history")


class ApptCancellationLog(Base):
    __tablename__ = "appt_cancellation_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    appointment_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"), nullable=False, index=True)
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    cancel_reason: Mapped[str] = mapped_column(Text, default="")
    refund_status: Mapped[str] = mapped_column(String(12), default="none")
    refund_amount: Mapped[float] = mapped_column(Numeric(8, 2), default=0)
    # A booking the HOSPITAL cancelled (a doctor's session was removed) leaves the
    # patient out of pocket for the online booking fee, and nothing in the app
    # pays that back. Instead of an unfulfillable refund promise, they get one
    # free rebooking: no booking fee on their next appointment. Granted here,
    # consumed once in create_booking, so the credit can't be spent twice.
    free_rebook_granted: Mapped[bool] = mapped_column(Boolean, default=False)
    free_rebook_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    free_rebook_used_appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    appointment: Mapped["Appointment"] = relationship(back_populates="cancellation_logs")


class FollowUp(Base):
    """A follow-up a doctor asked a patient to come back for.

    Auto-created when a doctor sets a follow-up date on a prescription. Tracks
    the lifecycle so the patient is reminded and the loop is closed when they
    re-book: pending → booked → completed / missed / cancelled.
    """
    __tablename__ = "follow_ups"

    follow_up_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("family_members.member_id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    # Where the follow-up came from (a prescription today; an appointment later).
    source_prescription_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("prescriptions.prescription_id"), index=True)
    source_appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"))
    due_date: Mapped[date] = mapped_column(Date, index=True)
    reason: Mapped[str] = mapped_column(String(200), default="")
    # pending | booked | completed | missed | cancelled
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)
    booked_appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"))
    reminded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))   # Phase C
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
