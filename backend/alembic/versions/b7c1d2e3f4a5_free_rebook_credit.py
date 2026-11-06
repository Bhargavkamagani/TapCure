"""Free-rebook credit on cancellation logs.

When a doctor's session is deleted, the patients booked into it lose a visit
they may already have paid the online booking fee for. The app has no automated
refund, so instead of promising money back it grants ONE free rebooking — no
booking fee on their next appointment — and says so in the notification.

Three additive, nullable/defaulted columns on `appt_cancellation_logs`. Existing
rows read as "no credit", which is correct: those cancellations were made under
the old policy and nobody was promised anything.

Revision ID: b7c1d2e3f4a5
Revises: c9a4f2b71d68
"""
from alembic import op
import sqlalchemy as sa

revision = "b7c1d2e3f4a5"
down_revision = "c9a4f2b71d68"
branch_labels = None
depends_on = None

_COLUMNS = (
    ("free_rebook_granted", sa.Column("free_rebook_granted", sa.Boolean(), nullable=False, server_default=sa.false())),
    ("free_rebook_used_at", sa.Column("free_rebook_used_at", sa.DateTime(timezone=True), nullable=True)),
    ("free_rebook_used_appointment_id", sa.Column("free_rebook_used_appointment_id", sa.BigInteger(), nullable=True)),
)


def _existing() -> set[str]:
    bind = op.get_bind()
    return {c["name"] for c in sa.inspect(bind).get_columns("appt_cancellation_logs")}


def upgrade() -> None:
    # Self-healing: a teammate who ran an earlier hand-patched schema may already
    # have some of these. Adding a column that exists aborts the whole migration
    # and leaves the chain stuck, so check first.
    have = _existing()
    for name, column in _COLUMNS:
        if name not in have:
            op.add_column("appt_cancellation_logs", column)


def downgrade() -> None:
    have = _existing()
    for name, _ in reversed(_COLUMNS):
        if name in have:
            op.drop_column("appt_cancellation_logs", name)
