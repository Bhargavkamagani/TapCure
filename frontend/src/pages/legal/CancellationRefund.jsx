import {
  ReceiptText, BadgeIndianRupee, UserX, Building2, RefreshCw,
  Wallet, Stethoscope, Mail,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { SectionCard } from '../../components/landing/LegalSection.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Public Cancellation & Refund Policy page (route: /cancellation-refund).
 *
 * Extracted and expanded from the content-pack Terms §8 into a standalone
 * policy — payment gateways (Razorpay/PhonePe) require a separately-linkable
 * cancellation/refund URL for merchant onboarding.
 *
 * Rewritten 2026-09-01 to state the ACTUAL commercial model: the ₹10 platform
 * fee is NON-REFUNDABLE, and the remedy offered instead is free rescheduling
 * plus a free rebooking credit. The earlier draft promised refunds "within 7
 * business days", which nothing could deliver — there is no refund call in
 * razorpay_client.py, and cancelling only writes refund_status='pending' that
 * nothing consumes.
 *
 * What the page describes now maps 1:1 onto real code:
 *   free reschedule  -> appointments.reschedule (fee row untouched, limit from
 *                       hospital_settings.free_reschedules, staff moves excluded)
 *   rebooking credit -> session_cancellation.py (free_rebook_granted, single use,
 *                       CREDIT_VALID_DAYS = 90, scoped to the granting hospital)
 * Keep them in step: if either rule changes in code, this page must change too.
 *
 * NOTE: still to be reviewed legally before public launch.
 */

const COMPANY = 'Trovate LLP'
const CONTACT_EMAIL = 'hello@tapcure.in'
const CONTACT_PHONE = '+91 93468 21621'

const buildSections = (t) => {
  const brand = BRAND.name
  return [
  {
    id: 1, icon: ReceiptText, title: t('lcr.s1.title'),
    blocks: [
      { type: 'p', text: t('lcr.s1.p1', { brand }) },
      { type: 'p', text: t('lcr.s1.p2') },
    ],
  },
  {
    id: 2, icon: BadgeIndianRupee, title: t('lcr.s2.title'),
    blocks: [
      { type: 'p', text: t('lcr.s2.p1') },
      { type: 'p', text: t('lcr.s2.p2') },
    ],
  },
  {
    id: 3, icon: UserX, title: t('lcr.s3.title'),
    blocks: [
      { type: 'p', text: t('lcr.s3.p1') },
      { type: 'ul', items: [
        t('lcr.s3.li1'),
        t('lcr.s3.li2'),
        t('lcr.s3.li3'),
      ] },
    ],
  },
  {
    id: 4, icon: Building2, title: t('lcr.s4.title'),
    blocks: [
      { type: 'p', text: t('lcr.s4.p1') },
      { type: 'p', text: t('lcr.s4.p2') },
      { type: 'p', text: t('lcr.s4.p3') },
    ],
  },
  {
    id: 5, icon: RefreshCw, title: t('lcr.s5.title'),
    blocks: [
      { type: 'p', text: t('lcr.s5.p1') },
      { type: 'p', text: t('lcr.s5.p2') },
      { type: 'p', text: t('lcr.s5.p3') },
    ],
  },
  {
    id: 6, icon: Wallet, title: t('lcr.s6.title'),
    blocks: [
      { type: 'p', text: t('lcr.s6.p1') },
      { type: 'p', text: t('lcr.s6.p2') },
      { type: 'p', text: t('lcr.s6.p3'), tone: 'warn' },
    ],
  },
  {
    id: 7, icon: Stethoscope, title: t('lcr.s7.title'),
    blocks: [
      { type: 'p', text: t('lcr.s7.p1', { brand }) },
    ],
  },
  {
    id: 8, icon: Mail, title: t('lcr.s8.title'),
    blocks: [
      { type: 'p', text: t('lcr.s8.p1', { email: CONTACT_EMAIL, phone: CONTACT_PHONE }) },
      { type: 'p', text: t('lcr.s8.p2') },
    ],
  },
  ]
}

export function CancellationRefundBody() {
  const { t } = useI18n()
  const SECTIONS = buildSections(t)
  return (
    <>
      <PageHero
        icon={ReceiptText}
        eyebrow={t('lcr.eyebrow')}
        title={t('lcr.title')}
        subtitle={t('lcr.subtitle', { brand: BRAND.name })}
        chips={[t('lcr.chipEffective', { date: t('lcr.effectiveDate') }), COMPANY, t('lcr.chipFee'), t('lcr.chipReschedule')]}
      />

      {/* ── Sections ── */}
      <div className="mt-8 space-y-6">
        {SECTIONS.map((s) => <SectionCard key={s.id} section={s} />)}
      </div>

      {/* ── Contact banner ── */}
      <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 px-8 py-10 text-white shadow-lift sm:px-12">
        <div className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full bg-ember/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Mail className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">{t('lcr.needHelp')}</p>
              <h2 className="mt-1 font-serif text-2xl leading-tight sm:text-3xl">{t('lcr.contactTitle')}</h2>
            </div>
          </div>
          <div className="text-sm text-white/90">
            <p className="font-semibold">{COMPANY}</p>
            <p>{t('lcr.email')} <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">{CONTACT_EMAIL}</a></p>
            <p>{t('lcr.phone')} <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="underline underline-offset-2">{CONTACT_PHONE}</a></p>
            <p>{t('lcr.address')}</p>
          </div>
        </div>
      </section>
    </>
  )
}

export default function CancellationRefund() {
  return (
    <StaticPageShell legal>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <CancellationRefundBody />
      </main>
    </StaticPageShell>
  )
}
