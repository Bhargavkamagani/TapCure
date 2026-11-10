import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Instagram, Facebook, Linkedin, Youtube, Mail, Phone, MapPin, Clock, ArrowRight } from 'lucide-react'
import { useAuthModal } from '../../context/AuthModalContext.jsx'
import { useI18n } from '../../i18n/index.jsx'
import TcLedger from './TcLedger.jsx'
import TcHowItWorks from './TcHowItWorks.jsx'
import TypeLoop from './TypeLoop.jsx'
import TcPricing from './TcPricing.jsx'

const pad = (n) => String(n).padStart(2, '0')

// Footer social links: add the page address to show an icon.
const SOCIAL = [['Instagram', Instagram, ''], ['Facebook', Facebook, ''], ['LinkedIn', Linkedin, ''], ['YouTube', Youtube, '']]

/**
 * TapCure landing — everything below the hero.
 *
 * Ported from the supplied reference (tapcure.zip) and re-pitched onto the
 * light palette. Styling lives in the page's scoped `<style>` block in
 * `pages/LandingPage.jsx`; this file is structure and the small amount of state
 * the Leave-Now demo needs.
 *
 * The Leave-Now engine runs in DEMO mode exactly as the reference ships it: a
 * modelled Indian-metro traffic curve, no Google key, no network. It is a
 * marketing illustration of the real feature — the live version already exists
 * in the patient console (`roadTravelMinutes` + Distance Matrix) and is not
 * touched here.
 */

/* ─────────────────────────  STATIC SECTIONS  ───────────────────────── */

/* [emoji, i18n key, the English term used for the SEARCH query]. The query stays
   English because that is what the doctor records hold — translating it would
   return nothing. */
/* Fourth field is decimal places, so the rating can count up to 4.8 rather
   than being rounded to 5 by the counter. */
const STATS = [
  [25000, '+', 'lx.stat.kept'],
  [4.8, '', 'lx.stat.rating', 1],
  [5, '', 'lx.stat.family'],
  [1240, '', 'lx.stat.reviews'],
]

const SPECIALTIES = [
  ['🫀', 'tc.spec.cardiology', 'Cardiology'], ['🧠', 'tc.spec.neurology', 'Neurology'],
  ['🦴', 'tc.spec.orthopedics', 'Orthopedics'], ['🩺', 'tc.spec.general', 'General Physician'],
  ['👶', 'tc.spec.pediatrics', 'Pediatrics'], ['🦷', 'tc.spec.dental', 'Dental'],
  ['👁️', 'tc.spec.ophthalmology', 'Ophthalmology'], ['🌿', 'tc.spec.dermatology', 'Dermatology'],
]

/* [quote key, name (a proper noun — never translated), role key, initials, gradient] */
const QUOTES = [
  ['tc.quote1', 'Sneha Mehra', 'tc.quote1.role', 'SM', 'linear-gradient(145deg,#16C7C2,#0A9A96)'],
  ['tc.quote2', 'Karthik Pillai', 'tc.quote2.role', 'KP', 'linear-gradient(145deg,#5B87FF,#2F58B7)'],
  ['tc.quote3', 'Dr. Divya Verma', 'tc.quote3.role', 'DV', 'linear-gradient(145deg,#7FA0FF,#1F3D8F)'],
]

/* Only things that exist. The reference list promised a lock-screen countdown
   and insurance pre-fill — neither is built. The mobile apps are ready but not
   yet listed, so this leads with the web being instant and mentions the apps as
   what is next. It neither offers a download that would go nowhere nor dwells
   on their absence. */
const CHECKS = [
  ['tc.check1.t', 'tc.check1.d'],
  ['tc.check2.t', 'tc.check2.d'],
  ['tc.check3.t', 'tc.check3.d'],
  ['tc.check4.t', 'tc.check4.d'],
]

/**
 * The doctors shown on the landing page.
 *
 * Static on purpose: the card is a sample of what a listing looks like, not a
 * live directory. Hospital names are TapCure's own so the page never implies a
 * partnership with a hospital brand that has not signed one.
 *
 * No slot grid. It used to show six bookable-looking times, which on a page
 * that never checks availability is a promise it cannot keep — the card sends
 * you to search instead.
 */
const DOCTORS = [
  {
    in: 'AR', name: 'Dr. Ananya Rao', specKey: 'tc.spec.cardiology', specQ: 'Cardiology', qual: 'MD, DM',
    hosp: 'Sunrise Hospital, Jubilee Hills', expN: 14, pat: 'lx.doc.langs.teHiEn',
    fee: '₹900', stars: 4.8, reviews: 214, g: 'linear-gradient(145deg,#16C7C2,#0A9A96)',
  },
  {
    in: 'VN', name: 'Dr. Vikram Nair', specKey: 'tc.spec.orthopedics', specQ: 'Orthopedics', qual: 'MS',
    hosp: 'City Care Hospital, Kondapur', expN: 11, pat: 'lx.doc.langs.hiEnMl',
    fee: '₹750', stars: 4.7, reviews: 168, g: 'linear-gradient(145deg,#5B87FF,#2F58B7)',
  },
  {
    in: 'MI', name: 'Dr. Meher Iqbal', specKey: 'tc.spec.dermatology', specQ: 'Dermatology', qual: 'MD',
    hosp: 'Lakeview Skin Hospital, Banjara Hills', expN: 9, pat: 'lx.doc.langs.urHiEn',
    fee: '₹650', stars: 4.9, reviews: 96, g: 'linear-gradient(145deg,#7FA0FF,#1F3D8F)',
  },
]

/**
 * The questions, in the three groups the page actually serves.
 *
 * Every answer is checked against the code rather than the pitch: the fee is
 * config.booking_fee (10.0), the family cap is the `>= 5` guard in
 * routers/patients.py, the languages are the three keys in i18n LANGS, and the
 * hospital report list is the ten endpoints in routers/reports.py. Where a thing
 * does not exist we say so instead of promising it — see the AI answer.
 */
const FAQ_GROUPS = [
  { id: 'patients', label: 'tc.faq.group.patients',
    qs: Array.from({ length: 14 }, (_, i) => [`tc.faq.p${i + 1}.q`, `tc.faq.p${i + 1}.a`]) },
  { id: 'hospitals', label: 'tc.faq.group.hospitals',
    qs: Array.from({ length: 8 }, (_, i) => [`tc.faq.c${i + 1}.q`, `tc.faq.c${i + 1}.a`]) },
  { id: 'doctors', label: 'tc.faq.group.doctors',
    qs: Array.from({ length: 10 }, (_, i) => [`tc.faq.d${i + 1}.q`, `tc.faq.d${i + 1}.a`]) },
]

/** Counts up once, when it first scrolls into view. */
function Counter({ to, suffix, decimals = 0 }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (!('IntersectionObserver' in window)) { setVal(to); return undefined }
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const dur = 1600
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur)
        // ease-out so it decelerates into the final number. Kept as a float
        // and rounded at render, so a rating can land on 4.8 not 5.
        setVal(to * (1 - Math.pow(1 - p, 3)))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [to])
  const shown = val.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return <b ref={ref}>{shown}{suffix}</b>
}

/**
 * The questions, grouped. One panel open at a time inside a group, and
 * switching group resets to the first question so the page never jumps under
 * you mid-read.
 */
function Faq() {
  const { t } = useI18n()
  const [group, setGroup] = useState(0)
  const [open, setOpen] = useState(0)

  return (
    <div className="faq-wrap">
      <div className="faq-tabs rv" role="tablist">
        {FAQ_GROUPS.map((g, i) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={group === i}
            className={`faq-tab${group === i ? ' on' : ''}`}
            onClick={() => { setGroup(i); setOpen(0) }}
          >
            {t(g.label)}
          </button>
        ))}
      </div>

      <div className="faq" key={FAQ_GROUPS[group].id}>
        {FAQ_GROUPS[group].qs.map(([qk, ak], i) => (
          <div className={`faq-row${open === i ? ' on' : ''}`} key={qk}>
            <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <span>{t(qk)}</span>
              <i className="faq-mark" aria-hidden="true" />
            </button>
            <div className="faq-a"><p>{t(ak)}</p></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TcSections() {
  const navigate = useNavigate()
  const { openAuth } = useAuthModal()
  const { t } = useI18n()

  const search = (q) => navigate(`/search?q=${encodeURIComponent(q)}`)

  return (
    <>
      {/* the leave-time road moved to the Features page (2026-11-09) */}
      <TcHowItWorks />

      {/* ── specialties ── */}
      <section className="sec" id="specialties">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow"><TypeLoop text={t('tc.spec.eyebrow')} /></span>
            <h2>{t('tc.spec.h2a')}<br />{t('tc.spec.h2b')} <span className="serif grad">{t('tc.spec.h2c')}</span></h2>
          </div>
          <div className="spec-grid">
            {SPECIALTIES.map(([em, key, query], i) => (
              <button className={`spec rv d${Math.min(i % 4 + 1, 4)}`} key={key} onClick={() => search(query)}>
                <span className="go">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14m-6-7 7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="em">{em}</span>
                <b>{t(`${key}.plain`)}</b>
                <span>{t(`${key}.hint`)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── the minutes ledger (sits between specialties and doctors, as in the
             reference: it hands you a reason to book right before the doctors) ── */}
      <TcLedger />

      {/* ── doctors ── */}
      <section className="sec" id="doctors" style={{ paddingTop: 'clamp(34px,4vw,52px)' }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow"><TypeLoop text={t('tc.doc.availableToday')} /></span>
            <h2>{t('tc.doc.h2a')} <span className="serif grad">{t('tc.doc.h2b')}</span></h2>
            <p className="lede">{t('tc.doc.note')}</p>
          </div>

          <div className="doc-grid">
            {DOCTORS.map((d, di) => (
              <div className={`doc-card rv d${di + 1}`} key={d.name}>
                <div className="doc-head">
                  <span className="doc-photo" style={{ background: d.g }}>{d.in}</span>
                  <span className="doc-meta">
                    <b>{t('lx.demo.' + d.name)}</b>
                    <span>{t(d.specKey)} · {t('lx.demo.' + d.qual)}</span>
                    <span>{t('lx.demo.' + d.hosp)}</span>
                  </span>
                </div>

                {/* Rating, experience and availability on one line — the card
                    used to stack them in three blocks, which pushed the whole
                    section past a screenful. Same facts, a third of the height. */}
                <div className="doc-rate">
                  <span className="doc-stars" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <i key={i} className={i < Math.round(d.stars) ? 'on' : undefined}>★</i>
                    ))}
                  </span>
                  <b>{d.stars.toFixed(1)}</b>
                  <span className="doc-rev">({d.reviews})</span>
                  <span className="doc-dot" aria-hidden="true">·</span>
                  <span className="doc-rev">{d.expN} {t('tc.doc.years')}</span>
                  <span className="doc-free">{t('tc.doc.today')}</span>
                </div>

                <p className="doc-langs">{t(d.pat)}</p>

                <div className="doc-foot">
                  <span className="fee">{t('tc.doc.consultation')} <b>{d.fee}</b></span>
                  <button className="btn btn-primary btn-sm" onClick={() => search(d.specQ)}>
                    {t('tc.doc.findOne')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── stats ── */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="stats rv">
            {STATS.map(([n, suffix, label, dp]) => (
              <div className="stat" key={label}>
                <Counter to={n} suffix={suffix} decimals={dp || 0} />
                <span>{t(label)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── testimonials ── */}
      <section className="sec" id="voices" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head rv">
            <span className="eyebrow"><TypeLoop text={t('tc.quote.eyebrow')} /></span>
            <h2>{t('tc.quote.h2a')} <span className="serif grad">{t('tc.quote.h2b')}</span></h2>
          </div>
          <div className="quotes">
            {QUOTES.map(([qk, name, whoKey, initials, g], i) => (
              <div className={`quote rv d${i}`} key={name}>
                <p>{t(qk)}</p>
                <div className="quote-by">
                  <span className="ava" style={{ background: g }}>{initials}</span>
                  <span><b>{t('lx.demo.' + name)}</b><span>{t(whoKey)}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── app ── */}
      <section className="app-sec" id="app">
        <div className="wrap">
          <div className="app-grid">
            <div>
              <span className="eyebrow rv"><TypeLoop text={t('tc.checks.eyebrow')} /></span>
              <h2 className="rv d1" style={{ marginTop: 18 }}>{t('tc.checks.h2a')}<br /><span className="serif grad">{t('tc.checks.h2b')}</span></h2>
              <div className="checks rv d2">
                {CHECKS.map(([tk, dk]) => (
                  <div className="check" key={tk}>
                    <span className="tick">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="m5 13 4.5 4.5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span><b>{t(tk)}</b><span>{t(dk)}</span></span>
                  </div>
                ))}
              </div>
              <div className="stores rv d3">
                <button className="btn btn-primary btn-lg" onClick={() => openAuth('patient')}>{t('tc.cta.createAccount')}</button>
                <a href="#how" className="btn btn-ghost btn-lg">{t('tc.cta.seeTiming')}</a>
              </div>
            </div>
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* The FAQ section used to sit here. It was removed from the landing page
         because the same 32 questions are on the /faq page, which the footer
         links to. The Faq() component below is kept for that reason only —
         nothing renders it now. */}

      {/* ── cta ── */}
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          {/* The "Free to book / Stop leaving early" call-to-action that sat here
             was replaced by the hospital plans (2026-10-23). Its tc.close.* copy is
             still in i18n/dict/tcLanding.js if it is ever wanted back. */}
          <div className="cta rv">
            <TcPricing />
          </div>
        </div>
      </section>

      <TcFooter />
    </>
  )
}

function PhoneMock() {
  const { t } = useI18n()
  const [left, setLeft] = useState(6442)
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = Math.floor(left / 3600)
  const mm = Math.floor(left / 60) % 60
  const ss = left % 60

  return (
    <div className="phone-stage rv d2">
      <span className="phone-glow" />
      <div className="phone">
        <span className="notch" />
        <div className="phone-screen">
          <div className="ph-top">
            <div className="ph-hello">{t('tc.phone.hello')}</div>
            <div className="ph-name">{t('lx.demo.Rahul')} 👋</div>
          </div>
          <div className="ph-card">
            <span className="kicker">{t('tc.phone.leaveIn')}</span>
            <div className="t">{hh}:{pad(mm)}:{pad(ss)}</div>
            <div className="s">{t('tc.phone.appt')}</div>
          </div>
          <div className="ph-map">
            <svg viewBox="0 0 260 110" preserveAspectRatio="none" aria-hidden="true">
              <rect width="260" height="110" fill="#DCEAF0" />
              <g stroke="#FFFFFF" strokeWidth="5">
                <path d="M0 40H260" /><path d="M0 78H260" /><path d="M70 0V110" /><path d="M170 0V110" />
              </g>
              <path d="M25 95 L25 78 L70 78 L70 40 L170 40 L170 22 L232 22" fill="none" stroke="#00C9C5" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="25" cy="95" r="4.5" fill="#FFFFFF" stroke="#0A9A96" strokeWidth="2.5" />
              <rect x="226" y="16" width="12" height="12" rx="4" fill="#FFFFFF" stroke="#3369FF" strokeWidth="2.5" />
            </svg>
          </div>
          <div className="ph-list">
            {[
              ['lx.phone.traffic', 'lx.phone.trafficSub'],
              ['lx.phone.onSchedule', 'lx.phone.onScheduleSub'],
              ['lx.phone.saved', 'lx.phone.savedSub'],
            ].map(([tk, sk]) => (
              <div className="ph-row" key={tk}>
                <span className="ic">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </span>
                <span><b>{t(tk)}</b><span>{t(sk)}</span></span>
              </div>
            ))}
          </div>
          <div className="ph-tabs"><i className="on" /><i /><i /><i /></div>
        </div>
      </div>
    </div>
  )
}

function TcFooter() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const year = new Date().getFullYear()

  /* Restored 2026-09-01 to the pre-redesign footer the team asked for: a wide
     brand column with the tagline and a "Get in touch" call to action, then
     Explore / Legal / Reach us. Rebuilt in the landing page's own `.tcx`
     palette rather than pasted from the backup — the original used the
     editorial theme's Tailwind tokens (text-sage-deep, text-muted-foreground,
     bg-sage/40), which do not resolve inside `.tcx` and would have rendered
     with fallback colours. Styles live in LandingPage.jsx's <style> block. */
  const EXPLORE = [
    ['tc.foot.about', '/about'], ['tc.foot.features', '/features'], ['tc.foot.pricing', '/pricing'],
    ['tc.foot.faq', '/faq'], ['tc.foot.articles', '/health-articles'], ['tc.foot.contact', '/contact'],
    // 2026-11-02: removed "Help" (same /contact page as Contact) and "Resources"
    // (its posts repeated /features; health content lives on /health-articles).
    // The /resources route still exists in App.jsx for old links.
  ]
  /* Partner routes. "Become a Partner" is the hospital onboarding form; doctors
     running their own practice have a separate sign-up; and a hospital that has
     already registered needs the login, not the form again. */
  const PARTNERS = [
    ['tc.foot.becomePartner', '/hospital-signup'],
    ['tc.foot.joinDoctor', '/doctor-signup'],
    ['tc.foot.hospitalLogin', '/hospital-login'],
  ]
  const LEGAL = [
    ['tc.foot.privacy', '/privacy'],
    ['tc.foot.terms', '/terms'], ['tc.foot.refund', '/cancellation-refund'],
    ['tc.foot.disclaimer', '/medical-disclaimer'],
  ]

  return (
    <footer>
      <div className="wrap">
        <div className="f-grid">
          <div className="f-brand">
            <button className="logo" onClick={() => navigate('/')}>
              <img src="/tapcure-icon.png" alt="" className="logo-img" />
              <span className="f-word">Tap<b>Cure</b><i>{t('tc.foot.tagline')}</i></span>
            </button>
            <p>{t('tc.foot.blurb')}</p>
            <div className="f-ctas">
              <button className="f-cta" onClick={() => navigate('/contact')}>
                {t('tc.foot.getInTouch')} <ArrowRight className="fc-i" />
              </button>
              {/* Hospitals and hospitals join by registering — /hospital-signup is the
                  onboarding form. Existing partners get the Hospital Login link in
                  the Explore column instead. */}
              <button className="f-cta f-cta-alt" onClick={() => navigate('/hospital-signup')}>
                {t('tc.foot.becomePartner')} <ArrowRight className="fc-i" />
              </button>
            </div>
            {/* An icon shows only once its page address is filled in; empty
                links that went nowhere are hidden. */}
            {SOCIAL.some(([, , href]) => href) && (
              <div className="f-social">
                {SOCIAL.filter(([, , href]) => href).map(([n, Icon, href]) => (
                  <a key={n} href={href} target="_blank" rel="noreferrer" aria-label={n}><Icon className="fs-i" /></a>
                ))}
              </div>
            )}
          </div>

          <div className="f-col">
            <h4>{t('tc.foot.explore')}</h4>
            {EXPLORE.map(([label, to]) => (
              <button key={label} onClick={() => navigate(to)}>{t(label)}</button>
            ))}
          </div>

          <div className="f-col">
            <h4>{t('tc.foot.partners')}</h4>
            {PARTNERS.map(([label, to]) => (
              <button key={label} onClick={() => navigate(to)}>{t(label)}</button>
            ))}
          </div>

          <div className="f-col">
            <h4>{t('tc.foot.legal')}</h4>
            {LEGAL.map(([label, to]) => (
              <button key={label} onClick={() => navigate(to)}>{t(label)}</button>
            ))}
          </div>

          {/* Reach us — the same address and number every policy page carries,
              so a patient never finds two ways to contact us that disagree. */}
          <div className="f-col f-reach">
            <h4>{t('tc.foot.reachUs')}</h4>
            <a href="mailto:hello@tapcure.in">
              <span className="f-ico"><Mail className="fr-i" /></span>
              <span className="f-txt">hello@tapcure.in</span>
            </a>
            <a href="tel:+919346821621">
              <span className="f-ico"><Phone className="fr-i" /></span>
              <span className="f-txt">+91 93468 21621</span>
            </a>
            <span className="f-line">
              <span className="f-ico"><MapPin className="fr-i" /></span>
              <span className="f-txt">{t('tc.foot.hyderabad')}</span>
            </span>
            <span className="f-line">
              <span className="f-ico"><Clock className="fr-i" /></span>
              <span className="f-txt">{t('tc.foot.hours')}</span>
            </span>
          </div>
        </div>

        <div className="f-bot">
          <span>© {year} TapCure Health Technologies · Trovate LLP.</span>
          <span style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/privacy')}>{t('tc.foot.privacyShort')}</button>
            <button onClick={() => navigate('/terms')}>{t('tc.foot.termsShort')}</button>
            <button onClick={() => navigate('/cancellation-refund')}>{t('tc.foot.refundsShort')}</button>
            <button onClick={() => navigate('/medical-disclaimer')}>{t('tc.foot.disclaimerShort')}</button>
            <span>{t('tc.foot.madeWith')} ♥</span>
          </span>
        </div>
      </div>
    </footer>
  )
}

export default TcSections
