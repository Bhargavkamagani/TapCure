// Addresses are typed freely and come out long and repetitive
// ("KPHB, Kukatpally, Hyderabad, Telangana, India, Hyderabad"). For display:
// split on commas, drop the country, states and anything with a PIN code, and
// de-duplicate (case-insensitive). `keep` limits it to the last N parts.
const STATES = /^(andhra pradesh|telangana|karnataka|tamil nadu|kerala|maharashtra|odisha|india)$/i

export function placeParts(...values) {
  const seen = new Set()
  return values
    .join(',')
    .split(',')
    .map((p) => p.trim().replace(/\s+/g, ' '))
    .filter((p) => p && !STATES.test(p) && !/\d{6}/.test(p))
    .filter((p) => {
      const key = p.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** "Gachibowli, Hyderabad" — the last two meaningful parts. */
export const shortPlace = (address, city) => placeParts(address, city).slice(-2).join(', ')

/** The whole address, cleaned: "KPHB, Kukatpally, Hyderabad". */
export const cleanAddress = (address, city) => placeParts(address, city).join(', ')
