/**
 * Why the app signed you out, carried across the redirect to the login page.
 *
 * Only one reason so far: the account was used to sign in somewhere else, and
 * one account may hold one session (server side: users.session_id). Without
 * this the person lands on a login screen with no explanation and reads it as
 * the app losing their session at random.
 *
 * sessionStorage, not localStorage: it belongs to this tab's journey and must
 * not still be sitting there tomorrow.
 */
const KEY = 'tapcure.signedOutReason'

/** The server's wording for a session replaced by a newer login (app/deps.py). */
export const isSessionReplaced = (detail) =>
  typeof detail === 'string' && detail.toLowerCase().includes('another device')

/** The server's wording when the hospital admin changed this login's email or password. */
export const isCredentialsChanged = (detail) =>
  typeof detail === 'string' && detail.toLowerCase().includes('login details were changed')

/** Staff and doctor consoles: a dead session there must end on the login page,
 *  not leave a dashboard full of failed requests. Public pages are excluded so a
 *  stale token never bounces a visitor off the landing page. */
export function inSignedInArea() {
  const path = window.location.pathname
  return ['/hospital-dashboard', '/assistant-dashboard', '/pharmacy', '/doctor-dashboard'].some((p) => path.startsWith(p))
}

export function setSignedOutReason(reason) {
  try { sessionStorage.setItem(KEY, reason) } catch { /* private mode */ }
}

/** Read it once — reading clears it, so a reload doesn't show the notice again. */
export function takeSignedOutReason() {
  try {
    const value = sessionStorage.getItem(KEY)
    if (value) sessionStorage.removeItem(KEY)
    return value
  } catch {
    return null
  }
}

/** The sign-in page for whichever console the person was thrown out of. */
export function loginPathForCurrentArea() {
  const path = window.location.pathname
  if (path.startsWith('/hospital-dashboard') || path.startsWith('/clinic-dashboard') || path.startsWith('/assistant-dashboard') || path.startsWith('/pharmacy')) {
    return '/hospital-login'
  }
  if (path.startsWith('/doctor-dashboard') || path.startsWith('/doctor-onboarding')) return '/doctor-login'
  return '/patient-login'
}
