import { useEffect, useState } from 'react'
import { Building2, Stethoscope, Mail, Phone, MapPin, BadgeCheck, Award, Pencil, X, IndianRupee, Languages, Fingerprint } from 'lucide-react'
import { Card, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import { TextInput, SelectInput, Banner } from '../../components/common/FormControls.jsx'
import AddressAutocomplete from '../../components/common/AddressAutocomplete.jsx'
import PhotoUpload from '../../components/common/PhotoUpload.jsx'
import ImageSlotUpload from '../../components/common/ImageSlotUpload.jsx'
import QualificationPicker from '../../components/common/QualificationPicker.jsx'
import LanguagePicker from '../../components/common/LanguagePicker.jsx'
import { SPECIALIZATIONS } from '../../data/authData.js'
import { fileUrl } from '../../api'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { doctorsApi } from '../../api'
import { geocodeAddress } from '../../lib/geo.js'
import { RevisitWindowCard } from './Fees.jsx'
import { validateRegistrationNumber, MAX_REG_NO, REG_NO_PLACEHOLDER } from '../../components/doctor/onboardingValidation.js'

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-[18px] w-[18px]" /></span>
      <div>
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-[14px] font-medium text-brand-navy">{value || '—'}</p>
      </div>
    </div>
  )
}

function EditModal({ doctor, feeLocked, onClose, onSaved }) {
  const [form, setForm] = useState({
    specialization: doctor.specialization || '',
    qualification: doctor.qualification || '',
    registration_number: doctor.registration_number || '',
    hpr_id: doctor.hpr_id || '',
    experience_years: doctor.experience_years ?? '',
    consultation_fee: Number(doctor.consultation_fee) || '',
    languages: doctor.languages || '',
    bio: doctor.bio || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  /** Money and year fields: digits only, so the wheel-spinner and `e`/`+`/`-`
   *  problems of type="number" can't reach the saved value. */
  const digitsOnly = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, '') }))

  const save = async (e) => {
    e.preventDefault()
    // The number is already on record by the time a doctor reaches this modal,
    // so it can only be edited into something worse. Same rule as signup.
    const regErr = form.registration_number?.trim() ? validateRegistrationNumber(form.registration_number) : null
    if (regErr) { setError(regErr); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        experience_years: Number(form.experience_years) || 0,
        consultation_fee: Number(form.consultation_fee) || 0,
      }
      // A hospital's doctor may not change the fee, and the backend rejects the
      // whole request if it's sent — so never send it when it's read-only.
      if (feeLocked) delete payload.consultation_fee
      const updated = await doctorsApi.update(doctor.doctor_id, payload)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-brand-navy">Edit Profile</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}
        <div className="mb-5">
          <PhotoUpload
            url={doctor.profile_photo_url}
            name={doctor.name}
            onUpload={async (fd) => { const d = await doctorsApi.uploadPhoto(doctor.doctor_id, fd); onSaved(d); return d.profile_photo_url }}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Was free text, which let a doctor set anything and had already put
              "Dentist", "Psychology" and even "MBBS" into the column. The
              symptom helper matches specialty names exactly, so those doctors
              were invisible to it. Any stored value outside the catalogue is
              still offered as an option, so opening the profile and saving can
              never silently blank out an existing specialty. */}
          <SelectInput label="Specialization" icon={Stethoscope} value={form.specialization || ''} onChange={set('specialization')}>
            <option value="">Select specialization</option>
            {form.specialization && !SPECIALIZATIONS.includes(form.specialization) && (
              <option value={form.specialization}>{form.specialization} (current)</option>
            )}
            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
          <QualificationPicker
            value={form.qualification}
            onChange={(v) => setForm((f) => ({ ...f, qualification: v }))}
          />
          <TextInput label="Medical Registration No." placeholder={REG_NO_PLACEHOLDER} maxLength={MAX_REG_NO} value={form.registration_number} onChange={set('registration_number')} />
          <TextInput label="HPR ID (optional)" value={form.hpr_id} onChange={set('hpr_id')} placeholder="ABDM Healthcare Professionals Registry ID" />
          <TextInput label="Experience (years)" inputMode="numeric" maxLength={2} value={form.experience_years} onChange={digitsOnly('experience_years')} />
          {feeLocked ? (
            <div>
              <TextInput label="Consultation Fee (₹)" value={form.consultation_fee} readOnly disabled />
              <p className="mt-1 text-[11.5px] text-slate-400">Set by your hospital.</p>
            </div>
          ) : (
            <TextInput label="Consultation Fee (₹)" inputMode="numeric" maxLength={6} value={form.consultation_fee} onChange={digitsOnly('consultation_fee')} />
          )}
          <div className="sm:col-span-2">
            <LanguagePicker
              value={form.languages}
              onChange={(v) => setForm((f) => ({ ...f, languages: v }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Bio</label>
            <textarea value={form.bio} onChange={set('bio')} className="min-h-[90px] w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <ToolButton type="button" onClick={onClose}>Cancel</ToolButton>
          <ToolButton type="submit" tone="primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</ToolButton>
        </div>
      </form>
    </div>
  )
}

const PRACTICE_TYPES = [
  { value: 'home', label: 'Home practice' },
  { value: 'personal_practice', label: 'Personal practice' },
  { value: 'hospital', label: 'Another hospital' },
  { value: 'online', label: 'Online consultation' },
]

function typeLabel(value) {
  return PRACTICE_TYPES.find((t) => t.value === value)?.label || value
}

/** Exported so first-login setup can offer it too — a doctor with no practice
 *  location can't add a single session, and during onboarding My Profile (where
 *  this normally lives) isn't reachable.
 *
 *  Pass `practice` to edit an existing row instead of adding one. Without it a
 *  self-registered doctor was stuck with whatever address they typed at signup:
 *  that affiliation — not the anchor hospital — is what patients are navigated
 *  to, so a wrong pin could never be corrected from the app. */
export function PracticeModal({ doctor, practice = null, onClose, onSaved }) {
  const isEdit = Boolean(practice)
  const [form, setForm] = useState({
    practice_type: practice?.practice_type || 'home',
    name: practice?.name || (isEdit ? '' : 'Home practice'),
    address: practice?.address || '',
    city: practice?.city || '',
    latitude: practice?.latitude ?? null,
    longitude: practice?.longitude ?? null,
    consultation_fee: Number(practice?.consultation_fee ?? doctor.consultation_fee) || 0,
  })
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  // A solo doctor has ONE fee: updating their profile rewrites every personal
  // affiliation's fee to match. Offering a per-practice fee here would let them
  // set an amount that the next profile save silently reverts.
  const feeLocked = doctor.is_self_registered && form.practice_type !== 'hospital'

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Practice name is required.')
      return
    }
    if (form.practice_type !== 'online' && !form.address.trim()) {
      setError('Address is required for hospital, home, and personal practice.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let coords = null
      if (form.practice_type !== 'online') {
        // Coordinates picked from the Google suggestion are the most accurate;
        // only geocode the typed text when the user didn't pick a suggestion.
        if (form.latitude != null && form.longitude != null) {
          coords = { lat: Number(form.latitude), lng: Number(form.longitude) }
        } else {
          setLocating(true)
          coords = await geocodeAddress({ address: form.address, city: form.city })
          setLocating(false)
        }
        if (!coords) {
          setError('Could not locate this address. Please pick it from the map suggestions, or enter a more complete address with area and city.')
          setSaving(false)
          return
        }
      }
      const place = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        consultation_fee: Number(feeLocked ? doctor.consultation_fee : form.consultation_fee) || 0,
      }
      // Editing can't move a practice between types — the backend derives
      // hospital_id + managed_by_hospital from practice_type on create, and
      // AffiliationUpdate deliberately doesn't accept it.
      const saved = isEdit
        ? await doctorsApi.updateAffiliation(practice.affiliation_id, place)
        : await doctorsApi.addAffiliation({
            doctor_id: doctor.doctor_id,
            practice_type: form.practice_type,
            ...place,
            mode: 'slot',
            is_active: true,
            managed_by_hospital: form.practice_type === 'hospital',
          })
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err.message || `Could not ${isEdit ? 'update' : 'add'} practice location.`)
    } finally {
      setLocating(false)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-brand-navy">{isEdit ? 'Edit Practice Location' : 'Add Practice Location'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <SelectInput label="Practice type" value={form.practice_type} onChange={set('practice_type')} disabled={isEdit}>
              {PRACTICE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </SelectInput>
            {isEdit && <p className="mt-1 text-[11.5px] text-slate-400">Can't be changed — remove this practice and add it again instead.</p>}
          </div>
          <TextInput label="Practice name" value={form.name} onChange={set('name')} placeholder="e.g. Dr Janesh Home Practice" />
          <TextInput label="City" value={form.city} onChange={set('city')} />
          {feeLocked ? (
            <div>
              <TextInput label="Consultation fee" value={Number(doctor.consultation_fee) || 0} readOnly disabled />
              <p className="mt-1 text-[11.5px] text-slate-400">Change it under Edit Profile — it applies to all your practices.</p>
            </div>
          ) : (
            <TextInput label="Consultation fee" type="number" min="0" value={form.consultation_fee} onChange={set('consultation_fee')} />
          )}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Address</label>
            <AddressAutocomplete
              value={form.address}
              onChange={(val) => setForm((f) => ({ ...f, address: val, latitude: null, longitude: null }))}
              onSelect={(p) => setForm((f) => ({
                ...f,
                address: p.label || f.address,
                city: p.city || f.city,
                latitude: p.lat ?? null,
                longitude: p.lng ?? null,
              }))}
              biasLat={Number(form.latitude) || undefined}
              biasLng={Number(form.longitude) || undefined}
              placeholder={form.practice_type === 'online' ? 'Optional for online consultation' : 'Search this practice on Google Maps…'}
              className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-sm text-brand-navy outline-none transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <ToolButton type="button" onClick={onClose}>Cancel</ToolButton>
          <ToolButton type="submit" tone="primary" disabled={saving || locating}>{locating ? 'Checking address...' : saving ? 'Saving...' : 'Save Practice'}</ToolButton>
        </div>
      </form>
    </div>
  )
}

/** The dashboard's My Profile page. First-login setup no longer renders this —
 *  it has its own three-screen wizard in OnboardingProfile.jsx. */
/** The signature printed on this doctor's prescription PDFs. Only the doctor can
 *  see or change it; the image is fetched as a short-lived private link. */
function SignatureCard({ doctor, onSaved }) {
  const [url, setUrl] = useState(null)
  const id = doctor.doctor_id
  useEffect(() => {
    let active = true
    if (!doctor.has_signature) { setUrl(null); return undefined }
    doctorsApi.signature(id).then((r) => { if (active) setUrl(r?.url || null) }).catch(() => {})
    return () => { active = false }
  }, [id, doctor.has_signature])
  const refresh = async (d) => {
    onSaved(d)
    setUrl(d.has_signature ? (await doctorsApi.signature(id))?.url || null : null)
  }
  return (
    <Card>
      <h3 className="text-[16px] font-bold text-brand-navy">Signature for Prescriptions</h3>
      <p className="mb-3 mt-1 text-[12.5px] text-slate-500">
        Printed above your name on prescription PDFs. Sign on white paper with a dark pen and take a clear photo,
        cropped close to the signature. Only you can see or change it.
      </p>
      <div className="max-w-md">
        <ImageSlotUpload
          title="Your signature"
          url={url}
          aspect="aspect-[3/1]"
          emptyText="No signature yet. PDFs show your name and registration number without one."
          hint="JPG/PNG, up to 3 MB."
          onUpload={async (fd) => refresh(await doctorsApi.uploadSignature(id, fd))}
          onRemove={async () => refresh(await doctorsApi.removeSignature(id))}
        />
      </div>
    </Card>
  )
}

function Profile() {
  const { doctor, hospital, setDoctor, loading } = useDoctorCtx()
  const [editing, setEditing] = useState(false)
  const [editingPractice, setEditingPractice] = useState(null)
  const [practices, setPractices] = useState([])
  const [practiceError, setPracticeError] = useState(null)

  useEffect(() => {
    if (!doctor?.doctor_id) return
    let active = true
    doctorsApi.affiliations({ doctor_id: doctor.doctor_id })
      .then((rows) => { if (active) setPractices((rows || []).filter((p) => p.is_active !== false)) })
      .catch((err) => { if (active) setPracticeError(err.message || 'Could not load practice locations.') })
    return () => { active = false }
  }, [doctor?.doctor_id])

  const upsertPractice = (saved) => {
    setPractices((current) => (
      current.some((p) => p.affiliation_id === saved.affiliation_id)
        ? current.map((p) => (p.affiliation_id === saved.affiliation_id ? saved : p))
        : [...current, saved]
    ))
  }

  /** A hospital owns the address of the practice it runs, so its doctors may read
   *  it but not rewrite it — the same rule the backend enforces. A solo doctor's
   *  personal practice is theirs alone. */
  const mayEdit = (practice) => !practice.managed_by_hospital

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!doctor) return <p className="text-sm text-slate-400">No doctor profile found.</p>

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="My Profile" subtitle="Your practice and hospital details.">
        <ToolButton icon={Pencil} tone="primary" onClick={() => setEditing(true)}>Edit Profile</ToolButton>
      </PageHeading>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="flex flex-col items-center text-center">
          {doctor.profile_photo_url ? (
            <img src={fileUrl(doctor.profile_photo_url)} alt={doctor.name} className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-100" />
          ) : (
            <Avatar name={doctor.name} className="h-20 w-20 text-2xl" />
          )}
          <h3 className="mt-3 text-xl font-extrabold text-brand-navy">{doctor.name}</h3>
          <p className="text-[13px] text-slate-500">{doctor.specialization}</p>
          {doctor.status === 'active' && <p className="mt-1 flex items-center gap-1 text-[13px] text-green-600"><BadgeCheck className="h-4 w-4" /> Active</p>}
          {/* A self-registered doctor is anchored to the default tenant purely
              for row ownership — showing that hospital's name, phone and address
              as if it were theirs is worse than showing nothing. Their real
              place of work is the practice card below. */}
          {hospital && !doctor.is_self_registered && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blueLight text-brand-blue"><Building2 className="h-5 w-5" /></span>
              <div className="text-left">
                <p className="text-[14px] font-bold text-brand-navy">{hospital.name}</p>
                <p className="text-[12px] text-slate-500">{[hospital.city, hospital.state].filter(Boolean).join(', ')}</p>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-[15px] font-bold text-brand-navy">Details</h3>
          <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
            <Row icon={Stethoscope} label="Specialty" value={doctor.specialization} />
            <Row icon={Award} label="Qualification" value={doctor.qualification} />
            <Row icon={BadgeCheck} label="Registration No." value={doctor.registration_number} />
            <Row icon={Fingerprint} label="HPR ID (ABDM)" value={doctor.hpr_id} />
            <Row icon={Award} label="Experience" value={doctor.experience_years != null ? `${doctor.experience_years} years` : ''} />
            <Row icon={IndianRupee} label="Consultation Fee" value={`₹${Number(doctor.consultation_fee)}`} />
            <Row icon={Languages} label="Languages" value={doctor.languages} />
            {hospital && !doctor.is_self_registered && <Row icon={Mail} label="Hospital Email" value={hospital.email} />}
            {hospital && !doctor.is_self_registered && <Row icon={Phone} label="Hospital Phone" value={hospital.phone} />}
            {hospital && !doctor.is_self_registered && <Row icon={MapPin} label="Hospital Address" value={[hospital.address, hospital.city, hospital.state].filter(Boolean).join(', ')} />}
          </div>
          {doctor.bio && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">About</p>
              <p className="mt-1 text-[13.5px] text-slate-600">{doctor.bio}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {/* Shown to EVERY doctor. This was gated on `is_self_registered`, so a
          doctor working under a hospital had no way to see where their own
          practice is registered — the card simply wasn't rendered for them.
          They can't edit it (the hospital owns the address), but they must be
          able to check it: it's the address patients are sent to. */}
      <Card className="h-full">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-brand-navy"><span aria-hidden="true">🏡</span> My Hospital</h3>
            <p className="text-[12.5px] text-slate-500">
              {doctor.is_self_registered
                ? 'Where patients are sent. Keep the address and map pin up to date — travel times are measured from it.'
                : 'Where you practise. Your hospital maintains this address — ask them to update it if anything is wrong.'}
            </p>
          </div>
          {/* No "Add Practice" here for anyone. A hospital-added doctor practises
              where their hospital says they do, and a solo doctor registered the
              one address patients are sent to — a second one added after the
              fact changes where people are told to turn up. Correcting the
              existing address is the real need, and that's the pencil below.
              Adding a location still happens once, during first-login setup. */}
        </div>
        {practiceError && <div className="mb-3"><Banner type="error">{practiceError}</Banner></div>}
        <div className="grid grid-cols-1 gap-4">
          {practices.map((practice) => (
            <div key={practice.affiliation_id} className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-blue-50 via-cyan-50 to-emerald-50 px-5 py-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-blue shadow-sm ring-1 ring-blue-100">
                  <Building2 className="h-6 w-6" />
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 shadow-sm">
                    Registered hospital
                  </span>
                  {/* Edit only, deliberately. A solo doctor usually has exactly
                      one practice — removing it leaves them with no address and
                      nothing a patient can book, with no warning that's what
                      just happened. Correcting the address is the real need. */}
                  {mayEdit(practice) && (
                    <button
                      type="button"
                      title="Edit this practice"
                      onClick={() => setEditingPractice(practice)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-brand-blue shadow-sm ring-1 ring-blue-100 transition-colors hover:bg-white"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="p-5">
                <h4 className="text-[18px] font-extrabold text-brand-navy">{practice.name}</h4>
                <p className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-slate-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                  {[practice.address, practice.city].filter(Boolean).join(', ') || 'Hospital location not added'}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] font-bold text-emerald-700">
                    <IndianRupee className="h-4 w-4" />
                    {Number(practice.consultation_fee || doctor.consultation_fee || 0)} consultation fee
                  </span>
                  {practice.latitude != null && practice.longitude != null ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-[12px] font-semibold text-blue-700">
                      <MapPin className="h-3.5 w-3.5" /> Location verified
                    </span>
                  ) : (
                    // No pin = no map, no distance sort and no "leave by" time
                    // for the patient. Worth saying out loud, not just omitting.
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700">
                      <MapPin className="h-3.5 w-3.5" />
                      {mayEdit(practice) ? 'No map pin — edit to set it' : 'No map pin set'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!practiceError && practices.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
              No practice locations found yet.
            </div>
          )}
        </div>
      </Card>

      <div className="h-full">
        <h3 className="mb-1 flex items-center gap-2 text-[16px] font-bold text-brand-navy"><span aria-hidden="true">🎁</span> Free Revisit</h3>
        <p className="mb-3 text-[12.5px] text-slate-500">Set how many days a patient may return after a paid consultation without another consultation fee.</p>
        <div className="grid grid-cols-1 gap-4">
          {practices.map((practice) => (
            <RevisitWindowCard
              key={practice.affiliation_id}
              row={{
                ...practice,
                practice_name: practice.name,
                days: practice.free_revisit_days,
                editable: !practice.managed_by_hospital,
              }}
              onSaved={() => doctorsApi.affiliations({ doctor_id: doctor.doctor_id }).then((rows) => setPractices((rows || []).filter((p) => p.is_active !== false)))}
            />
          ))}
        </div>
      </div>

      </div>

      <SignatureCard doctor={doctor} onSaved={(d) => setDoctor((prev) => ({ ...prev, ...d }))} />

      {editing && (
        <EditModal
          doctor={doctor}
          feeLocked={practices.some((p) => p.managed_by_hospital)}
          onClose={() => setEditing(false)}
          onSaved={(d) => setDoctor((prev) => ({ ...prev, ...d }))}
        />
      )}

      {editingPractice && (
        <PracticeModal
          key={editingPractice?.affiliation_id ?? 'new'}
          doctor={doctor}
          practice={editingPractice}
          onClose={() => setEditingPractice(null)}
          onSaved={upsertPractice}
        />
      )}
    </div>
  )
}

export default Profile
