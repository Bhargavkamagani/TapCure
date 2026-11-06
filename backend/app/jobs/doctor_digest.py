"""Send every doctor's morning schedule that has come due, then exit.

    python -m app.jobs.doctor_digest            # respects each hospital's local hour
    python -m app.jobs.doctor_digest --force    # ignore the hour, still once per doctor

A one-shot, like app/jobs/medicine_tick.py, so the same file works from cron, a
systemd timer, or an EventBridge-triggered Lambda (`handler` below). Schedule it
*more often* than you need — hourly is fine — because the service decides both
whether each hospital's local morning has arrived and whether that doctor has
already been messaged today.

`--force` skips only the clock, never the once-per-day guard. It's the tool for
"the 8 AM run didn't happen, send it now at 10", and it cannot double-send.
"""
import json
import logging
import sys

from ..database import SessionLocal
from ..services.doctor_digest import send_daily_schedules

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("doctor_digest")


def run(force: bool = False) -> dict:
    db = SessionLocal()
    try:
        result = send_daily_schedules(db, force=force)
        log.info("doctor daily digest: %s", result)
        return result
    finally:
        db.close()


def handler(event=None, context=None):
    """AWS Lambda entry point (EventBridge cron -> this)."""
    force = bool((event or {}).get("force")) if isinstance(event, dict) else False
    return {"statusCode": 200, "body": json.dumps(run(force))}


if __name__ == "__main__":
    print(json.dumps(run("--force" in sys.argv), indent=2))
