import { useCallback, useEffect, useState } from 'react'
import { CreditCard, RefreshCw, AlertTriangle, CheckCircle2, ArrowUpCircle, Package, IndianRupee, Info, Repeat } from 'lucide-react'
import { subscriptionsApi } from '../../api'
import { openCheckout } from '../../lib/razorpay.js'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { useDialog } from '../../components/common/DialogProvider.jsx'

/**
 * Plan & Bookings — the hospital's plan and this month's online bookings.
 *
 * Shows "used 140 of 200", the bill so far, and — once the free bookings are
 * nearly or fully used — the three choices (upgrade / booking pack / pay per
 * booking). Nothing changes until the admin picks one; the bill never goes
 * above the plan's limit either way. Rules: services/booking_quota.py.
 */

import { shownPrice } from '../../lib/planPrice.js'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const OPTION_ICON = { upgrade: ArrowUpCircle, pack: Package, pay_per_booking: IndianRupee }

function monthLabel(key) {
  if (!key) return ''
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function UsageBar({ used, allowance }) {
  const pct = allowance ? Math.min(100, Math.round((used / allowance) * 100)) : 0
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-teal-500'
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function BillRow({ label, value, strong }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-[13.5px] ${strong ? 'border-t border-slate-100 pt-2.5 font-bold text-brand-navy' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function HospitalPlan() {
  const dialog = useDialog()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await subscriptionsApi.bookings())
    } catch (e) {
      setError(e?.message || 'Could not load your plan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const choose = async (opt) => {
    const ok = await dialog.confirm({
      title: 'Confirm your choice',
      message: opt.choice === 'pay_per_booking'
        ? `${opt.title}. ${opt.detail}.`
        : `${opt.title}?`,
      tone: 'info',
      confirmLabel: 'Yes, continue',
      cancelLabel: 'Cancel',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await subscriptionsApi.choose(opt.choice, 1)
      setData(res.usage)
      await dialog.alert({ title: 'Done', message: res.message, tone: 'success' })
    } catch (e) {
      await dialog.alert({ title: 'Could not save', message: e?.message || 'Please try again.', tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const pickPlan = async (p) => {
    const onPilot = data?.plan?.code === 'pilot' && data?.online_booking_open
    const ok = await dialog.confirm({
      title: `Choose ${p.name}?`,
      message: `${p.name} is ${shownPrice(p.code, 'price', inr(p.price))} a month + GST, billed at the end of each month.`
        + (onPilot ? ' It starts today and ends your free pilot.' : ' It starts today and online bookings open again.'),
      tone: 'info',
      confirmLabel: `Yes, choose ${p.name}`,
      cancelLabel: 'Cancel',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await subscriptionsApi.choosePlan(p.code)
      setData(res.usage)
      await dialog.alert({ title: 'Done', message: res.message, tone: 'success' })
    } catch (e) {
      await dialog.alert({ title: 'Could not save', message: e?.message || 'Please try again.', tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const plan = data?.plan
  const bill = data?.bill

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
      <PageHeading title="Plan & Bookings" subtitle="Your TapCure plan and this month's online bookings. Walk-ins are always free.">
        <ToolButton icon={RefreshCw} onClick={load} disabled={loading}>Refresh</ToolButton>
      </PageHeading>

      {loading && !data && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}
      {error && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{error}</Card>}

      {data && !plan && (
        <Card className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" />
          <div>
            <p className="font-bold text-brand-navy">No plan yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Your hospital isn't on a TapCure plan yet. Choose one below, or contact TapCure support to start your free 30-day pilot.
            </p>
            <p className="mt-2 text-sm text-slate-500">Online bookings this month: <b>{data.used}</b></p>
          </div>
        </Card>
      )}
      {data && !plan && <PlanPicker choices={data.plan_choices} busy={busy} onPick={pickPlan} />}

      {plan && (
        <>
          <Card className="flex flex-wrap items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <CreditCard className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Your plan</p>
              <p className="text-xl font-extrabold text-brand-navy">{plan.name}</p>
              <p className="text-[13px] text-slate-500">
                {plan.code === 'pilot' ? 'Free pilot' : `${shownPrice(plan.code, 'price', inr(plan.price))} / month`}
                {plan.discount_pct > 0 && ` · ${plan.discount_pct}% off`}
                {plan.extra_doctors > 0 && ` · ${plan.extra_doctors} extra doctor${plan.extra_doctors > 1 ? 's' : ''}`}
                {plan.billing_cycle === 'annually' && ' · paid yearly'}
              </p>
            </div>
            {!data.online_booking_open && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-[12px] font-bold text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> Online booking is off
              </span>
            )}
          </Card>

          {(data.yearly_offer || data.yearly) && <Yearly data={data} onChanged={load} setData={setData} />}

          {data.state === 'pilot' && (
            <Card>
              <p className="font-bold text-brand-navy">Free pilot</p>
              <p className="mt-1 text-sm text-slate-600">
                {data.pilot_started
                  ? <>Your free pilot ends on <b>{new Date(data.trial_end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b>. All Smart Hospital features, no booking limit.</>
                  : <>Your 30 free days start on your first live OPD day (the first token you issue).</>}
              </p>
              <p className="mt-2 text-sm text-slate-500">Online bookings this month: <b>{data.used}</b></p>
              {data.ask_autopay && (
                <p className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-[13px] text-teal-800">
                  {data.pilot_days_left} day{data.pilot_days_left === 1 ? '' : 's'} of your pilot left. Turn on UPI Autopay below so online bookings keep working after the pilot.
                </p>
              )}
              {!data.online_booking_open && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                  The pilot has ended, so patients can't book online. Walk-ins still work. Choose a plan below to turn online bookings back on — your data is kept safe.
                </p>
              )}
            </Card>
          )}

          {data.state === 'pilot' && (
            <PlanPicker
              title={data.online_booking_open ? 'Ready to choose your plan?' : 'Choose a plan to turn online bookings back on'}
              choices={data.plan_choices} busy={busy} onPick={pickPlan}
            />
          )}

          {data.state === 'ended' && (
            <>
              <Card className="border-amber-200 bg-amber-50 text-sm text-amber-800">
                Your plan has ended, so patients can't book online. Walk-ins still work. Choose a plan below to start again — your data is kept safe.
              </Card>
              <PlanPicker choices={data.plan_choices} busy={busy} onPick={pickPlan} />
            </>
          )}

          {data.state === 'suspended' && (
            <Card className="border-red-200 bg-red-50 text-sm text-red-700">
              Your plan has been paused by TapCure, so patients can't book online. Walk-ins still work. Please contact TapCure support to restart it.
            </Card>
          )}

          {!['pilot', 'ended', 'suspended'].includes(data.state) && (
            <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
              <Card>
                <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">Online bookings · {monthLabel(data.month)}</p>
                {data.unlimited ? (
                  <p className="mt-2 text-2xl font-extrabold text-brand-navy">{data.used} <span className="text-base font-semibold text-slate-400">· no limit on your plan</span></p>
                ) : (
                  <>
                    <p className="mt-2 text-2xl font-extrabold text-brand-navy">
                      Used {data.used} <span className="text-base font-semibold text-slate-400">of {data.allowance}</span>
                    </p>
                    <div className="mt-3"><UsageBar used={data.used} allowance={data.allowance} /></div>
                    <p className="mt-2 text-[13px] text-slate-500">
                      {data.over > 0
                        ? `${data.over} booking${data.over > 1 ? 's' : ''} over your free limit.`
                        : `${data.remaining} free booking${data.remaining === 1 ? '' : 's'} left this month.`}
                      {data.packs_bought > 0 && ` Includes ${data.packs_bought * data.pack.size} from booking packs.`}
                    </p>
                  </>
                )}
                <p className="mt-3 text-[12px] text-slate-400">
                  Counted: bookings patients make online or on WhatsApp ({data.counts.online}) and walk-ins sent WhatsApp queue alerts ({data.counts.walkin_with_alerts}).
                  Not counted: walk-ins, and visits the hospital cancelled ({data.counts.not_counted_hospital_cancelled}).
                </p>
              </Card>

              {bill && (
                <Card>
                  <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">This month's bill so far</p>
                  <div className="mt-2">
                    {bill.lines.length === 0 && <BillRow label={plan.billing_cycle === 'annually' ? 'Paid yearly' : 'Nothing yet'} value={inr(0)} />}
                    {bill.lines.map((l) => <BillRow key={l.label} label={l.label} value={inr(l.amount)} />)}
                    <BillRow label="GST (18%)" value={inr(bill.gst)} />
                    <BillRow label="Total" value={inr(bill.total)} strong />
                  </div>
                  {bill.limit != null && (
                    <p className="mt-2 text-[12px] text-slate-400">
                      {bill.overage_capped ? 'Limit reached — no more booking charges this month. ' : ''}
                      Plan and bookings never go above {shownPrice(plan.code, 'limit', inr(bill.limit))} a month (+ GST{plan.extra_doctors > 0 ? ', + extra doctors' : ''}).
                    </p>
                  )}
                </Card>
              )}
            </div>
          )}

          {(data.state === 'near' || data.state === 'full' || data.state === 'over_chosen') && data.options?.length > 0 && (
            <Card className={data.state === 'full' ? 'border-red-200' : 'border-amber-200'}>
              <div className="flex items-start gap-3">
                {data.state === 'over_chosen'
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  : <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${data.state === 'full' ? 'text-red-500' : 'text-amber-500'}`} />}
                <div>
                  <p className="font-bold text-brand-navy">
                    {data.state === 'full' && 'Your free bookings are used up. What would you like to do?'}
                    {data.state === 'near' && `You've used ${data.used} of ${data.allowance} free bookings. Plan ahead:`}
                    {data.state === 'over_chosen' && 'You can still change your choice for this month:'}
                  </p>
                  {data.state === 'full' && (
                    <p className="mt-1 text-[13px] text-slate-500">
                      Bookings keep working while you decide. If you don't choose, extra bookings are charged per booking, and the bill stops at {shownPrice(plan.code, 'limit', inr(data.limit))}.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {data.options.map((opt) => {
                  const Icon = OPTION_ICON[opt.choice] || Info
                  const picked = data.choice === opt.choice
                  return (
                    <button
                      key={opt.choice}
                      type="button"
                      disabled={busy}
                      onClick={() => choose(opt)}
                      className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors disabled:opacity-50 ${
                        picked ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-teal-600" />
                      <span className="text-[14px] font-bold text-brand-navy">{opt.title}</span>
                      <span className="text-[12.5px] text-slate-500">{opt.detail}</span>
                      {picked && <span className="text-[11.5px] font-bold text-teal-700">Your choice this month</span>}
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          <Autopay status={data.autopay} onChanged={load} />
          <Invoices />
        </>
      )}
    </div>
  )
}

function Yearly({ data, onChanged, setData }) {
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  const offer = data.yearly_offer
  const yearly = data.yearly
  const until = yearly?.until
    ? new Date(yearly.until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const payYearly = async () => {
    const ok = await dialog.confirm({
      title: 'Pay for a year?',
      message: `Pay ${inr(offer.total)} (incl. GST) now for 12 months of ${data.plan.name}. `
        + "Your plan switches to yearly only after the payment goes through. This month's days so far stay on your monthly bill.",
      tone: 'info',
      confirmLabel: `Pay ${inr(offer.total)}`,
      cancelLabel: 'Cancel',
    })
    if (!ok) return
    setBusy(true)
    try {
      const o = await subscriptionsApi.startYearly()
      const res = await openCheckout({
        key: o.key_id, order_id: o.order_id, amount: o.amount, currency: 'INR',
        name: 'TapCure', description: `${data.plan.name} — 1 year`, prefill: o.prefill,
      })
      if (!res) return // closed the window: nothing changes, still monthly
      await subscriptionsApi.confirmInvoice(o.invoice_id, {
        order_id: res.razorpay_order_id, payment_id: res.razorpay_payment_id, signature: res.razorpay_signature,
      })
      await dialog.alert({ title: 'Paid', message: "Thank you! You're on the yearly plan now.", tone: 'success' })
      onChanged()
    } catch (e) {
      await dialog.alert({ title: 'Payment not completed', message: e?.message || 'You are still on monthly billing. Please try again.', tone: 'danger' })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const setRenew = async (renew) => {
    const ok = await dialog.confirm({
      title: renew ? 'Keep paying yearly?' : 'Switch to monthly?',
      message: renew
        ? `Your yearly plan will renew on ${until}.`
        : `You keep your paid year until ${until}. After that you move to monthly billing. No refund for the paid year.`,
      tone: 'info',
      confirmLabel: renew ? 'Yes, keep yearly' : 'Yes, switch to monthly',
      cancelLabel: 'Cancel',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await subscriptionsApi.yearlyRenewal(renew)
      setData(res.usage)
      await dialog.alert({ title: 'Done', message: res.message, tone: 'success' })
    } catch (e) {
      await dialog.alert({ title: 'Could not save', message: e?.message || 'Please try again.', tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  if (yearly) {
    return (
      <Card className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-brand-navy">Paid yearly</p>
          <p className="mt-1 text-sm text-slate-600">
            {yearly.renews
              ? <>Your plan is paid until <b>{until}</b> and renews for another year then.</>
              : <>Your plan is paid until <b>{until}</b>. After that you move to monthly billing.</>}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => setRenew(!yearly.renews)}
          className="rounded-lg border border-teal-300 px-3 py-1.5 text-[13px] font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50">
          {yearly.renews ? 'Switch to monthly when this year ends' : 'Keep paying yearly'}
        </button>
      </Card>
    )
  }
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand-navy">Pay yearly — 12 months for the price of 10</p>
        <p className="mt-1 text-sm text-slate-600">
          {inr(offer.total)} a year incl. GST, instead of {inr(offer.twelve_months_price)} + GST for 12 months.
          Your plan switches only after you pay.
        </p>
      </div>
      <button type="button" disabled={busy} onClick={payYearly}
        className="rounded-lg bg-teal-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {busy ? 'Please wait…' : `Pay ${inr(offer.total)} for 1 year`}
      </button>
    </Card>
  )
}

function PlanPicker({ title = 'Choose your plan', choices, busy, onPick }) {
  if (!choices?.length) return null
  return (
    <Card>
      <p className="font-bold text-brand-navy">{title}</p>
      <p className="mt-1 text-[13px] text-slate-500">Starts today. Billed at the end of each month — pay by UPI Autopay or from the bills below.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {choices.map((p) => (
          <button
            key={p.code}
            type="button"
            disabled={busy}
            onClick={() => onPick(p)}
            className="flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40 disabled:opacity-50"
          >
            <span className="text-[15px] font-bold text-brand-navy">{p.name}</span>
            <span className="text-[14px] font-semibold text-teal-700">{shownPrice(p.code, 'price', inr(p.price))} / month</span>
            <span className="text-[12.5px] text-slate-500">
              {p.included} free online bookings a month · {p.doctors} doctor{p.doctors > 1 ? 's' : ''}
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

function Autopay({ status, onChanged }) {
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  if (!status) return null

  const start = async () => {
    setBusy(true)
    try {
      const o = await subscriptionsApi.startAutopay()
      const res = await openCheckout({
        key: o.key_id, order_id: o.order_id, customer_id: o.customer_id, recurring: '1',
        name: 'TapCure', description: `UPI Autopay — up to ${inr(o.max_amount)} a month`, prefill: o.prefill,
      })
      if (!res) return
      const done = await subscriptionsApi.confirmAutopay({
        order_id: res.razorpay_order_id, payment_id: res.razorpay_payment_id, signature: res.razorpay_signature,
      })
      await dialog.alert({ title: 'UPI Autopay', message: done.message, tone: 'success' })
      onChanged()
    } catch (e) {
      await dialog.alert({ title: 'Autopay not set up', message: e?.message || 'Please try again.', tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
        <Repeat className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-brand-navy">UPI Autopay</p>
        <p className="text-[13px] text-slate-500">
          {status.active
            ? `On. Your monthly bill is paid automatically, up to ${inr(status.max_amount)} a month.`
            : `Approve once in your UPI app. Each month's bill is paid automatically — never more than ${inr(status.suggested_max)}.`}
          {status.needs_update && ' Your plan now costs more than this limit — please set it up again.'}
        </p>
      </div>
      {status.configured ? (
        (!status.active || status.needs_update) && (
          <button type="button" onClick={start} disabled={busy}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {busy ? 'Opening…' : status.active ? 'Set up again' : 'Turn on Autopay'}
          </button>
        )
      ) : (
        <span className="text-[12px] text-slate-400">Online payment isn't set up yet — contact TapCure.</span>
      )}
    </Card>
  )
}

const INVOICE_TONE = { paid: 'bg-green-100 text-green-700', overdue: 'bg-red-100 text-red-600', sent: 'bg-amber-100 text-amber-700' }

function Invoices() {
  const dialog = useDialog()
  const [rows, setRows] = useState(null)
  const [open, setOpen] = useState(null)
  const [paying, setPaying] = useState(null)

  const load = useCallback(() => subscriptionsApi.invoices().then(setRows).catch(() => setRows([])), [])
  useEffect(() => { load() }, [load])

  const pay = async (inv) => {
    setPaying(inv.invoice_id)
    try {
      const o = await subscriptionsApi.payInvoice(inv.invoice_id)
      const res = await openCheckout({
        key: o.key_id, order_id: o.order_id, amount: o.amount, currency: 'INR',
        name: 'TapCure', description: inv.invoice_number, prefill: o.prefill,
      })
      if (!res) return
      await subscriptionsApi.confirmInvoice(inv.invoice_id, {
        order_id: res.razorpay_order_id, payment_id: res.razorpay_payment_id, signature: res.razorpay_signature,
      })
      await dialog.alert({ title: 'Paid', message: `${inv.invoice_number} is paid. Thank you!`, tone: 'success' })
      load()
    } catch (e) {
      await dialog.alert({ title: 'Payment not completed', message: e?.message || 'Please try again.', tone: 'danger' })
    } finally {
      setPaying(null)
    }
  }

  if (!rows) return null
  return (
    <Card>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">Invoices</p>
      {rows.length === 0 && <p className="py-4 text-sm text-slate-400">No invoices yet. Your first one is made on the 1st of next month.</p>}
      <ul className="divide-y divide-slate-100">
        {rows.map((inv) => (
          <li key={inv.invoice_id} className="py-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setOpen(open === inv.invoice_id ? null : inv.invoice_id)}
                className="min-w-0 flex-1 text-left">
                <p className="text-[14px] font-semibold text-brand-navy">
                  {inv.billing_month ? monthLabel(inv.billing_month) : 'Yearly plan'} <span className="font-mono text-[12px] text-slate-400">{inv.invoice_number}</span>
                </p>
                <p className="text-[12px] text-slate-500">
                  {inr(inv.total_amount)} incl. GST{inv.status === 'paid' && inv.paid_date ? ` · paid ${inv.paid_date}` : inv.due_date ? ` · due ${inv.due_date}` : ''}
                </p>
              </button>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${INVOICE_TONE[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                {inv.status === 'sent' ? 'Unpaid' : inv.status}
              </span>
              {inv.status !== 'paid' && inv.status !== 'void' && (
                <button type="button" onClick={() => pay(inv)} disabled={paying === inv.invoice_id}
                  className="rounded-lg border border-teal-300 px-3 py-1 text-[12.5px] font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                  {paying === inv.invoice_id ? 'Opening…' : 'Pay now'}
                </button>
              )}
            </div>
            {open === inv.invoice_id && inv.lines_json && (
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-1">
                {inv.lines_json.map((l) => <BillRow key={l.label} label={l.label} value={inr(l.amount)} />)}
                <BillRow label="GST (18%)" value={inr(inv.tax_amount)} />
                <BillRow label="Total" value={inr(inv.total_amount)} strong />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
