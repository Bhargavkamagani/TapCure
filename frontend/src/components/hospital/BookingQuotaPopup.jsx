import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../../api'
import { useDialog } from '../common/DialogProvider.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

/**
 * The backend files a `booking_quota` notice for the hospital admin at 80% of
 * the month's free online bookings and again when they're used up. Raised as
 * a pop-up on any hospital page (same pattern as the doctor's
 * ScheduleChangePopup) and marked read once seen.
 */
function BookingQuotaPopup() {
  const dialog = useDialog()
  const navigate = useNavigate()
  const showing = useRef(false)

  const check = useCallback(async () => {
    if (showing.current) return
    showing.current = true
    try {
      const rows = await notificationsApi.history({ channel: 'in_app', type: 'booking_quota', size: 20 })
      const unread = (rows || []).filter((n) => !n.is_read)
      if (!unread.length) return
      // Only the newest matters: "used up" supersedes "almost used up".
      const alert = unread[0]
      await Promise.all(unread.map((n) => notificationsApi.markRead(n.notification_id)))
      const go = await dialog.confirm({
        title: alert.title || 'Online bookings',
        message: alert.message,
        tone: 'info',
        confirmLabel: 'See my options',
        cancelLabel: 'Later',
      })
      if (go) navigate('/hospital-dashboard/plan')
    } catch {
      // Leave it unread: shown again on the next check.
    } finally {
      showing.current = false
    }
  }, [dialog, navigate])

  useEffect(() => { check() }, [check])
  useAutoRefresh(check, { intervalMs: 60000 })
  return null
}

export default BookingQuotaPopup
