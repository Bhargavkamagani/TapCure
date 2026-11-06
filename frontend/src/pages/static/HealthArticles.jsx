import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  HeartPulse, ArrowRight, ShieldAlert, Stethoscope, Newspaper, ExternalLink, X, Clock,
  BadgeCheck, MapPin, IndianRupee, CalendarCheck,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import { HEALTH_ARTICLES } from '../../data/healthArticles.js'
import { discoveryApi, fileUrl } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { beginBooking } from '../../lib/bookingIntent.js'
import { translitName } from '../../lib/translit.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { useI18n } from '../../i18n/index.jsx'

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
    <section className="mt-14">
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-sage-deep" />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage-deep">{t('sart.news.eyebrow')}</p>
      </div>
      <h2 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">{t('sart.news.title')}</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        {t('sart.news.sub', { brand: BRAND.name })}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => (
          <a
            key={n.link || n.title}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col rounded-2xl border border-white/50 bg-card/70 p-5 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-lift"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-sage/40 px-2.5 py-0.5 text-[11px] font-medium text-sage-deep">{n.source}</span>
              {n.published_at && <span className="text-[11px] text-ink-soft">{fmtDate(n.published_at)}</span>}
            </div>
            <h3 className="mt-2.5 text-sm font-semibold leading-snug text-foreground">{n.title}</h3>
            {n.summary && <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">{n.summary}</p>}
            <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-sage-deep transition-all group-hover:gap-2">
              {t('sart.news.readOn', { source: n.source })} <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </a>
        ))}
      </div>
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
    <div className="flex overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/doctors/${doctor.doctor_id}`} className="relative w-28 shrink-0 bg-gradient-to-br from-teal-50 to-emerald-100" aria-label={t('psearch.viewProfile')}>
        {doctor.profile_photo_url && !failed ? (
          <img src={fileUrl(doctor.profile_photo_url)} alt="" loading="lazy" onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-teal-700"><Stethoscope className="h-7 w-7" /></span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <p className="flex items-center gap-1 truncate text-[15px] font-bold text-foreground">
          <span className="truncate">{translitName(doctor.name, lang)}</span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-teal-600" />
        </p>
        <p className="truncate text-[13px] font-medium text-sage-deep">{specialtyLabel(doctor.specialization, lang)}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-ink-soft">
          <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{translitName(aff?.name || doctor.city || '', lang)}</span>
        </p>
        <span className="mt-1 flex items-center text-[14px] font-bold text-foreground"><IndianRupee className="h-3.5 w-3.5" />{Number(aff?.consultation_fee ?? doctor.consultation_fee ?? 0)}</span>
        {/* One doctor per row in the pop-up (two side by side were too
            narrow: first Book was cut off, then View profile overflowed). */}
        <div className="mt-2 grid max-w-xs grid-cols-2 gap-2">
          <Link to={`/doctors/${doctor.doctor_id}`} className="whitespace-nowrap rounded-lg border border-teal-600 px-3 py-1.5 text-center text-[13px] font-semibold text-teal-700 hover:bg-teal-50">{t('psearch.viewProfile')}</Link>
          <button type="button" onClick={() => onBook(doctor, aff)} className="whitespace-nowrap rounded-lg bg-teal-700 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-teal-800">{t('psearch.book')}</button>
        </div>
      </div>
    </div>
  )
}

/** "Consult a doctor" at the end of an article: up to three real, verified
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
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="mt-8 rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-emerald-50/60 p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold text-foreground"><CalendarCheck className="h-5 w-5 text-teal-700" />{t('sart.consultTitle', { specialty: label })}</p>
          <p className="text-[13.5px] text-ink-soft">{t('sart.consultSub')}</p>
        </div>
        <Link to={`/search?type=doctors&specialty=${encodeURIComponent(found.specialty)}`} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-teal-700 hover:gap-2 hover:underline">
          {t('sart.seeAllDoctors', { specialty: label })} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4 grid gap-3">
        {found.doctors.map((d) => <MiniDoctor key={d.doctor_id} doctor={d} onBook={book} />)}
      </div>
    </motion.section>
  )
}

/**
 * The article as a pop-up over the list (2026-10-02). Read More opens it with
 * a fade + rise; closing (X, Esc, or a click on the dimmed background) plays
 * the same in reverse. The page behind stops scrolling while it is open.
 */
function ArticleModal({ article, onClose, tr, t }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={tr(`sart.${i}.title`, article.title)}
        onClick={(e) => e.stopPropagation()}
        // Slide + fade only. A scale animation (and a blurred backdrop) left
        // the text slightly soft on some screens; ending with no transform at
        // all keeps it pixel-sharp once open.
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0, transitionEnd: { transform: 'none' } }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 pb-4 pt-6 sm:px-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sage/40 px-3 py-1 text-xs font-medium text-sage-deep">
                {tr(`sart.tag.${article.tag}`, article.tag)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-ink-soft"><Clock className="h-3.5 w-3.5" />{t('sart.minRead', { n: article.minutes })}</span>
            </div>
            <h2 className="mt-3 font-serif text-2xl leading-snug text-foreground sm:text-3xl">{tr(`sart.${i}.title`, article.title)}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{tr(`sart.${i}.blurb`, article.blurb)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-card text-ink-soft transition-colors hover:bg-sage/30 hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          <div className="space-y-4">
            {article.body.map((para, j) => (
              <motion.p
                key={para.slice(0, 24)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 + j * 0.06, duration: 0.3 }}
                className="text-[16px] leading-7 text-ink-soft"
              >
                {tr(`sart.${i}.body.${j}`, para)}
              </motion.p>
            ))}
          </div>
          {/* The one line worth seeing even if everything else is skimmed. */}
          <p className="mt-6 flex items-start gap-2 rounded-2xl bg-teal-50/80 px-4 py-3 text-[15px] leading-relaxed text-teal-900">
            <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <span><strong className="font-semibold">{t('sart.whenDoctor')}</strong>{tr(`sart.${i}.see`, article.seeDoctor)}</span>
          </p>
          <p className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-ink-soft">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span><strong className="font-semibold text-foreground">{t('sart.disclaimerStrong')}</strong>{' '}{t('sart.disclaimerBody')}</span>
          </p>

          <ConsultDoctors article={article} />
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Health Articles — what the landing nav's "Health Articles" link opens.
 *
 * General awareness only. Every article ends with a "when to see a doctor"
 * line, and the disclaimer sits at the TOP rather than buried at the bottom:
 * someone skimming a page about their own symptoms should meet it before they
 * meet the content, not after.
 */
export default function HealthArticles() {
  const { t } = useI18n()
  // Article text is keyed by position in HEALTH_ARTICLES; fall back to the
  // data file's English if a newer article has no translation yet.
  const tr = (key, fallback) => {
    const v = t(key)
    return v === key ? fallback : v
  }
  const [tag, setTag] = useState('All')
  const [open, setOpen] = useState(null)
  const openArticle = HEALTH_ARTICLES.find((a) => a.title === open) || null

  const tags = useMemo(
    () => ['All', ...Array.from(new Set(HEALTH_ARTICLES.map((a) => a.tag)))],
    [],
  )
  const shown = tag === 'All' ? HEALTH_ARTICLES : HEALTH_ARTICLES.filter((a) => a.tag === tag)

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={HeartPulse}
          eyebrow={t('sart.eyebrow', { brand: BRAND.name })}
          title={t('sart.title')}
          subtitle={t('sart.subtitle')}
        />

        {/* Read this first, not last. */}
        <div className="mt-10 flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 px-5 py-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-ink-soft">
            <strong className="font-semibold text-foreground">{t('sart.disclaimerStrong')}</strong>{' '}
            {t('sart.disclaimerBody')}
          </p>
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap gap-2">
            {tags.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => { setTag(name); setOpen(null) }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  tag === name
                    ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-sm'
                    : 'border border-border bg-card text-ink-soft hover:text-foreground'
                }`}
              >
                {name === 'All' ? t('sart.all') : tr(`sart.tag.${name}`, name)}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {shown.map((article) => {
              const i = HEALTH_ARTICLES.indexOf(article)
              return (
                <article
                  key={article.title}
                  className="group flex h-full flex-col rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-sage/40 px-3 py-1 text-xs font-medium text-sage-deep">
                      {tr(`sart.tag.${article.tag}`, article.tag)}
                    </span>
                    <span className="text-xs text-ink-soft">{t('sart.minRead', { n: article.minutes })}</span>
                  </div>

                  <h2 className="mt-3 font-serif text-xl leading-snug text-foreground">{tr(`sart.${i}.title`, article.title)}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{tr(`sart.${i}.blurb`, article.blurb)}</p>


                  <button
                    type="button"
                    onClick={() => setOpen(article.title)}
                    aria-haspopup="dialog"
                    className="mt-4 inline-flex items-center gap-1 self-start text-sm font-medium text-sage-deep transition-all hover:gap-2"
                  >
                    {t('sart.readMore')}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <HealthNews />
      </main>

      <AnimatePresence>
        {openArticle && (
          <ArticleModal key={openArticle.title} article={openArticle} onClose={() => setOpen(null)} tr={tr} t={t} />
        )}
      </AnimatePresence>
    </StaticPageShell>
  )
}
