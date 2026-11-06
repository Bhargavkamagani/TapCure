"""
Module 4 — Reception.

receptionists       front-desk staff (links a user → hospital, assigned depts)
receptionist_shift  per-day shift roster
"""
import uuid
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base, UUIDType, new_uuid, utcnow


class Receptionist(Base):
    __tablename__ = "receptionists"

    receptionist_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("users.user_id"), nullable=False, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    employee_id: Mapped[Optional[str]] = mapped_column(String(50))
    designation: Mapped[str] = mapped_column(String(100), default="Front Desk Executive")
    departments_assigned: Mapped[Optional[list]] = mapped_column(JSON)  # array of department_ids
    # Doctors this receptionist handles. NULL/empty = every doctor at the hospital;
    # otherwise her console only shows these (services/reception_scope.py).
    doctors_assigned: Mapped[Optional[list]] = mapped_column(JSON)  # array of doctor_ids
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_date: Mapped[Optional[date]] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    shifts: Mapped[list["ReceptionistShift"]] = relationship(
        back_populates="receptionist", cascade="all, delete-orphan"
    )


class ReceptionistShift(Base):
    __tablename__ = "receptionist_shift"

    shift_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    receptionist_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("receptionists.receptionist_id"), nullable=False, index=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("departments.department_id"))
    notes: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    receptionist: Mapped["Receptionist"] = relationship(back_populates="shifts")
