import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users, Ticket, Hourglass, CheckCircle2, Stethoscope, RefreshCw, ChevronRight,
  Radio, UserPlus, CalendarDays, ListChecks, Search, Clock, X, AlertTriangle, BellRing,
  CalendarOff, Coffee,
} from 'lucide-react'
import { Avatar } from '../../components/hospital/ui.jsx'
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx'
import { reportsApi, doctorsApi, tokensApi } from '../../api'
import useAutoRefresh, { REFRESH_MS } from '../../hooks/useAutoRefresh.js'

const DELAY_PRESETS = [10, 15, 30, 45]

function DelayModal({ doctor, onClose, onSaved }) {
  const [minutes, setMinutes] = useState(15)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async () => {
    const m = Number(minutes)
    if (!m || m <= 0) { setErr('Enter a delay in minutes'); return }
    setBusy(true); setErr(null)
    try {
      await doctorsApi.logDelay({ doctor_id: doctor.doctor_id, delay_minutes: m, reason: reason.trim() })
      onSaved?.()
      onClose()
    } catch (e) {
      setErr(e.message || 'Could not update delay')
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                <Clock className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-slate-800">Doctor Running Late</h3>
                <p className="text-[13px] text-slate-500">
                  {doctor.name}{doctor.delay > 0 ? ` · currently +${doctor.delay} min` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-slate-400">Delay (minutes)</label>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {DELAY_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setMinutes(p)}
                className={`rounded-xl py-2.5 text-[13px] font-bold transition-all ${Number(minutes) === p ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`}>
                +{p}
              </button>
            ))}
          </div>
          <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} onWheel={(e) => e.currentTarget.blur()}
            className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
            placeholder="Custom minutes" />

          <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wider text-slate-400">Reason (optional)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Emergency case, stuck in traffic"
            className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100" />

          <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-700">
            <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            Waiting patients will be notified of the revised ETA.
          </div>

          {err && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
            </div>
          )}

          <div className="flex gap-2.5">
            <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
              Cancel
            </button>
            <button onClick={submit} disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 transition">
              <Clock className="h-4 w-4" /> {busy ? 'Saving…' : 'Update Delay'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
}

const QUICK_ACTIONS = [
  { label: 'New Walk-in', to: '/assistant-dashboard/walk-in', icon: UserPlus, hover: 'hover:from-teal-500 hover:to-teal-600', tone: 'bg-teal-50 text-teal-600' },
  { label: 'Live Queue', to: '/assistant-dashboard/queue', icon: ListChecks, hover: 'hover:from-emerald-500 hover:to-emerald-600', tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Appointments', to: '/assistant-dashboard/appointments', icon: CalendarDays, hover: 'hover:from-cyan-500 hover:to-cyan-600', tone: 'bg-cyan-50 text-cyan-600' },
  { label: 'Find Patient', to: '/assistant-dashboard/patients', icon: Search, hover: 'hover:from-sky-500 hover:to-sky-600', tone: 'bg-sky-50 text-sky-600' },
]

// A doctor who isn't rostered today is not "on time" — they're not here. Each
// off state gets its own wording and colour so the desk can answer the patient
// in front of it without opening another screen.
const DUTY_TONE = {
  leave: 'bg-rose-50 text-rose-600',
  holiday: 'bg-violet-50 text-violet-600',
  not_scheduled: 'bg-slate-100 text-slate-500',
  unavailable: 'bg-slate-100 text-slate-500',
  on_break: 'bg-sky-50 text-sky-600',
}
const dutyTone = (state) => DUTY_TONE[state] || 'bg-slate-100 text-slate-500'

// The status chip is a fixed-width pill sized for "On time". The API's full
// wording — "Not consulting today", "Not available today" — wrapped to three
// cramped lines inside it. Short text in the chip; the full reason (plus the
// "No Mon session" detail) stays on hover and in the row subtitle.
const DUTY_SHORT = {
  leave: 'On leave',
  holiday: 'Holiday',
  not_scheduled: 'Off today',
  unavailable: 'Unavailable',
  suspended: 'Suspended',
  inactive: 'Inactive',
  on_break: 'On break',
}
const dutyShort = (duty) => DUTY_SHORT[duty?.state] || duty?.label || 'Off today'
const dutyTitle = (duty) => [duty?.label, duty?.detail].filter(Boolean).join(' — ') || undefined

const STAT_META = [
  { key: 'total_patients', label: 'Total Patients', icon: Users, bg: 'bg-blue-500', light: 'bg-blue-50' },
  { key: 'tokens_today', label: 'In Queue Today', icon: Ticket, bg: 'bg-teal-500', light: 'bg-teal-50' },
  { key: 'waiting_now', label: 'Waiting Now', icon: Hourglass, bg: 'bg-orange-500', light: 'bg-orange-50' },
  { key: 'completed_today', label: 'Consulted', icon: CheckCircle2, bg: 'bg-green-500', light: 'bg-green-50' },
  { key: 'doctors_active', label: 'Doctors on Duty', icon: Stethoscope, bg: 'bg-violet-500', light: 'bg-violet-50' },
]

export default function AssistantDashboard() {
  const [kpis, setKpis] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [delayFor, setDelayFor] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  // `silent` is the background poll: refresh the numbers underneath the desk
  // without blanking the panels they're reading. Only the first load (and an
  // explicit Refresh) shows the spinner.
  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setErr(null)
    try {
      // `duty-today` = the roster with each doctor's state for TODAY. A doctor
      // on leave, on holiday, or with no session on this weekday comes back
      // marked rather than filtered out, so the desk sees "On leave" instead of
      // a doctor who quietly vanished from the board.
      const [dash, docs] = await Promise.all([
        reportsApi.dashboard(),
        doctorsApi.dutyToday(),
      ])
      setKpis(dash.kpis)
      const snaps = await Promise.all(
        docs.map(async (d) => {
          // No queue for a doctor who isn't consulting today — don't ask, and
          // don't let the failed lookup read as "unknown".
          if (!d.duty?.on_duty) return { ...d, now: null, waiting: null, delay: 0, stale: false }
          try {
            const ld = await tokensApi.liveDisplay(d.doctor_id)
            return { ...d, now: ld.now_serving, waiting: ld.total_waiting, delay: ld.delay_min || 0, stale: false }
          } catch {
            // A failed queue lookup used to render as "No wait · On time" —
            // identical to a doctor with an empty queue. On a live board that's
            // the desk telling a patient nobody's waiting when we simply don't
            // know. Mark it unknown and show it as such.
            return { ...d, now: null, waiting: null, delay: 0, stale: true }
          }
        })
      )
      // On-duty doctors first — the board is read top-down during OP hours.
      snaps.sort((a, b) => (b.duty?.on_duty ? 1 : 0) - (a.duty?.on_duty ? 1 : 0))
      setRows(snaps)
      setLastUpdated(new Date())
    } catch (e) {
      setErr(e.message)
    }
    if (!silent) setLoading(false)
  }

  useEffect(() => { load() }, [])
  // Paused while the Delay modal is open — the doctor being edited could change
  // rows mid-edit.
  useAutoRefresh(() => load({ silent: true }), { paused: !!delayFor })

  const onDuty = rows.filter((d) => d.duty?.on_duty)
  const lateCount = onDuty.filter((d) => d.delay > 0).length
  const onTimeCount = onDuty.length - lateCount
  const offCount = rows.length - onDuty.length

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden bg-slate-50">

      {err && (
        <div className="shrink-0 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      {/* ── KPI stat cards ── */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="shrink-0 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {STAT_META.map((s) => (
          <motion.div key={s.key} variants={fadeUp} whileHover={{ y: -2, transition: { duration: 0.15 } }}>
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div>
                <p className="text-[13px] font-semibold text-slate-400">{s.label}</p>
                <p className="mt-1.5 text-[26px] font-extrabold leading-none text-slate-800">
                  <AnimatedNumber value={kpis?.[s.key] ?? 0} />
                </p>
              </div>
              <span className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} text-white shadow-sm`}>
                <s.icon className="h-5 w-5" />
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="shrink-0">
        <div className="mb-2 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-slate-400" />
          <h2 className="text-[13px] font-bold text-slate-600 uppercase tracking-wide">Quick Actions</h2>
        </div>
        <div className="quick-actions-grid grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.label} to={a.to}
              className={`quick-action-card group relative flex flex-col items-center gap-2.5 rounded-2xl bg-white ${a.hover} py-4 shadow-sm ring-1 ring-slate-100 hover:bg-gradient-to-br hover:ring-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200`}>
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${a.tone} shadow-sm transition-colors duration-300 group-hover:bg-white/20 group-hover:text-white`}>
                <a.icon className="h-6 w-6" />
              </span>
              <span className="text-[13.5px] font-semibold text-slate-600 transition-colors duration-300 group-hover:text-white">{a.label}</span>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── Bottom row: Live Queue (left) + Doctors on Duty (right) ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-5">

      {/* ── Live Queue by Doctor — fills remaining space, scrolls internally ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200"
      >
        {/* Panel header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-teal-500" />
            <h2 className="text-[14px] font-bold text-slate-700">Live Queue — by Doctor</h2>
          </div>
          <div className="flex items-center gap-1">
            {/* Without this the board looks frozen: it was already refreshing
                itself, but nothing on screen said so, so the desk kept hitting
                Refresh to be sure. */}
            {lastUpdated && (
              <span
                className="mr-1 hidden items-center gap-1.5 text-[13px] font-semibold text-slate-400 sm:flex"
                title={`Updates automatically every ${REFRESH_MS / 1000} seconds`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500" />
                </span>
                Live · {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
            <button onClick={() => load()} title="Refresh"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-teal-600">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <Link to="/assistant-dashboard/queue"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-teal-600 transition hover:bg-teal-50">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Column labels */}
        {!loading && rows.length > 0 && (
          <div className="shrink-0 hidden grid-cols-[1fr_7rem_5rem_4.5rem_auto] border-b border-slate-50 bg-slate-50 px-5 py-2 text-[12px] font-bold uppercase tracking-widest text-slate-400 sm:grid">
            <span>Doctor</span>
            <span className="text-center">Status</span>
            <span className="text-center">Serving</span>
            <span className="text-center">Waiting</span>
            <span />
          </div>
        )}

        {/* Scrollable rows */}
        {loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-teal-500 border-t-transparent" />
            <p className="text-sm text-slate-400">Loading doctors…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <Stethoscope className="h-8 w-8 text-slate-200" />
            <p className="text-sm text-slate-400">No doctors found.</p>
          </div>
        ) : (
          <ul className="no-scrollbar flex-1 divide-y divide-slate-50 overflow-y-auto">
            {rows.map((d, i) => (
              <motion.li
                key={d.doctor_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.22 + i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 transition hover:bg-slate-50 ${
                  !d.duty?.on_duty ? 'bg-slate-50/60' : d.delay > 0 ? 'bg-amber-50/50' : ''
                }`}
              >
                {/* Doctor */}
                <div className="flex min-w-[160px] flex-1 items-center gap-2.5">
                  <Avatar name={d.name || 'Doctor'} className={`h-8 w-8 shrink-0 text-[13px] ${d.duty?.on_duty ? '' : 'opacity-50'}`} />
                  <div className="min-w-0">
                    <p className={`truncate text-[13px] font-bold ${d.duty?.on_duty ? 'text-slate-800' : 'text-slate-500'}`}>{d.name}</p>
                    <p className="truncate text-[13px] text-slate-400">
                      {d.specialization}
                      {d.duty?.hours ? ` · ${d.duty.hours}` : ''}
                      {!d.duty?.on_duty && d.duty?.detail ? ` · ${d.duty.detail}` : ''}
                    </p>
                  </div>
                </div>

                {/* Status — "not here today" outranks any queue reading */}
                {!d.duty?.on_duty ? (
                  <span className={`inline-flex w-[6.5rem] items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[13px] font-bold ${dutyTone(d.duty?.state)}`}
                        title={dutyTitle(d.duty)}>
                    <CalendarOff className="h-2.5 w-2.5 shrink-0" /> {dutyShort(d.duty)}
                  </span>
                ) : d.delay > 0 ? (
                  <span className="inline-flex w-[6.5rem] items-center justify-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[13px] font-bold text-amber-700">
                    <Clock className="h-2.5 w-2.5" /> +{d.delay} min late
                  </span>
                ) : d.duty?.state === 'on_break' ? (
                  <span className="inline-flex w-[6.5rem] items-center justify-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[13px] font-semibold text-sky-600"
                        title={d.duty?.detail || undefined}>
                    <Coffee className="h-2.5 w-2.5" /> On break
                  </span>
                ) : (
                  <span className="inline-flex w-[6.5rem] items-center justify-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[13px] font-semibold text-teal-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> On time
                  </span>
                )}

                {/* Serving */}
                <div className="w-20 text-center">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Serving</p>
                  {d.now ? (
                    <span className="inline-flex items-center gap-1 text-[13px] font-bold text-teal-600">
                      <Radio className="h-2.5 w-2.5 animate-pulse" /> {d.now}
                    </span>
                  ) : (
                    <span className="text-[13px] text-slate-300">—</span>
                  )}
                </div>

                {/* Waiting — null when the queue lookup failed, so the desk
                    doesn't read a hard "0" it can't rely on. */}
                <div className="w-14 text-center">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Waiting</p>
                  <span className={`text-[13px] font-extrabold ${d.waiting > 0 ? 'text-orange-500' : 'text-slate-300'}`}
                        title={d.stale ? 'Queue could not be loaded' : undefined}>
                    {d.waiting == null ? '—' : d.waiting}
                  </span>
                </div>

                {/* Actions — "running late" is meaningless for a doctor who
                    isn't consulting today, so it's hidden rather than disabled. */}
                <div className="flex items-center gap-1.5">
                  {d.duty?.on_duty && (
                    <button
                      onClick={() => setDelayFor(d)}
                      title="Doctor running late"
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold transition ${
                        d.delay > 0
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'
                      }`}
                    >
                      <Clock className="h-3 w-3" /> {d.delay > 0 ? 'Update' : 'Late'}
                    </button>
                  )}
                  <Link
                    to={`/assistant-dashboard/queue?doctor=${d.doctor_id}`}
                    className="flex items-center gap-1 rounded-lg bg-teal-500 px-2.5 py-1 text-[13px] font-semibold text-white shadow-sm transition hover:bg-teal-600"
                  >
                    Manage <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* ── Doctors on Duty (read-only roster, same data as the queue) ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex min-h-0 max-h-[42vh] flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200 lg:max-h-none lg:w-80 lg:shrink-0"
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-500" />
            {/* "Today", not "on Duty" — the panel now also lists who is off. */}
            <h2 className="text-[14px] font-bold text-slate-700">Doctors Today</h2>
          </div>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[13px] font-bold text-teal-600">
            {onDuty.length}{offCount > 0 ? `/${rows.length}` : ''}
          </span>
        </div>

        {/* On-time / late / off-today summary */}
        {!loading && rows.length > 0 && (
          <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-50 bg-slate-50 px-5 py-2 text-[13px] font-semibold">
            <span className="flex items-center gap-1.5 text-teal-600">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> {onTimeCount} on time
            </span>
            <span className="flex items-center gap-1.5 text-amber-600">
              <Clock className="h-3 w-3" /> {lateCount} running late
            </span>
            {offCount > 0 && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <CalendarOff className="h-3 w-3" /> {offCount} off today
              </span>
            )}
          </div>
        )}

        {/* Roster */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-teal-500 border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
            <Stethoscope className="h-7 w-7 text-slate-200" />
            <p className="text-sm text-slate-400">No doctors on the roster today.</p>
          </div>
        ) : (
          <ul className="no-scrollbar flex-1 divide-y divide-slate-50 overflow-y-auto">
            {rows.map((d) => (
              <li key={d.doctor_id} className="flex items-center gap-2.5 px-4 py-2.5">
                <Avatar name={d.name || 'Doctor'} className="h-8 w-8 shrink-0 text-[13px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-slate-800">{d.name}</p>
                  <p className="truncate text-[13px] text-slate-400">{d.specialization}</p>
                </div>
                <div className="shrink-0 text-right">
                  {!d.duty?.on_duty ? (
                    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[13px] font-bold ${dutyTone(d.duty?.state)}`}
                          title={dutyTitle(d.duty)}>
                      <CalendarOff className="h-2.5 w-2.5 shrink-0" /> {dutyShort(d.duty)}
                    </span>
                  ) : d.stale ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[13px] font-semibold text-slate-500">
                      <AlertTriangle className="h-2.5 w-2.5" /> Unavailable
                    </span>
                  ) : d.duty?.state === 'on_break' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[13px] font-semibold text-sky-600">
                      <Coffee className="h-2.5 w-2.5" /> On break
                    </span>
                  ) : d.delay > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[13px] font-bold text-amber-700">
                      <Clock className="h-2.5 w-2.5" /> +{d.delay}m
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-1.5 py-0.5 text-[13px] font-semibold text-teal-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> On time
                    </span>
                  )}
                  <p className="mt-0.5 text-[13px] text-slate-400">
                    {!d.duty?.on_duty
                      ? (d.duty?.detail || 'no queue today')
                      : d.stale ? 'queue not loaded' : d.waiting > 0 ? `${d.waiting} waiting` : 'No wait'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
      </div>

      {delayFor && (
        <DelayModal doctor={delayFor} onClose={() => setDelayFor(null)} onSaved={() => load({ silent: true })} />
      )}
    </div>
  )
}
