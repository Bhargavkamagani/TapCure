import { useCallback, useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { hospitalsApi, notificationsApi, fileUrl } from '../../api'
import { Avatar } from './ui.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

const PROFILE_PATH = '/hospital-dashboard/profile'

const ROLE_LABELS = {
  HOSPITAL_ADMIN: 'Hospital Admin',
  SUPER_ADMIN: 'Super Admin',
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
}

/** Top bar: who is signed in (left) + notifications & the hospital (right).
 *
 *  The two halves answer different questions and must not repeat each other:
 *  the left says WHO is at this screen, the right says WHICH HOSPITAL they are
 *  running — and only the right is clickable, because Hospital Profile is the
 *  only profile page this console has. */
function HospitalTopbar({ onMenu }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [hospital, setHospital] = useState(null)
  const [unread, setUnread] = useState(0)

  // The badge used to be a hardcoded red dot — always on, tied to nothing, so
  // it never cleared. Re-checked per route change so it drops after marking read.
  const loadUnread = useCallback(() => {
    notificationsApi.unreadCount()
      .then((res) => setUnread(res?.unread || 0))
      .catch(() => {})
  }, [])
  useEffect(() => { loadUnread() }, [location.pathname, loadUnread])
  // A bell that only counts on navigation tells you about an alert whenever you
  // happen to click something else. Keep it counting on its own.
  useAutoRefresh(loadUnread)

  useEffect(() => {
    // Show the hospital this admin registered/belongs to.
    // Only ever the hospital this user belongs to. Falling back to the first
    // hospital in the list put another hospital's name in the topbar whenever
    // hospital_id was missing.
    if (!user?.hospital_id) {
      setHospital(null)
      return
    }
    hospitalsApi.get(user.hospital_id).then(setHospital).catch(() => setHospital(null))
  }, [user?.hospital_id])

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-3">
      {/* Hospital name */}
      <button
        className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 lg:hidden"
        aria-label="Toggle menu"
        onClick={onMenu}
      >
        <Menu className="h-5 w-5" />
      </button>
      {/* Signed-in user. Not a link: there is no personal profile page in this
          console, and a block that looks clickable but goes to the hospital's
          record reads as the admin's own account when it isn't. */}
      <div className="flex items-center gap-2.5 px-2 py-1.5 text-left">
        <Avatar name={user?.name || 'Admin'} className="h-9 w-9 text-sm" />
        <span className="leading-tight">
          <span className="block text-[15px] font-bold text-brand-navy">{user?.name || 'Admin'}</span>
          <span className="block text-[13px] text-slate-400">
            {ROLE_LABELS[user?.role_name] || 'Hospital Admin'}
          </span>
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-5">
        <button
          className="relative text-slate-500 hover:text-brand-blue"
          aria-label="Notifications"
          onClick={() => navigate('/hospital-dashboard/notifications')}
        >
          <Bell className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[13px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        {/* This corner points at Hospital Profile, so it shows the HOSPITAL — its
            uploaded logo and name — not the logged-in admin. Showing a personal
            name and role here suggested a user account page that doesn't exist:
            the only profile in this console is the hospital's. */}
        <button
          type="button"
          onClick={() => navigate(PROFILE_PATH)}
          title="Hospital profile"
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50"
        >
          {hospital?.logo_url ? (
            <img
              src={fileUrl(hospital.logo_url)}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <Avatar name={hospital?.name || 'My Hospital'} className="h-9 w-9 text-sm" />
          )}
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-bold text-brand-navy">{hospital?.name || 'My Hospital'}</span>
            <span className="block text-[13px] text-slate-400">Hospital Profile</span>
          </span>
        </button>
      </div>
    </header>
  )
}

export default HospitalTopbar
