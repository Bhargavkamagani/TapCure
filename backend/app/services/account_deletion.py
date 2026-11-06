"""A patient deletes their own account (Google Play / App Store requirement).

What goes, and what deliberately stays:

* The PERSON goes: name, phone, email, date of birth, address, ABHA, emergency
  contact, profile photo and the documents they uploaded themselves. The login
  is switched off and every session ends.
* The RECORDS stay, without the person: past visits, prescriptions, payments,
  vitals and the UHID. The hospital is required to keep its medical records,
  and every one of those rows is a foreign key that a hard delete would break.

No new column: "deleted" is `users.status`, and who/when is the activity log.

The phone number is freed — `users.phone` is cleared and every patient row gets
a unique placeholder — so the same number can sign up again as a new person,
and signup's "claim the walk-in rows on this number" step never re-attaches the
deleted history to them.
"""
from __future__ import annotations

import logging
import os
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Appointment, FamilyMember, FollowUp, Patient, PatientDocument, Token, User
from ..models.medicine_reminder import COURSE_ACTIVE, COURSE_AWAITING, MedicineCourse
from . import accounts, audit, storage
from .reminder_engine import stop_course
from .session_cancellation import _ACTIVE, _cancel_one

logger = logging.getLogger(__name__)

DELETED_STATUS = "deleted"
DELETED_NAME = "Deleted user"
CANCEL_REASON = "The patient deleted their TapCure account"


def _placeholder_phone() -> str:
    # patients.phone is NOT NULL and (hospital_id, phone) is unique, so each
    # deleted row needs its own value. Never digits-only: nothing can match it
    # as a real number, at login, at signup or in a reminder.
    return f"del{uuid.uuid4().hex[:12]}"


def _remove_file(ref: str | None) -> None:
    """Delete a stored upload. Never raises — the account deletion goes on."""
    if not ref:
        return
    try:
        if ref.startswith("s3://"):
            bucket, _, key = ref[5:].partition("/")
            import boto3
            from ..config import settings
            boto3.client("s3", region_name=settings.aws_region).delete_object(Bucket=bucket, Key=key)
        elif ref.startswith("/uploads/"):
            root = os.path.realpath(storage._UPLOAD_ROOT)
            path = os.path.realpath(os.path.join(root, ref[len("/uploads/"):].split("?")[0]))
            if path.startswith(root + os.sep) and os.path.isfile(path):
                os.remove(path)
    except Exception:  # noqa: BLE001
        logger.warning("could not delete stored file %s", ref, exc_info=True)


def delete_patient_account(db: Session, user: User, *, via: str) -> dict:
    """Delete `user` (a patient) as described above. Caller commits, then calls remove_files."""
    rows = list(db.scalars(select(Patient).where(Patient.user_id == user.user_id)).all())
    pids = [p.patient_id for p in rows]
    files: list[str] = []
    cancelled = 0

    if pids:
        # 1. Upcoming visits: cancelled through the one shared routine, so the
        #    token is released, the queue renumbered and the hospital sees it.
        upcoming = db.scalars(select(Appointment).where(
            Appointment.patient_id.in_(pids), Appointment.status.in_(_ACTIVE))).all()
        for appt in upcoming:
            _cancel_one(db, appt, user.user_id, CANCEL_REASON)
            cancelled += 1
        # A walk-in token with no appointment behind it.
        from . import token_engine as te
        for tok in db.scalars(select(Token).where(
                Token.patient_id.in_(pids), Token.appointment_id.is_(None),
                Token.status.in_(("waiting", "current")))).all():
            te.set_status(db, tok, "cancelled", user.user_id, CANCEL_REASON)
            tok.queue_position = 0
            db.flush()
            te.recompute_positions(db, tok.doctor_id, tok.token_date, tok.affiliation_id)

        # 2. Medicine reminders stop.
        for course in db.scalars(select(MedicineCourse).where(
                MedicineCourse.patient_id.in_(pids),
                MedicineCourse.status.in_((COURSE_ACTIVE, COURSE_AWAITING)))).all():
            stop_course(db, course, "Account deleted")

        # 3. Follow-ups still waiting would keep sending reminders to nobody.
        for fu in db.scalars(select(FollowUp).where(
                FollowUp.patient_id.in_(pids), FollowUp.status == "pending")).all():
            fu.status = "cancelled"

        # 4. Family members: hidden and emptied of personal details.
        for m in db.scalars(select(FamilyMember).where(FamilyMember.patient_id.in_(pids))).all():
            files.append(m.photo_url)
            m.is_active = False
            m.name, m.first_name, m.last_name = "Family member", "Family", "member"
            m.phone = None
            m.dob = None
            m.photo_url = None
            m.linked_user_id = None
            m.link_status = "none"

        # 5. Documents the patient uploaded themselves (hospital-uploaded
        #    reports are medical records and stay). The FILE is deleted but the
        #    row is emptied, not removed: medicine_courses.document_id points at
        #    prescription photos (a database-only foreign key), and removing
        #    the row made Postgres refuse the whole account deletion.
        for d in db.scalars(select(PatientDocument).where(
                PatientDocument.patient_id.in_(pids),
                PatientDocument.uploaded_by == user.user_id)).all():
            files.append(d.file_url)
            d.file_url = ""
            d.file_name = "deleted"
            d.description = ""
            d.file_size_kb = None
            d.mime_type = None

        # 6. The person, wiped from every hospital's copy of the record.
        for p in rows:
            files.append(p.photo_url)
            p.name, p.first_name, p.last_name = DELETED_NAME, "Deleted", "user"
            p.phone = _placeholder_phone()
            p.email = None
            p.abha_number = p.abha_address = None
            p.dob = None
            p.age = None
            p.photo_url = None
            p.address = p.city = p.pincode = ""
            p.emergency_contact_name = p.emergency_contact_phone = None
            p.is_registered = False

    # Someone else's family entry linked to this login loses the link.
    for m in db.scalars(select(FamilyMember).where(FamilyMember.linked_user_id == user.user_id)).all():
        m.linked_user_id = None
        m.link_status = "none"

    # 7. The login: off, signed out everywhere, number and email freed.
    #    phone=None makes the phone-sync triggers do nothing.
    user.name, user.first_name, user.last_name = DELETED_NAME, "Deleted", "user"
    user.phone = None
    user.email = f"deleted-{user.user_id.hex}@{accounts.SYNTHETIC_EMAIL_DOMAIN}"
    user.status = DELETED_STATUS
    accounts.end_sessions(db, user)

    audit.log_activity(db, user.user_id, "patient.account_deleted", "patient", {
        "via": via, "patient_ids": [str(x) for x in pids], "cancelled_appointments": cancelled,
    })
    db.flush()
    # The caller deletes `files` AFTER the commit (remove_files): if the commit
    # failed, nothing would have been removed from storage.
    return {"cancelled_appointments": cancelled, "files": [f for f in files if f]}


def remove_files(refs: list[str]) -> None:
    for ref in refs:
        _remove_file(ref)
