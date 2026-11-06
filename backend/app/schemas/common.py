"""Validators shared across schema modules.

Registration numbers live here rather than in `doctor.py` because two unrelated
things carry one: a doctor's State Medical Council number, and a hospital's
clinical-establishment licence. The rule is the same for both, and a hospital
schema importing from the doctor module to get it would be a lie about where
the concept belongs.
"""
import re
from typing import Optional


# Registration numbers have NO single national format. A doctor's is issued by
# their State Medical Council; a hospital's by the district/state authority under
# the Clinical Establishments Act (or the state's own act). Both are usually a
# running serial, so the length genuinely varies:
#
#   Karnataka / Tamil Nadu / UP / Bihar   128940          (bare digits)
#   Telangana / Andhra Pradesh            TSMC/FMR/12345
#   Delhi                                 DMC/R/09876
#   Maharashtra                           2011/03/1234    (year/month/serial)
#
# So this checks PLAUSIBILITY, not an exact shape: sane length, at least four
# digits somewhere, no junk characters. A strict pattern would reject real
# certificates from whichever states we failed to anticipate, and leave those
# hospitals unable to register at all.
#
# Kept identical to the browser rules in `components/doctor/onboardingValidation.js`
# and `lib/regNumber.js`, so the two can never disagree — this one is the gate
# that actually holds, since any client can post straight to the API.
MAX_REG_NO = 20
MIN_REG_DIGITS = 4
_REG_NO_CHARS = re.compile(r"^[A-Za-z0-9][A-Za-z0-9/\- ]*$")


def validate_registration_number(v: Optional[str]) -> Optional[str]:
    """Trim and shape-check a registration number. Blank -> None."""
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if len(s) < 4:
        raise ValueError("Registration number is too short — enter it as printed on the certificate")
    if len(s) > MAX_REG_NO:
        raise ValueError(f"Registration number cannot be longer than {MAX_REG_NO} characters")
    if not _REG_NO_CHARS.match(s):
        raise ValueError("Registration number may contain only letters, numbers, hyphens and slashes")
    if sum(c.isdigit() for c in s) < MIN_REG_DIGITS:
        raise ValueError(f"A registration number has at least {MIN_REG_DIGITS} digits")
    return s
