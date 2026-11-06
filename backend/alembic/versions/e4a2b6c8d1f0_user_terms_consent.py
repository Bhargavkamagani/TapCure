"""user terms/policy consent audit

Adds consent-audit columns to `users`, recorded at signup across all four
public registration paths (patient email, patient OTP, clinic, doctor):

  users.terms_accepted_at  — when the user accepted the policies (nullable)
  users.terms_version      — which policy version they agreed to (nullable)

Both nullable so every pre-existing user (who signed up before consent was
recorded) stays valid. Idempotent (guards each column) so it's safe to re-run.

Revision ID: e4a2b6c8d1f0
Revises: d3f1a2b4c5e6
Create Date: 2026-07-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a2b6c8d1f0"
down_revision: Union[str, None] = "d3f1a2b4c5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_USER_COLUMNS = [
    ("terms_accepted_at", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True)),
    ("terms_version", sa.Column("terms_version", sa.String(length=20), nullable=True)),
]


def _has_column(insp, table: str, column: str) -> bool:
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for name, column in _USER_COLUMNS:
        if not _has_column(insp, "users", name):
            op.add_column("users", column)


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    for name, _column in reversed(_USER_COLUMNS):
        if _has_column(insp, "users", name):
            op.drop_column("users", name)
