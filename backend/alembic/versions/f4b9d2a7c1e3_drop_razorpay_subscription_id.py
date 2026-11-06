"""Drop subscriptions.razorpay_subscription_id (never used).

Revision ID: f4b9d2a7c1e3
Revises: e8a4c1f6b3d7
Create Date: 2026-10-23 12:00:00.000000

Clinic billing uses UPI Autopay mandates (billing_mandates) and monthly
invoices, not Razorpay Subscriptions, so nothing ever wrote this column.
Downgrade adds it back empty.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f4b9d2a7c1e3"
down_revision: Union[str, None] = "e8a4c1f6b3d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("subscriptions") as batch:
        batch.drop_column("razorpay_subscription_id")


def downgrade() -> None:
    with op.batch_alter_table("subscriptions") as batch:
        batch.add_column(sa.Column("razorpay_subscription_id", sa.String(100), nullable=True))
