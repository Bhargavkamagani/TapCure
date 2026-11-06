import { PageHeading } from '../../components/hospital/ui.jsx'
import FamilyMembers from '../../components/patient/FamilyMembers.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Standalone "Family Members" page for the patient console.
 *
 * The roster itself lives in <FamilyMembers/> (also reachable via the
 * `?addFamily=1` deep-link from the booking pages). The page supplies the
 * heading, so the card renders without its own header.
 */
export default function Family() {
  const { patient } = usePatientCtx()
  const { t } = useI18n()

  if (!patient) {
    return <p className="py-10 text-center text-sm text-slate-400">{t('pcommon.loading')}</p>
  }

  return (
    <div className="space-y-5">
      <PageHeading title={t('ppage.familyTitle')} subtitle={t('ppage.familySubtitle')} />
      <FamilyMembers patientId={patient.patient_id} showHeader={false} />
    </div>
  )
}
