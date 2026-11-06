"""
Module 8 — Notification endpoints (15 APIs).

Send per channel (sms/whatsapp/email/push) + bulk, browse history + per-channel
delivery logs, stats, templates, and per-hospital channel settings. Dispatch is
the mocked provider (services/notifications.py) — records + lifecycle are real.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import ensure_same_tenant, require_permission, require_role, require_staff
from ..models import (
    Appointment, Doctor, DoctorAffiliation, EmailLog, Hospital, HospitalSettings,
    Notification, NotificationRead, Patient, SmsLog, Token, WhatsappLog, User,
)
from ..rbac import ROLE_DOCTOR, ROLE_HOSPITAL_ADMIN, ROLE_PATIENT, ROLE_SUPER_ADMIN, is_hospital_staff
from ..schemas.notification import (
    EmailLogOut, EmailSend, NotificationOut, NotificationSettings,
    NotificationTest, PushBulk, PushSend, SmsBulk, SmsLogOut, SmsSend,
    WhatsappLogOut, WhatsappSend,
)
from ..services import notifications as notify

router = APIRouter(tags=["notifications"])


def _tenant(me: User, hospital_id: UUID | None) -> int | None:
    """Resolve the hospital to attribute a notification to, with tenant guard."""
    if hospital_id is not None:
        ensure_same_tenant(me, hospital_id)
        return hospital_id
    return me.hospital_id


def _hide_personal_notifications(stmt, me: User):
    """Hospital staff must not see notifications tied to a doctor's personal practice
    (e.g. a travel-alert SMS carrying the patient's phone + message). A notification
    is personal when its token OR appointment belongs to an unmanaged affiliation.
    Standalone notifications (no token/appointment) are hospital-originated → kept.
    Requires `Notification` to be selectable in `stmt` (entity or joined)."""
    if not is_hospital_staff(me.role.name if me.role else None):
        return stmt
    personal_aff = select(DoctorAffiliation.affiliation_id).where(
        DoctorAffiliation.managed_by_hospital.is_(False)
    )
    personal_tokens = select(Token.token_id).where(Token.affiliation_id.in_(personal_aff))
    personal_appts = select(Appointment.appointment_id).where(Appointment.affiliation_id.in_(personal_aff))
    return stmt.where(
        or_(Notification.token_id.is_(None), Notification.token_id.not_in(personal_tokens)),
        or_(Notification.appointment_id.is_(None), Notification.appointment_id.not_in(personal_appts)),
    )


def _scope_for_role(stmt, me: User, db: Session):
    """Narrow a Notification query to what THIS user is actually meant to see.

    Every message now carries an `audience`, because inferring it from which
    columns happened to be filled got it wrong: an OTP has no appointment and no
    token, so it looked exactly like a hospital-wide announcement, and every
    receptionist and doctor could read patients' login codes.

      PATIENT      → their own records (handled by the caller)
      staff        → audience='hospital' (operational; 'clinic' on rows before 2026-10-25) + anything addressed to
                     them personally by recipient_user_id
      SUPER_ADMIN  → everything at every hospital
      audience='private' (OTP) → nobody's feed, at any level

    A staff member wanting a patient's message history asks for that patient
    explicitly (patient_id), which stays permitted — this only governs the
    unsolicited feed.
    """
    stmt = stmt.where(Notification.audience != "private")
    role = me.role.name if me.role else None
    if role == "SUPER_ADMIN":
        return stmt
    if role == ROLE_DOCTOR:
        doctor = db.scalar(select(Doctor).where(Doctor.user_id == me.user_id))
        if not doctor:
            return stmt.where(Notification.notification_id == -1)
        own_appointments = select(Appointment.appointment_id).where(
            Appointment.doctor_id == doctor.doctor_id
        )
        own_tokens = select(Token.token_id).where(Token.doctor_id == doctor.doctor_id)
        return stmt.where(
            Notification.hospital_id == me.hospital_id,
            or_(
                Notification.recipient_user_id == me.user_id,
                and_(
                    Notification.audience.in_(("hospital", "clinic")),
                    or_(
                        Notification.appointment_id.in_(own_appointments),
                        Notification.token_id.in_(own_tokens),
                    ),
                ),
            ),
        )
    return stmt.where(
        Notification.hospital_id == me.hospital_id,
        or_(
            Notification.audience.in_(("hospital", "clinic")),
            Notification.recipient_user_id == me.user_id,
        ),
    )


def _mark_read_flags(db: Session, rows: list[Notification], me: User) -> list[Notification]:
    """Stamp each row with is_read for THIS user (one query, not one per row)."""
    ids = [n.notification_id for n in rows]
    read_ids = set(
        db.scalars(
            select(NotificationRead.notification_id).where(
                NotificationRead.user_id == me.user_id,
                NotificationRead.notification_id.in_(ids),
            )
        ).all()
    ) if ids else set()
    for n in rows:
        n.is_read = n.notification_id in read_ids
    return rows


def _notification_is_personal(db: Session, n: Notification) -> bool:
    """Whether a single notification belongs to a doctor's personal practice."""
    aff_id = None
    if n.token_id:
        t = db.get(Token, n.token_id)
        aff_id = t.affiliation_id if t else None
    if aff_id is None and n.appointment_id:
        a = db.get(Appointment, n.appointment_id)
        aff_id = a.affiliation_id if a else None
    if aff_id is None:
        return False
    aff = db.get(DoctorAffiliation, aff_id)
    return bool(aff and not aff.managed_by_hospital)


# ===================================================== Send =================
# --- Free-text messaging: admins only -----------------------------------------
# These six endpoints put arbitrary text on the hospital's own sender ID, to any
# number the caller names. They were open to anyone holding notification.create,
# which includes every RECEPTIONIST: a QA run signed in as the front desk and
# sent "Arbitrary text from the hospital's sender ID" to a number of its choosing,
# then the same again in bulk. One borrowed desk password is then a phishing
# campaign carrying the hospital's name, billed to the hospital.
#
# The app itself never calls them — patient messaging goes through the template
# paths in services/notifications.py — so narrowing them to hospital admins
# costs no feature. `notification.create` stays as it was for the internal
# senders; this is an extra gate in front of the hand-callable endpoints.
_FREE_TEXT_SENDER = require_role(ROLE_HOSPITAL_ADMIN, ROLE_SUPER_ADMIN)

# A blast is capped as well as gated: an admin account is a smaller blast radius
# than a desk account, not a zero one.
MAX_BULK_RECIPIENTS = 200

@router.post("/sms/send", response_model=NotificationOut, status_code=201)
def sms_send(body: SmsSend, me: User = Depends(_FREE_TEXT_SENDER), db: Session = Depends(get_db)):
    n = notify.send_sms(db, body.phone, body.message, ntype=body.type, title=body.title,
                        template_id=body.template_id, hospital_id=_tenant(me, body.hospital_id),
                        patient_id=body.patient_id)
    db.commit()
    db.refresh(n)
    return n


@router.post("/sms/bulk")
def sms_bulk(body: SmsBulk, me: User = Depends(_FREE_TEXT_SENDER), db: Session = Depends(get_db)):
    if len(body.phones) > MAX_BULK_RECIPIENTS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"At most {MAX_BULK_RECIPIENTS} recipients per send")
    hid = _tenant(me, body.hospital_id)
    count = 0
    for phone in body.phones:
        notify.send_sms(db, phone, body.message, ntype=body.type, hospital_id=hid)
        count += 1
    db.commit()
    return {"sent": count, "channel": "sms"}


@router.post("/whatsapp/send", response_model=NotificationOut, status_code=201)
def whatsapp_send(body: WhatsappSend, me: User = Depends(_FREE_TEXT_SENDER), db: Session = Depends(get_db)):
    n = notify.send_whatsapp(db, body.phone, body.message, ntype=body.type,
                             template_name=body.template_name, template_params=body.template_params,
                             otp_code=body.otp_code, language_code=body.language_code,
                             hospital_id=_tenant(me, body.hospital_id),
                             patient_id=body.patient_id)
    db.commit()
    db.refresh(n)
    return n


@router.post("/email/send", response_model=NotificationOut, status_code=201)
def email_send(body: EmailSend, me: User = Depends(_FREE_TEXT_SENDER), db: Session = Depends(get_db)):
    n = notify.send_email(db, body.to, body.subject, body.body, hospital_id=_tenant(me, body.hospital_id),
                          patient_id=body.patient_id)
    db.commit()
    db.refresh(n)
    return n


@router.post("/push/send", response_model=NotificationOut, status_code=201)
def push_send(body: PushSend, me: User = Depends(_FREE_TEXT_SENDER), db: Session = Depends(get_db)):
    n = notify.send_push(db, body.device_token, body.title, body.body, platform=body.platform,
                         payload=body.payload, hospital_id=_tenant(me, body.hospital_id),
                         patient_id=body.patient_id)
    db.commit()
    db.refresh(n)
    return n


@router.post("/push/bulk")
def push_bulk(body: PushBulk, me: User = Depends(_FREE_TEXT_SENDER), db: Session = Depends(get_db)):
    if len(body.patient_ids) > MAX_BULK_RECIPIENTS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"At most {MAX_BULK_RECIPIENTS} recipients per send")
    hid = _tenant(me, body.hospital_id)
    count = 0
    for pid in body.patient_ids:
        # Real impl resolves registered device tokens; mock addresses by patient.
        notify.send_push(db, f"patient:{pid}", body.title, body.body, hospital_id=hid, patient_id=pid)
        count += 1
    db.commit()
    return {"sent": count, "channel": "push"}


# ===================================================== Read ================
@router.get("/notification-history", response_model=list[NotificationOut])
def notification_history(
    patient_id: UUID | None = Query(None),
    channel: str | None = Query(None),
    type: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission("notification", "read")),
    db: Session = Depends(get_db),
):
    stmt = select(Notification)
    role = me.role.name if me.role else None
    if role == ROLE_PATIENT:
        own_patient_ids = [
            p.patient_id
            for p in db.scalars(select(Patient).where(Patient.user_id == me.user_id)).all()
        ]
        if patient_id:
            if patient_id not in own_patient_ids:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your notifications")
            own_patient_ids = [patient_id]
        if not own_patient_ids:
            return []
        stmt = stmt.where(Notification.patient_id.in_(own_patient_ids),
                          Notification.audience != "private")
    else:
        stmt = _scope_for_role(stmt, me, db)
    if patient_id and role != ROLE_PATIENT:
        stmt = stmt.where(Notification.patient_id == patient_id)
    if channel:
        stmt = stmt.where(Notification.channel == channel)
    if type:
        stmt = stmt.where(Notification.type == type)
    stmt = _hide_personal_notifications(stmt, me)
    rows = list(db.scalars(stmt.order_by(Notification.notification_id.desc()).offset((page - 1) * size).limit(size)).all())
    return _mark_read_flags(db, rows, me)


def _visible_stmt(me: User, db: Session):
    """The same visibility rules as notification-history, without paging —
    shared by the unread count and mark-all-read so they can never drift."""
    stmt = select(Notification)
    role = me.role.name if me.role else None
    if role == ROLE_PATIENT:
        own = [p.patient_id for p in db.scalars(select(Patient).where(Patient.user_id == me.user_id)).all()]
        if not own:
            return None
        stmt = stmt.where(Notification.patient_id.in_(own), Notification.audience != "private")
    else:
        stmt = _scope_for_role(stmt, me, db)
    return _hide_personal_notifications(stmt, me)


@router.get("/notifications/unread-count")
def unread_count(me: User = Depends(require_permission("notification", "read")), db: Session = Depends(get_db)):
    """Badge count for the bell — visible notifications this user hasn't read."""
    stmt = _visible_stmt(me, db)
    if stmt is None:
        return {"unread": 0}
    read_ids = select(NotificationRead.notification_id).where(NotificationRead.user_id == me.user_id)
    n = db.scalar(
        select(func.count()).select_from(
            stmt.where(Notification.notification_id.not_in(read_ids)).subquery()
        )
    )
    return {"unread": int(n or 0)}


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: UUID,
    me: User = Depends(require_permission("notification", "read")),
    db: Session = Depends(get_db),
):
    """Mark one notification read for the calling user. Idempotent."""
    stmt = _visible_stmt(me, db)
    if stmt is None or not db.scalar(stmt.where(Notification.notification_id == notification_id).limit(1)):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    already = db.scalar(
        select(NotificationRead).where(
            NotificationRead.notification_id == notification_id,
            NotificationRead.user_id == me.user_id,
        )
    )
    if not already:
        db.add(NotificationRead(notification_id=notification_id, user_id=me.user_id))
        db.commit()
    return {"notification_id": notification_id, "is_read": True}


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    me: User = Depends(require_permission("notification", "read")),
    db: Session = Depends(get_db),
):
    """Mark every notification currently visible to this user as read."""
    stmt = _visible_stmt(me, db)
    if stmt is None:
        return {"marked": 0}
    read_ids = select(NotificationRead.notification_id).where(NotificationRead.user_id == me.user_id)
    # Select the id FROM the subquery — using select(Notification.notification_id)
    # with select_from(subquery) cross-joins the table against itself.
    sub = stmt.where(Notification.notification_id.not_in(read_ids)).subquery()
    unread = list(db.scalars(select(sub.c.notification_id)).all())
    for nid in unread:
        db.add(NotificationRead(notification_id=nid, user_id=me.user_id))
    db.commit()
    return {"marked": len(unread)}


@router.get("/notifications/{notification_id}", response_model=NotificationOut)
def get_notification(notification_id: UUID, me: User = Depends(require_permission("notification", "read")), db: Session = Depends(get_db)):
    stmt = _visible_stmt(me, db)
    n = db.scalar(stmt.where(Notification.notification_id == notification_id).limit(1)) if stmt is not None else None
    if not n:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return _mark_read_flags(db, [n], me)[0]


@router.get("/sms-logs", response_model=list[SmsLogOut])
def sms_logs(status_filter: str | None = Query(None, alias="status"), me: User = Depends(require_staff), db: Session = Depends(get_db)):
    stmt = select(SmsLog).join(Notification, Notification.notification_id == SmsLog.notification_id)
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(Notification.hospital_id == me.hospital_id)
    if status_filter:
        stmt = stmt.where(SmsLog.status == status_filter)
    stmt = _hide_personal_notifications(stmt, me)
    return db.scalars(stmt.order_by(SmsLog.sms_id.desc())).all()


@router.get("/whatsapp-logs", response_model=list[WhatsappLogOut])
def whatsapp_logs(me: User = Depends(require_staff), db: Session = Depends(get_db)):
    stmt = select(WhatsappLog).join(Notification, Notification.notification_id == WhatsappLog.notification_id)
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(Notification.hospital_id == me.hospital_id)
    stmt = _hide_personal_notifications(stmt, me)
    return db.scalars(stmt.order_by(WhatsappLog.wa_id.desc())).all()


@router.get("/email-logs", response_model=list[EmailLogOut])
def email_logs(me: User = Depends(require_staff), db: Session = Depends(get_db)):
    stmt = select(EmailLog).join(Notification, Notification.notification_id == EmailLog.notification_id)
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(Notification.hospital_id == me.hospital_id)
    stmt = _hide_personal_notifications(stmt, me)
    return db.scalars(stmt.order_by(EmailLog.email_id.desc())).all()


@router.get("/notification-stats")
def notification_stats(hospital_id: UUID | None = Query(None), me: User = Depends(require_permission("notification", "read")), db: Session = Depends(get_db)):
    stmt = select(Notification.channel, Notification.status, func.count(Notification.notification_id))
    if not (me.role and me.role.name == "SUPER_ADMIN"):
        stmt = stmt.where(Notification.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(Notification.hospital_id == hospital_id)
    stmt = _hide_personal_notifications(stmt, me)
    rows = db.execute(stmt.group_by(Notification.channel, Notification.status)).all()
    by_channel: dict = {}
    total = 0
    for channel, st, cnt in rows:
        by_channel.setdefault(channel, {})[st] = cnt
        total += cnt
    return {"total": total, "by_channel": by_channel}


@router.get("/notification-templates")
def notification_templates(me: User = Depends(require_permission("notification", "read"))):
    return {"templates": notify.TEMPLATES}


# ===================================================== Config / test =======
@router.post("/notification-settings")
def notification_settings(body: NotificationSettings, me: User = Depends(require_permission("notification", "create")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, body.hospital_id)
    h = db.get(Hospital, body.hospital_id)
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    if not h.settings:
        h.settings = HospitalSettings(hospital_id=body.hospital_id)
        db.flush()
    if body.sms_enabled is not None:
        h.settings.sms_enabled = body.sms_enabled
    if body.whatsapp_enabled is not None:
        h.settings.whatsapp_enabled = body.whatsapp_enabled
    db.commit()
    return {"hospital_id": body.hospital_id, "sms_enabled": h.settings.sms_enabled, "whatsapp_enabled": h.settings.whatsapp_enabled}


@router.post("/notification-test")
def notification_test(body: NotificationTest, me: User = Depends(require_permission("notification", "create")), db: Session = Depends(get_db)):
    hid = me.hospital_id
    if body.channel == "sms":
        n = notify.send_sms(db, body.phone or "9999999999", "Test SMS from TapCure", ntype="general", hospital_id=hid)
    elif body.channel == "whatsapp":
        n = notify.send_whatsapp(
            db, body.phone or "9999999999", "Test WhatsApp OTP 123456 from TapCure",
            ntype="otp", title="Test WhatsApp", template_name=settings.whatsapp_otp_template,
            otp_code="123456", language_code="en_US", hospital_id=hid,
        )
    elif body.channel == "email":
        n = notify.send_email(db, body.email or "test@example.com", "Test", "Test email from TapCure", hospital_id=hid)
    else:
        n = notify.send_push(db, "test-device", "Test", "Test push from TapCure", hospital_id=hid)
    db.commit()
    return {"ok": True, "channel": body.channel, "notification_id": n.notification_id, "status": n.status}
