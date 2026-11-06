import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, ShoppingBag, Trash2, Undo2, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card } from '../../components/hospital/ui.jsx'
import { pharmacyApi } from '../../api'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { StockLine, StockPicker } from '../../components/pharmacy/StockPicker.jsx'
import { serverDate } from '../../components/pharmacy/stockStatus.js'
import { toMobile } from '../../lib/phone.js'

const PAGE_SIZE = 50

const fmtWhen = (iso) =>
  serverDate(iso)?.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) || ''

let lineSeq = 0
const blankLine = () => ({ key: ++lineSeq, stock: null, qty: '', picking: true })

function NewSaleModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', prescribed_by: '' })
  const [lines, setLines] = useState([blankLine()])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'customer_phone' ? toMobile(e.target.value) : e.target.value }))
  const setLine = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const save = async () => {
    const filled = lines.filter((l) => l.stock || l.qty)
    if (!filled.length) return setErr('Add at least one medicine.')
    for (const l of filled) {
      if (!l.stock) return setErr('Choose the medicine for every line.')
      if (!l.qty || Number(l.qty) < 1) return setErr(`${l.stock.medicine_name}: enter the quantity.`)
    }
    const ids = filled.map((l) => l.stock.stock_id)
    if (new Set(ids).size !== ids.length) return setErr('The same medicine is added twice. Put the quantities on one line.')
    if (form.customer_phone && !/^\d{10}$/.test(form.customer_phone)) return setErr('Mobile must be 10 digits.')
    setBusy(true)
    setErr(null)
    try {
      const res = await pharmacyApi.createWalkinSale({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone,
        prescribed_by: form.prescribed_by.trim(),
        items: filled.map((l) => ({ stock_id: l.stock.stock_id, quantity: Number(l.qty) })),
      })
      onSaved(res)
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
    return undefined
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-[17px] font-extrabold text-brand-navy">New walk-in sale</h3>
            <p className="text-[12.5px] text-slate-500">For customers without a prescription from this hospital. Stock goes down when you save.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={form.customer_name} onChange={set('customer_name')} maxLength={100} placeholder="Customer name (optional)" className="field-input" />
            <input value={form.customer_phone} onChange={set('customer_phone')} inputMode="numeric" placeholder="Mobile, 10 digits (optional)" className="field-input" />
            <input
              value={form.prescribed_by}
              onChange={set('prescribed_by')}
              maxLength={150}
              placeholder="Prescribed by — doctor / hospital on their prescription (optional)"
              className="field-input sm:col-span-2"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Medicines</p>
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-1 items-start gap-2 rounded-xl border border-slate-100 p-2 sm:grid-cols-[1fr_130px_36px]">
                {l.picking || !l.stock ? (
                  <StockPicker
                    onPick={(o) => setLine(l.key, { stock: o, picking: false })}
                    onCancel={l.stock ? () => setLine(l.key, { picking: false }) : null}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                    <StockLine option={l.stock} />
                    <button type="button" onClick={() => setLine(l.key, { picking: true })} className="shrink-0 text-[12px] font-semibold text-brand-blue hover:underline">
                      Change
                    </button>
                  </div>
                )}
                <input
                  inputMode="numeric"
                  value={l.qty}
                  onChange={(e) => setLine(l.key, { qty: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                  placeholder="Quantity"
                  title="Count it the same way as your stock sheet (strips, tablets, bottles…)"
                  className="field-input"
                />
                <button
                  type="button"
                  onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [blankLine()]))}
                  className="flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                  aria-label="Remove medicine"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, blankLine()])}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-brand-blue hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Add medicine
            </button>
          </div>

          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" /> {busy ? 'Saving…' : 'Save sale'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The walk-in half of the pharmacy counter. Search text, date range and the
 * "New walk-in sale" button live on the Counter page; `showNew`/`setShowNew`
 * let that button open the form here.
 */
export function WalkinSalesPanel({ query, days, active, refreshKey, showNew, setShowNew }) {
  const dialog = useDialog()
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [notice, setNotice] = useState(null)
  const [warnings, setWarnings] = useState([])

  useEffect(() => {
    setPage(1)
  }, [query, days])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setData(await pharmacyApi.walkinSales({ q: query, days, page, size: PAGE_SIZE }))
      setErr(null)
    } catch (e) {
      if (!silent) setErr(e.message)
    }
    if (!silent) setLoading(false)
  }, [query, days, page])
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    if (active) loadRef.current(true)
  }, [active])
  useEffect(() => {
    if (refreshKey) loadRef.current()
  }, [refreshKey])
  useEffect(() => {
    if (showNew) {
      setNotice(null)
      setWarnings([])
    }
  }, [showNew])

  useAutoRefresh(() => load(true), { paused: showNew, enabled: active })

  const onSaved = (res) => {
    setShowNew(false)
    setNotice('Sale saved. Stock updated.')
    setWarnings(res.warnings || [])
    load()
  }

  const undo = async (sale) => {
    const ok = await dialog.confirm({
      title: 'Undo this sale?',
      message: 'Use this if it was recorded by mistake. The stock count goes back up.',
      confirmLabel: 'Undo sale',
    })
    if (!ok) return
    try {
      const res = await pharmacyApi.undoWalkinSale(sale.sale_id)
      setNotice('Sale undone. Stock restored.')
      setWarnings(res.warnings || [])
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      {notice && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-700">
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {notice}</span>
          <button onClick={() => setNotice(null)} className="text-emerald-600/70 hover:text-emerald-700" aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] text-amber-800">
          {warnings.map((w, i) => <p key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}</p>)}
        </div>
      )}
      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      {!data && loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : data && data.items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600"><ShoppingBag className="h-6 w-6" /></span>
          <p className="text-[15px] font-bold text-brand-navy">
            No walk-in sales {days === 1 ? 'today' : `in the last ${days} days`}{query ? ' matching this' : ' yet'}
          </p>
          <p className="text-[12.5px] text-slate-500">Use <span className="font-semibold">New walk-in sale</span> when an outside customer buys medicines.</p>
        </Card>
      ) : data ? (
        <Card className="min-h-0 flex-1 overflow-hidden p-0">
          <div className="h-full overflow-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Prescribed by</th>
                  <th className="px-3 py-2.5">Medicines</th>
                  <th className="px-3 py-2.5">Pharmacist</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.sale_id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtWhen(s.sold_at)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-brand-navy">{s.customer_name || 'Walk-in customer'}</p>
                      {s.customer_phone && <p className="text-[11.5px] text-slate-400">{s.customer_phone}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{s.prescribed_by || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {s.items.map((it) => (
                        <p key={it.dispense_id}>
                          {it.medicine_name}{it.strength ? ` ${it.strength}` : ''} <span className="font-semibold text-brand-navy">× {it.quantity}</span>
                          {it.batch_no && <span className="text-[11.5px] text-slate-400"> · batch {it.batch_no}</span>}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{s.sold_by || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {s.can_undo && (
                        <button
                          onClick={() => undo(s)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-[12px] font-semibold text-slate-500">
          <span>Page {page} of {pages} · {data.total} sales</span>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {showNew && <NewSaleModal onClose={() => setShowNew(false)} onSaved={onSaved} />}
    </>
  )
}
