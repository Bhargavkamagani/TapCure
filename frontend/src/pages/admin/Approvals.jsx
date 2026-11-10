import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, XCircle, MapPin, Phone, Mail, RefreshCw, FileText } from 'lucide-react'
import { hospitalsApi, fileUrl } from '../../api'
import { useAdminCtx } from '../../components/admin/AdminLayout.jsx'
import HospitalRegistrationDetails from '../../components/admin/HospitalRegistrationDetails.jsx'

/** Super-Admin screen to review and approve/reject pending hospital registrations. */
export default function Approvals() {
  const { refreshCounts } = useAdminCtx()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [viewing, setViewing] = useState(null)   // the hospital whose full registration is open

  const load = async () => {
    setLoading(true)
    try {
      setRows(await hospitalsApi.pending())
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const decide = async (h, approve) => {
    setBusy(h.hospital_id)
    setMsg(null)
    try {
      if (approve) await hospitalsApi.approve(h.hospital_id)
      else await hospitalsApi.reject(h.hospital_id, 'Details could not be verified')
      setMsg({ type: 'success', text: `${approve ? 'Approved' : 'Rejected'} ${h.name}` })
      setViewing(null)
      await load()
      refreshCounts()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setBusy(null)
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
<div>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-brand-navy">Hospital Approvals</h1>
            <p className="mt-1 text-sm text-slate-500">Review and approve hospitals that have registered.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/doctor-verifications')} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:border-slate-300">
              Doctor Verifications
            </button>
            <button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:border-slate-300">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        </div>

        {msg && (
          <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-card">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-green" />
            <p className="mt-3 text-sm font-semibold text-brand-navy">No pending registrations</p>
            <p className="text-[13px] text-slate-400">New hospital sign-ups will appear here for approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((h) => (
              <div key={h.hospital_id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-blueLight text-brand-blue">
                    {h.logo_url
                      ? <img src={fileUrl(h.logo_url)} alt="" className="h-full w-full bg-white object-contain" />
                      : <Building2 className="h-6 w-6" />}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-brand-navy">{h.name}</p>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-slate-500">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {h.city || '—'}</span>
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {h.phone || '—'}</span>
                      <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {h.email || '—'}</span>
                      {/* The licence number is the thing being approved — it was
                          collected at signup but discarded until f1a7c3e95d24, so
                          hospitals registered before that show "not provided". */}
                      <span>
                        Reg. no:{' '}
                        {h.registration_number
                          ? <b className="font-semibold text-brand-navy">{h.registration_number}</b>
                          : <span className="italic text-slate-400">not provided</span>}
                      </span>
                      <span className="font-semibold text-brand-blue">code: {h.short_code}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setViewing(h)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50">
                    <FileText className="h-4 w-4" /> View all details
                  </button>
                  <button disabled={busy === h.hospital_id} onClick={() => decide(h, false)} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60">
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                  <button disabled={busy === h.hospital_id} onClick={() => decide(h, true)} className="flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewing && (
        <HospitalRegistrationDetails
          hospitalId={viewing.hospital_id}
          onClose={() => setViewing(null)}
          onApprove={() => decide(viewing, true)}
          onReject={() => decide(viewing, false)}
          busy={busy === viewing.hospital_id}
        />
      )}
    </div>
  )
}
