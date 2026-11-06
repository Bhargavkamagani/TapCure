"""
Hospital pharmacy — what the hospital's own pharmacy counter has on the shelf.

pharmacy_stock   one row per medicine line (name + strength + batch) from the
                 pharmacist's latest uploaded stock sheet

The pharmacist uploads their stock sheet (Excel/CSV); the doctor searches it
while writing a prescription to see what the hospital can hand over today.

A new upload REPLACES the list, but rows are matched on `match_key` and updated
in place instead of being deleted and re-inserted: a prescription line may point
at a stock row (prescription_items.stock_id) and that link has to survive the
next day's upload. A medicine missing from the new sheet is switched off
(`is_active=False`), never deleted.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base, UUIDType, new_uuid, utcnow


class PharmacyStock(Base):
    __tablename__ = "pharmacy_stock"
    __table_args__ = (
        UniqueConstraint("hospital_id", "match_key", name="uq_pharmacy_stock_hospital_match_key"),
    )

    stock_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    # Normalised name|strength|batch — how the next upload finds this row again.
    match_key: Mapped[str] = mapped_column(String(400), nullable=False)
    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)  # as written in the sheet, e.g. "Dolo 650"
    generic_name: Mapped[str] = mapped_column(String(300), default="")       # e.g. "Paracetamol" — drives substitutes
    strength: Mapped[str] = mapped_column(String(60), default="")            # e.g. "650 mg"
    form: Mapped[str] = mapped_column(String(40), default="")                # tablet / syrup / injection
    batch_no: Mapped[str] = mapped_column(String(60), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    mrp: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    expiry_date: Mapped[Optional[date]] = mapped_column(Date)
    # Lower-cased, punctuation-free copies for search and substitute matching
    # (see services/pharmacy_sheet.py for how each is derived).
    search_text: Mapped[str] = mapped_column(String(700), default="")
    generic_key: Mapped[str] = mapped_column(String(300), default="", index=True)
    strength_key: Mapped[str] = mapped_column(String(60), default="")
    # False = not in the latest uploaded sheet. Kept so prescription links survive.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


DISPENSE_GIVEN = "given"      # handed over from the hospital's stock
DISPENSE_OUTSIDE = "outside"  # not from our stock — the patient buys it elsewhere


class PharmacyDispense(Base):
    """What the pharmacy counter recorded for one prescription line.

    A line can have several hand-overs — a patient on a two-month course may
    take one month's supply now and come back for the next. An undo stamps
    `undone_at` rather than deleting, so the trail of who gave what survives.
    The links to the prescription, its line and the reminder course are ON
    DELETE SET NULL: a doctor deleting a prescription keeps working exactly as
    it did before this table existed.
    """
    __tablename__ = "pharmacy_dispenses"
    __table_args__ = (Index("ix_pharmacy_dispenses_item_id", "item_id"),)

    dispense_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    prescription_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDType, ForeignKey("prescriptions.prescription_id", ondelete="SET NULL"), index=True)
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDType, ForeignKey("prescription_items.item_id", ondelete="SET NULL"))
    outcome: Mapped[str] = mapped_column(String(12), nullable=False)
    stock_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("pharmacy_stock.stock_id"))
    quantity: Mapped[int] = mapped_column(Integer, default=0)           # what the pharmacist says they gave
    stock_deducted: Mapped[int] = mapped_column(Integer, default=0)     # what actually came off the shelf count
    # The reminder course this hand-over started, so an undo can stop it again.
    course_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDType, ForeignKey("medicine_courses.course_id", ondelete="SET NULL"))
    # Set for a walk-in sale to an outside customer (then there is no prescription).
    sale_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("pharmacy_walkin_sales.sale_id"), index=True)
    dispensed_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    dispensed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    undone_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    undone_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))


class PharmacyWalkinSale(Base):
    """A sale at the counter to an outside customer — someone without a
    prescription from this hospital. No prices: it exists so stock goes down.

    The medicines are ordinary pharmacy_dispenses rows pointing here via
    sale_id, so stock, expiry and undo work exactly as for prescriptions. The
    customer is not made a hospital patient; name, mobile and who prescribed it
    are optional notes on the sale.
    """
    __tablename__ = "pharmacy_walkin_sales"

    sale_id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=new_uuid)
    hospital_id: Mapped[uuid.UUID] = mapped_column(UUIDType, ForeignKey("hospitals.hospital_id"), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(100), default="")
    customer_phone: Mapped[str] = mapped_column(String(15), default="")
    prescribed_by: Mapped[str] = mapped_column(String(150), default="")   # doctor / hospital on their own prescription
    sold_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    undone_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    undone_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDType, ForeignKey("users.user_id"))
