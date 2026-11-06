"""Clinic always-open flag.

A clinic can declare itself open around the clock instead of naming opening
hours, so that when patients can be seen is decided by the DOCTOR's sessions
rather than by the premises' advertised window.

Scope is deliberately tiny, because patient booking never read these hours in
the first place: `services/scheduling.available_slots()` resolves a day from
the doctor's schedule, holidays, leave and already-booked times, and
`assert_reachable()` measures travel against the end of the doctor's last
session. Neither touches op_start_time/op_end_time. The only things clinic
hours ever constrained were doctors:

  * routers/doctors.py::_assert_fits_clinic  — hard 409 on a session outside
    the clinic's window or week (this flag makes it opt-out), and
  * routers/hospitals.py::_sessions_outside_hours — the advisory list shown
    when a clinic edits its hours.

Additive and reversible: one boolean, server_default false, so every existing
clinic keeps exactly the hours and the guard it has today. No table is
created, nothing is backfilled, nothing is dropped.
"""
from alembic import op
import sqlalchemy as sa


revision = "e6c3a91f4b72"
down_revision = "d8b1e6f3a9c4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "hospital_settings",
        sa.Column("always_open", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("hospital_settings", "always_open")
