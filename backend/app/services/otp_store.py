"""
Tiny in-process OTP store with TTL.

Good enough for local/dev (password-reset OTPs). In production this is exactly
what Redis (with native key expiry) replaces — same interface, swap the backend.
"""
import time
from typing import Optional

_STORE: dict[str, tuple[str, float]] = {}
_TTL_SECONDS = 10 * 60


def put(key: str, code: str) -> None:
    _STORE[key] = (code, time.time() + _TTL_SECONDS)


def verify(key: str, code: str) -> bool:
    item: Optional[tuple[str, float]] = _STORE.get(key)
    if not item:
        return False
    saved, expires = item
    if time.time() > expires:
        _STORE.pop(key, None)
        return False
    if saved != code:
        return False
    _STORE.pop(key, None)  # one-time use
    return True
