import { useEffect, useMemo, useState } from 'react'
import CollectedByMode, { byModeFromAppointments } from '../../components/common/CollectedByMode.jsx'
import LoadError from '../../components/common/LoadError.jsx'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { appointmentsApi, reportsApi, tokensApi } from '../../api'
import { CalendarDays } from 'lucide-react'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n) => String(n).padStart(2, '0')

/** The last 12 months, newest first — same choice the hospital Reports page offers. */
function recentPeriods(count = 12) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { month: d.getMonth() + 1, year: d.getFullYear() }
  })
}

/** First and last day of a month as YYYY-MM-DD. */
function monthRange({ month, year }) {
  const last = new Date(year, month, 0).getDate()
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}` }
}

/** Every appointment in the range, page by page (the API caps a page at 200). */
async function allAppointments(params) {
  const out = []
  for (let page = 1; page <= 25; page += 1) {
    const rows = (await appointmentsApi.list({ ...params, page, size: 200 })) || []
    out.push(...rows)
    if (rows.length < 200) break
  }
  return out
}

function hourLabel(h) {
  if (h == null) return '—'
  h = parseInt(h, 10)   // the API sends "09:00"
  if (Number.isNaN(h)) return '—'
  const to12 = (x) => `${((x + 11) % 12) + 1} ${x < 12 ? 'AM' : 'PM'}`
  return `${to12(h)}–${to12((h + 1) % 24)}`
}

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-44 items-end gap-3 pt-2">
      {data.map((d) => (
        <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[13px] font-semibold text-slate-400">{d.value}</span>
          <div className="w-full rounded-t-md bg-gradient-to-t from-brand-blue/50 to-brand-blue" style={{ height: `${(d.value / max) * 100}%` }} />
          <span className="text-[13px] text-slate-400">{d.day}</span>
        </div>
      ))}
    </div>
  )
}

function Reports() {
  const { doctorId } = useDoctorCtx()
  const [appts, setAppts] = useState([])
  const [peak, setPeak] = useState(null)
  const [tokenStats, setTokenStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  // Month shown — the same picker the hospital admin's Reports page has.
  const periods = useMemo(() => recentPeriods(), [])
  const [period, setPeriod] = useState(periods[0])
  const periodLabel = `${MONTHS[period.month]} ${period.year}`

  useEffect(() => {
    if (!doctorId) return
    let active = true
    setLoading(true)
    setLoadError(null)
    const { start, end } = monthRange(period)
    Promise.all([
      allAppointments({ doctor_id: doctorId, date_from: start, date_to: end }),
      reportsApi.peakHours({ doctor_id: doctorId, start, end }),
      tokensApi.stats(doctorId),
    ])
      .then(([list, peakHours, stats]) => {
        if (!active) return
        setAppts(list || [])
        setPeak(peakHours)
        setTokenStats(stats)
      })
      .catch((e) => { if (active) { setAppts([]); setLoadError(e.message || "Could not load.") } })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [doctorId, period])

  const { kpis, insights, weekData, typeSplit } = useMemo(() => {
    const completed = appts.filter((a) => a.status === 'completed')
    // Money ACTUALLY collected for this doctor: consultation fees that were paid
    // (collected at the hospital) + the booking fees paid online at booking time.
    const consultRevenue = appts.reduce(
      (n, a) => n + (a.consultation_paid ? Number(a.consultation_fee || 0) : 0), 0)
    const bookingRevenue = appts.reduce((n, a) => n + Number(a.booking_fee_paid || 0), 0)
    const revenue = consultRevenue + bookingRevenue
    const patients = new Set(appts.map((a) => a.patient_id)).size
    const noShows = appts.filter((a) => a.status === 'no_show').length
    const cancelled = appts.filter((a) => a.status === 'cancelled').length

    // Visits per weekday (last 7 days window from appointment_date).
    const counts = Object.fromEntries(WEEK.map((d) => [d, 0]))
    appts.forEach((a) => {
      const dt = new Date(a.appointment_date)
      if (!Number.isNaN(dt.getTime())) {
        const wd = WEEK[(dt.getDay() + 6) % 7] // JS Sun=0 -> shift so Mon=0
        counts[wd] += 1
      }
    })

    // Type split — how the visit reached the doctor: booked in the app, or
    // raised at the desk. Emergency was dropped as a category: it describes a
    // token's PRIORITY, not how the visit was booked, so it never belonged
    // alongside these two. Emergency visits are raised at the desk, so they
    // count as walk-ins here rather than silently inflating "Online".
    const types = { Online: 0, 'Walk-in': 0 }
    appts.forEach((a) => {
      if (a.appointment_type === 'walkin' || a.appointment_type === 'emergency') types['Walk-in'] += 1
      else types.Online += 1
    })
    const total = appts.length || 1
    const busiestDay = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]
    const split = [
      { label: 'Online', value: Math.round((types.Online / total) * 100), tone: 'bg-brand-blue' },
      { label: 'Walk-in', value: Math.round((types['Walk-in'] / total) * 100), tone: 'bg-brand-green' },
    ]

    return {
      kpis: [
        { label: 'Total Patients', value: patients, tone: 'text-brand-blue' },
        { label: 'Consultations', value: completed.length, tone: 'text-green-600' },
        { label: 'Collected', value: `₹${revenue.toLocaleString('en-IN')}`, tone: 'text-teal-600',
          sub: `Consult ₹${consultRevenue.toLocaleString('en-IN')} · Booking ₹${bookingRevenue.toLocaleString('en-IN')}` },
        { label: 'No-shows', value: noShows, tone: 'text-orange-500' },
      ],
      insights: [
        { label: 'Total Appointments', value: appts.length },
        { label: 'Completion Rate', value: appts.length ? `${Math.round((completed.length / appts.length) * 100)}%` : '0%' },
        { label: 'No-Show Rate', value: appts.length ? `${Math.round((noShows / appts.length) * 100)}%` : '0%' },
        { label: 'Cancellation Rate', value: appts.length ? `${Math.round((cancelled / appts.length) * 100)}%` : '0%' },
        { label: 'Peak Hour', value: hourLabel(peak?.busiest?.hour) },
        { label: 'Average Wait (today)', value: tokenStats?.avg_wait_mins != null ? `${tokenStats.avg_wait_mins} min` : '—' },
        { label: 'Busiest Day', value: busiestDay && busiestDay[1] ? busiestDay[0] : '—' },
      ],
      weekData: WEEK.map((d) => ({ day: d, value: counts[d] })),
      typeSplit: split,
    }
  }, [appts, peak, tokenStats])

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Reports & Analytics" subtitle="Your operational summary, revenue and practice insights in one place.">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
          <select
            value={`${period.year}-${period.month}`}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number)
              setPeriod({ month, year })
            }}
            className="bg-transparent py-2 text-sm font-semibold text-brand-navy outline-none"
          >
            {periods.map((p) => (
              <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                {MONTHS[p.month]} {p.year}
              </option>
            ))}
          </select>
        </div>
      </PageHeading>
      <LoadError message={loadError} what="these figures" />

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {kpis.map((k) => (
              <Card key={k.label}>
                <p className="text-[13.5px] font-medium text-slate-500">{k.label}</p>
                <span className={`mt-1.5 block text-[26px] font-extrabold leading-none ${k.tone}`}>{k.value}</span>
                {k.sub && <p className="mt-1.5 text-[13px] font-medium text-slate-400">{k.sub}</p>}
              </Card>
            ))}
          </div>

          <CollectedByMode rows={byModeFromAppointments(appts)} subtitle={`Consultation fees collected in ${periodLabel}. Payments before 26 Oct 2026 were all recorded as Cash.`} />

          <div>
            <h2 className="mb-3 text-[16px] font-bold text-brand-navy">Practice insights</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
              {insights.map((metric) => (
                <Card key={metric.label} className="text-center">
                  <p className="text-[21px] font-extrabold text-brand-navy">{metric.value}</p>
                  <p className="mt-1 text-[13px] text-slate-500">{metric.label}</p>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card>
              <h3 className="mb-1 text-[15px] font-bold text-brand-navy">Visits by Weekday — {periodLabel}</h3>
              <BarChart data={weekData} />
            </Card>
            <Card>
              <h3 className="mb-3 text-[15px] font-bold text-brand-navy">Appointment Types</h3>
              <div className="space-y-3">
                {typeSplit.map((t) => (
                  <div key={t.label}>
                    <div className="mb-1 flex items-center justify-between text-[13px]"><span className="font-semibold text-brand-navy">{t.label}</span><span className="text-slate-500">{t.value}%</span></div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${t.tone}`} style={{ width: `${t.value}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default Reports
