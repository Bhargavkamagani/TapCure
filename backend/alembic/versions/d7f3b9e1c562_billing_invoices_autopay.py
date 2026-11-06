"""Monthly invoices, UPI Autopay mandates, walk-in WhatsApp opt-in.

Revision ID: d7f3b9e1c562
Revises: c5e8a2f7d419
Create Date: 2026-10-22 18:00:00.000000

invoices gain billing_month / lines_json and the Razorpay ids they were paid
with. billing_mandates holds each clinic's Razorpay UPI Autopay token.
appointments.queue_alerts: NULL = alerts on (every existing row, app
bookings); walk-ins are False unless the front desk ticks the box.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d7f3b9e1c562"
down_revision: Union[str, None] = "c5e8a2f7d419"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("billing_month", sa.String(7), nullable=True))
    op.create_index("ix_invoices_billing_month", "invoices", ["billing_month"])
    op.add_column("invoices", sa.Column("lines_json", sa.JSON(), nullable=True))
    op.add_column("invoices", sa.Column("razorpay_order_id", sa.String(100), nullable=True))
    op.add_column("invoices", sa.Column("razorpay_payment_id", sa.String(100), nullable=True))
    op.add_column("appointments", sa.Column("queue_alerts", sa.Boolean(), nullable=True))
    op.create_table(
        "billing_mandates",
        sa.Column("mandate_id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.BigInteger(), sa.ForeignKey("hospitals.hospital_id"), nullable=False),
        sa.Column("razorpay_customer_id", sa.String(100), nullable=True),
        sa.Column("razorpay_order_id", sa.String(100), nullable=True),
        sa.Column("razorpay_token_id", sa.String(100), nullable=True),
        sa.Column("max_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(12), nullable=False, server_default="created"),
        sa.Column("created_by", sa.BigInteger(), sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_billing_mandates_hospital_id", "billing_mandates", ["hospital_id"])
    op.create_index("ix_billing_mandates_razorpay_order_id", "billing_mandates", ["razorpay_order_id"])
    op.create_index("ix_billing_mandates_razorpay_token_id", "billing_mandates", ["razorpay_token_id"])
    op.create_index("ix_billing_mandates_status", "billing_mandates", ["status"])


def downgrade() -> None:
    op.drop_table("billing_mandates")
    op.drop_column("appointments", "queue_alerts")
    op.drop_column("invoices", "razorpay_payment_id")
    op.drop_column("invoices", "razorpay_order_id")
    op.drop_column("invoices", "lines_json")
    op.drop_index("ix_invoices_billing_month", table_name="invoices")
    op.drop_column("invoices", "billing_month")
