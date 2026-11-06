"""Hospital photo for the public Find Hospitals cards.

Revision ID: e5c1a8d3f264
Revises: d4b8e1c6f907
Create Date: 2026-10-01 22:00:00.000000

The only picture a hospital had was its logo. The landing page's Find
Hospitals now leads with a photo of the hospital, uploaded by the clinic admin
(Settings) or optionally at sign-up. Nullable: until a hospital uploads one,
its card falls back to the logo.

Additive only; downgrade drops the column.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5c1a8d3f264"
down_revision: Union[str, None] = "d4b8e1c6f907"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    cols = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("hospitals")}
    if "photo_url" not in cols:
        op.add_column("hospitals", sa.Column("photo_url", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("hospitals", "photo_url")
