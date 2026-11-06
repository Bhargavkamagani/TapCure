"""
Prescriptions — what the doctor prescribes at a consultation.

prescriptions        one Rx per visit: diagnosis, advice, optional follow-up
prescription_items   the individual drugs on that Rx (name, dosage, frequency…)

A prescription is written by a doctor (optionally tied to the appointment it came
from) and is visible to that patient in their app. Drugs are kept as child rows
(not JSON) to match the relational style of the rest of the schema.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow


class Prescription(Base):
    __tablename__ = "prescriptions"

    prescription_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("patients.patient_id"), nullable=False, index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("doctors.doctor_id"), nullable=False, index=True)
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("appointments.appointment_id"), index=True)
    # Set when the Rx is for a dependent booked under the patient's account.
    family_member_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("family_members.member_id"), index=True)
    diagnosis: Mapped[str] = mapped_column(Text, default="")
    advice: Mapped[str] = mapped_column(Text, default="")          # general notes / lifestyle advice
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    items: Mapped[list["PrescriptionItem"]] = relationship(
        back_populates="prescription", cascade="all, delete-orphan",
    )


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    item_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    prescription_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("prescriptions.prescription_id"), nullable=False, index=True)
    drug_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), default="")       # e.g. "500 mg"
    frequency: Mapped[str] = mapped_column(String(100), default="")    # e.g. "1-0-1 after food"
    duration: Mapped[str] = mapped_column(String(100), default="")     # e.g. "5 days"
    instructions: Mapped[str] = mapped_column(Text, default="")
    # The hospital-pharmacy stock row the doctor picked from the medicine search.
    # NULL for a medicine typed freely — the patient may buy it outside.
    stock_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("pharmacy_stock.stock_id"), index=True)

    prescription: Mapped["Prescription"] = relationship(back_populates="items")
