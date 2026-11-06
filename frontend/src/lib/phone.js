// Phone-number input filters. Run them in onChange so letters never reach the
// field — inputMode="numeric" only changes the mobile keypad, it blocks nothing.

/** Digits only, `max` at most. */
export const digitsOnly = (raw, max = 10) => String(raw ?? '').replace(/\D/g, '').slice(0, max)

/** Indian mobile: digits only, 10 at most; a pasted "+91 98765 43210" or
 *  "098765 43210" keeps the 10-digit number. */
export const toMobile = (raw) => {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) return d.slice(2)
  if (d.length === 11 && d.startsWith('0')) return d.slice(1)
  return d.slice(0, 10)
}
