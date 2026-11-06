"""
Waiting-room TV link.

  GET  /display/{key}/board                    the TV — no login, read-only
  GET  /hospitals/{hospital_id}/display-link   admin: the link (made on first ask)
  POST /hospitals/{hospital_id}/display-link   admin: make a new link (old one dies)

The key in the link is the only credential, so it is long and random, and the
board it opens carries no patient data — token codes and counts only (see
services/display_board.py). One link per hospital; it works every day until the
admin replaces it.
"""
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db, parse_uuid
from ..deps import ensure_same_tenant, require_permission
from ..models import Hospital, User
from ..services import audit
from ..services import display_board

router = APIRouter(tags=["display"])

KEY_BYTES = 24   # 32 URL-safe characters


def _new_key(db: Session) -> str:
    while True:
        key = secrets.token_urlsafe(KEY_BYTES)
        if not db.scalar(select(Hospital.hospital_id).where(Hospital.display_key == key)):
            return key


def _link(h: Hospital) -> dict:
    return {"key": h.display_key, "path": f"/tv/{h.display_key}"}


def _hospital_for_admin(db: Session, me: User, hospital_id: UUID) -> Hospital:
    ensure_same_tenant(me, hospital_id)
    h = db.get(Hospital, hospital_id)
    if not h:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Hospital not found")
    return h


@router.get("/display/{key}/board")
def board(key: str, response: Response,
          doctors: str | None = Query(None, description="optional comma-separated doctor ids"),
          db: Session = Depends(get_db)):
    # Same answer for a wrong key and a switched-off hospital: the link simply
    # isn't valid, and a guesser learns nothing about which hospitals exist.
    h = db.scalar(select(Hospital).where(Hospital.display_key == key)) if len(key) >= 20 else None
    if not h or h.status != "active" or not h.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This display link is not valid. Ask the hospital for the new link.")
    only = {u for u in (parse_uuid(x) for x in (doctors or "").split(",")) if u} or None
    response.headers["Cache-Control"] = "no-store"
    return display_board.build(db, h, only_doctors=only)


@router.get("/hospitals/{hospital_id}/display-link")
def get_display_link(hospital_id: UUID, me: User = Depends(require_permission("hospital", "update")),
                     db: Session = Depends(get_db)):
    h = _hospital_for_admin(db, me, hospital_id)
    if not h.display_key:
        h.display_key = _new_key(db)
        db.commit()
    return _link(h)


@router.post("/hospitals/{hospital_id}/display-link")
def renew_display_link(hospital_id: UUID, me: User = Depends(require_permission("hospital", "update")),
                       db: Session = Depends(get_db)):
    """Replace the link. The old one stops working on the TV's next refresh."""
    h = _hospital_for_admin(db, me, hospital_id)
    h.display_key = _new_key(db)
    audit.log_activity(db, me.user_id, "hospital.display_link.renew", "hospital", {"hospital_id": str(hospital_id)})
    db.commit()
    return _link(h)
