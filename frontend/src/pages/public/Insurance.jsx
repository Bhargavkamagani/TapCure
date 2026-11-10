/**
 * Public Insurance page (/insurance, header tab, 2026-11-03).
 *
 * Two views, both from STATIC data only (public/insurers/network-hospitals.json,
 * compiled from the insurers' public directories; loaded only on this page):
 *   1. Insurer cards in 4 groups (the page's first design) with how many
 *      network hospitals each insurer lists. Insurers with no data are greyed.
 *   2. /insurance?insurer=<code>: that insurer's hospitals, with city filter
 *      and search. Display only — these are not TapCure hospitals.
 * The same hospital listed by several insurers (same name + same PIN, exact)
 * is one card showing all of them. Bajaj's delisted hospitals stay hidden
 * until "Show delisted" is ticked.
 * Earlier versions: local/backups/insurance_page_2026-11-03.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MapPin, Navigation, Phone, Search, ShieldCheck, X } from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { InsurerBadge, useInsurers } from '../../components/common/Insurance.jsx'
import { useI18n } from '../../i18n/index.jsx'

const PAGE = 30
const KEEP_TAGS = new Set(['PPN', 'Preferred'])  // the only labels worth a chip

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** "AADHYA CHILDRENS HOSPITAL" / "aadhya childrens" -> "Aadhya Childrens Hospital";
 *  deliberate mixed case ("KIMS Hospitals") kept; first letter always capital. */
const niceName = (s) => {
  const t = s === s.toUpperCase() || s === s.toLowerCase()
    ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase())
    : s
  return t.charAt(0).toUpperCase() + t.slice(1)
}
/** "Bajaj General Insurance (formerly Bajaj Allianz)" -> "Bajaj General". */
const shortName = (s) => String(s || '')
  .replace(/\s*\(.*?\)\s*/g, ' ')
  .replace(/\b(General |Health )?Insurance( Company)?\b/g, '')
  .replace(/\bThe\b/g, '')
  .replace(/\s+/g, ' ').trim()
const telHref = (t) => `tel:${String(t || '').split(/[,/]/)[0].replace(/[^\d+]/g, '')}`

/** Rows -> one entry per hospital (same name + same PIN), insurers merged. */
function mergeRows(rows) {
  const byKey = new Map()
  const out = []
  rows.forEach((r) => {
    const excluded = (r.g || []).includes('Excluded')
    const key = r.p ? `${norm(r.n)}|${r.p}` : null
    let h = key && byKey.get(key)
    if (!h) {
      h = { name: niceName(r.n), addr: r.a || '', city: r.c || '', pin: r.p || '', phone: r.t || '', ins: [], excluded: [] }
      out.push(h)
      if (key) byKey.set(key, h)
    }
    if (!h.addr && r.a) h.addr = r.a
    if (!h.phone && r.t) h.phone = r.t
    if (!h.city && r.c) h.city = r.c
    if (excluded) h.excluded.push(r.i)
    else if (!h.ins.some((x) => x.code === r.i)) h.ins.push({ code: r.i, tags: (r.g || []).filter((g) => KEEP_TAGS.has(g)) })
  })
  // Hospitals listed by the most insurers first (the big, well-known ones), then A-Z.
  return out.sort((a, b) => (b.ins.length - a.ins.length) || a.name.localeCompare(b.name))
}

// Soft tile colours for the monogram, picked from the name so a hospital always
// gets the same one.
const TILE = [
  'bg-teal-50 text-teal-700', 'bg-sky-50 text-sky-700', 'bg-emerald-50 text-emerald-700',
  'bg-indigo-50 text-indigo-700', 'bg-amber-50 text-amber-700', 'bg-rose-50 text-rose-700',
]
const tileFor = (name) => TILE[[...name].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % TILE.length]
const monogram = (name) => {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !/^(the|of|and|dr|sri|shri)$/i.test(w))
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase() || 'H'
}
const mapsHref = (h) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([h.name, h.addr, h.city, h.pin].filter(Boolean).join(', '))}`

/** Hospital card (redesigned 2026-11-03): monogram anchor, name + place, one-line
 *  address, "Accepted by N insurers" as overlapping logos, and a footer pinned
 *  to the bottom (phone · Directions · Call) so every card in a row lines up.
 *  `focus` = the insurer page we're on: its PPN/Preferred label is shown as a
 *  badge and its logo leads the stack. */
function HospitalCard({ h, byCode, t, focus = '' }) {
  const delisted = !h.ins.length
  const ordered = focus ? [...h.ins].sort((a, b) => (b.code === focus) - (a.code === focus)) : h.ins
  const focusTags = h.ins.find((x) => x.code === focus)?.tags || []
  const shownLogos = ordered.slice(0, 5)
  const extra = ordered.length - shownLogos.length
  const phone = h.phone.split(/[,/]/)[0].trim()
  const allNames = h.ins.map((x) => byCode[x.code]?.name || x.code).join(', ')
  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-2xl border bg-white/85 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
      delisted ? 'border-red-200' : 'border-white/70'}`}>
      {h.excluded.length > 0 && (
        <p className="bg-red-50 px-4 py-1.5 text-[12px] font-semibold text-red-700">
          {t('ins.dir.delistedBy', { name: h.excluded.map((c) => shortName(byCode[c]?.name || c)).join(', ') })}
        </p>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[14px] font-bold ${tileFor(h.name)}`} aria-hidden="true">
            {monogram(h.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="line-clamp-2 flex-1 text-[15.5px] font-bold leading-snug text-foreground" title={h.name}>{h.name}</h3>
              {focusTags.map((g) => (
                <span key={g} className="shrink-0 rounded-md bg-teal-700 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">{g}</span>
              ))}
            </div>
            {(h.city || h.pin) && (
              <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-sage-deep">
                <MapPin className="h-3.5 w-3.5 shrink-0" />{[h.city, h.pin].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        {h.addr && <p className="mt-2.5 truncate text-[12.5px] text-ink-soft" title={h.addr}>{h.addr}</p>}

        {h.ins.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2" title={allNames}>
            <span className="text-[12px] font-semibold text-ink-soft">
              {h.ins.length === 1 ? t('ins.dir.acceptedByOne', { name: shortName(byCode[h.ins[0].code]?.name || h.ins[0].code) }) : t('ins.dir.acceptedBy', { n: h.ins.length })}
            </span>
            <span className="flex items-center">
              <span className="flex -space-x-1">
                {shownLogos.map(({ code }) => byCode[code] && <InsurerBadge key={code} insurer={byCode[code]} size="sm" />)}
              </span>
              {extra > 0 && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-500">+{extra}</span>}
            </span>
          </div>
        )}

        {/* Spacer keeps at least 12px above the footer and pins the footer to the bottom. */}
        <div className="min-h-3 flex-1" />
        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <span className={`mr-auto flex min-w-0 items-center gap-1.5 truncate text-[13px] ${phone ? 'font-medium text-foreground' : 'text-ink-soft'}`}>
            <Phone className="h-3.5 w-3.5 shrink-0 text-sage-deep" />{phone || t('ins.dir.noPhone')}
          </span>
          <a href={mapsHref(h)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-2.5 py-1.5 text-[12.5px] font-semibold text-teal-700 hover:bg-teal-50">
            <Navigation className="h-3.5 w-3.5" />{t('ins.dir.directions')}
          </a>
          {phone && (
            <a href={telHref(h.phone)}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-teal-800">
              <Phone className="h-3.5 w-3.5" />{t('ins.dir.call')}
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

/** Paged grid of hospital cards + "Show more". */
function HospitalGrid({ list, byCode, t }) {
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [list])
  if (!list.length) return <p className="mt-4 rounded-2xl bg-white/60 p-6 text-sm text-ink-soft">{t('ins.dir.none')}</p>
  return (
    <>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.slice(0, limit).map((h, i) => <HospitalCard key={`${h.name}-${h.pin}-${i}`} h={h} byCode={byCode} t={t} />)}
      </div>
      {list.length > limit && (
        <div className="mt-6 text-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE)}
            className="rounded-full bg-teal-700 px-7 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-teal-800">
            {t('ins.dir.showMore', { n: Math.min(PAGE, list.length - limit) })}
          </button>
        </div>
      )}
    </>
  )
}

/** View 1: filter bar (type / location / search) + insurer cards grouped, with
 *  hospital counts from the static data. A location or a search also lists the
 *  matching hospitals directly. Filters live in the URL (?type=&city=&q=) so
 *  Back from an insurer keeps them. */
function InsurerCards({ groups, byCode, hospitals, loading, t }) {
  const [params, setParams] = useSearchParams()
  const type = params.get('type') || ''
  const city = params.get('city') || ''
  const q = params.get('q') || ''
  const set = (key, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next, { replace: true })
  }
  const term = q.trim().toLowerCase()

  // Searchable text per hospital: its own name/address/city/PIN + every insurer
  // that lists it, so "star", "yashoda", "kukatpally" and "500072" all work.
  const searchText = useMemo(() => new Map(hospitals.map((h) => [h,
    `${h.name} ${h.addr} ${h.city} ${h.pin} ${h.ins.map((x) => byCode[x.code]?.name || x.code).join(' ')}`.toLowerCase()])), [hospitals, byCode])
  const inType = (code) => !type || byCode[code]?.group === type

  // Hospitals passing location + search (not type: type picks insurers).
  const pool = useMemo(() => hospitals.filter((h) => h.ins.length
    && (!city || h.city === city)
    && (!term || searchText.get(h).includes(term))), [hospitals, city, term, searchText])

  const counts = useMemo(() => {
    const n = {}
    pool.forEach((h) => h.ins.forEach(({ code }) => { n[code] = (n[code] || 0) + 1 }))
    return n
  }, [pool])

  const locations = useMemo(() => {
    const n = {}
    hospitals.forEach((h) => { if (h.city && h.ins.length && (!type || h.ins.some((x) => inType(x.code)))) n[h.city] = (n[h.city] || 0) + 1 })
    return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [hospitals, type, byCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => groups
    .filter((g) => !type || g.key === type)
    .map((g) => {
      const items = g.items
        .map((i) => ({ ...(byCode[i.code] || i), count: counts[i.code] || 0 }))
        // While searching, keep insurers that have matching hospitals or whose
        // own name/state matches; otherwise show the whole group.
        .filter((i) => !term || i.count > 0 || `${i.name} ${i.state || ''}`.toLowerCase().includes(term))
        .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
      return { ...g, items, total: items.reduce((s, i) => s + i.count, 0) }
    })
    .filter((g) => g.items.length)
    // Groups that have hospitals first (the static data has no government schemes yet).
    .sort((a, b) => (b.total > 0) - (a.total > 0)), [groups, byCode, counts, term, type])

  const matching = useMemo(() => (city || term)
    ? pool.filter((h) => !type || h.ins.some((x) => inType(x.code)))
    : [], [pool, city, term, type]) // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = type || city || term
  const cardLink = (code) => `/insurance?insurer=${code}${city ? `&city=${encodeURIComponent(city)}` : ''}`

  return (
    <>
      <div className="mt-8 grid gap-3 rounded-3xl border border-white/60 bg-white/70 p-3.5 shadow-sm backdrop-blur md:grid-cols-[220px_220px_minmax(260px,1fr)]">
        <label className="flex items-center gap-2 rounded-2xl border border-teal-100 bg-white px-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-sage-deep" />
          <select aria-label={t('ins.dir.type')} value={type} onChange={(e) => set('type', e.target.value)}
            className="w-full bg-transparent py-3.5 text-[15px] outline-none">
            <option value="">{t('ins.dir.allTypes')}</option>
            {groups.map((g) => <option key={g.key} value={g.key}>{t(`ins.group.${g.key}`)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-teal-100 bg-white px-4">
          <MapPin className="h-5 w-5 shrink-0 text-sage-deep" />
          <select aria-label={t('ins.dir.city')} value={city} onChange={(e) => set('city', e.target.value)}
            className="w-full bg-transparent py-3.5 text-[15px] outline-none">
            <option value="">{t('ins.dir.allLocations')}</option>
            {locations.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-teal-100 bg-white px-4">
          <Search className="h-5 w-5 shrink-0 text-sage-deep" />
          <span className="sr-only">{t('ins.dir.searchAll')}</span>
          <input value={q} onChange={(e) => set('q', e.target.value)} placeholder={t('ins.dir.searchAll')}
            className="w-full bg-transparent py-3.5 text-[15px] outline-none" />
          {q && <button type="button" onClick={() => set('q', '')} aria-label={t('pm.clearSearch')} className="text-slate-300 hover:text-slate-500"><X className="h-4 w-4" /></button>}
        </label>
      </div>
      {filtered && (
        <button type="button" onClick={() => setParams({}, { replace: true })}
          className="mt-3 text-[13.5px] font-semibold text-teal-700 underline-offset-2 hover:underline">
          {t('ins.dir.clear')}
        </button>
      )}

      {loading ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/50 bg-white/60" />)}
        </div>
      ) : (
        <>
          {!shown.length && !matching.length && (
            <p className="mt-8 rounded-2xl bg-white/60 p-6 text-sm text-ink-soft">{t('ins.page.noMatch', { q: q.trim() || city })}</p>
          )}
          {shown.map((g) => (
            <section key={g.key} className="mt-10">
              <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">
                {t(`ins.group.${g.key}`)} <span className="font-sans text-base text-ink-soft">({g.items.length})</span>
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.items.map((i) => (i.count > 0 ? (
                  <Link key={i.code} to={cardLink(i.code)}
                    className="group flex items-center gap-3 rounded-2xl border border-white/50 bg-card/70 p-4 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-lift">
                    <InsurerBadge insurer={i} size="md" className="!h-11 !w-11 !text-[13px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold leading-snug text-foreground">{i.name}</span>
                      {i.state && <span className="block text-xs text-ink-soft">{i.state}</span>}
                      <span className="mt-1 block text-[13px] font-semibold text-teal-700">
                        {i.count === 1 ? t('ins.page.oneHospital') : t('ins.page.nHospitals', { n: i.count.toLocaleString('en-IN') })}
                        {city && <span className="font-normal text-ink-soft"> · {city}</span>}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-teal-700 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ) : (
                  <div key={i.code} aria-disabled="true"
                    className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/40 p-4 opacity-60">
                    <InsurerBadge insurer={i} size="md" className="!h-11 !w-11 !text-[13px] grayscale" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold leading-snug text-foreground">{i.name}</span>
                      {i.state && <span className="block text-xs text-ink-soft">{i.state}</span>}
                      <span className="mt-1 block text-[13px] text-ink-soft">{city ? t('ins.dir.noneHere', { city }) : t('ins.page.noHospitals')}</span>
                    </span>
                  </div>
                )))}
              </div>
            </section>
          ))}

          {(city || term) && (
            <section className="mt-12" id="matching-hospitals">
              <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">
                {t('ins.dir.matching')} <span className="font-sans text-base text-ink-soft">({matching.length.toLocaleString('en-IN')})</span>
              </h2>
              <HospitalGrid list={matching} byCode={byCode} t={t} />
            </section>
          )}
        </>
      )}
    </>
  )
}

/** View 2: one insurer's network hospitals. */
function InsurerHospitals({ code, hospitals, byCode, source, initialCity = '', t }) {
  const [city, setCity] = useState(initialCity)
  const [q, setQ] = useState('')
  const [showDelisted, setShowDelisted] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [city, q, showDelisted])
  useEffect(() => { setCity(initialCity); setQ(''); setShowDelisted(false) }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  const ins = byCode[code]
  const listed = useMemo(() => hospitals.filter((h) => h.ins.some((x) => x.code === code)), [hospitals, code])
  const delisted = useMemo(() => hospitals.filter((h) => h.excluded.includes(code)), [hospitals, code])
  const term = q.trim().toLowerCase()
  const base = useMemo(() => (showDelisted ? [...listed, ...delisted.filter((h) => !listed.includes(h))] : listed)
    .filter((h) => !term || `${h.name} ${h.addr} ${h.city} ${h.pin}`.toLowerCase().includes(term)), [listed, delisted, showDelisted, term])
  const cities = useMemo(() => {
    const n = {}
    base.forEach((h) => { if (h.city) n[h.city] = (n[h.city] || 0) + 1 })
    return Object.entries(n).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [base])
  const matches = useMemo(() => (city ? base.filter((h) => h.city === city) : base), [base, city])

  return (
    <>
      <Link to={initialCity ? `/insurance?city=${encodeURIComponent(initialCity)}` : '/insurance'} className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />{t('ins.dir.allInsurers')}
      </Link>

      <div className="mt-3 flex items-center gap-4 rounded-3xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
        {ins && <InsurerBadge insurer={ins} size="md" className="!h-14 !w-14 !text-[16px]" />}
        <div className="min-w-0">
          <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">{ins?.name || code}</h2>
          <p className="mt-0.5 text-[14px] text-ink-soft">
            <span className="font-semibold text-teal-700">{t('ins.page.nHospitals', { n: listed.length.toLocaleString('en-IN') })}</span>
            {source && <> · {source.note} · {source.scope}</>}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur sm:grid-cols-[minmax(220px,1fr)_240px]">
        <label className="flex items-center gap-2 rounded-xl border border-teal-100 bg-white px-3.5">
          <Search className="h-5 w-5 shrink-0 text-sage-deep" />
          <span className="sr-only">{t('ins.dir.search')}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ins.dir.search')}
            className="w-full bg-transparent py-3 text-[15px] outline-none" />
          {q && <button type="button" onClick={() => setQ('')} aria-label={t('pm.clearSearch')} className="text-slate-300 hover:text-slate-500"><X className="h-4 w-4" /></button>}
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-teal-100 bg-white px-3.5">
          <MapPin className="h-5 w-5 shrink-0 text-sage-deep" />
          <select aria-label={t('ins.dir.city')} value={city} onChange={(e) => setCity(e.target.value)}
            className="w-full bg-transparent py-3 text-[15px] outline-none">
            <option value="">{t('ins.dir.allCities')}</option>
            {cities.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px] text-ink-soft">
        <span className="font-semibold text-foreground">
          {t('ins.dir.showing', { shown: Math.min(limit, matches.length).toLocaleString('en-IN'), total: matches.length.toLocaleString('en-IN') })}
        </span>
        {(city || term) && (
          <button type="button" onClick={() => { setCity(''); setQ('') }} className="font-semibold text-teal-700 underline-offset-2 hover:underline">
            {t('ins.dir.clear')}
          </button>
        )}
        {delisted.length > 0 && (
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={showDelisted} onChange={(e) => setShowDelisted(e.target.checked)} className="h-4 w-4 accent-red-600" />
            {t('ins.dir.showDelisted', { n: delisted.length })}
          </label>
        )}
      </div>

      {!matches.length ? (
        <p className="mt-5 rounded-2xl bg-white/60 p-6 text-sm text-ink-soft">{t('ins.dir.none')}</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matches.slice(0, limit).map((h, i) => <HospitalCard key={`${h.name}-${h.pin}-${i}`} h={h} byCode={byCode} t={t} focus={code} />)}
        </div>
      )}
      {matches.length > limit && (
        <div className="mt-6 text-center">
          <button type="button" onClick={() => setLimit((n) => n + PAGE)}
            className="rounded-full bg-teal-700 px-7 py-3 text-[15px] font-semibold text-white shadow-sm hover:bg-teal-800">
            {t('ins.dir.showMore', { n: Math.min(PAGE, matches.length - limit) })}
          </button>
        </div>
      )}
    </>
  )
}

export default function InsurancePage() {
  const { t } = useI18n()
  const { groups, byCode, loading } = useInsurers()
  const [params] = useSearchParams()
  const selected = params.get('insurer') || ''
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let on = true
    fetch('/insurers/network-hospitals.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d) => on && setData(d))
      .catch(() => on && setFailed(true))
    return () => { on = false }
  }, [])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [selected])

  const hospitals = useMemo(() => mergeRows(data?.hospitals || []), [data])
  const counts = useMemo(() => {
    const n = {}
    hospitals.forEach((h) => h.ins.forEach(({ code }) => { n[code] = (n[code] || 0) + 1 }))
    return n
  }, [hospitals])
  const known = selected && (counts[selected] || 0) > 0

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-4 pb-20 sm:px-10 lg:px-16">
        <PageHero icon={ShieldCheck} eyebrow={t('ins.page.eyebrow')} title={t('ins.page.title')} subtitle={t('ins.dir.heroSub')} />

        {failed ? (
          <p className="mt-8 rounded-2xl bg-white/60 p-6 text-sm text-ink-soft">{t('ins.dir.loadFailed')}</p>
        ) : known ? (
          <InsurerHospitals code={selected} hospitals={hospitals} byCode={byCode} source={data?.sources?.[selected]} initialCity={params.get('city') || ''} t={t} />
        ) : (
          <InsurerCards groups={groups} byCode={byCode} hospitals={hospitals} loading={loading || !data} t={t} />
        )}

        {data && (
          <p className="mt-10 flex max-w-3xl items-start gap-2 text-[13px] text-ink-soft">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage-deep" />{t('ins.dir.note', { date: data.retrieved })}
          </p>
        )}
      </main>
    </StaticPageShell>
  )
}
