"""Send every "time to leave" alert that has come due, then exit.

    python -m app.jobs.leave_alert_tick

Written as a one-shot so the same file works from cron, a systemd timer, or an
EventBridge-triggered Lambda (`handler` below). The engine holds all the logic;
this is only a way in.

Safe to run more often than needed: `token.notified_leave` is set inside the
sending transaction, so overlapping runs cannot send the same alert twice.

Every five minutes is a sensible cadence — the alert fires 15 minutes before
the patient's departure time, so a five-minute granularity is well inside the
margin.
"""
import json
import logging

from ..config import settings
from ..database import SessionLocal
from ..services.token_engine import dispatch_leave_alerts

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("leave_alert_tick")


def run() -> dict:
    db = SessionLocal()
    try:
        result = dispatch_leave_alerts(db, limit=settings.leave_alert_batch_limit)
        log.info("leave alerts: %s", result)
        return result
    finally:
        db.close()


def handler(event=None, context=None):
    """AWS Lambda entry point (EventBridge cron -> this)."""
    return {"statusCode": 200, "body": json.dumps(run())}


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
