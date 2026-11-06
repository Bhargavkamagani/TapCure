import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle, ChevronDown, MessageCircle, User, Building2, Stethoscope } from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * FAQ, segmented by audience — Patients / Hospitals / Doctors each ask different
 * things, so the questions are grouped and shown one audience at a time.
 */
// Question/answer text lives in i18n/dict/staticFaq.js as
// `sfaq.<audience>.<id>.q` / `.a`; only the ids are kept here.
const GROUPS = {
  patient: {
    icon: User,
    faqs: ['what', 'hospital', 'booking', 'cost', 'consultFee', 'token', 'track', 'travel', 'family', 'delay', 'upload', 'ai', 'langs', 'safe'],
  },
  hospital: {
    icon: Building2,
    faqs: ['join', 'cost', 'queue', 'walkin', 'doctors', 'notify', 'reports', 'verify'],
  },
  doctor: {
    icon: Stethoscope,
    faqs: ['join', 'docs', 'verify', 'avail', 'queue', 'rx', 'delay', 'reports', 'multi', 'cost'],
  },
}

const ORDER = ['patient', 'hospital', 'doctor']

export default function FAQ() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [audience, setAudience] = useState('patient')
  const [openIndex, setOpenIndex] = useState(0)

  const select = (key) => { setAudience(key); setOpenIndex(0) }
  const faqs = GROUPS[audience].faqs.map((id) => ({
    id,
    q: t(`sfaq.${audience}.${id}.q`),
    a: t(`sfaq.${audience}.${id}.a`),
  }))

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={HelpCircle}
          eyebrow={t('sfaq.eyebrow', { brand: BRAND.name })}
          title={t('sfaq.title')}
          subtitle={t('sfaq.subtitle')}
        />

        {/* Audience tabs */}
        <div className="mt-8 flex flex-wrap gap-2">
          {ORDER.map((key) => {
            const g = GROUPS[key]
            const Icon = g.icon
            const active = audience === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => select(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  active
                    ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-sm'
                    : 'border border-white/50 bg-card/70 text-ink-soft backdrop-blur-sm hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" /> {t(`sfaq.${key}.label`)}
              </button>
            )
          })}
        </div>

        {/* Accordion for the selected audience */}
        <section className="mt-6 space-y-3">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/50 bg-card/70 shadow-sm backdrop-blur-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
                >
                  <span className="font-serif text-lg text-foreground">{item.q}</span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-sage-deep transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <div className="px-6 pb-5 leading-relaxed text-ink-soft">{item.a}</div>}
              </div>
            )
          })}
        </section>

        {/* Footer CTA */}
        <section className="mt-12">
          <div className="rounded-3xl border border-white/50 bg-white/40 px-8 py-10 text-center shadow-lift backdrop-blur-sm">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-sm">
              <MessageCircle className="h-7 w-7" />
            </span>
            <h2 className="mt-6 font-serif text-2xl text-foreground sm:text-3xl">{t('sfaq.stillQ')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
              {t('sfaq.stillBody', { brand: BRAND.name })}
            </p>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]"
            >
              <MessageCircle className="h-4 w-4" /> {t('sfaq.contact')}
            </button>
          </div>
        </section>
      </main>
    </StaticPageShell>
  )
}
