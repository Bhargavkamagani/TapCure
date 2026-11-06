"""hospitals.display_key — the secret in the waiting-room TV link.

Revision ID: e5f0ffee0005
Revises: d4e0ffee0004
Create Date: 2026-10-26 21:00:00.000000

One nullable column. Empty for every hospital until its admin opens the TV
link box the first time, which makes one; "Make new link" replaces it, and the
old link stops working at once.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "e5f0ffee0005"
down_revision: Union[str, None] = "d4e0ffee0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("display_key", sa.String(64), nullable=True))
    op.create_index("ix_hospitals_display_key", "hospitals", ["display_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_hospitals_display_key", table_name="hospitals")
    op.drop_column("hospitals", "display_key")
