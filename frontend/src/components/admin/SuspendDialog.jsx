import { useEffect, useState } from 'react'
import { X, Ban, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { doctorsApi, hospitalsApi } from '../../api'

/**
 * Super Admin: suspend or reactivate a hospital / doctor (2026-10-01).
 *
 * Suspending is serious and partly one-way (cancelled bookings stay cancelled),
 * so the dialog first shows what WILL happen, from GET …/suspend-preview, and
 * insists on a reason. Afterwards it lists the patients who had paid the
 * booking fee — they get a free rebooking automatically, and the admin may
 * want to call them.
 *
 * Props: kind 'hospital' | 'doctor', id, name, suspended (bool), onClose, onDone.
 */
export default function SuspendDialog({ kind, id, name, suspended, onClose, onDone }) {
  const api = kind === 'hospital' ? hospitalsApi : doctorsApi
  const label = kind === 'hospital' ? 'hospital' : 'doctor'
  const [preview, setPreview] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (suspended) return
    api.suspendPreview(id).then(setPreview).catch((e) => setError(e.message))
  }, [api, id, suspended])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = suspended ? await api.reactivate(id) : await api.suspend(id, reason.trim())
      setResult(r)
      onDone?.()
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
  }

  const tooShort = reason.trim().length < 5

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !busy && onClose?.()}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${suspended ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {suspended ? <RotateCcw className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold text-brand-navy">{suspended ? 'Reactivate' : 'Suspend'} {label}</p>
            <p className="truncate text-[13px] text-slate-500">{name}</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 px-5 py-4 text-[13.5px] text-slate-600">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-red-600">{error}</p>}

          {result ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 font-semibold text-green-700">
                <CheckCircle2 className="h-5 w-5" /> {result.message || `${name} is active again.`}
              </p>
              {!suspended && (
                <ul className="list-disc space-y-1 pl-5">
                  <li>{result.cancelled_appointments} upcoming appointment(s) cancelled, patients notified</li>
                  <li>{result.blocked_logins} login(s) blocked</li>
                  {kind === 'hospital' && result.doctors_suspended > 0 && (
                    <li>{result.doctors_suspended} doctor(s) who worked only here also suspended</li>
                  )}
                </ul>
              )}
              {suspended && (
                <p>{result.restored_logins} login(s) restored. Cancelled appointments stay cancelled; patients can book again.</p>
              )}
              {(result.paid_cancelled || []).length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 font-semibold text-amber-800">Patients who had paid the booking fee</p>
                  <p className="mb-2 text-[12.5px] text-amber-800">Each got a free next booking (any doctor, any TapCure hospital, 90 days). You may want to call them.</p>
                  <ul className="space-y-1 text-[12.5px]">
                    {result.paid_cancelled.map((p) => (
                      <li key={p.appointment_id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5">
                        <span className="font-semibold text-brand-navy">{p.patient || 'Patient'}</span>
                        <span>{p.phone || '—'}</span>
                        <span>{p.date}</span>
                        <span className="font-semibold">₹{p.booking_fee_paid}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : suspended ? (
            <>
              <p>This will make <b>{name}</b> visible and bookable again and restore the logins that were blocked by the suspension.</p>
              <p className="text-[12.5px] text-slate-400">Appointments cancelled during the suspension stay cancelled.</p>
            </>
          ) : (
            <>
              {!preview && !error && <p className="py-4 text-center text-slate-400">Checking…</p>}
              {preview && (
                <div className="rounded-xl border border-red-100 bg-red-50/60 p-3">
                  <p className="mb-2 flex items-center gap-1.5 font-semibold text-red-700"><AlertTriangle className="h-4 w-4" /> This will happen immediately</p>
                  <ul className="list-disc space-y-1 pl-5 text-[13px] text-red-800">
                    <li>Hidden from patients, no new bookings</li>
                    {kind === 'hospital'
                      ? <li>{preview.staff_logins} hospital login(s) blocked and signed out (owner, reception, pharmacy); doctors who work only here too</li>
                      : <li>{preview.has_login ? 'The doctor’s login is blocked and signed out' : 'No login account to block'}</li>}
                    <li>
                      <b>{preview.upcoming_appointments}</b> upcoming appointment(s), today included, cancelled; every patient gets an app + WhatsApp message
                    </li>
                    {preview.paid_appointments > 0 && (
                      <li>{preview.paid_appointments} of them paid the booking fee; they get a free next booking</li>
                    )}
                  </ul>
                  <p className="mt-2 text-[12px] text-red-700/80">Records, prescriptions and payments are kept. You can reactivate later.</p>
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-[12.5px] font-semibold text-brand-navy">Reason (kept in the audit log)</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Licence expired, documents pending"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-brand-blue"
                />
              </label>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {result ? (
            <button type="button" onClick={onClose} className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-semibold text-white">Done</button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              {suspended ? (
                <button type="button" disabled={busy} onClick={run} className="flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  <RotateCcw className="h-4 w-4" /> {busy ? 'Reactivating…' : 'Reactivate'}
                </button>
              ) : (
                <button type="button" disabled={busy || !preview || tooShort} onClick={run} className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  <Ban className="h-4 w-4" /> {busy ? 'Suspending…' : `Suspend ${label}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
