"""Module 2 — Department endpoints."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import ensure_same_tenant, require_permission
from ..models import Department, Hospital, User
from ..schemas.hospital import DepartmentCreate, DepartmentOut, DepartmentUpdate
from ..services import audit
from ..services import hospital_profile

router = APIRouter(prefix="/departments", tags=["departments"])


def _require(db: Session, department_id: UUID) -> Department:
    d = db.get(Department, department_id)
    if not d:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department not found")
    return d


def _ensure_unique_name(db: Session, hospital_id: UUID, name: str, exclude_id: UUID | None = None) -> None:
    """One department per name per hospital (case/space-insensitive). A
    deactivated one still counts: it should be reactivated, not duplicated."""
    stmt = select(Department).where(
        Department.hospital_id == hospital_id,
        func.lower(func.trim(Department.name)) == name.strip().lower(),
    )
    if exclude_id is not None:
        stmt = stmt.where(Department.department_id != exclude_id)
    dup = db.scalars(stmt).first()
    if dup:
        hint = " It is deactivated; reactivate it instead." if not dup.is_active else ""
        raise HTTPException(status.HTTP_409_CONFLICT, f'Department "{dup.name}" already exists.{hint}')


@router.get("", response_model=list[DepartmentOut])
def list_departments(
    hospital_id: UUID | None = Query(None),
    me: User = Depends(require_permission("department", "read")),
    db: Session = Depends(get_db),
):
    is_super = bool(me.role and me.role.name == "SUPER_ADMIN")
    stmt = select(Department)
    if is_super:
        if hospital_id is not None:
            stmt = stmt.where(Department.hospital_id == hospital_id)
    else:
        stmt = stmt.where(Department.hospital_id == me.hospital_id)
    return db.scalars(stmt.order_by(Department.department_id)).all()


@router.post("", response_model=DepartmentOut, status_code=201)
def create_department(body: DepartmentCreate, me: User = Depends(require_permission("department", "create")), db: Session = Depends(get_db)):
    ensure_same_tenant(me, body.hospital_id)
    if not db.get(Hospital, body.hospital_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid hospital_id")
    _ensure_unique_name(db, body.hospital_id, body.name)
    d = Department(**body.model_dump())
    db.add(d)
    audit.log_activity(db, me.user_id, "department.create", "department")
    hospital_profile.mark_if_complete(db, db.get(Hospital, body.hospital_id))
    db.commit()
    db.refresh(d)
    return d


@router.put("/{department_id}", response_model=DepartmentOut)
def update_department(department_id: UUID, body: DepartmentUpdate, me: User = Depends(require_permission("department", "update")), db: Session = Depends(get_db)):
    d = _require(db, department_id)
    ensure_same_tenant(me, d.hospital_id)
    if body.name is not None:
        _ensure_unique_name(db, d.hospital_id, body.name, exclude_id=d.department_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    hospital_profile.mark_if_complete(db, db.get(Hospital, d.hospital_id))
    db.commit()
    db.refresh(d)
    return d


@router.delete("/{department_id}")
def deactivate_department(department_id: UUID, me: User = Depends(require_permission("department", "delete")), db: Session = Depends(get_db)):
    d = _require(db, department_id)
    ensure_same_tenant(me, d.hospital_id)
    d.is_active = False
    db.commit()
    return {"message": "Department deactivated"}
