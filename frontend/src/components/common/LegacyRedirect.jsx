import { Navigate, useLocation } from 'react-router-dom'

/**
 * Sends an old address to its new one, keeping the rest of the link:
 * /clinic-dashboard/plan?tab=bills -> /hospital-dashboard/plan?tab=bills.
 *
 * The /clinic-* pages were renamed to /hospital-* (2026-10-25). Old bookmarks,
 * emails and links inside approved WhatsApp templates still use the old
 * addresses, so they must keep working.
 */
export default function LegacyRedirect({ from, to }) {
  const { pathname, search, hash } = useLocation()
  const rest = pathname.startsWith(from) ? pathname.slice(from.length) : ''
  return <Navigate to={`${to}${rest}${search}${hash}`} replace />
}
