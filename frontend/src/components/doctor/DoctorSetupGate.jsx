import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { doctorsApi } from '../../api'
import DoctorNotLinked from './DoctorNotLinked.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'

export function doctorProfileComplete(doctor) {
  return Boolean(doctor?.profile_photo_url && doctor?.specialization?.trim() && doctor?.qualification?.trim() && doctor?.registration_number?.trim() && doctor?.languages?.trim())
}

/**
 * The two things a doctor must finish before their dashboard opens: at least one
 * weekly session, and a patient-facing profile. Both the dashboard gate and the
 * onboarding shell read this, so "am I set up?" is answered in exactly one place.
 *
 * `refresh` re-counts the sessions without a page navigation — the onboarding
 * shell calls it after a step is completed so the stepper updates immediately.
 */
export function useDoctorSetupStatus() {
  const { doctor, loading } = useDoctorCtx()
  const [state, setState] = useState({ loading: true, availability: false, sessionCount: 0, revisitReady: false })

  const refresh = useCallback(async () => {
    if (!doctor?.doctor_id) return
    try {
      const affiliations = (await doctorsApi.affiliations({ doctor_id: doctor.doctor_id })) || []
      const activeAffiliations = affiliations.filter((a) => a.is_active !== false)
      const schedules = await Promise.all(
        activeAffiliations
          .map((a) => doctorsApi.schedule(doctor.doctor_id, a.affiliation_id).catch(() => [])),
      )
      const sessionCount = schedules.reduce((sum, rows) => sum + (rows?.length || 0), 0)
      /* Not a setup gate any more. Requiring `free_revisit_days > 0` locked out
         EVERY doctor: each has one personal practice and 28 of 29 hold NULL, so
         all of them were bounced back into onboarding permanently. They would
         re-save a profile that was already correct, be redirected again, and
         reasonably conclude their details were not being stored.

         NULL is not an unfinished setup — it is the only way to say "no free
         revisit". The API caps this field at `ge=1`, so zero cannot even be
         stored; absence IS the answer. The value is still offered during
         onboarding; it simply no longer blocks the dashboard. */
      const revisitReady = true
      setState({ loading: false, availability: sessionCount > 0, sessionCount, revisitReady })
    } catch {
      /* A dropped request is not evidence that setup is incomplete. Writing
         `availability: false` here threw fully-onboarded doctors back to step 1
         whenever one of these calls failed — from the dashboard too, not just
         onboarding. Keep the last known answer and only clear `loading`. */
      setState((current) => ({ ...current, loading: false }))
    }
  }, [doctor?.doctor_id])

  useEffect(() => {
    if (loading || !doctor?.doctor_id) return
    setState((current) => ({ ...current, loading: true }))
    refresh()
  }, [doctor?.doctor_id, loading, refresh])

  return {
    doctor,
    loading: loading || state.loading,
    availability: state.availability,
    sessionCount: state.sessionCount,
    profile: doctorProfileComplete(doctor),
    revisitReady: state.revisitReady,
    refresh,
  }
}

export function SetupSpinner() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600/20 border-t-teal-600" />
    </div>
  )
}

/**
 * Dashboard-side gate: bounces a half-set-up doctor back into the onboarding
 * flow. The onboarding shell does its own routing (it needs the same status for
 * its stepper), so it uses `useDoctorSetupStatus` directly instead of this.
 */
export default function DoctorSetupGate({ children }) {
  const { doctor, loading, availability, profile, revisitReady } = useDoctorSetupStatus()
  if (loading) return <SetupSpinner />
  // Not a redirect: this user is authenticated, so /doctor-login would bounce
  // them straight back here.
  if (!doctor) return <DoctorNotLinked />
  if (!availability) return <Navigate to="/doctor-onboarding/availability" replace />
  if (!profile) return <Navigate to="/doctor-onboarding/profile" replace />
  if (!revisitReady) return <Navigate to="/doctor-onboarding/profile" replace />
  return children
}
