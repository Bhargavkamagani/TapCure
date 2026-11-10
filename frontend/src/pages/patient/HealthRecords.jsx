import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Upload, ShieldCheck, AlertCircle, HeartPulse, Activity } from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { Banner } from '../../components/common/FormControls.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { patientsApi } from '../../api'
import { VitalsView } from '../../components/patient/VitalsPanel.jsx'
import HealthTimeline from '../../components/patient/HealthTimeline.jsx'
import { prettyDate } from '../../lib/format.js'
import { useI18n } from '../../i18n/index.jsx'

const SEVERITY_TONE = {
  severe: 'bg-red-50 text-red-600',
  moderate: 'bg-amber-50 text-amber-600',
  mild: 'bg-yellow-50 text-yellow-700',
}

/**
 * Health records — the account holder's unified <HealthTimeline/> (visits,
 * prescriptions, vitals, reports, upcoming follow-ups) alongside their standing
 * medical facts (latest vitals, ongoing conditions, allergies). Uploaded reports
 * appear inside the timeline, so there's no separate documents list.
 */
function HealthRecords() {
  const { t } = useI18n()
  const { patient } = usePatientCtx()
  const [conditions, setConditions] = useState([])
  const [allergies, setAllergies] = useState([])
  const [vitals, setVitals] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)   // bumps the timeline after an upload
  const fileRef = useRef(null)

  // Stable "self" person for the timeline (member_id null = account holder).
  const self = useMemo(() => ({ member_id: null, name: patient?.name }), [patient?.name])

  const load = useCallback(async () => {
    if (!patient) return
    const [h, a, v, shared] = await Promise.all([
      patientsApi.medicalHistory(patient.patient_id).catch(() => []),
      patientsApi.allergies(patient.patient_id).catch(() => []),
      patientsApi.vitals(patient.patient_id).catch(() => []),
      patientsApi.sharedVitals().catch(() => []),
    ])
    setConditions(h || [])
    setAllergies(a || [])
    // Own readings are the ones with no dependent attached — the rest of this
    // account's own record belongs to its dependents and is shown on their
    // cards. `shared` is the mirror case: readings taken for THIS person under
    // someone else's family record, which are theirs to see.
    setVitals(
      [...(v || []).filter((row) => !row.family_member_id), ...(shared || [])]
        .sort((x, y) => new Date(y.recorded_at || 0) - new Date(x.recorded_at || 0)),
    )
  }, [patient])

  useEffect(() => { load() }, [load])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !patient) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('patient_id', patient.patient_id)
      fd.append('document_type', 'report')
      fd.append('file', file)
      await patientsApi.uploadDocument(fd)
      setReloadKey((k) => k + 1)   // refresh the timeline so the new report shows
    } catch (err) {
      setError(err.message || t('ppage.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.hrTitle')} subtitle={t('ppage.hrSubtitle')}>
        <input ref={fileRef} type="file" className="hidden" onChange={onUpload} />
        <ToolButton icon={Upload} tone="primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? t('ppage.uploading') : t('ppage.uploadRecord')}
        </ToolButton>
      </PageHeading>

      {error && <Banner type="error">{error}</Banner>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Unified health timeline */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[16px] font-bold text-brand-navy">
            <Activity className="h-4 w-4 text-purple-500" /> {t('ppage.timeline')}
          </h3>
          <HealthTimeline key={reloadKey} member={self} patientId={patient?.patient_id} />
        </Card>

        {/* Standing medical facts */}
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-brand-navy">
              <HeartPulse className="h-4 w-4 text-rose-500" />{t('pm.latestVitals')}</h3>
            <VitalsView vitals={vitals} />
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-brand-navy">
              <HeartPulse className="h-4 w-4 text-brand-blue" /> {t('ppage.ongoingConditions')}
            </h3>
            {conditions.length === 0 ? (
              <p className="text-[13.5px] text-slate-400">{t('ppage.noConditions')}</p>
            ) : (
              <ul className="space-y-2">
                {conditions.map((c) => (
                  <li key={c.history_id} className="rounded-lg bg-blue-50 px-3 py-2 text-[13.5px] font-medium text-brand-navy">
                    {c.condition}
                    {c.is_chronic && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[13px] font-semibold text-brand-blue">{t('ppage.chronic')}</span>}
                    {c.diagnosed_date && <span className="ml-2 text-[13px] text-slate-400">{prettyDate(c.diagnosed_date)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-brand-navy">
              <AlertCircle className="h-4 w-4 text-red-500" /> {t('ppage.allergies')}
            </h3>
            {allergies.length === 0 ? (
              <p className="text-[13.5px] text-slate-400">{t('ppage.noAllergies')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allergies.map((a) => (
                  <span
                    key={a.allergy_id}
                    className={`rounded-full px-3 py-1 text-[13px] font-semibold ${SEVERITY_TONE[a.severity?.toLowerCase()] || 'bg-red-50 text-red-600'}`}
                    title={[a.allergy_type, a.severity, a.reaction].filter(Boolean).join(' · ')}
                  >
                    {a.allergen}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-[13.5px] text-green-700">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        {t('ppage.dataSecure')}
      </div>
    </div>
  )
}

export default HealthRecords
