import { useEffect, useRef } from 'react'

/** How often a live screen re-reads the server. Fast enough that the numbers on
 *  screen match the room while a patient is standing at the desk. */
export const REFRESH_MS = 15000

/**
 * Keep a screen current without the user pressing Refresh.
 *
 * Three rules, learned the hard way and now in one place instead of copied into
 * every console page:
 *
 *  1. Never poll a hidden tab. A desk leaves these screens open on a second
 *     monitor all day; polling one nobody is looking at is pure API traffic.
 *  2. Always refresh the moment the tab is looked at again. This is the half
 *     that was missing everywhere: skipping hidden tabs WITHOUT a wake meant
 *     coming back to the tab showed data up to a full interval old — the desk
 *     would call the next token off a list that had already moved.
 *  3. Never refresh mid-action. Pass `paused` while a request is in flight or a
 *     modal is open, so rows can't reorder under the hand of someone who is
 *     about to click a specific row.
 *
 * `refresh` should be the SILENT loader — it must swap data underneath the user
 * without throwing the panel back to a loading spinner.
 *
 * The callback is held in a ref, so passing an inline arrow is fine: it won't
 * tear down and restart the interval on every render.
 */
export default function useAutoRefresh(refresh, { intervalMs = REFRESH_MS, paused = false, enabled = true } = {}) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    if (!enabled) return undefined
    const tick = () => {
      if (pausedRef.current || document.hidden) return
      refreshRef.current?.()
    }
    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [enabled, intervalMs])
}
