"""Store the clinic's registration (licence) number.

The signup form has always REQUIRED this — it is in step 1 of ClinicSignup and
a clinic cannot get past it without typing one — and `ClinicRegister` has
always accepted it. But `register_clinic` built the Hospital row without it and
`hospitals` had no column, so every clinic registered so far typed its licence
number into a field that was discarded before the row was written. The Super
Admin then approved or rejected that clinic without ever seeing the number.

The only `registration_number` in the database until now belongs to DOCTORS
(their State Medical Council number) — a different identifier entirely.

Nullable on purpose: the numbers already typed are gone and cannot be
recovered, so existing clinics keep NULL until someone re-enters it. No unique
constraint yet — with historic rows blank and nothing verified against the
issuing authority, a uniqueness error would be the first thing a legitimate
clinic hit, for a value we cannot check anyway.
"""
from alembic import op
import sqlalchemy as sa


revision = "f1a7c3e95d24"
down_revision = "e6c3a91f4b72"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hospitals", sa.Column("registration_number", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("hospitals", "registration_number")
