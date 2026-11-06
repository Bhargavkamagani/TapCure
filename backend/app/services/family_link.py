"""Consent-gated link between a family-member entry and that person's own login.

Two records can describe the same human without the system knowing it: a
`family_members` row someone typed into their own record, and a `users` +
`patients` pair that person later created for themselves. Appointments booked
*for* the dependent hang off the account holder's patient record, so the
dependent signs in and sees none of their own visits.

Linking fixes that, but it is never inferred. A matching phone number is
evidence, not proof — numbers are recycled and mistyped, and the two possible
mistakes are wildly lopsided: failing to link costs a split history, while
linking the wrong people exposes a family's medical records to a stranger. So
both sides confirm, and the request always starts with the account holder, who
already knows who their dependent is. Asking the newcomer first would instead
tell whoever now holds that number about the holder's family.

    none ──registration match──> pending_holder ──holder approves──> pending_member
                                       │                                   │
                                       │ holder declines                   │ member accepts
                                       ▼                                   ▼
                                   declined                             linked
"""
from __future__ import annotations
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import FamilyMember, Patient, User
from . import notifications as notify

STATUS_NONE = "none"
STATUS_PENDING_HOLDER = "pending_holder"
STATUS_PENDING_MEMBER = "pending_member"
STATUS_LINKED = "linked"
STATUS_DECLINED = "declined"

# `notify_to` is NOT the test for whose number this is. It only decides where
# reminders are sent — every family entry in practice carries the dependent's
# own number while leaving notify_to at its 'account' default. Gating on 'own'
# meant real family lists never matched at all. What actually disqualifies a
# row is the number being the HOLDER's own line, which `_is_holders_own_line`
# checks directly.


def _holder_of(db: Session, member: FamilyMember) -> User | None:
    patient = db.get(Patient, member.patient_id)
    return db.get(User, patient.user_id) if patient and patient.user_id else None


def detect_on_register(db: Session, user: User, phone: str) -> list[FamilyMember]:
    """Raise a pending request for each family entry that matches a new account.

    Called after a registration succeeds. Nothing is disclosed to the new user
    and nothing is linked — this only puts the question in front of the account
    holder. Returns the rows moved to `pending_holder`, for logging/tests.
    """
    cleaned = (phone or "").strip()
    if not cleaned or not user:
        return []
    rows = _match_rows(db, cleaned)
    raised: list[FamilyMember] = []
    for member in rows:
        holder = _holder_of(db, member)
        if not holder or holder.user_id == user.user_id:
            continue  # an orphaned entry, or the holder registering themselves
        if _is_holders_own_line(db, member):
            continue
        member.linked_user_id = user.user_id
        member.link_status = STATUS_PENDING_HOLDER
        # The holder is named the dependent, so naming them back reveals
        # nothing they did not already write down.
        notify.send_in_app(
            db,
            f"Someone just registered with the number you saved for {member.name}. "
            f"Link the account so they can see the visits you book for them?",
            ntype="general", title="Family member registered",
            patient_id=member.patient_id,
        )
        raised.append(member)
    return raised


def _require(db: Session, member_id: UUID, *, expect: str) -> FamilyMember:
    from fastapi import HTTPException, status

    member = db.get(FamilyMember, member_id)
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family member not found")
    if member.link_status != expect:
        raise HTTPException(status.HTTP_409_CONFLICT, "This link request is no longer pending")
    return member


def approve_by_holder(db: Session, member_id: UUID, me: User) -> FamilyMember:
    """Holder confirms the newcomer really is their dependent."""
    from fastapi import HTTPException, status

    member = _require(db, member_id, expect=STATUS_PENDING_HOLDER)
    holder = _holder_of(db, member)
    if not holder or holder.user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your family member")
    member.link_status = STATUS_PENDING_MEMBER
    # Only now does the dependent hear about it, and only enough to decide.
    linked = db.get(User, member.linked_user_id)
    if linked:
        for row in db.scalars(select(Patient).where(Patient.user_id == linked.user_id)):
            notify.send_in_app(
                db,
                f"{holder.name} would like to share the appointments they book for you "
                f"with your account. Accept?",
                ntype="general", title="Share appointment history?",
                patient_id=row.patient_id,
            )
            break
    return member


def decline_by_holder(db: Session, member_id: UUID, me: User) -> FamilyMember:
    """Holder says it is not their dependent — a typo, or a recycled number."""
    from fastapi import HTTPException, status

    member = _require(db, member_id, expect=STATUS_PENDING_HOLDER)
    holder = _holder_of(db, member)
    if not holder or holder.user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your family member")
    member.linked_user_id = None
    member.link_status = STATUS_DECLINED
    return member


def accept_by_member(db: Session, member_id: UUID, me: User) -> FamilyMember:
    from fastapi import HTTPException, status

    member = _require(db, member_id, expect=STATUS_PENDING_MEMBER)
    if member.linked_user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your invitation")
    member.link_status = STATUS_LINKED
    return member


def reject_by_member(db: Session, member_id: UUID, me: User) -> FamilyMember:
    from fastapi import HTTPException, status

    member = _require(db, member_id, expect=STATUS_PENDING_MEMBER)
    if member.linked_user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your invitation")
    member.linked_user_id = None
    member.link_status = STATUS_DECLINED
    return member


def attach_holder_names(db: Session, members: list[FamilyMember]) -> list[FamilyMember]:
    """Tag each entry with the account holder's name.

    An invitation reads "<X> has listed you as family" — X is the holder, and
    the row itself only knows the *dependent's* name, so without this the
    message names the wrong person.
    """
    for member in members:
        holder = _holder_of(db, member)
        member.holder_name = holder.name if holder else None
    return members


def visible_condition(db: Session, user: User, model, own_patient_ids):
    """Rows this account may read: its own patients', plus any tagged to a
    family entry it has been confirmed to be.

    Every clinical table that can belong to a dependent carries both
    `patient_id` and `family_member_id`, so one condition covers them all. A
    row the holder recorded for themselves has `family_member_id` NULL, and
    NULL never matches an IN list — so widening the read can never expose the
    account holder's own history to a dependent.
    """
    from sqlalchemy import or_

    cond = model.patient_id.in_(own_patient_ids)
    ids = linked_member_ids(db, user)
    if ids:
        cond = or_(cond, model.family_member_id.in_(ids))
    return cond


def linked_member_ids(db: Session, user: User) -> list[int]:
    """Family entries this account has been confirmed to be."""
    if not user:
        return []
    return list(db.scalars(
        select(FamilyMember.member_id).where(
            FamilyMember.linked_user_id == user.user_id,
            FamilyMember.link_status == STATUS_LINKED,
        )
    ).all())


def _is_holders_own_line(db: Session, member: FamilyMember) -> bool:
    """True when the number on the entry is the account's own, not the dependent's.

    People do put their own number on a dependent who has no phone. Linking on
    that would attach the holder to their own family entry, so it is skipped.
    """
    patient = db.get(Patient, member.patient_id)
    return bool(patient and (patient.phone or "").strip() == (member.phone or "").strip())


def _match_rows(db: Session, phone: str) -> list[FamilyMember]:
    """Unlinked, active family entries carrying this number."""
    return list(db.scalars(
        select(FamilyMember).where(
            FamilyMember.phone == phone,
            FamilyMember.is_active.is_(True),
            FamilyMember.linked_user_id.is_(None),
            FamilyMember.link_status.in_((STATUS_NONE, STATUS_DECLINED)),
        )
    ).all())


def invitable_members(db: Session, holder: User) -> list[FamilyMember]:
    """My family entries whose number already belongs to an existing account.

    `detect_on_register` only fires the moment someone signs up, so it can never
    help a dependent who already had an account before they were listed — which
    is most of them. This is the other direction: the holder sees who can be
    invited and starts it themselves.
    """
    out: list[FamilyMember] = []
    rows = db.scalars(
        select(FamilyMember)
        .join(Patient, Patient.patient_id == FamilyMember.patient_id)
        .where(Patient.user_id == holder.user_id,
               FamilyMember.is_active.is_(True),
               FamilyMember.linked_user_id.is_(None),
               FamilyMember.link_status.in_((STATUS_NONE, STATUS_DECLINED)))
    ).all()
    for member in rows:
        phone = (member.phone or "").strip()
        if not phone or _is_holders_own_line(db, member):
            continue
        owner = db.scalars(select(User).where(User.phone == phone).limit(1)).first()
        if owner and owner.user_id != holder.user_id:
            out.append(member)
    return out


def invite_by_holder(db: Session, member_id: UUID, me: User) -> FamilyMember:
    """Holder invites a dependent who already has an account.

    Goes straight to `pending_member`: the holder starting it IS their half of
    the consent, so only the dependent still has to agree.
    """
    from fastapi import HTTPException, status

    member = db.get(FamilyMember, member_id)
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Family member not found")
    holder = _holder_of(db, member)
    if not holder or holder.user_id != me.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your family member")
    if member.link_status not in (STATUS_NONE, STATUS_DECLINED):
        raise HTTPException(status.HTTP_409_CONFLICT, "This member already has a link in progress")
    phone = (member.phone or "").strip()
    owner = db.scalars(select(User).where(User.phone == phone).limit(1)).first() if phone else None
    if not owner or owner.user_id == me.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No account is registered on that number")
    member.linked_user_id = owner.user_id
    member.link_status = STATUS_PENDING_MEMBER
    for row in db.scalars(select(Patient).where(Patient.user_id == owner.user_id)):
        notify.send_in_app(
            db,
            f"{holder.name} has listed you as family and would like their bookings "
            f"for you to appear in your account. Accept?",
            ntype="general", title="Family link request",
            patient_id=row.patient_id,
        )
        break
    return member
