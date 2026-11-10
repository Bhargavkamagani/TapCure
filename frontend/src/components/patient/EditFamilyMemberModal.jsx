import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Bell, Camera } from 'lucide-react'
import { Avatar, ToolButton } from '../hospital/ui.jsx'
import { TextInput, SelectInput, Banner } from '../common/FormControls.jsx'
import { patientsApi, fileUrl } from '../../api'
import { useI18n } from '../../i18n/index.jsx'
import { RELATIONS, GENDERS, BLOOD, PHONE_RE, relationTone } from '../../lib/family.js'
import { joinName, nameFields, nameParts } from '../../lib/personName.js'

const blank = { first_name: '', last_name: '', relation: '', gender: '', dob: '', blood_group: '', phone: '', notify_to: 'account' }

/**
 * Add / edit a family member, using the same modal shell as the patient's own
 * <EditProfileModal/> so both edits feel identical.
 *
 * `member` is 'new' or the member row. `family_members` has no photo column, so
 * the profile's photo uploader is replaced by a read-only initials avatar.
 */
export default function EditFamilyMemberModal({ member, patientId, accountPhone, onClose, onSaved }) {
  const { t } = useI18n()
  const isNew = member === 'new'
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Photo: an existing member uploads immediately; a new one has no id yet, so
  // the file is staged and uploaded right after the member is created.
  const [photoUrl, setPhotoUrl] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    if (!member) return
    setError(null)
    setForm(isNew ? blank : {
      first_name: nameParts(member).first, last_name: nameParts(member).last, relation: member.relation || '', gender: member.gender || '',
      dob: member.dob || '', blood_group: member.blood_group || '', phone: member.phone || '',
      notify_to: member.notify_to || 'account',
    })
    setPhotoUrl(isNew ? null : member.photo_url || null)
    setPhotoFile(null)
    setPhotoPreview(null)
  }, [member, isNew])

  // Release the staged file's object URL so we don't leak it.
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  useEffect(() => {
    if (!member) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [member, onClose])

  if (!member) return null

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Digits only. If the number stops being valid, reminders fall back to the account.
  const setPhone = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm((f) => ({ ...f, phone: v, notify_to: PHONE_RE.test(v) ? f.notify_to : 'account' }))
  }

  const phoneValid = PHONE_RE.test(form.phone.trim())

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError(t('ppage.photoNotImage')); return }
    setError(null)

    // No member_id yet — stage it and upload once the member is created.
    if (isNew) {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
      return
    }

    setPhotoBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const updated = await patientsApi.uploadFamilyPhoto(member.member_id, fd)
      setPhotoUrl(updated.photo_url)
      onSaved?.(updated)
    } catch (err) {
      setError(err.message || t('px.couldNotUploadPhoto'))
    } finally {
      setPhotoBusy(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    const phone = form.phone.trim()
    if (!form.first_name.trim()) { setError(t('ppage.firstNameReq')); return }
    if (!form.last_name.trim()) { setError(t('ppage.lastNameReq')); return }
    if (phone && !PHONE_RE.test(phone)) { setError(t('ppage.invalidPhone')); return }
    if (form.notify_to === 'own' && !phone) { setError(t('ppage.notifyNeedsPhone')); return }

    setSaving(true)
    setError(null)
    try {
      // Send every field explicitly so clearing one (e.g. the phone) actually clears it.
      const body = {
        ...nameFields(form.first_name, form.last_name),
        relation: form.relation || '',
        gender: form.gender || null,
        dob: form.dob || null,
        blood_group: form.blood_group || null,
        phone: phone || null,
        notify_to: phone ? form.notify_to : 'account',
      }
      let saved = isNew
        ? await patientsApi.addFamily({ patient_id: patientId, ...body })
        : await patientsApi.updateFamily(member.member_id, body)

      // The staged photo can only be uploaded once the member exists. If it
      // fails, the member is still created — they can add the photo by editing
      // (retrying here would risk creating a duplicate member).
      if (isNew && photoFile && saved?.member_id) {
        try {
          const fd = new FormData()
          fd.append('file', photoFile)
          saved = await patientsApi.uploadFamilyPhoto(saved.member_id, fd)
        } catch { /* keep the created member; photo can be added later */ }
      }

      onSaved?.(saved)
      onClose()
    } catch (err) {
      setError(err.message || t('px.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="theme-patient max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-brand-navy">
            {isNew ? t('ppage.addMember') : t('ppage.editMember')}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}

        {/* Photo — mirrors the patient profile modal's photo block */}
        <div className="mb-5 flex flex-col items-center gap-2">
          <div className="relative">
            {photoPreview || photoUrl ? (
              <img
                src={photoPreview || fileUrl(photoUrl)}
                alt={joinName(form.first_name, form.last_name)}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100"
              />
            ) : (
              <Avatar
                // The form holds first_name / last_name (2026-10-26); there is no
                // `form.name` any more, and reading .trim() off it crashed the modal.
                name={joinName(form.first_name, form.last_name) || '?'}
                tone={relationTone(form.relation)}
                className="h-24 w-24 text-2xl ring-4 ring-slate-100"
              />
            )}
            <label className={`absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-white shadow-md hover:bg-brand-blueDark ${photoBusy ? 'opacity-60' : 'cursor-pointer'}`}>
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={photoBusy} />
            </label>
          </div>
          <p className="text-[13px] text-slate-400">
            {photoBusy ? t('pcommon.uploading') : t('ppage.memberPhotoHint')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="col-span-full grid grid-cols-2 gap-3">
            <TextInput label={t('ppage.firstName')} value={form.first_name} onChange={set('first_name')} />
            <TextInput label={t('ppage.lastName')} placeholder={t('ppage.lastNameHint')} value={form.last_name} onChange={set('last_name')} />
          </div>
          <SelectInput label={t('ppage.relation')} value={form.relation} onChange={set('relation')}>
            <option value="">{t('pcommon.select')}</option>
            {RELATIONS.map((r) => <option key={r} value={r}>{t(`px.rel.${r}`)}</option>)}
          </SelectInput>
          <TextInput label={t('ppage.dob')} type="date" value={form.dob} onChange={set('dob')} />
          <SelectInput label={t('ppage.gender')} value={form.gender} onChange={set('gender')}>
            <option value="">{t('pcommon.select')}</option>
            {GENDERS.map((g) => <option key={g} value={g}>{t(`ppage.gender${g}`)}</option>)}
          </SelectInput>
          <SelectInput label={t('ppage.bloodGroup')} value={form.blood_group} onChange={set('blood_group')}>
            <option value="">{t('pcommon.select')}</option>
            {BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}
          </SelectInput>
          <TextInput
            label={t('ppage.phone')} prefix="+91" inputMode="numeric" maxLength={10}
            value={form.phone} onChange={setPhone}
          />

          {/* Where this member's reminders go */}
          <div className="sm:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <label className={`flex items-start gap-2.5 ${phoneValid ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  checked={form.notify_to === 'own'}
                  disabled={!phoneValid}
                  onChange={(e) => setForm((f) => ({ ...f, notify_to: e.target.checked ? 'own' : 'account' }))}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-brand-blue disabled:opacity-40"
                />
                <span className="leading-snug">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy">
                    <Bell className="h-3.5 w-3.5 text-slate-400" /> {t('ppage.notifyOwn')}
                  </span>
                  <span className="block text-[13px] text-slate-400">
                    {!phoneValid ? t('ppage.notifyNeedsPhone') : t('ppage.notifyOwnHint', { phone: accountPhone || '—' })}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <ToolButton type="button" onClick={onClose}>{t('pcommon.cancel')}</ToolButton>
          <ToolButton type="submit" tone="primary" disabled={saving}>
            {saving ? t('pcommon.saving') : t('ppage.saveChanges')}
          </ToolButton>
        </div>
      </form>
    </div>,
    document.body
  )
}
