"""hospitals.profile_completed_at + hospital_settings.hours_confirmed.

Revision ID: a7b0ffee0007
Revises: f6f0ffee0006
Create Date: 2026-11-10 18:00:00.000000

Since 2026-11-10 the hospital signup is short (no logo, hours or services); the
owner fills them in on "Complete your profile" after approval. Until that is
done, patients must NOT see the hospital or its doctors.

- hospital_settings.hours_confirmed: the owner chose the hours (signup only
  stores a 24x7 default). Was kept in the owner's browser only.
- hospitals.profile_completed_at: set once the profile is complete; NULL = hidden
  from patients.

Backfill: every hospital registered BEFORE 2026-11-10 went through the old long
signup (logo, hours and services were required), so it is marked complete and
stays visible exactly as today. Hospitals from 2026-11-10 on start incomplete.
Times are IST (+05:30).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a7b0ffee0007"
down_revision: Union[str, None] = "f6f0ffee0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CUTOFF = "2026-11-10 00:00:00+05:30"


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("profile_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "hospital_settings",
        sa.Column("hours_confirmed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(sa.text(
        "UPDATE hospitals SET profile_completed_at = COALESCE(created_at, now()) "
        "WHERE created_at < CAST(:cut AS timestamptz)"
    ).bindparams(cut=CUTOFF))
    op.execute(sa.text(
        "UPDATE hospital_settings SET hours_confirmed = true WHERE hospital_id IN "
        "(SELECT hospital_id FROM hospitals WHERE created_at < CAST(:cut AS timestamptz))"
    ).bindparams(cut=CUTOFF))


def downgrade() -> None:
    op.drop_column("hospital_settings", "hours_confirmed")
    op.drop_column("hospitals", "profile_completed_at")
