import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  CalendarDays,
  Users,
  UserPlus,
  Stethoscope,
  Building2,
  UserCog,
  Clock,
  BarChart3,
  Settings,
  CreditCard,
  Headphones,
  LogOut,
} from 'lucide-react'
import Logo from '../common/Logo.jsx'
import Tagline from '../common/Tagline.jsx'
import Wordmark from '../common/Wordmark.jsx'
import { HOSPITAL_NAV } from '../../data/hospitalPagesData.js'
import { useAuth } from '../../context/AuthContext.jsx'

const ICONS = { Home, CalendarDays, Users, UserPlus, Stethoscope, Building2, UserCog, Clock, BarChart3, Settings, CreditCard }

/** Which nav row the current route falls on — drives the glider position.
 *  Mirrors NavLink's active logic (exact match for `end`, prefix otherwise). */
function activeNavIndex(pathname) {
  const i = HOSPITAL_NAV.findIndex(({ to, end }) =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`),
  )
  return i < 0 ? 0 : i
}

/** Left navigation rail for the hospital dashboard (routed). */
function HospitalSidebar({ open = false, onClose }) {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const activeIndex = activeNavIndex(pathname)
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col bg-teal-900 text-teal-100/85 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand — transparent logo straight on the rail, same as the doctor /
          front-desk / super-admin consoles. */}
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <Logo className="h-11 shrink-0" />
        <span className="leading-tight">
          <Wordmark tone="light" className="block text-[17px]" />
          <Tagline tone="dark" className="mt-1" />
        </span>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-1"
        onClick={(e) => { if (e.target.closest('a')) onClose?.() }}
      >
        {/* Glider nav: the yellow bar + glow slide to the active row. */}
        <div className="radio-container nav-hospital" style={{ '--total-radio': HOSPITAL_NAV.length }}>
          <div className="glider-container">
            <div className="glider" style={{ transform: `translateY(${activeIndex * 100}%)` }} />
          </div>
          {HOSPITAL_NAV.map(({ label, to, icon, end }) => {
            const Icon = ICONS[icon]
            return (
              <NavLink
                key={label}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Need help card — the hospital rail was the one console with no way to
          reach support without leaving it. */}
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-white/10 p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-teal-100">
          <Headphones className="h-[18px] w-[18px]" />
        </span>
        <div className="leading-tight">
          <h4 className="text-[13px] font-bold text-white">Need Help?</h4>
          <Link to="/contact" className="text-[13px] font-semibold text-teal-200/70 hover:text-teal-100">
            Contact Support
          </Link>
        </div>
      </div>

      {/* Logout — last thing in the rail, and tinted so it reads as the exit
          rather than one more place to navigate to. */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-red-200/85 transition-colors hover:bg-red-500/20 hover:text-red-100"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </aside>
  )
}

export default HospitalSidebar
