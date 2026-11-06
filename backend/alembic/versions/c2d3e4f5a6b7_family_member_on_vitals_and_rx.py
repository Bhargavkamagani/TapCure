"""family_member_id on vitals & prescriptions

Lets a reading or prescription be attributed to a specific dependent (family
member) booked under the patient's account, so their clinical records track
under their own name. Idempotent: skips columns that already exist.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-06-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _has_col(insp, table: str, col: str) -> bool:
    return table in insp.get_table_names() and col in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if not _has_col(insp, "patient_vitals", "family_member_id"):
        op.add_column("patient_vitals", sa.Column("family_member_id", _BIGINT, sa.ForeignKey("family_members.member_id"), nullable=True))
        op.create_index("ix_patient_vitals_family_member_id", "patient_vitals", ["family_member_id"])
    if not _has_col(insp, "prescriptions", "family_member_id"):
        op.add_column("prescriptions", sa.Column("family_member_id", _BIGINT, sa.ForeignKey("family_members.member_id"), nullable=True))
        op.create_index("ix_prescriptions_family_member_id", "prescriptions", ["family_member_id"])


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if _has_col(insp, "prescriptions", "family_member_id"):
        op.drop_index("ix_prescriptions_family_member_id", table_name="prescriptions")
        op.drop_column("prescriptions", "family_member_id")
    if _has_col(insp, "patient_vitals", "family_member_id"):
        op.drop_index("ix_patient_vitals_family_member_id", table_name="patient_vitals")
        op.drop_column("patient_vitals", "family_member_id")
