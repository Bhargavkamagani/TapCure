import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import StaticPageShell from './StaticPageShell.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { POLICIES, VARS, COMPANY, CONTACT_EMAIL, CONTACT_PHONE } from '../../pages/legal/policyData.js'

/**
 * The four policy pages (2026-11-07) — laid out like the FAQ page.
 * Left, staying in place: "Policies", the four policies, a search across all of
 * them, and how to reach us. Right: the open policy as one list of rows — the
 * section title with one line in simple words; tap a row to read its full text
 * in place. No title is repeated: the list on the left shows which one is open.
 */

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Marked({ text, words }) {
  if (!words.length) return text
  const parts = text.split(new RegExp(`(${words.map(escape).join('|')})`, 'gi'))
  return parts.map((part, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-[#00C9C5]/25 px-0.5 text-inherit">{part}</mark> : part))
}

/** One section's full legal text. */
function FullText({ section, tv, t }) {
  return (
    <div className="max-w-[80ch] pb-[22px] pl-12 pr-8 max-sm:pl-0 max-sm:pr-0">
      <p className="text-[13.5px] font-semibold text-[#6B7A8F]">{t('lpol.ui.fullText')}</p>
      {section.blocks.map((b, i) => {
        if (b.type === 'ul') return <ul key={i} className="mt-2.5 list-disc pl-5 text-[16px] text-[#41526E] marker:text-[#0A9A96]">{b.keys.map((k) => <li key={k} className="mt-1">{tv(k)}</li>)}</ul>
        if (b.type === 'sub') return <h3 key={i} className="mt-4 text-[16.5px] font-bold text-[#0B2150]">{tv(b.key)}</h3>
        return <p key={i} className="mt-2.5 text-[16.5px] leading-relaxed text-[#41526E]">{tv(b.key)}</p>
      })}
      {section.contact && (
        <p className="mt-2.5 text-[16.5px] leading-relaxed text-[#41526E]">
          {COMPANY} · <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#0A9A96] hover:underline">{CONTACT_EMAIL}</a> · <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="font-semibold text-[#0A9A96] hover:underline">{CONTACT_PHONE}</a>
        </p>
      )}
      {section.readMore && (
        <Link to={section.readMore.to} className="mt-2.5 inline-block font-semibold text-[#0A9A96] hover:underline">{tv(section.readMore.label)} →</Link>
      )}
    </div>
  )
}

export default function PolicyReader({ policy }) {
  const { t } = useI18n()
  const tv = (k) => t(k, VARS)
  const navigate = useNavigate()
  const location = useLocation()
  const doc = POLICIES.find((x) => x.key === policy)
  const [open, setOpen] = useState(() => new Set())
  const [query, setQuery] = useState('')

  // Arriving from a search result (or a #s-N link): open that section and bring it into view.
  useEffect(() => {
    const id = location.state?.open ?? (location.hash.match(/^#s-(\d+)$/)?.[1] != null ? Number(location.hash.slice(3)) : null)
    setOpen(id != null ? new Set([id]) : new Set())
    setQuery('')
    if (id != null) setTimeout(() => document.getElementById(`s-${id}`)?.scrollIntoView({ block: 'center' }), 60)
    else window.scrollTo({ top: 0 })
  }, [policy, location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => setOpen((cur) => {
    const next = new Set(cur)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const allOpen = open.size === doc.sections.length

  // Search looks through all four policies: titles, simple lines and full text.
  const words = query.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 1)
  const index = useMemo(() => POLICIES.flatMap((d) => d.sections.map((s) => ({
    d, s,
    text: [tv(s.title), tv(s.simple), ...s.blocks.flatMap((b) => (b.keys ? b.keys.map(tv) : [tv(b.key)]))].join(' ').toLowerCase(),
  }))), [t]) // eslint-disable-line react-hooks/exhaustive-deps
  const hits = words.length ? index.filter((x) => words.every((w) => x.text.includes(w))) : []

  const effective = doc.effective || (doc.effectiveKey && t(doc.effectiveKey))
  const num = (s) => (s.id ? `${s.id}.` : '')

  return (
    <StaticPageShell modern legal title={t(doc.name)}>
      <main className="mx-auto grid max-w-[1200px] gap-5 px-5 pb-14 sm:px-8 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-16">
        {/* ── left: stays in place, in the window's vertical middle (as on the FAQ) ── */}
        <aside className="pt-8 lg:sticky lg:top-[72px] lg:flex lg:h-[calc(var(--app-vh,1vh)*100_-_72px)] lg:flex-col lg:justify-center lg:self-start lg:py-8">
          <h1 className="text-[40px] font-bold leading-[1.1] tracking-[-0.015em]">{t('lpol.hero.title')}</h1>
          <nav aria-label={t('lpol.hero.title')}>
            <ul className="mt-[22px] flex flex-wrap gap-x-5 gap-y-1 border-b border-[#0B2150]/10 lg:block lg:border-b-0 lg:border-l-2">
              {POLICIES.map((d) => {
                const on = d.key === policy && !words.length
                return (
                  <li key={d.key}>
                    <Link to={d.to} aria-current={on ? 'page' : undefined}
                      className={`block py-2 text-[18px] font-semibold transition-colors lg:-ml-0.5 lg:border-l-2 lg:py-[9px] lg:pl-4 ${on
                        ? 'border-b-[3px] border-[#0A9A96] text-[#0B2150] lg:border-b-0 lg:border-l-[#0A9A96]'
                        : 'border-transparent text-[#6B7A8F] hover:text-[#0B2150]'}`}>
                      {t(d.name)}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <div role="search" className="relative mt-[26px]">
            <Search aria-hidden="true" className="pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7A8F]" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder={t('lpol.ui.searchPh')} aria-label={t('lpol.ui.searchLabel')} autoComplete="off"
              className="w-full border-0 border-b-2 border-[#0B2150]/10 bg-transparent px-8 py-[11px] text-[17px] font-medium text-[#0B2150] outline-none placeholder:font-normal placeholder:text-[#6B7A8F] focus:border-[#0A9A96] [&::-webkit-search-cancel-button]:hidden" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('lpol.ui.clear')} className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-[#6B7A8F] hover:text-[#0B2150]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-[30px] text-[16px] text-[#41526E]">
            {t('lpol.ui.questions')} <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#0A9A96] hover:underline">{CONTACT_EMAIL}</a>
            <br />{t('lpol.ui.or')} <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="font-semibold text-[#0A9A96] hover:underline">{CONTACT_PHONE}</a>
          </p>
        </aside>

        {/* ── right: the policy, or search results ── */}
        <section aria-live="polite" className="min-w-0 lg:pt-16">
          {words.length ? (
            hits.length ? (
              <>
                <p className="text-[15px] text-[#6B7A8F]">{hits.length === 1 ? t('lpol.ui.count1', { q: query.trim() }) : t('lpol.ui.count', { n: hits.length, q: query.trim() })}</p>
                {POLICIES.filter((d) => hits.some((h) => h.d === d)).map((d) => (
                  <div key={d.key}>
                    <p className="mt-[22px] text-[14.5px] font-bold text-[#0A9A96]">{t(d.name)}</p>
                    <div className="mt-1.5 border-t border-[#0B2150]/10">
                      {hits.filter((h) => h.d === d).map(({ s }) => (
                        <button key={s.id} type="button" onClick={() => navigate(d.to, { state: { open: s.id } })}
                          className="group grid w-full grid-cols-[40px_minmax(0,1fr)_24px] gap-2 border-b border-[#0B2150]/10 py-[18px] text-left">
                          <span className="text-[18px] font-bold leading-[1.4] text-[#0A9A96]">{num(s)}</span>
                          <span>
                            <b className="block text-[19px] leading-[1.4] group-hover:text-[#0A9A96]"><Marked text={tv(s.title)} words={words} /></b>
                            <span className="mt-[3px] block text-[16px] text-[#41526E]"><Marked text={tv(s.simple)} words={words} /></span>
                          </span>
                          <span aria-hidden="true" className="text-[22px] text-[#0A9A96]">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[17px] text-[#41526E]">
                {t('lpol.ui.none', { q: query.trim() })}{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#0A9A96] hover:underline">{t('lpol.ui.ask')} →</a>
              </p>
            )
          ) : (
            <>
              {/* No title here: the list on the left already shows which policy is open. */}
              <p className="max-w-[56ch] text-[20px] leading-normal text-[#0B2150]">{tv(doc.lead)}</p>
              <p className="mt-2.5 text-[15px] text-[#6B7A8F]">
                {effective && <>{t('lpol.ui.effective', { date: effective })} · </>}{COMPANY}
                <button type="button" onClick={() => window.print()} className="ml-3.5 font-semibold text-[#0A9A96] hover:underline print:hidden">{t('lpol.ui.print')}</button>
              </p>
              {doc.emergency && (
                <p className="mt-[18px] flex flex-wrap items-center gap-x-3.5 gap-y-2.5 text-[16px] font-semibold text-[#C2410C]">
                  {t('lmd.em.title')}
                  <a href="tel:108" className="rounded-full bg-[#C2410C] px-4 py-2 text-[15.5px] font-bold text-white">{t('lmd.em.ambulance')}</a>
                  <a href="tel:104" className="rounded-full border-[1.5px] border-[#C2410C] px-4 py-2 text-[15.5px] font-bold">{t('lmd.em.helpline')}</a>
                </p>
              )}

              <div className="mt-[26px] border-t border-[#0B2150]/10">
                {doc.sections.map((s) => {
                  const isOpen = open.has(s.id)
                  return (
                    <div key={s.id} id={`s-${s.id}`} className="scroll-mt-24 border-b border-[#0B2150]/10">
                      <button type="button" onClick={() => toggle(s.id)} aria-expanded={isOpen}
                        className="group grid w-full grid-cols-[40px_minmax(0,1fr)_24px] gap-2 py-[18px] text-left">
                        <span className={`text-[18px] font-bold leading-[1.4] ${s.tone === 'warn' ? 'text-[#C2410C]' : 'text-[#0A9A96]'}`}>{num(s)}</span>
                        <span>
                          <b className="block text-[19px] leading-[1.4] group-hover:text-[#0A9A96]">{tv(s.title)}</b>
                          <span className="mt-[3px] block text-[16px] text-[#41526E]">{tv(s.simple)}</span>
                        </span>
                        <span aria-hidden="true" className={`text-[24px] leading-[1.1] text-[#0A9A96] transition-transform motion-reduce:transition-none ${isOpen ? 'rotate-45' : ''}`}>+</span>
                      </button>
                      {isOpen && <FullText section={s} tv={tv} t={t} />}
                    </div>
                  )
                })}
              </div>
              {doc.closing && <p className="mt-5 max-w-[80ch] text-[16px] text-[#41526E]">{tv(doc.closing)}</p>}
              <p className="mt-[18px] text-[14.5px] text-[#6B7A8F]">
                {t('lpol.ui.foot')}{' '}
                <button type="button" onClick={() => setOpen(allOpen ? new Set() : new Set(doc.sections.map((s) => s.id)))} className="font-semibold text-[#0A9A96] hover:underline print:hidden">
                  {allOpen ? t('lpol.ui.closeAll') : t('lpol.ui.openAll')}
                </button>
              </p>
            </>
          )}
        </section>
      </main>
    </StaticPageShell>
  )
}
