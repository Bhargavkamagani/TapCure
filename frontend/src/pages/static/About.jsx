import { useNavigate } from 'react-router-dom'
import {
  HeartPulse,
  Sparkles,
  Target,
  Eye,
  MapPin,
  MessageCircle,
  ArrowRight,
  Stethoscope,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { useI18n } from '../../i18n/index.jsx'

const WHY_ITEMS = [
  'sabout.why.booking',
  'sabout.why.tokens',
  'sabout.why.queue',
  'sabout.why.travel',
  'sabout.why.reminders',
  'sabout.why.language',
  'sabout.why.hospitalQueue',
]

const MISSION_PATIENT = [
  'sabout.mp.book',
  'sabout.mp.reach',
  'sabout.mp.avoid',
  'sabout.mp.reminders',
  'sabout.mp.family',
]

const MISSION_HOSPITAL = [
  'sabout.mc.crowd',
  'sabout.mc.manage',
  'sabout.mc.clarity',
  'sabout.mc.ops',
]

const INDIA_ITEMS = [
  'sabout.in.walkin',
  'sabout.in.family',
  'sabout.in.language',
  'sabout.in.whatsapp',
  'sabout.in.payAtHospital',
  'sabout.in.delays',
  'sabout.in.rural',
  'sabout.in.queue',
]

function Bullet({ children }) {
  return (
    <li className="flex items-start gap-3 text-sm text-ink-soft">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-sage-deep/70" />
      <span>{children}</span>
    </li>
  )
}

export default function About() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const brand = BRAND.name

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={HeartPulse}
          eyebrow={t('sabout.eyebrow')}
          title={t('sabout.title', { brand })}
          subtitle={t('sabout.subtitle', { brand })}
        />

        {/* Intro + mission */}
        <div className="mt-6 space-y-4">
          <p className="max-w-3xl leading-relaxed text-ink-soft">
            {t('sabout.intro')}
          </p>
          <div className="flex items-start gap-3 rounded-2xl border border-white/50 bg-card/70 p-5 shadow-sm backdrop-blur-sm">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-base text-foreground sm:text-lg">
              {t('sabout.missionLine')}
            </p>
          </div>
        </div>

        {/* Why We Built TapCure */}
        <section className="mt-8 rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="font-serif text-2xl">{t('sabout.whyTitle', { brand })}</h2>
          </div>
          <p className="mt-5 max-w-3xl text-sm text-muted-foreground">
            {t('sabout.whyBody', { brand })}
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_ITEMS.map((item) => (
              <Bullet key={item}>{t(item)}</Bullet>
            ))}
          </ul>
        </section>

        {/* Vision + Mission */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Our Vision */}
          <section className="rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
                <Eye className="h-5 w-5" />
              </span>
              <h2 className="font-serif text-2xl">{t('sabout.visionTitle')}</h2>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {t('sabout.visionBody')}
            </p>
          </section>

          {/* Our Mission */}
          <section className="rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
                <Target className="h-5 w-5" />
              </span>
              <h2 className="font-serif text-2xl">{t('sabout.missionTitle')}</h2>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">{t('sabout.missionPatientIntro')}</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {MISSION_PATIENT.map((item) => (
                <Bullet key={item}>{t(item)}</Bullet>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">{t('sabout.missionHospitalIntro')}</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {MISSION_HOSPITAL.map((item) => (
                <Bullet key={item}>{t(item)}</Bullet>
              ))}
            </ul>
          </section>
        </div>

        {/* Built for India */}
        <section className="mt-8 rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <div className="flex items-center gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
              <MapPin className="h-5 w-5" />
            </span>
            <h2 className="font-serif text-2xl">{t('sabout.indiaTitle')}</h2>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            {t('sabout.indiaBody', { brand })}
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {INDIA_ITEMS.map((item) => (
              <Bullet key={item}>{t(item)}</Bullet>
            ))}
          </ul>
        </section>

        {/* Closing CTA band */}
        <section className="relative mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 px-8 py-9 text-white shadow-lift sm:px-12 sm:py-11">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-ember/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-emerald-300/25 blur-2xl" />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Stethoscope className="h-7 w-7" />
              </span>
              <h2 className="mt-6 font-serif text-3xl leading-tight sm:text-4xl">
                {t('sabout.ctaTitle')}
              </h2>
              <p className="mt-3 max-w-xl text-white/85">
                {t('sabout.ctaBody', { brand })}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-shrink-0">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-white/40 transition-transform hover:scale-[1.02]"
              >
                {t('sabout.bookBtn')}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => navigate('/hospital-signup')}
                className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-transform hover:scale-[1.02]"
              >
                <MessageCircle className="h-4 w-4" />
                {t('sabout.partnerBtn')}
              </button>
            </div>
          </div>
        </section>
      </main>
    </StaticPageShell>
  )
}
