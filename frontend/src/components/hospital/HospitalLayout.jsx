import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import HospitalSidebar from './HospitalSidebar.jsx'
import HospitalTopbar from './HospitalTopbar.jsx'
import GlassBackdrop from '../common/GlassBackdrop.jsx'
import BookingQuotaPopup from './BookingQuotaPopup.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

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
 */
function HospitalLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const { user } = useAuth()
  return (
    <div className="glass-console relative flex h-screen w-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <GlassBackdrop />
      {/* Super admin can open this console too; the notices are the hospital admin's. */}
      {user?.role_name === 'HOSPITAL_ADMIN' && <BookingQuotaPopup />}
      <HospitalSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <HospitalTopbar onMenu={() => setNavOpen(true)} />
        <main className="tc-surface flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default HospitalLayout
