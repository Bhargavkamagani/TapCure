import { useEffect, useState } from 'react'
import { Clock, RefreshCw, Trash2 } from 'lucide-react'
import { Card, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import { Banner } from '../../components/common/FormControls.jsx'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import { AddSession } from '../doctor/Availability.jsx'
import { doctorsApi, hospitalsApi } from '../../api'
import { prettyTime } from '../../lib/format.js'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Availability() {
  const dialog = useDialog()
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingSched, setLoadingSched] = useState(false)
  const [err, setErr] = useState(null)
  const [notice, setNotice] = useState(null)
  // The hospital's own week and OP hours, so closed days are greyed out instead
  // of letting a save fail with a 409.
  const [hospitalRules, setHospitalRules] = useState(null)

  // Load the hospital's doctors once.
  useEffect(() => {
    let active = true
    ;(async () => {
      setLoadingDocs(true)
      setErr(null)
      try {
        const docs = await doctorsApi.list({ bookable: true })
        if (!active) return
        setDoctors(docs)
        if (docs.length) setDoctorId(docs[0].doctor_id)
        const hid = docs[0]?.hospital_id
        if (hid) setHospitalRules(await hospitalsApi.settings(hid).catch(() => null))
      } catch (e) {
        if (active) setErr(e.message)
      } finally {
        if (active) setLoadingDocs(false)
      }
    })()
    return () => { active = false }
  }, [])

  // Load the selected doctor's real schedule whenever the selection changes.
  const loadSchedule = async (id) => {
    if (!id) return
    setLoadingSched(true)
    setErr(null)
    try {
      setSchedules((await doctorsApi.schedule(id)) || [])
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoadingSched(false)
    }
  }
  useEffect(() => { setNotice(null); loadSchedule(doctorId) }, [doctorId])

  const selectedDoctor = doctors.find((d) => d.doctor_id === doctorId)
  const byDay = (day) => schedules.filter((s) => s.day_of_week === day)
  const total = schedules.length

  const alwaysOpen = Boolean(hospitalRules?.always_open)
  const openDays = alwaysOpen ? [] : (hospitalRules?.working_days || '').split(',').map((d) => d.trim()).filter(Boolean)
  const isOpenOn = (day) => alwaysOpen || openDays.length === 0 || openDays.includes(day)

  // No affiliation_id: the backend files it under the doctor's hospital practice.
  // The doctor is notified of every change made here.
  const add = async (day, partial) => {
    setErr(null)
    setNotice(null)
    try {
      await doctorsApi.addSchedule({ doctor_id: doctorId, day_of_week: day, consultation_mins: 10, ...partial })
      setNotice(`Session added. ${selectedDoctor?.name || 'The doctor'} has been notified.`)
      loadSchedule(doctorId)
    } catch (e) {
      setErr(e.message || 'Could not add session.')
    }
  }

  // Same guarded flow as the doctor's own page: show who is booked first.
  const remove = async (id) => {
    setNotice(null)
    let impact = null
    try {
      impact = await doctorsApi.scheduleImpact(id)
    } catch {
      /* couldn't check — fall back to the plain confirmation below */
    }
    const booked = impact ? impact.future_count + impact.today_count : 0
    const message = booked
      ? `${booked} upcoming appointment${booked === 1 ? ' is' : 's are'} booked in this session`
        + (impact.dates?.length ? ` (${impact.dates.slice(0, 3).join(', ')}${impact.dates.length > 3 ? '…' : ''})` : '')
        + '. They will be cancelled and those patients notified.'
        + (impact.today_count ? ` This includes ${impact.today_count} appointment(s) TODAY — those patients will be told not to travel.` : '')
        + ' The doctor will also be notified.'
      : 'Patients will no longer be able to book in this slot. The doctor will be notified.'
    if (!(await dialog.confirm({
      title: booked ? `Remove this session and cancel ${booked} appointment${booked === 1 ? '' : 's'}?` : 'Remove this session?',
      message,
      confirmLabel: booked ? 'Cancel them and remove' : 'Remove',
      tone: booked ? 'danger' : undefined,
    }))) return
    try {
      const res = await doctorsApi.removeSchedule(id, { confirm: true })
      setErr(null)
      setNotice(`Session removed${res?.cancelled ? `, ${res.cancelled} appointment(s) cancelled and those patients notified` : ''}. ${selectedDoctor?.name || 'The doctor'} has been notified.`)
      loadSchedule(doctorId)
    } catch (e) {
      setErr(e.message || 'Could not remove session.')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading title="Doctor Availability" subtitle="Weekly consulting sessions. Changes made here are sent to the doctor as a notification.">
        <ToolButton icon={RefreshCw} onClick={() => loadSchedule(doctorId)}>Refresh</ToolButton>
      </PageHeading>

      {err && <Banner type="error">{err}</Banner>}
      {notice && <Banner type="success">{notice}</Banner>}

      {loadingDocs ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading doctors…</p>
      ) : doctors.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-400">
          No doctors yet. Add doctors first, then set their availability here.
        </Card>
      ) : (
        <>
          {/* Doctor selector */}
          <div className="flex flex-wrap gap-2">
            {doctors.map((d) => (
              <button
                key={d.doctor_id}
                onClick={() => setDoctorId(d.doctor_id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  doctorId === d.doctor_id ? 'border-brand-blue bg-brand-blueLight text-brand-blue' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Avatar name={d.name || 'Doctor'} className="h-7 w-7 text-[13px]" />
                {d.name}
              </button>
            ))}
          </div>

          <Card className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-brand-navy">Weekly Schedule — {selectedDoctor?.name || '—'}</h3>
              <span className="rounded-full bg-brand-greenLight px-2.5 py-0.5 text-[13px] font-semibold text-brand-green">{total} sessions / week</span>
            </div>

            {loadingSched ? (
              <p className="py-10 text-center text-sm text-slate-400">Loading schedule…</p>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {WEEK_DAYS.map((day) => {
                    const open = isOpenOn(day)
                    return (
                      <div key={day} className={`rounded-2xl border p-4 ${open ? 'border-slate-100' : 'border-slate-100 bg-slate-50/70'}`}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h4 className={`text-[15px] font-bold ${open ? 'text-brand-navy' : 'text-slate-400'}`}>{day}</h4>
                          {!open && (
                            <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[12px] font-bold uppercase tracking-wide text-slate-500">
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
                                <p className="text-[13px] text-slate-400">Max {s.max_tokens} · {s.consultation_mins} min/consult</p>
                              </div>
                              <button onClick={() => remove(s.schedule_id)} className="text-slate-400 hover:text-red-500" aria-label="Remove session">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          {byDay(day).length === 0 && (
                            <p className="text-[13px] text-slate-400">{open ? 'No sessions.' : 'The hospital is not open on this day.'}</p>
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
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

export default Availability
