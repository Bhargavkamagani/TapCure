/** A short, readable reference for a record id, for showing on screen ("#EB3392EA").
 *  Ids are UUIDs now (time-ordered v7), so the first characters are the same
 *  for rows made around the same time; the last 8 are random and tell rows apart.
 *  Never use this to look a record up — always send the full id to the API. */
export function shortId(id) {
  if (id == null || id === '') return ''
  const s = String(id).replace(/-/g, '')
  return s.length > 8 ? s.slice(-8).toUpperCase() : s.toUpperCase()
}
