"""Module 12 — Audit endpoints (3 APIs): query the immutable audit trail."""
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_permission
from ..models import AuditLog, User
from ..rbac import ROLE_SUPER_ADMIN
from ..schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit-logs", tags=["audit"])


def _scope(stmt, me: User):
    if not (me.role and me.role.name == ROLE_SUPER_ADMIN):
        stmt = stmt.where(AuditLog.hospital_id == me.hospital_id)
    return stmt


@router.get("", response_model=list[AuditLogOut])
def query_logs(
    hospital_id: UUID | None = Query(None),
    user_id: UUID | None = Query(None),
    module: str | None = Query(None),
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    me: User = Depends(require_permission("audit", "read")),
    db: Session = Depends(get_db),
):
    stmt = _scope(select(AuditLog), me)
    if hospital_id and me.role and me.role.name == ROLE_SUPER_ADMIN:
        stmt = stmt.where(AuditLog.hospital_id == hospital_id)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if module:
        stmt = stmt.where(AuditLog.module == module)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    return db.scalars(stmt.order_by(AuditLog.log_id.desc()).offset((page - 1) * size).limit(size)).all()


@router.get("/user/{target_user_id}", response_model=list[AuditLogOut])
def logs_by_user(target_user_id: UUID, module: str | None = Query(None),
                 me: User = Depends(require_permission("audit", "read")), db: Session = Depends(get_db)):
    stmt = _scope(select(AuditLog).where(AuditLog.user_id == target_user_id), me)
    if module:
        stmt = stmt.where(AuditLog.module == module)
    return db.scalars(stmt.order_by(AuditLog.log_id.desc()).limit(200)).all()


@router.get("/{entity_type}/{entity_id}", response_model=list[AuditLogOut])
def logs_for_entity(entity_type: str, entity_id: UUID,
                    me: User = Depends(require_permission("audit", "read")), db: Session = Depends(get_db)):
    stmt = _scope(select(AuditLog).where(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id), me)
    return db.scalars(stmt.order_by(AuditLog.log_id)).all()
