/**
 * Shared bits for the patient's family-member roster and the booking "who is
 * this for?" picker, so both speak the same visual language (same avatar colour
 * per relationship, same age formatting).
 */

export const MAX_MEMBERS = 5

// Backend FamilyMember enums are capitalised.
export const RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other']
export const GENDERS = ['Male', 'Female', 'Other']
export const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

// A stable colour per relationship makes the roster instantly scannable.
const RELATION_TONE = {
  Spouse: 'bg-pink-500',
  Son: 'bg-brand-blue',
  Daughter: 'bg-purple-500',
  Father: 'bg-teal-500',
  Mother: 'bg-orange-500',
  Brother: 'bg-brand-green',
  Sister: 'bg-rose-500',
}

export const relationTone = (relation) => RELATION_TONE[relation] || 'bg-slate-400'

export const PHONE_RE = /^\d{10}$/

/** The number that will actually be contacted for this person. */
export const effectivePhone = (person, accountPhone) =>
  (person?.phone || '').trim() || (accountPhone || '').trim()

/** True when the person has no number of their own and we fall back to the account holder's. */
export const usesAccountPhone = (person, accountPhone) =>
  !(person?.phone || '').trim() && !!(accountPhone || '').trim()

/** 'YYYY-MM-DD' -> whole years, or null when absent/unparseable/absurd. */
export function ageFromDob(dob) {
  if (!dob) return null
  const born = new Date(dob)
  if (Number.isNaN(born.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - born.getFullYear()
  const monthsBefore = now.getMonth() - born.getMonth()
  if (monthsBefore < 0 || (monthsBefore === 0 && now.getDate() < born.getDate())) age -= 1
  return age >= 0 && age <= 130 ? age : null
}
