import {
  AlertTriangle, Stethoscope, Pill, Calculator, Ambulance, Phone, XCircle,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { SectionCard } from '../../components/landing/LegalSection.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Public Medical Disclaimer page (route: /medical-disclaimer).
 *
 * Consolidates the health/medical disclaimer language repeated across the
 * content pack (T&C §9-11, Privacy §5) into one dedicated compliance page,
 * linked from the footer. All sections are ember-toned so the "not medical
 * advice" message is unmistakable.
 */

// Copy lives in src/i18n/dict/legalTerms.js under `lmd.*`.
function buildSections(t) {
  const v = { brand: BRAND.name }
  const notList = [1, 2, 3, 4, 5, 6].map((i) => t(`lmd.not.li${i}`))
  return [
    {
      id: 1, icon: Stethoscope, title: t('lmd.s1.title'), tone: 'warn',
      blocks: [
        { type: 'p', text: t('lmd.s1.p1', v) },
        { type: 'p', text: t('lmd.s1.p2', v) },
        { type: 'ul', items: notList },
        { type: 'p', text: t('lmd.s1.p3') },
      ],
    },
    {
      id: 2, icon: Pill, title: t('lmd.s2.title'), tone: 'warn',
      blocks: [
        { type: 'p', text: t('lmd.s2.p1') },
        { type: 'ul', items: [t('lmd.s2.li1'), t('lmd.s2.li2'), t('lmd.s2.li3')] },
        { type: 'p', text: t('lmd.s2.p2', v) },
      ],
    },
    {
      id: 3, icon: Calculator, title: t('lmd.s3.title'), tone: 'warn',
      blocks: [
        { type: 'p', text: t('lmd.s3.p1') },
        { type: 'p', text: t('lmd.s3.p2') },
      ],
    },
  ]
}

export default function MedicalDisclaimer() {
  const { t } = useI18n()
  const sections = buildSections(t)
  return (
    <StaticPageShell legal>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          tone="warn"
          icon={AlertTriangle}
          eyebrow={t('lmd.hero.eyebrow')}
          title={t('lmd.hero.title')}
          subtitle={t('lmd.hero.subtitle', { brand: BRAND.name })}
        />

        {/* ── Emergency band ── */}
        <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 px-8 py-8 text-white shadow-lift sm:px-12">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-ember/25 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">{t('lmd.em.eyebrow')}</p>
              <h2 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">
                {t('lmd.em.title')}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href="tel:108" className="inline-flex items-center gap-2 rounded-xl bg-ember px-6 py-3 text-sm font-semibold transition-transform hover:scale-[1.03]">
                <Ambulance className="h-5 w-5" /> {t('lmd.em.ambulance')}
              </a>
              <a href="tel:104" className="inline-flex items-center gap-2 rounded-xl border border-primary-foreground/30 bg-primary-foreground/5 px-6 py-3 text-sm font-semibold transition-colors hover:bg-primary-foreground/10">
                <Phone className="h-5 w-5" /> {t('lmd.em.helpline')}
              </a>
            </div>
          </div>
        </section>

        {/* ── Sections ── */}
        <div className="mt-6 space-y-6">
          {sections.map((s) => <SectionCard key={s.id} section={s} />)}
        </div>

        {/* ── Closing note ── */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/50 bg-white/40 p-6 text-sm text-ink-soft backdrop-blur-sm">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <p>{t('lmd.closing', { brand: BRAND.name })}</p>
        </div>
      </main>
    </StaticPageShell>
  )
}
