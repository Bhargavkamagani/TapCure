"""patients.insurances + family_members.insurances (insurance Phase 2).

Revision ID: b8c0ffee0008
Revises: a7b0ffee0007
Create Date: 2026-11-10 20:00:00.000000

A patient (and each family member) can save the health insurances / govt
schemes they hold: a JSON list of {"code": ..., "policy_no": ...}, codes from
app/services/insurers.py. Used only to show "Accepts your insurance" on
hospitals and at booking; it never blocks anything. Everyone starts with an
empty list; nothing is guessed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b8c0ffee0008"
down_revision: Union[str, None] = "a7b0ffee0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("insurances", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    op.add_column("family_members", sa.Column("insurances", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))


def downgrade() -> None:
    op.drop_column("family_members", "insurances")
    op.drop_column("patients", "insurances")
