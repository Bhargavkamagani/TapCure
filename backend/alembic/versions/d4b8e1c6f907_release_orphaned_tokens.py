"""Release queue tokens left live by a cancelled appointment.

Revision ID: d4b8e1c6f907
Revises: c7f2a91d4e86
Create Date: 2026-09-21 13:40:00.000000

Until 21 Sep 2026 `appointments._do_cancel` marked an appointment cancelled
without touching its queue token, so the token stayed `waiting` for ever. Half
the system knew the visit was off and half did not.

The consequences were not cosmetic. A cancelled patient remained in the
doctor's queue, inflating every later patient's position and ETA, and stayed
eligible for every patient-facing alert. Nothing surfaced it while alerts only
fired when staff touched the queue; the moment a clock-driven sweep existed,
three patients were told to begin an eleven-hour journey for visits they had
themselves cancelled.

The code path is fixed (`_do_cancel` now releases the token, and both alerts
ask the APPOINTMENT via `token_engine._visit_is_off`). This migration clears the
rows already stranded — 11 on the development database, oldest dated 5 August,
and the server will have its own set. A migration rather than a one-off script
precisely so every environment is repaired on deploy without anyone having to
remember.

Idempotent: re-running matches nothing once the rows are clean.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4b8e1c6f907"
# Chains off d4b7e1c9a305 (one-session-per-user), not c7f2a91d4e86: that was the
# head when this repair was written, but a second migration had been added off
# it earlier the same day. Two children of one revision is a fork, and alembic
# then refuses `upgrade head` as ambiguous. Keep the chain linear.
down_revision: Union[str, None] = "d4b7e1c9a305"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(bind, name: str) -> bool:
    return sa.inspect(bind).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()
    # Guarded like 8d9f0a1b2c3d: a database that predates either table must not
    # fail the whole upgrade over a data tidy-up.
    if not (_has_table(bind, "tokens") and _has_table(bind, "appointments")):
        return

    result = bind.execute(sa.text("""
        UPDATE tokens
           SET status = 'cancelled',
               queue_position = 0
         WHERE status IN ('waiting', 'current')
           AND appointment_id IS NOT NULL
           AND appointment_id IN (
                 SELECT appointment_id
                   FROM appointments
                  WHERE status IN ('cancelled', 'no_show', 'rejected')
               )
    """))
    # Printed rather than silent: on a server this is the only evidence of how
    # much had accumulated, and "0" is a meaningful answer worth seeing too.
    print(f"[release_orphaned_tokens] released {result.rowcount} orphaned token(s)")

    # Deliberately NOT renumbering the affected queues here. `recompute_positions`
    # is Python and cannot be called from a migration without importing half the
    # service layer. Past dates do not matter, and any future queue is renumbered
    # by the next queue action (call next, complete, cancel, generate) before a
    # patient sees a position. `scripts/release_orphaned_tokens.py` does renumber,
    # and remains the tool to use when the queues are live TODAY.


def downgrade() -> None:
    # Intentionally a no-op. Nothing records which tokens were `waiting` versus
    # `current` before this ran, so the previous state cannot be reconstructed —
    # and resurrecting tokens for cancelled visits would restore the exact fault
    # this migration exists to clear: patients messaged about visits that are off.
    pass
