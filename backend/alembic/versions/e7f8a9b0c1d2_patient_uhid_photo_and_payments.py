"""patient uhid, photo_url, and appointment_payments

Adds the human-facing UHID and profile photo to patients, and the
appointment_payments audit table for the Razorpay booking fee. Fully idempotent
(guards every add) so it is safe on databases where some of these were already
applied directly.

Revision ID: e7f8a9b0c1d2
Revises: a1b2c3d4e5f6
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.services import uhid as uhid_service


# revision identifiers, used by Alembic.
revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")


def _has_table(insp, name: str) -> bool:
    return name in insp.get_table_names()


def _has_column(insp, table: str, col: str) -> bool:
    return any(c["name"] == col for c in insp.get_columns(table))


def _has_index(insp, table: str, name: str) -> bool:
    return any(i["name"] == name for i in insp.get_indexes(table))


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1) patients.uhid + patients.photo_url (nullable; backfilled below).
    with op.batch_alter_table("patients", schema=None) as batch_op:
        if not _has_column(insp, "patients", "uhid"):
            batch_op.add_column(sa.Column("uhid", sa.String(length=20), nullable=True))
        if not _has_column(insp, "patients", "photo_url"):
            batch_op.add_column(sa.Column("photo_url", sa.String(length=500), nullable=True))

    # 2) appointment_payments audit table.
    if not _has_table(insp, "appointment_payments"):
        op.create_table(
            "appointment_payments",
            sa.Column("payment_pk", _BIGINT, autoincrement=True, nullable=False),
            sa.Column("razorpay_order_id", sa.String(length=64), nullable=False),
            sa.Column("razorpay_payment_id", sa.String(length=64), nullable=True),
            sa.Column("patient_id", _BIGINT, nullable=True),
            sa.Column("appointment_id", _BIGINT, nullable=True),
            sa.Column("amount", sa.Numeric(precision=8, scale=2), nullable=True),
            sa.Column("currency", sa.String(length=8), nullable=True),
            sa.Column("status", sa.String(length=12), nullable=True),
            sa.Column("booking_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["patient_id"], ["patients.patient_id"]),
            sa.ForeignKeyConstraint(["appointment_id"], ["appointments.appointment_id"]),
            sa.PrimaryKeyConstraint("payment_pk"),
        )

    # 3) Backfill a UHID for every patient that doesn't have one yet.
    taken = {r[0] for r in bind.execute(sa.text("SELECT uhid FROM patients WHERE uhid IS NOT NULL"))}
    rows = bind.execute(sa.text("SELECT patient_id FROM patients WHERE uhid IS NULL ORDER BY patient_id")).fetchall()
    for (pid,) in rows:
        code = uhid_service.generate()
        while code in taken:
            code = uhid_service.generate()
        taken.add(code)
        bind.execute(sa.text("UPDATE patients SET uhid = :u WHERE patient_id = :p"), {"u": code, "p": pid})

    # 4) Indexes (unique on uhid; lookups on payments).
    insp = sa.inspect(bind)
    if not _has_index(insp, "patients", "ix_patients_uhid"):
        op.create_index("ix_patients_uhid", "patients", ["uhid"], unique=True)
    if _has_table(insp, "appointment_payments"):
        if not _has_index(insp, "appointment_payments", "ix_appointment_payments_razorpay_order_id"):
            op.create_index("ix_appointment_payments_razorpay_order_id", "appointment_payments", ["razorpay_order_id"], unique=True)
        for col in ("razorpay_payment_id", "patient_id", "appointment_id", "status"):
            iname = f"ix_appointment_payments_{col}"
            if not _has_index(insp, "appointment_payments", iname):
                op.create_index(iname, "appointment_payments", [col], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if _has_table(insp, "appointment_payments"):
        op.drop_table("appointment_payments")
    if _has_index(insp, "patients", "ix_patients_uhid"):
        op.drop_index("ix_patients_uhid", table_name="patients")
    with op.batch_alter_table("patients", schema=None) as batch_op:
        if _has_column(insp, "patients", "photo_url"):
            batch_op.drop_column("photo_url")
        if _has_column(insp, "patients", "uhid"):
            batch_op.drop_column("uhid")
