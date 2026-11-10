import { useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { Pencil, Phone, Cake, User2, Droplet, MapPin, Globe, ShieldAlert, Fingerprint, X, Camera, Trash2 } from 'lucide-react'
import { Card, Avatar, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { TextInput, SelectInput, Banner } from '../../components/common/FormControls.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { patientsApi, fileUrl } from '../../api'
import { useI18n } from '../../i18n/index.jsx'
import { abhaDigits, abhaError, formatAbha } from '../../lib/abha.js'
import { realEmail } from '../../lib/patientDisplay.js'
import { toMobile } from '../../lib/phone.js'
import { nameFields, nameParts } from '../../lib/personName.js'
import DeleteAccountFlow from '../../components/patient/DeleteAccountFlow.jsx'

/** Display-only name for a stored language value; the value itself is unchanged. */
function langLabel(t, l) {
  if (!l) return l
  const k = `px.lang.${l}`
  const s = t(k)
  return s === k ? l : s
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[13px] font-semibold text-slate-400">{label}</p>
        <p className="text-[13.5px] font-semibold text-brand-navy">{value || '—'}</p>
      </div>
    </div>
  )
}

const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Marathi']
// Must match the backend Literal exactly — schemas/patient.py declares
// Gender = Literal["Male", "Female", "Other"], so lowercase values 422.
const GENDERS = ['Male', 'Female', 'Other']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

/** Edit modal — updates the patient's own record via PUT /patients/{id}. */
// Keyed by the stored value, so the i18n lookup keeps working after the
// capitalisation fix above. Lowercase kept for any legacy rows.
const GENDER_KEYS = {
  Male: 'ppage.genderMale', Female: 'ppage.genderFemale', Other: 'ppage.genderOther',
  male: 'ppage.genderMale', female: 'ppage.genderFemale', other: 'ppage.genderOther',
}

function EditProfileModal({ patient, onClose, onSaved }) {
  const { t } = useI18n()
  const [form, setForm] = useState({
    first_name: nameParts(patient).first,
    last_name: nameParts(patient).last,
    dob: patient.dob || '',
    gender: patient.gender || '',
    blood_group: patient.blood_group || '',
    address: patient.address || '',
    city: patient.city || '',
    pincode: patient.pincode || '',
    emergency_contact_name: patient.emergency_contact_name || '',
    emergency_contact_phone: patient.emergency_contact_phone || '',
    preferred_language: patient.preferred_language || 'English',
    abha_number: patient.abha_number || '',
    abha_address: patient.abha_address || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(patient.photo_url || null)
  const [photoBusy, setPhotoBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'emergency_contact_phone' ? toMobile(e.target.value) : e.target.value }))

  // Photo uploads persist immediately (separate from the Save button).
  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const updated = await patientsApi.uploadPhoto(patient.patient_id, fd)
      setPhotoUrl(updated.photo_url)
      onSaved(updated)
    } catch (err) {
      setError(err.message || t('px.couldNotUploadPhoto'))
    } finally {
      setPhotoBusy(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    // Caught here so the field can be pointed at, instead of coming back as a
    // server validation error once the whole form has been submitted.
    const abhaMsg = abhaError(form.abha_number)
    if (abhaMsg) { setError(abhaMsg); return }
    if (!form.first_name.trim()) { setError(t('ppage.firstNameReq')); return }
    if (!form.last_name.trim()) { setError(t('ppage.lastNameReq')); return }
    setSaving(true)
    setError(null)
    try {
      // Only send filled values; leave the rest untouched server-side.
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))
      if (body.abha_number) body.abha_number = abhaDigits(body.abha_number)
      Object.assign(body, nameFields(form.first_name, form.last_name))
      const updated = await patientsApi.update(patient.patient_id, body)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err.message || t('ppage.couldNotSaveProfile'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-brand-navy">{t('ppage.editProfileTitle')}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}

        {/* Profile photo */}
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="relative">
            {photoUrl ? (
              <img src={fileUrl(photoUrl)} alt={patient.name} className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100" />
            ) : (
              <Avatar name={patient.name} className="h-24 w-24 text-2xl" />
            )}
            <label className={`absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-white shadow-md hover:bg-brand-blueDark ${photoBusy ? 'opacity-60' : 'cursor-pointer'}`}>
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={photoBusy} />
            </label>
          </div>
          <p className="text-[13px] text-slate-400">{photoBusy ? t('pcommon.uploading') : t('px.profile.photoHint')}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="col-span-full grid grid-cols-2 gap-3">
            <TextInput label={t('ppage.firstName')} value={form.first_name} onChange={set('first_name')} />
            <TextInput label={t('ppage.lastName')} placeholder={t('ppage.lastNameHint')} value={form.last_name} onChange={set('last_name')} />
          </div>
          <TextInput label={t('ppage.dob')} type="date" value={form.dob} onChange={set('dob')} />
          <SelectInput label={t('ppage.gender')} value={form.gender} onChange={set('gender')}>
            <option value="">{t('pcommon.select')}</option>
            {GENDERS.map((g) => <option key={g} value={g}>{t(GENDER_KEYS[g])}</option>)}
          </SelectInput>
          <SelectInput label={t('ppage.bloodGroup')} value={form.blood_group} onChange={set('blood_group')}>
            <option value="">{t('pcommon.select')}</option>
            {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
          </SelectInput>
          <SelectInput label={t('ppage.preferredLanguage')} value={form.preferred_language} onChange={set('preferred_language')}>
            {LANGUAGES.map((l) => <option key={l} value={l}>{langLabel(t, l)}</option>)}
          </SelectInput>
          <TextInput label={t('ppage.address')} value={form.address} onChange={set('address')} />
          <TextInput label={t('ppage.city')} value={form.city} onChange={set('city')} />
          <TextInput label={t('ppage.pincode')} value={form.pincode} onChange={set('pincode')} />
          <TextInput label={t('ppage.emergencyName')} value={form.emergency_contact_name} onChange={set('emergency_contact_name')} />
          <TextInput label={t('ppage.emergencyPhone')} inputMode="numeric" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} />

          <div className="mt-1 flex items-center gap-2 sm:col-span-2">
            <Fingerprint className="h-4 w-4 text-brand-green" />
            <span className="text-[13px] font-bold text-brand-navy">{t('ppage.abhaSection')}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[13px] font-semibold text-slate-500">{t('ppage.abhaOptional')}</span>
          </div>
          <TextInput
            label={t('ppage.abhaNumber')}
            value={form.abha_number}
            onChange={set('abha_number')}
            placeholder={t('ppage.abhaNumberHint')}
            inputMode="numeric"
            maxLength={20}
          />
          <TextInput
            label={t('ppage.abhaAddress')}
            value={form.abha_address}
            onChange={set('abha_address')}
            placeholder={t('ppage.abhaAddressHint')}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <ToolButton type="button" onClick={onClose}>{t('pcommon.cancel')}</ToolButton>
          <ToolButton type="submit" tone="primary" disabled={saving}>
            {saving ? t('pcommon.saving') : t('ppage.saveChanges')}
          </ToolButton>
        </div>
      </form>
    </div>
  )
}

/** Patient profile & settings, backed by the logged-in patient's record. */
function Profile() {
  const { t, lang } = useI18n()
  const { patient, loading, setPatient } = usePatientCtx()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (loading) return <p className="text-sm text-slate-400">{t('ppage.loadingProfile')}</p>
  if (!patient) return <p className="text-sm text-slate-400">{t('ppage.noProfile')}</p>

  const dobDisplay = patient.dob
    ? new Date(patient.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.profileTitle')} subtitle={t('ppage.profileSubtitle')}>
        <ToolButton icon={Pencil} tone="primary" onClick={() => setEditing(true)}>{t('ppage.editProfile')}</ToolButton>
      </PageHeading>

      {/* Identity header */}
      <Card className="flex flex-wrap items-center gap-4 p-5">
        {patient.photo_url ? (
          <img src={fileUrl(patient.photo_url)} alt={patient.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-100" />
        ) : (
          <Avatar name={patient.name} className="h-16 w-16 text-xl" />
        )}
        <div className="leading-tight">
          <p className="text-[18px] font-extrabold text-brand-navy">{translitName(patient.name, lang)}</p>
          <p className="text-[13px] text-slate-500">{realEmail(patient) || patient.phone}</p>
          <p className="text-[13.5px] text-slate-400">{patient.phone}</p>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-[13px] font-semibold ${patient.is_registered ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {patient.is_registered ? t('ppage.verifiedPatient') : t('ppage.unverified')}
        </span>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-[15px] font-bold text-brand-navy">{t('ppage.personalInfo')}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field icon={Phone} label={t('ppage.phone')} value={patient.phone} />
            <Field icon={Cake} label={t('ppage.dob')} value={dobDisplay} />
            <Field icon={User2} label={t('ppage.gender')} value={GENDER_KEYS[patient.gender] ? t(GENDER_KEYS[patient.gender]) : patient.gender ? patient.gender[0].toUpperCase() + patient.gender.slice(1) : ''} />
            <Field icon={Droplet} label={t('ppage.bloodGroup')} value={patient.blood_group} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field icon={Globe} label={t('ppage.preferredLanguage')} value={langLabel(t, patient.preferred_language)} />
            <Field icon={MapPin} label={t('ppage.address')} value={[patient.address, patient.city, patient.pincode].filter(Boolean).join(', ')} />
            <Field icon={Fingerprint} label={t('ppage.abhaNumber')} value={formatAbha(patient.abha_number)} />
            <Field icon={Fingerprint} label={t('ppage.abhaAddress')} value={patient.abha_address} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-brand-navy">
            <ShieldAlert className="h-4 w-4 text-red-500" /> {t('ppage.emergencyContact')}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            <Field icon={User2} label={t('ppage.name')} value={translitName(patient.emergency_contact_name, lang)} />
            <Field icon={Phone} label={t('ppage.phone')} value={patient.emergency_contact_phone} />
          </div>

        </Card>
      </div>

      {/* Delete my account — required by Google Play and the App Store. */}
      <Card className="flex flex-wrap items-center gap-4 border-red-100 p-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold text-red-600">{t('adel.cardTitle')}</h3>
          <p className="text-[13px] text-slate-500">{t('adel.cardDesc')}</p>
        </div>
        <ToolButton icon={Trash2} tone="danger" onClick={() => setDeleting(true)}>{t('adel.button')}</ToolButton>
      </Card>

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={() => setDeleting(false)}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-brand-navy">{t('adel.warnTitle')}</h3>
              <button type="button" onClick={() => setDeleting(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <DeleteAccountFlow loggedIn onCancel={() => setDeleting(false)} />
          </div>
        </div>
      )}

      {editing && (
        <EditProfileModal patient={patient} onClose={() => setEditing(false)} onSaved={setPatient} />
      )}
    </div>
  )
}

export default Profile
