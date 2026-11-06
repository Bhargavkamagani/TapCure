import { useCallback, useEffect, useRef, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { Outlet } from 'react-router-dom'
import PatientSidebar from './PatientSidebar.jsx'
import PatientTopbar from './PatientTopbar.jsx'
import DelayToaster from '../common/DelayToaster.jsx'
import DoseDueToaster from './DoseDueToaster.jsx'
import GlassBackdrop from '../common/GlassBackdrop.jsx'
import { PatientProvider } from '../../context/PatientContext.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { notificationsApi, patientsApi } from '../../api'
import { useDialog } from '../common/DialogProvider.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Cancellation alerts cannot wait behind the bell icon: the patient may be
 * about to leave home. Show the newest unread in-app cancellation as a modal
 * everywhere in the patient console, then persist the acknowledgement so it
 * appears only once across refreshes and devices.
 */
function UrgentCancellationPopup() {
  const { t } = useI18n()
  const { patient } = usePatientCtx()
  const dialog = useDialog()
  const showing = useRef(false)

  const check = useCallback(async () => {
    if (!patient || showing.current) return
    try {
      const rows = await notificationsApi.history({
        patient_id: patient.patient_id,
        channel: 'in_app',
        type: 'cancel',
        size: 20,
      })
      const alert = (rows || []).find((n) => !n.is_read)
      if (!alert) return

      showing.current = true
      await dialog.alert({
        title: alert.title || t('px.layout.apptCancelled'),
        message: alert.message,
        tone: 'danger',
        confirmLabel: t('px.layout.iUnderstand'),
      })
      await notificationsApi.markRead(alert.notification_id)
    } catch {
      // Keep it unread: a temporary fetch/acknowledgement failure is retried.
    } finally {
      showing.current = false
    }
  }, [dialog, patient, t])

  useEffect(() => { check() }, [check])
  useAutoRefresh(check, { intervalMs: 15000, enabled: !!patient })
  return null
}

/**
 * A pending family link is a question, and a card on one page is easy to walk
 * past — so it is raised as a modal anywhere in the patient console, the same
 * way a cancellation is.
 *
 * The modal can only ever say YES. Dismissing means "not now" and never
 * declines, because Escape or a stray click must not silently refuse something
 * the other person is waiting on; declining is a deliberate act on the Family
 * page. Dismissals are remembered for the session so it asks once, not every
 * fifteen seconds.
 */
function FamilyLinkPopup() {
  const { patient } = usePatientCtx()
  const dialog = useDialog()
  const { t, lang } = useI18n()
  const showing = useRef(false)
  const dismissed = useRef(new Set())

  const check = useCallback(async () => {
    if (!patient || showing.current) return
    try {
      const [requests, invitations] = await Promise.all([
        patientsApi.linkRequests().catch(() => []),
        patientsApi.linkInvitations().catch(() => []),
      ])
      // Holder-side first: they are the ones who can actually resolve a wrong
      // number, and nothing reaches the other person until they do.
      const asHolder = (requests || []).find((m) => !dismissed.current.has(`req-${m.member_id}`))
      const asMember = (invitations || []).find((m) => !dismissed.current.has(`inv-${m.member_id}`))
      const row = asHolder || asMember
      if (!row) return

      const isHolder = Boolean(asHolder)
      showing.current = true
      const yes = await dialog.confirm({
        title: t('ppage.linkInboxTitle'),
        message: isHolder
          ? t('ppage.linkAskHolder', { name: translitName(row.name, lang) })
          : t('ppage.linkAskMember', { name: row.holder_name || t('ppage.linkSomeone') }),
        tone: 'info',
        confirmLabel: t('ppage.linkAccept'),
        cancelLabel: t('pcommon.later'),
      })
      if (yes) {
        await (isHolder ? patientsApi.linkApprove(row.member_id) : patientsApi.linkAccept(row.member_id))
      } else {
        dismissed.current.add(`${isHolder ? 'req' : 'inv'}-${row.member_id}`)
      }
    } catch {
      // Leave it pending — a failed fetch or action is simply asked again.
    } finally {
      showing.current = false
    }
  }, [dialog, patient, t])

  useEffect(() => { check() }, [check])
  useAutoRefresh(check, { intervalMs: 15000, enabled: !!patient })
  return null
}

/**
 * Shared shell for all patient pages: fixed sidebar + topbar; page content
 * swaps via <Outlet/>. Same fluid, edge-to-edge layout as the doctor console.
 *
 * <PatientProvider/> loads the logged-in patient + doctor/hospital lookups once
 * so every nested page can read real data without refetching.
 *
 * On desktop (lg+) the sidebar is a static rail; on smaller screens it slides
 * in as an overlay drawer toggled from the topbar menu button.
 */
function PatientLayout() {
  const { t } = useI18n()
  const [navOpen, setNavOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('patient-theme') === 'dark')

  useEffect(() => {
    localStorage.setItem('patient-theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <PatientProvider>
      <div className={`theme-reception ${dark ? 'theme-dark' : 'glass-console'} relative flex h-screen w-screen flex-col overflow-hidden ${
        dark ? 'bg-slate-900' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'
      }`}>
        {/* Ambient "green glass" depth behind the frosted cards (light mode). */}
        {!dark && <GlassBackdrop />}
        {/* Full-width topbar across the top (holds the logo) */}
        <PatientTopbar
          onMenu={() => setNavOpen(true)}
          dark={dark}
          onToggleTheme={() => setDark((d) => !d)}
        />
        {/* Sidebar + routed content sit below the topbar */}
        <div className="relative flex min-h-0 flex-1">
          <PatientSidebar open={navOpen} onClose={() => setNavOpen(false)} />
          {navOpen && (
            <div
              className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
              onClick={() => setNavOpen(false)}
              aria-hidden="true"
            />
          )}
          {/* The desktop collapse arrow on the sidebar's edge was removed
              2026-09-30 at the user's request: the sidebar stays open on
              desktop. Phones still open it from the topbar's ☰ menu. */}
          <main className="tc-surface flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-4">
            <Outlet />
          </main>
        </div>
        {/* Live queue alerts for the patient's own tokens: doctor delays, the
            leave-by nudge, and being called in. `desktop` raises an OS
            notification too when they've granted permission via "Notify me". */}
        <DelayToaster channel="sms" types={['delay', 'travel_alert', 'recall']} desktop />
        {/* Dose-time popup. Mounted here rather than on the dashboard so it
            follows the patient across every page — a reminder that only fires
            on one screen is a reminder they will miss. */}
        <DoseDueToaster />
        <UrgentCancellationPopup />
        <FamilyLinkPopup />
      </div>
    </PatientProvider>
  )
}

export default PatientLayout
