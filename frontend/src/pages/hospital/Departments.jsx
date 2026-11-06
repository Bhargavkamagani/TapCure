import { useEffect, useState } from 'react'
import { Building2, Plus, Search, RefreshCw, X, Layers, Trash2, RotateCcw } from 'lucide-react'
import { Card, StatusBadge, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { SelectInput, TextInput } from '../../components/common/FormControls.jsx'
import { departmentsApi } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import { SPECIALIZATIONS } from '../../data/authData.js'

const normName = (s) => (s || '').trim().toLowerCase()

function AddDepartmentModal({ hospitalId, existing, onClose, onAdded }) {
  // name -> department already in this hospital, so it can't be added twice
  const taken = new Map(existing.map((d) => [normName(d.name), d]))
  const allTaken = SPECIALIZATIONS.every((n) => taken.has(normName(n)))
  const [form, setForm] = useState({ name: '', code: '', floor: '', description: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const er = {}
    if (!form.name.trim()) er.name = 'Required'
    setErrors(er)
    if (Object.keys(er).length) return

    setBusy(true)
    setErr(null)
    try {
      await departmentsApi.create({
        hospital_id: hospitalId,
        name: form.name.trim(),
        code: form.code.trim(),
        floor: form.floor.trim(),
        description: form.description.trim(),
      })
      onAdded()
    } catch (e2) {
      setErr(e2.message || 'Could not add department')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-brand-navy">Add Department</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <SelectInput icon={Building2} value={form.name} onChange={set('name')} error={errors.name}>
            <option value="">Select department name</option>
            {SPECIALIZATIONS.map((name) => {
              const dup = taken.get(normName(name))
              return (
                <option key={name} value={name} disabled={!!dup}>
                  {name}{dup ? (dup.is_active ? ' (already added)' : ' (deactivated)') : ''}
                </option>
              )
            })}
          </SelectInput>
          {allTaken && (
            <p className="text-[12.5px] text-slate-500">Every department is already added. Reactivate a deactivated one from the list instead.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextInput placeholder="Code (e.g. PSY)" value={form.code} onChange={set('code')} />
            <TextInput placeholder="Floor (e.g. 2nd)" value={form.floor} onChange={set('floor')} />
          </div>
          <TextInput placeholder="Description (optional)" value={form.description} onChange={set('description')} />
          {err && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
          <button disabled={busy || allTaken} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
            {busy ? 'Adding…' : 'Add Department'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Departments() {
  const dialog = useDialog()
  const { user } = useAuth()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [err, setErr] = useState(null)

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      setDepartments(await departmentsApi.list())
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const deactivate = async (d) => {
    const ok = await dialog.confirm({
      title: `Deactivate "${d.name}"?`,
      message: "Doctors already in it keep their record, but it won't be selectable for new doctors.",
      confirmLabel: 'Deactivate',
    })
    if (!ok) return
    try {
      await departmentsApi.remove(d.department_id)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  const reactivate = async (d) => {
    try {
      await departmentsApi.update(d.department_id, { is_active: true })
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  const filtered = departments.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
  const activeCount = departments.filter((d) => d.is_active).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Departments" subtitle="Organise your hospital into departments. Doctors are assigned to one when you add them.">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search department…" className="w-40 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" />
        </div>
        <ToolButton icon={RefreshCw} onClick={load}>Refresh</ToolButton>
        <ToolButton icon={Plus} tone="primary" onClick={() => setShowAdd(true)}>Add Department</ToolButton>
      </PageHeading>

      {/* Two numbers don't need two stat cards and a whole band of the screen —
          a department list is meant to be read at a glance, and the counts were
          pushing the list itself below the fold. */}
      <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-700">
          <Layers className="h-3.5 w-3.5" /> {departments.length} total
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-green-700">
          <Building2 className="h-3.5 w-3.5" /> {activeCount} active
        </span>
        {search && <span className="text-slate-400">· {filtered.length} matching “{search}”</span>}
      </div>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-400">
          No departments yet. Click <span className="font-semibold text-brand-blue">Add Department</span> to create your first one.
        </Card>
      ) : (
        /* One tight row per department instead of a tall card: the icon is
           smaller, the description sits inline on one clamped line, and
           Deactivate is an icon button in the corner rather than a full-width
           bar. Four across on a wide screen — an admin with 12 departments was
           scrolling through four rows of chest-high cards. */
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d) => (
            <div
              key={d.department_id}
              className={`group flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 shadow-card ${
                d.is_active ? '' : 'opacity-60'
              }`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-brand-navy">{d.name}</p>
                <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                  {[d.code, d.floor ? `${d.floor} floor` : null, d.description].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              {!d.is_active && <StatusBadge status="Inactive" />}
              {!d.is_active && (
                <button
                  onClick={() => reactivate(d)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-green-200 px-2.5 py-1.5 text-[12px] font-semibold text-green-700 hover:bg-green-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                </button>
              )}
              {d.is_active && (
                <button
                  onClick={() => deactivate(d)}
                  title={`Deactivate ${d.name}`}
                  aria-label={`Deactivate ${d.name}`}
                  /* Always reachable on touch; on a mouse it fades in, so a wall
                     of rows isn't a wall of red buttons. */
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:text-red-600 group-hover:text-slate-400 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddDepartmentModal
          hospitalId={user?.hospital_id}
          existing={departments}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}

export default Departments
