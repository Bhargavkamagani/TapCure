/**
 * Single loader for the Google Maps JavaScript API (with the `places` and
 * `geometry` libraries). Everything that wants Google — the map, geocoding,
 * autocomplete, distance — calls `loadGoogleMaps()` and gets back the `google`
 * object, or `null` when no key is set / the script fails. Callers then fall
 * back to the free OpenStreetMap / Photon / haversine path, so nothing breaks.
 */
const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

let _promise = null

/** True if a Google Maps key is configured (callers can prefer Google). */
export function isGoogleEnabled() {
  return !!KEY
}

/** Resolves to the loaded `window.google` object, or `null` to use the fallback. */
export function loadGoogleMaps() {
  if (!KEY) return Promise.resolve(null)
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve(window.google)
  if (_promise) return _promise

  _promise = new Promise((resolve) => {
    const cbName = '__gmapsReady'
    window[cbName] = () => resolve(window.google || null)
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places,geometry&callback=${cbName}&loading=async`
    s.async = true
    s.defer = true
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
  return _promise
}
