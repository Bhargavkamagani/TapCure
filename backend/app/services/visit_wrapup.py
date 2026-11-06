"""One wrap-up message per visit — the prescription, or the plain acknowledgement.

A patient should hear exactly once that their visit is finished, and the useful
version of that message names the medicines they were given. The difficulty is
that the two facts arrive in either order: some doctors write the prescription
and then mark the consultation complete, others mark it complete first and write
the prescription afterwards from the "just finished" prompt.

So nothing sends while the doctor may still be writing. The message waits until
the doctor is demonstrably finished with that patient, which is one of two
things: they call their NEXT patient, or there is nobody else in their queue.

Holding until then is what makes ONE message enough. Sending at completion
looked right and was not: `POST /prescriptions/{id}/items` deliberately lets a
doctor append to the same prescription for 12 hours, so a doctor who completes
the visit and then adds a tablet would have had the message already gone,
listing a medicine list that was no longer true. The patient would never hear
about the added tablet — and a missing medicine is a safety problem, not an
inconvenience.

That needs no timer and no scheduled job, which matters: nothing is scheduled in
this deployment (`reminder_ticker_enabled` and `doctor_digest_ticker_enabled`
both default to False), and a design resting on a cron nobody runs would deliver
silence. This codebase has already paid for that mistake twice (see the delivery
table in `docs/whatsapp-templates.md` §2).

A consultation that never gets a prescription still has to end somewhere, so the
same "doctor has moved on" signal releases the plain `consultation_complete`
message instead.

Two gaps, accepted deliberately, both confined to the LAST patient in a queue:

  - With no prescription and no following patient, the plain acknowledgement
    never fires. Nothing was prescribed, so it is the mildest thing to lose.
  - With a prescription, the message goes at completion — nobody is left to wait
    for — so a tablet appended after that is not in it. That is the very
    staleness this design prevents everywhere else, reduced from every patient
    to one per queue.

Closing either means a cron or a sweep on a polled endpoint. Left out on purpose.
"""
from __future__ import annotations
from uuid import UUID

import logging
from datetime import date as date_cls
from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Doctor, FamilyMember, Notification, Patient, Prescription, Token
from . import notifications as notify
from . import reminder_engine
from . import whatsapp_templates as wa

logger = logging.getLogger(__name__)

# The two ways a visit can be wrapped up. Either one having been sent means the
# patient has already been told, so the other must not follow it.
RX_READY = "rx_ready"
CONSULT_DONE = "consult_done"
_WRAP_TYPES = (RX_READY, CONSULT_DONE)

# How far back `flush_previous` looks. In practice only the immediately preceding
# completion is ever waiting, but a doctor who completes two patients before
# calling the next one would strand the earlier of them. Five is generous and
# keeps the per-click query count bounded.
_FLUSH_LOOKBACK = 5


def _token_for(db: Session, rx: Prescription) -> Optional[Token]:
    """The queue token for the visit this prescription belongs to, if any.

    `Prescription.appointment_id` is nullable — a prescription written outside a
    booked visit has no token, and therefore no completion event will ever
    arrive for it.
    """
    if not rx.appointment_id:
        return None
    return db.scalar(
        select(Token)
        .where(Token.appointment_id == rx.appointment_id)
        .order_by(Token.token_id.desc())
        .limit(1)
    )


def _rx_for(db: Session, token: Token) -> Optional[Prescription]:
    """The prescription written at this visit, if the doctor has written one."""
    if not token.appointment_id:
        return None
    return db.scalar(
        select(Prescription)
        .where(Prescription.appointment_id == token.appointment_id)
        .order_by(Prescription.created_at.desc())
        .limit(1)
    )


def _doctor_still_busy(db: Session, token: Token) -> bool:
    """Is anyone else in this doctor's queue right now?

    While someone is, the doctor has not finished with the patient who just
    left: they may still append to that prescription. The message therefore
    waits for `flush_previous`, which runs when they call the next patient.

    Same shape as the queue-empty test documented on
    `token_engine._legacy_send_day_complete_unused` — scoped to doctor, date and
    venue, counting only `waiting`/`current`, because a token that ended missed
    or cancelled is done with. Written here rather than reused because
    `maybe_send_day_complete` is retired and returns False without looking.
    """
    return bool(db.scalar(
        select(func.count(Token.token_id)).where(
            Token.doctor_id == token.doctor_id,
            Token.token_date == token.token_date,
            Token.affiliation_id.is_(None) if token.affiliation_id is None
            else Token.affiliation_id == token.affiliation_id,
            Token.status.in_(("waiting", "current")),
            Token.token_id != token.token_id,
        )
    ) or 0)


def _already_wrapped(db: Session, *, token: Optional[Token] = None,
                     rx: Optional[Prescription] = None) -> bool:
    """Has this visit already had its one message?

    Matched on token OR appointment id rather than one of them, because the two
    senders file their rows differently: the existing `consultation_complete`
    path records a `token_id` and no appointment, while this module records
    both. Checking a single key would let one sender's row hide from the other
    and the patient would get two messages.

    A prescription with neither (no booked visit) falls back to patient-and-day,
    which is the only handle left.
    """
    keys = []
    appointment_id = (token.appointment_id if token is not None else None) \
        or (rx.appointment_id if rx is not None else None)
    if token is not None:
        keys.append(Notification.token_id == token.token_id)
    if appointment_id:
        keys.append(Notification.appointment_id == appointment_id)

    stmt = select(Notification.notification_id).where(Notification.type.in_(_WRAP_TYPES))
    if keys:
        stmt = stmt.where(or_(*keys))
    elif rx is not None:
        stmt = stmt.where(
            Notification.patient_id == rx.patient_id,
            func.date(Notification.created_at) == rx.created_at.date(),
        )
    else:
        return False
    return bool(db.scalar(stmt.limit(1)))


def _send_rx_ready(db: Session, rx: Prescription, token: Optional[Token] = None) -> bool:
    """Send the medicine message, falling back to `consultation_complete`.

    Returns whether the patient was told anything at all — by either template.
    """
    patient = db.get(Patient, rx.patient_id)
    if patient is None:
        return False
    member = db.get(FamilyMember, rx.family_member_id) if rx.family_member_id else None

    # Same rule the dose reminders use: the greeting follows the HANDSET and the
    # possessive names the patient, so a parent reading their child's
    # prescription sees "Hi Satya ... Raju's prescription" rather than being
    # addressed as the child.
    phone, to_member = notify.reminder_recipient(patient, member, db)
    if not phone:
        return False
    who, whose = reminder_engine.greeting_for(patient, member, to_member)

    doctor = db.get(Doctor, rx.doctor_id)
    visit_date: date_cls = token.token_date if token is not None else rx.created_at.date()
    params = wa.prescription_ready_params(
        who, whose, doctor.name if doctor else "",
        wa.medicine_summary(rx.items), visit_date.strftime("%d %b %Y"),
    )
    n = notify.send_whatsapp(
        db, phone,
        # Human-readable copy for the in-app record; WhatsApp itself delivers the
        # approved template filled with `params`, never this text.
        f"Hello {params[0]}, {params[1][:1].lower()}{params[1][1:]} prescription from "
        f"Dr. {params[2]} is ready. Medicines: {params[3]}. Details are in the TapCure app.",
        ntype=RX_READY, title="Prescription Ready",
        template_name=wa.prescription_ready_name(), template_params=params,
        language_code=settings.whatsapp_default_lang,
        event_type=wa.PRESCRIPTION_READY_EVENT,
        hospital_id=rx.hospital_id, patient_id=rx.patient_id,
        appointment_id=rx.appointment_id,
        token_id=token.token_id if token is not None else None,
    )
    if n.status != "failed":
        return True

    # A template not yet approved — or renamed, rejected, or approved in a
    # different language — fails at the provider without anyone being told. That
    # exact failure has already shipped here twice: 61 booking confirmations
    # logged as `sent` and none delivered, unnoticed for three weeks
    # (docs/whatsapp-templates.md §2).
    #
    # `consultation_complete` IS approved, so falling back to it means the
    # patient hears something rather than nothing while this template waits for
    # approval. Once approved, this branch simply stops being reached.
    logger.warning(
        "prescription-ready send failed for Rx %s (%s) — falling back to consultation_complete",
        rx.prescription_id,
        n.whatsapp_log.error_code if n.whatsapp_log else "unknown",
    )
    if token is None:
        # No booked visit, so there is no consultation_complete to fall back to.
        return False
    from .token_engine import maybe_send_consultation_complete
    return maybe_send_consultation_complete(db, token)


def on_prescription_saved(db: Session, rx: Prescription) -> bool:
    """The doctor has written (or added to) the prescription.

    Sends only when the visit is complete AND the doctor has nobody else queued
    — otherwise the message waits for `flush_previous`, so a further tablet
    added a minute later is still included in the one message the patient gets.

    A prescription with no token at all (written outside a booked visit) has no
    completion event coming and no queue to wait on, so it sends immediately.
    """
    token = _token_for(db, rx)
    if token is not None and token.status != "completed":
        return False
    if _already_wrapped(db, token=token, rx=rx):
        return False
    if token is not None and _doctor_still_busy(db, token):
        return False
    return _send_rx_ready(db, rx, token)


def on_consultation_complete(db: Session, token: Token) -> bool:
    """The visit is finished.

    Normally sends nothing: the doctor may still write or append to the
    prescription, and `flush_previous` releases the message once they call their
    next patient. The exception is the last patient in the queue, where no such
    signal is coming — then the prescription, if there is one, goes now.
    """
    if _already_wrapped(db, token=token):
        return False
    rx = _rx_for(db, token)
    if rx is None:
        return False
    if _doctor_still_busy(db, token):
        return False
    return _send_rx_ready(db, rx, token)


def flush_previous(db: Session, doctor_id: UUID, token_date: date_cls,
                   except_token_id: Optional[UUID] = None) -> int:
    """Stop waiting: the doctor has moved on to their next patient.

    Any of this doctor's completed visits today that are still unwrapped get
    their message now — the prescription version if one was written in the
    meantime, the plain acknowledgement otherwise.

    Never raises. A wrap-up message must not be able to stop a doctor calling
    their next patient.
    """
    from .token_engine import maybe_send_consultation_complete

    sent = 0
    try:
        rows = db.scalars(
            select(Token)
            .where(
                Token.doctor_id == doctor_id,
                Token.token_date == token_date,
                Token.status == "completed",
                Token.token_id != (except_token_id or -1),
            )
            .order_by(Token.actual_end.desc().nullslast())
            .limit(_FLUSH_LOOKBACK)
        ).all()
        for tk in rows:
            if _already_wrapped(db, token=tk):
                continue
            rx = _rx_for(db, tk)
            ok = _send_rx_ready(db, rx, tk) if rx is not None \
                else maybe_send_consultation_complete(db, tk)
            if ok:
                sent += 1
    except Exception:  # noqa: BLE001 - never break the queue over a message
        logger.exception("Could not flush visit wrap-ups for doctor %s", doctor_id)
    return sent
