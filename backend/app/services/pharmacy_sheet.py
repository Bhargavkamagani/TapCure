"""
Read a pharmacist's stock sheet (Excel or CSV) into clean medicine rows.

Pharmacists already keep stock sheets and no two look alike, so nothing here
assumes our template: the header row is found by looking for familiar column
names, each of our fields is matched to one of their columns, and the pharmacist
confirms or corrects that matching once (the router remembers it per hospital).

Pure functions, no database — the router decides what to do with the result.
"""
import csv
import io
import re
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

MAX_ROWS = 20000
# Largest believable values for one line of a hospital pharmacy's stock. Anything
# bigger is nearly always the wrong column picked (a barcode, an item code) —
# and it would not fit the database either: quantity is a 32-bit integer and
# MRP a Numeric(10, 2). Refused per row with a message, never a server error.
MAX_QUANTITY = 1_000_000
MAX_MRP = 1_000_000

# Our fields, in the order the matching screen lists them.
FIELDS = ("medicine_name", "quantity", "generic_name", "strength", "form", "batch_no", "expiry_date", "mrp")
REQUIRED = ("medicine_name", "quantity")
FIELD_LABELS = {
    "medicine_name": "Medicine name",
    "quantity": "Quantity",
    "generic_name": "Composition / generic name",
    "strength": "Strength",
    "form": "Form",
    "batch_no": "Batch no.",
    "expiry_date": "Expiry date",
    "mrp": "MRP",
}

# Header names seen in real pharmacy sheets, most specific first.
_SYNONYMS = {
    "medicine_name": ["medicine name", "medicine", "item name", "item", "product name", "product",
                      "drug name", "drug", "brand name", "brand", "item description", "description",
                      "particulars", "name"],
    "quantity": ["quantity", "qty", "closing stock", "closing qty", "cl stock", "cl qty", "stock qty",
                 "stock", "balance qty", "balance", "available qty", "available", "units"],
    "generic_name": ["generic name", "generic", "composition", "salt name", "salt", "molecule",
                     "contents", "content"],
    "strength": ["strength", "potency", "dose", "dosage"],
    "form": ["dosage form", "form", "type"],
    "batch_no": ["batch number", "batch no", "batch", "lot no", "lot"],
    "expiry_date": ["expiry date", "exp date", "expiry dt", "exp dt", "expiry", "exp"],
    "mrp": ["mrp", "unit price", "selling price", "price", "rate"],
}
# A header containing one of these is never guessed as a field by prefix:
# "Item Code" is not the medicine name and "Stock Value" is not the quantity.
_NOT_A_FIELD = ("code", "value", "amount", "amt", "hsn", "gst", "tax", "disc")

_FORMS = {
    "tab": "tablet", "tabs": "tablet", "tablet": "tablet", "tablets": "tablet",
    "cap": "capsule", "caps": "capsule", "capsule": "capsule", "capsules": "capsule",
    "syp": "syrup", "syrup": "syrup", "susp": "suspension", "suspension": "suspension",
    "inj": "injection", "injection": "injection", "oint": "ointment", "ointment": "ointment",
    "cream": "cream", "gel": "gel", "drop": "drops", "drops": "drops", "powder": "powder",
    "sachet": "sachet", "inhaler": "inhaler", "lotion": "lotion", "spray": "spray",
}
_UNITS = {"mg", "mcg", "g", "gm", "ml", "iu", "w", "v", "ww", "wv", "kg", "l", "unit", "units", "percent"}

_DAY_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%y", "%d/%m/%y", "%d.%m.%y",
                "%d-%b-%Y", "%d-%b-%y", "%d %b %Y", "%d %b %y", "%d %B %Y", "%Y/%m/%d")
# Month-only expiries ("12/2026") mean the END of that month.
_MONTH_FORMATS = ("%m/%Y", "%m-%Y", "%m.%Y", "%m/%y", "%m-%y", "%m.%y", "%b-%Y", "%b-%y", "%b %Y",
                  "%b %y", "%B %Y", "%B-%Y", "%b/%Y", "%b/%y", "%Y-%m")


class SheetError(ValueError):
    """The file itself can't be read — wrong type, corrupt, empty or too big."""


# ------------------------------------------------------------ normalising ---
def norm(text) -> str:
    """Lower-case words and numbers only: "Dolo-650mg Tab." -> "dolo 650 mg tab"."""
    s = str(text or "").lower()
    s = re.sub(r"(\d)([a-z])", r"\1 \2", s)
    s = re.sub(r"([a-z])(\d)", r"\1 \2", s)
    s = re.sub(r"(?<!\d)\.|\.(?!\d)", " ", s)   # keep decimal points only
    s = re.sub(r"[^a-z0-9.]+", " ", s)
    return " ".join(s.split())


def _numbers(text) -> list[str]:
    out = []
    for n in re.findall(r"\d+(?:\.\d+)?", str(text or "")):
        out.append(n.rstrip("0").rstrip(".") if "." in n else n)
    return out


def strength_key(strength: str, generic: str, name: str) -> str:
    """The numbers that make two medicines the same dose: "650 mg" -> "650".
    Taken from the strength column, else the generic, else the first number in
    the name ("Dolo 650")."""
    for source in (strength, generic):
        nums = _numbers(source)
        if nums:
            return "|".join(nums)[:60]
    nums = _numbers(name)
    return nums[0] if nums else ""


def generic_key(generic: str) -> str:
    """The molecule words only: "Paracetamol 650mg" -> "paracetamol"."""
    words = [w for w in norm(generic).split() if w not in _UNITS and not re.fullmatch(r"[\d.]+", w)]
    return " ".join(words)[:300]


def form_key(form: str, name: str) -> str:
    """tablet / syrup / … from the form column, else from the name ("Dolo 650 Tab")."""
    for source in (form, name):
        for word in norm(source).split():
            if word in _FORMS:
                return _FORMS[word]
    return ""


# ------------------------------------------------------------------- rows ---
@dataclass
class StockRow:
    row: int
    medicine_name: str
    quantity: int
    generic_name: str = ""
    strength: str = ""
    form: str = ""
    batch_no: str = ""
    expiry_date: Optional[date] = None
    mrp: Optional[float] = None

    @property
    def match_key(self) -> str:
        return f"{norm(self.medicine_name)}|{norm(self.strength)}|{norm(self.batch_no)}"[:400]

    @property
    def search_text(self) -> str:
        return norm(" ".join((self.medicine_name, self.generic_name, self.strength, self.form)))[:700]

    @property
    def generic_key(self) -> str:
        return generic_key(self.generic_name)

    @property
    def strength_key(self) -> str:
        return strength_key(self.strength, self.generic_name, self.medicine_name)


@dataclass
class SheetResult:
    sheet_name: str
    header_row: int
    columns: list[str]
    column_map: dict[str, Optional[str]]
    mapping_source: str
    missing_required: list[str]
    rows: list[StockRow] = field(default_factory=list)
    errors: list[dict] = field(default_factory=list)
    total_rows: int = 0
    merged_count: int = 0


def _text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _number(value) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = re.search(r"-?\d+(?:\.\d+)?", str(value).replace(",", ""))
    return float(m.group()) if m else None


def _expiry(value) -> tuple[Optional[date], bool]:
    """(date, readable). A blank cell is readable and means "no expiry given"."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None, True
    if isinstance(value, datetime):
        return value.date(), True
    if isinstance(value, date):
        return value, True
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        # An Excel date serial that arrived as a plain number (e.g. via CSV).
        if 20000 <= value <= 80000:
            return date(1899, 12, 30) + timedelta(days=int(value)), True
        return None, False
    text = str(value).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}[ T]\d", text):
        text = text[:10]
    for fmt in _DAY_FORMATS:
        try:
            return datetime.strptime(text, fmt).date(), True
        except ValueError:
            pass
    for fmt in _MONTH_FORMATS:
        try:
            d = datetime.strptime(text, fmt)
            return date(d.year, d.month, monthrange(d.year, d.month)[1]), True
        except ValueError:
            pass
    return None, False


# ----------------------------------------------------------------- reading ---
def _read_table(filename: str, content: bytes) -> tuple[list[list], str]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("xlsx", "xlsm"):
        from openpyxl import load_workbook

        try:
            wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        except Exception:
            raise SheetError("This Excel file could not be opened. Please check it is a valid .xlsx file.")
        try:
            ws = wb.active or wb.worksheets[0]
            # Some exporters write a wrong sheet size; without this a read-only
            # sheet can silently come back as just its first column.
            if hasattr(ws, "reset_dimensions"):
                ws.reset_dimensions()
            rows, blank_streak = [], 0
            for values in ws.iter_rows(min_row=1, values_only=True):
                if any(_text(v) for v in values):
                    blank_streak = 0
                else:
                    blank_streak += 1
                    if blank_streak > 1000:   # formatting that runs to row 1,048,576
                        break
                rows.append(list(values))
                if len(rows) > MAX_ROWS + 1000:
                    raise SheetError(f"This file has more than {MAX_ROWS:,} rows. Please split it into smaller files.")
            return rows, ws.title
        finally:
            wb.close()
    if ext == "csv":
        text = ""
        for encoding in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        try:
            dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel
        rows = list(csv.reader(io.StringIO(text), dialect))
        if len(rows) > MAX_ROWS + 1000:
            raise SheetError(f"This file has more than {MAX_ROWS:,} rows. Please split it into smaller files.")
        return rows, "CSV"
    if ext == "xls":
        raise SheetError("The old Excel format (.xls) isn't supported. In Excel choose File > Save As > "
                         "Excel Workbook (.xlsx) and upload that file.")
    raise SheetError("Please upload an Excel (.xlsx) or CSV (.csv) file.")


def _key(header) -> str:
    return re.sub(r"[^a-z0-9]", "", str(header or "").lower())


def _matches(key: str, synonym: str, exact: bool) -> bool:
    syn = _key(synonym)
    if not key:
        return False
    if exact:
        return key == syn
    return len(syn) >= 3 and key.startswith(syn) and not any(bad in key for bad in _NOT_A_FIELD)


def _looks_like_field(header) -> bool:
    key = _key(_text(header))
    return any(_matches(key, syn, exact) for syns in _SYNONYMS.values() for syn in syns for exact in (True, False))


def _find_header(rows: list[list]) -> int:
    """The row (in the first 15) that looks most like column headers — sheets
    often open with a title such as "Stock report as on 14-09-2026"."""
    best, best_score = None, 0
    for i, row in enumerate(rows[:15]):
        score = sum(1 for cell in row if _looks_like_field(cell))
        if score > best_score:
            best, best_score = i, score
    if best is not None and best_score >= 2:
        return best
    for i, row in enumerate(rows):
        if any(_text(c) for c in row):
            return i
    raise SheetError("This file is empty.")


def _columns(header: list) -> list[str]:
    last = max((i for i, c in enumerate(header) if _text(c)), default=-1)
    names, seen = [], {}
    for i, cell in enumerate(header[: last + 1]):
        name = _text(cell) or f"Column {i + 1}"
        if name in seen:
            seen[name] += 1
            name = f"{name} ({seen[name]})"
        else:
            seen[name] = 1
        names.append(name)
    return names


def guess_map(columns: list[str]) -> dict[str, Optional[str]]:
    """Match our fields to their columns: exact header names first, then
    headers that start with a known name ("Qty (Strips)")."""
    keys = [_key(c) for c in columns]
    mapping: dict[str, Optional[str]] = {f: None for f in FIELDS}
    taken: set[int] = set()
    for exact in (True, False):
        for f in FIELDS:
            if mapping[f]:
                continue
            for syn in _SYNONYMS[f]:
                idx = next((i for i, k in enumerate(keys) if i not in taken and _matches(k, syn, exact)), None)
                if idx is not None:
                    mapping[f] = columns[idx]
                    taken.add(idx)
                    break
    return mapping


def resolve_map(columns: list[str], requested: Optional[dict], saved: Optional[dict]):
    """Pharmacist's own choice > the hospital's remembered choice > our guess."""
    if requested:
        return {f: (requested.get(f) if requested.get(f) in columns else None) for f in FIELDS}, "manual"
    if saved and all(saved.get(f) in columns for f in REQUIRED):
        mapping = {f: (saved.get(f) if saved.get(f) in columns else None) for f in FIELDS}
        used = {v for v in mapping.values() if v}
        for f, col in guess_map(columns).items():
            if not mapping[f] and col and col not in used:
                mapping[f] = col
                used.add(col)
        return mapping, "saved"
    return guess_map(columns), "guessed"


def parse_sheet(filename: str, content: bytes, requested_map: Optional[dict] = None,
                saved_map: Optional[dict] = None) -> SheetResult:
    table, sheet_name = _read_table(filename or "", content)
    h = _find_header(table)
    columns = _columns(table[h])
    mapping, source = resolve_map(columns, requested_map, saved_map)
    result = SheetResult(
        sheet_name=sheet_name, header_row=h + 1, columns=columns, column_map=mapping,
        mapping_source=source, missing_required=[f for f in REQUIRED if not mapping.get(f)],
    )
    if result.missing_required:
        result.total_rows = sum(1 for r in table[h + 1:] if any(_text(c) for c in r))
        return result

    index = {f: columns.index(col) for f, col in mapping.items() if col}

    def cell(raw: list, f: str):
        i = index.get(f)
        return raw[i] if i is not None and i < len(raw) else None

    merged: dict[str, StockRow] = {}
    for row_no, raw in enumerate(table[h + 1:], start=h + 2):
        if not any(_text(c) for c in raw):
            continue
        name = _text(cell(raw, "medicine_name"))
        if norm(name) in ("total", "grand total", "sub total", "subtotal"):
            continue
        result.total_rows += 1
        if result.total_rows > MAX_ROWS:
            raise SheetError(f"This file has more than {MAX_ROWS:,} rows. Please split it into smaller files.")
        if not name:
            result.errors.append({"row": row_no, "message": "Medicine name is missing"})
            continue
        qty = _number(cell(raw, "quantity"))
        if qty is None:
            result.errors.append({"row": row_no, "message": f"{name}: quantity is missing or not a number"})
            continue
        if qty < 0:
            result.errors.append({"row": row_no, "message": f"{name}: quantity can't be negative"})
            continue
        if qty > MAX_QUANTITY:
            result.errors.append({"row": row_no, "message":
                                  f"{name}: quantity {qty:,.0f} looks too large. Check that the right column is chosen for Quantity"})
            continue
        expiry, readable = _expiry(cell(raw, "expiry_date"))
        if not readable:
            shown = _text(cell(raw, "expiry_date"))
            result.errors.append({"row": row_no, "message":
                                  f'{name}: expiry "{shown}" is not a date we can read (use e.g. 12/2026 or 31-12-2026)'})
            continue
        mrp = _number(cell(raw, "mrp"))
        if mrp is not None and mrp > MAX_MRP:
            result.errors.append({"row": row_no, "message":
                                  f"{name}: MRP {mrp:,.2f} looks too large. Check that the right column is chosen for MRP"})
            continue
        row = StockRow(
            row=row_no, medicine_name=name[:200], quantity=int(qty),
            generic_name=_text(cell(raw, "generic_name"))[:300],
            strength=_text(cell(raw, "strength"))[:60],
            form=_text(cell(raw, "form"))[:40],
            batch_no=_text(cell(raw, "batch_no"))[:60],
            expiry_date=expiry,
            mrp=round(mrp, 2) if mrp is not None and mrp >= 0 else None,
        )
        # The same medicine + batch listed twice: add the quantities together.
        prev = merged.get(row.match_key)
        if prev:
            prev.quantity += row.quantity
            if row.expiry_date and (not prev.expiry_date or row.expiry_date < prev.expiry_date):
                prev.expiry_date = row.expiry_date
            result.merged_count += 1
        else:
            merged[row.match_key] = row
    result.rows = list(merged.values())
    return result


# ---------------------------------------------------------------- template ---
TEMPLATE_HEADERS = ["Medicine Name", "Generic Name", "Strength", "Form", "Quantity", "MRP", "Batch No", "Expiry Date"]


def template_xlsx() -> bytes:
    """A sample sheet for pharmacists who don't keep one of their own."""
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill

    wb = Workbook()
    ws = wb.active
    ws.title = "Stock"
    ws.append(TEMPLATE_HEADERS)
    ws.append(["Dolo 650", "Paracetamol", "650 mg", "Tablet", 120, 30.5, "DL2401", "12/2027"])
    ws.append(["Calpol 650", "Paracetamol", "650 mg", "Tablet", 45, 28, "CP1189", "03/2028"])
    ws.append(["Azithral 500", "Azithromycin", "500 mg", "Tablet", 8, 119, "AZ0921", "08/2027"])
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="0F766E")
    for col, width in zip("ABCDEFGH", (24, 24, 12, 12, 10, 10, 12, 14)):
        ws.column_dimensions[col].width = width
    ws.freeze_panes = "A2"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
