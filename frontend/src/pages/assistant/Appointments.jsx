import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Ticket, CalendarDays, Clock, CheckCircle2, Hourglass } from 'lucide-react'
import { Card, PageHeading, ToolButton, StatusBadge, Avatar, StatCard } from '../../components/hospital/ui.jsx'
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx'
import { doctorsApi, appointmentsApi, tokensApi } from '../../api'
import FreeRevisitChip from '../../components/common/FreeRevisitChip.jsx'
import { seenName, bookedBy } from '../../lib/patientDisplay.js'
import useAutoRefresh, { REFRESH_MS } from '../../hooks/useAutoRefresh.js'
import { shortId } from '../../lib/shortId.js'

const STATUS_LABEL = {
  scheduled: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

// Still to be dealt with at the desk. A consultation that's finished, cancelled
// or a no-show is closed — it shouldn't sit in a list the desk works down.
const OPEN_STATUSES = ['scheduled', 'confirmed', 'in_progress']

// How far ahead the desk's list looks. The page used to load ONLY today, so a
// visit booked for next week existed in the system but appeared nowhere at the
// front desk — even under a tab called "Upcoming".
const HORIZON_DAYS = 30
const isoDay = (d) => d.toISOString().slice(0, 10)
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const VIEWS = [
  { key: 'today', label: 'Today', match: (a) => a.appointment_date === isoDay(new Date()) },
  { key: 'upcoming', label: 'Upcoming', match: (a) => OPEN_STATUSES.includes(a.status) },
  { key: 'completed', label: 'Completed', match: (a) => a.status === 'completed' },
  { key: 'all', label: 'All', match: () => true },
]

function dayLabel(iso) {
  if (!iso) return '—'
  const today = isoDay(new Date())
  if (iso === today) return 'Today'
  if (iso === isoDay(addDays(new Date(), 1))) return 'Tomorrow'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function AssistantAppointments() {
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)
  // Opens on Today — that's the desk's working list. Upcoming is one tab away.
  const [view, setView] = useState('today')

  useEffect(() => {
    doctorsApi.list({ bookable: true }).then((d) => {
      setDoctors(d)
      if (d.length) setDoctorId(String(d[0].doctor_id))
    })
  }, [])

  // `silent` is the background poll: swap the rows underneath the desk without
  // blanking a list they're reading. Only the first load, a doctor change and
  // an explicit Refresh show the spinner.
  const load = async (id = doctorId, { silent = false } = {}) => {
    if (!id) return
    if (!silent) setLoading(true)
    setErr(null)
    try {
      // Today → +30 days in one call. The stat cards still count today only;
      // they're derived from this same set, so the tiles and the table can't
      // disagree the way two separate fetches would let them.
      const today = new Date()
      setRows(await appointmentsApi.list({
        doctor_id: id,
        date_from: isoDay(today),
        date_to: isoDay(addDays(today, HORIZON_DAYS)),
        size: 200,
      }))
      setUpdatedAt(new Date())
    } catch (e) {
      setErr(e.message)
    }
    if (!silent) setLoading(false)
  }
  useEffect(() => {
    if (doctorId) load(doctorId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId])

  // Patients book from the app while the desk is looking at this list, and a
  // booking that isn't on screen is one the desk will swear doesn't exist.
  // Paused while a token is being generated: that click acts on a specific row,
  // so the list must not reorder underneath it.
  useAutoRefresh(() => load(doctorId, { silent: true }), {
    enabled: !!doctorId,
    paused: busy != null,
  })

  const genToken = async (appt) => {
    setBusy(appt.appointment_id)
    setErr(null)
    try {
      await tokensApi.generate(appt.appointment_id)
      await load()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(null)
  }

  const doc = doctors.find((d) => String(d.doctor_id) === String(doctorId))
  // Stat cards are about TODAY — that's the day the desk is working. The table
  // follows the selected view, which can reach across the whole window.
  const today = isoDay(new Date())
  const todays = rows.filter((a) => a.appointment_date === today)
  const total = todays.length
  const pending = todays.filter((a) => ['scheduled', 'confirmed'].includes(a.status)).length
  const done = todays.filter((a) => a.status === 'completed').length
  const visible = rows.filter(VIEWS.find((v) => v.key === view).match)

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Appointments" subtitle={`Today and the next ${HORIZON_DAYS} days — check in patients and generate their queue tokens.`}>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          {doc && <Avatar name={doc.name} className="h-6 w-6 text-[9px]" />}
          <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="bg-transparent py-2 text-sm font-semibold text-brand-navy outline-none">
            {doctors.map((d) => (
              <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>
            ))}
          </select>
        </div>
        {/* Says the list is keeping itself current — without it a desk that
            knows a patient just booked assumes the page is broken. */}
        {updatedAt && (
          <span
            className="hidden items-center gap-1.5 text-[11.5px] font-semibold text-slate-400 sm:flex"
            title={`Updates automatically every ${REFRESH_MS / 1000} seconds`}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
            Live · updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <ToolButton icon={RefreshCw} onClick={() => load()}>Refresh</ToolButton>
      </PageHeading>

      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -4 }}>
          <StatCard value={<AnimatedNumber value={total} />} label="Today's Appointments" icon={CalendarDays} tone="blue" />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -4 }}>
          <StatCard value={<AnimatedNumber value={pending} />} label="To Check In" icon={Hourglass} tone="orange" />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -4 }}>
          <StatCard value={<AnimatedNumber value={done} />} label="Completed" icon={CheckCircle2} tone="green" />
        </motion.div>
      </motion.div>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      <Card className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-brand-navy">Appointments — {doc?.name || '—'}</h3>
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {VIEWS.map((v) => {
              const n = rows.filter(v.match).length
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                    view === v.key ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {v.label} <span className={view === v.key ? 'text-brand-blue' : 'text-slate-400'}>{n}</span>
                </button>
              )
            })}
          </div>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            {rows.length === 0
              ? `No appointments for this doctor in the next ${HORIZON_DAYS} days.`
              : view === 'today'
                ? 'Nothing booked for today — check the Upcoming tab.'
                : view === 'upcoming'
                  ? 'Nothing left to check in — every booked visit is done.'
                  : 'Nothing in this view.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5">When</th>
                <th className="px-3 py-2.5">Patient</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              <AnimatePresence initial={false}>
                {visible.map((a, i) => (
                  <motion.tr
                    key={a.appointment_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.4) }}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                  >
                    {/* The day matters now that the list spans a month — a bare
                        "10:30" told the desk nothing about which day it was. */}
                    <td className="whitespace-nowrap px-5 py-2.5">
                      <span className={`block text-[12px] font-bold ${a.appointment_date === today ? 'text-brand-blue' : 'text-slate-500'}`}>
                        {dayLabel(a.appointment_date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-300" /> {a.slot_time || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={seenName(a)} className="h-8 w-8 text-[10px]" />
                        <div className="leading-tight">
                          <p className="font-bold text-brand-navy">{seenName(a)}</p>
                          <p className="text-[11px] text-slate-400">
                            #{shortId(a.appointment_id)}{bookedBy(a) ? ` · booked by ${bookedBy(a)}` : ''}
                          </p>
                          {a.free_revisit && <div className="mt-1"><FreeRevisitChip info={a.free_revisit} /></div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 capitalize text-slate-500">{a.appointment_type}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={STATUS_LABEL[a.status] || a.status} /></td>
                    <td className="px-5 py-2.5 text-right">
                      {a.status === 'scheduled' ? (
                        <motion.button
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => genToken(a)} disabled={busy === a.appointment_id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60"
                        >
                          <Ticket className="h-3.5 w-3.5" /> {busy === a.appointment_id ? 'Issuing…' : 'Generate Token'}
                        </motion.button>
                      ) : ['confirmed', 'in_progress'].includes(a.status) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 text-[12px] font-semibold text-green-600">
                          <Ticket className="h-3.5 w-3.5" /> Token issued
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-300">—</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  )
}
