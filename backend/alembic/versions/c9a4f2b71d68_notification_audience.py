"""Give notifications an explicit audience.

A Notification recorded a message sent to a patient, but nothing recorded WHO it
was for. The only staff filter available was `hospital_id`, so every receptionist
and doctor at a clinic could read messages addressed to patients — including
"Your TapCure OTP is 393748". Patients log in with phone + OTP, so that was an
account-takeover path, not just noise.

Backfill classifies what already exists:
  otp                -> private  (nobody's feed; the code is also redacted)
  has a patient_id   -> patient  (booking confirmations, travel alerts)
  everything else    -> clinic   (doctor delays, announcements — front desk)

Revision ID: c9a4f2b71d68
Revises: b6e2f10a9d47
"""
from alembic import op
import sqlalchemy as sa

revision = "c9a4f2b71d68"
down_revision = "b6e2f10a9d47"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notifications",
                  sa.Column("audience", sa.String(length=10), nullable=False, server_default="patient"))
    op.add_column("notifications", sa.Column("recipient_user_id", sa.BigInteger(), nullable=True))
    op.create_index("ix_notifications_audience", "notifications", ["audience"])
    op.create_index("ix_notifications_recipient_user_id", "notifications", ["recipient_user_id"])
    op.create_foreign_key("fk_notifications_recipient_user", "notifications", "users",
                          ["recipient_user_id"], ["user_id"])

    op.execute("UPDATE notifications SET audience = 'patient' WHERE patient_id IS NOT NULL")
    op.execute("UPDATE notifications SET audience = 'clinic' WHERE patient_id IS NULL")
    op.execute("UPDATE notifications SET audience = 'private' WHERE type = 'otp'")
    # Strip codes already sitting in readable history.
    op.execute("""
        UPDATE notifications
           SET message = 'OTP sent to the patient (code hidden).'
         WHERE type = 'otp'
    """)


def downgrade() -> None:
    op.drop_constraint("fk_notifications_recipient_user", "notifications", type_="foreignkey")
    op.drop_index("ix_notifications_recipient_user_id", table_name="notifications")
    op.drop_index("ix_notifications_audience", table_name="notifications")
    op.drop_column("notifications", "recipient_user_id")
    op.drop_column("notifications", "audience")
