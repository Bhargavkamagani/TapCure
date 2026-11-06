"""Suspend / reactivate a hospital or a doctor (Super Admin), 2026-10-01.

There used to be no way to take a hospital or doctor off TapCure from the admin
console. The backend had two half-measures (DELETE /hospitals/{id} and
DELETE /doctors/{id}) that flipped one flag each: logins kept working,
patients kept their upcoming bookings and nobody was told. Policy, decided
with the product owner:

* **Suspend, never delete.** Patients' visits, prescriptions and payments
  depend on these rows and must be kept. A suspension is fully reversible.
* **Logins are blocked at once.** Users go to status ``suspended`` (not
  ``inactive``, so a reactivation restores exactly the accounts it blocked and
  never wakes one that was inactive for another reason). Every request checks
  ``user.is_active``, so open sessions end on their next call.
* **Upcoming appointments, today's included, are cancelled and every patient
  is told** — through session_cancellation._cancel_one, the same routine the
  session-delete and holiday paths use: it releases the queue token and
  renumbers the queue, restores a redeemed revisit pass, reopens follow-ups,
  notifies in-app + WhatsApp, and gives anyone who PAID the booking fee one
  free rebooking, valid at any TapCure hospital with any doctor.
* **The reason and every change are recorded** in the activity log, which is
  also how a reactivation knows exactly what to restore. No schema change.

Booking itself refuses a suspended doctor or hospital (appointments.
_resolve_affiliation), because a booking without a practice location can
create one on the fly and would otherwise slip past the hidden affiliations.
"""
from __future__ import annotations
from uuid import UUID

import re
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import parse_uuid
from ..models import Appointment, Doctor, DoctorAffiliation, FamilyMember, Hospital, Patient, Role, User
from ..models.security import ActivityLog
from ..rbac import ROLE_HOSPITAL_ADMIN, ROLE_PHARMACIST, ROLE_RECEPTIONIST
from . import audit
from .session_cancellation import _ACTIVE, _cancel_one

SUSPENDED = "suspended"
_IST = timezone(timedelta(hours=5, minutes=30), "IST")
# Hospital staff whose login is the hospital's own: blocked with the hospital.
_HOSPITAL_STAFF_ROLES = (ROLE_HOSPITAL_ADMIN, ROLE_RECEPTIONIST, ROLE_PHARMACIST)


def _dr(name: str) -> str:
    """"Dr. Rahul" — without doubling it when the name already says Dr."""
    name = (name or "").strip()
    return name if re.match(r"(?i)dr\.?\s", name) else f"Dr. {name}"


def _today():
    return datetime.now(_IST).date()


def _clean_reason(reason: str) -> str:
    reason = (reason or "").strip()
    if len(reason) < 5:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please give a reason (at least 5 characters).")
    return reason[:500]


def _upcoming(db: Session, *conds) -> list[Appointment]:
    return list(db.scalars(
        select(Appointment).where(
            Appointment.status.in_(_ACTIVE),
            Appointment.appointment_date >= _today(),
            *conds,
        ).order_by(Appointment.appointment_date, Appointment.appointment_id)
    ).all())


def _paid_row(db: Session, appt: Appointment) -> dict:
    patient = db.get(Patient, appt.patient_id) if appt.patient_id else None
    member = db.get(FamilyMember, appt.family_member_id) if appt.family_member_id else None
    return {
        "appointment_id": appt.appointment_id,
        "patient": (member.name if member else patient.name if patient else "") or "",
        "phone": (patient.phone if patient else "") or "",
        "date": appt.appointment_date.isoformat(),
        "booking_fee_paid": float(appt.booking_fee_paid or 0),
    }


def _cancel(db: Session, appts: list[Appointment], by_user_id: UUID, cause: str) -> list[dict]:
    """Cancel each booking through the shared routine; return the paid ones."""
    paid = []
    for appt in appts:
        row = _paid_row(db, appt) if float(appt.booking_fee_paid or 0) > 0 else None
        _cancel_one(db, appt, by_user_id, cause)
        if row:
            paid.append(row)
    return paid


def _last_log(db: Session, action: str, key: str, value) -> ActivityLog | None:
    """The latest `action` log whose meta[key] names `value`.

    Compared as text: the meta is JSON, so a UUID comes back out as a string,
    and `"0190…" == UUID("0190…")` is False. Comparing the raw values (as this
    did before ids became UUIDs) never matched, so Reactivate found nothing to
    restore and left every login it had blocked still blocked."""
    want = str(value)
    for row in db.scalars(
        select(ActivityLog).where(ActivityLog.action == action).order_by(ActivityLog.created_at.desc())
    ):
        if str((row.meta or {}).get(key)) == want:
            return row
    return None


# ---------------------------------------------------------------- hospitals ---
def _hospital_staff(db: Session, hospital_id: UUID) -> list[User]:
    return list(db.scalars(
        select(User).join(Role, Role.role_id == User.role_id).where(
            User.hospital_id == hospital_id,
            User.status == "active",
            Role.name.in_(_HOSPITAL_STAFF_ROLES),
        )
    ).all())


def _hospital_affiliations(db: Session, hospital_id: UUID) -> list[DoctorAffiliation]:
    return list(db.scalars(
        select(DoctorAffiliation).where(
            DoctorAffiliation.hospital_id == hospital_id,
            DoctorAffiliation.is_active.is_(True),
        )
    ).all())


def preview_hospital(db: Session, h: Hospital) -> dict:
    appts = _upcoming(db, Appointment.hospital_id == h.hospital_id)
    return {
        "hospital_id": h.hospital_id,
        "name": h.name,
        "status": h.status,
        "upcoming_appointments": len(appts),
        "paid_appointments": sum(1 for a in appts if float(a.booking_fee_paid or 0) > 0),
        "staff_logins": len(_hospital_staff(db, h.hospital_id)),
        "doctor_practices": len(_hospital_affiliations(db, h.hospital_id)),
    }


def suspend_hospital(db: Session, h: Hospital, by: User, reason: str) -> dict:
    reason = _clean_reason(reason)
    if h.status == SUSPENDED:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{h.name} is already suspended.")
    prev = {"status": h.status, "is_active": h.is_active}

    # 1. Staff logins (owner, reception, pharmacy).
    staff = _hospital_staff(db, h.hospital_id)
    for u in staff:
        u.status = SUSPENDED

    # 2. Doctors' practices here stop taking bookings. A doctor whose ONLY
    #    practice was this hospital is suspended too; one who also practises
    #    elsewhere (own hospital, another hospital) keeps working there.
    affs = _hospital_affiliations(db, h.hospital_id)
    for a in affs:
        a.is_active = False
    db.flush()
    doctor_ids, doctor_user_ids, doctor_prev = [], [], {}
    for did in sorted({a.doctor_id for a in affs}):
        d = db.get(Doctor, did)
        if not d or d.status == SUSPENDED:
            continue
        elsewhere = db.scalar(select(DoctorAffiliation.affiliation_id).where(
            DoctorAffiliation.doctor_id == did, DoctorAffiliation.is_active.is_(True)).limit(1))
        if elsewhere:
            continue
        doctor_prev[str(did)] = {"status": d.status, "is_available_today": d.is_available_today}
        d.status, d.is_available_today = SUSPENDED, False
        doctor_ids.append(did)
        u = db.get(User, d.user_id) if d.user_id else None
        if u and u.status == "active":
            u.status = SUSPENDED
            doctor_user_ids.append(u.user_id)

    # 3. Patients: cancel and tell them, today included.
    cause = f"{h.name} is no longer taking appointments on TapCure"
    appts = _upcoming(db, Appointment.hospital_id == h.hospital_id)
    paid = _cancel(db, appts, by.user_id, cause)

    h.status, h.is_active = SUSPENDED, False
    meta = {
        "hospital_id": h.hospital_id, "reason": reason, "previous": prev,
        "user_ids": [u.user_id for u in staff],
        "affiliation_ids": [a.affiliation_id for a in affs],
        "doctor_ids": doctor_ids, "doctor_user_ids": doctor_user_ids, "doctor_previous": doctor_prev,
        "cancelled": len(appts),
    }
    return _finish(db, by, "hospital.suspend", meta, paid, h.name)


def reactivate_hospital(db: Session, h: Hospital, by: User) -> dict:
    if h.status != SUSPENDED:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{h.name} is not suspended.")
    log = _last_log(db, "hospital.suspend", "hospital_id", h.hospital_id)
    meta = (log.meta if log else None) or {}
    restored_users = 0
    # Ids come back out of the audit log's JSON as strings; parse_uuid turns them
    # back into UUIDs. This used int(did) from before ids were UUIDs, which
    # raised on every UUID, so Reactivate crashed. Ids logged before the UUID
    # change no longer exist; they parse to None and are skipped.
    for uid in list(meta.get("user_ids", [])) + list(meta.get("doctor_user_ids", [])):
        u = db.get(User, parse_uuid(uid))
        if u and u.status == SUSPENDED:
            u.status = "active"
            restored_users += 1
    for aid in meta.get("affiliation_ids", []):
        a = db.get(DoctorAffiliation, parse_uuid(aid))
        if a:
            a.is_active = True
    for did, prev in (meta.get("doctor_previous") or {}).items():
        d = db.get(Doctor, parse_uuid(did))
        if d and d.status == SUSPENDED:
            d.status = prev.get("status") or "active"
            d.is_available_today = bool(prev.get("is_available_today", True))
    prev = meta.get("previous") or {}
    h.status = prev.get("status") if prev.get("status") not in (None, SUSPENDED) else "active"
    h.is_active = True
    audit.log_activity(db, by.user_id, "hospital.reactivate", "hospital",
                       {"hospital_id": h.hospital_id, "restored_users": restored_users})
    db.commit()
    return {"hospital_id": h.hospital_id, "status": h.status, "restored_logins": restored_users,
            "note": "Cancelled appointments stay cancelled; patients can book again."}


# ---------------------------------------------------------------- doctors ---
def preview_doctor(db: Session, d: Doctor) -> dict:
    appts = _upcoming(db, Appointment.doctor_id == d.doctor_id)
    return {
        "doctor_id": d.doctor_id,
        "name": d.name,
        "status": d.status,
        "upcoming_appointments": len(appts),
        "paid_appointments": sum(1 for a in appts if float(a.booking_fee_paid or 0) > 0),
        "has_login": bool(d.user_id),
    }


def suspend_doctor(db: Session, d: Doctor, by: User, reason: str) -> dict:
    reason = _clean_reason(reason)
    if d.status == SUSPENDED:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{_dr(d.name)} is already suspended.")
    prev = {"status": d.status, "is_available_today": d.is_available_today}
    d.status, d.is_available_today = SUSPENDED, False
    user_ids = []
    u = db.get(User, d.user_id) if d.user_id else None
    if u and u.status == "active":
        u.status = SUSPENDED
        user_ids.append(u.user_id)
    cause = f"{_dr(d.name)} is no longer taking appointments on TapCure"
    appts = _upcoming(db, Appointment.doctor_id == d.doctor_id)
    paid = _cancel(db, appts, by.user_id, cause)
    meta = {"doctor_id": d.doctor_id, "reason": reason, "previous": prev, "user_ids": user_ids,
            "cancelled": len(appts)}
    return _finish(db, by, "doctor.suspend", meta, paid, _dr(d.name))


def reactivate_doctor(db: Session, d: Doctor, by: User) -> dict:
    if d.status != SUSPENDED:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{_dr(d.name)} is not suspended.")
    log = _last_log(db, "doctor.suspend", "doctor_id", d.doctor_id)
    meta = (log.meta if log else None) or {}
    prev = meta.get("previous") or {}
    d.status = prev.get("status") if prev.get("status") not in (None, SUSPENDED) else "active"
    d.is_available_today = bool(prev.get("is_available_today", True))
    restored = 0
    # The doctor's own login: from the log when this doctor was suspended on
    # their own, else (suspended with their hospital) the linked account.
    for uid in meta.get("user_ids") or ([d.user_id] if d.user_id else []):
        u = db.get(User, parse_uuid(uid))
        if u and u.status == SUSPENDED:
            u.status = "active"
            restored += 1
    audit.log_activity(db, by.user_id, "doctor.reactivate", "doctor",
                       {"doctor_id": d.doctor_id, "restored_users": restored})
    db.commit()
    return {"doctor_id": d.doctor_id, "status": d.status, "restored_logins": restored,
            "note": "Cancelled appointments stay cancelled; patients can book again."}


# ----------------------------------------------------------------- shared ---
def _finish(db: Session, by: User, action: str, meta: dict, paid: list[dict], who: str) -> dict:
    """Record what was done (the reactivation reads this back) and commit."""
    module = action.split(".")[0]
    cancelled_ids = [r["appointment_id"] for r in paid]
    audit.log_activity(db, by.user_id, action, module, {**meta, "paid_appointment_ids": cancelled_ids})
    db.commit()
    return {
        "message": f"{who} has been suspended.",
        "blocked_logins": len(meta.get("user_ids", [])) + len(meta.get("doctor_user_ids", [])),
        "doctors_suspended": len(meta.get("doctor_ids", [])),
        "cancelled_appointments": meta.get("cancelled", 0),
        "paid_cancelled": paid,
        "paid_note": "Each paid patient gets one free rebooking at any TapCure hospital (90 days); "
                     "the cancellation message tells them so.",
    }


# ------------------------------------------- hospital sets a doctor Inactive ---
# Added 2026-10-01. A hospital admin setting a doctor to "inactive" (Edit Doctor,
# or DELETE /doctors/{id}) used to change only doctors.status: the doctor's
# login stayed active (console, queue, patient records, prescriptions) and
# their upcoming patients were never told. "Inactive" also hides the doctor
# from every patient list, including any home practice they run under the same
# login, so the doctor is now switched off completely:
#
# * login blocked (users.status "inactive"), open sessions end on next request;
# * this hospital's practice rows stop taking bookings;
# * every upcoming booking (today included) is cancelled and the patient told,
#   through the same _cancel_one routine as everything else.
#
# Setting the doctor back to active / on leave restores exactly what this
# changed (read back from the activity log). Cancelled bookings stay cancelled.
# "On leave" never blocks the login: a doctor on leave still needs the console.

def hospital_deactivate_doctor(db: Session, d: Doctor, by: User) -> dict:
    hospital_id = d.hospital_id
    hospital = db.get(Hospital, hospital_id) if hospital_id else None
    affs = [a for a in (d.affiliations or [])
            if a.is_active and a.managed_by_hospital and a.hospital_id == hospital_id]
    for a in affs:
        a.is_active = False
    prev_available = d.is_available_today
    d.is_available_today = False
    user_ids = []
    u = db.get(User, d.user_id) if d.user_id else None
    if u and u.status == "active":
        u.status = "inactive"
        user_ids.append(u.user_id)
    where = f" at {hospital.name}" if hospital and hospital.name else ""
    cause = f"{_dr(d.name)} is no longer available{where}"
    appts = _upcoming(db, Appointment.doctor_id == d.doctor_id)
    paid = _cancel(db, appts, by.user_id, cause)
    audit.log_activity(db, by.user_id, "doctor.hospital_deactivate", "doctor", {
        "doctor_id": d.doctor_id, "hospital_id": hospital_id,
        "affiliation_ids": [a.affiliation_id for a in affs], "user_ids": user_ids,
        "is_available_today": prev_available, "cancelled": len(appts),
        "paid_appointment_ids": [r["appointment_id"] for r in paid],
    })
    return {"cancelled_appointments": len(appts), "blocked_logins": len(user_ids), "paid_cancelled": paid}


def hospital_reactivate_doctor(db: Session, d: Doctor, by: User) -> None:
    log = _last_log(db, "doctor.hospital_deactivate", "doctor_id", d.doctor_id)
    meta = (log.meta if log else None) or {}
    for aid in meta.get("affiliation_ids", []):
        a = db.get(DoctorAffiliation, parse_uuid(aid))
        if a:
            a.is_active = True
    # From the log; a doctor made inactive before this existed has no log, and
    # their login was never blocked, so there is nothing to restore.
    for uid in meta.get("user_ids", []):
        u = db.get(User, parse_uuid(uid))
        if u and u.status == "inactive":
            u.status = "active"
    d.is_available_today = bool(meta.get("is_available_today", True))
    audit.log_activity(db, by.user_id, "doctor.hospital_reactivate", "doctor", {"doctor_id": d.doctor_id})
