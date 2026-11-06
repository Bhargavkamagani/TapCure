import { useState, useEffect, useCallback, useRef } from 'react'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays, CheckCircle2, Hourglass, Users, Clock,
  ArrowRight, SkipForward, Radio, RefreshCw, BellRing, Send, History,
  ChevronDown, ChevronUp, Pill, X, PhoneCall,
  UserPlus, Activity, RotateCcw, UserX,
} from 'lucide-react'
import { Card, StatusBadge, Avatar } from '../../components/hospital/ui.jsx'
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx'
import TravelChip from '../../components/common/TravelChip.jsx'
import { VitalsSummaryCard, VitalsModal } from '../../components/patient/VitalsPanel.jsx'
import PatientHistoryDrawer from '../../components/patient/PatientHistoryDrawer.jsx'
import RxComposer from '../../components/doctor/RxComposer.jsx'
import WalkInModal from '../../components/doctor/WalkInModal.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { appointmentsApi, tokensApi, patientsApi, doctorsApi } from '../../api'
import CollectPaymentModal, { paymentModeLabel } from '../../components/common/CollectPaymentModal.jsx'
import { seenName } from '../../lib/patientDisplay.js'
import FreeRevisitChip from '../../components/common/FreeRevisitChip.jsx'
import { prettyTime, statusLabel, todayISO } from '../../lib/format.js'
import { useDialog } from '../../components/common/DialogProvider.jsx'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } } }
const rise = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

const KPI_TONE = {
  blue: 'bg-blue-100 text-brand-blue', green: 'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-500', purple: 'bg-purple-100 text-purple-600',
  teal: 'bg-teal-100 text-teal-600',
}

function KpiCard({ value, isNum = true, label, sub, icon: Icon, tone, footer }) {
  return (
    // motion wrapper owns the mount stagger; the inner div owns the spotlight
    // hover, so framer's inline transform never fights the CSS one.
    <motion.div variants={item} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="relative">
      {/* Hover fills with the assistant dashboard's emerald gradient; text and
          the icon chip invert to white, matching the quick-action cards. */}
      <div className="spotlight-card group relative h-full rounded-xl border border-slate-100 bg-white p-3 shadow-card transition-colors duration-300 hover:border-white/30 hover:bg-gradient-to-br hover:from-emerald-500 hover:to-emerald-600">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-semibold text-slate-500 transition-colors duration-300 group-hover:text-white/85">{label}</p>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 group-hover:bg-white/20 group-hover:text-white ${KPI_TONE[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-1.5 text-[22px] font-extrabold leading-none text-brand-navy transition-colors duration-300 group-hover:text-white">
          {isNum ? <AnimatedNumber value={value} /> : value}
        </p>
        {sub && <p className="mt-1 text-[11px] text-slate-400 transition-colors duration-300 group-hover:text-white/75">{sub}</p>}
        {footer}
      </div>
    </motion.div>
  )
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** One labelled figure in the Live OP Queue stat strip. */
function HeroStat({ icon: Icon, tone, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] ${tone}`}>
        <Icon className="h-3 w-3" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[10px] text-white/50">{label}</p>
        <p className="truncate text-[12px] font-semibold text-white">{value}</p>
      </div>
    </div>
  )
}

// Allergy severity drives the colour — the doctor is about to prescribe on this
// same screen, so a life-threatening allergy must not look like a footnote.
const ALLERGY_TONE = {
  'Life-threatening': 'bg-red-600 text-white',
  Severe: 'bg-red-100 text-red-700',
  Moderate: 'bg-orange-100 text-orange-700',
  Mild: 'bg-amber-50 text-amber-700',
}

/**
 * What's already known about the patient being consulted: allergies first, then
 * conditions. One card, kept tight, so it sits under the vitals without pushing
 * the consult controls off screen.
 *
 * Renders nothing when there's neither — the doctor's screen shouldn't carry an
 * empty box. A failed lookup is NOT silence: "we couldn't load it" and "there is
 * none" are different clinical statements, and only one is safe to imply.
 */
function KnownHistoryNote({ history, allergies }) {
  const failed = history === null || allergies === null
  const conds = history || []
  const algs = allergies || []
  if (!failed && !conds.length && !algs.length) return null

  // Chronic first, and worst allergy first — what matters most, seen first.
  const rows = [...conds].sort((a, b) => Number(b.is_chronic) - Number(a.is_chronic))
  const order = ['Life-threatening', 'Severe', 'Moderate', 'Mild']
  const algRows = [...algs].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))

  return (
    <Card className="!p-3">
      {algRows.length > 0 && (
        <div className={rows.length ? 'mb-2.5' : ''}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <BellRing className="h-3.5 w-3.5 text-red-500" />
            <h4 className="text-[11.5px] font-bold uppercase tracking-wide text-red-600">Allergies</h4>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {algRows.map((a) => (
              <li
                key={a.allergy_id}
                title={[a.reaction, a.severity].filter(Boolean).join(' · ') || undefined}
                className={`rounded-lg px-2 py-0.5 text-[11.5px] font-bold ${ALLERGY_TONE[a.severity] || 'bg-red-50 text-red-600'}`}
              >
                {a.allergen}{a.severity ? ` · ${a.severity}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="mb-1.5 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-brand-blue" />
            <h4 className="text-[11.5px] font-bold uppercase tracking-wide text-slate-500">Medical history</h4>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {rows.map((h) => (
              <li
                key={h.history_id}
                title={[h.notes, h.diagnosed_date && `diagnosed ${h.diagnosed_date}`].filter(Boolean).join(' · ') || undefined}
                className={`rounded-lg px-2 py-0.5 text-[11.5px] font-semibold ${
                  h.is_chronic ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {h.condition}{h.is_chronic ? ' · chronic' : ''}
              </li>
            ))}
          </ul>
        </>
      )}

      {failed && (
        <p className={`text-[11px] font-medium text-amber-600 ${conds.length || algs.length ? 'mt-2' : ''}`}>
          {history === null && allergies === null
            ? 'History and allergies could not be loaded'
            : history === null ? 'Medical history could not be loaded' : 'Allergies could not be loaded'}
          {' '}— check the patient's record before prescribing.
        </p>
      )}
    </Card>
  )
}

/** Build short chips from a token's latest vitals summary (queue payload). */
function vitalChips(v) {
  if (!v) return []
  const c = []
  if (v.bp) c.push(`BP ${v.bp}`)
  if (v.pulse != null) c.push(`${v.pulse} bpm`)
  if (v.temperature_f != null) c.push(`${v.temperature_f}°F`)
  if (v.spo2 != null) c.push(`SpO₂ ${v.spo2}%`)
  if (v.weight_kg != null) c.push(`${v.weight_kg} kg`)
  if (v.blood_sugar != null) c.push(`Sugar ${v.blood_sugar}`)
  if (v.bmi != null) c.push(`BMI ${v.bmi}`)
  return c
}
const pct = (n, total) => (total > 0 ? `${Math.round((n / total) * 100)}% of total` : '—')

function Dashboard() {
  const dialog = useDialog()
  const navigate = useNavigate()
  const { doctor, doctorId, resolvePatient } = useDoctorCtx()
  const [appts, setAppts] = useState([])
  const [queue, setQueue] = useState({ current: null, waiting: [], total_waiting: 0 })
  const [stats, setStats] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [curVitals, setCurVitals] = useState([])   // current patient's vitals (flags + history)
  const [curHistory, setCurHistory] = useState([]) // current patient's known conditions
  const [curAllergies, setCurAllergies] = useState([]) // and their allergies
  const [delayOpen, setDelayOpen] = useState(false)
  const [delayMin, setDelayMin] = useState(15)
  const [delaySending, setDelaySending] = useState(false)
  const [delaySent, setDelaySent] = useState(false)
  const [histPatient, setHistPatient] = useState(null)  // current patient's history drawer
  // The hero strip is a fixed-height band: a long queue must scroll inside its
  // card, never stretch the page. Collapsed we show PREVIEW_ROWS; "See more"
  // expands in place (still scrolling) instead of growing the layout.
  const [queueExpanded, setQueueExpanded] = useState(false)
  const [apptsExpanded, setApptsExpanded] = useState(false)
  // Prescribing happens on this page — the doctor should never have to leave the
  // dashboard mid-consultation. `rxFor` drives the composer modal; `justDone`
  // keeps the patient reachable for a moment after "Done", since completing the
  // token clears `current` and would otherwise strand the prescription.
  const [rxFor, setRxFor] = useState(null)
  const [justDone, setJustDone] = useState(null)
  // Folded in from the old Live OP Queue page: recording vitals for any token in
  // the queue, and registering a walk-in. A solo doctor has no front desk to do
  // either, which is why they have to live on the screen they work from.
  const [vitalsFor, setVitalsFor] = useState(null)
  const [addingWalkIn, setAddingWalkIn] = useState(false)
  const startRef = useRef(null)

  const loadQueue = useCallback(async () => {
    if (!doctorId) return
    const [q, s] = await Promise.all([
      tokensApi.queue(doctorId, todayISO()).catch(() => null),
      tokensApi.stats(doctorId).catch(() => null),
    ])
    if (q) setQueue(q)
    setStats(s)
    startRef.current = q?.current?.actual_start ? new Date(q.current.actual_start).getTime() : null
  }, [doctorId])

  const loadAll = useCallback(async () => {
    if (!doctorId) return
    const [t] = await Promise.all([appointmentsApi.today(doctorId), loadQueue()])
    setAppts(t || [])
  }, [doctorId, loadQueue])

  const refreshAll = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await loadAll()
    } catch (e) {
      dialog.alert({ title: 'Refresh failed', message: e.message || 'Could not refresh the dashboard.', tone: 'danger' })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { loadAll() }, [loadAll])
  // 10s: this is the screen the doctor consults from, so it tracks the queue
  // closer than the desk's boards do. Paused while an action is in flight or a
  // prescription is open — the queue must not move under a half-written Rx.
  useAutoRefresh(loadQueue, {
    intervalMs: 10000,
    enabled: !!doctorId,
    paused: busy || !!rxFor || !!vitalsFor || addingWalkIn,
  })

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(startRef.current ? Math.max(0, Math.round((Date.now() - startRef.current) / 1000)) : 0)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Pull the consulting patient's full vitals (with flags + history) for the
  // dashboard vitals card. `[]` when nobody is being seen, `null` while loading.
  // Known conditions ride along: the doctor is about to consult, and a chronic
  // condition changes how a reading is read — a BP of 150 means something
  // different in a known hypertensive.
  useEffect(() => {
    const pid = queue.current?.patient_id
    if (!pid) { setCurVitals([]); setCurHistory([]); setCurAllergies([]); return }
    let active = true
    setCurVitals(null)
    setCurHistory(null)
    setCurAllergies(null)
    patientsApi.vitals(pid)
      .then((v) => active && setCurVitals(v))
      // Not `[]` — that is the card's "no vitals recorded" state, and a
      // network failure must never be shown as a clinical fact.
      .catch(() => active && setCurVitals(null))
    patientsApi.medicalHistory(pid)
      .then((h) => active && setCurHistory(h || []))
      // Same rule: "couldn't load" must not render as "no history".
      .catch(() => active && setCurHistory(null))
    patientsApi.allergies(pid)
      .then((a) => active && setCurAllergies(a || []))
      .catch(() => active && setCurAllergies(null))
    return () => { active = false }
  }, [queue.current?.patient_id])

  // Safety: once the next patient is called in, drop the "just completed"
  // prompt so an Rx can never be started for the previous patient while someone
  // else is on screen. The composer, if already open, keeps its own patient.
  useEffect(() => {
    if (queue.current?.token_id) setJustDone(null)
  }, [queue.current?.token_id])

  // Collect popup: asks how they paid (cash / UPI / card) before marking Paid.
  const [collectFor, setCollectFor] = useState(null)

  const act = async (fn) => {
    setBusy(true)
    try {
      await fn()
      await loadQueue()
    } catch (e) {
      dialog.alert({ title: 'Action failed', message: e.message || 'Please try again.', tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  // Notify waiting patients that the doctor is running late (moved here from the
  // standalone Delay Alert page).
  const sendDelay = async () => {
    setDelaySending(true)
    try {
      await doctorsApi.logDelay({ doctor_id: doctorId, delay_minutes: delayMin, reason: 'Running late' })
      setDelaySent(true)
    } catch (e) {
      dialog.alert({ title: 'Delay alert not sent', message: e.message || 'Could not send delay alert.', tone: 'danger' })
    } finally {
      setDelaySending(false)
    }
  }

  const current = queue.current
  const waiting = queue.waiting || []
  const next = waiting[0] || null

  const PREVIEW_ROWS = 5
  const queueRows = [current, ...waiting].filter(Boolean)
  const visibleQueue = queueExpanded ? queueRows : queueRows.slice(0, PREVIEW_ROWS)
  const hiddenQueue = queueRows.length - visibleQueue.length
  const visibleAppts = apptsExpanded ? appts : appts.slice(0, PREVIEW_ROWS)
  const hiddenAppts = appts.length - visibleAppts.length
  // Show the person being seen (a dependent when booked for one), not just the
  // account holder. Rows carry patient_name + family_member_name.
  const nameOf = (t) => t?.family_member_name || t?.patient_name || resolvePatient(t?.patient_id)?.name || (t ? `Token ${t.token_number}` : '')
  const bookedByOf = (t) => (t?.family_member_name ? (t?.patient_name || resolvePatient(t?.patient_id)?.name || null) : null)
  // "Male · 42 Years" under the patient name — omits whichever part is missing,
  // and returns null when the record has neither (caller falls back to status).
  const patientMeta = (t) => {
    const p = resolvePatient(t?.patient_id)
    if (!p) return null
    const bits = []
    if (p.gender) bits.push(p.gender.charAt(0).toUpperCase() + p.gender.slice(1).toLowerCase())
    if (p.age != null) bits.push(`${p.age} Years`)
    return bits.length ? bits.join(' · ') : null
  }

  const total = appts.length
  const completedToday = stats?.served ?? appts.filter((a) => a.status === 'completed').length
  const inQueue = stats?.waiting ?? queue.total_waiting
  const remaining = appts.filter((a) => a.status === 'scheduled').length

  return (
    <div className="flex flex-col gap-5">
      {/* Greeting row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-navy">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage appointments, queue and hospital operations in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Delay alert — notify waiting patients (moved here from the sidebar) */}
          <div className="relative">
            <button
              onClick={() => { setDelayOpen((o) => !o); setDelaySent(false) }}
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100"
            >
              <BellRing className="h-4 w-4" /> Delay Alert
            </button>
            {delayOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setDelayOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-xl">
                  <h4 className="mb-1.5 flex items-center gap-2 text-[14px] font-bold text-brand-navy">
                    <BellRing className="h-4 w-4 text-red-500" /> Send Delay Alert
                  </h4>
                  <p className="mb-3 text-[12.5px] text-slate-500">
                    <span className="font-bold text-brand-navy">{inQueue} waiting</span> {inQueue === 1 ? 'patient' : 'patients'} will be notified.
                  </p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {[10, 15, 20, 30, 45].map((m) => (
                      <button key={m} onClick={() => { setDelayMin(m); setDelaySent(false) }}
                        className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${delayMin === m ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 text-brand-navy hover:border-slate-300'}`}>
                        +{m}m
                      </button>
                    ))}
                  </div>
                  {delaySent ? (
                    <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[12.5px] font-semibold text-green-700">
                      <CheckCircle2 className="h-4 w-4" /> Alert sent (+{delayMin}m).
                    </div>
                  ) : (
                    <button onClick={sendDelay} disabled={delaySending}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60">
                      <Send className="h-4 w-4" /> {delaySending ? 'Sending…' : 'Send Delay Alert'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {/* Solo doctors only — in a hospital the front desk registers walk-ins. */}
          {doctor?.is_self_registered && (
            <button
              type="button"
              onClick={() => setAddingWalkIn(true)}
              disabled={!doctorId}
              className="flex items-center gap-2 rounded-xl border border-brand-blue bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" /> Add Walk-in
            </button>
          )}
          <button type="button" onClick={refreshAll} disabled={refreshing || !doctorId} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <motion.div variants={container} initial="hidden" animate="show" className="spotlight-grid grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard value={total} label="Today's Appointments" sub="Total" icon={CalendarDays} tone="blue"
          footer={<button onClick={() => navigate('/doctor-dashboard/appointments')} className="mt-1.5 text-[12px] font-semibold text-brand-blue transition-colors duration-300 hover:underline group-hover:text-white">View details</button>} />
        <KpiCard value={completedToday} label="Completed" sub={pct(completedToday, total)} icon={CheckCircle2} tone="green" />
        <KpiCard value={inQueue} label="In Queue" sub={pct(inQueue, total)} icon={Hourglass} tone="orange" />
        <KpiCard value={remaining} label="Remaining" sub={pct(remaining, total)} icon={Users} tone="purple" />
        <KpiCard isNum={false} value={stats?.avg_wait_mins != null ? `${stats.avg_wait_mins} mins` : '—'} label="Avg Consultation" sub="Today" icon={Clock} tone="teal" />
      </motion.div>

      {/* Live OP Queue + Today's Schedule + Current Vitals — one row */}
      {/* On xl the three cards share one fixed-height band; when stacked, each
          card caps its own height (below). Either way they scroll internally so
          the page never grows as the queue fills up. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr_1fr] xl:items-stretch xl:max-h-[460px]">
        {/* Live OP Queue — hero */}
        <motion.div {...rise} transition={{ delay: 0.1 }}>
          <div className="flex h-full max-h-[460px] flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-card xl:max-h-none">
          {/* Hero — brand teal→green gradient (same pair as the landing/login). */}
          <div className="relative overflow-hidden bg-teal-900 p-4">
            <motion.div
              aria-hidden
              animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-teal-400/20 blur-2xl"
            />
            <motion.div
              aria-hidden
              animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="pointer-events-none absolute -bottom-14 left-16 h-36 w-36 rounded-full bg-emerald-400/20 blur-2xl"
            />

            {/* Title row */}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[17px] font-bold text-white">Live OP Queue</h3>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 ring-1 ring-emerald-400/30">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" /></span>Live
                </span>
              </div>
              <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-white/80 ring-1 ring-white/10">{waiting.length} waiting</span>
            </div>

            <AnimatePresence mode="wait">
              {current ? (
                <motion.div key={current.token_id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
                  {/* Radar + Now serving + patient */}
                  <div className="relative mt-3 flex items-center gap-3.5">
                    {/* Pulsing radar rings */}
                    <div aria-hidden className="relative hidden h-[84px] w-[84px] shrink-0 items-center justify-center lg:flex">
                      {[84, 62, 42].map((size, i) => (
                        <motion.span
                          key={size}
                          className="absolute rounded-full border border-teal-300/25"
                          style={{ height: size, width: size }}
                          animate={{ scale: [1, 1.07, 1], opacity: [0.3, 0.65, 0.3] }}
                          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.45 }}
                        />
                      ))}
                      <span className="relative flex h-[36px] w-[36px] items-center justify-center rounded-full bg-teal-400 text-white shadow-[0_0_18px_rgba(45,212,191,0.55)]">
                        <Users className="h-4 w-4" />
                      </span>
                    </div>

                    {/* Now serving */}
                    <div className="flex flex-col items-center justify-center rounded-xl bg-white/[0.07] px-4 py-2 ring-1 ring-white/10 backdrop-blur">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/55">Now Serving</span>
                      <span className="text-[30px] font-extrabold leading-none tabular-nums text-white">
                        {String(current.token_number).padStart(2, '0')}
                      </span>
                    </div>

                    {/* Patient + live timer */}
                    <div className="min-w-0 flex-1 text-white">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[16px] font-bold">{nameOf(current)}</p>
                        {current.patient_id && (
                          <button
                            onClick={() => setHistPatient(resolvePatient(current.patient_id) || { patient_id: current.patient_id, name: nameOf(current) })}
                            title="Patient history"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="truncate text-[11.5px] text-white/55">
                        {patientMeta(current) || statusLabel(current.status)}
                        {bookedByOf(current) ? ` · booked by ${bookedByOf(current)}` : ''}
                      </p>
                      {current.reason && (
                        <p className="mt-0.5 truncate text-[12px] font-medium text-teal-200" title={current.reason}>
                          Here for: {current.reason}
                        </p>
                      )}
                      <p className="mt-1 flex items-center gap-1.5 text-[17px] font-bold tabular-nums text-emerald-300">
                        <Clock className="h-4 w-4" />{fmt(elapsed)}
                      </p>
                      <p className="text-[10.5px] text-white/50">Consultation in progress</p>
                      {current.latest_vitals && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {vitalChips(current.latest_vitals).map((c) => (
                            <span key={c} className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">{c}</span>
                          ))}
                          {current.latest_vitals.abnormal && (
                            <span className="rounded bg-red-500/40 px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ring-red-300/40">⚠ Check</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stat strip */}
                  <div className="relative mt-3 grid grid-cols-1 gap-2 border-t border-white/10 pt-2.5 sm:grid-cols-3">
                    <HeroStat icon={Clock} tone="text-amber-300" label="Started at" value={current.actual_start ? prettyTime(current.actual_start) : '—'} />
                    <HeroStat icon={Users} tone="text-teal-300" label="Patients Waiting" value={waiting.length} />
                    <HeroStat icon={Hourglass} tone="text-emerald-300" label="Est. avg. wait" value={stats?.avg_wait_mins != null ? `~ ${stats.avg_wait_mins} mins` : '—'} />
                  </div>

                  {/* Primary actions */}
                  <div className="relative mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => act(() => tokensApi.postpone(current.token_id))} disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50">
                      {/* Was `skip`, which only accepts a `waiting` token — so on
                          the patient being served it returned 409 every time.
                          The label follows the real behaviour: one patient goes
                          ahead, this one returns to the front of the queue. */}
                      <SkipForward className="h-3.5 w-3.5" /> Let one go ahead
                    </motion.button>
                    {/* From the old Live OP Queue page — the doctor is the one in
                        the room, so vitals get taken here when there's no desk. */}
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setVitalsFor(current)} disabled={busy || !current.patient_id}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50">
                      <Activity className="h-3.5 w-3.5" /> Record Vitals
                    </motion.button>
                    {/* Same three-state fee rule the queue rows use: unpaid with a
                        fee set → collect; paid → say so; no fee → say that. */}
                    {current.consultation_fee > 0 && !current.consultation_paid ? (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setCollectFor(current)} disabled={busy}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-[12px] font-bold text-white shadow-[0_5px_14px_-6px_rgba(245,158,11,0.9)] transition-colors hover:bg-amber-400 disabled:opacity-50">
                        Collect ₹{current.consultation_fee}
                      </motion.button>
                    ) : current.free_revisit ? (
                      <div className="flex items-center justify-center rounded-lg px-2 py-1.5"><FreeRevisitChip info={current.free_revisit} detail dark /></div>
                    ) : null}
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setRxFor(current)} disabled={busy || !current.patient_id}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-2 text-[12px] font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50">
                      <Pill className="h-3.5 w-3.5" /> Write Prescription
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={async () => {
                        const done = current
                        await act(() => tokensApi.complete(done.token_id))
                        // Keep the patient in reach so the Rx can still be written here.
                        if (done.patient_id) setJustDone(done)
                      }}
                      disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-teal-500 px-3 py-2 text-[12px] font-bold text-white shadow-[0_5px_14px_-6px_rgba(20,184,166,0.9)] transition-colors hover:bg-teal-400 disabled:opacity-50">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative mt-5 flex items-center gap-3 text-white">
                  <Radio className="h-9 w-9 text-white/40" />
                  <div>
                    <p className="text-[16px] font-bold">No active consultation</p>
                    <p className="text-[12px] text-white/60">{next ? 'Call the next patient to begin.' : 'Queue is clear.'}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Just-completed consultation — offer the Rx before moving on. */}
            <AnimatePresence>
              {justDone && !current && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="relative mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.08] px-3 py-2 text-white ring-1 ring-white/15"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  <span className="text-[12.5px]">
                    Consultation with <span className="font-bold">{nameOf(justDone)}</span> completed.
                  </span>
                  <button
                    onClick={() => setRxFor(justDone)}
                    className="ml-auto flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-teal-900 hover:bg-emerald-50"
                  >
                    <Pill className="h-3.5 w-3.5" /> Write Prescription
                  </button>
                  <button
                    onClick={() => setJustDone(null)}
                    aria-label="Dismiss"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Next-patient strip — darker band under the hero */}
          <div className="flex flex-wrap items-center gap-2.5 bg-[#0f3f3b] px-4 py-2.5">
            {next ? (
              <>
                <Avatar name={nameOf(next)} tone="bg-teal-500/30" className="h-8 w-8 shrink-0 text-[11px]" />
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45">Next Patient</p>
                  <p className="truncate text-[13px] font-semibold text-white">
                    <span className="text-white/70">#{next.token_number}</span> {nameOf(next)}
                  </p>
                </div>
                <span className="text-[11.5px] text-white/55">
                  ETA: {next.estimated_time ? prettyTime(next.estimated_time) : '—'}
                </span>
              </>
            ) : (
              <p className="text-[12px] text-white/50">No one waiting in the queue.</p>
            )}
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => act(() => tokensApi.next(doctorId))} disabled={busy || !next}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[12px] font-bold text-teal-900 shadow-sm transition-colors hover:bg-emerald-50 disabled:opacity-40">
              <PhoneCall className="h-3.5 w-3.5" /> Call Next Patient
            </motion.button>
          </div>

          {/* Queue table */}
          <div className="flex-1 overflow-auto px-5 py-4">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[12px] font-semibold text-slate-400">
                  <th className="pb-3 pr-2">Token</th><th className="pb-3 pr-2">Patient</th><th className="pb-3 pr-2">Status</th><th className="pb-3 pr-2">Est.</th><th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[13.5px]">
                <AnimatePresence initial={false}>
                  {visibleQueue.map((r, i) => (
                    <motion.tr key={r.token_id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ delay: Math.min(0.08 + i * 0.04, 0.5) }} className={`border-t border-slate-50 ${r.status === 'current' ? 'bg-brand-blueLight/50' : 'hover:bg-slate-50/70'}`}>
                      <td className="py-2.5 pr-2"><span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[12px] font-extrabold ${r.status === 'current' ? 'bg-brand-blue text-white' : 'bg-slate-100 text-brand-navy'}`}>{r.token_number}</span></td>
                      <td className="py-2.5 pr-2 font-medium text-slate-600">
                        {/* Width-capped: a table cell grows to fit no-wrap content,
                            so a long start address or reason used to widen this
                            column and squash the Actions buttons into a pile.
                            Everything here shortens with … instead (full text on
                            hover). */}
                        <div className="min-w-0 max-w-[15rem] xl:max-w-[20rem]">
                          <span className="block truncate" title={nameOf(r)}>
                            {nameOf(r)}{bookedByOf(r) ? <span className="ml-1 text-[11px] font-semibold text-purple-600">· by {bookedByOf(r)}</span> : null}
                          </span>
                          {/* Travel recorded at booking: a patient still hours away
                              explains a token that hasn't shown up yet. */}
                          <TravelChip minutes={r.travel_minutes} origin={r.origin_label} className="mt-0.5 max-w-full overflow-hidden" />
                          {/* Why they came, as typed at booking (or by the desk for
                              a walk-in). Read from the appointment, carried onto
                              the queue row by the API. */}
                          {r.reason && <span className="mt-0.5 block truncate text-[11.5px] font-normal text-slate-400" title={r.reason}>{r.reason}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 pr-2"><StatusBadge status={statusLabel(r.status)} /></td>
                      <td className="py-2.5 pr-2 text-[13px] text-slate-500">{r.estimated_time ? prettyTime(r.estimated_time) : '—'}</td>
                      {/* Row actions, verbatim from the old Live OP Queue table. */}
                      <td className="py-2.5">
                        {r.status === 'current' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[12px] font-semibold text-green-600">Active</span>
                            {r.patient_id && (
                              <button onClick={() => setVitalsFor(r)} title="Record vitals" className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50">
                                <Activity className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                            {r.patient_id && (
                              <button onClick={() => setVitalsFor(r)} title="Record vitals" className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50">
                                <Activity className="h-4 w-4" />
                              </button>
                            )}
                            {/* Three states, not two: a doctor with no fee set must
                                not see every patient marked "Paid". */}
                            {r.consultation_fee > 0 && !r.consultation_paid ? (
                              <button onClick={() => setCollectFor(r)} disabled={busy} className="rounded-lg bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-amber-600 disabled:opacity-60">Collect ₹{r.consultation_fee}</button>
                            ) : r.free_revisit ? (
                              <FreeRevisitChip info={r.free_revisit} />
                            ) : r.consultation_paid ? (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Paid{r.consultation_payment_method ? ` · ${paymentModeLabel(r.consultation_payment_method)}` : ''}</span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500" title="No consultation fee is set for this doctor">No fee</span>
                            )}
                            <button onClick={() => act(() => tokensApi.recall(r.token_id))} disabled={busy} title="Call this token back" className="flex items-center gap-1 text-[12px] font-semibold text-brand-blue hover:underline disabled:opacity-60"><RotateCcw className="h-3.5 w-3.5" /> Recall</button>
                            <button onClick={() => act(() => tokensApi.missed(r.token_id))} disabled={busy} title="Mark as no-show" className="flex items-center gap-1 text-[12px] font-semibold text-red-500 hover:underline disabled:opacity-60"><UserX className="h-3.5 w-3.5" /> No-show</button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            {!current && waiting.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Queue is empty.</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              {hiddenQueue > 0 ? (
                <button
                  onClick={() => setQueueExpanded(true)}
                  className="flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] font-semibold text-brand-navy transition-colors hover:bg-slate-100"
                >
                  See {hiddenQueue} more <ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : queueExpanded && queueRows.length > PREVIEW_ROWS ? (
                <button
                  onClick={() => setQueueExpanded(false)}
                  className="flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] font-semibold text-brand-navy transition-colors hover:bg-slate-100"
                >
                  Show less <ChevronUp className="h-3.5 w-3.5" />
                </button>
              ) : <span />}
              {/* The whole queue lives here now — the old "View Full Queue" link
                  pointed at the Live OP Queue page, which this screen replaced. */}
              <span className="shrink-0 text-[12px] font-semibold text-slate-400">
                {queueRows.length} in queue
              </span>
            </div>
          </div>
        </div>
        </motion.div>

        {/* Today's Schedule */}
        <motion.div {...rise} transition={{ delay: 0.15 }}>
          <Card className="flex h-full max-h-[460px] flex-col !p-0 xl:max-h-none">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-[16px] font-bold text-brand-navy">Today's Schedule</h3>
              <button onClick={() => navigate('/doctor-dashboard/today')} className="text-[12px] font-semibold text-brand-blue hover:underline">View Full</button>
            </div>
            <ul className="flex-1 divide-y divide-slate-50 overflow-auto px-5">
              {appts.length === 0 && <li className="py-6 text-center text-sm text-slate-400">Nothing scheduled today.</li>}
              {visibleAppts.map((a, i) => (
                <motion.li key={a.appointment_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + i * 0.03 }} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold tabular-nums text-slate-500">{a.slot_time ? prettyTime(a.slot_time) : '—'}</span>
                    <span className="text-[14px] font-medium text-brand-navy">{a.family_member_name || a.patient_name || resolvePatient(a.patient_id)?.name || `Patient #${a.patient_id}`}</span>
                    <FreeRevisitChip info={a.free_revisit} />
                  </div>
                  <StatusBadge status={statusLabel(a.status)} />
                </motion.li>
              ))}
              {(hiddenAppts > 0 || apptsExpanded) && appts.length > PREVIEW_ROWS && (
                <li className="py-2.5">
                  <button
                    onClick={() => setApptsExpanded((v) => !v)}
                    className="flex w-full items-center justify-center gap-1 rounded-lg bg-slate-50 py-1.5 text-[12px] font-semibold text-brand-navy transition-colors hover:bg-slate-100"
                  >
                    {hiddenAppts > 0
                      ? <>See {hiddenAppts} more <ChevronDown className="h-3.5 w-3.5" /></>
                      : <>Show less <ChevronUp className="h-3.5 w-3.5" /></>}
                  </button>
                </li>
              )}
            </ul>
          </Card>
        </motion.div>

        {/* Current patient vitals — recorded at check-in — plus what's already
            known about them. Readings alone can mislead without the conditions
            behind them. */}
        {/* Sizes to its CONTENT. It used to be `h-full` with a `flex-1` card,
            which stretched three chips down the full 460px band and left a tall
            empty white box. The column still scrolls internally if a patient has
            a long list, so the row height never changes. */}
        <motion.div {...rise} transition={{ delay: 0.2 }} className="flex flex-col gap-3 xl:max-h-[460px] xl:overflow-y-auto">
          <VitalsSummaryCard compact vitals={curVitals} patientName={current ? nameOf(current) : null} />
          {current && <KnownHistoryNote history={curHistory} allergies={curAllergies} />}
        </motion.div>
      </div>

      <AnimatePresence>
        {histPatient && <PatientHistoryDrawer patient={histPatient} onClose={() => setHistPatient(null)} />}
      </AnimatePresence>

      {collectFor && (
        <CollectPaymentModal
          amount={collectFor.consultation_fee}
          patientName={seenName(collectFor, '')}
          tokenCode={collectFor.display_code}
          onConfirm={async (method) => { await appointmentsApi.collectPayment(collectFor.appointment_id, method); await loadQueue() }}
          onClose={() => setCollectFor(null)}
        />
      )}

      {rxFor && (
        <RxComposer
          patientId={rxFor.patient_id}
          doctorId={doctorId}
          appointmentId={rxFor.appointment_id}
          patientName={nameOf(rxFor)}
          defaultFamilyMemberId={rxFor.family_member_id}
          onSaved={() => setJustDone(null)}
          onClose={() => setRxFor(null)}
        />
      )}

      {/* Both folded in from the old Live OP Queue page, unchanged. */}
      {vitalsFor && (
        <VitalsModal
          patient={{ patient_id: vitalsFor.patient_id, name: nameOf(vitalsFor), uhid: vitalsFor.patient_uhid }}
          appointmentId={vitalsFor.appointment_id}
          defaultFamilyMemberId={vitalsFor.family_member_id}
          onClose={() => setVitalsFor(null)}
          onSaved={loadQueue}
        />
      )}
      {doctor?.is_self_registered && addingWalkIn && (
        <WalkInModal
          doctorId={doctorId}
          onClose={() => setAddingWalkIn(false)}
          onCreated={async (result) => {
            await loadAll()
            await dialog.alert({
              title: 'Walk-in added',
              message: `Token ${result?.token?.display_code || ''} has been issued successfully.`,
              tone: 'success',
            })
          }}
        />
      )}
    </div>
  )
}

export default Dashboard
