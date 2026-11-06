import { useState } from 'react'
import { ChevronDown, Phone, Mail, MessageCircle, LifeBuoy, Send } from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { FAQS } from '../../data/patientDashboardData.js'
import { useI18n } from '../../i18n/index.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { supportApi } from '../../api'
import { realEmail } from '../../lib/patientDisplay.js'

const CONTACTS = [
  { icon: Phone, labelKey: 'ppage.callUs', value: '1800-123-4567', tone: 'bg-blue-100 text-brand-blue' },
  { icon: MessageCircle, labelKey: 'ppage.whatsapp', value: '+91 98765 00000', tone: 'bg-green-100 text-green-600' },
  { icon: Mail, labelKey: 'ppage.email', value: 'thetapcure@gmail.com', tone: 'bg-purple-100 text-purple-600' },
]

// FAQ text lives in the dictionary; data file order maps to these keys 1:1.
const FAQ_KEYS = [
  { q: 'ppage.faq1q', a: 'ppage.faq1a' },
  { q: 'ppage.faq2q', a: 'ppage.faq2a' },
  { q: 'ppage.faq3q', a: 'ppage.faq3a' },
  { q: 'ppage.faq4q', a: 'ppage.faq4a' },
  { q: 'ppage.faq5q', a: 'ppage.faq5a' },
]

/** Help & Support — FAQs, contact options, and a message form. */
function Help() {
  const { t } = useI18n()
  const { patient } = usePatientCtx()
  const [open, setOpen] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  // Same endpoint the public Contact page uses, so patient messages land in the
  // same Super-Admin inbox. The patient is logged in, so identity is taken from
  // their profile instead of asking them to retype it.
  const send = async (e) => {
    e.preventDefault()
    setError(null)
    if (!message.trim()) {
      setError(t('ppage.helpNeedMessage'))
      return
    }
    setSending(true)
    try {
      await supportApi.submit({
        name: patient?.name || 'Patient',
        email: realEmail(patient) || '',
        mobile: patient?.phone || '',
        city: patient?.city || '',
        role: 'Patient',
        message: message.trim(),
      })
      setSent(true)
      setMessage('')
    } catch (err) {
      setError(err.message || t('ppage.helpFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.helpTitle')} subtitle={t('ppage.helpSubtitle')} />

      {/* Contact options */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CONTACTS.map((c) => (
          <Card key={c.labelKey} className="flex items-center gap-3 p-4">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${c.tone}`}>
              <c.icon className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-[12px] font-semibold text-slate-400">{t(c.labelKey)}</p>
              <p className="text-[14px] font-bold text-brand-navy">{c.value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Write to support */}
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-[16px] font-bold text-brand-navy">
          <Send className="h-4 w-4 text-brand-blue" /> {t('ppage.helpMessageTitle')}
        </h3>
        <p className="mt-1 text-[13px] text-slate-500">{t('ppage.helpMessageSub')}</p>

        <form onSubmit={send} className="mt-3">
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setSent(false); setError(null) }}
            placeholder={t('ppage.helpMessagePlaceholder')}
            className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-brand-navy outline-none transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-brand-blueDark disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {sending ? t('ppage.helpSending') : t('ppage.helpSend')}
            </button>
            {sent && !error && (
              <p className="text-[13px] font-semibold text-green-600">{t('ppage.helpSent')}</p>
            )}
            {error && <p className="text-[13px] font-semibold text-red-500">{error}</p>}
          </div>
          {/* Reassure them we already know who they are. */}
          {(realEmail(patient) || patient?.phone) && (
            <p className="mt-2 text-[11.5px] text-slate-400">
              {t('ppage.helpRepliesTo', { contact: realEmail(patient) || `+91 ${patient?.phone}` })}
            </p>
          )}
        </form>
      </Card>

      {/* FAQs */}
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-brand-navy">
          <LifeBuoy className="h-4 w-4 text-brand-blue" /> {t('ppage.faqsTitle')}
        </h3>
        <ul className="divide-y divide-slate-100">
          {FAQS.map((f, i) => {
            const isOpen = open === i
            const fk = FAQ_KEYS[i]
            return (
              <li key={i}>
                <button
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
                >
                  <span className="text-[14px] font-semibold text-brand-navy">{fk ? t(fk.q) : f.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <p className="pb-4 pr-7 text-[13px] leading-relaxed text-slate-500">{fk ? t(fk.a) : f.a}</p>}
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

export default Help
