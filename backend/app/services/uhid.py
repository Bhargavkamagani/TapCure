"""
UHID — Unique Health ID for patients.

A UHID is the human-facing, lifetime identifier printed on a patient's card and
token slip (e.g. ``DM-7F3K9Q2``). It is distinct from ``patient_id`` (the internal
auto-increment PK used for foreign keys): the UHID is what staff read aloud,
write down and scan, so it is designed to be:

  * non-guessable     — random body, so patient counts can't be enumerated;
  * unambiguous       — drawn from an alphabet with the confusable characters
                        (0/O, 1/I/L, U) removed, so it survives being read over a
                        phone or hand-written;
  * self-checking     — the final character is a Luhn mod-N check digit, so a
                        single mistyped/transposed character is rejected
                        *before* we ever hit the database.

Layout:  ``<PREFIX>-<BODY><CHECK>``  e.g.  ``DM-7F3K9Q`` + ``2``  →  ``DM-7F3K9Q2``
         PREFIX  brand/hospital code (default "DM" — Doctor Mitra)
         BODY    6 random chars from ALPHABET
         CHECK   1 Luhn mod-N check character computed over BODY
"""
import secrets

# 30 unambiguous characters: digits 2-9 and A-Z minus the easily-confused
# I, L, O, U. Read-aloud / hand-written friendly. (Order is fixed forever —
# changing it would invalidate every previously issued check digit.)
ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
_N = len(ALPHABET)
_INDEX = {c: i for i, c in enumerate(ALPHABET)}

PREFIX = "DM"
BODY_LEN = 6


def _check_char(payload: str) -> str:
    """Luhn mod-N check character for ``payload`` (chars must be in ALPHABET)."""
    factor, total = 2, 0
    for ch in reversed(payload):
        addend = factor * _INDEX[ch]
        factor = 1 if factor == 2 else 2
        addend = (addend // _N) + (addend % _N)
        total += addend
    return ALPHABET[(_N - (total % _N)) % _N]


def _is_check_valid(payload_with_check: str) -> bool:
    """True if the trailing check character agrees with the body."""
    factor, total = 1, 0
    try:
        for ch in reversed(payload_with_check):
            addend = factor * _INDEX[ch]
            factor = 1 if factor == 2 else 2
            addend = (addend // _N) + (addend % _N)
            total += addend
    except KeyError:
        return False
    return total % _N == 0


def generate(prefix: str = PREFIX) -> str:
    """Return a fresh UHID like ``DM-7F3K9Q2``. Uniqueness is enforced by the DB;
    callers retry on the (vanishingly rare) collision."""
    body = "".join(secrets.choice(ALPHABET) for _ in range(BODY_LEN))
    return f"{prefix}-{body}{_check_char(body)}"


def allocate(db) -> str:
    """A UHID not already taken in the DB. Collisions are astronomically rare
    (30^6 space); we retry a handful of times before giving up. Used by every
    code path that creates a patient (front-desk *and* self-registration)."""
    from sqlalchemy import select  # local import keeps this module ORM-light
    from ..models import Patient
    for _ in range(8):
        code = generate()
        if not db.scalar(select(Patient.patient_id).where(Patient.uhid == code)):
            return code
    raise RuntimeError("Could not allocate a unique UHID after several attempts")


def normalise(raw: str) -> str:
    """Canonicalise user/QR input: upper-case, drop spaces/dashes, re-apply the
    canonical prefix dash. ``" dm-7f3k9q2 "`` → ``"DM-7F3K9Q2"``. Genuinely wrong
    characters are left in place so the check-digit step can reject them."""
    s = "".join(c for c in (raw or "").upper() if c.isalnum())
    if s.startswith(PREFIX):
        return f"{PREFIX}-{s[len(PREFIX):]}"
    return s


def is_valid(raw: str) -> bool:
    """True if ``raw`` is a structurally valid UHID with a correct check digit."""
    s = normalise(raw)
    body_check = s.split("-", 1)[-1]
    return len(body_check) == BODY_LEN + 1 and _is_check_valid(body_check)
