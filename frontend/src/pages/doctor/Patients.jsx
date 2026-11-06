import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, UserPlus, Users, UserCheck, Eye, FileText, X, Pill, RefreshCw } from 'lucide-react'
import { Card, StatCard, StatusBadge, PageHeading, Avatar } from '../../components/hospital/ui.jsx'
import PatientHistoryDrawer from '../../components/patient/PatientHistoryDrawer.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { ageSex } from '../../lib/format.js'
import { patientsApi, prescriptionsApi } from '../../api'
import RxPaper from '../../components/common/RxPaper.jsx'

function PrescriptionViewer({ patient, prescriptions, onClose }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-slate-100 p-4 shadow-xl sm:p-5" onClick={(e) => e.stopPropagation()}>
      <div className="mb-4 flex items-start justify-between"><div><p className="text-xs font-bold uppercase text-brand-blue">Prescriptions given</p><h2 className="text-xl font-bold text-brand-navy">{patient.name}</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div>
      <div className="space-y-5">{prescriptions.map((rx) => <div key={rx.prescription_id}>{rx.family_member_name && <p className="mb-1.5 text-xs font-semibold text-violet-700">For {rx.family_member_name}</p>}<RxPaper rx={rx} /></div>)}</div>
    </div>
  </div>
}
const PAGE_SIZE = 50

function Patients() {
  const { doctorId, cachePatients } = useDoctorCtx()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [prescriptions, setPrescriptions] = useState([])
  const [rxPatient, setRxPatient] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  /* The list is whatever the SERVER has answered so far, not a copy of every
     patient. GET /patients already narrows a doctor to people who have had an
     appointment with them, newest first, and does the searching — so this page
     holds one page at a time and asks for more.
     It used to download up to 25 pages of 200 at login and filter in the
     browser: past 5,000 patients the rest simply did not exist as far as this
     page was concerned — a doctor searching for patient 5,001 was told nobody
     matched. Typing now asks the server, so there is no ceiling. */
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPage = useCallback(async (nextPage, term, { append }) => {
    const batch = await patientsApi.list({ page: nextPage, size: PAGE_SIZE, search: term || undefined })
    const list = batch || []
    setRows((prev) => (append ? [...prev, ...list] : list))
    setPage(nextPage)
    setMore(list.length === PAGE_SIZE)
    // Feed the console's shared cache, so a name this page has seen is
    // available to the appointment and cancellation tables too.
    cachePatients(list)
  }, [cachePatients])

  const refresh = useCallback(async (term = q) => {
    setRefreshing(true)
    setError(null)
    try {
      await Promise.all([
        fetchPage(1, term, { append: false }),
        prescriptionsApi.list()
          .then((items) => setPrescriptions((items || []).filter((rx) => !doctorId || String(rx.doctor_id) === String(doctorId))))
          .catch(() => setPrescriptions([])),
      ])
    } catch (e) {
      setError(e.message || 'Could not load patients')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [doctorId, fetchPage, q])

  // Typing waits for a pause before asking the server — a request per keystroke
  // would be one per letter of a name.
  useEffect(() => {
    const id = setTimeout(() => { refresh(q) }, q ? 350 : 0)
    return () => clearTimeout(id)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    setRefreshing(true)
    try { await fetchPage(page + 1, q, { append: true }) } catch (e) { setError(e.message) } finally { setRefreshing(false) }
  }

  const prescriptionsFor = (patientId) => prescriptions.filter((rx) => String(rx.patient_id) === String(patientId))

  const registered = rows.filter((p) => p.is_registered).length

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Your Patients" subtitle="People who have had an appointment with you, most recent first. Search covers every one of them, not just those shown.">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient…"
              className="w-44 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => refresh(q)}
            disabled={refreshing}
            title="Refresh patient list"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </PageHeading>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* "Shown", not "Total": the page holds the rows fetched so far, and a
            tile reading 50 while the doctor has 4,000 patients would be a
            plain lie. The real total needs a count from the server. */}
        <StatCard value={rows.length} label={more ? 'Shown so far' : 'Patients'} icon={Users} tone="blue" />
        <StatCard value={registered} label="Registered" icon={UserCheck} tone="green" />
        <StatCard value={rows.length - registered} label="Walk-in" icon={UserPlus} tone="purple" />
      </div>

      <Card>
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[12px] font-semibold text-slate-400">
              <th className="pb-3 pr-4">Patient</th><th className="pb-3 pr-4">Age / Gender</th><th className="pb-3 pr-4">Mobile</th>
              <th className="pb-3 pr-4">City</th><th className="pb-3 pr-4">Source</th><th className="pb-3 pr-4">Prescriptions</th><th className="pb-3">Tag</th>
            </tr>
          </thead>
          <tbody className="text-[13.5px]">
            {rows.map((p) => (
              <tr key={p.patient_id} onClick={() => setSelected(p)} className="cursor-pointer border-t border-slate-50 hover:bg-slate-50/70">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.name} className="h-9 w-9 text-xs" />
                    <div className="leading-tight">
                      <span className="font-medium text-brand-navy">{p.name}</span>
                      {p.uhid && <p className="font-mono text-[11px] font-semibold text-brand-blue">{p.uhid}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 text-slate-500">{ageSex(p)}</td>
                <td className="py-3 pr-4 text-slate-500">{p.phone}</td>
                <td className="py-3 pr-4 text-slate-500">{p.city || '—'}</td>
                <td className="py-3 pr-4 text-slate-500 capitalize">{p.registration_source}</td>
                <td className="py-3 pr-4">
                  {prescriptionsFor(p.patient_id).length ? <button type="button" onClick={(e) => { e.stopPropagation(); setRxPatient(p) }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-brand-blue hover:bg-blue-100"><Eye size={14} /> View ({prescriptionsFor(p.patient_id).length})</button> : <span className="inline-flex items-center gap-1 text-xs text-slate-400"><FileText size={14} /> None</span>}
                </td>
                <td className="py-3"><StatusBadge status={p.is_registered ? 'Registered' : 'Walk-in'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {error && <p className="py-4 text-center text-sm text-red-500">{error}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {q ? `No patient matches “${q}”.` : 'No patients yet — they appear here once you have an appointment with them.'}
          </p>
        ) : null}
        {/* More to fetch: the last answer was a full page, so there is at least
            one more. Deliberately a button rather than scroll-loading — a
            doctor looking for one person searches, and endless scrolling on a
            list this long is a worse way to find anybody. */}
        {more && !loading && (
          <div className="border-t border-slate-50 pt-3 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {refreshing ? 'Loading…' : `Show ${PAGE_SIZE} more`}
            </button>
          </div>
        )}
      </Card>

      <AnimatePresence>
        {selected && <PatientHistoryDrawer patient={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
      {rxPatient && <PrescriptionViewer patient={rxPatient} prescriptions={prescriptionsFor(rxPatient.patient_id)} onClose={() => setRxPatient(null)} />}
    </div>
  )
}

export default Patients
