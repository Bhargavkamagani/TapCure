"""family member reminder recipient

Adds `family_members.notify_to` — where a dependent's reminders are sent:

  'account' (default) — the account holder's phone
  'own'              — the member's own `phone`

Non-null with a server default so every existing row keeps today's behaviour
(reminders go to the account holder). Resolved in one place:
`services.notifications.reminder_phone()`.

Idempotent (guards the column) so it's safe to re-run.

Revision ID: f5b3c7d9e2a1
Revises: e4a2b6c8d1f0
Create Date: 2026-07-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5b3c7d9e2a1"
down_revision: Union[str, None] = "e4a2b6c8d1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(insp, table: str, column: str) -> bool:
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not _has_column(insp, "family_members", "notify_to"):
        op.add_column(
            "family_members",
            sa.Column("notify_to", sa.String(length=8), nullable=False, server_default="account"),
        )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_column(insp, "family_members", "notify_to"):
        op.drop_column("family_members", "notify_to")
