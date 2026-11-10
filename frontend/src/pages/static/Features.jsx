import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ShieldCheck } from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { Story, PATIENT_STEPS, HOSPITAL_STEPS } from '../../components/landing/TcStory.jsx'
import TcLeaveNow from '../../components/landing/TcLeaveNow.jsx'
import { PageStyles } from '../LandingPage.jsx'

/**
 * Features — a scroll story on the landing page's look (StaticPageShell `modern`,
 * 2026-11-07). One phone (patients) or desk screen (hospitals) stays in place
 * while one OP day plays out beside it; a time ruler fills as you scroll. The
 * old 22-card grid and the public "For Admins" list are gone (admin verification
 * became one trust line). Names, times and numbers on the screens are examples
 * and the page says so. Times stay in Latin digits like the rest of the site.
 * The story itself lives in TcStory.jsx (the homepage shows a short version).
 * Patients also get the leave-time road (2026-11-09, moved here from the
 * homepage); it keeps the homepage look through PageStyles in a .tcx box.
 */

const PATIENT_ALSO = [
  ['sfeat.p.family.title', 'sfeat.p.family.desc'],
  ['sfeat.p.rx.title', 'sfeat.p.rx.desc'],
  ['sfeat.p.meds.title', 'sfeat.p.meds.desc'],
  ['sfeat.p.lang.title', 'sfeat.p.lang.desc'],
  ['sfeat.p.pay.title', 'sfeat.p.pay.desc'],
]
const HOSPITAL_ALSO = [
  ['sfeat.c.avail.title', 'sfeat.c.avail.desc'],
  ['sfeat.c.dash.title', 'sfeat.c.dash.desc'],
]

/* ── page ──────────────────────────────────────────────────────────────── */

export default function Features() {
  const { t } = useI18n()
  const brand = BRAND.name
  const [side, setSide] = useState('pat')
  const pat = side === 'pat'

  const tab = (key, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={side === key}
      onClick={() => setSide(key)}
      className={`relative pb-3 pt-1.5 text-[20px] font-semibold transition-colors ${side === key ? 'text-[#0B2150]' : 'text-[#6B7A8F] hover:text-[#0B2150]'}`}
    >
      {label}
      <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] transition-transform duration-300 ${side === key ? 'scale-x-100' : 'scale-x-0'}`} />
    </button>
  )

  const also = pat ? PATIENT_ALSO : HOSPITAL_ALSO

  return (
    <StaticPageShell modern title={t('sfeat.title')}>
      <main className="mx-auto max-w-[1120px] px-5 sm:px-8">
        {/* ── hero ── */}
        <section className="pb-2 pt-14 text-center sm:pt-20">
          <h1 className="mx-auto max-w-[16ch] text-[40px] font-bold leading-[1.04] tracking-[-0.03em] sm:text-[64px]">
            {t('sfeat.heroA')}{' '}
            <span className="bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] bg-clip-text text-transparent">{t('sfeat.heroB')}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[560px] text-[18px] leading-relaxed text-[#41526E] sm:text-[19px]">{t('sfeat.heroLede', { brand })}</p>
          <div role="tablist" aria-label={t('sfeat.showFor')} className="mt-9 flex justify-center gap-10">
            {tab('pat', t('sfeat.patientsEyebrow'))}
            {tab('hosp', t('sfeat.hospitalsEyebrow'))}
          </div>
          <p aria-hidden="true" className="mt-6 flex flex-col items-center gap-1.5 text-[14px] text-[#6B7A8F]">
            {t('sfeat.scroll')}
            <i className="block h-8 w-0.5 animate-pulse bg-gradient-to-b from-[#0A9A96] to-transparent motion-reduce:animate-none" />
          </p>
        </section>

        {/* ── the story (a new key remounts it, so it starts at step one) ── */}
        <div role="tabpanel">
          <Story key={side} steps={pat ? PATIENT_STEPS : HOSPITAL_STEPS} device={pat ? 'phone' : 'desk'} />
        </div>

        {/* ── patients: the leave-time road, in the homepage look ── */}
        {pat && (
          <div className="tcx tcx-embed">
            <PageStyles />
            <style>{'.tcx.tcx-embed{min-height:0;background:none;overflow:visible}.tcx.tcx-embed .wrap{padding-inline:0}.tcx.tcx-embed .rv{opacity:1;transform:none}.tcx.tcx-embed .leavenow{padding:clamp(40px,6vw,72px) 0 0}'}</style>
            <TcLeaveNow />
          </div>
        )}

        {/* ── also included: a plain ruled list ── */}
        <section className="pb-6 pt-14">
          <h2 className="text-[28px] font-bold tracking-[-0.02em] sm:text-[38px]">{t('sfeat.alsoTitle', { brand })}</h2>
          <ul className="mt-7 grid gap-x-14 sm:grid-cols-2">
            {also.map(([title, desc]) => (
              <li key={title} className="grid grid-cols-[28px_1fr] gap-3 border-t border-[#0B2150]/10 py-[18px]">
                <span aria-hidden="true" className="text-[18px] font-bold text-[#0A9A96]">✓</span>
                <div>
                  <b className="block text-[17.5px]">{t(title)}</b>
                  <span className="text-[15.5px] text-[#41526E]">{t(desc)}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-7 flex items-center gap-2.5 text-[16px] text-[#41526E]">
            <ShieldCheck className="h-[22px] w-[22px] shrink-0 text-[#0A9A96]" />
            {t(pat ? 'sfeat.trustP' : 'sfeat.trustH', { brand })}
          </p>
        </section>

        {/* ── one closing button, for the side being read ── */}
        <section className="mb-10 mt-16 rounded-[32px] bg-gradient-to-br from-[#0A9A96] via-[#0B8C88] to-[#2F58B7] px-7 py-14 text-center text-white sm:px-14 sm:py-16">
          <h2 className="mx-auto max-w-[18ch] text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[44px]">{t(pat ? 'sfeat.ctaP.t' : 'sfeat.ctaH.t')}</h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[17px] leading-relaxed text-white/85 sm:text-[18px]">{t(pat ? 'sfeat.ctaP.b' : 'sfeat.ctaH.b')}</p>
          <Link
            to={pat ? '/search' : '/hospital-signup'}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[16px] font-semibold text-[#0B2150] shadow-lg transition-transform hover:-translate-y-0.5"
          >
            {pat ? <>{t('sfeat.bookBtn')} <ArrowRight className="h-4 w-4" /></> : <><Building2 className="h-4 w-4" /> {t('sfeat.registerBtn')}</>}
          </Link>
        </section>
      </main>
    </StaticPageShell>
  )
}
