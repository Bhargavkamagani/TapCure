"""Doctors a receptionist is assigned to.

Revision ID: f2c6a9d4e183
Revises: b8e3f1a6c290
Create Date: 2026-10-16 12:00:00.000000

A hospital can have several receptionists, each handling particular doctors.
receptionists.doctors_assigned holds those doctor_ids; NULL (every existing
row) means "all doctors", which is how reception worked before.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f2c6a9d4e183"
down_revision: Union[str, None] = "b8e3f1a6c290"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("receptionists", sa.Column("doctors_assigned", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("receptionists", "doctors_assigned")
