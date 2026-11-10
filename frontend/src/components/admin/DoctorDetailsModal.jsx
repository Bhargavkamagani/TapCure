import { useEffect, useState } from 'react'
import {
  X, Stethoscope, Mail, Phone, BadgeCheck, FileText, Building2, Layers, GraduationCap,
  Briefcase, IndianRupee, Languages, CalendarClock, CheckCircle2, ExternalLink,
} from 'lucide-react'
import { doctorsApi, fileUrl } from '../../api'

/**
 * Super Admin: everything about one doctor — profile, contact, credentials,
 * documents and weekly timings — opened from a hospital's doctor list.
 * Read-only; verifying and suspending stay on their own screens.
 */

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const STATUS = {
  suspended: { label: 'Suspended', pill: 'bg-slate-200 text-slate-700' },
  pending: { label: 'Pending verification', pill: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejected', pill: 'bg-red-100 text-red-600' },
  active: { label: 'Active', pill: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inactive', pill: 'bg-red-100 text-red-600' },
  on_leave: { label: 'On leave', pill: 'bg-amber-100 text-amber-700' },
}
const statusOf = (d) => {
  if (d.status === 'suspended') return STATUS.suspended
  if (d.verification_status !== 'verified') return STATUS[d.verification_status] || STATUS.pending
  return STATUS[d.status] || STATUS.active
}

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
// "09:30:00" -> "9:30 AM"
const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function DoctorDetailsModal({ doctorId, onClose }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let live = true
    doctorsApi.adminDetail(doctorId)
      .then((res) => { if (live) setD(res) })
      .catch((e) => { if (live) setErr(e.message || 'Could not load this doctor') })
    return () => { live = false }
  }, [doctorId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const schedules = (d?.schedules || []).filter((s) => s.is_active)
  const byDay = DAYS.map((day) => ({ day, slots: schedules.filter((s) => s.day_of_week?.toLowerCase() === day) }))
    .filter((x) => x.slots.length)
  const docs = d?.documents || []
  const st = d ? statusOf(d) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Doctor details"
        className="max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-slate-100 bg-white p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-blueLight text-brand-blue">
            {d?.profile_photo_url
              ? <img src={fileUrl(d.profile_photo_url)} alt="" className="h-full w-full object-cover" />
              : <Stethoscope className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-extrabold text-brand-navy">{d?.name || 'Doctor'}</h3>
            {d && (
              <p className="truncate text-[13px] text-slate-500">
                {d.specialization || 'General Physician'}{d.hospital_name ? ` · ${d.hospital_name}` : ''}
              </p>
            )}
            {st && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${st.pill}`}>{st.label}</span>
                {d.is_self_registered && (
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[13px] font-bold text-purple-700">Self-registered</span>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-5">
          {!d && !err && <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

          {d && (
            <>
              <Section title="Profile">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Fact icon={Layers} label="Department" value={d.department_name} />
                  <Fact icon={GraduationCap} label="Qualification" value={d.qualification} />
                  <Fact icon={Briefcase} label="Experience" value={d.experience_years ? `${d.experience_years} years` : null} />
                  <Fact icon={IndianRupee} label="Consultation fee" value={inr(d.consultation_fee)} />
                  <Fact icon={Languages} label="Languages" value={d.languages} />
                  <Fact icon={Building2} label="Hospital" value={d.hospital_name} />
                </div>
                {d.bio && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600">{d.bio}</p>}
              </Section>

              <Section title="Contact & login">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Fact icon={Mail} label="Login email" value={d.email || d.login_email} />
                  <Fact icon={Phone} label="Phone" value={d.phone} />
                </div>
              </Section>

              <Section title="Credentials">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Fact icon={BadgeCheck} label="Registration no." value={d.registration_number} />
                  <Fact icon={FileText} label="HPR ID" value={d.hpr_id} />
                  <Fact icon={CheckCircle2} label="Verified on" value={fmtDate(d.verified_at)} />
                </div>
                {d.rejection_reason && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] text-red-700">
                    <span className="font-semibold">Rejected:</span> {d.rejection_reason}
                  </p>
                )}
              </Section>

              <Section title="Weekly timings">
                {byDay.length === 0 ? (
                  <Empty>No timings set yet, so patients can't book this doctor.</Empty>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {byDay.map(({ day, slots }) => (
                      <li key={day} className="flex items-start gap-3 px-3 py-2 text-[13px]">
                        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span className="w-24 shrink-0 font-semibold text-brand-navy">{cap(day)}</span>
                        <span className="min-w-0 flex-1 text-slate-600">
                          {slots.map((s) => `${fmtTime(s.start_time)} – ${fmtTime(s.end_time)} (${s.max_tokens} tokens)`).join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={`Documents${docs.length ? ` (${docs.length})` : ''}`}>
                {docs.length === 0 ? (
                  <Empty>No documents uploaded. Doctors added by a hospital don't upload any.</Empty>
                ) : (
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {docs.map((doc) => (
                      <li key={doc.document_id}>
                        <a
                          href={fileUrl(doc.file_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-brand-blue"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-brand-blue" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-brand-navy">{doc.label || doc.doc_type}</span>
                            {doc.file_size_kb ? <span className="block text-[13px] text-slate-400">{doc.file_size_kb} KB</span> : null}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-slate-400">{title}</p>
      {children}
    </section>
  )
}

function Fact({ icon: Icon, label, value }) {
  const text = value == null || value === '' ? '—' : String(value)
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="break-words text-[13px] font-semibold text-brand-navy">{text}</p>
      </div>
    </div>
  )
}

function Empty({ children }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[13.5px] text-slate-400">{children}</p>
  )
}
