import { useCallback, useEffect, useState } from 'react'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { Ticket, AlertTriangle, Bell, CalendarCheck, CreditCard, FlaskConical, CheckCheck } from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { notificationsApi } from '../../api'
import { relativeTime } from '../../lib/format.js'
import { useI18n } from '../../i18n/index.jsx'

/** Pick an icon + tint from the notification's `type` string (best-effort match). */
function metaFor(type = '') {
  const t = type.toLowerCase()
  if (t.includes('token')) return { icon: Ticket, tone: 'bg-blue-100 text-brand-blue' }
  if (t.includes('delay')) return { icon: AlertTriangle, tone: 'bg-red-100 text-red-500' }
  if (t.includes('remind')) return { icon: Bell, tone: 'bg-green-100 text-green-600' }
  if (t.includes('appoint') || t.includes('book')) return { icon: CalendarCheck, tone: 'bg-purple-100 text-purple-600' }
  if (t.includes('pay') || t.includes('invoice')) return { icon: CreditCard, tone: 'bg-teal-100 text-teal-600' }
  if (t.includes('report') || t.includes('lab')) return { icon: FlaskConical, tone: 'bg-orange-100 text-orange-500' }
  return { icon: Bell, tone: 'bg-slate-100 text-slate-500' }
}

// Read state comes from the server per user. Delivery is NOT read: a delivered
// SMS is still unread until the user actually opens it here.
const isUnread = (n) => !n.is_read

/** All notifications feed, backed by GET /notification-history. */
function Notifications() {
  const { t } = useI18n()
  const { patient } = usePatientCtx()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(({ silent = false } = {}) => {
    if (!patient) return
    notificationsApi
      .history({ patient_id: patient.patient_id, size: 100 })
      .then((list) => setItems(list || []))
      .catch(() => { if (!silent) setItems([]) })
      .finally(() => { if (!silent) setLoading(false) })
  }, [patient])

  useEffect(() => { load() }, [load])
  // Token called, doctor delayed, appointment confirmed — all of it is only
  // useful while the patient is still looking at the screen.
  useAutoRefresh(() => load({ silent: true }), { intervalMs: 30000, enabled: !!patient })

  const unread = items.filter(isUnread).length

  // Persist, then reflect locally — the bell polls the same server count, so
  // the red dot clears too instead of only this page looking read.
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
    <div className="flex flex-col gap-5">
      <PageHeading
        title={t('ppage.notificationsTitle')}
        subtitle={loading ? t('pcommon.loading') : unread === 1 ? t('ppage.unreadOne', { n: unread }) : t('ppage.unreadMany', { n: unread })}
      >
        {unread > 0 && (
          <ToolButton icon={CheckCheck} onClick={markAllRead}>{t('ppage.markAllRead')}</ToolButton>
        )}
      </PageHeading>

      <Card className="p-2">
        {loading ? (
          <p className="p-4 text-sm text-slate-400">{t('pcommon.loading')}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-[13.5px] text-slate-400">{t('ppage.noNotifications')}</p>
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
                  className={`flex items-start gap-3 rounded-xl p-3 ${unreadRow ? 'cursor-pointer bg-brand-blueLight/40' : ''}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-slate-700">{n.title}</p>
                    {n.message && <p className="text-[13.5px] text-slate-500">{n.message}</p>}
                    <p className="text-[13px] text-slate-400">{relativeTime(n.created_at)}</p>
                  </div>
                  {unreadRow && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-blue" />}
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
