"""What happens to booked patients when a doctor's session is removed.

Deleting a weekly session used to be a bare `db.delete(...)`: the recurring slot
vanished while every appointment already booked into it stayed `scheduled`, with
a live queue token and a leave-by time telling the patient when to set off. They
travelled to a hospital where no session existed and nobody had told them.

Policy, decided with the hospital:

* **Future dates are cancelled automatically.** The doctor is not available;
  leaving the booking alive is a lie the patient acts on.
* **Today is never touched automatically** — patients may already be sitting in
  the waiting room with tokens. Those are reported so a human deals with them at
  the desk, where the doctor is standing anyway.
* **Anyone who paid the online booking fee gets one free rebooking.** There is no
  automated refund in this app, and promising money that no code pays back is
  worse than saying nothing. The credit is recorded on the cancellation log and
  spent once, and the notification states it plainly.
"""
from __future__ import annotations
from uuid import UUID

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import utcnow
from ..models import (
    Appointment, ApptCancellationLog, ApptStatusHistory, Doctor, DoctorSchedule,
    FamilyMember, FollowUp, Patient, Token,
)
from . import notifications as notify
from . import whatsapp_templates

# Statuses still "live" — anything else is already dealt with and must not be
# reopened or re-cancelled.
_ACTIVE = ("scheduled", "confirmed", "rescheduled")

_WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


def affected_appointments(db: Session, schedule: DoctorSchedule, on_or_after: date) -> list[Appointment]:
    """Live bookings that fall on this session, from `on_or_after` onwards.

    Matched on the weekday the session runs, the same practice, and — for slot
    bookings — a slot inside the session window. Token bookings have no slot, so
    the whole day counts: without the session there is no queue to join.
    """
    rows = db.scalars(
        select(Appointment).where(
            Appointment.doctor_id == schedule.doctor_id,
            Appointment.appointment_date >= on_or_after,
            Appointment.status.in_(_ACTIVE),
        )
    ).all()
    out = []
    for appt in rows:
        if _WEEKDAYS[appt.appointment_date.weekday()] != schedule.day_of_week:
            continue
        # A session belongs to one practice; a booking at the doctor's other
        # location is unaffected. `None` on either side is a legacy row.
        if schedule.affiliation_id and appt.affiliation_id and appt.affiliation_id != schedule.affiliation_id:
            continue
        if appt.slot_time and not (schedule.start_time <= appt.slot_time < schedule.end_time):
            continue
        if schedule.valid_from and appt.appointment_date < schedule.valid_from:
            continue
        if schedule.valid_until and appt.appointment_date > schedule.valid_until:
            continue
        out.append(appt)
    return out


def preview(db: Session, schedule: DoctorSchedule) -> dict:
    """Counts for the confirmation dialog — nothing is changed."""
    today = date.today()
    future = affected_appointments(db, schedule, today)
    todays = [a for a in future if a.appointment_date == today]
    later = [a for a in future if a.appointment_date > today]
    return {
        "today_count": len(todays),
        "future_count": len(later),
        "paid_count": sum(1 for a in future if float(a.booking_fee_paid or 0) > 0),
        "dates": sorted({a.appointment_date.isoformat() for a in future})[:10],
    }


def cancel_and_notify(db: Session, schedule: DoctorSchedule, by_user_id: UUID | None) -> dict:
    """Cancel every FUTURE booking on this session and tell each patient.

    Returns the same counts as `preview`, so the caller can report exactly what
    happened. Today's bookings are counted but deliberately left alone.
    """
    today = date.today()
    affected = affected_appointments(db, schedule, today)
    todays = sum(1 for a in affected if a.appointment_date == today)
    granted = _cancel_all(db, affected, by_user_id,
                          "The doctor's session for this day was removed")
    return {
        "cancelled": len(affected),
        "today_count": todays,
        "free_rebooks_granted": granted,
        "dates": sorted({a.appointment_date.isoformat() for a in affected}),
    }


def _cancel_one(db: Session, appt: Appointment, by_user_id: UUID | None, reason: str) -> bool:
    """Cancel one booking and tell the patient. Returns whether a credit was granted.

    Extracted so the session-delete and holiday paths cannot drift: every caller
    releases the token, reopens the follow-up, restores the revisit pass and
    notifies, or none of them do.

    An audit on 21 Sep 2026 found the original inline version missing four of
    those. Each is restored here with the reason it matters:

    * the token goes through `te.set_status`, not a bare assignment, so the
      cancellation appears in `TokenStatusHistory` — the audit trail was empty;
    * `presence.current_token_id` is cleared, or the doctor's console stays
      pinned to a patient who was just told not to come;
    * the queue is renumbered, or everyone behind the cancelled patient keeps a
      stale position and ETA — and those ETAs drive the leave-by alerts;
    * the revisit pass is restored, or a patient whose visit the HOSPITAL cancelled
      silently loses the free visit they had redeemed.
    """
    from . import revisit_pass as rp
    from . import token_engine as te

    paid = float(appt.booking_fee_paid or 0) > 0
    db.add(ApptCancellationLog(
        appointment_id=appt.appointment_id, cancelled_by=by_user_id,
        cancel_reason=reason,
        # No automated refund exists; the credit below is what the patient
        # actually gets, so don't raise a refund expectation nobody fulfils.
        refund_status="none", refund_amount=0,
        free_rebook_granted=paid,
    ))
    db.add(ApptStatusHistory(
        appointment_id=appt.appointment_id, old_status=appt.status,
        new_status="cancelled", changed_by=by_user_id, reason=reason,
    ))

    # Hand back a redeemed free-revisit pass BEFORE the status flips: the visit
    # is being cancelled by the hospital, so it must not cost the patient the pass.
    try:
        rp.restore(db, appt.appointment_id)
    except Exception:  # noqa: BLE001 - a perk must never block the cancellation
        pass

    appt.status = "cancelled"

    # Release the queue token, or the queue keeps a patient who was told not to
    # come and the numbering runs long.
    for tok in db.scalars(select(Token).where(Token.appointment_id == appt.appointment_id)).all():
        if tok.status not in ("waiting", "current"):
            continue
        te.set_status(db, tok, "cancelled", by_user_id, reason)
        te.log_movement(db, tok, "cancel", tok.queue_position, None, by_user_id, reason)
        tok.queue_position = 0
        doctor = db.get(Doctor, tok.doctor_id)
        if doctor and doctor.presence and doctor.presence.current_token_id == tok.token_id:
            doctor.presence.current_token_id = None
        db.flush()
        te.recompute_positions(db, tok.doctor_id, tok.token_date, tok.affiliation_id)

    # A visit that never happens can't close a follow-up. Left as "booked",
    # the patient silently drops off the follow-up list.
    for fu in db.scalars(select(FollowUp).where(FollowUp.booked_appointment_id == appt.appointment_id)).all():
        fu.status = "pending"
        fu.booked_appointment_id = None

    _notify(db, appt, paid, reason)
    return paid


def _cancel_all(db: Session, appts: list[Appointment], by_user_id: UUID | None, reason: str) -> int:
    """Cancel a batch, returning how many free rebookings were granted."""
    return sum(1 for appt in appts if _cancel_one(db, appt, by_user_id, reason))


def affected_on_date(db: Session, doctor_id: UUID, on_date: date,
                     affiliation_id: UUID | None = None) -> list[Appointment]:
    """Live bookings on ONE exact date, for the holiday path.

    `affected_appointments` matches a recurring session by WEEKDAY, which is
    right for deleting a Monday slot and wrong for "I am away on 22 Sep". This
    is the date-shaped equivalent.
    """
    stmt = select(Appointment).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == on_date,
        Appointment.status.in_(_ACTIVE),
    )
    rows = db.scalars(stmt).all()
    if affiliation_id:
        rows = [a for a in rows if a.affiliation_id in (None, affiliation_id)]
    return list(rows)


def preview_on_date(db: Session, doctor_id: UUID, on_date: date,
                    affiliation_id: UUID | None = None) -> dict:
    """Counts for the holiday confirmation dialog — nothing is changed."""
    affected = affected_on_date(db, doctor_id, on_date, affiliation_id)
    today = date.today()
    return {
        # `total` exists because today_count + future_count is NOT the whole set:
        # a back-dated holiday falls into neither bucket and read as zero, which
        # would skip the confirmation gate entirely. The two split counts are
        # kept because the dialog words them differently — "including N TODAY,
        # those patients may already be travelling".
        "total": len(affected),
        "today_count": sum(1 for a in affected if a.appointment_date == today),
        "future_count": sum(1 for a in affected if a.appointment_date > today),
        "paid_count": sum(1 for a in affected if float(a.booking_fee_paid or 0) > 0),
        "dates": sorted({a.appointment_date.isoformat() for a in affected})[:10],
    }


class _Shape:
    """A snapshot of a session's bookable shape, for comparing before/after.

    `edit_schedule` mutates the ORM row in place, so the OLD values are gone by
    the time anything can ask "who did that just strand?". This captures them
    first. Only the fields that decide whether a booking is still honourable
    live here — `max_tokens` and `consultation_mins` change capacity, not
    coverage, so an edit touching only those strands nobody.
    """

    __slots__ = ("day_of_week", "start_time", "end_time", "is_active", "valid_from", "valid_until",
                 "affiliation_id", "doctor_id")

    def __init__(self, sched: DoctorSchedule):
        for f in self.__slots__:
            setattr(self, f, getattr(sched, f))

    def covers(self, appt: Appointment) -> bool:
        """Could this shape still honour that booking?"""
        if not self.is_active:
            return False
        if _WEEKDAYS[appt.appointment_date.weekday()] != self.day_of_week:
            return False
        if self.affiliation_id and appt.affiliation_id and appt.affiliation_id != self.affiliation_id:
            return False
        if self.valid_from and appt.appointment_date < self.valid_from:
            return False
        if self.valid_until and appt.appointment_date > self.valid_until:
            return False
        # A token booking has no slot: it joins the day's queue, so it survives
        # any change that leaves a session on that day at all. Narrowing the
        # hours shortens the queue's window, it does not evict the patient.
        if appt.slot_time is None:
            return True
        return self.start_time <= appt.slot_time < self.end_time


def stranded_by_edit(db: Session, old: _Shape, new: DoctorSchedule) -> list[Appointment]:
    """Bookings the OLD session could honour and the NEW one cannot.

    The difference, not the whole set: widening 09:00-17:00 to 08:00-18:00
    strands nobody and must raise no dialog, while shrinking it to 09:00-12:00
    strands only the afternoon. Cancelling everyone on any edit would be no
    better than the delete it is meant to be gentler than.
    """
    today = date.today()
    live = db.scalars(
        select(Appointment).where(
            Appointment.doctor_id == old.doctor_id,
            Appointment.appointment_date >= today,
            Appointment.status.in_(_ACTIVE),
        )
    ).all()
    new_shape = _Shape(new)
    return [a for a in live if old.covers(a) and not new_shape.covers(a)]


def snapshot(sched: DoctorSchedule) -> _Shape:
    """Capture a session's shape BEFORE an edit mutates it."""
    return _Shape(sched)


def preview_edit(db: Session, old: _Shape, new: DoctorSchedule) -> dict:
    """Counts for the edit confirmation dialog — nothing is changed."""
    affected = stranded_by_edit(db, old, new)
    today = date.today()
    return {
        "total": len(affected),
        "today_count": sum(1 for a in affected if a.appointment_date == today),
        "future_count": sum(1 for a in affected if a.appointment_date > today),
        "paid_count": sum(1 for a in affected if float(a.booking_fee_paid or 0) > 0),
        "dates": sorted({a.appointment_date.isoformat() for a in affected})[:10],
        # True when the edit strands EVERYTHING the session could serve — i.e.
        # it is a deletion wearing different clothes (is_active=False, a past
        # valid_until, or moving the day). The dialog says so plainly.
        "is_effectively_delete": bool(affected) and not _Shape(new).is_active,
    }


def cancel_edit_and_notify(db: Session, old: _Shape, new: DoctorSchedule,
                           by_user_id: UUID | None) -> dict:
    """Cancel only the bookings an edit strands, and tell those patients."""
    affected = stranded_by_edit(db, old, new)
    granted = _cancel_all(db, affected, by_user_id,
                          "The doctor has changed their consulting hours for that day")
    return {
        "cancelled": len(affected),
        "today_count": sum(1 for a in affected if a.appointment_date == date.today()),
        "free_rebooks_granted": granted,
        "dates": sorted({a.appointment_date.isoformat() for a in affected}),
    }


def cancel_date_and_notify(db: Session, doctor_id: UUID, on_date: date, by_user_id: UUID | None,
                           affiliation_id: UUID | None = None) -> dict:
    """Cancel every booking on a day the doctor has marked as a holiday.

    Adding a holiday used to write one row and stop: the appointments stayed
    `confirmed`, their tokens stayed `waiting`, nobody was told, and the
    clock-driven leave-by sweep went on telling those patients to set off for a
    doctor who would not be there. Same outcome as deleting the session, through
    a different door.

    Unlike the session path this DOES include today, deliberately: a doctor
    marking today as a holiday is not coming today, and patients may already be
    travelling. Silence is the worst of the options.
    """
    affected = affected_on_date(db, doctor_id, on_date, affiliation_id)
    granted = _cancel_all(db, affected, by_user_id, "The doctor is on leave that day")
    return {
        "cancelled": len(affected),
        "today_count": sum(1 for a in affected if a.appointment_date == date.today()),
        "free_rebooks_granted": granted,
        "dates": sorted({a.appointment_date.isoformat() for a in affected}),
    }


def _place_name(db: Session, appt: Appointment) -> str:
    """The hospital as the patient knows it — the booked practice, else the
    hospital, else a safe generic."""
    from ..models import DoctorAffiliation, Hospital

    if appt.affiliation_id:
        aff = db.get(DoctorAffiliation, appt.affiliation_id)
        if aff and aff.name:
            return aff.name
    if appt.hospital_id:
        hospital = db.get(Hospital, appt.hospital_id)
        if hospital and hospital.name:
            return hospital.name
    return "the hospital"


def _notify(db: Session, appt: Appointment, paid: bool,
            reason: str = "The doctor is unexpectedly unavailable") -> None:
    """In-app always; WhatsApp when we have a number. In-app is the one that
    always lands — a walk-in may have no phone on file at all.

    `reason` is a parameter because the two callers mean different things by it.
    A deleted session genuinely is unexpected; a holiday was planned, and
    telling a patient their doctor is "unexpectedly unavailable" when the leave
    was booked weeks ago reads as a cover story. The default preserves the
    original wording for any caller that doesn't care.
    """
    when = appt.appointment_date.strftime("%d %b %Y")
    cause = (reason or "").strip().rstrip(".") or "The doctor is unexpectedly unavailable"
    # The cause stands as its OWN sentence rather than being spliced into a
    # fixed one. The old tail ("...and will not be visiting that day") only read
    # correctly when the cause was a person: a holiday became "the doctor is on
    # leave that day and will not be visiting that day", and a deleted session
    # became "the session was removed and will not be visiting that day".
    message = (
        f"Important: your appointment on {when} has been cancelled. {cause}. "
        f"Please do not travel to the hospital for this appointment. Sorry for the "
        f"inconvenience — please book another day or another available doctor."
    )
    if paid:
        # State the window and say plainly that it travels. This used to name
        # the granting hospital, because the credit was only good there and a
        # patient turning up elsewhere expecting a free visit became an argument
        # at the desk. The credit is now redeemable at any hospital with any
        # doctor, so the message says so rather than implying a restriction the
        # code no longer applies.
        message += (
            f" You paid a booking fee for this visit — your next booking is free "
            f"(within {CREDIT_VALID_DAYS} days), with any doctor at any TapCure "
            f"hospital. The booking fee will not be charged again."
        )
    notify.send_in_app(
        db, message, ntype="cancel", title="Appointment cancelled",
        patient_id=appt.patient_id, appointment_id=appt.appointment_id,
        hospital_id=appt.hospital_id,
    )
    patient = db.get(Patient, appt.patient_id) if appt.patient_id else None
    member = db.get(FamilyMember, appt.family_member_id) if appt.family_member_id else None
    phone = notify.reminder_phone(patient, member) if patient else None
    if phone:
        doctor = db.get(Doctor, appt.doctor_id)
        token = db.scalar(select(Token).where(Token.appointment_id == appt.appointment_id))
        who = (member.name if member else patient.name) or "Patient"
        doctor_name = doctor.name if doctor and doctor.name else "your doctor"
        reference = token.display_code if token and token.display_code else str(appt.appointment_id)
        # {{5}} carries the CAUSE only. The approved template's own next line
        # already says "Booking another day, or another doctor, takes just a
        # moment", so a reason ending in "book another day or doctor" printed
        # the same instruction twice in adjacent lines.
        # {{5}} of the approved template. Use the caller's reason, not a fixed
        # string: this line shadowed the parameter, so a holiday read correctly
        # in-app and still said "unexpectedly unavailable" on WhatsApp.
        reason = (reason or "").strip().rstrip(".") + "."
        # "Do not travel" is the sentence this whole message exists to deliver,
        # and the APPROVED template body does not contain it — docs §11 claimed
        # a "Please don't set out for this visit" line that was never in the
        # template Meta actually approved (confirmed against a message a real
        # patient received on 22 Sep 2026). So patients were told their visit
        # was off but never told to stay home, and some of these people plan an
        # overnight journey around the appointment.
        #
        # {{5}} is the only text we control without re-approval, so the warning
        # rides in the parameter. It goes to everyone, paid or not: a wasted
        # journey costs far more than a booking fee. Adding a line to the body
        # instead would mean re-submitting the template to Dovesoft.
        reason += " Please do not travel for this visit."
        if paid:
            # The credit is granted ONLY for a visit the patient paid for
            # (`_cancel_one` sets free_rebook_granted=paid), so only a paid
            # visit may be told about it — an unpaid patient promised a free
            # booking becomes an argument at the desk we would lose.
            #
            # The in-app message has always carried this; WhatsApp never did,
            # so the patients who reach us only by phone were granted a credit
            # nobody told them about. {{5}} is the sole variable left in the
            # approved template, which is why the good news rides along with
            # the cause instead of getting a line of its own. Changing this
            # text needs no re-approval; changing the body would.
            reason += (f" Your next booking is free — any doctor, any TapCure "
                       f"hospital, within {CREDIT_VALID_DAYS} days.")
        notify.send_whatsapp(
            db, phone, message, ntype="cancel",
            title="Appointment cancelled", patient_id=appt.patient_id,
            appointment_id=appt.appointment_id, hospital_id=appt.hospital_id,
            template_name=whatsapp_templates.appointment_cancelled_name(),
            # Built, not hand-assembled: the raw list skipped `clean_param`, so a
            # blank or overlong value would have been rejected by Meta and the
            # "do not travel" message lost entirely.
            template_params=whatsapp_templates.appointment_cancelled_params(
                who, reference, doctor_name, when, reason,
            ),
            event_type=whatsapp_templates.APPOINTMENT_CANCELLED_EVENT,
        )


# How long a free rebooking stays redeemable. Open-ended goodwill is a liability
# a hospital can't forecast — and a patient turning up two years later expecting a
# free visit is an argument at the desk, not a kindness.
CREDIT_VALID_DAYS = 90


def unused_credit(db: Session, patient_id: UUID, hospital_id: UUID | None = None) -> ApptCancellationLog | None:
    """An unspent, unexpired free-rebooking this patient holds, oldest first.

    Redeemable at ANY hospital, with ANY doctor — callers pass `hospital_id=None`.
    The argument is kept because the scoping logic is sound and the policy could
    change back, not because anything uses it today.

    It was originally hospital-scoped, on the reasoning that one hospital's
    cancellation must not come out of another hospital's takings. That holds for a
    platform of independent tenants; here every hospital belongs to the same
    business, so the money is the same money either way and the restriction only
    ever punished the patient — who was told to come back to the very hospital
    that let them down.
    """
    if not patient_id:
        return None
    stmt = (
        select(ApptCancellationLog)
        .join(Appointment, Appointment.appointment_id == ApptCancellationLog.appointment_id)
        .where(
            Appointment.patient_id == patient_id,
            ApptCancellationLog.free_rebook_granted.is_(True),
            ApptCancellationLog.free_rebook_used_at.is_(None),
            ApptCancellationLog.created_at >= utcnow() - timedelta(days=CREDIT_VALID_DAYS),
        )
        .order_by(ApptCancellationLog.created_at)
    )
    if hospital_id is not None:
        stmt = stmt.where(Appointment.hospital_id == hospital_id)
    return db.scalar(stmt)


def spend_credit(db: Session, patient_id: UUID, appointment_id: UUID, hospital_id: UUID | None = None) -> bool:
    """Mark the credit as used by this booking. Spent exactly once — the stamp
    is what stops a patient rebooking free forever."""
    credit = unused_credit(db, patient_id, hospital_id)
    if not credit:
        return False
    credit.free_rebook_used_at = utcnow()
    credit.free_rebook_used_appointment_id = appointment_id
    return True
