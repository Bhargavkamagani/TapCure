import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Boxes, Upload, LogOut, Menu, MapPin, Headphones, ClipboardList } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { hospitalsApi, fileUrl } from '../../api'
import { Avatar } from '../hospital/ui.jsx'
import GlassBackdrop from '../common/GlassBackdrop.jsx'
import Logo from '../common/Logo.jsx'
import Tagline from '../common/Tagline.jsx'
import Wordmark from '../common/Wordmark.jsx'

const NAV = [
  { label: 'Counter', to: '/pharmacy-dashboard/counter', icon: ClipboardList },
  { label: 'Stock List', to: '/pharmacy-dashboard', icon: Boxes, end: true },
  { label: 'Upload Stock', to: '/pharmacy-dashboard/upload', icon: Upload },
]

const ROLE_LABEL = { PHARMACIST: 'Pharmacist', HOSPITAL_ADMIN: 'Hospital Admin' }

/**
 * Shell for the hospital pharmacy console. Same look as the front-desk console
 * (teal rail + light glass surface) so staff moving between the two aren't
 * learning a new app — just two pages: the stock list and the upload.
 */
function PharmacyLayout() {
  const { user, logout } = useAuth()
  const [navOpen, setNavOpen] = useState(false)
  const [hospital, setHospital] = useState(null)

  useEffect(() => {
    if (!user?.hospital_id) return
    hospitalsApi.get(user.hospital_id).then(setHospital).catch(() => {})
  }, [user?.hospital_id])

  return (
    <div className="theme-reception glass-console relative flex h-screen w-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <GlassBackdrop />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-56 shrink-0 flex-col bg-teal-900 text-teal-100/85 transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
          <Logo className="h-12 shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.25)]" />
          <div className="leading-tight">
            <Wordmark tone="light" className="block text-[17px]" />
            <Tagline tone="dark" className="mt-1" />
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" onClick={(e) => { if (e.target.closest('a')) setNavOpen(false) }}>
          {NAV.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-teal-900 shadow-md shadow-black/25'
                    : 'text-teal-100/80 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mx-3 mb-2 rounded-2xl bg-white/10 p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-teal-100">
              <Headphones className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-[12px] font-bold text-white">Need Help?</p>
              <Link to="/contact" className="text-[10px] text-teal-200/70 hover:text-teal-100">Contact Support</Link>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="mx-3 mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-red-200/85 transition-colors hover:bg-red-500/20 hover:text-red-100"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Log out
        </button>
      </aside>

      {navOpen && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-3">
          <div className="flex items-center gap-2">
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 lg:hidden"
              aria-label="Toggle menu"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            {hospital?.logo_url ? (
              <img src={fileUrl(hospital.logo_url)} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
            ) : (
              <Avatar name={hospital?.name || 'My Hospital'} className="h-9 w-9 text-sm" />
            )}
            <div className="leading-tight">
              <span className="block text-[14px] font-bold text-brand-navy">{hospital?.name || 'My Hospital'}</span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <MapPin className="h-3 w-3 shrink-0" />
                {[hospital?.city, hospital?.state].filter(Boolean).join(', ') || 'Pharmacy'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Avatar name={user?.name || 'Pharmacist'} className="h-9 w-9 text-[12px]" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[13px] font-bold text-brand-navy">{user?.name || 'Pharmacist'}</span>
              <span className="block text-[11px] text-slate-400">{ROLE_LABEL[user?.role_name] || 'Pharmacy'}</span>
            </span>
          </div>
        </header>
        <main className="tc-surface flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default PharmacyLayout
