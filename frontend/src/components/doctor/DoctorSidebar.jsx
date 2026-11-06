import { NavLink, Link } from 'react-router-dom'
import {
  Home, ClipboardList, Users, UserRound, Clock, BarChart3,
  Building2, Headphones, LogOut,
} from 'lucide-react'
import { DOCTOR_NAV } from '../../data/doctorNav.js'
import { useAuth } from '../../context/AuthContext.jsx'

const ICONS = {
  Home, ClipboardList, Users, UserRound, Clock, BarChart3, Building2,
}

const linkClass = ({ isActive }) =>
  `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-all ${
    isActive
      ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-teal-900 shadow-md shadow-black/25'
      : 'text-teal-100/80 hover:bg-white/10 hover:text-white'
  }`

function NavItem({ label, to, icon, end }) {
  const Icon = ICONS[icon]
  return (
    <NavLink to={to} end={end} className={linkClass}>
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

/** Left navigation rail for the doctor console (full grouped menu). */
function DoctorSidebar({ open = false, onClose }) {
  const { logout } = useAuth()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-60 shrink-0 flex-col bg-teal-900 text-teal-100/85 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <nav
        className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-2 pt-4"
        onClick={(e) => { if (e.target.closest('a')) onClose?.() }}
      >
        <div className="space-y-0.5">
          {DOCTOR_NAV.flatMap((group) => group.items).map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </div>

      </nav>

      {/* Need help card */}
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-white/10 p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-teal-100">
          <Headphones className="h-[18px] w-[18px]" />
        </span>
        <div className="leading-tight">
          <h4 className="text-[13px] font-bold text-white">Need Help?</h4>
          {/* Was to="/" — clicking Contact Support dropped the doctor out of
              the console onto the marketing landing page. */}
          <Link to="/contact" className="text-[12px] font-semibold text-teal-200/70 hover:text-teal-100">
            Contact Support
          </Link>
        </div>
      </div>

      {/* Logout — last thing in the rail, and tinted so it reads as the exit
          rather than one more place to navigate to. */}
      <button
        type="button"
        onClick={logout}
        className="mx-3 mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-200/85 transition-colors hover:bg-red-500/20 hover:text-red-100"
      >
        <LogOut className="h-[18px] w-[18px] shrink-0" /> Logout
      </button>
    </aside>
  )
}

export default DoctorSidebar
