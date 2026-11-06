"""One free revisit per PERSON, not per account.

`uq_revisit_pass_active` was unique on (patient_id, doctor_id) while every other
part of the feature — issue, lookup, redeem — already keys on the family member
as well. The index was the odd one out, and it lost:

    Raju books for his sister Raji. Raji's consultation completes and earns a
    pass, correctly recorded against her. Raju then sees the same doctor himself
    and earns one too — and the INSERT collides with Raji's row, because both are
    (patient=Raju's account, doctor=same). `maybe_issue` catches IntegrityError
    and returns None by design, so Raju is simply never told he had one.

The same collision hits two siblings on one account. On a family account with a
regular doctor it is not an edge case, it is the normal case.

COALESCE rather than a plain three-column index: in SQL, NULL != NULL, so
(patient, doctor, NULL) would never collide with itself and the account holder
would lose the double-issue guard entirely — trading one bug for another. 0 is
safe as the sentinel because member_id is autoincrement and starts at 1.

No data migration. Existing passes are unaffected; only the constraint widens,
so nothing that is currently legal becomes illegal.

Revision ID: e7a3c9d51f84
Revises: d2f5a8c93b17
"""
from alembic import op
import sqlalchemy as sa

revision = "e7a3c9d51f84"
down_revision = "d2f5a8c93b17"
branch_labels = None
depends_on = None

_OLD = "uq_revisit_pass_active"
_NEW = "uq_revisit_pass_active_person"


def _indexes() -> set[str]:
    return {i["name"] for i in sa.inspect(op.get_bind()).get_indexes("revisit_passes")}


def upgrade() -> None:
    # Self-healing, like the rest of this chain: re-running must not abort it.
    have = _indexes()
    if _NEW not in have:
        op.execute(
            f"CREATE UNIQUE INDEX {_NEW} ON revisit_passes "
            "(patient_id, doctor_id, COALESCE(family_member_id, 0)) "
            "WHERE status = 'active'"
        )
    # Dropped only after the replacement exists, so the guard is never absent.
    if _OLD in _indexes():
        op.execute(f"DROP INDEX {_OLD}")


def downgrade() -> None:
    have = _indexes()
    if _OLD not in have:
        op.execute(
            f"CREATE UNIQUE INDEX {_OLD} ON revisit_passes (patient_id, doctor_id) "
            "WHERE status = 'active'"
        )
    if _NEW in _indexes():
        op.execute(f"DROP INDEX {_NEW}")
