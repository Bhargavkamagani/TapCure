import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hospitalsApi, departmentsApi } from '../../api'

/**
 * "Complete your profile" for a newly approved hospital (2026-11-10). Signup
 * only asks for the basics, so the owner adds three things after approval:
 * a logo or photo, opening hours, and services (departments). This file answers
 * "how many are done?" in one place, for the setup page and the dashboard bar.
 *
 * Signup saves the hospital as open 24/7, so a hospital that still says 24/7
 * has not chosen its hours yet. An owner who really is open 24/7 confirms it on
 * the setup page, and that choice is remembered in this browser.
 */

const hoursKey = (id) => `tc.hsetup.hours.${id}`
// "Do it later" holds for this login only; the bar on the dashboard stays.
export const LATER_KEY = 'tc.hsetup.later'

const read = (store, key) => { try { return store.getItem(key) } catch { return null } }
export const remember = (store, key) => { try { store.setItem(key, '1') } catch { /* private mode */ } }
export const rememberHours = (id) => remember(localStorage, hoursKey(id))
export const skippedForNow = () => read(sessionStorage, LATER_KEY) === '1'

// Signup always creates a "General OPD" (code OPD) so doctors and tokens have a
// department to hang off. It is not a service the owner picked, so it does not
// count towards "services done" (2026-11-10) — otherwise every new hospital
// starts at 1 of 3 and is never sent to "Complete your profile".
export const isAutoOpd = (d) => d?.code === 'OPD' && (d?.name || '').trim().toLowerCase() === 'general opd'
export const pickedServices = (departments) =>
  (departments || []).filter((d) => d.is_active !== false && !isAutoOpd(d))

/** `enabled` false skips every request (the super admin in a hospital console). */
export function useHospitalSetup(enabled = true) {
  const [state, setState] = useState({ loading: true, hospital: null, settings: null, departments: [] })

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const hospital = ((await hospitalsApi.list()) || [])[0] || null
      if (!hospital) { setState({ loading: false, hospital: null, settings: null, departments: [] }); return }
      const [settings, departments] = await Promise.all([
        hospitalsApi.settings(hospital.hospital_id).catch(() => null),
        departmentsApi.list().catch(() => null),
      ])
      // null = could not load; judged as unknown below, never as "no services"
      setState({ loading: false, hospital, settings, departments })
    } catch {
      // A dropped request is not an unfinished profile: keep what we knew.
      setState((s) => ({ ...s, loading: false }))
    }
  }, [enabled])

  useEffect(() => { refresh() }, [refresh])

  const { hospital, settings } = state
  const departments = state.departments || []
  const steps = {
    photo: Boolean(hospital?.logo_url || hospital?.photo_url),
    // On the server since 2026-11-10 (hours_confirmed); the browser note is the
    // fallback for a backend without that column.
    hours: Boolean(settings && (settings.hours_confirmed ?? (!settings.always_open || read(localStorage, hoursKey(hospital?.hospital_id)) === '1'))),
    services: pickedServices(departments).length > 0,
  }
  const done = Object.values(steps).filter(Boolean).length
  // Only judge once everything loaded; a failed settings call is not "not done".
  const known = enabled && !state.loading && Boolean(hospital) && Boolean(settings) && state.departments !== null
  return {
    ...state, departments, setHospital: (h) => setState((s) => ({ ...s, hospital: h })), steps, done, refresh,
    complete: known && done === 3,
    // Patients see the hospital only once the server marked it complete.
    visible: Boolean(hospital?.profile_completed_at),
    incomplete: known && done < 3,
    // nothing filled at all: a hospital that has just been approved
    fresh: known && done === 0,
  }
}

/** The small bar on top of the dashboard until all three steps are done. */
export function SetupNudge({ done }) {
  const missing = 3 - done
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <div className="min-w-[200px] flex-1">
        <p className="text-[14px] text-slate-700">
          <b className="text-amber-700">Profile {done} of 3 done.</b>{' '}
          {missing === 1 ? 'One more step to go.' : `${missing} more steps to go.`}{' '}
          Patients can find and book your hospital only after your profile is complete.
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100">
          <i className="block h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(done / 3) * 100}%` }} />
        </div>
      </div>
      <Link to="/hospital-setup" className="rounded-xl bg-gradient-to-r from-teal-600 to-brand-blue px-4 py-2 text-[14px] font-bold text-white hover:opacity-95">
        Finish now
      </Link>
    </div>
  )
}
