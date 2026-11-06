import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Search,
  CalendarCheck,
  Ticket,
  ListOrdered,
  Navigation,
  MessageCircle,
  Users,
  FileUp,
  BellRing,
  Languages,
  CalendarClock,
  LayoutDashboard,
  ListChecks,
  UserPlus,
  Clock,
  BarChart3,
  Send,
  ShieldCheck,
  BadgeCheck,
  MapPin,
  BellDot,
  LifeBuoy,
  CalendarDays,
  Building2,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { useI18n } from '../../i18n/index.jsx'

const PATIENT_FEATURES = [
  {
    icon: Search,
    title: 'sfeat.p.search.title',
    desc: 'sfeat.p.search.desc',
  },
  {
    icon: CalendarCheck,
    title: 'sfeat.p.booking.title',
    desc: 'sfeat.p.booking.desc',
  },
  {
    icon: Ticket,
    title: 'sfeat.p.token.title',
    desc: 'sfeat.p.token.desc',
  },
  {
    icon: ListOrdered,
    title: 'sfeat.p.queue.title',
    desc: 'sfeat.p.queue.desc',
  },
  {
    icon: Navigation,
    title: 'sfeat.p.travel.title',
    desc: 'sfeat.p.travel.desc',
  },
  {
    icon: MessageCircle,
    title: 'sfeat.p.reminders.title',
    desc: 'sfeat.p.reminders.desc',
  },
  {
    icon: Users,
    title: 'sfeat.p.family.title',
    desc: 'sfeat.p.family.desc',
  },
  {
    icon: FileUp,
    title: 'sfeat.p.rx.title',
    desc: 'sfeat.p.rx.desc',
  },
  {
    icon: BellRing,
    title: 'sfeat.p.meds.title',
    desc: 'sfeat.p.meds.desc',
  },
  {
    icon: Languages,
    title: 'sfeat.p.lang.title',
    desc: 'sfeat.p.lang.desc',
  },
]

const HOSPITAL_FEATURES = [
  {
    icon: CalendarClock,
    title: 'sfeat.c.avail.title',
    desc: 'sfeat.c.avail.desc',
  },
  {
    icon: LayoutDashboard,
    title: 'sfeat.c.dash.title',
    desc: 'sfeat.c.dash.desc',
  },
  {
    icon: ListChecks,
    title: 'sfeat.c.queue.title',
    desc: 'sfeat.c.queue.desc',
  },
  {
    icon: UserPlus,
    title: 'sfeat.c.walkin.title',
    desc: 'sfeat.c.walkin.desc',
  },
  {
    icon: Clock,
    title: 'sfeat.c.delay.title',
    desc: 'sfeat.c.delay.desc',
  },
  {
    icon: BarChart3,
    title: 'sfeat.c.reports.title',
    desc: 'sfeat.c.reports.desc',
  },
  {
    icon: Send,
    title: 'sfeat.c.comm.title',
    desc: 'sfeat.c.comm.desc',
  },
]

const ADMIN_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'sfeat.a.hospital.title',
    desc: 'sfeat.a.hospital.desc',
  },
  {
    icon: BadgeCheck,
    title: 'sfeat.a.doctor.title',
    desc: 'sfeat.a.doctor.desc',
  },
  {
    icon: MapPin,
    title: 'sfeat.a.city.title',
    desc: 'sfeat.a.city.desc',
  },
  {
    icon: BellDot,
    title: 'sfeat.a.notif.title',
    desc: 'sfeat.a.notif.desc',
  },
  {
    icon: LifeBuoy,
    title: 'sfeat.a.support.title',
    desc: 'sfeat.a.support.desc',
  },
]

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-white/50 bg-card/70 p-5 shadow-sm backdrop-blur-sm">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-3 font-serif text-lg">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{desc}</p>
    </div>
  )
}

function FeatureGroup({ eyebrow, heading, features }) {
  const { t } = useI18n()
  return (
    <section className="mt-14">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage-deep">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">{heading}</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} icon={f.icon} title={t(f.title)} desc={t(f.desc)} />
        ))}
      </div>
    </section>
  )
}

export default function Features() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const brand = BRAND.name

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={Sparkles}
          eyebrow={t('sfeat.eyebrow', { brand })}
          title={t('sfeat.title')}
          subtitle={t('sfeat.subtitle', { brand })}
        />

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
          >
            <CalendarDays className="h-4 w-4" /> {t('sfeat.bookBtn')}
          </button>
          <button
            onClick={() => navigate('/hospital-signup')}
            className="inline-flex items-center gap-2 rounded-full border border-sage-deep/30 bg-white/50 px-6 py-3 text-sm font-semibold text-sage-deep transition-transform hover:scale-[1.02]"
          >
            <Building2 className="h-4 w-4" /> {t('sfeat.registerBtn')}
          </button>
        </div>

        {/* Feature groups */}
        <FeatureGroup eyebrow={t('sfeat.patientsEyebrow')} heading={t('sfeat.patientsHeading')} features={PATIENT_FEATURES} />
        <FeatureGroup eyebrow={t('sfeat.hospitalsEyebrow')} heading={t('sfeat.hospitalsHeading')} features={HOSPITAL_FEATURES} />
        <FeatureGroup eyebrow={t('sfeat.adminsEyebrow')} heading={t('sfeat.adminsHeading')} features={ADMIN_FEATURES} />

        {/* Closing CTA band */}
        <section className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 px-8 py-9 text-white shadow-lift sm:px-12 sm:py-11">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-ember/25 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-emerald-300/25 blur-2xl" />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-3xl leading-tight sm:text-4xl">{t('sfeat.ctaTitle')}</h2>
              <p className="mt-2 max-w-xl text-white/85">
                {t('sfeat.ctaBody', { brand })}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-white/30 transition-transform hover:scale-[1.02]"
              >
                <CalendarDays className="h-4 w-4" /> {t('sfeat.bookBtn')}
              </button>
              <button
                onClick={() => navigate('/hospital-signup')}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-teal-700 shadow-sm transition-transform hover:scale-[1.02]"
              >
                <Building2 className="h-4 w-4" /> {t('sfeat.registerBtn')}
              </button>
            </div>
          </div>
        </section>
      </main>
    </StaticPageShell>
  )
}
