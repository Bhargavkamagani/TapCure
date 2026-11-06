import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { Search } from 'lucide-react'
import LoadError from '../../components/common/LoadError.jsx'
import { Card, StatusBadge, PageHeading, Avatar } from '../../components/hospital/ui.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { appointmentsApi, tokensApi } from '../../api'
import { clockIST, prettyDate, prettyTime, statusLabel, todayISO } from '../../lib/format.js'

const FILTERS = ['All', 'Upcoming', 'Scheduled', 'Completed', 'Cancelled', 'No Show']
const UPCOMING_STATUSES = new Set(['scheduled', 'booked', 'confirmed', 'pending'])
const typeLabel = (t) =>
  t === 'walkin' ? 'Walk-in' : t === 'emergency' ? 'Emergency' : 'Regular'

const TYPE_TONE = {
  walkin: 'bg-orange-100 text-orange-600',
  emergency: 'bg-red-100 text-red-600',
}
const typeTone = (t) => TYPE_TONE[t] || 'bg-slate-100 text-slate-600'

/**
 * One row per visit, combining what was BOOKED with what actually HAPPENED.
 *
 * The appointment carries the promise (date, slot, type); the queue token
 * carries the outcome (token number, when they were really called in, how long
 * they waited). They used to live on two near-identical screens.
 *
 * Emergency tokens are minted straight into the queue with no appointment row
 * at all (see tokens.create_emergency), so they can only ever join by token —
 * without them folded in here, an emergency case appears on no list the doctor
 * has.
 */
function mergeVisits(appts, tokens) {
  const byAppt = new Map()
  const orphans = []
  for (const t of tokens) {
    if (t.appointment_id) byAppt.set(t.appointment_id, t)
    else orphans.push(t)
  }

  const fromAppts = appts.map((a) => ({
    key: `a-${a.appointment_id}`,
    patient_id: a.patient_id,
    // The row already knows who it is for. Relying on the console's patient
    // cache instead meant anyone outside it showed as "Patient #4012".
    patient_name: a.family_member_name || a.patient_name || '',
    date: a.appointment_date,
    slot_time: a.slot_time,
    practice_name: a.practice_name,
    type: a.appointment_type,
    status: a.status,
    token: byAppt.get(a.appointment_id) || null,
  }))

  const fromTokens = orphans.map((t) => ({
    key: `t-${t.token_id}`,
    patient_id: t.patient_id,
    patient_name: t.family_member_name || t.patient_name || '',
    date: t.token_date,
    slot_time: null,
    practice_name: '',
    // Priority is the only thing that marks these apart; they are always
    // walk-in-shaped (nobody books an emergency in advance).
    type: t.priority === 'emergency' ? 'emergency' : 'walkin',
    status: t.status,
    token: t,
  }))

  return [...fromAppts, ...fromTokens].sort((x, y) => {
    if (x.date !== y.date) return (y.date || '').localeCompare(x.date || '')
    const xn = x.token?.token_number ?? 9999
    const yn = y.token?.token_number ?? 9999
    if (xn !== yn) return xn - yn
    return (x.slot_time || '').localeCompare(y.slot_time || '')
  })
}

function AllAppointments() {
  const { doctorId, resolvePatient, loading: ctxLoading } = useDoctorCtx()
  const [appts, setAppts] = useState([])
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')
  const [date, setDate] = useState(todayISO())   // default to today's appointments

  // Sequence guard: with a background refresh in play, a slow earlier response
  // must never land on top of a newer one.
  const reqRef = useRef(0)
  const load = useCallback(({ silent = false } = {}) => {
    if (!doctorId) return
    const seq = ++reqRef.current
    if (!silent) setLoading(true)
    setLoadError(null)
    // Tokens are fetched for the same window the list is showing: one day, or
    // (All dates) the recent run across every day.
    const tokenReq = date
      ? tokensApi.history(doctorId, date)
      : tokensApi.history(doctorId, undefined, { all_dates: true })
    Promise.all([
      appointmentsApi.list({ doctor_id: doctorId, size: 200 }),
      tokenReq,
    ])
      .then(([a, t]) => {
        if (seq !== reqRef.current) return
        setAppts(a || [])
        setTokens(t || [])
      })
      .catch((e) => {
        if (seq !== reqRef.current) return
        if (!silent) { setAppts([]); setTokens([]) }
        setLoadError(e.message || 'Could not load.')
      })
      .finally(() => { if (!silent && seq === reqRef.current) setLoading(false) })
  }, [doctorId, date])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load({ silent: true }), { enabled: !!doctorId })

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return mergeVisits(appts, tokens).filter((r) => {
      const name = r.patient_name || resolvePatient(r.patient_id)?.name || ''
      const matchFilter = filter === 'All'
        || (filter === 'Upcoming' && UPCOMING_STATUSES.has(String(r.status).toLowerCase()) && (r.date || '').slice(0, 10) >= todayISO())
        || statusLabel(r.status) === filter
      const matchSearch = !term || name.toLowerCase().includes(term)
      const matchDate = !date || (r.date || '').slice(0, 10) === date
      return matchFilter && matchSearch && matchDate
    })
  }, [appts, tokens, filter, q, date, resolvePatient])

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Appointments" subtitle="Booked slot and what actually happened — token, time seen, wait.">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search className="h-4 w-4 text-slate-400" />
      <LoadError message={loadError} what="the appointment list" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient…"
            className="w-44 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" />
        </div>
      </PageHeading>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {FILTERS.map((f) => (
              <button key={f} onClick={() => { setFilter(f); if (f === 'Upcoming') setDate('') }}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${filter === f ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f}
              </button>
            ))}
          </div>
          {/* Date filter — defaults to today */}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <button onClick={() => setDate(todayISO())}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${date === todayISO() ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
              Today
            </button>
            <button onClick={() => setDate('')}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${!date ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
              All dates
            </button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-brand-navy outline-none focus:border-brand-blue" />
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[12px] font-semibold text-slate-400">
              <th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Token</th><th className="pb-3 pr-4">Slot</th>
              <th className="pb-3 pr-4">Patient</th><th className="pb-3 pr-4">Practice</th><th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Seen</th><th className="pb-3 pr-4">Waited</th><th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="text-[13.5px]">
            {rows.map((r) => {
              const name = r.patient_name
                || resolvePatient(r.patient_id)?.name
                || (r.patient_id ? `Patient #${r.patient_id}` : 'Walk-in')
              return (
                <tr key={r.key} className="border-t border-slate-50">
                  <td className="py-3 pr-4 font-semibold text-slate-500">{prettyDate(r.date)}</td>
                  <td className="py-3 pr-4 font-bold tabular-nums text-brand-navy">
                    {r.token ? r.token.token_number : <span className="font-normal text-slate-300">—</span>}
                  </td>
                  <td className="py-3 pr-4 tabular-nums text-slate-500">{r.slot_time ? prettyTime(r.slot_time) : '—'}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={name} className="h-8 w-8 text-xs" />
                      <span className="font-medium text-brand-navy">{name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {r.practice_name && (
                      <span className="text-[12px] text-slate-400">{r.practice_name}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${typeTone(r.type)}`}>
                      {typeLabel(r.type)}
                    </span>
                  </td>
                  {/* actual_start is naive UTC — render it as hospital-local, or a
                      2 PM consult reads as 8:30 AM. */}
                  <td className="py-3 pr-4 tabular-nums text-slate-500">
                    {r.token?.actual_start ? clockIST(r.token.actual_start) : '—'}
                  </td>
                  <td className="py-3 pr-4 text-slate-500">
                    {r.token?.wait_duration_mins != null ? `${r.token.wait_duration_mins} mins` : '—'}
                  </td>
                  <td className="py-3"><StatusBadge status={statusLabel(r.status)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        {loading || ctxLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {date ? `No appointments on ${prettyDate(date)}.` : 'No appointments found.'}
          </p>
        ) : null}
      </Card>
    </div>
  )
}

export default AllAppointments
