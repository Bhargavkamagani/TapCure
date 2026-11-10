import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, BadgeCheck, Briefcase, Camera, Check, Hash, IndianRupee, Languages, Stethoscope, CalendarClock } from 'lucide-react'
import { TextInput, SelectInput, Banner } from '../../components/common/FormControls.jsx'
import PhotoUpload from '../../components/common/PhotoUpload.jsx'
import QualificationPicker from '../../components/common/QualificationPicker.jsx'
import LanguagePicker from '../../components/common/LanguagePicker.jsx'
import OnboardingFooter from '../../components/doctor/OnboardingFooter.jsx'
import OnboardingHeader from '../../components/doctor/OnboardingHeader.jsx'
import { SPECIALIZATIONS } from '../../data/authData.js'
import { doctorsApi } from '../../api'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { validateProfileScreen, hasErrors, MAX_BIO, MAX_REG_NO, REG_NO_PLACEHOLDER } from '../../components/doctor/onboardingValidation.js'

/**
 * Step 2 of first-login setup, broken into three short screens.
 *
 * The dashboard's My Profile page asks for everything at once inside a modal —
 * fine when you're editing one field, heavy as a first impression. Here the same
 * fields arrive in three passes, each with its own heading explaining WHY it's
 * asked, and each one saves before moving on so a doctor who drops out
 * mid-setup keeps what they'd already entered.
 */
const SUB_STEPS = [
  {
    key: 'identity',
    label: 'Identity',
    icon: Camera,
    title: 'How patients recognise you',
    sub: 'Your photo and field of practice are the first things a patient sees in search results.',
  },
  {
    key: 'credentials',
    label: 'Credentials',
    icon: BadgeCheck,
    title: 'Your medical credentials',
    sub: 'Shown on your public profile as proof you are registered to practise.',
  },
  {
    key: 'care',
    label: 'How you care',
    icon: Languages,
    title: 'How you care for patients',
    sub: 'Patients filter by language, and read your note before choosing a doctor.',
  },
  {
    key: 'revisit',
    label: 'Free revisit',
    icon: CalendarClock,
    title: 'Set your free revisit window',
    sub: 'Choose how long a patient may return after a paid consultation without paying another consultation fee.',
  },
]

/** Three segments that fill as each screen is saved. */
function SubStepRail({ index }) {
  return (
    <div className="flex gap-2.5">
      {SUB_STEPS.map((s, i) => {
        const state = i < index ? 'done' : i === index ? 'active' : 'todo'
        return (
          <div key={s.key} className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-slate-200/80">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
                initial={false}
                animate={{ width: state === 'todo' ? '0%' : '100%' }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className={`mt-2 flex items-center gap-1.5 text-[13px] font-bold transition-colors ${
              state === 'todo' ? 'text-slate-300' : state === 'active' ? 'text-teal-700' : 'text-emerald-600'
            }`}>
              {state === 'done'
                ? <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>
                : <s.icon className="h-3.5 w-3.5" />}
              <span className="truncate">{s.label}</span>
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default function OnboardingProfile() {
  const navigate = useNavigate()
  const { doctor, setDoctor, loading } = useDoctorCtx()
  const [index, setIndex] = useState(0)
  const [form, setForm] = useState(null)
  const [feeLocked, setFeeLocked] = useState(false)
  const [personalPractice, setPersonalPractice] = useState(null)
  const [revisitDays, setRevisitDays] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  // Seed the form once the doctor record lands. Self-registered doctors already
  // supplied most of this at sign-up, so most screens open pre-filled.
  useEffect(() => {
    if (!doctor?.doctor_id || form) return
    setForm({
      specialization: doctor.specialization || '',
      qualification: doctor.qualification || '',
      registration_number: doctor.registration_number || '',
      hpr_id: doctor.hpr_id || '',
      experience_years: doctor.experience_years ?? '',
      consultation_fee: Number(doctor.consultation_fee) || '',
      languages: doctor.languages || '',
      bio: doctor.bio || '',
    })
  }, [doctor, form])

  // A hospital owns its doctors' fees; sending one back is rejected outright.
  useEffect(() => {
    if (!doctor?.doctor_id) return
    doctorsApi.affiliations({ doctor_id: doctor.doctor_id })
      .then((rows) => {
        const active = (rows || []).filter((p) => p.is_active !== false)
        setFeeLocked(active.some((p) => p.managed_by_hospital))
        const personal = active.find((p) => !p.managed_by_hospital) || null
        setPersonalPractice(personal)
        setRevisitDays(personal?.free_revisit_days ? String(personal.free_revisit_days) : '')
      })
      .catch(() => {})
  }, [doctor?.doctor_id])

  if (loading || !form) return <p className="text-sm text-slate-400">Loading…</p>
  if (!doctor) return <p className="text-sm text-slate-400">No doctor profile found.</p>

  // Self-registered doctors gave their registration number at sign-up, against
  // the council certificate they uploaded. Asking for it a second time here read
  // as a duplicate form, so it's shown back read-only. Hospital-added doctors
  // arrive without one (the Add Doctor modal doesn't collect it), and for them
  // this is still the only place it gets captured — so the field stays.
  const regOnRecord = Boolean(doctor.registration_number?.trim())
  const checks = { feeLocked, regOnRecord }

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    // Clear a field's error the moment it's edited; it re-validates on blur, so
    // the message doesn't nag at you mid-keystroke.
    setErrors((er) => (er[k] ? { ...er, [k]: null } : er))
  }
  const markTouched = (k) => () => {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors((er) => ({ ...er, ...validateProfileScreen(index, form, checks) }))
  }
  /** Only show a message once the doctor has actually been in that field. */
  const errFor = (k) => (touched[k] ? errors[k] : null)
  /** Numeric fields are text inputs, not `type="number"`: that control accepts
   *  `e`, `+` and `-`, and reports an empty string for anything it considers
   *  invalid — so "abc" arrived here as "" and was silently saved as 0. */
  const digitsOnly = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, '') }))
    setErrors((er) => (er[k] ? { ...er, [k]: null } : er))
  }

  const step = SUB_STEPS[index]
  const screenErrors = validateProfileScreen(index, form, checks)

  // The checklist gates Continue, so it has to track VALIDITY, not just
  // "is something typed" — otherwise a registration number of "x" ticks green
  // and the button unlocks on a value the field itself is rejecting.
  const checklistFor = (i) => {
    if (i === 0) {
      return [
        { label: 'Photo', done: Boolean(doctor.profile_photo_url) },
        { label: 'Specialization', done: !screenErrors.specialization },
        { label: 'Qualification', done: !screenErrors.qualification },
      ]
    }
    if (i === 1) {
      return [
        // Nothing to tick when the number came in with the sign-up — it isn't
        // something the doctor has to do on this screen.
        ...(regOnRecord ? [] : [{ label: 'Registration no.', done: !screenErrors.registration_number }]),
        { label: 'Consultation fee', done: !screenErrors.consultation_fee },
        ...(screenErrors.hpr_id ? [{ label: 'HPR ID', done: false }] : []),
        ...(screenErrors.experience_years ? [{ label: 'Experience', done: false }] : []),
      ]
    }
    if (i === 2) return [
      { label: 'At least one language', done: !screenErrors.languages },
      ...(screenErrors.bio ? [{ label: 'Note length', done: false }] : []),
    ]
    return [{ label: personalPractice ? 'Free revisit days' : 'Managed by hospital', done: !personalPractice || Number(revisitDays) > 0 }]
  }

  /** Persist everything captured so far, then move on. Sending the whole form
   *  each time (not just this screen's fields) keeps one proven payload shape. */
  const saveAndAdvance = async () => {
    // Re-check before saving rather than trusting the button's disabled state —
    // it's the only thing standing between a typo and the database.
    const found = validateProfileScreen(index, form, checks)
    if (index === 3 && personalPractice && (Number(revisitDays) < 1 || Number(revisitDays) > 365)) {
      setError('Free revisit days are required. Enter a number between 1 and 365.')
      return
    }
    if (hasErrors(found)) {
      setErrors(found)
      setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(found).map((k) => [k, true])) }))
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (index === 3 && personalPractice) {
        const savedPractice = await doctorsApi.updateAffiliation(personalPractice.affiliation_id, {
          free_revisit_days: Number(revisitDays),
        })
        setPersonalPractice(savedPractice)
      }
      // Trim on the way out: " 12345 " passed every presence check and was
      // being stored with its spaces.
      const payload = {
        ...form,
        specialization: (form.specialization || '').trim(),
        qualification: (form.qualification || '').trim(),
        registration_number: (form.registration_number || '').trim(),
        hpr_id: (form.hpr_id || '').trim(),
        languages: (form.languages || '').trim(),
        bio: (form.bio || '').trim(),
        experience_years: Number(form.experience_years) || 0,
        consultation_fee: Number(form.consultation_fee) || 0,
      }
      if (feeLocked) delete payload.consultation_fee
      const updated = await doctorsApi.update(doctor.doctor_id, payload)
      setDoctor((prev) => ({ ...prev, ...updated }))
      setForm((f) => ({ ...f, ...payload }))
      if (index < SUB_STEPS.length - 1) setIndex(index + 1)
      else navigate('/doctor-onboarding/done')
    } catch (e) {
      setError(e.message || 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const goBack = () => {
    if (index === 0) navigate('/doctor-onboarding/availability')
    else setIndex(index - 1)
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <OnboardingHeader
        eyebrow={`Step 2 · ${index + 1} of ${SUB_STEPS.length}`}
        title={step.title}
        sub={step.sub}
        animateKey={step.key}
      >
        <div className="mt-6 max-w-xl"><SubStepRail index={index} /></div>
      </OnboardingHeader>

      {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}

      <AnimatePresence mode="wait">
        <motion.section
          key={step.key}
          initial={{ opacity: 0, x: 26 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -26 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-1 flex-col rounded-[26px] border border-white bg-white p-6 shadow-soft sm:p-8 lg:p-10"
        >
          {index === 0 && (
            <div className="grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-[280px_1fr] lg:gap-12">
              <div className="flex flex-col items-center justify-center rounded-[22px] bg-gradient-to-b from-teal-50/80 to-emerald-50/40 p-7 ring-1 ring-inset ring-teal-100/70 lg:self-start">
                <PhotoUpload
                  url={doctor.profile_photo_url}
                  name={doctor.name}
                  size="h-32 w-32"
                  label="Tap the camera to add your photo"
                  onUpload={async (fd) => {
                    const d = await doctorsApi.uploadPhoto(doctor.doctor_id, fd)
                    setDoctor((prev) => ({ ...prev, ...d }))
                    return d.profile_photo_url
                  }}
                />
                <p className="mt-3 text-center text-[13px] leading-relaxed text-teal-800/70">
                  Profiles with a photo are chosen far more often than those without.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
                <SelectInput label="Specialization" required icon={Stethoscope} value={form.specialization} onChange={set('specialization')} onBlur={markTouched('specialization')} error={errFor('specialization')}>
                  <option value="">Select specialization</option>
                  {form.specialization && !SPECIALIZATIONS.includes(form.specialization) && (
                    <option value={form.specialization}>{form.specialization} (current)</option>
                  )}
                  {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </SelectInput>
                <div>
                  <QualificationPicker
                    value={form.qualification}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, qualification: v }))
                      setTouched((t) => ({ ...t, qualification: true }))
                      setErrors((er) => ({ ...er, qualification: null }))
                    }}
                  />
                  {errFor('qualification') && <p className="mt-1 text-xs text-red-500">{errFor('qualification')}</p>}
                </div>
              </div>
            </div>
          )}

          {index === 1 && (
            <div className="grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
              {regOnRecord ? (
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3.5 py-2.5">
                  <p className="text-[13.5px] font-bold text-slate-500">Medical Registration No.</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[15px] font-extrabold text-brand-navy">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="truncate">{form.registration_number}</span>
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                    Taken from your registration, with the certificate you uploaded.
                    Contact support if it needs correcting.
                  </p>
                </div>
              ) : (
                <TextInput
                  label="Medical Registration No."
                  required
                  icon={Hash}
                  inputMode="text"
                  maxLength={MAX_REG_NO}
                  placeholder={REG_NO_PLACEHOLDER}
                  value={form.registration_number}
                  onChange={set('registration_number')}
                  onBlur={markTouched('registration_number')}
                  error={errFor('registration_number')}
                />
              )}
              <TextInput
                label="HPR ID (optional)"
                icon={Award}
                maxLength={64}
                placeholder="ABDM registry ID, if any"
                value={form.hpr_id}
                onChange={set('hpr_id')}
                onBlur={markTouched('hpr_id')}
                error={errFor('hpr_id')}
              />
              <TextInput
                label="Experience (years)"
                icon={Briefcase}
                inputMode="numeric"
                maxLength={2}
                placeholder="0"
                value={form.experience_years}
                onChange={digitsOnly('experience_years')}
                onBlur={markTouched('experience_years')}
                error={errFor('experience_years')}
              />
              {feeLocked ? (
                <div>
                  <TextInput label="Consultation Fee (₹)" icon={IndianRupee} value={form.consultation_fee} readOnly disabled />
                  <p className="mt-1 text-[13px] text-slate-400">Set by your hospital.</p>
                </div>
              ) : (
                <TextInput
                  label="Consultation Fee (₹)"
                  required
                  icon={IndianRupee}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="500"
                  value={form.consultation_fee}
                  onChange={digitsOnly('consultation_fee')}
                  onBlur={markTouched('consultation_fee')}
                  error={errFor('consultation_fee')}
                />
              )}
            </div>
          )}

          {index === 2 && (
            <div className="grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
              <div>
                <LanguagePicker
                  value={form.languages}
                  onChange={(v) => {
                    setForm((f) => ({ ...f, languages: v }))
                    setTouched((t) => ({ ...t, languages: true }))
                    setErrors((er) => ({ ...er, languages: null }))
                  }}
                />
                {errFor('languages') && <p className="mt-1 text-xs text-red-500">{errFor('languages')}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                  A note for patients <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={form.bio}
                  onChange={set('bio')}
                  placeholder="e.g. 12 years treating diabetes and thyroid disorders. Evening slots for working patients."
                  className="min-h-[170px] w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm leading-relaxed text-ink outline-none transition-colors focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <p className={`text-[13px] ${errors.bio ? 'text-red-500' : 'text-slate-400'}`}>
                    {errors.bio || 'Two or three lines is plenty. You can add this later from My Profile.'}
                  </p>
                  <span className={`shrink-0 text-[13px] tabular-nums ${
                    (form.bio || '').length > MAX_BIO ? 'font-bold text-red-500' : 'text-slate-400'
                  }`}>
                    {(form.bio || '').length}/{MAX_BIO}
                  </span>
                </div>
              </div>
            </div>
          )}

          {index === 3 && (
            <div className="max-w-xl">
              {personalPractice ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                  <label className="block text-[13px] font-bold text-brand-navy">
                    Free revisit days <span className="text-red-500">*</span>
                  </label>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-500">
                    After a paid consultation at {personalPractice.name}, the patient may return to you free within this many days.
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <input
                      inputMode="numeric"
                      maxLength={3}
                      value={revisitDays}
                      placeholder="e.g. 15"
                      onChange={(e) => { setRevisitDays(e.target.value.replace(/\D/g, '')); setError(null) }}
                      className="w-32 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-brand-navy outline-none focus:border-teal-500"
                    />
                    <span className="text-[13.5px] text-slate-500">days from the consultation date</span>
                  </div>
                </div>
              ) : (
                <Banner type="info">Your hospital controls the free-revisit period for this practice. No action is required from you.</Banner>
              )}
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      <OnboardingFooter
        hint="fill it in above"
        checklist={checklistFor(index)}
        busy={saving}
        onBack={goBack}
        backLabel={index === 0 ? 'Hours' : SUB_STEPS[index - 1].label}
        nextLabel={saving ? 'Saving…' : index < SUB_STEPS.length - 1 ? `Continue to ${SUB_STEPS[index + 1].label.toLowerCase()}` : 'Finish setup'}
        onNext={saveAndAdvance}
      />
    </div>
  )
}
