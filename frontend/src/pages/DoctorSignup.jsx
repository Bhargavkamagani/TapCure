import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, Upload, Lock } from 'lucide-react'
import { validateRegistrationNumber, MAX_REG_NO, REG_NO_PLACEHOLDER } from '../components/doctor/onboardingValidation.js'
import AddressAutocomplete from '../components/common/AddressAutocomplete.jsx'
import ConsentCheck from '../components/legal/ConsentCheck.jsx'
import Wordmark from '../components/common/Wordmark.jsx'
import { MODERN_FONT } from '../components/landing/ModernChrome.jsx'
import { authApi } from '../api'
import { geocodeAddress } from '../lib/geo.js'
import { SPECIALIZATIONS, QUALIFICATION_GROUPS, DOCTOR_LANGUAGES } from '../data/authData.js'

const STEPS = [
  { n: 1, title: 'About You', sub: 'Tell patients who you are and where they can see you.' },
  { n: 2, title: 'Your Account', sub: 'Your registration number and how you will sign in.' },
  { n: 3, title: 'Verification Documents', sub: 'Our team checks these by hand. Patients never see them.' },
  { n: 4, title: 'Submitted', sub: 'Pending verification by our team' },
]

/** Step 4 is a confirmation the user lands on AFTER submitting — it has no
 *  fields and can't be navigated to. Everything that decides "is this the last
 *  page the user fills in" keys off this, not STEPS.length, or the Submit
 *  button on step 3 would turn back into "Continue". */
const LAST_INPUT_STEP = 3

// Mirrors POST /auth/register-doctor: users.email is String(100).
const MAX_EMAIL = 100
import { emailTypoError } from '../lib/emailTypos.js'
import { joinName } from '../lib/personName.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Error text for a non-empty email, or null when it looks valid. */
const emailError = (value) => {
  const email = value.toString().trim()
  if (email.length > MAX_EMAIL) return `Max ${MAX_EMAIL} characters`
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address'
  // See emailTypos.js: a misspelt provider is a valid address, and doctor
  // sign-in has no OTP fallback, so the account would be unreachable.
  const typo = emailTypoError(email)
  if (typo) return typo
  return null
}

const STEP_FIELDS = {
  1: ['firstName', 'lastName', 'specialization', 'hospitalName', 'consultationFee', 'address'],
  2: ['regNo', 'email', 'mobile', 'password', 'confirm'],
  3: ['regCert', 'degreeCert', 'terms'],
  4: [],
}

/**
 * Which step a field lives on — so an error can send the doctor to the screen
 * that actually shows it.
 */
const STEP_OF_FIELD = Object.entries(STEP_FIELDS).reduce((map, [n, keys]) => {
  keys.forEach((key) => { map[key] = Number(n) })
  return map
}, {})

/**
 * Server-side rejections arrive as a sentence, not a field name. Without this
 * the doctor got "Enter a valid 10-digit mobile number" as a banner on step 3,
 * with the mobile field two screens behind them and nothing marked — the error
 * was readable but not actionable.
 *
 * Matched against the exact messages `POST /auth/register-doctor` raises. Order
 * matters: the first match wins, so keep the specific ones first.
 */
const SERVER_ERROR_FIELDS = [
  [/10-digit mobile|phone already registered/i, 'mobile'],
  [/email already registered|valid email|email is too long/i, 'email'],
  [/password must be at least/i, 'password'],
  [/registration number/i, 'regNo'],
  [/consultation fee/i, 'consultationFee'],
  [/hospital name/i, 'hospitalName'],
  [/hospital location|invalid latitude|invalid longitude|address/i, 'address'],
  [/terms & conditions|privacy policy|refund policy/i, 'terms'],
]

/** Field key a server message refers to, or null when it's not field-specific. */
function fieldForServerError(message) {
  const text = String(message || '')
  return SERVER_ERROR_FIELDS.find(([re]) => re.test(text))?.[1] || null
}

/* ───────────────────────── look (2026-11-07) ─────────────────────────
 * Same split screen as Hospital Signup: the form on the left, and on the right
 * the doctor's TapCure prescription pad, which writes itself as they type
 * (prescriptions on TapCure carry the name, qualification and Reg. No — see
 * RxPaper.jsx). On desktop the page is laid out on an 810px-tall canvas and
 * zoomed to the window, so it fits one screen, with no scroll, on every machine.
 * Errors sit on the label line so they never make a step taller.
 */

const CANVAS_H = 810
const PANEL_W = 860
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

// The common qualifications are tap buttons; the full catalogue sits behind "+ More".
const COMMON_QUALS = ['MBBS', 'MD', 'MS', 'DNB', 'BDS', 'MDS', 'BAMS', 'BHMS', 'BPT', 'DM', 'MCh']
const splitList = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean)

// Written out in full (not built from variables) so Tailwind can see every class.
const inputCls = (bad) => `w-full rounded-xl border-[1.5px] bg-transparent px-4 py-[13px] text-[17px] font-medium text-[#0B2150] outline-none transition-colors placeholder:font-normal placeholder:text-[#6B7A8F] focus:border-[#0A9A96] ${bad ? 'border-[#C2410C]' : 'border-[#0B2150]/[.12]'}`
const CHEVRON = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7A8F' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }

/** Label with the error (or a quiet note) on the same line, so errors add no height. */
function Label({ htmlFor, text, optional, error, note }) {
  const Tag = htmlFor ? 'label' : 'span'
  return (
    <Tag htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2.5 text-[16px] font-semibold text-[#41526E]">
      <span>{text}{optional && <span className="font-medium text-[#6B7A8F]"> (Optional)</span>}</span>
      {error
        ? <span role="alert" title={error} data-field-error className="min-w-0 truncate text-[14px] font-medium text-[#C2410C]">{error}</span>
        : note ? <span className="min-w-0 truncate text-[14px] font-medium text-[#6B7A8F]">{note}</span> : null}
    </Tag>
  )
}

function Field({ id, label, optional, error, note, prefix, ...input }) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id} text={label} optional={optional} error={error} note={note} />
      <div className="relative">
        {prefix && <b className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-[#6B7A8F]">{prefix}</b>}
        <input id={id} aria-invalid={!!error} {...input} className={`${inputCls(error)} ${prefix ? 'pl-[54px]' : ''}`} />
      </div>
    </div>
  )
}

function PasswordField({ id, label, error, ...input }) {
  const [show, setShow] = useState(false)
  return (
    <div className="min-w-0">
      <Label htmlFor={id} text={label} error={error} />
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} aria-invalid={!!error} {...input} className={`${inputCls(error)} pr-11`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6B7A8F] hover:text-[#0A9A96]">
          {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  )
}

function Chip({ on, children, onClick }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`rounded-full border-[1.5px] px-2.5 py-[7px] text-[15px] font-semibold transition-colors ${on
        ? 'border-[#0A9A96] bg-[#0A9A96] text-white'
        : 'border-[#0B2150]/[.12] text-[#41526E] hover:border-[#0A9A96] hover:text-[#0A9A96]'}`}>
      {children}
    </button>
  )
}

/** One upload row — accepts a PDF/image, shows the chosen filename. */
function FileRow({ label, optional, hint, file, onPick, error, accept = '.pdf,image/*' }) {
  const ref = useRef(null)
  return (
    <div className="border-b border-[#0B2150]/10">
      <button type="button" onClick={() => ref.current?.click()}
        className="grid w-full grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-3.5 py-4 text-left">
        <span className={`grid h-[46px] w-[46px] place-items-center rounded-full ${file ? 'bg-[#0A9A96] text-white' : 'bg-[#0A9A96]/[.09] text-[#0A9A96]'}`}>
          {file ? <Check className="h-5 w-5" /> : <Upload className="h-5 w-5" />}
        </span>
        <span className="min-w-0">
          <b className="block text-[17px] text-[#0B2150]">{label}{optional && <span className="font-medium text-[#6B7A8F]"> (Optional)</span>}</b>
          <small {...(error ? { 'data-field-error': true, role: 'alert' } : {})} className={`block truncate text-[15px] ${error ? 'text-[#C2410C]' : 'text-[#6B7A8F]'}`}>
            {error || (file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : hint)}
          </small>
        </span>
        <span className="text-[15.5px] font-semibold text-[#0A9A96]">{file ? 'Change' : 'Upload'}</span>
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
    </div>
  )
}

/** The doctor's TapCure prescription pad — writes itself as the form fills. */
function PrescriptionPad({ form, files, step, scale }) {
  const name = joinName(form.firstName, form.lastName)
  const quals = splitList(form.qualification).join(', ')
  const langs = splitList(form.languages).join(', ')
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const stamp = step === 4 ? 'ok' : (files.regCert && files.degreeCert ? 'pend' : null)
  // A line "writes itself" once, when it first gets a value.
  const ink = (v) => (v ? 'tc-ink' : '')
  const ghost = (text) => <span className="font-normal text-[#9AA6B8]">{text}</span>
  const serif = { fontFamily: '"Instrument Serif", Georgia, serif' }
  const one = 'truncate'

  return (
    <div style={{ width: PAD_W, height: PAD_H, transform: `scale(${scale})`, transformOrigin: 'top center', marginBottom: (scale - 1) * PAD_H }}
      className="relative mx-auto mt-3.5">
      <div aria-hidden="true" className="absolute inset-[10px_-10px_-10px_10px] rotate-[2.2deg] rounded-md bg-[#F4EFE3] shadow-[0_20px_40px_-24px_rgba(11,33,80,.4)]" />
      <div className="relative flex h-full -rotate-[1.2deg] flex-col overflow-hidden rounded-md bg-[#FFFDF7] px-[30px] pb-[18px] pt-7 text-[#1C2B4A] shadow-[0_44px_80px_-40px_rgba(11,33,80,.55),0_0_0_1px_rgba(11,33,80,.06)]">
        <span aria-hidden="true" style={serif} className="pointer-events-none absolute -right-[30px] bottom-[70px] -rotate-[14deg] text-[190px] font-bold leading-none text-[#0A9A96]/5">℞</span>

        {/* letterhead */}
        <div className="relative grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-[18px] border-b-2 border-[#0A9A96] pb-3.5 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:bg-[#0A9A96]/50">
          <div className="min-w-0">
            <p style={serif} className={`text-[27px] leading-[1.1] text-[#0B2150] ${ink(name)}`}>{name ? `Dr. ${name}` : <span className="text-[#B4BDCB]">Dr. Your Name</span>}</p>
            <p className={`mt-1 text-[13px] font-semibold text-[#0A9A96] ${one} ${ink(quals)}`}>{quals || ghost('Qualification')}</p>
            <p className={`mt-0.5 text-[12.5px] text-[#41526E] ${one} ${ink(form.specialization)}`}>
              {form.specialization || ghost('Specialization')}{form.experience ? ` · ${form.experience} years` : ''}
            </p>
            <p className={`mt-0.5 text-[12.5px] text-[#41526E] ${one} ${ink(form.regNo)}`}>{form.regNo ? `Reg. No: ${form.regNo}` : ghost('Reg. No: —')}</p>
          </div>
          <div className="min-w-0 text-right text-[12.5px] leading-normal text-[#41526E]">
            <b className={`block text-[14px] text-[#0B2150] line-clamp-2 ${ink(form.hospitalName)}`}>{form.hospitalName || ghost('Your Hospital')}</b>
            <span className={`block line-clamp-2 ${ink(form.address)}`}>{form.address || ghost('Area, City')}</span>
            <span className={`block line-clamp-2 ${ink(langs)}`}>{langs ? `Speaks ${langs}` : ghost('Languages')}</span>
          </div>
        </div>

        <div className="mt-[18px] grid grid-cols-[1.5fr_1fr_1fr] gap-3.5 text-[12px] text-[#6B7A8F]">
          <span className="truncate border-b border-dotted border-[#0B2150]/30 pb-[3px]">Patient: {ghost('Ramesh K.')}</span>
          <span className="truncate border-b border-dotted border-[#0B2150]/30 pb-[3px]">Age: {ghost('42 / M')}</span>
          <span className="truncate border-b border-dotted border-[#0B2150]/30 pb-[3px]">{today}</span>
        </div>
        <p aria-hidden="true" style={serif} className="mt-4 text-[46px] leading-none text-[#0A9A96]">℞</p>
        <div aria-hidden="true" className="mb-1.5 ml-[46px] mt-1 flex-1 bg-[repeating-linear-gradient(180deg,transparent_0_31px,rgba(10,154,150,.13)_31px_32px)]" />

        <div className="mt-2 flex items-end justify-between gap-4">
          <span className={`text-[12.5px] text-[#41526E] ${ink(form.consultationFee)}`}>{form.consultationFee ? `Consultation ₹${form.consultationFee}` : ghost('Consultation ₹ —')}</span>
          <span className="min-w-[150px] text-center text-[12px] text-[#6B7A8F]">
            <i style={serif} className={`mb-[3px] block min-h-[28px] border-b border-[#0B2150]/30 pb-0.5 text-[20px] text-[#2F58B7] ${ink(name)}`}>
              {name ? `Dr. ${form.lastName || form.firstName}` : ''}
            </i>
            Signature
          </span>
        </div>
        <div className="mt-3 flex justify-between border-t border-[#0B2150]/10 pt-2 text-[11px] text-[#6B7A8F]">
          <span>Token booked on TapCure</span><span>tapcure.in</span>
        </div>

        {stamp && (
          <div key={stamp} role="img" aria-label={stamp === 'ok' ? 'Submitted' : 'Verification pending'}
            className={`tc-stamp absolute right-[34px] top-[44%] rounded-[10px] border-[3px] border-current px-3.5 py-2 text-center text-[17px] font-bold leading-[1.2] opacity-[.85] mix-blend-multiply ${stamp === 'ok' ? 'text-[#15803D]' : 'text-[#C2410C]'}`}>
            {stamp === 'ok' ? <>Submitted ✓<small className="block text-[11px] font-semibold">with TapCure for review</small></>
              : <>Verification<br />Pending<small className="block text-[11px] font-semibold">by TapCure team</small></>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DoctorSignup() {
  const navigate = useNavigate()
  const fit = useCanvasFit()
  const [form, setForm] = useState({})
  const [files, setFiles] = useState({ regCert: null, degreeCert: null, councilCert: null, idProof: null })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [step, setStep] = useState(1)
  const [step3Attempted, setStep3Attempted] = useState(false)
  const registrationTopRef = useRef(null)

  useEffect(() => { document.title = 'Join as a Doctor · TapCure' }, [])

  // Opening the documents step is not a validation attempt. Always start it
  // clean; errors are created only by pressing "Submit for Verification".
  useEffect(() => {
    if (step !== 3) return
    setStep3Attempted(false)
    setErrors((current) => {
      const clean = { ...current }
      STEP_FIELDS[3].forEach((key) => delete clean[key])
      return clean
    })
  }, [step])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // First / last name boxes keep fullName (used for the thank-you line) in step.
  const setNamePart = (k) => (e) => setForm((f) => { const n = { ...f, [k]: e.target.value }; return { ...n, fullName: joinName(n.firstName, n.lastName) } })
  /** Money and year fields: strip everything that isn't a digit as it's typed. */
  const digitsOnly = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, '') }))
  const pick = (k) => (file) => {
    setFiles((prev) => ({ ...prev, [k]: file }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }
  /** Multi-pick (qualifications, languages): stored comma-joined, as the API expects. */
  const toggleIn = (k, item) => setForm((f) => {
    const list = splitList(f[k])
    return { ...f, [k]: (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]).join(', ') }
  })

  const showStep = (nextStep) => {
    setStep(nextStep)
    setTimeout(() => registrationTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  /**
   * Put the doctor on the first thing that's actually wrong. Runs after the
   * step has painted, so the field exists in the DOM.
   */
  const focusFirstError = () => {
    setTimeout(() => {
      const marker = registrationTopRef.current?.querySelector('[data-field-error]')
      if (!marker) return
      const field = marker.closest('div')
      ;(field || marker).scrollIntoView({ behavior: 'smooth', block: 'center' })
      field?.querySelector('input, select, textarea')?.focus({ preventScroll: true })
    }, 120)
  }

  const validateStep = (targetStep) => {
    const err = {}
    const requiredByStep = {
      // Address is required: it's the only thing that puts this doctor on the
      // patient's map. Without it they'd be verified, live, and unfindable.
      1: ['firstName', 'lastName', 'specialization', 'hospitalName', 'consultationFee', 'address'],
      2: ['regNo', 'email', 'mobile', 'password', 'confirm'],
    }

    ;(requiredByStep[targetStep] || []).forEach((key) => {
      if (!form[key]?.toString().trim()) err[key] = 'Required'
    })
    if (targetStep === 1 && Number(form.consultationFee) <= 0) {
      err.consultationFee = 'Enter a valid consultation fee'
    }
    // Shape-check the registration number here too, not just on submit — a
    // doctor who types junk should be told at the step, not three screens later.
    if (targetStep === 2 && form.regNo?.toString().trim()) {
      const regErr = validateRegistrationNumber(form.regNo)
      if (regErr) err.regNo = regErr
    }
    if (targetStep === 2 && form.email?.toString().trim()) {
      const mailErr = emailError(form.email)
      if (mailErr) err.email = mailErr
    }
    if (targetStep === 2 && form.mobile && !/^\d{10}$/.test(form.mobile)) {
      err.mobile = 'Enter a valid 10-digit number'
    }
    if (targetStep === 2 && form.password && form.password.length < 8) {
      err.password = 'Min 8 characters'
    }
    if (targetStep === 2 && form.confirm && form.password && form.confirm !== form.password) {
      err.confirm = 'Passwords do not match'
    }
    if (targetStep === 3 && !files.regCert) err.regCert = 'Upload your registration certificate'
    if (targetStep === 3 && !files.degreeCert) err.degreeCert = 'Upload your degree certificate'
    if (targetStep === 3 && !agreed) err.terms = 'Please accept the Terms, Privacy and Refund policies.'

    setErrors((current) => {
      const next = { ...current }
      STEP_FIELDS[targetStep].forEach((key) => delete next[key])
      return { ...next, ...err }
    })
    return Object.keys(err).length === 0
  }

  const nextStep = () => {
    if (!validateStep(step)) {
      // Same treatment when "Next" is blocked: land on the offending field
      // rather than just refusing to advance.
      focusFirstError()
      return
    }
    setSubmitError(null)
    const next = Math.min(step + 1, LAST_INPUT_STEP)
    if (next === 3) {
      setStep3Attempted(false)
      setErrors((current) => {
        const clean = { ...current }
        STEP_FIELDS[3].forEach((key) => delete clean[key])
        return clean
      })
    }
    showStep(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step < LAST_INPUT_STEP) {
      nextStep()
      return
    }
    setStep3Attempted(true)
    const err = {}
    const required = ['firstName', 'lastName', 'specialization', 'hospitalName', 'consultationFee', 'address', 'regNo', 'email', 'mobile', 'password', 'confirm']
    required.forEach((k) => { if (!form[k]?.toString().trim()) err[k] = 'Required' })
    if (Number(form.consultationFee) <= 0) err.consultationFee = 'Enter a valid consultation fee'
    if (form.regNo?.toString().trim()) {
      const regErr = validateRegistrationNumber(form.regNo)
      if (regErr) err.regNo = regErr
    }
    if (form.email?.toString().trim()) {
      const mailErr = emailError(form.email)
      if (mailErr) err.email = mailErr
    }
    if (form.mobile && !/^\d{10}$/.test(form.mobile)) err.mobile = 'Enter a valid 10-digit number'
    if (form.password && form.password.length < 8) err.password = 'Min 8 characters'
    if (form.confirm && form.password && form.confirm !== form.password) err.confirm = 'Passwords do not match'
    if (!files.regCert) err.regCert = 'Upload your registration certificate'
    if (!files.degreeCert) err.degreeCert = 'Upload your degree certificate'
    if (!agreed) err.terms = 'Please accept the Terms, Privacy and Refund policies.'
    setErrors(err)
    if (Object.keys(err).length) {
      const firstInvalidStep = STEPS.find(({ n }) => STEP_FIELDS[n].some((key) => err[key]))?.n || 1
      showStep(firstInvalidStep)
      focusFirstError()
      return
    }

    setBusy(true)
    setSubmitError(null)
    try {
      // Coordinates from the picked Google suggestion are the most accurate.
      // Only geocode when the doctor typed the address without picking one —
      // and stop if even that can't place them, rather than registering a
      // doctor no patient can find.
      let coords = form.latitude != null && form.longitude != null
        ? { lat: Number(form.latitude), lng: Number(form.longitude) }
        : await geocodeAddress({ address: form.address, city: form.city })
      if (!coords) {
        setErrors({ address: 'Could not locate this address — please pick it from the suggestions.' })
        showStep(1)
        focusFirstError()
        setBusy(false)
        return
      }

      const fd = new FormData()
      fd.append('name', form.fullName)
      fd.append('first_name', (form.firstName || '').trim())
      fd.append('last_name', (form.lastName || '').trim())
      fd.append('email', form.email)
      fd.append('phone', form.mobile)
      fd.append('password', form.password)
      fd.append('registration_number', form.regNo)
      fd.append('specialization', form.specialization)
      fd.append('qualification', form.qualification || '')
      if (form.hprId?.trim()) fd.append('hpr_id', form.hprId.trim())
      fd.append('experience_years', String(parseInt(form.experience, 10) || 0))
      fd.append('consultation_fee', String(Number(form.consultationFee)))
      fd.append('hospital_name', form.hospitalName.trim())
      fd.append('city', form.city || '')
      fd.append('address', (form.address || '').trim())
      fd.append('latitude', String(coords.lat))
      fd.append('longitude', String(coords.lng))
      fd.append('languages', form.languages || '')
      fd.append('bio', form.bio || '')
      fd.append('terms_accepted', 'true')
      fd.append('registration_certificate', files.regCert)
      fd.append('degree_certificate', files.degreeCert)
      if (files.councilCert) fd.append('council_certificate', files.councilCert)
      if (files.idProof) fd.append('id_proof', files.idProof)

      await authApi.registerDoctor(fd)
      setStep(4)
      setTimeout(() => registrationTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    } catch (e2) {
      const message = e2.message || 'Registration failed. Please try again.'
      setSubmitError(message)
      // Send the doctor to the field the server actually complained about,
      // marked, instead of leaving them on the last step with a banner.
      const field = fieldForServerError(message)
      const targetStep = field ? STEP_OF_FIELD[field] : null
      if (field) setErrors((prev) => ({ ...prev, [field]: message }))
      if (targetStep && targetStep !== step) showStep(targetStep)
      else window.scrollTo({ top: 0, behavior: 'smooth' })
      if (field) focusFirstError()
    }
    setBusy(false)
  }

  // A server message that points at a field is already shown on that field;
  // only an unmatched one needs the line under the heading.
  const generalError = submitError && !fieldForServerError(submitError) ? submitError : null
  const quals = splitList(form.qualification)
  const extraQuals = quals.filter((q) => !COMMON_QUALS.includes(q))
  const langs = splitList(form.languages)
  const padScale = fit ? Math.max(0.6, Math.min((CANVAS_H - 140) / PAD_H, (fit.w - PANEL_W - 110) / PAD_W)) : 1
  const S = STEPS[step - 1]

  return (
    <div className={`tc-type min-h-screen bg-[#F3F8F8] text-[#0B2150] antialiased ${fit ? 'h-screen overflow-hidden' : ''}`} style={{ fontFamily: MODERN_FONT }}>
      <style>{'.tc-ink{animation:tcInk .55s ease-out}@keyframes tcInk{from{clip-path:inset(0 100% 0 0);opacity:.4}to{clip-path:inset(0 0 0 0);opacity:1}}.tc-stamp{transform:rotate(-12deg);animation:tcStamp .45s cubic-bezier(.2,1.6,.4,1)}@keyframes tcStamp{from{transform:rotate(-12deg) scale(2.2);opacity:0}to{transform:rotate(-12deg) scale(1);opacity:.85}}@media (prefers-reduced-motion:reduce){.tc-ink,.tc-stamp{animation:none}}'}</style>
      <div
        className="grid min-h-screen grid-cols-1 min-[901px]:min-h-0"
        style={fit ? { zoom: fit.z, width: fit.w, height: CANVAS_H, gridTemplateColumns: `${PANEL_W}px 1fr` } : undefined}
      >
        {/* ── left: the form ── */}
        <section className="flex min-h-screen flex-col bg-white px-5 pb-7 pt-5 sm:px-10 min-[901px]:h-full min-[901px]:min-h-0 min-[901px]:overflow-y-auto min-[901px]:px-[72px] min-[901px]:py-[22px]">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2" aria-label="TapCure">
              <img src="/tapcure-icon.png" alt="" className="h-8 w-8" />
              <Wordmark className="text-[22px]" />
            </Link>
            <span className="flex gap-5 text-[16px] text-[#6B7A8F]">
              <Link to="/" className="inline-flex items-center gap-1 hover:text-[#0A9A96]"><ArrowLeft className="h-4 w-4" /> Home</Link>
              <Link to="/doctor-login" className="font-semibold text-[#0A9A96] hover:underline">Doctor Login</Link>
            </span>
          </div>
          <div className="min-h-[10px] flex-[1]" aria-hidden="true" />

          <form ref={registrationTopRef} onSubmit={(e) => e.preventDefault()} noValidate className="scroll-mt-4">
            {step <= LAST_INPUT_STEP ? (
              <>
                <p className="text-[16px] font-semibold text-[#0A9A96]">Step {step} Of {LAST_INPUT_STEP}</p>
                <div className="mt-2 flex gap-1.5">
                  {[1, 2, 3].map((n) => <i key={n} className={`h-[5px] flex-1 rounded transition-colors ${n <= step ? 'bg-[#0A9A96]' : 'bg-[#0B2150]/[.12]'}`} />)}
                </div>
                <h1 className="mt-3.5 text-[32px] font-bold tracking-[-0.015em]">{S.title}</h1>
                <p className="mt-1 text-[17px] text-[#41526E]">{S.sub}</p>
                {generalError && <p role="alert" className="mt-2 text-[15px] font-medium text-[#C2410C]">{generalError}</p>}

                <div className="mt-[18px] grid gap-3">
                  {step === 1 && (
                    <>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field id="ds-first" label="First Name" placeholder="First name" autoComplete="given-name" value={form.firstName || ''} onChange={setNamePart('firstName')} error={errors.firstName} />
                        <Field id="ds-last" label="Last Name" placeholder="Surname or initial" autoComplete="family-name" value={form.lastName || ''} onChange={setNamePart('lastName')} error={errors.lastName} />
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="min-w-0">
                          <Label htmlFor="ds-spec" text="Specialization" error={errors.specialization} />
                          <select id="ds-spec" value={form.specialization || ''} onChange={set('specialization')} aria-invalid={!!errors.specialization}
                            style={CHEVRON} className={`${inputCls(errors.specialization)} appearance-none pr-10`}>
                            <option value="">Choose one</option>
                            {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <Field id="ds-hosp" label="Hospital Or Clinic" placeholder="Where you see patients" value={form.hospitalName || ''} onChange={set('hospitalName')} error={errors.hospitalName} />
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        {/* Deliberately NOT type="number": that control turned ₹500 into
                            ₹489 on a stray scroll and accepts `e`, `+` and `-`. Digits only. */}
                        <Field id="ds-exp" label="Experience" optional placeholder="Years" inputMode="numeric" maxLength={2} value={form.experience || ''} onChange={digitsOnly('experience')} />
                        <Field id="ds-fee" label="Consultation Fee" prefix="₹" placeholder="500" inputMode="numeric" maxLength={6} value={form.consultationFee || ''} onChange={digitsOnly('consultationFee')} error={errors.consultationFee} />
                      </div>
                      {/* Hospital location — the pin patients search, sort and travel by.
                          Picking a Google suggestion carries its coordinates; typing a
                          full address still works (geocoded on submit). */}
                      <div className="min-w-0">
                        <Label text="Hospital Location" error={errors.address}
                          note={form.latitude != null ? '📍 Location pinned' : 'Pick a suggestion'} />
                        <AddressAutocomplete
                          value={form.address || ''}
                          onChange={(val) => setForm((f) => ({ ...f, address: val, latitude: null, longitude: null }))}
                          onSelect={(p) => setForm((f) => ({
                            ...f,
                            address: p.label || f.address,
                            city: p.city || f.city,
                            latitude: p.lat ?? null,
                            longitude: p.lng ?? null,
                          }))}
                          placeholder="Search your hospital location…"
                          className={`${inputCls(errors.address)} pr-10`}
                        />
                      </div>
                      <div>
                        {/* "+ More" sits on the label line, so the full catalogue costs no height. */}
                        <div className="mb-1.5 flex items-baseline justify-between gap-2.5 text-[16px] font-semibold text-[#41526E]">
                          <span>Qualification <span className="font-medium text-[#6B7A8F]">(Tap all that apply)</span></span>
                          <select aria-label="More qualifications" value="" onChange={(e) => e.target.value && toggleIn('qualification', e.target.value)}
                            className="w-[190px] cursor-pointer appearance-none bg-transparent text-right text-[15px] font-semibold text-[#0A9A96] outline-none hover:underline">
                            <option value="">+ More Qualifications</option>
                            {QUALIFICATION_GROUPS.map((g) => (
                              <optgroup key={g.label} label={g.label}>
                                {g.items.filter((q) => !COMMON_QUALS.includes(q)).map((q) => <option key={q} value={q} disabled={quals.includes(q)}>{q}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-[7px]">
                          {COMMON_QUALS.map((q) => <Chip key={q} on={quals.includes(q)} onClick={() => toggleIn('qualification', q)}>{q}</Chip>)}
                          {extraQuals.map((q) => <Chip key={q} on onClick={() => toggleIn('qualification', q)}>{q} ✕</Chip>)}
                        </div>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field id="ds-reg" label="Registration Number" placeholder={REG_NO_PLACEHOLDER} maxLength={MAX_REG_NO} value={form.regNo || ''} onChange={set('regNo')} error={errors.regNo} />
                        <Field id="ds-hpr" label="HPR ID" optional placeholder="ABDM registry ID" value={form.hprId || ''} onChange={set('hprId')} />
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field id="ds-email" label="Email Address" type="email" placeholder="you@example.com" maxLength={MAX_EMAIL} autoComplete="email" value={form.email || ''} onChange={set('email')} error={errors.email} />
                        <Field id="ds-mobile" label="Mobile Number" prefix="+91" placeholder="WhatsApp number" inputMode="numeric" maxLength={10} autoComplete="tel-national" value={form.mobile || ''} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} error={errors.mobile} />
                      </div>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <PasswordField id="ds-pass" label="Create Password" placeholder="At least 8 characters" autoComplete="new-password" value={form.password || ''} onChange={set('password')} error={errors.password} />
                        <PasswordField id="ds-confirm" label="Confirm Password" name="confirm_password" placeholder="Type it again" autoComplete="new-password" value={form.confirm || ''} onChange={set('confirm')} onPaste={(e) => e.preventDefault()} error={errors.confirm} />
                      </div>
                      <div>
                        <Label text={<>Languages You Speak <span className="font-medium text-[#6B7A8F]">(Tap all that apply)</span></>} />
                        <div className="flex flex-wrap gap-[7px]">
                          {DOCTOR_LANGUAGES.map((l) => <Chip key={l} on={langs.includes(l)} onClick={() => toggleIn('languages', l)}>{l}</Chip>)}
                        </div>
                      </div>
                      <p className="text-[15px] text-[#6B7A8F]">We will email you once you are verified.</p>
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <div className="border-t border-[#0B2150]/10">
                        <FileRow label="Medical Registration Certificate" hint="PDF or photo of your council certificate" file={files.regCert} onPick={pick('regCert')} error={step3Attempted ? errors.regCert : undefined} />
                        <FileRow label="Degree Certificate" hint="MBBS, BDS or your primary degree" file={files.degreeCert} onPick={pick('degreeCert')} error={step3Attempted ? errors.degreeCert : undefined} />
                        <FileRow label="Medical Council ID" optional hint="State or national council ID" file={files.councilCert} onPick={pick('councilCert')} />
                        <FileRow label="ID Proof" optional hint="Aadhaar, PAN or passport" file={files.idProof} onPick={pick('idProof')} />
                      </div>
                      <div className="[&_input]:h-[18px] [&_input]:w-[18px] [&_span]:text-[16px]">
                        <ConsentCheck
                          checked={agreed}
                          onChange={(v) => { setAgreed(v); if (v) setErrors((er) => ({ ...er, terms: undefined })) }}
                          error={step3Attempted ? errors.terms : undefined}
                        />
                      </div>
                      <p className="flex items-center gap-1.5 text-[15px] text-[#6B7A8F]"><Lock className="h-4 w-4" /> Your documents are stored securely and used only for verification.</p>
                    </>
                  )}
                </div>

                <div className="mt-[22px] flex gap-3">
                  {step > 1 && (
                    <button type="button" onClick={() => showStep(step - 1)}
                      className="rounded-full border-[1.5px] border-[#0B2150]/[.12] px-[26px] py-[15px] text-[17px] font-semibold text-[#41526E] hover:border-[#0A9A96] hover:text-[#0A9A96]">
                      Back
                    </button>
                  )}
                  <button type="button" onClick={step < LAST_INPUT_STEP ? nextStep : handleSubmit} disabled={busy}
                    className="flex-1 rounded-full bg-[#0A9A96] py-4 text-[18px] font-semibold text-white transition-colors hover:bg-[#088582] disabled:opacity-60">
                    {step < LAST_INPUT_STEP ? 'Continue' : busy ? 'Submitting…' : 'Submit For Verification'}
                  </button>
                </div>
              </>
            ) : (
              /* Step 4 — the confirmation replaces the form, so the outcome is unambiguous. */
              <div>
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[#0A9A96] text-white"><Check className="h-8 w-8" strokeWidth={2.6} /></span>
                <h1 className="mt-4 text-[32px] font-bold tracking-[-0.015em]">Thank You{form.lastName || form.firstName ? `, Dr. ${form.lastName || form.firstName}` : ''}</h1>
                <p className="mt-1 text-[17px] text-[#41526E]">We have your details and documents. Our team checks every doctor by hand, so your profile is not live just yet.</p>
                <ol className="mt-6 border-t border-[#0B2150]/10">
                  {[
                    { t: 'Documents Received', d: 'Your certificates are with our verification team.', done: true },
                    { t: 'Manual Review', d: 'We check your registration with the medical council.' },
                    { t: 'Email Confirmation', d: `We will write to ${form.email || 'your registered email'} once you are approved. Then you can sign in.` },
                  ].map((row, i) => (
                    <li key={row.t} className="grid grid-cols-[28px_1fr] gap-3 border-b border-[#0B2150]/10 py-3.5">
                      <span className={`grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${row.done ? 'bg-[#0A9A96] text-white' : 'border-[1.5px] border-[#0B2150]/[.12] text-[#6B7A8F]'}`}>
                        {row.done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      <span><b className="block text-[17px]">{row.t}</b><small className="block text-[15px] text-[#6B7A8F]">{row.d}</small></span>
                    </li>
                  ))}
                </ol>
                <div className="mt-[22px] flex gap-3">
                  <button type="button" onClick={() => navigate('/')}
                    className="rounded-full border-[1.5px] border-[#0B2150]/[.12] px-[26px] py-[15px] text-[17px] font-semibold text-[#41526E] hover:border-[#0A9A96] hover:text-[#0A9A96]">
                    Back To Home
                  </button>
                  <button type="button" onClick={() => navigate('/doctor-login')}
                    className="flex-1 rounded-full bg-[#0A9A96] py-4 text-[18px] font-semibold text-white hover:bg-[#088582]">
                    Go To Doctor Login
                  </button>
                </div>
              </div>
            )}
          </form>
          <div className="min-h-[10px] flex-[1.4]" aria-hidden="true" />
        </section>

        {/* ── right: the prescription pad (desktop only) ── */}
        {fit && (
          <aside aria-label="Preview of your TapCure prescription pad"
            className="relative grid h-full place-items-center overflow-hidden px-8 py-5 [background:radial-gradient(60%_50%_at_70%_20%,rgba(0,201,197,.20),transparent_70%),radial-gradient(50%_45%_at_20%_90%,rgba(51,105,255,.14),transparent_70%),#F3F8F8]">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[140px] bg-gradient-to-r from-white to-transparent" />
            <div>
              <p className="text-center text-[14.5px] font-semibold text-[#0A9A96]">Your TapCure Prescription Pad</p>
              <p className="mt-1 text-center text-[14px] text-[#6B7A8F]">This is the prescription your patients will receive. It writes itself as you type.</p>
              <PrescriptionPad form={form} files={files} step={step} scale={padScale} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
