"""Stored "clinic" values become "hospital" — data only, no new tables/columns.

Revision ID: b2c0ffee0002
Revises: a1f0c0de0001
Create Date: 2026-10-25 18:00:00.000000

The product says "hospital" everywhere now. These are the VALUES the code
stores and compares; the code was changed with them (it still accepts the old
values on input, so an old app build keeps working):

  doctor_affiliations.practice_type  clinic -> hospital, personal_clinic -> personal_practice
  doctor_affiliations.name           "Clinic" -> "Hospital", "Home clinic" -> "Home practice"
                                     (the defaults the code used to write; names
                                     people typed themselves are left alone)
  notifications.audience             clinic -> hospital   (old notification TEXT is not touched)
  support_requests.role              Clinic -> Hospital
  plans.code                         smart_clinic -> smart_hospital
  plans.name, roles.description      the word clinic(s) -> hospital(s)
  audit_logs.action                  clinic.register / clinic.approve / doctor.clinic_* -> hospital

Downgrade puts the values back.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "b2c0ffee0002"
down_revision: Union[str, None] = "a1f0c0de0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VALUES = [
    ("doctor_affiliations", "practice_type", "clinic", "hospital"),
    ("doctor_affiliations", "practice_type", "personal_clinic", "personal_practice"),
    ("doctor_affiliations", "name", "Clinic", "Hospital"),
    ("doctor_affiliations", "name", "Home clinic", "Home practice"),
    ("notifications", "audience", "clinic", "hospital"),
    ("support_requests", "role", "Clinic", "Hospital"),
    ("audit_logs", "action", "clinic.register", "hospital.register"),
    ("audit_logs", "action", "clinic.approve", "hospital.approve"),
    ("audit_logs", "action", "doctor.clinic_deactivate", "doctor.hospital_deactivate"),
    ("audit_logs", "action", "doctor.clinic_reactivate", "doctor.hospital_reactivate"),
]
# whole words only, so "clinical" is never touched
WORDS = [("plans", "name"), ("roles", "description")]


def _set(old, new):
    for table, col, a, b in VALUES:
        a, b = (a, b) if old else (b, a)
        op.execute(f"UPDATE {table} SET {col} = '{b}' WHERE {col} = '{a}'")


def upgrade() -> None:
    _set(True, True)
    # The plan code. If a newer backend already started before this ran, it may
    # have made its own smart_hospital row: then move everything onto that one
    # and keep the old row under a retired code (nothing is deleted).
    op.execute("""
        DO $$
        DECLARE old_id uuid; new_id uuid;
        BEGIN
          SELECT plan_id INTO old_id FROM plans WHERE code = 'smart_clinic' LIMIT 1;
          SELECT plan_id INTO new_id FROM plans WHERE code = 'smart_hospital' LIMIT 1;
          IF old_id IS NOT NULL AND new_id IS NULL THEN
            UPDATE plans SET code = 'smart_hospital' WHERE plan_id = old_id;
          ELSIF old_id IS NOT NULL AND new_id IS NOT NULL THEN
            UPDATE subscriptions SET plan_id = new_id WHERE plan_id = old_id;
            UPDATE invoices SET plan_id = new_id WHERE plan_id = old_id;
            UPDATE plans SET code = 'smart_clinic_retired', is_active = false WHERE plan_id = old_id;
          END IF;
        END $$;
    """)
    for table, col in WORDS:
        op.execute(f"UPDATE {table} SET {col} = regexp_replace(regexp_replace(regexp_replace(regexp_replace("
                   f"{col}, '\\mClinics\\M', 'Hospitals', 'g'), '\\mClinic\\M', 'Hospital', 'g'), "
                   f"'\\mclinics\\M', 'hospitals', 'g'), '\\mclinic\\M', 'hospital', 'g') "
                   f"WHERE {col} ~* '\\mclinics?\\M'")


def downgrade() -> None:
    # The values the code compares go back exactly. The plan / role WORDING is
    # not reversed: names that always said "hospital" ("Large Hospital",
    # "Manages one hospital") can't be told apart from renamed ones.
    _set(False, False)
    op.execute("UPDATE plans SET code = 'smart_clinic' WHERE code = 'smart_hospital'")
