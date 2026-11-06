"""Keep every copy of a mobile number in step, even for hand-written SQL.

The number that identifies a patient is stored in more than one column, and the
features that read it disagree about which one: login resolves `users.phone`,
every reminder resolves `patients.phone`, and an OTP-only account additionally
carries the number *inside* its placeholder email. `services/accounts.py::
change_phone` keeps them together for anything coming through the API — but a
number edited straight in psql skips the application entirely, and a partial
edit is what leaves login on the new number while messages keep going to the
old one.

These triggers put the same rule inside the database, so it holds no matter who
writes. `users` is the source of truth: change the number there and everything
that follows it moves in the same transaction.

Deliberately one-directional. A trigger on `patients` that wrote back to `users`
would let the two bounce off each other, so `patients` only ever maintains its
own placeholder email. Also deliberately absent: `sms_logs` / `whatsapp_logs`,
which record where a message actually went at the time and must stay true.

Revision ID: c3d7e9f1a4b2
Revises: f8a4c2d7e1b9
"""
from alembic import op

revision = "c3d7e9f1a4b2"
down_revision = "f8a4c2d7e1b9"
branch_labels = None
depends_on = None

PLACEHOLDER = "%@mobile.tapcure.in"


def upgrade() -> None:
    # 1. A user's own placeholder email follows their own number. BEFORE, so it
    #    is part of the same row write rather than a second UPDATE.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION tapcure_sync_user_email() RETURNS trigger AS $$
        BEGIN
          IF NEW.phone IS DISTINCT FROM OLD.phone
             AND NEW.phone IS NOT NULL AND NEW.phone <> ''
             AND OLD.email LIKE '%@mobile.tapcure.in' THEN
            NEW.email := NEW.phone || '@mobile.tapcure.in';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS users_sync_placeholder_email ON users;")
    op.execute(
        """
        CREATE TRIGGER users_sync_placeholder_email
          BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION tapcure_sync_user_email();
        """
    )

    # 2. Everything that follows the account's number. AFTER, because these are
    #    other rows in other tables.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION tapcure_cascade_user_phone() RETURNS trigger AS $$
        BEGIN
          IF NEW.phone IS DISTINCT FROM OLD.phone
             AND NEW.phone IS NOT NULL AND NEW.phone <> '' THEN

            -- Dependents whose "own" number IS the account holder's line. This
            -- must run BEFORE the patient rows move: it recognises them by
            -- matching the OLD number, which is gone a statement later. A
            -- dependent with a genuinely separate number never matches.
            UPDATE family_members fm
               SET phone = NEW.phone
              FROM patients p
             WHERE fm.patient_id = p.patient_id
               AND p.user_id = NEW.user_id
               AND fm.notify_to = 'own'
               AND fm.phone = OLD.phone;

            -- Every patient record this person holds - one per clinic visited.
            -- Found by user_id, not by the old number, so a row that has
            -- already drifted is still corrected.
            UPDATE patients
               SET phone = NEW.phone,
                   email = CASE WHEN email LIKE '%@mobile.tapcure.in'
                                THEN NEW.phone || '@mobile.tapcure.in'
                                ELSE email END
             WHERE user_id = NEW.user_id
               AND phone IS DISTINCT FROM NEW.phone;
          END IF;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS users_cascade_phone ON users;")
    op.execute(
        """
        CREATE TRIGGER users_cascade_phone
          AFTER UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION tapcure_cascade_user_phone();
        """
    )

    # 3. A patient row edited directly still keeps its own placeholder honest.
    #    It never writes back to `users` - that is what would let the two
    #    triggers bounce off each other.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION tapcure_sync_patient_email() RETURNS trigger AS $$
        BEGIN
          IF NEW.phone IS DISTINCT FROM OLD.phone
             AND NEW.phone IS NOT NULL AND NEW.phone <> ''
             AND OLD.email LIKE '%@mobile.tapcure.in' THEN
            NEW.email := NEW.phone || '@mobile.tapcure.in';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute("DROP TRIGGER IF EXISTS patients_sync_placeholder_email ON patients;")
    op.execute(
        """
        CREATE TRIGGER patients_sync_placeholder_email
          BEFORE UPDATE ON patients
          FOR EACH ROW EXECUTE FUNCTION tapcure_sync_patient_email();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS patients_sync_placeholder_email ON patients;")
    op.execute("DROP TRIGGER IF EXISTS users_cascade_phone ON users;")
    op.execute("DROP TRIGGER IF EXISTS users_sync_placeholder_email ON users;")
    op.execute("DROP FUNCTION IF EXISTS tapcure_sync_patient_email();")
    op.execute("DROP FUNCTION IF EXISTS tapcure_cascade_user_phone();")
    op.execute("DROP FUNCTION IF EXISTS tapcure_sync_user_email();")
