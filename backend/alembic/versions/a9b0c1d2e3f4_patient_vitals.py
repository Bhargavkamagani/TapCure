"""patient vitals & measurements

Creates the patient_vitals table — a timestamped set of vitals (BP, pulse, temp,
SpO2, weight/height, blood sugar) captured per visit, usually by the nurse /
reception at check-in. Idempotent: skips creation if the table already exists.

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_table(insp, "patient_vitals"):
        return
    op.create_table(
        "patient_vitals",
        sa.Column("vital_id", _BIGINT, primary_key=True, autoincrement=True),
        sa.Column("patient_id", _BIGINT, sa.ForeignKey("patients.patient_id"), nullable=False, index=True),
        sa.Column("appointment_id", _BIGINT, sa.ForeignKey("appointments.appointment_id"), nullable=True, index=True),
        sa.Column("bp_systolic", sa.Integer(), nullable=True),
        sa.Column("bp_diastolic", sa.Integer(), nullable=True),
        sa.Column("pulse", sa.Integer(), nullable=True),
        sa.Column("temperature_f", sa.Numeric(4, 1), nullable=True),
        sa.Column("spo2", sa.Integer(), nullable=True),
        sa.Column("respiratory_rate", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Numeric(5, 1), nullable=True),
        sa.Column("height_cm", sa.Numeric(5, 1), nullable=True),
        sa.Column("blood_sugar", sa.Integer(), nullable=True),
        sa.Column("sugar_type", sa.String(length=10), nullable=True),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("recorded_by", _BIGINT, sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), index=True),
    )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_table(insp, "patient_vitals"):
        op.drop_table("patient_vitals")
