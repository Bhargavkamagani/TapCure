import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, UserCheck, Plus, Search, RefreshCw, X, Mail, Phone, BadgeCheck, Briefcase, Trash2, CalendarDays, Pill, Boxes, Pencil, Stethoscope, Check } from 'lucide-react'
import { Card, StatusBadge, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import { RECEPTIONIST_AVATAR } from '../../lib/staffAvatar.js'
import { TextInput, PasswordInput } from '../../components/common/FormControls.jsx'
import { receptionApi, pharmacistsApi, doctorsApi } from '../../api'
import { emailTypoError } from '../../lib/emailTypos.js'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import { toMobile } from '../../lib/phone.js'
import { joinName, nameFields, nameParts } from '../../lib/personName.js'

const ROLES = {
  receptionist: { label: 'Receptionist', pill: 'bg-sky-50 text-sky-700' },
  pharmacist: { label: 'Pharmacist', pill: 'bg-emerald-50 text-emerald-700' },
}

/** One labelled fact on a staff card; `title` keeps the full value on hover. */
function Detail({ icon: Icon, label, value }) {
  const text = value == null || value === '' ? '—' : String(value)
  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <Icon className="mt-[3px] h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-[13px] font-bold text-brand-navy" title={text}>{text}</p>
      </div>
    </div>
  )
}

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

// No maxLength on the phone inputs: the browser would cut a pasted
// "+91 98765 43210" before toMobile could strip the prefix.

/**
 * Which doctors a receptionist handles. `value` is null for "all doctors"
 * (stored as an empty assignment) or an array of doctor_ids. A receptionist
 * limited to some doctors only sees those doctors in her console.
 */
function DoctorAssignment({ doctors, value, onChange, error }) {
  const [q, setQ] = useState('')
  const specific = value !== null
  const selected = new Set(value || [])
  const term = q.trim().toLowerCase()
  const shown = doctors.filter((d) =>
    !term || [d.name, d.specialization].some((v) => (v || '').toLowerCase().includes(term)))
  const toggle = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy">
          <Stethoscope className="h-4 w-4 text-slate-400" /> Assigned doctors
        </span>
        {specific && <span className="text-[13px] font-semibold text-brand-blue">{selected.size} selected</span>}
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {[[false, 'All doctors'], [true, 'Specific doctors']].map(([isSpecific, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(isSpecific ? (value || []) : null)}
            className={`rounded-md py-1.5 text-[13.5px] font-semibold transition-colors ${
              specific === isSpecific ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {!specific ? (
        <p className="text-[13px] text-slate-500">She sees every doctor&apos;s queue and appointments at this hospital.</p>
      ) : doctors.length === 0 ? (
        <p className="text-[13px] text-slate-400">No doctors at this hospital yet.</p>
      ) : (
        <>
          <p className="mb-2 text-[13px] text-slate-500">She only sees the queue, tokens and appointments of the doctors ticked here.</p>
          {doctors.length > 5 && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2.5">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search doctor or specialty…" className="w-full bg-transparent py-1.5 text-[13.5px] outline-none" />
            </div>
          )}
          <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {shown.map((d) => {
              const on = selected.has(d.doctor_id)
              return (
                <li key={d.doctor_id}>
                  <button
                    type="button"
                    onClick={() => toggle(d.doctor_id)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                      on ? 'border-brand-blue/50 bg-blue-50/60' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 bg-white'}`}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <Avatar name={d.name} className="h-7 w-7 shrink-0 text-[13px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-brand-navy">{d.name}</span>
                      <span className="block truncate text-[13px] text-slate-500">{d.specialization || 'General Physician'}</span>
                    </span>
                    {d.status && d.status !== 'active' && (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[13px] font-semibold capitalize text-slate-500">{d.status.replace('_', ' ')}</span>
                    )}
                  </button>
                </li>
              )
            })}
            {shown.length === 0 && <li className="py-2 text-center text-[13px] text-slate-400">No match.</li>}
          </ul>
        </>
      )}
      {error && <p className="mt-1.5 text-[13px] text-red-600">{error}</p>}
    </div>
  )
}

/** Short "who she handles" summary for a staff card. */
function assignedLabel(ids, doctorsById) {
  if (!ids || ids.length === 0) return 'All doctors'
  const names = ids.map((id) => doctorsById[id]?.name).filter(Boolean)
  if (names.length === 0) return `${ids.length} doctor${ids.length === 1 ? '' : 's'}`
  return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`
}

function AddStaffModal({ doctors, onClose, onAdded }) {
  const [role, setRole] = useState('receptionist')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', password: '', designation: 'Front Desk Executive', employee_id: '' })
  const [assigned, setAssigned] = useState(null)   // null = all doctors
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setPhone = (e) => setForm((f) => ({ ...f, phone: toMobile(e.target.value) }))
  const roleLabel = ROLES[role].label

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    const name = joinName(form.first_name, form.last_name)
    const email = form.email.trim()
    if (!form.first_name.trim()) er.first_name = 'Required'
    if (!form.last_name.trim()) er.last_name = 'Required (an initial is fine)'
    if (name.length > 100) er.first_name = 'Max 100 characters'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) er.email = 'Valid email required'
    else if (email.length > 100) er.email = 'Max 100 characters'
    // Staff sign in by email only, so a misspelt provider (gmial.com) is a
    // login nobody can ever use or reset — same check as the signup pages.
    else if (emailTypoError(email)) er.email = emailTypoError(email)
    if (form.phone && !/^\d{10}$/.test(form.phone)) er.phone = 'Enter a 10-digit mobile number'
    if (!form.password || form.password.length < 8) er.password = 'Min 8 characters'
    if (role === 'receptionist' && assigned !== null && assigned.length === 0) er.assigned = 'Tick at least one doctor, or choose All doctors'
    setErrors(er)
    if (Object.keys(er).length) return

    setBusy(true)
    setErr(null)
    const base = {
      ...nameFields(form.first_name, form.last_name),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      password: form.password,
      employee_id: form.employee_id.trim() || undefined,
    }
    try {
      if (role === 'pharmacist') {
        await pharmacistsApi.onboard(base)
      } else {
        await receptionApi.onboard({ ...base, designation: form.designation, doctors_assigned: assigned || [] })
      }
      onAdded()
    } catch (e2) {
      setErr(e2.message || 'Could not add staff member')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Add {roleLabel}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {Object.entries(ROLES).map(([key, r]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={`rounded-lg py-2 text-[13px] font-semibold transition-colors ${
                role === key ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-[13px] text-slate-500">
          {role === 'pharmacist'
            ? 'Uploads the pharmacy stock list. Doctors see it while prescribing.'
            : 'Runs the front desk: queue, walk-ins and appointments.'}
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="col-span-full grid grid-cols-2 gap-3"><TextInput icon={Users} placeholder="First Name" maxLength={100} value={form.first_name} onChange={set('first_name')} error={errors.first_name} /><TextInput placeholder="Last Name / initial" maxLength={100} value={form.last_name} onChange={set('last_name')} error={errors.last_name} /></div>
          <TextInput icon={Mail} placeholder="Email (used to log in)" maxLength={100} value={form.email} onChange={set('email')} error={errors.email} />
          {role === 'receptionist' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextInput prefix="+91" placeholder="Mobile (10 digits)" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={setPhone} error={errors.phone} />
                <TextInput icon={BadgeCheck} placeholder="Employee ID (optional)" value={form.employee_id} onChange={set('employee_id')} />
              </div>
              <TextInput icon={Briefcase} placeholder="Designation" value={form.designation} onChange={set('designation')} />
              <DoctorAssignment doctors={doctors} value={assigned} onChange={setAssigned} error={errors.assigned} />
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <TextInput prefix="+91" placeholder="Mobile (optional)" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={setPhone} error={errors.phone} />
              <TextInput icon={BadgeCheck} placeholder="Employee ID (optional)" maxLength={50} value={form.employee_id} onChange={set('employee_id')} />
            </div>
          )}
          <PasswordInput icon={undefined} placeholder="Temporary password" value={form.password} onChange={set('password')} error={errors.password} />
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
            {busy ? 'Adding…' : `Add ${roleLabel}`}
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * Edit a staff member. Mostly used for a hand-over: someone leaves and the same
 * account is given to the person replacing them, so name, email, phone and
 * password can all change. A new email or password signs the old person out.
 */
function EditStaffModal({ member, doctors, onClose, onSaved }) {
  const isReceptionist = member.kind === 'receptionist'
  const startAssigned = member.doctors_assigned?.length ? member.doctors_assigned : null
  const [assigned, setAssigned] = useState(startAssigned)   // null = all doctors
  const [form, setForm] = useState({
    first_name: nameParts(member).first, last_name: nameParts(member).last, email: member.email || '', phone: member.phone || '',
    employee_id: member.employee_id || '', designation: member.designation || '',
    password: '', is_active: member.is_active,
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setPhone = (e) => setForm((f) => ({ ...f, phone: toMobile(e.target.value) }))
  const emailChanged = form.email.trim().toLowerCase() !== (member.email || '').toLowerCase()
  const signsOut = emailChanged || !!form.password

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    const name = joinName(form.first_name, form.last_name)
    const email = form.email.trim()
    if (!form.first_name.trim()) er.first_name = 'Required'
    if (!form.last_name.trim()) er.last_name = 'Required (an initial is fine)'
    if (name.length > 100) er.first_name = 'Max 100 characters'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) er.email = 'Valid email required'
    else if (email.length > 100) er.email = 'Max 100 characters'
    else if (emailChanged && emailTypoError(email)) er.email = emailTypoError(email)
    if (form.phone && !/^\d{10}$/.test(form.phone)) er.phone = 'Enter a 10-digit mobile number'
    if (form.password && form.password.length < 8) er.password = 'Min 8 characters'
    if (isReceptionist && assigned !== null && assigned.length === 0) er.assigned = 'Tick at least one doctor, or choose All doctors'
    setErrors(er)
    if (Object.keys(er).length) return

    // Only what changed is sent, so an untouched field can't trip a check.
    const body = {}
    if (name !== (member.name || '')) Object.assign(body, nameFields(form.first_name, form.last_name))
    if (emailChanged) body.email = email
    if (form.phone !== (member.phone || '')) body.phone = form.phone
    if (form.employee_id.trim() !== (member.employee_id || '')) body.employee_id = form.employee_id.trim()
    if (isReceptionist && form.designation.trim() && form.designation.trim() !== member.designation) body.designation = form.designation.trim()
    if (form.password) body.password = form.password
    if (form.is_active !== member.is_active) body.is_active = form.is_active
    if (isReceptionist) {
      const key = (ids) => [...(ids || [])].sort((a, b) => a - b).join(',')
      if (key(assigned) !== key(startAssigned)) body.doctors_assigned = assigned || []
    }
    if (Object.keys(body).length === 0) { onClose(); return }

    setBusy(true)
    setErr(null)
    try {
      if (isReceptionist) await receptionApi.updateAccount(member.receptionist_id, body)
      else await pharmacistsApi.update(member.user_id, body)
      onSaved()
    } catch (e2) {
      setErr(e2.message || 'Could not save changes')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-brand-navy">Edit {ROLES[member.kind].label}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Replacing someone? Change the details and set a new password.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="col-span-full grid grid-cols-2 gap-3"><TextInput icon={Users} placeholder="First Name" maxLength={100} value={form.first_name} onChange={set('first_name')} error={errors.first_name} /><TextInput placeholder="Last Name / initial" maxLength={100} value={form.last_name} onChange={set('last_name')} error={errors.last_name} /></div>
          <TextInput icon={Mail} placeholder="Email (used to log in)" maxLength={100} value={form.email} onChange={set('email')} error={errors.email} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput prefix="+91" placeholder="Mobile (optional)" inputMode="numeric" autoComplete="tel-national" value={form.phone} onChange={setPhone} error={errors.phone} />
            <TextInput icon={BadgeCheck} placeholder="Employee ID (optional)" maxLength={50} value={form.employee_id} onChange={set('employee_id')} />
          </div>
          {isReceptionist && (
            <TextInput icon={Briefcase} placeholder="Designation" maxLength={100} value={form.designation} onChange={set('designation')} />
          )}
          {isReceptionist && (
            <DoctorAssignment doctors={doctors} value={assigned} onChange={setAssigned} error={errors.assigned} />
          )}
          <PasswordInput icon={undefined} placeholder="New password (leave blank to keep)" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-brand-navy">
            <span className="font-semibold">Active — can log in</span>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="h-4 w-4 accent-brand-blue" />
          </label>
          {signsOut && form.is_active && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Saving signs this account out on every device. Whoever used it before can't get back in with the old {emailChanged && form.password ? 'email or password' : emailChanged ? 'email' : 'password'}.
            </p>
          )}
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Staff() {
  const dialog = useDialog()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)   // staff member open in the edit modal
  const [err, setErr] = useState(null)
  const [doctors, setDoctors] = useState([])     // for assigning doctors to receptionists
  const doctorsById = Object.fromEntries(doctors.map((d) => [d.doctor_id, d]))

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const [receptionists, pharmacists, docs] = await Promise.all([
        receptionApi.list(),
        // A backend without the pharmacy module must not blank the whole page.
        pharmacistsApi.list().catch(() => []),
        doctorsApi.list({ size: 200 }).catch(() => []),
      ])
      // Only verified doctors can be given patients, so only they can be assigned.
      setDoctors((docs || []).filter((d) => d.verification_status === 'verified' && d.status !== 'suspended'))
      setStaff([
        ...receptionists.map((s) => ({ ...s, kind: 'receptionist', key: `rc-${s.receptionist_id}` })),
        ...pharmacists.map((p) => ({
          ...p, kind: 'pharmacist', key: `ph-${p.user_id}`, designation: 'Pharmacist', joined_date: p.created_at,
        })),
      ])
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const deactivate = async (s) => {
    const role = ROLES[s.kind].label.toLowerCase()
    const ok = await dialog.confirm({
      title: `Deactivate ${s.name || `this ${role}`}?`,
      message: 'They will no longer be able to log in.',
      confirmLabel: 'Deactivate',
    })
    if (!ok) return
    try {
      if (s.kind === 'pharmacist') await pharmacistsApi.remove(s.user_id)
      else await receptionApi.remove(s.receptionist_id)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  const filtered = staff.filter((s) => (s.name || '').toLowerCase().includes(search.toLowerCase()))
  const active = staff.filter((s) => s.is_active).length
  const pharmacistCount = staff.filter((s) => s.kind === 'pharmacist').length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Staff" subtitle="Receptionists and pharmacists for your hospital. Each gets their own login.">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className="w-40 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" />
        </div>
        <ToolButton icon={RefreshCw} onClick={load}>Refresh</ToolButton>
        <ToolButton icon={Boxes} onClick={() => navigate('/pharmacy-dashboard')}>Pharmacy Stock</ToolButton>
        <ToolButton icon={Plus} tone="primary" onClick={() => setShowAdd(true)}>Add Staff</ToolButton>
      </PageHeading>

      {/* Counts as one line, not a band of cards above the list. */}
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
          <Users className="h-3.5 w-3.5" /> {staff.length} total
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-green-700">
          <UserCheck className="h-3.5 w-3.5" /> {active} active
        </span>
        {pharmacistCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            <Pill className="h-3.5 w-3.5" /> {pharmacistCount} pharmacist{pharmacistCount === 1 ? '' : 's'}
          </span>
        )}
        {search && <span className="text-slate-400">· {filtered.length} matching “{search}”</span>}
      </div>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-400">
          No staff yet. Click <span className="font-semibold text-brand-blue">Add Staff</span> to add a receptionist or pharmacist.
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 overflow-auto lg:grid-cols-2">
          {filtered.map((s) => (
            <Card key={s.key} className={`flex flex-col ${s.is_active ? '' : 'opacity-70'}`}>
              <div className="flex items-start gap-3.5">
                <Avatar
                  name={s.name || 'Staff'}
                  src={s.kind === 'receptionist' ? RECEPTIONIST_AVATAR : undefined}
                  className={`h-16 w-16 shrink-0 text-lg ${s.kind === 'receptionist' ? 'bg-sky-50' : ''}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-brand-navy">{s.name || ROLES[s.kind].label}</p>
                  <p className="truncate text-[13.5px] text-slate-500">{s.designation || 'Front desk'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${ROLES[s.kind].pill}`}>{ROLES[s.kind].label}</span>
                    <StatusBadge status={s.is_active ? 'Active' : 'Inactive'} />
                  </div>
                </div>
                <button
                  onClick={() => setEditing(s)}
                  title={`Edit ${s.name || 'this staff member'}`}
                  aria-label={`Edit ${s.name || 'this staff member'}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-brand-blue/40 hover:bg-blue-50 hover:text-brand-blue"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {s.is_active && (
                  <button
                    onClick={() => deactivate(s)}
                    title={`Deactivate ${s.name || 'this staff member'}`}
                    aria-label={`Deactivate ${s.name || 'this staff member'}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-3.5 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
                <Detail icon={Mail} label="Login Email" value={s.email} />
                <Detail icon={Phone} label="Phone" value={s.phone} />
                {/* The hospital's own code. The old "Staff ID" was the database
                    row number, counted across every hospital — meaningless here. */}
                <Detail icon={BadgeCheck} label="Employee ID" value={s.employee_id} />
                {s.kind === 'receptionist' && <Detail icon={Briefcase} label="Designation" value={s.designation} />}
                {s.kind === 'receptionist' && (
                  <Detail icon={Stethoscope} label="Handles" value={assignedLabel(s.doctors_assigned, doctorsById)} />
                )}
                {/* The API has always returned joined_date; the card just never
                    showed it, so "how long has she been with us" meant asking. */}
                <Detail icon={CalendarDays} label="Joined" value={fmtDate(s.joined_date)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <AddStaffModal
          doctors={doctors}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load() }}
        />
      )}
      {editing && (
        <EditStaffModal
          member={editing}
          doctors={doctors}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}

export default Staff
