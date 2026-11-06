"""
Medicine reminders — nudge the patient at each dose time of a prescribed course.

medicine_courses     one per schedulable prescription line (drug + times + days)
medicine_reminders   the outbox: one row per individual dose

Why two tables. A course needs a start date the hospital does not know: the
patient may buy the medicine at an outside pharmacy hours later, or the next
morning. So a course is created `awaiting_start` when the doctor writes the Rx,
and only materialises its dose rows once someone confirms the patient actually
has the medicine in hand. Nothing is sent before that.

Why an outbox of individual doses rather than computing due times on the fly:
`status` on the row is what makes the ticker idempotent — two overlapping cron
runs cannot double-send, because the row is claimed inside one transaction. It
also means the same table works whether the ticker runs in-process or in a
Lambda; only the caller changes.
"""
import uuid
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow

# Course lifecycle.
COURSE_AWAITING = "awaiting_start"   # Rx written, patient hasn't confirmed they have it
COURSE_ACTIVE = "active"
COURSE_COMPLETED = "completed"
COURSE_STOPPED = "stopped"           # patient or hospital ended it early

# Dose lifecycle.
DOSE_PENDING = "pending"
DOSE_SENT = "sent"
DOSE_FAILED = "failed"
DOSE_SKIPPED = "skipped"             # course stopped before this dose came due
# The only status that describes the PATIENT rather than us: every other value
# reports what we did with a message. Reachable from `pending` (they took it
# before the nudge went out) or from `sent` (they tapped after reading it).
DOSE_TAKEN = "taken"


class MedicineCourse(Base):
    __tablename__ = "medicine_courses"

    course_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    prescription_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("prescriptions.prescription_id"), nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("prescription_items.item_id"), nullable=False, index=True)
    # Set when the Rx was for a dependent — decides whose phone gets the nudge.
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("family_members.member_id"), index=True)

    # Copied from the Rx line so the reminder text survives an Rx edit/delete.
    drug_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), default="")
    food_note: Mapped[str] = mapped_column(String(60), default="")     # "after food"
    slots: Mapped[str] = mapped_column(String(60), default="")         # "morning,night"
    times_csv: Mapped[str] = mapped_column(String(60), default="")     # "09:00,21:00"
    days: Mapped[int] = mapped_column(default=1)

    status: Mapped[str] = mapped_column(String(20), default=COURSE_AWAITING, index=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    stopped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    stop_reason: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    doses: Mapped[list["MedicineReminder"]] = relationship(
        back_populates="course", cascade="all, delete-orphan",
    )

    @property
    def slot_list(self) -> list[str]:
        return [s for s in (self.slots or "").split(",") if s]

    @property
    def time_list(self) -> list[time]:
        out = []
        for chunk in (self.times_csv or "").split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            hh, _, mm = chunk.partition(":")
            out.append(time(int(hh), int(mm or 0)))
        return out


class MedicineReminder(Base):
    __tablename__ = "medicine_reminders"

    reminder_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    course_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("medicine_courses.course_id"), nullable=False, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)

    dose_date: Mapped[date] = mapped_column(Date, nullable=False)
    slot: Mapped[str] = mapped_column(String(20), default="")
    # UTC instant the nudge is due. Indexed with status — the ticker's only query.
    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    status: Mapped[str] = mapped_column(String(12), default=DOSE_PENDING, index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    channel: Mapped[str] = mapped_column(String(12), default="")
    sent_to: Mapped[str] = mapped_column(String(20), default="")
    last_error: Mapped[str] = mapped_column(Text, default="")
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # When the PATIENT took it — distinct from sent_at, which is when the
    # reminder left. See migration c7f2a91d4e86.
    taken_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    course: Mapped["MedicineCourse"] = relationship(back_populates="doses")
