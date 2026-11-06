"""prescriptions & prescription items

Creates the prescriptions table (one Rx per visit: diagnosis, advice, follow-up)
and prescription_items (the drugs on it). Idempotent: skips tables that already
exist.

Revision ID: b1c2d3e4f5a6
Revises: a9b0c1d2e3f4
Create Date: 2026-06-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not _has_table(insp, "prescriptions"):
        op.create_table(
            "prescriptions",
            sa.Column("prescription_id", _BIGINT, primary_key=True, autoincrement=True),
            sa.Column("hospital_id", _BIGINT, sa.ForeignKey("hospitals.hospital_id"), nullable=False, index=True),
            sa.Column("patient_id", _BIGINT, sa.ForeignKey("patients.patient_id"), nullable=False, index=True),
            sa.Column("doctor_id", _BIGINT, sa.ForeignKey("doctors.doctor_id"), nullable=False, index=True),
            sa.Column("appointment_id", _BIGINT, sa.ForeignKey("appointments.appointment_id"), nullable=True, index=True),
            sa.Column("diagnosis", sa.Text(), nullable=False, server_default=""),
            sa.Column("advice", sa.Text(), nullable=False, server_default=""),
            sa.Column("follow_up_date", sa.Date(), nullable=True),
            sa.Column("created_by", _BIGINT, sa.ForeignKey("users.user_id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True),
        )
    if not _has_table(insp, "prescription_items"):
        op.create_table(
            "prescription_items",
            sa.Column("item_id", _BIGINT, primary_key=True, autoincrement=True),
            sa.Column("prescription_id", _BIGINT, sa.ForeignKey("prescriptions.prescription_id"), nullable=False, index=True),
            sa.Column("drug_name", sa.String(length=200), nullable=False),
            sa.Column("dosage", sa.String(length=100), nullable=False, server_default=""),
            sa.Column("frequency", sa.String(length=100), nullable=False, server_default=""),
            sa.Column("duration", sa.String(length=100), nullable=False, server_default=""),
            sa.Column("instructions", sa.Text(), nullable=False, server_default=""),
        )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_table(insp, "prescription_items"):
        op.drop_table("prescription_items")
    if _has_table(insp, "prescriptions"):
        op.drop_table("prescriptions")
