"""
Support enquiries — public submission + the Super-Admin inbox.

The Contact page form was previously a mock that discarded what people typed
while telling them it had been sent. Submissions now land in `support_requests`
FIRST, then we try to email the support address. Storing before notifying is
deliberate: mail is optional (and currently still going out from a personal
Gmail), so the database is the source of truth and the email is a convenience.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db, utcnow
from ..deps import require_role
from ..models import SupportRequest, User
from ..rbac import ROLE_SUPER_ADMIN
from ..services import attempts
from ..schemas.support import SupportContactIn, SupportRequestOut, SupportRequestUpdate
from ..services import notifications as notify

router = APIRouter(tags=["support"])


@router.post("/support/contact", response_model=SupportRequestOut, status_code=201)
def submit_support_request(body: SupportContactIn, request: Request, db: Session = Depends(get_db)):
    """Public — anyone on the Contact page can write in, logged in or not."""
    # Each submission sends a real email from the hospital's own SMTP account.
    # Unthrottled, a script turns that account into a spam source and gets the
    # sending domain blacklisted — which would also take the appointment mail
    # down with it.
    ip = request.client.host if request.client else ""
    attempts.check("contact", ip, attempts.CONTACT_FORM)
    attempts.record("contact", ip)
    req = SupportRequest(
        name=body.name.strip(),
        email=str(body.email).strip(),
        mobile=body.mobile.strip(),
        city=body.city.strip(),
        role=body.role.strip() or "Patient",
        message=body.message.strip(),
        status="new",
    )
    db.add(req)
    db.flush()   # need request_id for the email subject

    # Best effort: a mail failure must never lose the enquiry or 500 the form.
    to = (settings.support_email or settings.mail_from_email or "").strip()
    if to:
        try:
            n = notify.send_email(
                db,
                to,
                f"[TapCure Support] #{str(req.request_id)[-8:].upper()} — {req.role}: {req.name}",
                (
                    f"New support enquiry #{str(req.request_id)[-8:].upper()}\n\n"
                    f"Name    : {req.name}\n"
                    f"Email   : {req.email}\n"
                    f"Mobile  : {req.mobile or '-'}\n"
                    f"City    : {req.city or '-'}\n"
                    f"I am a  : {req.role}\n\n"
                    f"Message:\n{req.message}\n"
                ),
                ntype="general",
            )
            req.notified = n.status == "sent"
        except Exception as exc:                     # noqa: BLE001 - never block the user
            print(f"[support] enquiry {req.request_id} saved but email failed: {exc}")

    db.commit()
    db.refresh(req)
    return req


@router.get("/support/requests", response_model=list[SupportRequestOut])
def list_support_requests(
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_role(ROLE_SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    stmt = select(SupportRequest)
    if status_filter:
        stmt = stmt.where(SupportRequest.status == status_filter)
    stmt = stmt.order_by(SupportRequest.request_id.desc()).offset((page - 1) * size).limit(size)
    return db.scalars(stmt).all()


@router.get("/support/requests/count")
def open_support_count(
    me: User = Depends(require_role(ROLE_SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    """Badge count for the Super-Admin sidebar."""
    n = db.scalar(select(func.count()).select_from(SupportRequest).where(SupportRequest.status == "new"))
    return {"new": int(n or 0)}


@router.patch("/support/requests/{request_id}", response_model=SupportRequestOut)
def update_support_request(
    request_id: UUID,
    body: SupportRequestUpdate,
    me: User = Depends(require_role(ROLE_SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    req = db.get(SupportRequest, request_id)
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Support request not found")
    if body.status is not None:
        req.status = body.status
        # Stamp who closed it, and clear the stamp if it's reopened.
        if body.status == "resolved":
            req.handled_by = me.user_id
            req.handled_at = utcnow()
        elif body.status == "new":
            req.handled_by = None
            req.handled_at = None
    if body.admin_note is not None:
        req.admin_note = body.admin_note
    db.commit()
    db.refresh(req)
    return req
