"""Allow a medicine course with no prescription behind it.

A patient can upload a prescription written by an outside doctor and ask for
reminders from it. That medicine has no row in `prescriptions` and no row in
`prescription_items` — the doctor who wrote it does not exist in this system —
but `medicine_courses.prescription_id` and `.item_id` were NOT NULL, so the
course could not be created at all.

Both become nullable. A course with a NULL `prescription_id` is self-reported:
the patient typed it in (or confirmed it from their uploaded photo), and it is
theirs alone. Everything the reminder engine needs — drug name, slots, times,
days — is already copied onto the course itself, precisely so a course survives
without the Rx line it came from.

Additive and reversible in shape: no column is dropped, no data is moved, and
every existing course keeps the prescription it already points at. The
downgrade is only safe while no self-reported course exists, so it deletes
those first rather than failing on the NOT NULL.
"""
from alembic import op
import sqlalchemy as sa


revision = "a2e8d14c7b63"
down_revision = "f1a7c3e95d24"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("medicine_courses", "prescription_id", existing_type=sa.BigInteger(), nullable=True)
    op.alter_column("medicine_courses", "item_id", existing_type=sa.BigInteger(), nullable=True)
    # Which uploaded photo the patient read this medicine off, when there is
    # one. Nullable: a course typed in without any upload has no document, and
    # every course that already exists came from a doctor's Rx, not a photo.
    op.add_column(
        "medicine_courses",
        sa.Column("document_id", sa.BigInteger(), nullable=True),
    )
    op.create_foreign_key(
        "fk_medicine_courses_document_id", "medicine_courses",
        "patient_documents", ["document_id"], ["document_id"],
    )
    op.create_index("ix_medicine_courses_document_id", "medicine_courses", ["document_id"])


def downgrade() -> None:
    # Self-reported courses cannot satisfy a NOT NULL prescription_id — they
    # never had one. Remove them (and their doses) before restoring the
    # constraint, or the ALTER fails on live data.
    op.execute(
        "DELETE FROM medicine_reminders WHERE course_id IN "
        "(SELECT course_id FROM medicine_courses WHERE prescription_id IS NULL)"
    )
    op.execute("DELETE FROM medicine_courses WHERE prescription_id IS NULL")
    op.drop_index("ix_medicine_courses_document_id", table_name="medicine_courses")
    op.drop_constraint("fk_medicine_courses_document_id", "medicine_courses", type_="foreignkey")
    op.drop_column("medicine_courses", "document_id")
    op.alter_column("medicine_courses", "item_id", existing_type=sa.BigInteger(), nullable=False)
    op.alter_column("medicine_courses", "prescription_id", existing_type=sa.BigInteger(), nullable=False)
