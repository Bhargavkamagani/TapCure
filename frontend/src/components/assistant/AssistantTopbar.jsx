import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MapPin, Bell, Menu, Sun, Moon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { hospitalsApi, notificationsApi, fileUrl } from '../../api'
import { Avatar } from '../hospital/ui.jsx'
import { RECEPTIONIST_AVATAR } from '../../lib/staffAvatar.js'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

const today = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Top bar for the Assistant console: hospital context (left) + tools + user (right). */
function AssistantTopbar({ onMenu, dark, onToggleTheme }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [hospital, setHospital] = useState(null)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user?.hospital_id) return
    hospitalsApi.get(user.hospital_id).then(setHospital).catch(() => {})
  }, [user?.hospital_id])

  // Was a hardcoded red dot that never cleared. Re-checked per route change —
  // plus whenever the notifications page reports it cleared something, since
  // standing on that page and marking read never changes the route, and the
  // badge would otherwise keep advertising alerts the user just dealt with.
  // ...and on a timer, so an alert raised while the desk sits on one page still
  // lights the bell instead of waiting for the next click.
  const loadUnread = useCallback(() => {
    notificationsApi.unreadCount()
      .then((res) => setUnread(res?.unread || 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadUnread()
    window.addEventListener('tapcure:notifications-read', loadUnread)
    return () => window.removeEventListener('tapcure:notifications-read', loadUnread)
  }, [location.pathname, loadUnread])

  useAutoRefresh(loadUnread)

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-3">
      {/* Hospital context */}
      <div className="flex items-center gap-2">
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 lg:hidden"
          aria-label="Toggle menu"
          onClick={onMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* The hospital's own logo, same as the hospital-admin topbar. This showed
            only a generic pin before, so the front desk was the one console
            where the hospital's identity never appeared. Falls back to initials
            when no logo has been uploaded — never to a blank space. */}
        {hospital?.logo_url ? (
          <img
            src={fileUrl(hospital.logo_url)}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <Avatar name={hospital?.name || 'My Hospital'} className="h-9 w-9 text-sm" />
        )}
        <div className="leading-tight">
          <span className="block text-[14px] font-bold text-brand-navy">{hospital?.name || 'My Hospital'}</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin className="h-3 w-3 shrink-0" />
            {[hospital?.city, hospital?.state].filter(Boolean).join(', ') || 'Front desk'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="hidden rounded-lg bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-500 sm:block">
          {today()}
        </span>
        <button
          onClick={onToggleTheme}
          className="text-slate-400 hover:text-brand-blue"
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <button onClick={() => navigate('/assistant-dashboard/notifications')} className="relative text-slate-400 hover:text-brand-blue">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2.5 border-l border-slate-100 pl-4">
          <Avatar name={user?.name || 'Front Desk'} src={RECEPTIONIST_AVATAR} className="h-9 w-9 bg-sky-50 text-[12px]" />
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[13px] font-bold text-brand-navy">{user?.name || 'Front Desk'}</span>
            <span className="block text-[11px] text-slate-400">Receptionist</span>
          </span>
        </div>
      </div>
    </header>
  )
}

export default AssistantTopbar
