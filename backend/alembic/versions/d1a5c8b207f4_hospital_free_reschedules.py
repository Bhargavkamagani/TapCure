"""Per-clinic free-reschedule allowance.

Cancellation & Refund Policy §5 promises "one free reschedule ... depending on
the clinic's policy", but nothing enforced or configured it — patients could
reschedule without limit.

Adds hospital_settings.free_reschedules. NULL means "use the platform default"
(settings.free_reschedules, currently 1), so existing clinics need no backfill
and a clinic can opt into a different allowance later.

Revision ID: d1a5c8b207f4
Revises: c9f4a1e7d305
"""
from alembic import op
import sqlalchemy as sa

revision = "d1a5c8b207f4"
down_revision = "c9f4a1e7d305"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable on purpose: NULL = inherit the platform default, so this is a
    # pure add with no rewrite of existing rows.
    op.add_column(
        "hospital_settings",
        sa.Column("free_reschedules", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("hospital_settings", "free_reschedules")
