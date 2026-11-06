"""Let a family member who has their own account see the visits booked for them.

A dependent listed in someone's family list and that same person's own login are
two unconnected records today: appointments booked *for* them hang off the
account holder's patient record, so signing in shows none of it.

The link is consent-gated in both directions and never inferred. A matching
phone number is evidence, not proof - numbers get recycled and mistyped, so
auto-linking on a match would hand a stranger a family's medical history. The
account holder is asked first because they already know who the dependent is;
telling the new account first would instead disclose the holder's family
structure to whoever now holds that number.

Revision ID: d1f4b8c6e2a7
Revises: c3d7e9f1a4b2
"""
import sqlalchemy as sa
from alembic import op

revision = "d1f4b8c6e2a7"
down_revision = "c3d7e9f1a4b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable, defaulted, no backfill: every existing row keeps meaning
    # "a dependent with no account of their own", which is the normal case.
    op.add_column("family_members", sa.Column("linked_user_id", sa.BigInteger(), nullable=True))
    op.add_column(
        "family_members",
        sa.Column("link_status", sa.String(16), nullable=False,
                  server_default="none"),
    )
    op.create_foreign_key(
        "fk_family_members_linked_user", "family_members", "users",
        ["linked_user_id"], ["user_id"],
    )
    # The member-side inbox ("which invitations are waiting for me?") and the
    # shared-appointment read both start from the linked account.
    op.create_index("ix_family_members_linked_user_id", "family_members", ["linked_user_id"])


def downgrade() -> None:
    op.drop_index("ix_family_members_linked_user_id", table_name="family_members")
    op.drop_constraint("fk_family_members_linked_user", "family_members", type_="foreignkey")
    op.drop_column("family_members", "link_status")
    op.drop_column("family_members", "linked_user_id")
