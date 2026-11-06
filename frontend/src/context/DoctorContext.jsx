import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { doctorsApi, hospitalsApi, patientsApi } from '../api'
import { useAuth } from './AuthContext.jsx'

/**
 * Shared data for the doctor console, loaded once in <DoctorLayout/>:
 *  - `doctor`      : the logged-in doctor's own record (matched by user_id)
 *  - `hospital`    : their hospital
 *  - `doctorsById` : all doctors in the tenant (for the staff view)
 *  - `patientsById`: hospital patients (to resolve patient_id -> name on rows)
 *
 * A DOCTOR user has no "/doctors/me"; the doctor list is tenant-scoped, so we
 * find our own record by matching `user_id`. Pages read it via `useDoctorCtx()`.
 */
const DoctorContext = createContext(null)

export function DoctorProvider({ children }) {
  const { user } = useAuth()
  const [doctor, setDoctor] = useState(null)
  const [hospital, setHospital] = useState(null)
  const [doctorsById, setDoctorsById] = useState({})
  const [patientsById, setPatientsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * A NAME CACHE, not the patient list.
   *
   * One page of the doctor's most recent patients, kept so the appointment and
   * cancellation tables can put a name against a patient_id that their own row
   * did not carry. The Patients page does its own fetching and searching
   * against the server, and feeds what it sees back in through cachePatients.
   *
   * It used to page through up to 25 x 200 patients at login to build this —
   * 25 requests, 5,000 rows held in memory, repeated every time the doctor
   * came back to the tab. Worse, the Patients page filtered that copy, so a
   * doctor with more than 5,000 patients could not find the rest at all.
   *
   * Deliberately does NOT touch `loading` — a background refresh must not
   * blank out the page being read.
   */
  const loadPatients = useCallback(async () => {
    const rows = await patientsApi.list({ page: 1, size: 200 }).catch(() => [])
    setPatientsById(Object.fromEntries((rows || []).map((p) => [p.patient_id, p])))
    return rows || []
  }, [])

  /** Merge freshly fetched patients into the cache (used by the Patients page). */
  const cachePatients = useCallback((list) => {
    if (!list?.length) return
    setPatientsById((prev) => {
      const next = { ...prev }
      list.forEach((p) => { next[p.patient_id] = p })
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [doctors] = await Promise.all([
        doctorsApi.list().catch(() => []),
        loadPatients(),
      ])
      // Match by user_id ONLY. This used to fall back to `doctors[0]` when no
      // row matched, which silently adopted a colleague's identity: the whole
      // console — dashboard, queue, availability, profile — then belonged to
      // that other doctor, and the setup gate made its redirect decisions from
      // their data, so the console appeared to jump between logins. A login we
      // can't resolve is an error to surface, never a doctor to guess.
      const mine = user ? (doctors || []).find((d) => d.user_id === user.user_id) || null : null
      setDoctor(mine)
      setDoctorsById(Object.fromEntries((doctors || []).map((d) => [d.doctor_id, d])))
      if (mine?.hospital_id) {
        const h = await hospitalsApi.get(mine.hospital_id).catch(() => null)
        setHospital(h)
      }
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [user, loadPatients])

  useEffect(() => {
    load()
  }, [load])

  const resolvePatient = useCallback((id) => patientsById[id] || null, [patientsById])

  return (
    <DoctorContext.Provider
      value={{
        doctor,
        doctorId: doctor?.doctor_id,
        hospital,
        doctorsById,
        patientsById,
        resolvePatient,
        loading,
        error,
        reload: load,
        reloadPatients: loadPatients,
        cachePatients,
        setDoctor,
      }}
    >
      {children}
    </DoctorContext.Provider>
  )
}

export function useDoctorCtx() {
  const ctx = useContext(DoctorContext)
  if (!ctx) throw new Error('useDoctorCtx must be used inside <DoctorProvider>')
  return ctx
}
