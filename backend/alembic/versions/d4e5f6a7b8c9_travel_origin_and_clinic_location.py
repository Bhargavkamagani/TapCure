"""travel origin + clinic location columns

Adds the leave-by / travel columns that were previously only created by the
ad-hoc migrate_travel.py script (so a fresh `alembic upgrade head` was missing
them — and the next migration, 8d9f0a1b2c3d, even references hospitals.latitude
and crashed). Bringing them under Alembic makes it the single source of truth.

  hospitals.latitude / longitude
  appointments.origin_lat / origin_lng / origin_label / travel_minutes
  tokens.origin_lat / origin_lng / origin_label / travel_minutes

Runs BEFORE 8d9f0a1b2c3d so its UPDATE has hospitals.latitude to read.
Idempotent (guards every add) so it's safe on DBs that already received these
columns from create_all()/migrate_travel.py.

Revision ID: d4e5f6a7b8c9
Revises: 2f4b7c9d1e20
Create Date: 2026-06-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'f976596dca29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (table, column, type, server_default)
COLUMNS = [
    ('hospitals', 'latitude', sa.Numeric(9, 6), None),
    ('hospitals', 'longitude', sa.Numeric(9, 6), None),
    ('appointments', 'origin_lat', sa.Numeric(9, 6), None),
    ('appointments', 'origin_lng', sa.Numeric(9, 6), None),
    ('appointments', 'origin_label', sa.String(120), ''),
    ('appointments', 'travel_minutes', sa.Integer(), None),
    ('tokens', 'origin_lat', sa.Numeric(9, 6), None),
    ('tokens', 'origin_lng', sa.Numeric(9, 6), None),
    ('tokens', 'origin_label', sa.String(120), ''),
    ('tokens', 'travel_minutes', sa.Integer(), None),
]


def _has_column(bind, table_name: str, column_name: str) -> bool:
    return any(c["name"] == column_name for c in sa.inspect(bind).get_columns(table_name))


def upgrade() -> None:
    bind = op.get_bind()
    for table, column, type_, default in COLUMNS:
        if not _has_column(bind, table, column):
            col = sa.Column(column, type_, nullable=True,
                            server_default=(sa.text("''") if default == '' else None))
            op.add_column(table, col)


def downgrade() -> None:
    bind = op.get_bind()
    for table, column, _type, _default in reversed(COLUMNS):
        if _has_column(bind, table, column):
            op.drop_column(table, column)
