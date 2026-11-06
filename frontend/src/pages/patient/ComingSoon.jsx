import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { PageHeading } from '../../components/hospital/ui.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Lightweight placeholder for patient pages not yet designed.
 * Keeps every sidebar route working and on-theme.
 */
function ComingSoon({ title, subtitle }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={title} subtitle={subtitle} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blueLight text-brand-blue">
          <Construction className="h-7 w-7" />
        </span>
        <p className="text-[15px] font-bold text-brand-navy">{t('ppage.comingSoon')}</p>
        <p className="max-w-md text-[13px] text-slate-500">
          {t('ppage.comingSoonDesc')}
        </p>
        <Link to="/patient-dashboard" className="mt-1 rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-blueDark">
          {t('ppage.backToDashboardArrow')}
        </Link>
      </div>
    </div>
  )
}

export default ComingSoon
