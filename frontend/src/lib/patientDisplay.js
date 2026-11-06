/**
 * Who an appointment / token / queue row is actually *for*.
 *
 * When a visit is booked for a family member, the person being seen is the
 * dependent (e.g. Raji) — not the account holder who booked it (Raj). Hospital,
 * doctor and reception views should show the dependent as the primary name, and
 * the account holder only as "booked by" context.
 *
 * Rows carry `family_member_name` (set server-side when family_member_id is
 * present) alongside `patient_name`.
 */

/**
 * Addresses we mint for ourselves, not addresses anyone can be reached at.
 *
 * `routers/auth.py` gives every mobile-OTP signup a synthetic
 * `{phone}@mobile.tapcure.in` so the users row has a unique key. Nothing is
 * ever delivered there. Showing it back to the patient implies we have an
 * email for them and that mail sent to it would arrive - neither is true.
 */
const SYNTHETIC_EMAIL = /@mobile\.tapcure\.in$/i

/** The patient's real email, or null when all we have is the synthetic one. */
export const realEmail = (p) => {
  const e = (p?.email || '').trim()
  return e && !SYNTHETIC_EMAIL.test(e) ? e : null
}

/** The name to show as the primary subject — the dependent if any, else the account holder. */
export const seenName = (row, fallback = 'Patient') =>
  row?.family_member_name || row?.patient_name || row?.name || fallback

/** The account holder who booked it, shown only when the visit is for a dependent (else null). */
export const bookedBy = (row) =>
  row?.family_member_name && row?.patient_name ? row.patient_name : null
