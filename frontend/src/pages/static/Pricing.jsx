import { useNavigate } from 'react-router-dom'
import {
  IndianRupee,
  Check,
  Building2,
  Stethoscope,
  Sparkles,
  Rocket,
  HeartPulse,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { useI18n } from '../../i18n/index.jsx'

const PATIENT_FEATURES = [
  'sprice.pf.booking',
  'sprice.pf.token',
  'sprice.pf.confirm',
  'sprice.pf.queue',
  'sprice.pf.delay',
  'sprice.pf.travel',
  'sprice.pf.notify',
]

const HOSPITAL_FEATURES = [
  'sprice.cf.profile',
  'sprice.cf.avail',
  'sprice.cf.dash',
  'sprice.cf.queue',
  'sprice.cf.walkin',
  'sprice.cf.delay',
  'sprice.cf.reports',
]

const FUTURE_PLANS = [
  {
    icon: Stethoscope,
    name: 'sprice.fp.starter.name',
    note: 'sprice.fp.starter.note',
  },
  {
    icon: Sparkles,
    name: 'sprice.fp.growth.name',
    note: 'sprice.fp.growth.note',
  },
  {
    icon: Building2,
    name: 'sprice.fp.queue.name',
    note: 'sprice.fp.queue.note',
  },
]

function FeatureItem({ children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-gradient-to-r from-teal-600 to-green-600 text-white">
        <Check className="h-3 w-3" />
      </span>
      <span className="text-sm text-ink-soft">{children}</span>
    </li>
  )
}

export default function Pricing() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const brand = BRAND.name

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={IndianRupee}
          eyebrow={t('sprice.eyebrow', { brand })}
          title={t('sprice.title')}
          subtitle={t('sprice.subtitle', { brand })}
        />

        {/* Pricing cards */}
        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Patient card (emphasized) */}
          <div className="rounded-3xl border-2 border-green-500/50 bg-card/70 p-8 shadow-[0_0_22px_rgba(34,197,94,0.2)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-r from-teal-600 to-green-600 text-white">
                <HeartPulse className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage-deep">
                  {t('sprice.forPatients')}
                </p>
                <h2 className="font-serif text-2xl text-foreground">
                  {t('sprice.patientPlan')}
                </h2>
              </div>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-serif text-4xl text-foreground">{t('sprice.free')}</span>
              {/* Previous platform-fee price: <span className="font-serif text-4xl text-foreground">₹10</span> */}
              {/*
              <span className="text-sm text-muted-foreground">
                {t('sprice.perBooking')}
              </span>
              */}
            </div>

            <ul className="mt-6 space-y-3">
              {PATIENT_FEATURES.map((f) => (
                <FeatureItem key={f}>{t(f)}</FeatureItem>
              ))}
            </ul>

            <p className="mt-5 text-xs text-muted-foreground">
              {t('sprice.consultNote')}
            </p>

            <button
              onClick={() => navigate('/')}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              <HeartPulse className="h-4 w-4" /> {t('sprice.bookBtn')}
            </button>
          </div>

          {/* Hospital card */}
          <div className="rounded-3xl border border-white/50 bg-card/70 p-8 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-r from-teal-600 to-green-600 text-white">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-sage-deep">
                  {t('sprice.forHospitals')}
                </p>
                <h2 className="font-serif text-2xl text-foreground">
                  {t('sprice.hospitalPlan')}
                </h2>
              </div>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-serif text-4xl text-foreground">{t('sprice.free')}</span>
              <span className="text-sm text-muted-foreground">
                {t('sprice.duringLaunch')}
              </span>
            </div>

            <p className="mt-4 text-sm text-ink-soft">
              {t('sprice.hospitalBody', { brand })}
            </p>

            <ul className="mt-6 space-y-3">
              {HOSPITAL_FEATURES.map((f) => (
                <FeatureItem key={f}>{t(f)}</FeatureItem>
              ))}
            </ul>

            <button
              onClick={() => navigate('/hospital-signup')}
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              <Stethoscope className="h-4 w-4" /> {t('sprice.registerBtn')}
            </button>
          </div>
        </section>

        {/* Future hospital plans */}
        <section className="mt-8 rounded-3xl border border-white/50 bg-card/70 p-8 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-r from-teal-600 to-green-600 text-white">
              <Rocket className="h-5 w-5" />
            </span>
            <h2 className="font-serif text-2xl text-foreground">
              {t('sprice.futureTitle')}
            </h2>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-ink-soft">
            {t('sprice.futureBody')}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {FUTURE_PLANS.map((plan) => {
              const Icon = plan.icon
              return (
                <div
                  key={plan.name}
                  className="rounded-2xl border border-white/50 bg-white/40 p-6 backdrop-blur-sm"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-teal-600 to-green-600 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-serif text-lg text-foreground">
                    {t(plan.name)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(plan.note)}
                  </p>
                </div>
              )
            })}
          </div>

          <p className="mt-6 text-sm text-sage-deep">
            {t('sprice.finalNote')}
          </p>
        </section>

        {/* Payment disclaimer band */}
        <section className="mt-8 rounded-2xl border border-white/50 bg-white/40 p-6 text-sm text-ink-soft backdrop-blur-sm">
          {t('sprice.disclaimer', { brand })}
        </section>
      </main>
    </StaticPageShell>
  )
}
