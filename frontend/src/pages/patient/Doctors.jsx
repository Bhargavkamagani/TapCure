import { useMemo, useState, useEffect, useCallback } from 'react'
import { translitName, translitDegrees } from '../../lib/translit.js'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, IndianRupee, Search, Stethoscope, Navigation, LocateFixed, X, GraduationCap, Users } from 'lucide-react'
import { Card, StatusBadge, Avatar, PageHeading } from '../../components/hospital/ui.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { fileUrl, patientsApi, discoveryApi } from '../../api'
import { useI18n } from '../../i18n/index.jsx'
import { cityKey, sameCity } from '../../lib/cityMatch.js'
import { haversineKm, travelMinutesBetween, getCurrentPosition } from '../../lib/geo.js'
import SymptomHelper from '../../components/patient/SymptomHelper.jsx'
import { specialtyLabel, matchesSpecialty, specialtyFromText, matchSpecialties } from '../../data/symptomSpecialty.js'

/** A coordinate is usable only if it's a finite, non-zero number. */
const validCoord = (v) => v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) !== 0
const hasCoords = (c) => c && validCoord(c.latitude) && validCoord(c.longitude)


function fmtDistance(km, t) {
  if (km == null) return null
  return km < 1 ? t('px.distM', { n: Math.round(km * 1000) }) : t('px.distKm', { n: km.toFixed(1) })
}

/** Maps the backend doctor status into the badge vocabulary used by the UI. */
function statusLabel(d) {
  if (d.status && d.status !== 'active') return 'On Leave'
  return d.is_available_today ? 'Available' : 'Busy'
}


/** Initials for a doctor with no photo — "Dr. Rahul Sharma" -> "RS". */
function initialsOf(name = '') {
  return name
    .replace(/^(Dr\.?|Prof\.?)\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'
}

/**
 * Photo block for a doctor card.
 *
 * The shared <Avatar> tints initials with a palette that includes purple,
 * orange and pink — colours that appear nowhere else in this product, so a
 * doctor without a photo stood out as an off-brand block. This falls back to
 * the brand gradient instead, with a stethoscope watermark that reads as
 * "doctor, photo pending" rather than "missing image".
 */
function DoctorPhoto({ doctor }) {
  // A file that fails to load (missing, expired link) falls back to the
  // initials block instead of the browser's broken-image box.
  const [failed, setFailed] = useState(false)
  if (doctor.profile_photo_url && !failed) {
    return (
      <img
        src={fileUrl(doctor.profile_photo_url)}
        alt={doctor.name}
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
    )
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal-500 via-teal-600 to-brand-blue">
      <Stethoscope className="absolute -bottom-2 -right-2 h-14 w-14 text-white/15" />
      <span className="relative text-[26px] font-extrabold tracking-wide text-white drop-shadow-sm">
        {initialsOf(doctor.name)}
      </span>
    </div>
  )
}

function Doctors() {
  const { t, lang } = useI18n()
  const [params] = useSearchParams()
  const hospitalId = params.get('hospital') || params.get('clinic') || ''  // ?clinic= = old links
  // Arrived from the family roster: every booking link carries the person on,
  // so choosing a doctor doesn't lose who the visit is for.
  const bookingFor = params.get('for') || ''
  const bookingForParam = bookingFor ? `&for=${bookingFor}` : ''
  const [bookingForName, setBookingForName] = useState('')
  // Location search, mirroring the landing page's city picker. Empty = all.
  const [cityFilter, setCityFilter] = useState('')
  const [cities, setCities] = useState([])
  const [query, setQuery] = useState('')
  const [specialty, setSpecialty] = useState('') // set by the symptom helper
  const [helperOpen, setHelperOpen] = useState(false)
  const { doctorsById, hospitalsById, affiliationsByDoctor, patient, loading } = usePatientCtx()

  useEffect(() => {
    let active = true
    discoveryApi.cities()
      .then((r) => active && setCities(r?.cities || []))
      .catch(() => { /* the picker just stays empty; search still works */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!bookingFor || !patient?.patient_id) { setBookingForName(''); return }
    let active = true
    patientsApi.family(patient.patient_id)
      .then((rows) => {
        if (!active) return
        const m = (rows || []).find((x) => String(x.member_id) === String(bookingFor))
        setBookingForName(m?.name || '')
      })
      .catch(() => active && setBookingForName(''))
    return () => { active = false }
  }, [bookingFor, patient?.patient_id])

  const [origin, setOrigin] = useState(null) // { lat, lng } — the patient's location
  const [locBusy, setLocBusy] = useState(false)
  const [locError, setLocError] = useState(null)
  const [radius, setRadius] = useState('any') // 'any' | '5' | '10' | '25'  (km)

  const hospitalName = hospitalId ? hospitalsById[hospitalId]?.name : ''

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

  // The city the patient registered with — now mandatory at signup.
  const homeCity = cityKey(patient?.city)

  /**
   * Where a doctor actually practises: their own active practice location if it
   * carries coordinates, otherwise the hospital they're attached to.
   *
   * A solo (self-registered) doctor is anchored to a default hospital purely as
   * a tenant, so that hospital's address is somebody else's. Their real address
   * lives on the personal-practice affiliation, which is what signup now
   * captures from the Google Maps picker. Hospital-employed doctors are unaffected
   * — their affiliation is kept in sync with the hospital's own address.
   */
  const practiceOf = useCallback((doctor) => {
    const own = (affiliationsByDoctor[doctor.doctor_id] || []).filter((a) => a.is_active !== false)
    // A doctor may work at several hospitals. Rank the doctor using the practice
    // relevant to THIS patient, not whichever affiliation happened to be first.
    if (origin) {
      const nearest = own.filter(hasCoords).sort((a, b) => (
        haversineKm(origin.lat, origin.lng, Number(a.latitude), Number(a.longitude))
        - haversineKm(origin.lat, origin.lng, Number(b.latitude), Number(b.longitude))
      ))[0]
      if (nearest) return nearest
    }
    if (homeCity) {
      const local = own.find((a) => sameCity(a.city, homeCity))
      if (local) return local
    }
    const pinned = own.find(hasCoords)
    if (pinned) return pinned
    const hospital = hospitalsById[doctor.hospital_id]
    if (hasCoords(hospital)) return hospital
    // Nothing is placeable — prefer the doctor's own row for the name/city text
    // over a hospital they only nominally belong to.
    return own[0] || hospital || null
  }, [affiliationsByDoctor, hospitalsById, homeCity, origin])

  // The speciality the typed words point to (named or by symptom), for the hint chip.
  const searchHint = useMemo(() => {
    const q = query.trim()
    if (!q) return ''
    return specialtyFromText(q) || matchSpecialties(q)[0]?.specialty || ''
  }, [query])

  // `hiddenByFilters`: doctors that match the search but sit outside the city /
  // distance filter. "stress" with a city picked used to say only "No doctors
  // found" while two psychiatrists existed elsewhere; the empty state now says
  // so and offers to show them.
  const [doctors, hiddenByFilters] = useMemo(() => {
    const term = query.trim().toLowerCase()
    let matchedIgnoringPlace = 0
    // "dentist" / "cardiologist" / "skin doctor" -> that speciality's doctors.
    const namedSpec = specialtyFromText(term)
    // A symptom ("headache", "chest pain") -> the speciality the symptom list
    // suggests, same as the public Find Doctors page. Doctors whose name or
    // hospital matches the words still show too.
    const symptomSpec = namedSpec ? '' : (matchSpecialties(term)[0]?.specialty || '')
    let list = Object.values(doctorsById)
      .filter((doctor) => {
        const matchesHospital = !hospitalId || String(doctor.hospital_id) === String(hospitalId)
        const matchesSpec = !specialty || matchesSpecialty(doctor.specialization, specialty)
        const place = practiceOf(doctor)
        const placeName = place?.name || ''
        const docCity = place?.city || ''
        const matchesCity = !cityFilter || sameCity(docCity, cityFilter)
        const matchesSearch =
          !term ||
          (namedSpec
            ? matchesSpecialty(doctor.specialization, namedSpec)
            : [doctor.name, doctor.specialization, placeName, docCity].some((v) =>
              String(v).toLowerCase().includes(term),
            ) || Boolean(symptomSpec && matchesSpecialty(doctor.specialization, symptomSpec)))
        const matchesRest = matchesHospital && matchesSpec && matchesSearch
        if (matchesRest) matchedIgnoringPlace += 1
        return matchesRest && matchesCity
      })
      .map((doctor) => {
        // Distance is to where the doctor actually SITS. This used to read the
        // anchor hospital, which for a self-registered solo doctor is just the
        // lowest-id active hospital they were parked under — so the patient was
        // shown the distance to a hospital the doctor has never been to.
        const place = practiceOf(doctor)
        const dKm = origin && hasCoords(place)
          ? haversineKm(origin.lat, origin.lng, Number(place.latitude), Number(place.longitude))
          : null
        const eta = origin && hasCoords(place) ? travelMinutesBetween(origin, place) : null
        return { ...doctor, practice: place, distanceKm: dKm, etaMin: eta }
      })

    if (origin) {
      if (radius !== 'any') list = list.filter((d) => d.distanceKm != null && d.distanceKm <= Number(radius))
      list = list.slice().sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0
        if (a.distanceKm == null) return 1
        if (b.distanceKm == null) return -1
        return a.distanceKm - b.distanceKm
      })
    } else if (homeCity) {
      // No explicit location asked for: show the patient's OWN city first, then
      // everywhere else. They still see every doctor — the ones they can
      // actually reach are simply at the top.
      list = list.slice().sort((a, b) => {
        // The doctor's OWN practice city. Reading the anchor hospital's city put a
        // solo doctor in whichever city they were parked under, so a patient in
        // Vijayawada could be shown Hyderabad doctors first — and their actual
        // neighbourhood doctor buried below.
        const aHome = sameCity(a.practice?.city, homeCity)
        const bHome = sameCity(b.practice?.city, homeCity)
        if (aHome !== bHome) return aHome ? -1 : 1
        return String(a.name).localeCompare(String(b.name))
      })
    }
    return [list, matchedIgnoringPlace - list.length]
  }, [doctorsById, hospitalId, query, specialty, origin, radius, cityFilter, homeCity, practiceOf])

  const placeFilterOn = Boolean(cityFilter) || Boolean(origin && radius !== 'any')
  const clearPlaceFilters = () => { setCityFilter(''); setRadius('any') }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title={hospitalName ? t('ppage.doctorsAt', { hospital: hospitalName }) : t('ppage.findDoctors')}
        subtitle={t('ppage.doctorsSubtitle')}
      />

      {/* Full-width search + location, like the landing page. The search used to
          be a 192px box wedged into the page header, which is not where anyone
          looks first on a page whose whole purpose is finding someone. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2.5 px-2">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full bg-transparent py-2.5 text-[15px] text-brand-navy outline-none placeholder:text-slate-400"
            placeholder={t('ppage.searchNameSpecialty')}
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
      </div>

      {/* Who this is for, carried from the family roster. Without it the patient
          picks a doctor with no reminder that the visit isn't for themselves —
          and the wizard only tells them two steps later. */}
      {bookingFor && (
        <div className="flex items-center gap-2.5 rounded-xl border border-brand-blue/25 bg-brand-blueLight/50 px-4 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-brand-blue shadow-sm">
            <Users className="h-4 w-4" />
          </span>
          <p className="text-[13px] text-slate-600">
            <span className="font-bold text-brand-navy">
              {bookingForName || t('ppage.familyMember', {})}
            </span>
            {' — '}
            {t('ppage.doctorsSubtitle')}
          </p>
        </div>
      )}

      {/* One row of actions: symptom helper, then "near me" beside it — they are
          the same kind of thing (narrow the list down) and were split across two
          rows for no reason. */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setHelperOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100"
        >
          <Stethoscope className="h-4 w-4" /> {t('symptom.button')}
        </button>
        {!origin && (
          <button
            onClick={useMyLocation}
            disabled={locBusy}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-blueDark disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" /> {locBusy ? t('ppage.locating') : t('px.nearMeDoctors')}
          </button>
        )}
        {!specialty && searchHint && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-700">
            <Stethoscope className="h-4 w-4" /> {t('symptom.showing', { specialty: specialtyLabel(searchHint, lang) })}
          </span>
        )}
        {specialty && (
          <span className="inline-flex items-center gap-2 rounded-xl bg-brand-blueLight px-3 py-2 text-sm font-semibold text-brand-blue">
            {t('symptom.showing', { specialty: specialtyLabel(specialty, lang) })}
            <button onClick={() => setSpecialty('')} aria-label={t('pm.clearSpecialty')} className="text-brand-blue/70 hover:text-brand-blue">
              <X className="h-4 w-4" />
            </button>
          </span>
        )}
      </div>

      {/* Distance controls, shown only once a location is actually set. */}
      <div className={`flex flex-wrap items-center gap-3 ${origin ? '' : 'hidden'}`}>
        {origin && (
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
        <p className="text-sm text-slate-400">{t('ppage.loadingDoctors')}</p>
      ) : doctors.length === 0 ? (
        <Card className="p-8 text-center">
          {placeFilterOn && hiddenByFilters > 0 ? (
            <>
              <p className="text-[15px] font-bold text-brand-navy">
                {t('px.hiddenByFilters', {
                  n: hiddenByFilters,
                  where: cityFilter ? translitName(cityFilter, lang) : t('px.distKm', { n: radius }),
                })}
              </p>
              <button onClick={clearPlaceFilters} className="mt-3 rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-blueDark">
                {t('px.showThem')}
              </button>
            </>
          ) : (<>
          <p className="text-[15px] font-bold text-brand-navy">
            {specialty
              ? origin && radius !== 'any'
                ? t('symptom.noneFoundRadius', { specialty: specialtyLabel(specialty, lang), radius })
                : t('symptom.noneFound', { specialty: specialtyLabel(specialty, lang) })
              : origin && radius !== 'any'
                ? t('px.noDoctorsWithin', { n: radius })
                : t('ppage.noDoctorsFound')}
          </p>
          {specialty
            ? <button onClick={() => setSpecialty('')} className="mt-1 text-[13px] font-semibold text-teal-700 hover:underline">{t('symptom.clearAll')}</button>
            : !(origin && radius !== 'any') && <p className="mt-1 text-[13px] text-slate-500">{t('ppage.tryAnother')}</p>}
          </>)}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((d) => {
            // The doctor's own practice, not the tenant they're anchored to.
            const place = d.practice
            const label = statusLabel(d)
            // On leave, or no weekly session anywhere (nothing to book).
            const bookable = label !== 'On Leave' && d.has_timings !== false
            return (
              <Card key={d.doctor_id} className="flex flex-col overflow-hidden !p-0 transition-all duration-300 will-change-transform hover:-translate-y-1.5 hover:border-brand-blue/50 hover:shadow-[0_18px_40px_-16px_rgba(13,148,136,0.45)]">
                {/* Photo left, details right. The face gets a tall portrait
                    block rather than a landscape crop, so nobody's head is cut
                    off — patients here recognise their doctor by face first.
                    Since 2026-10-01 the photo is flush to the card's edge and
                    as tall as the details (same as the public Find Doctors
                    card): bigger, without making the card bigger (the old
                    block was 132px + 14px padding each side = 160px; same
                    width share as before, so the details wrap as before). Absolutely
                    positioned, so the photo's own shape can't stretch the card. */}
                <div className="flex">
                  <Link to={`/doctors/${d.doctor_id}`} aria-label={t('psearch.viewProfile')} className="relative min-h-[160px] w-[36%] shrink-0 self-stretch overflow-hidden bg-gradient-to-br from-teal-50 to-brand-blueLight">
                    <DoctorPhoto doctor={d} />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col p-3.5">
                    <StatusBadge status={label} />
                    <p className="mt-1.5 truncate text-[17px] font-extrabold leading-tight text-brand-navy" title={d.name}>{translitName(d.name, lang)}</p>
                    {lang !== 'en' && <p className="truncate text-[11px] text-slate-400">{d.name}</p>}
                    <p className="truncate text-[12.5px] font-bold text-teal-700">{specialtyLabel(d.specialization, lang)}</p>

                    <div className="mt-2 space-y-1 text-[11.5px] text-slate-500">
                      {d.qualification && (
                        <p className="flex items-start gap-1.5">
                          <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{translitDegrees(d.qualification, lang)}</span>
                        </p>
                      )}
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate" title={d.practice?.address || undefined}>
                          {place ? translitName(`${place.name}${place.city ? ` - ${place.city}` : ''}`, lang) : '—'}
                        </span>
                      </p>
                      {d.distanceKm != null && (
                        <p className="flex items-center gap-1.5 font-semibold text-brand-blue">
                          <Navigation className="h-3.5 w-3.5 shrink-0" />
                          {t('px.distAway', { dist: fmtDistance(d.distanceKm, t) + (d.etaMin ? ` · ~${t('pdash.min', { n: d.etaMin })}` : '') })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer strip: the two numbers a patient decides on, then the CTA. */}
                <div className="mt-auto flex items-center gap-2.5 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                  <div className="leading-tight">
                    <p className="text-[13.5px] font-extrabold text-brand-navy">
                      ₹ {Number(d.consultation_fee)}
                    </p>
                    {/* Existing key — no new dictionary entries added for this card. */}
                    <p className="text-[11px] text-slate-400">{t('pflow.consultation')}</p>
                  </div>
                  <div className="border-l border-slate-200 pl-3 leading-tight">
                    <p className="whitespace-nowrap text-[13.5px] font-bold text-brand-navy">
                      {d.experience_years}
                    </p>
                    <p className="whitespace-nowrap text-[11px] text-slate-400">
                      {t('ppage.yrsExp', { n: '' }).trim()}
                    </p>
                  </div>
                  {/* View profile opens the public doctor page (big photo,
                      hospital location + map, weekly timings); its Book button
                      brings a signed-in patient straight back to booking. */}
                  <Link
                    to={`/doctors/${d.doctor_id}`}
                    className="ml-auto shrink-0 whitespace-nowrap rounded-lg border border-brand-blue px-2.5 py-[7px] text-center text-[12px] font-bold text-brand-blue transition-colors hover:bg-brand-blueLight/40"
                  >
                    {t('psearch.viewProfile')}
                  </Link>
                  {bookable ? (
                    <Link
                      to={`/patient-dashboard/appointments/new?doctor=${d.doctor_id}${bookingForParam}`}
                      className="shrink-0 whitespace-nowrap rounded-lg bg-brand-blue px-3.5 py-2 text-center text-[12px] font-bold text-white transition-colors hover:bg-brand-blueDark"
                    >
                      {t('psearch.book')}
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="shrink-0 cursor-not-allowed whitespace-nowrap rounded-lg bg-brand-blue px-3 py-2 text-[12px] font-bold text-white opacity-40"
                    >
                      {t('ppage.unavailable')}
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <SymptomHelper
        open={helperOpen}
        onClose={() => setHelperOpen(false)}
        onPick={(s) => { setSpecialty(s); setQuery('') }}
      />
    </div>
  )
}

export default Doctors
