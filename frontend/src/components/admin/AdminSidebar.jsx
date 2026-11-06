import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Building2, Stethoscope, ClipboardCheck, BadgeCheck, LifeBuoy, LogOut, ShieldCheck } from 'lucide-react'
import Logo from '../common/Logo.jsx'
import Tagline from '../common/Tagline.jsx'
import Wordmark from '../common/Wordmark.jsx'
import { ADMIN_NAV } from '../../data/adminPagesData.js'
import { useAuth } from '../../context/AuthContext.jsx'

const ICONS = { LayoutDashboard, Building2, Stethoscope, ClipboardCheck, BadgeCheck, LifeBuoy }

/** Which nav row the current route falls on — drives the glider position. */
function activeNavIndex(pathname) {
  const i = ADMIN_NAV.findIndex(({ to, end }) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`),
  )
  return i < 0 ? 0 : i
}

/** Left navigation rail for the Super-Admin console (routed). */
function AdminSidebar({ open = false, onClose, counts = {} }) {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const activeIndex = activeNavIndex(pathname)

  // Pending counts shown as badges, keyed by route.
  const badge = {
    '/admin/approvals': counts.hospitals || 0,
    '/admin/doctor-verifications': counts.doctors || 0,
    '/admin/support': counts.support || 0,
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col bg-teal-900 text-teal-100/85 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand — matches the hospital / doctor / front-desk consoles. The logo art
          is transparent, so it sits straight on the teal rail: the white chip it
          used to wear was a light-background holdover and read as a pasted-on box. */}
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <Logo className="h-11 shrink-0" />
        {/* Wordmark sits directly on the tagline. A "Super Admin" line wedged
            between them split the lockup in two — the console is already named
            by the shield card further down the rail. */}
        <span className="leading-tight">
          <Wordmark tone="light" className="block text-[17px]" />
          <Tagline tone="dark" className="mt-1" />
        </span>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-1"
        onClick={(e) => { if (e.target.closest('a')) onClose?.() }}
      >
        <div className="radio-container" style={{ '--total-radio': ADMIN_NAV.length }}>
          <div className="glider-container">
            <div className="glider" style={{ transform: `translateY(${activeIndex * 100}%)` }} />
          </div>
          {ADMIN_NAV.map(({ label, to, icon, end }) => {
            const Icon = ICONS[icon]
            const n = badge[to]
            return (
              <NavLink
                key={label}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{label}</span>
                {n > 0 && (
                  <span className="ml-auto rounded-full bg-amber-400 px-1.5 py-0.5 text-[10.5px] font-extrabold text-amber-950">
                    {n}
                  </span>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Scope reminder — a super admin acts across every tenant, not one hospital. */}
      <div className="mx-3 mb-2 flex items-start gap-2 rounded-xl bg-teal-800/60 px-3 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
        <p className="text-[11px] leading-snug text-teal-100/70">
          You are acting across <span className="font-semibold text-teal-50">all hospitals</span> on the platform.
        </p>
      </div>

      {/* Logout — last thing in the rail, and tinted so it reads as the exit
          rather than one more place to navigate to. No "Contact Support" card
          here: this console is where support tickets are answered. */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-200/85 transition-colors hover:bg-red-500/20 hover:text-red-100"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  )
}

export default AdminSidebar
