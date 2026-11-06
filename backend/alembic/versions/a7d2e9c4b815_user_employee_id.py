"""Employee ID for pharmacist logins.

Revision ID: a7d2e9c4b815
Revises: e5c1a8d3f264
Create Date: 2026-10-15 23:30:00.000000

Receptionists already had an Employee ID (receptionists.employee_id), but a
pharmacist is only a users row, so the clinic admin's Staff page showed the
internal database id instead. Nullable: existing pharmacists simply have none.

Additive only; downgrade drops the column.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7d2e9c4b815"
down_revision: Union[str, None] = "e5c1a8d3f264"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("users")}
    if "employee_id" not in cols:
        op.add_column("users", sa.Column("employee_id", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "employee_id")
