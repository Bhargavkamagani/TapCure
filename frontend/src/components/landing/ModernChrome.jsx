import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Clock, Languages, Mail, MapPin, Phone } from 'lucide-react'
import { useI18n, LANGS } from '../../i18n/index.jsx'
import { useAuth, homeFor } from '../../context/AuthContext.jsx'
import Wordmark from '../common/Wordmark.jsx'

/**
 * The landing page's look for the public content pages: a header and footer
 * that match `.tcx` in pages/LandingPage.jsx (Inter + Plus Jakarta Sans, navy ink, teal
 * accents, the same links and contact details as TcFooter).
 *
 * Opt-in through <StaticPageShell modern>, so pages move over one at a time
 * instead of all at once. About is the first (2026-11-03).
 *
 * Every link is a real <Link>, not a button with onClick, so it can be opened
 * in a new tab (long-press on a phone) and search engines can follow it.
 */

// Telugu and Devanagari come from Noto (index.html); Inter has no
// glyphs for them, and without these the browser picked a different system
// font on every phone.
// Reading text is Inter; headings inside a `tc-type` root use Plus Jakarta Sans
// (index.css), the one text style for the whole app (2026-11-08).
export const MODERN_FONT =
  'Inter, "Noto Sans Telugu", "Noto Sans Devanagari", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'

// Same tinted paper and brand washes as the landing page, toned down so long
// reading pages stay calm.
export const MODERN_BG = {
  backgroundColor: '#EAF4F3',
  backgroundImage: [
    'radial-gradient(62% 48% at 0% 0%, rgba(0,201,197,.28), transparent 70%)',
    'radial-gradient(58% 44% at 100% 6%, rgba(51,105,255,.20), transparent 70%)',
    'radial-gradient(64% 46% at 50% 100%, rgba(0,201,197,.20), transparent 72%)',
  ].join(', '),
  backgroundAttachment: 'fixed',
}

const NAV_LINKS = [
  ['land.nav.doctors', '/search?type=doctors'],
  ['land.nav.hospitals', '/search?type=hospitals'],
  ['land.nav.articles', '/health-articles'],
]

const LOGINS = [
  ['patient', '/patient-login'],
  ['doctor', '/doctor-login'],
  ['hospital', '/hospital-login'],
]

// Same three columns as the landing footer (TcFooter in TcSections.jsx).
const EXPLORE = [
  ['tc.foot.about', '/about'], ['tc.foot.features', '/features'], ['tc.foot.pricing', '/pricing'],
  ['tc.foot.faq', '/faq'], ['tc.foot.articles', '/health-articles'], ['tc.foot.contact', '/contact'],
]
const PARTNERS = [
  ['tc.foot.becomePartner', '/hospital-signup'],
  ['tc.foot.joinDoctor', '/doctor-signup'],
  ['tc.foot.hospitalLogin', '/hospital-login'],
]
const LEGAL = [
  ['tc.foot.policies', '/policies'], ['tc.foot.privacy', '/privacy'],
  ['tc.foot.terms', '/terms'], ['tc.foot.refund', '/cancellation-refund'],
  ['tc.foot.disclaimer', '/medical-disclaimer'],
]

export function ModernHeader() {
  const { t, lang, setLang } = useI18n()
  // `|| {}`: AuthContext defaults to null on public pages.
  const { user } = useAuth() || {}
  const [open, setOpen] = useState(null) // 'lang' | 'login' | null
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const toggle = (which) => setOpen((o) => (o === which ? null : which))

  return (
    <header className="sticky top-0 z-30 border-b border-[#0B2150]/10 bg-white/80 backdrop-blur-md">
      <div ref={ref} className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src="/tapcure-icon.png" alt="" className="h-9 w-auto" />
          <Wordmark className="text-[22px]" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(([key, to]) => (
            <Link key={to} to={to} className="rounded-full px-4 py-2 text-[15px] font-medium text-[#41526E] transition-colors hover:bg-[#0A9A96]/10 hover:text-[#0B2150]">
              {t(key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => toggle('lang')}
              aria-expanded={open === 'lang'}
              aria-label={t('land.nav.language')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#0B2150]/15 bg-white px-3 py-2 text-sm font-medium text-[#0B2150] hover:border-[#0A9A96]/50"
            >
              <Languages className="h-4 w-4" /> {LANGS[lang].label}
            </button>
            {open === 'lang' && (
              <div className="absolute right-0 mt-2 min-w-[150px] overflow-hidden rounded-2xl border border-[#0B2150]/10 bg-white py-1 shadow-xl">
                {Object.entries(LANGS).map(([code, meta]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => { setLang(code); setOpen(null) }}
                    className={`block w-full px-4 py-2.5 text-left text-[15px] hover:bg-[#0A9A96]/10 ${code === lang ? 'font-semibold text-[#0A9A96]' : 'text-[#0B2150]'}`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user?.role_name ? (
            <Link
              to={homeFor(user.role_name)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              {t('shell.backDashboard')}
            </Link>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => toggle('login')}
                aria-expanded={open === 'login'}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                {t('land.nav.login')} <ChevronDown className="h-4 w-4" />
              </button>
              {open === 'login' && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-[#0B2150]/10 bg-white py-1 shadow-xl">
                  {LOGINS.map(([role, to]) => (
                    <Link key={role} to={to} onClick={() => setOpen(null)} className="block px-4 py-3 hover:bg-[#0A9A96]/10">
                      <span className="block text-[15px] font-semibold text-[#0B2150]">{t(`land.role.${role}`)}</span>
                      <span className="block text-[13px] text-[#6B7A8F]">{t(`land.role.${role}Desc`)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function FooterCol({ title, links }) {
  const { t } = useI18n()
  return (
    <div>
      <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.13em] text-[#6B7A8F]">{title}</h4>
      <ul className="space-y-2.5">
        {links.map(([key, to]) => (
          <li key={to}>
            <Link to={to} className="text-[15px] text-[#41526E] transition-colors hover:text-[#0A9A96]">{t(key)}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ModernFooter() {
  const { t } = useI18n()
  const year = new Date().getFullYear()
  const reach = 'flex items-center gap-3 text-[15px] text-[#41526E]'
  const ico = 'grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#0A9A96]/10 text-[#0A9A96]'

  return (
    <footer className="relative mt-20 border-t border-[#0B2150]/10 bg-white/60 backdrop-blur-md">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#00C9C5] via-[#34d399] to-[#2F58B7]" />
      <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.2fr]">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img src="/tapcure-icon.png" alt="" className="h-9 w-auto" />
              <Wordmark className="text-[22px]" />
            </Link>
            <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[#6B7A8F]">{t('tc.foot.blurb')}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link to="/contact" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00C9C5] to-[#2F58B7] px-5 py-2.5 text-sm font-bold text-white">
                {t('tc.foot.getInTouch')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <FooterCol title={t('tc.foot.explore')} links={EXPLORE} />
          <FooterCol title={t('tc.foot.partners')} links={PARTNERS} />
          <FooterCol title={t('tc.foot.legal')} links={LEGAL} />

          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.13em] text-[#6B7A8F]">{t('tc.foot.reachUs')}</h4>
            <div className="space-y-3">
              <a href="mailto:hello@tapcure.in" className={`${reach} hover:text-[#0A9A96]`}>
                <span className={ico}><Mail className="h-4 w-4" /></span> hello@tapcure.in
              </a>
              <a href="tel:+919346821621" className={`${reach} hover:text-[#0A9A96]`}>
                <span className={ico}><Phone className="h-4 w-4" /></span> +91 93468 21621
              </a>
              <p className={reach}><span className={ico}><MapPin className="h-4 w-4" /></span> {t('tc.foot.hyderabad')}</p>
              <p className={reach}><span className={ico}><Clock className="h-4 w-4" /></span> {t('tc.foot.hours')}</p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-[#0B2150]/10 pt-6 text-[13px] text-[#93A3B8]">
          <span>© {year} TapCure Health Technologies · Trovate LLP.</span>
          <span>{t('tc.foot.madeWith')} ♥</span>
        </div>
      </div>
    </footer>
  )
}
