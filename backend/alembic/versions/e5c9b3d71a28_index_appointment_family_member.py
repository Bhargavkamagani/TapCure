"""Index appointments.family_member_id — the shared-visit lookup was a seq scan.

Every other table that can belong to a dependent (`prescriptions`,
`patient_vitals`, `follow_ups`, `medicine_courses`, `revisit_passes`) already
indexes this column; `appointments` was the one that did not. That went unnoticed
while nothing queried it — but the family-account link reads exactly this column
to show a dependent the visits booked for them, so on a busy clinic it would
scan the whole appointments table on every dashboard load.

CONCURRENTLY so a live table is never locked while it builds, which means this
migration cannot run inside a transaction — hence the autocommit block.

Revision ID: e5c9b3d71a28
Revises: d1f4b8c6e2a7
"""
from alembic import op

revision = "e5c9b3d71a28"
down_revision = "d1f4b8c6e2a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_appointments_family_member_id "
            "ON appointments (family_member_id)"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_appointments_family_member_id")
