import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, ShieldCheck } from 'lucide-react'
import AdminSidebar from './AdminSidebar.jsx'
import GlassBackdrop from '../common/GlassBackdrop.jsx'
import { hospitalsApi, doctorsApi, supportApi } from '../../api'

/**
 * Shared shell for the Super-Admin console: fixed sidebar + topbar, pages swap
 * via <Outlet/>. Same structure as the hospital / doctor consoles.
 *
 * The pending counts (hospital approvals, doctor verifications) are loaded once
 * here and shared through context, so the sidebar badges and the Overview page
 * agree without each fetching separately. Pages call `refreshCounts()` after
 * approving or rejecting so the badges drop immediately.
 */
const AdminCtx = createContext({ counts: { hospitals: 0, doctors: 0, support: 0 }, refreshCounts: () => {} })

export const useAdminCtx = () => useContext(AdminCtx)

function AdminLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const [counts, setCounts] = useState({ hospitals: 0, doctors: 0, support: 0 })

  const refreshCounts = useCallback(async () => {
    const [c, d, s] = await Promise.all([
      hospitalsApi.pending().catch(() => []),
      doctorsApi.pending().catch(() => []),
      supportApi.openCount().catch(() => ({ new: 0 })),
    ])
    setCounts({ hospitals: (c || []).length, doctors: (d || []).length, support: s?.new || 0 })
  }, [])

  useEffect(() => { refreshCounts() }, [refreshCounts])

  return (
    <AdminCtx.Provider value={{ counts, refreshCounts }}>
      <div className="glass-console relative flex h-screen w-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <GlassBackdrop />
        <AdminSidebar open={navOpen} onClose={() => setNavOpen(false)} counts={counts} />
        {navOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="console-topbar flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 lg:hidden"
                aria-label="Toggle menu"
                onClick={() => setNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blueLight text-brand-blue">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[15px] font-bold text-brand-navy">TapCure Platform</span>
                <span className="block text-[11.5px] text-slate-400">All hospitals · all doctors</span>
              </span>
            </div>

            {/* The badge says what this console is; the account name added
                nothing but the seeded "Platform Owner" string beside it. */}
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full bg-brand-blueLight px-2.5 py-1 text-[11px] font-bold text-brand-blue">
                SUPER ADMIN
              </span>
            </div>
          </header>

          <main className="tc-surface flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminCtx.Provider>
  )
}

export default AdminLayout
