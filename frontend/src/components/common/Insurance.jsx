/**
 * Insurance tie-ups (2026-11-03): everything the UI needs, in one file.
 *
 *   useInsurers(state)   the one list, from GET /public/insurers (cached)
 *   InsurerBadge         small round logo; initials in the insurer's colour
 *                        until a real logo file is added (see below)
 *   InsuranceLogos       a row of small badges + "+N more" — card top-right
 *   InsuranceList        full grouped list — hospital page / admin views
 *   InsurancePicker      search + collapsible groups of tick boxes — hospital
 *                        signup and hospital Profile
 *   InsuranceFilter      a <select> for patient search pages
 *
 * Hospitals store CODES only; names come from the backend list, so a rename
 * there shows everywhere at once.
 *
 * REAL LOGOS: put the file in public/insurers/ (e.g. star_health.png) and add
 * one line to public/insurers/logos.json: { "star_health": "star_health.png" }.
 * Insurers not listed there show their initials badge. (A manifest instead of
 * "try the file and see" avoids ~70 missing-file requests on every page.)
 */
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Search, ShieldCheck, X } from 'lucide-react'
import { discoveryApi } from '../../api'
import { useI18n } from '../../i18n/index.jsx'

// ---- data ----
const listCache = new Map() // normalised state -> Promise<groups>
let logoManifest = null      // Promise<{code: file}>

function loadLogos() {
  if (!logoManifest) {
    logoManifest = fetch('/insurers/logos.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => (m && typeof m === 'object' && !Array.isArray(m) ? m : {}))
      .catch(() => ({}))
  }
  return logoManifest
}

export function useInsurers(state = '') {
  const key = String(state || '').trim().toLowerCase()
  const [groups, setGroups] = useState(null)
  const [logos, setLogos] = useState({})
  useEffect(() => {
    let on = true
    if (!listCache.has(key)) {
      listCache.set(key, discoveryApi.insurers(state).then((r) => r?.groups || []).catch((e) => { listCache.delete(key); throw e }))
    }
    listCache.get(key).then((g) => on && setGroups(g)).catch(() => on && setGroups([]))
    loadLogos().then((m) => on && setLogos(m))
    return () => { on = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const byCode = useMemo(() => {
    const map = {}
    ;(groups || []).forEach((g) => g.items.forEach((i) => { map[i.code] = { ...i, logo: logos[i.code] || null } }))
    return map
  }, [groups, logos])
  return { groups: groups || [], byCode, loading: groups === null }
}

// ---- badge ----
const SIZES = { xs: 'h-5 w-5 text-[8px]', sm: 'h-6 w-6 text-[9px]', md: 'h-8 w-8 text-[11px]' }

export function InsurerBadge({ insurer, size = 'sm', className = '' }) {
  const [broken, setBroken] = useState(false)
  if (!insurer) return null
  const box = `${SIZES[size] || SIZES.sm} shrink-0 rounded-full ring-2 ring-white shadow-sm ${className}`
  if (insurer.logo && !broken) {
    return (
      <img src={`/insurers/${insurer.logo}`} alt={insurer.name} title={insurer.name} loading="lazy"
        onError={() => setBroken(true)} className={`${box} bg-white object-contain p-[2px]`} />
    )
  }
  return (
    <span title={insurer.name} aria-label={insurer.name} style={{ backgroundColor: insurer.color }}
      className={`${box} grid place-items-center font-bold uppercase leading-none tracking-tight text-white`}>
      {insurer.initials}
    </span>
  )
}

// ---- small row for cards ----
export function InsuranceLogos({ codes, max = 3, size = 'sm', className = '' }) {
  const { t } = useI18n()
  const { byCode } = useInsurers()
  const known = (codes || []).map((c) => byCode[c]).filter(Boolean)
  if (!known.length) return null
  const shown = known.slice(0, max)
  const extra = known.length - shown.length
  const all = known.map((i) => i.name).join(', ')
  return (
    <div className={`flex shrink-0 items-center ${className}`} title={`${t('ins.accepted')}: ${all}`} aria-label={`${t('ins.accepted')}: ${all}`}>
      <div className="flex -space-x-1.5">
        {shown.map((i) => <InsurerBadge key={i.code} insurer={i} size={size} />)}
      </div>
      {extra > 0 && (
        <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          {t('ins.more', { n: extra })}
        </span>
      )}
    </div>
  )
}

// ---- full grouped list ----
export function InsuranceList({ codes, showDisclaimer = true, emptyText }) {
  const { t } = useI18n()
  const { groups, loading } = useInsurers()
  const picked = new Set(codes || [])
  const rows = groups.map((g) => ({ ...g, items: g.items.filter((i) => picked.has(i.code)) })).filter((g) => g.items.length)
  if (loading) return null
  if (!rows.length) return <p className="text-[13px] text-slate-400">{emptyText ?? t('ins.noneListed')}</p>
  return (
    <div className="flex flex-col gap-3">
      {rows.map((g) => (
        <div key={g.key}>
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{t(`ins.group.${g.key}`)}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.items.map((i) => (
              <span key={i.code} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 text-[12px] font-medium text-slate-700">
                <InsurerBadge insurer={i} size="xs" className="!ring-0 !shadow-none" />{i.name}
              </span>
            ))}
          </div>
        </div>
      ))}
      {showDisclaimer && (
        <p className="flex items-start gap-1.5 text-[11.5px] text-slate-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('ins.disclaimer')}
        </p>
      )}
    </div>
  )
}

// ---- picker (hospital signup + Profile) ----
export function InsurancePicker({ value, onChange, state = '' }) {
  const { t } = useI18n()
  const { groups, byCode, loading } = useInsurers(state)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({ government: true })
  const picked = new Set(value || [])
  const term = q.trim().toLowerCase()

  const toggle = (code) => {
    const next = picked.has(code) ? (value || []).filter((c) => c !== code) : [...(value || []), code]
    onChange(next)
  }
  const visible = groups.map((g) => ({
    ...g,
    items: term ? g.items.filter((i) => `${i.name} ${i.state || ''} ${i.code}`.toLowerCase().includes(term)) : g.items,
  }))

  if (loading) return <p className="text-[13px] text-slate-400">Loading insurances…</p>
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 focus-within:border-brand-blue">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ins.search')}
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400" />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="text-slate-300 hover:text-slate-500"><X className="h-4 w-4" /></button>}
      </div>

      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(value || []).map((c) => byCode[c] && (
            <button type="button" key={c} onClick={() => toggle(c)} title="Remove"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-green bg-brand-greenLight py-1 pl-1 pr-2 text-[11.5px] font-semibold text-slate-700">
              <InsurerBadge insurer={byCode[c]} size="xs" className="!ring-0" />{byCode[c].name}<X className="h-3 w-3 text-slate-400" />
            </button>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-[11.5px] font-semibold text-slate-400 hover:text-red-500">Clear all</button>
        </div>
      )}

      {visible.map((g) => {
        const isOpen = term ? g.items.length > 0 : !!open[g.key]
        const count = groups.find((x) => x.key === g.key)?.items.filter((i) => picked.has(i.code)).length || 0
        if (term && !g.items.length) return null
        return (
          <div key={g.key} className="rounded-xl border border-slate-200">
            <button type="button" onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-left">
              <span className="text-[13px] font-semibold text-slate-700">
                {t(`ins.group.${g.key}`)} <span className="font-normal text-slate-400">({g.items.length})</span>
                {count > 0 && <span className="ml-2 rounded-full bg-brand-green px-2 py-0.5 text-[10.5px] font-bold text-white">{count} selected</span>}
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="grid grid-cols-1 gap-1.5 border-t border-slate-100 p-2.5 sm:grid-cols-2">
                {g.items.map((i) => {
                  const on = picked.has(i.code)
                  return (
                    <button type="button" key={i.code} onClick={() => toggle(i.code)} aria-pressed={on}
                      className={`relative flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors ${on ? 'border-brand-green bg-brand-greenLight' : 'border-slate-200 hover:border-brand-blue'}`}>
                      <InsurerBadge insurer={byCode[i.code] || i} size="sm" className="!ring-0" />
                      <span className="min-w-0 pr-4 leading-tight">
                        <span className="block text-[11.5px] font-semibold text-slate-700">{i.name}</span>
                        {i.state && <span className="block text-[10.5px] text-slate-400">{i.state}</span>}
                      </span>
                      {on && <CheckCircle2 className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-brand-green" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      {term && visible.every((g) => !g.items.length) && <p className="text-[12.5px] text-slate-400">No insurance or scheme matches “{q.trim()}”.</p>}
    </div>
  )
}

// ---- patient filter ----
export function InsuranceFilter({ value, onChange, className = '' }) {
  const { t } = useI18n()
  const { groups } = useInsurers()
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-slate-400" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('ins.filterLabel')}
        className="w-full bg-transparent py-2.5 text-[14px] font-medium text-brand-navy outline-none sm:w-44">
        <option value="">{t('ins.filterAny')}</option>
        {groups.map((g) => (
          <optgroup key={g.key} label={t(`ins.group.${g.key}`)}>
            {g.items.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
