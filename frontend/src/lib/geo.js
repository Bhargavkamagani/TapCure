/**
 * Travel-time helpers for the leave-by feature. Kept in sync with the backend
 * (services/token_engine.py): straight-line distance, padded for real roads,
 * over an assumed average speed.
 */

import { loadGoogleMaps } from './googleMaps.js'
import { parseComponents } from './places.js'
import { geoApi } from '../api/index.js'

export const AVG_SPEED_KMPH = 30
export const DETOUR_FACTOR = 1.3

/** Great-circle distance between two lat/lng points, in kilometres. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Estimated door-to-hospital travel time (minutes) from a straight-line distance.
 *  Clamped to [1, 1440] — the backend rejects anything over a day. */
export function travelMinutesFromKm(km) {
  const m = Math.round((km * DETOUR_FACTOR) / AVG_SPEED_KMPH * 60)
  return Math.min(1440, Math.max(1, m))
}

/** A coordinate is usable only if it's a finite number that isn't blank/null.
 *  Hospitals with no stored location read back as null/'' -> Number() === 0,
 *  which would otherwise measure distance to the equator ("null island"). */
function validCoord(v) {
  if (v == null || v === '') return false
  return Number.isFinite(Number(v))
}

/** Travel minutes between an origin {lat,lng} and a hospital {latitude,longitude},
 *  or null when either point is unknown / unset. */
export function travelMinutesBetween(origin, hospital) {
  if (!origin || !hospital) return null
  const { lat, lng } = origin
  if (!validCoord(lat) || !validCoord(lng)) return null
  if (!validCoord(hospital.latitude) || !validCoord(hospital.longitude)) return null
  const oLat = Number(lat)
  const oLng = Number(lng)
  const cLat = Number(hospital.latitude)
  const cLng = Number(hospital.longitude)
  // Exact (0,0) on either side means "no location set", not a real place.
  if ((oLat === 0 && oLng === 0) || (cLat === 0 && cLng === 0)) return null
  return travelMinutesFromKm(haversineKm(oLat, oLng, cLat, cLng))
}

/**
 * Real road travel time (minutes) via Google Distance Matrix when a key is set,
 * else the backend's road route (Mapbox live traffic → OSRM → ORS — the same
 * /geo/route the map draws, so "About M min away" is the top of the map's "N–M min"),
 * else the straight-line haversine estimate. Always async; returns null if
 * either point is unknown.
 *
 * This number is saved with the booking (travel_minutes) and drives the
 * leave-by reminder, so the straight-line guess — often half the real time —
 * is only the last resort.
 */
export async function roadTravelMinutes(origin, hospital) {
  const fallback = travelMinutesBetween(origin, hospital)
  if (fallback == null) return null
  const oLat = Number(origin.lat), oLng = Number(origin.lng)
  const cLat = Number(hospital.latitude), cLng = Number(hospital.longitude)
  const google = await loadGoogleMaps().catch(() => null)
  if (!google) {
    try {
      const route = await geoApi.route([oLat, oLng], [cLat, cLng])
      // The TOP of the map's "12–16 min" range: the patient is told, and the
      // booking saves, the cautious time — a reminder a few minutes early beats
      // one that leaves them late.
      const m = Number(route?.max_minutes ?? route?.minutes)
      if (Number.isFinite(m) && m > 0) return Math.min(1440, Math.round(m))
    } catch {
      /* 404 no road route / network → straight-line estimate */
    }
    return fallback
  }
  try {
    const svc = new google.maps.DistanceMatrixService()
    const resp = await new Promise((resolve, reject) => {
      svc.getDistanceMatrix(
        {
          origins: [{ lat: oLat, lng: oLng }],
          destinations: [{ lat: cLat, lng: cLng }],
          travelMode: google.maps.TravelMode.DRIVING,
          // departureTime=now makes Google return live-traffic duration.
          drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS },
        },
        (r, status) => (status === 'OK' ? resolve(r) : reject(new Error(status))),
      )
    })
    const el = resp?.rows?.[0]?.elements?.[0]
    // Prefer duration_in_traffic (live traffic) when available, else base road time.
    const dur = el?.duration_in_traffic || el?.duration
    if (el?.status === 'OK' && dur) {
      return Math.min(1440, Math.max(1, Math.round(dur.value / 60)))
    }
  } catch {
    /* quota / network / no route → fall back */
  }
  return fallback
}

/**
 * Turn a postal address into { lat, lng, approximate }: Google if a key is set,
 * then Mapbox, then OpenStreetMap's free Nominatim (address shortened from the
 * front before any city-only try). `approximate: true` means only the city /
 * district was found — the pin may be kilometres off, so callers should not
 * trust it silently. Returns null if nothing resolves; throws only if the
 * service itself is unreachable. Defaults the country to India.
 */
export async function geocodeAddress({ address, city, state, pincode, country = 'India' } = {}) {
  const p = (s) => (s == null ? '' : String(s).trim())
  const A = p(address), C = p(city), S = p(state), P = p(pincode), K = p(country) || 'India'

  // Prefer Google Geocoding when a key is configured (better Indian coverage).
  const google = await loadGoogleMaps().catch(() => null)
  if (google) {
    const q = [A, C, S, P, K].filter(Boolean).join(', ')
    if (q) {
      try {
        const { results } = await new google.maps.Geocoder().geocode({ address: q, region: 'in' })
        if (results?.[0]) {
          const loc = results[0].geometry.location
          return { lat: loc.lat(), lng: loc.lng(), label: results[0].formatted_address }
        }
      } catch {
        /* fall through to Nominatim */
      }
    }
  }

  // Mapbox next: it knows Indian house numbers and roads that OpenStreetMap
  // doesn't. "590, Rd Number 3, LIG, K P H B Phase 1, Kukatpally" found
  // nothing in OSM, so the old chain fell to "Hyderabad, Telangana" and pinned
  // the hospital at the city centre by Charminar, 15 km away — silently.
  const full = [A, C, S, P, K].filter(Boolean).join(', ')
  const mb = full ? await mapboxGeocode(full) : null
  if (mb && !mb.approximate) return mb

  // Then OpenStreetMap, most specific first. A street address is shortened
  // from the front (house no., road, block...) before any city-level query,
  // so a miss lands on the locality (Kukatpally) rather than the city centre.
  const parts = A.split(',').map((s) => s.trim()).filter(Boolean)
  const tails = parts.map((_, i) => parts.slice(i).join(', '))
  const queries = [
    [A, C, S, P, K],
    ...tails.slice(1).map((tail) => [tail, C, S, K]),
    [P, C, K],
  ]
    .map((q) => q.filter(Boolean).join(', '))
    .filter((q, i, arr) => q && arr.indexOf(q) === i)
  // City / state only: a last resort, and flagged so screens can say so
  // instead of trusting a pin that may be kilometres off.
  const coarse = [[C, S, P, K], [C, S, K]]
    .map((q) => q.filter(Boolean).join(', '))
    .filter((q, i, arr) => q && arr.indexOf(q) === i && !queries.includes(q))
  if (queries.length === 0 && coarse.length === 0) return mb

  let vague = mb                       // best city-level answer so far, if nothing better turns up
  for (const q of queries) {
    const hit = await nominatimSearch(q)
    if (hit && !hit.approximate) return hit
    if (hit && !vague) vague = hit
  }
  if (vague) return { ...vague, approximate: true }
  for (const q of coarse) {
    const hit = await nominatimSearch(q)
    if (hit) return { ...hit, approximate: true }
  }
  return null
}

/** Street spellings OSM and Mapbox don't match: "K P H B" → "KPHB". */
function tidyAddress(q) {
  return String(q).replace(/\b([A-Za-z])(?:\s+(?=[A-Za-z]\b))/g, '$1').replace(/\s+/g, ' ').trim()
}

// Mapbox (public token, the one address search uses). Blank → skipped.
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
// Results this vague mean "only the city / district was recognised".
const COARSE_TYPES = new Set(['country', 'region', 'district', 'place', 'postcode'])

// Words every Indian address has; sharing only these proves nothing.
const GENERIC_WORDS = new Set(['road', 'number', 'street', 'nagar', 'colony', 'main', 'cross', 'lane', 'phase',
  'block', 'sector', 'layout', 'near', 'opposite', 'india', 'hyderabad', 'telangana', 'andhra', 'pradesh'])

/** Mapbox always answers with something. A house-number match says how sure
 *  it is; any other result must share a real word with what was typed —
 *  "Zzqx Colony, Blah Road" came back as "Patrika Nagar Road Number 3". */
function trustworthy(p, query) {
  if (p.feature_type === 'address') return ['exact', 'high', 'medium'].includes(p.match_code?.confidence)
  if (COARSE_TYPES.has(p.feature_type)) return true          // flagged approximate by the caller
  const typed = tidyAddress(query).toLowerCase()
  return String(p.name || '').toLowerCase().split(/[^a-z0-9]+/)
    .some((w) => w.length >= 4 && !GENERIC_WORDS.has(w) && typed.includes(w))
}

/** One Mapbox lookup → { lat, lng, label, approximate } or null (no token,
 *  no match, error, or slower than 4s — the free chain carries on). */
async function mapboxGeocode(q) {
  if (!MAPBOX_TOKEN) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const params = new URLSearchParams({ q: tidyAddress(q), country: 'in', limit: '1', access_token: MAPBOX_TOKEN })
    const res = await fetch(`${MAPBOX_GEOCODE_URL}?${params.toString()}`, { signal: ctrl.signal })
    if (!res.ok) return null
    const f = (await res.json())?.features?.[0]
    const [lng, lat] = f?.geometry?.coordinates || []
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const p = f.properties || {}
    if (!trustworthy(p, q)) return null
    return { lat, lng, label: p.full_address || p.name || '', approximate: COARSE_TYPES.has(p.feature_type) }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** One OpenStreetMap (Nominatim) lookup → { lat, lng } or null. Throws only
 *  when the service can't be reached at all. */
async function nominatimSearch(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(tidyAddress(q))}`
  let res
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } })
  } catch {
    throw new Error('Address lookup service is unreachable. Check your connection or enter coordinates.')
  }
  if (!res.ok) return null
  const data = await res.json()
  if (Array.isArray(data) && data.length > 0) {
    const lat = Number(data[0].lat)
    const lng = Number(data[0].lon)
    // OSM quietly drops words it can't match: "Zzqx Colony, Blah Road,
    // Hyderabad" comes back as Hyderabad itself. Its `addresstype` says so.
    const approximate = OSM_COARSE_TYPES.has(String(data[0].addresstype || '').toLowerCase())
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng, approximate }
  }
  return null
}

// OSM place kinds that are a whole city / district / state, not a spot in it.
const OSM_COARSE_TYPES = new Set(['country', 'state', 'state_district', 'region', 'province', 'county', 'district', 'city', 'municipality', 'postcode'])

/**
 * The reverse of geocodeAddress: coordinates -> a readable address.
 *
 * Used by "use my current location" pickers so a dropped pin fills the address,
 * city, state and pincode boxes instead of leaving the hospital with bare
 * numbers. Google first (same key + better Indian coverage), then the free
 * Nominatim reverse endpoint. Returns null when nothing resolves — the caller
 * keeps the coordinates and lets the user type the address.
 */
export async function reverseGeocode(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null
  const location = { lat: Number(lat), lng: Number(lng) }

  const google = await loadGoogleMaps().catch(() => null)
  if (google) {
    try {
      const { results } = await new google.maps.Geocoder().geocode({ location })
      if (results?.[0]) {
        return {
          label: results[0].formatted_address,
          ...parseComponents(results[0].address_components),
        }
      }
    } catch {
      /* fall through to Nominatim */
    }
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.lat}&lon=${location.lng}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const a = data?.address || {}
    return {
      label: data?.display_name || '',
      city: a.city || a.town || a.village || a.suburb || a.county || '',
      state: a.state || '',
      pincode: a.postcode || '',
    }
  } catch {
    return null
  }
}

/**
 * Free deep-link that opens the real Google Maps app/site with driving
 * directions (origin → destination). No API call / quota — just a URL handoff,
 * like Uber/Rapido's "Navigate". Accepts {lat,lng} or {latitude,longitude}.
 * Returns null if the destination has no usable coordinates.
 */
export function mapsDirectionsUrl(origin, dest) {
  const dLat = dest?.lat ?? dest?.latitude
  const dLng = dest?.lng ?? dest?.longitude
  if (dLat == null || dLng == null || (Number(dLat) === 0 && Number(dLng) === 0)) return null
  const d = `${dLat},${dLng}`
  const oLat = origin?.lat ?? origin?.latitude
  const oLng = origin?.lng ?? origin?.longitude
  if (oLat != null && oLng != null && !(Number(oLat) === 0 && Number(oLng) === 0)) {
    return `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${d}&travelmode=driving`
  }
  return `https://www.google.com/maps/search/?api=1&query=${d}`
}

/**
 * Promise wrapper around the browser Geolocation API.
 * Resolves to {lat, lng}; rejects with a friendly message.
 */
export function getCurrentPosition(options = { enableHighAccuracy: true, timeout: 10000 }) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location is not supported on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Enter the distance instead.'
            : 'Could not get your location. Enter the distance instead.'
        reject(new Error(msg))
      },
      options,
    )
  })
}
