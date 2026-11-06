/**
 * Field rules for doctor first-login setup.
 *
 * The backend is deliberately permissive here — `DoctorUpdate` takes
 * `registration_number: Optional[str]` with no format or length check, and
 * `ScheduleCreate.max_tokens` is a bare `int`. So anything we don't catch on
 * this side reaches the database: a one-character registration number, a fee of
 * 0.5, 900 years of experience, a negative token cap. These are the rules the
 * setup screens enforce, kept in one place so the checklist that gates the
 * Continue button and the message shown under the field can never disagree.
 *
 * Every validator returns an error string, or null when the value is fine.
 */

export const MAX_BIO = 500
export const MAX_TOKENS_LIMIT = 500
export const MIN_CONSULT_MINS = 10

const str = (v) => (v ?? '').toString().trim()

/**
 * Medical council registration numbers have NO single national format. Each
 * State Medical Council issues its own, and most are a running serial — which
 * is why the length can't be fixed:
 *
 *   Karnataka / Tamil Nadu / UP / Bihar   128940         (bare digits)
 *   Telangana / Andhra Pradesh            TSMC/FMR/12345
 *   Delhi                                 DMC/R/09876
 *   Maharashtra                           2011/03/1234   (year/month/serial)
 *
 * A doctor registered in the 1970s legitimately has 4 digits; one registering
 * today gets 6. So the rule is "plausible", not "exact": at least four digits
 * somewhere in the string, and a sane overall length. That rejects junk like
 * `abc-1` while accepting every real form above.
 *
 * MAX_REG_NO is also the input's maxLength — the field used to accept an
 * unlimited run of digits.
 */
export const MAX_REG_NO = 20
export const MIN_REG_DIGITS = 4
export const REG_NO_PLACEHOLDER = 'e.g. 128940 or TSMC/FMR/128940'

export function validateRegistrationNumber(value) {
  const v = str(value)
  if (!v) return 'Enter your medical council registration number'
  if (v.length < 4) return 'Too short — enter the number as printed on your certificate'
  if (v.length > MAX_REG_NO) return `That looks too long — a registration number is at most ${MAX_REG_NO} characters`
  if (!/^[A-Za-z0-9][A-Za-z0-9/\- ]*$/.test(v)) return 'Use only letters, numbers, hyphens and slashes'
  const digitCount = (v.match(/\d/g) || []).length
  if (digitCount < MIN_REG_DIGITS) return `A registration number has at least ${MIN_REG_DIGITS} digits — check the number on your certificate`
  return null
}

/** Optional. ABDM Healthcare Professionals Registry: `name@hpr` or a 14-digit id. */
export function validateHprId(value) {
  const v = str(value)
  if (!v) return null
  if (v.length < 4) return 'Too short for an HPR ID — or leave it blank'
  if (v.length > 64) return 'That looks too long for an HPR ID'
  if (!/^[A-Za-z0-9@._-]+$/.test(v)) return 'Use only letters, numbers, @ . _ and -'
  return null
}

export function validateExperience(value) {
  const v = str(value)
  if (!v) return null // optional
  if (!/^\d+$/.test(v)) return 'Enter a whole number of years'
  const n = Number(v)
  if (n > 70) return 'Enter years of experience, not a year'
  return null
}

export function validateFee(value, { locked = false } = {}) {
  if (locked) return null
  const v = str(value)
  if (!v) return 'Enter your consultation fee'
  if (!/^\d+$/.test(v)) return 'Enter a whole rupee amount, digits only'
  const n = Number(v)
  if (n < 1) return 'A fee of ₹0 would let anyone book — enter your real fee'
  if (n > 100000) return 'That fee looks wrong — check the amount'
  return null
}

export function validateRequiredText(value, message) {
  return str(value) ? null : message
}

export function validateBio(value) {
  const v = (value ?? '').toString()
  return v.length > MAX_BIO ? `Keep it under ${MAX_BIO} characters (currently ${v.length})` : null
}

/** Max tokens for one session. Guards the two silent failures in the old
 *  `Number(x) || 40`: `0` became 40, and `-5` was sent through as -5. */
export function validateMaxTokens(value) {
  const v = str(value)
  if (!v) return 'Enter how many tokens this session can take'
  if (!/^\d+$/.test(v)) return 'Enter a whole number'
  const n = Number(v)
  if (n < 1) return 'A session needs at least one token'
  if (n > MAX_TOKENS_LIMIT) return `That's a lot — keep it under ${MAX_TOKENS_LIMIT}`
  return null
}

/** "HH:MM" strings compare correctly as strings, which is why they're kept as
 *  strings rather than parsed. Returns an error about the pair, not one field. */
export function validateSessionTimes(start, end, consultationMins = MIN_CONSULT_MINS) {
  if (!start || !end) return 'Pick a start and end time'
  if (end <= start) return 'The end time has to be after the start time'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < consultationMins) {
    return `Too short — a session needs at least ${consultationMins} minutes to fit one consultation`
  }
  return null
}

/** All of step 2's fields, by sub-screen index. */
/**
 * `regOnRecord` means the registration number already came in with the doctor's
 * sign-up, so onboarding shows it read-only instead of asking again. Its rule is
 * then skipped deliberately: sign-up only checks the number is non-blank, so a
 * value this stricter validator rejects would otherwise block Continue on a
 * field the doctor can no longer see or edit.
 */
export function validateProfileScreen(index, form, { feeLocked = false, regOnRecord = false } = {}) {
  if (index === 0) {
    return {
      specialization: validateRequiredText(form.specialization, 'Choose your specialization'),
      qualification: validateRequiredText(form.qualification, 'Add at least one qualification'),
    }
  }
  if (index === 1) {
    return {
      registration_number: regOnRecord ? null : validateRegistrationNumber(form.registration_number),
      hpr_id: validateHprId(form.hpr_id),
      experience_years: validateExperience(form.experience_years),
      consultation_fee: validateFee(form.consultation_fee, { locked: feeLocked }),
    }
  }
  return {
    languages: validateRequiredText(form.languages, 'Pick at least one language you consult in'),
    bio: validateBio(form.bio),
  }
}

export const hasErrors = (errors) => Object.values(errors).some(Boolean)
