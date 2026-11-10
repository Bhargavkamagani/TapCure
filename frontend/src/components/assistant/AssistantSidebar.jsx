import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard, ListChecks, UserPlus, CalendarDays, Users, Search,
  Activity, FlaskConical, Pill, MessageSquare, Bell, LogOut, Headphones,
} from 'lucide-react'
import { ASSISTANT_NAV } from '../../data/assistantNav.js'
import { useAuth } from '../../context/AuthContext.jsx'
import Logo from '../common/Logo.jsx'
import Tagline from '../common/Tagline.jsx'
import Wordmark from '../common/Wordmark.jsx'

const ICONS = {
  LayoutDashboard, ListChecks, UserPlus, CalendarDays, Users, Search,
  Activity, FlaskConical, Pill, MessageSquare, Bell,
}

/** Left navigation rail for the Assistant console — deep teal, grouped sections. */
function AssistantSidebar({ open = false, onClose }) {
  const { logout } = useAuth()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-56 shrink-0 flex-col bg-teal-900 text-teal-100/85 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand — same app icon used on the public landing page. */}
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <Logo className="h-12 shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.25)]" />
        {/* Wordmark sits directly on the tagline — a console name wedged
            between them splits the lockup in two. */}
        <div className="leading-tight">
          <Wordmark tone="light" className="block text-[17px]" />
          <Tagline tone="dark" className="mt-1" />
        </div>
      </div>

      {/* Grouped nav */}
      <nav
        className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 pb-4"
        onClick={(e) => { if (e.target.closest('a')) onClose?.() }}
      >
        {ASSISTANT_NAV.map((group, gi) => {
          // Drop hidden entries, and any section left with nothing in it.
          const items = group.items.filter((i) => !i.hidden)
          if (!items.length) return null
          return (
          <div key={gi}>
            {/* Section captions removed — the spacing between groups already
                reads as a break, and the rail is short enough that naming each
                cluster added labels to read rather than a place to click. */}
            <div className="space-y-0.5">
              {items.map(({ label, to, icon, end, soon }) => {
                const Icon = ICONS[icon] || LayoutDashboard
                return (
                  <NavLink
                    key={label}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-teal-900 shadow-md shadow-black/25'
                          : 'text-teal-100/80 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 leading-snug">{label}</span>
                    {soon && (
                      <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[13px] font-semibold text-teal-100">soon</span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
          )
        })}
      </nav>

      {/* Need help card */}
      <div className="mx-3 mb-2 rounded-2xl bg-white/10 p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-teal-100">
            <Headphones className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-white">Need Help?</p>
            {/* Was plain text — it looked clickable but did nothing. */}
            <Link to="/contact" className="text-[13px] text-teal-200/70 hover:text-teal-100">
              Contact Support
            </Link>
          </div>
        </div>
      </div>

      {/* Logout — last thing in the rail, and tinted so it reads as the exit
          rather than one more place to navigate to. */}
      <button
        onClick={logout}
        className="mx-3 mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-200/85 transition-colors hover:bg-red-500/20 hover:text-red-100"
      >
        <LogOut className="h-[18px] w-[18px]" />
        Log out
      </button>
    </aside>
  )
}

export default AssistantSidebar
