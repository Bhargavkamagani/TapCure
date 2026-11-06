"""Per-doctor free-revisit window for practices a doctor runs themselves.

Additive: one nullable column on doctor_affiliations. Nothing is backfilled —
NULL reads as "this practice offers no free revisit", exactly as a NULL on
hospital_settings.free_revisit_days does.

Why the column lives on the affiliation and not on doctors: a doctor may consult
at a clinic AND run their own practice. The clinic owns the fee at the clinic, so
it owns the waiver there; the doctor owns both at their own practice. Putting the
window on the practice row lets the same doctor have different answers in each,
which a column on `doctors` could not express.

This also closes a leak. A self-registered doctor's personal affiliation carries
hospital_id = NULL, but appointments fall back to `doctor.hospital_id`
(routers/appointments.py:410), which for a solo doctor is the default anchor
tenant picked by `_default_hospital_id`. So a solo doctor was reading the free
revisit policy of whichever clinic happened to be first in the table — one they
do not work for, never configured, and cannot see. After this migration
`services.revisit_pass.window_days` resolves a personal practice from this
column and never consults the anchor clinic's settings.

Revision ID: d2f5a8c93b17
Revises: c1d4e7f2a9b3
"""
from alembic import op
import sqlalchemy as sa

revision = "d2f5a8c93b17"
down_revision = "c1d4e7f2a9b3"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    return column in {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    # Self-healing, like c1d4e7f2a9b3: re-running must not abort the chain.
    if not _has_column("doctor_affiliations", "free_revisit_days"):
        op.add_column(
            "doctor_affiliations",
            sa.Column("free_revisit_days", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    if _has_column("doctor_affiliations", "free_revisit_days"):
        op.drop_column("doctor_affiliations", "free_revisit_days")
