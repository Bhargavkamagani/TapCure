import {
  ShieldCheck, Building2, Database, Workflow,
  Scale, Pill, Share2, MessageCircle, Cookie, Lock, Archive, Baby,
  UserCheck, AlertTriangle, Network, RefreshCw, Mail, EyeOff, BadgeIndianRupee,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { SectionCard } from '../../components/landing/LegalSection.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Public Privacy Policy page (route: /privacy).
 *
 * Verbatim copy from the "TapCure Website Content Pack 1" doc, with the known
 * placeholders filled in (Trovate LLP, TapCure, thetapcure@gmail.com, tapcure.in,
 * effective 9 July 2026). Registered address and grievance-officer name remain
 * as [ ] placeholders until finalised. Reachable without auth — required for
 * DPDP compliance and app-store / payment-gateway onboarding.
 *
 * Styled to match the editorial landing theme: gradient teal→green banners,
 * serif headings, sage eyebrows, icon-chip section cards.
 *
 * NOTE: This document should be reviewed by a qualified legal professional
 * before public launch.
 */

const COMPANY = 'Trovate LLP'
const EFFECTIVE_DATE = '1 September 2026'
const WEBSITE = 'https://tapcure.in'
const CONTACT_EMAIL = 'thetapcure@gmail.com'
const CONTACT_PHONE = '+91 93468 21621'
const CONTACT_ADDRESS = 'Hyderabad, Telangana, India'

// Three at-a-glance promises shown in the highlight band under the hero.
// Strings are i18n keys (src/i18n/dict/legalPrivacy.js), resolved with t() in PrivacyBody.
const HIGHLIGHTS = [
  { icon: EyeOff, title: 'lpp.hl1.title', desc: 'lpp.hl1.desc' },
  { icon: Lock, title: 'lpp.hl2.title', desc: 'lpp.hl2.desc' },
  { icon: BadgeIndianRupee, title: 'lpp.hl3.title', desc: 'lpp.hl3.desc' },
]

// List-item keys: L('lpp.s1.a', 3) -> ['lpp.s1.a.1', 'lpp.s1.a.2', 'lpp.s1.a.3']
const L = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}.${i + 1}`)

// Section content, kept as data so the long policy stays readable.
// block types: 'p' (paragraph), 'ul' (bullet list), 'sub' (sub-heading)
// tone: 'default' | 'warn' — warn renders as an ember-accented callout card.
// All text values are i18n keys; PrivacyBody translates them before rendering.
const SECTIONS = [
  {
    id: 1, icon: Building2, title: 'lpp.s1.title',
    blocks: [
      { type: 'p', text: 'lpp.s1.p1' },
      { type: 'p', text: 'lpp.s1.p2' },
      { type: 'ul', items: L('lpp.s1.a', 11) },
      { type: 'p', text: 'lpp.s1.p3' },
    ],
  },
  {
    id: 2, icon: Database, title: 'lpp.s2.title',
    blocks: [
      { type: 'p', text: 'lpp.s2.p1' },
      { type: 'sub', text: 'lpp.s2.sub1' },
      { type: 'ul', items: L('lpp.s2.a', 12) },
      { type: 'sub', text: 'lpp.s2.sub2' },
      { type: 'ul', items: L('lpp.s2.b', 12) },
      { type: 'sub', text: 'lpp.s2.sub3' },
      { type: 'ul', items: L('lpp.s2.c', 9) },
      { type: 'sub', text: 'lpp.s2.sub4' },
      { type: 'p', text: 'lpp.s2.p2' },
      { type: 'p', text: 'lpp.s2.p3' },
      { type: 'sub', text: 'lpp.s2.sub5' },
      { type: 'p', text: 'lpp.s2.p4' },
      { type: 'p', text: 'lpp.s2.p5' },
    ],
  },
  {
    id: 3, icon: Workflow, title: 'lpp.s3.title',
    blocks: [
      { type: 'p', text: 'lpp.s3.p1' },
      { type: 'ul', items: L('lpp.s3.a', 16) },
    ],
  },
  {
    id: 4, icon: Scale, title: 'lpp.s4.title',
    blocks: [
      { type: 'p', text: 'lpp.s4.p1' },
      { type: 'p', text: 'lpp.s4.p2' },
      { type: 'p', text: 'lpp.s4.p3' },
      { type: 'p', text: 'lpp.s4.p4' },
    ],
  },
  {
    id: 5, icon: Pill, title: 'lpp.s5.title', tone: 'warn',
    blocks: [
      { type: 'p', text: 'lpp.s5.p1' },
      { type: 'p', text: 'lpp.s5.p2' },
      { type: 'p', text: 'lpp.s5.p3' },
      { type: 'ul', items: L('lpp.s5.a', 5) },
      { type: 'p', text: 'lpp.s5.p4' },
    ],
  },
  {
    id: 6, icon: Share2, title: 'lpp.s6.title',
    blocks: [
      { type: 'p', text: 'lpp.s6.p1' },
      { type: 'ul', items: L('lpp.s6.a', 7) },
      { type: 'p', text: 'lpp.s6.p2' },
    ],
  },
  {
    id: 7, icon: MessageCircle, title: 'lpp.s7.title',
    blocks: [
      { type: 'p', text: 'lpp.s7.p1' },
      { type: 'ul', items: L('lpp.s7.a', 7) },
      { type: 'p', text: 'lpp.s7.p2' },
    ],
  },
  {
    id: 8, icon: Cookie, title: 'lpp.s8.title',
    blocks: [
      { type: 'p', text: 'lpp.s8.p1' },
      { type: 'ul', items: L('lpp.s8.a', 5) },
      { type: 'p', text: 'lpp.s8.p2' },
    ],
  },
  {
    id: 9, icon: Lock, title: 'lpp.s9.title',
    blocks: [
      { type: 'p', text: 'lpp.s9.p1' },
      { type: 'ul', items: L('lpp.s9.a', 7) },
      { type: 'p', text: 'lpp.s9.p2' },
    ],
  },
  {
    id: 10, icon: Archive, title: 'lpp.s10.title',
    blocks: [
      { type: 'p', text: 'lpp.s10.p1' },
      { type: 'ul', items: L('lpp.s10.a', 6) },
      { type: 'p', text: 'lpp.s10.p2' },
      { type: 'p', text: 'lpp.s10.p3' },
    ],
  },
  {
    id: 11, icon: Baby, title: 'lpp.s11.title',
    blocks: [
      { type: 'p', text: 'lpp.s11.p1' },
      { type: 'p', text: 'lpp.s11.p2' },
    ],
  },
  {
    id: 12, icon: UserCheck, title: 'lpp.s12.title',
    blocks: [
      { type: 'p', text: 'lpp.s12.p1' },
      { type: 'ul', items: L('lpp.s12.a', 6) },
      { type: 'p', text: 'lpp.s12.p2' },
    ],
  },
  {
    id: 13, icon: AlertTriangle, title: 'lpp.s13.title',
    blocks: [
      { type: 'p', text: 'lpp.s13.p1' },
    ],
  },
  {
    id: 14, icon: Network, title: 'lpp.s14.title',
    blocks: [
      { type: 'p', text: 'lpp.s14.p1' },
      { type: 'ul', items: L('lpp.s14.a', 7) },
      { type: 'p', text: 'lpp.s14.p2' },
    ],
  },
  {
    id: 15, icon: RefreshCw, title: 'lpp.s15.title',
    blocks: [
      { type: 'p', text: 'lpp.s15.p1' },
    ],
  },
]

export function PrivacyBody() {
  const { t } = useI18n()
  const V = { brand: BRAND.name, email: CONTACT_EMAIL, phone: CONTACT_PHONE, address: CONTACT_ADDRESS, date: EFFECTIVE_DATE }
  const tr = (key) => t(key, V)
  const sections = SECTIONS.map((s) => ({
    ...s,
    title: tr(s.title),
    blocks: s.blocks.map((b) => (b.type === 'ul' ? { ...b, items: b.items.map(tr) } : { ...b, text: tr(b.text) })),
  }))
  return (
    <>
        <PageHero
          icon={ShieldCheck}
          eyebrow={tr('lpp.hero.eyebrow')}
          title={tr('lpp.hero.title')}
          subtitle={tr('lpp.hero.subtitle')}
          chips={[tr('lpp.hero.effective'), COMPANY, 'DPDP Act · IT Act 2000']}
        />

        {/* ── At-a-glance highlight band ── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border-2 border-green-500/40 bg-card p-5 shadow-[0_0_18px_rgba(34,197,94,0.18)]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage/50 text-sage-deep">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 font-serif text-lg leading-tight">{tr(title)}</p>
              <p className="mt-1 text-sm text-ink-soft">{tr(desc)}</p>
            </div>
          ))}
        </div>

        {/* ── Identity / contact card ── */}
        <div className="mt-6 grid gap-3 rounded-2xl border border-white/50 bg-white/40 p-6 text-sm text-ink-soft backdrop-blur-sm sm:grid-cols-2">
          <div><span className="text-sage-deep">{tr('lpp.id.company')}</span><p className="font-medium text-foreground">{COMPANY}</p></div>
          <div><span className="text-sage-deep">{tr('lpp.id.platform')}</span><p className="font-medium text-foreground">{BRAND.name}</p></div>
          <div><span className="text-sage-deep">{tr('lpp.id.website')}</span><p><a href={WEBSITE} className="font-medium text-foreground underline underline-offset-2">{WEBSITE}</a></p></div>
          <div><span className="text-sage-deep">{tr('lpp.id.contact')}</span><p><a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-2">{CONTACT_EMAIL}</a></p></div>
        </div>

        {/* ── Intro ── */}
        <div className="mt-8 space-y-3 leading-relaxed text-ink-soft">
          <p>{tr('lpp.intro.p1')}</p>
          <p>{tr('lpp.intro.p2')}</p>
        </div>

        {/* ── Sections ── */}
        <div className="mt-8 space-y-6">
          {sections.map((s) => <SectionCard key={s.id} section={s} />)}
        </div>

        {/* ── Contact banner (section 16) ── */}
        <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 px-8 py-10 text-white shadow-lift sm:px-12">
          <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-ember/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">{tr('lpp.contact.eyebrow')}</p>
                <h2 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">{tr('lpp.contact.title')}</h2>
              </div>
            </div>
            <div className="text-sm text-white/90">
              <p className="font-semibold">{COMPANY}</p>
              <p>{tr('lpp.contact.email')} <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a></p>
              <p>{tr('lpp.contact.phone')} <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="underline underline-offset-2">{CONTACT_PHONE}</a></p>
              <p>{tr('lpp.contact.address')}</p>
              <p>{tr('lpp.contact.grievance')}</p>
            </div>
          </div>
        </section>
    </>
  )
}

export default function PrivacyPolicy() {
  return (
    <StaticPageShell legal>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PrivacyBody />
      </main>
    </StaticPageShell>
  )
}
