"""
Attempt limits: how many times one caller may try something before we say no.

Why this exists in the app and not in nginx: nginx counts requests per IP. The
things that actually needed limiting are counted per ACCOUNT — six wrong OTPs
for one phone number, twenty wrong passwords for one email — and an attacker
rotating IPs (or a whole hostel behind one NAT) makes the IP the wrong unit
either way. nginx's per-IP limit is still worth having; it is a different, and
complementary, control.

What was open before this:
  * 40 wrong OTPs accepted in a row. Six digits, ten-minute window, no counter
    at all — every patient account was guessable.
  * 25 wrong passwords with no lockout, alongside a password policy that
    accepts "123456".
  * OTP request, password reset, registration and the public contact form could
    each be called without limit: SMS/WhatsApp cost, a flooded inbox, junk
    accounts, and a contact form that sends a real email every time.

Storage is in-process, deliberately matching `otp_store`: one API instance, and
counters that reset on restart. That is honest for this deployment and wrong for
a scaled one — with several instances each keeps its own count, so the effective
limit multiplies by the number of instances. Swap `_HITS` for Redis (INCR +
EXPIRE) when there is more than one; the interface here does not change.

A limit reached returns 429 with the seconds to wait, never a hint about
whether the account exists.
"""
import time
from dataclasses import dataclass

from fastapi import HTTPException, status

# key -> list of attempt timestamps, newest last
_HITS: dict[str, list[float]] = {}


@dataclass(frozen=True)
class Limit:
    """`times` attempts allowed per `per_seconds`, then locked for `block_seconds`."""
    times: int
    per_seconds: int
    block_seconds: int


# The numbers are deliberately loose enough that a person fumbling their own
# password or waiting for a slow SMS never meets them, and tight enough that
# guessing a 6-digit code is hopeless.
LOGIN = Limit(times=10, per_seconds=15 * 60, block_seconds=15 * 60)
# Per IP, this has to be much looser than per account. A hospital is one building
# on one internet connection: the biggest hospital in this database has 67
# staff accounts, so ten fumbled passwords between them — a Monday morning —
# would otherwise lock out the entire front desk, the doctors and the admin at
# once. Per ACCOUNT stays at 10, which is what actually stops one account being
# ground down; this is only a backstop against one machine spraying passwords
# across many accounts.
LOGIN_PER_IP = Limit(times=50, per_seconds=15 * 60, block_seconds=10 * 60)
OTP_VERIFY = Limit(times=5, per_seconds=10 * 60, block_seconds=15 * 60)
OTP_REQUEST = Limit(times=5, per_seconds=15 * 60, block_seconds=15 * 60)
PASSWORD_RESET = Limit(times=5, per_seconds=30 * 60, block_seconds=30 * 60)
# Also per IP, and also loosened for shared connections: a waiting room full of
# patients signing up on the hospital's wifi all look like one address. Fifteen an
# hour still stops a script making hundreds.
REGISTER = Limit(times=15, per_seconds=60 * 60, block_seconds=30 * 60)
CONTACT_FORM = Limit(times=3, per_seconds=60 * 60, block_seconds=60 * 60)


def _prune(key: str, window: int, now: float) -> list[float]:
    hits = [t for t in _HITS.get(key, []) if now - t < window]
    if hits:
        _HITS[key] = hits
    else:
        _HITS.pop(key, None)
    return hits


def check(action: str, who: str | None, limit: Limit) -> None:
    """Raise 429 when this caller has already used up `limit`. Counts nothing.

    Call before doing the work; call `record` on the attempts that should
    count. Splitting the two is what lets a SUCCESSFUL login clear the count
    while failures keep accumulating.
    """
    if not who:
        return
    now = time.time()
    key = f"{action}:{who.strip().lower()}"
    hits = _prune(key, max(limit.per_seconds, limit.block_seconds), now)
    if len(hits) >= limit.times:
        retry_after = int(limit.block_seconds - (now - hits[-1]))
        if retry_after > 0:
            minutes = max(1, round(retry_after / 60))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Too many attempts. Please try again in about {minutes} minute"
                f"{'s' if minutes != 1 else ''}.",
                headers={"Retry-After": str(retry_after)},
            )


def record(action: str, who: str | None) -> None:
    """Count one attempt against this caller."""
    if not who:
        return
    _HITS.setdefault(f"{action}:{who.strip().lower()}", []).append(time.time())


def clear(action: str, who: str | None) -> None:
    """Forget this caller's attempts — called when they finally succeed."""
    if who:
        _HITS.pop(f"{action}:{who.strip().lower()}", None)
