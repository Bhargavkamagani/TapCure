import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, ShieldCheck, User, MapPin, Fingerprint, Mic, ArrowLeft, ArrowDown, Volume2, Sparkles, Square, Lock } from 'lucide-react'
import { Banner } from '../common/FormControls.jsx'
import ConsentCheck from '../legal/ConsentCheck.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useI18n, LANGS } from '../../i18n/index.jsx'
import { speak, listen, stopSpeaking, speakTurn, parseDigits, parseName, parseNameStrict, parseMobile, parseCity, parseAffirmative, sttSupported } from '../../lib/voice.js'
import { discoveryApi } from '../../api'
import { canRecord, cloudVoiceAvailable, startRecording, transcribe, extractAnswer } from '../../lib/voiceAgent.js'
import { consumeBookingIntent } from '../../lib/bookingIntent.js'
import { abhaDigits, abhaError } from '../../lib/abha.js'
import { toEnglishText } from '../../lib/englishText.js'
import { joinName, splitName } from '../../lib/personName.js'

const mobileRe = /^\d{10}$/

/** Input with a mic button that speaks the prompt then captures a spoken answer.
 *  When `active` (driven by the guided walkthrough) it shows a pulsing arrow +
 *  bubble pointing at the field and reflects the guide's speak/listen phase. */
function VoiceField({ icon: Icon, label, prompt, value, onChange, kind = 'text', placeholder, maxLength, exactLen, onVoiceError, active = false, bubble, phase = null }) {
  const { speech, t } = useI18n()
  const [listening, setListening] = useState(false)
  const [fieldError, setFieldError] = useState(null) // e.g. "only heard 6 of 10 digits"

  const handleMic = async () => {
    if (!sttSupported()) {
      onVoiceError?.(t('auth.voiceUnsupported'))
      return
    }
    setFieldError(null)
    setListening(true)
    try {
      // Fixed-length digit fields (mobile, OTP) must capture EVERY digit. If the
      // caller speaks a partial number, re-prompt once and flag it right here at
      // the field — never silently accept it and surprise them with an error on
      // submit.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await speak(attempt === 0 ? prompt : t('auth.repeatFull', { n: exactLen }), speech)
        const transcript = await listen(speech)
        const parsed =
          kind === 'digits' ? parseDigits(transcript).slice(0, maxLength || 32)
          : kind === 'name' ? parseName(transcript)
          : transcript.trim()
        if (kind === 'digits' && exactLen) {
          onChange(parsed) // reflect what we heard so far
          if (parsed.length === exactLen) { setFieldError(null); break }
          setFieldError(t('auth.incompleteDigits', { got: parsed.length, need: exactLen }))
          continue // give one more try with a "say the full number" prompt
        }
        if (parsed) onChange(parsed)
        break
      }
    } catch {
      onVoiceError?.(t('auth.voiceUnsupported'))
    } finally {
      setListening(false)
    }
  }

  const micActive = listening || phase === 'listening'

  return (
    <div className="relative">
      {/* Guide arrow + bubble pointing at this field */}
      <AnimatePresence>
        {active && bubble && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-1.5 flex items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-blue px-3 py-1 text-[12px] font-semibold text-white shadow-sm">
              <Volume2 className="h-3.5 w-3.5" />
              {bubble}
            </span>
            <motion.span
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
              className="text-brand-blue"
            >
              <ArrowDown className="h-4 w-4" />
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <label className="mb-1 block text-[12.5px] font-semibold text-slate-600">{label}</label>
      <div
        className={`flex items-center gap-2 rounded-xl border bg-white px-3 transition-shadow ${
          active
            ? 'border-brand-blue ring-2 ring-brand-blue/30'
            : 'border-slate-200 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/10'
        }`}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
        <input
          value={value}
          onChange={(e) => { setFieldError(null); onChange(kind === 'digits' ? e.target.value.replace(/\D/g, '').slice(0, maxLength || 32) : e.target.value) }}
          placeholder={placeholder}
          inputMode={kind === 'digits' ? 'numeric' : 'text'}
          maxLength={maxLength}
          className="w-full bg-transparent py-3.5 text-[16px] text-brand-navy outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={handleMic}
          title={t('auth.tapMic')}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
            micActive ? 'animate-pulse bg-red-500 text-white' : 'bg-brand-blueLight text-brand-blue hover:bg-brand-blue hover:text-white'
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>
      </div>
      {(micActive || (active && phase === 'speaking')) && (
        <p className="mt-1 text-[11.5px] font-medium text-brand-blue">
          {phase === 'speaking' ? t('guide.speaking') : t('auth.listening')}
        </p>
      )}
      {fieldError && <p className="mt-1 text-[11.5px] font-medium text-red-500">{fieldError}</p>}
    </div>
  )
}

/**
 * Patient login/registration by mobile number + OTP, with optional voice for
 * every field. Demo mode: the OTP comes back in the API response and is shown
 * on screen. The voice language follows the selected UI language.
 *
 * Guided walkthrough: when the UI language is Telugu (or the user taps "Voice
 * guide") an assistant auto-runs — it speaks each prompt, points an animated
 * arrow at the field, listens, and fills it in, then sends the OTP. All speech
 * goes through lib/voice.js `speak()`, which uses cloud TTS (Cartesia Sonic) when
 * configured and the browser voice otherwise.
 */
// `replaceOnDone` — true when this is the /patient-login route rather than a
// modal over the landing page, so the dashboard replaces the login entry in
// history instead of stacking on top of it.
function PatientVoiceAuth({ onClose, replaceOnDone = false }) {
  const { t, lang, setLang, speech } = useI18n()
  const { requestOtp, loginOtp, registerOtp, homeFor } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [step, setStep] = useState('mobile') // 'mobile' | 'details' | 'otp'
  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  // The full name the rest of this flow (and the voice guide) works with.
  const name = joinName(firstName, lastName)
  const setName = (v) => { const p = splitName(v); setFirstName(p.first); setLastName(p.last) }
  const [city, setCity] = useState('')
  const [abhaNumber, setAbhaNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [banner, setBanner] = useState(null) // { type, msg }
  const [busy, setBusy] = useState(false)
  const [agreed, setAgreed] = useState(false) // consent gate (register only)
  const [consentErr, setConsentErr] = useState(false)
  // Resend cooldown (2026-11-02). Every send costs a WhatsApp message and the
  // backend allows only 5 per phone per 15 min, so a patient tapping Resend
  // repeatedly would lock themselves out. Wait grows with use, per SAME number:
  // after the 1st OTP 30s, after the 2nd and every later one 60s. A different
  // number starts again at 30s.
  const resendWait = (sends) => (sends >= 2 ? 60 : 30)
  const [resendIn, setResendIn] = useState(0)
  const [sentTo, setSentTo] = useState('')
  // Ref, not state: submitDetails is a memoised callback and would read a
  // stale count from state.
  const sendsRef = useRef({ phone: '', count: 0 })
  useEffect(() => {
    if (resendIn <= 0) return undefined
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])
  const coolingDown = resendIn > 0 && phone === sentTo
  // "45s" under a minute, "14:59" above — a 15-minute lock in seconds is unreadable.
  const waitLabel = resendIn >= 60
    ? `${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}`
    : `${resendIn}s`
  // The backend says "too many attempts" with the exact seconds left (429).
  // Lock the send/resend buttons for exactly that long, so the countdown on
  // screen matches the server instead of letting the patient tap into a wall.
  const lockFromError = (e, p) => {
    const secs = e?.status === 429 ? Number(e?.detail?.retry_after) : 0
    if (secs > 0) { setSentTo(p); setResendIn(Math.ceil(secs)) }
  }

  // Guided walkthrough state
  const [guideOn, setGuideOn] = useState(false)
  const [guideField, setGuideField] = useState(null) // 'tab' | 'name' | 'mobile' | 'city' | null
  const [guidePhase, setGuidePhase] = useState(null) // 'speaking' | 'listening' | null
  const cancelRef = useRef(false)

  const reset = (m) => { setMode(m); setStep(m === 'register' ? 'details' : 'mobile'); setOtp(''); setBanner(null); setAgreed(false); setConsentErr(false) }

  const finish = (u) => {
    setBanner({ type: 'success', msg: t('auth.success') })
    setTimeout(() => {
      onClose()
      navigate(consumeBookingIntent(u.role_name) || homeFor(u.role_name), { replace: replaceOnDone })
    }, 700)
  }

  // Self-contained OTP request — takes explicit values so the guided runner
  // never trips over stale React state in its async closure.
  // Mirrors `abhaNumber` so the guided runner — which passes explicit values to
  // dodge stale closures — still validates an ABHA the user typed by hand.
  const abhaRef = useRef('')
  const updateAbha = (v) => { abhaRef.current = v; setAbhaNumber(v) }
  const cityRef = useRef('')
  const updateCity = (v) => { cityRef.current = v; setCity(v) }

  const submitDetails = useCallback(async ({ phone: p, name: n, abha: a = abhaRef.current,
                                             city: c = cityRef.current, register }) => {
    if (!mobileRe.test(p)) { setBanner({ type: 'error', msg: t('auth.invalidMobile') }); return false }
    if (register && !n.trim()) { setBanner({ type: 'error', msg: t('auth.nameLabel') }); return false }
    // City is required — it's what puts the patient in reach of a hospital. Caught
    // here so it fails before the OTP is sent, not after they've verified it.
    if (register && !(c || '').trim()) { setBanner({ type: 'error', msg: t('auth.cityRequired') }); return false }
    // Check the ABHA number now, not after the OTP round-trip — the backend
    // rejects a bad one at registration, which is two steps too late.
    if (register && abhaError(a)) { setBanner({ type: 'error', msg: t('auth.invalidAbha') }); return false }
    setBusy(true)
    try {
      // `mode` lets the server refuse without spending an OTP: a staff number,
      // a login for a number that was never registered, or a signup for one
      // that already is. Nothing is sent in those cases — we stop right here
      // instead of taking the patient to a code that could never work.
      const res = await requestOtp(p, register ? 'register' : 'login')
      if (res.otp_sent === false) {
        setBanner({ type: 'error', msg: res.message || t('auth.notRegistered') })
        // Point them at the door that WILL work.
        if (!register && res.registered === false && !res.is_staff) { setMode('register'); setStep('details') }
        if (register && res.registered === true) { setMode('login'); setStep('mobile') }
        return false
      }
      setStep('otp')
      const prev = sendsRef.current
      const count = prev.phone === p ? prev.count + 1 : 1
      sendsRef.current = { phone: p, count }
      setSentTo(p)
      setResendIn(resendWait(count))
      setBanner({
        type: 'success',
        msg: res.dev_otp
          ? t('auth.otpSentDemo', { phone: p, otp: res.dev_otp })
          : t('auth.otpOnWhatsapp', { phone: p }),
      })
      return true
    } catch (e) {
      lockFromError(e, p)
      setBanner({ type: 'error', msg: e.message || t('ax.pva.sendFailed') })
      return false
    } finally {
      setBusy(false)
    }
  }, [requestOtp, t])

  const sendOtp = () => {
    if (coolingDown) return
    // Consent is mandatory to register — block sending the OTP (and advancing to
    // the verify step) until the Terms/Privacy/Refund box is ticked.
    if (mode === 'register' && !agreed) {
      setConsentErr(true)
      setBanner({ type: 'error', msg: t('ax.pva.acceptPolicies') })
      return
    }
    // Speak the "enter the OTP" prompt ONLY when the voice guide is running.
    // It used to narrate on every submit, so someone typing their number by
    // hand got talked at out of nowhere.
    if (mode === 'register' && firstName.trim() && !lastName.trim()) { setBanner({ type: 'error', msg: t('ppage.lastNameReq') }); return }
    submitDetails({ phone, name, abha: abhaNumber, city, register: mode === 'register' }).then((ok) => {
      if (ok && guideOn) speak(t('auth.otpPrompt'), speech)
    })
  }

  const verify = async () => {
    if (otp.length < 4) { setBanner({ type: 'error', msg: t('auth.otpLabel') }); return }
    if (mode === 'register' && !agreed) {
      setConsentErr(true)
      setBanner({ type: 'error', msg: t('ax.pva.acceptPolicies') })
      return
    }
    setBusy(true)
    try {
      const u = mode === 'register'
        ? await registerOtp({ phone, otp, name: toEnglishText(name.trim()), first_name: toEnglishText(firstName.trim()), last_name: toEnglishText(lastName.trim()) || null, city: toEnglishText(city.trim()) || null, abha_number: abhaDigits(abhaNumber) || null, terms_accepted: true })
        : await loginOtp(phone, otp)
      finish(u)
    } catch (e) {
      // Five wrong codes lock the number — and, since 2026-11-02, sending to
      // it too. Count the same wait down on Resend.
      lockFromError(e, phone)
      setBanner({ type: 'error', msg: e.message || t('ax.pva.verifyFailed') })
    } finally {
      setBusy(false)
    }
  }

  // ----------------------------------------------------------- guided runner --
  const stopGuide = useCallback(() => {
    cancelRef.current = true
    stopSpeaking()
    setGuideOn(false)
    setGuideField(null)
    setGuidePhase(null)
  }, [])

  const runGuide = useCallback(async () => {
    cancelRef.current = false
    const cloudListening = await cloudVoiceAvailable()
    if (lang === 'te' && !cloudListening) {
      setGuideOn(false)
      setGuideField(null)
      setGuidePhase(null)
      setBanner({ type: 'error', msg: t('guide.listenUnavailable') })
      return
    }
    if (!cloudListening && !sttSupported()) {
      setGuideOn(false)
      setGuideField(null)
      setGuidePhase(null)
      setBanner({ type: 'error', msg: t('auth.voiceUnsupported') })
      return
    }
    setGuideOn(true)
    setMode('register')
    setStep('details')
    setBanner({ type: 'success', msg: t('guide.running') })

    const cancelled = () => cancelRef.current
    const say = async (key, vars) => {
      if (cancelled()) return
      setGuidePhase('speaking')
      const before = speakTurn()
      await speak(t(key, vars), speech)
      setGuidePhase(null)
      // If a newer voice took over while we were speaking (e.g. the user pressed
      // a field mic or switched language), abort the guide instead of talking
      // over it — the existing cancelled() checks after each step do the rest.
      if (speakTurn() !== before + 1) cancelRef.current = true
    }
    // `parse` is the fast local word rules. When they can't read a reply and
    // `aiField` is set, the AI pulls the answer out ("it's for my mother, her
    // name is Lakshmi", "nine eight double seven ..."), and that answer must
    // still pass `parse` — the AI helps read, it never skips the checks.
    const hear = async (parse, ms = 8000, aiField = null) => {
      if (cancelled()) return ''
      setGuidePhase('listening')
      try {
        let tr = ''
        if (cloudListening && canRecord()) {
          const recorder = await startRecording()
          await new Promise((resolve) => setTimeout(resolve, ms))
          const blob = await recorder.stop()
          if (blob.size < 1000) {
            setBanner({ type: 'error', msg: t('ax.pva.noAudio', { bytes: blob.size }) })
            return ''
          }
          tr = await transcribe(blob, lang)
        } else {
          if (!sttSupported()) return ''
          tr = await listen(speech)
        }
        let parsed = parse ? parse(tr) : (tr || '').trim()
        if (!parsed && aiField && cloudListening && (tr || '').trim() && !cancelled()) {
          setGuidePhase('thinking')
          const ai = await extractAnswer(tr, lang, aiField)
          if (ai) parsed = parse ? parse(ai) : ai
        }
        if (tr) setBanner({ type: 'success', msg: t('ax.pva.heard', { text: tr }) })
        if (!parsed) setBanner({ type: 'error', msg: tr ? t('ax.pva.heardUnusable', { text: tr }) : t('guide.didntHear') })
        return parsed
      } catch (e) {
        setBanner({ type: 'error', msg: t('ax.pva.listenFailed', { detail: e?.message || t('ax.pva.listenFailedDetail') }) })
        return ''
      } finally {
        setGuidePhase(null)
      }
    }

    // 0) Welcome + point at the Register tab ("sign up here").
    setGuideField('tab')
    await say('guide.welcome')
    if (cancelled()) return stopGuide()

    // A step only moves on with an answer that fits the question. If it still
    // has none after its tries, the guide stops at that box and asks the
    // patient to type it — it never carries on with a wrong or empty answer.
    const stopAt = async (key) => {
      await say(key)
      setBanner({ type: 'error', msg: t(key) })
      setGuideOn(false); setGuideField(null); setGuidePhase(null)
    }

    // 1) Name — must sound like a name, then read back; only a clear "yes"
    // keeps it. "No" or no clear answer asks for the name again.
    setGuideField('name')
    let collectedName = ''
    let namePrompt = 'guide.namePrompt'
    for (let i = 0; i < 3 && !collectedName && !cancelled(); i += 1) {
      await say(namePrompt)
      const v = await hear(parseNameStrict, 8000, 'name')
      if (!v) { namePrompt = 'ax.pva.nameRetry'; continue }
      setName(v)
      let ans = ''
      for (let k = 0; k < 2 && !ans && !cancelled(); k += 1) {
        await say(k === 0 ? 'ax.pva.nameConfirm' : 'ax.pva.sayYesNo', { name: v })
        ans = await hear((tr) => parseAffirmative(tr), 5000, 'yes_no')
      }
      if (ans !== 'yes') { setName(''); namePrompt = 'ax.pva.nameAgain'; continue }
      collectedName = v
      await say('guide.gotIt')
    }
    if (cancelled()) return stopGuide()
    if (!collectedName) return stopAt('ax.pva.nameTypeIt')

    // 2) Mobile — a valid Indian number (10 digits, starts 6-9), never a partial.
    setGuideField('mobile')
    let collectedPhone = ''
    for (let i = 0; i < 3 && !collectedPhone && !cancelled(); i += 1) {
      await say(i === 0 ? 'guide.mobilePrompt' : 'ax.pva.mobileRetry')
      const v = await hear(parseMobile, 10000, 'mobile')
      if (v) { collectedPhone = v; setPhone(v); await say('guide.gotIt') }
    }
    if (cancelled()) return stopGuide()
    if (!collectedPhone) return stopAt('ax.pva.mobileTypeIt')

    // 3) City — required to register, so it can't be skipped. Snapped to a
    // served city's spelling when it matches one.
    let knownCities = []
    try { knownCities = JSON.parse(sessionStorage.getItem('tapcure.cities') || '[]') } catch { /* refetch */ }
    if (!Array.isArray(knownCities) || !knownCities.length) {
      try { knownCities = (await discoveryApi.cities())?.cities || [] } catch { knownCities = [] }
    }
    setGuideField('city')
    let collectedCity = ''
    for (let i = 0; i < 3 && !collectedCity && !cancelled(); i += 1) {
      await say(i === 0 ? 'ax.pva.cityPrompt' : 'ax.pva.cityRetry')
      const v = await hear((tr) => parseCity(tr, knownCities), 8000, 'city')
      // updateCity, not setCity: submitDetails reads the ref, so setCity
      // alone left the city empty and the OTP step failed "city required".
      if (v) { collectedCity = v; updateCity(v); await say('guide.gotIt') }
    }
    if (cancelled()) return stopGuide()
    if (!collectedCity) return stopAt('ax.pva.cityTypeIt')

    // 3.5) Consent — mandatory to register, and now spoken. Ask, then listen for
    // a yes/no in the caller's language (parseAffirmative handles en/te/hi, native
    // script + romanised). No consent → we stop before sending the OTP.
    setGuideField('consent')
    let consented = agreed
    for (let i = 0; i < 2 && !consented && !cancelled(); i += 1) {
      await say(i === 0 ? 'guide.consentPrompt' : 'guide.consentRetry')
      const ans = await hear((tr) => parseAffirmative(tr))
      if (ans === 'yes') { consented = true; setAgreed(true); setConsentErr(false); await say('guide.consentThanks') }
      else if (ans === 'no') { await say('guide.consentDeclined') }
    }
    if (cancelled()) return stopGuide()
    if (!consented) {
      setConsentErr(true)
      setBanner({ type: 'error', msg: t('guide.consentNeeded') })
      setGuideOn(false); setGuideField(null); setGuidePhase(null)
      return
    }

    // 4) Send the OTP automatically if we have a valid number.
    setGuideField(null)
    if (mobileRe.test(collectedPhone) && collectedName.trim()) {
      await say('guide.sendingOtp')
      const ok = await submitDetails({ phone: collectedPhone, name: collectedName, city: collectedCity, register: true })
      if (ok && !cancelled()) await say('auth.otpPrompt')
    }
    setGuideOn(false)
    setGuidePhase(null)
  }, [speech, t, submitDetails, stopGuide])

  // The guide starts ONLY when the user asks for it. It used to auto-launch and
  // start talking as soon as the language was Telugu — nobody had asked for
  // voice, and there was no way to predict it. The "Voice guide" button is
  // right there, and it stays available in every language.

  // Stop the guide + narration if the modal unmounts (tab closed / navigated away).
  // stopSpeaking() alone only cancels the clip that's playing right now — the async
  // runGuide loop would carry on to its next prompt and start talking again. Setting
  // the cancel flag makes the loop bail at its next checkpoint.
  useEffect(() => () => { cancelRef.current = true; stopSpeaking() }, [])

  // Stop the voice guide when the browser tab is hidden (user switched tabs or
  // minimised the window) — otherwise the narration keeps playing in the
  // background tab. pagehide covers navigating away / closing the tab.
  useEffect(() => {
    const onHidden = () => { if (document.hidden) stopGuide() }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', stopGuide)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', stopGuide)
    }
  }, [stopGuide])

  const guideTarget = (f) => guideOn && guideField === f

  return (
    <div className="space-y-4">
      {/* Language picker — drives both the UI and the voice prompts. */}
      <div className="flex justify-center gap-1.5">
        {Object.entries(LANGS).map(([code, meta]) => (
          <button
            key={code}
            type="button"
            onClick={() => { stopSpeaking(); if (guideOn) stopGuide(); setLang(code) }}
            className={`rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-colors ${
              lang === code ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {/* Login / Register toggle */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        <button type="button" onClick={() => reset('login')} className={`flex-1 rounded-lg py-3 text-[15px] font-semibold ${mode === 'login' ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-500'}`}>{t('auth.loginTab')}</button>
        <button
          type="button"
          onClick={() => reset('register')}
          className={`relative flex-1 rounded-lg py-3 text-[15px] font-semibold transition-shadow ${
            mode === 'register' ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-500'
          } ${guideTarget('tab') ? 'ring-2 ring-brand-blue ring-offset-1' : ''}`}
        >
          {t('auth.signupTab')}
          {guideTarget('tab') && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand-blue px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm"
            >
              {t('guide.signupHere')}
            </motion.span>
          )}
        </button>
      </div>

      {banner && <Banner type={banner.type}>{banner.msg}</Banner>}

      {step !== 'otp' ? (
        <>
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <VoiceField icon={User} kind="name" label={t('ppage.firstName')} prompt={t('auth.namePrompt')} value={firstName} onChange={setFirstName} placeholder={t('ppage.firstName')} onVoiceError={(m) => setBanner({ type: 'error', msg: m })} active={guideTarget('name')} bubble={t('guide.nameBubble')} phase={guideTarget('name') ? guidePhase : null} />
              <VoiceField icon={User} kind="name" label={t('ppage.lastName')} prompt={t('ppage.lastName')} value={lastName} onChange={setLastName} placeholder={t('ppage.lastName')} onVoiceError={(m) => setBanner({ type: 'error', msg: m })} />
            </div>
          )}
          <VoiceField icon={Phone} kind="digits" maxLength={10} exactLen={10} label={t('auth.mobileLabel')} prompt={t('auth.mobilePrompt')} value={phone} onChange={setPhone} placeholder="9876543210" onVoiceError={(m) => setBanner({ type: 'error', msg: m })} active={guideTarget('mobile')} bubble={t('guide.mobileBubble')} phase={guideTarget('mobile') ? guidePhase : null} />
          {mode === 'register' && (
            <VoiceField icon={MapPin} kind="text" label={t('auth.cityLabel')} prompt={t('auth.cityLabel')} value={city} onChange={updateCity} placeholder={t('auth.cityLabel')} onVoiceError={(m) => setBanner({ type: 'error', msg: m })} active={guideTarget('city')} bubble={t('guide.cityBubble')} phase={guideTarget('city') ? guidePhase : null} />
          )}
          {mode === 'register' && (
            <VoiceField icon={Fingerprint} kind="digits" maxLength={14} label={t('auth.abhaLabel')} prompt={t('auth.abhaPrompt')} value={abhaNumber} onChange={updateAbha} placeholder="12-3456-7890-1234" onVoiceError={(m) => setBanner({ type: 'error', msg: m })} />
          )}
          {mode === 'register' && (
            <div className={`rounded-xl p-2 transition-colors ${
              !agreed ? 'bg-brand-blueLight/50 ring-2 ring-brand-blue/40' : ''
            } ${guideTarget('consent') ? 'ring-brand-blue' : ''}`}>
              {!agreed && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-1.5 flex items-center gap-1.5 px-1 text-[12.5px] font-semibold text-brand-blue"
                >
                  <motion.span animate={{ y: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 0.9 }}>
                    <ArrowDown className="h-4 w-4" />
                  </motion.span>
                  {t('auth.tickToAccept')}
                </motion.p>
              )}
              <ConsentCheck
                checked={agreed}
                onChange={(v) => { setAgreed(v); if (v) setConsentErr(false) }}
                error={consentErr ? t('ax.pva.acceptToContinue') : null}
              />
            </div>
          )}
          <button type="button" disabled={busy || coolingDown || (mode === 'register' && !agreed)} onClick={sendOtp} className="w-full rounded-xl bg-brand-blue py-4 text-[15.5px] font-semibold text-white transition-colors hover:bg-brand-blueDark disabled:opacity-60 disabled:cursor-not-allowed">
            {coolingDown ? t('auth.resendIn', { s: waitLabel }) : mode === 'register' ? t('auth.registerCta') : t('auth.loginCta')}
          </button>
        </>
      ) : (
        <>
          <VoiceField icon={ShieldCheck} kind="digits" maxLength={6} exactLen={6} label={t('auth.otpLabel')} prompt={t('auth.otpPrompt')} value={otp} onChange={setOtp} placeholder="••••••" onVoiceError={(m) => setBanner({ type: 'error', msg: m })} />
          {mode === 'register' && !agreed && (
            <ConsentCheck
              checked={agreed}
              onChange={(v) => { setAgreed(v); if (v) setConsentErr(false) }}
              error={consentErr ? t('ax.pva.acceptToCreate') : null}
            />
          )}
          <button type="button" disabled={busy} onClick={verify} className="w-full rounded-xl bg-brand-blue py-4 text-[15.5px] font-semibold text-white transition-colors hover:bg-brand-blueDark disabled:opacity-60">
            {mode === 'register' ? t('auth.createAccount') : t('auth.verifyLogin')}
          </button>
          <button type="button" disabled={busy || coolingDown} onClick={() => { setOtp(''); sendOtp() }} className="w-full text-[13.5px] font-semibold text-brand-blue hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline">
            {coolingDown ? t('auth.resendIn', { s: waitLabel }) : t('auth.resendOtp')}
          </button>
          <button type="button" onClick={() => { setStep(mode === 'register' ? 'details' : 'mobile'); setBanner(null) }} className="flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-brand-blue">
            <ArrowLeft className="h-4 w-4" /> {t('auth.back')}
          </button>
        </>
      )}

      {/* Guided voice walkthrough control — registration helper only. Hidden
          once the OTP has been sent so it can't restart the guide (and wipe the
          user's OTP progress) after registration. */}
      {step !== 'otp' && (
        <>
        {/* A real alternative to the button above it, not a second action of
            equal weight — the rule says "or" so the choice reads as a fork. */}
        <div className="flex items-center gap-3 py-0.5">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-[12.5px] font-medium text-slate-400">{t('ax.pva.or')}</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <button
          type="button"
          onClick={() => (guideOn ? stopGuide() : runGuide())}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3.5 text-[14.5px] font-semibold transition-colors ${
            guideOn
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-slate-200 bg-white text-brand-blue hover:border-brand-blue/40 hover:bg-brand-blueLight'
          }`}
        >
          {guideOn ? <Square className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          {guideOn ? t('guide.stop') : t('guide.start')}
        </button>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 pt-1 text-[12.5px] text-slate-400">
        <Lock className="h-3.5 w-3.5" /> {t('ax.pva.dataSafe')}
      </p>
    </div>
  )
}

export default PatientVoiceAuth
