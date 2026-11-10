import { useEffect, useState } from 'react'
import {
  Stethoscope, UserCheck, UserX, Plus, Search, Briefcase, IndianRupee, X, RefreshCw, Pencil, Phone,
  Building2, GraduationCap, Languages, BadgeCheck, Fingerprint, Mail, Users,
} from 'lucide-react'
import { Card, StatusBadge, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import { TextInput, PasswordInput, SelectInput } from '../../components/common/FormControls.jsx'
import QualificationPicker from '../../components/common/QualificationPicker.jsx'
import LanguagePicker from '../../components/common/LanguagePicker.jsx'
import { doctorsApi, departmentsApi, receptionApi } from '../../api'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import { emailTypoError } from '../../lib/emailTypos.js'
import { SPECIALIZATIONS } from '../../data/authData.js'
import { nameFields, nameParts } from '../../lib/personName.js'

const STATUS_LABEL = { active: 'Active', on_leave: 'On Leave', inactive: 'Inactive', suspended: 'Inactive' }

// Leave has dates now (2026-10-01): the doctor is "On Leave" while today is
// inside an approved leave, and bookable again the day after it ends. A
// doctor with only the old open-ended `on_leave` status still shows as before.
const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const onLeaveNow = (d, leave) => d.status === 'on_leave' || (d.status === 'active' && !!leave && leave.leave_from <= todayIST())
const leaveText = (leave) => {
  if (!leave) return ''
  const span = leave.leave_from === leave.leave_to ? shortDate(leave.leave_from) : `${shortDate(leave.leave_from)} – ${shortDate(leave.leave_to)}`
  return leave.leave_from <= todayIST() ? `On leave till ${shortDate(leave.leave_to)}` : `Leave ${span}`
}

/** Active receptionists who handle this doctor: those assigned to them, plus
 *  any with no assignment (they handle every doctor). Set on the Staff page. */
function frontDeskLabel(doctorId, receptionists) {
  const names = receptionists
    .filter((r) => r.is_active && (!r.doctors_assigned?.length || r.doctors_assigned.includes(doctorId)))
    .map((r) => r.name || 'Receptionist')
  return names.length ? names.join(', ') : 'No receptionist'
}

/** One labelled fact on a doctor/staff card. `title` carries the untruncated
 *  value, so a long qualification or email is still readable on hover. */
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

// The specialty a department stands for, when its name is one ("Cardiology").
// Custom names like "General OPD" return null and keep a separate specialty pick.
const specialtyOf = (dept) =>
  dept ? SPECIALIZATIONS.find((s) => s.toLowerCase() === dept.name.trim().toLowerCase()) || null : null

/**
 * One choice instead of two: the department decides the specialty, so a doctor
 * can no longer sit in Cardiology while listed as a General Physician. A
 * department that doesn't name a specialty ("General OPD") means General
 * Physician. The specialty picker only shows when the hospital has no
 * departments at all.
 */
function DepartmentSpecialtyFields({ departments, form, setForm, error }) {
  // Deactivated departments can't take new doctors, but a doctor already in
  // one keeps it selectable so editing them doesn't silently move them.
  const options = departments.filter((d) => d.is_active || String(d.department_id) === String(form.department_id))
  const dept = departments.find((d) => String(d.department_id) === String(form.department_id))
  const fixed = specialtyOf(dept)

  const pickDept = (e) => {
    const next = departments.find((d) => String(d.department_id) === e.target.value)
    setForm((f) => ({
      ...f,
      department_id: e.target.value,
      specialization: next ? specialtyOf(next) || 'General Physician' : f.specialization,
    }))
  }

  return (
    <div className="space-y-1.5">
      <div>
        {options.length > 0 && (
          <SelectInput icon={Building2} value={form.department_id} onChange={pickDept} error={error}>
            <option value="">Select department</option>
            {options.map((d) => (
              <option key={d.department_id} value={d.department_id}>{d.name}{d.is_active ? '' : ' (deactivated)'}</option>
            ))}
          </SelectInput>
        )}
        {/* Was free text, which is how "Dentist", "Psychology" and "MBBS"
            got into the column. The symptom helper matches specialty names
            exactly, so a typo here makes the doctor unfindable. */}
        {options.length === 0 && (
          <SelectInput value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}>
            {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectInput>
        )}
      </div>
      {dept && (
        <p className="pl-1 text-[13px] text-slate-500">
          Specialty: <span className="font-semibold text-brand-navy">{fixed || form.specialization}</span>
          {fixed ? ' (from the department)' : ''}
        </p>
      )}
      {options.length === 0 && <p className="pl-1 text-[13px] text-slate-500">No departments yet. Add them on the Departments page to group doctors.</p>}
    </div>
  )
}

function AddDoctorModal({ departments, onClose, onAdded }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', specialization: 'General Physician', qualification: '', consultation_fee: '', experience_years: '',
    department_id: '', languages: '', hpr_id: '', email: '', phone: '', password: '',
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!form.first_name.trim()) er.first_name = 'Required'
    if (!form.last_name.trim()) er.last_name = 'Required (an initial is fine)'
    if (!form.department_id && departments.some((d) => d.is_active)) er.department_id = 'Choose a department'
    const email = form.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) er.email = 'Valid email required'
    else if (email.length > 100) er.email = 'Max 100 characters'
    // This creates the doctor's login, and doctors sign in by email only — a
    // misspelt provider (gmial.com) is an account nobody can ever use or reset.
    // Same check as the doctor signup page.
    else if (emailTypoError(email)) er.email = emailTypoError(email)
    if (!/^\d{10}$/.test(form.phone)) er.phone = 'Valid 10-digit mobile number required'
    if (!form.password || form.password.length < 8) er.password = 'Min 8 characters'
    setErrors(er)
    if (Object.keys(er).length) return

    setBusy(true)
    setErr(null)
    try {
      await doctorsApi.onboard({
        ...nameFields(form.first_name, form.last_name),
        specialization: form.specialization,
        qualification: form.qualification,
        consultation_fee: form.consultation_fee ? Number(form.consultation_fee) : 0,
        experience_years: form.experience_years ? Number(form.experience_years) : 0,
        department_id: form.department_id || undefined,
        languages: form.languages,
        hpr_id: form.hpr_id?.trim() || undefined,
        create_login: true,
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      })
      onAdded()
    } catch (e2) {
      setErr(e2.message || 'Could not add doctor')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-[480px] rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Add Doctor</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="col-span-full grid grid-cols-2 gap-3"><TextInput icon={Stethoscope} placeholder="First Name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} /><TextInput placeholder="Last Name / initial" value={form.last_name} onChange={set('last_name')} error={errors.last_name} /></div>
          <DepartmentSpecialtyFields departments={departments} form={form} setForm={setForm} error={errors.department_id} />

          {/* The onboard API already accepted `qualification`; this form simply
              never sent it, so hospital-added doctors showed a blank qualification
              to patients while self-registered ones did not. */}
          <QualificationPicker
            label=""
            value={form.qualification}
            onChange={(v) => setForm((f) => ({ ...f, qualification: v }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput icon={IndianRupee} placeholder="Consultation Fee" inputMode="numeric" value={form.consultation_fee} onChange={set('consultation_fee')} />
            <TextInput icon={Briefcase} placeholder="Experience (yrs)" inputMode="numeric" value={form.experience_years} onChange={set('experience_years')} />
          </div>
          <LanguagePicker
            value={form.languages}
            onChange={(v) => setForm((f) => ({ ...f, languages: v }))}
          />
          <TextInput placeholder="HPR ID — Healthcare Professionals Registry (optional)" value={form.hpr_id} onChange={set('hpr_id')} />

          <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <p className="text-xs font-semibold text-brand-navy">Doctor login credentials</p>
            <TextInput type="email" placeholder="Doctor's login email" maxLength={100} value={form.email} onChange={set('email')} error={errors.email} />
            <TextInput icon={Phone} prefix="+91" placeholder="Doctor's WhatsApp mobile number" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))} error={errors.phone} />
            <PasswordInput placeholder="Temporary password (minimum 8 characters)" value={form.password} onChange={set('password')} error={errors.password} />
          </div>
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
            {busy ? 'Adding…' : 'Add Doctor'}
          </button>
        </form>
      </div>
    </div>
  )
}

function EditDoctorModal({ doctor, leave, departments, onClose, onSaved }) {
  const dialog = useDialog()
  const [form, setForm] = useState({
    first_name: nameParts(doctor).first, last_name: nameParts(doctor).last, specialization: doctor.specialization || 'General Physician',
    department_id: doctor.department_id || '', qualification: doctor.qualification || '',
    consultation_fee: String(Number(doctor.consultation_fee || 0)),
    experience_years: String(Number(doctor.experience_years || 0)),
    languages: doctor.languages || '', hpr_id: doctor.hpr_id || '',
    status: onLeaveNow(doctor, leave) ? 'on_leave' : (doctor.status || 'active'),
    leave_from: todayIST(), leave_to: todayIST(), leave_reason: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }))
  // Doctors saved before the two fields were tied together can disagree.
  const currentDept = departments.find((d) => String(d.department_id) === String(form.department_id))
  const mismatch = !!specialtyOf(currentDept) && specialtyOf(currentDept) !== doctor.specialization
    && String(form.department_id) === String(doctor.department_id)

  const submit = async (e) => {
    e.preventDefault()
    const fee = Number(form.consultation_fee)
    const experience = Number(form.experience_years)
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setErr('Doctor first and last name are required (an initial is fine)')
      return
    }
    if (form.consultation_fee === '' || !Number.isFinite(fee) || fee < 0) {
      setErr('Enter a valid consultation fee')
      return
    }
    if (form.experience_years === '' || !Number.isFinite(experience) || experience < 0) {
      setErr('Enter valid experience in years')
      return
    }
    const newLeave = form.status === 'on_leave' && !leave
    if (newLeave && (!form.leave_from || !form.leave_to || form.leave_to < form.leave_from)) {
      setErr('Choose the leave dates (the last day must be on or after the first)')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await doctorsApi.update(doctor.doctor_id, {
        ...nameFields(form.first_name, form.last_name), specialization: specialtyOf(currentDept) || form.specialization,
        department_id: form.department_id || null,
        qualification: form.qualification, consultation_fee: fee,
        experience_years: experience, languages: form.languages,
        hpr_id: form.hpr_id.trim() || null,
        // Leave is saved separately, with dates; the status itself stays.
        status: form.status === 'on_leave' ? doctor.status : form.status,
      })
      if (newLeave) {
        const body = { leave_from: form.leave_from, leave_to: form.leave_to, reason: form.leave_reason.trim() }
        try {
          await doctorsApi.setLeave(doctor.doctor_id, body)
        } catch (e3) {
          // 409 = patients are booked inside the leave; show who is affected first.
          if (e3?.status !== 409 || e3?.detail?.code !== 'leave_has_bookings') throw e3
          const d = e3.detail || {}
          const ok = await dialog.confirm({
            title: `Put ${doctor.name} on leave and cancel ${d.total} appointment${d.total === 1 ? '' : 's'}?`,
            message:
              `${d.total} appointment${d.total === 1 ? ' is' : 's are'} booked during this leave. `
              + 'They will be cancelled and those patients told not to travel.'
              + (d.paid_count ? ` ${d.paid_count} paid the booking fee — they get a free rebooking, and the message tells them so.` : '')
              + (d.today_count ? ` This includes ${d.today_count} appointment(s) TODAY.` : ''),
            confirmLabel: 'Cancel them and set leave',
            tone: 'danger',
          })
          if (!ok) {
            setErr('Leave not set. The other changes were saved.')
            setBusy(false)
            return
          }
          await doctorsApi.setLeave(doctor.doctor_id, body, { confirm: true })
        }
      } else if (leave && form.status === 'active') {
        await doctorsApi.endLeave(doctor.doctor_id, leave.leave_id)
      }
      onSaved()
    } catch (e2) {
      setErr(e2.message || 'Could not update doctor')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-brand-navy">Edit Doctor</h3>
            <p className="mt-0.5 text-xs text-slate-500">Update the doctor’s hospital profile</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="col-span-full grid grid-cols-2 gap-3"><TextInput icon={Stethoscope} placeholder="First Name" value={form.first_name} onChange={set('first_name')} autoFocus /><TextInput placeholder="Last Name / initial" value={form.last_name} onChange={set('last_name')} /></div>
          <DepartmentSpecialtyFields departments={departments} form={form} setForm={setForm} />
          {mismatch && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Listed as <b>{doctor.specialization}</b> but in the <b>{currentDept.name}</b> department. Saving will set the specialty to <b>{specialtyOf(currentDept)}</b>.
            </p>
          )}
          <QualificationPicker label="" value={form.qualification} onChange={(value) => setForm((current) => ({ ...current, qualification: value }))} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput icon={IndianRupee} type="number" min="0" step="1" placeholder="Consultation Fee" value={form.consultation_fee} onChange={set('consultation_fee')} />
            <TextInput icon={Briefcase} type="number" min="0" step="1" placeholder="Experience (yrs)" value={form.experience_years} onChange={set('experience_years')} />
          </div>
          <LanguagePicker value={form.languages} onChange={(value) => setForm((current) => ({ ...current, languages: value }))} />
          <TextInput placeholder="HPR ID (optional)" value={form.hpr_id} onChange={set('hpr_id')} />
          <select value={form.status} onChange={set('status')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy">
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </select>
          {form.status === 'on_leave' && leave && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {leaveText(leave)}{leave.reason ? ` · ${leave.reason}` : ''}. Choose <b>Active</b> and save to end the leave now.
            </div>
          )}
          {form.status === 'on_leave' && !leave && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">Leave dates</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[13px] text-amber-800">From
                  <input type="date" min={todayIST()} value={form.leave_from} onChange={set('leave_from')} className="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-brand-navy" />
                </label>
                <label className="text-[13px] text-amber-800">To (last day of leave)
                  <input type="date" min={form.leave_from || todayIST()} value={form.leave_to} onChange={set('leave_to')} className="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-brand-navy" />
                </label>
              </div>
              <input value={form.leave_reason} onChange={set('leave_reason')} maxLength={200} placeholder="Reason (optional)" className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm" />
              <p className="text-[13px] text-amber-800">
                Patients can’t book these dates; anyone already booked is cancelled and told. The doctor can still log in
                and is bookable again the day after the leave ends.
              </p>
            </div>
          )}
          {form.status === 'inactive' && doctor.status !== 'inactive' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Saving as <b>Inactive</b> will block this doctor’s login, sign them out, and cancel all their upcoming
              appointments (patients are notified). Set Active again to restore their login.
            </div>
          )}
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Login email: <span className="font-semibold text-slate-700">{doctor.login_email || 'Not available'}</span></div>
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button disabled={busy} className="flex-1 rounded-xl bg-brand-blue py-2.5 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
              {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Doctors() {
  const [doctors, setDoctors] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [leaves, setLeaves] = useState({})   // doctor_id -> current or next approved leave
  const [receptionists, setReceptionists] = useState([])   // for each card's "Front Desk"
  const [err, setErr] = useState(null)

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const [docs, depts, lv, rc] = await Promise.all([
        doctorsApi.list(), departmentsApi.list(),
        doctorsApi.leaveList({ status: 'approved' }).catch(() => []),
        receptionApi.list().catch(() => []),
      ])
      setDoctors(docs)
      setDepartments(depts)
      setReceptionists(rc || [])
      // Each doctor's current or next approved leave.
      const today = todayIST()
      const next = {}
      ;(lv || []).filter((l) => l.leave_to >= today)
        .sort((a, b) => a.leave_from.localeCompare(b.leave_from))
        .forEach((l) => { if (!next[l.doctor_id]) next[l.doctor_id] = l })
      setLeaves(next)
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const deptName = (id) => departments.find((d) => d.department_id === id)?.name || '—'
  const filtered = doctors.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization.toLowerCase().includes(search.toLowerCase()))
  const onLeave = doctors.filter((d) => onLeaveNow(d, leaves[d.doctor_id])).length
  const active = doctors.filter((d) => d.status === 'active' && !onLeaveNow(d, leaves[d.doctor_id])).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Doctors" subtitle="Your hospital's medical team. Add as many doctors as you need.">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search doctor…" className="w-40 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" />
        </div>
        <ToolButton icon={RefreshCw} onClick={load}>Refresh</ToolButton>
        <ToolButton icon={Plus} tone="primary" onClick={() => setShowAdd(true)}>Add Doctor</ToolButton>
      </PageHeading>

      {/* Three counts used to occupy a full band of cards above the list the
          admin actually came here to read. Same numbers, one line. */}
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
          <Stethoscope className="h-3.5 w-3.5" /> {doctors.length} total
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-green-700">
          <UserCheck className="h-3.5 w-3.5" /> {active} active
        </span>
        {onLeave > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-orange-700">
            <UserX className="h-3.5 w-3.5" /> {onLeave} on leave
          </span>
        )}
        {search && <span className="text-slate-400">· {filtered.length} matching “{search}”</span>}
      </div>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-400">
          No doctors yet. Click <span className="font-semibold text-brand-blue">Add Doctor</span> to add your first one.
        </Card>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 overflow-auto lg:grid-cols-2">
          {filtered.map((d) => (
            <Card key={d.doctor_id} className="group flex flex-col">
              <div className="flex items-start gap-3.5">
                {/* `src` was never passed, so a doctor who uploaded a photo on
                    their own profile still showed initials to their hospital —
                    it looked like the upload hadn't saved. Avatar resolves the
                    stored path itself and falls back to initials if the file
                    is missing. */}
                <Avatar
                  name={d.name || 'Doctor'}
                  src={d.profile_photo_url}
                  className="h-16 w-16 shrink-0 text-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-brand-navy">{d.name}</p>
                  <p className="truncate text-[13.5px] text-slate-500">{d.specialization}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={onLeaveNow(d, leaves[d.doctor_id]) ? 'On Leave' : (STATUS_LABEL[d.status] || d.status)} />
                    {d.status === 'active' && leaves[d.doctor_id] && (
                      <span className="text-[13px] font-semibold text-amber-700">{leaveText(leaves[d.doctor_id])}</span>
                    )}
                    {d.is_self_registered && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[13px] font-bold text-violet-700">
                        Self-registered
                      </span>
                    )}
                    {d.verification_status === 'pending' && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-bold text-amber-700">
                        Pending verification
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingDoctor(d)}
                  title="Edit doctor"
                  aria-label={`Edit ${d.name}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-brand-blue"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              {/* Everything the admin came to this page to check, labelled.
                  Previously only four of these were shown and the rest lived
                  inside the edit modal. */}
              <div className="mt-3.5 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-2">
                <Detail icon={Building2} label="Department" value={deptName(d.department_id)} />
                <Detail icon={IndianRupee} label="Consultation Fee" value={`₹${Number(d.consultation_fee || 0)}`} />
                <Detail icon={Briefcase} label="Experience" value={`${d.experience_years || 0} years`} />
                <Detail icon={GraduationCap} label="Qualification" value={d.qualification} />
                <Detail icon={Languages} label="Languages" value={d.languages} />
                <Detail icon={BadgeCheck} label="Registration No." value={d.registration_number} />
                <Detail icon={Fingerprint} label="HPR ID (ABDM)" value={d.hpr_id} />
                <Detail icon={Mail} label="Login Email" value={d.login_email} />
                <Detail icon={Users} label="Front Desk" value={frontDeskLabel(d.doctor_id, receptionists)} />
              </div>

              {d.bio && (
                <p className="mt-3 line-clamp-2 text-[13px] text-slate-500" title={d.bio}>{d.bio}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {showAdd && (
        <AddDoctorModal
          departments={departments}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load() }}
        />
      )}
      {editingDoctor && (
        <EditDoctorModal
          doctor={editingDoctor}
          leave={leaves[editingDoctor.doctor_id]}
          departments={departments}
          onClose={() => setEditingDoctor(null)}
          onSaved={() => { setEditingDoctor(null); load() }}
        />
      )}
    </div>
  )
}

export default Doctors
