"""Clinic pharmacy — stock list, remembered sheet layout, Rx line -> stock link, PHARMACIST role.

The clinic's pharmacist uploads their stock sheet; the doctor sees what is on
the shelf while prescribing.

  pharmacy_stock                  one row per medicine line of the latest sheet
  hospital_settings.pharmacy_config  remembered column matching + low-stock threshold
  prescription_items.stock_id     which stock row the doctor picked (NULL = typed freely)

RBAC: seed() short-circuits once any role exists, so an already-seeded database
never picks up rbac.py changes (see c9f4a1e7d305). This migration adds the
PHARMACIST role and the pharmacy.read/update grants itself, each only if missing.

Revision ID: f6a2c8e4b1d9
Revises: e5c9b3d71a28
"""
from alembic import op
import sqlalchemy as sa

revision = "f6a2c8e4b1d9"
down_revision = "e5c9b3d71a28"
branch_labels = None
depends_on = None

# Mirrors rbac.py at the time of writing — kept literal so the migration never
# changes meaning when the matrix evolves later.
GRANTS = {
    "PHARMACIST": [("hospital", "read"), ("pharmacy", "read"), ("pharmacy", "update"), ("notification", "read")],
    "HOSPITAL_ADMIN": [("pharmacy", "read"), ("pharmacy", "update")],
    "DOCTOR": [("pharmacy", "read")],
}
NEW_PERMISSIONS = [("pharmacy", "read"), ("pharmacy", "update")]
ROLE = "PHARMACIST"
ROLE_DESCRIPTION = "Clinic pharmacy counter: uploads the medicine stock list doctors prescribe from"


def upgrade() -> None:
    op.create_table(
        "pharmacy_stock",
        sa.Column("stock_id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("hospital_id", sa.BigInteger(), nullable=False),
        sa.Column("match_key", sa.String(length=400), nullable=False),
        sa.Column("medicine_name", sa.String(length=200), nullable=False),
        sa.Column("generic_name", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("strength", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("form", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("batch_no", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mrp", sa.Numeric(10, 2), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("search_text", sa.String(length=700), nullable=False, server_default=""),
        sa.Column("generic_key", sa.String(length=300), nullable=False, server_default=""),
        sa.Column("strength_key", sa.String(length=60), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("uploaded_by", sa.BigInteger(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["hospital_id"], ["hospitals.hospital_id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("stock_id"),
        sa.UniqueConstraint("hospital_id", "match_key", name="uq_pharmacy_stock_hospital_match_key"),
    )
    op.create_index("ix_pharmacy_stock_hospital_id", "pharmacy_stock", ["hospital_id"])
    op.create_index("ix_pharmacy_stock_generic_key", "pharmacy_stock", ["generic_key"])

    op.add_column("hospital_settings", sa.Column("pharmacy_config", sa.JSON(), nullable=True))

    op.add_column("prescription_items", sa.Column("stock_id", sa.BigInteger(), nullable=True))
    op.create_foreign_key(
        "fk_prescription_items_stock_id", "prescription_items", "pharmacy_stock", ["stock_id"], ["stock_id"],
    )
    op.create_index("ix_prescription_items_stock_id", "prescription_items", ["stock_id"])

    _grant_rbac()


def _grant_rbac() -> None:
    conn = op.get_bind()
    if conn.scalar(sa.text("SELECT role_id FROM roles LIMIT 1")) is None:
        # Fresh database — seed() applies the current matrix on first startup.
        return

    role_id = conn.scalar(sa.text("SELECT role_id FROM roles WHERE name = :n"), {"n": ROLE})
    if role_id is None:
        # Raw SQL gets no ORM defaults, so fill every NOT NULL column the model
        # fills in Python. updated_at only where this database has the column.
        role_cols = {c["name"] for c in sa.inspect(conn).get_columns("roles")}
        cols, vals = ["name", "description", "is_active", "created_at"], [":n", ":d", "TRUE", "CURRENT_TIMESTAMP"]
        if "updated_at" in role_cols:
            cols.append("updated_at")
            vals.append("CURRENT_TIMESTAMP")
        conn.execute(
            sa.text(f"INSERT INTO roles ({', '.join(cols)}) VALUES ({', '.join(vals)})"),
            {"n": ROLE, "d": ROLE_DESCRIPTION},
        )

    for module, action in NEW_PERMISSIONS:
        exists = conn.scalar(
            sa.text("SELECT permission_id FROM permissions WHERE module = :m AND action = :a"),
            {"m": module, "a": action},
        )
        if exists is None:
            conn.execute(
                sa.text("INSERT INTO permissions (module, action, description, created_at) "
                        "VALUES (:m, :a, :d, CURRENT_TIMESTAMP)"),
                {"m": module, "a": action, "d": f"{action} {module}"},
            )

    for role_name, perms in GRANTS.items():
        rid = conn.scalar(sa.text("SELECT role_id FROM roles WHERE name = :n"), {"n": role_name})
        if rid is None:
            continue
        for module, action in perms:
            pid = conn.scalar(
                sa.text("SELECT permission_id FROM permissions WHERE module = :m AND action = :a"),
                {"m": module, "a": action},
            )
            if pid is None:
                continue
            already = conn.scalar(
                sa.text("SELECT 1 FROM role_permissions WHERE role_id = :r AND permission_id = :p"),
                {"r": rid, "p": pid},
            )
            if not already:
                conn.execute(
                    sa.text("INSERT INTO role_permissions (role_id, permission_id, created_at) "
                            "VALUES (:r, :p, CURRENT_TIMESTAMP)"),
                    {"r": rid, "p": pid},
                )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "DELETE FROM role_permissions WHERE permission_id IN "
        "(SELECT permission_id FROM permissions WHERE module = 'pharmacy')"
    ))
    conn.execute(sa.text("DELETE FROM permissions WHERE module = 'pharmacy'"))
    # The role itself stays if any pharmacist login still points at it.
    conn.execute(sa.text(
        "DELETE FROM role_permissions WHERE role_id IN (SELECT role_id FROM roles WHERE name = :n)"
    ), {"n": ROLE})
    conn.execute(sa.text(
        "DELETE FROM roles WHERE name = :n AND NOT EXISTS "
        "(SELECT 1 FROM users u WHERE u.role_id = roles.role_id)"
    ), {"n": ROLE})

    op.drop_index("ix_prescription_items_stock_id", table_name="prescription_items")
    op.drop_constraint("fk_prescription_items_stock_id", "prescription_items", type_="foreignkey")
    op.drop_column("prescription_items", "stock_id")
    op.drop_column("hospital_settings", "pharmacy_config")
    op.drop_index("ix_pharmacy_stock_generic_key", table_name="pharmacy_stock")
    op.drop_index("ix_pharmacy_stock_hospital_id", table_name="pharmacy_stock")
    op.drop_table("pharmacy_stock")
