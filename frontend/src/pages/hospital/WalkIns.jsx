import { useEffect, useMemo, useState } from 'react'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { UserPlus, Clock, CheckCircle2, RefreshCw, Ticket, AlertTriangle } from 'lucide-react'
import { Card, StatCard, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import { VISIT_REASONS } from '../../data/hospitalDashboardData.js'
import { doctorsApi, appointmentsApi, tokensApi } from '../../api'
import { toMobile } from '../../lib/phone.js'
import WhatsAppAlertsToggle from '../../components/common/WhatsAppAlertsToggle.jsx'
import { nameFields } from '../../lib/personName.js'

const STAT_ICONS = [UserPlus, Clock, CheckCircle2]
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
// Only normal priority is allowed for walk-ins now.
const PRIORITIES = [
  { value: 'normal', label: 'Normal' },
]

function Field({ label, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-slate-600">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function WalkIns() {
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({ doctor_id: '', first_name: '', last_name: '', mobile: '', gender: '', blood_group: '', city: '', reason: '', priority: 'normal', whatsapp_alerts: false })
  const [queue, setQueue] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'mobile' ? toMobile(e.target.value) : e.target.value }))

  useEffect(() => {
    doctorsApi.list({ bookable: true }).then((d) => {
      setDoctors(d)
      if (d.length) setForm((f) => ({ ...f, doctor_id: String(d[0].doctor_id) }))
    })
  }, [])

  const loadQueue = async (id = form.doctor_id) => {
    if (!id) return
    try {
      setQueue(await tokensApi.queue(id))
    } catch {
      setQueue(null)
    }
  }
  useEffect(() => {
    loadQueue(form.doctor_id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.doctor_id])

  // The queue panel beside the form is a live board — it moves as the doctor
  // calls patients. Paused while a walk-in is being registered.
  useAutoRefresh(() => loadQueue(form.doctor_id), {
    enabled: !!form.doctor_id,
    paused: busy,
  })

  const submit = async (e) => {
    e.preventDefault()
    const err = {}
    if (!form.doctor_id) err.doctor_id = 'Select a doctor'
    if (!form.first_name.trim()) err.first_name = 'Required'
    if (!/^\d{10}$/.test(form.mobile)) err.mobile = 'Enter a valid 10-digit number'
    setErrors(err)
    if (Object.keys(err).length) return

    setBusy(true)
    setBanner(null)
    try {
      const appt = await appointmentsApi.walkIn({
        doctor_id: form.doctor_id,
        ...nameFields(form.first_name, form.last_name),
        phone: form.mobile,
        notes: form.reason,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        city: form.city.trim() || null,
        whatsapp_alerts: form.whatsapp_alerts,
      })
      const { token, estimate } = await tokensApi.generate(appt.appointment_id, form.priority)
      setBanner({ type: 'success', msg: `Token ${token.display_code} issued — est. wait ~${estimate?.wait_min ?? '—'} min` })
      setForm((f) => ({ ...f, first_name: '', last_name: '', mobile: '', gender: '', blood_group: '', city: '', reason: '', priority: 'normal', whatsapp_alerts: false }))
      await loadQueue()
    } catch (e2) {
      setBanner({ type: 'error', msg: e2.message || 'Could not register walk-in' })
    }
    setBusy(false)
  }

  const waiting = queue?.waiting || []
  const current = queue?.current
  const stats = useMemo(() => {
    const walkins = waiting.filter((t) => t.is_walkin).length + (current?.is_walkin ? 1 : 0)
    return [
      { value: walkins, label: 'Walk-ins in queue', tone: 'blue' },
      { value: waiting.length, label: 'Total waiting', tone: 'orange' },
      { value: current ? 1 : 0, label: 'In consultation', tone: 'green' },
    ]
  }, [waiting, current])

  const doc = doctors.find((d) => String(d.doctor_id) === String(form.doctor_id))

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Walk-in Patients" subtitle="Register walk-ins and manage the live walk-in queue.">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          {doc && <Avatar name={doc.name} className="h-6 w-6 text-[9px]" />}
          <select value={form.doctor_id} onChange={set('doctor_id')} className="bg-transparent py-2 text-sm font-semibold text-brand-navy outline-none">
            {doctors.map((d) => (
              <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>
            ))}
          </select>
        </div>
        <ToolButton icon={RefreshCw} onClick={() => loadQueue()}>Refresh</ToolButton>
      </PageHeading>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s, i) => <StatCard key={s.label} {...s} icon={STAT_ICONS[i]} />)}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
        {/* Entry form */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blueLight text-brand-blue"><UserPlus className="h-5 w-5" /></span>
            <h3 className="text-[15px] font-bold text-brand-navy">New Walk-in Entry</h3>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Patient Name" required>
              <div className="col-span-full grid grid-cols-2 gap-3">
                <input value={form.first_name} onChange={set('first_name')} placeholder="First name" className="field-input" />
                <input value={form.last_name} onChange={set('last_name')} placeholder="Last name (optional)" className="field-input" />
              </div>
              {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name}</p>}
            </Field>
            <Field label="Mobile Number" required>
              <input value={form.mobile} onChange={set('mobile')} placeholder="10-digit mobile" inputMode="numeric" className="field-input" />
              {errors.mobile && <p className="mt-1 text-xs text-red-500">{errors.mobile}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gender">
                <select value={form.gender} onChange={set('gender')} className="field-input">
                  <option value="">Optional</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </Field>
              <Field label="Blood Group">
                <select value={form.blood_group} onChange={set('blood_group')} className="field-input">
                  <option value="">Optional</option>
                  {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
            </div>
            <Field label="City / Village">
              <input value={form.city} onChange={set('city')} placeholder="Optional" className="field-input" />
            </Field>
            <Field label="Reason for Visit">
              <select value={form.reason} onChange={set('reason')} className="field-input">
                <option value="">Select reason</option>{VISIT_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <WhatsAppAlertsToggle checked={form.whatsapp_alerts} onChange={(v) => setForm((f) => ({ ...f, whatsapp_alerts: v }))} />
            {/* Priority is fixed to Normal for all walk-ins. */}

            {banner && (
              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${banner.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {banner.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                {banner.msg}
              </div>
            )}

            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue py-2.5 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
              <Ticket className="h-4 w-4" /> {busy ? 'Issuing token…' : 'Generate Token'}
            </button>
          </form>
        </Card>

        {/* Live queue */}
        <Card className="flex min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-brand-navy">Today's Queue — {doc?.name || '—'}</h3>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">{waiting.length} in queue</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white">
                <tr className="whitespace-nowrap text-[12px] font-semibold text-slate-400">
                  <th className="pb-2 pr-4">Token</th>
                  <th className="pb-2 pr-4">Patient</th>
                  <th className="pb-2 pr-4">Pos</th>
                  <th className="pb-2 pr-4">Priority</th>
                  <th className="pb-2">Type</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                {current && (
                  <tr className="border-t border-slate-50 bg-green-50/40">
                    <td className="whitespace-nowrap py-2.5 pr-4 font-semibold text-brand-navy">{current.display_code}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-slate-600">{current.patient_name || 'Patient'}</td>
                    <td className="py-2.5 pr-4 text-slate-500">—</td>
                    <td className="py-2.5 pr-4 capitalize text-slate-500">{current.priority}</td>
                    <td className="py-2.5"><span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">In consultation</span></td>
                  </tr>
                )}
                {waiting.map((w) => (
                  <tr key={w.token_id} className="border-t border-slate-50 hover:bg-slate-50/60">
                    <td className="whitespace-nowrap py-2.5 pr-4 font-semibold text-brand-navy">{w.display_code}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-slate-600">{w.patient_name || 'Patient'}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{w.queue_position}</td>
                    <td className="py-2.5 pr-4 capitalize text-slate-500">{w.priority}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${w.is_walkin ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>
                        {w.is_walkin ? 'Walk-in' : 'Booked'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!current && waiting.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">The queue is empty.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default WalkIns
