"""hospitals.insurance_partners — insurers / govt schemes a hospital accepts.

Revision ID: f6f0ffee0006
Revises: e5f0ffee0005
Create Date: 2026-11-03 12:00:00.000000

One JSON column holding a list of codes from app/services/insurers.py, e.g.
["pmjay", "star_health"]. Every existing hospital starts with an empty list
("not said yet"); nothing is guessed. Phase 2 (patient insurance) will add its
own columns in a later migration.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f6f0ffee0006"
down_revision: Union[str, None] = "e5f0ffee0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hospitals",
        sa.Column("insurance_partners", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )


def downgrade() -> None:
    op.drop_column("hospitals", "insurance_partners")
