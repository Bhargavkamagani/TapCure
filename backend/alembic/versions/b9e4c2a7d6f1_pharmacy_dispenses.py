"""Pharmacy counter — record what was handed over for each prescription line.

One NEW table only; no existing table is altered.

  pharmacy_dispenses   one row per prescription line the counter recorded
                       (given from stock / not from our stock), with who and
                       when; an undo stamps undone_at instead of deleting

The links to prescriptions, prescription_items and medicine_courses are
ON DELETE SET NULL so deleting a prescription behaves exactly as before.
A partial unique index allows at most one live (not undone) record per line.

Revision ID: b9e4c2a7d6f1
Revises: a8d3f5c1e7b2
"""
from alembic import op
import sqlalchemy as sa

revision = "b9e4c2a7d6f1"
down_revision = "a8d3f5c1e7b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pharmacy_dispenses",
        sa.Column("dispense_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("hospital_id", sa.BigInteger(), nullable=False),
        sa.Column("prescription_id", sa.BigInteger(), nullable=True),
        sa.Column("item_id", sa.BigInteger(), nullable=True),
        sa.Column("outcome", sa.String(length=12), nullable=False),
        sa.Column("stock_id", sa.BigInteger(), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stock_deducted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("course_id", sa.BigInteger(), nullable=True),
        sa.Column("dispensed_by", sa.BigInteger(), nullable=True),
        sa.Column("dispensed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("undone_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("undone_by", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.hospital_id"]),
        sa.ForeignKeyConstraint(["prescription_id"], ["prescriptions.prescription_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["item_id"], ["prescription_items.item_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["stock_id"], ["pharmacy_stock.stock_id"]),
        sa.ForeignKeyConstraint(["course_id"], ["medicine_courses.course_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["dispensed_by"], ["users.user_id"]),
        sa.ForeignKeyConstraint(["undone_by"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("dispense_id"),
    )
    op.create_index("ix_pharmacy_dispenses_hospital_id", "pharmacy_dispenses", ["hospital_id"])
    op.create_index("ix_pharmacy_dispenses_prescription_id", "pharmacy_dispenses", ["prescription_id"])
    op.create_index(
        "uq_pharmacy_dispenses_live_item", "pharmacy_dispenses", ["item_id"], unique=True,
        postgresql_where=sa.text("undone_at IS NULL"), sqlite_where=sa.text("undone_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_pharmacy_dispenses_live_item", table_name="pharmacy_dispenses")
    op.drop_index("ix_pharmacy_dispenses_prescription_id", table_name="pharmacy_dispenses")
    op.drop_index("ix_pharmacy_dispenses_hospital_id", table_name="pharmacy_dispenses")
    op.drop_table("pharmacy_dispenses")
