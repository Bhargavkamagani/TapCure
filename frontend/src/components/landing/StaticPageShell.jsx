import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Languages } from 'lucide-react'
import { useI18n, LANGS } from '../../i18n/index.jsx'
import { BRAND } from '../../data/landingData.js'
import Wordmark from '../common/Wordmark.jsx'
import { useAuth, homeFor } from '../../context/AuthContext.jsx'

/**
 * Shared chrome for the public static / content pages (Privacy, Terms, About,
 * Features, Pricing, FAQ, Contact, Resources, Medical Disclaimer).
 *
 * Provides the editorial theme wrapper, ambient colour blobs, a sticky top bar
 * (back-to-home + brand) and the shared site footer with cross-links to every
 * static page. Each page supplies its own <main> as `children`.
 */

const FOOTER_LINKS = [
  { labelKey: 'shell.about', to: '/about' },
  { labelKey: 'shell.features', to: '/features' },
  { labelKey: 'shell.pricing', to: '/pricing' },
  { labelKey: 'shell.faq', to: '/faq' },
  { labelKey: 'shell.resources', to: '/resources' },
  { labelKey: 'shell.calculators', to: '/calculators' },
  { labelKey: 'shell.contact', to: '/contact' },
  { labelKey: 'shell.policies', to: '/policies' },
  { labelKey: 'shell.privacy', to: '/privacy' },
  { labelKey: 'shell.terms', to: '/terms' },
  { labelKey: 'shell.refund', to: '/cancellation-refund' },
  { labelKey: 'shell.disclaimer', to: '/medical-disclaimer' },
]

/** `legal` pages show a note in Telugu/Hindi that the English text is the
 *  binding one — a translation can drift, the policy must not. */
export default function StaticPageShell({ children, legal = false }) {
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()
  const [langOpen, setLangOpen] = useState(false)
  // `|| {}` because AuthContext defaults to null — these are public pages and
  // must not crash if one is ever rendered outside the provider.
  const { user } = useAuth() || {}
  // These pages are public, but a logged-in user reaches them from inside a
  // console (e.g. the "Contact Support" link in the doctor sidebar). Sending
  // them to "/" dumped them onto the marketing landing page instead of back
  // where they came from. homeFor() is the same mapping login already uses.
  const backTo = user?.role_name ? homeFor(user.role_name) : '/'
  const backLabel = user?.role_name ? t('shell.backDashboard') : t('shell.backHome')

  return (
    <div className="theme-editorial editorial-grain relative isolate min-h-screen w-full overflow-x-hidden bg-gradient-to-br from-emerald-50 via-background to-teal-50 text-foreground">
      {/* Ambient colour blobs behind the frosted surfaces */}
      <div aria-hidden="true" className="pointer-events-none fixed -left-40 top-8 -z-10 h-[34rem] w-[34rem] rounded-full bg-teal-300/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none fixed -right-32 top-1/3 -z-10 h-[36rem] w-[36rem] rounded-full bg-emerald-300/25 blur-3xl" />

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/40 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-none items-center justify-between px-6 py-4 sm:px-10 lg:px-16">
          <button
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-2 text-sm font-medium text-sage-deep transition-all hover:gap-3"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </button>
          <div className="flex items-center gap-4">
          {/* The real mark, same lockup as the landing page. These pages used a
              generic heart icon in a rounded square with the brand name set in
              the body serif — a placeholder that never got replaced, sitting on
              the Privacy and Terms pages people are most likely to scrutinise. */}
          <button onClick={() => navigate(backTo)} className="flex items-center gap-2">
            <img src="/tapcure-icon.png" alt={BRAND.name} className="h-9 w-auto shrink-0 object-contain" />
            <Wordmark className="text-[22px]" />
          </button>
          {/* Same choice as the landing page switcher (shared `lang` state). */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/60 px-3 py-1.5 text-sm font-medium text-sage-deep hover:bg-white"
            >
              <Languages className="h-4 w-4" /> {LANGS[lang].label}
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {Object.entries(LANGS).map(([code, meta]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => { setLang(code); setLangOpen(false) }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${code === lang ? 'font-semibold text-teal-700' : 'text-slate-700'}`}
                  >
                    {meta.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {legal && lang !== 'en' && (
        <div className="mx-auto mt-6 max-w-4xl px-6">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t('shell.legalNote')}
          </p>
        </div>
      )}

      {children}

      {/* Shared site footer with cross-links */}
      <footer className="border-t border-white/40 bg-white/25 backdrop-blur-md">
        <div className="mx-auto max-w-none px-6 py-10 sm:px-10 lg:px-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-2">
              <img src="/tapcure-icon.png" alt={BRAND.name} className="h-9 w-auto shrink-0 object-contain" />
              <Wordmark className="text-[22px]" />
            </div>
            <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
              {FOOTER_LINKS.map((l) => (
                <button key={l.to} onClick={() => navigate(l.to)} className="text-left hover:text-foreground">
                  {t(l.labelKey)}
                </button>
              ))}
            </nav>
          </div>
          <p className="mt-8 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {BRAND.name} — Trovate LLP. {t('shell.madeWithCare')}
          </p>
        </div>
      </footer>
    </div>
  )
}
