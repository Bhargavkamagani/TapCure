import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stethoscope, CheckCircle2, XCircle, Phone, Mail, RefreshCw,
  FileText, Hash, Award, ExternalLink,
} from 'lucide-react'
import { doctorsApi, fileUrl } from '../../api'
import { useAdminCtx } from '../../components/admin/AdminLayout.jsx'
import DoctorRegistrationDetails from '../../components/admin/DoctorRegistrationDetails.jsx'

/** Super-Admin screen to review self-registered doctors' credentials and approve/reject. */
export default function DoctorVerifications() {
  const { refreshCounts } = useAdminCtx()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState(null)
  const [viewing, setViewing] = useState(null)   // the doctor whose full registration is open

  const load = async () => {
    setLoading(true)
    try {
      setRows(await doctorsApi.pending())
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const decide = async (d, approve) => {
    let reason = ''
    if (!approve) {
      reason = window.prompt(`Reason for rejecting Dr. ${d.name}?`, 'Credentials could not be verified') || ''
      if (reason === null) return
    }
    setBusy(d.doctor_id)
    setMsg(null)
    try {
      if (approve) await doctorsApi.verify(d.doctor_id)
      else await doctorsApi.reject(d.doctor_id, reason || 'Credentials could not be verified')
      setMsg({ type: 'success', text: `${approve ? 'Verified' : 'Rejected'} Dr. ${d.name}` })
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
            <h1 className="text-2xl font-extrabold text-brand-navy">Doctor Verifications</h1>
            <p className="mt-1 text-sm text-slate-500">Review credentials of self-registered doctors and approve or reject.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin/approvals')} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:border-slate-300">
              Hospital Approvals
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
            <p className="mt-3 text-sm font-semibold text-brand-navy">No pending doctor verifications</p>
            <p className="text-[13px] text-slate-400">New doctor sign-ups will appear here for review.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((d) => (
              <div key={d.doctor_id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-blueLight text-brand-blue">
                      {d.profile_photo_url
                        ? <img src={fileUrl(d.profile_photo_url)} alt="" className="h-full w-full object-cover" />
                        : <Stethoscope className="h-6 w-6" />}
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-brand-navy">Dr. {d.name}</p>
                      <p className="text-[12px] font-semibold text-brand-blue">{d.specialization}{d.qualification ? ` · ${d.qualification}` : ''}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-slate-500">
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {d.phone || '—'}</span>
                        <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {d.email || '—'}</span>
                        <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> Reg: {d.registration_number || '—'}</span>
                        {d.hpr_id && <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" /> HPR: {d.hpr_id}</span>}
                        {d.experience_years ? <span>{d.experience_years} yrs exp</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setViewing(d)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50">
                      <FileText className="h-4 w-4" /> View all details
                    </button>
                    <button disabled={busy === d.doctor_id} onClick={() => decide(d, false)} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60">
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                    <button disabled={busy === d.doctor_id} onClick={() => decide(d, true)} className="flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                      <CheckCircle2 className="h-4 w-4" /> Verify
                    </button>
                  </div>
                </div>

                {/* Uploaded documents */}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {(d.documents || []).length === 0 ? (
                    <span className="text-[12px] text-slate-400">No documents uploaded.</span>
                  ) : (
                    d.documents.map((doc) => (
                      <a
                        key={doc.document_id}
                        href={fileUrl(doc.file_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-brand-navy transition-colors hover:border-brand-blue hover:bg-white"
                      >
                        <FileText className="h-4 w-4 text-brand-blue" />
                        {doc.label || doc.doc_type}
                        <span className="text-[10px] font-normal text-slate-400">{doc.file_size_kb} KB</span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </a>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewing && (
        <DoctorRegistrationDetails
          doctorId={viewing.doctor_id}
          onClose={() => setViewing(null)}
          onApprove={() => decide(viewing, true)}
          onReject={() => decide(viewing, false)}
          busy={busy === viewing.doctor_id}
        />
      )}
    </div>
  )
}
