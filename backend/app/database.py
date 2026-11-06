"""
SQLAlchemy engine, session factory and declarative Base.

`get_db` is the FastAPI dependency every router uses to obtain a request-scoped
session that is always closed afterwards.
"""
import json
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import Uuid, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# Every primary key and every foreign key is a UUID (2026-10-25; they were
# BIGINT before — migration a1f0c0de0001 converted the data). Native `uuid` on
# Postgres, CHAR(32) on SQLite. Ids can't be guessed or counted from outside.
UUIDType = Uuid(as_uuid=True)

_v7_lock = threading.Lock()
_v7_last = [0, 0]  # last millisecond, counter within it


def new_uuid() -> uuid.UUID:
    """A time-ordered UUID (version 7, RFC 9562): 48-bit Unix-ms timestamp,
    then randomness. Newer rows sort after older ones, so "latest by id"
    (order_by(id.desc())) keeps working as it did with integer ids. A counter
    keeps ids made within the same millisecond in creation order."""
    with _v7_lock:
        ms = time.time_ns() // 1_000_000
        if ms <= _v7_last[0]:
            ms = _v7_last[0]
            _v7_last[1] += 1
            if _v7_last[1] > 0xFFF:          # 4096 ids in one ms: borrow the next ms
                ms += 1
                _v7_last[0], _v7_last[1] = ms, 0
        else:
            _v7_last[0], _v7_last[1] = ms, 0
        counter = _v7_last[1]
    rand = int.from_bytes(os.urandom(8), "big")
    value = (ms & ((1 << 48) - 1)) << 80          # unix_ts_ms
    value |= 0x7 << 76                            # version 7
    value |= counter << 64                        # rand_a: monotonic counter
    value |= 0b10 << 62                           # RFC 4122 variant
    value |= rand & ((1 << 62) - 1)               # rand_b
    return uuid.UUID(int=value)


def parse_uuid(value) -> uuid.UUID | None:
    """A UUID from a string/UUID, or None when it isn't one (bad input from a
    URL, a token, a comma list…). Never raises."""
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value).strip())
    except (TypeError, ValueError, AttributeError):
        return None


def lock_key(value) -> int:
    """A 31-bit integer from a UUID, for Postgres advisory-lock keys (which are
    integers). Two ids sharing a key only means one waits for the other."""
    return uuid.UUID(str(value)).int & 0x7FFFFFFF


def utcnow() -> datetime:
    # Naive UTC: SQLite returns naive datetimes on read, so storing naive UTC
    # keeps all comparisons consistent across SQLite/MySQL/Postgres.
    return datetime.now(timezone.utc).replace(tzinfo=None)

# Per-driver connection args:
#  - SQLite needs check_same_thread=False to be used across FastAPI's threadpool.
#  - Postgres columns are timestamptz, but the app writes *naive* UTC (utcnow()).
#    Without a fixed session timezone, Postgres interprets those naive values in
#    the server's local tz (e.g. IST +05:30) — so stored instants come back
#    hours off and elapsed/ETA timers read e.g. "331:26". Pinning the session
#    timezone to UTC makes it interpret the naive UTC values as UTC.
if settings.database_url.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
elif settings.database_url.startswith("postgresql"):
    _connect_args = {"options": "-c timezone=utc"}
else:
    _connect_args = {}

# SQLite has no connection pool worth configuring (one file, one writer), and
# passing pool arguments to it raises. Only the real databases get the pool.
_pool_args = {} if settings.database_url.startswith("sqlite") else {
    "pool_size": settings.db_pool_size,
    "max_overflow": settings.db_max_overflow,
    "pool_timeout": settings.db_pool_timeout,
    "pool_recycle": settings.db_pool_recycle_seconds,
}

def _json_default(value):
    # Ids are UUIDs: audit details, notification payloads, receptionist
    # assignments… put them in JSON columns. Store them as their string form.
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime,)):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def json_dumps(value) -> str:
    return json.dumps(value, default=_json_default)


engine = create_engine(
    settings.database_url,
    json_serializer=json_dumps,
    connect_args=_connect_args,
    pool_pre_ping=True,
    echo=False,
    future=True,
    **_pool_args,
)

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
