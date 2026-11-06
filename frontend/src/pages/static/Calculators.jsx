import { useState } from 'react'
import { Calculator, ChevronRight, MousePointerClick, PencilLine, Salad } from 'lucide-react'
import { BRAND, HEALTH_CALCULATORS } from '../../data/landingData.js'
import { CALCULATORS } from '../../lib/calculators.js'
import { useI18n } from '../../i18n/index.jsx'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import CalculatorModal from '../../components/landing/CalculatorModal.jsx'

/**
 * The health calculators, on a page of their own.
 *
 * They already existed — eight of them in `lib/calculators.js`, each with food
 * guidance under its result — but the only two components that listed them
 * (`CalculatorSidebar`, `ToolsAndJourney`) were left unmounted when the landing
 * page was redesigned, so nothing in the app could reach them.
 *
 * A page rather than a landing section: the grid plus the food guidance is a
 * lot of height to add back to a landing page that was just compacted, and a
 * tool people return to deserves a URL they can bookmark.
 *
 * `ToolsAndJourney` is deliberately NOT reused here — it pairs a calculator
 * aside with the whole six-step patient journey, which belongs on the landing
 * page, not on a page about calculators.
 */

/* Pregnancy answers a date, not a health judgement, so it is the one tool with
   no food plan behind it — see the mapping in lib/calculators.js. */
const NO_DIET = new Set(['Pregnancy Calculator'])

// Text for each step lives in i18n as scalc.step.<id>.title / .body.
const STEPS = [
  { icon: MousePointerClick, id: 'pick' },
  { icon: PencilLine, id: 'type' },
  { icon: Salad, id: 'plan' },
]

function Calculators() {
  const { t } = useI18n()
  const [active, setActive] = useState(null)   // open calculator label

  // A label listed but not implemented would be a dead button — the older
  // surfaces have always guarded this the same way.
  const live = HEALTH_CALCULATORS.filter(({ label }) => CALCULATORS[label])

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={Calculator}
          eyebrow={t('scalc.eyebrow', { brand: BRAND.name })}
          title={t('scalc.title')}
          subtitle={t('scalc.subtitle')}
          chips={[t('scalc.chip.free'), t('scalc.chip.noSignup'), t('scalc.chip.nothingStored')]}
        />

        {/* How it works — three steps, so the food plan is visible as a promise
            before anyone clicks a single tile. */}
        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, id }, i) => (
            <div
              key={id}
              className="flex items-start gap-3 rounded-2xl border border-white/50 bg-card/60 p-4 backdrop-blur-sm"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage/50 text-sage-deep">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-foreground">
                  <span className="text-sage-deep">{i + 1}.</span> {t(`scalc.step.${id}.title`)}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{t(`scalc.step.${id}.body`)}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-14">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage-deep">{t('scalc.pick')}</p>
          <h2 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
            {t('scalc.count', { n: live.length })}
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map(({ label, short, icon: Icon }) => {
              const hasDiet = !NO_DIET.has(label)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActive(label)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/60 bg-card/70 p-5 text-left shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-teal-300/70 hover:shadow-lift"
                >
                  {/* Wash that lifts on hover — keeps the grid from reading as a
                      list of plain boxes without shouting on every card. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-teal-400/20 to-emerald-400/10 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                  />

                  <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white shadow-[0_8px_20px_-10px_rgba(13,148,136,0.9)]">
                    {short
                      ? <span className="text-[11px] font-extrabold tracking-tight">{short}</span>
                      : <Icon className="h-5 w-5" />}
                  </span>

                  <p className="relative mt-4 text-[16px] font-bold leading-tight text-foreground">
                    {t(`calc.label.${label}`)}
                  </p>
                  <p className="relative mt-1.5 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                    {t(`calc.blurb.${label}`)}
                  </p>

                  <span className="relative mt-4 flex items-center justify-between gap-2">
                    {hasDiet ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/50 px-2.5 py-1 text-[11px] font-semibold text-sage-deep">
                        <Salad className="h-3.5 w-3.5" /> {t('calc.diet.tag')}
                      </span>
                    ) : <span />}
                    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-sage-deep transition-all group-hover:gap-1.5">
                      {t('scalc.open')} <ChevronRight className="h-4 w-4" />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <p className="mt-10 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            {t('scalc.disclaimer')}
          </p>
        </section>
      </main>

      <CalculatorModal name={active} onClose={() => setActive(null)} />
    </StaticPageShell>
  )
}

export default Calculators
