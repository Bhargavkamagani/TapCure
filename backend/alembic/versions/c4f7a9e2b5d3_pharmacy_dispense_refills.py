"""Pharmacy counter — allow more than one hand-over per prescription line.

A patient on a two-month course may take one month's supply now and come back
for the next. b9e4c2a7d6f1 allowed a single live record per prescription line;
this drops that rule and keeps a plain index for the per-line lookups.

Touches ONLY pharmacy_dispenses (created in b9e4c2a7d6f1). No other table.

Revision ID: c4f7a9e2b5d3
Revises: b9e4c2a7d6f1
"""
from alembic import op
import sqlalchemy as sa

revision = "c4f7a9e2b5d3"
down_revision = "b9e4c2a7d6f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("uq_pharmacy_dispenses_live_item", table_name="pharmacy_dispenses")
    op.create_index("ix_pharmacy_dispenses_item_id", "pharmacy_dispenses", ["item_id"])


def downgrade() -> None:
    # Fails if a line already has several live hand-overs — undo the extras first.
    op.drop_index("ix_pharmacy_dispenses_item_id", table_name="pharmacy_dispenses")
    op.create_index(
        "uq_pharmacy_dispenses_live_item", "pharmacy_dispenses", ["item_id"], unique=True,
        postgresql_where=sa.text("undone_at IS NULL"), sqlite_where=sa.text("undone_at IS NULL"),
    )
