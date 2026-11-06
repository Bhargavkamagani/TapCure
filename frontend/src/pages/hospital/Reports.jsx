import { useEffect, useMemo, useState } from 'react'
import CollectedByMode from '../../components/common/CollectedByMode.jsx'
import { CalendarDays, Star } from 'lucide-react'
import { Card, PageHeading, Avatar } from '../../components/hospital/ui.jsx'
import { reportsApi, fileUrl } from '../../api'

const KPI_TONE = {
  blue: 'text-brand-blue', teal: 'text-teal-600', orange: 'text-orange-500', green: 'text-green-600',
}
// Stable palette for the department donut.
const DEPT_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#f59e0b', '#ec4899', '#06b6d4', '#64748b']
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

function KpiCard({ value, label, tone, sub }) {
  return (
    <Card>
      <p className="text-[12px] font-medium text-slate-500">{label}</p>
      <span className={`mt-1 block text-[26px] font-extrabold leading-none ${KPI_TONE[tone]}`}>{value}</span>
      {sub && <p className="mt-1.5 text-[11px] font-medium text-slate-400">{sub}</p>}
    </Card>
  )
}

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex h-full items-end gap-3 pt-2">
      {data.map((d) => (
        <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500">{d.value}</span>
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-brand-blue/60 to-brand-blue"
            style={{ height: `${(d.value / max) * 100}%` }}
          />
          <span className="text-[11px] text-slate-400">{d.day}</span>
        </div>
      ))}
    </div>
  )
}

function Donut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = 42
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        {total === 0 ? (
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="16" />
        ) : data.map((d) => {
          const len = (d.value / total) * c
          const el = (
            <circle key={d.label} cx="60" cy="60" r={r} fill="none" stroke={d.color} strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-brand-navy">{total ? '100%' : '—'}</span>
        <span className="text-[10px] text-slate-400">visits</span>
      </div>
    </div>
  )
}

/** The last 12 months, newest first — the range a hospital actually looks back over. */
function recentPeriods(count = 12) {
  const now = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { month: d.getMonth() + 1, year: d.getFullYear() }
  })
}

function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // The backend has always accepted month/year; the header chip just never sent
  // them, so a hospital could only ever see the current month.
  const periods = useMemo(() => recentPeriods(), [])
  const [period, setPeriod] = useState(periods[0])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    reportsApi
      .hospitalOverview({ month: period.month, year: period.year })
      .then((d) => active && setData(d))
      .catch((e) => {
        if (!active) return
        // Previously swallowed: a failed request rendered as a page of zeros,
        // indistinguishable from a genuinely quiet month.
        setData(null)
        setError(e.message || 'Could not load the report.')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [period])

  const { kpis, weekData, deptSplit, topDoctors, periodLabel, totalVisits } = useMemo(() => {
    const k = data?.kpis || {}
    const week = (data?.visits_week || []).map((d) => ({ day: d.day, value: d.value }))
    const split = (data?.dept_split || []).map((d, i) => ({ ...d, color: DEPT_COLORS[i % DEPT_COLORS.length] }))
    return {
      kpis: [
        { label: 'Total Patients', value: k.total_patients ?? 0, tone: 'blue' },
        { label: 'Consultations', value: k.consultations ?? 0, tone: 'green' },
        // Previous sub-label: `Consultation fees · excludes ${inr(k.booking_revenue)} platform booking fee`
        { label: 'Collected', value: inr(k.consultation_revenue), tone: 'teal', sub: 'Consultation fees' },
        { label: 'No-shows', value: k.no_shows ?? 0, tone: 'orange' },
      ],
      weekData: week,
      deptSplit: split,
      topDoctors: data?.top_doctors || [],
      periodLabel: `${MONTHS[period.month]} ${period.year}`,
      totalVisits: week.reduce((s, d) => s + d.value, 0),
    }
  }, [data, period])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Reports & Analytics" subtitle="Performance insights for your hospital — all doctors.">
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

      {error && (
        <Card className="border-red-100 bg-red-50">
          <p className="text-sm font-semibold text-red-600">{error}</p>
          <p className="mt-1 text-[12.5px] text-red-500">
            These figures could not be loaded — this is not a zero-activity month.
          </p>
          <button
            type="button"
            onClick={() => setPeriod((p) => ({ ...p }))}
            className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-red-600 hover:bg-red-50"
          >
            Try again
          </button>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : !data ? (
        !error && <p className="text-sm text-slate-400">No report data for {periodLabel}.</p>
      ) : (
        <>
          <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
          </div>

          {data.collected_by_mode && (
            <CollectedByMode rows={data.collected_by_mode} subtitle={`Consultation fees collected in ${periodLabel}. Payments before 26 Oct 2026 were all recorded as Cash.`} />
          )}

          <div className="grid flex-1 shrink-0 grid-cols-1 xl:min-h-[320px] gap-4 xl:grid-cols-[1.7fr_1fr]">
            {/* Bar chart */}
            <Card className="flex min-h-[260px] flex-col">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-brand-navy">Visits — {periodLabel}</h3>
                <span className="text-[12px] font-semibold text-slate-400">Total {totalVisits.toLocaleString('en-IN')}</span>
              </div>
              <div className="min-h-0 flex-1">
                <BarChart data={weekData} />
              </div>
            </Card>

            {/* Donut */}
            <Card className="flex flex-col">
              <h3 className="mb-3 text-[15px] font-bold text-brand-navy">Visits by Department</h3>
              {deptSplit.length === 0 ? (
                <p className="flex flex-1 items-center justify-center text-[13px] text-slate-400">No visits yet.</p>
              ) : (
                <div className="flex flex-1 items-center gap-4">
                  <Donut data={deptSplit} />
                  <ul className="flex-1 space-y-2">
                    {deptSplit.map((d) => (
                      <li key={d.label} className="flex items-center gap-2 text-[12px]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="flex-1 text-slate-600">{d.label}</span>
                        <span className="font-bold text-brand-navy">{d.value}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          {/* Top doctors */}
          <Card className="shrink-0">
            <h3 className="mb-2 text-[15px] font-bold text-brand-navy">Top Doctors by Consultations</h3>
            {topDoctors.length === 0 ? (
              <p className="py-3 text-[13px] text-slate-400">No completed consultations this month.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[12px] font-semibold text-slate-400">
                      <th className="pb-2 pr-4">#</th>
                      <th className="pb-2 pr-4">Doctor</th>
                      <th className="pb-2 pr-4">Specialty</th>
                      <th className="pb-2 pr-4">Consultations</th>
                      <th className="pb-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {topDoctors.map((d, i) => (
                      <tr key={d.doctor_id} className="border-t border-slate-50">
                        <td className="py-2 pr-4 font-bold text-slate-400">{i + 1}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2.5">
                            {d.photo ? (
                              <img src={fileUrl(d.photo)} alt={d.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                            ) : (
                              <Avatar name={d.name} className="h-8 w-8 text-[11px]" />
                            )}
                            <span className="font-semibold text-brand-navy">{d.name}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-slate-500">{d.specialty || '—'}</td>
                        <td className="py-2 pr-4 font-semibold text-brand-navy">{d.consults}</td>
                        <td className="py-2">
                          {d.rating != null ? (
                            <span className="flex items-center gap-1 font-semibold text-amber-500">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {d.rating}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default Reports
