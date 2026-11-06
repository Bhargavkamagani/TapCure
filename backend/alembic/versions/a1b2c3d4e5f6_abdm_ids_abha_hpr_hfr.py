"""ABDM IDs — patient ABHA, doctor HPR, clinic HFR

Adds the optional Ayushman Bharat Digital Mission identifiers:
  patients.abha_number   — 14-digit ABHA number (digits-only)
  patients.abha_address  — ABHA / PHR address (e.g. name@abdm)
  doctors.hpr_id         — Healthcare Professionals Registry ID
  hospitals.hfr_id       — Health Facility Registry ID

Idempotent (guards every add/index) so it's safe on a DB that already received
these columns from the earlier create_all()/manual scripts, and correct on a
fresh DB built purely via `alembic upgrade head`.

Revision ID: a1b2c3d4e5f6
Revises: 8d9f0a1b2c3d
Create Date: 2026-06-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '8d9f0a1b2c3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, column, type)
COLUMNS = [
    ('patients', 'abha_number', sa.String(length=17)),
    ('patients', 'abha_address', sa.String(length=64)),
    ('doctors', 'hpr_id', sa.String(length=64)),
    ('hospitals', 'hfr_id', sa.String(length=64)),
]
# (index_name, table, column)
INDEXES = [
    ('ix_patients_abha_number', 'patients', 'abha_number'),
    ('ix_doctors_hpr_id', 'doctors', 'hpr_id'),
    ('ix_hospitals_hfr_id', 'hospitals', 'hfr_id'),
]


def _has_column(bind, table_name: str, column_name: str) -> bool:
    return any(c["name"] == column_name for c in sa.inspect(bind).get_columns(table_name))


def _has_index(bind, table_name: str, index_name: str) -> bool:
    return any(i["name"] == index_name for i in sa.inspect(bind).get_indexes(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    for table, column, type_ in COLUMNS:
        if not _has_column(bind, table, column):
            op.add_column(table, sa.Column(column, type_, nullable=True))
    for index_name, table, column in INDEXES:
        if not _has_index(bind, table, index_name):
            op.create_index(index_name, table, [column])


def downgrade() -> None:
    bind = op.get_bind()
    for index_name, table, _column in INDEXES:
        if _has_index(bind, table, index_name):
            op.drop_index(index_name, table_name=table)
    for table, column, _type in COLUMNS:
        if _has_column(bind, table, column):
            op.drop_column(table, column)
