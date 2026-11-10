import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Bell, BellRing, CalendarDays, Sun, Moon, UserPlus, CheckCircle2 } from 'lucide-react'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { notificationsApi } from '../../api'
import { relativeTime } from '../../lib/format.js'
import { Avatar } from '../hospital/ui.jsx'
import Logo from '../common/Logo.jsx'
import Tagline from '../common/Tagline.jsx'
import Wordmark from '../common/Wordmark.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

/** Time-of-day greeting. */
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** Ensure the doctor's name reads with a "Dr." prefix. */
function withDr(name = '') {
  const n = name.trim()
  if (!n) return 'Doctor'
  return /^dr\.?\s/i.test(n) ? n : `Dr. ${n}`
}

/** Icon + tint for a notification, keyed off its type. */
function notifMeta(type = '') {
  const t = type.toLowerCase()
  if (t.includes('delay')) return { icon: BellRing, tone: 'bg-purple-100 text-purple-600' }
  if (t.includes('arriv') || t.includes('check')) return { icon: CheckCircle2, tone: 'bg-green-100 text-green-600' }
  if (t.includes('appoint') || t.includes('book') || t.includes('walk')) return { icon: UserPlus, tone: 'bg-blue-100 text-brand-blue' }
  return { icon: Bell, tone: 'bg-slate-100 text-slate-500' }
}

// Read state lives on the server, per user (notification_reads). It used to be a
// localStorage set, which meant the badge never cleared on another device — and
// the key wasn't scoped per user, so whoever logged in next inherited it.

/**
 * Doctor console top bar: menu toggle (decorative for now) + centered title,
 * with notifications, calendar and the doctor profile chip on the right.
 */
function DoctorTopbar({ onMenu, dark, onToggleTheme }) {
  const navigate = useNavigate()
  const { doctor } = useDoctorCtx()
  const [notifs, setNotifs] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  const loadNotifs = useCallback(() => {
    Promise.all([
      notificationsApi.history({ size: 50 }).catch(() => []),
      notificationsApi.unreadCount().catch(() => ({ unread: 0 })),
    ]).then(([list, count]) => {
      setNotifs(list || [])
      setUnread(count?.unread || 0)
    })
  }, [])

  useEffect(() => { loadNotifs() }, [loadNotifs])
  // This dropdown was loaded exactly once per session: a cancellation raised an
  // hour into a hospital never reached the doctor until they reloaded the page.
  // Paused while the panel is open so the list can't shift as they read it.
  useAutoRefresh(loadNotifs, { paused: notifOpen })

  const visible = notifs.filter((n) => !n.is_read)

  // Same vanish-on-view behaviour as before, but recorded server-side so the
  // badge stays cleared after a refresh and on the doctor's other devices.
  const closeNotifs = () => {
    setNotifOpen(false)
    if (!unread) return
    notificationsApi
      .markAllRead()
      .then(() => {
        setUnread(0)
        setNotifs((rows) => rows.map((n) => ({ ...n, is_read: true })))
      })
      .catch(() => { /* badge stays until the next load */ })
  }

  const name = doctor?.name || 'Doctor'
  const specialty = doctor?.specialization || ''

  return (
    <header className="console-topbar relative flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-2.5 sm:px-6">
      {/* Left: mobile menu + the same full brand lockup used by the patient console. */}
      <div className="flex items-center gap-2">
        <button className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 lg:hidden" aria-label="Toggle menu" onClick={onMenu}>
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/doctor-dashboard" className="flex items-center gap-2.5">
          <Logo className="h-12 shrink-0" />
          <span className="hidden flex-col items-center leading-none sm:flex">
            <Wordmark className="text-[20px]" />
            <Tagline className="mt-1.5" />
          </span>
        </Link>
      </div>

      {/* Center: personalised greeting */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-center lg:block">
        <h1 className="whitespace-nowrap text-[22px] font-extrabold leading-tight text-brand-navy">
          {greeting()}, {withDr(name)}
        </h1>
        <p className="whitespace-nowrap text-[13px] text-slate-500">
          Here&apos;s what&apos;s happening at your hospital today.
        </p>
      </div>

      {/* Right: actions + profile */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleTheme}
          className="text-slate-500 hover:text-brand-blue"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="relative">
          <button
            className="relative text-slate-500 hover:text-brand-blue"
            aria-label="Notifications"
            onClick={() => (notifOpen ? closeNotifs() : setNotifOpen(true))}
          >
            <Bell className="h-6 w-6" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[13px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={closeNotifs} aria-hidden="true" />
              <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h4 className="text-[14px] font-bold text-brand-navy">Notifications</h4>
                  {unread > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[13px] font-bold text-red-600">{unread} new</span>}
                </div>
                <ul className="max-h-96 overflow-auto p-1.5">
                  {visible.length === 0 ? (
                    <li className="py-8 text-center text-[13px] text-slate-400">You&apos;re all caught up.</li>
                  ) : (
                    visible.slice(0, 12).map((n) => {
                      const meta = notifMeta(n.type)
                      const Icon = meta.icon
                      return (
                        <li key={n.notification_id} className="flex gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}><Icon className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1 leading-tight">
                            <p className="text-[13px] font-bold text-brand-navy">{n.title}</p>
                            <p className="truncate text-[13px] text-slate-500">{n.message}</p>
                            <p className="mt-0.5 text-[13px] text-slate-400">{relativeTime(n.created_at)}</p>
                          </div>
                        </li>
                      )
                    })
                  )}
                </ul>
                <button
                  onClick={() => { closeNotifs(); navigate('/doctor-dashboard/notifications') }}
                  className="w-full border-t border-slate-100 py-2.5 text-center text-[13px] font-semibold text-brand-blue hover:bg-slate-50"
                >
                  View all
                </button>
              </div>
            </>
          )}
        </div>
        <button className="text-slate-500 hover:text-brand-blue" aria-label="Calendar" onClick={() => navigate('/doctor-dashboard/today')}>
          <CalendarDays className="h-6 w-6" />
        </button>
        <button
          className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-slate-50"
          onClick={() => navigate('/doctor-dashboard/profile')}
        >
          <Avatar name={name} src={doctor?.profile_photo_url} tone="bg-brand-blue" className="h-10 w-10 text-sm" />
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-bold text-brand-navy">{name}</span>
            <span className="block text-[13px] text-slate-400">{specialty}</span>
          </span>
        </button>
      </div>
    </header>
  )
}

export default DoctorTopbar
