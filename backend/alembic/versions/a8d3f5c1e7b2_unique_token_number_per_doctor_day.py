"""One token number per doctor per day — enforced by the database.

services/token_engine.py numbers tokens as max(token_number) + 1 for the
doctor's day. Two bookings in the same instant both read the same max and both
took the same number: two patients holding CCH-008. The code now serialises a
doctor's day with an advisory lock (lock_doctor_day); this unique index is the
backstop, so any future path that forgets the lock fails loudly instead of
handing out a duplicate.

Refuses to run while duplicates already exist — CREATE UNIQUE INDEX
CONCURRENTLY would otherwise fail halfway and leave an INVALID index that
IF NOT EXISTS then silently skips on the next attempt. The error lists them so
they can be renumbered first.

CONCURRENTLY so the live tokens table is never locked while the index builds,
which means it runs outside a transaction (autocommit block), as e5c9b3d71a28.

Revision ID: a8d3f5c1e7b2
Revises: f6a2c8e4b1d9
"""
from alembic import op
import sqlalchemy as sa

revision = "a8d3f5c1e7b2"
down_revision = "f6a2c8e4b1d9"
branch_labels = None
depends_on = None

INDEX = "uq_tokens_doctor_date_number"


def upgrade() -> None:
    conn = op.get_bind()
    duplicates = conn.execute(sa.text(
        "SELECT doctor_id, token_date, token_number, count(*) FROM tokens "
        "GROUP BY doctor_id, token_date, token_number HAVING count(*) > 1 "
        "ORDER BY token_date, doctor_id, token_number LIMIT 20"
    )).all()
    if duplicates:
        listed = "; ".join(f"doctor {d} on {day}: #{n} x{c}" for d, day, n, c in duplicates)
        raise RuntimeError(
            f"Cannot add {INDEX}: duplicate token numbers already exist ({listed}). "
            "Renumber those tokens first, then run the upgrade again."
        )
    if conn.dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute(
                f"CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS {INDEX} "
                "ON tokens (doctor_id, token_date, token_number)"
            )
    else:
        op.create_index(INDEX, "tokens", ["doctor_id", "token_date", "token_number"], unique=True)


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        with op.get_context().autocommit_block():
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX}")
    else:
        op.drop_index(INDEX, table_name="tokens")
