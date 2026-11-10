"""
The prescription as a downloadable PDF, on the hospital's letterhead.

Built fresh on every download from the rows in `prescriptions` /
`prescription_items` — nothing is stored, so a medicine added to the visit's
prescription afterwards is always on the next download.

Letterhead, in order of preference:
  1. the practice's own uploaded header / footer images
     (hospitals.letterhead_header_url / letterhead_footer_url);
  2. otherwise one built from its logo, name, address and phone.
A doctor's own personal practice (an affiliation the hospital does not manage)
uses that practice's name and address, never the hospital's letterhead.

The doctor's signature (doctors.signature_url) is printed when on file.
Text in the DB is English-only (see services/english_text), so the built-in
Helvetica covers it.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import date, datetime, timezone
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from sqlalchemy.orm import Session

from ..models import Appointment, Doctor, DoctorAffiliation, FamilyMember, Hospital, Patient, Prescription
from . import storage

IST = ZoneInfo("Asia/Kolkata")
PAGE_W, PAGE_H = A4
SIDE = 15 * mm
HEADER_MAX_H = 40 * mm
FOOTER_MAX_H = 22 * mm
BRAND = colors.HexColor("#0f766e")
MUTED = colors.HexColor("#6b7280")
RULE = colors.HexColor("#d1d5db")

_base = ParagraphStyle("base", fontName="Helvetica", fontSize=9.5, leading=13)
S = {
    "body": _base,
    "small": ParagraphStyle("small", parent=_base, fontSize=8, leading=10.5, textColor=MUTED),
    "label": ParagraphStyle("label", parent=_base, fontName="Helvetica-Bold", fontSize=9, textColor=BRAND),
    "hname": ParagraphStyle("hname", parent=_base, fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=BRAND),
    "dname": ParagraphStyle("dname", parent=_base, fontName="Helvetica-Bold", fontSize=11, leading=14, alignment=TA_RIGHT),
    "dright": ParagraphStyle("dright", parent=_base, fontSize=8.5, leading=11, alignment=TA_RIGHT),
    "rx": ParagraphStyle("rx", parent=_base, fontName="Helvetica-Bold", fontSize=18, leading=20, textColor=BRAND),
    "cell": ParagraphStyle("cell", parent=_base, fontSize=9, leading=11.5),
    "cellh": ParagraphStyle("cellh", parent=_base, fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=colors.white),
}


def _p(text, style="body") -> Paragraph:
    """A paragraph of user text — escaped, so a "<" in a note can't break the PDF."""
    return Paragraph(escape(str(text or "")).replace("\n", "<br/>"), S[style])


def short_ref(uid) -> str:
    """Same short reference the screens show (frontend lib/shortId.js)."""
    s = str(uid or "").replace("-", "")
    return (s[-8:] if len(s) > 8 else s).upper()


def _image(data: bytes | None) -> ImageReader | None:
    if not data:
        return None
    try:
        img = ImageReader(io.BytesIO(data))
        img.getSize()
        return img
    except Exception:  # noqa: BLE001 — a broken image is left out, not fatal
        return None


def _fit(img: ImageReader, max_w: float, max_h: float) -> tuple[float, float]:
    w, h = img.getSize()
    k = min(max_w / w, max_h / h)
    return w * k, h * k


def _age(dob: date | None, stored: int | None, on: date) -> int | None:
    if dob:
        return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))
    return stored


@dataclass
class Practice:
    """Whose letterhead this is: a hospital, or a doctor's own practice."""
    name: str
    address_lines: list[str]
    contact: str
    registration: str
    logo: ImageReader | None
    header: ImageReader | None
    footer: ImageReader | None


def practice_details(db: Session, rx: Prescription, doctor: Doctor | None) -> dict:
    """Whose letterhead a prescription goes on, as plain values plus stored image
    references. The ONE place this is decided: the PDF and the on-screen paper
    view both read it, so they can never show different letterheads."""
    hospital = db.get(Hospital, rx.hospital_id)
    appt = db.get(Appointment, rx.appointment_id) if rx.appointment_id else None
    aff = db.get(DoctorAffiliation, appt.affiliation_id) if appt and appt.affiliation_id else None

    def addr(*parts):
        return ", ".join(p.strip() for p in parts if p and str(p).strip())

    # A hospital doctor's own clinic: that clinic's details, not the hospital's
    # letterhead. A solo (self-registered) doctor's hospital row IS their own
    # practice, so its uploaded letterhead is theirs to use.
    if aff and not aff.managed_by_hospital and not (doctor and doctor.is_self_registered):
        return {
            "name": aff.name or (doctor.name if doctor else ""),
            "address_lines": [x for x in (aff.address, aff.city) if x],
            "contact": "", "registration": "",
            "logo_ref": None, "header_ref": None, "footer_ref": None,
        }
    h = hospital
    contact = "  |  ".join(x for x in (
        f"Phone: {h.phone}" if h and h.phone else "",
        h.email if h and h.email else "",
    ) if x)
    return {
        "name": (aff.name if aff and aff.name and not aff.managed_by_hospital else None) or (h.name if h else ""),
        "address_lines": [x for x in (h.address if h else "", addr(h.city, h.state, h.pincode) if h else "") if x],
        "contact": contact,
        "registration": f"Reg. No: {h.registration_number}" if h and h.registration_number else "",
        "logo_ref": h.logo_url if h else None,
        "header_ref": h.letterhead_header_url if h else None,
        "footer_ref": h.letterhead_footer_url if h else None,
    }


def _practice(db: Session, rx: Prescription, doctor: Doctor | None) -> Practice:
    d = practice_details(db, rx, doctor)
    return Practice(
        name=d["name"], address_lines=d["address_lines"], contact=d["contact"], registration=d["registration"],
        logo=_image(storage.media_bytes(d["logo_ref"], "hospitals")),
        header=_image(storage.media_bytes(d["header_ref"], "letterheads")),
        footer=_image(storage.media_bytes(d["footer_ref"], "letterheads")),
    )


def _written_ist(rx: Prescription) -> datetime:
    written = rx.created_at or datetime.now(timezone.utc)
    if written.tzinfo is None:  # stored naive-UTC on some rows
        written = written.replace(tzinfo=timezone.utc)
    return written.astimezone(IST)


def paper(db: Session, rx: Prescription) -> dict:
    """Everything the on-screen "paper" view draws AROUND the medicines — the
    same letterhead, patient line and signature as the PDF. Images are links the
    browser can open (signed / presigned, short-lived), never raw stored refs.
    The caller has already checked access."""
    doctor = db.get(Doctor, rx.doctor_id)
    patient = db.get(Patient, rx.patient_id)
    member = db.get(FamilyMember, rx.family_member_id) if rx.family_member_id else None
    d = practice_details(db, rx, doctor)
    written = _written_ist(rx)
    who = member or patient
    age = _age(getattr(who, "dob", None), None if member else getattr(patient, "age", None), written.date())
    return {
        "practice": {
            "name": d["name"], "address_lines": d["address_lines"],
            "contact": d["contact"], "registration": d["registration"],
            "logo_url": storage.media_url(d["logo_ref"], "hospitals"),
            "header_url": storage.media_url(d["header_ref"], "letterheads"),
            "footer_url": storage.media_url(d["footer_ref"], "letterheads"),
        },
        "doctor": None if not doctor else {
            "name": _dr(doctor.name), "qualification": doctor.qualification or "",
            "specialization": doctor.specialization or "",
            "registration_number": doctor.registration_number or "",
            "signature_url": storage.media_url(doctor.signature_url, "signatures"),
        },
        "patient": {
            "name": (member.name if member else (patient.name if patient else "")) or "",
            "age": age,
            "gender": (getattr(who, "gender", None) or "").strip().title(),
            "uhid": patient.uhid if patient and patient.uhid else None,
            "account_holder": patient.name if member and patient else None,
        },
        "written_at": written.isoformat(),
        "ref": short_ref(rx.prescription_id),
    }


def build(db: Session, rx: Prescription) -> bytes:
    """The PDF bytes for one prescription. The caller has already checked access."""
    doctor = db.get(Doctor, rx.doctor_id)
    patient = db.get(Patient, rx.patient_id)
    member = db.get(FamilyMember, rx.family_member_id) if rx.family_member_id else None
    practice = _practice(db, rx, doctor)
    signature_bytes = storage.media_bytes(doctor.signature_url, "signatures") if doctor else None
    signature = _image(signature_bytes)

    written = _written_ist(rx)

    # ---- header height decides the top margin, so the body never runs under it
    if practice.header:
        header_h = _fit(practice.header, PAGE_W - 2 * SIDE, HEADER_MAX_H)[1]
    else:
        header_h = 30 * mm
    footer_h = _fit(practice.footer, PAGE_W - 2 * SIDE, FOOTER_MAX_H)[1] if practice.footer else 8 * mm

    def draw_page(canvas, doc):
        canvas.saveState()
        top = PAGE_H - 10 * mm
        if practice.header:
            w, h = _fit(practice.header, PAGE_W - 2 * SIDE, HEADER_MAX_H)
            canvas.drawImage(practice.header, (PAGE_W - w) / 2, top - h, w, h, mask="auto")
        else:
            _draw_built_header(canvas, practice, doctor, top, header_h)
        canvas.setStrokeColor(BRAND)
        canvas.setLineWidth(1.2)
        canvas.line(SIDE, top - header_h - 2 * mm, PAGE_W - SIDE, top - header_h - 2 * mm)
        # footer
        if practice.footer:
            w, h = _fit(practice.footer, PAGE_W - 2 * SIDE, FOOTER_MAX_H)
            canvas.drawImage(practice.footer, (PAGE_W - w) / 2, 8 * mm, w, h, mask="auto")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(SIDE, 4.5 * mm, f"Rx #{short_ref(rx.prescription_id)}  ·  Generated by TapCure")
        canvas.drawRightString(PAGE_W - SIDE, 4.5 * mm, f"Page {doc.page}")
        canvas.restoreState()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=SIDE, rightMargin=SIDE,
        topMargin=10 * mm + header_h + 6 * mm, bottomMargin=8 * mm + footer_h + 6 * mm,
        title=f"Prescription {short_ref(rx.prescription_id)}",
        author=(doctor.name if doctor else ""), creator="TapCure",
    )
    usable = PAGE_W - 2 * SIDE
    story = []

    # A custom letterhead is the hospital's; the doctor still has to be named.
    if practice.header and doctor:
        story += [_doctor_block(doctor, align_right=False), Spacer(1, 3 * mm)]

    # ---- patient
    who = member or patient
    name = (member.name if member else patient.name if patient else "") or ""
    age = _age(getattr(who, "dob", None), None if member else getattr(patient, "age", None), written.date())
    gender = (getattr(who, "gender", None) or "").strip().title()
    age_sex = " / ".join(x for x in ((f"{age} yrs" if age is not None else ""), gender) if x)
    rows = [
        [Paragraph(f"<b>Patient:</b> {escape(name)}", S["body"]),
         Paragraph(f"<b>Date:</b> {written.strftime('%d %b %Y, %I:%M %p')}", S["body"])],
        [Paragraph(f"<b>Age / Sex:</b> {escape(age_sex or '-')}", S["body"]),
         Paragraph(f"<b>Patient ID:</b> {escape(patient.uhid if patient and patient.uhid else '-')}", S["body"])],
    ]
    if member and patient:
        rows.append([Paragraph(f"<b>Account holder:</b> {escape(patient.name or '')}", S["body"]), _p("")])
    t = Table(rows, colWidths=[usable * 0.55, usable * 0.45])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#99f6e4")),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [t, Spacer(1, 4 * mm)]

    if (rx.diagnosis or "").strip():
        story += [_p("Diagnosis", "label"), _p(rx.diagnosis), Spacer(1, 3 * mm)]

    # ---- medicines
    story += [_p("Rx", "rx"), Spacer(1, 2 * mm)]
    items = list(rx.items or [])
    if items:
        head = [Paragraph(h, S["cellh"]) for h in ("#", "Medicine", "Dosage", "Frequency", "Duration", "Instructions")]
        body = [[_p(str(i), "cell"), Paragraph(f"<b>{escape(it.drug_name or '')}</b>", S["cell"]),
                 _p(it.dosage, "cell"), _p(it.frequency, "cell"), _p(it.duration, "cell"), _p(it.instructions, "cell")]
                for i, it in enumerate(items, 1)]
        widths = [0.05, 0.27, 0.13, 0.17, 0.13, 0.25]
        mt = Table([head] + body, colWidths=[usable * w for w in widths], repeatRows=1)
        mt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
            ("LINEBELOW", (0, 1), (-1, -1), 0.4, RULE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(mt)
    else:
        story.append(_p("No medicines prescribed.", "small"))
    story.append(Spacer(1, 4 * mm))

    if (rx.advice or "").strip():
        story += [_p("Advice", "label"), _p(rx.advice), Spacer(1, 3 * mm)]
    if rx.follow_up_date:
        story += [Paragraph(f"<b>Follow-up on:</b> {rx.follow_up_date.strftime('%d %b %Y')}", S["body"]),
                  Spacer(1, 3 * mm)]

    # ---- signature, kept on one page with the name under it
    if doctor:
        sig = []
        if signature:
            w, h = _fit(signature, 45 * mm, 18 * mm)
            sig.append(Image(io.BytesIO(signature_bytes), width=w, height=h, hAlign="RIGHT"))
        else:
            sig.append(Spacer(1, 14 * mm))
        sig += [_p(_dr(doctor.name), "dname")]
        if doctor.qualification:
            sig.append(_p(doctor.qualification, "dright"))
        if doctor.registration_number:
            sig.append(_p(f"Reg. No: {doctor.registration_number}", "dright"))
        story += [Spacer(1, 8 * mm), KeepTogether(sig)]

    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    return buf.getvalue()


def _dr(name: str | None) -> str:
    n = (name or "").strip()
    return n if not n or n.lower().startswith("dr") else f"Dr. {n}"


def _doctor_block(doctor: Doctor, align_right: bool = True) -> Table:
    style = "dright" if align_right else "body"
    lines = [Paragraph(f"<b>{escape(_dr(doctor.name))}</b>", S["dname"] if align_right else S["body"])]
    for x in (doctor.qualification, doctor.specialization,
              f"Reg. No: {doctor.registration_number}" if doctor.registration_number else ""):
        if x:
            lines.append(_p(x, style))
    t = Table([[lines]], colWidths=[PAGE_W - 2 * SIDE])
    t.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0)]))
    return t


def _draw_built_header(canvas, practice: Practice, doctor: Doctor | None, top: float, height: float) -> None:
    """Logo + practice on the left, the doctor on the right."""
    x = SIDE
    if practice.logo:
        w, h = _fit(practice.logo, 24 * mm, 24 * mm)
        canvas.drawImage(practice.logo, x, top - h, w, h, mask="auto")
        x += w + 4 * mm
    left_w = (PAGE_W - SIDE) - x - 70 * mm
    left = [Paragraph(escape(practice.name or ""), S["hname"])]
    for line in practice.address_lines + [practice.contact, practice.registration]:
        if line:
            left.append(_p(line, "small"))
    _flow(canvas, left, x, top, left_w, height)
    if doctor:
        right = [Paragraph(escape(_dr(doctor.name)), S["dname"])]
        for line in (doctor.qualification, doctor.specialization,
                     f"Reg. No: {doctor.registration_number}" if doctor.registration_number else ""):
            if line:
                right.append(_p(line, "dright"))
        _flow(canvas, right, PAGE_W - SIDE - 68 * mm, top, 68 * mm, height)


def _flow(canvas, paras, x, top, width, height) -> None:
    y = top
    for para in paras:
        _, h = para.wrap(width, height)
        y -= h
        if y < top - height:
            break
        para.drawOn(canvas, x, y)
