import { Route } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

/**
 * How far the patient behind this token has to travel, for queue screens.
 *
 * The desk decides who to call next, who to chase and who to mark no-show. A
 * patient eight hours away is a different case from one who lives round the
 * corner, and the queue never showed the difference — the journey was recorded
 * at booking and only ever used for the patient's own leave-by reminder.
 *
 * Renders nothing when the booking captured no travel time, which is most
 * walk-ins — the chip must not imply "nearby" when the truth is "unknown".
 */
export default function TravelChip({ minutes, origin, className = '' }) {
  const { t } = useI18n()
  if (!minutes) return null
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  const label = hrs
    ? (mins ? t('cmn.travelHM', { h: hrs, m: mins }) : t('cmn.travelH', { h: hrs }))
    : t('cmn.travelMin', { n: mins })
  // An hour and a half is roughly where "on their way" becomes "planned a trip":
  // far enough that the desk should think twice before skipping them.
  const far = minutes >= 90
  return (
    <span
      title={origin ? t('cmn.travellingFrom', { origin }) : t('cmn.travelTime')}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        far ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
      } ${className}`}
    >
      <Route className="h-3 w-3 shrink-0" />
      {label}
      {origin ? <span className="max-w-[10rem] truncate font-medium opacity-80">· {origin}</span> : null}
    </span>
  )
}
