import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Stethoscope, FileText, ExternalLink, RefreshCw, Search, CheckCircle2, Clock, XCircle,
  Mail, Phone, Building2, BadgeCheck, ChevronDown, Ban, RotateCcw,
} from 'lucide-react'
import { doctorsApi, hospitalsApi, fileUrl } from '../../api'
import SuspendDialog from '../../components/admin/SuspendDialog.jsx'

/**
 * Super-Admin doctor register — every doctor on the platform in any credential
 * state, with the documents they uploaded.
 *
 * The verification screen only ever lists `pending` doctors, so once someone is
 * approved their certificates become unreachable. This is the audit view:
 * GET /doctors/verifications?status=… returns the same payload (doctor +
 * contact + documents) for pending, verified and rejected alike.
 */

const STATE = {
  verified: { label: 'Verified', icon: CheckCircle2, pill: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  pending: { label: 'Pending', icon: Clock, pill: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  rejected: { label: 'Rejected', icon: XCircle, pill: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
  suspended: { label: 'Suspended', icon: Ban, pill: 'bg-slate-200 text-slate-700', dot: 'bg-slate-500' },
}

// Suspension (Super Admin) overrides the credential state for display and filtering.
// Whether the doctor is switched on (their hospital can set Inactive / On leave).
const ACTIVITY = {
  active: { label: 'Active', pill: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inactive', pill: 'bg-red-100 text-red-600' },
  on_leave: { label: 'On leave', pill: 'bg-amber-100 text-amber-700' },
}

const stateOf = (d) => (d.status === 'suspended' ? 'suspended' : d.verification_status)

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'suspended', label: 'Suspended' },
]

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function AdminDoctors() {
  const [rows, setRows] = useState([])
  const [hospitals, setHospitals] = useState({})
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [suspendOf, setSuspendOf] = useState(null)   // doctor being suspended / reactivated
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [docs, hs] = await Promise.all([
      doctorsApi.verifications('all').catch(() => []),
      hospitalsApi.list().catch(() => []),
    ])
    setRows(docs || [])
    setHospitals(Object.fromEntries((hs || []).map((h) => [h.hospital_id, h.name])))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((d) => {
      if (filter !== 'all' && stateOf(d) !== filter) return false
      if (!term) return true
      return [d.name, d.specialization, d.email, d.phone, d.registration_number]
        .some((v) => (v || '').toLowerCase().includes(term))
    })
  }, [rows, filter, q])

  const counts = useMemo(
    () => rows.reduce((a, d) => ({ ...a, [stateOf(d)]: (a[stateOf(d)] || 0) + 1 }), {}),
    [rows]
  )

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-navy">Doctors</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every doctor on the platform, with the credentials they submitted.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:border-slate-300 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filters + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = f.key === 'all' ? rows.length : counts[f.key] || 0
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                active ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-blue/40 hover:text-brand-blue'
              }`}
            >
              {f.label} <span className={active ? 'text-white/70' : 'text-slate-400'}>· {n}</span>
            </button>
          )
        })}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, specialty, reg. no…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13.5px] outline-none focus:border-brand-blue"
          />
        </div>
      </div>

      {loading && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}
      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
          <Stethoscope className="mx-auto mb-2 h-7 w-7 text-slate-300" />
          <p className="text-sm text-slate-500">No doctors match this filter.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {!loading && visible.map((d) => {
          const st = STATE[stateOf(d)] || STATE.pending
          const StIcon = st.icon
          const open = openId === d.doctor_id
          const docs = d.documents || []
          return (
            <div key={d.doctor_id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <button
                onClick={() => setOpenId(open ? null : d.doctor_id)}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50/70"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blueLight text-brand-blue">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-brand-navy">
                    {d.name}
                    {d.is_self_registered && (
                      <span className="ml-2 rounded-md bg-purple-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-purple-700">Self-registered</span>
                    )}
                  </p>
                  <p className="truncate text-[12.5px] text-slate-500">
                    {d.specialization || 'General Physician'}
                    {hospitals[d.hospital_id] ? ` · ${hospitals[d.hospital_id]}` : ''}
                  </p>
                </div>
                {d.verification_status === 'verified' && ACTIVITY[d.status] && (
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${ACTIVITY[d.status].pill}`}>
                    {ACTIVITY[d.status].label}
                  </span>
                )}
                <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold sm:inline-flex ${st.pill}`}>
                  <StIcon className="h-3.5 w-3.5" /> {st.label}
                </span>
                {docs.length > 0 && (
                  <span className="hidden shrink-0 items-center gap-1 text-[12px] font-semibold text-slate-400 md:inline-flex">
                    <FileText className="h-3.5 w-3.5" /> {docs.length}
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Details */}
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Details</p>
                      <dl className="space-y-1.5 text-[13px]">
                        <Row icon={BadgeCheck} label="Reg. number" value={d.registration_number} />
                        <Row icon={FileText} label="HPR ID" value={d.hpr_id} />
                        <Row icon={Mail} label="Email" value={d.email} />
                        <Row icon={Phone} label="Phone" value={d.phone} />
                        <Row icon={Building2} label="Hospital" value={hospitals[d.hospital_id]} />
                        <Row icon={CheckCircle2} label="Verified on" value={d.verified_at ? fmtDate(d.verified_at) : null} />
                      </dl>
                      {d.rejection_reason && (
                        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
                          <span className="font-semibold">Rejected:</span> {d.rejection_reason}
                        </p>
                      )}
                    </div>

                    {/* Documents */}
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Submitted documents {docs.length > 0 && `(${docs.length})`}
                      </p>
                      {docs.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[12.5px] text-slate-400">
                          No documents uploaded — this doctor was added by a hospital, not self-registered.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
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
                                  <span className="block truncate text-[11px] text-slate-400">
                                    {doc.file_size_kb ? `${doc.file_size_kb} KB · ` : ''}{fmtDate(doc.uploaded_at)}
                                  </span>
                                </span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {/* Pending/rejected sign-ups are handled on Doctor Verifications. */}
                  {(d.verification_status === 'verified' || d.status === 'suspended') && (
                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                      {d.status === 'suspended' ? (
                        <button type="button" onClick={() => setSuspendOf(d)} className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
                          <RotateCcw className="h-4 w-4" /> Reactivate doctor
                        </button>
                      ) : (
                        <button type="button" onClick={() => setSuspendOf(d)} className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50">
                          <Ban className="h-4 w-4" /> Suspend doctor
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {suspendOf && (
        <SuspendDialog
          kind="doctor"
          id={suspendOf.doctor_id}
          name={suspendOf.name}
          suspended={suspendOf.status === 'suspended'}
          onClose={() => setSuspendOf(null)}
          onDone={load}
        />
      )}
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <dt className="w-24 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-brand-navy">{value || '—'}</dd>
    </div>
  )
}
