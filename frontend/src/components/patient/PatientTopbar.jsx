import { useCallback, useEffect, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Menu, Bell, ChevronDown, Globe, Sun, Moon } from 'lucide-react'
import Logo from '../common/Logo.jsx'
import Tagline from '../common/Tagline.jsx'
import Wordmark from '../common/Wordmark.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { notificationsApi } from '../../api'
import { useI18n, LANGS } from '../../i18n/index.jsx'
import { Avatar } from '../hospital/ui.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

/** Time-of-day greeting i18n key. */
function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'pdash.greetingMorning'
  if (h < 17) return 'pdash.greetingAfternoon'
  return 'pdash.greetingEvening'
}

/**
 * Patient console top bar: menu toggle (decorative for now) on the left;
 * language selector, notifications and the patient profile chip on the right.
 * Backed by the logged-in patient record from PatientContext.
 */
function PatientTopbar({ onMenu, dark, onToggleTheme }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { patient } = usePatientCtx()
  const { t, lang, setLang } = useI18n()
  const [unread, setUnread] = useState(0)
  const [langOpen, setLangOpen] = useState(false)

  const loadUnread = useCallback(() => {
    if (!patient) return
    notificationsApi
      .unreadCount()
      .then((res) => setUnread(res?.unread || 0))
      .catch(() => {})
  }, [patient])

  // Re-checked on every route change so the badge clears as soon as the patient
  // comes back from marking things read — and on a timer, so a token call or a
  // delay alert lights the bell while they sit on one screen.
  useEffect(() => { loadUnread() }, [loadUnread, location.pathname])
  useAutoRefresh(loadUnread, { intervalMs: 30000, enabled: !!patient })

  const name = patient?.name || t('pnav.patient')

  return (
    <header className="relative flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-2.5 sm:px-6">
      {/* Left: menu (mobile) + logo */}
      <div className="flex items-center gap-2">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 lg:hidden"
          aria-label={t('pm.toggleMenu')}
          onClick={onMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Brand lockup — icon, name, tagline. Was the bare icon, which left the
            patient console as the only surface that never said what the app is
            called. Name + tagline hide on small screens so the greeting keeps
            the middle of the bar. */}
        <Link to="/patient-dashboard" className="flex items-center gap-2.5">
          <Logo className="h-12 shrink-0" />
          <span className="hidden flex-col items-center leading-none sm:flex">
            <Wordmark className="text-[20px]" />
            <Tagline className="mt-1.5" text={t('tc.foot.tagline')} />
          </span>
        </Link>
      </div>

      {/* Greeting — centered in the topbar (moved up from the dashboard page) */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-center lg:block">
        <p className="text-[22px] font-extrabold leading-tight text-brand-navy">
          {t(greetingKey())}, {translitName(name, lang)}
        </p>
        <p className="text-[13px] text-slate-500">{t('pdash.greetingLine')}</p>
      </div>

      {/* Right: language + notifications + profile */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:border-slate-300"
          >
            <Globe className="h-4 w-4 text-slate-400" />
            {LANGS[lang].label}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {Object.entries(LANGS).map(([code, { label }]) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangOpen(false) }}
                    className={`block w-full px-3 py-1.5 text-left text-[13px] font-semibold hover:bg-slate-50 ${
                      lang === code ? 'text-brand-blue' : 'text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onToggleTheme}
          className="text-slate-500 hover:text-brand-blue"
          aria-label={dark ? t('px.top.toLight') : t('px.top.toDark')}
          title={dark ? t('px.top.lightMode') : t('px.top.darkMode')}
        >
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          className="relative text-slate-500 hover:text-brand-blue"
          aria-label={t('pm.notifications')}
          onClick={() => navigate('/patient-dashboard/notifications')}
        >
          <Bell className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </button>

        <button
          className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 hover:bg-slate-50"
          onClick={() => navigate('/patient-dashboard/profile')}
        >
          <Avatar name={name} src={patient?.photo_url} tone="bg-brand-blue" className="h-10 w-10 text-sm" />
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-bold text-brand-navy">{name}</span>
            <span className="block text-[11px] text-slate-400">{t('pnav.patient')}</span>
          </span>
        </button>
      </div>
    </header>
  )
}

export default PatientTopbar
