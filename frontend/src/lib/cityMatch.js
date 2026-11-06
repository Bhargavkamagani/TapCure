/**
 * Matching two city names typed by different people.
 *
 * City values come from both Google address results and older free-text rows,
 * and hospitals enter them by hand, so the same place arrives as "Hyderabad",
 * "hyderabad ", "Hyderabad." or "Hyderabad, Telangana". Punctuation and case
 * are dropped, and a containment match is allowed once both names are long
 * enough that it cannot fire by accident — five characters, so "Pune" never
 * swallows "Puner..." but "Hyderabad" still finds "Hyderabad, Telangana".
 *
 * Lived in Doctors.jsx; the Hospitals directory needs the identical rule, and
 * two copies would drift apart the first time either is tweaked.
 */
export const cityKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9\u0080-￿]+/g, ' ')
  .trim()

export const sameCity = (left, right) => {
  const a = cityKey(left)
  const b = cityKey(right)
  if (!a || !b) return false
  return a === b || (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a)))
}
