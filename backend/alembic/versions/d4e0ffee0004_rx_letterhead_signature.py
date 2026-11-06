"""letterhead images on hospitals, signature on doctors (prescription PDF).

Revision ID: d4e0ffee0004
Revises: c3d0ffee0003
Create Date: 2026-10-26 18:00:00.000000

Three nullable columns, nothing else:
  hospitals.letterhead_header_url  - top of the printed prescription
  hospitals.letterhead_footer_url  - bottom of it
  doctors.signature_url            - printed above the doctor's name

All empty to start with. A hospital with no header gets one built from its
name, logo, address and phone, so every prescription PDF has a letterhead.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d4e0ffee0004"
down_revision: Union[str, None] = "c3d0ffee0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("letterhead_header_url", sa.String(255), nullable=True))
    op.add_column("hospitals", sa.Column("letterhead_footer_url", sa.String(255), nullable=True))
    op.add_column("doctors", sa.Column("signature_url", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("doctors", "signature_url")
    op.drop_column("hospitals", "letterhead_footer_url")
    op.drop_column("hospitals", "letterhead_header_url")
