import { useEffect, useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { appointmentsApi, reportsApi, tokensApi } from '../../api'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function LineChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${28 - (d.value / max) * 24}`).join(' ')
  return (
    <svg viewBox="0 0 100 28" className="h-40 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => <circle key={i} cx={(i / (data.length - 1)) * 100} cy={28 - (d.value / max) * 24} r="0.9" fill="#2563eb" />)}
    </svg>
  )
}

function hourLabel(h) {
  if (h == null) return '—'
  const to12 = (x) => `${((x + 11) % 12) + 1} ${x < 12 ? 'AM' : 'PM'}`
  return `${to12(h)}–${to12((h + 1) % 24)}`
}

function Analytics() {
  const { doctorId } = useDoctorCtx()
  const [appts, setAppts] = useState([])
  const [peak, setPeak] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!doctorId) return
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([
      appointmentsApi.list({ doctor_id: doctorId, size: 200 }),
      // Was hospital-wide: the page presents this as YOUR peak hour, but without
      // doctor_id it returned the busiest hour across every doctor here.
      reportsApi.peakHours({ doctor_id: doctorId }),
      tokensApi.stats(doctorId),
    ]).then(([a, p, s]) => {
      if (!active) return
      setAppts(a || [])
      setPeak(p)
      setStats(s)
      setLoading(false)
    }).catch((e) => {
      if (!active) return
      // Silently swallowing these rendered zeros and dashes that looked like a
      // quiet practice rather than a failed load.
      setError(e.message || 'Could not load your analytics.')
      setLoading(false)
    })
    return () => { active = false }
  }, [doctorId])

  const { metrics, trend } = useMemo(() => {
    const total = appts.length
    const completed = appts.filter((a) => a.status === 'completed').length
    const noShows = appts.filter((a) => a.status === 'no_show').length
    const counts = Object.fromEntries(WEEK.map((d) => [d, 0]))
    appts.forEach((a) => {
      const dt = new Date(a.appointment_date)
      if (!Number.isNaN(dt.getTime())) counts[WEEK[(dt.getDay() + 6) % 7]] += 1
    })
    const busiestDay = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]
    return {
      metrics: [
        { label: 'Total Appointments', value: total },
        { label: 'Completed', value: completed },
        { label: 'No-Show Rate', value: total ? `${Math.round((noShows / total) * 100)}%` : '0%' },
        { label: 'Peak Hour', value: hourLabel(peak?.busiest?.hour) },
        { label: 'Avg Wait', value: stats?.avg_wait_mins != null ? `${stats.avg_wait_mins} min` : '—' },
        { label: 'Busiest Day', value: busiestDay && busiestDay[1] ? busiestDay[0] : '—' },
      ],
      trend: WEEK.map((d) => ({ day: d, value: counts[d] })),
    }
  }, [appts, peak, stats])

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Analytics" subtitle="Deeper insights into your practice patterns." />
      {error && (
        <Card className="border-red-100 bg-red-50 text-sm font-semibold text-red-600">
          {error} <span className="font-normal text-red-500">— the figures below are not zero, they are unavailable.</span>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {metrics.map((m) => (
              <Card key={m.label} className="text-center">
                <p className="text-[22px] font-extrabold text-brand-navy">{m.value}</p>
                <p className="mt-1 text-[12px] text-slate-500">{m.label}</p>
              </Card>
            ))}
          </div>

          <Card>
            <h3 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-brand-navy"><Activity className="h-5 w-5 text-brand-blue" /> Patient Visits Trend</h3>
            <p className="mb-2 text-[12.5px] text-slate-400">Visits by weekday</p>
            <LineChart data={trend} />
            <div className="mt-1 flex justify-between text-[11px] text-slate-400">
              {trend.map((d) => <span key={d.day}>{d.day}</span>)}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export default Analytics
