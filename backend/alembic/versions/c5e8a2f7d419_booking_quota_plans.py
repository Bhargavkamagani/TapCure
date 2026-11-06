"""Online-booking quota for the subscription plans.

Revision ID: c5e8a2f7d419
Revises: f2c6a9d4e183
Create Date: 2026-10-22 12:00:00.000000

plans.code ties a plan row to its booking rules (services/booking_quota.py);
the old demo plans keep NULL and are never enforced. subscriptions.extra_doctors
is the Pro add-on. booking_months holds each hospital's monthly quota choice,
booking packs and which warnings were already sent.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c5e8a2f7d419"
down_revision: Union[str, None] = "f2c6a9d4e183"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("plans", sa.Column("code", sa.String(30), nullable=True))
    op.create_index("ix_plans_code", "plans", ["code"])
    op.add_column("subscriptions", sa.Column("extra_doctors", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "booking_months",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
        sa.Column("hospital_id", sa.BigInteger(), sa.ForeignKey("hospitals.hospital_id"), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("choice", sa.String(16), nullable=True),
        sa.Column("choice_by", sa.BigInteger(), sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("choice_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pack_bookings", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pack_amount", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("warned_near_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("warned_full_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("hospital_id", "month", name="uq_booking_month"),
    )
    op.create_index("ix_booking_months_hospital_id", "booking_months", ["hospital_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_months_hospital_id", table_name="booking_months")
    op.drop_table("booking_months")
    op.drop_column("subscriptions", "extra_doctors")
    op.drop_index("ix_plans_code", table_name="plans")
    op.drop_column("plans", "code")
