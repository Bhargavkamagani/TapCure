import { useCallback, useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { subscriptionsApi } from '../../api'
import { useDialog } from '../common/DialogProvider.jsx'

/**
 * Super-admin view of one hospital's plan: what it's on, this month's online
 * bookings, and a form to move it to another plan (pilot, Starter, Smart
 * Hospital, Pro, Hospital). Discount covers the Founding Hospital rate
 * (20% off Smart Hospital = ₹799).
 */
const PLANS = [
  { code: 'pilot', label: 'Pilot (free 30 days)' },
  // Real list prices (2026-11-02); billing itself is still ₹0 for now.
  { code: 'starter', label: 'Starter · ₹499' },
  { code: 'smart_hospital', label: 'Smart Hospital · ₹999' },
  { code: 'pro', label: 'Pro · ₹1,999' },
  { code: 'hospital', label: 'Hospital · from ₹4,999' },
]

export default function HospitalPlan({ hospitalId }) {
  const dialog = useDialog()
  const [usage, setUsage] = useState(null)
  const [form, setForm] = useState({ plan_code: 'pilot', billing_cycle: 'monthly', extra_doctors: 0, discount_pct: 0 })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const u = await subscriptionsApi.bookings({ hospital_id: hospitalId })
      setUsage(u)
      if (u?.plan) {
        setForm({
          plan_code: u.plan.code, billing_cycle: u.plan.billing_cycle || 'monthly',
          extra_doctors: u.plan.extra_doctors || 0, discount_pct: u.plan.discount_pct || 0,
        })
      }
    } catch {
      setUsage(null)
    }
  }, [hospitalId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    const ok = await dialog.confirm({
      title: 'Change plan',
      message: `Move this hospital to ${PLANS.find((p) => p.code === form.plan_code)?.label}? The current plan ends today.`,
      tone: 'info',
      confirmLabel: 'Change plan',
    })
    if (!ok) return
    setSaving(true)
    try {
      await subscriptionsApi.assign({
        hospital_id: hospitalId, ...form,
        extra_doctors: form.plan_code === 'pro' ? Number(form.extra_doctors) : 0,
        discount_pct: Number(form.discount_pct) || 0,
      })
      await load()
    } catch (e) {
      await dialog.alert({ title: 'Could not change plan', message: e?.message || 'Please try again.', tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const field = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-blue'

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-white p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-brand-blue" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Plan</p>
      </div>
      <p className="text-[13px] text-slate-600">
        {usage?.plan
          ? <>On <b>{usage.plan.name}</b>
              {usage.unlimited ? ` · ${usage.used} online bookings this month` : ` · used ${usage.used} of ${usage.allowance} this month`}
              {usage.choice && ` · chose: ${usage.choice.replace(/_/g, ' ')}`}
              {usage.online_booking_open === false && <span className="font-semibold text-red-500"> · online booking off</span>}
            </>
          : 'No plan yet.'}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-slate-500">
          Plan
          <select value={form.plan_code} onChange={set('plan_code')} className={field}>
            {PLANS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-slate-500">
          Billing
          <select value={form.billing_cycle} onChange={set('billing_cycle')} className={field} disabled={form.plan_code === 'pilot'}>
            <option value="monthly">Monthly</option>
            <option value="annually">Yearly (10 months' price)</option>
          </select>
        </label>
        {form.plan_code === 'pro' && (
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-slate-500">
            Extra doctors (₹599 each)
            <select value={form.extra_doctors} onChange={set('extra_doctors')} className={field}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-slate-500">
          Discount %
          <input type="number" min="0" max="100" value={form.discount_pct} onChange={set('discount_pct')} className={`${field} w-20`} />
        </label>
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-brand-blue px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-blueDark disabled:opacity-50">
          {saving ? 'Saving…' : 'Save plan'}
        </button>
      </div>
    </div>
  )
}
