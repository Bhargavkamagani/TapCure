import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck, Building2, IndianRupee, MapPin, Search as SearchIcon,
  Stethoscope, Users, RotateCcw,
} from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { discoveryApi, fileUrl } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { beginBooking } from '../../lib/bookingIntent.js'
import { matchSpecialties, specialtyFromText } from '../../data/symptomSpecialty.js'
import { useI18n } from '../../i18n/index.jsx'
import { translitName, translitDegrees } from '../../lib/translit.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import { shortPlace as placeOf } from '../../lib/shortPlace.js'
import { InsuranceLogos, useInsurers } from '../../components/common/Insurance.jsx'

const clean = (value) => String(value || '').trim()

function LoadingCards() {
  const { t, lang } = useI18n()
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('psearch.loadingAria')}>
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="h-64 animate-pulse rounded-3xl border border-white/60 bg-white/55" />
      ))}
    </div>
  )
}

function EmptyState({ onReset }) {
  const { t, lang } = useI18n()
  return (
    <div className="rounded-3xl border border-white/60 bg-white/65 px-6 py-14 text-center shadow-sm backdrop-blur">
      <SearchIcon className="mx-auto h-10 w-10 text-sage-deep/50" />
      <h2 className="mt-4 font-serif text-2xl">{t('psearch.emptyTitle')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        {t('psearch.emptyBody')}
      </p>
      <button onClick={onReset} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white">
        <RotateCcw className="h-4 w-4" /> {t('psearch.clearFilters')}
      </button>
    </div>
  )
}

// Doctor card (2026-10-01): photo on the LEFT, flush to the card's edge and
// as tall as the card, the details and buttons on the right. Doctor photos
// are mostly portraits; every wide picture area tried on top of the card
// either cut them to the head or made the card very tall. A tall, narrow
// frame matches a portrait, and filling the card's own height makes the photo
// bigger without making the card any bigger. The image is absolutely
// positioned, so its own shape can never stretch the card taller. A missing or failed photo falls back to
// the stethoscope tile.
function DoctorPicture({ doctor }) {
  const [failed, setFailed] = useState(false)
  if (doctor.profile_photo_url && !failed) {
    return (
      <img src={fileUrl(doctor.profile_photo_url)} alt="" loading="lazy" onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
    )
  }
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-teal-50 via-emerald-50 to-teal-100">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white/80 text-teal-700 shadow-sm"><Stethoscope className="h-6 w-6" /></span>
    </div>
  )
}

function DoctorCard({ doctor, onBook }) {
  const { t, lang } = useI18n()
  const affiliation = doctor.affiliations?.[0]
  const location = affiliation?.name || doctor.hospital_name
  return (
    <article className="group flex h-full overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg">
      <Link to={`/doctors/${doctor.doctor_id}`} className="relative block min-h-[11rem] w-48 shrink-0 self-stretch overflow-hidden sm:w-52" aria-label={t('psearch.viewProfile')}>
        <DoctorPicture doctor={doctor} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col px-3.5 py-4">
        <div className="flex items-center gap-1.5">
          <h2 className="truncate text-[18px] font-bold text-foreground">{translitName(doctor.name, lang)}</h2>
          <BadgeCheck className="h-4 w-4 shrink-0 text-teal-600" aria-label={t('psearch.verifiedDoctor')} />
        </div>
        <p className="truncate text-[15px] font-medium text-sage-deep">{specialtyLabel(doctor.specialization, lang)}</p>
        <p className="truncate text-[13px] text-muted-foreground">{translitDegrees(doctor.qualification, lang) || t('psearch.qualifiedFallback')}</p>
        <p className="mt-2 flex items-center gap-1.5 text-[15px] text-ink-soft"><MapPin className="h-4 w-4 shrink-0 text-sage-deep" /><span className="truncate">{translitName(location || doctor.city, lang) || t('psearch.locationFallback')}</span></p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[15px] text-ink-soft">
          <span className="flex items-center gap-0.5 font-semibold text-foreground"><IndianRupee className="h-4 w-4" />{Number(affiliation?.consultation_fee ?? doctor.consultation_fee ?? 0)}</span>
          <span className="truncate text-[13px]">{t('psearch.yearsExp', { n: Number(doctor.experience_years || 0) })}</span>
        </div>
        <div className="mt-auto grid grid-cols-[1.3fr_1fr] gap-1.5 pt-3">
          <Link to={`/doctors/${doctor.doctor_id}`} className="whitespace-nowrap rounded-xl border border-teal-600 px-2 py-2 text-center text-[14px] font-semibold text-teal-700 hover:bg-teal-50">{t('psearch.viewProfile')}</Link>
          {/* has_timings false = no weekly session anywhere, so nothing to book. */}
          {doctor.has_timings === false
            ? <span className="cursor-not-allowed whitespace-nowrap rounded-xl bg-slate-200 px-2 py-2 text-center text-[14px] font-semibold text-slate-500">{t('pdoc.notAvailableShort')}</span>
            : <button onClick={() => onBook(doctor, affiliation)} className="whitespace-nowrap rounded-xl bg-teal-700 px-2 py-2 text-[14px] font-semibold text-white hover:bg-teal-800">{t('psearch.book')}</button>}
        </div>
      </div>
    </article>
  )
}

/** The card's picture: the hospital photo, else its logo, else an icon.
 *  A file that fails to load (missing, expired link) falls to the next one
 *  instead of showing the browser's broken-image box. */
function HospitalPicture({ hospital }) {
  const [failed, setFailed] = useState({})
  // Photo first, then the logo — both fill the whole picture area (a logo
  // shown as a small tile in the middle looked like a placeholder).
  const pick = hospital.photo_url && !failed.photo ? 'photo' : hospital.logo_url && !failed.logo ? 'logo' : null
  if (pick) {
    return (
      <img src={fileUrl(hospital[`${pick}_url`])} alt="" loading="lazy" onError={() => setFailed((f) => ({ ...f, [pick]: true }))}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
    )
  }
  return (
    <div className="grid h-full w-full place-items-center bg-gradient-to-br from-teal-50 via-emerald-50 to-teal-100">
      <span className="grid h-20 w-20 place-items-center rounded-2xl bg-white/80 text-teal-700 shadow-sm"><Building2 className="h-9 w-9" /></span>
    </div>
  )
}

// Picture-first card (2026-10-01): the full address made every card a
// different height; the card shows a short "area, city" and the rest lives on
// the hospital page behind "View full details".
function HospitalCard({ hospital }) {
  const { t, lang } = useI18n()
  return (
    <Link to={`/hospitals/${hospital.hospital_id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <HospitalPicture hospital={hospital} />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-sm">
          <Users className="h-3.5 w-3.5" />{t('psearch.doctorsShort', { n: hospital.doctor_count || 0 })}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-1.5">
          <h2 className="truncate text-[18px] font-bold text-foreground">{translitName(hospital.name, lang)}</h2>
          <BadgeCheck className="h-4 w-4 shrink-0 text-teal-600" aria-label={t('psearch.verifiedHospital')} />
          {/* Insurers accepted: small logos, top right (2026-11-03). */}
          <InsuranceLogos codes={hospital.insurance_partners} className="ml-auto pl-1" />
        </div>
        {placeOf(hospital.address, hospital.city) && (
          <p className="mt-1 flex items-center gap-1 text-[15px] text-ink-soft" title={[hospital.address, hospital.city].filter(Boolean).join(', ')}>
            <MapPin className="h-3.5 w-3.5 shrink-0 text-sage-deep" />
            <span className="truncate">{translitName(placeOf(hospital.address, hospital.city), lang)}</span>
          </p>
        )}
        <span className="mt-auto pt-4">
          <span className="block rounded-xl bg-teal-700 px-3 py-2.5 text-center text-[15px] font-semibold text-white group-hover:bg-teal-800">{t('psearch.viewFullDetails')}</span>
        </span>
      </div>
    </Link>
  )
}

export default function PublicSearch() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState(params.get('q') || '')
  const [data, setData] = useState({ doctors: [], hospitals: [], cities: [], specialties: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)

  const query = params.get('q') || ''
  const city = params.get('city') || ''
  const specialty = params.get('specialty') || ''
  const insurance = params.get('insurance') || ''
  const { groups: insurerGroups } = useInsurers()
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
      insurance,
    })
      .then((result) => { if (active) setData(result || { doctors: [], hospitals: [] }) })
      .catch((err) => { if (active) setError(err.message || 'psearch.unavailable') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [query, city, specialty, suggestion, type, insurance, retryNonce])

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

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-[1440px] px-4 pb-24 pt-12 sm:px-8 lg:px-12">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-sage-deep">{t('psearch.eyebrow')}</p>
          <h1 className="mt-2 font-serif text-5xl tracking-tight sm:text-6xl">{t('psearch.title')}</h1>
          <p className="mt-4 text-lg text-ink-soft">{t('psearch.subtitle')}</p>
        </div>

        <form onSubmit={submit} className="mt-10 grid gap-3 rounded-3xl border border-white/60 bg-white/70 p-3.5 shadow-sm backdrop-blur md:grid-cols-[minmax(280px,1fr)_220px_auto]">
          <label className="flex items-center gap-2 rounded-2xl border border-teal-100 bg-white px-4">
            <SearchIcon className="h-6 w-6 text-sage-deep" />
            <span className="sr-only">{t('psearch.queryLabel')}</span>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('psearch.queryLabel')} className="w-full bg-transparent py-4 text-base outline-none" />
          </label>
          <select aria-label={t('auth.cityLabel')} value={city} onChange={(event) => update('city', event.target.value)} className="rounded-2xl border border-teal-100 bg-white px-4 py-4 text-base outline-none">
            <option value="">{t('psearch.allCities')}</option>
            {(data.cities || []).map((item) => <option key={item} value={item}>{translitName(item, lang)}</option>)}
          </select>
          <button className="rounded-2xl bg-primary px-8 py-4 text-base font-bold text-white hover:opacity-90">{t('hero.search')}</button>
        </form>

        {suggestion && !specialty && query && (
          <button onClick={() => update('specialty', suggestion)} className="mt-3 rounded-full bg-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800">
            {t('psearch.suggested', { specialty: suggestion })}
          </button>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-2.5">
          {[['all', t('ppage.fltAll')], ['doctors', t('pnav.doctors')], ['hospitals', t('psearch.tabHospitals')]].map(([value, label]) => (
            <button key={value} onClick={() => update('type', value === 'all' ? '' : value)} className={`rounded-full px-5 py-2.5 text-[15px] font-semibold ${type === value ? 'bg-teal-700 text-white' : 'border border-teal-100 bg-white/70 text-ink-soft'}`}>{label}</button>
          ))}
          <select aria-label={t('psearch.specialty')} value={specialty} onChange={(event) => update('specialty', event.target.value)} className="ml-auto rounded-full border border-teal-100 bg-white/70 px-5 py-2.5 text-[15px] outline-none">
            <option value="">{t('psearch.allSpecialties')}</option>
            {(data.specialties || []).map((item) => <option key={item} value={item}>{specialtyLabel(item, lang)}</option>)}
          </select>
          <select aria-label={t('ins.filterLabel')} value={insurance} onChange={(event) => update('insurance', event.target.value)} className="max-w-[220px] rounded-full border border-teal-100 bg-white/70 px-5 py-2.5 text-[15px] outline-none">
            <option value="">{t('ins.filterAny')}</option>
            {insurerGroups.map((g) => (
              <optgroup key={g.key} label={t(`ins.group.${g.key}`)}>
                {g.items.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="mt-8">
          {loading ? <LoadingCards /> : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="font-semibold text-red-800">{t(error)}</p>
              <button onClick={() => setRetryNonce((value) => value + 1)} className="mt-3 text-sm font-semibold text-red-700 underline">{t('psearch.tryAgain')}</button>
            </div>
          ) : total === 0 ? <EmptyState onReset={reset} /> : (
            <div className="space-y-10">
              {doctors.length > 0 && (
                <section>
                  <h2 className="mb-5 font-serif text-3xl">{t('pnav.doctors')} <span className="text-lg text-muted-foreground">({doctors.length})</span></h2>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{doctors.map((doctor) => <DoctorCard key={doctor.doctor_id} doctor={doctor} onBook={onBook} />)}</div>
                </section>
              )}
              {hospitals.length > 0 && (
                <section>
                  <h2 className="mb-5 font-serif text-3xl">{t('pnav.hospitals')} <span className="text-lg text-muted-foreground">({hospitals.length})</span></h2>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{hospitals.map((hospital) => <HospitalCard key={hospital.hospital_id} hospital={hospital} />)}</div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </StaticPageShell>
  )
}
