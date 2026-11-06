import { useEffect, useMemo, useState } from 'react'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { CalendarDays, RefreshCw, Search, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Card, StatusBadge, StatCard, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import { appointmentsApi } from '../../api'
import { seenName, bookedBy } from '../../lib/patientDisplay.js'
import { shortId } from '../../lib/shortId.js'

// Map backend appointment.status → the human label shown in the badge / filters.
const STATUS_LABEL = {
  scheduled: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}
// Filter chip → backend statuses it selects.
const FILTERS = {
  All: null,
  Confirmed: ['confirmed', 'in_progress'],
  Pending: ['scheduled'],
  Completed: ['completed'],
  Cancelled: ['cancelled', 'no_show'],
}
const STAT_ICONS = [CalendarDays, CheckCircle2, Clock, XCircle]

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const prettyDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function Appointments() {
  const [date, setDate] = useState(today())
  const [filter, setFilter] = useState('All')
  const [q, setQ] = useState('')
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = async (on = date, { silent = false } = {}) => {
    if (!silent) setLoading(true)
    setErr(null)
    try {
      setAppts(await appointmentsApi.list({ date: on, size: 200 }))
    } catch (e) {
      setErr(e.message || 'Could not load appointments')
    }
    if (!silent) setLoading(false)
  }
  useEffect(() => {
    load(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Bookings arrive from the app and the front desk all day; the admin's list
  // shouldn't need a reload to show them.
  useAutoRefresh(() => load(date, { silent: true }))

  const stats = useMemo(() => {
    const count = (sts) => appts.filter((a) => sts.includes(a.status)).length
    return [
      { value: appts.length, label: 'Total', tone: 'blue' },
      { value: count(['confirmed', 'in_progress']), label: 'Confirmed', tone: 'green' },
      { value: count(['scheduled']), label: 'Pending', tone: 'orange' },
      { value: count(['cancelled', 'no_show']), label: 'Cancelled', tone: 'red' },
    ]
  }, [appts])

  const rows = useMemo(() => {
    const allowed = FILTERS[filter]
    const needle = q.trim().toLowerCase()
    return appts.filter(
      (a) =>
        (!allowed || allowed.includes(a.status)) &&
        (!needle || `${a.patient_name || ''} ${a.family_member_name || ''}`.toLowerCase().includes(needle))
    )
  }, [appts, filter, q])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Appointments" subtitle="Manage and track all hospital appointments.">
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-transparent py-2 text-sm font-semibold text-brand-navy outline-none"
          />
        </label>
        <ToolButton icon={RefreshCw} onClick={() => load()}>Refresh</ToolButton>
      </PageHeading>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s, i) => <StatCard key={s.label} {...s} icon={STAT_ICONS[i]} />)}
      </div>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {Object.keys(FILTERS).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  filter === f ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search patient…"
              className="w-44 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-white">
              <tr className="whitespace-nowrap text-[12px] font-semibold text-slate-400">
                <th className="pb-2 pr-4">Appt ID</th>
                <th className="pb-2 pr-4">Patient</th>
                <th className="pb-2 pr-4">Doctor</th>
                <th className="pb-2 pr-4">Specialty</th>
                <th className="pb-2 pr-4">Time</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {!loading && rows.map((a) => (
                <tr key={a.appointment_id} className="border-t border-slate-50 hover:bg-slate-50/60">
                  <td className="whitespace-nowrap py-2.5 pr-4 font-semibold text-brand-navy">#{shortId(a.appointment_id)}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={seenName(a)} className="h-8 w-8 text-[11px]" />
                      <div className="leading-tight">
                        <p className="font-semibold text-brand-navy">{seenName(a)}</p>
                        {bookedBy(a) && <p className="text-[11px] text-slate-400">booked by {bookedBy(a)}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-slate-600">{a.doctor_name || '—'}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500">{a.doctor_specialty || '—'}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500">{a.slot_time || '—'}</td>
                  <td className="whitespace-nowrap py-2.5 pr-4 capitalize text-slate-500">{a.appointment_type}</td>
                  <td className="py-2.5"><StatusBadge status={STATUS_LABEL[a.status] || a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">No appointments for {prettyDate(date)}.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

export default Appointments
