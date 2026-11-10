import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Building2,
  UsersRound,
  Clock,
  Stethoscope,
  User,
  Phone,
  Mail,
  Lock,
  MapPin,
  CheckCircle2,
  Plus,
  ArrowLeft,
  ArrowRight,
  Hash,
  ShieldCheck,
  BellRing,
  Home,
  ChevronDown,
  ImagePlus,
} from 'lucide-react'
import { TextInput, PasswordInput, SelectInput, Banner } from '../components/common/FormControls.jsx'
import AddressAutocomplete from '../components/common/AddressAutocomplete.jsx'
import { toMobile } from '../lib/phone.js'
import ConsentCheck from '../components/legal/ConsentCheck.jsx'
import { InsurancePicker } from '../components/common/Insurance.jsx'
import BackToHome from '../components/common/BackToHome.jsx'
import { authApi, discoveryApi } from '../api'
import { geocodeAddress } from '../lib/geo.js'
import { validateHospitalRegNo, MAX_REG_NO, REG_NO_PLACEHOLDER } from '../lib/regNumber.js'
import {
  CONSULT_TIMES,
  WORKING_DAYS,
  SERVICE_OPTIONS,
} from '../data/authData.js'

const STEPS = [
  { n: 1, title: 'Hospital Details', sub: 'Basic information about your hospital' },
  { n: 2, title: 'Owner & Timings', sub: 'Owner account and working hours' },
  { n: 3, title: 'Services', sub: 'Choose services you provide' },
]

const ICON_COLORS = {
  green: 'text-brand-green',
  sky: 'text-sky-500',
  pink: 'text-pink-500',
  blue: 'text-brand-blue',
  red: 'text-red-500',
  violet: 'text-violet-500',
}

// Mirrors HospitalRegister: users.email is String(100), password min 6.
const MAX_EMAIL = 100
const MIN_PASSWORD = 6
import { emailTypoError } from '../lib/emailTypos.js'
import { joinName } from '../lib/personName.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Error text for a non-empty email, or null when it looks valid. */
const emailError = (value) => {
  const email = value.toString().trim()
  if (email.length > MAX_EMAIL) return `Max ${MAX_EMAIL} characters`
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address'
  // `gmial.com` passes every format check — it is a real, squatted domain. A
  // hospital admin who mistypes here can never receive the verification mail or
  // reset their password, because staff sign-in is email-only.
  const typo = emailTypoError(email)
  if (typo) return typo
  return null
}

// The hospital logo: required at sign-up (a pending hospital can't log in to
// add one), and shown as the hospital's pin on every map. Same rules as the
// backend's storage.require_image.
const LOGO_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
const LOGO_MAX_MB = 3

const STEP_FIELDS = {
  1: ['hospitalName', 'logo', 'regNo', 'city', 'area', 'address'],
  2: ['ownerFirstName', 'ownerLastName', 'mobile', 'email', 'password', 'confirm', 'open', 'close', 'consult'],
  3: ['services', 'terms'],
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

/* Full-page confirmation shown after a successful hospital registration.
   The account is created PENDING (backend: auth.py /register-hospital) and cannot
   log in until a Super Admin approves it — so this screen replaces the form
   entirely rather than sitting under it as a banner. */
function RegistrationSubmitted({ hospitalName, email, phone, applicationId, onLogin, onHome }) {
  const steps = [
    {
      icon: ShieldCheck,
      title: 'Document verification',
      body: 'Our team reviews your hospital registration number and the details you submitted.',
    },
    {
      icon: BellRing,
      title: 'Approval notification',
      body: `We'll notify you at ${email || 'your registered email'}${phone ? ` and ${phone}` : ''} once your hospital is approved.`,
    },
    {
      icon: Building2,
      title: 'Start using TapCure',
      body: 'After approval, sign in as hospital admin to add doctors and open your OP queue.',
    },
  ]

  return (
    <div className="signup-lg theme-reception flex min-h-screen items-center justify-center bg-[#f2ecdf] px-6 py-12">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-card sm:p-10">
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-green/20" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-green-600 text-white shadow-lg">
            <CheckCircle2 className="h-10 w-10" strokeWidth={2.5} />
          </span>
        </div>

        <h1 className="mt-6 text-[28px] font-extrabold leading-tight text-brand-navy">
          Registration completed
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Thank you for registering{' '}
          <span className="font-semibold text-brand-navy">{hospitalName || 'your hospital'}</span> with TapCure.
        </p>

        {/* The actual wait-for-approval message */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-amber-900">Waiting for admin approval</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800">
              Your details are being verified by our admin team. You will not be able to log in until
              your hospital is approved — we'll let you know as soon as it is.
            </p>
          </div>
        </div>

        {applicationId != null && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-[13px] text-slate-500">
            <Hash className="h-3.5 w-3.5 text-slate-400" />
            Application reference
            <span className="font-bold tracking-wide text-brand-navy">
              TC-CL-{String(applicationId).padStart(5, '0')}
            </span>
          </div>
        )}

        <div className="mt-7 space-y-3 text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">What happens next</p>
          {steps.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-blue shadow-sm">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-brand-navy">
                  <span className="text-slate-400">{i + 1}.</span> {title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onLogin}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-blue to-brand-teal px-7 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01]"
          >
            Go to Hospital Login <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onHome}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-3.5 text-sm font-bold text-brand-navy transition-colors hover:border-brand-blue hover:text-brand-blue"
          >
            <Home className="h-4 w-4" /> Back to Home
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Need help? Reach us at{' '}
          <a href="mailto:hello@tapcure.in" className="font-semibold text-brand-blue hover:underline">
            hello@tapcure.in
          </a>
        </p>
      </div>
    </div>
  )
}

function HospitalSignup() {
  const navigate = useNavigate()
  // alwaysOpen defaults ON: patient booking has always followed the DOCTOR's
  // sessions, never the hospital's advertised window, so asking for opening hours
  // up front constrained the hospital's own doctors for no benefit to patients.
  const [form, setForm] = useState({ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], services: [], insurers: [], other: '', alwaysOpen: true })
  const [logo, setLogo] = useState(null)              // the File picked for the hospital logo
  const [logoPreview, setLogoPreview] = useState('')  // object URL for the preview
  const [photo, setPhoto] = useState(null)            // optional hospital photo (Find Hospitals card)
  const [photoPreview, setPhotoPreview] = useState('')
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [agreed, setAgreed] = useState(false)
  const [step, setStep] = useState(1)
  const [cities, setCities] = useState([])
  const [cityOpen, setCityOpen] = useState(false)
  const stepTopRef = useRef(null)

  useEffect(() => {
    discoveryApi.cities()
      .then((result) => setCities((result?.cities || []).filter(Boolean)))
      .catch(() => setCities([]))
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // Owner first / last name boxes keep ownerName in step.
  const setOwnerPart = (k) => (e) => setForm((f) => { const n = { ...f, [k]: e.target.value }; return { ...n, ownerName: joinName(n.ownerFirstName, n.ownerLastName) } })
  const matchingCities = cities.filter((city) =>
    city.toLowerCase().includes((form.city || '').trim().toLowerCase()),
  )
  const cityIsNew = Boolean(
    form.city?.trim() && !cities.some((city) => city.toLowerCase() === form.city.trim().toLowerCase()),
  )
  const toggle = (key, val) =>
    setForm((f) => {
      const arr = f[key]
      return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] }
    })

  const showStep = (nextStep) => {
    setErrors((current) => Object.fromEntries(
      Object.entries(current).filter(([key, message]) => Boolean(message) && (nextStep !== 4 || !['services', 'terms'].includes(key)))
    ))
    setStep(nextStep)
    setDone(false)
    setTimeout(() => stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  /** Take the picked logo after the same checks the server makes. */
  const pickLogo = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // picking the same file again still fires onChange
    if (!file) return
    let msg = null
    if (!LOGO_TYPES.includes((file.type || '').toLowerCase())) msg = 'Please choose a JPG or PNG image'
    else if (file.size > LOGO_MAX_MB * 1024 * 1024) msg = `The logo must be ${LOGO_MAX_MB} MB or smaller`
    if (msg) { setErrors((current) => ({ ...current, logo: msg })); return }
    setLogo(file)
    setLogoPreview(URL.createObjectURL(file))
    setErrors((current) => ({ ...current, logo: undefined }))
  }
  // Release the old preview's memory when it changes or the page closes.
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview) }, [logoPreview])

  /** Optional photo, same checks as the logo. */
  const pickPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    let msg = ''
    if (!LOGO_TYPES.includes((file.type || '').toLowerCase())) msg = 'Please choose a JPG or PNG image'
    else if (file.size > LOGO_MAX_MB * 1024 * 1024) msg = `The photo must be ${LOGO_MAX_MB} MB or smaller`
    if (msg) { setErrors((current) => ({ ...current, photo: msg })); return }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setErrors((current) => ({ ...current, photo: undefined }))
  }
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  const validateStep = (targetStep) => {
    const err = {}
    const requiredByStep = {
      1: ['hospitalName', 'regNo', 'city', 'area', 'address'],
      // Owner account + timings share step 2. A 24/7 hospital is never shown the
      // two time fields, so requiring them would block the step on inputs that
      // aren't on screen.
      2: ['ownerFirstName', 'ownerLastName', 'mobile', 'email', 'password', 'confirm',
        ...(form.alwaysOpen ? ['consult'] : ['open', 'close', 'consult'])],
    }

    ;(requiredByStep[targetStep] || []).forEach((key) => {
      if (!form[key]?.toString().trim()) err[key] = 'Required'
    })
    // Shape-check the licence number once something has been typed, so the
    // hospital is told at the field rather than after the whole form.
    if (targetStep === 1 && form.regNo?.toString().trim()) {
      const regErr = validateHospitalRegNo(form.regNo)
      if (regErr) err.regNo = regErr
    }
    if (targetStep === 1 && !logo) err.logo = 'Please upload your hospital logo'
    if (targetStep === 2 && form.mobile && !/^\d{10}$/.test(form.mobile)) {
      err.mobile = 'Enter a valid 10-digit number'
    }
    if (targetStep === 2 && form.email?.toString().trim()) {
      const mailErr = emailError(form.email)
      if (mailErr) err.email = mailErr
    }
    if (targetStep === 2 && form.password && form.password.length < MIN_PASSWORD) {
      err.password = `Min ${MIN_PASSWORD} characters`
    }
    if (targetStep === 2 && form.confirm && form.password && form.confirm !== form.password) {
      err.confirm = 'Passwords do not match'
    }
    if (targetStep === 3 && !form.services.length) err.services = 'Select at least one service'
    if (targetStep === 3 && !agreed) err.terms = 'Please accept the Terms, Privacy and Refund policies.'

    setErrors((current) => {
      const next = { ...current }
      STEP_FIELDS[targetStep].forEach((key) => delete next[key])
      return { ...next, ...err }
    })
    return Object.keys(err).length === 0
  }

  const nextStep = () => {
    if (validateStep(step)) {
      setSubmitError(null)
      showStep(Math.min(step + 1, STEPS.length))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step < STEPS.length) {
      nextStep()
      return
    }
    const err = {}
    const required = ['hospitalName', 'regNo', 'city', 'area', 'address', 'ownerFirstName', 'ownerLastName', 'mobile', 'email', 'password', 'confirm', 'consult',
      ...(form.alwaysOpen ? [] : ['open', 'close'])]
    required.forEach((k) => { if (!form[k]?.toString().trim()) err[k] = 'Required' })
    if (!logo) err.logo = 'Please upload your hospital logo'
    if (form.regNo?.toString().trim()) {
      const regErr = validateHospitalRegNo(form.regNo)
      if (regErr) err.regNo = regErr
    }
    if (form.mobile && !/^\d{10}$/.test(form.mobile)) err.mobile = 'Enter a valid 10-digit number'
    if (form.email?.toString().trim()) {
      const mailErr = emailError(form.email)
      if (mailErr) err.email = mailErr
    }
    if (form.password && form.password.length < MIN_PASSWORD) err.password = `Min ${MIN_PASSWORD} characters`
    if (form.confirm && form.password && form.confirm !== form.password) err.confirm = 'Passwords do not match'
    if (!form.services.length) err.services = 'Select at least one service'
    if (!agreed) err.terms = 'Please accept the Terms, Privacy and Refund policies.'
    setErrors(err)
    if (Object.keys(err).length) {
      setDone(false)
      const firstInvalidStep = STEPS.find(({ n }) => STEP_FIELDS[n].some((key) => err[key]))?.n || 1
      showStep(firstInvalidStep)
      return
    }

    // Map "HH:MM AM/PM" consult option to minutes if it's like "10 mins"; else default.
    const consultMins = parseInt(form.consult, 10) || 10
    setBusy(true)
    setSubmitError(null)
    try {
      // Coordinates only arrive when the hospital PICKS a Google suggestion. If
      // they just typed the address, geocode it now — otherwise the hospital is
      // stored with no map pin, the Profile page shows an empty location, and
      // patients get no travel time. Registration still goes through if the
      // lookup fails; the pin can be set later from Hospital Profile.
      let { latitude, longitude } = form
      if ((latitude == null || longitude == null) && form.address?.trim()) {
        try {
          const g = await geocodeAddress({ address: form.address, city: form.city, pincode: form.pincode })
          if (g) { latitude = g.lat; longitude = g.lng }
        } catch { /* keep going — location is not a registration blocker */ }
      }
      const res = await authApi.registerHospital({
        hospital_name: form.hospitalName,
        registration_number: form.regNo,
        hfr_id: form.hfrId?.trim() || null,
        city: form.city || '',
        area: form.area,
        address: form.address,
        pincode: form.pincode || '',
        state: form.state || '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        owner_name: form.ownerName,
        owner_first_name: (form.ownerFirstName || '').trim(),
        owner_last_name: (form.ownerLastName || '').trim(),
        phone: form.mobile,
        email: form.email,
        password: form.password,
        always_open: Boolean(form.alwaysOpen),
        open_time: form.alwaysOpen ? null : form.open,
        close_time: form.alwaysOpen ? null : form.close,
        consultation_minutes: consultMins,
        working_days: form.days,
        services: form.services,
        insurance_partners: form.insurers,
        terms_accepted: true,
      }, logo, photo)
      // Swap the whole form out for the pending-approval confirmation screen.
      setDone(res || {})
      window.scrollTo({ top: 0, behavior: 'auto' })
    } catch (e2) {
      setSubmitError(e2.message || 'Registration failed. Please try again.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setBusy(false)
  }

  if (done) {
    return (
      <RegistrationSubmitted
        hospitalName={form.hospitalName}
        email={form.email}
        phone={form.mobile}
        applicationId={done.hospital_id}
        onLogin={() => navigate('/hospital-login')}
        onHome={() => navigate('/')}
      />
    )
  }

  return (
    <div className="signup-lg theme-reception min-h-screen bg-[#f2ecdf]">
      <main className="mx-auto max-w-[1400px] px-6 py-8 lg:py-10">
        {/* Title + registration photo (top-right, where the illustration was).
            The band reserves height so the photo never overlaps the stepper. */}
        <BackToHome className="mb-5" />
        <div className="relative min-h-[160px]">
          <h1 className="text-[30px] font-extrabold text-brand-navy">
            Register your hospital with <span className="text-brand-navy">Tap</span>
            <span className="bg-gradient-to-r from-brand-blue via-brand-teal to-brand-green bg-clip-text text-transparent">Cure</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Join TapCure and grow your practice by connecting with more patients.
          </p>

          <div className="absolute -top-3 right-0 hidden w-[480px] xl:block">
            <div className="absolute right-4 -top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full rounded-bl-none bg-brand-green shadow-md ring-4 ring-white">
              <Plus className="h-5 w-5 text-white" strokeWidth={3} />
            </div>
            {/* Blended into the page background with soft faded edges (no card/patch) */}
            <img
              src="/hospital-register-banner.png"
              alt="Patient registering at a TapCure hospital reception"
              className="h-[170px] w-full object-cover object-center"
              style={{
                WebkitMaskImage:
                  'linear-gradient(to right, transparent 0%, black 22%, black 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
                maskImage:
                  'linear-gradient(to right, transparent 0%, black 22%, black 90%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
                WebkitMaskComposite: 'source-in',
                maskComposite: 'intersect',
              }}
            />
          </div>
        </div>

        <form ref={stepTopRef} onSubmit={handleSubmit} className="mt-4 scroll-mt-4">
          {/* Stepper header */}
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
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex flex-1 items-center">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${s.n < step ? 'bg-brand-green' : s.n === step ? 'bg-brand-blue' : 'bg-slate-300'}`}>
                    {s.n < step ? <CheckCircle2 className="h-4 w-4" /> : s.n}
                  </span>
                  <div>
                    <p className={`text-[13px] font-bold ${s.n === step ? 'text-brand-blue' : s.n < step ? 'text-brand-green' : 'text-brand-navy'}`}>{s.title}</p>
                    <p className="text-[11px] text-slate-400">{s.sub}</p>
                  </div>
                </div>
                {i < STEPS.length - 1 && <span className={`mx-3 h-px flex-1 ${s.n < step ? 'bg-brand-green' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          {Object.values(errors).some(Boolean) && (
            <div className="mb-4">
              <Banner type="error">Please fill all required fields highlighted below.</Banner>
            </div>
          )}
          {submitError && (
            <div className="mb-4">
              <Banner type="error">{submitError}</Banner>
            </div>
          )}

          <div className="mx-auto max-w-3xl">
            {/* 1. Hospital Details */}
            {step === 1 && (
            <SectionCard icon={Building2} title="Hospital Details">
              <TextInput label="Hospital Name" required icon={Building2} placeholder="Enter hospital name" value={form.hospitalName || ''} onChange={set('hospitalName')} error={errors.hospitalName} />
              {/* Required: the maps show the hospital by its logo, and a
                  pending hospital can't log in to add one later. */}
              <div>
                <p className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Hospital Logo<span className="text-red-500"> *</span>
                </p>
                <div className={`flex items-center gap-4 rounded-xl border border-dashed p-3 ${errors.logo ? 'border-red-300 bg-red-50/40' : 'border-slate-300 bg-slate-50/60'}`}>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {logoPreview
                      ? <img src={logoPreview} alt="Hospital logo preview" className="h-full w-full object-contain" />
                      : <ImagePlus className="h-6 w-6 text-slate-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="hospital-logo" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-[13px] font-bold text-white hover:bg-brand-blueDark">
                      <ImagePlus className="h-4 w-4" /> {logo ? 'Change logo' : 'Upload logo'}
                    </label>
                    <input id="hospital-logo" type="file" accept="image/png,image/jpeg" onChange={pickLogo} className="sr-only" />
                    <p className="mt-1.5 truncate text-[12px] text-slate-500">
                      {logo ? logo.name : `JPG or PNG, up to ${LOGO_MAX_MB} MB. Patients see it on maps and your hospital page.`}
                    </p>
                  </div>
                </div>
                {errors.logo && <p className="mt-1 text-xs text-red-500">{errors.logo}</p>}
              </div>
              {/* Optional: shown on the public Find Hospitals cards. */}
              <div>
                <p className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Hospital Photo <span className="font-normal text-slate-400">(optional)</span>
                </p>
                <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {photoPreview
                      ? <img src={photoPreview} alt="Hospital photo preview" className="h-full w-full object-cover" />
                      : <ImagePlus className="h-6 w-6 text-slate-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="hospital-photo" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-blue px-3 py-2 text-[13px] font-bold text-brand-blue hover:bg-blue-50">
                      <ImagePlus className="h-4 w-4" /> {photo ? 'Change photo' : 'Upload photo'}
                    </label>
                    <input id="hospital-photo" type="file" accept="image/png,image/jpeg" onChange={pickPhoto} className="sr-only" />
                    <p className="mt-1.5 truncate text-[12px] text-slate-500">
                      {photo ? photo.name : 'A photo of your building or reception. Patients see it when browsing hospitals.'}
                    </p>
                  </div>
                </div>
                {errors.photo && <p className="mt-1 text-xs text-red-500">{errors.photo}</p>}
              </div>
              {/* "Hospital Type" used to sit here. It was required, then thrown
                  away — register_hospital never read it and hospitals has no
                  column for it — and the Services step already says what the
                  hospital does, in more detail and as real Departments. */}
              <TextInput label="Registration Number" required icon={Hash} maxLength={MAX_REG_NO} placeholder={REG_NO_PLACEHOLDER} value={form.regNo || ''} onChange={set('regNo')} error={errors.regNo} />
              <TextInput label="HFR ID (optional)" icon={Hash} placeholder="ABDM Health Facility Registry ID, if any" value={form.hfrId || ''} onChange={set('hfrId')} />
              <div>
                <label htmlFor="hospital-city" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  City<span className="text-red-500"> *</span>
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="hospital-city"
                    value={form.city || ''}
                    onFocus={() => setCityOpen(true)}
                    onBlur={() => setTimeout(() => setCityOpen(false), 120)}
                    onChange={(e) => {
                      setForm((current) => ({ ...current, city: e.target.value }))
                      setErrors((current) => ({ ...current, city: undefined }))
                      setCityOpen(true)
                    }}
                    placeholder="Search or enter your city"
                    autoComplete="off"
                    aria-expanded={cityOpen}
                    aria-controls="hospital-city-options"
                    className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-10 text-sm text-brand-navy outline-none transition-colors placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 ${errors.city ? 'border-red-300' : 'border-slate-200'}`}
                  />
                  <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => setCityOpen((open) => !open)} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-brand-blue" aria-label="Show city options">
                    <ChevronDown className={`h-4 w-4 transition-transform ${cityOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {cityOpen && (
                    <div id="hospital-city-options" role="listbox" className="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                      {matchingCities.map((city) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={form.city === city}
                          key={city}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setForm((current) => ({ ...current, city }))
                            setErrors((current) => ({ ...current, city: undefined }))
                            setCityOpen(false)
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${form.city === city ? 'bg-blue-50 font-semibold text-brand-blue' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />{city}
                        </button>
                      ))}
                      {cityIsNew && (
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setCityOpen(false)} className="flex w-full items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-left text-sm font-semibold text-teal-700 hover:bg-teal-100">
                          <Plus className="h-3.5 w-3.5" /> Use “{form.city.trim()}” as a new city
                        </button>
                      )}
                      {!matchingCities.length && !cityIsNew && (
                        <p className="px-3 py-3 text-center text-xs text-slate-400">Start typing to add your city</p>
                      )}
                    </div>
                  )}
                </div>
                {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
                <p className="mt-1 text-[11px] text-slate-400">Choose an existing city or type a new city if it is not listed.</p>
              </div>
              <TextInput label="Area / Locality" required placeholder="Enter area" value={form.area || ''} onChange={set('area')} error={errors.area} />
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  Full Address<span className="text-red-500"> *</span>
                </label>
                <AddressAutocomplete
                  value={form.address || ''}
                  onChange={(val) => { setForm((f) => ({ ...f, address: val })); setErrors((er) => ({ ...er, address: undefined })) }}
                  onSelect={(p) => setForm((f) => ({
                    ...f,
                    address: p.label || f.address,
                    latitude: p.lat, longitude: p.lng,
                    state: p.state || f.state || '',
                    city: p.city || f.city || '',
                    pincode: p.pincode || f.pincode,
                    area: f.area || p.city || '',
                  }))}
                  // Search within the area + city already entered above.
                  context={[form.area, form.city].map((s) => (s || '').trim()).filter(Boolean).join(', ')}
                  placeholder="Search your hospital on Google Maps…"
                  className={`flex w-full items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 pr-9 text-sm text-brand-navy outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 ${errors.address ? 'border-red-300' : 'border-slate-200'}`}
                />
                {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-brand-blue" />
                  Pick your hospital from the suggestions for an accurate map location.
                  {form.latitude != null && form.longitude != null && (
                    <span className="font-semibold text-brand-green">· Location pinned ✓</span>
                  )}
                </p>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" /> Your hospital details are secure and safe with us.
              </p>
            </SectionCard>
            )}

            {/* 2. Owner Details + Hospital Timings */}
            {step === 2 && (
            <div className="space-y-5">
            <SectionCard icon={UsersRound} title="Owner Details">
              <div className="col-span-full grid grid-cols-2 gap-3"><TextInput label="Owner First Name" required icon={User} placeholder="First name" value={form.ownerFirstName || ''} onChange={setOwnerPart('ownerFirstName')} error={errors.ownerFirstName} /><TextInput label="Owner Last Name" required placeholder="Surname or initial" value={form.ownerLastName || ''} onChange={setOwnerPart('ownerLastName')} error={errors.ownerLastName} /></div>
              <TextInput label="Mobile Number" required icon={Phone} prefix="+91" placeholder="Enter mobile number" inputMode="numeric" autoComplete="tel-national" value={form.mobile || ''} onChange={(e) => setForm((f) => ({ ...f, mobile: toMobile(e.target.value) }))} error={errors.mobile} />
              <TextInput label="Email Address" required icon={Mail} placeholder="Enter email address" maxLength={MAX_EMAIL} autoComplete="email" value={form.email || ''} onChange={set('email')} error={errors.email} />
              <PasswordInput label="Password" required icon={Lock} name="hospital-new-password" autoComplete="new-password" placeholder="Create a strong password" value={form.password || ''} onChange={set('password')} error={errors.password} />
              <PasswordInput label="Confirm Password" required icon={Lock} name="hospital-confirm-password" autoComplete="off" onPaste={(e) => e.preventDefault()} placeholder="Type the password again" value={form.confirm || ''} onChange={set('confirm')} error={errors.confirm} />
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" /> Use a strong password to keep your account secure.
              </p>
            </SectionCard>

            <SectionCard icon={Clock} title="Hospital Timings">
              <div>
                <p className="mb-2 text-[13px] font-semibold text-slate-700">
                  When is your hospital open? <span className="text-red-500">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[[true, 'Always open (24/7)'], [false, 'Specific hours']].map(([val, label]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, alwaysOpen: val }))}
                      aria-pressed={Boolean(form.alwaysOpen) === val}
                      className={`rounded-xl border px-3.5 py-2.5 text-[13px] font-bold transition-colors ${
                        Boolean(form.alwaysOpen) === val
                          ? 'border-brand-blue bg-brand-blueLight text-brand-blue'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {!form.alwaysOpen && (
                <>
                  <TextInput label="Opening Time" required icon={Clock} type="time" value={form.open || ''} onChange={set('open')} error={errors.open} />
                  <TextInput label="Closing Time" required icon={Clock} type="time" value={form.close || ''} onChange={set('close')} error={errors.close} />
                </>
              )}

              <SelectInput label="Average Consultation Time" required value={form.consult || ''} onChange={set('consult')} error={errors.consult}>
                <option value="">Select duration</option>
                {CONSULT_TIMES.map((t) => <option key={t}>{t}</option>)}
              </SelectInput>

              {/* Days are a separate constraint on doctors from the hours, so a
                  24/7 hospital must not carry a week either. */}
              {!form.alwaysOpen && (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-slate-700">Working Days <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-4 gap-x-2 gap-y-2.5">
                    {WORKING_DAYS.map((d) => (
                      <label key={d} className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={form.days.includes(d)}
                          onChange={() => toggle('days', d)}
                          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                        />
                        <span className="text-[13px] font-medium text-slate-600">{d}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-blue" />
                {form.alwaysOpen
                  ? 'Each doctor sets their own consulting hours — patients book around those.'
                  : 'Doctors can only add consulting sessions inside these hours.'}
              </p>
            </SectionCard>
            </div>
            )}

            {/* 3. Services */}
            {step === 3 && (
            <SectionCard icon={Stethoscope} title="Services">
              <p className="text-[13px] font-semibold text-slate-700">
                Select the services you provide <span className="text-red-500">*</span>
              </p>
              {errors.services && <p className="text-xs text-red-500">{errors.services}</p>}
              <div className="grid grid-cols-3 gap-2">
                {SERVICE_OPTIONS.map(({ label, icon: Icon, color }) => {
                  const on = form.services.includes(label)
                  return (
                    <button type="button" key={label} onClick={() => { toggle('services', label); setErrors((current) => ({ ...current, services: undefined })) }}
                      className={`relative flex items-center gap-1.5 rounded-xl border px-2 py-2.5 text-left transition-colors ${on ? 'border-brand-green bg-brand-greenLight' : 'border-slate-200 hover:border-brand-blue'}`}>
                      <Icon className={`h-4 w-4 shrink-0 ${ICON_COLORS[color]}`} />
                      <span className="text-[11px] font-semibold leading-tight text-slate-700">{label}</span>
                      {on && <CheckCircle2 className="absolute right-1 top-1 h-3.5 w-3.5 text-brand-green" />}
                    </button>
                  )
                })}
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-slate-700">Other Services</p>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 focus-within:border-brand-blue">
                  <input placeholder="Enter other service" value={form.other} onChange={set('other')}
                    className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400" />
                  <button type="button" onClick={() => { if (form.other.trim()) { toggle('services', form.other.trim()); setForm((f) => ({ ...f, other: '' })); setErrors((current) => ({ ...current, services: undefined })) } }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-blueLight text-brand-blue">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </SectionCard>
            )}
            {step === 3 && (
            <SectionCard icon={ShieldCheck} title="Insurance & schemes accepted">
              <p className="text-[12.5px] text-slate-500">
                Optional. Tick every insurance company and government scheme your hospital accepts.
                Patients will see these on your hospital card. You can change them later in Profile.
              </p>
              <InsurancePicker value={form.insurers} onChange={(insurers) => setForm((f) => ({ ...f, insurers }))} state={form.state} />
            </SectionCard>
            )}
          </div>

          {/* Consent */}
          {step === 3 && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-slate-100 bg-white p-4 shadow-card">
            <ConsentCheck
              checked={agreed}
              onChange={(v) => { setAgreed(v); if (v) setErrors((er) => ({ ...er, terms: undefined })) }}
              error={errors.terms}
            />
          </div>
          )}

          {/* Step navigation and final submit */}
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
            {step < STEPS.length ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-blue to-brand-teal px-8 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01]"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
            <button
              disabled={busy}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-green-600 px-10 py-3.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              <Building2 className="h-4 w-4" />
              {busy ? 'Submitting…' : 'Submit Hospital Registration'}
            </button>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}

export default HospitalSignup
