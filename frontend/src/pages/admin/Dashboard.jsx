import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2, Stethoscope, Ticket, RefreshCw, ArrowRight,
  ClipboardCheck, CheckCircle2, AlertCircle,
  // IndianRupee, Users: used only by the booking-fee KPI/footnote (commented out below)
} from 'lucide-react'
import { hospitalsApi, doctorsApi, reportsApi } from '../../api'

/**
 * Super-Admin landing screen: platform-wide health at a glance plus the two
 * queues only a super admin can clear (hospital approvals, doctor verifications).
 *
 * Everything is composed from endpoints that already exist — no new backend:
 *   GET /hospitals            all tenants (super admin sees every row)
 *   GET /hospitals/pending    hospitals awaiting approval
 *   GET /doctors/pending      self-registered doctors awaiting verification
 *   GET /reports/super-admin  per-hospital tokens/revenue + platform totals
 */

// Used only by the booking-fee KPI/column (commented out below).
// const inr = (n) =>
//   `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function Kpi({ icon: Icon, label, value, sub, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-100 text-brand-blue',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    teal: 'bg-teal-100 text-teal-600',
    purple: 'bg-purple-100 text-purple-600',
  }
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="mt-2 text-[26px] font-extrabold leading-none tabular-nums text-brand-navy">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-slate-400">{sub}</p>}
    </div>
  )
}

/** A queue card — shows the count and routes to the screen that clears it. */
function QueueCard({ icon: Icon, title, count, blurb, cta, to, tone }) {
  const navigate = useNavigate()
  const empty = count === 0
  return (
    <button
      onClick={() => navigate(to)}
      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
        empty
          ? 'border-slate-100 bg-white hover:border-slate-200'
          : `${tone.border} ${tone.bg} hover:brightness-[0.98]`
      }`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${empty ? 'bg-slate-100 text-slate-400' : tone.chip}`}>
        {empty ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-brand-navy">
          {title}
          {!empty && (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11.5px] font-extrabold ${tone.badge}`}>{count}</span>
          )}
        </p>
        <p className="mt-0.5 text-[12.5px] text-slate-500">{empty ? 'Nothing waiting — all clear.' : blurb}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand-blue">
        {empty ? 'Open' : cta} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

const STATUS_PILL = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  suspended: 'bg-red-100 text-red-600',
}

export default function AdminDashboard() {
  const [hospitals, setHospitals] = useState([])
  const [pendingHospitals, setPendingHospitals] = useState([])
  const [pendingDoctors, setPendingDoctors] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    // Each call is independently guarded: one failing endpoint shouldn't blank
    // the whole dashboard.
    const [h, pc, pd, rep] = await Promise.all([
      hospitalsApi.list().catch(() => []),
      hospitalsApi.pending().catch(() => []),
      doctorsApi.pending().catch(() => []),
      reportsApi.superAdmin().catch(() => null),
    ])
    setHospitals(h || [])
    setPendingHospitals(pc || [])
    setPendingDoctors(pd || [])
    setReport(rep)
    if (!h?.length && !rep) setErr('Could not load platform data. Check that you are signed in as a Super Admin.')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Join the month's per-hospital figures onto the tenant list so the table can
  // show status and activity together.
  const rows = useMemo(() => {
    const byId = new Map((report?.hospitals || []).map((r) => [r.hospital_id, r]))
    return hospitals
      .map((h) => ({
        ...h,
        ...(byId.get(h.hospital_id) || { total_tokens: 0, completed: 0, platform_revenue: 0, hospital_revenue: 0 }),
      }))
      .sort((a, b) => (b.total_tokens || 0) - (a.total_tokens || 0))
  }, [hospitals, report])

  const activeHospitals = hospitals.filter((h) => h.status === 'active').length
  const totals = report?.platform_totals || { tokens: 0, platform_revenue: 0 }
  const monthLabel = report
    ? new Date(report.year, report.month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'this month'

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <div>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Platform Overview</h1>
            <p className="mt-1 text-sm text-slate-500">
              Every hospital on TapCure, and anything waiting on you. Figures cover {monthLabel}.
            </p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:border-slate-300 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {err && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <Kpi icon={Building2} label="Hospitals" value={hospitals.length}
               sub={`${activeHospitals} active · ${pendingHospitals.length} pending`} tone="blue" />
          <Kpi icon={ClipboardCheck} label="Hospital approvals" value={pendingHospitals.length}
               sub={pendingHospitals.length ? 'Awaiting your review' : 'All clear'} tone="amber" />
          <Kpi icon={Stethoscope} label="Doctor verifications" value={pendingDoctors.length}
               sub={pendingDoctors.length ? 'Credentials to check' : 'All clear'} tone="purple" />
          <Kpi icon={Ticket} label="Tokens" value={Number(totals.tokens || 0).toLocaleString('en-IN')}
               sub={monthLabel} tone="teal" />
          {/* Patient booking fee removed (doctor subscription planned). Previous KPI:
          <Kpi icon={IndianRupee} label="Our revenue" value={inr(totals.platform_revenue)}
               sub={`Booking fees · ${monthLabel}`} tone="green" /> */}
        </div>

        {/* Action queues */}
        <h2 className="mb-3 mt-8 text-[13px] font-bold uppercase tracking-wide text-slate-500">Needs your attention</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <QueueCard
            icon={Building2} title="Hospital approvals" count={pendingHospitals.length}
            blurb="Hospitals that registered and cannot log in until approved."
            cta="Review" to="/admin/approvals"
            tone={{ border: 'border-amber-200', bg: 'bg-amber-50', chip: 'bg-amber-100 text-amber-600', badge: 'bg-amber-200 text-amber-800' }}
          />
          <QueueCard
            icon={Stethoscope} title="Doctor verifications" count={pendingDoctors.length}
            blurb="Self-registered doctors whose documents need checking."
            cta="Verify" to="/admin/doctor-verifications"
            tone={{ border: 'border-purple-200', bg: 'bg-purple-50', chip: 'bg-purple-100 text-purple-600', badge: 'bg-purple-200 text-purple-800' }}
          />
        </div>

        {/* Per-hospital table */}
        <h2 className="mb-3 mt-8 text-[13px] font-bold uppercase tracking-wide text-slate-500">Hospitals</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11.5px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Hospital</th>
                  <th className="px-4 py-3 font-semibold">City</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Tokens</th>
                  <th className="px-4 py-3 text-right font-semibold">Completed</th>
                  {/* Previous column: <th className="px-4 py-3 text-right font-semibold">Booking fees</th> */}
                </tr>
              </thead>
              <tbody className="text-[13.5px]">
                {loading && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No hospitals yet.</td></tr>
                )}
                {!loading && rows.map((h) => (
                  <tr key={h.hospital_id} className="border-t border-slate-50 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-navy">{h.name}</p>
                      <p className="text-[11.5px] text-slate-400">{h.short_code}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{h.city || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold capitalize ${STATUS_PILL[h.status] || 'bg-slate-100 text-slate-600'}`}>
                        {h.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{h.total_tokens || 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{h.completed || 0}</td>
                    {/* Previous cell: <td className="px-4 py-3 text-right font-semibold tabular-nums text-brand-navy">{inr(h.platform_revenue)}</td> */}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Previous footnote:
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-400">
          <Users className="h-3.5 w-3.5" />
          Booking fees are TapCure&apos;s earnings for {monthLabel}. Consultation fees belong to the hospital — see a hospital&apos;s own page for those.
        </p> */}
      </div>
    </div>
  )
}
