"""One signed-in device per account.

Until now a login handed out a self-contained access token and the server never
asked again which session it belonged to. Logging in somewhere else simply
minted a second token, and both kept working for their full 30 minutes — an
account shared (or stolen) stayed usable in two places at once.

`users.session_id` is the id of the session currently allowed. Every login
writes a new one and revokes that user's refresh tokens, so the previous
device's token no longer matches and it is signed out on its next request.

RECEPTIONIST is exempt in the code (app/deps.py): a front desk deliberately runs
one login on several machines, and enforcing this there would have two clerks
logging each other out all day. The column is still filled for them so the rule
can be turned on later without another migration.

BACKFILL, deliberate: every existing user gets a fresh random id. Tokens already
in the wild carry no session id at all, so they stop matching the moment this
ships — everyone signs in once more. That was the choice made: the rule applies
to everybody from minute one rather than leaving a window where old tokens are
still good.

Cost: 36 characters per user row, written once.
"""
import uuid

from alembic import op
import sqlalchemy as sa


revision = "d4b7e1c9a305"
down_revision = "c7f2a91d4e86"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("session_id", sa.String(length=36), nullable=True))

    # A DIFFERENT id per row, not one value for everybody: two users sharing an
    # id would let a token minted for one satisfy the check for the other.
    conn = op.get_bind()
    users = sa.table("users", sa.column("user_id", sa.BigInteger), sa.column("session_id", sa.String))
    ids = [row[0] for row in conn.execute(sa.select(users.c.user_id))]
    for user_id in ids:
        conn.execute(
            users.update().where(users.c.user_id == user_id).values(session_id=uuid.uuid4().hex)
        )


def downgrade() -> None:
    op.drop_column("users", "session_id")
