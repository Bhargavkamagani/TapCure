"""Public provider discovery.

Read-only endpoints with deliberately reduced payloads. Existing authenticated
doctor/hospital routes remain unchanged and continue to enforce RBAC.
"""
from uuid import UUID
import re
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..services import health_news as news_service
from ..services import insurers as insurer_list
from ..services import scheduling as sch
from ..services.storage import media_url
from ..models.doctor import Doctor, DoctorAffiliation, DoctorSchedule
from ..models.hospital import Hospital

router = APIRouter(prefix="/public", tags=["public-discovery"])

SPECIALTY_ALIASES = {
    "general physician": ["physician", "general medicine", "internal medicine", "family medicine",
                          "general practitioner", "family doctor"],
    "cardiology": ["cardiolog", "cardiac", "heart"],
    "dermatology": ["dermatolog", "derma", "skin", "cosmetolog"],
    "orthopedics": ["orthop", "orthoped", "orthopaedic", "bone"],
    "pediatrics": ["pediatric", "paediatric", "neonatolog", "child", "children", "kids", "baby"],
    "gynecology": ["gynec", "gynaec", "obstetric", "obgyn", "women", "woman", "lady doctor", "pregnan"],
    "ent": ["ent", "otolaryng", "ear", "ears", "nose", "throat"],
    "ophthalmology": ["ophthalm", "optometr", "eye"],
    "dental": ["dental", "dentist", "dentistry", "orthodont", "tooth", "teeth"],
    "physiotherapy": ["physio", "physiotherap", "physical therapy", "rehab"],
    "psychiatry": ["psychiat", "psycholog", "mental", "counsel"],
    "nutrition": ["nutrition", "diet", "dietic", "dietit", "dietet"],
    "neurology": ["neurolog", "nerve", "brain"],
    "neurosurgery": ["neurosurg"],
    "urology": ["urolog", "kidney", "urine", "bladder"],
    "general surgery": ["surgeon", "general surg"],
}


def _specialty_from_term(term: str) -> str:
    """The speciality a typed search NAMES, or "".

    The typed box only matched letters, so "dentist" found nobody while
    "dental" found every dentist ("dentist" is not inside "Dental"), and the
    same for "cardiologist", "skin doctor", "heart doctor". The alias table
    above was only ever used by the speciality dropdown. Same matching rule as
    `_specialty_matches`: one-word aliases are word prefixes (so "ent" never
    fires on "dentist"), multi-word aliases are phrases.
    """
    text = term.lower()
    words = [w for w in re.split(r"[^a-z0-9]+", text) if w]
    if not words:
        return ""
    def hits(word: str, alias: str) -> bool:
        # A short everyday word ("heart", "ear", "ent") must be the whole word
        # or its plural; only longer stems ("cardiolog", "dentist") are
        # prefixes. Otherwise "heartburn" became Cardiology, "entrance" ENT.
        if len(alias) <= 5:
            return word in (alias, alias + "s", alias + "es")
        return word.startswith(alias)

    for name, aliases in SPECIALTY_ALIASES.items():
        for alias in [name, *aliases]:
            if (" " in alias and alias in text) or (" " not in alias and any(hits(w, alias) for w in words)):
                return name
    return ""


def _text(value) -> str:
    return str(value or "").strip()


def _contains(value, term: str) -> bool:
    return term in _text(value).lower()


def _specialty_matches(value, requested: str) -> bool:
    stored = _text(value).lower()
    if not stored or not requested:
        return not requested
    # Whole words only. This used `requested in stored`, so "ent" matched
    # "dENTal" and the ENT filter listed every dentist. A multi-word request
    # ("general physician") may still sit inside a longer title.
    if stored == requested or (" " in requested and requested in stored):
        return True
    tokens = [token for token in re.split(r"[^a-z0-9]+", stored) if token]
    return any(
        alias in stored if " " in alias else any(token.startswith(alias) for token in tokens)
        for alias in SPECIALTY_ALIASES.get(requested, [requested])
    )


def _schedule_out(row: DoctorSchedule) -> dict:
    return {
        "schedule_id": row.schedule_id,
        "day_of_week": row.day_of_week,
        "start_time": row.start_time,
        "end_time": row.end_time,
    }


def _affiliation_out(row: DoctorAffiliation, schedules: list[DoctorSchedule]) -> dict:
    return {
        "affiliation_id": row.affiliation_id,
        "hospital_id": row.hospital_id,
        "practice_type": row.practice_type,
        "name": row.name,
        "address": row.address,
        "city": row.city,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "consultation_fee": row.consultation_fee,
        "mode": row.mode,
        "schedules": [
            _schedule_out(schedule)
            for schedule in schedules
            if schedule.is_active and schedule.affiliation_id == row.affiliation_id
        ],
    }


def _doctor_out(row: Doctor, hospitals: dict[int, Hospital], include_schedules: bool = False) -> dict:
    hospital = hospitals.get(row.hospital_id)
    schedules = list(row.schedules) if include_schedules else []
    affiliations = [
        _affiliation_out(affiliation, schedules)
        for affiliation in row.affiliations
        if affiliation.is_active
        and (
            affiliation.hospital_id is None
            or (
                affiliation.hospital_id in hospitals
                and hospitals[affiliation.hospital_id].status == "active"
                and hospitals[affiliation.hospital_id].is_active
            )
        )
    ]
    return {
        "doctor_id": row.doctor_id,
        "hospital_id": row.hospital_id,
        "name": row.name,
        "specialization": row.specialization,
        "qualification": row.qualification,
        "experience_years": row.experience_years,
        "consultation_fee": row.consultation_fee,
        "bio": row.bio,
        # Stored as "s3://bucket/key" on servers using S3: a browser can't open
        # that, so the landing page showed no photos while the logged-in
        # screens (which go through DoctorOut's public_url) did.
        "profile_photo_url": media_url(row.profile_photo_url, "doctors"),
        "languages": row.languages,
        "status": row.status,
        "is_available_today": row.is_available_today,
        # No weekly session anywhere = nothing to book (shown as "Not available").
        "has_timings": row.has_timings,
        "hospital_name": hospital.name if hospital else "",
        "city": hospital.city if hospital else "",
        "affiliations": affiliations,
    }


def _hospital_out(row: Hospital, doctor_count: int = 0) -> dict:
    return {
        "hospital_id": row.hospital_id,
        "name": row.name,
        "address": row.address,
        "city": row.city,
        "state": row.state,
        "pincode": row.pincode,
        "phone": row.phone,
        "logo_url": media_url(row.logo_url, "hospitals"),
        "photo_url": media_url(row.photo_url, "hospitals"),
        "latitude": row.latitude,
        "longitude": row.longitude,
        "doctor_count": doctor_count,
        # Codes; names/badges come from GET /public/insurers.
        "insurance_partners": insurer_list.known(row.insurance_partners),
    }


def _active_hospitals(db: Session) -> list[Hospital]:
    return list(db.scalars(
        select(Hospital)
        .where(Hospital.status == "active", Hospital.is_active.is_(True))
        .order_by(Hospital.name)
    ).all())


def _active_doctors(db: Session) -> list[Doctor]:
    return list(db.scalars(
        select(Doctor)
        .options(selectinload(Doctor.affiliations), selectinload(Doctor.schedules))
        .where(Doctor.status == "active", Doctor.verification_status == "verified")
        .order_by(Doctor.name)
    ).unique().all())


@router.get("/discovery")
def discover(
    q: str = Query("", max_length=120),
    city: str = Query("", max_length=100),
    specialty: str = Query("", max_length=100),
    symptom: bool = Query(False),
    type: str = Query("all", pattern="^(all|doctors|hospitals|clinics)$"),  # clinics = old name
    # One insurer code (GET /public/insurers): only hospitals that accept it,
    # and only doctors at those hospitals. Unknown code -> nothing matches.
    insurance: str = Query("", max_length=60),
    db: Session = Depends(get_db),
):
    if type == "clinics":
        type = "hospitals"
    all_hospitals = _active_hospitals(db)
    all_by_id = {row.hospital_id: row for row in all_hospitals}
    all_doctors = [row for row in _active_doctors(db) if row.hospital_id in all_by_id]
    insurance_code = insurance.strip().lower()
    hospitals = ([row for row in all_hospitals if insurance_code in (row.insurance_partners or [])]
                 if insurance_code else all_hospitals)
    hospital_by_id = {row.hospital_id: row for row in hospitals}
    doctors = [row for row in all_doctors if row.hospital_id in hospital_by_id]
    term = _text(q).lower()
    city_term = _text(city).lower()
    specialty_term = _text(specialty).lower()
    # "dentist" / "cardiologist" / "skin doctor" typed in the box -> that speciality.
    named_specialty = _specialty_from_term(term) if term and not symptom else ""

    def doctor_matches(row: Doctor) -> bool:
        hospital = hospital_by_id.get(row.hospital_id)
        affiliations = [item for item in row.affiliations if item.is_active]
        searchable = [
            row.name, row.specialization, row.qualification, row.languages,
            hospital.name if hospital else "",
            *(item.name for item in affiliations),
        ]
        cities = [hospital.city if hospital else "", *(item.city for item in affiliations)]
        return (
            # A search that names a speciality returns that speciality only:
            # matching letters too let "urologist" pull in a neurologist.
            (not term or symptom
             or (_specialty_matches(row.specialization, named_specialty) if named_specialty
                 else any(_contains(value, term) for value in searchable)))
            and (not city_term or any(_contains(value, city_term) for value in cities))
            and _specialty_matches(row.specialization, specialty_term)
        )

    matched_doctors = [row for row in doctors if doctor_matches(row)]
    doctor_counts: dict[int, int] = {}
    for row in doctors:
        doctor_counts[row.hospital_id] = doctor_counts.get(row.hospital_id, 0) + 1

    def hospital_matches(row: Hospital) -> bool:
        searchable = [row.name, row.address, row.city, row.state]
        return (
            (not term or any(_contains(value, term) for value in searchable))
            and (not city_term or _contains(row.city, city_term))
        )

    matched_hospitals = [row for row in hospitals if hospital_matches(row)]
    return {
        "doctors": [] if type == "hospitals" else [_doctor_out(row, hospital_by_id) for row in matched_doctors],
        "hospitals": [] if type == "doctors" else [_hospital_out(row, doctor_counts.get(row.hospital_id, 0)) for row in matched_hospitals],
        # Dropdown choices stay complete even while the insurance filter is on.
        "cities": sorted({_text(row.city) for row in all_hospitals if _text(row.city)}),
        "specialties": sorted({_text(row.specialization) for row in all_doctors if _text(row.specialization)}),
    }


def _clean_city(value: str) -> str:
    """Normalise a free-text city into something safe to show publicly.

    These values are typed by hospitals and doctors, so the same place arrives as
    "hyderabad", " Hyderabad " and "KPHB , Hyderabad". Without this the landing
    dropdown would list the same city three times. A comma means the city is the
    last part ("KPHB, Hyderabad" -> "Hyderabad").
    """
    text = (value or "").strip()
    if not text:
        return ""
    if "," in text:
        text = text.rsplit(",", 1)[-1].strip()
    text = " ".join(text.split())
    return text.title() if text.islower() or text.isupper() else text


@router.get("/cities")
def public_cities(db: Session = Depends(get_db)):
    """Cities TapCure actually serves — for the landing page's city picker.

    Deliberately its own endpoint: the landing used /discovery, which loads every
    active hospital AND every doctor with their affiliations and schedules just to
    derive this list. Two cheap DISTINCT queries instead.

    Sources both live hospitals and doctors' own practice locations, so a solo
    doctor in a town with no registered hospital still puts that town on the map.
    """
    hospital_cities = db.scalars(
        select(Hospital.city).where(
            Hospital.status == "active", Hospital.is_active.is_(True), Hospital.city != ""
        ).distinct()
    ).all()
    practice_cities = db.scalars(
        select(DoctorAffiliation.city)
        .join(Doctor, Doctor.doctor_id == DoctorAffiliation.doctor_id)
        .where(
            DoctorAffiliation.is_active.is_(True),
            DoctorAffiliation.city != "",
            Doctor.status == "active",
            Doctor.verification_status == "verified",
        ).distinct()
    ).all()

    names = {_clean_city(c) for c in [*hospital_cities, *practice_cities]}
    return {"cities": sorted(n for n in names if n)}


@router.get("/insurers")
def public_insurers(state: str = Query("", max_length=100)):
    """Every insurer and government scheme, in 4 groups — the only list the app
    uses. `state` (a hospital's state) puts that state's schemes first."""
    return {"groups": insurer_list.grouped(state)}


@router.get("/insurers/hospital-counts")
def public_insurer_hospital_counts(db: Session = Depends(get_db)):
    """How many live hospitals accept each insurer/scheme, for the public
    Insurance page (2026-11-03). Only codes with at least one hospital appear;
    the page shows the rest as "No hospitals yet"."""
    counts: dict[str, int] = {}
    for row in _active_hospitals(db):
        for code in set(insurer_list.known(row.insurance_partners)):
            counts[code] = counts.get(code, 0) + 1
    return {"counts": counts}


@router.get("/health-news")
def health_news(limit: int = Query(6, ge=1, le=20)):
    """Public-health headlines for the Health Articles page.

    Proxied and cached server-side: the feeds are cross-origin, and one cache
    here beats every visitor hitting the source. Returns an empty list — never
    an error — when no feed is configured or a source is unreachable, so the
    page hides the strip instead of breaking.
    """
    return {"items": news_service.latest(limit)}


@router.get("/doctors/{doctor_id}")
def public_doctor(doctor_id: UUID, db: Session = Depends(get_db)):
    row = db.scalar(
        select(Doctor)
        .options(selectinload(Doctor.affiliations), selectinload(Doctor.schedules))
        .where(
            Doctor.doctor_id == doctor_id,
            Doctor.status == "active",
            Doctor.verification_status == "verified",
        )
    )
    if not row:
        raise HTTPException(404, "Doctor profile not found")
    hospitals = {item.hospital_id: item for item in _active_hospitals(db)}
    if row.hospital_id not in hospitals:
        raise HTTPException(404, "Doctor profile not found")
    # Days in the next two weeks the doctor is away (approved leave or a
    # full-day holiday), so the profile's "Available today / Next available"
    # badge skips them instead of promising a day the booking form refuses.
    # Dates only — never the reason.
    today = sch.ist_now().date()
    days_off = [
        (today + timedelta(days=i)).isoformat()
        for i in range(14)
        if sch.is_on_holiday(row, today + timedelta(days=i)) or sch.is_on_leave(db, row, today + timedelta(days=i))
    ]
    return {**_doctor_out(row, hospitals, include_schedules=True), "days_off": days_off}


@router.get("/hospitals/{hospital_id}")
@router.get("/clinics/{hospital_id}", include_in_schema=False)  # old address
def public_hospital(hospital_id: UUID, db: Session = Depends(get_db)):
    hospital = db.scalar(
        select(Hospital).where(
            Hospital.hospital_id == hospital_id,
            Hospital.status == "active",
            Hospital.is_active.is_(True),
        )
    )
    if not hospital:
        raise HTTPException(404, "Hospital profile not found")
    doctors = list(db.scalars(
        select(Doctor)
        .options(selectinload(Doctor.affiliations), selectinload(Doctor.schedules))
        .where(
            Doctor.hospital_id == hospital_id,
            Doctor.status == "active",
            Doctor.verification_status == "verified",
        )
        .order_by(Doctor.name)
    ).unique().all())
    public_doctors = []
    for doctor in doctors:
        affiliation = next(
            (item for item in doctor.affiliations if item.is_active and item.hospital_id == hospital_id),
            None,
        )
        public_doctors.append({
            "doctor_id": doctor.doctor_id,
            "name": doctor.name,
            "specialization": doctor.specialization,
            "qualification": doctor.qualification,
            "experience_years": doctor.experience_years,
            "consultation_fee": affiliation.consultation_fee if affiliation else doctor.consultation_fee,
            "profile_photo_url": media_url(doctor.profile_photo_url, "doctors"),
            "affiliation_id": affiliation.affiliation_id if affiliation else None,
            # Timings at THIS hospital. A doctor with no practice here (a solo
            # doctor only anchored to it) books at their own hospital, so for
            # them it is whether they have timings anywhere.
            "has_timings": (
                any(s.is_active and s.affiliation_id == affiliation.affiliation_id for s in doctor.schedules)
                if affiliation else doctor.has_timings
            ),
        })
    return {**_hospital_out(hospital, len(public_doctors)), "doctors": public_doctors}
