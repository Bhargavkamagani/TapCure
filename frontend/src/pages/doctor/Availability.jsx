import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Clock, MapPin } from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { Banner } from '../../components/common/FormControls.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { doctorsApi, hospitalsApi } from '../../api'
import { prettyTime } from '../../lib/format.js'
import { HolidaysPanel } from './Holidays.jsx'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import TimePicker12Hour from '../../components/doctor/TimePicker12Hour.jsx'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// A practice the hospital doesn't manage is the doctor's own (personal/home).
// The hospital console never sees these — only the doctor does.
const isPersonal = (a) => a?.managed_by_hospital === false

/** Hospital (blue) vs Personal (purple) chip for a practice location. */
function PracticeTag({ aff, className = '' }) {
  const personal = isPersonal(aff)
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
        personal ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-brand-blue'
      } ${className}`}
    >
      {personal ? 'Personal' : 'Hospital'}
    </span>
  )
}

/** Inline "add a session" row inside a weekday card. Also used by the hospital
 *  console's Availability page. */
export function AddSession({ onAdd, minTime, maxTime }) {
  const [open, setOpen] = useState(false)
  // Default the session inside the hospital's opening hours when we know them,
  // so the common case needs no correction at all.
  const [start, setStart] = useState(minTime || '09:00')
  const [end, setEnd] = useState('12:00')
  const [maxTokens, setMaxTokens] = useState(40)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-[12.5px] font-semibold text-brand-blue hover:bg-brand-blueLight/30">
        <Plus className="h-4 w-4" /> Add session
      </button>
    )
  }
  return (
    <div className="space-y-3 rounded-2xl border border-brand-blue/20 bg-brand-blueLight/20 p-3 shadow-sm">
      <div>
        <p className="text-[12.5px] font-bold text-brand-navy">Set session time</p>
        <p className="text-[11px] text-slate-400">Choose the booking window, then save below.</p>
      </div>
      <div className="grid gap-2">
        <TimePicker12Hour label="From" value={start} onChange={setStart} />
        <TimePicker12Hour label="To" value={end} onChange={setEnd} />
      </div>
      {(minTime || maxTime) && (
        <p className="px-0.5 text-[11px] text-slate-400">Hospital hours {minTime || '—'} to {maxTime || '—'}</p>
      )}
      <div className="flex items-center gap-2 text-[12px]">
        <label className="text-slate-500">Max tokens</label>
        <input type="number" min="1" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} onWheel={(e) => e.currentTarget.blur()} className="w-20 rounded-lg border border-slate-200 px-2 py-1" />
      </div>
      <p className="rounded-xl bg-white px-3 py-2 text-center text-[12px] font-semibold text-brand-navy">{prettyTime(start)} – {prettyTime(end)} · up to {maxTokens || 0} patients</p>
      <div className="flex gap-2">
        <button onClick={() => { onAdd({ start_time: start, end_time: end, max_tokens: Number(maxTokens) }); setOpen(false) }}
          className="flex-1 rounded-xl bg-brand-blue py-2.5 text-[12.5px] font-bold text-white shadow-sm hover:bg-brand-blueDark">Save session</button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-600">Cancel</button>
      </div>
    </div>
  )
}

/** The dashboard's Availability page. First-login setup has its own screen —
 *  see OnboardingAvailability.jsx. */
function Availability() {
  const dialog = useDialog()
  const { doctorId, loading: doctorLoading } = useDoctorCtx()
  const [affiliations, setAffiliations] = useState([])
  const [affiliationId, setAffiliationId] = useState('')
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Confirmation of what a removal actually did — how many patients were
  // cancelled and notified. Silence after a destructive action is worse than
  // the action itself.
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState('weekly')   // 'weekly' | 'holidays'

  // The hospital's own week and OP hours. A doctor practising under a hospital
  // can't consult when the doors are shut, so the grid greys those days out
  // instead of letting the save fail with a 409.
  const [hospitalRules, setHospitalRules] = useState(null)

  const load = useCallback(async () => {
    if (!doctorId) return
    setLoading(true)
    try {
      const affs = ((await doctorsApi.affiliations({ doctor_id: doctorId })) || []).filter((a) => a.is_active !== false)
      const selectedId =
        affiliationId && affs.some((a) => String(a.affiliation_id) === String(affiliationId))
          ? affiliationId
          : affs[0] ? String(affs[0].affiliation_id) : ''
      setAffiliations(affs)
      if (!affiliationId && selectedId) setAffiliationId(selectedId)
      setSchedules((await doctorsApi.schedule(doctorId, selectedId)) || [])

      const selected = affs.find((a) => String(a.affiliation_id) === String(selectedId))
      if (selected?.managed_by_hospital && selected.hospital_id) {
        // Non-fatal: without the settings we simply don't grey anything out and
        // the backend still refuses an out-of-hours session.
        setHospitalRules(await hospitalsApi.settings(selected.hospital_id).catch(() => null))
      } else {
        setHospitalRules(null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [affiliationId, doctorId])

  useEffect(() => { load() }, [load])

  const add = async (day, partial) => {
    setError(null)
    if (!affiliationId) {
      setError('Create or select a practice location before adding sessions.')
      return
    }
    try {
      await doctorsApi.addSchedule({ doctor_id: doctorId, affiliation_id: affiliationId, day_of_week: day, consultation_mins: 10, ...partial })
      load()
    } catch (e) {
      setError(e.message || 'Could not add session.')
    }
  }
  const remove = async (id) => {
    // Ask the server who is booked BEFORE asking the doctor to confirm. Removing
    // a session cancels those patients' appointments and notifies them, so the
    // confirmation has to state the real cost — "patients can no longer book"
    // hid the fact that people already had.
    let impact = null
    try {
      impact = await doctorsApi.scheduleImpact(id)
    } catch {
      /* couldn't check — fall back to the plain confirmation below */
    }
    const booked = impact ? impact.future_count + impact.today_count : 0
    const paid = impact ? impact.paid_count : 0
    const message = booked
      ? `${booked} upcoming appointment${booked === 1 ? '' : 's'} ${booked === 1 ? 'is' : 'are'} booked in this session`
        + (impact.dates?.length ? ` (${impact.dates.slice(0, 3).join(', ')}${impact.dates.length > 3 ? '…' : ''})` : '')
        + `. They will be cancelled and those patients notified.`
        + (paid ? ` ${paid} paid the booking fee online — they get a free rebooking, and the message tells them so.` : '')
        + (impact.today_count ? ` This includes ${impact.today_count} appointment(s) TODAY — those patients will be told not to travel.` : '')
      : 'Patients will no longer be able to book in this slot.'
    if (!(await dialog.confirm({
      title: booked ? `Remove this session and cancel ${booked} appointment${booked === 1 ? '' : 's'}?` : 'Remove this session?',
      message,
      confirmLabel: booked ? 'Cancel them and remove' : 'Remove',
      tone: booked ? 'danger' : undefined,
    }))) return
    try {
      const res = await doctorsApi.removeSchedule(id, { confirm: true })
      if (res?.cancelled) {
        setError(null)
        setNotice(`Session removed. ${res.cancelled} appointment(s) cancelled and those patients notified`
          + (res.free_rebooks_granted ? `, ${res.free_rebooks_granted} given a free rebooking.` : '.'))
      }
      load()
    } catch (e) {
      setError(e.message || 'Could not remove session.')
    }
  }

  const byDay = (day) => schedules.filter((s) => s.day_of_week === day)
  const total = schedules.length
  const selectedPractice = affiliations.find((a) => String(a.affiliation_id) === String(affiliationId))

  // Hospital-managed practice only: the hospital owns the premises' opening times.
  // Unless it is open 24/7 — then it imposes no week and no window, the
  // backend stops checking, and these pickers must stop clamping too or the
  // doctor still can't choose hours the server would now accept.
  const alwaysOpen = Boolean(hospitalRules?.always_open)
  const openDays = alwaysOpen ? [] : (hospitalRules?.working_days || '').split(',').map((d) => d.trim()).filter(Boolean)
  const isOpenOn = (day) => alwaysOpen || openDays.length === 0 || openDays.includes(day)
  const hospitalHours = !alwaysOpen && hospitalRules?.op_start_time && hospitalRules?.op_end_time
    ? `${prettyTime(hospitalRules.op_start_time)} – ${prettyTime(hospitalRules.op_end_time)}`
    : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="My Availability" subtitle={tab === 'holidays' ? "Days you're unavailable." : loading ? 'Loading…' : `Your weekly consulting sessions — ${total} active.`} />
      {error && <Banner type="error">{error}</Banner>}
      {notice && <Banner type="success">{notice}</Banner>}
      {!doctorLoading && !doctorId && (
        <Banner type="error">Your doctor profile is not linked to this login yet. Please ask hospital admin to link this user to the doctor.</Banner>
      )}

      {/* Tabs: weekly hours vs holidays / leave */}
      <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1">
        {[['weekly', 'Weekly hours'], ['holidays', 'Holidays & leave']].map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${tab === key ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'holidays' ? (
        <HolidaysPanel />
      ) : (
      <Card>
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-brand-navy">Select practice location</h3>
              <p className="text-[12px] font-medium text-slate-500">
                Add or edit practice locations from My Profile. This page is only for weekly timings.
              </p>
            </div>
            {!loading && affiliations.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-700">
                No practice location found. Open My Profile to add one.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {affiliations.map((a) => (
              <button
                key={a.affiliation_id}
                onClick={() => setAffiliationId(String(a.affiliation_id))}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-semibold ${
                  String(affiliationId) === String(a.affiliation_id)
                    ? 'border-brand-blue bg-brand-blueLight text-brand-blue'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <MapPin className="h-4 w-4" /> {a.name}
                <PracticeTag aff={a} />
              </button>
            ))}
          </div>
          {selectedPractice && (
            <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-slate-500">
              <PracticeTag aff={selectedPractice} />
              Sessions below apply only to {selectedPractice.name}
              {isPersonal(selectedPractice)
                ? ' — your personal practice, not visible to the hospital.'
                : ' — managed by the hospital.'}
            </p>
          )}
          {selectedPractice && !isPersonal(selectedPractice) && (openDays.length > 0 || hospitalHours) && (
            <p className="text-[12px] font-medium text-slate-500">
              Sessions must fit the hospital's own opening times
              {openDays.length > 0 && <> — open <span className="font-semibold text-brand-navy">{openDays.join(', ')}</span></>}
              {hospitalHours && <>, <span className="font-semibold text-brand-navy">{hospitalHours}</span></>}. Your personal
              practice locations have no such limit.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {WEEK_DAYS.map((day) => {
            const open = isOpenOn(day)
            return (
            <div key={day} className={`rounded-2xl border p-4 ${open ? 'border-slate-100' : 'border-slate-100 bg-slate-50/70'}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className={`text-[15px] font-bold ${open ? 'text-brand-navy' : 'text-slate-400'}`}>{day}</h3>
                {!open && (
                  <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                    Hospital closed
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {byDay(day).map((s) => (
                  <div key={s.schedule_id} className="flex items-center gap-3 rounded-xl border border-brand-blue/30 bg-brand-blueLight/40 px-3 py-2">
                    <Clock className="h-4 w-4 text-brand-blue" />
                    <div className="flex-1 leading-tight">
                      <p className="text-[13px] font-semibold text-brand-navy">{prettyTime(s.start_time)} – {prettyTime(s.end_time)}</p>
                      <p className="text-[11px] text-slate-400">Max {s.max_tokens} · {s.consultation_mins} min/consult</p>
                    </div>
                    <button onClick={() => remove(s.schedule_id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                {byDay(day).length === 0 && (
                  <p className="text-[12px] text-slate-400">{open ? 'No sessions.' : 'The hospital is not open on this day.'}</p>
                )}
                {open && (
                  <AddSession
                    onAdd={(partial) => add(day, partial)}
                    minTime={alwaysOpen ? undefined : hospitalRules?.op_start_time?.slice(0, 5)}
                    maxTime={alwaysOpen ? undefined : hospitalRules?.op_end_time?.slice(0, 5)}
                  />
                )}
              </div>
            </div>
            )
          })}
        </div>
      </Card>
      )}
    </div>
  )
}

export default Availability
