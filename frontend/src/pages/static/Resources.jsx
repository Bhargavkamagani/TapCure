import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Users,
  Building2,
  Activity,
  HeartPulse,
  ArrowRight,
  Send,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { useI18n } from '../../i18n/index.jsx'
// Product and operations guides. Health awareness articles are a different
// thing and live on /health-articles.
// Displayed text is resolved through t() (i18n/dict/staticFaq.js): articles by
// position (`sres.<index>.*`), tags/categories by English title (`sres.topic.*`).
const ARTICLES = [
  {
    tag: 'Digital Healthcare',
    title: 'How Digital OP Tokens Reduce Waiting Time',
    blurb: 'Learn how digital tokens help patients avoid long queues and reach hospitals at the right time.',
    body: [
      'A paper token tells you your place in the queue and nothing else. You still have to sit in the waiting room to find out when your turn is near.',
      'A digital token keeps counting for you. As each consultation finishes, your position and estimated time update on your phone, so the waiting room is somewhere you arrive at — not somewhere you spend the morning.',
      'For the hospital the gain is the same in reverse: the front desk can see who is waiting, who has been called, and who has not turned up, without anyone having to ask.',
    ],
  },
  {
    tag: 'Patient Guides',
    title: 'Why Smart Travel Timing Matters for Rural Patients',
    blurb: 'Understand how patients travelling from villages can save time, money, and effort.',
    body: [
      'If you are travelling an hour to reach a hospital, knowing your token number is not enough. What you need to know is when to leave home.',
      'Booking records where you are starting from, and the app works backwards from your estimated turn — travel time, plus a buffer to arrive before you are called. You get a "time to leave" alert instead of a number to guess with.',
      'That matters most where a wasted trip costs a day of work and a bus fare, not just an afternoon.',
    ],
  },
  {
    tag: 'Hospital Operations',
    title: 'How Hospitals Can Manage Walk-in and Online Patients Together',
    blurb: 'A practical guide for reception teams and hospital administrators.',
    body: [
      'Most hospitals run two queues without meaning to: people who booked, and people who walked in. Kept separate, one of them always feels cheated.',
      'One queue solves it. A walk-in registered at the desk joins the same live list as an online booking, in the order they arrive, and the doctor calls from a single screen.',
      'The desk keeps the exceptions it actually needs — priority for an emergency, a recall for someone who stepped out — instead of holding the whole order in their head.',
    ],
  },
  {
    tag: 'Patient Guides',
    title: 'Getting the Most Out of a Short Consultation',
    blurb: 'A few minutes of preparation makes a ten-minute appointment go further.',
    body: [
      'Consultations are short. What you bring into the room decides how much of that time goes on catching up rather than on you.',
      'Three things help: the medicines you are already taking, when the problem started, and anything that has changed since the last visit. Written down beats remembered.',
      'Your record already carries some of this — past prescriptions, vitals taken at check-in, conditions and allergies the hospital has noted. Keeping it current means the doctor starts from what is true rather than from what you can recall on the day.',
    ],
  },
]

const CATEGORIES = [
  {
    icon: Users,
    title: 'Patient Guides',
    desc: 'Simple guides to help patients book appointments, understand digital tokens, and reduce waiting time.',
  },
  {
    icon: Building2,
    title: 'Hospital Operations',
    desc: 'Resources for hospitals to manage doctor availability, walk-ins, queues, and patient communication.',
  },
  {
    icon: Activity,
    title: 'Digital Healthcare',
    desc: 'Insights on digital health tools, patient reminders, telehealth readiness, and healthcare technology.',
  },
  {
    icon: HeartPulse,
    title: 'Health Awareness',
    desc: 'General awareness articles about wellness, preventive care, and health calculators.',
  },
]


export default function Resources() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const tr = (key, fallback) => {
    const v = t(key)
    return v === key ? fallback : v
  }
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [openArticle, setOpenArticle] = useState(null)

  const handleSubscribe = (e) => {
    e.preventDefault()
    setSubscribed(true)
    setEmail('')
  }

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={BookOpen}
          eyebrow={t('sres.eyebrow', { brand: BRAND.name })}
          title={t('sres.title')}
          subtitle={t('sres.subtitle')}
        />

        {/* FEATURED CATEGORIES */}
        <section className="mt-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage-deep">{t('sres.browse')}</p>
          <h2 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">{t('sres.featuredCats')}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <div
                  key={cat.title}
                  className="rounded-2xl border border-white/50 bg-card/70 p-5 shadow-sm backdrop-blur-sm"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-serif text-lg text-foreground">{tr(`sres.topic.${cat.title}`, cat.title)}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{tr(`sres.catDesc.${cat.title}`, cat.desc)}</p>
                </div>
              )
            })}
          </div>
        </section>

        {/* FEATURED ARTICLES */}
        <section className="mt-16">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage-deep">{t('sres.latest')}</p>
          <h2 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">{t('sres.featuredArts')}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {ARTICLES.map((article, i) => {
              const open = openArticle === article.title
              return (
                <article
                  key={article.title}
                  className="group rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm"
                >
                  <span className="inline-block rounded-full bg-sage/40 px-3 py-1 text-xs font-medium text-sage-deep">
                    {tr(`sres.topic.${article.tag}`, article.tag)}
                  </span>
                  <h3 className="mt-3 font-serif text-xl text-foreground">{tr(`sres.${i}.title`, article.title)}</h3>
                  <p className="mt-2 text-sm text-ink-soft">{tr(`sres.${i}.blurb`, article.blurb)}</p>

                  {open && (
                    <div className="mt-4 space-y-3 border-t border-white/60 pt-4">
                      {article.body.map((para, j) => (
                        <p key={para.slice(0, 24)} className="text-sm leading-relaxed text-ink-soft">{tr(`sres.${i}.body.${j}`, para)}</p>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenArticle(open ? null : article.title)}
                    aria-expanded={open}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sage-deep transition-all group-hover:gap-2"
                  >
                    {open ? t('sart.showLess') : t('sart.readMore')}
                    <ArrowRight className={`h-4 w-4 transition-transform ${open ? '-rotate-90' : ''}`} />
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        {/* NEWSLETTER CTA */}
        <section className="relative mt-16 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 px-8 py-10 text-white shadow-lift sm:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-ember/30 blur-3xl" />
          <div className="relative">
            <h2 className="max-w-3xl font-serif text-2xl leading-snug sm:text-3xl">
              {t('sres.newsletter')}
            </h2>
            <form onSubmit={handleSubscribe} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-full border-0 bg-white/90 px-5 py-3 text-sm text-foreground outline-none sm:max-w-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-primary-foreground"
              >
                <Send className="h-4 w-4" />
                {t('sres.subscribe')}
              </button>
            </form>
            {subscribed && (
              <p className="mt-3 text-sm text-white/90">{t('sres.subscribed', { brand: BRAND.name })}</p>
            )}
          </div>
        </section>
      </main>
    </StaticPageShell>
  )
}
