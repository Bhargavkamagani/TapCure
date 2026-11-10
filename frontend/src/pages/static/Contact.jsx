import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import { supportApi } from '../../api'
import { toMobile } from '../../lib/phone.js'
import { useI18n } from '../../i18n/index.jsx'
import { staticFaqT } from '../../i18n/dict/staticFaq.js'

/**
 * Contact Us — on the landing page's look (StaticPageShell `modern`, 2026-11-07).
 * Left: the quick ways to reach us (WhatsApp / call / email), hours, office, and
 * a shortcut to My Appointments. Right: the message form as a chat — TapCure asks
 * one small thing at a time, FAQ answers arrive as replies while the message is
 * typed, and the thank-you is the last message.
 *
 * It collects exactly what the old form did and posts it the same way:
 * supportApi.submit → /support/contact (Super-Admin inbox + support email).
 * Name, email and message are required; mobile and city can be skipped.
 */

const PHONE = '+91 93468 21621'
const ROLES = ['Patient', 'Hospital', 'Doctor', 'Other']

// Support hours in India: Monday–Saturday, 9:00–19:00.
const istNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
const isOnline = () => {
  const t = istNow(), m = t.getHours() * 60 + t.getMinutes()
  return t.getDay() !== 0 && m >= 540 && m < 1140
}
const LOCALE = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' }

// The FAQ questions the chat can suggest (same ids as the FAQ page).
const FAQ_IDS = {
  patient: ['what', 'hospital', 'langs', 'booking', 'cost', 'consultFee', 'family', 'token', 'track', 'travel', 'delay', 'upload', 'safe'],
  hospital: ['join', 'verify', 'cost', 'after', 'walkinCount', 'queue', 'walkin', 'doctors', 'notify', 'reports'],
  doctor: ['join', 'docs', 'verify', 'cost', 'avail', 'queue', 'rx', 'delay', 'reports', 'multi'],
}
const STOP = new Set('a an the i me my we our you your is are am was be to of in on at for and or but it this that do does did can could how what why when where who will would with from have has had not no yes please there their them they about any get got just so if as by up out into than then also want need tapcure'.split(' '))
const SAME = {
  cancelled: 'cancel', fees: 'fee', charges: 'fee', charge: 'fee', price: 'cost', pay: 'fee', payment: 'fee', paid: 'fee', money: 'fee',
  tokens: 'token', queue: 'token', number: 'token', late: 'delay', delayed: 'delay', waiting: 'delay', wait: 'delay',
  mother: 'family', father: 'family', child: 'family', son: 'family', daughter: 'family', wife: 'family', husband: 'family',
  prescriptions: 'prescription', report: 'reports', register: 'join', signup: 'join', registration: 'join',
  doctors: 'doctor', hospitals: 'hospital', 'walk-in': 'walkin', walkins: 'walkin', privacy: 'safe', data: 'safe',
  language: 'languages', telugu: 'languages', hindi: 'languages', verification: 'verify', verified: 'verify', free: 'cost', trial: 'after',
}
const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s-]/gu, ' ').split(/\s+/)
  .filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (SAME[w] || w).replace(/s$/, ''))
const WHO = { Patient: 'patient', Hospital: 'hospital', Doctor: 'doctor' }

/** Up to two FAQ answers whose words match the message (in English and the reader's language). */
function matchFaq(text, role, t) {
  const mine = [...new Set(words(text))]
  if (!mine.length || text.trim().length < 10) return []
  const tEn = (k) => staticFaqT[k]?.en || ''
  return Object.entries(FAQ_IDS).flatMap(([who, ids]) => ids.map((id) => {
    const k = `sfaq.${who}.${id}`
    const q = new Set(words(`${t(`${k}.q`)} ${tEn(`${k}.q`)}`))
    const a = new Set(words(`${t(`${k}.a`)} ${tEn(`${k}.a`)}`))
    let score = 0
    mine.forEach((w) => { if (q.has(w)) score += 3; else if (a.has(w)) score += 1 })
    if (WHO[role] === who) score += 1.5
    return { q: t(`${k}.q`), a: t(`${k}.a`), score }
  })).filter((x) => x.score >= 4).sort((x, y) => y.score - x.score).slice(0, 2)
}

const first = (n) => String(n || '').trim().split(/\s+/)[0]

const ICONS = {
  whatsapp: <><path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 7.7 19.4z" /><path d="M9 9.5c.3 2 2 3.8 4 4.5l1.3-1.2 2 .9c-.3 1.2-1.3 1.8-2.4 1.6C10.6 14.6 8.4 12.4 8 9.8c-.1-1.1.5-2.1 1.6-2.4l.9 2z" /></>,
  call: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
}

function Way({ href, icon, title, value, go, external }) {
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="-mx-2.5 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-[10px] border-b border-[#0B2150]/10 px-2.5 py-4 transition-colors hover:bg-[#0A9A96]/[.09]">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#0A9A96]/[.09] text-[#0A9A96]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>
      </span>
      <span className="min-w-0">
        <b className="block text-[17px]">{title}</b>
        <small className="block text-[14.5px] text-[#6B7A8F]">{value}</small>
      </span>
      <span className="whitespace-nowrap text-[14.5px] font-semibold text-[#0A9A96]">{go} →</span>
    </a>
  )
}

function Bot({ children, ...rest }) {
  return (
    <div {...rest} className="max-w-[84%] self-start rounded-[18px] rounded-bl-md bg-white px-3.5 py-2.5 text-[16px] leading-[1.45] shadow-[0_1px_2px_rgba(11,33,80,.08)] motion-safe:animate-[tcPop_.28s_cubic-bezier(.2,.8,.2,1)]">
      {children}
    </div>
  )
}

export default function Contact() {
  const { t, lang } = useI18n()

  const STEPS = [
    { key: 'role', kind: 'choice', ask: () => t('scontact.q.role') },
    { key: 'name', kind: 'text', ask: () => t('scontact.q.name'), ph: t('scontact.namePh'), auto: 'name', need: 'scontact.err.name' },
    { key: 'email', kind: 'email', ask: (a) => t('scontact.q.email', { name: first(a.name) }), ph: t('scontact.ph.email'), auto: 'email', need: 'scontact.err.email' },
    { key: 'mobile', kind: 'tel', ask: () => t('scontact.q.mobile'), ph: t('scontact.ph.mobile'), auto: 'tel-national', optional: true },
    { key: 'city', kind: 'text', ask: () => t('scontact.q.city'), ph: t('scontact.cityPh'), auto: 'address-level2', optional: true },
    { key: 'message', kind: 'long', ask: (a) => t('scontact.q.message', { hint: t(`scontact.hint.${(a.role || 'Other').toLowerCase()}`) }), ph: t('scontact.ph.message'), need: 'scontact.err.message' },
  ]

  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState(false)
  const [typing, setTyping] = useState(true)
  const [draft, setDraft] = useState('')
  const [fieldErr, setFieldErr] = useState('')
  const [tips, setTips] = useState([])
  const [sending, setSending] = useState(false)
  const [sendErr, setSendErr] = useState(null)
  const [done, setDone] = useState(null)        // { when, reply } once sent
  const [online] = useState(isOnline)

  const feedRef = useRef(null)
  const inputRef = useRef(null)
  const calm = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // A short "typing…" before each message from TapCure.
  const pause = () => {
    setTyping(true)
    setTimeout(() => setTyping(false), calm ? 0 : 650)
  }
  useEffect(pause, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // Each new question starts with what was typed before (when changing an answer).
  useEffect(() => {
    const s = STEPS[step]
    setDraft(s ? (answers[s.key] || '') : '')
    setFieldErr('')
    if (!s || s.key !== 'message') setTips([])
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!typing) inputRef.current?.focus() }, [typing, step])

  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [answers, step, typing, tips, done, sendErr])

  // FAQ answers arrive as a reply while the message is typed.
  useEffect(() => {
    if (STEPS[step]?.key !== 'message') return undefined
    const id = setTimeout(() => setTips(matchFaq(draft, answers.role, t)), 300)
    return () => clearTimeout(id)
  }, [draft, step]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextOpen = (a) => {
    const i = STEPS.findIndex((s) => !(s.key in a))
    return i === -1 ? STEPS.length : i
  }

  const answer = (value) => {
    const next = { ...answers, [STEPS[step].key]: value }
    setAnswers(next)
    setStep(editing ? nextOpen(next) : step + 1)
    setEditing(false)
    pause()
  }

  const submitStep = (e) => {
    e.preventDefault()
    const s = STEPS[step]
    const v = (s.kind === 'tel' ? toMobile(draft) : draft).trim()
    let bad = ''
    if (!v && !s.optional) bad = t(s.need)
    else if (s.kind === 'email' && !/^\S+@\S+\.\S+$/.test(v)) bad = t('scontact.err.emailBad')
    else if (s.kind === 'tel' && v && v.length !== 10) bad = t('scontact.err.mobile')
    if (bad) { setFieldErr(bad); inputRef.current?.focus(); return }
    answer(v)
  }

  const edit = (i) => { setStep(i); setEditing(true); setSendErr(null) }

  const send = async () => {
    setSendErr(null)
    setSending(true)
    try {
      await supportApi.submit({
        name: (answers.name || '').trim(),
        email: (answers.email || '').trim(),
        mobile: (answers.mobile || '').trim(),
        city: (answers.city || '').trim(),
        role: answers.role || 'Other',
        message: (answers.message || '').trim(),
      })
      const now = new Date()
      const when = now.toLocaleString(LOCALE[lang] || 'en-IN', { weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
      const ist = istNow(), m = ist.getHours() * 60 + ist.getMinutes()
      let reply
      if (ist.getDay() !== 0 && m < 1140) reply = t(m >= 540 ? 'scontact.replyNow' : 'scontact.replyLater')
      else {
        const next = new Date(ist); next.setDate(ist.getDate() + 1)
        if (next.getDay() === 0) next.setDate(next.getDate() + 1)
        reply = t('scontact.replyNext', { day: next.toLocaleDateString(LOCALE[lang] || 'en-IN', { weekday: 'long' }) })
      }
      setDone({ when, reply })
      pause()
    } catch (err) {
      setSendErr(err.message || t('scontact.errSend'))
    } finally {
      setSending(false)
    }
  }

  const reset = () => {
    setAnswers({}); setStep(0); setEditing(false); setDone(null); setSendErr(null); setTips([])
    pause()
  }

  const shown = (key, v) => (key === 'mobile' && v ? `+91 ${v.slice(0, 5)} ${v.slice(5)}` : v)
  const roleLabel = (r) => t(`scontact.role.${r.toLowerCase()}`)
  const upto = done ? STEPS.length : step
  const s = STEPS[step]

  const field = 'min-w-0 flex-1 resize-none rounded-[22px] border-[1.5px] border-[#0B2150]/10 bg-transparent px-4 py-[11px] text-[16px] leading-[1.4] text-[#0B2150] outline-none transition-colors placeholder:text-[#6B7A8F] focus:border-[#0A9A96]'

  return (
    <StaticPageShell modern title={t('scontact.title')}>
      <style>{'@keyframes tcPop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes tcDot{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}'}</style>
      <main className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-20">
        {/* ── left: the quick ways ── */}
        <section>
          <h1 className="text-[34px] font-bold tracking-[-0.015em]">{t('scontact.title')}</h1>
          <p className="mt-2 max-w-[44ch] text-[17px] text-[#41526E]">{t('scontact.lede')}</p>

          <div className="mt-7 border-t border-[#0B2150]/10">
            <Way href="https://wa.me/919346821621" external icon="whatsapp" title={t('scontact.way.whatsapp')} value={PHONE} go={t('scontact.go.chat')} />
            <Way href="tel:+919346821621" icon="call" title={t('scontact.way.call')} value={PHONE} go={t('scontact.go.call')} />
            <Way href="mailto:hello@tapcure.in" icon="email" title={t('scontact.way.email')} value="hello@tapcure.in" go={t('scontact.go.write')} />
          </div>

          <div className="mt-7 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-[14px] font-semibold text-[#6B7A8F]">{t('scontact.hours')}</p>
              <p className="mt-1 text-[16px]">{t('scontact.hoursDays')}<br />{t('scontact.hoursTime')}</p>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#6B7A8F]">{t('scontact.office')}</p>
              <p className="mt-1 text-[16px]">Trovate LLP<br />{t('scontact.addressCity')}, {t('scontact.addressCountry')}</p>
            </div>
          </div>
          <p className="mt-7 text-[15.5px] text-[#41526E]">
            {t('scontact.myAppts')}{' '}
            <Link to="/patient-dashboard/appointments" className="font-semibold text-[#0A9A96] hover:underline">{t('scontact.myApptsLink')} →</Link>
          </p>
        </section>

        {/* ── right: the chat ── */}
        <section aria-label={t('scontact.chat.aria')}
          className="flex h-[640px] max-h-[calc(var(--app-vh,1vh)*100_-_96px)] min-h-[520px] flex-col overflow-hidden rounded-3xl bg-[#EEF6F5] shadow-[0_30px_70px_-36px_rgba(11,33,80,.45),0_0_0_1px_rgba(11,33,80,.11)]">
          <div className="flex items-center gap-3 border-b border-[#0B2150]/10 bg-white px-[18px] py-3.5">
            <span aria-hidden="true" className="relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#00C9C5] to-[#2F58B7] font-bold text-white">
              TC<i className={`absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2 border-white ${online ? 'bg-[#16A34A]' : 'bg-[#6B7A8F]'}`} />
            </span>
            <div>
              <b className="block text-[16.5px]">{t('scontact.chat.title')}</b>
              <small className={`block text-[13.5px] ${online ? 'font-semibold text-[#16A34A]' : 'text-[#6B7A8F]'}`}>{t(online ? 'scontact.chat.online' : 'scontact.chat.away')}</small>
            </div>
          </div>

          <div ref={feedRef} role="log" aria-live="polite" className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pb-2 pt-5">
            <span className="mb-1.5 self-center rounded-full bg-white px-3 py-0.5 text-[12.5px] font-semibold text-[#6B7A8F]">{t('scontact.chat.today')}</span>

            {STEPS.slice(0, upto).map((st, i) => {
              const v = answers[st.key]
              return [
                <Bot key={`q${i}`}>{st.ask(answers)}</Bot>,
                v ? (
                  <div key={`a${i}`} className="max-w-[84%] self-end whitespace-pre-line rounded-[18px] rounded-br-md bg-[#0A9A96] px-3.5 py-2.5 text-[16px] leading-[1.45] text-white motion-safe:animate-[tcPop_.28s_cubic-bezier(.2,.8,.2,1)]">
                    {st.key === 'role' ? roleLabel(v) : shown(st.key, v)}
                    {!done && <button type="button" onClick={() => edit(i)} className="mt-0.5 block w-full text-right text-[12px] opacity-80 hover:underline hover:opacity-100">{t('scontact.change')}</button>}
                  </div>
                ) : (
                  <div key={`a${i}`} className="self-end pr-1 text-[15px] italic text-[#6B7A8F]">
                    {t('scontact.skipped')}
                    {!done && <> · <button type="button" onClick={() => edit(i)} className="not-italic font-semibold text-[#0A9A96] hover:underline">{t('scontact.add')}</button></>}
                  </div>
                ),
              ]
            })}

            {!typing && !done && (s
              ? <Bot>{s.ask(answers)}</Bot>
              : <Bot>{t('scontact.allSet')}</Bot>)}

            {!typing && !done && s?.key === 'message' && tips.length > 0 && (
              <Bot>
                <p className="mb-1 text-[13.5px] font-semibold text-[#0A9A96]">{t('scontact.tipHead')}</p>
                {tips.map((f, i) => (
                  <details key={f.q} className={i ? 'mt-2 border-t border-[#0B2150]/10 pt-2' : ''}>
                    <summary className="flex cursor-pointer list-none justify-between gap-2.5 font-semibold [&::-webkit-details-marker]:hidden">
                      {f.q}<span aria-hidden="true" className="text-[19px] leading-[1.1] text-[#0A9A96]">+</span>
                    </summary>
                    <p className="mt-1.5 text-[15px] text-[#41526E]">{f.a}</p>
                  </details>
                ))}
                <span className="mt-2 block text-[13.5px] text-[#6B7A8F]">{t('scontact.tipMore')}</span>
              </Bot>
            )}

            {sendErr && !sending && <Bot role="alert"><span className="text-[#C2410C]">{sendErr}</span></Bot>}

            {done && !typing && (
              <Bot role="status">
                <span aria-hidden="true" className="mr-1.5 inline-grid h-[22px] w-[22px] place-items-center rounded-full bg-[#0A9A96] align-[-5px] text-white"><Check className="h-[13px] w-[13px]" strokeWidth={3.2} /></span>
                <b>{t('scontact.thanks', { name: first(answers.name) })}</b> {t('scontact.received', { when: done.when })}
                <br />{done.reply}
              </Bot>
            )}

            {typing && (
              <div aria-label={t('scontact.chat.typing')} className="flex gap-[5px] self-start rounded-[18px] rounded-bl-md bg-white px-4 py-[13px]">
                {[0, 0.15, 0.3].map((d) => <i key={d} style={{ animationDelay: `${d}s` }} className="h-[7px] w-[7px] rounded-full bg-[#6B7A8F] motion-safe:animate-[tcDot_1s_infinite]" />)}
              </div>
            )}
          </div>

          {/* composer: changes with the question */}
          <div className="border-t border-[#0B2150]/10 bg-white p-3">
            {done ? (
              <button type="button" onClick={reset} disabled={typing}
                className="w-full rounded-full border-[1.5px] border-[#0B2150]/10 py-3 text-[15.5px] font-semibold text-[#41526E] hover:border-[#0A9A96] hover:text-[#0A9A96]">
                {t('scontact.again')}
              </button>
            ) : !s ? (
              <>
                <button type="button" onClick={send} disabled={sending || typing}
                  className="w-full rounded-full bg-[#0A9A96] py-3.5 text-[16.5px] font-semibold text-white transition-colors hover:bg-[#088582] disabled:opacity-60">
                  {sending ? t('scontact.sending') : sendErr ? t('scontact.retry') : t('scontact.sendBtn')}
                </button>
                <p className="mt-2 px-1.5 text-[13.5px] text-[#6B7A8F]">{t('scontact.privacy')}</p>
              </>
            ) : s.kind === 'choice' ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ROLES.map((r, i) => (
                  <button key={r} ref={i === 0 ? inputRef : undefined} type="button" disabled={typing} onClick={() => answer(r)}
                    className="rounded-full border-[1.5px] border-[#0A9A96] px-1 py-2.5 text-[15px] font-semibold text-[#0A9A96] transition-colors hover:bg-[#0A9A96] hover:text-white">
                    {roleLabel(r)}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <form onSubmit={submitStep} noValidate className="flex items-end gap-2">
                  {s.kind === 'long' ? (
                    <textarea
                      ref={inputRef}
                      rows={2}
                      value={draft}
                      onChange={(e) => { setDraft(e.target.value); setFieldErr('') }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form.requestSubmit() } }}
                      placeholder={s.ph}
                      aria-label={s.ph}
                      aria-invalid={!!fieldErr}
                      className={`${field} max-h-[140px] rounded-[18px]`}
                    />
                  ) : (
                    <input
                      ref={inputRef}
                      type={s.kind === 'email' ? 'email' : s.kind === 'tel' ? 'tel' : 'text'}
                      inputMode={s.kind === 'tel' ? 'numeric' : undefined}
                      maxLength={s.kind === 'tel' ? 10 : undefined}
                      autoComplete={s.auto}
                      value={draft}
                      onChange={(e) => { setDraft(s.kind === 'tel' ? toMobile(e.target.value) : e.target.value); setFieldErr('') }}
                      placeholder={s.ph}
                      aria-label={s.ph}
                      aria-invalid={!!fieldErr}
                      className={field}
                    />
                  )}
                  <button type="submit" disabled={typing} aria-label={t('scontact.sendAria')}
                    className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-[#0A9A96] text-white transition hover:bg-[#088582] active:scale-95">
                    <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
                  </button>
                </form>
                <div className="mt-2 flex min-h-[20px] items-center justify-between gap-3 px-1.5 text-[13.5px]">
                  {fieldErr
                    ? <span className="text-[#C2410C]">{fieldErr}</span>
                    : <span className="text-[#6B7A8F]">{s.optional ? t('scontact.optional') : s.kind === 'long' ? t('scontact.enterHint') : ''}</span>}
                  {s.optional && <button type="button" onClick={() => answer('')} className="px-1 text-[14px] font-semibold text-[#0A9A96] hover:underline">{t('scontact.skip')}</button>}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </StaticPageShell>
  )
}
