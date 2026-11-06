import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { motion } from 'framer-motion'
import { X, Phone, User, MapPin, Droplet, Copy, Check, Printer, IdCard, AlertTriangle, Stethoscope, FileText, CalendarClock, Plus, Activity, Home, BadgeCheck, ClipboardList, Info } from 'lucide-react'
import { Avatar } from '../hospital/ui.jsx'
import { patientsApi, revisitPassesApi, fileUrl } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { VitalsView, VitalsCaptureForm } from './VitalsPanel.jsx'

/**
 * The patient's full history, shown as a right-side drawer. Shared by the
 * receptionist (assistant) and doctor consoles so both show — and capture —
 * identical history: UHID card, allergies, conditions, documents and visits.
 */

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SEVERITY_PILL = {
  'Mild': 'bg-amber-100 text-amber-700',
  'Moderate': 'bg-orange-100 text-orange-700',
  'Severe': 'bg-red-100 text-red-700',
  'Life-threatening': 'bg-red-600 text-white',
}

const STATUS_PILL = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  'no-show': 'bg-slate-200 text-slate-600',
  waiting: 'bg-amber-100 text-amber-700',
}

function CopyButton({ value }) {
  const { t } = useI18n()
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1400)
    } catch { /* clipboard blocked — ignore */ }
  }
  return (
    <button onClick={copy} title={t('pm.copyUhid')} className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/25">
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{done ? t('px.copied') : t('px.copy')}
    </button>
  )
}

/** Patient identity hero — the drawer's header AND the printed take-home slip.
 *
 *  These used to be three separate blocks: a "Patient History" title bar, an
 *  avatar+name row, and a gradient UHID card that repeated the name, age, gender
 *  and phone all over again — the same four facts rendered three times before a
 *  single clinical detail appeared. Folding them into one band is what buys the
 *  vertical space the tabs now sit in.
 *
 *  It keeps `print-card`, which `index.css` relies on to print this element
 *  alone. That is also why it lives ABOVE the tabs and not inside one: an
 *  element in an unmounted tab cannot be printed, so Print would silently
 *  produce a blank page from any tab but the first.
 */
export function UhidCard({ patient, onClose }) {
  const { t } = useI18n()
  const uhid = patient.uhid || `PID #${patient.patient_id}`
  const chips = [
    [patient.age && `${patient.age}y`, patient.gender].filter(Boolean).join(' · '),
    patient.blood_group,
    patient.phone,
  ].filter(Boolean)
  return (
    <div className="print-card relative overflow-hidden bg-gradient-to-br from-brand-blue to-brand-blueDark px-5 pb-4 pt-4 text-white">
      {/* Two soft light blooms. Purely decorative, so they must not intercept
          the close button or the copy/print row sitting on top of them. */}
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-white/5 blur-2xl" />

      <div className="relative flex items-start justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
          <IdCard className="h-3.5 w-3.5" />{t('pm.patientRecord')}
        </p>
        {onClose && (
          <button onClick={onClose} aria-label={t('pm.close')}
                  className="-mr-1 -mt-1 rounded-lg p-1 text-white/70 transition hover:bg-white/15 hover:text-white print:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="relative mt-3 flex items-center gap-3">
        <Avatar name={patient.name} className="h-14 w-14 shrink-0 text-lg ring-2 ring-white/30" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[18px] font-extrabold">{patient.name}</p>
          <p className="mt-0.5 font-mono text-[13px] font-bold tracking-wide text-white/90">{uhid}</p>
        </div>
      </div>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white/95">
            {c}
          </span>
        ))}
      </div>

      <div className="relative mt-3 flex items-center gap-2 print:hidden">
        <CopyButton value={uhid} />
        <button onClick={() => window.print()}
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/25">
          <Printer className="h-3.5 w-3.5" />{t('pm.printCard')}
        </button>
      </div>
    </div>
  )
}

/* The three views the record is split into. Scrolling past every section to
   reach a visit was the drawer's real problem, not its colours. */
const TABS = [
  { key: 'overview', labelKey: 'pm.tabOverview', icon: User },
  { key: 'clinical', labelKey: 'pm.tabClinical', icon: Stethoscope },
  { key: 'visits', labelKey: 'pm.tabVisits', icon: CalendarClock },
]

function Tabs({ value, onChange, counts }) {
  const { t } = useI18n()
  return (
    <div className="flex gap-1 border-b border-slate-100 bg-white px-3 print:hidden">
      {TABS.map(({ key, labelKey, icon: Icon }) => {
        const active = value === key
        return (
          <button key={key} onClick={() => onChange(key)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-[12.5px] font-bold transition
                              ${active ? 'text-brand-blue' : 'text-slate-400 hover:text-slate-600'}`}>
            <Icon className="h-4 w-4" />
            {t(labelKey)}
            {counts[key] > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-brand-blueLight text-brand-blue' : 'bg-slate-100 text-slate-400'}`}>
                {counts[key]}
              </span>
            )}
            {active && (
              <motion.span layoutId="pm-tab-underline"
                           className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-brand-blue" />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* Says out loud that a list is scoped to the viewer.
   Not decoration: the server returns only the records this caller is party to,
   and a doctor reading three vitals as "that is her whole history" would draw a
   clinical conclusion from an access-control decision. */
function ScopeNote({ role, doctorKey, hospitalKey }) {
  const { t } = useI18n()
  if (role === 'PATIENT' || role === 'SUPER_ADMIN' || !role) return null
  return (
    <p className="mb-2.5 flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-500">
      <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
      {t(role === 'DOCTOR' ? doctorKey : hospitalKey)}
    </p>
  )
}

/* Allergies are the one thing that must not be a tab away. This strip stays
   under the header on every tab, so a life-threatening allergy cannot be hidden
   behind a click the doctor never made. */
function AllergyStrip({ allergies }) {
  const { t } = useI18n()
  if (allergies === null) return null
  if (allergies.length === 0) {
    return (
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-2 text-[11.5px] font-semibold text-slate-400">
        <Check className="h-3.5 w-3.5" />{t('pm.noAllergies')}
      </div>
    )
  }
  const worst = allergies.some((a) => a.severity === 'Life-threatening' || a.severity === 'Severe')
  return (
    <div className={`flex items-start gap-2 border-b px-5 py-2.5 ${worst ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${worst ? 'text-red-600' : 'text-amber-600'}`} />
      <div className="min-w-0">
        <p className={`text-[11px] font-bold uppercase tracking-wide ${worst ? 'text-red-700' : 'text-amber-700'}`}>
          {t('pm.allergyAlert')}
        </p>
        <p className={`text-[12.5px] font-semibold ${worst ? 'text-red-900' : 'text-amber-900'}`}>
          {allergies.map((a) => a.allergen).join(', ')}
        </p>
      </div>
    </div>
  )
}

/* A titled history section: icon + count, an optional header "+ Add" action, an
   optional inline form, and the list (or a muted empty note). */
function HistorySection({ icon: Icon, title, count, tone = 'text-slate-400', children, empty, action, form }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <h4 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-brand-navy">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {title}
        {count > 0 && <span className="text-slate-300">({count})</span>}
        {action && <span className="ml-auto">{action}</span>}
      </h4>
      {form}
      {count === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] text-slate-400">{empty}</p> : children}
    </section>
  )
}

function AddToggle({ open, onClick }) {
  const { t } = useI18n()
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-brand-blue hover:bg-blue-50">
      {open ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{open ? t('pm.close') : t('px.add')}
    </button>
  )
}

const _field = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] text-brand-navy outline-none focus:border-brand-blue'

/* Wrapper around an inline add-form: handles busy/error state + Save button. */
function AddForm({ onSubmit, onDone, children, submitLabel }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try { await onSubmit(); onDone() }
    catch (e2) { setErr(e2.message || t('px.couldNotSave')); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {children}
      {err && <p className="rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-600">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-brand-blue py-1.5 text-[12px] font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
        {busy ? t('pcommon.saving') : (submitLabel || t('pm.save'))}
      </button>
    </form>
  )
}

function AddAllergyForm({ patientId, onDone }) {
  const { t } = useI18n()
  const [f, setF] = useState({ allergen: '', allergy_type: 'drug', severity: 'Mild', reaction: '' })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  return (
    <AddForm onDone={onDone} onSubmit={() => {
      if (!f.allergen.trim()) throw new Error(t('px.hist.allergenRequired'))
      return patientsApi.addAllergy({ patient_id: patientId, ...f, allergen: f.allergen.trim() })
    }}>
      <input className={_field} placeholder={t('pm.allergenPh')} value={f.allergen} onChange={set('allergen')} />
      <div className="grid grid-cols-2 gap-2">
        <select className={_field} value={f.allergy_type} onChange={set('allergy_type')}>
          {['drug', 'food', 'environmental', 'other'].map((ty) => <option key={ty} value={ty}>{t(`px.allergyType.${ty}`)}</option>)}
        </select>
        <select className={_field} value={f.severity} onChange={set('severity')}>
          {['Mild', 'Moderate', 'Severe', 'Life-threatening'].map((s) => <option key={s} value={s}>{t(`px.severity.${s}`)}</option>)}
        </select>
      </div>
      <input className={_field} placeholder={t('pm.reactionPh')} value={f.reaction} onChange={set('reaction')} />
    </AddForm>
  )
}

function AddConditionForm({ patientId, onDone }) {
  const { t } = useI18n()
  const [f, setF] = useState({ condition: '', diagnosed_date: '', is_chronic: false, notes: '' })
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))
  return (
    <AddForm onDone={onDone} onSubmit={() => {
      if (!f.condition.trim()) throw new Error(t('px.hist.conditionRequired'))
      return patientsApi.addHistory({
        patient_id: patientId, condition: f.condition.trim(), is_chronic: f.is_chronic,
        diagnosed_date: f.diagnosed_date || undefined, notes: f.notes,
      })
    }}>
      <input className={_field} placeholder={t('pm.conditionPh')} value={f.condition} onChange={set('condition')} />
      <div className="grid grid-cols-2 items-center gap-2">
        <input type="date" className={_field} value={f.diagnosed_date} onChange={set('diagnosed_date')} />
        <label className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
          <input type="checkbox" checked={f.is_chronic} onChange={(e) => setF((s) => ({ ...s, is_chronic: e.target.checked }))} /> {t('pm.chronic')}
        </label>
      </div>
      <input className={_field} placeholder={t('pm.notesOptional')} value={f.notes} onChange={set('notes')} />
    </AddForm>
  )
}

function UploadDocForm({ patientId, appointments = [], role, onDone }) {
  const { t } = useI18n()
  const [docType, setDocType] = useState('lab_report')
  const [appointmentId, setAppointmentId] = useState('')
  const [file, setFile] = useState(null)
  const receptionistLabReport = role === 'RECEPTIONIST' && docType === 'lab_report'
  const completedVisits = appointments.filter((a) => a.status === 'completed')
  return (
    <AddForm onDone={onDone} submitLabel={t('px.upload')} onSubmit={() => {
      if (!file) throw new Error(t('px.hist.chooseFileFirst'))
      if (receptionistLabReport && !appointmentId) throw new Error(t('px.hist.selectConsultation'))
      const fd = new FormData()
      fd.append('patient_id', patientId)
      fd.append('document_type', docType)
      if (appointmentId) fd.append('appointment_id', appointmentId)
      fd.append('file', file)
      return patientsApi.uploadDocument(fd)
    }}>
      <select className={_field} value={docType} onChange={(e) => setDocType(e.target.value)}>
        {[
          ['lab_report', t('px.labReport')],
          ['prescription', t('ppage.evtRx')],
          ['scan', t('px.docScan')],
          ['id_proof', t('px.docIdProof')],
          ['other', t('ppage.genderOther')],
        ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {receptionistLabReport && (
        <select className={_field} value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} required>
          <option value="">{t('px.hist.selectConsultationOpt')}</option>
          {completedVisits.map((a) => (
            <option key={a.appointment_id} value={a.appointment_id}>
              {fmtDate(a.appointment_date)} · {t('px.drName', { name: a.doctor_name || t('ppage.doctor') })} · {a.hospital_name || t('ppage.hospitalLabel')}
            </option>
          ))}
        </select>
      )}
      {receptionistLabReport && completedVisits.length === 0 && (
        <p className="text-[11px] text-amber-600">{t('px.hist.noCompletedConsult')}</p>
      )}
      <input type="file" className="w-full text-[11.5px] text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-blueLight file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-brand-blue" onChange={(e) => setFile(e.target.files?.[0] || null)} />
    </AddForm>
  )
}

export default function PatientHistoryDrawer({ patient, onClose }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const tx = (prefix, v) => { const k = prefix + v; const s = t(k); return s === k ? v : s }
  const pid = patient.patient_id
  const [appts, setAppts] = useState(null)
  const [allergies, setAllergies] = useState(null)
  const [history, setHistory] = useState(null)
  const [docs, setDocs] = useState(null)
  // Free revisit passes this patient holds. Fetched here rather than passed in
  // because all four consoles open this drawer, and only two of them know which
  // doctor is in context.
  const [passes, setPasses] = useState([])
  // Redemption state, keyed by pass_id so two passes on one record can't share
  // a spinner or an error.
  const [redeeming, setRedeeming] = useState(null)
  const [redeemNote, setRedeemNote] = useState(null)
  const [vitals, setVitals] = useState(null)
  const [openForm, setOpenForm] = useState(null)  // 'allergy' | 'condition' | 'doc' | 'vitals'
  const [tab, setTab] = useState('overview')

  const loadAllergies = useCallback(() => patientsApi.allergies(pid).then(setAllergies).catch(() => setAllergies([])), [pid])
  const loadHistory = useCallback(() => patientsApi.medicalHistory(pid).then(setHistory).catch(() => setHistory([])), [pid])
  const loadDocs = useCallback(() => patientsApi.documents(pid).then(setDocs).catch(() => setDocs([])), [pid])
  const loadVitals = useCallback(() => patientsApi.vitals(pid).then(setVitals).catch(() => setVitals([])), [pid])

  useEffect(() => {
    patientsApi.appointments(pid).then(setAppts).catch(() => setAppts([]))
    // Failure is silent: a missing perk badge must never blank the whole record.
    revisitPassesApi.forPatient(pid).then((r) => setPasses(r || [])).catch(() => setPasses([]))
    loadAllergies(); loadHistory(); loadDocs(); loadVitals()
  }, [pid, loadAllergies, loadHistory, loadDocs, loadVitals])

  /**
   * Spend a free revisit at the counter: the server creates today's zero-fee
   * visit and issues the token in one call.
   *
   * Deliberately not a confirm() dialog — the desk does this with the patient
   * standing there, and the action is reversible by cancelling the visit, which
   * hands the pass back. What it DOES show is the token number, because that is
   * the thing the desk has to read out.
   */
  const useRevisit = async (p) => {
    setRedeeming(p.pass_id)
    setRedeemNote(null)
    try {
      const r = await revisitPassesApi.redeem(p.pass_id)
      setRedeemNote({
        type: 'success',
        text: t('rvp.redeemed', { token: r.display_code || r.token_number }),
      })
      // Refetch rather than filter locally: the server is the only thing that
      // knows whether anything else about this patient's passes changed.
      revisitPassesApi.forPatient(pid).then((rows) => setPasses(rows || [])).catch(() => {})
    } catch (e) {
      setRedeemNote({ type: 'error', text: e.message || t('rvp.redeemFailed') })
    } finally {
      setRedeeming(null)
    }
  }

  const toggle = (name) => () => setOpenForm((cur) => (cur === name ? null : name))
  const afterAdd = (reload) => () => { setOpenForm(null); reload() }

  const Detail = ({ icon: Icon, label, value, wide }) => (
    <div className={`flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 ${wide ? 'col-span-2' : ''}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-bold text-brand-navy">{value || '—'}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      </div>
    </div>
  )

  const counts = {
    overview: passes.length,
    clinical: (allergies?.length || 0) + (history?.length || 0) + (docs?.length || 0),
    visits: appts?.length || 0,
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[2px]"
                onMouseDown={onClose}>
      <motion.div initial={{ x: 520 }} animate={{ x: 0 }} exit={{ x: 520 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  className="flex h-full w-full max-w-[520px] flex-col bg-slate-50 shadow-2xl"
                  onMouseDown={(e) => e.stopPropagation()}>

        {/* Header, allergy strip and tabs are fixed; only the panel scrolls. The
            patient's identity and their allergies stay on screen no matter how
            far down the record the doctor reads. */}
        <UhidCard patient={patient} onClose={onClose} />
        <AllergyStrip allergies={allergies} />
        <Tabs value={tab} onChange={setTab} counts={counts} />

        <div className="flex-1 overflow-y-auto p-4">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }} className="space-y-3">

            {tab === 'overview' && (
              <>
                {passes.map((p) => (
                  <div key={p.pass_id}
                       className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                        <BadgeCheck className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 leading-tight">
                        <p className="text-[13px] font-extrabold text-emerald-900">
                          {t('rvp.badge')}
                          {/* Whose visit this is. One account can hold a pass for
                              the holder AND for each dependant with the same
                              doctor; redeeming the sister's for the brother would
                              charge the wrong person nothing and the right person
                              full price. */}
                          {p.for_name ? (
                            <span className="ml-1.5 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                              {t('rvp.for', { name: p.for_name })}
                            </span>
                          ) : null}
                        </p>
                        {/* Names the doctor: a pass earned with one doctor is not
                            valid with another, and the desk must not have to guess. */}
                        <p className="mt-0.5 text-[12px] text-emerald-800">
                          {t('rvp.badgeUntil', {
                            date: new Date(p.valid_until).toLocaleDateString('en-IN',
                              { day: 'numeric', month: 'short', year: 'numeric' }),
                          }).replace('this doctor', p.doctor_name || 'this doctor')}
                        </p>
                        <p className="mt-0.5 text-[11.5px] font-semibold text-emerald-700">
                          {p.doctor_name ? t('px.drName', { name: p.doctor_name }) : ''} · {t('rvp.noCharge')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => useRevisit(p)}
                      disabled={redeeming === p.pass_id}
                      className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5
                                 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-emerald-700
                                 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      {redeeming === p.pass_id ? t('rvp.redeeming') : t('rvp.redeem')}
                    </button>
                  </div>
                ))}

                {/* Outside the pass list on purpose: redeeming removes the last
                    pass, and the token number must not vanish with it before the
                    desk has read it out. */}
                {redeemNote && (
                  <div className={`rounded-2xl border px-4 py-3 text-[12.5px] font-semibold ${
                    redeemNote.type === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}>
                    {redeemNote.text}
                  </div>
                )}

                <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <h4 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-brand-navy">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-50 text-brand-blue">
                      <ClipboardList className="h-3.5 w-3.5" />
                    </span>
                    {t('pm.contactDetails')}
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Detail icon={Phone} label={t('pm.mobile')} value={patient.phone} />
                    <Detail icon={User} label={t('pm.ageGender')} value={[patient.age && `${patient.age}y`, patient.gender].filter(Boolean).join(' · ')} />
                    <Detail icon={Droplet} label={t('pm.bloodGroup')} value={patient.blood_group} />
                    <Detail icon={MapPin} label={t('pm.city')} value={patient.city} />
                    {/* An address the patient set in their own profile was invisible to
                        the desk — the list only has a City column. */}
                    <Detail icon={Home} label={t('pm.address')} wide value={[patient.address, patient.pincode].filter(Boolean).join(', ')} />
                  </div>
                </section>

                {/* Vitals & measurements — the "now" snapshot, captured at check-in */}
                <HistorySection icon={Activity} title={t('pm.vitalsMeasurements')} tone="text-rose-500" count={vitals?.length || 0} empty={vitals === null ? t('pm.loading') : t('pm.noVitals')}
                  action={<AddToggle open={openForm === 'vitals'} onClick={toggle('vitals')} />}
                  form={openForm === 'vitals' && (
                    <div className="mb-2">
                      <VitalsCaptureForm patientId={pid} onDone={afterAdd(loadVitals)} />
                    </div>
                  )}>
                  <ScopeNote role={user?.role_name} doctorKey="pm.recScopeDoctor" hospitalKey="pm.recScopeHospital" />
                  <VitalsView vitals={vitals} />
                </HistorySection>
              </>
            )}

            {tab === 'clinical' && (
              <>
                {/* Allergies first — safety critical */}
                <HistorySection icon={AlertTriangle} title={t('pm.allergies')} tone="text-red-500" count={allergies?.length || 0} empty={allergies === null ? t('pm.loading') : t('ppage.noAllergies')}
                  action={<AddToggle open={openForm === 'allergy'} onClick={toggle('allergy')} />}
                  form={openForm === 'allergy' && <AddAllergyForm patientId={pid} onDone={afterAdd(loadAllergies)} />}>
                  <ul className="space-y-2">
                    {(allergies || []).map((a) => (
                      <li key={a.allergy_id} className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/50 px-3 py-2 text-[12.5px]">
                        <span className="font-semibold text-brand-navy">{a.allergen}<span className="ml-1 font-normal text-slate-400">· {tx('px.allergyType.', a.allergy_type)}</span></span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SEVERITY_PILL[a.severity] || 'bg-slate-100 text-slate-500'}`}>{tx('px.severity.', a.severity)}</span>
                      </li>
                    ))}
                  </ul>
                </HistorySection>

                {/* Medical history / conditions */}
                <HistorySection icon={Stethoscope} title={t('pm.medicalHistory')} tone="text-brand-blue" count={history?.length || 0} empty={history === null ? t('pm.loading') : t('px.hist.noConditions')}
                  action={<AddToggle open={openForm === 'condition'} onClick={toggle('condition')} />}
                  form={openForm === 'condition' && <AddConditionForm patientId={pid} onDone={afterAdd(loadHistory)} />}>
                  <ul className="space-y-2">
                    {(history || []).map((h) => (
                      <li key={h.history_id} className="rounded-xl border border-slate-100 px-3 py-2 text-[12.5px]">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-brand-navy">{h.condition}</span>
                          {h.is_chronic && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-600">{t('pm.chronic')}</span>}
                        </div>
                        {(h.diagnosed_date || h.notes) && (
                          <p className="mt-0.5 text-[11px] text-slate-400">{[h.diagnosed_date && t('px.hist.diagnosedOn', { date: fmtDate(h.diagnosed_date) }), h.notes].filter(Boolean).join(' · ')}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </HistorySection>

                {/* Lab reports and other patient documents */}
                <HistorySection icon={FileText} title={t('px.hist.labDocsTitle')} tone="text-emerald-500" count={docs?.length || 0} empty={docs === null ? t('pm.loading') : t('px.hist.noLabDocs')}
                  action={<AddToggle open={openForm === 'doc'} onClick={toggle('doc')} />}
                  form={openForm === 'doc' && <UploadDocForm patientId={pid} appointments={appts || []} role={user?.role_name} onDone={afterAdd(loadDocs)} />}>
                  <ScopeNote role={user?.role_name} doctorKey="pm.recScopeDoctor" hospitalKey="pm.recScopeHospital" />
                  <ul className="space-y-2">
                    {(docs || []).map((d) => (
                      <li key={d.document_id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-[12.5px]">
                        <span className="min-w-0 truncate font-semibold text-brand-navy">
                          {d.file_name}<span className="ml-1 font-normal capitalize text-slate-400">· {d.document_type?.replace('_', ' ')}</span>
                          {d.hospital_name && <span className="block truncate text-[10.5px] font-normal text-slate-400">{d.hospital_name}{d.doctor_name ? ` · ${t('px.drName', { name: d.doctor_name })}` : ''}</span>}
                        </span>
                        <a href={fileUrl(d.file_url)} target="_blank" rel="noreferrer" className="ml-2 shrink-0 rounded-lg bg-brand-blueLight px-2 py-1 text-[11px] font-semibold text-brand-blue hover:bg-blue-100">{t('pm.open')}</a>
                      </li>
                    ))}
                  </ul>
                </HistorySection>
              </>
            )}

            {/* Visit history — when, why, which doctor, which hospital */}
            {tab === 'visits' && (
              <HistorySection icon={CalendarClock} title={t('pm.visitHistory')} count={appts?.length || 0} empty={appts === null ? t('pm.loading') : t('px.hist.noVisits')}>
                {/* The server returns only the visits this viewer was party to.
                    Saying so matters clinically: without it a doctor reads a
                    two-line list as "this patient has barely been seen", when
                    the patient may have a long history elsewhere. */}
                <ScopeNote role={user?.role_name} doctorKey="pm.visitsScopeDoctor" hospitalKey="pm.visitsScopeHospital" />
                <ul className="space-y-2">
                  {(appts || []).slice(0, 12).map((a) => (
                    <li key={a.appointment_id} className="rounded-xl border border-slate-100 px-3 py-2.5 text-[12.5px] transition hover:border-slate-200 hover:bg-slate-50/60">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-brand-navy">{fmtDate(a.appointment_date)}{a.slot_time ? ` · ${a.slot_time.slice(0, 5)}` : ''}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_PILL[a.status] || 'bg-slate-100 text-slate-500'}`}>{tx('px.status.', a.status)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-slate-600">
                        <Stethoscope className="h-3.5 w-3.5 text-brand-blue" />
                        <span className="font-semibold">{a.doctor_name ? t('px.drName', { name: a.doctor_name }) : t('ppage.doctor')}</span>
                        {a.doctor_specialty && <span className="text-slate-400">· {a.doctor_specialty}</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                        {a.appointment_type && <span className="capitalize">{t('px.hist.purpose', { type: a.appointment_type })}</span>}
                        {a.hospital_name && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{a.hospital_name}</span>}
                      </div>
                      {a.notes && <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-500">{a.notes}</p>}
                    </li>
                  ))}
                </ul>
              </HistorySection>
            )}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}
