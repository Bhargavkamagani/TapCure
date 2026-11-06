"""Close the logins of receptionists who were already deactivated.

Revision ID: b8e3f1a6c290
Revises: a7d2e9c4b815
Create Date: 2026-10-15 23:50:00.000000

Deactivating a receptionist used to flip only receptionists.is_active; the
users row behind it stayed 'active', so the person could still sign in. The
endpoint now deactivates both. This brings the rows deactivated before that
into line.

Data only. Downgrade does nothing: which of these logins were meant to stay
open can't be known, and reopening them would undo a security fix.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b8e3f1a6c290"
down_revision: Union[str, None] = "a7d2e9c4b815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET status = 'inactive' "
        "WHERE status = 'active' AND user_id IN "
        "(SELECT user_id FROM receptionists WHERE is_active = false AND user_id IS NOT NULL)"
    )
    op.execute(
        "UPDATE refresh_tokens SET revoked = true "
        "WHERE revoked = false AND user_id IN "
        "(SELECT user_id FROM receptionists WHERE is_active = false AND user_id IS NOT NULL)"
    )


def downgrade() -> None:
    pass
