"""
Lightweight write helpers for the audit-ish tables (login_history, activity_logs).

These are best-effort: a logging failure must never break the actual request,
so callers can wrap in try/except or rely on the same transaction commit.
"""
from uuid import UUID
from typing import Optional

from sqlalchemy.orm import Session

from ..models import ActivityLog, LoginHistory


def log_login(
    db: Session, user_id: Optional[UUID], ip: str, user_agent: str, status: str
) -> None:
    db.add(LoginHistory(user_id=user_id, ip_address=ip or "", user_agent=user_agent or "", status=status))


def log_activity(
    db: Session, user_id: Optional[UUID], action: str, module: str, meta: Optional[dict] = None
) -> None:
    db.add(ActivityLog(user_id=user_id, action=action, module=module, meta=meta))
