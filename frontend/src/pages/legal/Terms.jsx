import {
  ScrollText, Info, UserCheck, KeyRound, CalendarCheck, Stethoscope,
  BadgeIndianRupee, Ticket, ReceiptText, HeartPulse, Pill, Calculator,
  ShieldAlert, Copyright, Network, Scale, ShieldCheck, Ban, RefreshCw,
  Landmark, Mail,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { SectionCard } from '../../components/landing/LegalSection.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Public Terms & Conditions page (route: /terms).
 *
 * Verbatim copy from the "TapCure Website Content Pack 1" doc, known
 * placeholders filled in (Trovate LLP, TapCure, thetapcure@gmail.com, tapcure.in,
 * effective 9 July 2026). Jurisdiction city and registered address remain as
 * [ ] placeholders until finalised.
 *
 * NOTE: These Terms should be reviewed by a qualified legal professional
 * before public launch.
 */

const COMPANY = 'Trovate LLP'
const EFFECTIVE_DATE = '1 September 2026'
const WEBSITE = 'https://tapcure.in'
const CONTACT_EMAIL = 'thetapcure@gmail.com'
const CONTACT_PHONE = '+91 93468 21621'
const CONTACT_ADDRESS = 'Hyderabad, Telangana, India'

// Section layout only — all copy lives in src/i18n/dict/legalTerms.js under
// `lt.s<id>.*`. Block specs: 'pN' = paragraph key, a number N = bulleted list
// of keys li1..liN.
const SECTION_SPECS = [
  { id: 1, icon: Info, blocks: ['p1', 'p2'] },
  { id: 2, icon: UserCheck, blocks: ['p1', 'p2'] },
  { id: 3, icon: KeyRound, blocks: ['p1', 'p2', 5] },
  { id: 4, icon: CalendarCheck, blocks: ['p1', 8, 'p2'] },
  { id: 5, icon: Stethoscope, blocks: ['p1', 7, 'p2'] },
  { id: 6, icon: BadgeIndianRupee, blocks: ['p1', 'p2', 'p3', 'p4'] },
  { id: 7, icon: Ticket, blocks: ['p1', 'p2', 5, 'p3'] },
  { id: 8, icon: ReceiptText, readMoreTo: '/cancellation-refund', blocks: ['p1', 5, 'p2'] },
  { id: 9, icon: HeartPulse, tone: 'warn', blocks: ['p1', 'p2', 'p3', 'p4'] },
  { id: 10, icon: Pill, tone: 'warn', blocks: ['p1', 4, 'p2'] },
  { id: 11, icon: Calculator, blocks: ['p1', 'p2'] },
  { id: 12, icon: ShieldAlert, blocks: ['p1', 8] },
  { id: 13, icon: Copyright, blocks: ['p1', 'p2'] },
  { id: 14, icon: Network, blocks: ['p1', 'p2'] },
  { id: 15, icon: Scale, blocks: ['p1', 9] },
  { id: 16, icon: ShieldCheck, blocks: ['p1'] },
  { id: 17, icon: Ban, blocks: ['p1', 5] },
  { id: 18, icon: RefreshCw, blocks: ['p1'] },
  { id: 19, icon: Landmark, blocks: ['p1', 'p2'] },
]

function buildSections(t) {
  const vars = { brand: BRAND.name, company: COMPANY }
  return SECTION_SPECS.map(({ id, icon, tone, readMoreTo, blocks }) => ({
    id, icon, tone,
    title: t(`lt.s${id}.title`),
    ...(readMoreTo && { readMore: { label: t(`lt.s${id}.readMore`), to: readMoreTo } }),
    blocks: blocks.map((b) => (typeof b === 'number'
      ? { type: 'ul', items: Array.from({ length: b }, (_, i) => t(`lt.s${id}.li${i + 1}`, vars)) }
      : { type: 'p', text: t(`lt.s${id}.${b}`, vars) })),
  }))
}

export function TermsBody() {
  const { t } = useI18n()
  const sections = buildSections(t)
  return (
    <>
        <PageHero
          icon={ScrollText}
          eyebrow={t('lt.hero.eyebrow')}
          title={t('lt.hero.title')}
          subtitle={t('lt.hero.subtitle', { brand: BRAND.name })}
          chips={[t('lt.hero.effective', { date: EFFECTIVE_DATE }), COMPANY, t('lt.hero.law')]}
        />

        {/* ── Identity card ── */}
        <div className="mt-6 grid gap-3 rounded-2xl border border-white/50 bg-white/40 p-6 text-sm text-ink-soft backdrop-blur-sm sm:grid-cols-2">
          <div><span className="text-sage-deep">{t('lt.id.company')}</span><p className="font-medium text-foreground">{COMPANY}</p></div>
          <div><span className="text-sage-deep">{t('lt.id.platform')}</span><p className="font-medium text-foreground">{BRAND.name}</p></div>
          <div><span className="text-sage-deep">{t('lt.id.website')}</span><p><a href={WEBSITE} className="font-medium text-foreground underline underline-offset-2">{WEBSITE}</a></p></div>
          <div><span className="text-sage-deep">{t('lt.id.contact')}</span><p><a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-2">{CONTACT_EMAIL}</a></p></div>
        </div>

        {/* ── Sections ── */}
        <div className="mt-8 space-y-6">
          {sections.map((s) => <SectionCard key={s.id} section={s} />)}
        </div>

        {/* ── Contact banner (section 20) ── */}
        <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 px-8 py-10 text-white shadow-lift sm:px-12">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-ember/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">{t('lt.contact.eyebrow')}</p>
                <h2 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">{t('lt.contact.title')}</h2>
              </div>
            </div>
            <div className="text-sm text-white/90">
              <p className="font-semibold">{COMPANY}</p>
              <p>{t('lt.contact.email')} <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a></p>
              <p>{t('lt.contact.phone')} <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="underline underline-offset-2">{CONTACT_PHONE}</a></p>
              <p>{t('lt.contact.address')} {CONTACT_ADDRESS}</p>
            </div>
          </div>
        </section>
    </>
  )
}

export default function Terms() {
  return (
    <StaticPageShell legal>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <TermsBody />
      </main>
    </StaticPageShell>
  )
}
