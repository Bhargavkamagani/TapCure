"""Per-user notification read receipts.

"Mark as read" was component state only — it reset on refresh, and the bell kept
its own separate localStorage list, so the red dot never cleared. Nothing was
ever stored, because notifications had no read column at all.

Read state is per USER rather than a flag on the notification: clinic
notifications are visible to several staff at once, and reception marking one
read must not clear it for the doctor.

Revision ID: e2b7d419c063
Revises: d1a5c8b207f4
"""
from alembic import op
import sqlalchemy as sa

revision = "e2b7d419c063"
down_revision = "d1a5c8b207f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_reads",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("notification_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["notification_id"], ["notifications.notification_id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("notification_id", "user_id", name="uq_notification_read"),
    )
    op.create_index(
        "ix_notification_reads_notification_id", "notification_reads", ["notification_id"]
    )
    op.create_index("ix_notification_reads_user_id", "notification_reads", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_notification_reads_user_id", table_name="notification_reads")
    op.drop_index("ix_notification_reads_notification_id", table_name="notification_reads")
    op.drop_table("notification_reads")
