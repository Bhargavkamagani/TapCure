import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X, ArrowLeft, ArrowRight, Stethoscope, BadgeCheck } from 'lucide-react'
import { HEALTH_ARTICLES } from '../../data/healthArticles.js'
import { discoveryApi, fileUrl } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { beginBooking } from '../../lib/bookingIntent.js'
import { translitName } from '../../lib/translit.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Health Articles — on the landing page's look (StaticPageShell `modern`, 2026-11-07).
 * Three things, top to bottom: a "what's worrying you?" search, topic buttons,
 * and the articles as photo cards (three per row). An article opens as a full
 * page: photo, text, "when to see a doctor", then real TapCure doctors to book.
 *
 * Photos live in public/health-articles/a{index}.jpg, one per article in
 * HEALTH_ARTICLES order. They are CC0 / public-domain photos found via Openverse,
 * so they need no licence fee or credit. A new article without a photo shows a
 * soft teal block instead.
 */

const photo = (i) => `/health-articles/a${i}.jpg`

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The text with every searched word marked. */
function Marked({ text, words }) {
  if (!words.length) return text
  const parts = text.split(new RegExp(`(${words.map(escape).join('|')})`, 'gi'))
  return parts.map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-[#00C9C5]/25 px-0.5 text-inherit">{p}</mark> : p))
}

/** A photo that quietly becomes a soft block if the file is missing. */
function Photo({ i, className }) {
  const [failed, setFailed] = useState(false)
  return failed
    ? <span aria-hidden="true" className={`block bg-[#0A9A96]/10 ${className}`} />
    : <img src={photo(i)} alt="" loading="lazy" onError={() => setFailed(true)} className={`block object-cover ${className}`} />
}

/**
 * Live headlines from official public-health newsrooms, proxied and cached by
 * the backend. Renders NOTHING at all when no feed is configured or a source is
 * unreachable — a news strip that shows "nothing to show" is worse than no strip,
 * and stale filler is what made this page a problem in the first place.
 *
 * Every item carries its source and date, so a reader can judge how current it
 * is rather than trusting the word "news".
 */
function HealthNews() {
  const { t } = useI18n()
  const [items, setItems] = useState([])

  useEffect(() => {
    let active = true
    discoveryApi.healthNews(6)
      .then((r) => active && setItems(r?.items || []))
      .catch(() => active && setItems([]))
    return () => { active = false }
  }, [])

  if (!items.length) return null

  return (
    <section className="mt-20">
      <h2 className="text-[22px] font-bold text-[#0B2150]">{t('sart.news.head')}</h2>
      <p className="mt-1.5 text-[15px] text-[#6B7A8F]">{t('sart.news.subShort')}</p>
      <ul className="mt-4 grid border-t border-[#0B2150]/10 md:grid-cols-2 md:gap-x-14">
        {items.map((n) => (
          <li key={n.link || n.title} className="border-b border-[#0B2150]/10 py-4">
            <span className="block text-[13.5px] text-[#6B7A8F]">
              {n.source}{n.published_at && ` · ${fmtDate(n.published_at)}`}
            </span>
            <a href={n.link} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[16.5px] font-semibold text-[#0B2150] hover:text-[#0A9A96]">
              {n.title} ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Which doctors an article points to: preferred speciality first, General
// Physician as the fallback (every topic has one, and a GP refers on). Only
// specialities TapCure actually lists come back from the search, so a missing
// one just falls through to the next.
const TOPIC_SPECIALTIES = {
  'Heart Health': ['Cardiology', 'General Physician'],
  Diabetes: ['Endocrinology', 'Diabetology', 'General Physician'],
  'Child Health': ['Pediatrics', 'Paediatrics', 'General Physician'],
  Medicines: ['General Physician'],
  'Women’s Health': ['Gynecology', 'Gynaecology', 'Obstetrics & Gynaecology', 'General Physician'],
  Prevention: ['General Physician'],
  'Mental Health': ['Psychiatry', 'Psychology', 'General Physician'],
  Nutrition: ['Nutrition', 'General Physician'],
}

function MiniDoctor({ doctor, onBook }) {
  const { t, lang } = useI18n()
  const [failed, setFailed] = useState(false)
  const aff = doctor.affiliations?.[0]
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-[#0B2150]/10 py-3.5">
      <Link to={`/doctors/${doctor.doctor_id}`} aria-label={t('psearch.viewProfile')} className="relative h-12 w-12 overflow-hidden rounded-full bg-[#0A9A96]/10">
        {doctor.profile_photo_url && !failed ? (
          <img src={fileUrl(doctor.profile_photo_url)} alt="" loading="lazy" onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[#0A9A96]"><Stethoscope className="h-5 w-5" /></span>
        )}
      </Link>
      <div className="min-w-0">
        <Link to={`/doctors/${doctor.doctor_id}`} className="flex items-center gap-1 text-[16px] font-semibold text-[#0B2150] hover:text-[#0A9A96]">
          <span className="truncate">{translitName(doctor.name, lang)}</span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-[#0A9A96]" />
        </Link>
        <p className="truncate text-[14px] text-[#6B7A8F]">
          {specialtyLabel(doctor.specialization, lang)}
          {(aff?.name || doctor.city) && ` · ${translitName(aff?.name || doctor.city || '', lang)}`}
          {` · ₹${Number(aff?.consultation_fee ?? doctor.consultation_fee ?? 0)}`}
        </p>
      </div>
      <button type="button" onClick={() => onBook(doctor, aff)} className="whitespace-nowrap rounded-full bg-[#0A9A96] px-[18px] py-2 text-[14.5px] font-semibold text-white hover:bg-[#088582]">
        {t('psearch.book')}
      </button>
    </div>
  )
}

/** "Book a doctor" at the end of an article: up to three real, verified
 *  TapCure doctors for the article's topic, each bookable, plus a link to the
 *  full list. Renders nothing if none are found (or the search fails) — an
 *  empty "no doctors" box at the end of a health article helps no one. */
function ConsultDoctors({ article }) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [found, setFound] = useState(null)   // { specialty, doctors }

  useEffect(() => {
    let alive = true
    const order = TOPIC_SPECIALTIES[article.tag] || ['General Physician']
    ;(async () => {
      for (const specialty of order) {
        try {
          const r = await discoveryApi.search({ type: 'doctors', specialty })
          const doctors = (r?.doctors || []).filter((d) => (d.status === undefined || d.status === 'active') && d.has_timings !== false)
          if (doctors.length) {
            // Doctors with a photo first: the strip is meant to feel personal.
            doctors.sort((a, b) => Number(!!b.profile_photo_url) - Number(!!a.profile_photo_url))
            if (alive) setFound({ specialty, doctors: doctors.slice(0, 3) })
            return
          }
        } catch { /* try the next speciality */ }
      }
      if (alive) setFound({ specialty: null, doctors: [] })
    })()
    return () => { alive = false }
  }, [article])

  if (!found?.doctors?.length) return null
  const label = specialtyLabel(found.specialty, lang)
  const book = (doctor, aff) => beginBooking({ user, navigate, doctorId: doctor.doctor_id, affiliationId: aff?.affiliation_id })

  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="mt-11">
      <h2 className="text-[20px] font-bold text-[#0B2150]">{t('sart.bookTitle', { specialty: label })}</h2>
      <p className="mt-0.5 text-[15px] text-[#6B7A8F]">{t('sart.bookSub')}</p>
      <div className="mt-2">
        {found.doctors.map((d) => <MiniDoctor key={d.doctor_id} doctor={d} onBook={book} />)}
      </div>
      <Link to={`/search?type=doctors&specialty=${encodeURIComponent(found.specialty)}`} className="mt-3.5 inline-block text-[15px] font-semibold text-[#0A9A96] hover:underline">
        {t('sart.seeAllDoctors', { specialty: label })} →
      </Link>
    </motion.section>
  )
}

/**
 * The article as a full page over the list: photo, text, when to see a doctor,
 * then doctors. Back / X / Esc close it; the page behind stops scrolling.
 */
function ArticleReader({ article, onClose, tr, t }) {
  const i = HEALTH_ARTICLES.indexOf(article)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={tr(`sart.${i}.title`, article.title)}
      className="fixed inset-0 z-[60] overflow-y-auto bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="sticky top-0 z-[2] border-b border-[#0B2150]/10 bg-white">
        <div className="mx-auto flex max-w-[1140px] items-center justify-between px-5 py-3.5">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 py-1.5 text-[16px] font-semibold text-[#41526E] hover:text-[#0A9A96]">
            <ArrowLeft className="h-4 w-4" /> {t('sart.back')}
          </button>
          <button type="button" onClick={onClose} aria-label={t('sart.close')} className="p-1.5 text-[#41526E] hover:text-[#0A9A96]">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Wide photo on top; below it two sides on desktop — the text on the left,
          "when to see a doctor" and the doctors on the right, staying in view
          while the text scrolls. Phones stack them. */}
      <div className="mx-auto max-w-[1140px] px-5 pb-[88px] pt-8">
        <Photo i={i} className="aspect-[2/1] w-full rounded-[18px] lg:aspect-[21/8]" />

        <div className="mt-9 grid gap-10 lg:grid-cols-[minmax(0,700px)_340px] lg:justify-between">
          <article className="min-w-0">
            <p className="text-[14px] font-semibold text-[#0A9A96]">
              {tr(`sart.tag.${article.tag}`, article.tag)} <span className="font-medium text-[#6B7A8F]">· {t('sart.minRead', { n: article.minutes })}</span>
            </p>
            <h1 className="mt-2 text-[32px] font-bold leading-[1.2] tracking-[-0.015em] text-[#0B2150]">{tr(`sart.${i}.title`, article.title)}</h1>
            <p className="mt-2.5 text-[18px] text-[#41526E]">{tr(`sart.${i}.blurb`, article.blurb)}</p>

            <div className="mt-7 space-y-[18px]">
              {article.body.map((para, j) => (
                <p key={para.slice(0, 24)} className="text-[17.5px] leading-[1.75] text-[#0B2150]">{tr(`sart.${i}.body.${j}`, para)}</p>
              ))}
            </div>

            <p className="mt-8 text-[14px] text-[#6B7A8F]">
              <strong className="font-semibold text-[#41526E]">{t('sart.disclaimerStrong')}</strong>{' '}{t('sart.disclaimerBody')}
            </p>
          </article>

          <aside className="min-w-0 lg:sticky lg:top-[84px] lg:self-start">
            {/* The one line worth seeing even if everything else is skimmed. */}
            <div className="rounded-[4px_12px_12px_4px] border-l-[3px] border-[#C2410C] bg-[#C2410C]/[.07] px-5 py-[18px]">
              <p className="text-[15px] font-semibold text-[#C2410C]">{t('sart.whenDoctorHead')}</p>
              <p className="mt-1.5 text-[15.5px] leading-relaxed text-[#0B2150]">{tr(`sart.${i}.see`, article.seeDoctor)}</p>
            </div>
            <ConsultDoctors article={article} />
          </aside>
        </div>
      </div>
    </motion.div>
  )
}

export default function HealthArticles() {
  const { t } = useI18n()
  // Article text is keyed by position in HEALTH_ARTICLES; fall back to the
  // data file's English if a newer article has no translation yet.
  const tr = (key, fallback) => {
    const v = t(key)
    return v === key ? fallback : v
  }
  const [tag, setTag] = useState('All')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const openArticle = HEALTH_ARTICLES.find((a) => a.title === open) || null

  const tags = useMemo(
    () => ['All', ...Array.from(new Set(HEALTH_ARTICLES.map((a) => a.tag)))],
    [],
  )

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  // Searching looks through every article (whatever topic is picked), in the
  // reader's language and in English, including the "see a doctor" line.
  const text = (a, i) => [
    tr(`sart.${i}.title`, a.title), tr(`sart.${i}.blurb`, a.blurb), tr(`sart.${i}.see`, a.seeDoctor),
    tr(`sart.tag.${a.tag}`, a.tag), ...a.body.map((p, j) => tr(`sart.${i}.body.${j}`, p)),
    a.title, a.blurb, a.seeDoctor, a.tag, ...a.body,
  ].join(' ').toLowerCase()
  const shown = words.length
    ? HEALTH_ARTICLES.filter((a, i) => { const s = text(a, i); return words.every((w) => s.includes(w)) })
    : (tag === 'All' ? HEALTH_ARTICLES : HEALTH_ARTICLES.filter((a) => a.tag === tag))

  const count = shown.length === 1 ? t('sart.count1') : t('sart.count', { n: shown.length })
  const countLine = words.length
    ? t('sart.countFor', { count, q: query.trim() })
    : (tag === 'All' ? count : t('sart.countIn', { count, tag: tr(`sart.tag.${tag}`, tag) }))

  return (
    <StaticPageShell modern title={t('sart.title')}>
      <main className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8">
        {/* ── 1: heading and search ── */}
        <section role="search" className="pt-12 text-center">
          <h1 className="text-[30px] font-bold tracking-[-0.015em] text-[#0B2150] sm:text-[34px]">{t('sart.title')}</h1>
          <p className="mt-2 text-[17px] text-[#41526E]">{t('sart.lede')}</p>
          <div className="relative mx-auto mt-7 max-w-[640px]">
            <Search aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7A8F]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sart.searchPh')}
              aria-label={t('sart.searchLabel')}
              autoComplete="off"
              className="w-full rounded-full border-[1.5px] border-[#0B2150]/10 bg-white px-[52px] py-4 text-[18px] text-[#0B2150] shadow-[0_6px_24px_-14px_rgba(11,33,80,.35)] outline-none transition-colors placeholder:text-[#6B7A8F] focus:border-[#0A9A96] [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('sart.clear')} className="absolute right-3.5 top-1/2 -translate-y-1/2 p-2 text-[#6B7A8F] hover:text-[#0B2150]">
                <X className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>

          {/* ── 2: topic buttons ── */}
          <div role="group" aria-label={t('sart.title')} className="mt-[22px] flex flex-wrap justify-center gap-2.5">
            {tags.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={!words.length && tag === name}
                onClick={() => { setTag(name); setQuery('') }}
                className={`rounded-full border-[1.5px] px-4 py-2 text-[15px] font-semibold transition-colors ${
                  !words.length && tag === name
                    ? 'border-[#0A9A96] bg-[#0A9A96] text-white'
                    : 'border-[#0B2150]/10 bg-white text-[#41526E] hover:border-[#0A9A96] hover:text-[#0A9A96]'
                }`}
              >
                {name === 'All' ? t('sart.all') : tr(`sart.tag.${name}`, name)}
              </button>
            ))}
          </div>
        </section>

        {/* ── 3: the articles, three per row ── */}
        <p aria-live="polite" className="mt-11 text-[15px] text-[#6B7A8F]">{countLine}</p>
        {shown.length ? (
          <div className="mt-4 grid gap-x-9 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((article) => {
              const i = HEALTH_ARTICLES.indexOf(article)
              return (
                <button
                  key={article.title}
                  type="button"
                  onClick={() => setOpen(article.title)}
                  aria-haspopup="dialog"
                  className="group block min-w-0 text-left"
                >
                  <span className="block aspect-[16/10] overflow-hidden rounded-2xl bg-[#0A9A96]/10">
                    <Photo i={i} className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
                  </span>
                  <span className="mt-4 block text-[13.5px] font-semibold text-[#0A9A96]">{tr(`sart.tag.${article.tag}`, article.tag)}</span>
                  <span className="mt-1 block text-[19px] font-bold leading-[1.3] text-[#0B2150] transition-colors group-hover:text-[#0A9A96]">
                    <Marked text={tr(`sart.${i}.title`, article.title)} words={words} />
                  </span>
                  <span className="mt-1.5 block text-[15.5px] text-[#41526E]">
                    <Marked text={tr(`sart.${i}.blurb`, article.blurb)} words={words} />
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-[14px] font-semibold text-[#6B7A8F] group-hover:text-[#0A9A96]">
                    {t('sart.readMins', { n: article.minutes })} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="py-8 text-[17px] text-[#41526E]">
            {t('sart.none')}{' '}
            <Link to="/search" className="font-semibold text-[#0A9A96] hover:underline">{t('sart.findDoctor')} →</Link>
          </p>
        )}
        <p className="mt-10 text-center text-[14px] text-[#6B7A8F]">{t('sart.shortNote')}</p>

        <HealthNews />
      </main>

      <AnimatePresence>
        {openArticle && (
          <ArticleReader key={openArticle.title} article={openArticle} onClose={() => setOpen(null)} tr={tr} t={t} />
        )}
      </AnimatePresence>
    </StaticPageShell>
  )
}
