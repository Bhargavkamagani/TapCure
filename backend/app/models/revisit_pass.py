"""
Free revisit pass — one no-charge return visit with the same doctor.

After a PAID consultation the patient holds one free revisit for a number of days
the hospital chooses (`hospital_settings.free_revisit_days`). They do not book: they
walk in, the front desk finds the pass on their record, issues a token, and
collects nothing.

Why a pass and not an Appointment or a FollowUp:

  - An Appointment would have to exist before the patient decides to come, and be
    cancelled when they don't. A pass that goes unused simply expires.
  - A FollowUp is the doctor's clinical instruction ("come back in 10 days") and
    carries no fee meaning. The two are independent: a patient can hold a pass
    with no follow-up, or a follow-up with no pass.

`status` is stored rather than derived from `valid_until` so that a hospital
shortening its window from 15 days to 10 cannot retroactively cancel a promise
already made — `valid_until` is frozen at issue time.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base, UUIDType, new_uuid, utcnow

# Lifecycle. Only ONE pass per (patient, doctor) may be `active` at a time —
# enforced by a partial unique index, not just by the service check.
PASS_ACTIVE = "active"
PASS_REDEEMED = "redeemed"
PASS_EXPIRED = "expired"
PASS_VOID = "void"          # doctor left the practice, hospital withdrew the offer


class RevisitPass(Base):
    __tablename__ = "revisit_passes"

    pass_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    # The practice it was earned at. A doctor who consults at two hospitals earns
    # the pass at one of them; the front desk of the other should still honour it
    # (same doctor), so this is recorded for reporting, not for matching.
    affiliation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("doctor_affiliations.affiliation_id"), index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    # Which person the earning visit was for — a dependant's consultation earns
    # the pass for that dependant, not for the account holder.
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("family_members.member_id"), index=True)

    source_appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"))
    issued_on: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(12), default=PASS_ACTIVE, nullable=False, index=True)

    redeemed_appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"))
    redeemed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    redeemed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        # The real double-issue guard. Two consultations completing in the same
        # instant would both pass a SELECT-then-INSERT check; this one cannot be
        # raced. Partial, so redeemed/expired history is unconstrained.
        #
        # Keyed on the PERSON, not the account. A dependant's pass and the account
        # holder's own are different entitlements: Raju booking for his sister
        # Raji earns HER a pass, and it must not block Raju from earning his.
        #
        # COALESCE rather than a plain third column because NULL != NULL in SQL,
        # so (patient, doctor, NULL) would never collide with itself and the
        # account holder would lose the guard altogether. Ids are UUIDs, cast
        # to text so '' is a safe sentinel on both Postgres and SQLite.
        Index(
            "uq_revisit_pass_active_person",
            "patient_id", "doctor_id",
            text("COALESCE(CAST(family_member_id AS TEXT), '')"),
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<RevisitPass {self.pass_id} p{self.patient_id} d{self.doctor_id} {self.status}>"
