import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * FAQ — on the landing page's look (StaticPageShell `modern`, 2026-11-07).
 * One search line that looks through every audience, an underline switch for
 * Patients / Hospitals / Doctors, then one calm column: small group headings
 * and plain ruled questions that open in place. No cards.
 *
 * Text lives in i18n/dict/staticFaq.js as `sfaq.<audience>.<id>.q` / `.a`.
 * Answers were checked against the code on 2026-11-07: the hospital price
 * answer now matches the Pricing page, "where enabled" was dropped from
 * prescription upload, and "Can AI explain my prescription?" is no longer
 * shown (not in the patient app; its keys are kept).
 */

const GROUPS = {
  patient: [
    ['sfaq.g.start', ['what', 'hospital', 'langs']],
    ['sfaq.g.booking', ['booking', 'cost', 'consultFee', 'family']],
    ['sfaq.g.queue', ['token', 'track', 'travel', 'delay']],
    ['sfaq.g.data', ['upload', 'safe']],
  ],
  hospital: [
    ['sfaq.g.joining', ['join', 'verify']],
    ['sfaq.g.price', ['cost', 'after', 'walkinCount']],
    ['sfaq.g.opd', ['queue', 'walkin', 'doctors', 'notify', 'reports']],
  ],
  doctor: [
    ['sfaq.g.joining', ['join', 'docs', 'verify']],
    ['sfaq.g.price', ['cost']],
    ['sfaq.g.practice', ['avail', 'queue', 'rx', 'delay', 'reports', 'multi']],
  ],
}
const ORDER = ['patient', 'hospital', 'doctor']

// A link shown after an answer, where it helps.
const LINKS = {
  'hospital.cost': ['/pricing', 'sfaq.seePrice'],
  'patient.safe': ['/privacy', 'sfaq.readPrivacy'],
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The text with every searched word marked. */
function Marked({ text, words }) {
  if (!words.length) return text
  const parts = text.split(new RegExp(`(${words.map(escape).join('|')})`, 'gi'))
  return parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-[#00C9C5]/25 px-0.5 text-inherit">{p}</mark> : p))
}

function Question({ q, a, link, who, words, open: startOpen }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="border-b border-[#0B2150]/10">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-5 py-[18px] text-left text-[19px] font-semibold leading-snug text-[#0B2150]"
      >
        <span>
          {who && <span className="mr-2.5 align-[2px] text-[12.5px] font-bold text-[#2F58B7]">{who}</span>}
          <Marked text={q} words={words} />
        </span>
        <span aria-hidden="true" className={`shrink-0 text-[26px] leading-[.9] text-[#0A9A96] transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && (
        <p className="-mt-1 max-w-[62ch] pb-5 text-[17px] leading-relaxed text-[#41526E]">
          <Marked text={a} words={words} />
          {link && <> <Link to={link[0]} className="font-semibold text-[#0A9A96] hover:underline">{t(link[1])} →</Link></>}
        </p>
      )}
    </div>
  )
}

export default function FAQ() {
  const { t } = useI18n()
  const [audience, setAudience] = useState('patient')
  const [query, setQuery] = useState('')

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const entry = (aud, id) => ({
    key: `${aud}.${id}`,
    q: t(`sfaq.${aud}.${id}.q`),
    a: t(`sfaq.${aud}.${id}.a`),
    link: LINKS[`${aud}.${id}`],
    aud,
  })

  // Searching looks through every audience at once.
  const hits = words.length
    ? ORDER.flatMap((aud) => GROUPS[aud].flatMap(([, ids]) => ids.map((id) => entry(aud, id))))
      .filter((e) => { const text = `${e.q} ${e.a}`.toLowerCase(); return words.every((w) => text.includes(w)) })
    : []

  const tab = (key) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={audience === key}
      onClick={() => setAudience(key)}
      className={`relative whitespace-nowrap pb-3 pt-1.5 text-[17px] font-semibold transition-colors sm:text-[19px] ${audience === key ? 'text-[#0B2150]' : 'text-[#6B7A8F] hover:text-[#0B2150]'}`}
    >
      {t(`sfaq.${key}.label`)}
      <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] transition-transform duration-300 ${audience === key ? 'scale-x-100' : 'scale-x-0'}`} />
    </button>
  )

  const groupHead = 'mb-1.5 text-[14px] font-bold uppercase tracking-[0.06em] text-[#0A9A96]'

  return (
    <StaticPageShell modern title={t('sfaq.title')}>
      {/* Desktop: two sides at the header's width — the left (heading, search, switch,
          contact) stays in place while the questions on the right scroll. Phones stack. */}
      <main className="mx-auto grid max-w-[1200px] px-5 sm:px-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-20">
        {/* ── left: headline, search, switch ── */}
        {/* Desktop: as tall as the window under the header, content in its vertical middle.
            --app-vh is the real window height even when DisplayScale zooms the page. */}
        <section className="pb-2 pt-14 text-center sm:pt-20 lg:sticky lg:top-[72px] lg:flex lg:h-[calc(var(--app-vh,1vh)*100_-_72px)] lg:flex-col lg:justify-center lg:self-start lg:py-8 lg:text-left">
          <h1 className="text-[40px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[64px] lg:text-[56px]">
            {t('sfaq.h1a')} <span className="bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] bg-clip-text text-transparent lg:block">{t('sfaq.h1b')}</span>
          </h1>
          <div role="search" className="relative mx-auto mt-8 max-w-[620px] lg:mx-0">
            <Search aria-hidden="true" className="pointer-events-none absolute left-1 top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-[#6B7A8F]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sfaq.searchPh')}
              aria-label={t('sfaq.searchPh')}
              autoComplete="off"
              className="w-full border-0 border-b-2 border-[#0B2150]/15 bg-transparent px-10 py-3.5 text-[21px] font-medium text-[#0B2150] outline-none transition-colors placeholder:text-[#6B7A8F] focus:border-[#0A9A96] [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('sfaq.clear')} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-[#6B7A8F] hover:text-[#0B2150]">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="mt-3.5 text-[14.5px] text-[#6B7A8F]">
            {t('sfaq.try')}
            {t('sfaq.tryWords').split('|').map((w) => (
              <button key={w} type="button" onClick={() => setQuery(w)} className="px-1.5 font-semibold text-[#0A9A96] hover:underline">{w}</button>
            ))}
          </p>
          {!words.length && (
            <div role="tablist" aria-label={t('sfaq.for')} className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 sm:gap-x-9 lg:justify-start lg:gap-x-7">
              {ORDER.map(tab)}
            </div>
          )}
          {/* On desktop the way to the team sits here, always in view. */}
          <p className="mt-12 hidden text-[17px] text-[#41526E] lg:block">
            {t('sfaq.stillLine')}{' '}
            <Link to="/contact" className="font-semibold text-[#0A9A96] hover:underline">{t('sfaq.contactTeam')} →</Link>
          </p>
        </section>

        {/* ── right: the questions ── */}
        <section aria-live="polite" className="mx-auto w-full max-w-[760px] pb-6 pt-12 lg:mx-0 lg:max-w-none lg:pt-24">
          {words.length > 0 ? (
            hits.length > 0 ? (
              <div>
                <h2 className={groupHead}>{hits.length === 1 ? t('sfaq.hit1') : t('sfaq.hits', { n: hits.length })}</h2>
                {hits.map((e) => (
                  <Question key={`${query}|${e.key}`} q={e.q} a={e.a} link={e.link} who={t(`sfaq.who.${e.aud}`)} words={words} open />
                ))}
              </div>
            ) : (
              <p className="py-8 text-[18px] text-[#41526E]">
                {t('sfaq.none', { q: query.trim() })}{' '}
                <Link to="/contact" className="font-semibold text-[#0A9A96] hover:underline">{t('sfaq.askTeam')} →</Link>
              </p>
            )
          ) : (
            GROUPS[audience].map(([head, ids], gi) => (
              <div key={head} className={gi ? 'mt-11' : ''}>
                <h2 className={groupHead}>{t(head)}</h2>
                {ids.map((id, i) => {
                  const e = entry(audience, id)
                  return <Question key={e.key} q={e.q} a={e.a} link={e.link} words={[]} open={gi === 0 && i === 0} />
                })}
              </div>
            ))
          )}
        </section>

        {/* ── one line to the team (phones and tablets; desktop shows it on the left) ── */}
        <p className="pb-10 pt-14 text-center text-[19px] text-[#41526E] lg:col-span-2 lg:hidden">
          {t('sfaq.stillLine')}{' '}
          <Link to="/contact" className="font-semibold text-[#0A9A96] hover:underline">{t('sfaq.contactTeam')} →</Link>
        </p>
      </main>
    </StaticPageShell>
  )
}
