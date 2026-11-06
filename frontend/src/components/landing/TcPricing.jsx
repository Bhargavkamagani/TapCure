import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Hospital plans — the pricing cards in the landing page's closing section.
 *
 * Prices / limits mirror the backend catalog (booking_quota.py CATALOG):
 * yearly = 10 months' price. Styling: `.tcx .pr-*` in pages/LandingPage.jsx.
 *
 * Kept light on purpose: each card shows its four numbers as tiles, the two
 * or three things that set it apart, then a small "Also included" list of
 * what every plan has (the pilot leaves out invoices — it is free).
 *
 * Motion: the cards rise in one after another when the section comes into
 * view, then a light-blue spotlight moves from card to card; hovering a card
 * holds the light on it. Both are off for prefers-reduced-motion.
 *
 * Every button leads to hospital signup, where a new hospital starts on the free
 * 30-day pilot and later picks its paid plan from Plan & Bookings.
 */

// tiles: [doctors, bookings a month, per extra booking, max bill a month]
// highlights: [i18n key, included?] — false is shown muted with a cross.
const PLANS = [
  // Prices shown as X's for now (2026-10-27), one X per digit — the real ones are set later.
  // `shown`: [monthly, yearly (10 months), struck-through 12 months].
  // Previous: starter 499 (₹4 extra, ₹999 max), smart 999 (₹3, ₹1,999), pro 1999 (₹2, ₹4,999).
  { key: 'pilot', free: true, monthly: 0, cta: 'tc.price.pilot.cta',
    tiles: ['∞', '∞', '₹0', '₹0'], highlights: [['every', true], ['whatsapp', true], ['noPay', true]] },
  { key: 'starter', monthly: 0, shown: ['₹0xx', '₹0,xxx', '₹0,xxx'],
    tiles: ['1', '50', '₹0', '₹0xx'], highlights: [['core', true], ['upgrade', true], ['noWhatsapp', false]] },
  { key: 'smart', monthly: 0, popular: true, shown: ['₹0xx', '₹0,xxx', '₹0x,xxx'],
    tiles: ['1', '200', '₹0', '₹0,xxx'], highlights: [['core', true], ['whatsapp', true], ['upgrade', true]] },
  { key: 'pro', monthly: 0, shown: ['₹0,xxx', '₹0x,xxx', '₹0x,xxx'],
    tiles: ['3', '600', '₹0', '₹0,xxx'], highlights: [['core', true], ['whatsapp', true], ['addDoc', true]] },
]
const TILES = ['doctors', 'bookings', 'extra', 'cap']
const EVERY_PLAN = ['queue', 'leave', 'walkins', 'rx', 'pharmacy', 'reports', 'billing']

const SPOT_MS = 2600

// Glitter on hover: [left %, top %, delay s, size px] for the twinkling stars.
const SPARKS = [
  [12, 10, 0, 10], [78, 6, 0.35, 8], [92, 30, 0.8, 12], [8, 42, 1.1, 7],
  [60, 22, 0.55, 6], [86, 62, 0.2, 9], [18, 78, 0.95, 11], [50, 90, 0.45, 8],
  [36, 52, 1.3, 6], [70, 84, 0.7, 7],
]

// The soft light under the cursor follows the mouse (CSS vars, no re-render).
function followMouse(e) {
  const r = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
}
const rupees = (n) => `₹${n.toLocaleString('en-IN')}`

function Mark({ ok = true }) {
  return ok ? (
    <span className="pr-mark yes" aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path d="m5 13 4.5 4.5L19 7" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span className="pr-mark no" aria-hidden="true">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export default function TcPricing() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const [yearly, setYearly] = useState(false)
  const [shown, setShown] = useState(false)
  const [lit, setLit] = useState(2) // start on the most popular plan
  const [hover, setHover] = useState(null)

  // Rise in when the section is first seen.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    if (!('IntersectionObserver' in window)) { setShown(true); return undefined }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Walk the light across the cards once they're in, unless a card is hovered.
  useEffect(() => {
    if (!shown || hover !== null) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => setLit((i) => (i + 1) % PLANS.length), SPOT_MS)
    return () => clearInterval(id)
  }, [shown, hover])

  const active = hover ?? lit

  return (
    <div className={`pr${shown ? ' shown' : ''}`} id="pricing" ref={rootRef}>
      <h2 className="pr-h2">{t('tc.price.h3a')}<br /><span className="serif grad">{t('tc.price.h3b')}</span></h2>
      <p className="pr-lede">{t('tc.price.lede')}</p>

      <div className="pr-toggle" role="group" aria-label={`${t('tc.price.monthly')} / ${t('tc.price.yearly')}`}>
        <button type="button" className={!yearly ? 'on' : ''} aria-pressed={!yearly} onClick={() => setYearly(false)}>
          {t('tc.price.monthly')}
        </button>
        <button type="button" className={yearly ? 'on' : ''} aria-pressed={yearly} onClick={() => setYearly(true)}>
          {t('tc.price.yearly')} <span className="pr-save">{t('tc.price.twoFree')}</span>
        </button>
      </div>

      <div className="pr-grid">
        {PLANS.map((p, i) => {
          const free = !!p.free
          const amount = yearly ? p.monthly * 10 : p.monthly
          return (
            <article
              key={p.key}
              className={`pr-card${p.popular ? ' pop' : ''}${active === i ? ' lit' : ''}`}
              style={{ '--i': i }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => { setHover(null); setLit(i) }}
              onMouseMove={followMouse}
            >
              <span className="pr-shine" aria-hidden="true" />
              <span className="pr-glow" aria-hidden="true" />
              <span className="pr-sparks" aria-hidden="true">
                {SPARKS.map(([x, y, d, s], k) => (
                  <svg key={k} className="pr-spark" width={s} height={s} viewBox="0 0 24 24"
                    style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>
                    <path d="M12 0c.6 5.6 2.4 8.5 6.6 10.3L24 12l-5.4 1.7C14.4 15.5 12.6 18.4 12 24c-.6-5.6-2.4-8.5-6.6-10.3L0 12l5.4-1.7C9.6 8.5 11.4 5.6 12 0Z" fill="currentColor" />
                  </svg>
                ))}
              </span>
              <div className="pr-head">
                <h4 className="pr-name">{t(`tc.price.${p.key}.name`)}</h4>
                {p.popular && <span className="pr-badge">{t('tc.price.popular')}</span>}
              </div>
              <p className="pr-tag">{t(`tc.price.${p.key}.tag`)}</p>

              <div className="pr-price">
                {free ? (
                  <>
                    <span className="pr-amt">{t('tc.price.pilot.price')}</span>
                    <span className="pr-per">{t('tc.price.pilot.term')}</span>
                  </>
                ) : (
                  <>
                    <span className="pr-amt">{p.shown ? p.shown[yearly ? 1 : 0] : rupees(amount)}</span>
                    <span className="pr-per">{yearly ? t('tc.price.perYear') : t('tc.price.perMonth')} {t('tc.price.plusGst')}</span>
                  </>
                )}
              </div>
              <p className={`pr-was${yearly && !free && (p.shown || p.monthly) ? '' : ' empty'}`}>{yearly && !free && (p.shown || p.monthly) ? (p.shown ? p.shown[2] : rupees(p.monthly * 12)) : ' '}</p>

              {/* Number boxes (doctors / bookings / per extra booking / max bill) hidden
                  for now (2026-10-27) — uncomment to bring them back.
              <div className="pr-tiles">
                {TILES.map((tk, j) => (
                  <div className="pr-tile" key={tk}>
                    <span className={`pr-tile-v${p.tiles[j] === '∞' ? ' inf' : ''}`}>{p.tiles[j]}</span>
                    <span className="pr-tile-l">{t(`tc.price.t.${tk}`)}</span>
                  </div>
                ))}
              </div>
              */}

              <ul className="pr-hl">
                {p.highlights.map(([hk, ok]) => (
                  <li key={hk} className={ok ? '' : 'off'}><Mark ok={ok} />{t(`tc.price.h.${hk}`)}</li>
                ))}
              </ul>

              <div className="pr-inc">
                <span className="pr-inc-title">{t('tc.price.allTitle')}</span>
                <ul>
                  {EVERY_PLAN.filter((k) => !(free && k === 'billing')).map((k) => (
                    <li key={k}><Mark />{t(`tc.price.r.${k}`)}</li>
                  ))}
                </ul>
              </div>

              <button type="button" className={`btn ${p.popular || free ? 'btn-primary' : 'btn-ghost'} pr-btn`} onClick={() => navigate('/hospital-signup')}>
                {t(p.cta || 'tc.price.choose')}
              </button>
            </article>
          )
        })}
      </div>

      <div className="pr-hosp">
        <div>
          <h4 className="pr-name">{t('tc.price.hosp.name')} <span className="pr-hosp-price">{t('tc.price.hosp.price')}</span></h4>
          <p className="pr-tag">{t('tc.price.hosp.body')}</p>
        </div>
        <button type="button" className="btn btn-ghost pr-btn" onClick={() => navigate('/contact')}>{t('tc.price.hosp.cta')}</button>
      </div>

      <p className="fine">{t('tc.price.fine')}</p>
    </div>
  )
}
