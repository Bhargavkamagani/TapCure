"""Month-end billing run for the hospital subscription plans, then exit.

    python -m app.jobs.monthly_invoices            # last month
    python -m app.jobs.monthly_invoices 2026-10    # a given month

Run it DAILY (cron, systemd timer, or an EventBridge Lambda via `handler`) —
or set BILLING_TICKER_ENABLED=true on one API instance instead. On the 1st it
writes last month's invoices and charges the hospitals that have UPI Autopay
on; every day it renews yearly plans, marks unpaid invoices overdue and sends
the unpaid reminders (due, +3, +7, and the 15-day online-booking pause).
Safe to run any number of times. Run it from the folder whose .env points at
the real database.
"""
import json
import logging
import sys

from ..database import SessionLocal
from ..services.billing import run_month_end

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("monthly_invoices")


def run(month: str | None = None) -> dict:
    db = SessionLocal()
    try:
        result = run_month_end(db, month)
        log.info("month-end billing: %s", result)
        return result
    finally:
        db.close()


def handler(event=None, context=None):
    """AWS Lambda entry point (EventBridge cron -> this)."""
    return {"statusCode": 200, "body": json.dumps(run((event or {}).get("month")))}


if __name__ == "__main__":
    print(json.dumps(run(sys.argv[1] if len(sys.argv) > 1 else None), indent=2))
