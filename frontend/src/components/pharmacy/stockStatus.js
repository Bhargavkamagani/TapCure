/** Shared display helpers for the hospital pharmacy stock (pharmacy console + doctor's Rx box). */

export const STOCK_STATUS = {
  in_stock: { label: 'In stock', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  low: { label: 'Low', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
  out: { label: 'Out of stock', dot: 'bg-red-500', badge: 'bg-red-50 text-red-600' },
  expired: { label: 'Expired', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
}

export const isAvailable = (status) => status === 'in_stock' || status === 'low'

// Server times are UTC. Some arrive without a zone marker ("2026-09-15T10:00:00"),
// which the browser would read as local time — 5½ hours off in India.
export function serverDate(iso) {
  if (!iso) return null
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function timeAgo(iso) {
  const d = serverDate(iso)
  if (!d) return ''
  const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

/** A list older than this is shown with a warning — stock moves every day. */
export function isStale(iso, days = 3) {
  const d = serverDate(iso)
  return !!d && Date.now() - d.getTime() > days * 24 * 60 * 60 * 1000
}

export const fmtExpiry = (isoDate) =>
  isoDate ? new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'
