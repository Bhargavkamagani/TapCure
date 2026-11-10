import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

/**
 * "This is broken" vs "there's nothing here" — a distinction these consoles kept
 * losing. A failed fetch that falls back to an empty array renders exactly like
 * a quiet day, so a doctor reads "no appointments" when the truth is "we don't
 * know". Every list that can fail should say which one it is.
 */
export default function LoadError({ message, onRetry, what }) {
  const { t } = useI18n()
  if (!message) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="font-semibold">{message}</span>
      <span className="text-[13.5px] text-red-500">
        {t('cmn.loadErrorBody', { what: what ?? t('cmn.thisList') })}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto rounded-lg border border-red-200 bg-white px-3 py-1 text-[13.5px] font-semibold text-red-600 hover:bg-red-50"
        >
          {t('cmn.retry')}
        </button>
      )}
    </div>
  )
}
