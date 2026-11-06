import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet'
import { Navigation } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { isGoogleEnabled, loadGoogleMaps } from '../../lib/googleMaps.js'
import { useI18n } from '../../i18n/index.jsx'
import { geoApi, fileUrl } from '../../api'

/** A free deep-link that opens the real Google Maps app/site with driving
 *  directions (origin → hospital). No API call, no quota — just like Uber/Rapido. */
function OpenInMapsButton({ hospital, origin }) {
  const { t } = useI18n()
  const dest = `${hospital[0]},${hospital[1]}`
  const url = origin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin[0]},${origin[1]}&destination=${dest}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${dest}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-2.5 right-2.5 z-[1200] inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[12px] font-bold text-brand-blue shadow-md ring-1 ring-slate-200 backdrop-blur hover:bg-white"
    >
      <Navigation className="h-3.5 w-3.5" /> {t('cmn.openInMaps')}
    </a>
  )
}

/** Inline pin SVG as a data-URI (reused by the Google renderer's markers). */
function pinDataUri(color) {
  const svg = `<svg width="30" height="42" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 24 12 24s12-15.6 12-24C24 5.4 18.6 0 12 0z" fill="${color}"/><circle cx="12" cy="12" r="5" fill="#ffffff"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

/** Google Maps renderer (used when a key is configured). */
function GoogleHospitalMap({ hospital, origin, hospitalLabel, originLabel, height, className }) {
  const ref = useRef(null)
  const cKey = hospital ? hospital.join(',') : ''
  const oKey = origin ? origin.join(',') : ''
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps().then((google) => {
      if (cancelled || !google || !ref.current) return
      const icon = (color) => ({ url: pinDataUri(color), scaledSize: new google.maps.Size(30, 42), anchor: new google.maps.Point(15, 42) })
      const map = new google.maps.Map(ref.current, {
        center: { lat: hospital[0], lng: hospital[1] }, zoom: 14,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      })
      const bounds = new google.maps.LatLngBounds()
      const cPos = { lat: hospital[0], lng: hospital[1] }
      new google.maps.Marker({ position: cPos, map, title: hospitalLabel, icon: icon('#2563eb') })
      bounds.extend(cPos)
      if (origin) {
        const oPos = { lat: origin[0], lng: origin[1] }
        new google.maps.Marker({ position: oPos, map, title: originLabel, icon: icon('#059669') })
        bounds.extend(oPos)
        map.fitBounds(bounds, 48)
        // Draw the REAL driving route (follows roads); fall back to a straight
        // line if the Directions API isn't enabled / has no route.
        const renderer = new google.maps.DirectionsRenderer({
          map, suppressMarkers: true, preserveViewport: true,
          polylineOptions: { strokeColor: '#2563eb', strokeWeight: 4, strokeOpacity: 0.85 },
        })
        new google.maps.DirectionsService().route(
          { origin: oPos, destination: cPos, travelMode: google.maps.TravelMode.DRIVING, drivingOptions: { departureTime: new Date() } },
          (res, status) => {
            if (status === 'OK') renderer.setDirections(res)
            else new google.maps.Polyline({ path: [oPos, cPos], map, strokeColor: '#2563eb', strokeOpacity: 0.6, strokeWeight: 3, geodesic: true })
          },
        )
      } else {
        map.setCenter(cPos); map.setZoom(14)
      }
    })
    return () => { cancelled = true }
  }, [cKey, oKey, hospitalLabel, originLabel])
  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${className}`} style={{ height }}>
      <div ref={ref} className="h-full w-full" />
      <OpenInMapsButton hospital={hospital} origin={origin} />
    </div>
  )
}

/**
 * Lightweight interactive map (Leaflet + free OpenStreetMap tiles, no API key).
 *
 * Shows the hospital location and, optionally, the patient's origin plus a line
 * between them. Coordinates are { latitude, longitude } for the hospital and
 * { lat, lng } for the origin — matching how the rest of the app stores them.
 *
 * We build markers with an inline-SVG divIcon instead of Leaflet's default
 * image marker, because the default icon's image paths break under Vite's
 * bundler. This keeps the component asset-free and self-contained.
 */

function pin(color) {
  return L.divIcon({
    className: 'hospital-map-pin',
    html: `<svg width="30" height="42" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 24 12 24s12-15.6 12-24C24 5.4 18.6 0 12 0z" fill="${color}"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff"/>
    </svg>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
  })
}

const HOSPITAL_ICON = pin('#2563eb') // brand blue
const ORIGIN_ICON = pin('#059669') // emerald

const escAttr = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The hospital shown by its own logo (2026-10-01; the logo is required at
 *  hospital sign-up): a round white badge with a pointer underneath, like a
 *  business pin on Google Maps. The hospital's first letter sits under the
 *  image, so a logo that fails to load still leaves a readable pin. */
function logoPin(url, name, fit = 'contain') {
  const letter = escAttr((String(name || '').trim()[0] || '+').toUpperCase())
  // 'contain' keeps a logo whole; 'cover' fills the circle like a profile
  // picture (a doctor's photo on the doctor profile map).
  const img = fit === 'cover'
    ? 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;border-radius:50%'
    : 'position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain;background:#ffffff;border-radius:50%'
  return L.divIcon({
    className: 'hospital-map-pin',
    html: `<div style="position:relative;width:48px;height:60px">
      <div style="position:absolute;left:0;top:0;width:48px;height:48px;border-radius:50%;background:#ffffff;border:3px solid #0d9488;box-shadow:0 2px 6px rgba(15,39,66,.35);overflow:hidden;box-sizing:border-box">
        <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 18px/1 sans-serif;color:#0d9488">${letter}</span>
        <img src="${escAttr(url)}" alt="" style="${img}">
      </div>
      <div style="position:absolute;left:17px;top:44px;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid #0d9488"></div>
    </div>`,
    iconSize: [48, 60],
    iconAnchor: [24, 58],
    popupAnchor: [0, -54],
  })
}

/** Keep the view framed on whatever points we have, re-fitting when they move. */
function FitBounds({ points }) {
  const map = useMap()
  useMemo(() => {
    if (points.length === 1) {
      map.setView(points[0], 14)
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.25))
    }
  }, [map, points])
  return null
}

/**
 * The patient -> hospital route on the free map. Asks the backend for the road
 * path (OpenRouteService) and draws it along the streets like Google does,
 * with the drive time on it. Until it arrives — or if there is no route (no
 * key, service down, quota used up) — it keeps the old straight dashed line.
 */
function RoadRoute({ origin, hospital }) {
  const map = useMap()
  const { t } = useI18n()
  const [route, setRoute] = useState(null)
  const [oLat, oLng] = origin
  const [cLat, cLng] = hospital

  useEffect(() => {
    let active = true
    setRoute(null)
    geoApi.route([oLat, oLng], [cLat, cLng])
      .then((r) => { if (active && Array.isArray(r?.points) && r.points.length > 1) setRoute(r) })
      .catch(() => { /* no road route: the straight line stays */ })
    return () => { active = false }
  }, [oLat, oLng, cLat, cLng])

  // A road can swing well outside the two pins; frame the whole route.
  useEffect(() => {
    if (route) map.fitBounds(L.latLngBounds(route.points).pad(0.15))
  }, [map, route])

  if (!route) {
    return <Polyline positions={[origin, hospital]} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 6', opacity: 0.7 }} />
  }
  return (
    <>
      {/* White casing under the blue line, the way Google draws a route. */}
      <Polyline positions={route.points} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
      <Polyline positions={route.points} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.95 }}>
        <Tooltip permanent direction="center" className="hospital-map-eta">
          {route.max_minutes > route.minutes
            ? t('cmn.routeEtaRange', { min: route.minutes, max: route.max_minutes, km: route.km })
            : t('cmn.routeEta', { min: route.minutes, km: route.km })}
        </Tooltip>
      </Polyline>
    </>
  )
}

// Mapbox "Satellite Streets" map picture (real photos + street names) — every
// map in the app since 2026-09-30 (tiles="mapbox" is the default; pass
// tiles="osm" to opt a map out). No map/satellite switch: "Get directions" /
// "Open in Google Maps" hands navigation to Google Maps.
// Free tier: 200,000 tiles a month (~15 per map view). Satellite tiles are
// photos, 2-3x the bytes of a drawn map, so slower on weak mobile data.
// PUBLIC pk. token, the same one address search uses; blank → OpenStreetMap.
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
const MAPBOX_TILES = 'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/512/{z}/{x}/{y}{r}'
// A few failed tiles (token refused, free tier used up, offline) and the map
// switches to OpenStreetMap for the rest of the visit rather than show gaps.
const MAPBOX_FAILS_BEFORE_FALLBACK = 3
let mapboxTilesFailed = false   // shared by every map on the page, this visit

function MapTiles({ tiles }) {
  const [useMapbox, setUseMapbox] = useState(tiles === 'mapbox' && !!MAPBOX_TOKEN && !mapboxTilesFailed)
  const fails = useRef(0)
  if (useMapbox) {
    return (
      <TileLayer
        key="mapbox"
        attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://www.maxar.com/">Maxar</a>'
        url={`${MAPBOX_TILES}?access_token=${MAPBOX_TOKEN}`}
        tileSize={512}
        zoomOffset={-1}
        eventHandlers={{
          tileerror: () => {
            fails.current += 1
            if (fails.current >= MAPBOX_FAILS_BEFORE_FALLBACK) {
              mapboxTilesFailed = true
              setUseMapbox(false)
            }
          },
        }}
      />
    )
  }
  return (
    <TileLayer
      key="osm"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  )
}

export default function HospitalMap({
  hospital,
  origin = null,
  hospitalLabel: hospitalLabelProp,
  originLabel: originLabelProp,
  height = 240,
  className = '',
  // 'mapbox' (default since 2026-09-30: Mapbox Satellite on every map, falls
  // back to OpenStreetMap on its own) or 'osm' (free OpenStreetMap only).
  tiles = 'mapbox',
  // The white + / − buttons: hidden on every map since 2026-09-30 (pinch and
  // double-tap zoom still work). Pass zoomControl to show them on one map.
  zoomControl = false,
  // The hospital's logo for its pin. Defaults to `hospital.logo_url` (screens
  // that pass a hospital row); a doctor's personal hospital has none and keeps
  // the plain pin.
  hospitalLogo,
  // 'cover' to fill the round pin with a photo instead of fitting a logo.
  hospitalLogoFit = 'contain',
}) {
  const { t } = useI18n()
  const hospitalLabel = hospitalLabelProp ?? t('cmn.hospital')
  const logo = hospitalLogo !== undefined ? hospitalLogo : hospital?.logo_url
  // Built once per logo, not per render: a new icon object makes Leaflet
  // replace the marker (and reload the image) every time.
  const hospitalIcon = useMemo(
    () => (logo ? logoPin(fileUrl(logo), hospitalLabel, hospitalLogoFit) : HOSPITAL_ICON),
    [logo, hospitalLabel, hospitalLogoFit],
  )
  const originLabel = originLabelProp ?? t('pdash.you')
  const hospitalLatLng = hospital && hospital.latitude != null && hospital.longitude != null
    ? [Number(hospital.latitude), Number(hospital.longitude)]
    : null
  const originLatLng = origin && origin.lat != null && origin.lng != null
    ? [Number(origin.lat), Number(origin.lng)]
    : null

  const points = [hospitalLatLng, originLatLng].filter(
    (p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && !(p[0] === 0 && p[1] === 0),
  )

  if (!points.length) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400 ${className}`}
        style={{ height }}
      >
        {t('cmn.locationNA')}
      </div>
    )
  }

  // Google Maps when a key is set; otherwise the free Leaflet/OpenStreetMap map.
  if (isGoogleEnabled()) {
    return (
      <GoogleHospitalMap
        hospital={hospitalLatLng && points.includes(hospitalLatLng) ? hospitalLatLng : points[0]}
        origin={originLatLng && points.includes(originLatLng) ? originLatLng : null}
        hospitalLabel={hospitalLabel}
        originLabel={originLabel}
        height={height}
        className={className}
      />
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${className}`} style={{ height }}>
      <OpenInMapsButton hospital={hospitalLatLng || points[0]} origin={originLatLng} />
      <MapContainer center={points[0]} zoom={14} scrollWheelZoom={false} zoomControl={zoomControl} style={{ height: '100%', width: '100%' }}>
        <MapTiles tiles={tiles} />
        {hospitalLatLng && (
          <Marker position={hospitalLatLng} icon={hospitalIcon}>
            <Popup>{hospitalLabel}</Popup>
          </Marker>
        )}
        {originLatLng && (
          <Marker position={originLatLng} icon={ORIGIN_ICON}>
            <Popup>{originLabel}</Popup>
          </Marker>
        )}
        {hospitalLatLng && originLatLng && <RoadRoute origin={originLatLng} hospital={hospitalLatLng} />}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  )
}
