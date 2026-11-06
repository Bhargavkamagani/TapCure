import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Logo from './Logo.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Slim top header for the full-page (non-homepage) screens:
 * brand logo on the left, a "Back to Home" link (or custom `right`) on the right.
 */
function PageHeader({ right }) {
  const { t } = useI18n()
  return (
    <header className="flex items-center justify-between border-b border-slate-100 bg-white/80 px-6 py-4 backdrop-blur md:px-10">
      <Link to="/" className="transition-opacity hover:opacity-90">
        <Logo />
      </Link>
      {right ?? (
        <Link
          to="/"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-brand-blue hover:text-brand-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('cmn.backToHomeCap')}
        </Link>
      )}
    </header>
  )
}

export default PageHeader
