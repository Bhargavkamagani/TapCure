"""Medicine reminders — courses + per-dose outbox.

A course is created `awaiting_start` when the doctor writes the prescription and
only materialises its dose rows once the patient confirms they actually have the
medicine — they may well have bought it at an outside pharmacy, so the clinic
can't know when the course begins.

Revision ID: a4d1e7b93c02
Revises: f3c81d92a47b
"""
from alembic import op
import sqlalchemy as sa

revision = "a4d1e7b93c02"
down_revision = "f3c81d92a47b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "medicine_courses",
        sa.Column("course_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("hospital_id", sa.BigInteger(), nullable=False),
        sa.Column("patient_id", sa.BigInteger(), nullable=False),
        sa.Column("prescription_id", sa.BigInteger(), nullable=False),
        sa.Column("item_id", sa.BigInteger(), nullable=False),
        sa.Column("family_member_id", sa.BigInteger(), nullable=True),
        sa.Column("drug_name", sa.String(length=200), nullable=False),
        sa.Column("dosage", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("food_note", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("slots", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("times_csv", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("days", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="awaiting_start"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("stop_reason", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.hospital_id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.patient_id"]),
        sa.ForeignKeyConstraint(["prescription_id"], ["prescriptions.prescription_id"]),
        sa.ForeignKeyConstraint(["item_id"], ["prescription_items.item_id"]),
        sa.ForeignKeyConstraint(["family_member_id"], ["family_members.member_id"]),
        sa.PrimaryKeyConstraint("course_id"),
    )
    op.create_index("ix_medicine_courses_hospital_id", "medicine_courses", ["hospital_id"])
    op.create_index("ix_medicine_courses_patient_id", "medicine_courses", ["patient_id"])
    op.create_index("ix_medicine_courses_prescription_id", "medicine_courses", ["prescription_id"])
    op.create_index("ix_medicine_courses_item_id", "medicine_courses", ["item_id"])
    op.create_index("ix_medicine_courses_family_member_id", "medicine_courses", ["family_member_id"])
    op.create_index("ix_medicine_courses_status", "medicine_courses", ["status"])

    op.create_table(
        "medicine_reminders",
        sa.Column("reminder_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=False),
        sa.Column("hospital_id", sa.BigInteger(), nullable=False),
        sa.Column("patient_id", sa.BigInteger(), nullable=False),
        sa.Column("dose_date", sa.Date(), nullable=False),
        sa.Column("slot", sa.String(length=20), nullable=False, server_default=""),
        sa.Column("send_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("channel", sa.String(length=12), nullable=False, server_default=""),
        sa.Column("sent_to", sa.String(length=20), nullable=False, server_default=""),
        sa.Column("last_error", sa.Text(), nullable=False, server_default=""),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["course_id"], ["medicine_courses.course_id"]),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.hospital_id"]),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.patient_id"]),
        sa.PrimaryKeyConstraint("reminder_id"),
    )
    op.create_index("ix_medicine_reminders_course_id", "medicine_reminders", ["course_id"])
    op.create_index("ix_medicine_reminders_hospital_id", "medicine_reminders", ["hospital_id"])
    op.create_index("ix_medicine_reminders_patient_id", "medicine_reminders", ["patient_id"])
    op.create_index("ix_medicine_reminders_send_at", "medicine_reminders", ["send_at"])
    op.create_index("ix_medicine_reminders_status", "medicine_reminders", ["status"])
    # The ticker's only hot query: pending doses that have come due.
    op.create_index("ix_medicine_reminders_due", "medicine_reminders", ["status", "send_at"])


def downgrade() -> None:
    op.drop_table("medicine_reminders")
    op.drop_table("medicine_courses")
