import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, RefreshCw, Upload, PackageOpen, ChevronLeft, ChevronRight, Pencil, AlertTriangle } from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { pharmacyApi } from '../../api'
import { STOCK_STATUS, timeAgo, isStale, fmtExpiry } from '../../components/pharmacy/stockStatus.js'

const PAGE_SIZE = 100
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in_stock', label: 'In stock' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out of stock' },
  { key: 'expired', label: 'Expired' },
]

/** "Low stock = 10 or fewer", editable in place. Digits-only text input, not
 *  type="number" — a focused number box changes value on a mouse-wheel scroll. */
function ThresholdEditor({ value, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => setDraft(String(value)), [value])

  const save = async () => {
    if (!draft) {
      setErr('Enter a number')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await pharmacyApi.updateSettings({ low_stock_threshold: Number(draft) })
      setEditing(false)
      onSaved()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[13px] font-semibold text-amber-700 hover:bg-amber-100"
        title="Change when a medicine counts as low stock"
      >
        Low stock = {value} or fewer <Pencil className="h-3 w-3" />
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
      Low stock =
      <input
        autoFocus
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center outline-none focus:border-teal-400"
      />
      or fewer
      <button onClick={save} disabled={busy} className="rounded-lg bg-brand-blue px-2.5 py-1 text-white disabled:opacity-60">
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button onClick={() => { setEditing(false); setDraft(String(value)); setErr(null) }} className="text-slate-400 hover:text-slate-600">
        Cancel
      </button>
      {err && <span className="text-red-600">{err}</span>}
    </span>
  )
}

export default function PharmacyStock() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  // Search as the pharmacist types, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setData(await pharmacyApi.stock({ q: query, status: filter, page, size: PAGE_SIZE }))
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }, [query, filter, page])

  useEffect(() => {
    load()
  }, [load])

  const counts = data?.counts
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const neverUploaded = data && counts.all === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Stock List" subtitle="What your pharmacy has on the shelf. Doctors at this hospital see it while writing prescriptions.">
        {!neverUploaded && (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search medicine or generic…"
              className="w-52 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        )}
        <ToolButton icon={RefreshCw} onClick={load}>Refresh</ToolButton>
        <ToolButton icon={Upload} tone="primary" onClick={() => navigate('/pharmacy-dashboard/upload')}>Upload Stock</ToolButton>
      </PageHeading>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      {!data && loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : neverUploaded ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <PackageOpen className="h-7 w-7" />
          </span>
          <p className="text-[16px] font-bold text-brand-navy">No stock list yet</p>
          <p className="max-w-md text-[13px] text-slate-500">
            Upload your stock sheet (Excel or CSV). Doctors will then see which medicines are available while they prescribe.
          </p>
          <button
            onClick={() => navigate('/pharmacy-dashboard/upload')}
            className="mt-1 flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blueDark"
          >
            <Upload className="h-4 w-4" /> Upload stock sheet
          </button>
        </Card>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {data.last_updated_at && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${
                  isStale(data.last_updated_at) ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isStale(data.last_updated_at) && <AlertTriangle className="h-3.5 w-3.5" />}
                Updated {timeAgo(data.last_updated_at)}{data.last_updated_by ? ` by ${data.last_updated_by}` : ''}
                {isStale(data.last_updated_at) && ' — upload today’s sheet so doctors see current stock'}
              </span>
            )}
            <ThresholdEditor value={data.low_stock_threshold} onSaved={load} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.key
              const dot = STOCK_STATUS[f.key]?.dot
              return (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setPage(1) }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors ${
                    active ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                  }`}
                >
                  {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
                  {f.label} <span className={active ? 'text-white/80' : 'text-slate-400'}>{counts[f.key]}</span>
                </button>
              )
            })}
          </div>

          <Card className="min-h-0 flex-1 overflow-hidden p-0">
            <div className="h-full overflow-auto">
              <table className="w-full min-w-[820px] text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Medicine</th>
                    <th className="px-3 py-2.5">Strength</th>
                    <th className="px-3 py-2.5">Form</th>
                    <th className="px-3 py-2.5">Batch</th>
                    <th className="px-3 py-2.5">Expiry</th>
                    <th className="px-3 py-2.5 text-right">MRP</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No medicines match.</td>
                    </tr>
                  ) : (
                    data.items.map((it) => {
                      const st = STOCK_STATUS[it.status]
                      return (
                        <tr key={it.stock_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-brand-navy">{it.medicine_name}</p>
                            {it.generic_name && <p className="text-[13px] text-slate-400">{it.generic_name}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{it.strength || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-600">{it.form || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-500">{it.batch_no || '—'}</td>
                          <td className={`px-3 py-2.5 ${it.status === 'expired' ? 'font-semibold text-red-600' : 'text-slate-600'}`}>{fmtExpiry(it.expiry_date)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{it.mrp != null ? `₹${it.mrp.toFixed(2)}` : '—'}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-brand-navy">{it.quantity}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${st.badge}`}>{st.label}</span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-[13px] font-semibold text-slate-500">
              <span>Page {page} of {pages} · {data.total} medicines</span>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
