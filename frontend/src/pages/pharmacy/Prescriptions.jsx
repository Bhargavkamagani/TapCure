import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X, ClipboardList, CheckCircle2, AlertTriangle, Undo2, Stethoscope, ChevronLeft, ChevronRight, Plus,
  Eye, Circle, MinusCircle, Package,
} from 'lucide-react'
import { Card } from '../../components/hospital/ui.jsx'
import { pharmacyApi } from '../../api'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { isAvailable, serverDate } from '../../components/pharmacy/stockStatus.js'
import { StockLine, StockPicker } from '../../components/pharmacy/StockPicker.jsx'

const PAGE_SIZE = 50
const RX_STATE = {
  pending: { label: 'To give', badge: 'bg-amber-50 text-amber-700' },
  partial: { label: 'Partly given', badge: 'bg-sky-50 text-sky-700' },
  done: { label: 'Done', badge: 'bg-emerald-50 text-emerald-700' },
}
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'To give' },
  { key: 'partial', label: 'Partly given' },
  { key: 'done', label: 'Done' },
]

// How one medicine on the prescription stands, at a glance.
const LINE_STATE = {
  given: {
    label: 'Given', icon: CheckCircle2, edge: 'border-l-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700', tone: 'text-emerald-600',
  },
  outside: {
    label: 'Not from our stock', icon: MinusCircle, edge: 'border-l-slate-300',
    pill: 'bg-slate-100 text-slate-600', tone: 'text-slate-400',
  },
  todo: {
    label: 'To give', icon: Circle, edge: 'border-l-amber-400',
    pill: 'bg-amber-50 text-amber-700', tone: 'text-amber-500',
  },
}
const lineState = (item) => {
  if (!item.dispenses.length) return 'todo'
  return item.dispenses.some((d) => d.outcome === 'given') ? 'given' : 'outside'
}

const fmtWhen = (iso) =>
  serverDate(iso)?.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) || ''
const fmtTime = (iso) =>
  serverDate(iso)?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) || ''

function StateBadge({ state }) {
  const s = RX_STATE[state] || RX_STATE.pending
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${s.badge}`}>{s.label}</span>
}

/** One recorded hand-over: what, how many, who, when — Undo while it's still today. */
function HandOver({ record, busy, onUndo }) {
  const given = record.outcome === 'given'
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-[13.5px]">
      <span className="flex flex-wrap items-center gap-1.5 text-slate-700">
        <Package className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        {given
          ? <><b>{record.quantity}</b> of {record.stock_name}{record.batch_no ? ` · batch ${record.batch_no}` : ''}</>
          : <>Patient buys it outside</>}
        <span className="text-slate-400">· {record.dispensed_by || 'Pharmacy'}, {fmtTime(record.dispensed_at)}</span>
        {record.reminders_started && <span className="text-slate-400">· reminders started</span>}
      </span>
      {record.can_undo && (
        <button
          onClick={onUndo}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] font-semibold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        >
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </button>
      )}
    </div>
  )
}

const draftFor = (item) => ({
  // A medicine nothing was recorded for yet starts on "Give" when the doctor's
  // pick is on the shelf; one already handed over waits for "Give more".
  mode: item.dispenses.length === 0 && item.stock && isAvailable(item.stock.status) ? 'give' : 'skip',
  stock: item.stock && item.stock.status !== 'expired' ? item.stock : null,
  qty: '',
  picking: false,
})

/**
 * One prescription at the counter. Opens showing what has already been handed
 * over and what is still waiting, so the pharmacist can see the state of the
 * whole prescription without reading every line.
 */
function CounterModal({ id, onClose, onChanged }) {
  const dialog = useDialog()
  const [rx, setRx] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [err, setErr] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [busy, setBusy] = useState(false)
  const [pendingOnly, setPendingOnly] = useState(false)

  const apply = (detail) => {
    setRx(detail)
    setDrafts(Object.fromEntries(detail.items.map((it) => [it.item_id, draftFor(it)])))
  }

  useEffect(() => {
    pharmacyApi.prescription(id).then(apply).catch((e) => setErr(e.message))
  }, [id])

  const setDraft = (itemId, patch) => setDrafts((d) => ({ ...d, [itemId]: { ...d[itemId], ...patch } }))

  const lines = rx ? rx.items.filter((it) => drafts[it.item_id] && drafts[it.item_id].mode !== 'skip') : []
  const counts = rx
    ? rx.items.reduce((acc, it) => ({ ...acc, [lineState(it)]: (acc[lineState(it)] || 0) + 1 }), {})
    : {}
  const done = (counts.given || 0) + (counts.outside || 0)
  const shown = rx ? rx.items.filter((it) => !pendingOnly || lineState(it) === 'todo') : []

  const save = async (confirmedRepeats = []) => {
    const payload = []
    for (const it of lines) {
      const d = drafts[it.item_id]
      if (d.mode === 'outside') {
        payload.push({ item_id: it.item_id, outcome: 'outside' })
        continue
      }
      if (!d.stock) return setErr(`${it.drug_name}: choose which stock item you gave`)
      if (!d.qty || Number(d.qty) < 1) return setErr(`${it.drug_name}: enter how many you gave`)
      payload.push({
        item_id: it.item_id, outcome: 'given', stock_id: d.stock.stock_id, quantity: Number(d.qty),
        repeat_ok: confirmedRepeats.includes(it.item_id),
      })
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await pharmacyApi.dispense(id, payload)
      apply(res.prescription)
      setWarnings(res.warnings || [])
      onChanged()
    } catch (e) {
      setBusy(false)
      if (e?.status === 409 && e?.detail?.code === 'recently_given') {
        const earlier = e.detail.items
          .map((x) => `${x.drug_name}: ${x.quantity} given ${fmtWhen(x.dispensed_at)}${x.dispensed_by ? ` by ${x.dispensed_by}` : ''}`)
          .join(' · ')
        const ok = await dialog.confirm({
          title: 'Already given recently',
          message: `${earlier}. Is this a new supply?`,
          confirmLabel: 'Yes, give again',
        })
        if (ok) return save(e.detail.items.map((x) => x.item_id))
        return undefined
      }
      setErr(e.message)
      return undefined
    }
    setBusy(false)
    return undefined
  }

  const undo = async (item, record) => {
    const ok = await dialog.confirm({
      title: `Undo ${item.drug_name}?`,
      message: 'Use this if it was recorded by mistake. The stock count goes back up.',
      confirmLabel: 'Undo',
    })
    if (!ok) return
    setBusy(true)
    setErr(null)
    try {
      const res = await pharmacyApi.undoDispense(record.dispense_id)
      apply(res.prescription)
      setWarnings(res.warnings || [])
      onChanged()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {/* Who and from whom */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-emerald-50 px-5 py-4">
          {rx ? (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[17px] font-extrabold text-brand-navy">{rx.family_member_name || rx.patient_name}</h3>
                <StateBadge state={rx.status} />
              </div>
              <p className="mt-0.5 text-[13.5px] text-slate-500">
                {rx.family_member_name && <>for {rx.family_member_name} · account {rx.patient_name} · </>}
                {rx.patient_uhid && <>UHID {rx.patient_uhid} · </>}
                {rx.patient_phone}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-slate-500">
                <Stethoscope className="h-3.5 w-3.5" /> {rx.doctor_name || 'Doctor'} · written {fmtWhen(rx.created_at)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">{err ? '' : 'Loading…'}</p>
          )}
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/70" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {/* How far this prescription has got */}
        {rx && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.round((done / Math.max(rx.items.length, 1)) * 100)}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-slate-600">{done} of {rx.items.length} recorded</span>
            </div>
            {['given', 'outside', 'todo'].filter((k) => counts[k]).map((k) => {
              const s = LINE_STATE[k]
              return (
                <span key={k} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${s.pill}`}>
                  <s.icon className="h-3.5 w-3.5" /> {counts[k]} {s.label.toLowerCase()}
                </span>
              )
            })}
            {(counts.todo || 0) > 0 && (counts.given || counts.outside) ? (
              <button
                onClick={() => setPendingOnly((v) => !v)}
                className="ml-auto text-[13px] font-semibold text-brand-blue hover:underline"
              >
                {pendingOnly ? 'Show all medicines' : 'Show only what’s left'}
              </button>
            ) : null}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-3 overflow-auto bg-slate-50/60 px-5 py-4">
          {warnings.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13.5px] text-amber-800">
              {warnings.map((w, i) => <p key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}</p>)}
            </div>
          )}
          {err && <div className="whitespace-pre-line rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

          {shown.map((it) => {
            const d = drafts[it.item_id]
            const state = lineState(it)
            const s = LINE_STATE[state]
            const hadAny = it.dispenses.length > 0
            const detailText = [it.dosage, it.frequency, it.duration, it.instructions].filter(Boolean).join(' · ')
            return (
              <div key={it.item_id} className={`rounded-xl border border-l-4 border-slate-100 bg-white p-3 ${s.edge}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[14.5px] font-bold text-brand-navy">
                      <s.icon className={`h-4 w-4 shrink-0 ${s.tone}`} />
                      {it.drug_name}
                    </p>
                    {detailText && <p className="mt-0.5 pl-6 text-[13.5px] text-slate-500">{detailText}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {it.given_total > 0 && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[13px] font-semibold text-slate-500 ring-1 ring-slate-200">
                        {it.given_total} given in total
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${s.pill}`}>{s.label}</span>
                  </div>
                </div>

                {hadAny && (
                  <div className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-1.5">
                    {it.dispenses.map((rec) => (
                      <HandOver key={rec.dispense_id} record={rec} busy={busy} onUndo={() => undo(it, rec)} />
                    ))}
                  </div>
                )}

                {/* Can't be handed over as written — what's on the shelf instead.
                    Tapping one fills the give form with it; nothing is swapped silently. */}
                {d && !hadAny && (it.suggestions.length > 0 || it.other_strength.length > 0) && (
                  <div className="mt-2 rounded-lg bg-emerald-50/70 px-3 py-2">
                    <p className="text-[13px] text-slate-600">
                      <span className="font-semibold text-brand-navy">{it.drug_name}</span>
                      {it.stock ? ' is not available' : ' is not in your stock list'}
                      {it.suggestions.length > 0 && (
                        <>. Same medicine{it.suggestion_generic ? ` (${it.suggestion_generic})` : ''} in stock:</>
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {it.suggestions.map((o) => (
                        <button
                          key={o.stock_id}
                          type="button"
                          onClick={() => setDraft(it.item_id, { mode: 'give', stock: o, picking: false })}
                          className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          {o.medicine_name}{o.strength ? ` ${o.strength}` : ''} · {o.quantity}
                        </button>
                      ))}
                    </div>
                    {it.other_strength.length > 0 && (
                      <p className="mt-1.5 text-[13px] text-slate-500">
                        Same brand in a different strength:{' '}
                        {it.other_strength.map((o) => `${o.medicine_name}${o.strength ? ` ${o.strength}` : ''}`).join(', ')}
                        {' '}— only the doctor can change the strength.
                      </p>
                    )}
                  </div>
                )}

                {d && !hadAny && (
                  <div className="mt-2 inline-grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-[13px] font-semibold">
                    {[['give', 'Give from stock'], ['outside', 'Not from our stock'], ['skip', 'Skip for now']].map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDraft(it.item_id, { mode: m })}
                        className={`rounded-lg px-3 py-1.5 ${d.mode === m ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {d && hadAny && d.mode === 'skip' && (
                  <button
                    type="button"
                    onClick={() => setDraft(it.item_id, { mode: 'give' })}
                    className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[13px] font-semibold text-brand-blue hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> {it.given_total > 0 ? 'Give more' : 'Give from stock now'}
                  </button>
                )}

                {d && d.mode === 'give' && (
                  <div className="mt-2 grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_150px]">
                    {d.picking || !d.stock ? (
                      <StockPicker
                        initialQuery={it.drug_name}
                        onPick={(o) => setDraft(it.item_id, { stock: o, picking: false })}
                        onCancel={d.stock ? () => setDraft(it.item_id, { picking: false }) : null}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                        <StockLine option={d.stock} />
                        <button type="button" onClick={() => setDraft(it.item_id, { picking: true })} className="shrink-0 text-[13px] font-semibold text-brand-blue hover:underline">
                          Change
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        inputMode="numeric"
                        value={d.qty}
                        onChange={(e) => setDraft(it.item_id, { qty: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                        placeholder="Qty given"
                        title="Count it the same way as your stock sheet (strips, tablets, bottles…)"
                        className="field-input"
                      />
                      {hadAny && (
                        <button type="button" onClick={() => setDraft(it.item_id, { mode: 'skip' })} className="text-[13px] font-semibold text-slate-400 hover:text-slate-600">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {rx && shown.length === 0 && (
            <Card className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              <p className="text-[14px] font-bold text-brand-navy">Everything on this prescription is recorded</p>
              <button onClick={() => setPendingOnly(false)} className="text-[13.5px] font-semibold text-brand-blue hover:underline">
                Show all medicines
              </button>
            </Card>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          <p className="text-[13px] text-slate-500">
            {(counts.todo || 0) > 0
              ? <><b className="text-brand-navy">{counts.todo}</b> still to record · stock updates when you save</>
              : 'All recorded · today’s entries can be undone'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
            <button
              onClick={() => save()}
              disabled={busy || lines.length === 0}
              className="flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> {busy ? 'Saving…' : `Save (${lines.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The prescriptions half of the pharmacy counter. The search text and date
 * range come from the Counter page, which shows walk-in sales beside it.
 * `active` = this tab is on screen; `refreshKey` bumps when Refresh is pressed.
 */
export function PrescriptionsPanel({ query, days, active, refreshKey }) {
  const [data, setData] = useState(null)
  const [state, setState] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [openId, setOpenId] = useState(null)

  useEffect(() => {
    setPage(1)
  }, [query, days])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setData(await pharmacyApi.prescriptions({ q: query, days, state, page, size: PAGE_SIZE }))
      setErr(null)
    } catch (e) {
      if (!silent) setErr(e.message)
    }
    if (!silent) setLoading(false)
  }, [query, days, state, page])
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    load()
  }, [load])
  // Switching back to this tab, or pressing Refresh on the page, re-reads the list.
  useEffect(() => {
    if (active) loadRef.current(true)
  }, [active])
  useEffect(() => {
    if (refreshKey) loadRef.current()
  }, [refreshKey])

  // New prescriptions from the consulting rooms appear without pressing Refresh.
  useAutoRefresh(() => load(true), { paused: openId !== null, enabled: active })

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const months = data ? Math.round(data.window_days / 30) : 6
  const emptyRange = query ? `in the last ${months} months` : days === 1 ? 'today' : `in the last ${days} days`

  return (
    <>
      {data && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const on = state === f.key
            return (
              <button
                key={f.key}
                onClick={() => { setState(f.key); setPage(1) }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors ${
                  on ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                }`}
              >
                {f.label} <span className={on ? 'text-white/80' : 'text-slate-400'}>{data.counts[f.key]}</span>
              </button>
            )
          })}
          {query && <span className="text-[13px] text-slate-400">Searching the last {months} months</span>}
        </div>
      )}

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      {!data && loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : data && data.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600"><ClipboardList className="h-6 w-6" /></span>
          <p className="text-[15px] font-bold text-brand-navy">No prescriptions {emptyRange}{query || state !== 'all' ? ' matching this' : ' yet'}</p>
          <p className="text-[13.5px] text-slate-500">New prescriptions from this hospital's doctors show up here automatically.</p>
        </Card>
      ) : data ? (
        <Card className="min-h-0 flex-1 overflow-hidden p-0">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Written</th>
                  <th className="px-3 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Doctor</th>
                  <th className="px-3 py-2.5">Medicines</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.prescription_id} onClick={() => setOpenId(r.prescription_id)} className="cursor-pointer border-t border-slate-100 hover:bg-teal-50/40">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtWhen(r.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-brand-navy">{r.family_member_name || r.patient_name}</p>
                      <p className="text-[13px] text-slate-400">
                        {r.family_member_name ? `for ${r.family_member_name} · ${r.patient_name}` : ''}
                        {r.family_member_name && r.patient_uhid ? ' · ' : ''}
                        {r.patient_uhid || ''}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{r.doctor_name || '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className="block h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.round((r.recorded_count / Math.max(r.item_count, 1)) * 100)}%` }}
                          />
                        </span>
                        <span className="text-slate-600">{r.recorded_count} of {r.item_count}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StateBadge state={r.status} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenId(r.prescription_id) }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-2.5 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-blueDark"
                      >
                        <Eye className="h-3.5 w-3.5" /> Open prescription
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-[13px] font-semibold text-slate-500">
          <span>Page {page} of {pages} · {data.total} prescriptions</span>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {openId !== null && (
        <CounterModal id={openId} onClose={() => setOpenId(null)} onChanged={() => load(true)} />
      )}
    </>
  )
}
