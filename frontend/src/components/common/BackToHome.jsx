import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

/**
 * "Back to home" escape hatch for the auth routes.
 *
 * Every login/signup route is reachable directly by URL (a shared link, a
 * bookmark, an email), so browser Back is not guaranteed to have a previous
 * entry to return to — the user can land on a login screen with no way out of
 * it. This is that way out, and it renders on all five auth routes.
 *
 * Two placements, one component: the full-bleed glass screens
 * (/patient-login, /doctor-login, /hospital-login) pass absolute positioning so
 * it floats over the panel, while the cream signup wizards drop it into normal
 * flow above the heading. The colours are self-contained rather than themed so
 * it reads the same on the teal glass and on the `#f2ecdf` wizard background.
 */
function BackToHome({ className = '' }) {
  const { t } = useI18n()
  return (
    <Link
      to="/"
      aria-label={t('cmn.backToHome')}
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-3.5 py-2 text-[13px] font-semibold text-slate-600 shadow-sm backdrop-blur transition-colors hover:border-teal-300 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {t('cmn.backToHome')}
    </Link>
  )
}

export default BackToHome
