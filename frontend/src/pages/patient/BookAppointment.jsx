import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { specialtyLabel, matchesSpecialty, specialtyFromText, matchSpecialties } from '../../data/symptomSpecialty.js'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, animate, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import {
  CalendarDays, MapPin, Stethoscope, Phone, Mail,
  IndianRupee, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, LocateFixed,
  Navigation, Users, Route, User, Ticket, Hourglass, Check, Search,
  ClipboardList, Plus, Pencil, Building2,
} from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { Checkbox, Banner } from '../../components/common/FormControls.jsx'
import AddressAutocomplete from '../../components/common/AddressAutocomplete.jsx'
import HospitalMap from '../../components/common/HospitalMap.jsx'
import EditFamilyMemberModal from '../../components/patient/EditFamilyMemberModal.jsx'
import PersonAvatar from '../../components/patient/PersonAvatar.jsx'
import { MAX_MEMBERS, ageFromDob, effectivePhone, usesAccountPhone } from '../../lib/family.js'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { appointmentsApi, doctorsApi, tokensApi, patientsApi, revisitPassesApi } from '../../api'
// import { paymentsApi } from '../../api'
import { todayISO, humanMins, clockISTWithDay } from '../../lib/format.js'

// Razorpay booking checkout is disabled for now.
// function loadRazorpay() {
//   return new Promise((resolve) => {
//     if (window.Razorpay) return resolve(true)
//     const s = document.createElement('script')
//     s.src = 'https://checkout.razorpay.com/v1/checkout.js'
//     s.onload = () => resolve(true)
//     s.onerror = () => resolve(false)
//     document.body.appendChild(s)
//   })
// }

import { travelMinutesBetween, travelMinutesFromKm, roadTravelMinutes, getCurrentPosition, geocodeAddress } from '../../lib/geo.js'
import { useI18n } from '../../i18n/index.jsx'
import { relLabel } from '../../components/patient/personLabels.js'
import { englishSymptomNote, toEnglishText } from '../../lib/englishText.js'
import { dashboardT } from '../../i18n/dict/dashboard.js'
import { realEmail } from '../../lib/patientDisplay.js'

/* Common complaints offered as one-tap chips so nobody has to type on a phone. */
const QUICK_REASONS = ['pflow.r1', 'pflow.r2', 'pflow.r3', 'pflow.r4', 'pflow.r5', 'pflow.r6']

// The reason box as its comma-separated parts ("Fever & cold, Body pain, knee
// swollen" → 3 parts): a chip is ticked while its wording is one of the parts.
const reasonParts = (text) => String(text || '').split(',').map((s) => s.trim()).filter(Boolean)

/* The wizard, in order. "who" is dropped when the patient has no dependents —
   there is nothing to choose, so we don't make them tap through it. */
/* Six screens was too many to tap through for one visit. "Who" is now a compact
   row on the first screen — every person is still shown, just smaller — and the
   reason sits under the date, which is the same kind of quick choice. */
const ALL_STEPS = [
  { id: 'doctor', labelKey: 'pflow.stepDoctor', icon: Stethoscope },
  { id: 'when', labelKey: 'pflow.stepWhen', icon: CalendarDays },
  { id: 'travel', labelKey: 'pflow.stepTravel', icon: Route },
  { id: 'review', labelKey: 'pflow.stepReview', icon: CheckCircle2 },
]

const DAY_COUNT = 14

function textareaClass(error) {
  // Two lines, not four: the chips answer this for most people, and a tall box
  // pushed the leave-by question below the fold on a phone.
  return `min-h-[58px] w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-brand-navy outline-none transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 ${
    error ? 'border-red-300' : 'border-slate-200'
  }`
}

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  // Local date, NOT toISOString() — UTC conversion in IST shifts the day back one.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readableDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/* Animated count-up for the success stats. */
function CountUp({ value, duration = 1 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const controls = animate(0, value || 0, { duration, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) })
    return () => controls.stop()
  }, [value, duration])
  return <>{n}</>
}

/* A celebratory confetti burst — one pop from the centre + two side cannons. */
function fireConfetti() {
  const colors = ['#22c55e', '#10b981', '#2563eb', '#f59e0b', '#ffffff']
  confetti({ particleCount: 90, spread: 72, startVelocity: 45, origin: { x: 0.5, y: 0.42 }, colors, zIndex: 70 })
  setTimeout(() => confetti({ particleCount: 55, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, zIndex: 70 }), 160)
  setTimeout(() => confetti({ particleCount: 55, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, zIndex: 70 }), 160)
}

const _container = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } } }
const _item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } } }

/* Loader: "loading" by Mj chen, locally vendored from LottieFiles.
   https://lottiefiles.com/free-animation/loading-fHKMl9U5Jk */
/* Two-act booking reveal: the requested Lottie loader, then confirmation. */
function BookedCard({ booked, doctorName, dateLabel, onView, onAnother }) {
  const { t, lang } = useI18n()
  const tk = booked.token
  // Backend times are naive UTC: read as local they came out 5.5 hours early,
  // so this card advised a departure time that had already passed.
  // WithDay, not bare clockIST: a long journey means leaving the day BEFORE the
  // visit, and a bare "12:39 AM" on a card shown at 12:41 AM reads as two
  // minutes ago rather than tomorrow night. Reported from a real Amalapuram ->
  // Hyderabad booking (471 min): the stored time was right, the display wasn't.
  const leaveBy = tk?.leave_by ? clockISTWithDay(tk.leave_by) : null
  const peopleAhead = tk ? Math.max(0, (tk.queue_position || 1) - 1) : 0
  const reduceMotion = useReducedMotion()
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const revealTimer = window.setTimeout(() => {
      setRevealed(true)
      if (!reduceMotion) {
        fireConfetti()
        navigator.vibrate?.([35, 35, 85])
      }
    }, reduceMotion ? 700 : 2200)
    return () => window.clearTimeout(revealTimer)
  }, [reduceMotion])

  return (
    <div className="mx-auto flex max-w-[540px] flex-col gap-5 py-6">
      <motion.div initial={{ opacity: 0, scale: 0.92, y: 22 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 210, damping: 22 }}>
        <Card className={`min-h-[350px] overflow-hidden p-0 ${revealed ? 'border-0 shadow-[0_24px_70px_-22px_rgba(15,118,110,0.55)]' : '!border-transparent !bg-transparent !shadow-none'}`}>
          <AnimatePresence mode="wait" initial={false}>
            {!revealed ? (
              <motion.div
                key="lottie-loader"
                className="relative flex min-h-[350px] flex-col items-center justify-center px-6 py-8 text-center text-brand-navy"
                exit={{ opacity: 0, scale: 1.3, filter: 'blur(12px)' }}
                transition={{ duration: 0.24, ease: 'easeIn' }}
              >
                <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="relative mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-brand-blue">{t('pm.securingAppt')}</motion.p>

                <motion.div
                  className="relative h-[190px] w-[190px] drop-shadow-[0_0_30px_rgba(34,211,238,0.35)]"
                  initial={{ opacity: 0, scale: 0.72 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 230, damping: 18 }}
                >
                  <DotLottieReact
                    src="/booking-loader.lottie"
                    autoplay
                    loop
                    speed={0.9}
                    className="h-full w-full"
                  />
                </motion.div>

                <div className="relative mt-3 flex items-center gap-2 text-[13px] font-semibold text-slate-500">
                  <span>{t('pm.allocatingToken')}</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((dot) => (
                      <motion.i key={dot} className="h-1 w-1 rounded-full bg-brand-blue" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.38, repeat: Infinity, delay: dot * 0.1 }} />
                    ))}
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div key="booking-confirmed" initial={{ opacity: 0, scale: 0.84 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
          {/* Header */}
          <div className="relative flex flex-col items-center overflow-hidden bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 px-6 pb-7 pt-9 text-center text-white">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-white/20 blur-3xl" />

            {/* Checkmark badge with radiating rings */}
            <div className="relative flex h-24 w-24 items-center justify-center">
              {[0, 0.45].map((d, i) => (
                <motion.span
                  key={i}
                  className="absolute h-20 w-20 rounded-full bg-white/40"
                  initial={{ scale: 0.6, opacity: 0.55 }}
                  animate={{ scale: 2.1, opacity: 0 }}
                  transition={{ delay: 0.2 + d, duration: 1.1, ease: 'easeOut' }}
                />
              ))}
              <motion.div
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
              >
                <svg viewBox="0 0 52 52" className="h-12 w-12">
                  <motion.path
                    d="M14 27 l8 8 l16 -18" fill="none" stroke="white" strokeWidth="5"
                    strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ delay: 0.35, duration: 0.45, ease: 'easeInOut' }}
                  />
                </svg>
              </motion.div>
            </div>

            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-4 text-[9px] font-bold uppercase tracking-[0.3em] text-white/70">{t('pm.bookingConfirmed')}</motion.p>
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }} className="mt-1 text-[24px] font-black tracking-tight">{t('pm.tokenBooked')}</motion.h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[13px] text-white/85">
              {doctorName ? t('px.book.withDr', { name: doctorName }) : ''} · {dateLabel}
            </motion.p>
            {booked.appt?.free_revisit && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="mx-auto mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-[12px] font-bold text-white">
                🎁 {t('rvp.applied')}
              </motion.p>
            )}

            {tk && (
              <motion.div
                initial={{ scale: 2.6, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ delay: 0.72, type: 'spring', stiffness: 200, damping: 13 }}
                className="relative mt-4 inline-flex items-center gap-2.5 overflow-hidden rounded-2xl bg-white/20 px-6 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)] ring-1 ring-white/30 backdrop-blur-sm"
              >
                <motion.span className="absolute inset-y-0 w-12 -skew-x-12 bg-white/25 blur-sm" initial={{ left: '-35%' }} animate={{ left: '125%' }} transition={{ delay: 1, duration: 0.65, ease: 'easeInOut' }} />
                <Ticket className="relative h-7 w-7" />
                <div className="text-left leading-tight">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">{t('pm.yourToken')}</p>
                  <p className="font-mono text-[26px] font-black leading-none">{tk.display_code || `#${tk.token_number}`}</p>
                </div>
              </motion.div>
            )}
          </div>

          {/* Body — staggered in after the header */}
          <motion.div variants={_container} initial="hidden" animate="show">
            <div className="grid grid-cols-2 gap-3 p-5">
              <motion.div variants={_item} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-center">
                <p className="text-[11px] font-medium text-slate-400">{t('pm.peopleAhead')}</p>
                <p className="text-[22px] font-extrabold text-brand-navy"><CountUp value={peopleAhead} /></p>
              </motion.div>
              <motion.div variants={_item} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-center">
                <p className="text-[11px] font-medium text-slate-400">{t('pm.estWaitShort')}</p>
                <p className="text-[22px] font-extrabold text-brand-navy">{tk?.wait_min != null ? <>~<CountUp value={tk.wait_min} /> {t('px.minUnit')}</> : '—'}</p>
              </motion.div>
            </div>
            <div className="px-5 pb-5">
              <motion.div variants={_item} className={`flex items-center gap-2 rounded-xl border p-3 text-[13px] font-semibold ${leaveBy ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <Hourglass className="h-4 w-4" />
                {leaveBy ? t('px.book.leaveBy', { time: leaveBy }) : t('px.book.remindLeave')}
              </motion.div>
              <motion.div variants={_item} className="mt-4 flex gap-3">
                <button onClick={onView} className="flex-1 rounded-xl bg-brand-blue py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-blueDark">{t('pm.viewMyAppts')}</button>
                <button onClick={onAnother} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50">{t('pm.bookAnother')}</button>
              </motion.div>
            </div>
          </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  )
}

/* ---------------------------------------------------------------- wizard UI */

/* Progress rail — dots joined by a fill that tracks how far along you are.
   Visited steps are tappable so going back to change an answer is one click. */
function StepRail({ steps, currentIdx, visited, onJump, t }) {
  const pct = steps.length > 1 ? (currentIdx / (steps.length - 1)) * 100 : 0
  return (
    <div className="px-1 pb-1 pt-2">
      <div className="relative">
        <div className="absolute left-0 right-0 top-[15px] h-[3px] rounded-full bg-slate-100" />
        <motion.div
          className="absolute left-0 top-[15px] h-[3px] rounded-full bg-brand-blue"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        />
        <ol className="relative flex items-start justify-between">
          {steps.map((s, i) => {
            const done = i < currentIdx
            const active = i === currentIdx
            const reachable = visited.has(s.id)
            return (
              <li key={s.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={!reachable || active}
                  onClick={() => onJump(s.id)}
                  aria-current={active ? 'step' : undefined}
                  aria-label={t(s.labelKey)}
                  className={`relative grid h-[33px] w-[33px] shrink-0 place-items-center rounded-full border-2 transition-all ${
                    // No unconditional `bg-white` here: it and `bg-brand-blue`
                    // have equal specificity, and bg-white is emitted LATER in
                    // the stylesheet — so it won regardless of class order, and a
                    // completed step rendered a white icon on a white circle.
                    // Each state now owns its background outright.
                    active
                      ? 'border-brand-blue bg-white text-brand-blue shadow-[0_0_0_5px_rgba(37,99,235,0.13)]'
                      : done
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-slate-200 bg-white text-slate-300'
                  } ${reachable && !active ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                >
                  {/* The step's own icon stays put for the whole journey. It used
                      to be swapped for a tick once complete, so a finished step
                      lost the one thing identifying it — and going back to change
                      an answer meant counting positions. Completion is shown by
                      the filled circle plus a small tick badge instead. */}
                  <s.icon className="h-[15px] w-[15px]" />
                  {done && (
                    <span className="absolute -bottom-0.5 -right-0.5 grid h-[15px] w-[15px] place-items-center rounded-full border-2 border-white bg-brand-green text-white">
                      <Check className="h-[9px] w-[9px]" strokeWidth={4} />
                    </span>
                  )}
                </button>
                <span
                  className={`hidden max-w-full truncate text-[11px] font-bold sm:block ${
                    active ? 'text-brand-navy' : done ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {t(s.labelKey)}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/* One tappable answer — the wizard's workhorse. Replaces every <select>. */
function SelectCard({ selected, onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
        selected
          ? 'border-brand-blue bg-brand-blueLight/40 ring-2 ring-brand-blue/30'
          : 'border-slate-200 bg-white hover:border-brand-blue/40'
      } ${className}`}
    >
      {selected && (
        <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-brand-blue text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  )
}

/* Pill used for visit type and quick reasons. */
function Chip({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
        active
          ? 'border-brand-blue bg-brand-blue text-white'
          : 'border-slate-200 bg-white text-brand-navy hover:border-brand-blue/40 hover:bg-brand-blueLight/40'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/* Step heading — the single question this screen is asking. */
function StepTitle({ title, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-[20px] font-extrabold leading-tight text-brand-navy sm:text-[22px]">{title}</h2>
      {sub && <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{sub}</p>}
    </div>
  )
}

function BookAppointment() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { patient, doctorsById, affiliationsByDoctor, resolveHospital, loading: ctxLoading } = usePatientCtx()

  const bookableDoctors = useMemo(
    // has_timings false: no weekly session anywhere, so every date would be empty.
    () => Object.values(doctorsById).filter((d) => (d.status === 'active' || d.is_available_today) && d.has_timings !== false),
    [doctorsById],
  )

  const [form, setForm] = useState({
    doctorId: params.get('doctor') || '',
    affiliationId: params.get('affiliation') || '',
    date: params.get('date') || '',   // pre-filled by the "Book follow-up" shortcut
    reason: '',          // the reason box; ticked "Common reasons" chips are written into it
    consent: false,
    // 'self' or a family member_id (string). `?for=<id>` deep-links here from
    // the family roster's "Book appointment" action.
    bookingFor: params.get('for') || 'self',
  })
  const [family, setFamily] = useState([])
  const [familyLoaded, setFamilyLoaded] = useState(false)
  const [doctorAffiliations, setDoctorAffiliations] = useState([])
  const [affiliationsLoaded, setAffiliationsLoaded] = useState(false)
  // Arriving with ?doctor= means the doctor is already chosen (a doctor card, a
  // follow-up, a prescription). Don't make them pick again — show it as decided.
  // "Change" goes back to the Doctors page rather than opening a cut-down grid
  // here: that page has the search, filters and symptom helper, and picking a
  // doctor there links straight back into this flow.
  const doctorLocked = Boolean(params.get('doctor'))
  // Day-level availability (is the doctor consulting that day) + alternatives.
  const [dayState, setDayState] = useState({ loading: false, available: null, reason: null })
  const [slotSuggestions, setSlotSuggestions] = useState({ sameDate: [], nearbyDates: [] })
  // Token queue preview for the chosen doctor + date (token model, not slots).
  const [queue, setQueue] = useState(null)
  // Set after a successful booking → shows the allocated token + leave-by.
  const [booked, setBooked] = useState(null)
  // const [payCfg, setPayCfg] = useState({ enabled: false, booking_fee: 0 })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [doctorQuery, setDoctorQuery] = useState('')
  // Server's verdict when the journey can't be made in time; null = no warning.
  const [travelWarn, setTravelWarn] = useState(null)

  // Travel origin → powers the "leave by" reminder. `for` chooses whose journey
  // we estimate; `lat/lng` come from GPS, `km` is the manual distance fallback.
  const [trip, setTrip] = useState({
    // `source` records WHERE the coordinates came from, which `lat` alone cannot
    // say. The button used to read "Location captured" whenever lat was set —
    // including after an address search, so picking an address left the GPS
    // button claiming a capture that never happened, with no way back to it.
    for: 'self', lat: null, lng: null, label: '', km: '', address: '', source: null,
    geoLoading: false, geoError: null,
  })

  // Default to the first bookable doctor once the directory loads.
  useEffect(() => {
    if (!form.doctorId && bookableDoctors.length) {
      setForm((f) => ({ ...f, doctorId: String(bookableDoctors[0].doctor_id) }))
    }
  }, [bookableDoctors, form.doctorId])

  // Payment config lookup disabled with the booking-fee checkout:
  // useEffect(() => {
  //   paymentsApi.config().then(setPayCfg).catch(() => {})
  // }, [])

  // Load the patient's dependents so they can book "for" one of them. If a
  // `?for=<id>` deep-link points at a member that no longer exists (removed, or
  // a hand-typed id), fall back to "self" rather than posting a bogus id.
  const loadFamily = useCallback(() => {
    if (!patient?.patient_id) return
    patientsApi.family(patient.patient_id)
      .then((rows) => {
        const list = (rows || []).filter((m) => m.is_active)
        setFamily(list)
        setForm((f) =>
          f.bookingFor !== 'self' && !list.some((m) => String(m.member_id) === String(f.bookingFor))
            ? { ...f, bookingFor: 'self' }
            : f,
        )
      })
      .catch(() => setFamily([]))
      .finally(() => setFamilyLoaded(true))
  }, [patient?.patient_id])

  useEffect(loadFamily, [loadFamily])

  // ---- "Who is this for?" -------------------------------------------------
  // Self and dependents share one shape. Self has member_id = null. Adding or
  // editing a dependent happens in-place, so the half-filled flow is never lost.
  const [editingMember, setEditingMember] = useState(null) // 'new' | member | null

  const selfPerson = patient && {
    member_id: null,
    name: patient.name || t('ppage.myself'),
    relation: t('ppage.you'),
    dob: patient.dob,
    gender: patient.gender,
    blood_group: patient.blood_group,
    phone: patient.phone,
  }
  const people = selfPerson ? [selfPerson, ...family] : family
  const selectedPerson =
    form.bookingFor === 'self'
      ? selfPerson
      : family.find((m) => String(m.member_id) === String(form.bookingFor)) || selfPerson

  const selectedIsSelf = !selectedPerson?.member_id
  const selectedAge = ageFromDob(selectedPerson?.dob)
  const contactPhone = effectivePhone(selectedPerson, patient?.phone)
  const contactIsFallback = !selectedIsSelf && usesAccountPhone(selectedPerson, patient?.phone)

  const doctor = doctorsById[form.doctorId]
  const contextAffiliations = form.doctorId ? affiliationsByDoctor[form.doctorId] || [] : []
  const affiliations = doctorAffiliations.length ? doctorAffiliations : contextAffiliations
  const affiliation = affiliations.find((a) => String(a.affiliation_id) === String(form.affiliationId)) || affiliations[0] || null
  const hospital = affiliation?.hospital_id ? resolveHospital(affiliation.hospital_id) : doctor ? resolveHospital(doctor.hospital_id) : null
  const destination = affiliation?.latitude != null && affiliation?.longitude != null
    ? { ...affiliation, latitude: affiliation.latitude, longitude: affiliation.longitude }
    : hospital
  const feeAmount = Number(affiliation?.consultation_fee ?? doctor?.consultation_fee ?? 0)
  // A free revisit with this doctor, for this person, still valid on the chosen
  // date: the server will charge ₹0, so the summary must not say ₹{fee}.
  const [myPasses, setMyPasses] = useState([])
  useEffect(() => {
    revisitPassesApi.mine().then((r) => setMyPasses(Array.isArray(r) ? r : [])).catch(() => {})
  }, [])
  const forMember = form.bookingFor === 'self' ? null : form.bookingFor
  const freePass = myPasses.find((p) => String(p.doctor_id) === String(form.doctorId)
    && String(p.family_member_id ?? '') === String(forMember ?? '')
    && (!form.date || form.date <= p.valid_until)) || null

  useEffect(() => {
    if (form.doctorId && !form.affiliationId && affiliations.length) {
      setForm((f) => ({ ...f, affiliationId: String(affiliations[0].affiliation_id) }))
    }
  }, [form.doctorId, form.affiliationId, affiliations])

  useEffect(() => {
    if (!form.doctorId) {
      setDoctorAffiliations([])
      return
    }
    let active = true
    doctorsApi.affiliations({ doctor_id: form.doctorId })
      .then((rows) => {
        if (!active) return
        const activeRows = (rows || []).filter((a) => a.is_active !== false)
        setDoctorAffiliations(activeRows)
        if (activeRows.length && !activeRows.some((a) => String(a.affiliation_id) === String(form.affiliationId))) {
          setForm((f) => ({ ...f, affiliationId: String(activeRows[0].affiliation_id) }))
        }
      })
      .catch(() => {
        if (active) setDoctorAffiliations([])
      })
      .finally(() => {
        if (active) setAffiliationsLoaded(true)
      })
    return () => { active = false }
  }, [form.doctorId, form.affiliationId])

  // When doctor + date change: check the doctor consults that day, and (if so)
  // load the live token queue so the patient sees how busy it is before booking.
  useEffect(() => {
    if (!form.doctorId || !form.affiliationId || !form.date) {
      setDayState({ loading: false, available: null, reason: null })
      setSlotSuggestions({ sameDate: [], nearbyDates: [] })
      setQueue(null)
      return
    }
    let active = true
    setDayState({ loading: true, available: null, reason: null })
    setSlotSuggestions({ sameDate: [], nearbyDates: [] })
    setQueue(null)
    ;(async () => {
      try {
        const res = await appointmentsApi.availableSlots(form.doctorId, form.date, form.affiliationId)
        if (!active) return
        setDayState({ loading: false, available: !!res?.available, reason: res?.available ? null : res?.reason || t('ppage.noSlots') })
        if (res?.available) {
          // Token model: don't pick a slot — just show the queue length.
          tokensApi.queue(form.doctorId, form.date, form.affiliationId)
            .then((q) => { if (active) setQueue(q) })
            .catch(() => { if (active) setQueue(null) })
        }
        if (!res?.available) {
          const otherLocations = await Promise.all(
            affiliations
              .filter((a) => String(a.affiliation_id) !== String(form.affiliationId))
              .map(async (a) => {
                try {
                  const alt = await appointmentsApi.availableSlots(form.doctorId, form.date, a.affiliation_id)
                  return alt?.available && alt?.slots?.length ? { affiliation: a, slots: alt.slots } : null
                } catch {
                  return null
                }
              }),
          )
          const nextDates = await Promise.all(
            Array.from({ length: 7 }, (_, i) => addDaysISO(form.date, i + 1)).map(async (date) => {
              try {
                const alt = await appointmentsApi.availableSlots(form.doctorId, date, form.affiliationId)
                return alt?.available && alt?.slots?.length ? { date, slots: alt.slots } : null
              } catch {
                return null
              }
            }),
          )
          if (active) {
            setSlotSuggestions({
              sameDate: otherLocations.filter(Boolean),
              nearbyDates: nextDates.filter(Boolean).slice(0, 3),
            })
          }
        }
      } catch (err) {
        if (!active) return
        setQueue(null)
        setDayState({ loading: false, available: false, reason: err.message || t('ppage.couldNotLoadSlots') })
      }
    })()
    return () => {
      active = false
    }
  }, [affiliations, form.doctorId, form.affiliationId, form.date, t])

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const pick = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  // Travel minutes: GPS/address coords → instant haversine, then refined to real
  // road time (Google, else the backend's Mapbox/OSRM route — the same number
  // the map shows); manual distance → straight estimate.
  const [travelMin, setTravelMin] = useState(null)
  // Depend on the destination COORDINATES, not the destination object.
  // `destination` is rebuilt (`{ ...affiliation }`) on every render, so a new
  // identity re-ran this effect each time: it set the instant estimate, the
  // Google refinement came back and set a different number, that re-render made
  // another new object, and round it went — the displayed time visibly ticked
  // between the two values and fired a Distance Matrix request per cycle.
  const destLat = destination?.latitude ?? null
  const destLng = destination?.longitude ?? null
  useEffect(() => {
    let cancelled = false
    if (trip.lat == null || trip.lng == null) {
      const km = Number(trip.km)
      setTravelMin(Number.isFinite(km) && km > 0 ? travelMinutesFromKm(km) : null)
      return undefined
    }
    if (destLat == null || destLng == null) return undefined
    const origin = { lat: trip.lat, lng: trip.lng }
    const dest = { latitude: destLat, longitude: destLng }
    setTravelMin(travelMinutesBetween(origin, dest))   // instant estimate
    roadTravelMinutes(origin, dest).then((m) => {      // refine: real road time
      if (!cancelled && m != null) setTravelMin(m)
    })
    return () => { cancelled = true }
  }, [trip.lat, trip.lng, trip.km, destLat, destLng])

  // Reachability for the CHOSEN DATE, asked of the server as soon as we know
  // where they're travelling from. The submit-time guard still exists as the
  // backstop, but finding out only after filling the form — and expecting a
  // token — is the wrong moment to learn the trip is impossible.
  const [dayReach, setDayReach] = useState(null)
  // Which (date, origin) combination the patient has already been shown. Not a
  // plain boolean: dismissing the popup for Monday must not hide it when they
  // then pick Tuesday and still can't make it.
  const [reachSeen, setReachSeen] = useState(null)
  useEffect(() => {
    let active = true
    if (!form.doctorId || !form.date || trip.lat == null || trip.lng == null) {
      setDayReach(null)
      return undefined
    }
    appointmentsApi
      .availableSlots(form.doctorId, form.date, form.affiliationId, { lat: trip.lat, lng: trip.lng })
      .then((res) => { if (active) setDayReach(res?.travel?.day || null) })
      .catch(() => { if (active) setDayReach(null) })
    return () => { active = false }
  }, [form.doctorId, form.date, form.affiliationId, trip.lat, trip.lng])

  const useMyLocation = async () => {
    setTrip((tr) => ({ ...tr, geoLoading: true, geoError: null }))
    try {
      const { lat, lng } = await getCurrentPosition()
      setTrip((tr) => ({
        ...tr, lat, lng, km: '', source: 'gps', geoLoading: false, geoError: null,
        label: tr.for === 'self' ? t('ppage.myCurrentLocation') : t('ppage.patientCurrentLocation'),
      }))
    } catch (err) {
      setTrip((tr) => ({ ...tr, geoLoading: false, geoError: err.message }))
    }
  }

  // Resolve a typed address (the patient's home when booking for someone else)
  // into coordinates so the leave-by time is based on *their* journey.
  const locateFromAddress = async () => {
    if (!trip.address.trim()) {
      setTrip((tr) => ({ ...tr, geoError: t('ppage.enterAddressFirst') }))
      return
    }
    setTrip((tr) => ({ ...tr, geoLoading: true, geoError: null }))
    try {
      const g = await geocodeAddress({ address: trip.address })
      if (!g) {
        setTrip((tr) => ({ ...tr, geoLoading: false, geoError: t('ppage.couldNotFindAddress') }))
        return
      }
      // Only the city matched: its centre can be 15 km from the patient, which
      // would make the travel time and leave-by reminder wrong. Ask instead.
      if (g.approximate) {
        setTrip((tr) => ({ ...tr, geoLoading: false, geoError: t('ppage.onlyCityFound') }))
        return
      }
      setTrip((tr) => ({ ...tr, lat: g.lat, lng: g.lng, km: '', source: 'address', geoLoading: false, geoError: null, label: tr.address.trim() }))
    } catch (err) {
      setTrip((tr) => ({ ...tr, geoLoading: false, geoError: err.message || t('ppage.addressLookupFailed') }))
    }
  }

  // User picked a suggestion from the autocomplete → store its coordinates so
  // the leave-by time uses their real journey (no separate "Find" step needed).
  const selectAddress = (place) => {
    setTrip((tr) => ({ ...tr, lat: place.lat, lng: place.lng, km: '', source: 'address', label: place.label, address: place.label, geoLoading: false, geoError: null }))
  }
  // While typing, keep the text but drop any stale coordinates until they pick.
  const typeAddress = (text) => {
    setTrip((tr) => ({ ...tr, address: text, lat: null, lng: null, source: null }))
  }

  const setKm = (event) => {
    const km = event.target.value
    // Switching to a manual distance clears any captured GPS point.
    setTrip((tr) => ({ ...tr, km, lat: null, lng: null, source: null, label: km ? t('ppage.kmAway', { km }) : '' }))
  }

  const setTripFor = (who) => () =>
    setTrip((tr) => ({ ...tr, for: who, lat: null, lng: null, km: '', address: '', label: '', source: null, geoError: null }))

  // ---- Wizard navigation --------------------------------------------------
  // Arriving with ?doctor= (from a doctor card, a follow-up, a prescription)
  // and only one possible location leaves the doctor step with nothing to ask,
  // so it drops out of the wizard entirely.
  const skipDoctor = useMemo(
    () => Boolean(params.get('doctor')) &&
      (Boolean(params.get('affiliation')) || affiliations.length <= 1),
    [params, affiliations.length],
  )
  // "who" is always asked. It used to appear only when the patient already had
  // family members — so anyone booking for the first time was never asked, and
  // never discovered they could book for a parent or child at all. The step
  // carries an "Add member" tile, so it has something to offer even to someone
  // booking alone.
  const steps = useMemo(
    () => ALL_STEPS.filter((s) => !(s.id === 'doctor' && skipDoctor)),
    [skipDoctor],
  )
  const [stepId, setStepId] = useState(null)
  const [visited, setVisited] = useState(() => new Set())
  const [dir, setDir] = useState(1)
  const initedRef = useRef(false)
  const topRef = useRef(null)

  // Pick the entry step once everything we need to decide has settled.
  //
  // Arriving with ?doctor= (a doctor card, a follow-up, a prescription) already
  // answers "which doctor". Whether we can also skip the doctor STEP depends on
  // the location: with an explicit ?affiliation=, or a doctor who practises in
  // exactly one place, there is nothing left to ask and we jump to the date.
  // With several locations we still have to ask *where* — but not *who*, which
  // is why the step renders the doctor as already-decided.
  //
  // Only in-app entry points pass ?doctor= alone, so we wait for the location
  // list before deciding; otherwise we would skip a step that has a real question.
  const needsAffiliations = Boolean(params.get('doctor')) && !params.get('affiliation')
  useEffect(() => {
    if (initedRef.current || ctxLoading || !familyLoaded) return
    if (needsAffiliations && !affiliationsLoaded) return
    initedRef.current = true
    // Start at the first step. Previously a doctor-card entry jumped straight
    // to the date, which skipped "who" as well as the doctor — so booking for a
    // family member meant noticing the rail and going back a step.
    const ids = steps.map((s) => s.id)
    setStepId(ids[0])
    setVisited(new Set(ids.slice(0, 1)))
  }, [ctxLoading, familyLoaded, affiliationsLoaded, needsAffiliations, affiliations.length, steps, params])

  // The roster can arrive late and add the "who" screen; never strand the user
  // on a step that no longer exists.
  useEffect(() => {
    if (stepId && !steps.some((s) => s.id === stepId)) setStepId(steps[0]?.id ?? null)
  }, [steps, stepId])

  const currentIdx = steps.findIndex((s) => s.id === stepId)
  const isLast = currentIdx === steps.length - 1

  const validateStep = useCallback((id) => {
    const next = {}
    if (id === 'doctor') {
      if (!form.doctorId) next.doctorId = t('ppage.valSelectDoctor')
      else if (!form.affiliationId) next.affiliationId = t('pflow.valLocation')
    }
    if (id === 'when') {
      if (!form.date) next.date = t('ppage.valSelectDate')
      else if (dayState.loading) next.date = t('pflow.checkingDay')
      else if (dayState.available === false) next.date = dayState.reason || t('ppage.noSlots')
    }
    // Reason now lives on the travel screen, so it is checked there.
    if (id === 'travel' && !form.reason.trim()) next.reason = t('ppage.valReason')
    // Travel is required. Skipping it silently disabled the whole leave-by
    // feature — no travel time, no "time to leave" alert, and the token screen
    // just shows a dash. Any one of the three inputs satisfies it.
    if (id === 'travel') {
      const hasPoint = trip.lat != null && trip.lng != null
      const hasKm = String(trip.km ?? '').trim() !== '' && Number(trip.km) >= 0
      if (!hasPoint && !hasKm) next.trip = t('ppage.valTravel')
      // A journey that can't be completed before the hospital closes blocks the
      // step outright — the visit cannot happen on this date, so letting them
      // carry on to Confirm only to be refused wastes their time.
      else if (dayReach && dayReach.reachable === false) next.trip = t('pflow.travelBlockedShort')
    }
    if (id === 'review' && !form.consent) next.consent = t('ppage.valConsent')
    if (id === 'review' && dayReach && dayReach.reachable === false) next.trip = t('pflow.travelBlockedShort')
    return next
  }, [form.doctorId, form.affiliationId, form.date, form.reason, form.consent, dayState, dayReach, trip.lat, trip.lng, trip.km, t])

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const goNext = () => {
    const found = validateStep(stepId)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const next = steps[currentIdx + 1]
    if (!next) return
    setDir(1)
    setVisited((v) => new Set(v).add(next.id))
    setStepId(next.id)
    scrollToTop()
  }

  const goBack = () => {
    const prev = steps[currentIdx - 1]
    if (!prev) {
      navigate('/patient-dashboard')
      return
    }
    setDir(-1)
    setErrors({})
    setStepId(prev.id)
    scrollToTop()
  }

  const jumpTo = (id) => {
    if (!visited.has(id)) return
    setDir(steps.findIndex((s) => s.id === id) > currentIdx ? 1 : -1)
    setErrors({})
    setStepId(id)
    scrollToTop()
  }

  const submit = async (event) => {
    event.preventDefault()
    // Enter anywhere in the flow means "continue", not "book".
    if (!isLast) {
      goNext()
      return
    }
    setBanner(null)

    // Re-check every step, not just this one — a stale answer upstream (a date
    // that became unavailable while they filled the rest) must not slip through.
    const nextErrors = steps.reduce((acc, s) => ({ ...acc, ...validateStep(s.id) }), {})
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const firstBad = steps.find((s) => Object.keys(validateStep(s.id)).length > 0)
      if (firstBad && firstBad.id !== stepId) {
        setDir(-1)
        setStepId(firstBad.id)
        scrollToTop()
      }
      return
    }

    setSubmitting(true)
    try {
      // Token model: no slot_time — the patient just joins the queue.
      const booking = {
        doctor_id: form.doctorId,
        affiliation_id: form.affiliationId || null,
        patient_id: patient.patient_id,
        family_member_id: form.bookingFor === 'self' ? null : form.bookingFor,
        appointment_date: form.date,
        // Booked by the patient in the app — always 'online'. The visit-type
        // picker was removed: it offered 'Walk-in', which is a contradiction
        // here (a walk-in is raised at the desk, not booked in advance).
        appointment_type: 'online',
        // English only in the database (lib/englishText.js): a reason typed in
        // Telugu/Hindi becomes English symptom words, and the GPS label — shown
        // translated on screen — is saved in English.
        // English in the database whatever the screen language: chip wording
        // in the box ("జ్వరం & జలుబు") is saved as the chip's English
        // ("Fever & cold"); anything typed goes through englishSymptomNote.
        notes: reasonParts(form.reason)
          .map((p) => {
            const key = QUICK_REASONS.find((k) => t(k) === p)
            return key ? (dashboardT[key]?.en || p) : englishSymptomNote(p)
          })
          .filter(Boolean).join(', '),
        source: 'app',
        origin_lat: trip.lat,
        origin_lng: trip.lng,
        origin_label: trip.source === 'gps'
          ? (trip.for === 'self' ? 'My current location' : "Patient's current location")
          : toEnglishText(trip.label),
        travel_minutes: travelMin,
      }
      // Previous booking-fee checkout flow (disabled):
      // const order = await paymentsApi.createOrder(booking)
      // let appt
      // if (order.payment_required) {
      //   const ready = await loadRazorpay()
      //   if (!ready) throw new Error(t('px.book.gatewayFailed'))
      //   appt = await new Promise((resolve, reject) => {
      //     const rzp = new window.Razorpay({
      //       key: order.key_id,
      //       order_id: order.order_id,
      //       amount: order.amount,
      //       currency: order.currency,
      //       name: 'TapCure',
      //       description: t('px.book.consultWith', { name: doctor?.name || t('ppage.doctor') }),
      //       prefill: { name: patient?.name || '', contact: patient?.phone || '', email: realEmail(patient) || '' },
      //       theme: { color: '#2563eb' },
      //       handler: (resp) => {
      //         paymentsApi.confirm({
      //           razorpay_order_id: resp.razorpay_order_id,
      //           razorpay_payment_id: resp.razorpay_payment_id,
      //           razorpay_signature: resp.razorpay_signature,
      //           booking,
      //         }).then(resolve).catch(reject)
      //       },
      //       modal: { ondismiss: () => reject(new Error(t('px.book.payCancelled'))) },
      //     })
      //     rzp.open()
      //   })
      // } else {
      //   appt = await appointmentsApi.book(booking)
      // }
      const appt = await appointmentsApi.book(booking)
      // Fetch the freshly-allocated token + leave-by to show on the confirmation.
      let token = null
      try { token = await tokensApi.estimate({ appointment_id: appt.appointment_id }) } catch { /* token shows on dashboard */ }
      setBooked({ appt, token })
    } catch (err) {
      // The server refuses a first attempt it thinks the patient can't physically
      // reach. That's a question, not a failure — offer the choice rather than
      // dropping them into a red banner they can't act on.
      if (err?.status === 409 && err?.detail?.code === 'unreachable_slot') {
        setTravelWarn(err.detail)
      } else {
        setBanner(err.message || t('ppage.couldNotBook'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Next fortnight as tappable chips — a phone keyboard never opens for a date.
  const dayOptions = useMemo(() => {
    const base = todayISO()
    return Array.from({ length: DAY_COUNT }, (_, i) => ({
      iso: addDaysISO(base, i),
      offset: i,
    }))
  }, [])

  const dayLabel = (iso, offset) => {
    if (offset === 0) return t('pflow.today')
    if (offset === 1) return t('pflow.tomorrow')
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })
  }

  const filteredDoctors = useMemo(() => {
    const q = doctorQuery.trim().toLowerCase()
    if (!q) return bookableDoctors
    // "dentist" / "cardiologist" / "skin doctor" names a speciality: show
    // that speciality's doctors (letters alone made "dentist" find nobody).
    const named = specialtyFromText(q)
    if (named) return bookableDoctors.filter((d) => matchesSpecialty(d.specialization, named))
    // A symptom ("headache") -> the speciality the symptom list suggests.
    const bySymptom = matchSpecialties(q)[0]?.specialty || ''
    return bookableDoctors.filter((d) =>
      `${d.name || ''} ${d.specialization || ''}`.toLowerCase().includes(q)
      || Boolean(bySymptom && matchesSpecialty(d.specialization, bySymptom)),
    )
  }, [bookableDoctors, doctorQuery])

  // currentIdx < 0 means the step list changed under us (the roster arrived and
  // added "who"); the repair effect above fixes it on the next tick.
  if (ctxLoading || !stepId || currentIdx < 0) return <p className="text-sm text-slate-400">{t('pcommon.loading')}</p>

  // ---- Confirmation: show the allocated token + leave-by after booking ----
  if (booked) {
    return (
      <BookedCard
        booked={booked}
        doctorName={doctor?.name}
        dateLabel={readableDate(form.date)}
        onView={() => navigate('/patient-dashboard/appointments')}
        onAnother={() => {
          setBooked(null)
          setForm((f) => ({ ...f, date: '', reason: '', consent: false }))
          setDir(-1)
          setStepId(steps[0].id)
          setVisited(new Set([steps[0].id]))
        }}
      />
    )
  }

  /* ---------------------------------------------------------- step screens */

  /* Everyone the account can book for, as a scrollable row of small tiles: the
     whole family stays on screen (that was the point of the step) without
     spending a screen of the wizard on it. Sits on top of the first step. */
  const whoRow = (
    <div className="mb-5 border-b border-slate-100 pb-4">
      <p className="mb-2 text-[13px] font-semibold text-slate-700">{t('pflow.whoTitle')}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {people.map((p) => {
          const isSelf = !p.member_id
          const value = isSelf ? 'self' : String(p.member_id)
          const age = ageFromDob(p.dob)
          const selected = String(form.bookingFor) === value
          return (
            <button
              key={value}
              type="button"
              onClick={() => pick('bookingFor', value)}
              aria-pressed={selected}
              className={`flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors ${
                selected
                  ? 'border-brand-blue bg-brand-blueLight text-brand-blue'
                  : 'border-slate-200 bg-white hover:border-brand-blue/40'
              }`}
            >
              <PersonAvatar person={p} isSelf={isSelf} className="h-8 w-8 text-[11px]" />
              <span className="min-w-0 leading-tight">
                <span className="block max-w-[9rem] truncate text-[13px] font-bold text-brand-navy">{translitName(p.name, lang)}</span>
                <span className="block max-w-[9rem] truncate text-[11px] text-slate-400">
                  {[isSelf ? t('ppage.accountHolder') : relLabel(t, p.relation), age != null ? `${age} ${t('ppage.years')}` : null]
                    .filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              {/* Editing a member stays reachable, on the selected tile only —
                  a pencil on every tile would crowd the row. */}
              {!isSelf && selected && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setEditingMember(p) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditingMember(p) } }}
                  title={t('pcommon.edit')}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white hover:text-brand-blue"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          )
        })}

        {family.length < MAX_MEMBERS && (
          <button
            type="button"
            onClick={() => setEditingMember('new')}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-3 py-2 text-slate-400 transition-colors hover:border-brand-blue hover:bg-brand-blueLight/40 hover:text-brand-blue"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
              <Plus className="h-4 w-4" />
            </span>
            <span className="text-[12.5px] font-semibold">{t('ppage.addMember')}</span>
          </button>
        )}
      </div>
      {contactIsFallback && <p className="mt-2 text-[11.5px] text-slate-400">{t('ppage.noPhoneSaved')}</p>}
    </div>
  )

  const lockedDoctor = doctorLocked && doctor

  const doctorStep = (
    <>
      <StepTitle
        title={lockedDoctor ? t('pflow.whereTitle') : t('pflow.doctorTitle')}
        sub={lockedDoctor ? t('pflow.whereSub') : t('pflow.doctorSub')}
      />

      {lockedDoctor && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand-blue/25 bg-brand-blueLight/40 p-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand-blue shadow-sm">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] font-bold text-brand-navy" title={doctor.name}>{translitName(doctor.name, lang)}</p>
            <p className="truncate text-[11.5px] text-slate-500">{specialtyLabel(doctor.specialization, lang) || t('ppage.specialty')}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/patient-dashboard/doctors')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand-blue/30 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-brand-blue transition-colors hover:bg-brand-blueLight"
          >
            {t('pcommon.change')} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!lockedDoctor && bookableDoctors.length > 4 && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 transition-colors focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/10">
          <Search className="h-[18px] w-[18px] shrink-0 text-slate-400" />
          <input
            value={doctorQuery}
            onChange={(e) => setDoctorQuery(e.target.value)}
            placeholder={t('pflow.searchDoctor')}
            className="w-full bg-transparent py-2.5 text-sm text-brand-navy outline-none placeholder:text-slate-400"
          />
        </div>
      )}

      <div className={`grid max-h-[46vh] gap-3 overflow-y-auto pr-1 sm:max-h-none sm:grid-cols-2 sm:overflow-visible ${lockedDoctor ? 'hidden' : ''}`}>
        {filteredDoctors.map((d) => (
          <SelectCard
            key={d.doctor_id}
            selected={String(form.doctorId) === String(d.doctor_id)}
            onClick={() => {
              // Changing doctor invalidates the location + day answers below it.
              setForm((f) => ({ ...f, doctorId: String(d.doctor_id), affiliationId: '' }))
              setErrors((e) => ({ ...e, doctorId: undefined, affiliationId: undefined }))
            }}
          >
            <div className="flex items-center gap-3 pr-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-blueLight text-brand-blue">
                <Stethoscope className="h-5 w-5" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[14px] font-bold text-brand-navy" title={d.name}>{translitName(d.name, lang)}</p>
                <p className="truncate text-[11.5px] text-slate-400">{specialtyLabel(d.specialization, lang) || t('ppage.specialty')}</p>
              </div>
            </div>
            {d.consultation_fee != null && (
              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
                <IndianRupee className="h-3 w-3 shrink-0 text-slate-400" />
                {Number(d.consultation_fee)} · {t('pflow.payAtHospital')}
              </p>
            )}
          </SelectCard>
        ))}
        {filteredDoctors.length === 0 && (
          <p className="col-span-full rounded-xl bg-slate-50 p-4 text-center text-[13px] text-slate-400">
            {t('pflow.noDoctors')}
          </p>
        )}
      </div>
      {errors.doctorId && <p className="mt-2 text-xs text-red-500">{errors.doctorId}</p>}

      {form.doctorId && (
        <div className={lockedDoctor ? '' : 'mt-5'}>
          {/* When the doctor arrived pre-chosen the step heading already asks
              "where", so this label would just repeat it. */}
          {!lockedDoctor && (
            <p className="mb-2 text-[13px] font-semibold text-slate-700">{t('pflow.locationLabel')}</p>
          )}
          {affiliations.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-[13px] text-slate-400">{t('pflow.noLocations')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {affiliations.map((a) => (
                <SelectCard
                  key={a.affiliation_id}
                  selected={String(form.affiliationId) === String(a.affiliation_id)}
                  onClick={() => pick('affiliationId', String(a.affiliation_id))}
                >
                  <div className="flex items-start gap-3 pr-6">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-green/10 text-brand-green">
                      <Building2 className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-[13.5px] font-bold text-brand-navy">
                        {translitName(a.name || hospital?.name, lang) || t('ppage.hospitalLabel')}
                      </p>
                      {a.address && <p className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-400" title={a.address}>{translitName(a.address, lang)}</p>}
                      {a.consultation_fee != null && (
                        <p className="mt-1 text-[11.5px] font-semibold text-slate-500">₹{Number(a.consultation_fee)}</p>
                      )}
                    </div>
                  </div>
                </SelectCard>
              ))}
            </div>
          )}
          {errors.affiliationId && <p className="mt-2 text-xs text-red-500">{errors.affiliationId}</p>}
        </div>
      )}
    </>
  )

  const whenStep = (
    <>
      <StepTitle title={t('pflow.whenTitle')} sub={t('pflow.whenSub')} />

      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2">
        {dayOptions.map(({ iso, offset }) => {
          const active = form.date === iso
          const d = new Date(`${iso}T00:00:00`)
          return (
            <button
              key={iso}
              type="button"
              onClick={() => pick('date', iso)}
              className={`flex w-[68px] shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-3 transition-all ${
                active
                  ? 'border-brand-blue bg-brand-blue text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]'
                  : 'border-slate-200 bg-white text-brand-navy hover:-translate-y-0.5 hover:border-brand-blue/40'
              }`}
            >
              <span className={`text-[10.5px] font-bold uppercase tracking-wide ${active ? 'text-white/80' : 'text-slate-400'}`}>
                {dayLabel(iso, offset)}
              </span>
              <span className="text-[19px] font-extrabold leading-none">{d.getDate()}</span>
              <span className={`text-[10.5px] font-semibold ${active ? 'text-white/80' : 'text-slate-400'}`}>
                {d.toLocaleDateString('en-IN', { month: 'short' })}
              </span>
            </button>
          )
        })}
      </div>

      {/* Token queue preview — no slot to pick; just show how busy it is. */}
      {form.date && dayState.available && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-brand-blue/15 bg-brand-blueLight/40 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-blue shadow-sm"><Ticket className="h-5 w-5" /></span>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-brand-navy">
              {t(queue?.total_waiting === 1 ? 'px.book.queueOne' : 'px.book.queueMany', { name: translitName(doctor?.name, lang) || t('px.book.thisDoctor'), n: queue?.total_waiting ?? '…' })}
            </p>
            <p className="text-[12.5px] text-slate-500">
              {queue == null ? t('px.book.checkingQueue')
                : t('px.book.nextToken', { n: (queue.total_waiting || 0) * 10 })}
            </p>
          </div>
          <span className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-brand-blue">{t('pm.noApptTime')}</span>
        </div>
      )}
      {form.date && dayState.loading && (
        <p className="mt-3 text-[12.5px] text-slate-400">{t('pflow.checkingDay')}</p>
      )}

      {form.date && dayState.reason && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] font-medium text-amber-700">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {affiliation?.name
              ? t('px.book.notAvailableAt', { name: translitName(doctor?.name, lang) || t('px.book.thisDoctor'), place: translitName(affiliation.name, lang), date: readableDate(form.date) })
              : dayState.reason}
          </div>
          {slotSuggestions.sameDate.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold text-amber-800">{t('pm.availableOtherPractice')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {slotSuggestions.sameDate.map((item) => (
                  <button
                    key={item.affiliation.affiliation_id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, affiliationId: String(item.affiliation.affiliation_id) }))}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-bold text-amber-800 hover:bg-amber-100"
                  >
                    {t('px.book.bookAt', { place: item.affiliation.name })}
                  </button>
                ))}
              </div>
            </div>
          )}
          {slotSuggestions.nearbyDates.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold text-amber-800">{t('px.book.availableAtOn', { place: affiliation?.name || t('px.book.thisLocation') })}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {slotSuggestions.nearbyDates.map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    onClick={() => pick('date', item.date)}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-bold text-amber-800 hover:bg-amber-100"
                  >
                    {readableDate(item.date)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!slotSuggestions.sameDate.length && !slotSuggestions.nearbyDates.length && (
            <p className="mt-2 text-[12px]">{dayState.reason}</p>
          )}
        </div>
      )}

      {!form.date && errors.date && <p className="mt-2 text-xs text-red-500">{errors.date}</p>}
    </>
  )

  /** Tick / untick a "Common reasons" chip: its words are added to the reason
   *  box (after anything already there) or taken back out, so the box always
   *  shows the full reason and the patient can still edit it. */
  const toggleReason = (key) => {
    const label = t(key)
    setForm((f) => {
      const parts = reasonParts(f.reason)
      const next = parts.includes(label) ? parts.filter((p) => p !== label) : [...parts, label]
      return { ...f, reason: next.join(', ') }
    })
    setErrors((e) => ({ ...e, reason: undefined }))
  }

  /* Reason had a screen of its own, which was a lot of tapping for two chips.
     It now opens the travel screen, above the leave-by question. */
  const reasonBlock = (
    <>
      <p className="mb-2 text-[13px] font-semibold text-slate-700">{t('pflow.quickPick')}</p>
      {/* Tighter than the default Chip so all six complaints fit across instead
          of dropping the last one onto a line of its own. Passed per-call, not
          changed on Chip itself, which is also used for the time slots. */}
      <div className="flex flex-wrap gap-1.5">
        {/* Any number can be ticked; each is written into the reason box below
            (and taken out again on untick), next to whatever was typed. */}
        {QUICK_REASONS.map((key) => (
          <Chip
            key={key}
            active={reasonParts(form.reason).includes(t(key))}
            onClick={() => toggleReason(key)}
            className="!px-2.5 !py-1.5 !text-[12px]"
          >
            {t(key)}
          </Chip>
        ))}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {t('ppage.reasonForVisit')} <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={2}
          className={textareaClass(errors.reason)}
          value={form.reason}
          onChange={set('reason')}
          placeholder={t('ppage.reasonPlaceholder')}
        />
        {errors.reason && <p className="mt-1 text-xs text-red-500">{errors.reason}</p>}
      </div>
    </>
  )

  /** Shown as soon as the location makes this date impossible — on the travel
   *  step and again on review, so it can't be reached only at submit. */
  // Key identifying this exact (date, origin) pair — the popup shows once per
  // combination.
  const reachKey = dayReach ? `${form.date}|${trip.lat},${trip.lng}` : null
  const showReachModal = !!(dayReach && dayReach.reachable === false && reachKey !== reachSeen)
  const dismissReach = () => setReachSeen(reachKey)

  const reachModal = showReachModal ? (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={dismissReach}
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-amber-900">{t('pflow.travelTooFarTitle')}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">{dayReach.message}</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-[12.5px] text-slate-500">{t('pflow.travelPickAnotherDay')}</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { dismissReach(); setDir(-1); setStepId('when'); scrollToTop() }}
              className="w-full rounded-xl bg-brand-blue py-2.5 text-[13.5px] font-bold text-white hover:bg-brand-blueDark"
            >
              {t('pflow.travelChooseDate')}
            </button>
            {/* The way out for someone who is ALREADY near the hospital: their
                saved/GPS origin is a guess, and this is the only honest way to
                correct it. */}
            <button
              type="button"
              onClick={dismissReach}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t('pflow.travelEditStart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null

  // Makes it, but with little to spare. A note, never a block — the patient may
  // be fine with a short wait, and refusing them would be inventing a rule the
  // hospital never asked for.
  const tightNotice = dayReach?.reachable && dayReach?.tight ? (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
      <p className="flex items-center gap-2 text-[13px] font-bold text-amber-900">
        <Hourglass className="h-4 w-4 shrink-0" /> {t('pflow.travelTightTitle')}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">{dayReach.message}</p>
    </div>
  ) : null

  const reachNotice = dayReach && dayReach.reachable === false ? (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
      <p className="flex items-center gap-2 text-[13px] font-bold text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {t('pflow.travelTooFarTitle')}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-800">{dayReach.message}</p>
      <button
        type="button"
        onClick={() => { setDir(-1); setStepId('when'); scrollToTop() }}
        className="mt-2.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-[12.5px] font-bold text-white hover:bg-amber-700"
      >
        {t('pflow.travelChooseDate')}
      </button>
    </div>
  ) : null

  const travelStep = (
    <>
      <StepTitle title={t('pflow.travelTitle')} sub={t('pflow.travelSub')} />

      <div className="mb-4">
        <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">{t('ppage.whoTravelling')}</p>
        <div className="flex gap-2">
          {[
            { key: 'self', label: t('ppage.me'), icon: User },
            { key: 'other', label: t('ppage.someoneElse'), icon: Users },
          ].map((opt) => (
            <Chip
              key={opt.key}
              active={trip.for === opt.key}
              onClick={setTripFor(opt.key)}
              className="inline-flex items-center gap-1.5"
            >
              <opt.icon className="h-4 w-4" /> {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={useMyLocation}
        disabled={trip.geoLoading}
        className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3.5 text-[14px] font-bold transition-colors disabled:opacity-60 ${
          trip.source === 'gps'
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-brand-blue bg-brand-blue text-white hover:bg-brand-blueDark'
        }`}
      >
        <LocateFixed className="h-5 w-5" />
        {/* Keyed on `source`, not on `lat`. Both address paths set lat too, so
            keying on it left this green and reading "Location captured" after
            an address search — claiming a GPS capture that never happened, and
            offering no way back to the real one. */}
        {trip.geoLoading ? t('ppage.locating') : trip.source === 'gps' ? t('ppage.locationCaptured') : t('ppage.useCurrentLocation')}
      </button>
      {trip.geoError && <p className="mt-1.5 text-xs text-amber-600">{trip.geoError}</p>}

      <div className="my-4 flex items-center gap-3 text-[11.5px] font-semibold uppercase tracking-wider text-slate-300">
        <span className="h-px flex-1 bg-slate-100" /> {t('pflow.or')} <span className="h-px flex-1 bg-slate-100" />
      </div>

      <div>
        <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">
          {trip.for === 'self' ? t('ppage.yourAddress') : t('ppage.patientAddress')}
        </p>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <AddressAutocomplete
              value={trip.address}
              onChange={typeAddress}
              onSelect={selectAddress}
              placeholder={t('ppage.addressPlaceholder')}
              biasLat={destination?.latitude}
              biasLng={destination?.longitude}
            />
          </div>
          <button
            type="button"
            onClick={locateFromAddress}
            disabled={trip.geoLoading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-blue px-3.5 py-2.5 text-[13px] font-bold text-white hover:bg-brand-blueDark disabled:opacity-60"
          >
            <MapPin className="h-4 w-4" /> {t('ppage.find')}
          </button>
        </div>
        {/* Confirm the address was actually accepted. With the button now
            reverting to blue for an address, nothing else on screen would say
            the lookup had worked — it would read as "nothing happened". */}
        {trip.source === 'address' && trip.label ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] font-semibold text-green-700">
            <MapPin className="mt-[1px] h-3.5 w-3.5 shrink-0" />
            {t('cmn.travellingFrom', { origin: trip.label })}
          </p>
        ) : (
          <p className="mt-1 text-[11.5px] text-slate-400">{t('ppage.addressHint')}</p>
        )}
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[12.5px] font-semibold text-slate-700">
          {trip.for === 'self' ? t('ppage.orDistanceToHospital') : t('ppage.distanceToHospital')}
        </p>
        <div className="relative sm:max-w-[240px]">
          <Navigation className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={trip.km}
            onChange={setKm}
            placeholder={t('ppage.distancePlaceholder')}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-12 text-sm text-brand-navy outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-slate-400">{t('px.kmUnit')}</span>
        </div>
        {errors.trip && (
          <p className="mt-2 text-xs font-semibold text-red-500">{errors.trip}</p>
        )}
      </div>

      {travelMin != null ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[12.5px] font-semibold text-green-700">
          <Navigation className="h-4 w-4" />
          {t('ppage.aboutMinAway', { d: humanMins(t, travelMin), label: trip.label ? ` · ${trip.label}` : '' })}
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-slate-500">{t('ppage.optionalReminder')}</p>
      )}

      {reachNotice}
      {tightNotice}

      {destination?.latitude != null && destination?.longitude != null && (
        <HospitalMap
          hospital={destination}
          origin={trip.lat != null && trip.lng != null ? { lat: trip.lat, lng: trip.lng } : null}
          hospitalLabel={affiliation?.name || hospital?.name || t('ppage.hospitalLabel')}
          originLabel={trip.label || t('pdash.you')}
          height={200}
          className="mt-4"
          tiles="mapbox"
          zoomControl={false}
          // The hospital's logo as the pin. `hospital` falls back to the doctor's
          // main hospital, which is NOT where a personal-hospital visit happens,
          // so a personal hospital (affiliation with no hospital) keeps the plain pin.
          hospitalLogo={(affiliation ? (affiliation.hospital_id ? hospital?.logo_url : null) : hospital?.logo_url) || null}
        />
      )}
    </>
  )

  const summaryRow = (Icon, label, value, strong = false) => (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <span className="flex shrink-0 items-center gap-2 text-[12.5px] font-medium text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </span>
      <span className={`text-right text-[13px] ${strong ? 'font-bold text-brand-navy' : 'font-semibold text-slate-600'}`}>
        {value}
      </span>
    </div>
  )

  const reviewStep = (
    <>
      <StepTitle title={t('pflow.reviewTitle')} sub={t('pflow.reviewSub')} />

      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 divide-y divide-slate-200/70">
        {summaryRow(User, t('ppage.bookingFor'), selectedPerson?.name || '—', true)}
        {summaryRow(Stethoscope, t('ppage.doctor'), translitName(doctor?.name, lang) || '—', true)}
        {summaryRow(MapPin, t('pflow.stepWhereShort'), translitName(affiliation?.name || hospital?.name, lang) || t('ppage.hospitalLabel'))}
        {summaryRow(CalendarDays, t('ppage.apptDate'), form.date ? readableDate(form.date) : '—', true)}
        {form.date && dayState.available && summaryRow(
          Ticket,
          t('pflow.queueLabel'),
          queue == null ? '…' : `${queue.total_waiting || 0} ${t('pflow.inQueue')}`,
        )}
        {summaryRow(ClipboardList, t('ppage.reasonForVisit'), form.reason || '—')}
        {summaryRow(Phone, t('ppage.mobileNumber'), contactPhone ? `+91 ${contactPhone}` : '—')}
        {realEmail(patient) && summaryRow(Mail, t('ppage.email'), realEmail(patient))}
        {travelMin != null && summaryRow(
          Navigation,
          t('pflow.stepTravel'),
          t('ppage.minAwaySummary', { d: humanMins(t, travelMin), label: trip.label ? ` (${trip.label})` : '' }),
        )}
        {summaryRow(
          IndianRupee,
          t('pflow.consultation'),
          freePass
            ? <span className="font-bold text-emerald-700">{t('rvp.summary', { date: new Date(`${freePass.valid_until}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) })}</span>
            : <>₹{feeAmount} <span className="font-normal text-slate-400">· {t('pflow.payAtHospital')}</span></>,
        )}
        {/* Booking-fee summary disabled with checkout:
        {payCfg.enabled && payCfg.booking_fee > 0 && summaryRow(
          IndianRupee,
          t('pflow.bookingFee'),
          <>₹{payCfg.booking_fee} <span className="font-normal text-slate-400">· {t('pflow.payNow')}</span></>,
          true,
        )}
        */}
      </div>

      {reachNotice}
      {tightNotice}

      <div className="mt-4">
        <Checkbox checked={form.consent} onChange={set('consent')} className="rounded-xl bg-slate-50 p-3">
          {t('ppage.bookConsent')}
        </Checkbox>
        {errors.consent && <p className="mt-1 text-xs text-red-500">{errors.consent}</p>}
      </div>

      <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-3 text-[12.5px] font-medium text-green-700">
        {t('ppage.afterConfirm')}
      </div>
    </>
  )

  const screens = {
    doctor: doctorStep,
    when: whenStep,
    // Reason sits above the leave-by question, on the same screen.
    travel: (
      <>
        {reasonBlock}
        <div className="mt-6 border-t border-slate-100 pt-5">{travelStep}</div>
      </>
    ),
    review: reviewStep,
  }

  /* A one-line reminder of what's chosen so far — keeps context without the
     old always-on sidebar competing with the question being asked. */
  const showContext = ['when', 'travel'].includes(stepId) && doctor

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <span ref={topRef} className="sr-only" aria-hidden="true" />

      <PageHeading title={t('ppage.bookTitle')} subtitle={t('pflow.bookSubtitle')}>
        <button
          type="button"
          onClick={() => navigate('/patient-dashboard')}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:border-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> {t('ppage.backToDashboard')}
        </button>
      </PageHeading>

      {reachModal}

      {banner && <Banner type="error">{banner}</Banner>}

      {/* Travel reality check. Not an error: the journey is longer than the time
          left before this hospital closes, so the visit can't happen today. The
          patient still decides — they may already be in the city, or be booking
          for a relative who lives there. */}
      {travelWarn && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Route className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-amber-900">{t('pflow.travelTooFarTitle')}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-amber-800">{travelWarn.message}</p>
              <p className="mt-2 text-[12.5px] text-amber-700">{t('pflow.travelPickAnotherDay')}</p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setTravelWarn(null)
                    setDir(-1)
                    setStepId('when')
                    scrollToTop()
                  }}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-amber-700"
                >
                  {t('pflow.travelChooseDate')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[720px]">
        {/* No overflow-hidden here: it would make the Card a scroll container
            and stop the action bar below from sticking to the viewport. */}
        <Card className="p-0">
          <div className="border-b border-slate-100 px-4 pb-3 sm:px-6">
            <StepRail steps={steps} currentIdx={currentIdx} visited={visited} onJump={jumpTo} t={t} />
            <p className="mt-1 text-center text-[11.5px] font-semibold text-slate-400 sm:hidden">
              {t('pflow.step', { n: currentIdx + 1, total: steps.length })} · {t(steps[currentIdx].labelKey)}
            </p>
          </div>

          {showContext && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11.5px] font-semibold text-slate-500 sm:px-6">
              <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-brand-navy">{translitName(doctor.name, lang)}</span>
              {affiliation?.name && <><span className="text-slate-300">·</span><span>{translitName(affiliation.name, lang)}</span></>}
              {form.date && <><span className="text-slate-300">·</span><span>{readableDate(form.date)}</span></>}
            </div>
          )}

          <div className="px-4 py-5 sm:px-6">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div
                key={stepId}
                custom={dir}
                initial={{ opacity: 0, x: dir * 26 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -26 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                {/* Whoever the visit is for is asked once, on the first screen
                    of whichever wizard this entry point produced. */}
                {currentIdx === 0 && whoRow}
                {screens[stepId]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Sticky action bar — thumb-reachable on a phone. */}
          <div className="sticky bottom-0 z-20 flex items-center gap-3 rounded-b-2xl border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{currentIdx === 0 ? t('pcommon.cancel') : t('pflow.back')}</span>
            </button>

            <div className="flex-1" />

            {isLast ? (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] transition-colors hover:bg-brand-blueDark disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting
                  ? t('ppage.booking')
                  : t('px.book.bookToken')}
                {/* Previous conditional payment label:
                (payCfg.enabled && payCfg.booking_fee > 0)
                  ? t('px.book.payAndBook', { fee: payCfg.booking_fee })
                  : t('px.book.bookToken')
                */}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] transition-colors hover:bg-brand-blueDark"
              >
                {t('pflow.continue')} <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Add / edit a dependent without leaving the flow. */}
      <EditFamilyMemberModal
        member={editingMember}
        patientId={patient?.patient_id}
        accountPhone={patient?.phone}
        onClose={() => setEditingMember(null)}
        onSaved={(saved) => {
          loadFamily()
          // A freshly added member becomes the selected one — that's why they added them.
          if (editingMember === 'new' && saved?.member_id) {
            setForm((f) => ({ ...f, bookingFor: String(saved.member_id) }))
          }
        }}
      />
    </form>
  )
}

export default BookAppointment
