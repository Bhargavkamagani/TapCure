import { Link } from 'react-router-dom'
import { Scale, ScrollText, ShieldCheck, ReceiptText, AlertTriangle, ArrowRight } from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Policies hub (route: /policies) — a single place that links to every legal
 * document, each as a "Read more" card. Linked from the footer and referenced
 * from the consent checkbox context.
 */
const POLICIES = [
  // Copy lives in src/i18n/dict/legalTerms.js as `lpol.<key>.title` / `.desc`.
  { icon: ScrollText, key: 'terms', to: '/terms' },
  { icon: ShieldCheck, key: 'privacy', to: '/privacy' },
  { icon: ReceiptText, key: 'refund', to: '/cancellation-refund' },
  { icon: AlertTriangle, key: 'disclaimer', to: '/medical-disclaimer' },
]

export default function Policies() {
  const { t } = useI18n()
  return (
    <StaticPageShell legal>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={Scale}
          eyebrow={t('lpol.hero.eyebrow')}
          title={t('lpol.hero.title')}
          subtitle={t('lpol.hero.subtitle', { brand: BRAND.name })}
        />

        {/* ── Policy cards ── */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {POLICIES.map(({ icon: Icon, key, to }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-lift sm:p-8"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 font-serif text-2xl leading-tight">{t(`lpol.${key}.title`)}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{t(`lpol.${key}.desc`)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sage-deep transition-all group-hover:gap-2">
                {t('lpol.readMore')} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </main>
    </StaticPageShell>
  )
}
