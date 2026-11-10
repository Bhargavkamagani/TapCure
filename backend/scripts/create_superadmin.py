"""
Create (or re-password) the platform owner — run ON THE SERVER.

    python -m scripts.create_superadmin                # asks for everything
    python -m scripts.create_superadmin --email a@b.c  # asks only for the password
    python -m scripts.create_superadmin --dry-run      # says what it WOULD do

Why this exists: only a SUPER_ADMIN can create another SUPER_ADMIN (the API
enforces it), and the admin console has no "create user" screen at all. So the
demo owner shipped in `app/seed.py` was the only way in — with a password
written in the source, which is exactly what had to stop. This is the
replacement: make your own owner first, prove you can sign in, and only then
disable the demo accounts.

It is also the way back in if every admin account is ever locked out, because it
runs against the database instead of through the app.

Safety, deliberately:
  * The password is typed hidden and is NEVER accepted as a command-line
    argument — that would put it in shell history and in `ps` for everyone on
    the box. It is never printed or logged either.
  * Stored bcrypt-hashed, the same as any other password.
  * Weak and short passwords are refused.
  * Changing an EXISTING account shows you that account and asks for a typed
    confirmation first.
  * Every run writes an audit row, so this cannot be done quietly.
  * `--dry-run` changes nothing.

What it cannot protect against: anyone who can run it already has shell access
to the server, and could reach the database anyway. The audit row is the
control that remains.
"""
import argparse
import getpass
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models import AuditLog, Role, User  # noqa: E402
from app.rbac import ROLE_SUPER_ADMIN  # noqa: E402
from app.security import hash_password  # noqa: E402

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MIN_PASSWORD = 12
# Refused outright. Not a full dictionary — just the ones that actually get
# typed when someone is in a hurry, including the demo passwords this script
# exists to replace.
BANNED = {
    "password", "password1", "password@123", "admin@123", "super@123",
    "superadmin", "12345678", "123456789", "qwerty123", "letmein123",
    "changeme123", "tapcure@123", "welcome@123",
}


def _ask_password() -> str:
    while True:
        pw = getpass.getpass("New password (typing is hidden): ")
        if len(pw) < MIN_PASSWORD:
            print(f"  Too short — at least {MIN_PASSWORD} characters.")
            continue
        if pw.lower() in BANNED or pw.lower().replace(" ", "") in BANNED:
            print("  That password is too common. Pick something else.")
            continue
        if pw != getpass.getpass("Type it again: "):
            print("  They don't match.")
            continue
        return pw


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or re-password the platform owner.")
    parser.add_argument("--email", help="owner's email address (asked for if omitted)")
    parser.add_argument("--name", default="Platform Owner", help="display name for a NEW account")
    parser.add_argument("--phone", default="", help="10-digit mobile for a NEW account (optional)")
    parser.add_argument("--dry-run", action="store_true", help="show what would happen, change nothing")
    args = parser.parse_args()

    email = (args.email or input("Owner email: ")).strip().lower()
    if not EMAIL_RE.match(email):
        print(f"'{email}' is not a valid email address.")
        return 2

    db = SessionLocal()
    try:
        role = db.scalar(select(Role).where(Role.name == ROLE_SUPER_ADMIN))
        if not role:
            print("No SUPER_ADMIN role in this database. Is DATABASE_URL pointing at the right one?")
            return 2

        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            current_role = existing.role.name if existing.role else "(none)"
            print("\nThis account already exists:")
            print(f"  id {existing.user_id} | {existing.name} | role {current_role} | status {existing.status}")
            print("It will get a NEW PASSWORD" + ("" if current_role == ROLE_SUPER_ADMIN else " and be MADE A SUPER ADMIN") + ".")
            if args.dry_run:
                print("\n--dry-run: nothing was changed.")
                return 0
            if input('Type "yes" to continue: ').strip().lower() != "yes":
                print("Cancelled. Nothing changed.")
                return 1
        elif args.dry_run:
            print(f"\n--dry-run: would CREATE super admin {email}. Nothing was changed.")
            return 0

        password = _ask_password()

        if existing:
            existing.password_hash = hash_password(password)
            existing.role_id = role.role_id
            existing.status = "active"
            # Any pass handed out before this moment stops working (one session
            # per account, app/deps.py) — a reset must not leave an old device
            # signed in.
            existing.session_id = None
            user = existing
            action = "superadmin.password_reset"
        else:
            user = User(
                name=args.name.strip() or "Platform Owner",
                email=email,
                phone=args.phone.strip() or None,
                password_hash=hash_password(password),
                role_id=role.role_id,
                hospital_id=None,          # the platform owner belongs to no hospital
                status="active",
                is_email_verified=True,
            )
            db.add(user)
            db.flush()
            action = "superadmin.created"

        db.add(AuditLog(
            hospital_id=None, user_id=user.user_id, user_role=ROLE_SUPER_ADMIN,
            module="auth", action=action, entity_type="user", entity_id=user.user_id,
            new_value={"email": email, "by": f"server console ({getpass.getuser()})"},
            ip_address=None, user_agent="scripts/create_superadmin.py", request_id=None,
        ))
        db.commit()

        print(f"\nDone — {email} is a platform owner (id {user.user_id}).")
        print("Sign in on the hospital login page to check it works, THEN disable the demo accounts.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
