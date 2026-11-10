import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BadgeCheck, RotateCcw, Search as SearchIcon } from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { discoveryApi, fileUrl } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { beginBooking } from '../../lib/bookingIntent.js'
import { matchSpecialties, specialtyFromText } from '../../data/symptomSpecialty.js'
import { useI18n } from '../../i18n/index.jsx'
import { translitName, translitDegrees } from '../../lib/translit.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import { shortPlace as placeOf } from '../../lib/shortPlace.js'

/**
 * Find Doctors / Find Hospitals — on the landing page's look (StaticPageShell
 * `modern`, 2026-11-08). The filters are the same as before (search + city +
 * Search, All / Doctors / Hospitals + specialty, the "Suggested" chip); only
 * the title and the results changed: a small "Find Care" heading and one calm
 * list of ruled rows instead of a grid of cards.
 *
 * Search, URL params, suggestion, booking and retry logic are unchanged.
 */

// This page's new words (Title Case buttons, short title). Kept here so no
// shared dictionary changes; the rest still comes from psearch.* keys.
const TX = {
  title: { en: 'Find Care', te: 'వైద్యం కనుగొనండి', hi: 'इलाज खोजें' },
  sub: {
    en: 'Verified doctors and hospitals. You only sign in when you book.',
    te: 'ధృవీకరించిన డాక్టర్లు, ఆసుపత్రులు. బుక్ చేసేటప్పుడు మాత్రమే సైన్ ఇన్ చేయాలి.',
    hi: 'सत्यापित डॉक्टर और अस्पताल। साइन इन सिर्फ़ बुक करते समय करना होगा।',
  },
  years: { en: '{n} years', te: '{n} సంవత్సరాలు', hi: '{n} साल' },
  fee: { en: 'Fee', te: 'ఫీజు', hi: 'फ़ीस' },
  viewProfile: { en: 'View Profile', te: 'ప్రొఫైల్ చూడండి', hi: 'प्रोफ़ाइल देखें' },
  book: { en: 'Book Token', te: 'టోకెన్ బుక్ చేయండి', hi: 'टोकन बुक करें' },
  notAvailable: { en: 'Not Available', te: 'అందుబాటులో లేరు', hi: 'उपलब्ध नहीं' },
  viewFullDetails: { en: 'View Full Details', te: 'పూర్తి వివరాలు చూడండి', hi: 'पूरी जानकारी देखें' },
}

/** This page's translator: same rules as i18n's t(), reading TX instead. */
function useTx() {
  const { lang } = useI18n()
  return useCallback((key, vars) => {
    const entry = TX[key]
    let str = (entry && (entry[lang] ?? entry.en)) ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v)
    return str
  }, [lang])
}

const clean = (value) => String(value || '').trim()

// "Dr. Anitha Rao" -> "AR"; "Sri Sai Multi Speciality" -> "SS".
const initials = (name) => clean(name).replace(/^dr\.?\s*/i, '').split(/\s+/)
  .filter((word) => /^[A-Za-z]/.test(word)).map((word) => word[0].toUpperCase()).join('').slice(0, 2)

// A steady colour per hospital for the initials tile (same hospital, same colour).
const TONES = [
  'from-[#0A9A96] to-[#2F58B7]', 'from-[#C0587E] to-[#7C3AED]', 'from-[#0369A1] to-[#0A9A96]',
  'from-[#15803D] to-[#0A9A96]', 'from-[#EA580C] to-[#C0587E]',
]
const toneOf = (id) => TONES[[...String(id || '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length]

const ROW = 'grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-[#0B2150]/10 py-4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:gap-x-[18px] sm:px-3'
const PILL = 'whitespace-nowrap rounded-full px-5 py-2.5 text-[15px] font-semibold transition-colors'
const SECTION_HEAD = 'border-b border-[#0B2150]/10 pb-3 text-[21px] font-bold text-[#0B2150]'

function LoadingCards() {
  const { t } = useI18n()
  return (
    <div className="mt-8" aria-label={t('psearch.loadingAria')}>
      {[0, 1, 2, 3, 4].map((item) => (
        <div key={item} className="flex items-center gap-4 border-b border-[#0B2150]/10 py-4">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-[#E6F5F4] sm:h-16 sm:w-16" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-[#E6F5F4]" />
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-[#F4F8F8]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onReset }) {
  const { t } = useI18n()
  return (
    <div className="py-14 text-center">
      <p className="text-[18px] font-semibold text-[#0B2150]">{t('psearch.emptyTitle')}</p>
      <p className="mx-auto mt-1.5 max-w-md text-[15.5px] text-[#6B7A8F]">{t('psearch.emptyBody')}</p>
      <button onClick={onReset} className="mt-3 inline-flex items-center gap-1.5 text-[16px] font-semibold text-[#0A9A96] hover:underline">
        <RotateCcw className="h-4 w-4" /> {t('psearch.clearFilters')}
      </button>
    </div>
  )
}

/** Round doctor photo; a missing or failed photo shows the doctor's initials. */
function DoctorPicture({ doctor }) {
  const [failed, setFailed] = useState(false)
  return (
    <span aria-hidden="true" className="grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full bg-white text-[17px] font-bold text-[#0A9A96] ring-1 ring-[#0A9A96]/20 sm:h-16 sm:w-16 sm:text-[20px]">
      {doctor.profile_photo_url && !failed
        ? <img src={fileUrl(doctor.profile_photo_url)} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover object-top" />
        : initials(doctor.name)}
    </span>
  )
}

// The whole row opens the profile (like the old card's photo); the name is the
// real link for keyboards and screen readers, and the buttons keep their own job.
function DoctorCard({ doctor, onBook }) {
  const { t, lang } = useI18n()
  const tx = useTx()
  const navigate = useNavigate()
  const affiliation = doctor.affiliations?.[0]
  const location = affiliation?.name || doctor.hospital_name
  const profile = `/doctors/${doctor.doctor_id}`
  const place = [translitName(location, lang), translitName(doctor.city, lang)].filter(Boolean).join(', ') || t('psearch.locationFallback')
  const openRow = (event) => { if (!event.target.closest('a,button')) navigate(profile) }
  return (
    <article onClick={openRow} className={`${ROW} cursor-pointer transition-colors hover:bg-[#F4F8F8]`}>
      <DoctorPicture doctor={doctor} />
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-[18px] font-semibold text-[#0B2150]">
          <Link to={profile} className="truncate hover:text-[#0A9A96]">{translitName(doctor.name, lang)}</Link>
          <BadgeCheck className="h-4 w-4 shrink-0 text-[#0A9A96]" aria-label={t('psearch.verifiedDoctor')} />
        </h3>
        <p className="truncate text-[15.5px] font-medium text-[#0A9A96]">
          {specialtyLabel(doctor.specialization, lang)} · {tx('years', { n: Number(doctor.experience_years || 0) })}
        </p>
        <p className="truncate text-[14.5px] text-[#6B7A8F]">
          {translitDegrees(doctor.qualification, lang) || t('psearch.qualifiedFallback')} · {place}
        </p>
      </div>
      <div className="col-start-2 flex items-center justify-between gap-4 sm:col-start-3 sm:justify-end sm:gap-[22px]">
        <p className="whitespace-nowrap text-[17px] font-semibold text-[#0B2150] sm:min-w-[64px] sm:text-right">
          ₹{Number(affiliation?.consultation_fee ?? doctor.consultation_fee ?? 0)}
          <span className="block text-[13px] font-normal text-[#6B7A8F]">{tx('fee')}</span>
        </p>
        <Link to={profile} className="whitespace-nowrap text-[15px] font-semibold text-[#0A9A96] hover:underline">{tx('viewProfile')}</Link>
        {/* has_timings false = no weekly session anywhere, so nothing to book. */}
        {doctor.has_timings === false
          ? <span className="whitespace-nowrap py-2.5 text-center text-[14.5px] text-[#6B7A8F] sm:min-w-[132px]">{tx('notAvailable')}</span>
          : <button onClick={() => onBook(doctor, affiliation)} className="whitespace-nowrap rounded-full bg-[#0A9A96] px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-[#088582] sm:min-w-[132px]">{tx('book')}</button>}
      </div>
    </article>
  )
}

/** The hospital tile: photo, else its logo, else coloured initials. A file that
 *  fails to load falls to the next one instead of a broken-image box. */
function HospitalPicture({ hospital }) {
  const [failed, setFailed] = useState({})
  const pick = hospital.photo_url && !failed.photo ? 'photo' : hospital.logo_url && !failed.logo ? 'logo' : null
  return (
    <span aria-hidden="true" className={`grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-2xl bg-gradient-to-br text-[17px] font-bold text-white sm:h-16 sm:w-16 sm:text-[20px] ${toneOf(hospital.hospital_id)}`}>
      {pick
        ? <img src={fileUrl(hospital[`${pick}_url`])} alt="" loading="lazy" onError={() => setFailed((f) => ({ ...f, [pick]: true }))} className="h-full w-full bg-white object-cover" />
        : initials(hospital.name)}
    </span>
  )
}

// A short "area, city" only; the full address lives on the hospital page.
function HospitalCard({ hospital }) {
  const { t, lang } = useI18n()
  const tx = useTx()
  const place = placeOf(hospital.address, hospital.city)
  return (
    <Link to={`/hospitals/${hospital.hospital_id}`} className={`${ROW} group transition-colors hover:bg-[#F4F8F8]`}>
      <HospitalPicture hospital={hospital} />
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-[18px] font-semibold text-[#0B2150]">
          <span className="truncate">{translitName(hospital.name, lang)}</span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-[#0A9A96]" aria-label={t('psearch.verifiedHospital')} />
        </h3>
        {place && (
          <p className="truncate text-[15.5px] font-medium text-[#0A9A96]" title={[hospital.address, hospital.city].filter(Boolean).join(', ')}>
            {translitName(place, lang)}
          </p>
        )}
        <p className="text-[14.5px] text-[#6B7A8F]">{t('psearch.doctorsShort', { n: hospital.doctor_count || 0 })}</p>
      </div>
      <span className="col-start-2 justify-self-start whitespace-nowrap rounded-full px-5 py-2.5 text-[15px] font-semibold text-[#0A9A96] shadow-[inset_0_0_0_1.5px_#0A9A96] transition-colors group-hover:bg-[#0A9A96] group-hover:text-white sm:col-start-3 sm:justify-self-end">
        {tx('viewFullDetails')}
      </span>
    </Link>
  )
}

export default function PublicSearch() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const tx = useTx()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(params.get('q') || '')
  const [data, setData] = useState({ doctors: [], hospitals: [], cities: [], specialties: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  const query = params.get('q') || ''
  const city = params.get('city') || ''
  const specialty = params.get('specialty') || ''
  const type = params.get('type') === 'clinics' ? 'hospitals' : params.get('type') || 'all'  // old links said clinics
  // A speciality NAMED in the box ("dentist") wins over a symptom guess.
  const suggestion = useMemo(() => specialtyFromText(query) || matchSpecialties(query)[0]?.specialty || '', [query])

  useEffect(() => setDraft(query), [query])
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    discoveryApi.search({
      q: query,
      city,
      specialty: specialty || suggestion,
      symptom: Boolean(suggestion && !specialty),
      type,
    })
      .then((result) => { if (active) setData(result || { doctors: [], hospitals: [] }) })
      .catch((err) => { if (active) setError(err.message || 'psearch.unavailable') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, city, specialty, suggestion, type, retryNonce])

  const update = (key, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next)
  }
  const submit = (event) => {
    event.preventDefault()
    update('q', clean(draft))
  }
  const reset = () => {
    setDraft('')
    setParams({})
  }
  const onBook = (doctor, affiliation) => beginBooking({
    user,
    navigate,
    doctorId: doctor.doctor_id,
    affiliationId: affiliation?.affiliation_id,
  })

  const doctors = type === 'hospitals' ? [] : data.doctors || []
  const hospitals = type === 'doctors' ? [] : data.hospitals || []
  const total = doctors.length + hospitals.length
  const field = 'min-h-[50px] rounded-[14px] border-[1.5px] border-[#0B2150]/10 bg-white text-[16px] text-[#0B2150] outline-none transition-colors focus:border-[#0A9A96]'

  return (
    <StaticPageShell modern title={tx('title')}>
      <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-10 sm:px-8 sm:pt-14">
        <h1 className="text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#0B2150]">{tx('title')}</h1>
        <p className="mt-1.5 text-[17px] text-[#41526E]">{tx('sub')}</p>

        <form onSubmit={submit} className="mt-6 grid gap-2.5 rounded-[20px] bg-white p-2.5 shadow-[0_0_0_1px_rgba(11,33,80,.09),0_18px_36px_-28px_rgba(11,33,80,.45)] md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className={`${field} flex items-center gap-2.5 px-3.5 focus-within:border-[#0A9A96]`}>
            <SearchIcon className="h-5 w-5 shrink-0 text-[#0A9A96]" />
            <span className="sr-only">{t('psearch.queryLabel')}</span>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('psearch.queryLabel')} className="w-full min-w-0 bg-transparent py-3.5 outline-none placeholder:text-[#6B7A8F]" />
          </label>
          <select aria-label={t('auth.cityLabel')} value={city} onChange={(event) => update('city', event.target.value)} className={`${field} px-3.5`}>
            <option value="">{t('psearch.allCities')}</option>
            {(data.cities || []).map((item) => <option key={item} value={item}>{translitName(item, lang)}</option>)}
          </select>
          <button className="min-h-[50px] rounded-[14px] bg-[#0A9A96] px-7 text-[16px] font-semibold text-white hover:bg-[#088582]">{t('hero.search')}</button>
        </form>

        {suggestion && !specialty && query && (
          <button onClick={() => update('specialty', suggestion)} className="mt-2.5 rounded-full bg-[#CCEFEC] px-3.5 py-1.5 text-[14px] font-semibold text-[#088582] hover:bg-[#b8e8e4]">
            {t('psearch.suggested', { specialty: suggestion })}
          </button>
        )}

        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[['all', t('ppage.fltAll')], ['doctors', t('pnav.doctors')], ['hospitals', t('psearch.tabHospitals')]].map(([value, label]) => (
              <button key={value} onClick={() => update('type', value === 'all' ? '' : value)} aria-pressed={type === value}
                className={`${PILL} border-[1.5px] ${type === value ? 'border-[#0A9A96] bg-[#0A9A96] text-white' : 'border-[#0B2150]/10 bg-white text-[#41526E] hover:text-[#0B2150]'}`}>{label}</button>
            ))}
          </div>
          <select aria-label={t('psearch.specialty')} value={specialty} onChange={(event) => update('specialty', event.target.value)} className={`${field} min-h-[44px] rounded-full px-4 text-[15px]`}>
            <option value="">{t('psearch.allSpecialties')}</option>
            {(data.specialties || []).map((item) => <option key={item} value={item}>{specialtyLabel(item, lang)}</option>)}
          </select>
        </div>

        {loading ? <LoadingCards /> : error ? (
          <div className="py-14 text-center">
            <p className="text-[18px] font-semibold text-[#C2410C]">{t(error)}</p>
            <button onClick={() => setRetryNonce((value) => value + 1)} className="mt-2 text-[16px] font-semibold text-[#0A9A96] hover:underline">{t('psearch.tryAgain')}</button>
          </div>
        ) : total === 0 ? <EmptyState onReset={reset} /> : (
          <>
            {doctors.length > 0 && (
              <section className="mt-[30px]">
                <h2 className={SECTION_HEAD}>{t('pnav.doctors')} <span className="ml-1 text-[16px] font-medium text-[#6B7A8F]">({doctors.length})</span></h2>
                {doctors.map((doctor) => <DoctorCard key={doctor.doctor_id} doctor={doctor} onBook={onBook} />)}
              </section>
            )}
            {hospitals.length > 0 && (
              <section className="mt-[30px]">
                <h2 className={SECTION_HEAD}>{t('pnav.hospitals')} <span className="ml-1 text-[16px] font-medium text-[#6B7A8F]">({hospitals.length})</span></h2>
                {hospitals.map((hospital) => <HospitalCard key={hospital.hospital_id} hospital={hospital} />)}
              </section>
            )}
          </>
        )}
      </main>
    </StaticPageShell>
  )
}
