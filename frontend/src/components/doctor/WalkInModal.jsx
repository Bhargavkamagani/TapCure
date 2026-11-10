import { useState } from 'react'
import { X, Ticket } from 'lucide-react'
import { appointmentsApi, tokensApi } from '../../api'
import { toMobile } from '../../lib/phone.js'
import WhatsAppAlertsToggle from '../common/WhatsAppAlertsToggle.jsx'
import { nameFields } from '../../lib/personName.js'

/**
 * Register a walk-in patient and issue their token in one step.
 *
 * Lifted verbatim out of the old `pages/doctor/LiveQueue.jsx` when that page was
 * folded into the doctor dashboard — same fields, same validation, same two API
 * calls in the same order. Only a solo (self-registered) doctor sees it: in a
 * hospital the front desk does walk-ins.
 */
function WalkInModal({ doctorId, onClose, onCreated }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', gender: '', blood_group: '', notes: '', priority: 'normal', whatsapp_alerts: false })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: key === 'phone' ? toMobile(e.target.value) : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.first_name.trim()) { setError('Patient first name is required.'); return }
    if (!/^\d{10}$/.test(form.phone)) { setError('Enter a valid 10-digit mobile number.'); return }
    setSaving(true)
    setError(null)
    try {
      const appointment = await appointmentsApi.walkIn({
        doctor_id: doctorId,
        ...nameFields(form.first_name, form.last_name),
        phone: form.phone,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        notes: form.notes.trim(),
        whatsapp_alerts: form.whatsapp_alerts,
      })
      const result = await tokensApi.generate(appointment.appointment_id, form.priority)
      await onCreated(result)
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add this walk-in.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-extrabold text-brand-navy">Add Walk-in Patient</h3>
            <p className="mt-0.5 text-[13px] text-slate-500">Register the patient and issue a token immediately.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600">{error}</p>}
        <div className="space-y-3">
          <div className="col-span-full grid grid-cols-2 gap-3"><input className="field-input" placeholder="First name *" value={form.first_name} onChange={set('first_name')} /><input className="field-input" placeholder="Last name (optional)" value={form.last_name} onChange={set('last_name')} /></div>
          <input className="field-input" placeholder="10-digit mobile number *" inputMode="numeric" value={form.phone} onChange={set('phone')} />
          <div className="grid grid-cols-2 gap-3">
            <select className="field-input" value={form.gender} onChange={set('gender')}>
              <option value="">Gender (optional)</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
            <select className="field-input" value={form.blood_group} onChange={set('blood_group')}>
              <option value="">Blood group (optional)</option>
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((value) => <option key={value}>{value}</option>)}
            </select>
          </div>
          <input className="field-input" placeholder="Reason for visit (optional)" value={form.notes} onChange={set('notes')} />
          <WhatsAppAlertsToggle checked={form.whatsapp_alerts} onChange={(v) => setForm((f) => ({ ...f, whatsapp_alerts: v }))} />
          {/* Priority selection removed; it defaults to 'normal'. */}
        </div>
        <button disabled={saving} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue py-3 text-sm font-bold text-white disabled:opacity-60">
          <Ticket className="h-4 w-4" /> {saving ? 'Issuing token…' : 'Add Walk-in & Generate Token'}
        </button>
      </form>
    </div>
  )
}

export default WalkInModal
