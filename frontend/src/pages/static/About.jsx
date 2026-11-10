import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Car,
  Eye,
  Footprints,
  Hourglass,
  Languages,
  ListOrdered,
  MessageCircle,
  Navigation,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * About — the first page on the landing page's look (StaticPageShell `modern`,
 * 2026-11-03). Told as a story instead of four boxes of bullets: what a hospital
 * visit is like today, what TapCure changes, who it is for, and why it fits
 * India. The "Amma" day is an example and is labelled as one on the page.
 */

// Example times, not patient data. Times stay in Latin digits like the rest of the site.
const BEFORE = [['6:30 AM', 'sabout.story.b1'], ['8:15 AM', 'sabout.story.b2'], ['12:40 PM', 'sabout.story.b3']]
const AFTER = [['8:00 AM', 'sabout.story.a1'], ['11:50 AM', 'sabout.story.a2'], ['12:25 PM', 'sabout.story.a3']]

const POINTS = [
  [Smartphone, 'sabout.p1.t', 'sabout.p1.b'],
  [Navigation, 'sabout.p2.t', 'sabout.p2.b'],
  [MessageCircle, 'sabout.p3.t', 'sabout.p3.b'],
]

const FOR_PATIENTS = ['sabout.mp.book', 'sabout.mp.reach', 'sabout.mp.avoid', 'sabout.mp.reminders', 'sabout.mp.family']
const FOR_HOSPITALS = ['sabout.mc.crowd', 'sabout.mc.manage', 'sabout.mc.clarity', 'sabout.mc.ops']

const INDIA = [
  [Footprints, 'sabout.in.walkin'],
  [Users, 'sabout.in.family'],
  [Languages, 'sabout.in.language'],
  [MessageCircle, 'sabout.in.whatsapp'],
  [Wallet, 'sabout.in.payAtHospital'],
  [Hourglass, 'sabout.in.delays'],
  [Car, 'sabout.in.rural'],
  [ListOrdered, 'sabout.in.queue'],
]

function Check() {
  return (
    <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0A9A96]/15 text-[#0A9A96]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="m5 13 4.5 4.5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function SectionHead({ eyebrow, title, lead }) {
  return (
    <div className="mx-auto max-w-[720px] text-center">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0A9A96]">{eyebrow}</p>}
      <h2 className="mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[40px]">{title}</h2>
      {lead && <p className="mt-4 text-[17px] leading-relaxed text-[#41526E] sm:text-[18px]">{lead}</p>}
    </div>
  )
}

function Actions({ onDark = false, center = false }) {
  const { t } = useI18n()
  return (
    <div className={`flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>
      <Link
        to="/search"
        className={`inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5 ${
          onDark
            ? 'bg-white text-[#0B2150] shadow-lg'
            : 'bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] text-white shadow-[0_12px_30px_-12px_rgba(10,154,150,.9)]'
        }`}
      >
        {t('sabout.bookBtn')} <ArrowRight className="h-4 w-4" />
      </Link>
      <Link
        to="/hospital-signup"
        className={`inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5 ${
          onDark ? 'border-white/50 bg-white/10 text-white' : 'border-[#0B2150]/15 bg-white text-[#0B2150]'
        }`}
      >
        <Building2 className="h-4 w-4" /> {t('sabout.partnerBtn')}
      </Link>
    </div>
  )
}

function Timeline({ title, steps, total, good }) {
  const { t } = useI18n()
  return (
    <div
      className={`rounded-[28px] border p-6 sm:p-8 ${
        good ? 'border-[#0A9A96]/35 bg-white shadow-[0_24px_60px_-34px_rgba(10,154,150,.7)]' : 'border-[#0B2150]/10 bg-white/70'
      }`}
    >
      <p className={`text-sm font-bold uppercase tracking-[0.12em] ${good ? 'text-[#0A9A96]' : 'text-[#E14356]'}`}>{title}</p>
      <ol className="mt-6 space-y-6">
        {steps.map(([time, key], i) => (
          <li key={key} className="relative flex gap-4">
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="absolute left-[7px] top-6 h-[calc(100%+8px)] w-[2px] bg-[#0B2150]/10" />
            )}
            <span aria-hidden="true" className={`relative mt-1.5 h-4 w-4 shrink-0 rounded-full border-[3px] bg-white ${good ? 'border-[#0A9A96]' : 'border-[#E14356]/70'}`} />
            <div>
              <p className="text-[15px] font-bold tabular-nums text-[#0B2150]">{time}</p>
              <p className="mt-0.5 text-[16px] leading-snug text-[#41526E]">{t(key)}</p>
            </div>
          </li>
        ))}
      </ol>
      <p
        className={`mt-7 flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[16px] font-semibold ${
          good ? 'bg-[#0A9A96]/10 text-[#0B8C88]' : 'bg-[#E14356]/10 text-[#C2334A]'
        }`}
      >
        <Hourglass className="h-5 w-5 shrink-0" /> {t(total)}
      </p>
    </div>
  )
}

export default function About() {
  const { t } = useI18n()
  const brand = BRAND.name

  return (
    <StaticPageShell modern title={t('sabout.eyebrow')}>
      <main className="mx-auto max-w-[1200px] px-5 sm:px-8">
        {/* ── hero ── */}
        <section className="pb-4 pt-14 text-center sm:pt-20">
          <span className="inline-flex rounded-full bg-[#0A9A96]/10 px-4 py-1.5 text-sm font-semibold text-[#0A9A96]">
            {t('sabout.title', { brand })}
          </span>
          <h1 className="mx-auto mt-6 max-w-[15ch] text-[40px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[60px]">
            {t('sabout.heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-[18px] leading-relaxed text-[#41526E] sm:text-[19px]">
            {t('sabout.subtitle', { brand })}
          </p>
          <div className="mt-9">
            <Actions center />
          </div>
        </section>

        {/* ── story: a visit today vs with TapCure ── */}
        <section className="mt-24">
          <SectionHead eyebrow={t('sabout.story.eyebrow')} title={t('sabout.story.title')} lead={t('sabout.intro')} />
          <div className="mx-auto mt-12 grid max-w-[980px] gap-6 md:grid-cols-2">
            <Timeline title={t('sabout.story.before', { brand })} steps={BEFORE} total="sabout.story.bTotal" />
            <Timeline title={t('sabout.story.after', { brand })} steps={AFTER} total="sabout.story.aTotal" good />
          </div>
          <p className="mt-5 text-center text-[13px] text-[#6B7A8F]">{t('sabout.story.note')}</p>
        </section>

        {/* ── why we built it ── */}
        <section className="mt-28">
          <SectionHead title={t('sabout.whyTitle', { brand })} lead={t('sabout.whyShort', { brand })} />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {POINTS.map(([Icon, title, body]) => (
              <div key={title} className="rounded-[26px] border border-[#0B2150]/10 bg-white p-7 shadow-[0_18px_40px_-32px_rgba(15,39,66,.5)]">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#00C9C5] to-[#2F58B7] text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-[20px] font-bold tracking-[-0.01em]">{t(title)}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-[#41526E]">{t(body)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── vision ── */}
        <section className="mt-28 overflow-hidden rounded-[32px] bg-[#0B2150] px-7 py-14 text-center text-white sm:px-14 sm:py-16">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#00C9C5]">
            <Eye className="h-6 w-6" />
          </span>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-[#00C9C5]">{t('sabout.visionTitle')}</p>
          <p className="mx-auto mt-4 max-w-[760px] text-[24px] font-semibold leading-snug tracking-[-0.01em] sm:text-[32px]">
            {t('sabout.visionBody')}
          </p>
        </section>

        {/* ── mission: for patients / for hospitals ── */}
        <section className="mt-28">
          <SectionHead title={t('sabout.missionTitle')} lead={t('sabout.missionLine')} />
          <div className="mx-auto mt-12 grid max-w-[980px] gap-6 md:grid-cols-2">
            {[[Users, 'sabout.forPatients', FOR_PATIENTS], [Building2, 'sabout.forHospitals', FOR_HOSPITALS]].map(([Icon, head, items]) => (
              <div key={head} className="rounded-[26px] border border-[#0B2150]/10 bg-white p-7 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0A9A96]/10 text-[#0A9A96]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-[20px] font-bold">{t(head)}</h3>
                </div>
                <ul className="mt-6 space-y-3.5">
                  {items.map((k) => (
                    <li key={k} className="flex gap-3 text-[16px] leading-snug text-[#41526E]"><Check />{t(k)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── built for India ── */}
        <section className="mt-28">
          <SectionHead title={t('sabout.indiaTitle')} lead={t('sabout.indiaBody', { brand })} />
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {INDIA.map(([Icon, k]) => (
              <div key={k} className="flex flex-col items-start gap-3 rounded-[22px] border border-[#0B2150]/10 bg-white/80 p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0A9A96]/10 text-[#0A9A96]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[16px] font-semibold leading-snug">{t(k)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── closing ── */}
        <section className="mt-28 overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0A9A96] via-[#0B8C88] to-[#2F58B7] px-7 py-14 text-center text-white sm:px-14 sm:py-16">
          <h2 className="mx-auto max-w-[20ch] text-[30px] font-bold leading-tight tracking-[-0.02em] sm:text-[40px]">{t('sabout.ctaTitle')}</h2>
          <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-white/85 sm:text-[18px]">{t('sabout.ctaBody', { brand })}</p>
          <div className="mt-9">
            <Actions onDark center />
          </div>
        </section>
      </main>
    </StaticPageShell>
  )
}
