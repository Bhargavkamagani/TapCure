import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Award, BadgeCheck, Building2, CalendarDays, Clock, IndianRupee, Languages,
  MapPin, Stethoscope,
} from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import HospitalMap from '../../components/common/HospitalMap.jsx'
import { discoveryApi, fileUrl } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { beginBooking } from '../../lib/bookingIntent.js'
import { useI18n } from '../../i18n/index.jsx'
import { translitName, translitDegrees } from '../../lib/translit.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import { cleanAddress } from '../../lib/shortPlace.js'

/**
 * Public doctor profile ("View profile" on Find Doctors). Redesigned
 * 2026-10-01: the old page was a narrow column with a thumbnail photo, a
 * half-width location card, the raw address and timings in tiny grey text.
 * Now: big photo header, About, one full-width card per practice with a
 * clean address + satellite map, and a readable weekly timetable with today
 * highlighted.
 */

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fmtTime = (value) => {
  if (!value) return ''
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  const suffix = hours >= 12 ? 'PM' : 'AM'
  return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, '0')} ${suffix}`
}
// Today's weekday in IST, as the schedule rows spell it ("Mon").
const todayIST = () => DAY_ORDER[(new Date(Date.now() + 330 * 60000).getUTCDay() + 6) % 7]

/**
 * When the doctor can next be seen, from the weekly timings of every practice
 * (IST). Returns { kind: 'now' | 'today' | 'next' | 'none', ... } for the badge
 * under the name. Days in `daysOff` (approved leave / full-day holiday, sent by
 * the server for the next 14 days as "YYYY-MM-DD") are skipped; `awayToday`
 * says today was one of them.
 */
function nextAvailability(affiliations, availableToday, daysOff = []) {
  const rows = (affiliations || []).flatMap((a) => a.schedules || [])
  if (!rows.length) return { kind: 'none' }
  const ist = new Date(Date.now() + 330 * 60000)
  const nowHM = ist.toISOString().slice(11, 16)                     // "14:05"
  const todayIdx = (ist.getUTCDay() + 6) % 7                          // Mon = 0
  const hm = (v) => String(v || '').slice(0, 5)
  const off = new Set(daysOff)
  const awayToday = off.has(ist.toISOString().slice(0, 10))
  for (let offset = 0; offset < 14; offset += 1) {
    const day = DAY_ORDER[(todayIdx + offset) % 7]
    const iso = new Date(ist.getTime() + offset * 86400000).toISOString().slice(0, 10)
    if (off.has(iso)) continue                                        // on leave / holiday
    if (offset === 0 && availableToday === false) continue           // marked away today
    const sessions = rows
      .filter((r) => r.day_of_week === day)
      .sort((a, b) => hm(a.start_time).localeCompare(hm(b.start_time)))
    if (!sessions.length) continue
    if (offset === 0) {
      const running = sessions.find((s) => hm(s.start_time) <= nowHM && nowHM < hm(s.end_time))
      if (running) return { kind: 'now', until: running.end_time }
      const later = sessions.filter((s) => hm(s.start_time) > nowHM)
      if (later.length) return { kind: 'today', sessions: later }
      continue                                                        // today's hours are over
    }
    return { kind: 'next', day, offset, start: sessions[0].start_time, awayToday }
  }
  return { kind: awayToday ? 'away' : 'none' }
}

function AvailabilityBadge({ data }) {
  const { t } = useI18n()
  const a = nextAvailability(data.affiliations, data.is_available_today, data.days_off)
  const base = 'mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-semibold'
  const dot = (c) => <span className={`h-2.5 w-2.5 rounded-full ${c}`} />
  if (a.kind === 'now') {
    return <span className={`${base} bg-green-50 text-green-700`}>{dot('bg-green-500 animate-pulse')}{t('pdoc.availNow', { time: fmtTime(a.until) })}</span>
  }
  if (a.kind === 'today') {
    const hours = a.sessions.map((s) => `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)}`).join(', ')
    return <span className={`${base} bg-green-50 text-green-700`}>{dot('bg-green-500')}{t('pdoc.availToday', { hours })}</span>
  }
  if (a.kind === 'next') {
    const day = a.offset === 1 ? t('pdoc.tomorrow') : t(`cmn.day.${a.day}`)
    const next = t('pdoc.nextAvail', { day, time: fmtTime(a.start) })
    return a.awayToday
      ? <span className={`${base} bg-amber-50 text-amber-800`}>{dot('bg-amber-500')}{t('pdoc.awayToday')} · {next}</span>
      : <span className={`${base} bg-sky-50 text-sky-700`}>{dot('bg-sky-500')}{next}</span>
  }
  if (a.kind === 'away') {
    return <span className={`${base} bg-amber-50 text-amber-800`}>{dot('bg-amber-500')}{t('pdoc.awayToday')}</span>
  }
  return <span className={`${base} bg-slate-100 text-slate-500`}>{dot('bg-slate-400')}{t('pdoc.notAvailableShort')}</span>
}

function DoctorPhoto({ data }) {
  const [failed, setFailed] = useState(false)
  if (data.profile_photo_url && !failed) {
    return (
      <img src={fileUrl(data.profile_photo_url)} alt={data.name} onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover object-top" />
    )
  }
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-teal-50 via-emerald-50 to-teal-100">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-white/80 text-teal-700 shadow-sm"><Stethoscope className="h-10 w-10" /></span>
    </div>
  )
}

function Timetable({ schedules }) {
  const { t } = useI18n()
  const today = todayIST()
  return (
    <div className="overflow-hidden rounded-2xl border border-teal-100 bg-white/80">
      {DAY_ORDER.map((day) => {
        const rows = schedules.filter((row) => row.day_of_week === day)
        const isToday = day === today
        return (
          <div key={day} className={`flex items-center justify-between gap-3 border-b border-teal-50 px-4 py-2.5 text-[15px] last:border-b-0 ${isToday ? 'bg-teal-50 font-semibold' : ''}`}>
            <span className="flex items-center gap-2 text-foreground">
              {t(`cmn.day.${day}`)}
              {isToday && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[11px] font-bold text-white">{t('pdoc.today')}</span>}
            </span>
            {rows.length
              ? <span className="text-right text-ink-soft">{rows.map((row) => `${fmtTime(row.start_time)} – ${fmtTime(row.end_time)}`).join(', ')}</span>
              : <span className="text-slate-400">{t('pdoc.closed')}</span>}
          </div>
        )
      })}
    </div>
  )
}

function PracticeCard({ affiliation, fallbackFee, onBook, photo }) {
  const { t, lang } = useI18n()
  const address = cleanAddress(affiliation.address, affiliation.city)
  const hasPin = affiliation.latitude != null && affiliation.longitude != null
  return (
    <article className="rounded-3xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Building2 className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-foreground">{translitName(affiliation.name, lang)}</h3>
            <p className="mt-1 flex items-start gap-1.5 text-[15px] text-ink-soft">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sage-deep" />
              {address ? translitName(address, lang) : t('pdoc.addressFallback')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center text-2xl font-extrabold text-foreground"><IndianRupee className="h-5 w-5" />{Number(affiliation.consultation_fee ?? fallbackFee ?? 0)}</span>
          {/* No timings here = no slots to book: say so instead of a Book
              button that leads to an empty calendar. */}
          {affiliation.schedules?.length
            ? <button onClick={() => onBook(affiliation.affiliation_id)} className="rounded-xl bg-teal-700 px-5 py-2.5 text-[15px] font-bold text-white hover:bg-teal-800">{t('pdoc.bookHere')}</button>
            : <span className="cursor-not-allowed rounded-xl bg-slate-200 px-5 py-2.5 text-[15px] font-bold text-slate-500">{t('pdoc.notAvailableShort')}</span>}
        </div>
      </div>

      <div className={`mt-5 grid gap-5 ${hasPin ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
        {hasPin && (
          <div>
            <HospitalMap
              hospital={{ latitude: affiliation.latitude, longitude: affiliation.longitude }}
              hospitalLabel={affiliation.name}
              hospitalLogo={photo || null}
              hospitalLogoFit="cover"
              height={280}
            />{/* the map carries its own Open in Google Maps button */}
          </div>
        )}
        <div>
          <p className="mb-2 flex items-center gap-2 text-[15px] font-bold text-foreground"><Clock className="h-4 w-4 text-sage-deep" />{t('pdoc.timings')}</p>
          {affiliation.schedules?.length
            ? <Timetable schedules={affiliation.schedules} />
            : <p className="rounded-2xl bg-amber-50 p-4 text-[14px] text-amber-800">{t('pdoc.notAvailableHere')}</p>}
        </div>
      </div>
    </article>
  )
}

export default function PublicDoctorProfile() {
  const { doctorId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    discoveryApi.doctor(doctorId)
      .then((result) => { if (active) setData(result) })
      .catch((err) => { if (active) setError(err.status === 404 ? 'pdoc.notAvailable' : err.message || 'pdoc.loadFailed') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [doctorId])

  const book = (affiliationId) => beginBooking({ user, navigate, doctorId, affiliationId })
  // Back to the list the visitor came from; a shared link has no history.
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/search?type=doctors'))
  // Bookable only somewhere the doctor actually has consultation timings.
  const bookableAff = (data?.affiliations || []).find((a) => a.schedules?.length)
  const bookable = Boolean(bookableAff) && data?.status === 'active'

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-8 sm:px-8 lg:px-12">
        <button onClick={back} className="mb-5 inline-flex items-center gap-2 text-[15px] font-semibold text-sage-deep transition-all hover:gap-3">
          <ArrowLeft className="h-4 w-4" /> {t('pdoc.backToSearch')}
        </button>

        {loading ? (
          <div className="h-[420px] animate-pulse rounded-[2rem] border border-white/60 bg-white/60" />
        ) : error || !data ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
            <h1 className="font-serif text-3xl">{t('pdoc.unavailableTitle')}</h1>
            <p className="mt-2 text-sm text-red-700">{error ? t(error) : ''}</p>
            <Link to="/search?type=doctors" className="mt-5 inline-block text-sm font-semibold text-teal-700 underline">{t('pdoc.browseDoctors')}</Link>
          </div>
        ) : (
          <>
            {/* Header: big photo, who they are, fee + Book */}
            <section className="flex flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 shadow-sm backdrop-blur md:flex-row">
              <div className="relative aspect-[4/5] w-full shrink-0 md:aspect-auto md:min-h-[20rem] md:w-72">
                <DoctorPhoto data={data} />
              </div>
              <div className="flex flex-1 flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{translitName(data.name, lang)}</h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700"><BadgeCheck className="h-4 w-4" /> {t('pdoc.verified')}</span>
                  </div>
                  <p className="mt-2 text-xl font-semibold text-sage-deep">{specialtyLabel(data.specialization, lang)}</p>
                  {data.status === 'active' && <div><AvailabilityBadge data={data} /></div>}
                  <div className="mt-5 flex flex-col gap-3 text-[16px] text-ink-soft">
                    {data.qualification && <span className="flex items-center gap-2.5"><Award className="h-5 w-5 text-sage-deep" />{translitDegrees(data.qualification, lang)}</span>}
                    <span className="flex items-center gap-2.5"><CalendarDays className="h-5 w-5 text-sage-deep" />{t('psearch.yearsExp', { n: Number(data.experience_years || 0) })}</span>
                    {data.languages && <span className="flex items-center gap-2.5"><Languages className="h-5 w-5 text-sage-deep" />{data.languages}</span>}
                  </div>
                </div>
                <div className="rounded-2xl bg-teal-50 p-5 text-center lg:w-60">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t('pdoc.consultFrom')}</p>
                  <p className="mt-1 flex items-center justify-center text-4xl font-extrabold text-foreground"><IndianRupee className="h-7 w-7" />{Number(data.consultation_fee || 0)}</p>
                  <button onClick={() => book(bookableAff?.affiliation_id)} disabled={!bookable}
                    className="mt-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-[15px] font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                    {t('pdoc.bookAppointment')}
                  </button>
                </div>
              </div>
            </section>

            {data.bio && (
              <section className="mt-8 rounded-3xl border border-white/60 bg-white/75 p-6 shadow-sm backdrop-blur sm:p-8">
                <h2 className="font-serif text-2xl">{t('pdoc.about')}</h2>
                <p className="mt-3 max-w-4xl whitespace-pre-line text-[16px] leading-7 text-ink-soft">{data.bio}</p>
              </section>
            )}

            <section className="mt-8">
              <h2 className="font-serif text-3xl">{t('pdoc.hospitalLocation')}</h2>
              <div className="mt-5 flex flex-col gap-5">
                {(data.affiliations || []).map((affiliation) => (
                  <PracticeCard key={affiliation.affiliation_id} affiliation={affiliation} fallbackFee={data.consultation_fee} onBook={book} photo={data.profile_photo_url} />
                ))}
              </div>
              {!data.affiliations?.length && <p className="mt-4 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">{t('pdoc.noLocation')}</p>}
            </section>
          </>
        )}
      </main>
    </StaticPageShell>
  )
}
