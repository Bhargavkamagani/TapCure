import { useEffect, useState } from 'react'
import {
  X, Stethoscope, User, MapPin, FileText, ShieldCheck, CalendarDays, ExternalLink,
  CheckCircle2, XCircle, UserRound,
} from 'lucide-react'
import { doctorsApi, fileUrl } from '../../api'
import HospitalMap from '../common/HospitalMap.jsx'

/**
 * Everything a doctor submitted at sign-up, for the Super Admin (2026-10-01).
 *
 * The verification list showed the credentials and documents; the practice
 * (name, address, map pin, fee), languages, bio, account status and consent
 * were stored but never shown. One call to GET /doctors/{id}/registration
 * gathers them; documents keep their short-lived signed links.
 *
 * `onApprove` / `onReject` (optional): shown while the doctor is pending.
 */

function dateTimeIST(iso) {
  if (!iso) return null
  const d = new Date(/[Z]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
}

const rupees = (v) => (v == null || v === '' ? null : `₹${Number(v).toLocaleString('en-IN')}`)
const isImage = (url) => /\.(png|jpe?g|webp|gif)$/i.test(String(url || '').split('?')[0])

const PRACTICE_TYPE = {
  personal_practice: 'Own practice',
  hospital: 'Hospital',
  personal_clinic: 'Own practice',  // pre-2026-10-25 values
  clinic: 'Hospital',  // pre-2026-10-25 value
  home: 'Home visits',
  online: 'Online',
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
      <dd className="min-w-0 whitespace-pre-line break-words font-semibold text-brand-navy">
        {value || value === 0 ? value : <span className="font-normal italic text-slate-400">{missing}</span>}
      </dd>
    </div>
  )
}

export default function DoctorRegistrationDetails({ doctorId, onClose, onApprove, onReject, busy = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    doctorsApi.registration(doctorId)
      .then((d) => { if (alive) setData(d) })
      .catch((e) => { if (alive) setError(e.message || 'Could not load the registration details.') })
    return () => { alive = false }
  }, [doctorId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pending = data?.verification_status === 'pending'
  const pr = data?.practice
  const hasPin = pr?.latitude != null && pr?.longitude != null
  const statusPill = {
    pending: 'bg-amber-100 text-amber-700',
    verified: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }[data?.verification_status] || 'bg-slate-100 text-slate-600'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Doctor registration details"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-slate-50 shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            {data?.profile_photo_url
              ? <img src={fileUrl(data.profile_photo_url)} alt={`Dr. ${data.name}`} className="h-full w-full object-cover" />
              : <UserRound className="h-7 w-7 text-slate-300" aria-label="No photo" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-extrabold text-brand-navy">{data ? `Dr. ${data.name}` : 'Registration details'}</p>
            {data && (
              <p className="mt-0.5 text-[13.5px] text-slate-500">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-[13px] font-bold ${statusPill}`}>{data.verification_status}</span>
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
              <Section icon={Stethoscope} title="Doctor">
                <dl>
                  <Field label="Name" value={`Dr. ${data.name}`} />
                  <Field label="Specialization" value={data.specialization} />
                  <Field label="Qualification" value={data.qualification} />
                  <Field label="Experience" value={data.experience_years ? `${data.experience_years} years` : null} />
                  <Field label="Registration no." value={data.registration_number} />
                  <Field label="HPR ID" value={data.hpr_id} />
                  <Field label="Languages" value={data.languages?.length ? data.languages.join(', ') : null} />
                  <Field label="About" value={data.bio} />
                </dl>
                {data.rejection_reason && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] text-red-600">Rejected: {data.rejection_reason}</p>
                )}
              </Section>

              <Section icon={User} title="Contact and account">
                <dl>
                  <Field label="Mobile" value={data.phone} />
                  <Field label="Email (login)" value={data.email} />
                  <Field label="Account" value={data.account ? (data.account.status === 'active' ? 'Active' : 'Inactive until verified') : null} missing="No login account" />
                  <Field
                    label="Terms accepted"
                    value={data.account?.terms_accepted_at
                      ? `${dateTimeIST(data.account.terms_accepted_at)}${data.account.terms_version ? ` (version ${data.account.terms_version})` : ''}`
                      : null}
                    missing="No record"
                  />
                  {data.verified_at && <Field label="Verified on" value={dateTimeIST(data.verified_at)} />}
                </dl>
              </Section>

              <Section icon={MapPin} title="Practice">
                {pr ? (
                  <>
                    <dl>
                      <Field label="Hospital name" value={pr.name} />
                      <Field label="Type" value={PRACTICE_TYPE[pr.practice_type] || pr.practice_type} />
                      <Field label="Consultation fee" value={rupees(pr.consultation_fee ?? data.consultation_fee)} />
                      <Field label="Address" value={pr.address} />
                      <Field label="City" value={pr.city} />
                      <Field label="Map pin" value={hasPin ? `${Number(pr.latitude).toFixed(5)}, ${Number(pr.longitude).toFixed(5)}` : null} missing="Not set" />
                    </dl>
                    {hasPin && (
                      <>
                        <HospitalMap
                          hospital={{ latitude: pr.latitude, longitude: pr.longitude }}
                          hospitalLabel={pr.name}
                          hospitalLogo={null}
                          height={220}
                          className="mt-3"
                        />
                        <a
                          href={`https://www.google.com/maps?q=${pr.latitude},${pr.longitude}`}
                          target="_blank" rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-blue hover:underline"
                        >
                          Open in Google Maps <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-[13px] italic text-slate-400">No practice location recorded.</p>
                )}
              </Section>

              <Section icon={FileText} title="Documents">
                {(data.documents || []).length === 0 ? (
                  <p className="text-[13px] italic text-slate-400">No documents uploaded.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.documents.map((doc) => (
                      <a
                        key={doc.document_id}
                        href={fileUrl(doc.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-brand-blue hover:bg-white"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                          {isImage(doc.file_url)
                            ? <img src={fileUrl(doc.file_url)} alt="" className="h-full w-full object-cover" />
                            : <FileText className="h-6 w-6 text-brand-blue" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-brand-navy">{doc.label || doc.doc_type}</p>
                          <p className="text-[13px] text-slate-400">{doc.file_size_kb} KB · {isImage(doc.file_url) ? 'Image' : 'PDF'}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue">
                          Open <ExternalLink className="h-3.5 w-3.5" />
                        </span>
                      </a>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[13px] text-slate-400">Document links are private and expire; reopen this panel for fresh ones.</p>
              </Section>

              <p className="flex items-center gap-1.5 text-[13px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Shown to Super Admins only.
                <CalendarDays className="ml-2 h-3.5 w-3.5" /> Times in IST.
              </p>
            </>
          )}
        </div>

        {data && pending && (onApprove || onReject) && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-3">
            {onReject && (
              <button type="button" disabled={busy} onClick={onReject} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60">
                <XCircle className="h-4 w-4" /> Reject
              </button>
            )}
            {onApprove && (
              <button type="button" disabled={busy} onClick={onApprove} className="flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                <CheckCircle2 className="h-4 w-4" /> Verify
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
