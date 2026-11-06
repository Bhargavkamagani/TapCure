"""consultation fee payment (collected at clinic)

Adds the in-person consultation-fee payment fields to appointments. Idempotent.

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f8a9b0c1d2e3"
down_revision: Union[str, None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _has_column(insp, table: str, col: str) -> bool:
    return any(c["name"] == col for c in insp.get_columns(table))


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {
        "consultation_paid": sa.Column("consultation_paid", sa.Boolean(), nullable=False, server_default=sa.false()),
        "consultation_payment_method": sa.Column("consultation_payment_method", sa.String(length=12), nullable=True),
        "consultation_paid_at": sa.Column("consultation_paid_at", sa.DateTime(timezone=True), nullable=True),
        "consultation_paid_by": sa.Column("consultation_paid_by", _BIGINT, nullable=True),
    }
    with op.batch_alter_table("appointments", schema=None) as batch_op:
        for name, col in cols.items():
            if not _has_column(insp, "appointments", name):
                batch_op.add_column(col)


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    with op.batch_alter_table("appointments", schema=None) as batch_op:
        for name in ("consultation_paid_by", "consultation_paid_at", "consultation_payment_method", "consultation_paid"):
            if _has_column(insp, "appointments", name):
                batch_op.drop_column(name)
