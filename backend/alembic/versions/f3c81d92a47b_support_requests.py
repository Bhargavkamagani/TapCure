"""Support enquiries from the public Contact page.

The Contact form was a mock: handleSubmit only flipped a "sent" flag, made no
API call, and no support endpoint existed — so every message people typed was
silently discarded while the UI claimed success. This gives them somewhere to
land, and the Super-Admin console an inbox to read.

Revision ID: f3c81d92a47b
Revises: e2b7d419c063
"""
from alembic import op
import sqlalchemy as sa

revision = "f3c81d92a47b"
down_revision = "e2b7d419c063"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_requests",
        sa.Column("request_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False, server_default=""),
        sa.Column("email", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("mobile", sa.String(length=20), nullable=False, server_default=""),
        sa.Column("city", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("role", sa.String(length=40), nullable=False, server_default="Patient"),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="new"),
        sa.Column("handled_by", sa.BigInteger(), nullable=True),
        sa.Column("handled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=False, server_default=""),
        sa.Column("notified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.current_timestamp()),
        sa.ForeignKeyConstraint(["handled_by"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("request_id"),
    )
    op.create_index("ix_support_requests_status", "support_requests", ["status"])
    op.create_index("ix_support_requests_created_at", "support_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_support_requests_created_at", table_name="support_requests")
    op.drop_index("ix_support_requests_status", table_name="support_requests")
    op.drop_table("support_requests")
