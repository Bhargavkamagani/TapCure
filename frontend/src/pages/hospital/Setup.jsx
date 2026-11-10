import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Plus, Camera, Clock, Stethoscope, MapPin, Phone, Pencil, X, ArrowRight, ShieldCheck } from 'lucide-react'
import Wordmark from '../../components/common/Wordmark.jsx'
import { hospitalsApi, departmentsApi, fileUrl } from '../../api'
import { SPECIALIZATIONS, SERVICE_OPTIONS } from '../../data/authData.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { InsurancePicker, InsuranceList } from '../../components/common/Insurance.jsx'
import { useHospitalSetup, rememberHours, remember, LATER_KEY, pickedServices } from '../../components/hospital/HospitalSetupStatus.jsx'

/**
 * Complete your profile — what a hospital owner sees after approval (2026-11-10).
 * No form and no steps: the page shows the hospital's card the way patients see
 * it, and the owner taps its empty parts to fill them — photo, logo, hours,
 * services. Everything signup already gave us (owner, hospital name, address,
 * phone, email, registration number) is filled in and shown as such. Pictures save as soon as they are picked; hours and services save
 * with "Save and go live". "Skip for now" opens the dashboard, where a small bar
 * keeps count until all three are done.
 */

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
// 30-minute steps, shown as 9:00 AM rather than 09:00.
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const ICONS = new Map(SERVICE_OPTIONS.map((o) => [o.label, o.icon]))
const COMMON = SPECIALIZATIONS.filter((n) => ICONS.has(n))
const norm = (s) => (s || '').trim().toLowerCase()
const ampm = (hhmm) => {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
}
const dayRange = (days) => {
  const on = WEEK_DAYS.filter((d) => days.includes(d))
  if (on.length === 7) return 'Every day'
  const run = on.length > 2 && WEEK_DAYS.indexOf(on[on.length - 1]) - WEEK_DAYS.indexOf(on[0]) === on.length - 1
  return run ? `${on[0]}–${on[on.length - 1]}` : on.join(', ')
}

/** The dashed "+ Add …" button that marks an empty part of the card. */
function AddSpot({ icon: Icon, children, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="group inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/60 px-3.5 py-2 text-[14.5px] font-bold text-teal-700 transition hover:border-teal-500 hover:bg-teal-50">
      <Icon className="h-4 w-4" /><Plus className="-ml-1 h-3.5 w-3.5" />{children}
    </button>
  )
}

/** A file picker wrapped around any part of the card. Checks type and size here. */
function PickImage({ onFile, className, children, label }) {
  return (
    <label className={`cursor-pointer ${className}`} aria-label={label}>
      {children}
      <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} />
    </label>
  )
}

export default function HospitalSetup() {
  const navigate = useNavigate()
  const setup = useHospitalSetup()
  const { user } = useAuth()
  const { hospital, settings, departments, steps, loading } = setup
  const [edit, setEdit] = useState(null)     // 'hours' | 'services' | 'insurance' | null
  const [busy, setBusy] = useState(null)     // 'logo' | 'photo' | 'save'
  const [error, setError] = useState(null)
  const [live, setLive] = useState(false)
  const [bad, setBad] = useState({})

  // hours: null until the owner touches them (or they were already saved)
  const [hours, setHours] = useState(null)   // { always, days, open, close }
  const [picked, setPicked] = useState([])
  const [query, setQuery] = useState('')    // search over all services
  // Insurance & schemes accepted (2026-11-10): optional, not one of the 3 steps.
  // null until the hospital loads, then a copy of what is saved.
  const [insurers, setInsurers] = useState(null)
  useEffect(() => {
    if (hospital && insurers === null) setInsurers(hospital.insurance_partners || [])
  }, [hospital, insurers])

  useEffect(() => {
    if (!settings || hours) return
    if (steps.hours) {
      setHours({
        always: settings.always_open,
        days: (settings.working_days || '').split(',').map((d) => d.trim()).filter(Boolean),
        open: (settings.op_start_time || '09:00').slice(0, 5),
        close: (settings.op_end_time || '20:00').slice(0, 5),
      })
    }
  }, [settings, steps.hours, hours])

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#EEF5F4]"><div className="h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600/20 border-t-teal-600" /></div>
  if (!hospital) return <p className="p-8 text-slate-500">No hospital linked to this account.</p>

  // The auto "General OPD" is hidden here and not counted (see pickedServices),
  // but still blocks picking a duplicate of it.
  const have = pickedServices(departments).map((d) => d.name)
  const haveSet = new Set(departments.filter((d) => d.is_active !== false).map((d) => norm(d.name)))
  const services = [...have, ...picked]
  const photo = hospital.photo_url && !bad.photo
  const logo = hospital.logo_url && !bad.logo
  const filled = [Boolean(photo || logo), Boolean(hours), services.length > 0]
  const count = filled.filter(Boolean).length
  const firstName = (user?.name || '').trim().split(/\s+/)[0]
  const phone = (hospital.phone || '').replace(/^(\d{5})(\d{5})$/, '$1 $2')
  // What signup already told us, shown so the owner knows it is done.
  const fromSignup = [
    ['Owner', user?.name],
    ['Phone', phone],
    ['Email', hospital.email],
    ['Reg. no.', hospital.registration_number],
  ].filter(([, v]) => v)
  const hoursText = hours ? (hours.always ? 'Open 24/7' : `${dayRange(hours.days)} · ${ampm(hours.open)} – ${ampm(hours.close)}`) : ''

  const upload = (kind) => async (file) => {
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes((file.type || '').toLowerCase())) { setError('Please choose a JPG or PNG image.'); return }
    if (file.size > 3 * 1024 * 1024) { setError('The picture must be 3 MB or smaller.'); return }
    const fd = new FormData()
    fd.append('file', file)
    setBusy(kind); setError(null)
    try {
      setup.setHospital(await (kind === 'logo' ? hospitalsApi.uploadLogo : hospitalsApi.uploadPhoto)(hospital.hospital_id, fd))
      setBad((b) => ({ ...b, [kind]: false }))
    } catch (err) { setError(err.message || 'Could not upload the picture.') }
    setBusy(null)
  }

  const openHours = () => {
    setError(null)
    // Starts on the most common week: Mon–Sat, 9 AM to 8 PM.
    if (!hours) setHours({ always: false, days: WEEK_DAYS.slice(0, 6), open: '09:00', close: '20:00' })
    setEdit('hours')
  }
  const setHour = (patch) => setHours((h) => ({ ...h, ...patch }))
  // ‹ › move a time by 30 minutes, kept inside the day.
  const step = (key, by) => setHour({ [key]: TIMES[Math.min(TIMES.length - 1, Math.max(0, TIMES.indexOf(hours[key]) + by))] })
  const mins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
  const toggle = (name) => { setError(null); setPicked((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name])) }

  const save = async () => {
    if (hours && !hours.always && !hours.days.length) { setError('Pick at least one open day.'); setEdit('hours'); return }
    if (hours && !hours.always && hours.open >= hours.close) { setError('Closing time must be after opening time.'); setEdit('hours'); return }
    setBusy('save'); setError(null)
    try {
      if (hours) {
        await hospitalsApi.updateSettings(hospital.hospital_id, {
          always_open: hours.always,
          working_days: hours.always ? WEEK_DAYS.join(',') : WEEK_DAYS.filter((d) => hours.days.includes(d)).join(','),
          op_start_time: `${hours.open}:00`,
          op_end_time: `${hours.close}:00`,
        })
        if (hours.always) rememberHours(hospital.hospital_id)
      }
      const savedIns = hospital.insurance_partners || []
      if (insurers && (insurers.length !== savedIns.length || insurers.some((c) => !savedIns.includes(c)))) {
        setup.setHospital(await hospitalsApi.update(hospital.hospital_id, { insurance_partners: insurers }))
      }
      for (const name of picked) await departmentsApi.create({ hospital_id: hospital.hospital_id, name, code: '', floor: '', description: '' })
      setPicked([])
      await setup.refresh()
      setEdit(null)
      setLive(true)
    } catch (e) { setError(e.message || 'Could not save. Please try again.') }
    setBusy(null)
  }
  const later = () => { remember(sessionStorage, LATER_KEY); navigate('/hospital-dashboard') }


  return (
    <div className="min-h-screen bg-[#EEF5F4] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(13,148,136,.16),transparent_70%)] px-4 pb-16 pt-6">
      <div className="mx-auto flex max-w-[600px] items-center justify-between">
        <Wordmark className="text-[20px]" />
        {!live && <button type="button" onClick={later} className="rounded-lg px-2 py-1 text-[14px] font-semibold text-slate-500 hover:bg-white hover:text-brand-navy">Skip for now</button>}
      </div>

      <div className="mx-auto mt-8 max-w-[600px] text-center">
        {live && hospital.profile_completed_at ? (
          <>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[13px] font-bold text-emerald-700"><i className="h-2 w-2 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" /> Live</p>
            <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.02em] text-brand-navy sm:text-[32px]">{hospital.name} is live!</h1>
            <p className="mt-1.5 text-[16px] text-slate-500">This is the card patients now see when they look for a hospital.</p>
          </>
        ) : (
          <>
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-brand-navy sm:text-[32px]">{firstName ? `Welcome, ${firstName}!` : 'Welcome!'}</h1>
            <p className="mt-1.5 text-[16px] text-slate-500">This is how patients will see {hospital.name}. We filled in what you gave us at sign-up. Just tap the empty parts.</p>
            {fromSignup.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Already filled from your sign-up">
                {fromSignup.map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] text-slate-500 ring-1 ring-slate-900/5">
                    <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />{k}: <b className="font-semibold text-brand-navy">{v}</b>
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── the card ── */}
      <div className="mx-auto mt-7 max-w-[560px] overflow-hidden rounded-[28px] bg-white shadow-[0_40px_80px_-40px_rgba(11,33,80,.45)] ring-1 ring-slate-900/5">
        {/* photo */}
        <PickImage onFile={upload('photo')} label="Add or change the hospital photo" className="group relative block aspect-[16/8] bg-gradient-to-br from-teal-50 via-white to-sky-50">
          {photo ? (
            <>
              <img src={fileUrl(hospital.photo_url)} alt="" onError={() => setBad((b) => ({ ...b, photo: true }))} className="absolute inset-0 h-full w-full object-cover" />
              {!live && <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-[13px] font-bold text-brand-navy opacity-90 shadow group-hover:opacity-100"><Camera className="h-3.5 w-3.5" />{busy === 'photo' ? 'Saving…' : 'Change'}</span>}
            </>
          ) : (
            <span className="absolute inset-4 grid place-content-center justify-items-center gap-2 rounded-2xl border-2 border-dashed border-teal-300 text-center transition group-hover:border-teal-500 group-hover:bg-teal-50/50">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-teal-600 shadow-sm"><Camera className="h-5 w-5" /></span>
              <b className="text-[15px] text-teal-800">{busy === 'photo' ? 'Saving…' : 'Tap to add a photo of your hospital'}</b>
              <span className="text-[13px] text-slate-400">Building or reception · JPG or PNG, up to 3 MB</span>
            </span>
          )}
        </PickImage>

        <div className="relative px-6 pb-6 pt-11">
          {/* logo, sitting on the edge of the photo */}
          <PickImage onFile={upload('logo')} label="Add or change the logo" className="group absolute -top-9 left-6">
            <span className={`grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-2xl border-4 border-white shadow-md ${logo ? 'bg-white' : 'bg-teal-50'}`}>
              {logo
                ? <img src={fileUrl(hospital.logo_url)} alt="" onError={() => setBad((b) => ({ ...b, logo: true }))} className="h-full w-full object-contain" />
                : <span className="grid justify-items-center text-teal-700"><Plus className="h-5 w-5" /><b className="text-[11px]">{busy === 'logo' ? 'Saving' : 'Logo'}</b></span>}
            </span>
          </PickImage>

          <h2 className="text-[22px] font-extrabold tracking-[-0.01em] text-brand-navy">{hospital.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-slate-500"><MapPin className="h-4 w-4 shrink-0" />{[hospital.address, hospital.city].filter(Boolean).join(', ')}</p>
          {phone && <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-slate-500"><Phone className="h-4 w-4 shrink-0" />{phone}</p>}

          {/* hours */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            {hours && edit !== 'hours' ? (
              <button type="button" onClick={openHours} disabled={live} className="group flex w-full items-center gap-2.5 text-left">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Clock className="h-[18px] w-[18px]" /></span>
                <b className="text-[15.5px] text-brand-navy">{hoursText}</b>
                {!live && <Pencil className="ml-auto h-4 w-4 text-slate-300 group-hover:text-slate-500" />}
              </button>
            ) : edit !== 'hours' && <AddSpot icon={Clock} onClick={openHours}>Add your hours</AddSpot>}

            {edit === 'hours' && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <b className="flex items-center gap-2 text-[15px] text-brand-navy"><Clock className="h-4 w-4 text-teal-600" /> When are you open?</b>
                  <span className="flex items-center gap-3">
                    <button type="button" role="switch" aria-checked={hours.always} onClick={() => setHour({ always: !hours.always })} className="flex items-center gap-2 text-[13.5px] font-bold text-slate-600">
                      24/7
                      <span className={`relative h-6 w-10 rounded-full transition ${hours.always ? 'bg-teal-600' : 'bg-slate-300'}`}>
                        <i className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${hours.always ? 'left-[18px]' : 'left-0.5'}`} />
                      </span>
                    </button>
                    <button type="button" onClick={() => setEdit(null)} className="rounded-lg bg-teal-600 px-3 py-1.5 text-[13.5px] font-bold text-white">Done</button>
                  </span>
                </div>
                {hours.always ? (
                  <p className="mt-3 rounded-xl bg-white px-4 py-3 text-[14.5px] text-slate-600 ring-1 ring-slate-200">Open day and night, every day. Each doctor's own sessions decide when patients can book.</p>
                ) : (
                  <>
                    {/* the week: tap a day to close it */}
                    <div className="mt-4 grid grid-cols-7 gap-1.5">
                      {WEEK_DAYS.map((d) => {
                        const on = hours.days.includes(d)
                        return (
                          <button key={d} type="button" aria-pressed={on} onClick={() => setHour({ days: on ? hours.days.filter((x) => x !== d) : [...hours.days, d] })}
                            className={`rounded-xl py-2 text-center transition ${on ? 'bg-white text-brand-navy shadow-sm ring-1 ring-teal-200' : 'text-slate-400 hover:bg-white/60'}`}>
                            <b className="block text-[14px]">{d}</b>
                            <span className={`text-[11.5px] font-semibold ${on ? 'text-teal-600' : 'text-slate-400'}`}>{on ? 'Open' : 'Closed'}</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* opening and closing time, 30 minutes per tap */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[['open', 'Opens'], ['close', 'Closes']].map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between rounded-xl bg-white px-2 py-1.5 ring-1 ring-slate-200">
                          <button type="button" aria-label={`${label} earlier`} onClick={() => step(key, -1)} className="grid h-9 w-9 place-items-center rounded-lg text-[20px] font-bold text-teal-700 hover:bg-teal-50">‹</button>
                          <span className="text-center">
                            <span className="block text-[11.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</span>
                            <b className="text-[16px] tabular-nums text-brand-navy">{ampm(hours[key])}</b>
                          </span>
                          <button type="button" aria-label={`${label} later`} onClick={() => step(key, 1)} className="grid h-9 w-9 place-items-center rounded-lg text-[20px] font-bold text-teal-700 hover:bg-teal-50">›</button>
                        </div>
                      ))}
                    </div>

                    {/* the day as a bar, so the hours can be seen at a glance */}
                    <div className="mt-4" aria-hidden="true">
                      <div className="relative h-3 rounded-full bg-slate-200">
                        <i className="absolute inset-y-0 rounded-full bg-gradient-to-r from-amber-300 via-teal-400 to-teal-600 transition-all"
                          style={{ left: `${(mins(hours.open) / 1440) * 100}%`, width: `${Math.max(0, (mins(hours.close) - mins(hours.open)) / 1440) * 100}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11.5px] font-semibold text-slate-400">
                        <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* services */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            {services.length > 0 && edit !== 'services' && (
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600"><Stethoscope className="h-[18px] w-[18px]" /></span>
                <div className="flex flex-1 flex-wrap items-center gap-2 pt-0.5">
                {services.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-3 py-1.5 text-[14px] font-semibold text-teal-800">
                    {s}
                    {picked.includes(s) && !live && <button type="button" aria-label={`Remove ${s}`} onClick={() => toggle(s)} className="text-teal-500 hover:text-teal-800"><X className="h-3.5 w-3.5" /></button>}
                  </span>
                ))}
                {!live && edit !== 'services' && <button type="button" onClick={() => setEdit('services')} className="rounded-xl px-2 py-1.5 text-[14px] font-bold text-teal-700 hover:bg-teal-50">+ Add more</button>}
                </div>
              </div>
            )}
            {!services.length && edit !== 'services' && <AddSpot icon={Stethoscope} onClick={() => setEdit('services')}>Add your services</AddSpot>}

            {edit === 'services' && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <b className="flex items-center gap-2 text-[15px] text-brand-navy"><Stethoscope className="h-4 w-4 text-teal-600" /> Which services do you offer?</b>
                  <span className="flex items-center gap-3">
                    <span className="text-[13.5px] font-semibold text-slate-500">{services.length} selected</span>
                    <button type="button" onClick={() => { setEdit(null); setQuery('') }} className="rounded-lg bg-teal-600 px-3 py-1.5 text-[13.5px] font-bold text-white">Done</button>
                  </span>
                </div>
                {/* the common ones as a tidy list; anything else is one search away */}
                <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {(query.trim() ? SPECIALIZATIONS.filter((n) => norm(n).includes(norm(query))) : COMMON).map((name) => {
                    const added = haveSet.has(norm(name))
                    const on = added || picked.includes(name)
                    return (
                      <button key={name} type="button" aria-pressed={on} disabled={added} onClick={() => toggle(name)}
                        className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] transition ${on ? 'bg-white font-semibold text-brand-navy shadow-sm' : 'text-slate-600 hover:bg-white/70'}`}>
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? 'bg-teal-600 text-white' : 'ring-2 ring-inset ring-slate-300'}`}>{on && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
                        {name}
                      </button>
                    )
                  })}
                  {query.trim() && !SPECIALIZATIONS.some((n) => norm(n).includes(norm(query))) && <p className="col-span-full px-2.5 py-2 text-[14px] text-slate-400">No service called “{query}”.</p>}
                </div>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search all ${SPECIALIZATIONS.length} services…`} aria-label="Search services"
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14.5px] text-brand-navy placeholder:text-slate-400 focus:border-teal-500 focus:outline-none" />
              </div>
            )}
          </div>

          {/* insurance & schemes — optional, saved with the rest */}
          <div className="mt-4 border-t border-slate-100 pt-4">
            {edit !== 'insurance' && (insurers?.length ? (
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600"><ShieldCheck className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <InsuranceList codes={insurers} showDisclaimer={false} />
                  {!live && <button type="button" onClick={() => setEdit('insurance')} className="mt-1 rounded-xl px-2 py-1.5 text-[14px] font-bold text-teal-700 hover:bg-teal-50">Change</button>}
                </div>
              </div>
            ) : (
              !live && <AddSpot icon={ShieldCheck} onClick={() => setEdit('insurance')}>Add insurance &amp; schemes you accept (optional)</AddSpot>
            ))}

            {edit === 'insurance' && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <b className="flex items-center gap-2 text-[15px] text-brand-navy"><ShieldCheck className="h-4 w-4 text-teal-600" /> Which insurance &amp; schemes do you accept?</b>
                  <span className="flex items-center gap-3">
                    <span className="text-[13.5px] font-semibold text-slate-500">{(insurers || []).length} selected</span>
                    <button type="button" onClick={() => setEdit(null)} className="rounded-lg bg-teal-600 px-3 py-1.5 text-[13.5px] font-bold text-white">Done</button>
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-slate-500">Patients see these on your hospital card and can search by them.</p>
                <div className="mt-3">
                  <InsurancePicker value={insurers || []} onChange={setInsurers} state={hospital.state} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mx-auto mt-4 max-w-[560px] rounded-2xl bg-red-50 px-4 py-3 text-center text-[14.5px] font-semibold text-red-600">{error}</p>}

      {/* ── the one button ── */}
      <div className="mx-auto mt-7 grid max-w-[560px] justify-items-center gap-3">
        {live ? (
          <button type="button" onClick={() => navigate('/hospital-dashboard')} className="inline-flex items-center gap-2 rounded-2xl bg-brand-navy px-7 py-3.5 text-[16px] font-bold text-white shadow-lg hover:brightness-110">
            Go to my dashboard <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-500" aria-live="polite">
              {filled.map((on, i) => <i key={i} className={`h-2 w-8 rounded-full ${on ? 'bg-teal-500' : 'bg-slate-200'}`} />)}
              <span className="ml-1">{count} of 3 added</span>
            </div>
            <button type="button" onClick={save} disabled={busy === 'save' || count === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-brand-blue px-7 py-3.5 text-[16px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(13,148,136,.9)] transition hover:brightness-105 disabled:opacity-50">
              {busy === 'save' ? 'Saving…' : <>Save and go live <Check className="h-4 w-4" strokeWidth={3} /></>}
            </button>
            <p className="text-[13px] text-slate-400">You can change all of this later in Hospital Profile.</p>
          </>
        )}
      </div>
    </div>
  )
}
