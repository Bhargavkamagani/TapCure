import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, X, Clock, BellRing } from 'lucide-react'
import { notificationsApi } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Real-time queue alerts popup.
 *
 * The app has no websockets, so this polls GET /notification-history and pops a
 * toast when a new row appears. The backend already records these rows as a
 * side-effect of the SMS/WhatsApp it sends, so nothing extra is written for the
 * in-app channel — we simply surface what is already there:
 *   delay        POST /doctor-delay        "…revised ETA: 4:30 PM"
 *   travel_alert token_engine leave-alert   "Time to Leave"
 *   recall       POST /tokens/{id}/recall   "please proceed to the doctor"
 *
 * Reception watches `push`+delay; patients watch `sms` across the queue types.
 * The endpoint already scopes rows to the logged-in patient / staff hospital.
 *
 * Dedupe is purely by notification_id, persisted in localStorage per channel —
 * we deliberately do NOT gate on created_at: the backend stores naive-UTC times
 * in a timestamptz column, so timestamps read hours in the past and any recency
 * window would wrongly suppress every alert.
 *
 * On the very first load in a browser we surface the single most-recent alert
 * (so an already-running delay is visible), then only ids newer than that pop.
 *
 * Props:
 *   channel — 'push' for reception, 'sms' for patients.
 *   types   — notification types to surface.
 *   desktop — also raise an OS notification (needs granted permission; this is
 *             what the patient dashboard's "Notify me" button asks for). Fires
 *             even when the tab is in the background, which is the whole point.
 *   pollMs  — poll interval (default 12s).
 */

// Per-type presentation. `delay` keeps the original amber warning treatment.
const TONES = {
  delay: {
    icon: AlertTriangle, fallbackTitle: 'cmn.delayTitle',
    box: 'border-amber-400 bg-amber-50 shadow-[0_20px_50px_-10px_rgba(180,120,0,0.55)]',
    chip: 'bg-amber-100 text-amber-600', head: 'text-amber-900', body: 'text-amber-800',
    close: 'text-amber-500 hover:bg-amber-100 hover:text-amber-700',
  },
  travel_alert: {
    icon: Clock, fallbackTitle: 'cmn.leaveTitle',
    box: 'border-teal-400 bg-teal-50 shadow-[0_20px_50px_-10px_rgba(13,148,136,0.5)]',
    chip: 'bg-teal-100 text-teal-600', head: 'text-teal-900', body: 'text-teal-800',
    close: 'text-teal-500 hover:bg-teal-100 hover:text-teal-700',
  },
  recall: {
    icon: BellRing, fallbackTitle: 'cmn.recallTitle',
    box: 'border-emerald-400 bg-emerald-50 shadow-[0_20px_50px_-10px_rgba(16,185,129,0.5)]',
    chip: 'bg-emerald-100 text-emerald-600', head: 'text-emerald-900', body: 'text-emerald-800',
    close: 'text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700',
  },
}
const DEFAULT_TONE = TONES.delay

/** Local opt-out for OS alerts. Browser permission can't be revoked from JS, so
 *  turning reminders OFF has to be our own preference — without it the dashboard
 *  toggle could only ever be switched on. */
export const QUEUE_ALERTS_KEY = 'tapcure.queue-alerts'
export function queueAlertsMuted() {
  try {
    return localStorage.getItem(QUEUE_ALERTS_KEY) === 'off'
  } catch {
    return false
  }
}

/** Raise an OS notification when the user has granted permission and not muted.
 *  Exported so the medicine dose popup raises its alert the same way — same
 *  permission check, same mute switch, rather than a second copy that could
 *  drift out of step with the "Notify me" toggle. */
export function osNotify(title, body) {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    if (queueAlertsMuted()) return
    // Tag by title so repeated alerts replace rather than stack up.
    new Notification(title, { body, tag: `tapcure:${title}`, icon: '/tapcure-icon.png' })
  } catch {
    /* some browsers throw on construction outside a user gesture — ignore */
  }
}

function DelayToaster({ channel = 'sms', types = ['delay'], desktop = false, pollMs = 12000 }) {
  const { user } = useAuth()
  const [toasts, setToasts] = useState([])
  const { t: tr } = useI18n()
  // Latest translator for the poll loop, without restarting the interval on a language switch.
  const trRef = useRef(tr)
  trRef.current = tr
  // Scoped to the user, not just the channel. These consoles run on a shared
  // front-desk machine: with one key per channel, the last person's "seen"
  // high-water mark suppressed the next person's alerts entirely, because their
  // notification ids were lower than the marker left behind.
  const storeKey = `delayToastSeen:${channel}:${user?.user_id ?? 'anon'}`
  const typeKey = types.join(',')

  const dismiss = (id) => setToasts((list) => list.filter((t) => t.id !== id))

  useEffect(() => {
    let alive = true
    const wanted = typeKey.split(',')

    async function poll() {
      try {
        // No `type` filter server-side — one request covers every type we care
        // about, and we narrow client-side.
        const all = await notificationsApi.history({ channel, size: 20 })
        if (!alive || !Array.isArray(all)) return
        const rows = all.filter((r) => wanted.includes(r.type))
        if (rows.length === 0) return

        // Ids are time-ordered UUIDs (v7): compared as strings they sort by time.
        const idOf = (r) => String(r.notification_id)
        const maxId = rows.map(idOf).sort().pop()
        const raw = localStorage.getItem(storeKey)
        // First load in this browser — or an integer id saved before ids became
        // UUIDs — shows exactly the most-recent alert once. Afterwards: only newer.
        const seen = raw && raw.includes('-') ? raw : null
        const isFirstLoad = seen === null

        const fresh = rows
          .filter((r) => (seen === null ? idOf(r) === maxId : idOf(r) > seen))
          .sort((a, b) => idOf(a).localeCompare(idOf(b)))

        if (seen === null || maxId > seen) localStorage.setItem(storeKey, maxId)

        if (fresh.length) {
          setToasts((list) => [
            ...list,
            ...fresh.map((r) => ({
              id: r.notification_id,
              type: r.type,
              title: r.title || null,
              message: r.message,
            })),
          ].slice(-4)) // keep at most 4 stacked

          // Don't fire an OS notification for the backfilled row on first load —
          // it may be hours old and would look like a bug.
          if (desktop && !isFirstLoad) {
            fresh.forEach((r) =>
              osNotify(r.title || trRef.current((TONES[r.type] || DEFAULT_TONE).fallbackTitle), r.message)
            )
          }
        }
      } catch {
        /* ignore transient poll errors */
      }
    }

    poll()
    const iv = setInterval(poll, pollMs)
    return () => { alive = false; clearInterval(iv) }
  }, [channel, typeKey, desktop, pollMs, storeKey])

  // Auto-dismiss each toast ~10s after it appears.
  useEffect(() => {
    if (!toasts.length) return
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 10000))
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  if (!toasts.length) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-3 px-4">
      {toasts.map((t) => {
        const tone = TONES[t.type] || DEFAULT_TONE
        const Icon = tone.icon
        return (
          <div
            key={t.id}
            role="alert"
            className={`delay-toast pointer-events-auto flex w-[min(94vw,40rem)] items-start gap-4 rounded-2xl border-2 p-5 ${tone.box}`}
          >
            <span className={`mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full ${tone.chip}`}>
              <Icon className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[17px] font-extrabold ${tone.head}`}>{t.title || tr(tone.fallbackTitle)}</p>
              <p className={`mt-1 text-[14.5px] leading-snug ${tone.body}`}>{t.message}</p>
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label={tr('land.guide.dismiss')}
              className={`shrink-0 rounded-lg p-1.5 transition-colors ${tone.close}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default DelayToaster
