"""
Tiny in-process OTP store with TTL.

Good enough for local/dev (password-reset OTPs). In production this is exactly
what Redis (with native key expiry) replaces — same interface, swap the backend.
"""
import hmac
import time
from typing import Optional

_STORE: dict[str, tuple[str, float, int]] = {}  # key -> (code, expires, wrong guesses)
_TTL_SECONDS = 10 * 60
# A code dies after this many wrong guesses, whatever the caller does. The
# routers also lock the account/number (services/attempts.py); this is the
# backstop for any caller that forgets to — reset-password and OTP sign-up both
# did, and 40 wrong codes followed by the right one still worked.
_MAX_WRONG = 5


def put(key: str, code: str) -> None:
    _STORE[key] = (code, time.time() + _TTL_SECONDS, 0)


def verify(key: str, code: str) -> bool:
    item: Optional[tuple[str, float, int]] = _STORE.get(key)
    if not item:
        return False
    saved, expires, wrong = item
    if time.time() > expires:
        _STORE.pop(key, None)
        return False
    if not hmac.compare_digest(saved, str(code or "")):
        if wrong + 1 >= _MAX_WRONG:
            _STORE.pop(key, None)  # burnt: a new code must be requested
        else:
            _STORE[key] = (saved, expires, wrong + 1)
        return False
    _STORE.pop(key, None)  # one-time use
    return True
