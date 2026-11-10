import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import { motion } from 'framer-motion'
import {
  Activity, X, HeartPulse, Thermometer, Droplets, Wind, Scale, Gauge,
  AlertTriangle, TrendingUp, Clock,
} from 'lucide-react'
import { patientsApi } from '../../api'

/**
 * Vitals & measurements UI, shared across consoles:
 *  - <VitalsCaptureForm>  inline form to record a reading (nurse/reception)
 *  - <VitalsView>         latest reading (colour-flagged) + history
 *  - <VitalsModal>        a centered modal wrapping the capture form, used from
 *                         the reception queue for quick check-in capture
 *
 * Abnormal values are colour-coded from the server-computed `flags` map.
 */

// status (from backend services/vitals) -> tint
const FLAG_TEXT = { normal: 'text-green-600', watch: 'text-amber-600', low: 'text-red-600', high: 'text-red-600', critical: 'text-red-700' }
const FLAG_CARD = {
  normal: 'border-green-100 bg-green-50/40',
  watch: 'border-amber-200 bg-amber-50/50',
  low: 'border-red-200 bg-red-50/50',
  high: 'border-red-200 bg-red-50/50',
  critical: 'border-red-300 bg-red-100/70',
}
const FLAG_LABEL = { watch: 'px.v.flagWatch', low: 'px.v.flagLow', high: 'px.v.flagHigh', critical: 'px.v.flagCritical' }

const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

// Which cards to render for a reading, in order. `val` returns null to skip.
const METRICS = [
  { key: 'bp', label: 'Blood Pressure', labelKey: 'px.v.bloodPressure', unit: 'mmHg', val: (v) => (v.bp_systolic != null || v.bp_diastolic != null ? `${v.bp_systolic ?? '–'}/${v.bp_diastolic ?? '–'}` : null) },
  { key: 'pulse', label: 'Pulse', labelKey: 'px.v.pulse', unit: 'bpm', val: (v) => v.pulse },
  { key: 'temperature', label: 'Temp', labelKey: 'px.v.temp', unit: '°F', val: (v) => v.temperature_f },
  { key: 'spo2', label: 'SpO₂', unit: '%', val: (v) => v.spo2 },
  { key: 'blood_sugar', label: 'Blood Sugar', labelKey: 'px.v.bloodSugar', unit: 'mg/dL', val: (v) => v.blood_sugar },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²', val: (v) => v.bmi },
  { key: 'weight', label: 'Weight', labelKey: 'px.v.weight', unit: 'kg', val: (v) => v.weight_kg, noflag: true },
]

function MetricCard({ label, unit, value, status }) {
  const { t } = useI18n()
  const tone = status ? FLAG_TEXT[status] : 'text-brand-navy'
  const card = status ? FLAG_CARD[status] : 'border-slate-100 bg-slate-50/60'
  return (
    <div className={`rounded-xl border px-3 py-2 ${card}`}>
      <p className="text-[12px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-[16px] font-extrabold leading-none ${tone}`}>
        {value}<span className="ml-1 text-[13px] font-medium text-slate-400">{unit}</span>
      </p>
      {status && status !== 'normal' && (
        <p className={`mt-0.5 text-[12px] font-bold uppercase ${tone}`}>{FLAG_LABEL[status] ? t(FLAG_LABEL[status]) : status}</p>
      )}
    </div>
  )
}

/* ============================================================
 * Shared, attractive vitals primitives — used by the reception
 * Vitals page and the doctor dashboard's current-patient card.
 * ============================================================ */

// flag → chip colour (anything non-normal reads as a coloured alert)
const CHIP_TONE = {
  normal: 'bg-slate-100 text-slate-600',
  watch: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-600',
  high: 'bg-red-100 text-red-600',
  critical: 'bg-red-200 text-red-700',
}

// each measurement → icon + value extractor + which `flags` key colours it
export const VITAL_CHIPS = [
  { key: 'bp', label: 'BP', icon: HeartPulse, flag: 'bp', val: (v) => (v.bp_systolic != null || v.bp_diastolic != null ? `${v.bp_systolic ?? '–'}/${v.bp_diastolic ?? '–'}` : null) },
  { key: 'pulse', label: 'Pulse', labelKey: 'px.v.pulse', icon: Activity, flag: 'pulse', val: (v) => (v.pulse != null ? `${v.pulse} bpm` : null) },
  { key: 'temp', label: 'Temp', labelKey: 'px.v.temp', icon: Thermometer, flag: 'temperature', val: (v) => (v.temperature_f != null ? `${v.temperature_f}°F` : null) },
  { key: 'spo2', label: 'SpO₂', icon: Wind, flag: 'spo2', val: (v) => (v.spo2 != null ? `${v.spo2}%` : null) },
  { key: 'sugar', label: 'Sugar', labelKey: 'px.v.sugar', icon: Droplets, flag: 'blood_sugar', val: (v) => (v.blood_sugar != null ? `${v.blood_sugar}` : null) },
  { key: 'bmi', label: 'BMI', icon: Gauge, flag: 'bmi', val: (v) => (v.bmi != null ? `${v.bmi}` : null) },
  { key: 'weight', label: 'Wt', labelKey: 'px.v.wt', icon: Scale, flag: null, val: (v) => (v.weight_kg != null ? `${v.weight_kg} kg` : null) },
]

export function VitalChip({ icon: Icon, label, value, status }) {
  const tone = CHIP_TONE[status] || CHIP_TONE.normal
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5 opacity-70" />
      <span className="opacity-70">{label}</span>
      <span className="font-extrabold">{value}</span>
    </span>
  )
}

/** Tiny BP trend line. data = systolic values, oldest→newest. */
export function VitalsSparkline({ data, color = '#2563eb' }) {
  if (!data || data.length < 2) return null
  const w = 92, h = 26, pad = 3
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pt = (d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad)
    const y = h - pad - ((d - min) / span) * (h - 2 * pad)
    return [x, y]
  }
  const line = data.map((d, i) => pt(d, i).join(',')).join(' ')
  const [lx, ly] = pt(data[data.length - 1], data.length - 1)
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polygon points={area} fill={color} opacity="0.08" />
      <motion.polyline
        points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <circle cx={lx} cy={ly} r="2.4" fill={color} />
    </svg>
  )
}

/**
 * Self-contained "current patient vitals" card. `vitals` = the patient's
 * readings newest-first (with server `flags`/`abnormal`), null = loading.
 */
// `compact` trims the padding and the empty state so the doctor's dashboard can
// fit vitals, conditions and allergies on one screen without scrolling. The
// full-size version is still what LiveQueue renders, where it stands alone.
export function VitalsSummaryCard({ vitals, patientName, className = '', compact = false }) {
  const { t } = useI18n()
  const latest = vitals && vitals.length ? vitals[0] : null
  const series = useMemo(
    () => (vitals || []).map((v) => v.bp_systolic).filter((x) => x != null).reverse(),
    [vitals]
  )
  const chips = latest ? VITAL_CHIPS.map((c) => ({ c, value: c.val(latest) })).filter((x) => x.value != null && x.value !== '') : []

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-card ${latest?.abnormal ? 'border-red-200' : 'border-slate-100'} ${className}`}>
      <div className={`flex items-center justify-between gap-2 border-b border-slate-100 ${compact ? 'px-4 py-2.5' : 'px-5 py-3.5'}`}>
        <h3 className={`flex items-center gap-1.5 font-bold text-brand-navy ${compact ? 'text-[13.5px]' : 'text-[15px]'}`}>
          <span className={`flex items-center justify-center rounded-lg bg-rose-100 text-rose-500 ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}><Activity className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} /></span>{t('pm.currentPatientVitals')}</h3>
        {latest && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold ${latest.abnormal ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${latest.abnormal ? 'bg-red-500' : 'bg-emerald-500'}`} />
            {latest.abnormal ? t('pm.needsAttention') : t('px.v.stable')}
          </span>
        )}
      </div>

      <div className={`flex-1 ${compact ? 'p-3.5' : 'p-5'}`}>
        {vitals === null ? (
          <p className="py-4 text-center text-[13px] text-slate-400">{t('pm.loading')}</p>
        ) : !latest ? (
          <div className={`flex flex-col items-center gap-1.5 text-center ${compact ? 'py-3' : 'py-6'}`}>
            <span className={`flex items-center justify-center rounded-xl bg-slate-100 text-slate-300 ${compact ? 'h-8 w-8' : 'h-11 w-11'}`}><HeartPulse className={compact ? 'h-4 w-4' : 'h-5 w-5'} /></span>
            <p className="text-[13px] font-semibold text-slate-500">{patientName ? t('px.v.noVitalsRecorded') : t('px.v.noPatient')}</p>
            <p className="text-[13px] text-slate-400">{patientName ? t('px.v.nothingYet', { name: patientName }) : t('px.v.callPatient')}</p>
          </div>
        ) : (
          <>
            {patientName && (
              <p className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-brand-navy">
                {patientName}
                {latest.family_member_name && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[13px] font-semibold text-purple-600">{t('pm.forPerson', { name: latest.family_member_name })}</span>}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {chips.map(({ c, value }) => (
                <VitalChip key={c.key} icon={c.icon} label={c.labelKey ? t(c.labelKey) : c.label} value={value} status={c.flag ? latest.flags?.[c.flag] : null} />
              ))}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <p className="flex items-center gap-1 text-[13px] text-slate-400">
                <Clock className="h-3 w-3" /> {fmtDateTime(latest.recorded_at)}{latest.recorded_by_name ? ` · ${latest.recorded_by_name}` : ''}
              </p>
              {series.length >= 2 && (
                <div className="shrink-0 text-right">
                  <p className="mb-0.5 flex items-center justify-end gap-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                    <TrendingUp className="h-3 w-3" />{t('pm.bpTrend')}</p>
                  <VitalsSparkline data={series} color={latest.abnormal ? '#ef4444' : '#2563eb'} />
                </div>
              )}
            </div>
            {latest.notes && <p className="mt-2.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-500">{latest.notes}</p>}
          </>
        )}
      </div>
    </div>
  )
}

export function VitalsView({ vitals }) {
  const { t } = useI18n()
  if (vitals === null) return <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-400">{t('pm.loading')}</p>
  if (!vitals.length) return <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-400">{t('pm.noVitals')}</p>
  const latest = vitals[0]
  const cards = METRICS.map((m) => ({ m, value: m.val(latest) })).filter((c) => c.value != null && c.value !== '')
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[13px] text-slate-400">{t('px.v.latestAt', { date: fmtDateTime(latest.recorded_at) })}{latest.recorded_by_name ? ` · ${t('px.v.byName', { name: latest.recorded_by_name })}` : ''}</p>
        <div className="flex items-center gap-1.5">
          {latest.family_member_name && <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[13px] font-semibold text-purple-600">{t('pm.forPerson', { name: latest.family_member_name })}</span>}
          {latest.abnormal && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[13px] font-bold text-red-600">{t('pm.needsAttention')}</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map(({ m, value }) => (
          <MetricCard key={m.key} label={m.labelKey ? t(m.labelKey) : m.label} unit={m.unit} value={value}
            status={m.noflag ? null : latest.flags?.[m.key]} />
        ))}
      </div>
      {latest.notes && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[13px] text-slate-500">{latest.notes}</p>}

      {vitals.length > 1 && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-[13px] font-semibold text-brand-blue">{t('px.v.earlier', { n: vitals.length - 1 })}</summary>
          <ul className="mt-2 space-y-1.5">
            {vitals.slice(1).map((v) => (
              <li key={v.vital_id} className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-1.5 text-[13px]">
                <span className="text-slate-500">{fmtDateTime(v.recorded_at)}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-600">
                  {v.bp_systolic != null && <span className={FLAG_TEXT[v.flags?.bp] || ''}>BP {v.bp_systolic}/{v.bp_diastolic}</span>}
                  {v.pulse != null && <span className={FLAG_TEXT[v.flags?.pulse] || ''}>{v.pulse}bpm</span>}
                  {v.temperature_f != null && <span className={FLAG_TEXT[v.flags?.temperature] || ''}>{v.temperature_f}°F</span>}
                  {v.spo2 != null && <span className={FLAG_TEXT[v.flags?.spo2] || ''}>SpO₂ {v.spo2}%</span>}
                  {v.blood_sugar != null && <span className={FLAG_TEXT[v.flags?.blood_sugar] || ''}>{t('px.v.sugar')} {v.blood_sugar}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

const _field = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13.5px] text-brand-navy outline-none focus:border-brand-blue'
const num = (s) => (s === '' || s == null ? undefined : Number(s))

export function VitalsCaptureForm({ patientId, appointmentId, defaultFamilyMemberId, onDone, submitLabel }) {
  const { t } = useI18n()
  const [f, setF] = useState({
    bp_systolic: '', bp_diastolic: '', pulse: '', temperature_f: '', spo2: '',
    weight_kg: '', height_cm: '', blood_sugar: '', sugar_type: '', respiratory_rate: '', notes: '',
  })
  const [family, setFamily] = useState([])
  const [forWhom, setForWhom] = useState(defaultFamilyMemberId ? String(defaultFamilyMemberId) : 'self')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  useEffect(() => {
    if (!patientId) return
    patientsApi.family(patientId)
      .then((r) => setFamily((r || []).filter((m) => m.is_active)))
      .catch(() => setFamily([]))
  }, [patientId])

  const liveBmi = useMemo(() => {
    const w = num(f.weight_kg), h = num(f.height_cm)
    if (!w || !h) return null
    const m = h / 100
    return m > 0 ? (w / (m * m)).toFixed(1) : null
  }, [f.weight_kg, f.height_cm])

  const submit = async (e) => {
    e.preventDefault()
    const body = {
      patient_id: patientId, appointment_id: appointmentId || undefined,
      family_member_id: forWhom === 'self' ? undefined : forWhom,
      bp_systolic: num(f.bp_systolic), bp_diastolic: num(f.bp_diastolic), pulse: num(f.pulse),
      temperature_f: num(f.temperature_f), spo2: num(f.spo2), respiratory_rate: num(f.respiratory_rate),
      weight_kg: num(f.weight_kg), height_cm: num(f.height_cm), blood_sugar: num(f.blood_sugar),
      sugar_type: f.sugar_type || undefined, notes: f.notes,
    }
    const measures = ['bp_systolic', 'bp_diastolic', 'pulse', 'temperature_f', 'spo2', 'respiratory_rate', 'weight_kg', 'height_cm', 'blood_sugar']
    if (!measures.some((k) => body[k] != null)) { setErr(t('px.v.enterOne')); return }
    setBusy(true); setErr(null)
    try { await patientsApi.recordVitals(body); onDone?.() }
    catch (e2) { setErr(e2.message || t('px.couldNotSave')); setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      {family.length > 0 && (
        <select className={_field} value={forWhom} onChange={(e) => setForWhom(e.target.value)}>
          <option value="self">{t('pm.self')}</option>
          {family.map((m) => (
            <option key={m.member_id} value={String(m.member_id)}>{t('pm.forPerson', { name: m.name })}{m.relation ? ` — ${m.relation}` : ''}</option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid grid-cols-2 gap-1.5">
          <input className={_field} inputMode="numeric" placeholder={t('pm.bpSys')} value={f.bp_systolic} onChange={set('bp_systolic')} />
          <input className={_field} inputMode="numeric" placeholder={t('pm.bpDia')} value={f.bp_diastolic} onChange={set('bp_diastolic')} />
        </div>
        <input className={_field} inputMode="numeric" placeholder={t('pm.pulse')} value={f.pulse} onChange={set('pulse')} />
        <input className={_field} inputMode="decimal" placeholder={t('pm.temp')} value={f.temperature_f} onChange={set('temperature_f')} />
        <input className={_field} inputMode="numeric" placeholder={t('pm.spo2')} value={f.spo2} onChange={set('spo2')} />
        <input className={_field} inputMode="decimal" placeholder={t('pm.weight')} value={f.weight_kg} onChange={set('weight_kg')} />
        <input className={_field} inputMode="decimal" placeholder={t('pm.height')} value={f.height_cm} onChange={set('height_cm')} />
        <input className={_field} inputMode="numeric" placeholder={t('pm.bloodSugar')} value={f.blood_sugar} onChange={set('blood_sugar')} />
        <select className={_field} value={f.sugar_type} onChange={set('sugar_type')}>
          <option value="">{t('pm.sugarType')}</option>
          <option value="fasting">{t('pm.fasting')}</option>
          <option value="random">{t('pm.random')}</option>
          <option value="pp">{t('pm.postMeal')}</option>
        </select>
      </div>
      {liveBmi && <p className="text-[13px] font-semibold text-slate-500">{t('pm.bmi')} <span className="text-brand-navy">{liveBmi}</span> kg/m²</p>}
      <input className={_field} placeholder={t('pm.notesOptional')} value={f.notes} onChange={set('notes')} />
      {err && <p className="rounded-lg bg-red-50 px-2 py-1 text-[13px] text-red-600">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-brand-blue py-1.5 text-[13px] font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
        {busy ? t('pcommon.saving') : (submitLabel || t('px.v.saveVitals'))}
      </button>
    </form>
  )
}

/** Centered modal for quick capture from the queue (check-in). */
export function VitalsModal({ patient, appointmentId, defaultFamilyMemberId, onClose, onSaved }) {
  const { t } = useI18n()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-brand-navy">
            <Activity className="h-4 w-4 text-rose-500" />{t('pm.recordVitals')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-[13.5px] text-slate-500">
          {patient?.name}{patient?.uhid ? ` · ${patient.uhid}` : ''}
        </p>
        <VitalsCaptureForm patientId={patient.patient_id} appointmentId={appointmentId}
          defaultFamilyMemberId={defaultFamilyMemberId}
          onDone={() => { onSaved?.(); onClose() }} />
      </motion.div>
    </motion.div>
  )
}
