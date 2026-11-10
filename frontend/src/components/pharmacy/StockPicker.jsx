import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { pharmacyApi } from '../../api'
import { STOCK_STATUS, isAvailable, fmtExpiry } from './stockStatus.js'

/** One stock item on a line: status dot, name, strength, how many, expiry. */
export function StockLine({ option }) {
  const st = STOCK_STATUS[option.status]
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13.5px]">
      <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} />
      <span className="truncate font-semibold text-brand-navy">
        {option.medicine_name}{option.strength ? ` · ${option.strength}` : ''}
      </span>
      <span className="shrink-0 text-slate-500">
        {isAvailable(option.status) ? `${st.label} · ${option.quantity}` : st.label}
        {option.expiry_date ? ` · exp ${fmtExpiry(option.expiry_date)}` : ''}
      </span>
    </span>
  )
}

/** Search this hospital's stock and pick the item being handed over. Used by the
 *  prescription counter and walk-in sales. Expired stock is listed but can't be picked. */
export function StockPicker({ initialQuery, onPick, onCancel }) {
  const [q, setQ] = useState(initialQuery || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return undefined
    }
    const mine = ++seq.current
    setLoading(true)
    const t = setTimeout(() => {
      pharmacyApi.search(term)
        .then((r) => {
          if (mine !== seq.current) return
          // Substitutes the search suggests for an out-of-stock match are real
          // choices at the counter too — list them alongside, once each.
          const seen = new Set()
          const flat = []
          for (const m of r.results || []) {
            if (!seen.has(m.stock_id)) {
              seen.add(m.stock_id)
              flat.push(m)
            }
            // Say WHY a substitute is in the list — the counter can't be
            // expected to know every brand's composition by heart.
            for (const s of m.substitutes || []) {
              if (!seen.has(s.stock_id)) {
                seen.add(s.stock_id)
                flat.push({ ...s, sameAs: m.medicine_name })
              }
            }
          }
          // Brands this pharmacy never stocked, recognised from other hospitals'
          // sheets, and the same brand in another strength.
          for (const o of [...(r.alternatives || []), ...(r.other_strength || [])]) {
            if (!seen.has(o.stock_id)) {
              seen.add(o.stock_id)
              flat.push({ ...o, sameAs: r.not_stocked_name || undefined })
            }
          }
          setResults(flat)
        })
        .catch(() => { if (mine === seq.current) setResults([]) })
        .finally(() => { if (mine === seq.current) setLoading(false) })
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your stock…"
          className="w-full bg-transparent py-1 text-[13px] outline-none"
        />
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-[13px] font-semibold text-slate-400 hover:text-slate-600">Cancel</button>
        )}
      </div>
      <div className="mt-1 max-h-48 overflow-auto">
        {loading && !results.length && <p className="px-2 py-1.5 text-[13px] text-slate-400">Searching…</p>}
        {!loading && q.trim().length >= 2 && !results.length && (
          <p className="px-2 py-1.5 text-[13px] text-slate-500">Not in your stock list.</p>
        )}
        {results.map((o) => {
          const expired = o.status === 'expired'
          return (
            <button
              key={o.stock_id}
              type="button"
              disabled={expired}
              onClick={() => onPick(o)}
              className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={expired ? 'Expired stock cannot be given' : ''}
            >
              <StockLine option={o} />
              {o.sameAs && (
                <span className="mt-0.5 block text-[13px] font-semibold text-emerald-700">
                  same medicine as {o.sameAs}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
