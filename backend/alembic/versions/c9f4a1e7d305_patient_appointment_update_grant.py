"""Grant PATIENT the appointment.update permission.

Patients could not reschedule or cancel their own appointment: both endpoints
sit behind require_permission("appointment", "update"), and ROLE_PATIENT was
only granted create/read/delete. Every attempt returned 403.

rbac.py holds the intended matrix, but permissions are enforced from the
role_permissions TABLE — and seed() short-circuits once any role exists, so an
already-seeded database never picks up a matrix change. Hence this migration.

Safe on every database: it inserts the permission row only if the catalog is
missing it, and the grant only if it isn't already there.

Revision ID: c9f4a1e7d305
Revises: b8d2f6a3c1e9
"""
from alembic import op
import sqlalchemy as sa

revision = "c9f4a1e7d305"
down_revision = "b8d2f6a3c1e9"
branch_labels = None
depends_on = None

MODULE = "appointment"
ACTION = "update"
ROLE = "PATIENT"


def upgrade() -> None:
    conn = op.get_bind()

    role_id = conn.scalar(
        sa.text("SELECT role_id FROM roles WHERE name = :n"), {"n": ROLE}
    )
    if role_id is None:
        # Fresh database that hasn't been seeded yet — seed() will apply the
        # current matrix (which already includes this grant) on first startup.
        return

    perm_id = conn.scalar(
        sa.text(
            "SELECT permission_id FROM permissions WHERE module = :m AND action = :a"
        ),
        {"m": MODULE, "a": ACTION},
    )
    if perm_id is None:
        # created_at is NOT NULL with no server default — the ORM fills it in
        # Python, so raw SQL has to supply it or the insert violates the column.
        conn.execute(
            sa.text(
                "INSERT INTO permissions (module, action, description, created_at) "
                "VALUES (:m, :a, :d, CURRENT_TIMESTAMP)"
            ),
            {"m": MODULE, "a": ACTION, "d": f"{ACTION} {MODULE}"},
        )
        perm_id = conn.scalar(
            sa.text(
                "SELECT permission_id FROM permissions WHERE module = :m AND action = :a"
            ),
            {"m": MODULE, "a": ACTION},
        )

    already = conn.scalar(
        sa.text(
            "SELECT 1 FROM role_permissions "
            "WHERE role_id = :r AND permission_id = :p"
        ),
        {"r": role_id, "p": perm_id},
    )
    if not already:
        conn.execute(
            sa.text(
                "INSERT INTO role_permissions (role_id, permission_id, created_at) "
                "VALUES (:r, :p, CURRENT_TIMESTAMP)"
            ),
            {"r": role_id, "p": perm_id},
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "DELETE FROM role_permissions WHERE role_id = ("
            "  SELECT role_id FROM roles WHERE name = :n"
            ") AND permission_id = ("
            "  SELECT permission_id FROM permissions WHERE module = :m AND action = :a"
            ")"
        ),
        {"n": ROLE, "m": MODULE, "a": ACTION},
    )
