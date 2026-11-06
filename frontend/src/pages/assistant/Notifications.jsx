import { useEffect, useState } from 'react'
import { AlertTriangle, Bell, CheckCheck, RefreshCw } from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { notificationsApi } from '../../api'
import { relativeTime } from '../../lib/format.js'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

const metaFor = (type = '') => {
  const t = type.toLowerCase()
  if (t.includes('delay')) return { icon: AlertTriangle, tone: 'bg-amber-100 text-amber-600' }
  return { icon: Bell, tone: 'bg-slate-100 text-slate-500' }
}

// Server-side per-user read receipt. Delivery is not read — a delivered SMS is
// still unread until the user opens it here.
const isUnread = (n) => !n.is_read

// The topbar bell refetches its count on route change, which never fires while
// you're already standing on this page. Tell it directly instead, so the badge
// can't sit there claiming unread alerts the user just cleared.
const NOTIFICATIONS_READ_EVENT = 'tapcure:notifications-read'
const announceRead = () => window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_EVENT))

const PAGE_SIZE = 100

function AssistantNotifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      setItems(await notificationsApi.history({ size: PAGE_SIZE }))
    } catch (e) {
      // Was swallowed: a failed load rendered "No notifications yet", so a
      // broken feed looked exactly like a quiet one and alerts went unseen.
      setItems([])
      setError(e.message || 'Could not load notifications.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // An alert nobody sees is the whole failure mode of this page — it must not
  // wait for someone to think of reloading.
  useAutoRefresh(() => load({ silent: true }))

  const unread = items.filter(isUnread).length
  // At the cap there are older notifications this page will never show.
  const truncated = items.length >= PAGE_SIZE

  const markAllRead = async () => {
    setActionError(null)
    try {
      await notificationsApi.markAllRead()
      setItems((rows) => rows.map((n) => ({ ...n, is_read: true })))
      announceRead()
    } catch (e) {
      setActionError(e.message || 'Could not mark these as read.')
    }
  }

  const openOne = async (n) => {
    if (n.is_read) return
    setActionError(null)
    try {
      await notificationsApi.markRead(n.notification_id)
      setItems((rows) => rows.map((r) => (r.notification_id === n.notification_id ? { ...r, is_read: true } : r)))
      announceRead()
    } catch (e) {
      setActionError(e.message || 'Could not mark that as read.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Notifications" subtitle={loading ? 'Loading alerts...' : `${unread} unread alert${unread === 1 ? '' : 's'}`}>
        {unread > 0 && <ToolButton icon={CheckCheck} onClick={markAllRead}>Mark read</ToolButton>}
        <ToolButton icon={RefreshCw} onClick={load}>Refresh</ToolButton>
      </PageHeading>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{error}</span>
          <span className="text-[12.5px] text-red-500">This is a load failure, not an empty inbox.</span>
          <button type="button" onClick={load}
            className="ml-auto rounded-lg border border-red-200 bg-white px-3 py-1 text-[12.5px] font-semibold text-red-600 hover:bg-red-50">
            Retry
          </button>
        </div>
      )}
      {actionError && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-medium text-amber-700">{actionError}</p>
      )}
      {truncated && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-500">
          Showing the latest {PAGE_SIZE} notifications — older ones aren’t listed.
        </p>
      )}

      <Card className="p-2">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Loading...</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-[13.5px] text-slate-400">
            {error ? 'Could not load notifications.' : 'No notifications yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((n) => {
              const meta = metaFor(n.type)
              const Icon = meta.icon
              const unreadRow = isUnread(n)
              return (
                <li
                  key={n.notification_id}
                  onClick={() => openOne(n)}
                  className={`flex items-start gap-3 rounded-xl p-3 ${unreadRow ? 'cursor-pointer bg-amber-50/70' : ''}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-brand-navy">{n.title || 'Notification'}</p>
                    {n.message && <p className="text-[12.5px] text-slate-500">{n.message}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">{relativeTime(n.created_at)}</p>
                  </div>
                  {unreadRow && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default AssistantNotifications
