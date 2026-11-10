import { useEffect, useState } from 'react'
import {
  X, Building2, MapPin, User, Clock, Stethoscope, ShieldCheck,
  CalendarDays, ExternalLink, CheckCircle2, XCircle, ImageOff,
} from 'lucide-react'
import { hospitalsApi, fileUrl } from '../../api'
import HospitalMap from '../common/HospitalMap.jsx'
import { InsuranceList } from '../common/Insurance.jsx'

/**
 * Everything a hospital submitted at sign-up, for the Super Admin (2026-10-01).
 *
 * The Approvals list showed the name and licence number, and the Hospitals page
 * part of the rest; the owner's account, opening hours, consultation time,
 * chosen services and consent were never shown anywhere. One call to
 * GET /hospitals/{id}/registration gathers them.
 *
 * `onApprove` / `onReject` (optional): shown for a pending hospital so the admin
 * can decide right after reviewing.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Server datetimes, shown in hospital-local (IST) time.
function dateTimeIST(iso) {
  if (!iso) return null
  const d = new Date(/[Z]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

// "17:00" → "5:00 PM"
function time12(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h)) return hhmm
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      {children}
    </section>
  )
}

function Field({ label, value, missing = 'Not provided' }) {
  return (
    <div className="grid grid-cols-[9.5rem_1fr] gap-3 py-1 text-[13px]">
      <dt className="text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-brand-navy">
        {value || value === 0 ? value : <span className="font-normal italic text-slate-400">{missing}</span>}
      </dd>
    </div>
  )
}

export default function HospitalRegistrationDetails({ hospitalId, onClose, onApprove, onReject, busy = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    hospitalsApi.registration(hospitalId)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError(e.message || 'Could not load the registration details.') })
    return () => { alive = false }
  }, [hospitalId])

  // Esc closes, like the other dialogs.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tm = data?.timings || {}
  const pending = data?.status === 'pending'
  const hasPin = data?.latitude != null && data?.longitude != null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Registration details"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-slate-50 shadow-xl"
      >
        {/* Header: logo, name, status */}
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            {data?.logo_url
              ? <img src={fileUrl(data.logo_url)} alt={`${data.name} logo`} className="h-full w-full object-contain" />
              : <ImageOff className="h-6 w-6 text-slate-300" aria-label="No logo uploaded" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-extrabold text-brand-navy">{data?.name || 'Registration details'}</p>
            {data && (
              <p className="mt-0.5 text-[12.5px] text-slate-500">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${pending ? 'bg-amber-100 text-amber-700' : data.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                  {data.status}
                </span>
                Registered {dateTimeIST(data.registered_at) || '—'}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-6">
          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}
          {!data && !error && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}

          {data && (
            <>
              <Section icon={Building2} title="Hospital">
                <dl>
                  <Field label="Hospital name" value={data.name} />
                  <Field label="Registration no." value={data.registration_number} />
                  <Field label="HFR ID" value={data.hfr_id} />
                  <Field label="GSTIN" value={data.gstin} />
                  <Field label="Short code" value={data.short_code} />
                  <Field label="Hospital phone" value={data.phone} />
                  <Field label="Hospital email" value={data.email} />
                </dl>
              </Section>

              <Section icon={MapPin} title="Location">
                <dl>
                  <Field label="Address" value={data.address} />
                  <Field label="City" value={data.city} />
                  <Field label="State" value={data.state} />
                  <Field label="Pincode" value={data.pincode} />
                  <Field label="Map pin" value={hasPin ? `${Number(data.latitude).toFixed(5)}, ${Number(data.longitude).toFixed(5)}` : null} missing="Not set" />
                </dl>
                {hasPin && (
                  <>
                    <HospitalMap
                      hospital={{ latitude: data.latitude, longitude: data.longitude }}
                      hospitalLabel={data.name}
                      hospitalLogo={data.logo_url || null}
                      height={220}
                      className="mt-3"
                    />
                    <a
                      href={`https://www.google.com/maps?q=${data.latitude},${data.longitude}`}
                      target="_blank" rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline"
                    >
                      Open in Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </Section>

              <Section icon={User} title="Owner account">
                {data.owner ? (
                  <dl>
                    <Field label="Owner name" value={data.owner.name} />
                    <Field label="Mobile" value={data.owner.phone} />
                    <Field label="Email (login)" value={data.owner.email} />
                    <Field label="Account" value={data.owner.status === 'active' ? 'Active' : 'Inactive until approved'} />
                    <Field
                      label="Terms accepted"
                      value={data.owner.terms_accepted_at
                        ? `${dateTimeIST(data.owner.terms_accepted_at)}${data.owner.terms_version ? ` (version ${data.owner.terms_version})` : ''}`
                        : null}
                      missing="No record"
                    />
                  </dl>
                ) : (
                  <p className="text-[13px] italic text-slate-400">No owner account is linked to this hospital.</p>
                )}
              </Section>

              <Section icon={Clock} title="Timings">
                <dl>
                  <Field
                    label="Opening hours"
                    value={tm.always_open ? 'Open 24×7' : [time12(tm.open_time), time12(tm.close_time)].filter(Boolean).join(' – ') || null}
                  />
                  <Field label="Consultation" value={tm.consultation_minutes ? `${tm.consultation_minutes} min per patient` : null} />
                </dl>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAYS.map((d) => {
                    const on = (tm.working_days || []).includes(d)
                    return (
                      <span key={d} className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold ${on ? 'bg-brand-blueLight text-brand-blue' : 'bg-slate-100 text-slate-400 line-through'}`}>
                        {d}<span className="sr-only">{on ? ' open' : ' closed'}</span>
                      </span>
                    )
                  })}
                </div>
              </Section>

              <Section icon={Stethoscope} title="Services">
                {data.services?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.services.map((s) => (
                      <span key={s} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12.5px] font-semibold text-emerald-700">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] italic text-slate-400">None selected</p>
                )}
              </Section>

              {/* View only: the hospital's own admin changes these (2026-11-03). */}
              <Section icon={ShieldCheck} title="Insurance & schemes accepted">
                <InsuranceList codes={data.insurance_partners} showDisclaimer={false}
                  emptyText={<span className="italic">None selected</span>} />
              </Section>

              <p className="flex items-center gap-1.5 text-[12px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Shown to Super Admins only.
                <CalendarDays className="ml-2 h-3.5 w-3.5" /> Times in IST.
              </p>
            </>
          )}
        </div>

        {/* Decide right after reviewing — pending hospitals only. */}
        {data && pending && (onApprove || onReject) && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-3">
            {onReject && (
              <button type="button" disabled={busy} onClick={onReject} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60">
                <XCircle className="h-4 w-4" /> Reject
              </button>
            )}
            {onApprove && (
              <button type="button" disabled={busy} onClick={onApprove} className="flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
