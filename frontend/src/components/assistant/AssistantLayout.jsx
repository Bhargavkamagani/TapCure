import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import AssistantSidebar from './AssistantSidebar.jsx'
import AssistantTopbar from './AssistantTopbar.jsx'
import DelayToaster from '../common/DelayToaster.jsx'
import GlassBackdrop from '../common/GlassBackdrop.jsx'

/**
 * Shared shell for the Assistant console: sidebar + topbar + routed content.
 *
 * On desktop (lg+) the sidebar is a static rail; on smaller screens it slides
 * in as an overlay drawer toggled from the topbar menu button.
 */
function AssistantLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('assistant-theme') === 'dark')

  useEffect(() => {
    localStorage.setItem('assistant-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className={`theme-reception ${dark ? 'theme-dark' : 'glass-console'} relative flex h-screen w-screen overflow-hidden ${
      dark ? 'bg-teal-100/60' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'
    }`}>
      {!dark && <GlassBackdrop />}
      <AssistantSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <AssistantTopbar onMenu={() => setNavOpen(true)} dark={dark} onToggleTheme={() => setDark((d) => !d)} />
        <main className="tc-surface flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
      {/* Real-time "doctor running late" popup for the front desk */}
      <DelayToaster channel="push" />
    </div>
  )
}

export default AssistantLayout
