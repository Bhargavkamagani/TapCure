import { useCallback, useEffect, useState } from 'react'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { UserPlus, UserCheck, BellRing, Users, CheckCheck, Bell } from 'lucide-react'
import LoadError from '../../components/common/LoadError.jsx'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { notificationsApi } from '../../api'
import { relativeTime } from '../../lib/format.js'

function metaFor(type = '') {
  const t = type.toLowerCase()
  if (t.includes('walk')) return { icon: Users, tone: 'bg-teal-100 text-teal-600' }
  if (t.includes('delay')) return { icon: BellRing, tone: 'bg-purple-100 text-purple-600' }
  if (t.includes('arriv') || t.includes('check')) return { icon: UserCheck, tone: 'bg-green-100 text-green-600' }
  if (t.includes('appoint') || t.includes('book')) return { icon: UserPlus, tone: 'bg-blue-100 text-brand-blue' }
  return { icon: Bell, tone: 'bg-slate-100 text-slate-500' }
}

// Server-side per-user read receipt. Delivery is not read — a delivered SMS is
// still unread until the user opens it here.
const isUnread = (n) => !n.is_read

function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(({ silent = false } = {}) => {
    notificationsApi
      .history({ size: 100 })
      .then((list) => setItems(list || []))
      .catch((e) => { if (!silent) setItems([]); setLoadError(e.message || "Could not load.") })
      .finally(() => { if (!silent) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  // A doctor's alerts (cancellations, delays, new bookings) are worthless if
  // they only appear on a manual reload.
  useAutoRefresh(() => load({ silent: true }))

  const unread = items.filter(isUnread).length

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead()
      setItems((rows) => rows.map((n) => ({ ...n, is_read: true })))
    } catch { /* count refreshes on next load */ }
  }

  const openOne = async (n) => {
    if (n.is_read) return
    try {
      await notificationsApi.markRead(n.notification_id)
      setItems((rows) => rows.map((r) => (r.notification_id === n.notification_id ? { ...r, is_read: true } : r)))
    } catch { /* stays unread; retried next time */ }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Notifications" subtitle={loading ? 'Loading…' : `${unread} unread · stay on top of hospital activity.`}>
        {unread > 0 && <ToolButton icon={CheckCheck} onClick={markAllRead}>Mark all read</ToolButton>}
      </PageHeading>
      <LoadError message={loadError} what="this inbox" />

      <Card>
        {loading ? (
          <p className="p-4 text-sm text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-[13.5px] text-slate-400">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((n) => {
              const m = metaFor(n.type)
              const Icon = m.icon
              const unreadRow = isUnread(n)
              return (
                <li
                  key={n.notification_id}
                  onClick={() => openOne(n)}
                  className={`flex items-start gap-3 py-3.5 ${unreadRow ? 'cursor-pointer' : 'opacity-70'}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${m.tone}`}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-brand-navy">{n.title}</p>
                    <p className="text-[12.5px] text-slate-500">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadRow && <span className="h-2 w-2 rounded-full bg-brand-blue" />}
                    <span className="whitespace-nowrap text-[11.5px] text-slate-400">{relativeTime(n.created_at)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default Notifications
