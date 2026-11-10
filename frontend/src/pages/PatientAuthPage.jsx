import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PatientVoiceAuth from '../components/auth/PatientVoiceAuth.jsx'
import Wordmark from '../components/common/Wordmark.jsx'
import { MODERN_FONT } from '../components/landing/ModernChrome.jsx'
import { useI18n } from '../i18n/index.jsx'
import { takeSignedOutReason } from '../lib/signedOut.js'

/**
 * /patient-login (2026-11-08) — the patient sign-in page look.
 *
 * The form and ALL of its behaviour (OTP, resend wait, voice fields, the voice
 * guide, not-registered switch, ABHA check, consent, where it goes after) is
 * PatientVoiceAuth, unchanged; this page only lays it out and draws the art
 * beside it: a calm yoga scene (light leaves, a breathing halo, a rotating
 * health line). Login shows a seated meditation; Register shows a standing
 * dancer pose, so the two views are easy to tell apart. (The glass heart that
 * Register used to show is now on the Hospital Login page.)
 * Desktop only for the art; phones get the form alone. The landing page pop-up
 * (AuthModal) keeps its own look.
 *
 * Photos: StockSnap "Young Woman" (Altered Reality, CC0; mat recoloured to
 * TapCure teal) and StockSnap "Yoga Stretch" (Burst, CC0; cropped).
 */

const CANVAS_H = 810

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

const calm = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ───────────── Login: the calm scene ───────────── */
const QUOTES = ['ax.pp.quote1', 'ax.pp.quote2', 'ax.pp.quote3', 'ax.pp.quote4', 'ax.pp.quote5', 'ax.pp.quote6']
const LEAF_PATHS = [
  'M12 2C7 6 5 11 6.5 16.5 8 21 12 22 12 22s4-1 5.5-5.5C19 11 17 6 12 2z',
  'M12 2c-4 4-6 8-5 13 1 4 3 6 5 7 2-1 4-3 5-7 1-5-1-9-5-13z',
]
const LEAF_TINTS = ['#8fd3b6', '#a9dcc3', '#e8cf8a', '#9fd9d4', '#efc2a0']

const SCENE_PHOTOS = {
  login: { src: '/patient-login/meditate.jpg', pos: '[object-position:50%_58%]', mask: '[mask-image:radial-gradient(ellipse_66%_70%_at_50%_52%,#000_58%,transparent_90%)]' },
  // the sea behind this pose is not white, so it fades out in a tighter oval
  register: { src: '/patient-login/yoga-dancer.jpg', pos: '[object-position:50%_70%]', mask: '[mask-image:radial-gradient(ellipse_44%_48%_at_50%_50%,#000_50%,transparent_100%)]' },
}

function MeditationScene({ photo }) {
  const { t } = useI18n()
  const leavesRef = useRef(null)
  const [breathIn, setBreathIn] = useState(true)
  const [qi, setQi] = useState(0)
  const [quoteOut, setQuoteOut] = useState(false)

  // 4 s in, 4 s out.
  useEffect(() => {
    if (calm()) return undefined
    const id = setInterval(() => setBreathIn((b) => !b), 4000)
    return () => clearInterval(id)
  }, [])
  // One health line at a time, every 8 s.
  useEffect(() => {
    let swap
    const id = setInterval(() => { setQuoteOut(true); swap = setTimeout(() => { setQi((i) => i + 1); setQuoteOut(false) }, 600) }, 8000)
    return () => { clearInterval(id); clearTimeout(swap) }
  }, [])
  // A few light leaves; each drifts on its own path and starts again when it lands.
  useEffect(() => {
    const box = leavesRef.current
    if (!box || calm()) return undefined
    const anims = []
    let alive = true
    const drift = (el, i, startAt) => {
      if (!alive) return
      const size = 15 + Math.random() * 8
      const x0 = 6 + Math.random() * 88
      const dur = 13000 + Math.random() * 9000
      const swing = 18 + Math.random() * 36
      const turns = (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 240)
      const h = (box.clientHeight || 600) + 40
      el.style.width = el.style.height = `${size}px`
      el.style.left = `${x0}%`
      const frames = Array.from({ length: 9 }, (_, k) => {
        const p = k / 8
        return {
          transform: `translate(${Math.sin(p * Math.PI * 2.2 + x0) * swing}px, ${-30 + p * h}px) rotate(${p * turns}deg)`,
          opacity: p < 0.08 ? (p / 0.08) * 0.75 : p > 0.88 ? ((1 - p) / 0.12) * 0.75 : 0.75,
        }
      })
      const a = el.animate(frames, { duration: dur, easing: 'linear' })
      a.currentTime = startAt * dur
      a.onfinish = () => drift(el, i, 0)
      anims[i] = a
    }
    const els = Array.from({ length: 7 }, (_, i) => {
      const el = document.createElement('span')
      el.className = 'absolute top-0 [filter:drop-shadow(0_2px_3px_rgba(11,33,80,.12))]'
      el.innerHTML = `<svg viewBox="0 0 24 24" style="width:100%;height:100%;display:block"><path d="${LEAF_PATHS[i % 2]}" fill="${LEAF_TINTS[i % LEAF_TINTS.length]}"/><path d="M12 4.5v16.5" stroke="#fff" stroke-opacity=".6" stroke-width=".9"/></svg>`
      box.appendChild(el)
      drift(el, i, Math.random())
      return el
    })
    return () => { alive = false; anims.forEach((a) => a?.cancel()); els.forEach((el) => el.remove()) }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-3.5">
      <div className={`relative min-h-0 flex-1 overflow-hidden ${photo.mask}`} style={{ maxHeight: 640 }}>
        <span aria-hidden="true" className={`pointer-events-none absolute left-[22%] top-[4%] z-0 h-[86%] w-[56%] rounded-full transition-[opacity,transform] duration-[4000ms] ease-in-out [background:radial-gradient(closest-side,rgba(0,201,197,0)_52%,rgba(0,201,197,.22)_72%,rgba(0,201,197,.08)_86%,rgba(0,201,197,0))] ${breathIn ? 'scale-110 opacity-100' : 'scale-[.92] opacity-50'}`} />
        <img key={photo.src} src={photo.src} alt="" className={`absolute inset-0 z-[1] h-full w-full object-cover mix-blend-multiply transition-transform duration-[4000ms] ease-in-out motion-safe:animate-[ppFade_.6s_ease-out] ${photo.pos} ${breathIn ? 'scale-[1.045]' : 'scale-[1.02]'}`} />
        <div ref={leavesRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[2]" />
        <p key={String(breathIn)} className="absolute inset-x-0 top-[9%] z-[3] text-center motion-safe:animate-[ppBreath_4s_ease-in-out]">
          <span className="inline-block rounded-full bg-white/85 px-[22px] py-2 text-[22px] font-semibold text-[#0A7F7B] shadow-[0_8px_24px_-12px_rgba(11,33,80,.35)]">
            {t(breathIn ? 'ax.pp.breatheIn' : 'ax.pp.breatheOut')}
          </span>
        </p>
      </div>
      <p className={`text-center transition-[opacity,transform] duration-500 ${quoteOut ? 'translate-y-1.5 opacity-0' : 'opacity-100'}`}>
        <span className="text-[20px] font-medium italic text-[#0B2150]">
          <span className="mr-1.5 align-[-6px] text-[30px] not-italic text-[#0A9A96]">“</span>{t(QUOTES[qi % QUOTES.length])}<span className="ml-1.5 align-[-6px] text-[30px] not-italic text-[#0A9A96]">”</span>
        </span>
      </p>
    </div>
  )
}

export default function PatientAuthPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const fit = useCanvasFit()
  const [register, setRegister] = useState(false)
  const [notice] = useState(() => (takeSignedOutReason() === 'other-device' ? 'auth.signedOutOtherDevice' : null))

  useEffect(() => { document.title = 'Patient Login · TapCure' }, [])

  return (
    <div className={`tc-type min-h-screen bg-[#F3F8F8] text-[#0B2150] antialiased [background-image:radial-gradient(50%_45%_at_85%_10%,rgba(0,201,197,.16),transparent_70%),radial-gradient(45%_40%_at_5%_60%,rgba(51,105,255,.08),transparent_70%)] ${fit ? 'h-screen overflow-hidden' : ''}`} style={{ fontFamily: MODERN_FONT }}>
      <style>{'@keyframes ppFade{from{opacity:0}}@keyframes ppBreath{0%{opacity:0;transform:translateY(8px)}25%,70%{opacity:1;transform:none}100%{opacity:0}}'}</style>
      <div className="flex min-h-screen flex-col px-5 pt-5 sm:px-10 min-[901px]:min-h-0 min-[901px]:px-[72px] min-[901px]:pt-7"
        style={fit ? { zoom: fit.z, width: fit.w, height: CANVAS_H } : undefined}>
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2" aria-label="TapCure">
            <img src="/tapcure-icon.png" alt="" className="h-8 w-8" />
            <Wordmark className="text-[22px]" />
          </Link>
          <span id="pa-langs" />
        </header>
        {notice && <p role="status" className="mt-3 text-[15.5px] font-medium text-[#C2410C]">{t(notice)}</p>}

        <main className={`grid min-h-0 flex-1 items-center gap-10 py-4 ${fit ? 'grid-cols-[minmax(0,780px)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
          <div className="min-h-0 overflow-y-auto">
            {/* onClose as AuthPage gave the old page, so leaving after sign-in behaves the same */}
            <PatientVoiceAuth variant="page" replaceOnDone onClose={() => navigate('/')} onState={(v) => setRegister(v.mode === 'register')} />
          </div>
          {fit && <MeditationScene photo={SCENE_PHOTOS[register ? 'register' : 'login']} />}
        </main>
        {!fit && (
          <button type="button" onClick={() => navigate('/')} className="pb-6 pt-2 text-left text-[15px] font-semibold text-[#6B7A8F]">← TapCure</button>
        )}
      </div>
    </div>
  )
}
