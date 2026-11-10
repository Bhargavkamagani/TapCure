import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import {
  CalendarDays, UserPlus, Stethoscope, ChevronRight,
  Users, CheckCircle2, IndianRupee, UserX, Wallet, Footprints, Banknote, Smartphone, CreditCard,
} from 'lucide-react'
import { Card, StatCard, PageHeading, Avatar } from '../../components/hospital/ui.jsx'
import { doctorsApi, tokensApi, appointmentsApi, reportsApi } from '../../api'
import { todayISO } from '../../lib/format.js'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

/** Big gradient highlight card for the metrics the admin cares about most. */
function HeroCard({ icon: Icon, label, value, sub, gradient, live }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/5" />
      <div className="relative flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <Icon className="h-6 w-6" />
        </span>
        {live && (
          <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Live
          </span>
        )}
      </div>
      <div className="relative mt-4 text-[36px] font-extrabold leading-none">{value}</div>
      <div className="relative mt-1.5 text-[14.5px] font-semibold text-white/90">{label}</div>
      {sub && <div className="relative mt-1 text-[13.5px] text-white/75">{sub}</div>}
    </div>
  )
}

/** Horizontal stacked proportion bar + legend (walk-in/online, collections, …).
 *  Segments should be mutually exclusive so the bar reads as a whole. */
function SplitBar({ title, icon: Icon, segments, note }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[14.5px] font-bold text-brand-navy">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        {title}
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((s) => (
          s.value > 0 ? <div key={s.label} className={s.color} style={{ width: `${(s.value / (total || 1)) * 100}%` }} /> : null
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[13px]">
            <span className={`h-2 w-2 rounded-full ${s.color}`} />
            <span className="text-slate-500">{s.label}</span>
            <span className="font-bold text-brand-navy">{s.value}</span>
          </span>
        ))}
      </div>
      {note && <p className="mt-2 text-[13px] text-slate-400">{note}</p>}
    </div>
  )
}

function Dashboard() {
  const [kpis, setKpis] = useState(null)
  const [byDoctor, setByDoctor] = useState([])
  const [queue, setQueue] = useState({ current: null, waiting: [] })
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)

  // `silent` is the background poll: refresh the board without dropping the
  // admin back into a loading state they didn't ask for.
  const load = async ({ silent = false } = {}) => {
    const today = todayISO()
    try {
      const [dash, docs, apptList] = await Promise.all([
        reportsApi.dashboard().catch(() => null),
        doctorsApi.list().catch(() => []),
        appointmentsApi.list({ date: today }).catch(() => []),
      ])
      setKpis(dash?.kpis || null)
      setByDoctor(dash?.by_doctor || [])
      setAppts(apptList || [])

      // Aggregate the live queue across every doctor in the hospital.
      const queues = await Promise.all(
        (docs || []).map((d) =>
          tokensApi.queue(d.doctor_id, today).then((q) => ({ q, doc: d })).catch(() => null),
        ),
      )
      let current = null
      const waiting = []
      queues.filter(Boolean).forEach(({ q, doc }) => {
        if (!current && q.current) current = { ...q.current, doctorName: doc.name }
        ;(q.waiting || []).forEach((t) => waiting.push({ ...t, doctorName: doc.name }))
      })
      waiting.sort((a, b) => (a.estimated_time || '').localeCompare(b.estimated_time || ''))
      setQueue({ current, waiting })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useAutoRefresh(() => load({ silent: true }))

  // Operational splits the admin watches — computed from today's appointments:
  // where patients came from (walk-in vs online) and how money was collected.
  const ops = useMemo(() => {
    const list = (appts || []).filter((a) => a.managed_by_hospital !== false)
    const isWalkin = (a) => a.source === 'walkin' || a.appointment_type === 'walkin'
    const live = (a) => !['cancelled', 'no_show'].includes(a.status)
    const hospitalPaid = list.filter((a) => a.consultation_paid)
    const onlinePaid = list.filter((a) => Number(a.booking_fee_paid) > 0)
    const methods = { cash: 0, upi: 0, card: 0, other: 0 }
    hospitalPaid.forEach((a) => {
      const m = (a.consultation_payment_method || 'other').toLowerCase()
      methods[m in methods ? m : 'other'] += 1
    })
    return {
      total: list.length,
      walkin: list.filter(isWalkin).length,
      online: list.filter((a) => !isWalkin(a)).length,
      hospitalPaid: hospitalPaid.length,
      onlinePaid: onlinePaid.length,
      pending: list.filter((a) => !a.consultation_paid && live(a)).length,
      hospitalAmt: hospitalPaid.reduce((s, a) => s + Number(a.consultation_fee || 0), 0),
      onlineAmt: onlinePaid.reduce((s, a) => s + Number(a.booking_fee_paid || 0), 0),
      methods,
    }
  }, [appts])

  // Secondary KPIs — the supporting numbers, shown smaller below the hero row.
  const STATS = [
    { value: kpis ? String(kpis.no_shows_today ?? 0) : '—', label: 'No-shows Today', icon: UserX, tone: 'teal' },
    { value: String(appts.length), label: "Today's Appointments", icon: CalendarDays, tone: 'green' },
    { value: kpis ? `${kpis.doctors_active ?? 0}/${kpis.doctors ?? 0}` : '—', label: 'Doctors Active', icon: Stethoscope, tone: 'teal' },
    { value: kpis ? String(kpis.total_patients ?? 0) : '—', label: 'Total Patients', icon: UserPlus, tone: 'green' },
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeading title="Dashboard" subtitle="Welcome back — here's what's happening at your hospital today.">
        {/* A label, not a control. This was a <ToolButton>, which renders a
            real <button> with hover styling and a pointer cursor — so it read
            as a date picker, and clicking it did nothing.

            It is deliberately NOT being made selectable. This dashboard is
            today-only by construction: `reportsApi.dashboard()` takes no date
            (Collected Today, Doctors Active, Total Patients), and the queue is
            polled for the current day every 30s. A picker here would change the
            appointments list alone and silently leave every other tile on
            today. Appointments has a working date filter; Reports takes a
            range. */}
        <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[15px] font-semibold text-slate-500">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          Today · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </PageHeading>

      {/* Hero row — the three numbers an admin checks first. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HeroCard
          icon={IndianRupee}
          label="Collected Today"
          value={kpis ? inr(kpis.revenue_today) : '—'}
          // Previous sub: `${ops.hospitalPaid} paid at hospital · ${inr(ops.onlineAmt)} booked online`
          sub={`${ops.hospitalPaid} paid at hospital`}
          gradient="from-teal-500 via-emerald-500 to-green-500"
        />
        <HeroCard
          icon={Users}
          label="Waiting Now"
          value={loading ? '—' : String(queue.waiting.length)}
          sub={queue.current ? `Now serving ${queue.current.display_code}` : 'No token in progress'}
          gradient="from-teal-500 to-teal-700"
          live
        />
        <HeroCard
          icon={CheckCircle2}
          label="OPs Completed"
          value={kpis ? String(kpis.completed_today ?? 0) : '—'}
          sub={kpis ? `of ${kpis.tokens_today ?? 0} tokens today` : ''}
          gradient="from-emerald-500 to-green-600"
        />
      </div>

      {/* Today's operations — walk-in vs online, and how money was collected. */}
      <Card>
        {/* Three readings side by side. A gap alone left them running together,
            so each is fenced with a light theme-green rule — horizontal when
            they stack, vertical once they sit in a row. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-0">
          <div className="md:pr-6">
          <SplitBar
            title="Patient Source"
            icon={Footprints}
            segments={[
              { label: 'Walk-in', value: ops.walkin, color: 'bg-teal-500' },
              { label: 'Online', value: ops.online, color: 'bg-green-500' },
            ]}
          />
          </div>
          <div className="border-t-[1.5px] border-teal-500/20 pt-5 md:border-l-[1.5px] md:border-t-0 md:px-6 md:pt-0">
          <SplitBar
            title="Consultation Collections"
            icon={Wallet}
            segments={[
              { label: 'Paid at hospital', value: ops.hospitalPaid, color: 'bg-teal-500' },
              { label: 'Pending', value: ops.pending, color: 'bg-slate-300' },
            ]}
            // Previous note: `${ops.onlinePaid} prepaid booking fee online (${inr(ops.onlineAmt)})`
          />
          </div>
          <div className="border-t-[1.5px] border-teal-500/20 pt-5 md:border-l-[1.5px] md:border-t-0 md:pl-6 md:pt-0">
            <div className="mb-2 flex items-center gap-2 text-[14.5px] font-bold text-brand-navy">
              <Banknote className="h-4 w-4 text-slate-400" /> Payment Mode
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'cash', label: 'Cash', icon: Banknote, tone: 'bg-green-50 text-green-700' },
                { key: 'upi', label: 'UPI', icon: Smartphone, tone: 'bg-teal-50 text-teal-700' },
                { key: 'card', label: 'Card', icon: CreditCard, tone: 'bg-emerald-50 text-emerald-700' },
                { key: 'other', label: 'Other', icon: Wallet, tone: 'bg-slate-100 text-slate-500' },
              ].map(({ key, label, icon: MIcon, tone }) => (
                <span key={key} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold ${tone}`}>
                  <MIcon className="h-3.5 w-3.5" /> {label}
                  <span className="font-extrabold">{ops.methods[key] || 0}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Secondary KPIs — supporting numbers. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATS.map((s) => <StatCard key={s.label} value={s.value} label={s.label} icon={s.icon} tone={s.tone} />)}
      </div>

      {/* Per-doctor performance today */}
      <Card className="flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-[16.5px] font-bold text-brand-navy">Doctor Performance Today</h3>
            <Link to="/hospital-dashboard/op-queue" className="flex items-center gap-1 text-[13px] font-semibold text-teal-600">Queue <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          {byDoctor.length === 0 ? (
            <p className="mt-3 text-[14px] text-slate-400">{loading ? 'Loading…' : 'No consultations recorded yet today.'}</p>
          ) : (
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[13px] font-semibold text-slate-400">
                    <th className="pb-2 pr-4">Doctor</th>
                    <th className="pb-2 pr-3 text-right">OPs Done</th>
                    <th className="pb-2 pr-3 text-right">Waiting</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-[14px]">
                  {byDoctor.map((d) => (
                    <tr key={d.doctor_id} className="border-t border-slate-50">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={d.name} className="h-8 w-8 shrink-0 text-[13px]" />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-brand-navy">{d.name}</span>
                            <div className="mt-1 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${d.total ? (d.completed / d.total) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold text-green-600">{d.completed}</td>
                      <td className="py-2.5 pr-3 text-right text-teal-600">{d.waiting}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-500">{d.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
    </div>
  )
}

export default Dashboard
