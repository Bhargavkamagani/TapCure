"""Record when a patient actually took a dose.

`medicine_reminders.status` has only ever described what WE did — pending, sent,
failed, skipped. "sent" means a message left the building; it says nothing about
whether the tablet was swallowed. So the app could show a patient a list of
reminders and had no way to tell which ones they had acted on.

`taken` goes in the existing status column (it fits inside String(12), no change
needed there). The one thing with nowhere to live is the TIME, which is what
this column adds — the screen shows "Taken at 08:05 AM", and later it is what
makes adherence answerable: "took 8 of 10 doses".

Nullable, and nothing is backfilled: for every dose already in the table we
genuinely do not know whether it was taken, and inventing a time would turn an
unknown into a false record on a medical screen.

Cost is small and worth stating plainly, since it was asked: a timestamp is 8
bytes per row, and this adds a field to rows that already exist rather than
creating new ones. At a million doses that is ~8 MB.

Marking a dose taken does NOT change what gets sent. The schedule still drives
delivery; an un-marked dose is still reminded about at its time. The only
interaction is that a dose marked taken BEFORE its reminder goes out is no
longer `pending`, so the ticker skips it — there is no point nudging someone
about a tablet they have already taken.
"""
from alembic import op
import sqlalchemy as sa


revision = "c7f2a91d4e86"
# Chains from a2e8d14c7b63, not f1a7c3e95d24: that is the revision the database
# is actually stamped at, and hanging this off f1a7c3e95d24 instead would make
# a second child of it — a fresh branch, and another "multiple heads" error.
down_revision = "a2e8d14c7b63"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "medicine_reminders",
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    # Doses marked taken revert to `sent`: that is the last thing we can still
    # assert truthfully once the timestamp is gone. Anything never sent goes
    # back to pending so the schedule picks it up again.
    op.execute(
        "UPDATE medicine_reminders SET status = CASE "
        "WHEN sent_at IS NOT NULL THEN 'sent' ELSE 'pending' END "
        "WHERE status = 'taken'"
    )
    op.drop_column("medicine_reminders", "taken_at")
