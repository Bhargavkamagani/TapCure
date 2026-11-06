"""family member photo

Adds `family_members.photo_url` — an uploaded profile photo for a dependent,
mirroring `patients.photo_url`. Nullable, so existing rows keep showing their
initials avatar.

Idempotent (guards the column) so it's safe to re-run.

Revision ID: a7c1e4f8b3d2
Revises: f5b3c7d9e2a1
Create Date: 2026-07-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c1e4f8b3d2"
down_revision: Union[str, None] = "f5b3c7d9e2a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(insp, table: str, column: str) -> bool:
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not _has_column(insp, "family_members", "photo_url"):
        op.add_column("family_members", sa.Column("photo_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_column(insp, "family_members", "photo_url"):
        op.drop_column("family_members", "photo_url")
