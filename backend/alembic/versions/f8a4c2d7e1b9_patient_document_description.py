"""Add descriptions to patient-uploaded documents.

Revision ID: f8a4c2d7e1b9
Revises: e7a3c9d51f84, f5b3c7d9e2a1
"""
from alembic import op
import sqlalchemy as sa

revision = "f8a4c2d7e1b9"
down_revision = ("e7a3c9d51f84", "f5b3c7d9e2a1")
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "patient_documents",
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
    )


def downgrade():
    op.drop_column("patient_documents", "description")
