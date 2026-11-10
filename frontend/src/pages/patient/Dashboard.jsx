import { useCallback, useEffect, useRef, useState, Fragment } from 'react'
import { translitName } from '../../lib/translit.js'
import { originLabelText } from '../../lib/englishText.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { motion, useReducedMotion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ArrowRight, MapPin, Clock, Bell, BellRing, CalendarPlus, CalendarDays, Ticket,
  CheckCircle2, Mic, CalendarClock, Car, Users, AlertTriangle, Zap, ShieldCheck, Smile, Footprints,
  Navigation, UserRound,
} from 'lucide-react'
import { Card } from '../../components/hospital/ui.jsx'
import HospitalMap from '../../components/common/HospitalMap.jsx'
import FollowUpCard from '../../components/patient/FollowUpCard.jsx'
import TodayMedicines from '../../components/patient/TodayMedicines.jsx'
import RevisitPassCard from '../../components/patient/RevisitPassCard.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { tokensApi, fileUrl } from '../../api'
import { dateChip, prettyTime, todayISO, clockIST, clockISTWithDay, humanMins } from '../../lib/format.js'
import { roadTravelMinutes, mapsDirectionsUrl } from '../../lib/geo.js'
import { useI18n } from '../../i18n/index.jsx'
import { speak } from '../../lib/voice.js'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import { QUEUE_ALERTS_KEY, queueAlertsMuted } from '../../components/common/DelayToaster.jsx'

const ACTIVE_STATUSES = ['scheduled', 'booked', 'confirmed', 'pending', 'checked_in', 'in_progress']

/** First run of digits in a string (e.g. "#13" -> 13), or null. */
const digits = (s) => {
  const m = String(s ?? '').match(/\d+/)
  return m ? parseInt(m[0], 10) : null
}

/** Build the little token-number track around "now serving" and "your token". */
function buildTrack(nowNum, youNum) {
  if (nowNum == null && youNum == null) return []
  if (nowNum != null && youNum != null && youNum >= nowNum) {
    if (youNum - nowNum <= 5) {
      const a = []
      for (let n = nowNum; n <= youNum; n++) a.push({ n, kind: n === nowNum ? 'now' : n === youNum ? 'you' : 'mid' })
      return a
    }
    return [
      { n: nowNum, kind: 'now' },
      { n: nowNum + 1, kind: 'mid' },
      { kind: 'gap' },
      { n: youNum - 1, kind: 'mid' },
      { n: youNum, kind: 'you' },
    ]
  }
  const base = youNum ?? nowNum
  const a = []
  for (let n = Math.max(1, base - 2); n <= base + 2; n++) a.push({ n, kind: n === nowNum ? 'now' : n === youNum ? 'you' : 'mid' })
  return a
}

/**
 * Smart OP Queue card — live view of the patient's token vs the one being
 * served. All values come from `tokensApi.estimate` (the `est` object); nothing
 * is mocked.
 */
function SmartOpQueue({ est, liveTravelMin, onNotify, notifyOn }) {
  const { t, lang } = useI18n()
  const youNum = est.token_number || digits(est.display_code)
  const nowNum = digits(est.now_serving)
  const before = Math.max(0, (est.queue_position || 1) - 1)
  const track = buildTrack(nowNum, youNum)

  const crowd =
    est.total_waiting <= 5
      ? { label: t('pdash.lightCrowd'), cls: 'bg-emerald-50 text-emerald-600' }
      : est.total_waiting <= 15
      ? { label: t('pdash.moderateCrowd'), cls: 'bg-amber-50 text-amber-600' }
      : { label: t('pdash.heavyCrowd'), cls: 'bg-red-50 text-red-500' }
  const punctual =
    est.delay_min > 0
      ? { label: t('pdash.minLate', { n: est.delay_min }), icon: AlertTriangle, cls: 'bg-amber-50 text-amber-600' }
      : { label: t('pdash.onTime'), icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' }

  // Circle styling per node — matches the provided design (ring states + scale).
  const circleCls = (node) =>
    node.kind === 'now'
      ? 'scale-110 bg-teal-600 text-white ring-4 ring-teal-100'
      : node.kind === 'you'
      ? 'bg-orange-100 text-orange-600 ring-2 ring-orange-300'
      : nowNum != null && node.n < nowNum
      ? 'bg-teal-100 text-teal-600'
      : 'bg-slate-100 text-slate-400'

  return (
    <>
      {/* Now serving / Your token */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3.5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{t('pdash.nowServing')}</p>
          <p className="mt-0.5 text-3xl font-extrabold tabular-nums text-teal-600 animate-token-pulse">{nowNum != null ? `#${nowNum}` : '—'}</p>
        </div>
        <div className="rounded-2xl bg-orange-50 p-3.5 ring-1 ring-orange-100">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-orange-400">{t('pdash.yourToken')}</p>
          <p className="mt-0.5 text-3xl font-extrabold tabular-nums text-orange-500">{youNum != null ? `#${youNum}` : '—'}</p>
        </div>
      </div>

      {/* Token track — matches the provided design (h-8 circles + colored connectors) */}
      {track.length > 0 && (
        <div className="mt-4 flex items-center justify-between px-1">
          {track.map((node, i) => {
            const prevDone = i > 0 && track[i - 1].n != null && nowNum != null && track[i - 1].n < nowNum
            return (
              <Fragment key={i}>
                {i > 0 && (
                  <span className={`mb-4 h-0.5 flex-1 rounded-full transition-colors duration-300 ${prevDone ? 'bg-teal-300' : 'bg-slate-200'}`} />
                )}
                <div className="flex flex-col items-center gap-1">
                  {node.kind === 'gap' ? (
                    <span className="flex h-8 items-center px-1 text-[16px] font-bold text-slate-300">…</span>
                  ) : (
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold tabular-nums transition-all duration-300 ${circleCls(node)}`}>{node.n}</span>
                  )}
                  <span className={`text-[13px] font-bold ${node.kind === 'now' ? 'text-teal-600' : node.kind === 'you' ? 'text-orange-500' : 'text-transparent'}`}>
                    {node.kind === 'now' ? t('pdash.now') : node.kind === 'you' ? t('pdash.you') : '·'}
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>
      )}

      {/* Status chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold ${punctual.cls}`}>
          <punctual.icon className="h-3.5 w-3.5" /> {punctual.label}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold ${crowd.cls}`}>
          <Users className="h-3.5 w-3.5" /> {crowd.label}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[13px] font-semibold text-teal-700">
          {before === 0 ? t('pdash.youreNext') : t('pdash.beforeYou', { n: before })}
        </span>
      </div>

      {/* Wait · travel · leave · arrive — teal panel from the design.
          Four across on a wide screen, 2×2 on a phone. "Leave by" was the one
          number the panel never actually said: it was implied by reach-by minus
          travel, and used for the alert, but the patient had to work it out. */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-teal-50/70 p-3.5 sm:grid-cols-4">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div>
            <p className="text-[13px] text-slate-500">{t('pdash.estWait')}</p>
            <p className="font-bold text-slate-800">{humanMins(t, est.wait_min)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Car className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div>
            <p className="flex items-center gap-1 text-[13px] text-slate-500">
              {t('pdash.travelTime')}
              {liveTravelMin != null && (
                <span title={t('pm.liveTraffic')} className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              )}
            </p>
            <p className="font-bold text-slate-800">
              {(liveTravelMin ?? est.travel_min) != null ? `~${humanMins(t, liveTravelMin ?? est.travel_min)}` : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Footprints className={`mt-0.5 h-5 w-5 shrink-0 ${est.should_leave_now ? 'text-amber-600' : 'text-teal-600'}`} />
          <div>
            <p className="text-[13px] text-slate-500">{t('pdash.leaveByTitle')}</p>
            {/* Once the moment has passed, a clock time reads as "you're late".
                "Now" is both truthful and the actual instruction. */}
            <p className={`font-bold ${est.should_leave_now ? 'text-amber-700' : 'text-slate-800'}`}>
              {est.should_leave_now ? t('pdash.leaveNowShort') : (est.leave_by ? clockIST(est.leave_by) : '—')}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div>
            <p className="text-[13px] text-slate-500">{t('pdash.reachBy')}</p>
            <p className="font-bold text-slate-800">{est.arrive_by ? clockIST(est.arrive_by) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Link
          to="appointments"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          {t('pdash.viewOpQueue')} <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onNotify}
          aria-pressed={notifyOn}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition ${
            notifyOn ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700'
          }`}
        >
          {notifyOn ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {notifyOn ? t('pdash.remindersOn') : t('pdash.notifyMe')}
        </button>
      </div>
    </>
  )
}

/**
 * Blank state shown inside the Smart OP Queue card when there's no live token —
 * so the card is always present, just with empty data (as it was originally).
 */
function QueueEmpty({ nextAppt }) {
  const { t, lang } = useI18n()
  const chip = nextAppt ? dateChip(nextAppt.appointment_date) : null
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Ticket className="h-7 w-7" />
      </span>
      <p className="text-[15px] font-bold text-brand-navy">{t('pdash.noTokenYet')}</p>
      <p className="mt-1.5 max-w-xs text-[13.5px] leading-relaxed text-slate-500">
        {nextAppt
          ? t('pdash.queueOpensOn', { date: `${chip.day} ${chip.month}` })
          : t('pdash.queueNoAppt')}
      </p>
      {!nextAppt && (
        <Link
          to="appointments/book"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-blueDark"
        >
          <CalendarPlus className="h-4 w-4" /> {t('pdash.bookOneNow')}
        </Link>
      )}
    </div>
  )
}

function Dashboard() {
  const dialog = useDialog()
  const { t, lang, speech } = useI18n()
  const { patient, resolveDoctor, resolveHospital, resolveAffiliation, appointments: appts, reloadAppointments } = usePatientCtx()
  const [est, setEst] = useState(null)     // my token status for today (identity + ETA + leave-by)
  const reduceMotion = useReducedMotion()
  const [hasMeds, setHasMeds] = useState(false) // TodayMedicines is showing → 3-column row
  /* The empty-state globe turns in two layers, and they add up.
     The INNER layer runs one constant keyframe loop that is never touched:
     speeding a running keyframe animation up is impossible — handing it a new
     duration restarts it from the top, which reads as a jump backwards.
     The OUTER layer is this value: a tap eases it a further 7% along (a bit
     over a quarter turn), so the globe surges ahead and coasts while the
     steady turn continues underneath. Both are percentages of the strip row,
     which draws the world four times over, so anything wrapped by 25% lands
     on an identical copy and no seam is ever visible. */
  const nudge = useMotionValue(0)
  const nudgeX = useTransform(nudge, (v) => `${v}%`)
  const spinBurst = useCallback(() => {
    if (reduceMotion) return
    // Wrap BEFORE each tap, not when the tap's animation ends. Tap after tap
    // after tap, each one used to add another 7% while the wrap waited 1.1s
    // for the animation to finish, so an impatient hand could stack the row
    // past its own end and the white behind it showed through the circle.
    // Wrapping first is invisible (25% = one whole world) and pins the surge
    // to (-32%, 0] no matter how fast anyone taps: 32 + the turn's 25 is well
    // inside the four worlds the row carries.
    const from = nudge.get() % 25
    nudge.set(from)
    animate(nudge, from - 7, { duration: 1.1, ease: [0.16, 1, 0.3, 1] })
  }, [nudge, reduceMotion])
  // Seed from the browser's actual permission so the toggle survives a reload
  // instead of always starting at "Notify me".
  const [notify, setNotify] = useState(
    () => typeof window !== 'undefined' && 'Notification' in window
      && Notification.permission === 'granted' && !queueAlertsMuted()
  )
  const [liveTravel, setLiveTravel] = useState(null)  // live-traffic refresh of travel time
  const voicePrompted = useRef(false)

  useEffect(() => {
    if (lang !== 'te' || voicePrompted.current) return undefined
    const id = setTimeout(() => {
      voicePrompted.current = true
      speak('Voice tho appointment book cheyyadaniki, dashboard lo Book by Voice button click cheyyandi.', speech)
    }, 700)
    return () => {
      clearTimeout(id)
    }
  }, [lang, speech])
  // "Notify Me" → ask the browser for notification permission. The backend
  // already schedules a 15-min "time to leave" reminder; this opts in locally.
  // Asks the browser for notification permission. Once granted, DelayToaster in
  // PatientLayout raises an OS notification for every new queue alert (delay,
  // time-to-leave, being called in) — including while the tab is in the
  // background. Reflects the REAL permission state so the label can't claim
  // reminders are on when the browser has blocked them.
  const notifyMe = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      dialog.alert({ title: t('px.dash.notSupported'), message: t('px.dash.notSupportedMsg') })
      return
    }
    // It reads as a toggle (aria-pressed) and has to behave like one. Pressing
    // it while ON used to re-request an already-granted permission, which
    // resolves instantly with the same answer — so nothing happened and the
    // button looked dead. Off is our own preference; the browser has no API to
    // withdraw permission.
    if (notify) {
      try { localStorage.setItem(QUEUE_ALERTS_KEY, 'off') } catch { /* private mode */ }
      setNotify(false)
      return
    }
    try {
      const result = await Notification.requestPermission()
      const granted = result === 'granted'
      if (granted) {
        try { localStorage.removeItem(QUEUE_ALERTS_KEY) } catch { /* private mode */ }
      }
      setNotify(granted)
      if (result === 'denied') {
        dialog.alert({ title: t('px.dash.blocked'), message: t('px.dash.blockedMsg') })
      }
    } catch {
      setNotify(Notification.permission === 'granted' && !queueAlertsMuted())
    }
  }

  // Appointments come from PatientContext (cached across tab switches), so the
  // Smart OP Queue / Next Visit render instantly on return. Kick a background
  // refresh on mount for freshness — the cached list stays on screen meanwhile.
  useEffect(() => {
    reloadAppointments()
  }, [reloadAppointments])

  const today = todayISO()
  const upcoming = appts.filter((a) => ACTIVE_STATUSES.includes(a.status) && a.appointment_date >= today)
  const nextAppt = upcoming[upcoming.length - 1] // list is desc; last active is soonest
  // Anything booked at all — today or next week — wakes the Next Visit circle.
  const booked = !!nextAppt
  const todayAppt = upcoming.find((a) => a.appointment_date === today) || null

  // Where the next visit is, and where the patient set out from (captured at
  // booking) — so the dashboard map can draw their route there.
  const nextAff = nextAppt ? resolveAffiliation(nextAppt.affiliation_id) : null
  const nextHosp = nextAppt
    ? resolveHospital(nextAppt.hospital_id) || resolveHospital(resolveDoctor(nextAppt.doctor_id)?.hospital_id)
    : null
  const nextHospital = nextAff || nextHosp // for the name shown under the visit
  // The map pin shows the HOSPITAL's logo. A doctor's personal hospital is an
  // affiliation with no hospital, so it has none and keeps the plain pin.
  const nextLogo = nextAff
    ? (nextAff.hospital_id ? resolveHospital(nextAff.hospital_id)?.logo_url : null)
    : nextHosp?.logo_url
  const nextDest = nextAff?.latitude != null && nextAff?.longitude != null
    ? nextAff
    : nextHosp?.latitude != null && nextHosp?.longitude != null
      ? nextHosp
      : null
  const nextOrigin = nextAppt?.origin_lat != null && nextAppt?.origin_lng != null
    ? { lat: nextAppt.origin_lat, lng: nextAppt.origin_lng }
    : null

  // Poll my own token status (auto-allocated at booking) for today's visit. One
  // ownership-safe call returns identity + live ETA + leave-by — no queue PII.
  const apptId = todayAppt?.appointment_id

  // The SAME call for the next visit when it ISN'T today. Kept separate from
  // `est` on purpose: the Smart OP Queue card is queue-framed ("you're next",
  // "est wait"), and none of that means anything for a booking three days out —
  // rendering it there would be confidently wrong. What DOES apply is the
  // journey, and for a long one the departure can be today, so it belongs on
  // the Next Visit card instead.
  const nextApptId = !todayAppt ? nextAppt?.appointment_id : null
  const [nextEst, setNextEst] = useState(null)
  const loadNextEstimate = useCallback(async () => {
    if (!nextApptId) return
    try {
      setNextEst(await tokensApi.estimate({ appointment_id: nextApptId }))
    } catch {
      /* no token yet — the card still shows the date and place */
    }
  }, [nextApptId])
  useEffect(() => {
    if (!nextApptId) { setNextEst(null); return }
    loadNextEstimate()
  }, [nextApptId, loadNextEstimate])
  useAutoRefresh(loadNextEstimate, { intervalMs: 60000, enabled: !!nextApptId })
  const loadEstimate = useCallback(async () => {
    if (!apptId) return
    try {
      setEst(await tokensApi.estimate({ appointment_id: apptId }))
    } catch {
      /* no token yet / not mine — leave empty */
    }
  }, [apptId])

  useEffect(() => {
    if (!apptId) { setEst(null); return }
    loadEstimate()
  }, [apptId, loadEstimate])

  // The self-rescheduling timeout chain this replaced kept polling from a phone
  // in someone's pocket and, worse, showed a stale ETA for up to 30s after they
  // opened the app again — exactly when they're checking whether to leave.
  useAutoRefresh(loadEstimate, { intervalMs: 30000, enabled: !!apptId })

  // Today's route endpoints (for the live-traffic travel refresh).
  const todayAff = todayAppt ? resolveAffiliation(todayAppt.affiliation_id) : null
  const todayHosp = todayAppt
    ? resolveHospital(todayAppt.hospital_id) || resolveHospital(resolveDoctor(todayAppt.doctor_id)?.hospital_id)
    : null
  const todayDest = todayAff?.latitude != null && todayAff?.longitude != null
    ? todayAff
    : todayHosp?.latitude != null && todayHosp?.longitude != null ? todayHosp : null
  const todayOrigin = todayAppt?.origin_lat != null && todayAppt?.origin_lng != null
    ? { lat: todayAppt.origin_lat, lng: todayAppt.origin_lng } : null
  // Only refresh while the token is live and it's not yet time to leave.
  const tokenLive = !!(est && est.leave_by && !est.should_leave_now)
  const haveRouteCoords = !!(todayOrigin && todayDest?.latitude != null && todayDest?.longitude != null)

  // Live-traffic travel refresh — quota-safe: slow (3 min), paused when the tab
  // is hidden, and only while the token is active. Each tick is one Google
  // Distance Matrix call; it stops the moment the patient should leave / is done.
  useEffect(() => {
    if (!tokenLive || !haveRouteCoords) { setLiveTravel(null); return }
    let cancelled = false
    let timer
    const refresh = async () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        try {
          const m = await roadTravelMinutes(todayOrigin, todayDest)
          if (!cancelled && m != null) setLiveTravel(m)
        } catch { /* keep last good value */ }
      }
      if (!cancelled) timer = setTimeout(refresh, 180000)  // 3 min
    }
    refresh()
    return () => { cancelled = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenLive, haveRouteCoords, todayOrigin?.lat, todayOrigin?.lng, todayDest?.latitude, todayDest?.longitude])

  return (
    <div className="flex flex-col gap-3">
      {/* Book Appointment — voice + manual options in one card */}
      <div className="relative overflow-hidden rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/60 to-white p-4 shadow-sm">
        <div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-brand-navy">{t('pdash.bookTitle')}</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">{t('pdash.bookSubtitle')}</p>

            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {/* Voice booking (recommended) */}
              <Link
                to="appointments/voice"
                className="group flex items-center gap-3 rounded-xl border-2 border-teal-300 bg-teal-50/50 p-3 transition-colors hover:bg-teal-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm">
                  <Mic className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-brand-navy">
                    {t('vbook.promoCta')}
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-teal-700">{t('pdash.recommended')}</span>
                  </p>
                  <p className="mt-0.5 text-[13.5px] text-slate-500">{t('vbook.promoSub')}</p>
                </div>
                <span className="sparkle-btn shrink-0">
                  <svg className="sparkle" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="path" d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z" />
                    <path className="path" d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z" />
                    <path className="path" d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z" />
                  </svg>
                  <span className="text_button">{t('pdash.bookNow')}</span>
                </span>
              </Link>

              {/* Book manually */}
              <Link
                to="appointments/book"
                className="group flex items-center gap-3 rounded-xl border-2 border-teal-300 bg-teal-50/50 p-3 transition-colors hover:bg-teal-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-brand-navy">{t('pdash.bookManually')}</p>
                  <p className="mt-0.5 text-[13.5px] text-slate-500">{t('pdash.bookManuallySub')}</p>
                </div>
                <span className="sparkle-btn shrink-0">
                  <svg className="sparkle" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path className="path" d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z" />
                    <path className="path" d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z" />
                    <path className="path" d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z" />
                  </svg>
                  <span className="text_button">{t('pdash.bookNow')}</span>
                </span>
              </Link>
            </div>

            {/* Trust flags */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-medium text-slate-500">
              <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-teal-600" /> {t('pdash.flagFastest')}</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-teal-600" /> {t('pdash.flagSecure')}</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1"><Smile className="h-3.5 w-3.5 text-teal-600" /> {t('pdash.flagSimple')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Straight under Book Appointment, because both answer "what do I do
          next": a free revisit or a due follow-up IS the next booking, and at
          the foot of the page they were missed. Each renders nothing unless the
          patient has one, so they never leave an empty box. */}
      <RevisitPassCard />
      <FollowUpCard />

      {/* The three cards a patient actually acts on, side by side: where am I in
          the queue, what do I take today, where am I going next. Medicines moved
          in here from its own full-width row — it is a daily glance, not a
          banner. Stacks on mobile. */}
      {/* Two columns until there is a medicine plan for today — a new patient
          has only the queue and the next visit, and they share the full width
          instead of leaving the middle column empty. */}
      <div className={`grid grid-cols-1 gap-4 ${hasMeds ? 'lg:grid-cols-[1.5fr_1.1fr_0.75fr]' : 'lg:grid-cols-[1.5fr_1fr]'}`}>
        {est ? (
          <div className="relative h-full">
            {/* soft teal glow */}
            <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] bg-teal-300/25 blur-2xl" />
            {/* rotating green line around the border */}
            <div className="queue-glow h-full">
            <Card className="relative h-full rounded-3xl p-4 shadow-[0_24px_60px_-24px_rgba(13,148,136,0.45)] ring-1 ring-teal-50">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold tracking-wide text-slate-800">{t('pdash.smartQueue')}</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  {t('pdash.liveUpdating')}
                </span>
              </div>
              <SmartOpQueue est={est} liveTravelMin={liveTravel} onNotify={notifyMe} notifyOn={notify} />
            </Card>
            </div>
          </div>
        ) : (
          <Card className="rounded-3xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-bold tracking-wide text-slate-800">{t('pdash.smartQueue')}</span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                {t('pdash.queueIdle')}
              </span>
            </div>
            <QueueEmpty nextAppt={nextAppt} />

            {/* The queue itself is idle until the day of the visit, but the
                JOURNEY isn't: an eight-hour trip to Friday's hospital starts on
                Thursday. Shown here rather than as fake queue numbers — there
                is no position or wait time to report yet, only a departure. */}
            {nextEst?.leave_by && (
              <div className={`mt-4 rounded-2xl px-3.5 py-3 ${
                nextEst.should_leave_now ? 'bg-amber-50' : 'bg-teal-50/70'
              }`}>
                <p className={`flex items-center gap-2 text-[13.5px] font-extrabold ${
                  nextEst.should_leave_now ? 'text-amber-800' : 'text-slate-700'
                }`}>
                  <Footprints className={`h-5 w-5 shrink-0 ${nextEst.should_leave_now ? 'text-amber-600' : 'text-teal-600'}`} />
                  {nextEst.should_leave_now
                    ? t('pdash.leaveNowTitle')
                    : `${t('pdash.leaveByTitle')} ${clockISTWithDay(nextEst.leave_by)}`}
                </p>

                {/* The same three facts the live card shows on the day itself —
                    when the doctor could call them, when to be at the hospital,
                    and how long the journey takes — so the plan is readable in
                    advance instead of only on the morning of the visit. */}
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-white/70 px-2.5 py-2">
                    <p className="text-[13px] text-slate-500">{t('pdash.tokenExpected')}</p>
                    <p className="text-[13px] font-bold text-slate-800">{clockISTWithDay(nextEst.estimated_time)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-2.5 py-2">
                    <p className="text-[13px] text-slate-500">{t('pdash.reachBy')}</p>
                    <p className="text-[13px] font-bold text-slate-800">{clockISTWithDay(nextEst.arrive_by)}</p>
                  </div>
                  <div className="rounded-xl bg-white/70 px-2.5 py-2">
                    <p className="text-[13px] text-slate-500">{t('pdash.travelTime')}</p>
                    <p className="text-[13px] font-bold text-slate-800">
                      {humanMins(t, nextEst.travel_min)}
                    </p>
                  </div>
                </div>
                {nextEst.origin_label && (
                  <p className="mt-1.5 text-[13px] text-slate-500">{t('ppage.travelFrom', { place: originLabelText(nextEst.origin_label, t, lang) })}</p>
                )}
              </div>
            )}
          </Card>
        )}

          {/* Today's medicines. Renders nothing when the patient has no
              courses, so the row collapses to two cards rather than showing an
              empty box. */}
          {/* Today's doses — "what do I take next, and did I take the last
              one", which is the question someone opens the app to answer.
              Renders nothing when there is no plan for today, so it never
              leaves an empty box. Starting, stopping and re-timing a course
              live on the Prescriptions page and in the dose popup. */}
          <TodayMedicines onVisibleChange={setHasMeds} />

      {/* Next Visit — the route map drawn as a circle, with the actions
          floating on its rim and the visit itself on a card that overlaps the
          lower edge. Same data, same destinations and the same two links as
          the old rectangular card; only the shape changed. It stays in the
          column row: every rim pill is anchored by its OUTER edge, so each one
          overhangs the circle by only ~12px and lays the rest of itself back
          over the map — the block needs no more width than the circle. */}
      {/* Deliberately NOT a <Card>. A white box with its own padding and border
          around a circle just draws a second shape behind the first, and the
          padding was width the OP queue could be using. The circle sits on the
          page background instead; the only panel left is the detail card that
          overlaps its lower edge, which is the one the design actually calls
          for. */}
      <div className="overflow-visible">
        <h3 className="px-1 text-[16px] font-bold text-brand-navy">{t('pdash.nextVisit')}</h3>
        {/* The circle renders ALWAYS, booked or not. With a visit it fills in
            with the real route, hospital and doctor; without one the same shape
            stays on screen greyed out with a Book one now, so the dashboard
            keeps its form instead of collapsing into a bare line of text. */}
        {(() => {
          const dirUrl = mapsDirectionsUrl(nextOrigin, nextDest)
          /* The shadow and ring live on the STATE, not the base: a dead pill
             is glass over the globe, and a white ring with a drop shadow would
             put the white block straight back. */
          const pillBase = 'absolute inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-bold'
          const live = 'bg-white shadow-lg ring-1 ring-slate-100 transition-colors'
          const muted = 'bg-white/35 text-slate-400 ring-1 ring-white/50 backdrop-blur-[2px] cursor-default select-none'
          return (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 0.68, 0.28, 1] }}
            className="mx-auto w-full max-w-[460px] px-2 pt-6 sm:px-6"
          >
            {/* The circle.
                `rounded-full` + `overflow-hidden` is NOT enough to round a map.
                Google Maps positions its tile panes with `transform:
                translate3d(...)`, and a transformed/composited child is not
                clipped by an ancestor's border-radius — the tiles paint over
                the corners and you get a square. `clip-path: circle(50%)` does
                clip transformed descendants, so that is what actually makes it
                round.
                The catch: clip-path also clips the element's OWN ring and
                shadow away, so the white rim lives on a separate overlay below
                rather than on the map.
                The box is a fixed pixel square (not `aspect-square` + `h-full`)
                so the circle never depends on percentage-height resolution;
                `!h-full !w-full` then just fills it, overriding HospitalMap's
                inline `height` via the !important that a stylesheet rule wins.
                `[&>a]:hidden` drops the component's built-in "Open in Google
                Maps" chip for THIS instance only — it sits in a bottom corner
                the circle cuts off, and the rim already carries that action. */}
            {/* The circle comes alive as soon as ANY visit is booked — a slow
                bob with a teal halo breathing under it — not only on the day
                itself: book for tomorrow and the dashboard should already look
                like somewhere to be. The rim pills are children, so they ride
                along. The outward ripples stay for the live OP alone, so today
                still reads differently from later in the week.
                Still flat with nothing booked, and for reduced-motion users. */}
            <motion.div
              animate={booked && !reduceMotion ? { y: [0, -8, 0] } : { y: 0 }}
              transition={booked && !reduceMotion ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
              className="relative isolate mx-auto h-[220px] w-[220px] lg:h-[170px] lg:w-[170px] xl:h-[215px] xl:w-[215px] 2xl:h-[260px] 2xl:w-[260px]"
            >
              {booked && (
                <motion.div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-3 -z-10 rounded-full bg-teal-300/45 blur-xl"
                  animate={reduceMotion ? { opacity: 0.6 } : { opacity: [0.5, 0.95, 0.5], scale: [0.96, 1.06, 0.96] }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* A teal glow hugging the rim, pulsing with the float. Its own
                  layer: Tailwind draws the white rim as a box-shadow, so
                  animating the rim's box-shadow would erase it. */}
              {booked && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-[6px] -z-10 rounded-full"
                  animate={{ boxShadow: reduceMotion
                    ? '0 0 30px 8px rgba(45,212,191,0.75)'
                    : ['0 0 18px 4px rgba(45,212,191,0.5)', '0 0 44px 14px rgba(45,212,191,0.9)', '0 0 18px 4px rgba(45,212,191,0.5)'] }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* Two ripple rings pushing out from the rim, half a cycle apart,
                  so there is always one travelling — the "live" signal. */}
              {est && !reduceMotion && [0, 1.3].map((delay) => (
                <motion.span
                  key={delay}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -z-10 rounded-full border-2 border-teal-400"
                  initial={{ scale: 1, opacity: 0 }}
                  animate={{ scale: [1, 1.25], opacity: [0.9, 0] }}
                  transition={{ duration: 2.6, delay, repeat: Infinity, ease: 'easeOut' }}
                />
              ))}
              {nextAppt && nextDest ? (
                <HospitalMap
                  hospital={nextDest}
                  origin={nextOrigin}
                  hospitalLabel={nextHospital?.name || t('ppage.hospitalLabel')}
                  originLabel={t('pdash.you') || 'You'}
                  height={300}
                  tiles="mapbox"
                  zoomControl={false}
                  hospitalLogo={nextLogo || null}
                  className="!h-full !w-full !rounded-full !border-0 [clip-path:circle(50%)] [&>a]:hidden"
                />
              ) : (
                /* Stands in for the map when there is no visit to route to, or
                   when the hospital has no map pin — same circle, so the card
                   keeps its shape either way.

                   A static picture of the Earth turned to face India
                   (public/globe-strip.svg, generated once from Natural Earth
                   110m land). Not a live map: a real map of some place would
                   cost a Maps call for decoration and could be misread as the
                   patient's hospital. LAND ONLY, deliberately — no country
                   borders, because the standard dataset's India outline is not
                   the official Survey of India boundary. The pin below marks
                   India instead. */
                <div
                  onClick={spinBurst}
                  className="relative grid h-full w-full cursor-pointer place-items-center overflow-hidden rounded-full bg-gradient-to-br from-brand-blueLight via-white to-teal-50"
                  title={t('pdash.spinGlobe')}
                >
                  {/* The world turning. The strip file holds the map twice, and
                      the row draws that file TWICE again — four worlds across,
                      four circles wide. The steady turn slides one world (-25%)
                      and taps add at most one more before wrapping, so at the
                      furthest the row is only half spent and two worlds still
                      cover the circle: the right-hand edge can never come into
                      view. (It did when the row was two worlds: a tap on top of
                      the turn ran past the end and showed white.)
                      Outer layer = the tap surge, inner = the steady turn. */}
                  <motion.div className="absolute inset-y-0 left-0 flex w-[400%]" style={{ x: nudgeX }}>
                    <motion.div
                      className="flex h-full w-full"
                      animate={reduceMotion ? { x: '0%' } : { x: ['0%', '-25%'] }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 44, repeat: Infinity, ease: 'linear' }}
                    >
                      {[0, 1].map((i) => (
                        <img
                          key={i}
                          src="/globe-strip.svg"
                          alt=""
                          aria-hidden="true"
                          draggable="false"
                          className="h-full w-1/2 shrink-0 select-none object-cover"
                          style={{ objectPosition: '50% 38%' }}
                        />
                      ))}
                    </motion.div>
                  </motion.div>
                  {/* Sphere shading over the flat map: lit from the top left,
                      shaded at the rim, which is what makes it read as a ball
                      rather than a scrolling picture. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full"
                    /* Keep the highlight SMALL and faint. At 55% opacity over
                       half the circle it washed the map out to near-white and
                       read as empty space rather than as a lit sphere. */
                    style={{ background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,.30), rgba(255,255,255,0) 32%), radial-gradient(circle at 64% 74%, rgba(12,74,110,.30), rgba(12,74,110,0) 62%)', boxShadow: 'inset 0 0 26px rgba(12,74,110,.28)' }}
                  />
                  {/* NO pin here. The globe turns, so a pin pinned to the
                      middle of the circle points at whatever ocean happens to
                      be passing — it marked India for about a second and South
                      America for the rest. The card below already says there is
                      no visit; the globe only has to say "somewhere out there". */}
                </div>
              )}

              {/* The white rim and drop shadow. Separate from the map because
                  clip-path would clip them off the map itself; pointer-events
                  are off so it never swallows a drag on the map beneath. */}
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-xl ring-[6px] ring-white" />

              {/* Rim actions. Every one of them stays on screen even with
                  nothing booked — they are part of the shape — but a pill with
                  no data behind it renders as a plain greyed chip rather than a
                  link, so it never looks clickable and can never lead nowhere. */}
              {nextAppt ? (
                <Link to="appointments" className={`${pillBase} ${live} -top-4 left-1/2 -translate-x-1/2 text-brand-navy hover:bg-slate-50`}>
                  <CalendarClock className="h-4 w-4 text-brand-blue" /> {t('pdash.viewReschedule')}
                </Link>
              ) : (
                <span className={`${pillBase} ${muted} -top-4 left-1/2 -translate-x-1/2`}>
                  <CalendarClock className="h-4 w-4" /> {t('pdash.viewReschedule')}
                </span>
              )}

              {dirUrl ? (
                <>
                  <a
                    href={dirUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('pdash.getDirections')}
                    className="absolute -right-2 top-[10%] grid h-10 w-10 place-items-center rounded-full bg-brand-blue text-white shadow-lg ring-4 ring-white transition-colors hover:bg-brand-blueDark"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                  <a
                    href={dirUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${pillBase} ${live} -right-3 top-1/2 -translate-y-1/2 text-teal-700 hover:bg-teal-50`}
                  >
                    <Navigation className="h-4 w-4" /> {t('pdash.getDirections')}
                  </a>
                </>
              ) : (
                <>
                  <span className="absolute -right-2 top-[10%] grid h-10 w-10 place-items-center rounded-full bg-white/35 text-slate-400 ring-1 ring-white/50 backdrop-blur-[2px]">
                    <Navigation className="h-4 w-4" />
                  </span>
                  <span className={`${pillBase} ${muted} -right-3 top-1/2 -translate-y-1/2`}>
                    <Navigation className="h-4 w-4" /> {t('pdash.getDirections')}
                  </span>
                </>
              )}

            </motion.div>

            {/* The detail card, overlapping the bottom of the circle. */}
            <div className="relative z-10 -mt-16 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-100">
              {!nextAppt ? (
                <div className="py-1 text-center">
                  <p className="text-[13.5px] font-semibold text-brand-navy">{t('pdash.noUpcomingVisits')}</p>
                  <Link
                    to="appointments/book"
                    className="mt-2.5 inline-block rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-blueDark"
                  >
                    {t('pdash.bookOneNow')}
                  </Link>
                </div>
              ) : (
              <>
              <p className="flex items-center gap-1.5 text-[14px] font-bold text-brand-navy">
                <MapPin className="h-4 w-4 shrink-0 text-brand-blue" />
                <span className="truncate">{translitName(nextHospital?.name, lang) || '—'}</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                  {dateChip(nextAppt.appointment_date).day} {dateChip(nextAppt.appointment_date).month}
                </span>
                {nextAppt.slot_time && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />{prettyTime(nextAppt.slot_time)}
                  </span>
                )}
              </p>

              {/* WHO is being seen. The card named the hospital and the doctor
                  but never the patient, so a household where three people are
                  booked in the same week could not tell whose visit this is.
                  A dependent's own name when there is one, otherwise the
                  account holder's — the answer is never left to be guessed. */}
              {(nextAppt.family_member_name || patient?.name) && (
                <p className="mt-1.5">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[13px] font-semibold text-purple-600">
                    <UserRound className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {t('pm.forPerson', { name: translitName(nextAppt.family_member_name || patient.name, lang) })}
                    </span>
                  </span>
                </p>
              )}

              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3">
                {/* The initials sit UNDERNEATH the photo rather than in an
                    `else`, so a URL that 404s falls back to them instead of
                    leaving a blank hole. `alt=""` means a broken image renders
                    as nothing at all — which is exactly how this failed
                    silently instead of announcing itself. */}
                <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-blueLight text-[15px] font-extrabold text-brand-blue ring-2 ring-brand-blueLight">
                  {(translitName(resolveDoctor(nextAppt.doctor_id)?.name, lang) || 'D').trim().charAt(0).toUpperCase()}
                  {resolveDoctor(nextAppt.doctor_id)?.profile_photo_url && (
                    <img
                      /* fileUrl(), never the raw field. `public_url` only
                         rewrites `s3://` values, and UPLOAD_STORAGE defaults to
                         `local`, so the stored value is a relative path like
                         /uploads/doctors/7.png. A relative `src` resolves
                         against the PAGE origin (Vite, 5173) rather than the
                         API (8000) — a guaranteed 404 in local dev, and fine
                         only on the S3-backed box. */
                      src={fileUrl(resolveDoctor(nextAppt.doctor_id).profile_photo_url)}
                      alt=""
                      onError={(event) => { event.currentTarget.style.visibility = 'hidden' }}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[13.5px] font-bold text-brand-navy">
                    {translitName(resolveDoctor(nextAppt.doctor_id)?.name, lang) || t('px.doctorNum', { id: nextAppt.doctor_id })}
                  </p>
                  <p className="truncate text-[13px] text-slate-500">
                    {specialtyLabel(resolveDoctor(nextAppt.doctor_id)?.specialization, lang)}
                  </p>
                </div>
                <Link
                  to="appointments"
                  className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13.5px] font-bold text-brand-blue hover:text-brand-blueDark"
                >
                  {t('pdash.viewDetails')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              </>
              )}
            </div>
          </motion.div>
          )
        })()}
      </div>
        </div>

    </div>
  )
}

export default Dashboard
