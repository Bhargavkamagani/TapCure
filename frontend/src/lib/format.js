/**
 * Shared formatting helpers for turning raw API values (ISO dates, 24h times,
 * status codes) into the display strings the patient UI expects.
 */

/** "2025-05-24" -> { day: "24", month: "May 2025" } for the date chip. */
export function dateChip(isoDate) {
  if (!isoDate) return { day: '--', month: '' }
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return { day: '--', month: '' }
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
  }
}

/** "14:30:00" (or ISO datetime) -> "2:30 PM". */
export function prettyTime(value) {
  if (!value) return ''
  // Bare "HH:MM[:SS]" -> anchor to an arbitrary date so Date can parse it.
  const d = /^\d{1,2}:\d{2}/.test(value) ? new Date(`1970-01-01T${value}`) : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Backend datetimes are naive UTC. Read them as UTC and render hospital-local
 * (Asia/Kolkata) clock time — used by the leave-by / token-ETA displays.
 */
export function clockIST(iso) {
  if (!iso) return '—'
  const d = new Date(/[Z]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

/**
 * Same as `clockIST`, but prefixes the weekday when the moment isn't today —
 * "Thu, 6:19 AM". A cross-day journey (leave Thursday for Friday's hospital)
 * renders as a bare "6:19 AM" otherwise, which reads as this morning.
 */
export function clockISTWithDay(iso) {
  if (!iso) return '—'
  const d = new Date(/[Z]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return '—'
  const day = (x) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const time = clockIST(iso)
  if (day(d) === day(new Date())) return time
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}, ${time}`
}

/**
 * Minutes as a human duration: 45 -> "45 min", 492 -> "8 hr 12 min".
 *
 * A long journey printed in raw minutes ("Travel time 492 min") is a number the
 * patient has to divide by 60 themselves, and it makes the leave-by time that
 * follows from it look arbitrary. Takes `t` so the unit words stay translated.
 */
export function humanMins(t, n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const total = Math.round(Number(n))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return t('pdash.min', { n: m })
  if (!m) return t('pcommon.hr', { h })
  return t('pcommon.hrMin', { h, m })
}

/** "2025-05-24" -> "24 May 2025". */
export function prettyDate(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Backend status code -> Title Case label used by <StatusBadge/>. */
export function statusLabel(status = '') {
  const map = {
    scheduled: 'Scheduled',
    booked: 'Confirmed',
    confirmed: 'Confirmed',
    pending: 'Pending',
    checked_in: 'Checked In',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  }
  return map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** ISO datetime -> "10 mins ago" / "2 days ago". */
export function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return prettyDate(iso)
}

/** Patient record -> "34 / M" (age / sex), tolerant of missing fields. */
export function ageSex(patient) {
  if (!patient) return '—'
  const sex = patient.gender ? patient.gender[0].toUpperCase() : ''
  const age = patient.age != null ? patient.age : ''
  return [age, sex].filter((x) => x !== '').join(' / ') || '—'
}

/** Today's date as a "YYYY-MM-DD" string (local). */
export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
