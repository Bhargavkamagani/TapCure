import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail,
  MessageCircle,
  MapPin,
  Clock,
  Building2,
  Send,
  User,
} from 'lucide-react'
import { BRAND } from '../../data/landingData.js'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import PageHero from '../../components/landing/PageHero.jsx'
import { supportApi } from '../../api'
import { toMobile } from '../../lib/phone.js'
import { useI18n } from '../../i18n/index.jsx'

function InfoCard({ icon: Icon, title, children }) {
  return (
    <section className="rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-serif text-xl">{title}</h2>
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-ink-soft">{children}</div>
    </section>
  )
}

export default function Contact() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    city: '',
    role: 'Patient',
    message: '',
  })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: field === 'mobile' ? toMobile(e.target.value) : e.target.value }))
    setSent(false)
  }

  // This used to be `setSent(true)` and nothing else — the form claimed success
  // and threw the message away. It now posts to /support/contact, which stores
  // the enquiry for the Super-Admin inbox and emails the support address.
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError(t('scontact.errRequired'))
      return
    }
    setSending(true)
    try {
      await supportApi.submit({
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        city: form.city.trim(),
        role: form.role,
        message: form.message.trim(),
      })
      setSent(true)
      setForm({ name: '', mobile: '', email: '', city: '', role: 'Patient', message: '' })
    } catch (err) {
      setError(err.message || t('scontact.errSend'))
    } finally {
      setSending(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-sage-deep/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-sage-deep/50'
  const labelClass = 'text-sm font-medium text-foreground'

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-none px-6 pb-20 sm:px-10 lg:px-16">
        <PageHero
          icon={Mail}
          eyebrow={t('scontact.eyebrow')}
          title={t('scontact.title')}
          subtitle={t('scontact.subtitle')}
        />

        {/* Content grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Left: info cards */}
          <div className="space-y-6">
            <InfoCard icon={MessageCircle} title={t('scontact.patientSupport')}>
              <p className="text-muted-foreground">
                {t('scontact.patientSupportBody')}
              </p>
              <p>{t('scontact.emailLabel')} <a href="mailto:hello@tapcure.in" className="underline underline-offset-2">hello@tapcure.in</a></p>
              <p>{t('scontact.phoneLabel')} <a href="tel:+919346821621" className="underline underline-offset-2">+91 93468 21621</a></p>
              <p>{t('scontact.whatsappLabel')} <a href="https://wa.me/919346821621" className="underline underline-offset-2">+91 93468 21621</a></p>
            </InfoCard>

            <InfoCard icon={Building2} title={t('scontact.partnerships')}>
              <p className="text-muted-foreground">
                {t('scontact.partnershipsBody')}
              </p>
              <p>{t('scontact.emailLabel')} <a href="mailto:hello@tapcure.in" className="underline underline-offset-2">hello@tapcure.in</a></p>
              <p>{t('scontact.phoneLabel')} <a href="tel:+919346821621" className="underline underline-offset-2">+91 93468 21621</a></p>
            </InfoCard>

            <InfoCard icon={MapPin} title={t('scontact.address')}>
              <p>Trovate LLP</p>
              <p>{t('scontact.addressCity')}</p>
              <p>{t('scontact.addressCountry')}</p>
            </InfoCard>

            <InfoCard icon={Clock} title={t('scontact.hours')}>
              <p>{t('scontact.hoursDays')}</p>
              <p>{t('scontact.hoursTime')}</p>
            </InfoCard>
          </div>

          {/* Right: contact form */}
          <section className="rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white">
                <User className="h-5 w-5" />
              </span>
              <h2 className="font-serif text-2xl">{t('scontact.formTitle')}</h2>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="contact-name" className={labelClass}>
                    {t('scontact.name')}
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={form.name}
                    onChange={update('name')}
                    className={inputClass}
                    placeholder={t('scontact.namePh')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-mobile" className={labelClass}>
                    {t('scontact.mobile')}
                  </label>
                  <input
                    id="contact-mobile"
                    type="tel"
                    value={form.mobile}
                    onChange={update('mobile')}
                    className={inputClass}
                    placeholder={t('scontact.mobilePh')}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-email" className={labelClass}>
                    {t('scontact.email')}
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    value={form.email}
                    onChange={update('email')}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="contact-city" className={labelClass}>
                    {t('scontact.city')}
                  </label>
                  <input
                    id="contact-city"
                    type="text"
                    value={form.city}
                    onChange={update('city')}
                    className={inputClass}
                    placeholder={t('scontact.cityPh')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-role" className={labelClass}>
                  {t('scontact.role')}
                </label>
                <select
                  id="contact-role"
                  value={form.role}
                  onChange={update('role')}
                  className={inputClass}
                >
                  <option value="Patient">{t('scontact.role.patient')}</option>
                  <option value="Hospital">{t('scontact.role.hospital')}</option>
                  <option value="Doctor">{t('scontact.role.doctor')}</option>
                  <option value="Other">{t('scontact.role.other')}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="contact-message" className={labelClass}>
                  {t('scontact.message')}
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  value={form.message}
                  onChange={update('message')}
                  className={inputClass}
                  placeholder={t('scontact.messagePh')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {sending ? t('scontact.sending') : t('scontact.submit')}
                </button>
                {sent && !error && (
                  <p className="text-sm font-medium text-sage-deep">
                    {t('scontact.sent')}
                  </p>
                )}
                {error && <p className="text-sm font-medium text-red-600">{error}</p>}
              </div>
            </form>
          </section>
        </div>
      </main>
    </StaticPageShell>
  )
}
