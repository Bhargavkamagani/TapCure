/** Shared UI primitives for the hospital dashboard pages. */
import { useState } from 'react'
import { fileUrl } from '../../api'
import { useI18n } from '../../i18n/index.jsx'

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-card ${className}`}>
      {children}
    </div>
  )
}

const BADGE = {
  Waiting: 'bg-amber-100 text-amber-700',
  Completed: 'bg-green-100 text-green-700',
  'In Consultation': 'bg-blue-100 text-blue-700',
  Confirmed: 'bg-green-100 text-green-700',
  Pending: 'bg-amber-100 text-amber-700',
  Cancelled: 'bg-red-100 text-red-600',
  Available: 'bg-green-100 text-green-700',
  Busy: 'bg-amber-100 text-amber-700',
  'On Leave': 'bg-amber-100 text-amber-700',
  'In Queue': 'bg-amber-100 text-amber-700',
  'No Show': 'bg-red-100 text-red-600',
  'On Hold': 'bg-amber-100 text-amber-700',
  Active: 'bg-green-100 text-green-700',
  Inactive: 'bg-red-100 text-red-600',
  Refunded: 'bg-green-100 text-green-700',
  'Paid Online': 'bg-green-100 text-green-700',
  'Paid at Hospital': 'bg-blue-100 text-blue-700',
  'Hospital Closed': 'bg-red-100 text-red-600',
  Unavailable: 'bg-slate-200 text-slate-500',
  Regular: 'bg-blue-100 text-blue-700',
  New: 'bg-purple-100 text-purple-600',
}

export function StatusBadge({ status }) {
  // The colour is still picked by the ENGLISH status (BADGE above); only the
  // text shown is translated. Unknown statuses fall through unchanged.
  const { t, lang } = useI18n()
  const key = `status.${String(status ?? '').toLowerCase().trim().replace(/[\s_]+/g, '_')}`
  const shown = t(key)
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BADGE[status] || 'bg-slate-100 text-slate-600'}`}>
      {lang === 'en' || shown === key ? status : shown}
    </span>
  )
}

const AVATAR_TONES = ['bg-brand-blue', 'bg-brand-green', 'bg-purple-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500']

/**
 * Circular avatar. Shows the uploaded photo when `src` is given, otherwise
 * falls back to tinted initials.
 *
 * `src` is the raw stored path — fileUrl() resolves it, so callers can pass
 * doctor.profile_photo_url / patient.photo_url straight through. A broken or
 * deleted file falls back to initials rather than leaving a broken-image icon.
 */
export function Avatar({ name, className = '', tone, src }) {
  const [failed, setFailed] = useState(false)
  const safeName = name || '?'
  const initials = safeName
    .replace(/^(Dr\.|Mr\.|Mrs\.|Miss\.|Ms\.)\s*/i, '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (src && !failed) {
    return (
      <img
        src={fileUrl(src)}
        alt={safeName}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  const color = tone ?? AVATAR_TONES[(safeName.charCodeAt(0) + safeName.length) % AVATAR_TONES.length]
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${color} ${className}`}>
      {initials}
    </span>
  )
}

/** Page heading row: title + subtitle on the left, optional actions on the right. */
export function PageHeading({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  )
}

/** Small tinted KPI/stat card. */
const STAT_TONES = {
  blue: { num: 'text-brand-blue', icon: 'bg-blue-100 text-brand-blue', card: 'border-blue-100 bg-blue-50/50' },
  green: { num: 'text-green-600', icon: 'bg-green-100 text-green-600', card: 'border-green-100 bg-green-50/50' },
  purple: { num: 'text-purple-600', icon: 'bg-purple-100 text-purple-600', card: 'border-purple-100 bg-purple-50/50' },
  teal: { num: 'text-teal-600', icon: 'bg-teal-100 text-teal-600', card: 'border-teal-100 bg-teal-50/50' },
  orange: { num: 'text-orange-500', icon: 'bg-orange-100 text-orange-500', card: 'border-orange-100 bg-orange-50/50' },
  red: { num: 'text-red-500', icon: 'bg-red-100 text-red-500', card: 'border-red-100 bg-red-50/50' },
}

export function StatCard({ value, label, icon: Icon, tone = 'blue', sub }) {
  const t = STAT_TONES[tone]
  return (
    <div className={`rounded-2xl border p-3.5 ${t.card}`}>
      <div className="flex items-start gap-2.5">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.icon}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <div className={`text-[23px] font-extrabold leading-none ${t.num}`}>{value}</div>
          <div className="mt-1 text-[12px] font-medium text-slate-500">{label}</div>
        </div>
      </div>
      {sub && <div className="mt-2 text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

/** Outlined toolbar button (date/refresh/etc.). */
export function ToolButton({ icon: Icon, children, tone = 'default', ...props }) {
  const styles =
    tone === 'danger'
      ? 'border-red-200 text-red-500 hover:bg-red-50'
      : tone === 'primary'
        ? 'border-brand-blue bg-brand-blue text-white hover:bg-brand-blueDark'
        : 'border-slate-200 bg-white text-brand-navy hover:border-slate-300'
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${styles}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  )
}
