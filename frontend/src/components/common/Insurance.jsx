/**
 * Insurance tie-ups (2026-11-03): everything the UI needs, in one file.
 *
 *   useInsurers(state)   the one list, from GET /public/insurers (cached)
 *   InsurerBadge         small round logo; initials in the insurer's colour
 *                        until a real logo file is added (see below)
 *   InsuranceLogos       a row of small badges + "+N more" — card top-right
 *   InsuranceList        full grouped list — hospital page / admin views
 *   InsurancePicker      chips + common suggestions + type-to-search —
 *                        hospital Profile and Complete your profile
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
import { BadgeCheck, Search, ShieldCheck, X } from 'lucide-react'
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
  // 2026-11-10: no more full lists of ~70 schemes. A few common ones for this
  // hospital's state are offered as one-tap suggestions; anything else is found
  // by typing (same idea as "Add services"). Picked ones show as chips on top.
  const { t } = useI18n()
  const { groups, byCode, loading } = useInsurers(state)
  const [q, setQ] = useState('')
  const picked = new Set(value || [])
  const term = q.trim().toLowerCase()

  const toggle = (code) => {
    const next = picked.has(code) ? (value || []).filter((c) => c !== code) : [...(value || []), code]
    onChange(next)
  }
  const all = groups.flatMap((g) => g.items)
  const mine = String(state || '').trim().toLowerCase()
  // Suggestions: national schemes + this state's scheme, then the first health insurers.
  const gov = (groups.find((g) => g.key === 'government')?.items || [])
    .filter((i) => !i.state || (mine && i.state.toLowerCase() === mine))
  const health = (groups.find((g) => g.key === 'health')?.items || []).slice(0, 4)
  const suggested = [...gov.slice(0, 5), ...health].filter((i) => !picked.has(i.code))
  const results = term
    ? all.filter((i) => !picked.has(i.code) && `${i.name} ${i.state || ''} ${i.code}`.toLowerCase().includes(term)).slice(0, 10)
    : []

  const row = (i) => (
    <button type="button" key={i.code} onClick={() => { toggle(i.code); setQ('') }}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-left transition-colors hover:border-brand-blue">
      <InsurerBadge insurer={byCode[i.code] || i} size="sm" className="!ring-0" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[12.5px] font-semibold text-slate-700">{i.name}</span>
        {i.state && <span className="block text-[11px] text-slate-400">{i.state}</span>}
      </span>
    </button>
  )

  if (loading) return <p className="text-[13px] text-slate-400">Loading insurances…</p>
  return (
    <div className="flex flex-col gap-3">
      {picked.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(value || []).map((c) => byCode[c] && (
            <button type="button" key={c} onClick={() => toggle(c)} title="Remove"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-green bg-brand-greenLight py-1 pl-1 pr-2 text-[12px] font-semibold text-slate-700">
              <InsurerBadge insurer={byCode[c]} size="xs" className="!ring-0" />{byCode[c].name}<X className="h-3 w-3 text-slate-400" />
            </button>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-[12px] font-semibold text-slate-400 hover:text-red-500">Clear all</button>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 focus-within:border-brand-blue">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${t('ins.search')} (${all.length})`}
          aria-label="Search insurance and schemes"
          className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400" />
        {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="text-slate-300 hover:text-slate-500"><X className="h-4 w-4" /></button>}
      </div>

      {term ? (
        results.length
          ? <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{results.map(row)}</div>
          : <p className="text-[12.5px] text-slate-400">No insurance or scheme matches “{q.trim()}”.</p>
      ) : suggested.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-slate-500">Common ones — tap to add, or type to find others</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{suggested.map(row)}</div>
        </div>
      )}
    </div>
  )
}

// ---- the patient's own insurance (Phase 2, 2026-11-10) ----
/** Edits a patient's / family member's insurances: [{code, policy_no}].
 *  The same suggest-and-search picker, then an optional policy number each. */
export function MyInsuranceEditor({ value, onChange, state = '' }) {
  const { t } = useI18n()
  const { byCode } = useInsurers()
  const items = value || []
  const codes = items.map((i) => i.code)
  const setCodes = (next) => onChange(next.map((c) => items.find((i) => i.code === c) || { code: c, policy_no: '' }))
  const setPolicy = (code, policy_no) => onChange(items.map((i) => (i.code === code ? { ...i, policy_no } : i)))
  return (
    <div className="flex flex-col gap-3">
      <InsurancePicker value={codes} onChange={setCodes} state={state} />
      {items.length > 0 && (
        <div className="grid gap-2">
          {items.map((i) => byCode[i.code] && (
            <label key={i.code} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <InsurerBadge insurer={byCode[i.code]} size="sm" className="!ring-0" />
              <span className="min-w-[120px] flex-1 text-[13px] font-semibold text-slate-700">{byCode[i.code].name}</span>
              <input value={i.policy_no || ''} maxLength={40} onChange={(e) => setPolicy(i.code, e.target.value)}
                placeholder={t('ins.my.policy')} aria-label={`${byCode[i.code].name} – ${t('ins.my.policy')}`}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] outline-none focus:border-brand-blue sm:w-56" />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/** Codes of the person's insurances that this hospital accepts. */
export function acceptedOf(hospitalCodes, insurances) {
  const h = new Set(hospitalCodes || [])
  return (insurances || []).map((i) => i.code).filter((c) => h.has(c))
}

/** Green "✓ Accepts your Star Health" badge; nothing when there is no match.
 *  `overlay`: solid badge for the top-left corner of a hospital photo. */
export function AcceptsYourBadge({ hospitalCodes, insurances, className = '', overlay = false }) {
  const { t } = useI18n()
  const { byCode } = useInsurers()
  const match = acceptedOf(hospitalCodes, insurances)
  if (!match.length) return null
  const first = byCode[match[0]]?.name || match[0]
  const name = match.length > 1 ? `${first} +${match.length - 1}` : first
  if (overlay) {
    return (
      // Just "Accepts your insurance": a patient may hold several, and names
      // don't fit on a photo. The names are in the tooltip and on the hospital page.
      <span title={t('ins.accepts', { name })}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-600 py-1 pl-1 pr-3 text-[12.5px] font-bold text-white shadow-md ring-2 ring-white ${className}`}>
        <BadgeCheck className="h-5 w-5 shrink-0 fill-white text-emerald-600" strokeWidth={2.5} />
        {t('ins.acceptsYours')}
      </span>
    )
  }
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12.5px] font-semibold text-emerald-700 ring-1 ring-emerald-200 ${className}`}>
      <ShieldCheck className="h-3.5 w-3.5" />{t('ins.accepts', { name })}
    </span>
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
