import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Hospital plans — the pricing cards in the landing page's closing section.
 *
 * Prices / limits mirror the backend catalog (booking_quota.py CATALOG):
 * yearly = 10 months' price. Styling: `.tcx .pr-*` in pages/LandingPage.jsx.
 *
 * Small cards: name, price, doctors and bookings a month, then the button.
 * Everything else (extra booking price, max bill, highlights, "Also included")
 * sits behind "See details". One switch opens every card together, so the
 * cards stay level and can be compared side by side.
 *
 * Motion: the cards rise in once when the section comes into view. The light
 * rests on the most popular plan and follows the mouse; it never moves on its
 * own. Off for prefers-reduced-motion.
 *
 * Every button leads to hospital signup, where a new hospital starts on the free
 * 30-day pilot and later picks its paid plan from Plan & Bookings.
 */

// tiles: [doctors, bookings a month, per extra booking, max bill a month]
// The first MAIN_TILES show on the small card; the rest sit in "See details".
// highlights: [i18n key, included?] — false is shown muted with a cross.
const PLANS = [
  // `shown`: [monthly, yearly (10 months), struck-through 12 months].
  // Previous tiles (to 2026-11-03): smart ['1', '200', ...], pro ['3', '600', ...].
  { key: 'pilot', free: true, monthly: 0, cta: 'tc.price.pilot.cta',
    tiles: ['∞', '∞', '₹0', '₹0'], highlights: [['every', true], ['whatsapp', true], ['noPay', true]] },
  { key: 'starter', monthly: 0, shown: ['₹499', '₹4,990', '₹5,988'],
    tiles: ['1', '100', '₹4', '₹999'], highlights: [['core', true], ['freeRevisit', true], ['whatsapp', true], ['upgrade', true]] },
  { key: 'smart', monthly: 0, popular: true, shown: ['₹999', '₹9,990', '₹11,988'],
    tiles: ['2', '250', '₹3', '₹1,999'], highlights: [['core', true], ['freeRevisit', true], ['whatsapp', true], ['upgrade', true]] },
  { key: 'pro', monthly: 0, shown: ['₹1,999', '₹19,990', '₹23,988'],
    tiles: ['3', '600', '₹2', '₹4,999'], highlights: [['core', true], ['freeRevisit', true], ['whatsapp', true], ['addDoc', true]] },
]
const TILES = ['doctors', 'bookings', 'extra', 'cap']
const MAIN_TILES = 2
const EVERY_PLAN = ['queue', 'leave', 'walkins', 'rx', 'pharmacy', 'reports', 'billing']
const POPULAR = PLANS.findIndex((p) => p.popular)

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
  const [open, setOpen] = useState(false) // "See details" — one switch for every card
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

  const active = hover ?? POPULAR

  const tile = (p, j) => (
    <div className="pr-tile" key={TILES[j]}>
      <span className={`pr-tile-v${p.tiles[j] === '∞' ? ' inf' : ''}`}>{p.tiles[j]}</span>
      <span className="pr-tile-l">{t(`tc.price.t.${TILES[j]}`)}</span>
    </div>
  )

  return (
    <div className={`pr${shown ? ' shown' : ''}`} id="pricing" ref={rootRef}>
      {/* Says who this is for, so a patient never thinks booking costs money. */}
      <span className="eyebrow pr-for">{t('tc.price.forHosp')}</span>
      <h2 className="pr-h2">{t('tc.price.h3a')}<br /><span className="serif grad">{t('tc.price.h3b')}</span></h2>
      <p className="pr-lede">{t('tc.price.lede')}</p>
      <p className="pr-patfree">{t('tc.price.patientsFree')}</p>

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
              onMouseLeave={() => setHover(null)}
              onMouseMove={followMouse}
            >
              <span className="pr-shine" aria-hidden="true" />
              <span className="pr-glow" aria-hidden="true" />
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
              <p className={`pr-was${yearly && !free && (p.shown || p.monthly) ? '' : ' empty'}`}>{yearly && !free && (p.shown || p.monthly) ? (p.shown ? p.shown[2] : rupees(p.monthly * 12)) : ' '}</p>

              {/* Always visible: doctors and bookings a month. */}
              <div className="pr-tiles">
                {TILES.slice(0, MAIN_TILES).map((_, j) => tile(p, j))}
              </div>

              <button
                type="button"
                className={`pr-more-btn${open ? ' on' : ''}`}
                aria-expanded={open}
                aria-controls={`pr-more-${p.key}`}
                onClick={() => setOpen((o) => !o)}
              >
                {t(open ? 'tc.price.less' : 'tc.price.more')}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div id={`pr-more-${p.key}`} className={`pr-more${open ? ' open' : ''}`} aria-hidden={!open}>
                <div className="pr-more-in">
                  <div className="pr-tiles">
                    {TILES.slice(MAIN_TILES).map((_, j) => tile(p, j + MAIN_TILES))}
                  </div>

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
                </div>
              </div>

              <button type="button" className="btn btn-primary pr-btn" onClick={() => navigate('/hospital-signup')}>
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
