"""Billing webhook log + autopay double-charge guard + unpaid-bill reminders.

Revision ID: e8a4c1f6b3d7
Revises: d7f3b9e1c562
Create Date: 2026-10-22 20:00:00.000000

billing_events: every Razorpay billing webhook by its event id, so a repeat
is skipped and a failed one is retried. invoices gain the autopay order id
(kept apart from a manual Checkout order), when autopay was tried / failed,
and how many unpaid reminders were sent. Additive only; no data changes.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e8a4c1f6b3d7"
down_revision: Union[str, None] = "d7f3b9e1c562"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("autopay_order_id", sa.String(100), nullable=True))
    op.create_index("ix_invoices_autopay_order_id", "invoices", ["autopay_order_id"])
    op.add_column("invoices", sa.Column("autopay_attempted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("invoices", sa.Column("autopay_failed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("invoices", sa.Column("reminder_stage", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "billing_events",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.String(100), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False, server_default=""),
        sa.Column("status", sa.String(12), nullable=False, server_default="processed"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("event_id", name="uq_billing_events_event_id"),
    )


def downgrade() -> None:
    op.drop_table("billing_events")
    op.drop_column("invoices", "reminder_stage")
    op.drop_column("invoices", "autopay_failed_at")
    op.drop_column("invoices", "autopay_attempted_at")
    op.drop_index("ix_invoices_autopay_order_id", table_name="invoices")
    op.drop_column("invoices", "autopay_order_id")
