"""Close each doctor's day once their session end has passed, then exit.

    python -m app.jobs.doctor_day_close            # respects each doctor's session end
    python -m app.jobs.doctor_day_close --force    # ignore the clock, still once per doctor

The evening counterpart to app/jobs/doctor_digest.py, and deployed the same way:
cron, a systemd timer, or an EventBridge-triggered Lambda (`handler` below).

Schedule it *more often* than you think you need — every 15 minutes is sensible.
Doctors finish at different times, and the service decides per doctor whether
their own session end has passed, so an extra run costs nothing and a missed one
is picked up by the next. The message lands within one interval of closing time,
which is the only thing the interval controls.

`--force` skips only the clock, never the once-per-day guard, so a manual run to
fix a missed evening cannot double-send.
"""
import json
import logging
import sys

from ..database import SessionLocal
from ..services.doctor_digest import send_day_complete

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("doctor_day_close")


def run(force: bool = False) -> dict:
    db = SessionLocal()
    try:
        result = send_day_complete(db, force=force)
        log.info("doctor day close: %s", result)
        return result
    finally:
        db.close()


def handler(event=None, context=None):
    """AWS Lambda entry point (EventBridge cron -> this)."""
    force = bool((event or {}).get("force")) if isinstance(event, dict) else False
    return {"statusCode": 200, "body": json.dumps(run(force))}


if __name__ == "__main__":
    print(json.dumps(run("--force" in sys.argv), indent=2))
