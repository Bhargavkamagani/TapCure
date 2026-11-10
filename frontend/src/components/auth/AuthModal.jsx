import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import BackToHome from '../common/BackToHome.jsx'
import { useNavigate } from 'react-router-dom'
import { X, Lock, Mail, MapPin, Stethoscope, ShieldCheck, Ticket, CalendarCheck, ClipboardList, Sparkles, Users, UserPlus, LogIn } from 'lucide-react'
import { TextInput, PasswordInput, SelectInput, Checkbox, Banner } from '../common/FormControls.jsx'
import { AUTH_ROLES, CITIES, SPECIALIZATIONS } from '../../data/authData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useI18n } from '../../i18n/index.jsx'
import PatientVoiceAuth from './PatientVoiceAuth.jsx'
import { consumeBookingIntent } from '../../lib/bookingIntent.js'
import GlassBackdrop from '../common/GlassBackdrop.jsx'
import ForgotPasswordFlow from './ForgotPasswordFlow.jsx'

import { emailTypoSuggestion } from '../../lib/emailTypos.js'
import { takeSignedOutReason } from '../../lib/signedOut.js'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mobileRe = /^\d{10}$/

/* The floating figures on the doctor panel. Illustrative by necessity: this
   is a signed-out page, so there is no doctor whose real numbers these could
   be. Kept plausible for a single clinician's day rather than impressive. */
const DOCTOR_STATS = [
  { icon: CalendarCheck, label: 'ax.stat.todayAppts', value: '24', note: 'ax.stat.twoSessions', at: 'left-[22%] top-[0%]' },
  { icon: Users, label: 'ax.stat.patientsSeen', value: '56', note: 'ax.stat.thisWeek', at: 'left-[-2%] top-[62%]' },
  { icon: Ticket, label: 'ax.stat.liveTokens', value: '8', note: 'ax.stat.inQueue', at: 'right-[1%] top-[24%]' },
]

// Editorial promo content for the split panel (matches the reference designs).
// Values are i18n keys (i18n/dict/authExtra.js), resolved with t() at render.
const PATIENT_PROMO = {
  badge: 'ax.promoP.badge',
  // `accent` is rendered in the brand teal inside the headline.
  title: 'ax.promoP.title',
  accent: 'ax.promoP.accent',
  titleAfter: 'ax.promoP.titleAfter',
  subtitle: 'ax.promoP.subtitle',
  features: [
    { icon: ShieldCheck, title: 'ax.promoP.f1Title', desc: 'ax.promoP.f1Desc' },
    { icon: Ticket, title: 'ax.promoP.f2Title', desc: 'ax.promoP.f2Desc' },
    { icon: CalendarCheck, title: 'ax.promoP.f3Title', desc: 'ax.promoP.f3Desc' },
  ],
}
const DOCTOR_PROMO = {
  badge: 'ax.promoD.badge',
  title: 'ax.promoD.title',
  accent: 'ax.promoD.accent',
  titleAfter: 'ax.promoD.titleAfter',
  subtitle: 'ax.promoD.subtitle',
  features: [
    { icon: CalendarCheck, title: 'ax.promoD.f1Title', desc: 'ax.promoD.f1Desc' },
    { icon: Ticket, title: 'ax.promoD.f2Title', desc: 'ax.promoD.f2Desc' },
    { icon: ClipboardList, title: 'ax.promoD.f3Title', desc: 'ax.promoD.f3Desc' },
  ],
}

/**
 * Premium split auth modal used for BOTH patient and doctor roles.
 * Left = gradient promo panel; right = Login / Sign up tabs.
 *
 * Rendered through a portal to <body> so the homepage's scale() transform
 * never shrinks or clips it.
 */
function AuthModal({ open, onClose, role = 'patient', initialMode = 'login', page = false }) {
  const cfg = AUTH_ROLES[role]
  const promo = role === 'patient' ? PATIENT_PROMO : DOCTOR_PROMO
  const navigate = useNavigate()
  const { login, register, homeFor } = useAuth()
  const { t } = useI18n()

  const [mode, setMode] = useState(initialMode) // 'login' | 'signup'
  const [forgot, setForgot] = useState(false) // null | 'enter' | 'sent'
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null) // { type, msg }

  // Reset to a clean state whenever the modal (re)opens.
  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setForgot(false)
      setForm({})
      setErrors({})
      // Say WHY they are back at the login screen when the app sent them here
      // itself: the account was signed in on another device, and one account
      // holds one session. Read once — takeSignedOutReason() clears it, so a
      // reload doesn't repeat a notice about something that already happened.
      const reason = takeSignedOutReason()
      setBanner(reason === 'other-device' ? { type: 'error', msg: t('auth.signedOutOtherDevice') } : null)
    }
  }, [open, initialMode, role]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll + close on Escape.
  useEffect(() => {
    if (!open || page) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, page])

  if (!open) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const finish = (u) => {
    setBanner({ type: 'success', msg: t('ax.modal.success') })
    setTimeout(() => {
      onClose()
      // `page` = this modal IS the /patient-login | /doctor-login route, so the
      // console must REPLACE it — otherwise Back lands on a login form the user
      // has already passed. Opened over the landing page it stays a push, so
      // Back still returns to the page they came from.
      navigate(consumeBookingIntent(u.role_name) || homeFor(u.role_name), { replace: !!page })
    }, 600)
  }

  /* ---------------- Password login ---------------- */
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
    // through. Caught here because doctor sign-in is email-only: a typo means
    // an account that can never be logged into or reset.
    else if (emailTypoSuggestion(idf)) err.idf = t('pm.emailTypo', { d: emailTypoSuggestion(idf) })
    if (!form.password?.trim()) err.password = t('ax.modal.required')
    setErrors(err)
    if (Object.keys(err).length) return

    try {
      // This password form is the DOCTOR door — patients sign in by mobile OTP
      // through PatientVoiceAuth, never here.
      const u = await login(idf, form.password, 'doctor')
      finish(u)
    } catch (e2) {
      setBanner({
        type: 'error',
        msg: e2.status === 401 ? t('ax.modal.invalidCreds') : e2.message || t('ax.modal.loginFailed'),
      })
    }
  }

  /* ---------------- Signup ---------------- */
  const handleSignup = async (e) => {
    e.preventDefault()
    const err = {}
    if (!form.fullName?.trim()) err.fullName = t('ax.modal.required')
    if (!mobileRe.test(form.mobile || '')) err.mobile = t('ax.modal.invalidMobile')
    if (!emailRe.test(form.email || '')) err.email = t('ax.modal.invalidEmail')
    else if (emailTypoSuggestion(form.email)) {
      err.email = t('pm.emailTypo', { d: emailTypoSuggestion(form.email) })
    }
    if (role === 'patient' && !form.city) err.city = t('ax.modal.selectCity')
    if (role === 'doctor' && !form.specialization) err.specialization = t('ax.modal.selectSpec')
    if (!form.password?.trim()) err.password = t('ax.modal.required')
    else if (form.password.length < 8) err.password = t('ax.modal.min6')
    if (form.confirm !== form.password) err.confirm = t('ax.modal.pwMismatch')
    if (!form.terms) err.terms = t('ax.modal.acceptTerms')
    setErrors(err)
    if (Object.keys(err).length) return

    if (role !== 'patient') {
      setBanner({ type: 'error', msg: t('ax.modal.doctorByHospital') })
      return
    }
    try {
      const u = await register({
        name: form.fullName,
        email: form.email,
        phone: form.mobile,
        password: form.password,
        city: form.city,
      })
      finish(u)
    } catch (e2) {
      setBanner({ type: 'error', msg: e2.message || t('ax.modal.signupFailed') })
    }
  }

  const TabBtn = ({ value, children }) => (
    <button
      type="button"
      onClick={() => {
        setMode(value)
        setErrors({})
        setBanner(null)
      }}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-[15px] font-semibold transition-colors ${
        mode === value ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {value === 'signup' ? <UserPlus className="h-[17px] w-[17px]" /> : <LogIn className="h-[17px] w-[17px]" />}
      {children}
    </button>
  )

  const content = (
    <div
      className={page
        ? 'login-glass-page theme-editorial relative isolate min-h-screen overflow-x-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 font-sans text-slate-700 lg:h-screen lg:overflow-hidden'
        : 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm'}
      onMouseDown={page ? undefined : onClose}
    >
      {page && <GlassBackdrop />}
      {/* As a route this has no close button and Escape is disabled, so this is
          the only way back to the landing page. */}
      {page && <BackToHome className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6" />}
      <div
        className={page
          ? 'theme-patient grid w-full max-w-full grid-rows-[auto_auto] overflow-x-hidden lg:h-full lg:grid-cols-2 lg:grid-rows-1 lg:overflow-visible'
          : 'theme-patient relative flex max-h-[94vh] w-full max-w-[1120px] overflow-hidden rounded-3xl bg-white shadow-2xl'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close */}
        {!page && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label={t('ax.modal.close')}
        >
          <X className="h-5 w-5" />
        </button>
        )}

        {/* Left promo panel — brand teal→green (matches landing, patient & doctor) */}
        <div className={page
          ? 'relative flex w-full min-w-0 flex-col justify-center px-6 pb-10 pt-24 sm:px-10 lg:h-full lg:overflow-hidden lg:p-12 lg:pt-12'
          : 'relative hidden w-[46%] flex-col justify-center overflow-hidden bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#16a34a] p-11 text-white md:flex'}>
          {/* Cropped from the supplied reference, background keyed out so it sits
              on the page gradient. Decorative, so hidden from assistive tech and
              dropped below lg where the copy needs the full width. */}
          {page && role === 'patient' && (
            <img
              src="/patient-login-art.webp"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 bottom-0 hidden w-[64%] max-w-[440px] select-none opacity-95 xl:block"
            />
          )}
          {page && role === 'doctor' && (
            <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-[4%] hidden h-[88%] w-[46%] max-w-[430px] xl:block">
              {/* Masked rather than alpha-keyed: he is wearing a white coat, so
                  keying the near-white ground would take the coat with it. */}
              {/* The soft edge is baked into the file: a CSS mask could not be
                  relied on here, and the photo has a white coat so an alpha key
                  by luminance would have removed the doctor along with the
                  background. */}
              <img src="/doctor-login-art.webp" alt="" className="absolute bottom-0 left-0 w-full select-none" />
              {/* Illustrative figures - this panel is seen before anyone logs
                  in, so there is no doctor whose real numbers these could be. */}
              {DOCTOR_STATS.map(({ icon: Icon, label, value, note, at }) => (
                <span key={label} className={`absolute flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/85 px-3.5 py-2.5 shadow-lg backdrop-blur-sm ${at}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-medium text-slate-500">{t(label)}</span>
                    <b className="block text-[19px] font-extrabold tracking-tight text-[#0f2742]">{value}</b>
                    <span className="block text-[13px] text-slate-400">{t(note)}</span>
                  </span>
                </span>
              ))}
            </div>
          )}
          <div className={page ? 'relative z-10 w-full lg:ml-auto lg:max-w-[620px]' : 'contents'}>
          <span className={`relative z-10 inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${page ? 'bg-teal-50 text-teal-700' : 'bg-white/10 text-green-100 ring-1 ring-white/15'}`}>
            {role === 'doctor' ? <Stethoscope className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} {t(promo.badge)}
          </span>
          <h3 className={`relative z-10 mt-6 text-[2.1rem] font-extrabold leading-[1.08] tracking-tight sm:text-[2.7rem] xl:text-[3.4rem] xl:leading-[1.06] ${page ? 'text-[#0f2742]' : 'font-serif text-white'}`}>
            {t(promo.title)}
            {promo.accent && <span className={page ? 'text-[#0f766e]' : 'text-white/80'}>{t(promo.accent)}</span>}
            {t(promo.titleAfter)}
          </h3>
          <div className={`relative z-10 mt-4 h-1 w-20 rounded-full ${page ? 'bg-gradient-to-r from-teal-600 to-green-600' : 'bg-white/30'}`} />
          <p className={`relative z-10 mt-4 max-w-[21rem] text-[15.5px] sm:mt-5 sm:text-[17.5px] ${page ? 'text-slate-500' : 'text-green-100/80'}`}>{t(promo.subtitle)}</p>
          <ul className="relative z-10 mt-10 max-w-[20rem] space-y-6">
            {promo.features.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex gap-4">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${page ? 'bg-teal-50 text-teal-600' : 'bg-white/10 text-white ring-1 ring-white/15'}`}>
                  <Icon className="h-7 w-7" />
                </span>
                <div>
                  <p className={`text-[17px] font-bold ${page ? 'text-[#0f2742]' : 'text-white'}`}>{t(title)}</p>
                  <p className={`text-[14.5px] leading-snug ${page ? 'text-slate-500' : 'text-green-100/70'}`}>{t(desc)}</p>
                </div>
              </li>
            ))}
          </ul>
          </div>
        </div>

        {/* Right form panel */}
        <div className={page
          ? 'flex w-full min-w-0 items-center justify-center px-5 pb-12 sm:px-8 lg:h-full lg:overflow-y-auto lg:p-10'
          : 'flex w-full flex-col overflow-y-auto p-9 md:w-[58%] md:p-10'}>
          {/* In page mode the form sits in its own card. `contents` in modal
              mode makes this wrapper invisible to layout, so the modal keeps
              exactly the shape it had. */}
          <div className={page
            ? 'w-full max-w-[560px] rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur-xl sm:p-9 lg:p-11'
            : 'contents'}>
          <div className="mb-5 flex flex-col items-center text-center">
            {/* Both sides carry an illustration rather than a glyph: the
                artwork fills the tile instead of floating at icon size inside
                it, and the mint ground stays behind the transparent corners.
                The doctor art is a bust, so it sits on the bottom edge; the
                patient art is a whole bed, so it stays centred. */}
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-[#d9f2e6] text-[#0f766e]">
              <img
                src={role === 'patient' ? '/patient-avatar.png' : '/doctor-avatar.png'}
                alt=""
                aria-hidden="true"
                className={`h-full w-full object-contain select-none ${role === 'patient' ? 'scale-[0.94]' : 'scale-[1.06] object-bottom'}`}
              />
            </span>
            <h2 className="mt-4 text-[1.75rem] font-extrabold tracking-tight text-brand-navy sm:mt-5 sm:text-[2.35rem] lg:text-[2.75rem]">
              {role === 'patient' ? t('auth.title') : t(mode === 'signup' ? 'ax.doctor.signupTitle' : 'ax.doctor.loginTitle')}
            </h2>
            <p className="mt-3 max-w-md text-[15.5px] text-slate-500">
              {role === 'patient' ? t('auth.subtitle') : t(mode === 'signup' ? 'ax.doctor.signupSubtitle' : 'ax.doctor.loginSubtitle')}
            </p>
          </div>

          {role === 'patient' ? (
            <PatientVoiceAuth onClose={onClose} replaceOnDone={!!page} />
          ) : (
          <>
          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            {mode === 'signup' ? (
              <>
                <TabBtn value="signup">{t('ax.modal.signupTab')}</TabBtn>
                <TabBtn value="login">{t('auth.loginTab')}</TabBtn>
              </>
            ) : (
              <>
                <TabBtn value="login">{t('auth.loginTab')}</TabBtn>
                <TabBtn value="signup">{t('ax.modal.signupTab')}</TabBtn>
              </>
            )}
          </div>

          {banner && (
            <div className="mb-3">
              <Banner type={banner.type}>{banner.msg}</Banner>
            </div>
          )}

          {/* PASSWORD RESET */}
          {mode === 'login' && forgot && (
            <ForgotPasswordFlow portal="doctor" onBack={() => { setForgot(false); setBanner(null) }} />
          )}

          {/* LOGIN */}
          {mode === 'login' && !forgot && (
            <form onSubmit={handleLogin} className="space-y-3">
              <TextInput
                icon={Mail}
                placeholder={t('ax.modal.emailPh')}
                value={form.idf || ''}
                onChange={set('idf')}
                error={errors.idf}
              />
              <PasswordInput
                icon={Lock}
                placeholder={t('ax.modal.passwordPh')}
                value={form.password || ''}
                onChange={set('password')}
                error={errors.password}
              />
              <button className="w-full rounded-xl bg-brand-blue py-4 text-[15.5px] font-semibold text-white transition-colors hover:bg-brand-blueDark">
                {t('auth.loginCta')}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setForgot(true); setBanner(null); setErrors({}) }}
                  className="text-[13px] font-medium text-brand-blue hover:underline"
                >
                  {t('ax.modal.forgot')}
                </button>
              </div>
            </form>
          )}

          {/* SIGNUP → doctors register on a dedicated page (needs document uploads
              + manual verification), so route out of the modal. */}
          {mode === 'signup' && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-brand-blueLight bg-brand-blueLight/40 p-4">
                <p className="text-sm font-semibold text-brand-navy">{t('ax.modal.registerPractice')}</p>
                <p className="mt-1 text-[13px] text-slate-500">
                  {t('ax.modal.registerPracticeHelp')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { onClose(); navigate('/doctor-signup') }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue py-4 text-[15.5px] font-semibold text-white transition-colors hover:bg-brand-blueDark"
              >
                <Stethoscope className="h-4 w-4" /> {t('ax.modal.continueDoctorReg')}
              </button>
              <p className="text-center text-[13px] text-slate-500">
                {t('ax.modal.alreadyRegistered')}{' '}
                <button type="button" onClick={() => setMode('login')} className="font-semibold text-brand-blue hover:underline">
                  {t('auth.loginTab')}
                </button>
              </p>
            </div>
          )}
          </>
          )}
          </div>
        </div>
      </div>
    </div>
  )

  return page ? content : createPortal(content, document.body)
}

export default AuthModal
