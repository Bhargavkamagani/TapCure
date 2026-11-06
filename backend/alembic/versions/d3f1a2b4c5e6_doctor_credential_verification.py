"""doctor credential verification (solo self-registered doctors)

Adds manual-verification state to `doctors` and the `doctor_documents` table that
holds uploaded credential files (registration certificate, degree, council proof)
reviewed by a Super Admin.

  doctors.verification_status  — 'verified' (default) | 'pending' | 'rejected'
  doctors.is_self_registered   — solo doctor who signed up themselves
  doctors.verified_at / _by     — audit of the manual review
  doctors.rejection_reason      — shown to the doctor if rejected
  doctor_documents              — one row per uploaded credential file

Defaults to 'verified' so every existing row and every clinic-onboarded doctor
stays trusted — only self-registration sets 'pending'.

Idempotent (guards every table/column/index) so it's safe on a DB that already
received these from the standalone migrate_doctor_verification.py script, and
correct on a fresh DB built purely via `alembic upgrade head`.

Revision ID: d3f1a2b4c5e6
Revises: c2d3e4f5a6b7
Create Date: 2026-07-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d3f1a2b4c5e6"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

# (column, Column spec) added to `doctors`.
_DOCTOR_COLUMNS = [
    ("verification_status", sa.Column("verification_status", sa.String(length=12), nullable=False, server_default="verified")),
    ("is_self_registered", sa.Column("is_self_registered", sa.Boolean(), nullable=False, server_default=sa.false())),
    ("verified_at", sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True)),
    ("verified_by", sa.Column("verified_by", _BIGINT, sa.ForeignKey("users.user_id"), nullable=True)),
    ("rejection_reason", sa.Column("rejection_reason", sa.Text(), nullable=True)),
]


def _has_table(insp, table: str) -> bool:
    return table in insp.get_table_names()


def _has_column(insp, table: str, column: str) -> bool:
    return any(c["name"] == column for c in insp.get_columns(table))


def _has_index(insp, table: str, index: str) -> bool:
    return any(i["name"] == index for i in insp.get_indexes(table))


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())

    for name, column in _DOCTOR_COLUMNS:
        if not _has_column(insp, "doctors", name):
            op.add_column("doctors", column)

    if not _has_index(insp, "doctors", "ix_doctors_verification_status"):
        op.create_index("ix_doctors_verification_status", "doctors", ["verification_status"])

    if not _has_table(insp, "doctor_documents"):
        op.create_table(
            "doctor_documents",
            sa.Column("document_id", _BIGINT, primary_key=True, autoincrement=True),
            sa.Column("doctor_id", _BIGINT, sa.ForeignKey("doctors.doctor_id"), nullable=False, index=True),
            sa.Column("doc_type", sa.String(length=32), nullable=False, server_default="other"),
            sa.Column("label", sa.String(length=120), nullable=False, server_default=""),
            sa.Column("file_url", sa.String(length=255), nullable=False),
            sa.Column("file_size_kb", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    insp = sa.inspect(op.get_bind())

    if _has_table(insp, "doctor_documents"):
        op.drop_table("doctor_documents")
    if _has_index(insp, "doctors", "ix_doctors_verification_status"):
        op.drop_index("ix_doctors_verification_status", table_name="doctors")
    for name, _column in reversed(_DOCTOR_COLUMNS):
        if _has_column(insp, "doctors", name):
            op.drop_column("doctors", name)
