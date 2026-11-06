"""
Hospital pharmacy — the pharmacist uploads the hospital's stock sheet; the doctor
sees what is on the shelf while writing a prescription.

  POST   /pharmacy/stock/preview    read a sheet, match its columns, list problems — saves nothing
  POST   /pharmacy/stock/confirm    the same file again → the hospital's stock list is replaced
  GET    /pharmacy/stock            the pharmacist's list with In stock / Low / Out / Expired counts
  GET    /pharmacy/search           the doctor's medicine box: matches + substitutes
  GET    /pharmacy/template         a sample sheet for pharmacists without one
  PUT    /pharmacy/settings         low-stock threshold
  GET    /pharmacists               hospital admin: pharmacist logins at their hospital
  POST   /pharmacists/onboard       hospital admin: add one
  DELETE /pharmacists/{user_id}     hospital admin: deactivate one

  GET    /pharmacy/prescriptions                  counter: this hospital's prescriptions (today by default)
  GET    /pharmacy/prescriptions/{id}             counter: one prescription's medicines + what was given
  POST   /pharmacy/prescriptions/{id}/dispense    counter: record what was handed over; stock goes down
  POST   /pharmacy/dispenses/{id}/undo            counter: same-day undo; stock goes back up

  GET    /pharmacy/walkin-sales                   counter: sales to outside customers (today by default)
  POST   /pharmacy/walkin-sales                   counter: record a walk-in sale; stock goes down
  POST   /pharmacy/walkin-sales/{id}/undo         counter: same-day undo of the whole sale

Confirm re-reads the uploaded file instead of trusting rows echoed back by the
browser, so what goes live is exactly what the server validated. Every hospital
has at most one list; staff are confined to their own hospital's.
"""
from uuid import UUID
import json
import re
from datetime import date, datetime, time as dtime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, aliased

from ..database import get_db, utcnow
from ..deps import require_permission
from ..models import (
    Appointment, Doctor, DoctorAffiliation, FamilyMember, HospitalSettings, MedicineCourse, Patient,
    PharmacyDispense, PharmacyStock, PharmacyWalkinSale, Prescription, PrescriptionItem, Role, User,
)
from ..models.medicine_reminder import COURSE_ACTIVE, COURSE_AWAITING, COURSE_STOPPED
from ..models.pharmacy import DISPENSE_GIVEN
from ..rbac import ROLE_DOCTOR, ROLE_PHARMACIST
from ..schemas.pharmacy import (
    CounterRxCounts, CounterRxDetail, CounterRxItem, CounterRxList, CounterRxRow, DispenseOut,
    DispenseRequest, DispenseResult,
    WalkinSaleCreate, WalkinSaleLineOut, WalkinSaleList, WalkinSaleOut, WalkinSaleResult,
    MedicineMatch, MedicineOption, MedicineSearchOut, PharmacistOnboard, PharmacistOut,
    PharmacySettings, SheetField, SheetProblem, StockCounts, StockItemOut, StockListOut,
    StockPreviewOut, StockPreviewRow, StockUploadResult,
)
from ..schemas.reception import StaffAccountUpdate
from ..security import hash_password
from ..services import person_name
from ..services import accounts, audit
from ..services import pharmacy_sheet as sheet
from ..services import reminder_engine

router = APIRouter(tags=["pharmacy"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
DEFAULT_LOW_STOCK = 10
AVAILABLE = ("in_stock", "low")


# =================================================================== helpers ==
def _hospital_id(me: User) -> int:
    if not me.hospital_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account is not linked to a hospital")
    return me.hospital_id


def _settings_row(db: Session, hospital_id: UUID) -> HospitalSettings | None:
    return db.scalar(select(HospitalSettings).where(HospitalSettings.hospital_id == hospital_id))


def _config(s: HospitalSettings | None) -> dict:
    return dict(s.pharmacy_config or {}) if s else {}


def _threshold(cfg: dict) -> int:
    value = cfg.get("low_stock_threshold")
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    return DEFAULT_LOW_STOCK


def _hospital_today(s: HospitalSettings | None) -> date:
    """Expiry is judged by the hospital's calendar, not the server's (UTC)."""
    try:
        return datetime.now(ZoneInfo((s.timezone if s else None) or "Asia/Kolkata")).date()
    except Exception:
        return date.today()


def _status(quantity: int, expiry: date | None, threshold: int, today: date) -> str:
    if expiry and expiry < today:
        return "expired"
    if quantity <= 0:
        return "out"
    if quantity <= threshold:
        return "low"
    return "in_stock"


def _last_upload(db: Session, hospital_id: UUID) -> tuple[datetime | None, str | None]:
    """When the live list was last uploaded, and by whom. Every row of an upload
    is stamped with the same time, so the newest stamp is the last upload."""
    row = db.execute(
        select(PharmacyStock.uploaded_at, User.name)
        .outerjoin(User, User.user_id == PharmacyStock.uploaded_by)
        .where(PharmacyStock.hospital_id == hospital_id, PharmacyStock.is_active.is_(True))
        .order_by(PharmacyStock.uploaded_at.desc())
        .limit(1)
    ).first()
    return (row[0], row[1]) if row else (None, None)


def _parse(file: UploadFile, column_map: str | None, cfg: dict) -> sheet.SheetResult:
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The file is larger than 5 MB.")
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")
    requested = None
    if column_map:
        try:
            requested = json.loads(column_map)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "column_map must be a JSON object")
        if not isinstance(requested, dict):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "column_map must be a JSON object")
        requested = {str(k): (str(v) if v else None) for k, v in requested.items()}
    try:
        return sheet.parse_sheet(file.filename or "", content, requested, cfg.get("column_map"))
    except sheet.SheetError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


def _match_index(rows: list[PharmacyStock]):
    """Two ways to find the stock line a sheet row belongs to."""
    by_key: dict[str, PharmacyStock] = {}
    by_name_batch: dict[tuple[str, str], list[PharmacyStock]] = {}
    for r in rows:
        by_key[r.match_key] = r
        by_name_batch.setdefault((sheet.norm(r.medicine_name), sheet.norm(r.batch_no or "")), []).append(r)
    return by_key, by_name_batch


def _existing_row(row: sheet.StockRow, by_key, by_name_batch, claimed: set[int]) -> PharmacyStock | None:
    """The stock line this sheet row updates, or None when it's a new line.

    Lines are identified by name + strength + batch. Plenty of billing exports
    carry no strength column at all, and those sheets would then create a twin
    of every medicine already on the list — so when the strength is missing on
    either side we fall back to name + batch, and only when that points at
    exactly one line. Anything less certain becomes a new line instead.
    """
    rec = by_key.get(row.match_key)
    if rec is not None:
        return rec
    candidates = [
        r for r in by_name_batch.get((sheet.norm(row.medicine_name), sheet.norm(row.batch_no)), [])
        if id(r) not in claimed and (not row.strength.strip() or not (r.strength or "").strip())
    ]
    return candidates[0] if len(candidates) == 1 else None


def _upload_mode(mode: str | None) -> str:
    """How a sheet meets the existing list.

    replace — the sheet IS the stock list (a full stock report). Medicines
              missing from it are switched off. The safe default.
    merge   — a purchase sheet: quantities are ADDED to what's on the shelf and
              nothing is switched off. Wrong mode on a full report would double
              every count, so the screen says which one is in use and why.
    """
    value = (mode or "replace").strip().lower()
    if value not in ("replace", "merge"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "mode must be 'replace' or 'merge'")
    return value


def _item_out(r: PharmacyStock, st: str) -> StockItemOut:
    return StockItemOut(
        stock_id=r.stock_id, medicine_name=r.medicine_name, generic_name=r.generic_name or "",
        strength=r.strength or "", form=r.form or "", batch_no=r.batch_no or "",
        quantity=r.quantity, mrp=float(r.mrp) if r.mrp is not None else None,
        expiry_date=r.expiry_date, status=st,
    )


# ============================================================ stock upload ====
@router.post("/pharmacy/stock/preview", response_model=StockPreviewOut)
def preview_stock(
    file: UploadFile = File(...),
    column_map: str | None = Form(None),
    mode: str | None = Form("replace"),
    me: User = Depends(require_permission("pharmacy", "update")),
    db: Session = Depends(get_db),
):
    """Read the sheet and report what uploading it WOULD do. Saves nothing."""
    hid = _hospital_id(me)
    mode = _upload_mode(mode)
    s = _settings_row(db, hid)
    result = _parse(file, column_map, _config(s))
    today = _hospital_today(s)

    existing_rows = list(db.scalars(select(PharmacyStock).where(PharmacyStock.hospital_id == hid)))
    by_key, by_name_batch = _match_index(existing_rows)
    claimed: set[int] = set()
    matched_ids: set[UUID] = set()
    will_add = will_update = 0
    for row in result.rows:
        rec = _existing_row(row, by_key, by_name_batch, claimed)
        if rec is None:
            will_add += 1
        else:
            claimed.add(id(rec))
            matched_ids.add(rec.stock_id)
            will_update += 1

    def expired(r: sheet.StockRow) -> bool:
        return bool(r.expiry_date and r.expiry_date < today)

    return StockPreviewOut(
        file_name=file.filename or "",
        sheet_name=result.sheet_name,
        header_row=result.header_row,
        columns=result.columns,
        sheet_fields=[SheetField(key=f, label=sheet.FIELD_LABELS[f], required=f in sheet.REQUIRED)
                      for f in sheet.FIELDS],
        column_map=result.column_map,
        mapping_source=result.mapping_source,
        missing_required=result.missing_required,
        total_rows=result.total_rows,
        valid_count=len(result.rows),
        error_count=len(result.errors),
        expired_count=sum(1 for r in result.rows if expired(r)),
        merged_count=result.merged_count,
        errors=[SheetProblem(**e) for e in result.errors[:200]],
        sample=[
            StockPreviewRow(
                row=r.row, medicine_name=r.medicine_name, generic_name=r.generic_name,
                strength=r.strength, form=r.form, batch_no=r.batch_no, quantity=r.quantity,
                mrp=r.mrp, expiry_date=r.expiry_date, expired=expired(r),
            )
            for r in result.rows[:25]
        ],
        composition_mapped=bool(result.column_map.get("generic_name")),
        missing_composition=sum(1 for r in result.rows if not r.generic_name.strip()),
        mode=mode,
        current_count=sum(1 for r in existing_rows if r.is_active),
        will_add=will_add,
        will_update=will_update,
        # A purchase sheet never takes anything off the list.
        will_remove=0 if mode == "merge" else sum(
            1 for r in existing_rows if r.is_active and r.stock_id not in matched_ids),
    )


@router.post("/pharmacy/stock/confirm", response_model=StockUploadResult)
def confirm_stock(
    file: UploadFile = File(...),
    column_map: str | None = Form(None),
    mode: str | None = Form("replace"),
    me: User = Depends(require_permission("pharmacy", "update")),
    db: Session = Depends(get_db),
):
    """Apply the sheet to the hospital's stock list.

    `replace` (default) makes this sheet the whole list — medicines missing from
    it are switched off. `merge` treats it as newly purchased stock: quantities
    are added to what's on the shelf and nothing is switched off.

    Nothing changes unless the sheet has at least one valid medicine, so a
    wrong or empty file can never wipe the list.
    """
    hid = _hospital_id(me)
    mode = _upload_mode(mode)
    s = _settings_row(db, hid)
    if s is None:
        s = HospitalSettings(hospital_id=hid)
        db.add(s)
        db.flush()
    # One upload at a time per hospital: two at once would race on match_key.
    db.execute(select(HospitalSettings.setting_id).where(HospitalSettings.setting_id == s.setting_id).with_for_update())

    result = _parse(file, column_map, _config(s))
    if result.missing_required:
        labels = " and ".join(sheet.FIELD_LABELS[f] for f in result.missing_required)
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Choose which column holds the {labels}. Your stock list was not changed.")
    if not result.rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "No valid medicines found in this file. Your stock list was not changed.")

    now = utcnow()
    existing_rows = list(db.scalars(select(PharmacyStock).where(PharmacyStock.hospital_id == hid)))
    by_key, by_name_batch = _match_index(existing_rows)
    added = updated = removed = increased = 0
    claimed: set[int] = set()
    matched_ids: set[UUID] = set()
    for row in result.rows:
        rec = _existing_row(row, by_key, by_name_batch, claimed)
        quantity = row.quantity
        if rec is None:
            rec = PharmacyStock(hospital_id=hid, match_key=row.match_key, generic_name="", strength="",
                                form="", batch_no="", mrp=None, expiry_date=None)
            db.add(rec)
            added += 1
        else:
            claimed.add(id(rec))
            matched_ids.add(rec.stock_id)
            updated += 1
            # Newly purchased stock adds to what's on the shelf. A row that was
            # switched off earlier starts again from the sheet's own count.
            if mode == "merge" and rec.is_active:
                quantity = max(rec.quantity, 0) + row.quantity
                increased += 1
        # A sheet without a strength, form or expiry column must not wipe details
        # the list already holds — only real values are written over.
        rec.medicine_name = row.medicine_name
        if row.generic_name:
            rec.generic_name = row.generic_name
        if row.strength:
            rec.strength = row.strength
        if row.form:
            rec.form = row.form
        if row.batch_no:
            rec.batch_no = row.batch_no
        if row.expiry_date:
            rec.expiry_date = row.expiry_date
        if row.mrp is not None:
            rec.mrp = row.mrp
        rec.quantity = quantity
        # Search + substitute keys follow what the row now holds, not just this sheet.
        rec.search_text = sheet.norm(" ".join(
            (rec.medicine_name, rec.generic_name or "", rec.strength or "", rec.form or "")))[:700]
        rec.generic_key = sheet.generic_key(rec.generic_name or "")
        rec.strength_key = sheet.strength_key(rec.strength or "", rec.generic_name or "", rec.medicine_name)
        rec.is_active = True
        rec.uploaded_by = me.user_id
        rec.uploaded_at = now
    if mode == "replace":
        for rec in existing_rows:
            if rec.is_active and rec.stock_id not in matched_ids:
                rec.is_active = False
                removed += 1

    # Remember how this hospital's sheet is laid out. A new dict, not a mutation:
    # SQLAlchemy doesn't notice in-place changes to a JSON column.
    s.pharmacy_config = {**_config(s), "column_map": result.column_map}
    audit.log_activity(db, me.user_id, "pharmacy.stock_upload", "pharmacy", {
        "hospital_id": hid, "file": file.filename, "mode": mode, "added": added, "updated": updated,
        "removed": removed, "increased": increased, "skipped_rows": len(result.errors),
    })
    db.commit()
    active_count = db.scalar(select(func.count()).select_from(PharmacyStock).where(
        PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True))) or 0
    return StockUploadResult(added=added, updated=updated, removed=removed, increased=increased, mode=mode,
                             active_count=active_count, skipped_rows=len(result.errors), uploaded_at=now)


@router.get("/pharmacy/template")
def stock_template(me: User = Depends(require_permission("pharmacy", "update"))):
    return Response(
        content=sheet.template_xlsx(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="pharmacy-stock-template.xlsx"'},
    )


@router.put("/pharmacy/settings", response_model=PharmacySettings)
def update_settings(
    body: PharmacySettings,
    me: User = Depends(require_permission("pharmacy", "update")),
    db: Session = Depends(get_db),
):
    hid = _hospital_id(me)
    s = _settings_row(db, hid)
    if s is None:
        s = HospitalSettings(hospital_id=hid)
        db.add(s)
    s.pharmacy_config = {**_config(s), "low_stock_threshold": body.low_stock_threshold}
    audit.log_activity(db, me.user_id, "pharmacy.update_settings", "pharmacy",
                       {"hospital_id": hid, "low_stock_threshold": body.low_stock_threshold})
    db.commit()
    return body


# ============================================================= stock views ====
@router.get("/pharmacy/stock", response_model=StockListOut)
def list_stock(
    q: str = Query("", max_length=100),
    status_filter: str = Query("all", alias="status", pattern="^(all|in_stock|low|out|expired)$"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    me: User = Depends(require_permission("pharmacy", "read")),
    db: Session = Depends(get_db),
):
    """The hospital's live stock list, one row per batch, A–Z."""
    hid = _hospital_id(me)
    s = _settings_row(db, hid)
    threshold, today = _threshold(_config(s)), _hospital_today(s)
    rows = db.scalars(
        select(PharmacyStock)
        .where(PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True))
        .order_by(func.lower(PharmacyStock.medicine_name), PharmacyStock.expiry_date)
    ).all()
    tokens = sheet.norm(q).split()
    counts = StockCounts()
    items: list[StockItemOut] = []
    for r in rows:
        st = _status(r.quantity, r.expiry_date, threshold, today)
        counts.all += 1
        setattr(counts, st, getattr(counts, st) + 1)
        if tokens and not all(t in (r.search_text or "") for t in tokens):
            continue
        if status_filter != "all" and st != status_filter:
            continue
        items.append(_item_out(r, st))
    last_at, last_by = _last_upload(db, hid)
    start = (page - 1) * size
    return StockListOut(items=items[start:start + size], total=len(items), counts=counts,
                        last_updated_at=last_at, last_updated_by=last_by, low_stock_threshold=threshold)


def _search_hospital_id(db: Session, me: User, appointment_id: UUID | None) -> int:
    """Whose shelf the doctor is looking at: the hospital of the visit they're
    prescribing for (a doctor may consult at several), else their home hospital."""
    if not (me.role and me.role.name == ROLE_DOCTOR):
        return _hospital_id(me)
    doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
    if not doctor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No doctor profile for this account")
    if appointment_id:
        appt = db.get(Appointment, appointment_id)
        if not appt or appt.doctor_id != doctor.doctor_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")
        return appt.hospital_id
    return doctor.hospital_id


def _group_key(r: PharmacyStock) -> tuple:
    return (sheet.norm(r.medicine_name), r.strength_key or "", sheet.form_key(r.form, r.medicine_name))


def _options(rows: list[PharmacyStock], threshold: int, today: date) -> list[tuple[MedicineOption, PharmacyStock]]:
    """Collapse batches of one medicine into a single choice. Unexpired
    quantities add up, and the choice points at the batch that expires first —
    the one the counter should hand out."""
    groups: dict[tuple, list[PharmacyStock]] = {}
    for r in rows:
        groups.setdefault(_group_key(r), []).append(r)
    out = []
    for batches in groups.values():
        live = [r for r in batches if not (r.expiry_date and r.expiry_date < today)]
        if live:
            qty = sum(max(r.quantity, 0) for r in live)
            stocked = [r for r in live if r.quantity > 0] or live
            pick = min(stocked, key=lambda r: (r.expiry_date is None, r.expiry_date or date.max))
            st = _status(qty, None, threshold, today)
        else:
            qty = 0
            pick = max(batches, key=lambda r: r.expiry_date or date.min)
            st = "expired"
        out.append((MedicineOption(
            stock_id=pick.stock_id, medicine_name=pick.medicine_name, generic_name=pick.generic_name or "",
            strength=pick.strength or "", form=pick.form or "", quantity=qty, status=st,
            expiry_date=pick.expiry_date, mrp=float(pick.mrp) if pick.mrp is not None else None,
        ), pick))
    return out


def _is_substitute(candidate: PharmacyStock, original: PharmacyStock) -> bool:
    """Same molecule and same dose. The dose must be known on both sides unless
    both are the same known form (a cream vs a cream), and a known form must
    not differ (a tablet is not a syrup)."""
    if _group_key(candidate) == _group_key(original):
        return False
    if candidate.strength_key != original.strength_key:
        return False
    form_a = sheet.form_key(candidate.form, candidate.medicine_name)
    form_b = sheet.form_key(original.form, original.medicine_name)
    if form_a and form_b and form_a != form_b:
        return False
    if not original.strength_key and not (form_a and form_a == form_b):
        return False
    return True


def _brand_composition(db: Session, tokens: list[str]) -> tuple[str, str, str, str] | None:
    """What a brand contains, learned from what every pharmacy on TapCure has uploaded.

    A doctor types "Dolo 650" at a hospital whose pharmacy never stocked Dolo, so
    that hospital's own sheet can't say it is paracetamol. Other pharmacies have
    uploaded Dolo with its composition, and a brand's composition is public
    knowledge — the sheets it comes from are not. Only (name, composition) is
    read here; quantities, prices and hospital identity never leave that query.

    Returns (brand name, composition text, generic key, strength key), or None
    when the brand is unknown or the pharmacies disagree about what it contains.
    """
    if not tokens:
        return None
    stmt = select(
        PharmacyStock.medicine_name, PharmacyStock.generic_name,
        PharmacyStock.generic_key, PharmacyStock.strength_key, func.count(),
    ).where(PharmacyStock.generic_key != "")
    for token in tokens[:4]:
        stmt = stmt.where(func.lower(PharmacyStock.medicine_name).like(f"%{_escape_like(token)}%", escape="\\"))
    rows = db.execute(
        stmt.group_by(PharmacyStock.medicine_name, PharmacyStock.generic_name,
                      PharmacyStock.generic_key, PharmacyStock.strength_key)
        .order_by(func.count().desc()).limit(5)
    ).all()
    if not rows:
        return None
    best = rows[0]
    # Pharmacies that disagree about the same brand: say nothing rather than guess.
    if any(r[2] != best[2] or r[3] != best[3] for r in rows[1:] if r[4] == best[4]):
        return None
    return best[0], best[1], best[2], best[3]


@router.get("/pharmacy/search", response_model=MedicineSearchOut)
def search_medicines(
    q: str = Query("", max_length=100),
    appointment_id: UUID | None = Query(None),
    me: User = Depends(require_permission("pharmacy", "read")),
    db: Session = Depends(get_db),
):
    """The doctor's medicine box. Every word typed must appear in the name,
    generic, strength or form. An empty `q` returns only the header facts —
    whether this hospital has a pharmacy list and how old it is."""
    hid = _search_hospital_id(db, me, appointment_id)
    s = _settings_row(db, hid)
    threshold, today = _threshold(_config(s)), _hospital_today(s)
    last_at, last_by = _last_upload(db, hid)
    out = MedicineSearchOut(has_pharmacy=last_at is not None, last_updated_at=last_at,
                            last_updated_by=last_by, low_stock_threshold=threshold)
    tokens = sheet.norm(q).split()[:6]
    if not tokens or last_at is None:
        return out

    stmt = select(PharmacyStock).where(PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True))
    for t in tokens:  # norm() leaves only [a-z0-9. ], so no LIKE wildcards can sneak in
        stmt = stmt.where(PharmacyStock.search_text.like(f"%{t}%"))
    options = _options(db.scalars(stmt.limit(300)).all(), threshold, today)
    options.sort(key=lambda op: (
        not sheet.norm(op[0].medicine_name).startswith(tokens[0]),
        op[0].status not in AVAILABLE,
        sheet.norm(op[0].medicine_name),
    ))
    options = options[:12]

    # Nothing of that name here: if we know the brand from other pharmacies'
    # sheets, offer this hospital's own brands of the same medicine instead.
    if not options:
        # Same brand here in another strength? Dropping the numbers from the
        # query finds it ("levipil 250" -> Levipil 500). Information only: the
        # doctor decides, we never swap a strength for them.
        # Numbers AND unit words go: "levipil 10 mg" must still find Levipil 500,
        # whose NAME column holds no "mg".
        brand_words = [t for t in tokens if not t.replace(".", "").isdigit() and t not in _DOSE_UNITS]
        if brand_words:
            brand_stmt = select(PharmacyStock).where(
                PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True),
            )
            for word in brand_words[:3]:
                brand_stmt = brand_stmt.where(
                    func.lower(PharmacyStock.medicine_name).like(f"%{_escape_like(word)}%", escape="\\"))
            same_brand = [opt for opt, _ in _options(db.scalars(brand_stmt.limit(50)).all(), threshold, today)]
            out.other_strength = sorted(
                [o for o in same_brand if o.status in AVAILABLE], key=lambda o: -o.quantity)[:3]

        known = _brand_composition(db, tokens)
        if known:
            brand, composition, generic_key, strength_key = known
            same = db.scalars(select(PharmacyStock).where(
                PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True),
                PharmacyStock.generic_key == generic_key, PharmacyStock.strength_key == strength_key,
            )).all()
            available = [opt for opt, _ in _options(same, threshold, today) if opt.status in AVAILABLE]
            if available:
                out.not_stocked_name = brand
                out.not_stocked_generic = composition
                out.alternatives = sorted(available, key=lambda o: -o.quantity)[:3]
        return out

    needy = [pick for opt, pick in options if opt.status not in AVAILABLE and pick.generic_key]
    pool: dict[str, list[tuple[MedicineOption, PharmacyStock]]] = {}
    if needy:
        same_generic = db.scalars(select(PharmacyStock).where(
            PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True),
            PharmacyStock.generic_key.in_({p.generic_key for p in needy}),
        )).all()
        for opt, pick in _options(same_generic, threshold, today):
            if opt.status in AVAILABLE:
                pool.setdefault(pick.generic_key, []).append((opt, pick))

    for opt, pick in options:
        match = MedicineMatch(**opt.model_dump())
        if opt.status not in AVAILABLE and pick.generic_key:
            subs = [o for o, p in pool.get(pick.generic_key, []) if _is_substitute(p, pick)]
            match.substitutes = sorted(subs, key=lambda o: -o.quantity)[:3]
        out.results.append(match)
    return out


# ============================================================= pharmacists ====
def _pharmacist_role(db: Session) -> Role:
    role = db.scalar(select(Role).where(Role.name == ROLE_PHARMACIST))
    if not role:
        raise HTTPException(500, "PHARMACIST role not seeded — run `alembic upgrade head`")
    return role


@router.get("/pharmacists", response_model=list[PharmacistOut])
def list_pharmacists(me: User = Depends(require_permission("user", "read")), db: Session = Depends(get_db)):
    hid = _hospital_id(me)
    role = _pharmacist_role(db)
    return db.scalars(
        select(User).where(User.hospital_id == hid, User.role_id == role.role_id).order_by(User.user_id)
    ).all()


@router.post("/pharmacists/onboard", response_model=PharmacistOut, status_code=201)
def onboard_pharmacist(
    body: PharmacistOnboard,
    me: User = Depends(require_permission("user", "create")),
    db: Session = Depends(get_db),
):
    """Hospital admin adds a pharmacist login to their OWN hospital. The pharmacist
    signs in on the hospital login page like the front desk does."""
    hid = _hospital_id(me)
    email = accounts.normalize_email(body.email)
    if accounts.email_taken(db, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    if body.phone and db.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Phone already registered")
    role = _pharmacist_role(db)
    u = User(hospital_id=hid, role_id=role.role_id, name=body.name.strip(), **person_name.parts(body), email=email,
             phone=body.phone, password_hash=hash_password(body.password), employee_id=body.employee_id)
    db.add(u)
    audit.log_activity(db, me.user_id, "pharmacist.create", "pharmacy", {"hospital_id": hid, "email": email})
    db.commit()
    db.refresh(u)
    return u


@router.put("/pharmacists/{user_id}", response_model=PharmacistOut)
def update_pharmacist(
    user_id: UUID,
    body: StaffAccountUpdate,
    me: User = Depends(require_permission("user", "update")),
    db: Session = Depends(get_db),
):
    """Edit a pharmacist's login, e.g. to hand it over to a replacement."""
    hid = _hospital_id(me)
    u = db.get(User, user_id)
    if not u or u.hospital_id != hid or not u.role or u.role.name != ROLE_PHARMACIST:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pharmacist not found")
    accounts.update_staff_login(db, u, name=body.name, email=body.email, phone=body.phone, password=body.password)
    if body.employee_id is not None:
        u.employee_id = body.employee_id or None
    if body.is_active is not None:
        u.status = "active" if body.is_active else "inactive"
        if not body.is_active:
            accounts.end_sessions(db, u)
    audit.log_activity(db, me.user_id, "pharmacist.update", "pharmacy",
                       {"hospital_id": hid, "user_id": user_id, "fields": sorted(body.model_dump(exclude_unset=True))})
    db.commit()
    db.refresh(u)
    return u


@router.delete("/pharmacists/{user_id}")
def deactivate_pharmacist(
    user_id: UUID,
    me: User = Depends(require_permission("user", "delete")),
    db: Session = Depends(get_db),
):
    hid = _hospital_id(me)
    u = db.get(User, user_id)
    if not u or u.hospital_id != hid or not u.role or u.role.name != ROLE_PHARMACIST:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pharmacist not found")
    u.status = "inactive"
    accounts.end_sessions(db, u)
    audit.log_activity(db, me.user_id, "pharmacist.deactivate", "pharmacy", {"hospital_id": hid, "user_id": user_id})
    db.commit()
    return {"message": "Pharmacist deactivated"}


# =================================================== counter: prescriptions ====
# The pharmacy counter's view of prescriptions. Counter staff only: gated on
# pharmacy.update, which pharmacists and hospital admins hold and doctors don't
# (a doctor's pharmacy.read is for their own prescribing box). The existing
# /prescriptions endpoints are untouched — this is a separate, narrower read.
COUNTER = ("pharmacy", "update")
# A search looks this far back whatever range is picked, so a patient back for
# next month's supply is always found.
SEARCH_DAYS = 180
# Giving a line again within this many days needs the counter to confirm it's a
# new supply — it's more often a second pharmacist on a stale screen.
RECENT_DAYS = 7
UNDO_STOP_REASON = "Pharmacy undo: medicine was not given"
# Strength words: part of the dose the doctor typed, never part of the brand name.
_DOSE_UNITS = {"mg", "mcg", "g", "gm", "ml", "iu", "unit", "units"}


def _hospital_zone(s: HospitalSettings | None):
    try:
        return ZoneInfo((s.timezone if s else None) or "Asia/Kolkata")
    except Exception:
        return timezone(timedelta(hours=5, minutes=30))


def _utc(dt: datetime) -> datetime:
    """Rows read back from Postgres are timezone-aware; ones just written are naive UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _visible_rx(stmt, hid: int):
    """Only prescriptions written AT this hospital, never a doctor's personal practice.

    The hospital is taken from the visit, not `prescriptions.hospital_id` — that
    column holds the doctor's home hospital, so a doctor who also consults
    elsewhere would otherwise land on the wrong counter. Personal practice is
    hidden the same way the front desk's lists hide it (appointments.
    _hide_personal): a visit with no practice recorded is a legacy hospital
    booking and is kept. A prescription written without a visit falls back to
    its own hospital, provided the doctor has a hospital-run practice there.
    """
    visit_aff = aliased(DoctorAffiliation)
    hospital_aff = aliased(DoctorAffiliation)
    return (
        stmt.outerjoin(Appointment, Appointment.appointment_id == Prescription.appointment_id)
        .outerjoin(visit_aff, visit_aff.affiliation_id == Appointment.affiliation_id)
        .where(or_(
            and_(
                Prescription.appointment_id.is_not(None),
                Appointment.hospital_id == hid,
                or_(Appointment.affiliation_id.is_(None), visit_aff.managed_by_hospital.is_(True)),
            ),
            and_(
                Prescription.appointment_id.is_(None),
                Prescription.hospital_id == hid,
                exists().where(
                    hospital_aff.doctor_id == Prescription.doctor_id,
                    hospital_aff.hospital_id == hid,
                    hospital_aff.managed_by_hospital.is_(True),
                ),
            ),
        ))
    )


def _counter_rx(db: Session, hid: int, prescription_id: UUID, *, lock: bool = False) -> Prescription:
    stmt = _visible_rx(select(Prescription), hid).where(Prescription.prescription_id == prescription_id)
    if lock:
        # Two pharmacists recording the same prescription at once must not both succeed.
        stmt = stmt.with_for_update(of=Prescription)
    rx = db.scalar(stmt)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found at this hospital")
    return rx


def _rx_state(item_count: int, recorded: int) -> str:
    if recorded == 0:
        return "pending"
    return "done" if recorded >= item_count else "partial"


def _counter_suggestions(db: Session, hid: int, drug_name: str, linked: PharmacyStock | None,
                         threshold: int, today: date):
    """What the counter can hand over instead, when the prescribed line can't be.

    The doctor's box already does this; the pharmacist needs it more, because a
    prescription can name a brand this pharmacy has never kept and nobody at the
    counter knows every composition by heart. Same three steps as the doctor's
    search: the medicine itself under another batch, then the same composition
    and strength under another brand, then — information only — the same brand
    in another strength.

    Returns (same medicine available now, what makes them the same, other strengths).
    """
    tokens = sheet.norm(drug_name).split()[:6]
    if not tokens:
        return [], None, []

    def available(rows):
        return [opt for opt, _ in _options(rows, threshold, today) if opt.status in AVAILABLE]

    # 1. The very same medicine, perhaps on another batch row.
    stmt = select(PharmacyStock).where(PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True))
    for token in tokens:
        stmt = stmt.where(PharmacyStock.search_text.like(f"%{token}%"))
    direct = available(db.scalars(stmt.limit(100)).all())
    if direct:
        return direct[:3], None, []

    # 2. Same composition + strength under another brand — from the line's own
    #    stock row when the doctor picked one, else from what other pharmacies
    #    have uploaded about this brand.
    label = linked.generic_name or None if linked is not None else None
    gkey = linked.generic_key if linked is not None else ""
    skey = linked.strength_key if linked is not None else ""
    if not gkey:
        known = _brand_composition(db, tokens)
        if known:
            _, label, gkey, skey = known
    if gkey:
        rows = db.scalars(select(PharmacyStock).where(
            PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True),
            PharmacyStock.generic_key == gkey, PharmacyStock.strength_key == skey,
        )).all()
        same = available(rows)
        if same:
            return sorted(same, key=lambda o: -o.quantity)[:3], label, []

    # 3. Same brand, another strength. Never a substitute — the doctor decides.
    brand_words = [t for t in tokens if not t.replace(".", "").isdigit() and t not in _DOSE_UNITS]
    if not brand_words:
        return [], label, []
    brand_stmt = select(PharmacyStock).where(PharmacyStock.hospital_id == hid, PharmacyStock.is_active.is_(True))
    for word in brand_words[:3]:
        brand_stmt = brand_stmt.where(
            func.lower(PharmacyStock.medicine_name).like(f"%{_escape_like(word)}%", escape="\\"))
    return [], label, sorted(available(db.scalars(brand_stmt.limit(50)).all()), key=lambda o: -o.quantity)[:3]


def _detail(db: Session, hid: int, rx: Prescription) -> CounterRxDetail:
    s = _settings_row(db, hid)
    threshold, today, zone = _threshold(_config(s)), _hospital_today(s), _hospital_zone(s)
    items = db.scalars(
        select(PrescriptionItem).where(PrescriptionItem.prescription_id == rx.prescription_id)
        .order_by(PrescriptionItem.item_id)
    ).all()
    records = list(db.scalars(select(PharmacyDispense).where(
        PharmacyDispense.prescription_id == rx.prescription_id, PharmacyDispense.undone_at.is_(None),
    ).order_by(PharmacyDispense.dispensed_at, PharmacyDispense.dispense_id)))
    history: dict[int, list[PharmacyDispense]] = {}
    for d in records:
        history.setdefault(d.item_id, []).append(d)
    stock_ids = {i.stock_id for i in items if i.stock_id} | {d.stock_id for d in records if d.stock_id}
    stock = {r.stock_id: r for r in db.scalars(select(PharmacyStock).where(
        PharmacyStock.stock_id.in_(stock_ids), PharmacyStock.hospital_id == hid,
    ))} if stock_ids else {}
    user_ids = {d.dispensed_by for d in records if d.dispensed_by}
    names = dict(db.execute(select(User.user_id, User.name).where(User.user_id.in_(user_ids))).all()) if user_ids else {}

    def option(r: PharmacyStock) -> MedicineOption:
        qty = r.quantity if r.is_active else 0  # dropped from the latest sheet = not on the shelf
        return MedicineOption(
            stock_id=r.stock_id, medicine_name=r.medicine_name, generic_name=r.generic_name or "",
            strength=r.strength or "", form=r.form or "", quantity=qty,
            status=_status(qty, r.expiry_date, threshold, today), expiry_date=r.expiry_date,
            mrp=float(r.mrp) if r.mrp is not None else None,
        )

    def hand_over(d: PharmacyDispense) -> DispenseOut:
        given_from = stock.get(d.stock_id) if d.stock_id else None
        return DispenseOut(
            dispense_id=d.dispense_id, outcome=d.outcome, stock_id=d.stock_id,
            stock_name=given_from.medicine_name if given_from else None,
            batch_no=(given_from.batch_no or "") if given_from else "",
            quantity=d.quantity, dispensed_by=names.get(d.dispensed_by), dispensed_at=d.dispensed_at,
            reminders_started=d.course_id is not None,
            can_undo=_utc(d.dispensed_at).astimezone(zone).date() == today,
        )

    out_items = []
    for it in items:
        past = history.get(it.item_id, [])
        given = [d for d in past if d.outcome == DISPENSE_GIVEN]
        linked = stock.get(it.stock_id) if it.stock_id else None
        linked_option = option(linked) if linked else None
        # Only for lines still waiting that can't be handed over as written.
        suggestions, suggestion_generic, other_strength = [], None, []
        if not past and (linked_option is None or linked_option.status not in AVAILABLE):
            suggestions, suggestion_generic, other_strength = _counter_suggestions(
                db, hid, it.drug_name, linked, threshold, today)
        out_items.append(CounterRxItem(
            item_id=it.item_id, drug_name=it.drug_name, dosage=it.dosage or "", frequency=it.frequency or "",
            duration=it.duration or "", instructions=it.instructions or "",
            stock=linked_option,
            suggestions=suggestions, suggestion_generic=suggestion_generic, other_strength=other_strength,
            dispenses=[hand_over(d) for d in past],
            given_total=sum(d.quantity for d in given),
            last_given_at=given[-1].dispensed_at if given else None,
        ))
    patient = db.get(Patient, rx.patient_id)
    doctor = db.get(Doctor, rx.doctor_id)
    member = db.get(FamilyMember, rx.family_member_id) if rx.family_member_id else None
    return CounterRxDetail(
        prescription_id=rx.prescription_id, created_at=rx.created_at, patient_id=rx.patient_id,
        patient_name=patient.name if patient else None, patient_uhid=patient.uhid if patient else None,
        patient_phone=patient.phone if patient else None,
        family_member_name=member.name if member else None,
        doctor_name=doctor.name if doctor else None,
        status=_rx_state(len(items), len(history)), items=out_items,
    )


@router.get("/pharmacy/prescriptions", response_model=CounterRxList)
def counter_prescriptions(
    q: str = Query("", max_length=100),
    days: int = Query(1, ge=1, le=30),
    state: str = Query("all", pattern="^(all|pending|partial|done)$"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission(*COUNTER)),
    db: Session = Depends(get_db),
):
    """Prescriptions written at this hospital over the last `days` hospital-local
    days (1 = today), newest first. `q` matches the patient's or dependent's
    name, mobile number or UHID, and looks back SEARCH_DAYS whatever `days` is."""
    hid = _hospital_id(me)
    zone = _hospital_zone(_settings_row(db, hid))
    term = q.strip()
    window = max(days, SEARCH_DAYS) if term else days
    first_day = datetime.now(zone).date() - timedelta(days=window - 1)
    since = datetime.combine(first_day, dtime.min, tzinfo=zone).astimezone(timezone.utc).replace(tzinfo=None)

    stmt = (
        _visible_rx(
            select(
                Prescription, Patient.name.label("patient_name"), Patient.uhid.label("patient_uhid"),
                Doctor.name.label("doctor_name"), FamilyMember.name.label("member_name"),
            ).select_from(Prescription),
            hid,
        )
        .join(Patient, Patient.patient_id == Prescription.patient_id)
        .outerjoin(Doctor, Doctor.doctor_id == Prescription.doctor_id)
        .outerjoin(FamilyMember, FamilyMember.member_id == Prescription.family_member_id)
        .where(Prescription.created_at >= since)
    )
    if term:
        like =f"%{_escape_like(term.lower())}%"
        conditions = [
            func.lower(Patient.name).like(like, escape="\\"),
            func.lower(FamilyMember.name).like(like, escape="\\"),
            func.upper(Patient.uhid).like(f"%{_escape_like(term.upper())}%", escape="\\"),
        ]
        digits = re.sub(r"\D", "", term)
        if len(digits) >= 4:
            conditions.append(Patient.phone.like(f"%{digits}%"))
        stmt = stmt.where(or_(*conditions))
    rows = db.execute(stmt.order_by(Prescription.created_at.desc()).limit(1000)).all()

    ids = [r[0].prescription_id for r in rows]
    item_counts, recorded = {}, {}
    if ids:
        item_counts = dict(db.execute(
            select(PrescriptionItem.prescription_id, func.count())
            .where(PrescriptionItem.prescription_id.in_(ids)).group_by(PrescriptionItem.prescription_id)
        ).all())
        recorded = dict(db.execute(
            select(PharmacyDispense.prescription_id, func.count(func.distinct(PharmacyDispense.item_id)))
            .where(PharmacyDispense.prescription_id.in_(ids), PharmacyDispense.undone_at.is_(None))
            .group_by(PharmacyDispense.prescription_id)
        ).all())

    counts = CounterRxCounts()
    out: list[CounterRxRow] = []
    for rx, patient_name, patient_uhid, doctor_name, member_name in rows:
        n_items, n_recorded = item_counts.get(rx.prescription_id, 0), recorded.get(rx.prescription_id, 0)
        st = _rx_state(n_items, n_recorded)
        counts.all += 1
        setattr(counts, st, getattr(counts, st) + 1)
        if state != "all" and st != state:
            continue
        out.append(CounterRxRow(
            prescription_id=rx.prescription_id, created_at=rx.created_at, patient_id=rx.patient_id,
            patient_name=patient_name, patient_uhid=patient_uhid, family_member_name=member_name,
            doctor_name=doctor_name, item_count=n_items, recorded_count=n_recorded, status=st,
        ))
    start = (page - 1) * size
    return CounterRxList(items=out[start:start + size], total=len(out), counts=counts, days=days, window_days=window)


@router.get("/pharmacy/prescriptions/{prescription_id}", response_model=CounterRxDetail)
def counter_prescription(
    prescription_id: UUID,
    me: User = Depends(require_permission(*COUNTER)),
    db: Session = Depends(get_db),
):
    hid = _hospital_id(me)
    return _detail(db, hid, _counter_rx(db, hid, prescription_id))


@router.post("/pharmacy/prescriptions/{prescription_id}/dispense", response_model=DispenseResult)
def dispense(
    prescription_id: UUID,
    body: DispenseRequest,
    me: User = Depends(require_permission(*COUNTER)),
    db: Session = Depends(get_db),
):
    """Record what the counter handed over, line by line.

    `given` takes the quantity off that stock row and starts the patient's
    medicine reminders for the line (only if they were still waiting to start —
    reminders the patient already started are left alone). `outside` records
    that the hospital doesn't have it. Everything is checked before anything is
    written, so a bad line saves nothing.
    """
    hid = _hospital_id(me)
    rx = _counter_rx(db, hid, prescription_id, lock=True)
    today = _hospital_today(_settings_row(db, hid))
    items = {i.item_id: i for i in db.scalars(
        select(PrescriptionItem).where(PrescriptionItem.prescription_id == rx.prescription_id)
    )}
    live = list(db.scalars(select(PharmacyDispense).where(
        PharmacyDispense.prescription_id == rx.prescription_id, PharmacyDispense.undone_at.is_(None),
    ).order_by(PharmacyDispense.dispensed_at, PharmacyDispense.dispense_id)))
    recorded_items = {d.item_id for d in live}

    seen: set[int] = set()
    for line in body.items:
        item = items.get(line.item_id)
        if item is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Medicine line {line.item_id} is not on this prescription")
        if line.item_id in seen:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{item.drug_name} is listed twice")
        seen.add(line.item_id)
        # A line can be given again (next month's supply), but "not from our
        # stock" only makes sense before anything was recorded for it.
        if line.outcome != DISPENSE_GIVEN and line.item_id in recorded_items:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"{item.drug_name} already has a hand-over recorded. Undo it first to change it.")
        if line.outcome == DISPENSE_GIVEN:
            if not line.stock_id:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{item.drug_name}: choose which stock item was given")
            if line.quantity < 1:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{item.drug_name}: enter how many were given")

    given_ids = {line.stock_id for line in body.items if line.outcome == DISPENSE_GIVEN}
    stock = {r.stock_id: r for r in db.scalars(
        select(PharmacyStock).where(PharmacyStock.stock_id.in_(given_ids), PharmacyStock.hospital_id == hid)
        .with_for_update()
    )} if given_ids else {}
    for line in body.items:
        if line.outcome != DISPENSE_GIVEN:
            continue
        drug, row = items[line.item_id].drug_name, stock.get(line.stock_id)
        if row is None or not row.is_active:
            raise HTTPException(status.HTTP_409_CONFLICT, f"{drug}: that item is not in this hospital's current stock list")
        if row.expiry_date and row.expiry_date < today:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"{drug}: {row.medicine_name} batch {row.batch_no or '-'} is expired and can't be given")

    # Given again within RECENT_DAYS: refuse until the counter confirms it's a
    # new supply. Carries the earlier hand-over so the screen can ask the question.
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)
    latest_given = {d.item_id: d for d in live if d.outcome == DISPENSE_GIVEN}  # ordered, so the newest wins
    repeats = [
        line for line in body.items
        if line.outcome == DISPENSE_GIVEN and not line.repeat_ok
        and line.item_id in latest_given and _utc(latest_given[line.item_id].dispensed_at) >= cutoff
    ]
    if repeats:
        earlier = [latest_given[line.item_id] for line in repeats]
        by_ids = {d.dispensed_by for d in earlier if d.dispensed_by}
        by = dict(db.execute(select(User.user_id, User.name).where(User.user_id.in_(by_ids))).all()) if by_ids else {}
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "code": "recently_given",
            "message": "Some of these medicines were given in the last few days. Confirm this is a new supply.",
            "items": [
                {"item_id": d.item_id, "drug_name": items[d.item_id].drug_name, "quantity": d.quantity,
                 "dispensed_at": _utc(d.dispensed_at).isoformat(), "dispensed_by": by.get(d.dispensed_by)}
                for d in earlier
            ],
        })

    # Reminders start with the first hand-over only: a course still waiting, or
    # one this counter stopped by undoing a hand-over. A refill never restarts a
    # running course, and a course the patient stopped themselves stays stopped.
    waiting = {c.item_id: c for c in db.scalars(select(MedicineCourse).where(
        MedicineCourse.prescription_id == rx.prescription_id,
        or_(
            MedicineCourse.status == COURSE_AWAITING,
            and_(MedicineCourse.status == COURSE_STOPPED, MedicineCourse.stop_reason == UNDO_STOP_REASON),
        ),
    ))}
    now = utcnow()
    warnings: list[str] = []
    for line in body.items:
        item = items[line.item_id]
        rec = PharmacyDispense(
            hospital_id=hid, prescription_id=rx.prescription_id, item_id=item.item_id,
            outcome=line.outcome, dispensed_by=me.user_id, dispensed_at=now,
        )
        if line.outcome == DISPENSE_GIVEN:
            row = stock[line.stock_id]
            deducted = min(line.quantity, max(row.quantity, 0))
            if line.quantity > row.quantity:
                warnings.append(f"{item.drug_name}: {line.quantity} given but only {max(row.quantity, 0)} "
                                "were in the stock list, so it is now 0. Please check the count.")
            row.quantity = max(row.quantity, 0) - deducted
            rec.stock_id, rec.quantity, rec.stock_deducted = row.stock_id, line.quantity, deducted
            course = waiting.get(item.item_id)
            if course is not None:
                reminder_engine.start_course(db, course)
                rec.course_id = course.course_id
        db.add(rec)

    audit.log_activity(db, me.user_id, "pharmacy.dispense", "pharmacy", {
        "hospital_id": hid, "prescription_id": rx.prescription_id,
        "lines": [{"item_id": l.item_id, "outcome": l.outcome, "stock_id": l.stock_id, "quantity": l.quantity}
                  for l in body.items],
    })
    db.commit()
    return DispenseResult(prescription=_detail(db, hid, rx), warnings=warnings)


@router.post("/pharmacy/dispenses/{dispense_id}/undo", response_model=DispenseResult)
def undo_dispense(
    dispense_id: UUID,
    me: User = Depends(require_permission(*COUNTER)),
    db: Session = Depends(get_db),
):
    """Take back a record made by mistake — same hospital-local day only.

    The stock goes back up unless a newer stock sheet was uploaded after the
    hand-over (that sheet already has the real count). Reminders this record
    started are stopped again.
    """
    hid = _hospital_id(me)
    found = db.get(PharmacyDispense, dispense_id)
    if not found or found.hospital_id != hid or found.undone_at is not None or not found.prescription_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nothing to undo")
    rx = _counter_rx(db, hid, found.prescription_id, lock=True)
    d = db.scalar(select(PharmacyDispense).where(PharmacyDispense.dispense_id == dispense_id).with_for_update())
    if d.undone_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nothing to undo")
    s = _settings_row(db, hid)
    if _utc(d.dispensed_at).astimezone(_hospital_zone(s)).date() != _hospital_today(s):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only today's records can be undone")

    warnings: list[str] = []
    item = db.get(PrescriptionItem, d.item_id) if d.item_id else None
    drug = item.drug_name if item else "This medicine"
    if d.outcome == DISPENSE_GIVEN and d.stock_id and d.stock_deducted:
        row = db.scalar(select(PharmacyStock).where(PharmacyStock.stock_id == d.stock_id).with_for_update())
        if row is not None and _utc(row.uploaded_at) <= _utc(d.dispensed_at):
            row.quantity += d.stock_deducted
        else:
            warnings.append(f"{drug}: stock not changed. A newer stock sheet was uploaded after this was given, "
                            "so it already has the right count.")
    if d.course_id:
        course = db.get(MedicineCourse, d.course_id)
        # Another hand-over of the same medicine still stands (e.g. a refill):
        # the patient has the medicine, so reminders keep going and that record
        # takes over the course. Only the last one standing stops them.
        other = db.scalar(select(PharmacyDispense).where(
            PharmacyDispense.item_id == d.item_id, PharmacyDispense.undone_at.is_(None),
            PharmacyDispense.outcome == DISPENSE_GIVEN, PharmacyDispense.dispense_id != d.dispense_id,
        ).order_by(PharmacyDispense.dispensed_at.desc()).limit(1)) if d.item_id else None
        if course is not None and course.status == COURSE_ACTIVE:
            if other is not None:
                other.course_id = course.course_id
            else:
                reminder_engine.stop_course(db, course, UNDO_STOP_REASON)
                warnings.append(f"{drug}: medicine reminders were stopped.")
    d.undone_at = utcnow()
    d.undone_by = me.user_id
    audit.log_activity(db, me.user_id, "pharmacy.dispense_undo", "pharmacy",
                       {"hospital_id": hid, "dispense_id": dispense_id, "prescription_id": rx.prescription_id})
    db.commit()
    return DispenseResult(prescription=_detail(db, hid, rx), warnings=warnings)


# =================================================== counter: walk-in sales ====
# Outside customers buying at the counter without a prescription from this
# hospital. Each medicine line is an ordinary hand-over row (pharmacy_dispenses
# with sale_id set and no prescription), so stock, expiry and undo follow the
# prescription rules. No prices — this exists so the stock count stays right.
# Prescription endpoints never see these rows: they all filter on prescription_id.
def _sales_out(db: Session, hid: int, sales: list[PharmacyWalkinSale]) -> list[WalkinSaleOut]:
    if not sales:
        return []
    s = _settings_row(db, hid)
    zone, today = _hospital_zone(s), _hospital_today(s)
    lines = db.scalars(
        select(PharmacyDispense).where(PharmacyDispense.sale_id.in_([x.sale_id for x in sales]))
        .order_by(PharmacyDispense.dispense_id)
    ).all()
    stock_ids = {line.stock_id for line in lines if line.stock_id}
    stock = {r.stock_id: r for r in db.scalars(select(PharmacyStock).where(PharmacyStock.stock_id.in_(stock_ids)))} if stock_ids else {}
    user_ids = {x.sold_by for x in sales if x.sold_by}
    names = dict(db.execute(select(User.user_id, User.name).where(User.user_id.in_(user_ids))).all()) if user_ids else {}
    by_sale: dict[int, list[PharmacyDispense]] = {}
    for line in lines:
        by_sale.setdefault(line.sale_id, []).append(line)

    out = []
    for x in sales:
        items = []
        for line in by_sale.get(x.sale_id, []):
            row = stock.get(line.stock_id)
            items.append(WalkinSaleLineOut(
                dispense_id=line.dispense_id, stock_id=line.stock_id,
                medicine_name=row.medicine_name if row else "", strength=(row.strength or "") if row else "",
                batch_no=(row.batch_no or "") if row else "", quantity=line.quantity,
            ))
        out.append(WalkinSaleOut(
            sale_id=x.sale_id, customer_name=x.customer_name or "", customer_phone=x.customer_phone or "",
            prescribed_by=x.prescribed_by or "", sold_by=names.get(x.sold_by), sold_at=x.sold_at,
            undone=x.undone_at is not None,
            can_undo=x.undone_at is None and _utc(x.sold_at).astimezone(zone).date() == today,
            items=items,
        ))
    return out


@router.get("/pharmacy/walkin-sales", response_model=WalkinSaleList)
def walkin_sales(
    q: str = Query("", max_length=100),
    days: int = Query(1, ge=1, le=30),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission(*COUNTER)),
    db: Session = Depends(get_db),
):
    """Walk-in sales over the last `days` hospital-local days (1 = today), newest
    first. Undone sales are left out. `q` matches customer name, mobile or who
    prescribed it."""
    hid = _hospital_id(me)
    zone = _hospital_zone(_settings_row(db, hid))
    first_day = datetime.now(zone).date() - timedelta(days=days - 1)
    since = datetime.combine(first_day, dtime.min, tzinfo=zone).astimezone(timezone.utc).replace(tzinfo=None)
    stmt = select(PharmacyWalkinSale).where(
        PharmacyWalkinSale.hospital_id == hid, PharmacyWalkinSale.undone_at.is_(None),
        PharmacyWalkinSale.sold_at >= since,
    )
    term = q.strip()
    if term:
        like = f"%{_escape_like(term.lower())}%"
        conditions = [
            func.lower(PharmacyWalkinSale.customer_name).like(like, escape="\\"),
            func.lower(PharmacyWalkinSale.prescribed_by).like(like, escape="\\"),
        ]
        digits = re.sub(r"\D", "", term)
        if len(digits) >= 4:
            conditions.append(PharmacyWalkinSale.customer_phone.like(f"%{digits}%"))
        stmt = stmt.where(or_(*conditions))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    sales = db.scalars(
        stmt.order_by(PharmacyWalkinSale.sold_at.desc()).offset((page - 1) * size).limit(size)
    ).all()
    return WalkinSaleList(items=_sales_out(db, hid, list(sales)), total=total, days=days)


@router.post("/pharmacy/walkin-sales", response_model=WalkinSaleResult, status_code=201)
def create_walkin_sale(
    body: WalkinSaleCreate,
    me: User = Depends(require_permission(*COUNTER)),
    db: Session = Depends(get_db),
):
    """Record medicines handed to an outside customer; stock goes down.
    Everything is checked before anything is written, so a bad line saves nothing."""
    hid = _hospital_id(me)
    today = _hospital_today(_settings_row(db, hid))
    ids = [line.stock_id for line in body.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "The same medicine is listed twice. Put the quantities on one line.")
    stock = {r.stock_id: r for r in db.scalars(
        select(PharmacyStock).where(PharmacyStock.stock_id.in_(ids), PharmacyStock.hospital_id == hid).with_for_update()
    )}
    for line in body.items:
        row = stock.get(line.stock_id)
        if row is None or not row.is_active:
            raise HTTPException(status.HTTP_409_CONFLICT, "A medicine in this sale is not in this hospital's current stock list")
        if row.expiry_date and row.expiry_date < today:
            raise HTTPException(status.HTTP_409_CONFLICT,
                                f"{row.medicine_name} batch {row.batch_no or '-'} is expired and can't be sold")

    now = utcnow()
    sale = PharmacyWalkinSale(
        hospital_id=hid, customer_name=body.customer_name, customer_phone=body.customer_phone,
        prescribed_by=body.prescribed_by, sold_by=me.user_id, sold_at=now,
    )
    db.add(sale)
    db.flush()
    warnings: list[str] = []
    for line in body.items:
        row = stock[line.stock_id]
        on_shelf = max(row.quantity, 0)
        deducted = min(line.quantity, on_shelf)
        if line.quantity > on_shelf:
            warnings.append(f"{row.medicine_name}: {line.quantity} sold but only {on_shelf} were in the stock list, "
                            "so it is now 0. Please check the count.")
        row.quantity = on_shelf - deducted
        db.add(PharmacyDispense(
            hospital_id=hid, sale_id=sale.sale_id, outcome=DISPENSE_GIVEN, stock_id=row.stock_id,
            quantity=line.quantity, stock_deducted=deducted, dispensed_by=me.user_id, dispensed_at=now,
        ))
    # Customer name and mobile stay on the sale row only, not in the activity log.
    audit.log_activity(db, me.user_id, "pharmacy.walkin_sale", "pharmacy", {
        "hospital_id": hid, "sale_id": sale.sale_id,
        "lines": [{"stock_id": line.stock_id, "quantity": line.quantity} for line in body.items],
    })
    db.commit()
    return WalkinSaleResult(sale=_sales_out(db, hid, [sale])[0], warnings=warnings)


@router.post("/pharmacy/walkin-sales/{sale_id}/undo", response_model=WalkinSaleResult)
def undo_walkin_sale(
    sale_id: UUID,
    me: User = Depends(require_permission(*COUNTER)),
    db: Session = Depends(get_db),
):
    """Take back a whole sale recorded by mistake — same hospital-local day only.
    Stock goes back up unless a newer stock sheet was uploaded since the sale."""
    hid = _hospital_id(me)
    sale = db.scalar(select(PharmacyWalkinSale).where(PharmacyWalkinSale.sale_id == sale_id).with_for_update())
    if not sale or sale.hospital_id != hid or sale.undone_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Nothing to undo")
    s = _settings_row(db, hid)
    if _utc(sale.sold_at).astimezone(_hospital_zone(s)).date() != _hospital_today(s):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only today's sales can be undone")

    lines = db.scalars(select(PharmacyDispense).where(
        PharmacyDispense.sale_id == sale.sale_id, PharmacyDispense.undone_at.is_(None),
    )).all()
    stock_ids = {line.stock_id for line in lines if line.stock_id}
    stock = {r.stock_id: r for r in db.scalars(
        select(PharmacyStock).where(PharmacyStock.stock_id.in_(stock_ids)).with_for_update()
    )} if stock_ids else {}
    now = utcnow()
    warnings: list[str] = []
    for line in lines:
        row = stock.get(line.stock_id)
        if line.stock_deducted and row is not None:
            if _utc(row.uploaded_at) <= _utc(line.dispensed_at):
                row.quantity += line.stock_deducted
            else:
                warnings.append(f"{row.medicine_name}: stock not changed. A newer stock sheet was uploaded after "
                                "this sale, so it already has the right count.")
        line.undone_at, line.undone_by = now, me.user_id
    sale.undone_at, sale.undone_by = now, me.user_id
    audit.log_activity(db, me.user_id, "pharmacy.walkin_sale_undo", "pharmacy", {"hospital_id": hid, "sale_id": sale_id})
    db.commit()
    return WalkinSaleResult(sale=_sales_out(db, hid, [sale])[0], warnings=warnings)
