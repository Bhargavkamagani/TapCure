"""
Notification dispatcher — MOCK provider (Phase 5).

Creates the logical Notification + the per-channel delivery log and walks them
through a realistic status lifecycle, but the actual provider call is simulated
(no MSG91/Twilio/SES network call). Each `send_*` returns the Notification row.

To go live later, replace the `_provider_send` stubs with real SDK calls — the
DB writes, status handling and public API stay identical.
"""
from uuid import UUID
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import utcnow
from ..models import (
    Appointment, EmailLog, FamilyMember, Notification, Patient,
    PushNotification, SmsLog, User, WhatsappLog,
)
from ..config import settings
from . import mailer
from . import notification_events
from . import whatsapp_client
from . import whatsapp_templates


def reminder_phone_for_token(db: Session, token) -> str | None:
    """Recipient for a token's alerts.

    A token points at the appointment it was issued for, and that appointment
    knows whether the visit is for a dependent — so a member who opted into
    their own reminders gets the alert on their own number.
    """
    patient = db.get(Patient, token.patient_id) if token.patient_id else None
    member = None
    if getattr(token, "appointment_id", None):
        appt = db.get(Appointment, token.appointment_id)
        if appt and appt.family_member_id:
            member = db.get(FamilyMember, appt.family_member_id)
    return reminder_phone(patient, member, db)


def reminder_phone(patient, member=None, db: Session | None = None) -> str | None:
    """The number a reminder for this person should go to.

    A dependent can opt to receive their own reminders (`notify_to='own'`) on
    their own `phone`; otherwise everything falls back to the account holder's
    number. This is the single resolver — every send (token alerts, doctor
    delays, medicine reminders) must go through it so the rule stays in one place.
    """
    if member is not None and getattr(member, "notify_to", "account") == "own":
        # (see reminder_recipient below when you need to know WHOSE number won)
        # A dependent with their own confirmed account is a reference, not a
        # copy: read their live number so it can never go stale behind a phone
        # change made on the other account. `db` is optional so the existing
        # callers that have no session keep working off the stored value.
        if db is not None and getattr(member, "link_status", "none") == "linked" and member.linked_user_id:
            owner = db.get(User, member.linked_user_id)
            live = (getattr(owner, "phone", None) or "").strip()
            if live:
                return live
        phone = (member.phone or "").strip()
        if phone:
            return phone
    return (getattr(patient, "phone", None) or "").strip() or None


def reminder_recipient(patient, member=None, db: Session | None = None):
    """`(phone, to_member)` — the number a reminder goes to, and whether that
    number is the dependent's OWN rather than the account holder's.

    Anything that has to word a message differently depending on who is reading
    it must use this instead of re-deriving the rule. `reminder_phone` above is
    still the only place the choice is made; this just reports what it chose, so
    the two can never drift apart.

    Why it matters: the medicine reminder used to greet the dependent by name
    while landing on the account holder's phone, so a parent minding a child's
    course read "Hi Raju" on their own handset and had to work out each time
    that it was theirs to act on.

    A dependent whose saved number IS the account holder's counts as the account
    holder — the same handset is reading it either way.
    """
    phone = reminder_phone(patient, member, db)
    if phone is None or member is None:
        return phone, False
    account = (getattr(patient, "phone", None) or "").strip()
    return phone, phone != account


# Canned message templates exposed via GET /notification-templates.
TEMPLATES = [
    {"key": "booking", "channel": "sms", "title": "Appointment Confirmed",
     "body": "Hi {name}, your token {code} with Dr. {doctor} is confirmed for {date}."},
    {"key": "reminder", "channel": "sms", "title": "Appointment Reminder",
     "body": "Reminder: your appointment with Dr. {doctor} is today. Token {code}."},
    {"key": "delay", "channel": "sms", "title": "Doctor Delayed",
     "body": "Dr. {doctor} is running ~{minutes} min late. Your token {code} is still valid."},
    {"key": "recall", "channel": "sms", "title": "Your Turn",
     "body": "Token {code}: please proceed to {room}. Dr. {doctor} is ready."},
    {"key": "travel_alert", "channel": "sms", "title": "Time to Leave",
     "body": "Token {code}: ~{minutes} min to your turn. Please start for the hospital."},
    {"key": "cancel", "channel": "sms", "title": "Appointment Cancelled",
     "body": "Your appointment (token {code}) has been cancelled. {reason}"},
    {"key": "otp", "channel": "whatsapp", "title": "TapCure OTP",
     "body": "Template otp_04: OTP code in body and URL button."},
    {"key": "booking", "channel": "whatsapp", "title": "Appointment Confirmed",
     "body": "Template appointment_confirmation: name, date, time, doctor, token, location, directions."},
    {"key": "travel_alert", "channel": "whatsapp", "title": "Time to Leave",
     "body": "Template 03_leave_now_: name, doctor, expected time, token, destination."},
    {"key": "almost_turn", "channel": "whatsapp", "title": "Almost Your Turn",
     "body": "Template almost_your_turn_a: name, wait, ahead, token, doctor, hospital/room."},
    {"key": "consult_done", "channel": "whatsapp", "title": "Consultation Completed",
     "body": "Template consultation_complete: name, visit date, time, doctor, hospital, token."},
    {"key": "doctor_reg", "channel": "whatsapp", "title": "Registration Received",
     "body": "Template doctor_registration_received: doctor, reg no, practice, location, date."},
    {"key": "doctor_daily", "channel": "whatsapp", "title": "Today's Appointment Schedule",
     "body": "Template doctor_daily_bookings: doctor, count, date, first, last, hospital, location."},
    {"key": "doctor_day", "channel": "whatsapp", "title": "All Appointments Completed",
     "body": "Template doctor_day_complete: doctor, date, scheduled, completed, cancelled, hospital."},
    {"key": "reminder", "channel": "whatsapp", "title": "Medicine Reminder",
     "body": "Template tapcure_medicine_reminder: name, medicine (+dose), instruction."},
]


def sent_today(db: Session, user_id: UUID, ntype: str, on_date=None) -> bool:
    """Has this user already had a message of this kind today?

    The once-a-day guard for the two doctor-facing messages, kept on the
    notification log rather than a flag column so overlapping job runs, a
    restarted ticker and a manual re-run all converge on exactly one send —
    and so adding a third daily message needs no migration.

    Bounded by the UTC day. Both senders fire during hospital-local working hours,
    which sit inside the same UTC day for every timezone TapCure serves, and
    being generous by a few hours only ever suppresses a duplicate.
    """
    from datetime import date as date_cls
    from datetime import datetime, time, timedelta

    start = datetime.combine(on_date or date_cls.today(), time.min)
    return bool(db.scalar(
        select(Notification.notification_id).where(
            Notification.recipient_user_id == user_id,
            Notification.type == ntype,
            Notification.created_at >= start,
            Notification.created_at < start + timedelta(days=1),
        ).limit(1)
    ))


def _mock_id(channel: str) -> str:
    return f"mock_{channel}_{uuid4().hex[:16]}"


def _default_audience(ntype: str, patient_id, recipient_user_id) -> str:
    """Who a message is for, when the caller doesn't say.

    An OTP is an authentication credential — it belongs to nobody's feed, ever.
    Anything naming a patient is theirs. What's left is hospital-operational.
    """
    if ntype == "otp":
        return "private"
    if recipient_user_id is not None:
        return "staff"
    return "patient" if patient_id is not None else "hospital"


def _notification(db: Session, *, channel: str, ntype: str, title: str, message: str,
                  hospital_id=None, patient_id=None, appointment_id=None, token_id=None,
                  audience: str | None = None, recipient_user_id: UUID | None = None) -> Notification:
    audience = audience or _default_audience(ntype, patient_id, recipient_user_id)
    # Never persist a live OTP in a readable row: the notification feed is a
    # product surface, and a code sitting in it is a way into someone's account.
    stored_message = "OTP sent to the patient (code hidden)." if ntype == "otp" else message
    n = Notification(
        hospital_id=hospital_id, patient_id=patient_id, appointment_id=appointment_id,
        token_id=token_id, type=ntype, channel=channel, title=title, message=stored_message,
        audience=audience, recipient_user_id=recipient_user_id,
        status="sent", sent_at=utcnow(),
    )
    db.add(n)
    db.flush()
    return n


def send_in_app(db: Session, message: str, *, ntype: str = "general", title: str = "",
                **refs) -> Notification:
    """A notification the patient reads inside the app — no phone required.

    Distinct from SMS/WhatsApp on purpose: those need a working number and an
    outbound provider, and a walk-in often has neither. The in-app record always
    lands, and shows up in the patient's Notifications feed the moment they log
    in — including later, once a walk-in registers and claims their record.
    """
    n = _notification(db, channel="in_app", ntype=ntype, title=title, message=message,
                      audience="patient", **refs)
    n.delivered_at = utcnow()
    return n


def send_staff_in_app(db: Session, recipient_user_id: UUID, message: str, *, ntype: str = "general",
                      title: str = "", **refs) -> Notification:
    """An in-app message addressed to ONE staff login (e.g. a doctor).

    `send_in_app` is patient-facing and pins audience='patient'; this one lands
    only in the named user's feed, never the front desk's or a patient's.
    """
    n = _notification(db, channel="in_app", ntype=ntype, title=title, message=message,
                      audience="staff", recipient_user_id=recipient_user_id, **refs)
    n.delivered_at = utcnow()
    return n


def send_sms(db: Session, phone: str, message: str, *, ntype: str = "general", title: str = "",
             template_id: str | None = None, **refs) -> Notification:
    n = _notification(db, channel="sms", ntype=ntype, title=title, message=message, **refs)
    n.sms_log = SmsLog(
        phone=phone, provider="mock", provider_msg_id=_mock_id("sms"), template_id=template_id,
        message_text=message, status="delivered", cost=0.20, sent_at=utcnow(), delivered_at=utcnow(),
    )
    n.delivered_at = utcnow()
    return n


# Patient alerts that only plans with WhatsApp include (the pricing cards:
# Starter has none). OTPs and cancellations are not on this list — a patient
# must always be able to sign in and must always hear that a visit is off.
PLAN_ALERT_TYPES = {"booking", "almost_turn", "travel_alert", "consult_done", "rx_ready", "reminder"}


def send_whatsapp(db: Session, phone: str, message: str, *, ntype: str = "general", title: str = "",
                  template_name: str | None = None, template_params: list[str] | None = None,
                  otp_code: str | None = None, language_code: str | None = None,
                  event_type: str | None = None,
                  **refs) -> Notification:
    n = _notification(db, channel="whatsapp", ntype=ntype, title=title, message=message, **refs)

    if ntype in PLAN_ALERT_TYPES and not otp_code:
        from . import booking_quota  # imports this module; lazy to avoid a cycle
        if not booking_quota.whatsapp_allowed(db, refs.get("hospital_id")):
            n.status = "skipped"  # not in this hospital's plan; nothing is sent or billed
            n.sent_at = None
            return n

    if notification_events.is_sqs_enabled():
        resolved_event_type = event_type or ("otp_login" if otp_code else "appointment_confirmed")
        if otp_code:
            payload = {"otp_code": str(otp_code)}
            template = template_name or settings.whatsapp_otp_template
        else:
            payload = {}
            template = template_name
            if resolved_event_type == whatsapp_templates.APPOINTMENT_CONFIRMED_EVENT:
                keys = whatsapp_templates.APPOINTMENT_CONFIRMED_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.APPOINTMENT_CANCELLED_EVENT:
                keys = whatsapp_templates.APPOINTMENT_CANCELLED_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.MEDICINE_REMINDER_EVENT:
                keys = whatsapp_templates.MEDICINE_REMINDER_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.LEAVE_NOW_EVENT:
                keys = whatsapp_templates.LEAVE_NOW_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.ALMOST_TURN_EVENT:
                keys = whatsapp_templates.ALMOST_TURN_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.CONSULTATION_COMPLETE_EVENT:
                keys = whatsapp_templates.CONSULTATION_COMPLETE_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.PRESCRIPTION_READY_EVENT:
                keys = whatsapp_templates.PRESCRIPTION_READY_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.DOCTOR_REGISTRATION_EVENT:
                keys = whatsapp_templates.DOCTOR_REGISTRATION_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.DOCTOR_DAILY_EVENT:
                keys = whatsapp_templates.DOCTOR_DAILY_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.PILOT_REMINDER_EVENT:
                keys = whatsapp_templates.PILOT_REMINDER_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            elif resolved_event_type == whatsapp_templates.DOCTOR_DAY_COMPLETE_EVENT:
                keys = whatsapp_templates.DOCTOR_DAY_COMPLETE_PAYLOAD_KEYS
                payload = {key: str(value) for key, value in zip(keys, template_params or [])}
            else:
                payload = {f"value{i + 1}": str(value) for i, value in enumerate(template_params or [])}
            # The Lambda sender has to know WHICH approved template to fill. It's
            # additive — a worker that only reads the named keys ignores it — and
            # it means a new template needs no Lambda release.
            if template:
                payload["template_name"] = template
        result = notification_events.publish_whatsapp_event(
            resolved_event_type, phone, payload,
            event_id=f"{resolved_event_type}-{n.notification_id}",
        )
        n.whatsapp_log = WhatsappLog(
            phone=phone, provider="lambda_sqs", provider_msg_id=result.provider_msg_id,
            template_name=template, status="queued" if result.ok else "failed",
            error_code=result.error_code, cost=0,
            sent_at=utcnow() if result.ok else None,
        )
        n.status = "pending" if result.ok else "failed"
        n.sent_at = None
        return n

    if whatsapp_client.is_enabled():
        template = template_name or (settings.whatsapp_otp_template if otp_code else None)
        if otp_code:
            result = whatsapp_client.send_otp(
                phone, otp_code, template_name=template, language_code=language_code or "en_US"
            )
        elif template:
            result = whatsapp_client.send_template(
                phone, template, template_params or [], language_code=language_code or settings.whatsapp_default_lang
            )
        else:
            result = whatsapp_client.WhatsappResult(
                False, status="failed", error_code="missing_template",
                error_message="template_name is required when WhatsApp provider is enabled",
            )
        if not result.ok:
            # The provider's own words — the only thing that distinguishes "wrong
            # template name" from "wrong parameter count" from "template not
            # approved in this language". WhatsappLog has an error_code column but
            # no error_message, so without this line the reason is discarded and
            # every failure looks identical in the database.
            print(f"[whatsapp] {template} -> {phone}: {result.error_code}: "
                  f"{result.error_message} | params={len(template_params or [])}")
        n.whatsapp_log = WhatsappLog(
            phone=phone, provider="dovesoft", provider_msg_id=result.provider_msg_id,
            template_name=template, status="sent" if result.ok else "failed",
            error_code=result.error_code, cost=0.35,
            sent_at=utcnow() if result.ok else None,
        )
        n.status = "sent" if result.ok else "failed"
        n.sent_at = utcnow() if result.ok else None
        return n
    n.whatsapp_log = WhatsappLog(
        phone=phone, provider="mock", provider_msg_id=_mock_id("wa"), template_name=template_name,
        status="delivered", cost=0.35, sent_at=utcnow(), delivered_at=utcnow(),
    )
    n.delivered_at = utcnow()
    return n


def send_email(db: Session, to_email: str, subject: str, body: str, *, ntype: str = "general",
               html: str | None = None, **refs) -> Notification:
    """Send a transactional email.

    Goes out over real SMTP when mail is enabled+configured (services/mailer);
    otherwise falls back to the no-network mock so dev/demo keeps working. The
    EmailLog + Notification status reflect the real delivery outcome either way.
    """
    n = _notification(db, channel="email", ntype=ntype, title=subject, message=body, **refs)

    if mailer.is_enabled():
        ok, msg_id, error = mailer.send(to_email, subject, body, html=html)
        n.email_log = EmailLog(
            to_email=to_email, subject=subject, provider=settings_mail_provider(),
            provider_msg_id=msg_id, status="sent" if ok else "failed",
            sent_at=utcnow() if ok else None,
        )
        if ok:
            n.status = "sent"
            n.sent_at = utcnow()
        else:
            n.status = "failed"
            print(f"[email] send to {to_email} failed: {error}")
        return n

    # Mock provider — DB-logged only, no network call.
    n.email_log = EmailLog(
        to_email=to_email, subject=subject, provider="mock", provider_msg_id=_mock_id("email"),
        status="sent", sent_at=utcnow(),
    )
    return n


def settings_mail_provider() -> str:
    from ..config import settings
    return settings.mail_provider or "smtp"


def send_push(db: Session, device_token: str, title: str, body: str, *, platform: str = "android",
              payload: dict | None = None, ntype: str = "general", **refs) -> Notification:
    n = _notification(db, channel="push", ntype=ntype, title=title, message=body, **refs)
    n.push_log = PushNotification(
        device_token=device_token, platform=platform, title=title, body=body,
        data_payload=payload, status="sent", sent_at=utcnow(),
    )
    return n
