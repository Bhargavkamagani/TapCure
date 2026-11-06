"""Free revisit pass — one no-charge return visit with the same doctor.

Purely additive: a new table plus one nullable column on hospital_settings.
Nothing is backfilled — passes start being earned the day this ships, and the
feature stays dormant until a clinic sets `free_revisit_days`.

The partial unique index is the real guard against issuing two live passes for
the same (patient, doctor): the service checks first, but two consultations
finishing in the same instant would both pass a SELECT-then-INSERT.

Revision ID: c1d4e7f2a9b3
Revises: b7c1d2e3f4a5
"""
from alembic import op
import sqlalchemy as sa

revision = "c1d4e7f2a9b3"
down_revision = "b7c1d2e3f4a5"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    # Self-healing, like b7c1d2e3f4a5: re-running must not abort the chain.
    if not _has_table("revisit_passes"):
        op.create_table(
            "revisit_passes",
            sa.Column("pass_id", sa.BigInteger(), primary_key=True, autoincrement=True),
            sa.Column("hospital_id", sa.BigInteger(), sa.ForeignKey("hospitals.hospital_id"), nullable=True),
            sa.Column("doctor_id", sa.BigInteger(), sa.ForeignKey("doctors.doctor_id"), nullable=False),
            sa.Column("affiliation_id", sa.BigInteger(), sa.ForeignKey("doctor_affiliations.affiliation_id"), nullable=True),
            sa.Column("patient_id", sa.BigInteger(), sa.ForeignKey("patients.patient_id"), nullable=False),
            sa.Column("family_member_id", sa.BigInteger(), sa.ForeignKey("family_members.member_id"), nullable=True),
            sa.Column("source_appointment_id", sa.BigInteger(), sa.ForeignKey("appointments.appointment_id"), nullable=True),
            sa.Column("issued_on", sa.Date(), nullable=False),
            sa.Column("valid_until", sa.Date(), nullable=False),
            sa.Column("status", sa.String(length=12), nullable=False, server_default="active"),
            sa.Column("redeemed_appointment_id", sa.BigInteger(), sa.ForeignKey("appointments.appointment_id"), nullable=True),
            sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("redeemed_by", sa.BigInteger(), sa.ForeignKey("users.user_id"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_revisit_passes_hospital_id", "revisit_passes", ["hospital_id"])
        op.create_index("ix_revisit_passes_doctor_id", "revisit_passes", ["doctor_id"])
        op.create_index("ix_revisit_passes_affiliation_id", "revisit_passes", ["affiliation_id"])
        op.create_index("ix_revisit_passes_patient_id", "revisit_passes", ["patient_id"])
        op.create_index("ix_revisit_passes_family_member_id", "revisit_passes", ["family_member_id"])
        op.create_index("ix_revisit_passes_valid_until", "revisit_passes", ["valid_until"])
        op.create_index("ix_revisit_passes_status", "revisit_passes", ["status"])
        op.create_index(
            "uq_revisit_pass_active", "revisit_passes", ["patient_id", "doctor_id"],
            unique=True, postgresql_where=sa.text("status = 'active'"),
        )

    if not _has_column("hospital_settings", "free_revisit_days"):
        # Nullable with NO default: NULL means "this clinic does not offer it",
        # so shipping this cannot switch a free consultation on for anybody.
        op.add_column("hospital_settings", sa.Column("free_revisit_days", sa.Integer(), nullable=True))


def downgrade() -> None:
    if _has_column("hospital_settings", "free_revisit_days"):
        op.drop_column("hospital_settings", "free_revisit_days")
    if _has_table("revisit_passes"):
        op.drop_table("revisit_passes")
