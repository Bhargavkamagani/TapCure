"""
Module 5 — Patient endpoints (20 APIs).

Patient master + family members + medical history + allergies + documents.
Staff (reception/admin) manage patients within their tenant; a PATIENT-role user
is confined to their own linked record. Uploads use the configured shared
storage backend (local in development, private S3 in QA/production).
"""
from uuid import UUID
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status,
)
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import ensure_same_tenant, get_current_user, require_permission, require_staff
from ..models import (
    Allergy, Appointment, Doctor, DoctorAffiliation, FamilyMember, FollowUp, Hospital,
    MedicalHistory, MedicineCourse, Patient, PatientDocument, PatientVital,
    Prescription, RevisitPass, Role, User,
)
from ..rbac import (
    ROLE_DOCTOR, ROLE_PATIENT, ROLE_RECEPTIONIST, ROLE_SUPER_ADMIN,
    is_hospital_staff,
)
from ..schemas.appointment import AppointmentOut
from ..schemas.patient import (
    AllergyCreate, AllergyOut, DocumentOut, FamilyMemberCreate, FamilyMemberOut,
    FamilyMemberUpdate, MedicalHistoryCreate, MedicalHistoryOut,
    MedicalHistoryUpdate, PatientCreate, PatientDetail, PatientOut, PatientUpdate,
    VitalsCreate, VitalsOut,
)
from ..services import (
    accounts, audit, family_link, storage, uhid as uhid_service,
    vitals as vitals_service,
)
from ..services.english_text import to_english
from ..services.reception_scope import assigned_doctor_ids

router = APIRouter(tags=["patients"])

def _patient(db: Session, patient_id: UUID) -> Patient:
    p = db.get(Patient, patient_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    return p


def _assert_access(db: Session, me: User, patient: Patient) -> None:
    """PATIENT users are confined to their own record. Staff may access a patient
    anchored to their hospital OR any global patient who has booked an appointment
    there (so a hospital can open the history of someone who visited them)."""
    role = me.role.name if me.role else None
    if role == "PATIENT":
        if patient.user_id != me.user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your patient record")
        return
    if role == "DOCTOR":
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
        has_seen_patient = doctor and db.scalar(
            select(Appointment.appointment_id).where(
                Appointment.patient_id == patient.patient_id,
                Appointment.doctor_id == doctor.doctor_id,
            ).limit(1)
        )
        if not has_seen_patient:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This patient has not visited you")
        return
    if role == "SUPER_ADMIN" or patient.hospital_id == me.hospital_id:
        return
    booked_here = db.scalar(
        select(Appointment.appointment_id).where(
            Appointment.patient_id == patient.patient_id,
            Appointment.hospital_id == me.hospital_id,
        )
    )
    if not booked_here:
        ensure_same_tenant(me, patient.hospital_id)  # raises 403 for other tenants


def _scope_visits(db: Session, stmt, me: User):
    """Narrow a patient's visit history to the visits the caller is party to.

    `_assert_access` is a DOOR — may you open this record at all — and it answers
    yes to a doctor who has seen the patient even once. That is the right rule
    for the door and the wrong rule for the contents: unscoped, one consultation
    bought a doctor the patient's entire history everywhere, including which
    OTHER doctors they saw, at which hospitals, in which specialties, and the
    free-text complaint on each visit. A specialty alone can disclose a
    psychiatric, obstetric or oncology visit the patient never chose to share.

      - PATIENT / SUPER_ADMIN  — everything (their own record; platform owner)
      - DOCTOR                 — visits with THAT doctor, at any practice of
                                 theirs. Their own clinical record, no one
                                 else's.
      - hospital staff           — visits at THEIR hospital, minus any doctor's
                                 personal practice.

    The personal-practice exclusion is not optional tidiness. A self-registered
    doctor's appointments carry `hospital_id = doctor.hospital_id`, which is the
    default anchor tenant (`auth._default_hospital_id` = lowest active hospital),
    NOT a hospital they work for. Filtering on hospital_id alone would therefore
    hand that hospital's front desk every solo doctor's private consultations.
    """
    role = me.role.name if me.role else None
    if role in (ROLE_PATIENT, ROLE_SUPER_ADMIN):
        return stmt
    if role == ROLE_DOCTOR:
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
        if not doctor:
            # A DOCTOR login with no doctor row sees nothing, rather than
            # falling through to the hospital branch and inheriting a tenant.
            return stmt.where(Appointment.appointment_id.is_(None))
        return stmt.where(Appointment.doctor_id == doctor.doctor_id)
    stmt = stmt.where(Appointment.hospital_id == me.hospital_id)
    if is_hospital_staff(role):
        # Same rule as routers/appointments._hide_personal. Appointments with no
        # affiliation are legacy hospital bookings, so they stay.
        stmt = stmt.outerjoin(
            DoctorAffiliation, Appointment.affiliation_id == DoctorAffiliation.affiliation_id
        ).where(
            or_(
                Appointment.affiliation_id.is_(None),
                DoctorAffiliation.managed_by_hospital.is_(True),
            )
        )
    return stmt


def _hospital_appointment_ids(hospital_id: UUID):
    """Appointments belonging to a hospital's OWN practice.

    Excludes personal practices for the reason that recurs throughout this
    codebase: a self-registered doctor's appointments carry
    `hospital_id = doctor.hospital_id`, which is the default anchor tenant and
    not a hospital they work for.
    """
    return (
        select(Appointment.appointment_id)
        .outerjoin(DoctorAffiliation,
                   Appointment.affiliation_id == DoctorAffiliation.affiliation_id)
        .where(
            Appointment.hospital_id == hospital_id,
            or_(
                Appointment.affiliation_id.is_(None),
                DoctorAffiliation.managed_by_hospital.is_(True),
            ),
        )
    )


def _patient_authored():
    """User ids belonging to patients — i.e. rows the patient put on file
    themselves."""
    return select(User.user_id).join(Role, Role.role_id == User.role_id).where(
        Role.name == ROLE_PATIENT
    )


def _scope_clinical(db: Session, stmt, me: User, model, owner_col):
    """Narrow captured clinical rows (documents, vitals) to their provenance.

    Same principle as `_scope_visits`: opening a record is not the same as seeing
    everything in it. A lab report or a set of vitals captured at another hospital
    says where the patient was treated, and a document type alone
    (`prescription`, `scan`) can disclose a great deal.

    Provenance is read two ways because the data supports two:

      - `appointment_id`, when the row was captured against a visit — reliable
        for vitals, which are taken at check-in
      - the user who filed it (`uploaded_by` / `recorded_by`), which is the only
        signal documents have; in practice they are filed without an appointment

    Rows the PATIENT filed themselves stay visible to everyone treating them.
    They put those on their own record precisely so their doctors would see them,
    and hiding a patient's own uploaded lab report from the doctor they are
    sitting in front of would be a worse bug than the one this fixes.

      - PATIENT / SUPER_ADMIN — everything
      - DOCTOR                — rows from their own visits, rows they recorded,
                                and the patient's own uploads
      - hospital staff          — rows from their hospital's visits, rows filed by
                                their own staff, and the patient's own uploads

    NOTE: this trades continuity of care for privacy. A doctor no longer sees BP
    or sugar trends recorded at another hospital. That is the intended policy here;
    if it should be relaxed for vitals specifically, drop the `_scope_clinical`
    call in `list_vitals` and leave `list_documents` scoped.
    """
    role = me.role.name if me.role else None
    if role in (ROLE_PATIENT, ROLE_SUPER_ADMIN):
        return stmt

    mine_by_author = owner_col.in_(_patient_authored())

    if role == ROLE_DOCTOR:
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
        if not doctor:
            return stmt.where(model.patient_id.is_(None))    # matches nothing
        own_appts = select(Appointment.appointment_id).where(
            Appointment.doctor_id == doctor.doctor_id
        )
        return stmt.where(
            or_(
                model.appointment_id.in_(own_appts),
                and_(model.appointment_id.is_(None), owner_col == me.user_id),
                mine_by_author,
            )
        )

    same_hospital_staff = select(User.user_id).where(User.hospital_id == me.hospital_id)
    return stmt.where(
        or_(
            model.appointment_id.in_(_hospital_appointment_ids(me.hospital_id)),
            and_(model.appointment_id.is_(None), owner_col.in_(same_hospital_staff)),
            mine_by_author,
        )
    )


def _fresh_uhid(db: Session) -> str:
    try:
        return uhid_service.allocate(db)
    except RuntimeError:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Could not allocate a UHID")


def _at_hospital(hospital_id: UUID):
    """A hospital 'sees' a patient if they are anchored to it OR have booked an
    appointment there. Patients self-register as 'global' (anchored to one
    default tenant) but may book at any hospital — without this, such a patient
    would never appear in the list of the hospital they actually visited."""
    booked_here = select(Appointment.patient_id).where(Appointment.hospital_id == hospital_id)
    return or_(Patient.hospital_id == hospital_id, Patient.patient_id.in_(booked_here))


def _save_upload(patient_id: UUID, upload: UploadFile) -> tuple[str, int]:
    return storage.save_upload("patients", patient_id, upload)


# ========================================================= Patients =========
@router.get("/patients", response_model=list[PatientOut])
def list_patients(
    hospital_id: UUID | None = Query(None),
    search: str | None = Query(None),
    # Filtering these client-side only ever saw the current page, so a desk
    # filtering "Female" on page 1 was told "no patients found" while matches
    # sat on page 3. Filter in the query instead.
    gender: str | None = Query(None),
    blood_group: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission("patient", "read")),
    db: Session = Depends(get_db),
):
    is_super = bool(me.role and me.role.name == "SUPER_ADMIN")
    stmt = select(Patient)
    if me.role and me.role.name == "PATIENT":
        stmt = stmt.where(Patient.user_id == me.user_id)
    elif me.role and me.role.name == "DOCTOR":
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
        if not doctor:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctor profile not linked")
        own_patient_ids = select(Appointment.patient_id).where(
            Appointment.doctor_id == doctor.doctor_id
        )
        stmt = stmt.where(Patient.patient_id.in_(own_patient_ids))
    elif is_super:
        if hospital_id:
            stmt = stmt.where(_at_hospital(hospital_id))
    else:
        stmt = stmt.where(_at_hospital(me.hospital_id))
    if search:
        like = f"%{search}%"
        conds = [Patient.name.ilike(like), Patient.phone.ilike(like)]
        norm = uhid_service.normalise(search)
        if norm:
            conds.append(Patient.uhid == norm)
        stmt = stmt.where(or_(*conds))
    if gender:
        stmt = stmt.where(Patient.gender == gender)
    if blood_group:
        stmt = stmt.where(Patient.blood_group == blood_group)
    # Newest first, so a just-registered patient is visible on page 1 immediately.
    return db.scalars(stmt.order_by(Patient.patient_id.desc()).offset((page - 1) * size).limit(size)).all()


@router.get("/patients/search", response_model=list[PatientOut])
def search_patients(q: str = Query(..., min_length=1), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    """Front-desk lookup: matches name, phone OR UHID. One phone shared by a
    family returns several rows — the caller shows a pick list."""
    like = f"%{q}%"
    conditions = [Patient.name.ilike(like), Patient.phone.ilike(like)]
    norm = uhid_service.normalise(q)
    if norm:
        conditions.append(Patient.uhid == norm)
    stmt = select(Patient).where(or_(*conditions))
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(_at_hospital(me.hospital_id))
    return db.scalars(stmt.order_by(Patient.name).limit(50)).all()


@router.get("/patients/by-uhid/{code}", response_model=PatientDetail)
def get_patient_by_uhid(code: str, me: User = Depends(require_permission("patient", "read")), db: Session = Depends(get_db)):
    """Exact UHID resolution for a typed card code. The check digit is verified
    first so an obviously-mistyped code is rejected before any lookup."""
    if not uhid_service.is_valid(code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid UHID — please re-check the code")
    p = db.scalar(select(Patient).where(Patient.uhid == uhid_service.normalise(code)))
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No patient with this UHID")
    _assert_access(db, me, p)
    return p


@router.post("/patients", response_model=PatientOut, status_code=201)
def create_patient(body: PatientCreate, me: User = Depends(require_permission("patient", "create")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, body.hospital_id)
    if not db.get(Hospital, body.hospital_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid hospital_id")
    if db.scalar(select(Patient).where(Patient.hospital_id == body.hospital_id, Patient.phone == body.phone)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Patient with this phone already exists at this hospital")
    p = Patient(**body.model_dump(), uhid=_fresh_uhid(db))
    db.add(p)
    audit.log_activity(db, me.user_id, "patient.create", "patient")
    db.commit()
    db.refresh(p)
    return p


@router.get("/patients/{patient_id}", response_model=PatientDetail)
def get_patient(patient_id: UUID, me: User = Depends(require_permission("patient", "read")), db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    return p


@router.put("/patients/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: UUID, body: PatientUpdate, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    data = body.model_dump(exclude_unset=True)
    new_phone = data.pop("phone", None)
    if new_phone is not None:
        owner = db.get(User, p.user_id) if p.user_id else None
        if owner:
            # Linked to a login, and patients sign in by OTP to this number: who
            # holds the number holds the account. Staff (reception, admin,
            # doctor) and the patient themselves could move it here with no OTP
            # to anyone — the next login on the new number got the whole history.
            # Only the Super Admin may, as an audited support case. No screen
            # sends a phone here, so the app loses nothing.
            if new_phone.strip() != (owner.phone or "").strip():
                if not (me.role and me.role.name == ROLE_SUPER_ADMIN):
                    raise HTTPException(
                        status.HTTP_403_FORBIDDEN,
                        "This patient signs in with their mobile number. It can't be changed from here.",
                    )
                audit.log_activity(db, me.user_id, "patient.phone_change", "patient",
                                   {"patient_id": str(p.patient_id), "user_id": str(owner.user_id)})
            # The number has to move on both tables at once — that single
            # writer owns every copy of it.
            accounts.change_phone(db, owner, new_phone)
        else:
            # A walk-in registered at the desk has no user account to carry the
            # number, so this row IS the record. Same validation, same clash
            # check, just nothing else to keep in step.
            p.phone = accounts.set_walkin_phone(db, p, new_phone)
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.post("/patients/{patient_id}/photo", response_model=PatientOut)
def upload_patient_photo(
    patient_id: UUID,
    file: UploadFile = File(...),
    me: User = Depends(require_permission("patient", "update")),
    db: Session = Depends(get_db),
):
    """Set/replace the patient's profile photo in configured upload storage."""
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    storage.require_image(file)
    url, _ = _save_upload(patient_id, file)
    p.photo_url = url
    db.commit()
    db.refresh(p)
    return p


@router.delete("/patients/{patient_id}")
def delete_patient(patient_id: UUID, me: User = Depends(require_permission("patient", "delete")), db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    ensure_same_tenant(me, p.hospital_id)
    db.delete(p)
    db.commit()
    return {"message": "Patient deleted"}


# ===================================================== Family ===============
@router.get("/patients/{patient_id}/family", response_model=list[FamilyMemberOut])
def list_family(patient_id: UUID, me: User = Depends(require_permission("patient", "read")), db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    # Removed members are kept (is_active=False) for their records; hide them.
    return [m for m in p.family_members if m.is_active]


def _assert_notify_target(m: FamilyMember) -> None:
    """`notify_to='own'` is meaningless without a number to send to."""
    if m.notify_to == "own" and not (m.phone or "").strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Add a mobile number to send this member's reminders to their own number.",
        )


@router.post("/family-members", response_model=FamilyMemberOut, status_code=201)
def add_family(body: FamilyMemberCreate, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    p = _patient(db, body.patient_id)
    _assert_access(db, me, p)
    # A patient may carry at most 5 dependents (active ones).
    if sum(1 for fm in p.family_members if fm.is_active) >= 5:
        raise HTTPException(status.HTTP_409_CONFLICT, "You can add up to 5 family members")
    m = FamilyMember(**body.model_dump())
    _assert_notify_target(m)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


@router.put("/family-members/{member_id}", response_model=FamilyMemberOut)
def update_family(member_id: UUID, body: FamilyMemberUpdate, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    m = db.get(FamilyMember, member_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family member not found")
    _assert_access(db, me, m.patient)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    _assert_notify_target(m)
    db.commit()
    db.refresh(m)
    return m


def _save_member_photo(patient_id: UUID, member_id: UUID, upload: UploadFile) -> str:
    """Persist a family member's photo; return its stable stored reference.

    Namespaced by member so two dependents uploading `photo.jpg` don't clobber
    each other.
    """
    url, _ = storage.save_upload("patients", f"{patient_id}/family/{member_id}", upload)
    return url


@router.post("/family-members/{member_id}/photo", response_model=FamilyMemberOut)
def upload_family_member_photo(
    member_id: UUID,
    file: UploadFile = File(...),
    me: User = Depends(require_permission("patient", "update")),
    db: Session = Depends(get_db),
):
    """Set/replace a family member's photo."""
    m = db.get(FamilyMember, member_id)
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family member not found")
    _assert_access(db, me, m.patient)
    storage.require_image(file)
    m.photo_url = _save_member_photo(m.patient_id, m.member_id, file)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/family-members/{member_id}")
def remove_family(member_id: UUID, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    m = db.get(FamilyMember, member_id)
    if not m or not m.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family member not found")
    _assert_access(db, me, m.patient)

    # A visit still to come would leave the doctor with a booking for someone
    # who no longer exists — make them cancel it first, and say which one.
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    upcoming = db.scalar(
        select(Appointment).where(
            Appointment.family_member_id == m.member_id,
            Appointment.appointment_date >= today,
            Appointment.status.in_(("scheduled", "confirmed", "in_progress", "rescheduled")),
        ).order_by(Appointment.appointment_date).limit(1)
    )
    if upcoming:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{m.name} has an appointment on {upcoming.appointment_date.strftime('%d %b %Y')}. "
            "Cancel it first, then remove them.",
        )

    # Every one of these tables points at the member with no ON DELETE rule, so
    # a hard delete of anyone with history failed in the database (a bare 500).
    # Their visits and prescriptions are medical records and must stay, so a
    # member with history is hidden instead; only an unused one is deleted.
    has_history = any(
        db.scalar(select(model.family_member_id).where(model.family_member_id == m.member_id).limit(1))
        for model in (Appointment, FollowUp, MedicineCourse, PatientVital, Prescription, RevisitPass)
    )
    if has_history:
        m.is_active = False
    else:
        db.delete(m)
    db.commit()
    return {"message": "Family member removed"}


# ============================================ Family account links ==========
# Two-sided consent, holder first. See services/family_link.py for why a phone
# match alone is never enough.


@router.get("/family-links/requests", response_model=list[FamilyMemberOut])
def link_requests(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Waiting on ME as the account holder: someone registered on a number I
    saved for a dependent."""
    return db.scalars(
        select(FamilyMember)
        .join(Patient, Patient.patient_id == FamilyMember.patient_id)
        .where(Patient.user_id == me.user_id,
               FamilyMember.link_status == family_link.STATUS_PENDING_HOLDER)
    ).all()


@router.get("/family-links/invitable", response_model=list[FamilyMemberOut])
def link_invitable(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """My family entries whose number already belongs to an existing account.

    Registration-time detection only helps a dependent who signs up AFTER being
    listed. Most already had an account, so the holder starts it from here.
    """
    return family_link.invitable_members(db, me)


@router.post("/family-links/{member_id}/invite", response_model=FamilyMemberOut)
def link_invite(member_id: UUID, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = family_link.invite_by_holder(db, member_id, me)
    audit.log_activity(db, me.user_id, "family.link_invite", "patient", {"member_id": member_id})
    db.commit(); db.refresh(m)
    return m


@router.get("/family-links/invitations", response_model=list[FamilyMemberOut])
def link_invitations(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Waiting on ME as the dependent: a holder has vouched for me and I decide."""
    rows = list(db.scalars(
        select(FamilyMember).where(
            FamilyMember.linked_user_id == me.user_id,
            FamilyMember.link_status == family_link.STATUS_PENDING_MEMBER,
        )
    ).all())
    # The dependent needs to know WHO is asking, and the row only knows their
    # own name.
    return family_link.attach_holder_names(db, rows)


@router.post("/family-links/{member_id}/approve", response_model=FamilyMemberOut)
def link_approve(member_id: UUID, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = family_link.approve_by_holder(db, member_id, me)
    audit.log_activity(db, me.user_id, "family.link_approve", "patient", {"member_id": member_id})
    db.commit(); db.refresh(m)
    return m


@router.post("/family-links/{member_id}/decline", response_model=FamilyMemberOut)
def link_decline(member_id: UUID, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = family_link.decline_by_holder(db, member_id, me)
    audit.log_activity(db, me.user_id, "family.link_decline", "patient", {"member_id": member_id})
    db.commit(); db.refresh(m)
    return m


@router.post("/family-links/{member_id}/accept", response_model=FamilyMemberOut)
def link_accept(member_id: UUID, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = family_link.accept_by_member(db, member_id, me)
    audit.log_activity(db, me.user_id, "family.link_accept", "patient", {"member_id": member_id})
    db.commit(); db.refresh(m)
    return m


@router.post("/family-links/{member_id}/reject", response_model=FamilyMemberOut)
def link_reject(member_id: UUID, me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = family_link.reject_by_member(db, member_id, me)
    audit.log_activity(db, me.user_id, "family.link_reject", "patient", {"member_id": member_id})
    db.commit(); db.refresh(m)
    return m


@router.get("/family-links/shared-vitals", response_model=list[VitalsOut])
def shared_vitals(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Vitals recorded FOR me under someone else's account, once we are linked.

    Vitals have no "mine" endpoint of their own — they are read per patient id,
    and a dependent does not own the holder's patient record. So this is a
    separate read rather than a widened one; loosening `_assert_access` on
    `/patients/{id}/vitals` would have handed over the whole record.
    """
    ids = family_link.linked_member_ids(db, me)
    if not ids:
        return []
    rows = db.scalars(
        select(PatientVital)
        .where(PatientVital.family_member_id.in_(ids))
        .order_by(PatientVital.recorded_at.desc(), PatientVital.vital_id.desc())
    ).all()
    return [_vital_out(db, v) for v in rows]


@router.get("/family-links/shared-appointments", response_model=list[AppointmentOut])
def shared_appointments(me: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Visits booked FOR me under someone else's account, once we are linked.

    Read-only and derived: nothing is copied onto my own record, so revoking
    the link (setting it back) simply stops returning these.
    """
    ids = family_link.linked_member_ids(db, me)
    if not ids:
        return []
    return db.scalars(
        select(Appointment)
        .where(Appointment.family_member_id.in_(ids))
        .order_by(Appointment.appointment_date.desc(), Appointment.appointment_id.desc())
    ).all()


# ================================================ Medical history ===========
@router.get("/patients/{patient_id}/medical-history", response_model=list[MedicalHistoryOut])
def list_history(patient_id: UUID, me: User = Depends(require_permission("patient", "read")), db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    return p.medical_history


@router.post("/medical-history", response_model=MedicalHistoryOut, status_code=201)
def add_history(body: MedicalHistoryCreate, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    p = _patient(db, body.patient_id)
    _assert_access(db, me, p)
    h = MedicalHistory(**body.model_dump(), created_by=me.user_id)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.put("/medical-history/{history_id}", response_model=MedicalHistoryOut)
def update_history(history_id: UUID, body: MedicalHistoryUpdate, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    h = db.get(MedicalHistory, history_id)
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Record not found")
    _assert_access(db, me, h.patient)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h


# ===================================================== Allergies ============
@router.get("/patients/{patient_id}/allergies", response_model=list[AllergyOut])
def list_allergies(patient_id: UUID, me: User = Depends(require_permission("patient", "read")), db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    return p.allergies


@router.post("/allergies", response_model=AllergyOut, status_code=201)
def add_allergy(body: AllergyCreate, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    p = _patient(db, body.patient_id)
    _assert_access(db, me, p)
    a = Allergy(**body.model_dump(), created_by=me.user_id)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.delete("/allergies/{allergy_id}")
def remove_allergy(allergy_id: UUID, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    a = db.get(Allergy, allergy_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Allergy not found")
    _assert_access(db, me, a.patient)
    db.delete(a)
    db.commit()
    return {"message": "Allergy removed"}


# ===================================================== Documents ============
def _document_out(db: Session, doc: PatientDocument) -> DocumentOut:
    """Add the consultation doctor and hospital to a linked document."""
    out = DocumentOut.model_validate(doc)
    if not doc.appointment_id:
        return out
    appointment = db.get(Appointment, doc.appointment_id)
    if not appointment:
        return out
    doctor = db.get(Doctor, appointment.doctor_id)
    hospital = db.get(Hospital, appointment.hospital_id)
    out.doctor_id = appointment.doctor_id
    out.doctor_name = doctor.name if doctor else None
    out.hospital_id = appointment.hospital_id
    out.hospital_name = hospital.name if hospital else None
    out.consultation_date = appointment.appointment_date
    return out


@router.get("/patients/{patient_id}/documents", response_model=list[DocumentOut])
def list_documents(patient_id: UUID, me: User = Depends(require_permission("patient", "read")), db: Session = Depends(get_db)):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    # Queried rather than read off `p.documents`: the relationship cannot be
    # filtered, and opening the record must not hand over another hospital's files.
    stmt = _scope_clinical(
        db, select(PatientDocument).where(PatientDocument.patient_id == patient_id),
        me, PatientDocument, PatientDocument.uploaded_by,
    )
    # A prescription photographed/uploaded by the patient is their private
    # archive. It is separate from a prescription authored in the consultation
    # workflow and must never appear in a doctor or front-desk record view.
    role = me.role.name if me.role else None
    if role != ROLE_PATIENT:
        stmt = stmt.where(
            or_(
                PatientDocument.document_type != "prescription",
                PatientDocument.uploaded_by.not_in(_patient_authored()),
            )
        )
    rows = db.scalars(stmt.order_by(PatientDocument.created_at.desc())).all()
    return [_document_out(db, row) for row in rows]


@router.post("/documents", response_model=DocumentOut, status_code=201)
def upload_document(
    patient_id: UUID = Form(...),
    document_type: str = Form("other"),
    description: str = Form(""),
    appointment_id: UUID | None = Form(None),
    file: UploadFile = File(...),
    me: User = Depends(require_permission("patient", "update")),
    db: Session = Depends(get_db),
):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    role = me.role.name if me.role else None
    # A receptionist's hospital lab report must belong to a completed visit at
    # that hospital. This is deliberately not applied to DOCTOR uploads, so the
    # existing self-registered/personal-practice workflow stays unchanged.
    if role == ROLE_RECEPTIONIST and document_type == "lab_report":
        if appointment_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "Select the completed consultation for this lab report",
            )
        appointment = db.scalar(
            select(Appointment).where(
                Appointment.appointment_id == appointment_id,
                Appointment.patient_id == patient_id,
                Appointment.status == "completed",
                Appointment.appointment_id.in_(_hospital_appointment_ids(me.hospital_id)),
            )
        )
        if not appointment:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "The selected consultation must be a completed visit at your hospital",
            )
    url, size_kb = _save_upload(patient_id, file)
    doc = PatientDocument(
        patient_id=patient_id, document_type=document_type,
        # English only in the database (services/english_text.py).
        description=to_english(description.strip())[:2000], file_name=to_english(file.filename or "file"),
        file_url=url, file_size_kb=size_kb, mime_type=file.content_type,
        uploaded_by=me.user_id, appointment_id=appointment_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return _document_out(db, doc)


@router.delete("/documents/{document_id}")
def delete_document(document_id: UUID, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    d = db.get(PatientDocument, document_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    _assert_access(db, me, d.patient)
    db.delete(d)
    db.commit()
    return {"message": "Document deleted"}


# =================================================== Vitals =================
def _vital_out(db: Session, v: PatientVital) -> VitalsOut:
    """Serialise a vital with its derived BMI / abnormal flags and recorder name."""
    out = VitalsOut.model_validate(v)
    ev = vitals_service.evaluate(v)
    out.bmi, out.flags, out.abnormal = ev["bmi"], ev["flags"], ev["abnormal"]
    if v.recorded_by:
        u = db.get(User, v.recorded_by)
        out.recorded_by_name = u.name if u else None
    if v.family_member_id:
        fm = db.get(FamilyMember, v.family_member_id)
        out.family_member_name = fm.name if fm else None
    return out


@router.get("/vitals/recent", response_model=list[VitalsOut])
def recent_vitals(limit: int = Query(50, ge=1, le=200), me: User = Depends(require_permission("patient", "read")),
                  _staff: User = Depends(require_staff), db: Session = Depends(get_db)):
    """The hospital's vitals log — most recent readings recorded by this hospital's
    staff, newest first, each tagged with the patient's name/UHID. Powers the
    receptionist 'Vitals & Measurements' page."""
    staff_ids = select(User.user_id).where(User.hospital_id == me.hospital_id)
    stmt = select(PatientVital).where(PatientVital.recorded_by.in_(staff_ids))
    allowed = assigned_doctor_ids(db, me)
    if allowed is not None:
        # A receptionist assigned to particular doctors sees readings for those
        # doctors' patients, plus any she took herself.
        their_patients = select(Appointment.patient_id).where(
            Appointment.hospital_id == me.hospital_id, Appointment.doctor_id.in_(allowed)
        )
        stmt = stmt.where(or_(PatientVital.patient_id.in_(their_patients), PatientVital.recorded_by == me.user_id))
    rows = db.scalars(
        stmt
        # vital_id breaks ties: two readings taken in the same instant (a re-check
        # right after the first) otherwise come back in arbitrary order, and every
        # caller treats row 0 as "the latest" — so an older BP could be shown as
        # the current one.
        .order_by(PatientVital.recorded_at.desc(), PatientVital.vital_id.desc()).limit(limit)
    ).all()
    out = []
    for v in rows:
        o = _vital_out(db, v)
        p = db.get(Patient, v.patient_id)
        o.patient_name = p.name if p else None
        o.patient_uhid = p.uhid if p else None
        out.append(o)
    return out


@router.get("/patients/{patient_id}/vitals", response_model=list[VitalsOut])
def list_vitals(patient_id: UUID, me: User = Depends(require_permission("patient", "read")), db: Session = Depends(get_db)):
    """Vitals history for a patient, newest first (latest reading is index 0)."""
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    stmt = _scope_clinical(
        db, select(PatientVital).where(PatientVital.patient_id == patient_id),
        me, PatientVital, PatientVital.recorded_by,
    )
    rows = db.scalars(
        stmt.order_by(PatientVital.recorded_at.desc(), PatientVital.vital_id.desc())
    ).all()
    return [_vital_out(db, v) for v in rows]


@router.post("/vitals", response_model=VitalsOut, status_code=201)
def record_vitals(body: VitalsCreate, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    """Record a set of vitals (nurse/reception at check-in). At least one measure
    must be provided — an all-empty reading is rejected."""
    p = _patient(db, body.patient_id)
    _assert_access(db, me, p)
    data = body.model_dump()
    measures = ("bp_systolic", "bp_diastolic", "pulse", "temperature_f", "spo2",
                "respiratory_rate", "weight_kg", "height_cm", "blood_sugar")
    if not any(data.get(k) is not None for k in measures):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter at least one vital measurement")
    v = PatientVital(**data, recorded_by=me.user_id)
    db.add(v)
    db.commit()
    db.refresh(v)
    return _vital_out(db, v)


@router.delete("/vitals/{vital_id}")
def delete_vitals(vital_id: UUID, me: User = Depends(require_permission("patient", "update")), db: Session = Depends(get_db)):
    v = db.get(PatientVital, vital_id)
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vitals record not found")
    _assert_access(db, me, v.patient)
    db.delete(v)
    db.commit()
    return {"message": "Vitals record deleted"}


# ============================================ Patient appointments ==========
@router.get("/patients/{patient_id}/appointments", response_model=list[AppointmentOut])
def patient_appointments(
    patient_id: UUID,
    status_filter: str | None = Query(None, alias="status"),
    me: User = Depends(require_permission("appointment", "read")),
    db: Session = Depends(get_db),
):
    p = _patient(db, patient_id)
    _assert_access(db, me, p)
    # This, not GET /appointments, is what the patient console actually calls
    # for someone's visit list — so the family-link widening has to live here
    # too, or a linked dependent opens their dashboard to an empty page while
    # the data sits one join away.
    cond = Appointment.patient_id == patient_id
    if me.role and me.role.name == ROLE_PATIENT and p.user_id == me.user_id:
        linked = family_link.linked_member_ids(db, me)
        if linked:
            cond = or_(cond, Appointment.family_member_id.in_(linked))
    stmt = select(Appointment).where(cond)
    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)
    # Opening the record is not the same as seeing every visit in it.
    stmt = _scope_visits(db, stmt, me)
    appts = db.scalars(stmt.order_by(Appointment.appointment_date.desc())).all()

    # Enrich each visit with the doctor seen and the hospital visited, so the
    # history reads "saw Dr X (Cardiology) at City Care" rather than bare ids.
    doc_ids = {a.doctor_id for a in appts}
    hosp_ids = {a.hospital_id for a in appts}
    fam_ids = {a.family_member_id for a in appts if a.family_member_id}
    doctors = {d.doctor_id: d for d in db.scalars(select(Doctor).where(Doctor.doctor_id.in_(doc_ids)))} if doc_ids else {}
    hospitals = {h.hospital_id: h for h in db.scalars(select(Hospital).where(Hospital.hospital_id.in_(hosp_ids)))} if hosp_ids else {}
    members = {m.member_id: m.name for m in db.scalars(select(FamilyMember).where(FamilyMember.member_id.in_(fam_ids)))} if fam_ids else {}
    for a in appts:
        d = doctors.get(a.doctor_id)
        a.doctor_name = d.name if d else None
        a.doctor_specialty = d.specialization if d else None
        h = hospitals.get(a.hospital_id)
        a.hospital_name = getattr(h, "name", None)
        if a.family_member_id:
            a.family_member_name = members.get(a.family_member_id)
    return appts
