"""Schemas for the hospital pharmacy — stock sheet upload + the doctor's medicine search."""
from uuid import UUID
from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from .person import NamePartsIn, NamePartsOut
from .security import MIN_PASSWORD_LENGTH, validate_password

# in_stock / low = the counter can hand it over; out / expired = it can't.
StockStatus = Literal["in_stock", "low", "out", "expired"]


class SheetField(BaseModel):
    key: str
    label: str
    required: bool


class SheetProblem(BaseModel):
    row: int        # row number as the pharmacist sees it in Excel
    message: str


class StockPreviewRow(BaseModel):
    row: int
    medicine_name: str
    generic_name: str = ""
    strength: str = ""
    form: str = ""
    batch_no: str = ""
    quantity: int
    mrp: Optional[float] = None
    expiry_date: Optional[date] = None
    expired: bool = False


class StockPreviewOut(BaseModel):
    """What uploading this sheet WOULD do. Nothing has been saved yet."""
    file_name: str
    sheet_name: str
    header_row: int
    columns: List[str]                       # the sheet's own column headers
    sheet_fields: List[SheetField]           # our fields, for the matching step
    column_map: Dict[str, Optional[str]]     # our field -> their header
    mapping_source: Literal["saved", "guessed", "manual"]
    missing_required: List[str]
    total_rows: int
    valid_count: int
    error_count: int
    expired_count: int
    merged_count: int                        # duplicate lines added together
    errors: List[SheetProblem]
    sample: List[StockPreviewRow]
    # Composition is what tells the system that Dolo 650 and Calpol 650 are the
    # same tablet — without it doctors get no other-brand suggestions.
    composition_mapped: bool = False         # a composition / generic column was matched
    missing_composition: int = 0             # medicines ready to upload that have none
    # replace = this sheet IS the stock list; merge = a purchase sheet whose
    # quantities are added to what's already there.
    mode: Literal["replace", "merge"] = "replace"
    current_count: int                       # medicines in the live list today
    will_add: int
    will_update: int
    will_remove: int


class StockUploadResult(BaseModel):
    added: int
    updated: int
    removed: int
    increased: int = 0                       # rows whose quantity was added to (merge only)
    mode: Literal["replace", "merge"] = "replace"
    active_count: int
    skipped_rows: int
    uploaded_at: datetime


class StockItemOut(BaseModel):
    stock_id: UUID
    medicine_name: str
    generic_name: str
    strength: str
    form: str
    batch_no: str
    quantity: int
    mrp: Optional[float] = None
    expiry_date: Optional[date] = None
    status: StockStatus


class StockCounts(BaseModel):
    all: int = 0
    in_stock: int = 0
    low: int = 0
    out: int = 0
    expired: int = 0


class StockListOut(BaseModel):
    items: List[StockItemOut]
    total: int                               # matching the filters, before paging
    counts: StockCounts                      # across the whole live list
    last_updated_at: Optional[datetime] = None
    last_updated_by: Optional[str] = None
    low_stock_threshold: int


class MedicineOption(BaseModel):
    """One medicine as the doctor sees it — batches of it added together."""
    stock_id: UUID
    medicine_name: str
    generic_name: str
    strength: str
    form: str
    quantity: int
    status: StockStatus
    expiry_date: Optional[date] = None
    mrp: Optional[float] = None


class MedicineMatch(MedicineOption):
    # Filled only when this one can't be handed over: same generic, same
    # strength, in stock.
    substitutes: List[MedicineOption] = []


class MedicineSearchOut(BaseModel):
    has_pharmacy: bool                       # False = this hospital never uploaded a list
    last_updated_at: Optional[datetime] = None
    last_updated_by: Optional[str] = None
    low_stock_threshold: int
    results: List[MedicineMatch] = []
    # The doctor typed a brand this hospital doesn't stock, but other pharmacies on
    # TapCure have uploaded it, so we know what it contains — and this hospital has
    # the same medicine under another brand. Only the brand's composition is
    # shared knowledge; no other hospital's stock is ever exposed.
    not_stocked_name: Optional[str] = None
    not_stocked_generic: Optional[str] = None
    alternatives: List[MedicineOption] = []
    # Same brand on the shelf in a DIFFERENT strength (typed Levipil 250, the
    # pharmacy keeps Levipil 500). Shown as information, never as a substitute —
    # another strength is another medicine, and only the doctor may change it.
    other_strength: List[MedicineOption] = []


# ---- pharmacy counter: prescriptions ----------------------------------------
# Deliberately no diagnosis, advice or follow-up: the counter needs the medicines.
RxState = Literal["pending", "partial", "done"]


class CounterRxRow(BaseModel):
    prescription_id: UUID
    created_at: datetime
    patient_id: UUID
    patient_name: Optional[str] = None
    patient_uhid: Optional[str] = None
    family_member_name: Optional[str] = None
    doctor_name: Optional[str] = None
    item_count: int
    recorded_count: int
    status: RxState


class CounterRxCounts(BaseModel):
    all: int = 0
    pending: int = 0
    partial: int = 0
    done: int = 0


class CounterRxList(BaseModel):
    items: List[CounterRxRow]
    total: int
    counts: CounterRxCounts
    days: int
    window_days: int                           # how far back this list actually looked (a search looks further)


class DispenseOut(BaseModel):
    dispense_id: UUID
    outcome: Literal["given", "outside"]
    stock_id: Optional[UUID] = None
    stock_name: Optional[str] = None
    batch_no: str = ""
    quantity: int
    dispensed_by: Optional[str] = None
    dispensed_at: datetime
    reminders_started: bool
    can_undo: bool


class CounterRxItem(BaseModel):
    item_id: UUID
    drug_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str
    stock: Optional[MedicineOption] = None     # the stock row the doctor picked, as it stands now
    # Filled only while the line is still pending AND can't be handed over as
    # written — so the counter doesn't have to know the compositions by heart.
    suggestions: List[MedicineOption] = []     # same medicine, on the shelf right now
    suggestion_generic: Optional[str] = None   # what makes them the same
    other_strength: List[MedicineOption] = []  # same brand, different strength (information only)
    dispenses: List[DispenseOut] = []          # every live hand-over, oldest first (refills add more)
    given_total: int = 0                       # sum of quantities given from stock
    last_given_at: Optional[datetime] = None


class CounterRxDetail(BaseModel):
    prescription_id: UUID
    created_at: datetime
    patient_id: UUID
    patient_name: Optional[str] = None
    patient_uhid: Optional[str] = None
    patient_phone: Optional[str] = None
    family_member_name: Optional[str] = None
    doctor_name: Optional[str] = None
    status: RxState
    items: List[CounterRxItem]


class DispenseLine(BaseModel):
    item_id: UUID
    outcome: Literal["given", "outside"]
    stock_id: Optional[UUID] = None
    quantity: int = Field(0, ge=0, le=1_000_000)
    # The counter confirmed a repeat: this line was already given in the last few days.
    repeat_ok: bool = False


class DispenseRequest(BaseModel):
    items: List[DispenseLine] = Field(..., min_length=1, max_length=100)


class DispenseResult(BaseModel):
    prescription: CounterRxDetail
    warnings: List[str] = []


# ---- pharmacy counter: walk-in sales (outside customers, no prices) --------
class WalkinLine(BaseModel):
    stock_id: UUID
    quantity: int = Field(..., ge=1, le=1_000_000)


class WalkinSaleCreate(BaseModel):
    customer_name: str = Field("", max_length=100)
    customer_phone: str = ""
    prescribed_by: str = Field("", max_length=150)
    items: List[WalkinLine] = Field(..., min_length=1, max_length=50)

    @field_validator("customer_name", "prescribed_by")
    @classmethod
    def _trim(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("customer_phone")
    @classmethod
    def _mobile(cls, v: str) -> str:
        v = (v or "").strip()
        if v and not (v.isdigit() and len(v) == 10):
            raise ValueError("Mobile must be 10 digits")
        return v


class WalkinSaleLineOut(BaseModel):
    dispense_id: UUID
    stock_id: Optional[UUID] = None
    medicine_name: str
    strength: str = ""
    batch_no: str = ""
    quantity: int


class WalkinSaleOut(BaseModel):
    sale_id: UUID
    customer_name: str
    customer_phone: str
    prescribed_by: str
    sold_by: Optional[str] = None
    sold_at: datetime
    undone: bool
    can_undo: bool
    items: List[WalkinSaleLineOut]


class WalkinSaleList(BaseModel):
    items: List[WalkinSaleOut]
    total: int
    days: int


class WalkinSaleResult(BaseModel):
    sale: WalkinSaleOut
    warnings: List[str] = []


class PharmacySettings(BaseModel):
    low_stock_threshold: int = Field(..., ge=0, le=100000)


class PharmacistOnboard(NamePartsIn):
    """Hospital admin adds a pharmacist to their own hospital, creating the login."""
    name: str = Field(..., min_length=1)
    email: EmailStr
    phone: Optional[str] = Field(None, pattern=r"^\d{10}$")
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH, max_length=128)
    employee_id: Optional[str] = Field(None, max_length=50)
    # Staff accounts get the same policy as everyone else (schemas/security.py).
    _check_password = field_validator("password")(validate_password)

    @field_validator("employee_id")
    @classmethod
    def _clean_employee_id(cls, v: Optional[str]) -> Optional[str]:
        return (v or "").strip() or None

    # users.name and users.email are VARCHAR(100): longer values used to reach
    # the database and come back as a 500 instead of a message.
    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        if len(v) > 100:
            raise ValueError("Name is too long (100 characters max)")
        return v

    @field_validator("email")
    @classmethod
    def _email_fits(cls, v: str) -> str:
        if len(v) > 100:
            raise ValueError("Email is too long (100 characters max)")
        return v


class PharmacistOut(NamePartsOut):
    model_config = ConfigDict(from_attributes=True)
    user_id: UUID
    hospital_id: Optional[UUID] = None
    name: str
    # Plain str on the way out: EmailStr would 500 on a legacy address it rejects.
    email: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    is_active: bool
    created_at: datetime
