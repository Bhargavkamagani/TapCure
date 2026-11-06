import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2, RefreshCw, Search, CheckCircle2, Clock, XCircle, Mail, Phone, MapPin,
  Hash, ChevronDown, Stethoscope, Ticket, IndianRupee, ExternalLink, FileText, Ban, RotateCcw, Users,
  X, GraduationCap, Briefcase, ChevronRight,
} from 'lucide-react'
import { hospitalsApi, doctorsApi, reportsApi, subscriptionsApi, fileUrl } from '../../api'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import HospitalRegistrationDetails from '../../components/admin/HospitalRegistrationDetails.jsx'
import SuspendDialog from '../../components/admin/SuspendDialog.jsx'
import DoctorDetailsModal from '../../components/admin/DoctorDetailsModal.jsx'
import HospitalPlan from '../../components/admin/HospitalPlan.jsx'

/**
 * Super-Admin hospital register — every tenant on the platform in any state, with
 * the registration details they submitted and this month's activity.
 *
 * The Approvals screen only lists `pending` hospitals, so once approved there was
 * nowhere to look a hospital up again. Composed from existing endpoints:
 *   GET /hospitals             every tenant (super admin sees all)
 *   GET /reports/super-admin   per-hospital tokens / revenue this month
 *   GET /doctors               doctor counts, to show hospital size
 */

const STATE = {
  active: { label: 'Active', icon: CheckCircle2, pill: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  pending: { label: 'Pending', icon: Clock, pill: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  suspended: { label: 'Suspended', icon: XCircle, pill: 'bg-red-100 text-red-600', dot: 'bg-red-500' },
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
]

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function AdminHospitals() {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({})
  const [docCounts, setDocCounts] = useState({})
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [detailsId, setDetailsId] = useState(null)   // hospital whose full registration is open
  const [suspendOf, setSuspendOf] = useState(null)   // hospital being suspended / reactivated
  const [loading, setLoading] = useState(true)
  const [docsOpenId, setDocsOpenId] = useState(null)   // hospital whose doctor list is shown
  const [doctorsOf, setDoctorsOf] = useState({})       // hospital_id -> { loading, list, error }
  const [doctorDetailsId, setDoctorDetailsId] = useState(null)   // doctor open in the details window

  // Fetched per hospital on demand: the page-level GET /doctors is paged (50),
  // so it can't be relied on for a complete list.
  const loadDoctors = useCallback(async (hid) => {
    setDoctorsOf((m) => ({ ...m, [hid]: { loading: true, list: m[hid]?.list || [] } }))
    try {
      const list = await doctorsApi.list({ hospital_id: hid, size: 200 })
      setDoctorsOf((m) => ({ ...m, [hid]: { loading: false, list: list || [] } }))
      setDocCounts((c) => ({ ...c, [hid]: (list || []).length }))   // exact, unlike the paged total
    } catch {
      setDoctorsOf((m) => ({ ...m, [hid]: { loading: false, list: [], error: true } }))
    }
  }, [])

  const toggleDoctors = useCallback((hid) => {
    if (docsOpenId === hid) { setDocsOpenId(null); return }
    setDocsOpenId(hid)
    loadDoctors(hid)
  }, [docsOpenId, loadDoctors])

  const load = useCallback(async () => {
    setLoading(true)
    setDoctorsOf({})
    const [hs, rep, docs] = await Promise.all([
      hospitalsApi.list().catch(() => []),
      reportsApi.superAdmin().catch(() => null),
      doctorsApi.list().catch(() => []),
    ])
    setRows(hs || [])
    setStats(Object.fromEntries((rep?.hospitals || []).map((r) => [r.hospital_id, r])))
    const counts = {}
    ;(docs || []).forEach((d) => { counts[d.hospital_id] = (counts[d.hospital_id] || 0) + 1 })
    setDocCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((h) => {
      if (filter !== 'all' && h.status !== filter) return false
      if (!term) return true
      return [h.name, h.city, h.email, h.phone, h.short_code, h.hfr_id]
        .some((v) => (v || '').toLowerCase().includes(term))
    })
  }, [rows, filter, q])

  const counts = useMemo(
    () => rows.reduce((a, h) => ({ ...a, [h.status]: (a[h.status] || 0) + 1 }), {}),
    [rows]
  )

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-brand-navy">Hospitals</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every hospital registered on TapCure — approved, pending or suspended.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthEndButton />
          <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:border-slate-300 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = f.key === 'all' ? rows.length : counts[f.key] || 0
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                active ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-brand-blue/40 hover:text-brand-blue'
              }`}
            >
              {f.label} <span className={active ? 'text-white/70' : 'text-slate-400'}>· {n}</span>
            </button>
          )
        })}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search hospital, city, code…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13.5px] outline-none focus:border-brand-blue"
          />
        </div>
      </div>

      {loading && <p className="py-10 text-center text-sm text-slate-400">Loading…</p>}
      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
          <Building2 className="mx-auto mb-2 h-7 w-7 text-slate-300" />
          <p className="text-sm text-slate-500">No hospitals match this filter.</p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {!loading && visible.map((h) => {
          const st = STATE[h.status] || STATE.pending
          const StIcon = st.icon
          const open = openId === h.hospital_id
          const s = stats[h.hospital_id] || {}
          return (
            <div key={h.hospital_id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
              <button
                onClick={() => setOpenId(open ? null : h.hospital_id)}
                className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-slate-50/70"
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-blueLight text-brand-blue">
                  {h.logo_url
                    ? <img src={fileUrl(h.logo_url)} alt="" className="h-full w-full object-cover" />
                    : <Building2 className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-brand-navy">{h.name}</p>
                  <p className="truncate text-[12.5px] text-slate-500">
                    {h.city || 'City not set'} · <span className="font-mono">{h.short_code}</span>
                  </p>
                </div>
                <span className="hidden shrink-0 items-center gap-1 text-[12px] font-semibold text-slate-400 md:inline-flex">
                  <Stethoscope className="h-3.5 w-3.5" /> {docCounts[h.hospital_id] || 0}
                </span>
                <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold sm:inline-flex ${st.pill}`}>
                  <StIcon className="h-3.5 w-3.5" /> {st.label}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Registration details</p>
                        <div className="flex flex-col items-end gap-1.5">
                          <button type="button" onClick={() => setDetailsId(h.hospital_id)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline">
                            <FileText className="h-3.5 w-3.5" /> View all details
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDoctors(h.hospital_id)}
                            aria-expanded={docsOpenId === h.hospital_id}
                            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline"
                          >
                            <Users className="h-3.5 w-3.5" />
                            {docsOpenId === h.hospital_id ? 'Hide doctors' : 'View doctors'}
                            <span className="rounded-full bg-brand-blueLight px-1.5 text-[11px] font-bold">{docCounts[h.hospital_id] || 0}</span>
                          </button>
                        </div>
                      </div>
                      <dl className="space-y-1.5 text-[13px]">
                        <Row icon={Hash} label="Short code" value={h.short_code} />
                        <Row icon={Hash} label="HFR ID" value={h.hfr_id} />
                        <Row icon={Hash} label="GSTIN" value={h.gstin} />
                        <Row icon={Mail} label="Email" value={h.email} />
                        <Row icon={Phone} label="Phone" value={h.phone} />
                        <Row icon={MapPin} label="Address" value={[h.address, h.city, h.pincode].filter(Boolean).join(', ')} />
                      </dl>
                      {h.latitude != null && h.longitude != null && (
                        <a
                          href={`https://www.google.com/maps?q=${h.latitude},${h.longitude}`}
                          target="_blank" rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-blue hover:underline"
                        >
                          <MapPin className="h-3.5 w-3.5" /> View on map <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">This month</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Stat icon={Ticket} label="Tokens" value={s.total_tokens || 0} />
                        <Stat icon={CheckCircle2} label="Completed" value={s.completed || 0} />
                        <Stat icon={IndianRupee} label="Hospital earned" value={inr(s.hospital_revenue)} />
                      </div>
                      {/* Patient booking fee removed. Previous row:
                      <div className="mt-2 flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-[12.5px]">
                        <span className="text-teal-800">Booking fees to TapCure</span>
                        <span className="font-bold text-teal-900">{inr(s.platform_revenue)}</span>
                      </div> */}
                    </div>
                  </div>
                  {docsOpenId === h.hospital_id && (
                    <HospitalDoctors
                      hospitalName={h.name}
                      state={doctorsOf[h.hospital_id]}
                      onView={setDoctorDetailsId}
                      onRetry={() => loadDoctors(h.hospital_id)}
                      onClose={() => setDocsOpenId(null)}
                    />
                  )}
                  {h.status !== 'pending' && <HospitalPlan hospitalId={h.hospital_id} />}
                  {/* Pending hospitals are approved/rejected on Approvals, not suspended. */}
                  {h.status !== 'pending' && (
                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                      {h.status === 'suspended' ? (
                        <button type="button" onClick={() => setSuspendOf(h)} className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50">
                          <RotateCcw className="h-4 w-4" /> Reactivate hospital
                        </button>
                      ) : (
                        <button type="button" onClick={() => setSuspendOf(h)} className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-50">
                          <Ban className="h-4 w-4" /> Suspend hospital
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* View only here; approving stays on the Approvals screen. */}
      {detailsId != null && (
        <HospitalRegistrationDetails hospitalId={detailsId} onClose={() => setDetailsId(null)} />
      )}
      {doctorDetailsId != null && (
        <DoctorDetailsModal doctorId={doctorDetailsId} onClose={() => setDoctorDetailsId(null)} />
      )}
      {suspendOf && (
        <SuspendDialog
          kind="hospital"
          id={suspendOf.hospital_id}
          name={suspendOf.name}
          suspended={suspendOf.status === 'suspended'}
          onClose={() => setSuspendOf(null)}
          onDone={load}
        />
      )}
    </div>
  )
}

/** Month-end billing by hand. Normally the 1st-of-month job does this; it's
 *  safe to repeat — each hospital gets one invoice per month. */
function MonthEndButton() {
  const dialog = useDialog()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    const ok = await dialog.confirm({
      title: 'Run month-end billing',
      message: "Make last month's invoices, charge hospitals on autopay, renew yearly plans and mark unpaid invoices overdue?",
      tone: 'info', confirmLabel: 'Run now',
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await subscriptionsApi.runMonthEnd()
      await dialog.alert({
        title: `Billing for ${r.month}`, tone: 'success',
        message: `${r.invoices.length} invoice(s), ${r.autopay_charged.length} charged by autopay, ${r.autopay_failed.length} autopay failed, ${r.yearly_renewals.length} yearly renewal(s).`,
      })
    } catch (e) {
      await dialog.alert({ title: 'Billing run failed', message: e?.message || 'Please try again.', tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <button onClick={run} disabled={busy} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:border-slate-300 disabled:opacity-50">
      <IndianRupee className="h-4 w-4" /> {busy ? 'Running…' : 'Month-end billing'}
    </button>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <dt className="w-24 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-brand-navy">{value || '—'}</dd>
    </div>
  )
}

// Suspension overrides everything; otherwise an unverified self-registration
// is shown as such, and a verified doctor by whether they're switched on.
const DOC_STATE = {
  suspended: { label: 'Suspended', pill: 'bg-slate-200 text-slate-700' },
  pending: { label: 'Pending verification', pill: 'bg-amber-100 text-amber-700' },
  rejected: { label: 'Rejected', pill: 'bg-red-100 text-red-600' },
  active: { label: 'Active', pill: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inactive', pill: 'bg-red-100 text-red-600' },
  on_leave: { label: 'On leave', pill: 'bg-amber-100 text-amber-700' },
}
const docStateOf = (d) => {
  if (d.status === 'suspended') return DOC_STATE.suspended
  if (d.verification_status !== 'verified') return DOC_STATE[d.verification_status] || DOC_STATE.pending
  return DOC_STATE[d.status] || DOC_STATE.active
}

const initialsOf = (name) =>
  (name || '').replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'DR'

function HospitalDoctors({ hospitalName, state, onView, onRetry, onClose }) {
  const { loading = true, list = [], error } = state || {}
  const [q, setQ] = useState('')
  const [stFilter, setStFilter] = useState('all')
  const panelRef = useRef(null)

  // Bring the panel into view when it opens — it renders below the fold on small screens.
  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  // Status chips only for states that actually occur at this hospital.
  const chips = useMemo(() => {
    const byLabel = {}
    list.forEach((d) => {
      const st = docStateOf(d)
      byLabel[st.label] = (byLabel[st.label] || 0) + 1
    })
    return Object.entries(byLabel)
  }, [list])

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return list.filter((d) => {
      if (stFilter !== 'all' && docStateOf(d).label !== stFilter) return false
      if (!term) return true
      return [d.name, d.specialization, d.qualification, d.registration_number]
        .some((v) => (v || '').toLowerCase().includes(term))
    })
  }, [list, q, stFilter])

  return (
    <div ref={panelRef} className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-brand-blueLight/60 to-white px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-white">
          <Stethoscope className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold text-brand-navy">Doctors at {hospitalName}</p>
          <p className="text-[12px] text-slate-500">
            {loading ? 'Loading…' : error ? 'Could not load' : `${list.length} doctor${list.length === 1 ? '' : 's'} registered`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close doctor list"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4">
        {/* Filters */}
        {!loading && !error && list.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {[['all', list.length], ...chips].map(([label, n]) => {
              const active = stFilter === label
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStFilter(label)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
                    active ? 'bg-brand-navy text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {label === 'all' ? 'All' : label} <span className={active ? 'text-white/70' : 'text-slate-400'}>· {n}</span>
                </button>
              )
            })}
            {list.length > 4 && (
              <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, specialty, reg. no…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-[12.5px] outline-none focus:border-brand-blue"
                />
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                    <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="mt-3 h-6 rounded bg-slate-50" />
              </li>
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            Couldn&apos;t load the doctors for this hospital.
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:bg-red-50">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {!loading && !error && list.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
            <Users className="mx-auto mb-2 h-7 w-7 text-slate-300" />
            <p className="text-[13px] text-slate-500">No doctors registered under this hospital yet.</p>
          </div>
        )}

        {!loading && !error && list.length > 0 && shown.length === 0 && (
          <p className="py-6 text-center text-[12.5px] text-slate-400">No doctors match this filter.</p>
        )}

        {!loading && !error && shown.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((d) => {
              const st = docStateOf(d)
              return (
                <li key={d.doctor_id}>
                  <button
                    type="button"
                    onClick={() => onView(d.doctor_id)}
                    className="group flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:-translate-y-0.5 hover:border-brand-blue/50 hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-blueLight text-[14px] font-bold text-brand-blue">
                        {d.profile_photo_url
                          ? <img src={fileUrl(d.profile_photo_url)} alt="" className="h-full w-full object-cover" />
                          : initialsOf(d.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-brand-navy">{d.name}</span>
                        <span className="block truncate text-[12px] font-medium text-brand-blue">{d.specialization || 'General Physician'}</span>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${st.pill}`}>{st.label}</span>
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px] text-slate-600">
                      {d.qualification && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
                          <GraduationCap className="h-3 w-3 text-slate-400" /> {d.qualification}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
                        <Briefcase className="h-3 w-3 text-slate-400" /> {d.experience_years || 0} yrs exp
                      </span>
                      {Number(d.consultation_fee) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1">
                          <IndianRupee className="h-3 w-3 text-slate-400" /> {inr(d.consultation_fee)} consult
                        </span>
                      )}
                    </div>

                    <div className="mt-auto w-full pt-3">
                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11.5px]">
                        <span className="truncate text-slate-400">
                          {d.registration_number ? `Reg. ${d.registration_number}` : 'Reg. no. not added'}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-brand-blue">
                          View details <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-center">
      <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-slate-400" />
      <p className="text-[15px] font-extrabold leading-none tabular-nums text-brand-navy">{value}</p>
      <p className="mt-1 text-[10.5px] text-slate-400">{label}</p>
    </div>
  )
}
