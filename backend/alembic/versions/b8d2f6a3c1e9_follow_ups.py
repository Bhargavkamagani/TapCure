"""follow-ups (auto-created from prescription follow-up dates)

Adds the `follow_ups` table — a first-class record of a follow-up a doctor
asked a patient to come back for. Auto-created when a follow-up date is set on
a prescription; its status tracks the lifecycle (pending → booked → completed /
missed / cancelled) so the patient can be reminded and the loop closed on
re-booking.

Idempotent (guards the table) so it's safe to re-run.

Revision ID: b8d2f6a3c1e9
Revises: a7c1e4f8b3d2
Create Date: 2026-07-11 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8d2f6a3c1e9"
down_revision: Union[str, None] = "a7c1e4f8b3d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_table(insp, "follow_ups"):
        return
    op.create_table(
        "follow_ups",
        sa.Column("follow_up_id", _BIGINT, primary_key=True, autoincrement=True),
        sa.Column("hospital_id", _BIGINT, sa.ForeignKey("hospitals.hospital_id"), nullable=False, index=True),
        sa.Column("patient_id", _BIGINT, sa.ForeignKey("patients.patient_id"), nullable=False, index=True),
        sa.Column("family_member_id", _BIGINT, sa.ForeignKey("family_members.member_id"), nullable=True, index=True),
        sa.Column("doctor_id", _BIGINT, sa.ForeignKey("doctors.doctor_id"), nullable=False, index=True),
        sa.Column("source_prescription_id", _BIGINT, sa.ForeignKey("prescriptions.prescription_id"), nullable=True, index=True),
        sa.Column("source_appointment_id", _BIGINT, sa.ForeignKey("appointments.appointment_id"), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False, index=True),
        sa.Column("reason", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="pending", index=True),
        sa.Column("booked_appointment_id", _BIGINT, sa.ForeignKey("appointments.appointment_id"), nullable=True),
        sa.Column("reminded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_table(insp, "follow_ups"):
        op.drop_table("follow_ups")
