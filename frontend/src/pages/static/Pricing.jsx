import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Pricing — "find your price" on the landing page's look (StaticPageShell
 * `modern`, 2026-11-07). Two tap questions (doctors, online bookings a day) and
 * the price beside them, then the plans as a plain menu line, solo doctors,
 * patients, three answers and one button. No cards or tables.
 *
 * Replaces the old page that said hospitals were "free during initial launch"
 * with plans to come later: the 30-day pilot and paid plans are live
 * (backend services/booking_quota.py). Bookings included are the numbers Raju
 * chose on 2026-11-07 (100 / 250 / 600); the homepage cards and the backend
 * catalog still need to be brought to the same numbers. Fees, bill limits and
 * extra doctors follow booking_quota.py. Solo doctors are not billed today, so
 * they read "free during launch".
 */

// included = online bookings a month; limit = the most a month's bill can reach.
const PLANS = [
  { key: 'starter', price: 499, doctors: 1, included: 100, fee: 4, limit: 999 },
  { key: 'smart', price: 999, doctors: 2, included: 250, fee: 3, limit: 1999 },
  { key: 'pro', price: 1999, doctors: 3, included: 600, fee: 2, limit: 4999 },
]
// Pro can add up to 3 doctors, each with 200 more bookings. Above that, or a very
// busy OPD, the Hospital plan (unlimited, set up by the team) fits better.
const EXTRA_DOCTOR = 599
const EXTRA_DOCTOR_BOOKINGS = 200
const MAX_EXTRA = 3
const HOSPITAL_FROM = 4999

const DOCTOR_CHOICES = [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7+']]
// Asked per day (owners know that); a month is about 25 OPD days. 50+ = Hospital plan.
const BOOKING_CHOICES = [[75, '1–3'], [200, '4–8'], [500, '9–20'], [900, '21–50'], [Infinity, '50+']]

const rupees = (n) => `₹${n.toLocaleString('en-IN')}`
const bill = (p, b) => Math.min(p.limit, p.price + Math.max(0, b - p.included) * p.fee)

/** The cheapest way to cover these doctors and bookings. */
function quote(doctors, bookings) {
  if (doctors > 3 + MAX_EXTRA || !Number.isFinite(bookings)) return { hospital: true }
  if (doctors > 3) {
    const plan = PLANS[2]
    const extraDoctors = doctors - 3
    const included = plan.included + extraDoctors * EXTRA_DOCTOR_BOOKINGS
    const over = Math.max(0, bookings - included)
    const monthly = plan.price + extraDoctors * EXTRA_DOCTOR + over * plan.fee
    if (monthly >= HOSPITAL_FROM) return { hospital: true }
    return { plan, monthly, extraDoctors, included, over }
  }
  const fits = PLANS.filter((p) => p.doctors >= doctors)
  const plan = fits.reduce((best, p) => (bill(p, bookings) < bill(best, bookings) ? p : best), fits[0])
  return { plan, monthly: bill(plan, bookings), included: plan.included, over: Math.max(0, bookings - plan.included) }
}

/** One row of tap choices, equal widths, never wrapping a lone last choice. */
function Taps({ label, choices, value, onPick }) {
  return (
    <div role="group" aria-label={label} className="mt-3.5 grid auto-cols-fr grid-flow-col gap-1.5 sm:gap-2">
      {choices.map(([v, text]) => (
        <button
          key={text}
          type="button"
          aria-pressed={value === v}
          onClick={() => onPick(v)}
          className={`whitespace-nowrap rounded-full border-[1.5px] px-0.5 py-3 text-[15px] font-semibold tabular-nums transition-colors sm:text-[17px] ${
            value === v ? 'border-[#0A9A96] bg-[#0A9A96] text-white' : 'border-[#0B2150]/15 text-[#0B2150] hover:border-[#0A9A96]'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export default function Pricing() {
  const { t } = useI18n()
  const [doctors, setDoctors] = useState(2)
  const [bookings, setBookings] = useState(75)
  const [yearly, setYearly] = useState(false)

  const q = quote(doctors, bookings)
  const name = (p) => t(`tc.price.${p.key}.name`)

  let why = t('sprice.n.whyHosp')
  if (!q.hospital && doctors > 3) {
    why = t('sprice.n.whyPro', { plan: name(q.plan), x: q.extraDoctors, fee: rupees(EXTRA_DOCTOR), n: q.included })
      + (q.over > 0 ? t('sprice.n.plusExtra', { x: q.over, fee: rupees(q.plan.fee) }) : '')
  } else if (!q.hospital) {
    why = q.over > 0
      ? t('sprice.n.whyOver', { plan: name(q.plan), n: q.included, x: q.over, fee: rupees(q.plan.fee), cap: rupees(q.plan.limit) })
      : t('sprice.n.whyRoom', { plan: name(q.plan), n: q.included })
  }

  const amount = q.hospital ? HOSPITAL_FROM : yearly ? q.monthly * 10 : q.monthly
  const per = q.hospital ? t('sprice.n.fromMonth') : yearly ? t('sprice.n.perYear') : t('sprice.n.perMonth')
  const button = 'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] px-7 py-4 text-[17px] font-semibold text-white shadow-[0_14px_30px_-14px_rgba(10,154,150,.9)] transition-transform hover:-translate-y-0.5'
  const link = 'font-semibold text-[#0A9A96] hover:underline'

  return (
    <StaticPageShell modern title={t('sprice.title')}>
      <main className="mx-auto max-w-[1040px] px-5 sm:px-8">
        {/* ── headline ── */}
        <section className="pt-14 text-center sm:pt-20">
          <h1 className="mx-auto max-w-[18ch] text-[38px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[60px]">
            {t('sprice.n.h1a')}{' '}
            <span className="bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] bg-clip-text text-transparent">{t('sprice.n.h1b')}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[18px] leading-relaxed text-[#41526E] sm:text-[18.5px]">{t('sprice.n.lede')}</p>
        </section>

        {/* ── two questions, the price beside them ── */}
        <section aria-label={t('sprice.n.find')} className="grid items-center gap-9 py-11 md:grid-cols-[1.2fr_.8fr] md:gap-14 md:py-16">
          <div>
            <h2 className="text-[22px] font-bold tracking-[-0.015em]">{t('sprice.n.qDocs')}</h2>
            <Taps label={t('sprice.n.qDocs')} choices={DOCTOR_CHOICES} value={doctors} onPick={setDoctors} />
            <h2 className="mt-9 text-[22px] font-bold tracking-[-0.015em]">{t('sprice.n.qBook')}</h2>
            <p className="mt-1 text-[15px] text-[#6B7A8F]">{t('sprice.n.qBookSub')}</p>
            <Taps label={t('sprice.n.qBook')} choices={BOOKING_CHOICES} value={bookings} onPick={setBookings} />
          </div>

          <div aria-live="polite" className="min-w-0 border-t-2 border-[#0B2150]/10 pt-7 md:border-l-2 md:border-t-0 md:pl-14 md:pt-0">
            <p className="text-[20px] font-semibold text-[#41526E]">{t('sprice.n.youPay')}</p>
            <p className="mt-1 bg-gradient-to-b from-[#0A9A96] to-[#2F58B7] bg-clip-text text-[56px] font-bold leading-[1.05] tracking-[-0.05em] text-transparent tabular-nums sm:text-[84px]">
              {rupees(amount)}
            </p>
            <p className="text-[18px] font-semibold text-[#41526E]">{per}</p>
            <p className="mt-4 max-w-[40ch] text-[17px] leading-relaxed text-[#41526E]">{why}</p>
            {!q.hospital && (
              <p className="mt-2.5 text-[15px] text-[#6B7A8F]">
                {!yearly && <>{t('sprice.n.yearlyAsk')} </>}
                <button type="button" onClick={() => setYearly((y) => !y)} className="font-semibold text-[#0A9A96] underline underline-offset-[3px]">
                  {t(yearly ? 'sprice.n.seeMonthly' : 'sprice.n.seeYearly')}
                </button>
              </p>
            )}
            <Link to={q.hospital ? '/contact' : '/hospital-signup'} className={`mt-6 ${button}`}>
              {t(q.hospital ? 'sprice.n.talk' : 'sprice.n.start')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── the plans as a plain menu line ── */}
        <section aria-label={t('sprice.n.plans')}>
          <div className="grid gap-5 border-y border-[#0B2150]/15 py-6 text-center sm:grid-cols-3 sm:gap-6">
            {PLANS.map((p) => {
              const on = !q.hospital && q.plan.key === p.key
              return (
                <div key={p.key} className={`transition-opacity ${on ? 'opacity-100' : 'opacity-50'}`}>
                  <b className="block text-[22px]">{name(p)}</b>
                  <p className={`mt-0.5 text-[30px] font-bold tracking-[-0.03em] tabular-nums ${on ? 'text-[#0A9A96]' : ''}`}>{rupees(p.price)}</p>
                  <span className="mt-1 block text-[15.5px] text-[#41526E]">
                    {p.doctors === 1 ? t('sprice.n.doc1') : t('sprice.n.docN', { n: p.doctors })} · {t('sprice.n.bookings', { n: p.included })}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-center text-[15px] text-[#6B7A8F]">
            {t('sprice.n.walkinNote')} <Link to="/contact" className={link}>{t('sprice.n.talk')}</Link>
          </p>
          <p className="mt-7 text-center text-[19px] text-[#41526E]">
            {t('sprice.n.solo')} <b className="text-[#0B2150]">{t('sprice.n.soloFree')}</b>{' '}
            <Link to="/doctor-signup" className={`whitespace-nowrap ${link}`}>{t('sprice.n.soloJoin')} →</Link>
          </p>
        </section>

        {/* ── patients ── */}
        <section className="pb-16 pt-20 text-center sm:pb-[72px] sm:pt-[88px]">
          <h2 className="text-[34px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[58px]">
            {t('sprice.n.patA')} <span className="text-[#0A9A96]">{t('sprice.n.patB')}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[18px] leading-relaxed text-[#41526E]">{t('sprice.n.patBody')}</p>
        </section>

        {/* ── three plain answers ── */}
        <section aria-label={t('sprice.n.qa')} className="grid gap-7 pb-6 md:grid-cols-3 md:gap-10">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <h3 className="text-[19px] font-bold tracking-[-0.01em]">{t(`sprice.n.q${i}`)}</h3>
              <p className="mt-2 text-[16px] leading-relaxed text-[#41526E]">{t(`sprice.n.a${i}`)}</p>
            </div>
          ))}
        </section>

        {/* ── one button ── */}
        <section className="pb-12 pt-16 text-center sm:pt-[72px]">
          <p className="text-[18px] text-[#41526E]">{t('sprice.n.noPay')}</p>
          <Link to="/hospital-signup" className={`mt-5 ${button}`}>
            {t('sprice.n.start')} <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
    </StaticPageShell>
  )
}
