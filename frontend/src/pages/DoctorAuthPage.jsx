import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useI18n } from '../i18n/index.jsx'
import { consumeBookingIntent } from '../lib/bookingIntent.js'
import { emailTypoSuggestion } from '../lib/emailTypos.js'
import { takeSignedOutReason } from '../lib/signedOut.js'
import ForgotPasswordFlow from '../components/auth/ForgotPasswordFlow.jsx'
import Wordmark from '../components/common/Wordmark.jsx'
import { MODERN_FONT } from '../components/landing/ModernChrome.jsx'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mobileRe = /^\d{10}$/

/* ───────────────────────── look (2026-11-08) ─────────────────────────
 * /doctor-login — the second chapter of Join as a Doctor. There the doctor's
 * prescription pad was made (it wrote itself as the form filled); here the pad
 * is at work: a prescription writes itself line by line, is signed, and is
 * stamped "Sent to patient". Same family as Hospital Login: a calm form on the
 * left, on an 810px-tall canvas zoomed to the window so it fits one screen.
 *
 * The sign-in behaviour is the one AuthModal had for doctors, unchanged
 * (email only, typo check, 'doctor' login, signed-out notice, reset flow, where
 * it goes after). The landing-page pop-up (AuthModal) keeps its own look.
 */

const CANVAS_H = 810
const PANEL_W = 720
const PAD_W = 470
const PAD_H = 620

/** Desktop zoom for the canvas: { z, w } (w = canvas width), or null on phones. */
function useCanvasFit() {
  const measure = () => {
    if (typeof window === 'undefined' || window.innerWidth <= 900) return null
    const z = Math.min(window.innerHeight / CANVAS_H, window.innerWidth / 1400)
    return { z, w: window.innerWidth / z }
  }
  const [fit, setFit] = useState(measure)
  useEffect(() => {
    const on = () => setFit(measure())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return fit
}

/* Illustrative: this page is seen before anyone signs in, so there is no
   doctor or patient these could be. */
const RX = [
  { p: 'Ramesh K.', a: '42 / M', lines: [['Tab. Paracetamol 650 mg', '1 – 0 – 1 · 3 days'], ['Syp. Cough relief 5 ml', 'at night · 5 days'], ['Advice: rest, warm fluids', ''], ['Review if fever continues', 'after 3 days']] },
  { p: 'Lakshmi D.', a: '35 / F', lines: [['Tab. Iron + Folic acid', '0 – 1 – 0 · 30 days'], ['Tab. Vitamin D3 60k', 'once a week · 8 weeks'], ['Advice: green leafy vegetables', ''], ['Blood test (Hb)', 'after 1 month']] },
  { p: 'Arjun S.', a: '8 / M', lines: [['Syp. Paracetamol 250 mg / 5 ml', '5 ml when fever'], ['ORS sachet', 'sip through the day'], ['Advice: plenty of fluids', ''], ['Come back if not eating', 'or very sleepy']] },
]
const HAND = { fontFamily: '"Caveat", cursive' }
const SERIF = { fontFamily: '"Instrument Serif", Georgia, serif' }
const lineSecs = ([a, b]) => Math.max(1, (a.length + (b ? b.length + 3 : 0)) * 0.05)

/** The pad at work: writes a prescription, signs it, stamps it sent, then the next. */
function PadAtWork({ scale }) {
  const [n, setN] = useState(0)          // which example
  const [written, setWritten] = useState(0) // lines finished (or writing)
  const [signed, setSigned] = useState(false)
  const [sent, setSent] = useState(false)
  const [clear, setClear] = useState(false)
  const rx = RX[n % RX.length]

  // Caveat is only used here, so this page loads it rather than every page.
  useEffect(() => {
    if (document.getElementById('tc-caveat')) return
    const l = document.createElement('link')
    l.id = 'tc-caveat'; l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&display=swap'
    document.head.appendChild(l)
  }, [])

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setWritten(rx.lines.length); setSigned(true); setSent(true); return undefined
    }
    const timers = []
    let at = 500
    setClear(false); setWritten(0); setSigned(false); setSent(false)
    rx.lines.forEach((l, i) => { timers.push(setTimeout(() => setWritten(i + 1), at)); at += lineSecs(l) * 1000 + 250 })
    timers.push(setTimeout(() => setSigned(true), (at += 300)))
    timers.push(setTimeout(() => setSent(true), (at += 1100)))
    timers.push(setTimeout(() => setClear(true), (at += 3600)))
    timers.push(setTimeout(() => setN((k) => k + 1), (at += 700)))
    return () => timers.forEach(clearTimeout)
  }, [n]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const fade = `transition-opacity duration-500 ${clear ? 'opacity-0' : 'opacity-100'}`

  return (
    <div style={{ width: PAD_W, height: PAD_H, transform: `scale(${scale})`, transformOrigin: 'top center', marginBottom: (scale - 1) * PAD_H }}
      className="relative mx-auto mt-4">
      <div aria-hidden="true" className="absolute inset-[10px_-10px_-10px_10px] rotate-[2.2deg] rounded-md bg-[#F4EFE3] shadow-[0_20px_40px_-24px_rgba(11,33,80,.4)]" />
      <div className="relative flex h-full -rotate-[1.2deg] flex-col overflow-hidden rounded-md bg-[#FFFDF7] px-[30px] pb-[18px] pt-7 text-[#1C2B4A] shadow-[0_44px_80px_-40px_rgba(11,33,80,.55),0_0_0_1px_rgba(11,33,80,.06)]">
        <div className="relative grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-[18px] border-b-2 border-[#0A9A96] pb-3.5 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:bg-[#0A9A96] after:opacity-50">
          <div className="min-w-0">
            <p style={SERIF} className="text-[27px] leading-[1.1] text-[#0B2150]">Dr. Anitha Rao</p>
            <p className="mt-1 text-[13px] font-semibold text-[#0A9A96]">MBBS, MD (General Medicine)</p>
            <p className="mt-0.5 text-[12.5px] text-[#41526E]">General Physician · 12 years</p>
            <p className="mt-0.5 text-[12.5px] text-[#41526E]">Reg. No: TSMC/12345</p>
          </div>
          <div className="text-right text-[12.5px] leading-normal text-[#41526E]">
            <b className="block text-[14px] text-[#0B2150]">Sunrise Hospital</b>Hanamkonda, Warangal<br />Speaks English, Telugu
          </div>
        </div>
        <div className="mt-[18px] grid grid-cols-[1.5fr_1fr_1fr] gap-3.5 text-[12px] text-[#6B7A8F]">
          <span className={`overflow-hidden whitespace-nowrap border-b border-dotted border-[#0B2150]/30 pb-[3px] ${fade}`}>Patient: <b className="font-semibold text-[#1C2B4A]">{rx.p}</b></span>
          <span className={`overflow-hidden whitespace-nowrap border-b border-dotted border-[#0B2150]/30 pb-[3px] ${fade}`}>Age: <b className="font-semibold text-[#1C2B4A]">{rx.a}</b></span>
          <span className="overflow-hidden whitespace-nowrap border-b border-dotted border-[#0B2150]/30 pb-[3px]">{today}</span>
        </div>
        <p aria-hidden="true" style={SERIF} className="mt-3.5 text-[46px] leading-none text-[#0A9A96]">℞</p>
        <div className={`mb-1.5 mt-1 flex-1 bg-clip-content pl-[46px] [background-image:repeating-linear-gradient(180deg,transparent_0_35px,rgba(10,154,150,.13)_35px_36px)] ${fade}`}>
          {rx.lines.map((l, i) => (
            <p key={`${n}-${i}`} style={{ ...HAND, animationDuration: `${lineSecs(l)}s` }}
              className={`whitespace-nowrap text-[25px] leading-[36px] text-[#1d3c8f] [clip-path:inset(0_100%_0_0)] motion-reduce:[clip-path:none] ${i < written ? 'animate-[dlWrite_1s_steps(40,end)_forwards]' : ''}`}>
              {l[0]}{l[1] && <small className="text-[20px] text-[#41526E]"> — {l[1]}</small>}
            </p>
          ))}
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <span className="text-[12.5px] text-[#41526E]">Token booked on TapCure</span>
          <span className="min-w-[150px] text-center text-[12px] text-[#6B7A8F]">
            <i key={n} style={HAND} className={`mb-[3px] block min-h-[38px] border-b border-[#0B2150]/30 text-[30px] not-italic leading-[38px] text-[#2F58B7] [clip-path:inset(0_100%_0_0)] motion-reduce:[clip-path:none] ${signed ? 'animate-[dlWrite_.9s_ease-out_forwards]' : ''} ${fade}`}>A. Rao</i>
            Signature
          </span>
        </div>
        <div className="mt-3 flex justify-between border-t border-[#0B2150]/10 pt-2 text-[11px] text-[#6B7A8F]">
          <span>Sent on WhatsApp · Saved to patient's records</span><span>tapcure.in</span>
        </div>
        <div aria-hidden="true" className={`pointer-events-none absolute right-[84px] top-[66%] -rotate-12 whitespace-nowrap rounded-[10px] border-[3px] border-[#15803D] px-3.5 py-2 text-center text-[17px] font-bold leading-[1.2] text-[#15803D] opacity-0 mix-blend-multiply motion-reduce:opacity-[.85] ${sent && !clear ? 'animate-[dlDrop_.45s_cubic-bezier(.2,1.6,.4,1)_forwards]' : ''}`}>
          Sent to patient ✓<small className="block text-[11px] font-semibold">on WhatsApp · just now</small>
        </div>
      </div>
    </div>
  )
}

export default function DoctorAuthPage() {
  const navigate = useNavigate()
  const fit = useCanvasFit()
  const { login, homeFor } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null) // { type, msg }
  const [forgot, setForgot] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => { document.title = 'Doctor Login · TapCure' }, [])

  // Say WHY they are back at the login screen when the app sent them here
  // itself: the account was signed in on another device, and one account
  // holds one session. Read once — takeSignedOutReason() clears it.
  useEffect(() => {
    if (takeSignedOutReason() === 'other-device') setBanner({ type: 'error', msg: t('auth.signedOutOtherDevice') })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  // Same as AuthModal's finish() for the /doctor-login route: its onClose went
  // home, then the console REPLACES that entry.
  const finish = (u) => {
    setBanner({ type: 'success', msg: t('ax.modal.success') })
    setTimeout(() => {
      navigate('/')
      navigate(consumeBookingIntent(u.role_name) || homeFor(u.role_name), { replace: true })
    }, 600)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    const err = {}
    const idf = form.idf?.trim() || ''
    // Doctors sign in with their registered email. A mobile number is the
    // PATIENT door (PatientVoiceAuth) and never resolves to a doctor login,
    // so catch it here instead of letting the API answer 401.
    if (!idf) err.idf = t('ax.modal.required')
    else if (mobileRe.test(idf)) err.idf = t('ax.modal.useEmail')
    else if (!emailRe.test(idf)) err.idf = t('ax.modal.invalidEmailAddr')
    // A misspelt provider is a valid address, so the format check above lets it
    // through. Caught here because doctor sign-in is email-only.
    else if (emailTypoSuggestion(idf)) err.idf = t('pm.emailTypo', { d: emailTypoSuggestion(idf) })
    if (!form.password?.trim()) err.password = t('ax.modal.required')
    setErrors(err)
    if (Object.keys(err).length) return

    setBusy(true)
    try {
      const u = await login(idf, form.password, 'doctor')
      finish(u)
    } catch (e2) {
      setBanner({
        type: 'error',
        msg: e2.status === 401 ? t('ax.modal.invalidCreds') : e2.message || t('ax.modal.loginFailed'),
      })
      setBusy(false)
    }
  }

  const padScale = fit ? Math.max(0.6, Math.min(1.08, (CANVAS_H - 140) / PAD_H, (fit.w - PANEL_W - 110) / PAD_W)) : 1
  const label = 'mb-2 flex items-baseline justify-between gap-2.5 text-[17.5px] font-semibold text-[#41526E]'
  const box = (bad) => `w-full rounded-[14px] border-[1.5px] bg-white px-5 py-[18px] text-[19px] font-medium text-[#0B2150] shadow-[0_6px_18px_-14px_rgba(11,33,80,.35)] outline-none transition-colors placeholder:font-normal placeholder:text-[#6B7A8F] focus:border-[#0A9A96] ${bad ? 'border-[#C2410C]' : 'border-[#0B2150]/[.12]'}`
  const link = 'font-semibold text-[#0A9A96] hover:underline'
  const errText = 'text-[15.5px] font-medium text-[#C2410C]'

  return (
    <div className={`tc-type min-h-screen bg-[#F3F8F8] text-[#0B2150] antialiased ${fit ? 'h-screen overflow-hidden' : ''}`} style={{ fontFamily: MODERN_FONT }}>
      <style>{'@keyframes dlWrite{to{clip-path:inset(0 0 0 0)}}@keyframes dlDrop{from{transform:rotate(-12deg) scale(2.2);opacity:0}to{transform:rotate(-12deg) scale(1);opacity:.85}}'}</style>
      <div
        className="grid min-h-screen grid-cols-1"
        style={fit ? { zoom: fit.z, width: fit.w, height: CANVAS_H, minHeight: 0, gridTemplateColumns: `${PANEL_W}px 1fr` } : undefined}
      >
        {/* ── left: sign in ── */}
        <section className="flex min-h-screen flex-col bg-white px-5 pb-8 pt-5 sm:px-10 min-[901px]:h-full min-[901px]:min-h-0 min-[901px]:overflow-y-auto min-[901px]:px-[88px] min-[901px]:py-[26px]">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2" aria-label="TapCure">
              <img src="/tapcure-icon.png" alt="" className="h-8 w-8" />
              <Wordmark className="text-[22px]" />
            </Link>
            <Link to="/" className="inline-flex items-center gap-1 text-[17px] text-[#6B7A8F] hover:text-[#0A9A96]"><ArrowLeft className="h-4 w-4" /> Home</Link>
          </div>
          <div className="min-h-3 flex-[1]" aria-hidden="true" />

          <div>
            <p className="text-[18px] font-semibold text-[#0A9A96]">For Doctors</p>
            <h1 className="mt-2.5 text-[46px] font-bold leading-[1.1] tracking-[-0.015em]">{t('ax.doctor.loginTitle')}</h1>
            <p className="mt-2.5 text-[19px] text-[#41526E]">{t('ax.doctor.loginSubtitle')}</p>
            {banner && (
              <p role={banner.type === 'error' ? 'alert' : 'status'} className={`mt-4 text-[15.5px] font-medium ${banner.type === 'error' ? 'text-[#C2410C]' : 'text-[#15803D]'}`}>{banner.msg}</p>
            )}

            {forgot ? (
              <div className="mt-7"><ForgotPasswordFlow portal="doctor" onBack={() => { setForgot(false); setBanner(null) }} /></div>
            ) : (
              <form onSubmit={handleLogin} noValidate className="mt-8 grid gap-[22px]">
                <div>
                  <label htmlFor="dl-email" className={label}>
                    <span>Email Address</span>
                    {errors.idf && <span role="alert" className={errText}>{errors.idf}</span>}
                  </label>
                  <input id="dl-email" type="text" inputMode="email" autoComplete="username" placeholder={t('ax.modal.emailPh')}
                    value={form.idf || ''} onChange={set('idf')} aria-invalid={!!errors.idf} className={box(errors.idf)} />
                </div>
                <div>
                  <div className={label}>
                    <label htmlFor="dl-pass">{t('ax.modal.passwordPh')}</label>
                    {errors.password
                      ? <span role="alert" className={errText}>{errors.password}</span>
                      : <button type="button" onClick={() => { setForgot(true); setBanner(null); setErrors({}) }} className={`text-[16.5px] ${link}`}>{t('ax.modal.forgot')}</button>}
                  </div>
                  <div className="relative">
                    <input id="dl-pass" type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password"
                      value={form.password || ''} onChange={set('password')} aria-invalid={!!errors.password} className={`${box(errors.password)} pr-[52px]`} />
                    <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7A8F] hover:text-[#0A9A96]">
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <button disabled={busy} className="mt-1.5 rounded-full bg-[#0A9A96] py-5 text-[19.5px] font-semibold text-white transition-colors hover:bg-[#088582] disabled:opacity-65">
                  {busy ? 'Signing In…' : t('auth.loginCta')}
                </button>
              </form>
            )}

            <div className="mt-[30px] grid gap-3 border-t border-[#0B2150]/10 pt-6 text-[17.5px] text-[#41526E]">
              <span>New doctor? <Link to="/doctor-signup" className={link}>Join TapCure →</Link></span>
              <span>Hospital staff? <Link to="/hospital-login" className={link}>Hospital Login →</Link></span>
            </div>
            <p className="mt-4 text-[15.5px] text-[#6B7A8F]">🔒 Your patients' data is encrypted. Every sign-in is logged.</p>
          </div>
          <div className="min-h-3 flex-[1.15]" aria-hidden="true" />
        </section>

        {/* ── right: the prescription pad at work (desktop only) ── */}
        {fit && (
          <aside aria-label="Your TapCure prescription pad at work"
            className="relative grid h-full place-items-center overflow-hidden px-8 py-5 [background:radial-gradient(60%_50%_at_70%_20%,rgba(0,201,197,.20),transparent_70%),radial-gradient(50%_45%_at_20%_90%,rgba(51,105,255,.14),transparent_70%),#F3F8F8]">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[140px] bg-gradient-to-r from-white to-transparent" />
            <div>
              <p className="text-center text-[15px] font-semibold text-[#0A9A96]">Your Prescription Pad, At Work</p>
              <p className="mt-1 text-center text-[14.5px] text-[#6B7A8F]">Write it once. TapCure sends it to your patient instantly.</p>
              <PadAtWork scale={padScale} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
