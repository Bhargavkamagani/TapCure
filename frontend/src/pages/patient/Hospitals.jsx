import { useMemo, useState, useEffect } from 'react'
import { translitName } from '../../lib/translit.js'
import { Link } from 'react-router-dom'
import { Building2, MapPin, Phone, Users, Navigation, LocateFixed, X, Search } from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { fileUrl, discoveryApi } from '../../api'
import { useI18n } from '../../i18n/index.jsx'
import { shortPlace } from '../../lib/shortPlace.js'
import { haversineKm, travelMinutesBetween, getCurrentPosition } from '../../lib/geo.js'
import { cityKey, sameCity } from '../../lib/cityMatch.js'
import { InsuranceLogos, InsuranceFilter, useInsurers } from '../../components/common/Insurance.jsx'

/** A coordinate is usable only if it's a finite, non-zero number. */
const validCoord = (v) => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) !== 0
const hasCoords = (c) => validCoord(c.latitude) && validCoord(c.longitude)

function fmtDistance(km, t) {
  if (km == null) return null
  return km < 1 ? t('px.distM', { n: Math.round(km * 1000) }) : t('px.distKm', { n: km.toFixed(1) })
}

function OpenBadge({ active }) {
  const { t, lang } = useI18n()
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {active ? t('ppage.open') : t('ppage.closed')}
    </span>
  )
}

/** The card's picture (2026-10-01, same as the public Find Hospitals card):
 *  the hospital photo, else its logo, both filling the area; else an icon.
 *  A file that fails to load falls to the next one. */
function HospitalPicture({ hospital }) {
  const [failed, setFailed] = useState({})
  const pick = hospital.photo_url && !failed.photo ? 'photo' : hospital.logo_url && !failed.logo ? 'logo' : null
  if (pick) {
    return (
      <img src={fileUrl(hospital[`${pick}_url`])} alt="" loading="lazy" onError={() => setFailed((f) => ({ ...f, [pick]: true }))}
        className="absolute inset-0 h-full w-full object-cover" />
    )
  }
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-blueLight via-teal-50 to-teal-100">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/80 text-brand-blue shadow-sm"><Building2 className="h-8 w-8" /></span>
    </div>
  )
}

/** Hospitals directory — backed by GET /hospitals, with live doctor counts and an
 *  optional "near me" sort (browser geolocation → haversine distance). */
function Hospitals() {
  const { t, lang } = useI18n()
  const { hospitalsById, doctorsById, patient, loading } = usePatientCtx()
  // Carried from the family roster so choosing a hospital, then a doctor,
  // never loses who the visit is for.
  const bookingFor = new URLSearchParams(window.location.search).get('for') || ''
  const forParam = bookingFor ? `&for=${bookingFor}` : ''

  const [origin, setOrigin] = useState(null) // { lat, lng } — the patient's location
  const [locBusy, setLocBusy] = useState(false)
  const [locError, setLocError] = useState(null)
  const [radius, setRadius] = useState('any') // 'any' | '5' | '10' | '25'  (km)
  const [query, setQuery] = useState('')
  // City picker, same as the Doctors directory. Empty = every city.
  const [cityFilter, setCityFilter] = useState('')
  const [cities, setCities] = useState([])
  // Insurance filter (2026-11-03): one insurer/scheme code, '' = any.
  const [insurance, setInsurance] = useState('')
  const { byCode: insurers } = useInsurers()
  // The patient's own city, used to float local hospitals to the top.
  const homeCity = cityKey(patient?.city)

  useEffect(() => {
    let active = true
    discoveryApi.cities()
      .then((r) => active && setCities(r?.cities || []))
      .catch(() => { /* the picker just stays empty; the typed search still works */ })
    return () => { active = false }
  }, [])

  // If the patient already has a saved location, sort by it right away — no click.
  useEffect(() => {
    if (!origin && patient && validCoord(patient.latitude) && validCoord(patient.longitude)) {
      setOrigin({ lat: Number(patient.latitude), lng: Number(patient.longitude) })
    }
  }, [patient]) // eslint-disable-line react-hooks/exhaustive-deps

  const useMyLocation = async () => {
    setLocBusy(true)
    setLocError(null)
    try {
      setOrigin(await getCurrentPosition())
    } catch (e) {
      setLocError(e.message || t('px.couldNotGetLocation'))
    } finally {
      setLocBusy(false)
    }
  }

  const clearLocation = () => { setOrigin(null); setRadius('any'); setLocError(null) }

  const hospitals = useMemo(() => {
    const counts = {}
    Object.values(doctorsById).forEach((d) => { counts[d.hospital_id] = (counts[d.hospital_id] || 0) + 1 })

    let list = Object.values(hospitalsById).map((h) => {
      const dKm = origin && hasCoords(h) ? haversineKm(origin.lat, origin.lng, Number(h.latitude), Number(h.longitude)) : null
      const eta = origin && hasCoords(h) ? travelMinutesBetween(origin, h) : null
      return { ...h, doctorCount: counts[h.hospital_id] || 0, distanceKm: dKm, etaMin: eta }
    })

    // City picker, matched with the Doctors page's own rule (lib/cityMatch.js)
    // so "Hyderabad" also keeps "Hyderabad, Telangana".
    if (cityFilter) list = list.filter((c) => sameCity(c.city, cityFilter))
    if (insurance) list = list.filter((c) => (c.insurance_partners || []).includes(insurance))

    /* Typed search, the same shape as the Doctors page. Matches the name, the
       city, the state and the address, so "Peruru", "Andhra" and "jeevan" all
       find the same hospital. Also matches the TRANSLITERATED name, because on
       the Telugu page that is what is printed on the card — searching for what
       you can see should work. */
    const term = query.trim().toLowerCase()
    if (term) {
      list = list.filter((c) =>
        [c.name, translitName(c.name, lang), c.city, c.state, c.address].some((v) =>
          String(v || '').toLowerCase().includes(term),
        ),
      )
    }

    if (origin) {
      if (radius !== 'any') list = list.filter((c) => c.distanceKm != null && c.distanceKm <= Number(radius))
      list = list.slice().sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      })
    } else if (homeCity) {
      // No location asked for: the patient's OWN city first, then everywhere
      // else, exactly as the Doctors directory orders its list. Every hospital
      // is still listed — a patient in Vijayawada simply stops opening the page
      // on a screenful of Hyderabad.
      list = list.slice().sort((a, b) => {
        const aHome = sameCity(a.city, homeCity)
        const bHome = sameCity(b.city, homeCity)
        if (aHome !== bHome) return aHome ? -1 : 1
        return String(a.name || '').localeCompare(String(b.name || ''))
      })
    }
    return list
  }, [hospitalsById, doctorsById, origin, radius, query, cityFilter, insurance, homeCity, lang])

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.hospitalsTitle')} subtitle={t('ppage.hospitalsSubtitle')} />

      {/* Search, above the near-me controls. This page had none at all: with a
          city's worth of hospitals the only way to find one by name was to
          scroll. Same box as the Doctors page so both directories behave the
          same way. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2.5 px-2">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent py-2.5 text-[15px] text-brand-navy outline-none placeholder:text-slate-400"
            placeholder={t('px.searchHospitals')}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label={t('pm.clearSearch')} className="text-slate-300 hover:text-slate-500">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-slate-100 px-2 sm:border-l sm:border-t-0 sm:pl-3">
          <MapPin className="h-4.5 w-4.5 shrink-0 text-slate-400" />
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="w-full bg-transparent py-2.5 text-[14px] font-medium text-brand-navy outline-none sm:w-40"
          >
            <option value="">{t('land.hero.allCities')}</option>
            {cities.map((c) => <option key={c} value={c}>{translitName(c, lang)}</option>)}
          </select>
        </div>
        <InsuranceFilter value={insurance} onChange={setInsurance}
          className="border-t border-slate-100 px-2 sm:border-l sm:border-t-0 sm:pl-3" />
      </div>

      {/* Near-me controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!origin ? (
          <button
            onClick={useMyLocation}
            disabled={locBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blueDark disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" /> {locBusy ? t('ppage.locating') : t('px.nearMeHospitals')}
          </button>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-xl bg-brand-greenLight px-3 py-2 text-sm font-semibold text-brand-green">
              <Navigation className="h-4 w-4" />{t('pm.sortedByNearest')}<button onClick={clearLocation} aria-label={t('pm.clearLocation')} className="ml-1 text-brand-green/70 hover:text-brand-green">
                <X className="h-4 w-4" />
              </button>
            </span>
            <label className="inline-flex items-center gap-2 text-sm text-slate-500">{t('pm.within')}<select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-brand-navy outline-none focus:border-brand-blue"
              >
                <option value="any">{t('pm.anyDistance')}</option>
                <option value="5">{t('px.distKm', { n: 5 })}</option>
                <option value="10">{t('px.distKm', { n: 10 })}</option>
                <option value="25">{t('px.distKm', { n: 25 })}</option>
              </select>
            </label>
          </>
        )}
        {locError && <span className="text-xs text-red-500">{locError}</span>}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{t('ppage.loadingHospitals')}</p>
      ) : hospitals.length === 0 ? (
        <Card className="p-8 text-center">
          {/* Say WHICH filter emptied the list, and offer the way out. "No
              hospitals yet" would be a lie when the typed word is the reason. */}
          <p className="text-[15px] font-bold text-brand-navy">
            {insurance && !query.trim() && !cityFilter
              ? t('ins.noMatch', { name: insurers[insurance]?.name || insurance })
              : query.trim() || cityFilter
              ? t('px.noHospitalsMatch', { q: query.trim() || translitName(cityFilter, lang) })
              : origin && radius !== 'any'
              ? t('px.noHospitalsWithin', { n: radius })
              : t('ppage.noHospitals')}
          </p>
          {(query.trim() || cityFilter || insurance) && (
            <button
              onClick={() => { setQuery(''); setCityFilter(''); setInsurance('') }}
              className="mt-3 rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-blueDark"
            >
              {t('pm.clearSearch')}
            </button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {hospitals.map((c) => (
            <Card key={c.hospital_id} className="relative flex flex-col overflow-hidden !p-0 transition-all duration-300 will-change-transform hover:z-20 hover:-translate-y-3 hover:scale-[1.08] hover:border-brand-blue/50 hover:shadow-[0_30px_65px_-14px_rgba(13,148,136,0.45)]">
              {/* Picture first (2026-10-01): the hospital photo / logo fills the
                  top of the card, replacing the logo thumbnail and the small
                  map. The address is cut to "area, city"; the full one is on
                  hover. */}
              <div className="relative h-[210px] w-full shrink-0 overflow-hidden">
                <HospitalPicture hospital={c} />
                <span className="absolute right-3 top-3"><OpenBadge active={c.is_active} /></span>
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-brand-navy shadow-sm">
                  <Users className="h-3.5 w-3.5 text-brand-blue" />{t('ppage.nDoctors', { n: c.doctorCount })}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5 pt-4">
              <div className="min-w-0 leading-tight">
                {/* Insurers accepted: small logos, top right (2026-11-03). */}
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[16px] font-bold text-brand-navy" title={c.name}>{translitName(c.name, lang)}</p>
                  <InsuranceLogos codes={c.insurance_partners} className="mt-0.5" />
                </div>
                {lang !== 'en' && <p className="text-[11px] text-slate-400">{c.name}</p>}
                <p className="mt-1 flex items-center gap-1 text-[13px] text-slate-500" title={[c.address, c.city].filter(Boolean).join(', ')}>
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{translitName(shortPlace(c.address, c.city) || c.city, lang) || '—'}</span>
                </p>
              </div>

              {c.distanceKm != null && (
                <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-brand-blueLight px-2.5 py-1 text-[11.5px] font-semibold text-brand-blue">
                  <Navigation className="h-3 w-3" />
                  {t('px.distAway', { dist: fmtDistance(c.distanceKm, t) + (c.etaMin ? ` · ~${t('pdash.min', { n: c.etaMin })}` : '') })}
                </span>
              )}

              {c.phone && (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-slate-500"><Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}</p>
              )}

              <Link
                to={`/patient-dashboard/doctors?hospital=${c.hospital_id}${forParam}`}
                className="mt-4 w-full rounded-xl border border-brand-blue py-2 text-center text-[13px] font-semibold text-brand-blue transition-colors hover:bg-brand-blueLight/40"
              >
                {t('ppage.viewDoctors')}
              </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default Hospitals
