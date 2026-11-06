/**
 * Tiny fetch wrapper for the backend API.
 *
 *  - Prefixes every call with VITE_API_URL (default http://localhost:8000).
 *  - Attaches the JWT access token, which lives in memory only.
 *  - The refresh token lives in an HttpOnly cookie the server sets; page
 *    JavaScript can never read it, so an XSS bug cannot steal the long-lived
 *    credential. A page load restores the session by trading the cookie for
 *    a fresh access token (restoreSession).
 *  - On a 401, transparently refreshes once, then retries.
 *  - A 401 that says the account signed in elsewhere ends the session here.
 *  - Throws ApiError(status, message) on non-2xx so callers can show details.
 */
import {
  isSessionReplaced, isCredentialsChanged, inSignedInArea, setSignedOutReason, loginPathForCurrentArea,
} from '../lib/signedOut.js'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
// Where both tokens used to sit in plain JSON. Read once to move an existing
// session onto the cookie (so nobody is signed out by the upgrade), then erased.
const LEGACY_TOKEN_KEY = 'tapcure.tokens'
// Not a credential: only "this browser has a session worth restoring", so an
// anonymous visitor's page load doesn't fire a refresh that is bound to 401.
const SESSION_HINT_KEY = 'tapcure.session'
// Tells the server to put the refresh token in the HttpOnly cookie, and lets it
// read that cookie back. Being a custom header, it also can't be sent from
// another site without passing CORS — the CSRF guard for the cookie.
const COOKIE_HEADERS = { 'X-Auth-Transport': 'cookie' }

export class ApiError extends Error {
  /** `detail` keeps the server's raw error payload. Some errors carry structure
   *  the caller needs to act on (e.g. the travel-time warning returns the
   *  journey length and the arrival time so the UI can offer "book anyway" or
   *  the next reachable day) — `message` alone would throw that away. */
  constructor(status, message, detail) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

let accessToken = null

function setSessionHint(on) {
  try {
    if (on) localStorage.setItem(SESSION_HINT_KEY, '1')
    else localStorage.removeItem(SESSION_HINT_KEY)
  } catch { /* private mode */ }
}
function hasSessionHint() {
  try { return localStorage.getItem(SESSION_HINT_KEY) === '1' } catch { return false }
}
function readLegacyRefreshToken() {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_TOKEN_KEY))?.refresh_token || null
  } catch {
    return null
  }
}
function dropLegacyTokens() {
  try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch { /* private mode */ }
}

export function getTokens() {
  return accessToken ? { access_token: accessToken } : {}
}
/** Keep the access token (memory only). Any refresh token is ignored on
 *  purpose — the server already put it in the HttpOnly cookie. */
export function setTokens(t) {
  accessToken = t?.access_token || null
  setSessionHint(!!accessToken)
}
export function clearTokens() {
  accessToken = null
  setSessionHint(false)
  dropLegacyTokens()
}

/* One refresh at a time. The refresh token rotates on every use, so two
   requests refreshing at once would send the same cookie and the loser would
   be refused. Inside a tab a shared promise covers it; across tabs the Web
   Locks API queues them, so the second tab sends the cookie the first one
   just rotated. Where Web Locks is missing, one retry has the same effect. */
let refreshing = null

async function refreshOnce(legacyToken) {
  const r = await fetch(BASE + '/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: legacyToken ? { ...COOKIE_HEADERS, 'Content-Type': 'application/json' } : COOKIE_HEADERS,
    body: legacyToken ? JSON.stringify({ refresh_token: legacyToken }) : undefined,
  })
  if (!r.ok) return r.status
  setTokens(await r.json())
  return 200
}

/** Resolves to the final HTTP status of the refresh. */
async function doRefresh() {
  const legacy = readLegacyRefreshToken()
  if (legacy) {
    const status = await refreshOnce(legacy)   // a network error throws and keeps it for next time
    dropLegacyTokens()
    if (status === 200) return status
  }
  let status = await refreshOnce(null)
  if (status === 401 && !navigator.locks) {
    await new Promise((res) => setTimeout(res, 400))
    status = await refreshOnce(null)
  }
  return status
}

/** Trade the refresh cookie for a new access token. Resolves true on success.
 *  Only a refusal (401/403) ends the session; a server error or a dropped
 *  connection leaves it in place to try again. */
export function refreshSession() {
  if (!refreshing) {
    const run = () => doRefresh()
      .then((status) => {
        if (status === 401 || status === 403) clearTokens()
        return status === 200
      })
      .catch(() => false)
    refreshing = (navigator.locks ? navigator.locks.request('tapcure-refresh', run) : run())
      .finally(() => { refreshing = null })
  }
  return refreshing
}

/** Page load: get an access token back if this browser has a session. */
export async function restoreSession() {
  if (accessToken) return true
  let hasLegacy = false
  try { hasLegacy = !!localStorage.getItem(LEGACY_TOKEN_KEY) } catch { /* private mode */ }
  if (!hasSessionHint() && !hasLegacy) return false
  return refreshSession()
}

/** Tell the server to end the session and drop the cookie. Best effort: the
 *  local session is cleared whatever happens. */
export async function endSession() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)   // never hold Log out hostage to a slow network
  try {
    await fetch(BASE + '/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: accessToken ? { ...COOKIE_HEADERS, Authorization: `Bearer ${accessToken}` } : COOKIE_HEADERS,
      signal: ctrl.signal,
    })
  } catch { /* offline: still sign out here */ }
  clearTimeout(timer)
  clearTokens()
}

/** "abha_number" -> "ABHA number"; the last real field name in a 422 `loc`. */
function fieldLabel(loc) {
  const parts = (Array.isArray(loc) ? loc : []).filter(
    (p) => typeof p === 'string' && !['body', 'query', 'path', 'header'].includes(p),
  )
  const name = parts[parts.length - 1]
  if (!name) return ''
  return name
    .replace(/_/g, ' ')
    .replace(/\b(abha|abdm|hpr|uhid|otp|id)\b/gi, (m) => m.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase())
}

/**
 * Turn an error body into something a person can read.
 *
 * FastAPI answers a validation failure with a list of
 * `{type, loc, msg, input, ctx}` objects. Dumping that as JSON put
 * `[{"type":"value_error","loc":["body","abha_number"],…}]` in front of
 * patients, so unpack it into plain sentences instead.
 */
function humanizeDetail(detail, fallback) {
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    const lines = detail
      .map((e) => {
        const msg = String(e?.msg || '').replace(/^Value error,\s*/i, '').trim()
        if (!msg) return ''
        const label = fieldLabel(e?.loc)
        // Custom validators usually name the field already ("ABHA number must
        // be 14 digits"); only prefix when the message would be orphaned.
        const first = label.split(' ')[0].toLowerCase()
        return label && !msg.toLowerCase().includes(first) ? `${label}: ${msg}` : msg
      })
      .filter(Boolean)
    if (lines.length) return lines.join('\n')
  }
  if (detail && typeof detail === 'object') {
    const msg = detail.msg || detail.message || detail.detail
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

/* `cookie: true` is for the sign-in calls: the response sets the HttpOnly
   refresh cookie, which a cross-origin fetch only stores with credentials. */
async function raw(path, { method = 'GET', body, auth = true, isForm = false, cookie = false } = {}) {
  const headers = cookie ? { ...COOKIE_HEADERS } : {}
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  const { access_token } = getTokens()
  if (auth && access_token) headers.Authorization = `Bearer ${access_token}`
  return fetch(BASE + path, {
    method,
    headers,
    credentials: cookie ? 'include' : 'same-origin',
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })
}

async function request(path, opts = {}) {
  const sentToken = getTokens().access_token
  let res = await raw(path, opts)

  // Try a single silent refresh on 401. If another request already refreshed
  // while this one was in flight, just retry with the new token.
  let sessionEnded = false
  if (res.status === 401 && opts.auth !== false && (sentToken || hasSessionHint())) {
    const current = getTokens().access_token
    const ok = (current && current !== sentToken) || (await refreshSession())
    if (ok) res = await raw(path, opts)
    // refreshSession only drops the session hint when the server refused it.
    else sessionEnded = !hasSessionHint()
  }

  if (!res.ok) {
    const fallback = res.statusText || `Request failed (${res.status})`
    let detail = fallback
    try {
      const j = await res.json()
      detail = j.detail ?? detail
    } catch {
      /* non-json error body */
    }
    /* Signed out because the account was used elsewhere. Nothing this tab can
       retry, and leaving it in place would show a wall of failed requests on a
       screen the person can no longer use — so hand them straight to the login
       page with the reason. A full page load, because the React tree still
       holds the old user in context and only a reload clears it. */
    if (res.status === 401 && isSessionReplaced(detail)) {
      clearTokens()
      setSignedOutReason('other-device')
      window.location.replace(loginPathForCurrentArea())
    } else if (res.status === 401 && isCredentialsChanged(detail)) {
      // The hospital admin changed this login's email or password (a hand-over).
      clearTokens()
      setSignedOutReason('credentials-changed')
      window.location.replace(loginPathForCurrentArea())
    } else if (res.status === 401 && sessionEnded && inSignedInArea()) {
      // Refresh refused too: the session is over (deactivated, or expired).
      // Clearing the tokens used to leave the person on a dead dashboard.
      setSignedOutReason('ended')
      window.location.replace(loginPathForCurrentArea())
    }
    throw new ApiError(res.status, humanizeDetail(detail, fallback), detail)
  }

  if (res.status === 204) return null
  if (opts.blob) return res.blob()
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

export const api = {
  get: (p, o) => request(p, { ...o, method: 'GET' }),
  post: (p, b, o) => request(p, { ...o, method: 'POST', body: b }),
  put: (p, b, o) => request(p, { ...o, method: 'PUT', body: b }),
  patch: (p, b, o) => request(p, { ...o, method: 'PATCH', body: b }),
  del: (p, o) => request(p, { ...o, method: 'DELETE' }),
}
