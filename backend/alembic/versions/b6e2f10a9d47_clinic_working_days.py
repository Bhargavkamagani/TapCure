"""Store the clinic's working days on hospital_settings.

The clinic signup form has always asked for working days (ClinicRegister.
working_days) and the value was thrown away — there was no column. Without it a
doctor could put a Sunday session on a clinic that never opens on Sunday, and
patients could book into it.

Existing clinics get the common Mon-Sat default rather than a blank, so nothing
that was bookable yesterday silently stops being bookable today.

Revision ID: b6e2f10a9d47
Revises: a4d1e7b93c02
"""
from alembic import op
import sqlalchemy as sa

revision = "b6e2f10a9d47"
down_revision = "a4d1e7b93c02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hospital_settings",
        sa.Column("working_days", sa.String(length=40), nullable=False,
                  server_default="Mon,Tue,Wed,Thu,Fri,Sat"),
    )


def downgrade() -> None:
    op.drop_column("hospital_settings", "working_days")
