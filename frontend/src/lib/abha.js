/**
 * ABHA (Ayushman Bharat Health Account) number helpers.
 *
 * The backend stores digits only and rejects anything that isn't exactly 14
 * (`schemas/patient.py::_normalize_abha_number`). Validating here too keeps the
 * user from discovering that at the end of a multi-step form — an ABHA typo in
 * the signup form must not surface only after the OTP has been verified.
 */

/** Digits only — the form lets the user type 12-3456-7890-1234 or with spaces. */
export function abhaDigits(v) {
  return String(v ?? '').replace(/\D/g, '')
}

/** ABHA is optional: blank is valid. Returns an error message, or null. */
export function abhaError(v) {
  const d = abhaDigits(v)
  if (!d) return null
  return d.length === 14 ? null : 'ABHA number must be exactly 14 digits (or leave it blank).'
}

/** Display a stored 14-digit ABHA number as XX-XXXX-XXXX-XXXX. */
export function formatAbha(v) {
  if (!v) return ''
  const d = abhaDigits(v)
  if (d.length !== 14) return v
  return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}-${d.slice(10, 14)}`
}
