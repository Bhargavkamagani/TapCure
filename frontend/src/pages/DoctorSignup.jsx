import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stethoscope,
  User,
  Phone,
  Mail,
  Lock,
  Hash,
  BadgeCheck,
  FileText,
  Upload,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Briefcase,
} from 'lucide-react'
import { TextInput, PasswordInput, SelectInput, Banner } from '../components/common/FormControls.jsx'
import { validateRegistrationNumber, MAX_REG_NO, REG_NO_PLACEHOLDER } from '../components/doctor/onboardingValidation.js'
import QualificationPicker from '../components/common/QualificationPicker.jsx'
import AddressAutocomplete from '../components/common/AddressAutocomplete.jsx'
import LanguagePicker from '../components/common/LanguagePicker.jsx'
import ConsentCheck from '../components/legal/ConsentCheck.jsx'
import BackToHome from '../components/common/BackToHome.jsx'
import { authApi } from '../api'
import { geocodeAddress } from '../lib/geo.js'
import { SPECIALIZATIONS } from '../data/authData.js'

const STEPS = [
  { n: 1, title: 'About You', sub: 'Personal and professional details' },
  { n: 2, title: 'Credentials & Account', sub: 'Registration and login details' },
  { n: 3, title: 'Verification Documents', sub: 'Upload credentials for review' },
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

function SectionCard({ icon: Icon, title, children }) {
  return (
    <section className="flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blueLight text-brand-blue">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="text-[15px] font-bold text-brand-navy">{title}</h3>
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  )
}

/** Styled file picker — accepts a PDF/image, shows the chosen filename. */
function FileField({ label, required, hint, file, onPick, error, accept = '.pdf,image/*' }) {
  const ref = useRef(null)
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={`flex w-full items-center gap-2.5 rounded-xl border border-dashed bg-white px-3.5 py-3 text-left transition-colors hover:border-brand-blue ${
          error ? 'border-red-300' : file ? 'border-brand-green' : 'border-slate-300'
        }`}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${file ? 'bg-brand-greenLight text-brand-green' : 'bg-slate-100 text-slate-400'}`}>
          {file ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Upload className="h-4.5 w-4.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-brand-navy">
            {file ? file.name : 'Click to upload'}
          </span>
          <span className="block text-[11px] text-slate-400">{file ? `${Math.max(1, Math.round(file.size / 1024))} KB` : (hint || 'PDF or image')}</span>
        </span>
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] || null)}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function DoctorSignup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({})
  const [files, setFiles] = useState({ regCert: null, degreeCert: null, councilCert: null, idProof: null })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [step, setStep] = useState(1)
  const [step3Attempted, setStep3Attempted] = useState(false)
  const registrationTopRef = useRef(null)

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

  const showStep = (nextStep) => {
    setStep(nextStep)
    setTimeout(() => registrationTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  /**
   * Put the doctor on the first thing that's actually wrong. Jumping to the
   * right step isn't enough on its own — on a long step the offending field can
   * still be below the fold, which reads as "it just bounced me back here".
   *
   * Runs after the step has painted, so the field exists in the DOM.
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

  return (
    <div className="signup-lg theme-reception min-h-screen bg-[#f2ecdf]">
      <main className="mx-auto max-w-[1200px] px-6 py-8 lg:py-10">
        <BackToHome className="mb-5" />
        <div className="mb-6">
          <h1 className="text-[30px] font-extrabold text-brand-navy">
            Join <span className="text-brand-navy">Tap</span>
            <span className="bg-gradient-to-r from-brand-blue via-brand-teal to-brand-green bg-clip-text text-transparent">Cure</span> as a Doctor
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Register your independent practice. Upload your credentials — our team verifies them
            manually before your account goes live.
          </p>
        </div>

        <form ref={registrationTopRef} onSubmit={(e) => e.preventDefault()} noValidate className="scroll-mt-4">
          <div className="mb-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-card lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-blue">Step {step} of {STEPS.length}</p>
                <p className="mt-0.5 text-sm font-bold text-brand-navy">{STEPS[step - 1].title}</p>
                <p className="text-xs text-slate-400">{STEPS[step - 1].sub}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-bold text-white">{step}</span>
            </div>
            <div className="mt-3 flex gap-1.5">
              {STEPS.map((item) => (
                <span key={item.n} className={`h-1.5 flex-1 rounded-full ${item.n <= step ? 'bg-brand-blue' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>

          <div className="mb-5 hidden items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white px-6 py-4 shadow-card lg:flex">
            {STEPS.map((item, index) => (
              <div key={item.n} className="flex flex-1 items-center">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${item.n < step ? 'bg-brand-green' : item.n === step ? 'bg-brand-blue' : 'bg-slate-300'}`}>
                    {item.n < step ? <CheckCircle2 className="h-4 w-4" /> : item.n}
                  </span>
                  <div>
                    <p className={`text-[13px] font-bold ${item.n === step ? 'text-brand-blue' : item.n < step ? 'text-brand-green' : 'text-brand-navy'}`}>{item.title}</p>
                    <p className="text-[11px] text-slate-400">{item.sub}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && <span className={`mx-4 h-px flex-1 ${item.n < step ? 'bg-brand-green' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          {STEP_FIELDS[step].some((key) => Boolean(errors[key])) && (step !== 3 || step3Attempted) && (
            <div className="mb-4"><Banner type="error">Please fill all required fields and upload the required documents.</Banner></div>
          )}
          {submitError && <div className="mb-4"><Banner type="error">{submitError}</Banner></div>}

          <div className="mx-auto max-w-3xl">
            {/* 1. Personal + professional */}
            {step === 1 && (
            <SectionCard icon={User} title="About You">
              <div className="col-span-full grid grid-cols-2 gap-3"><TextInput label="First Name" required icon={User} placeholder="First name" value={form.firstName || ''} onChange={setNamePart('firstName')} error={errors.firstName} /><TextInput label="Last Name" required placeholder="Surname or initial" value={form.lastName || ''} onChange={setNamePart('lastName')} error={errors.lastName} /></div>
              <SelectInput label="Specialization" required icon={Stethoscope} value={form.specialization || ''} onChange={set('specialization')} error={errors.specialization}>
                <option value="">Select specialization</option>
                {SPECIALIZATIONS.map((s) => <option key={s}>{s}</option>)}
              </SelectInput>
              <QualificationPicker
                value={form.qualification || ''}
                onChange={(v) => setForm((f) => ({ ...f, qualification: v }))}
              />
              <TextInput label="Hospital Name" required icon={Stethoscope} placeholder="Enter your hospital name" value={form.hospitalName || ''} onChange={set('hospitalName')} error={errors.hospitalName} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Deliberately NOT type="number". Beyond the wheel-spinner
                    problem (which silently turned ₹500 into ₹489 for doctors who
                    scrolled on with the field focused), that control also accepts
                    `e`, `+` and `-`, and reports an empty string for anything it
                    considers invalid — so a typo arrived here as 0. Digits only,
                    filtered on the way in. */}
                <TextInput
                  label="Experience (yrs)"
                  icon={Briefcase}
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="0"
                  value={form.experience || ''}
                  onChange={digitsOnly('experience')}
                />
                <TextInput
                  label="Consultation Fee (₹)"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="500"
                  value={form.consultationFee || ''}
                  onChange={digitsOnly('consultationFee')}
                  error={errors.consultationFee}
                />
              </div>

              {/* Hospital location — the pin patients search, sort and travel by.
                  Typing shows Google Maps suggestions; picking one carries its
                  coordinates. Typing a full address without picking still works
                  (geocoded on submit), so the doctor is never stuck. */}
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Hospital Location<span className="text-red-500"> *</span>
                </label>
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
                  placeholder="Search your hospital location on Google Maps…"
                  className={`flex w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 pr-9 text-sm text-brand-navy outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 ${errors.address ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.address ? (
                  <p className="mt-1 text-[11.5px] font-medium text-red-500">{errors.address}</p>
                ) : (
                  <p className="mt-1 text-[11.5px] text-slate-400">
                    {form.latitude != null
                      ? '📍 Location pinned — patients can find you by distance.'
                      : 'Pick a suggestion so patients see you at the right place.'}
                  </p>
                )}
              </div>
              <LanguagePicker
                value={form.languages || ''}
                onChange={(v) => setForm((f) => ({ ...f, languages: v }))}
              />
            </SectionCard>
            )}

            {/* 2. Credentials + login */}
            {step === 2 && (
            <SectionCard icon={BadgeCheck} title="Credentials & Account">
              <TextInput label="Medical Council Registration No." required icon={Hash} placeholder={REG_NO_PLACEHOLDER} maxLength={MAX_REG_NO} value={form.regNo || ''} onChange={set('regNo')} error={errors.regNo} />
              <TextInput label="HPR ID (optional)" icon={Hash} placeholder="ABDM Healthcare Professionals Registry ID, if any" value={form.hprId || ''} onChange={set('hprId')} />
              <TextInput label="Email Address" required icon={Mail} placeholder="Enter email address" maxLength={MAX_EMAIL} autoComplete="email" value={form.email || ''} onChange={set('email')} error={errors.email} />
              <TextInput label="Mobile Number" required icon={Phone} prefix="+91" placeholder="WhatsApp mobile number" inputMode="numeric" maxLength={10} value={form.mobile || ''} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '') }))} error={errors.mobile} />
              <PasswordInput label="Password" required icon={Lock} placeholder="Create a strong password" value={form.password || ''} onChange={set('password')} error={errors.password} />
              <PasswordInput
                label="Confirm Password"
                required
                icon={Lock}
                name="confirm_password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={form.confirm || ''}
                onChange={set('confirm')}
                onPaste={(e) => e.preventDefault()}
                error={errors.confirm}
              />
            </SectionCard>
            )}

            {/* 3. Documents */}
            {step === 3 && (
            <SectionCard icon={FileText} title="Verification Documents">
              <p className="text-[12px] text-slate-500">
                Upload clear scans or photos. These are reviewed manually and are never shown to patients.
              </p>
              <FileField label="Medical Registration Certificate" required hint="Council registration certificate (PDF/image)" file={files.regCert} onPick={pick('regCert')} error={step3Attempted ? errors.regCert : undefined} />
              <FileField label="Degree Certificate (MBBS/BDS/etc.)" required hint="Your primary medical degree" file={files.degreeCert} onPick={pick('degreeCert')} error={step3Attempted ? errors.degreeCert : undefined} />
              <FileField label="Medical Council Proof (optional)" hint="State/national council ID, if available" file={files.councilCert} onPick={pick('councilCert')} />
              <FileField label="ID Proof (optional)" hint="Aadhaar / PAN / passport" file={files.idProof} onPick={pick('idProof')} />
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" /> Your documents are stored securely and used only for verification.
              </p>
            </SectionCard>
            )}
          </div>

          {step === 3 && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <ConsentCheck
              checked={agreed}
              onChange={(v) => { setAgreed(v); if (v) setErrors((er) => ({ ...er, terms: undefined })) }}
              error={step3Attempted ? errors.terms : undefined}
            />
          </div>
          )}

          {step <= LAST_INPUT_STEP && (
          <div className="mx-auto mt-6 flex max-w-3xl items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => showStep(step - 1)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:border-brand-blue hover:text-brand-blue"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : <span />}
            {step < LAST_INPUT_STEP ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-blue to-brand-teal px-8 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01]"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-green-600 px-10 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              <Stethoscope className="h-4 w-4" />
              {busy ? 'Submitting…' : 'Submit for Verification'}
            </button>
            )}
          </div>
          )}

          {/* Step 4 — the confirmation. Previously submitting left the doctor
              sitting on the documents step with a banner underneath, which read
              as if the form still needed attention. This replaces the form
              entirely so the outcome is unambiguous. */}
          {step === 4 && (
            <div className="mx-auto max-w-3xl">
              <section className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-card">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-greenLight text-brand-green">
                  <CheckCircle2 className="h-9 w-9" />
                </span>
                <h2 className="mt-4 text-[22px] font-extrabold text-brand-navy">
                  Submitted — pending verification
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-[14px] leading-relaxed text-slate-500">
                  Thanks{form.fullName ? `, Dr. ${form.fullName}` : ''}. We&apos;ve received your
                  registration and your documents. Our team reviews credentials manually, so your
                  account isn&apos;t live just yet.
                </p>

                <ol className="mx-auto mt-6 max-w-md space-y-3 text-left">
                  {[
                    { t: 'Documents received', d: 'Your registration and degree certificates are with our verification team.', done: true },
                    { t: 'Manual review', d: 'We check your credentials against the medical council register.' },
                    { t: 'Email confirmation', d: `We'll write to ${form.email || 'your registered email'} once approved — you can log in after that.` },
                  ].map((row, i) => (
                    <li key={row.t} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                        row.done ? 'bg-brand-green text-white' : 'bg-white text-slate-400 ring-1 ring-slate-200'
                      }`}>
                        {row.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </span>
                      <span className="leading-tight">
                        <span className="block text-[13.5px] font-bold text-brand-navy">{row.t}</span>
                        <span className="block text-[12.5px] text-slate-500">{row.d}</span>
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-teal px-6 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01]"
                  >
                    Back to Home <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/doctor-login')}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
                  >
                    Go to login
                  </button>
                </div>
              </section>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
