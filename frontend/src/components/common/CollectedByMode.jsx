import { Banknote, Smartphone, CreditCard, MoreHorizontal } from 'lucide-react'
import { Card } from '../hospital/ui.jsx'

const MODES = {
  cash: { label: 'Cash', icon: Banknote, tone: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  upi: { label: 'UPI', icon: Smartphone, tone: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
  card: { label: 'Card', icon: CreditCard, tone: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500' },
  other: { label: 'Other', icon: MoreHorizontal, tone: 'bg-slate-100 text-slate-500', bar: 'bg-slate-400' },
}
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

/**
 * Consultation fees collected, split by how they were paid — so Cash can be
 * matched against the drawer and UPI/Card against the bank statement.
 * `rows`: [{ mode, amount, count }] (the API's `collected_by_mode`).
 */
export default function CollectedByMode({ rows = [], subtitle }) {
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return (
    <Card className="shrink-0">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-bold text-brand-navy">Collected by payment mode</h3>
        <span className="text-[13px] font-extrabold text-brand-navy">{inr(total)}</span>
      </div>
      {subtitle && <p className="-mt-2 mb-3 text-[13px] text-slate-400">{subtitle}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {rows.map((r) => {
          const m = MODES[r.mode] || MODES.other
          const Icon = m.icon
          const share = total ? Math.round((r.amount / total) * 100) : 0
          return (
            <div key={r.mode} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.tone}`}><Icon className="h-4 w-4" /></span>
                <span className="text-[13px] font-semibold text-slate-600">{m.label}</span>
              </div>
              <p className="mt-2 text-[19px] font-extrabold leading-none text-brand-navy">{inr(r.amount)}</p>
              <p className="mt-1 text-[13px] text-slate-400">{r.count} {r.count === 1 ? 'visit' : 'visits'} · {share}%</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${share}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/** The same split worked out in the browser from a list of appointments, with
 *  the server's rules: paid only, ₹0 (free revisit) left out, no mode = cash. */
export function byModeFromAppointments(appts) {
  const acc = Object.fromEntries(Object.keys(MODES).map((m) => [m, { mode: m, amount: 0, count: 0 }]))
  for (const a of appts) {
    const fee = Number(a.consultation_fee || 0)
    if (!a.consultation_paid || fee <= 0) continue
    const m = acc[a.consultation_payment_method] ? a.consultation_payment_method : 'cash'
    acc[m].amount += fee
    acc[m].count += 1
  }
  return Object.values(acc)
}
