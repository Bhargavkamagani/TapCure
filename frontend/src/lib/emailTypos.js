/**
 * Catch misspellings of the big free email providers.
 *
 * `you@gmial.com` is a perfectly valid address — name, @, domain, dot, TLD —
 * so no format check and no RFC validator will ever reject it. `gmial.com` is
 * a real registered domain; typo-squatters own it. The only way to catch this
 * is to recognise the specific misspellings people actually make.
 *
 * Why it is worth catching at all: doctor and hospital sign-in is EMAIL ONLY,
 * with no OTP fallback. A typo there does not merely bounce a welcome message
 * — it creates an account that can never be logged into and never password-
 * reset. For a patient it is an inconvenience; for a doctor it is a lockout.
 *
 * DELIBERATELY NARROW. It rejects only the exact domains listed below, which
 * nobody legitimately uses. Everything else — including every hospital's own
 * domain — passes straight through untouched. We cannot tell `omegahospitl.in`
 * from a real company domain, so we do not try: guessing there would block
 * genuine sign-ups, which is far worse than letting a typo through.
 */

/** Misspelt domain -> what they almost certainly meant. */
const TYPOS = {
  // gmail
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  // hotmail
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  // yahoo
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  // outlook
  'outlok.com': 'outlook.com',
  'outloook.com': 'outlook.com',
  'outlook.con': 'outlook.com',
  // rediffmail — common in India
  'rediffmial.com': 'rediffmail.com',
  'rediffmail.co': 'rediffmail.com',
}

/**
 * The domain they probably meant, or null when there is nothing to correct.
 *
 * Returns null for anything not on the list above — an unknown domain is not
 * evidence of a mistake.
 */
export function emailTypoSuggestion(value) {
  const email = String(value || '').trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at < 1) return null                       // no domain to judge
  const domain = email.slice(at + 1)
  return TYPOS[domain] || null
}

/**
 * Ready-made error text, or null when the address is fine.
 *
 * Callers append this AFTER their existing format check, so it can only ever
 * see an address that already looked valid.
 */
export function emailTypoError(value) {
  const suggestion = emailTypoSuggestion(value)
  return suggestion ? `Did you mean ${suggestion}? Please check the spelling.` : null
}
