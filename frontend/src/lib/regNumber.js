/**
 * Hospital registration (licence) number — browser rule.
 *
 * A clinical establishment registers with its state or district authority under
 * the Clinical Establishments Act 2010, or the state's own act where that one
 * wasn't adopted. Each authority numbers its own way, so there is NO national
 * format to match against:
 *
 *   plain serial        12345
 *   state/district      TS/HYD/CE/12345
 *   year-based          2019/CE/0412
 *
 * So this checks plausibility, not shape — sane length, at least four digits,
 * no junk characters. A strict pattern would lock out legitimate hospitals from
 * whichever states we failed to anticipate.
 *
 * Kept identical to the server rule in `app/schemas/common.py`. The server one
 * is the gate that actually holds; this one exists so the hospital is told at the
 * field rather than after submitting the whole form.
 */
export const MAX_REG_NO = 20
export const MIN_REG_DIGITS = 4
export const REG_NO_PLACEHOLDER = 'e.g. 12345 or TS/HYD/CE/12345'

const str = (v) => (v ?? '').toString().trim()

/** Returns an error string, or null when the value is fine. */
export function validateHospitalRegNo(value) {
  const v = str(value)
  if (!v) return 'Enter your hospital registration number'
  if (v.length < 4) return 'Too short — enter the number as printed on your certificate'
  if (v.length > MAX_REG_NO) return `That looks too long — a registration number is at most ${MAX_REG_NO} characters`
  if (!/^[A-Za-z0-9][A-Za-z0-9/\- ]*$/.test(v)) return 'Use only letters, numbers, hyphens and slashes'
  const digitCount = (v.match(/\d/g) || []).length
  if (digitCount < MIN_REG_DIGITS) return `A registration number has at least ${MIN_REG_DIGITS} digits — check your certificate`
  return null
}
