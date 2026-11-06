import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import DoctorSidebar from './DoctorSidebar.jsx'
import DoctorTopbar from './DoctorTopbar.jsx'
import GlassBackdrop from '../common/GlassBackdrop.jsx'
import { DoctorProvider } from '../../context/DoctorContext.jsx'
import DoctorSetupGate from './DoctorSetupGate.jsx'
import ScheduleChangePopup from './ScheduleChangePopup.jsx'

/**
 * Shared shell for all doctor pages: fixed sidebar + topbar; page content
 * swaps via <Outlet/>.
 *
 * <DoctorProvider/> loads the logged-in doctor + tenant lookups once so every
 * nested page can read real data without refetching.
 *
 * On desktop (lg+) the sidebar is a static rail; on smaller screens it slides
 * in as an overlay drawer toggled from the topbar menu button.
 */
function DoctorLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('doctor-theme') === 'dark')

  useEffect(() => {
    localStorage.setItem('doctor-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <DoctorProvider>
      <DoctorSetupGate>
      <div className={`theme-reception ${dark ? 'theme-dark' : 'glass-console glass-landing'} relative flex h-screen w-screen flex-col overflow-hidden ${
        dark ? 'bg-slate-900' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'
      }`}>
        {!dark && <GlassBackdrop />}
        <DoctorTopbar onMenu={() => setNavOpen(true)} dark={dark} onToggleTheme={() => setDark((d) => !d)} />
        <div className="relative flex min-h-0 flex-1">
          <DoctorSidebar open={navOpen} onClose={() => setNavOpen(false)} />
          {navOpen && (
            <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />
          )}
          <main className="tc-surface flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4">
            <Outlet />
          </main>
        </div>
        {/* "Hospital admin changed your availability" — raised on any page. */}
        <ScheduleChangePopup />
      </div>
      </DoctorSetupGate>
    </DoctorProvider>
  )
}

export default DoctorLayout
