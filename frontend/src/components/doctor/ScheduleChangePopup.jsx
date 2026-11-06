import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../../api'
import { useDialog } from '../common/DialogProvider.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

/**
 * When the hospital (admin / reception) changes this doctor's weekly sessions,
 * the backend files a `schedule_change` notification addressed to them. A
 * badge on the bell is easy to miss, and a doctor who doesn't know their hours
 * moved may simply not turn up — so it is raised as a pop-up on any page.
 *
 * Shown one at a time, oldest first, and marked read once acknowledged so it
 * appears once across refreshes and devices.
 */
function ScheduleChangePopup() {
  const dialog = useDialog()
  const navigate = useNavigate()
  const showing = useRef(false)

  const check = useCallback(async () => {
    if (showing.current) return
    showing.current = true
    try {
      for (;;) {
        const rows = await notificationsApi.history({ channel: 'in_app', type: 'schedule_change', size: 20 })
        const unread = (rows || []).filter((n) => !n.is_read)
        const alert = unread[unread.length - 1]   // newest-first list → oldest unread
        if (!alert) break
        const view = await dialog.confirm({
          title: alert.title || 'Your availability was changed',
          message: alert.message,
          tone: 'info',
          confirmLabel: 'View my availability',
          cancelLabel: 'OK',
        })
        await notificationsApi.markRead(alert.notification_id)
        if (view) {
          navigate('/doctor-dashboard/availability')
          break
        }
      }
    } catch {
      // Leave it unread: it is simply shown again on the next check.
    } finally {
      showing.current = false
    }
  }, [dialog, navigate])

  useEffect(() => { check() }, [check])
  useAutoRefresh(check, { intervalMs: 15000 })
  return null
}

export default ScheduleChangePopup
