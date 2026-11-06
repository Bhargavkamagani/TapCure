import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, UserPlus, RefreshCw, X, Phone, User, MapPin, Droplet, Calendar, ChevronLeft, ChevronRight, Filter, Eye, Fingerprint, Pencil, Home, Pill } from 'lucide-react'
import { Card, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import { TextInput } from '../../components/common/FormControls.jsx'
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx'
import PatientHistoryDrawer from '../../components/patient/PatientHistoryDrawer.jsx'
import { patientsApi, prescriptionsApi } from '../../api'
import RxPaper from '../../components/common/RxPaper.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { abhaDigits, abhaError } from '../../lib/abha.js'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { toMobile } from '../../lib/phone.js'
import { nameFields, nameParts } from '../../lib/personName.js'

const SOURCE_PILL = {
  walkin: 'bg-slate-100 text-slate-600',
  app: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  csc: 'bg-purple-100 text-purple-600',
  phone: 'bg-orange-100 text-orange-600',
}
const SOURCE_LABEL = { walkin: 'Walk-in', app: 'App', whatsapp: 'WhatsApp', csc: 'CSC', phone: 'Phone' }
const PAGE_SIZE = 12

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

/* ---------------- Prescriptions modal ----------------
   Read-only on purpose. The desk needs to see what the doctor wrote — to
   print it, or to answer "what did he give me?" at the counter — but writing
   a prescription is the doctor's act, not the front desk's. */
function PrescriptionsModal({ patient, onClose }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let active = true
    prescriptionsApi.forPatient(patient.patient_id)
      .then((list) => {
        if (!active) return
        // Newest first — the desk almost always wants the latest visit.
        setRows([...(list || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)))
      })
      .catch((e) => active && setErr(e.message || 'Could not load prescriptions'))
    return () => { active = false }
  }, [patient.patient_id])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50 to-emerald-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <Pill className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h3 className="text-[15px] font-bold text-slate-800">Prescriptions</h3>
              <p className="text-[12px] text-slate-500">
                {patient.name}{patient.uhid ? ` · ${patient.uhid}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {err ? (
            <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-600">{err}</p>
          ) : rows === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-teal-500 border-t-transparent" />
              Loading prescriptions…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Pill className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">No prescriptions for this patient yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((rx) => (
                <div key={rx.prescription_id}>
                  {/* An Rx written for a dependent must say so, or the desk
                      hands the wrong person's medicines over the counter. */}
                  {rx.family_member_name && <p className="mb-1.5 text-[12px] font-semibold text-violet-700">For {rx.family_member_name}</p>}
                  <RxPaper rx={rx} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-3 text-right">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ---------------- Add Patient modal ---------------- */
function AddPatientModal({ hospitalId, onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', gender: 'Male', age: '', blood_group: '', city: '', abha_number: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'phone' ? toMobile(e.target.value) : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!form.first_name.trim()) er.first_name = 'Required'
    if (!/^\d{10}$/.test(form.phone)) er.phone = 'Enter a valid 10-digit number'
    const digits = abhaDigits(form.abha_number)
    if (abhaError(form.abha_number)) er.abha_number = 'ABHA must be 14 digits (or leave blank)'
    setErrors(er)
    if (Object.keys(er).length) return
    setBusy(true)
    setErr(null)
    try {
      await patientsApi.create({
        hospital_id: hospitalId,
        ...nameFields(form.first_name, form.last_name),
        phone: form.phone,
        gender: form.gender,
        age: form.age ? Number(form.age) : undefined,
        blood_group: form.blood_group || undefined,
        city: form.city,
        abha_number: digits || undefined,
        registration_source: 'walkin',
      })
      onAdded()
    } catch (e2) {
      setErr(e2.message || 'Could not register patient')
    }
    setBusy(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-[460px] rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Add Patient</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="col-span-full grid grid-cols-2 gap-3"><TextInput icon={User} placeholder="First Name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} /><TextInput placeholder="Last Name / initial (optional)" value={form.last_name} onChange={set('last_name')} /></div>
          <TextInput icon={Phone} prefix="+91" placeholder="Mobile Number" inputMode="numeric" value={form.phone} onChange={set('phone')} error={errors.phone} />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.gender} onChange={set('gender')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy">
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
            <input type="number" placeholder="Age" value={form.age} onChange={set('age')} onWheel={(e) => e.currentTarget.blur()} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy" />
            <select value={form.blood_group} onChange={set('blood_group')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy">
              <option value="">Blood</option>
              {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <TextInput icon={MapPin} placeholder="City / Village" value={form.city} onChange={set('city')} />
          <TextInput icon={Fingerprint} placeholder="ABHA Number (optional)" inputMode="numeric" maxLength={17} value={form.abha_number} onChange={set('abha_number')} error={errors.abha_number} />
          <p className="-mt-1.5 px-1 text-[11px] text-slate-400">14-digit Ayushman Bharat health ID · leave blank if none</p>
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
            {busy ? 'Saving…' : 'Register Patient'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}


/* ---------------- Edit Patient modal ----------------
 * The front desk owns these demographics — a walk-in registered in a hurry
 * routinely needs gender/blood group/city corrected later. Mobile number is
 * deliberately absent: it's the patient's identity key here
 * (uq_patient_hospital_phone) and PatientUpdate doesn't accept it.
 */
function EditPatientModal({ patient, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: nameParts(patient).first,
    last_name: nameParts(patient).last,
    gender: patient.gender || '',
    age: patient.age ?? '',
    blood_group: patient.blood_group || '',
    city: patient.city || '',
    address: patient.address || '',
    pincode: patient.pincode || '',
    abha_number: patient.abha_number || '',
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!form.first_name.trim()) er.first_name = 'Required'
    if (abhaError(form.abha_number)) er.abha_number = 'ABHA must be 14 digits (or leave blank)'
    setErrors(er)
    if (Object.keys(er).length) return
    setBusy(true)
    setErr(null)
    try {
      // Send blanks as null so clearing a field actually clears it — dropping
      // empty values would make blood group / city impossible to un-set.
      const blank = (v) => (v === '' ? null : v)
      const updated = await patientsApi.update(patient.patient_id, {
        ...nameFields(form.first_name, form.last_name),
        gender: blank(form.gender),
        age: form.age === '' ? null : Number(form.age),
        blood_group: blank(form.blood_group),
        city: form.city,
        address: form.address,
        pincode: form.pincode,
        abha_number: abhaDigits(form.abha_number) || null,
      })
      onSaved(updated)
    } catch (e2) {
      setErr(e2.message || 'Could not save changes')
    }
    setBusy(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="max-h-[92vh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Edit Patient</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 font-mono text-[11.5px] font-semibold text-brand-blue">
          {patient.uhid || `PID #${patient.patient_id}`} · +91 {patient.phone}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="col-span-full grid grid-cols-2 gap-3"><TextInput icon={User} placeholder="First Name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} /><TextInput placeholder="Last Name / initial (optional)" value={form.last_name} onChange={set('last_name')} /></div>
          <div className="grid grid-cols-3 gap-3">
            <select value={form.gender} onChange={set('gender')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy">
              <option value="">Gender</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
            <input type="number" placeholder="Age" value={form.age} onChange={set('age')} onWheel={(e) => e.currentTarget.blur()} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy" />
            <select value={form.blood_group} onChange={set('blood_group')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy">
              <option value="">Blood</option>
              {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <TextInput icon={MapPin} placeholder="City / Village" value={form.city} onChange={set('city')} />
          <TextInput icon={Home} placeholder="Address" value={form.address} onChange={set('address')} />
          <TextInput placeholder="Pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={set('pincode')} />
          <TextInput icon={Fingerprint} placeholder="ABHA Number (optional)" inputMode="numeric" maxLength={17} value={form.abha_number} onChange={set('abha_number')} error={errors.abha_number} />
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button disabled={busy} className="flex-1 rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

/* ---------------- Page ---------------- */
export default function AssistantPatients() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState('')
  const [blood, setBlood] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(null)
  const [rxFor, setRxFor] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setErr(null)
    try {
      // Every filter goes to the server. Refining the loaded page client-side
      // meant a filter could only ever see 12 rows, so "Female" on page 1
      // reported "No patients found" while matches sat on page 3.
      setRows(await patientsApi.list({
        search: search.trim() || undefined,
        gender: gender || undefined,
        blood_group: blood || undefined,
        page,
        size: PAGE_SIZE,
      }))
    } catch (e) {
      setErr(e.message)
    }
    if (!silent) setLoading(false)
  }, [search, gender, blood, page])
  useEffect(() => { load() }, [load])

  // A patient registered at the walk-in desk (or by a colleague on the next
  // machine) shows up here without a reload. Paused whenever a modal is open —
  // nobody wants the row behind their edit swapped mid-keystroke.
  useAutoRefresh(() => load({ silent: true }), {
    paused: showAdd || !!profile || !!editing || !!rxFor,
  })

  const filtered = rows

  const resetFilters = () => { setSearch(''); setGender(''); setBlood(''); setPage(1) }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        title="Patient List"
        subtitle="View and manage all registered patients."
      >
        <ToolButton icon={RefreshCw} onClick={load}>Refresh</ToolButton>
        <ToolButton icon={UserPlus} tone="primary" onClick={() => setShowAdd(true)}>Add Patient</ToolButton>
      </PageHeading>

      {/* Filter bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search by name, mobile or UHID…"
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <select value={gender} onChange={(e) => { setGender(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
            <option value="">All Genders</option><option>Male</option><option>Female</option><option>Other</option>
          </select>
          <select value={blood} onChange={(e) => { setBlood(e.target.value); setPage(1) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600">
            <option value="">All Blood Groups</option>
            {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((b) => <option key={b}>{b}</option>)}
          </select>
          <button onClick={resetFilters} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
            <Filter className="h-4 w-4" /> Reset
          </button>
        </div>
      </Card>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      {/* Table */}
      <Card className="!p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          {/* This is the page's rows, not the hospital's total — say so, rather
              than letting "All Patients (12)" read as "you have 12 patients". */}
          <h3 className="text-[15px] font-bold text-brand-navy">
            {gender || blood || search.trim() ? 'Matching Patients' : 'All Patients'}
            <span className="ml-1 font-semibold text-slate-400">
              · showing <AnimatedNumber value={filtered.length} />{page > 1 ? ` on page ${page}` : ''}
            </span>
          </h3>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Loading patients…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No patients found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5">Patient</th>
                  <th className="px-3 py-2.5">Age / Gender</th>
                  <th className="px-3 py-2.5">Mobile</th>
                  <th className="px-3 py-2.5">Blood</th>
                  <th className="px-3 py-2.5">City</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Registered</th>
                  <th className="px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-[13px]">
                <AnimatePresence initial={false}>
                  {filtered.map((p, i) => (
                    <motion.tr
                      key={p.patient_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.4) }}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.name} className="h-9 w-9 text-[11px]" />
                          <div className="leading-tight">
                            <p className="font-bold text-brand-navy">{p.name}</p>
                            <p className="font-mono text-[11px] font-semibold text-brand-blue">{p.uhid || `PID #${p.patient_id}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{[p.age && `${p.age}y`, p.gender].filter(Boolean).join(' · ') || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500">{p.phone}</td>
                      <td className="px-3 py-2.5">
                        {p.blood_group ? <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-red-500">{p.blood_group}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{p.city || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_PILL[p.registration_source] || 'bg-slate-100 text-slate-500'}`}>
                          {SOURCE_LABEL[p.registration_source] || p.registration_source}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{fmtDate(p.created_at)}</td>
                      <td className="px-5 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <motion.button
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setProfile(p)}
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-blueLight px-2.5 py-1.5 text-[12px] font-semibold text-brand-blue hover:bg-blue-100"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setRxFor(p)}
                            title="Prescriptions written for this patient"
                            className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-[12px] font-semibold text-teal-700 hover:bg-teal-100"
                          >
                            <Pill className="h-3.5 w-3.5" /> Prescriptions
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                            onClick={() => setEditing(p)}
                            title="Edit patient details"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <span className="text-[12px] text-slate-400">Page {page}{rows.length < PAGE_SIZE ? ' · last' : ''}</span>
          <div className="flex gap-1.5">
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button disabled={rows.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {showAdd && (
          <AddPatientModal
            hospitalId={user?.hospital_id}
            onClose={() => setShowAdd(false)}
            onAdded={() => { setShowAdd(false); load() }}
          />
        )}
        {editing && (
          <EditPatientModal
            patient={editing}
            onClose={() => setEditing(null)}
            onSaved={(updated) => {
              // Patch the row in place — a full reload would drop the desk's
              // current search and page position.
              setRows((current) => current.map((r) => (r.patient_id === updated.patient_id ? updated : r)))
              setProfile((p) => (p && p.patient_id === updated.patient_id ? updated : p))
              setEditing(null)
            }}
          />
        )}
        {rxFor && <PrescriptionsModal patient={rxFor} onClose={() => setRxFor(null)} />}
        {profile && <PatientHistoryDrawer patient={profile} onClose={() => setProfile(null)} />}
      </AnimatePresence>
    </div>
  )
}
