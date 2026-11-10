import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import HospitalSidebar from './HospitalSidebar.jsx'
import HospitalTopbar from './HospitalTopbar.jsx'
import GlassBackdrop from '../common/GlassBackdrop.jsx'
import BookingQuotaPopup from './BookingQuotaPopup.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { subscriptionsApi } from '../../api'
import { useHospitalSetup, SetupNudge, skippedForNow } from './HospitalSetupStatus.jsx'

const PLAN_PATH = '/hospital-dashboard/plan'
// Plan.jsx fires this after "Start free trial" / choosing a plan.
export const PLAN_CHANGED_EVENT = 'tc:plan-changed'

/**
 * Shared shell for all hospital pages: fixed sidebar + topbar, page content
 * swaps via <Outlet/>.
 *
 * Fully fluid (no fixed canvas / scaling) so the console fills the entire
 * screen edge-to-edge on any display — same approach as the doctor console.
 * The content area stretches to fill the space; only it scrolls if a page is
 * taller than the viewport.
 *
 * On desktop (lg+) the sidebar is a static rail; on smaller screens it slides
 * in as an overlay drawer toggled from the topbar menu button.
 *
 * New hospital (2026-11-09): until the admin picks "Start free trial" or a paid
 * plan (plan state "choose"), every page goes to the Plan page and the sidebar
 * is hidden, so they always know which plan they are on.
 */
function HospitalLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isAdmin = user?.role_name === 'HOSPITAL_ADMIN'
  const owner = isAdmin
  // null = still checking; true/false once known. Super admin is never gated.
  const [mustChoose, setMustChoose] = useState(isAdmin ? null : false)

  const checkPlan = useCallback(() => {
    if (!isAdmin) return
    subscriptionsApi.bookings()
      .then((d) => setMustChoose(d?.state === 'choose'))
      .catch(() => setMustChoose(false)) // never lock the console on a network error
  }, [isAdmin])

  useEffect(() => { checkPlan() }, [checkPlan])
  useEffect(() => {
    window.addEventListener(PLAN_CHANGED_EVENT, checkPlan)
    return () => window.removeEventListener(PLAN_CHANGED_EVENT, checkPlan)
  }, [checkPlan])

  const setup = useHospitalSetup(owner)
  // Re-count when the owner moves between pages, so the bar notices a logo or
  // hours added on the Profile page without a reload.
  const { incomplete, refresh } = setup
  useEffect(() => { if (incomplete) refresh() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wait for BOTH checks so the dashboard never flashes before a redirect.
  // (setup.loading only matters for the owner; for anyone else the hook is off.)
  if (mustChoose === null || (owner && setup.loading)) {
    return <div className="flex h-screen w-screen items-center justify-center text-sm text-slate-400">Loading…</div>
  }
  // Order for a newly approved hospital (2026-11-10): profile first, then plan.
  // 1) Profile not complete (under 3 of 3) -> "Complete your profile", like
  //    WoVerse. "Skip for now" lets them in for this login only; the next
  //    login opens the setup page again until all 3 steps are done.
  if (owner && setup.incomplete && !skippedForNow()) return <Navigate to="/hospital-setup" replace />
  // 2) No plan chosen yet -> only the Plan page.
  if (mustChoose && pathname !== PLAN_PATH) return <Navigate to={PLAN_PATH} replace />

  return (
    <div className="glass-console relative flex h-screen w-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <GlassBackdrop />
      {/* Super admin can open this console too; the notices are the hospital admin's. */}
      {isAdmin && !mustChoose && <BookingQuotaPopup />}
      {!mustChoose && <HospitalSidebar open={navOpen} onClose={() => setNavOpen(false)} />}
      {navOpen && !mustChoose && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <HospitalTopbar onMenu={() => setNavOpen(true)} />
        <main className="tc-surface flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
          {owner && !mustChoose && setup.incomplete && <SetupNudge done={setup.done} />}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default HospitalLayout
