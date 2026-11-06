"""Close out visits still open after their day has passed, then exit.

    python -m app.jobs.close_stale_visits

Written as a one-shot so the same file works from cron, a systemd timer, or an
EventBridge-triggered Lambda (`handler` below). The engine holds all the logic;
this is only a way in.

Safe to run as often as you like: it only ever looks at dates strictly BEFORE
today, and a token it has already closed is no longer `waiting`, so a second run
finds nothing. Once an hour is plenty.

Sends nothing. The first run on an existing database will close whatever has
accumulated — 138 tokens as of 22 Sep 2026, the oldest from 12 June — and no
patient hears a word about it, which is the intent: a "you missed your visit"
message three months late would alarm people about a visit they have forgotten.
"""
import json
import logging

from ..config import settings
from ..database import SessionLocal
from ..services.token_engine import close_stale_visits

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("close_stale_visits")


def run() -> dict:
    db = SessionLocal()
    try:
        result = close_stale_visits(db, limit=settings.stale_visit_batch_limit)
        log.info("stale visits closed: %s", result)
        return result
    finally:
        db.close()


def handler(event=None, context=None):
    """AWS Lambda entry point (EventBridge cron -> this)."""
    return {"statusCode": 200, "body": json.dumps(run())}


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))
