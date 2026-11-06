"""first_name / last_name for people; existing names are split.

Revision ID: c3d0ffee0003
Revises: b2c0ffee0002
Create Date: 2026-10-26 12:00:00.000000

Adds two nullable columns to users, patients, family_members and doctors.
`name` (the full name every screen reads) is kept and untouched.

Existing rows are split the way the app splits a name: a leading title
(Dr./Mr./Mrs./Ms./Prof.) is ignored, the last word is the last name and
everything before it the first name — "Sai Krishna Reddy" -> Sai Krishna /
Reddy, "Ramesh K" -> Ramesh / K, "Dr. Rahul Sharma" -> Rahul / Sharma.
A single word becomes the first name with no last name. People can correct
it on their profile.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3d0ffee0003"
down_revision: Union[str, None] = "b2c0ffee0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = {"users": "user_id", "patients": "patient_id", "family_members": "member_id", "doctors": "doctor_id"}
TITLES = {"dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof."}


def _split(full):
    words = [w for w in " ".join(str(full or "").split()).split(" ") if w]
    if len(words) > 1 and words[0].lower() in TITLES:
        words = words[1:]
    if len(words) >= 2:
        return " ".join(words[:-1])[:100], words[-1][:100]
    return (words[0][:100] if words else None), None


def upgrade() -> None:
    bind = op.get_bind()
    for table, pk in TABLES.items():
        op.add_column(table, sa.Column("first_name", sa.String(100), nullable=True))
        op.add_column(table, sa.Column("last_name", sa.String(100), nullable=True))
        rows = bind.execute(sa.text(f'SELECT {pk}, name FROM {table}')).all()
        updates = []
        for row_id, name in rows:
            first, last = _split(name)
            if first:
                updates.append({"id": row_id, "f": first, "l": last})
        if updates:
            bind.execute(sa.text(f"UPDATE {table} SET first_name = :f, last_name = :l WHERE {pk} = :id"), updates)
        print(f"[names] {table}: {len(updates)} of {len(rows)} rows split")


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, "last_name")
        op.drop_column(table, "first_name")
