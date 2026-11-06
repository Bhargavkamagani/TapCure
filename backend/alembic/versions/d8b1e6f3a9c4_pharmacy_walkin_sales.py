"""Pharmacy counter — walk-in sales to outside customers (no prices).

  pharmacy_walkin_sales        NEW: one row per sale — optional customer name,
                               mobile and who prescribed it, who sold, when,
                               and an undo marker
  pharmacy_dispenses.sale_id   NEW column: links each medicine line to its sale.
                               NULL for prescription hand-overs, which keep
                               working exactly as before.

Touches only the pharmacy tables created today; no older table is altered.

Revision ID: d8b1e6f3a9c4
Revises: c4f7a9e2b5d3
"""
from alembic import op
import sqlalchemy as sa

revision = "d8b1e6f3a9c4"
down_revision = "c4f7a9e2b5d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pharmacy_walkin_sales",
        sa.Column("sale_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("hospital_id", sa.BigInteger(), nullable=False),
        sa.Column("customer_name", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("customer_phone", sa.String(length=15), nullable=False, server_default=""),
        sa.Column("prescribed_by", sa.String(length=150), nullable=False, server_default=""),
        sa.Column("sold_by", sa.BigInteger(), nullable=True),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("undone_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("undone_by", sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.hospital_id"]),
        sa.ForeignKeyConstraint(["sold_by"], ["users.user_id"]),
        sa.ForeignKeyConstraint(["undone_by"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("sale_id"),
    )
    op.create_index("ix_pharmacy_walkin_sales_hospital_id", "pharmacy_walkin_sales", ["hospital_id"])
    op.create_index("ix_pharmacy_walkin_sales_sold_at", "pharmacy_walkin_sales", ["sold_at"])

    op.add_column("pharmacy_dispenses", sa.Column("sale_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        "fk_pharmacy_dispenses_sale_id", "pharmacy_dispenses", "pharmacy_walkin_sales", ["sale_id"], ["sale_id"],
    )
    op.create_index("ix_pharmacy_dispenses_sale_id", "pharmacy_dispenses", ["sale_id"])


def downgrade() -> None:
    op.drop_index("ix_pharmacy_dispenses_sale_id", table_name="pharmacy_dispenses")
    op.drop_constraint("fk_pharmacy_dispenses_sale_id", "pharmacy_dispenses", type_="foreignkey")
    op.drop_column("pharmacy_dispenses", "sale_id")
    op.drop_index("ix_pharmacy_walkin_sales_sold_at", table_name="pharmacy_walkin_sales")
    op.drop_index("ix_pharmacy_walkin_sales_hospital_id", table_name="pharmacy_walkin_sales")
    op.drop_table("pharmacy_walkin_sales")
