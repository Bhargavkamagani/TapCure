"""Dispatch every medicine reminder that has come due, then exit.

    python -m app.jobs.medicine_tick

Written as a one-shot so the same file works from cron, a systemd timer, or an
EventBridge-triggered Lambda (`handler` below). The engine holds all the logic;
this is only a way in. Safe to run more often than needed — a dose is claimed
inside the sending transaction, so overlapping runs cannot double-send.
"""
import json
import logging

from ..config import settings
from ..database import SessionLocal
from ..services.reminder_engine import dispatch_due

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("medicine_tick")


def run() -> dict:
    db = SessionLocal()
    try:
        result = dispatch_due(db, limit=settings.reminder_batch_limit)
        log.info("medicine reminders: %s", result)
        return result
    finally:
        db.close()


def handler(event=None, context=None):
    """AWS Lambda entry point (EventBridge cron -> this)."""
    return {"statusCode": 200, "body": json.dumps(run())}


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
