import { useEffect, useRef, useState } from 'react'
import { pharmacyApi } from '../../api'
import { STOCK_STATUS } from '../pharmacy/stockStatus.js'

/** "Calpol" + "650 mg" -> "Calpol 650 mg"; "Dolo 650" + "650 mg" stays "Dolo 650". */
const nameWithStrength = (o) => {
  const num = (o.strength || '').match(/\d+(\.\d+)?/)?.[0]
  return o.strength && !(num && o.medicine_name.includes(num)) ? `${o.medicine_name} ${o.strength}` : o.medicine_name
}

/** In stock / Low / Out of stock / Expired — no shelf count: the doctor decides
 *  what to prescribe, the counted stock is the pharmacist's business. */
function StockLabel({ option }) {
  const st = STOCK_STATUS[option.status]
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-slate-600">
      <span className={`h-2 w-2 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  )
}

/**
 * Medicine name box that checks the hospital pharmacy's stock as the doctor
 * types. Picking a result links the Rx line to that stock row; typing freely
 * is always allowed — the patient may buy the medicine outside.
 *
 * With `enabled` false (the hospital has no pharmacy list) it is the plain input
 * it always was.
 *
 * Props: value, enabled, appointmentId, onType(text), onPick(option, drugName)
 */
export default function MedicineSearch({ value, enabled, appointmentId, onType, onPick }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const seq = useRef(0)
  const q = value.trim()
  const results = data?.results || []
  // The brand isn't stocked here, but we know what it contains and this hospital
  // has the same medicine under another brand.
  const alternatives = data?.alternatives || []
  // Same brand here, different strength (typed Levipil 250, they keep 500).
  const otherStrength = data?.other_strength || []

  useEffect(() => {
    if (!enabled || !open) return undefined
    if (q.length < 2) {
      setData(null)
      setLoading(false)
      return undefined
    }
    const mine = ++seq.current // ignore answers to searches the doctor has typed past
    setLoading(true)
    const t = setTimeout(() => {
      pharmacyApi.search(q, appointmentId)
        .then((r) => { if (mine === seq.current) { setData(r); setActive(-1) } })
        .catch(() => { if (mine === seq.current) setData(null) })
        .finally(() => { if (mine === seq.current) setLoading(false) })
    }, 250)
    return () => clearTimeout(t)
  }, [q, open, enabled, appointmentId])

  if (!enabled) {
    return <input value={value} onChange={(e) => onType(e.target.value)} placeholder="Medicine name *" className="field-input flex-1" />
  }

  const choose = (option) => {
    onPick(option, nameWithStrength(option))
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') return setOpen(false)
    if (!open || !results.length) return undefined
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      choose(results[active])
    }
    return undefined
  }

  return (
    <div className="relative flex-1">
      <input
        value={value}
        onChange={(e) => { onType(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="Medicine name * (checks hospital stock)"
        autoComplete="off"
        className="field-input w-full"
      />
      {open && q.length >= 2 && (
        // mousedown would blur the input and close the list before the click lands
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          {loading && !results.length && !alternatives.length && (
            <p className="px-3 py-2 text-[12px] text-slate-400">Checking hospital stock…</p>
          )}

          {/* Not stocked here, but the same medicine is — under another brand. */}
          {!loading && !results.length && alternatives.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[12px] text-slate-500">
                <span className="font-semibold text-brand-navy">{data.not_stocked_name}</span> is not stocked here.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-emerald-50/70 px-2 py-1.5">
                <span className="text-[11.5px] font-semibold text-emerald-800">
                  Same medicine{data.not_stocked_generic ? ` (${data.not_stocked_generic})` : ''} in stock:
                </span>
                {alternatives.map((o) => (
                  <button
                    key={o.stock_id}
                    type="button"
                    onClick={() => choose(o)}
                    className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    {nameWithStrength(o)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-slate-400">You can still prescribe what you typed.</p>
            </div>
          )}

          {/* Same brand here, different strength — a different medicine, so it is
              shown as information and switching to it takes a deliberate tap. */}
          {!loading && !results.length && otherStrength.length > 0 && (
            <div className="border-t border-slate-100 px-3 py-2 first:border-t-0">
              <p className="text-[12px] text-slate-500">
                This pharmacy has the same brand in a <span className="font-semibold text-brand-navy">different strength</span>:
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {otherStrength.map((o) => (
                  <button
                    key={o.stock_id}
                    type="button"
                    onClick={() => choose(o)}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-slate-600 hover:border-brand-blue hover:text-brand-blue"
                  >
                    Use {nameWithStrength(o)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-slate-400">Or keep what you typed — the patient can buy it outside.</p>
            </div>
          )}

          {!loading && !results.length && !alternatives.length && !otherStrength.length && (
            <p className="px-3 py-2 text-[12px] text-slate-500">
              Not stocked here. Try the generic name (e.g. paracetamol) to see which brands the pharmacy has.
              You can still prescribe it.
            </p>
          )}

          {results.map((o, i) => (
            <div key={o.stock_id} className={`px-3 py-2 ${i === active ? 'bg-teal-50' : ''}`}>
              <button type="button" onClick={() => choose(o)} className="flex w-full items-center justify-between gap-3 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-brand-navy">
                    {o.medicine_name}
                    {o.strength && <span className="font-normal text-slate-500"> · {o.strength}</span>}
                  </span>
                  {(o.generic_name || o.form) && (
                    <span className="block truncate text-[11.5px] text-slate-400">{[o.generic_name, o.form].filter(Boolean).join(' · ')}</span>
                  )}
                </span>
                <StockLabel option={o} />
              </button>
              {o.substitutes?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-emerald-50/70 px-2 py-1.5">
                  <span className="text-[11.5px] font-semibold text-emerald-800">
                    Same medicine{o.generic_name ? ` (${o.generic_name})` : ''} in stock:
                  </span>
                  {o.substitutes.map((s) => (
                    <button
                      key={s.stock_id}
                      type="button"
                      onClick={() => choose(s)}
                      className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      {nameWithStrength(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {results.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-[12px] text-slate-500 hover:bg-slate-50"
            >
              Use “{q}” as typed (not from hospital pharmacy)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
