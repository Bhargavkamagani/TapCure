import { useEffect, useState } from 'react'
import {
  Building2, Phone, Mail, MapPin, Save, Hash, Navigation, Fingerprint, Pencil, Stethoscope,
  AlertTriangle,
} from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import PhotoUpload from '../../components/common/PhotoUpload.jsx'
import ImageSlotUpload from '../../components/common/ImageSlotUpload.jsx'
import { TextInput, Banner } from '../../components/common/FormControls.jsx'
import HospitalMap from '../../components/common/HospitalMap.jsx'
import ChangeAddressModal from '../../components/hospital/ChangeAddressModal.jsx'
import { hospitalsApi, fileUrl } from '../../api'
import { digitsOnly } from '../../lib/phone.js'
import { InsurancePicker } from '../../components/common/Insurance.jsx'

const EMPTY = {
  name: '', phone: '', email: '', address: '',
  city: '', state: '', pincode: '', hfr_id: '', latitude: '', longitude: '',
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Opening days + OP hours. Doctors can only put sessions inside these, so this
 * card is the source of truth for the hospital's week — it was collected at
 * signup and, until now, had nowhere to be corrected.
 */
function OpeningHoursCard({ hospitalId, onSaved }) {
  const [cfg, setCfg] = useState(null)
  const [days, setDays] = useState([])
  const [open, setOpen] = useState('')
  const [close, setClose] = useState('')
  const [always, setAlways] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null)   // { type, text, conflicts }

  useEffect(() => {
    if (!hospitalId) return
    let active = true
    hospitalsApi.settings(hospitalId)
      .then((s) => {
        if (!active) return
        setCfg(s)
        setAlways(Boolean(s.always_open))
        setDays((s.working_days || '').split(',').map((d) => d.trim()).filter(Boolean))
        setOpen((s.op_start_time || '').slice(0, 5))
        setClose((s.op_end_time || '').slice(0, 5))
      })
      .catch((e) => active && setNote({ type: 'error', text: e.message || 'Could not load opening hours.' }))
    return () => { active = false }
  }, [hospitalId])

  const toggle = (day) => {
    setNote(null)
    setDays((cur) => (cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day]))
  }

  const save = async () => {
    // Neither check applies to a 24/7 hospital: it has no week and no window.
    if (!always && !days.length) {
      setNote({ type: 'error', text: 'Pick at least one open day — a hospital with no open days can’t be booked.' })
      return
    }
    if (!always && open && close && open >= close) {
      setNote({ type: 'error', text: 'Closing time must be after opening time.' })
      return
    }
    setSaving(true)
    setNote(null)
    try {
      // Keep the stored order Mon..Sun regardless of the order they were ticked.
      const ordered = WEEK_DAYS.filter((d) => days.includes(d))
      const saved = await hospitalsApi.updateSettings(hospitalId, {
        always_open: always,
        // A 24/7 hospital stores the full week, because working_days is a
        // separate hard block on doctor sessions from the hours are.
        working_days: always ? WEEK_DAYS.join(',') : ordered.join(','),
        op_start_time: open ? `${open}:00` : null,
        op_end_time: close ? `${close}:00` : null,
      })
      setCfg(saved)
      setDays(ordered)
      onSaved?.(saved)
      setNote(saved.conflicting_sessions
        ? {
            type: 'warn',
            text: `Saved. ${saved.conflicting_sessions} existing doctor session${saved.conflicting_sessions > 1 ? 's' : ''} no longer fit these hours — patients may already hold tokens in them.`,
            conflicts: saved.conflicts || [],
          }
        : { type: 'success', text: 'Opening hours saved.' })
    } catch (e) {
      setNote({ type: 'error', text: e.message || 'Could not save opening hours.' })
    } finally {
      setSaving(false)
    }
  }

  if (!cfg && !note) return null

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-brand-navy">Opening Days & Hours</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            {always
              ? 'Open around the clock — each doctor’s own sessions decide when patients can book.'
              : 'Doctors can only add consulting sessions inside these times.'}
          </p>
        </div>
        <ToolButton type="button" icon={Save} tone="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Hours'}
        </ToolButton>
      </div>

      <div className="mt-4 grid max-w-md grid-cols-2 gap-2">
        {[[true, 'Always open (24/7)'], [false, 'Specific hours']].map(([val, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => { setAlways(val); setNote(null) }}
            aria-pressed={always === val}
            className={`rounded-xl border px-3.5 py-2.5 text-[13px] font-bold transition-colors ${
              always === val
                ? 'border-brand-blue bg-brand-blueLight text-brand-blue'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!always && (
      <>
      <div className="mt-4 flex flex-wrap gap-2">
        {WEEK_DAYS.map((day) => {
          const on = days.includes(day)
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              aria-pressed={on}
              className={`rounded-xl border px-3.5 py-2 text-[13px] font-bold transition-colors ${
                on
                  ? 'border-brand-blue bg-brand-blueLight text-brand-blue'
                  : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Opens at</label>
          <input type="time" value={open} onChange={(e) => { setOpen(e.target.value); setNote(null) }}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-blue" />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Closes at</label>
          <input type="time" value={close} onChange={(e) => { setClose(e.target.value); setNote(null) }}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-blue" />
        </div>
      </div>
      </>
      )}

      {note && (
        <div className={`mt-4 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium ${
          note.type === 'error' ? 'border-red-200 bg-red-50 text-red-600'
            : note.type === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-green-200 bg-green-50 text-green-700'
        }`}>
          <p className="flex items-start gap-1.5">
            {note.type === 'warn' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            {note.text}
          </p>
          {note.conflicts?.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t border-amber-200/70 pt-2 text-[12px] font-normal">
              {note.conflicts.map((c) => <li key={c}>• {c}</li>)}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

/**
 * "Free revisit" — how many days after a paid consultation a patient may come
 * back to the SAME doctor at no charge. Blank means this hospital does not offer
 * it, which is the default: the perk is opt-in per hospital, never switched on
 * globally.
 *
 * The number is a digit-filtered text input rather than <input type="number">
 * on purpose — a focused number input changes value on mouse-wheel scroll, and
 * silently turning a 15-day window into a 5-day one is exactly the kind of bug
 * nobody notices until a patient is refused at the counter.
 */
function FreeRevisitCard({ hospitalId }) {
  const [days, setDays] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null)

  useEffect(() => {
    if (!hospitalId) return undefined
    let active = true
    hospitalsApi.settings(hospitalId)
      .then((s) => {
        if (!active) return
        setDays(s.free_revisit_days == null ? '' : String(s.free_revisit_days))
        setLoaded(true)
      })
      .catch(() => active && setLoaded(true))
    return () => { active = false }
  }, [hospitalId])

  const save = async () => {
    const trimmed = days.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 365)) {
      setNote({ type: 'error', text: 'Enter a number of days between 0 and 365, or leave it blank to turn the offer off.' })
      return
    }
    setSaving(true)
    setNote(null)
    try {
      const saved = await hospitalsApi.updateSettings(hospitalId, { free_revisit_days: value })
      setDays(saved.free_revisit_days == null ? '' : String(saved.free_revisit_days))
      setNote(value
        ? { type: 'success', text: `Saved. Patients may return free within ${value} days of a paid consultation.` }
        : { type: 'success', text: 'Saved. This hospital does not offer a free revisit.' })
    } catch (e) {
      setNote({ type: 'error', text: e.message || 'Could not save the free revisit window.' })
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-brand-navy">Free Revisit</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            After a paid consultation, a patient may see the same doctor again free of
            charge within this many days. They walk in — no booking needed. Leave blank
            to switch the offer off.
          </p>
        </div>
        <ToolButton type="button" icon={Save} tone="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </ToolButton>
      </div>

      <div className="mt-4 sm:max-w-xs">
        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Days</label>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={days}
            placeholder="e.g. 15"
            onChange={(e) => { setDays(e.target.value.replace(/[^0-9]/g, '')); setNote(null) }}
            className="w-32 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-blue"
          />
          <span className="text-[12.5px] text-slate-400">
            {days.trim() === '' ? 'not offered' : 'days from the consultation date'}
          </span>
        </div>
      </div>

      {note && (
        <div className={`mt-4 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium ${
          note.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {note.text}
        </div>
      )}
    </Card>
  )
}


/** Insurance companies + government schemes this hospital accepts (2026-11-03).
 *  Ticked from the one list (no typing); saved on its own. Patients see these
 *  as small logos on the hospital card and can filter by them. */
function InsuranceCard({ hospital, setHospital }) {
  const [codes, setCodes] = useState(hospital.insurance_partners || [])
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null)
  const saved = hospital.insurance_partners || []
  const dirty = codes.length !== saved.length || codes.some((c) => !saved.includes(c))

  const save = async () => {
    setSaving(true)
    setNote(null)
    try {
      const h = await hospitalsApi.update(hospital.hospital_id, { insurance_partners: codes })
      setHospital(h)
      setCodes(h.insurance_partners || [])
      const n = (h.insurance_partners || []).length
      setNote({ type: 'success', text: n ? `Saved. Patients now see ${n} accepted insurance${n > 1 ? 's' : ''} on your hospital card.` : 'Saved. No insurances are shown for this hospital.' })
    } catch (e) {
      setNote({ type: 'error', text: e.message || 'Could not save the insurances.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold text-brand-navy">Insurance &amp; Schemes Accepted</h3>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Tick every insurance company and government scheme your hospital accepts. Patients see
            them on your hospital card and can search by them. TapCure only shows this list —
            claims and approvals stay with your insurance desk.
          </p>
        </div>
        <ToolButton type="button" icon={Save} tone="primary" onClick={save} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save'}
        </ToolButton>
      </div>
      <div className="mt-4">
        <InsurancePicker value={codes} onChange={(v) => { setCodes(v); setNote(null) }} state={hospital.state} />
      </div>
      {note && (
        <div className={`mt-4 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium ${
          note.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {note.text}
        </div>
      )}
    </Card>
  )
}


/** Hospital photo: the picture patients see on the Find Hospitals cards. */
function HospitalPhotoField({ hospital, setHospital }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [broken, setBroken] = useState(false)
  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes((file.type || '').toLowerCase())) { setError('Please choose a JPG or PNG image'); return }
    if (file.size > 3 * 1024 * 1024) { setError('The photo must be 3 MB or smaller'); return }
    const fd = new FormData()
    fd.append('file', file)
    setBusy(true); setError(null)
    try { setHospital(await hospitalsApi.uploadPhoto(hospital.hospital_id, fd)); setBroken(false) } catch (err) { setError(err.message || 'Could not upload the photo') }
    setBusy(false)
  }
  const remove = async () => {
    setBusy(true); setError(null)
    try { setHospital(await hospitalsApi.removePhoto(hospital.hospital_id)) } catch (err) { setError(err.message || 'Could not remove the photo') }
    setBusy(false)
  }
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-[13px] font-semibold text-slate-700">Hospital photo</p>
      <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/60">
        <div className="relative aspect-[16/7] w-full">
          {hospital.photo_url && !broken
            ? <img src={fileUrl(hospital.photo_url)} alt="Hospital" onError={() => setBroken(true)} className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center text-center text-[12.5px] text-slate-400">No photo yet. Patients see this photo when they browse hospitals.</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
          <label className={`inline-flex cursor-pointer items-center rounded-lg bg-brand-blue px-3 py-1.5 text-[13px] font-bold text-white hover:bg-brand-blueDark ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? 'Saving…' : hospital.photo_url ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/png,image/jpeg" onChange={pick} className="sr-only" />
          </label>
          {hospital.photo_url && (
            <button type="button" disabled={busy} onClick={remove} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Remove</button>
          )}
          <span className="text-[11.5px] text-slate-400">JPG or PNG, up to 3 MB. A wide photo of the building or reception works best.</span>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

/** The printed prescription's top and bottom. Both optional: with no header the
 *  PDF builds one from the logo, name, address and phone saved above. */
function LetterheadCard({ hospital, setHospital }) {
  const id = hospital.hospital_id
  return (
    <Card className="p-5">
      <h3 className="text-[16px] font-bold text-brand-navy">Prescription Letterhead</h3>
      <p className="mt-1 text-[12.5px] text-slate-500">
        Printed on every prescription PDF your doctors give patients. Have a printed letterhead? Upload a scan or design of
        its top and bottom. If you skip this, we make one from your logo, hospital name, address and phone.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ImageSlotUpload
          title="Header (top of the page)"
          url={hospital.letterhead_header_url}
          emptyText="Not uploaded. The PDF uses your logo, name, address and phone."
          hint="Wide JPG/PNG, up to 3 MB (about 2000 × 330 px)."
          onUpload={async (fd) => setHospital(await hospitalsApi.uploadLetterhead(id, 'header', fd))}
          onRemove={async () => setHospital(await hospitalsApi.removeLetterhead(id, 'header'))}
        />
        <ImageSlotUpload
          title="Footer (bottom of the page, optional)"
          url={hospital.letterhead_footer_url}
          emptyText="Not uploaded. Nothing extra at the bottom."
          hint="Wide JPG/PNG, up to 3 MB (about 2000 × 200 px)."
          onUpload={async (fd) => setHospital(await hospitalsApi.uploadLetterhead(id, 'footer', fd))}
          onRemove={async () => setHospital(await hospitalsApi.removeLetterhead(id, 'footer'))}
        />
      </div>
    </Card>
  )
}

function HospitalProfile() {
  const [hospital, setHospital] = useState(null)   // raw record (for id + short_code)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState(null)    // { type, text }
  const [editingAddress, setEditingAddress] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const list = await hospitalsApi.list()
        const mine = (list || [])[0] || null
        if (!active) return
        setHospital(mine)
        if (mine) {
          setForm({
            name: mine.name || '', phone: mine.phone || '', email: mine.email || '',
            address: mine.address || '', city: mine.city || '', state: mine.state || '',
            pincode: mine.pincode || '', hfr_id: mine.hfr_id || '',
            latitude: mine.latitude ?? '', longitude: mine.longitude ?? '',
          })
        }
      } catch (e) {
        if (active) setBanner({ type: 'error', text: e.message || 'Could not load hospital.' })
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setBanner(null)
  }

  /** Reflect whatever the server stored, so the page never shows a value that
   *  didn't persist. */
  const applySaved = (saved) => {
    setHospital(saved)
    setForm((f) => ({
      ...f,
      address: saved.address || '', city: saved.city || '', state: saved.state || '',
      pincode: saved.pincode || '',
      latitude: saved.latitude ?? '', longitude: saved.longitude ?? '',
    }))
  }

  // The address is saved on its own, from the picker — it cascades to the
  // doctors practising here, so it shouldn't ride along with unrelated edits.
  const saveAddress = async (addr) => {
    const saved = await hospitalsApi.update(hospital.hospital_id, {
      address: addr.address, city: addr.city, state: addr.state, pincode: addr.pincode,
      latitude: addr.latitude ?? null, longitude: addr.longitude ?? null,
    })
    applySaved(saved)
    setEditingAddress(false)
    const n = saved.doctors_synced || 0
    setBanner({
      type: 'success',
      text: 'Hospital address updated.'
        + (n ? ` ${n} doctor${n > 1 ? 's' : ''} at this hospital now show the new location to patients.` : '')
        + (addr.latitude == null ? ' No map pin was found — patients won’t get travel times until one is set.' : ''),
    })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!hospital) return
    setSaving(true)
    setBanner(null)
    try {
      const saved = await hospitalsApi.update(hospital.hospital_id, {
        name: form.name, phone: form.phone, email: form.email || null,
        hfr_id: form.hfr_id || null,
      })
      applySaved(saved)
      setBanner({ type: 'success', text: 'Hospital profile saved.' })
    } catch (err) {
      setBanner({ type: 'error', text: err.message || 'Could not save changes.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!hospital) return <Banner type="error">No hospital linked to this account.</Banner>

  const hasLocation = form.latitude !== '' && form.longitude !== ''

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <PageHeading title="Hospital Profile" subtitle="Update your hospital's details and map location.">
        <ToolButton type="submit" icon={Save} tone="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </ToolButton>
      </PageHeading>

      {banner && <Banner type={banner.type}>{banner.text}</Banner>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        {/* Details */}
        <Card className="p-5">
          <h3 className="mb-4 text-[16px] font-bold text-brand-navy">Hospital Details</h3>
          <div className="mb-5 flex justify-center">
            <PhotoUpload
              url={hospital.logo_url}
              name={form.name || hospital.name}
              rounded="rounded-2xl"
              label="Tap the camera to add or change your hospital logo"
              onUpload={async (fd) => { const h = await hospitalsApi.uploadLogo(hospital.hospital_id, fd); setHospital(h); return h.logo_url }}
            />
          </div>
          <HospitalPhotoField hospital={hospital} setHospital={setHospital} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput label="Hospital Name" icon={Building2} value={form.name} onChange={set('name')} />
            <TextInput label="Hospital Code" icon={Hash} value={hospital.short_code || ''} disabled />
            {/* Digits only; up to 12 so a landline with its STD code fits. */}
            <TextInput label="Phone" icon={Phone} inputMode="numeric" value={form.phone} onChange={(e) => set('phone')({ target: { value: digitsOnly(e.target.value, 12) } })} />
            <TextInput label="Email" icon={Mail} value={form.email} onChange={set('email')} />
            <div className="md:col-span-2">
              <TextInput label="HFR ID — Health Facility Registry (optional)" icon={Fingerprint} value={form.hfr_id} onChange={set('hfr_id')} placeholder="ABDM facility ID, if registered" />
            </div>
          </div>
        </Card>

        {/* Address + map */}
        <Card className="h-fit p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-bold text-brand-navy">Hospital Address</h3>
              <p className="mt-1 text-[12.5px] text-slate-500">
                What patients see, and where their travel time is measured to.
              </p>
            </div>
            <ToolButton type="button" icon={Pencil} onClick={() => setEditingAddress(true)}>Change</ToolButton>
          </div>

          <div className="mt-4 flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-blueLight text-brand-blue">
              <MapPin className="h-4 w-4" />
            </span>
            <p className="text-[13.5px] font-medium leading-snug text-brand-navy">
              {form.address || <span className="text-slate-400">No address set yet.</span>}
              {[form.city, form.state, form.pincode].filter(Boolean).length > 0 && (
                <span className="mt-0.5 block text-[12.5px] font-normal text-slate-500">
                  {[form.city, form.state, form.pincode].filter(Boolean).join(', ')}
                </span>
              )}
            </p>
          </div>

          <HospitalMap
            hospital={{ latitude: form.latitude === '' ? null : form.latitude, longitude: form.longitude === '' ? null : form.longitude }}
            hospitalLabel={form.name || hospital.name}
            hospitalLogo={hospital.logo_url || null}
            height={190}
            className="mt-4 overflow-hidden rounded-xl"
          />

          <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${
            hasLocation ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            <Navigation className="h-4 w-4" />
            {hasLocation ? 'Location set — travel estimates enabled.' : 'No location yet — patients won’t get a leave-by time.'}
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-slate-400">
            <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Changing this updates the practice location of every doctor at this hospital.
          </p>
        </Card>
      </div>

      {/* Opening days/hours — saved separately; doctors' sessions must fit them. */}
      <OpeningHoursCard hospitalId={hospital.hospital_id} />
      <FreeRevisitCard hospitalId={hospital.hospital_id} />
      <InsuranceCard hospital={hospital} setHospital={setHospital} />
      <LetterheadCard hospital={hospital} setHospital={setHospital} />

      {editingAddress && (
        <ChangeAddressModal
          hospital={{ ...hospital, ...form }}
          onClose={() => setEditingAddress(false)}
          onConfirm={saveAddress}
        />
      )}
    </form>
  )
}

export default HospitalProfile
