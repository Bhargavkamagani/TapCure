/**
 * Address search / autocomplete: Mapbox first (VITE_MAPBOX_TOKEN), then Photon
 * (photon.komoot.io — free, no API key, no billing). Used by
 * <AddressAutocomplete> to suggest places as the user types and resolve the
 * pick to coordinates for the leave-by travel estimate.
 *
 * Mapbox Search Box copes better with misspelt village names ("Chevela" →
 * Chevella), is India-only, and knows landmarks (metro stations, shops) — the
 * plain Mapbox Geocoding API only knows addresses and areas, so "kphb metro"
 * found nothing there. The dropdown mixes both: ~3 Mapbox + ~2 Photon (villages,
 * OSM street names). With no token, or Mapbox erroring (quota used up, token
 * refused), it is all Photon. Both return coords directly.
 *
 * Complements lib/geo.js (OpenStreetMap Nominatim), which stays the one-shot
 * "resolve this exact address" fallback. Photon is tuned for type-ahead.
 */

import { loadGoogleMaps } from './googleMaps.js'

const PHOTON_URL = 'https://photon.komoot.io/api/'
// India's bounding box (minLon, minLat, maxLon, maxLat). Without it Photon
// answers a typo like "Chevela" with a town in France.
const PHOTON_INDIA_BBOX = '68.1,6.5,97.4,35.7'

const MAPBOX_URL = 'https://api.mapbox.com/search/searchbox/v1/forward'
// PUBLIC (pk.) token — it ships in the browser bundle, so restrict it to the
// app's URLs in the Mapbox account. Blank → Photon only.
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
// Slow Mapbox must not hold back the dropdown: both searches are awaited
// together, so after this Photon's results show on their own.
const MAPBOX_TIMEOUT_MS = 4000

/** One-line label from a Mapbox feature. Built from `context` rather than
 *  `full_address` because that often drops the district ("Yacharam, Telangana"),
 *  and several villages share a name — the district tells them apart. */
function mapboxLabel(p = {}) {
  const c = p.context || {}
  const street = c.street?.name
  const parts = [
    p.name,
    street && !/^unnamed road$/i.test(street) ? street : null,
    c.neighborhood?.name,
    c.locality?.name,
    c.place?.name,
    c.district?.name,
    c.region?.name,
    c.postcode?.name,
    c.country?.name,
  ]
  const seen = new Set()
  return parts
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .join(', ')
}

/** Mapbox suggestions for `query` → [{lat, lng, label, city, state, pincode,
 *  country}]. Returns null to signal "use Photon" (no token, error, or no
 *  match). An abort (superseded keystroke) is re-thrown so the caller doesn't
 *  fire a pointless Photon request for text the user has already changed. */
async function mapboxPredictions(query, { limit, lat, lng, signal }) {
  if (!MAPBOX_TOKEN) return null
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    country: 'in',
    language: 'en',
    access_token: MAPBOX_TOKEN,
  })
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    params.set('proximity', `${lng},${lat}`)   // Mapbox wants lng,lat
  }
  // Own controller so a slow Mapbox can be cut off without cancelling the
  // caller's search; the caller's abort (newer keystroke) is forwarded to it.
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (signal?.aborted) ctrl.abort()
  else signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => ctrl.abort(), MAPBOX_TIMEOUT_MS)
  try {
    const res = await fetch(`${MAPBOX_URL}?${params.toString()}`, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = await res.json()
    const out = (data.features || [])
      .map((f) => {
        const [lon, la] = f.geometry?.coordinates || []
        const p = f.properties || {}
        const c = p.context || {}
        return {
          lat: Number(la),
          lng: Number(lon),
          label: mapboxLabel(p),
          city: c.place?.name || c.district?.name || '',
          state: c.region?.name || '',
          pincode: c.postcode?.name || '',
          country: c.country?.name || '',
        }
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.label)
    return out.length ? out : null
  } catch (err) {
    // Caller aborted → re-throw. Our timeout fired → just Photon's results.
    if (err?.name === 'AbortError' && signal?.aborted) throw err
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Google Places predictions for `query` → [{label, placeId}] (coords resolved
 *  lazily on select via resolvePlaceCoords). Returns null to signal "use Photon". */
async function googlePredictions(query, { limit, lat, lng }) {
  const google = await loadGoogleMaps().catch(() => null)
  if (!google?.maps?.places) return null
  try {
    const svc = new google.maps.places.AutocompleteService()
    const req = { input: query, componentRestrictions: { country: 'in' } }
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      req.location = new google.maps.LatLng(Number(lat), Number(lng))
      req.radius = 50000
    }
    const preds = await new Promise((resolve) => {
      svc.getPlacePredictions(req, (p, status) => resolve(status === 'OK' && p ? p : []))
    })
    return preds.slice(0, limit).map((p) => ({ label: p.description, placeId: p.place_id, lat: null, lng: null }))
  } catch {
    return null
  }
}

/** Pull city/state/pincode/country out of a Google address_components array so
 *  forms can auto-fill the structured fields (not just the one-line address). */
export function parseComponents(components = []) {
  const pick = (type) => components.find((c) => c.types?.includes(type))
  const city =
    pick('locality')?.long_name ||
    pick('administrative_area_level_2')?.long_name ||
    pick('postal_town')?.long_name ||
    ''
  return {
    city,
    state: pick('administrative_area_level_1')?.long_name || '',
    pincode: pick('postal_code')?.long_name || '',
    country: pick('country')?.long_name || '',
  }
}

/** Resolve a Google place_id to {lat, lng, city, state, pincode, country}
 *  (called when a prediction is picked). The structured fields are '' when
 *  Google doesn't return them; callers can ignore what they don't need. */
export async function resolvePlaceCoords(placeId) {
  const google = await loadGoogleMaps().catch(() => null)
  if (!google?.maps?.places || !placeId) return null
  try {
    const svc = new google.maps.places.PlacesService(document.createElement('div'))
    return await new Promise((resolve) => {
      svc.getDetails({ placeId, fields: ['geometry', 'address_components'] }, (place, status) => {
        const loc = place?.geometry?.location
        if (status !== 'OK' || !loc) return resolve(null)
        resolve({ lat: loc.lat(), lng: loc.lng(), ...parseComponents(place.address_components) })
      })
    })
  } catch {
    return null
  }
}

/** Build a human-readable one-line label from a Photon feature's properties. */
function formatLabel(p = {}) {
  const parts = [
    p.name,
    p.street && p.housenumber ? `${p.housenumber} ${p.street}` : p.street,
    p.district,
    p.city || p.town || p.village || p.county,
    p.state,
    p.postcode,
    p.country,
  ]
  // Drop blanks and collapse duplicates (e.g. name === city).
  const seen = new Set()
  return parts
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .join(', ')
}

/**
 * Search places matching `query`. Returns up to `limit` results as
 * `{ lat, lng, label }`. Empty array for short/blank queries or any error
 * (callers just show no suggestions). Pass `lat`/`lng` to bias results toward a
 * region (e.g. the hospital) so local matches rank first.
 */
export async function searchPlaces(query, { limit = 5, lat, lng, signal } = {}) {
  const q = spaceInitials((query || '').trim())
  if (q.length < 3) return []

  // Prefer Google Places autocomplete when a key is set; else Mapbox + Photon.
  const g = await googlePredictions(q, { limit, lat, lng })
  if (g && g.length) return g

  // Both at once, then mixed: Mapbox Search Box knows landmarks ("KPHB Metro")
  // but ranks shops above villages, so a half-typed village ("Mudim") gets only
  // shops; Photon knows villages and OSM street names. Each fills the other's
  // share when it has fewer results.
  let mapbox, photon
  try {
    [mapbox, photon] = await Promise.all([
      mapboxPredictions(q, { limit, lat, lng, signal }),
      photonPredictions(q, { limit, lat, lng, signal }),
    ])
  } catch {
    return []   // aborted — a newer keystroke's search is already running
  }
  mapbox = mapbox || []
  if (signal?.aborted) return []
  const mapboxShare = Math.min(mapbox.length, Math.max(limit - photon.length, Math.ceil(limit * 0.6)))
  const out = []
  for (const p of mapbox.slice(0, mapboxShare)) {
    if (!out.some((o) => isSamePlace(o, p))) out.push(p)   // Mapbox repeats some POIs
  }
  for (const p of [...photon, ...mapbox.slice(mapboxShare)]) {
    if (out.length >= limit) break
    if (!out.some((o) => isSamePlace(o, p))) out.push(p)
  }
  return out
}

/** Photon suggestions for `query` → [{lat, lng, label}], limited to India.
 *  [] on no match or network failure; an abort is re-thrown like Mapbox's. */
async function photonPredictions(query, { limit, lat, lng, signal }) {
  const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'en', bbox: PHOTON_INDIA_BBOX })
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    params.set('lat', String(lat))
    params.set('lon', String(lng))
  }
  try {
    const res = await fetch(`${PHOTON_URL}?${params.toString()}`, { signal })
    if (!res.ok) return []
    const data = await res.json()
    return (data.features || [])
      .map((f) => {
        const [lon, la] = f.geometry?.coordinates || []
        return { lat: Number(la), lng: Number(lon), label: formatLabel(f.properties) }
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.label)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return []
  }
}

/** Village names often start with an initial written without a space —
 *  "T.Challapalle", "P.Gannavaram". Mapbox reads that as one word and returns a
 *  different Challapalle; "T. Challapalle" finds the right one. Only splits
 *  before a word of 3+ letters, so abbreviations like "K.P.H.B" stay intact. */
function spaceInitials(s) {
  return s.replace(/\b([A-Za-z])\.(?=[A-Za-z]{3,})/g, '$1. ')
}

/** Both sources often return the same village ("Yacharam"): same first name
 *  part and within ~300 m counts as one place. */
function isSamePlace(a, b) {
  const head = (s) => String(s).split(',')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
  return (
    Math.abs(a.lat - b.lat) < 0.003 &&
    Math.abs(a.lng - b.lng) < 0.003 &&
    head(a.label) === head(b.label)
  )
}
