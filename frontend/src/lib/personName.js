/**
 * First name / last name helpers (2026-10-26).
 *
 * The backend stores first_name + last_name and keeps `name` (the full name)
 * in step. Forms send all three; when editing an older record that has no
 * first/last yet, they are split out of `name` the same way the server does:
 * a leading title (Dr./Mr./Mrs./Ms./Prof.) is not part of the first name, the
 * last word is the last name. See tapcure_backend app/services/person_name.py.
 */
const TITLES = new Set(['dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.'])

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

export function splitName(full) {
  let words = clean(full).split(' ').filter(Boolean)
  if (words.length > 1 && TITLES.has(words[0].toLowerCase())) words = words.slice(1)
  if (words.length >= 2) return { first: words.slice(0, -1).join(' '), last: words[words.length - 1] }
  return { first: words[0] || '', last: '' }
}

export const joinName = (first, last) => [clean(first), clean(last)].filter(Boolean).join(' ')

/** { first, last } for a person object from the API (older rows: split from name). */
export function nameParts(person) {
  if (person && clean(person.first_name)) return { first: clean(person.first_name), last: clean(person.last_name) }
  return splitName(person?.name)
}

/** The three fields a form sends: first_name, last_name, and name (full). */
export const nameFields = (first, last) => ({
  first_name: clean(first),
  last_name: clean(last) || null,
  name: joinName(first, last),
})

/** '' when fine, otherwise the message. An initial ("K" or "K.") is a valid last name. */
export function nameError(first, last, { lastRequired = true } = {}) {
  if (!clean(first)) return 'Enter the first name'
  if (lastRequired && !clean(last)) return 'Enter the last name (an initial is fine)'
  return ''
}
