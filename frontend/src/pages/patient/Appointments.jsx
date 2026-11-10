import { useEffect, useState, useCallback } from 'react'
import { translitName } from '../../lib/translit.js'
import { originLabelText } from '../../lib/englishText.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'
import { useLocation } from 'react-router-dom'
import { Clock, MapPin, IndianRupee, X, CalendarClock, Navigation, Timer, Footprints, UserRound } from 'lucide-react'
import { Card, StatusBadge, Avatar, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { SelectInput, TextInput, Banner } from '../../components/common/FormControls.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { appointmentsApi, patientsApi, tokensApi } from '../../api'
import { dateChip, prettyTime, prettyDate, statusLabel, todayISO, clockIST, clockISTWithDay, humanMins } from '../../lib/format.js'
import { mapsDirectionsUrl } from '../../lib/geo.js'
import { useI18n } from '../../i18n/index.jsx'
import { useDialog } from '../../components/common/DialogProvider.jsx'

const ACTIVE_STATUSES = ['scheduled', 'booked', 'confirmed', 'pending', 'checked_in', 'in_progress']

/** Small reschedule modal: pick a new date, load that doctor's free slots, submit. */
function RescheduleModal({ appt, onClose, onDone }) {
  const { t, lang } = useI18n()
  const [date, setDate] = useState(appt.appointment_date || todayISO())
  const [slots, setSlots] = useState([])
  const [slot, setSlot] = useState('')
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoadingSlots(true)
    setSlot('')
    appointmentsApi
      .availableSlots(appt.doctor_id, date, appt.affiliation_id)
      .then((res) => {
        if (!active) return
        // Endpoint may return an array of times or an object with `slots`.
        const list = Array.isArray(res) ? res : res?.slots || []
        setSlots(list)
      })
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoadingSlots(false))
    return () => {
      active = false
    }
  }, [appt.doctor_id, date])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await appointmentsApi.reschedule({
        appointment_id: appt.appointment_id,
        new_date: date,
        new_time: slot || null,
        reason: 'Patient requested',
      })
      onDone()
      onClose()
    } catch (err) {
      setError(err.message || t('ppage.couldNotReschedule'))
    } finally {
      setSaving(false)
    }
  }

  const slotValue = (s) => (typeof s === 'string' ? s : s.time || s.slot_time || s.value)
  const slotLabel = (s) => (typeof s === 'string' ? prettyTime(s) : s.label || prettyTime(slotValue(s)))

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-brand-navy">{t('ppage.rescheduleAppt')}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}
        <div className="space-y-3">
          <TextInput label={t('ppage.newDate')} type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} />
          <SelectInput label={t('ppage.availableSlot')} value={slot} onChange={(e) => setSlot(e.target.value)} disabled={loadingSlots}>
            <option value="">{loadingSlots ? t('ppage.loadingSlots') : slots.length ? t('ppage.selectSlot') : t('ppage.noSlots')}</option>
            {slots.map((s, i) => (
              <option key={i} value={slotValue(s)}>{slotLabel(s)}</option>
            ))}
          </SelectInput>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <ToolButton type="button" onClick={onClose}>{t('pcommon.cancel')}</ToolButton>
          <ToolButton type="submit" tone="primary" disabled={saving}>{saving ? t('pcommon.saving') : t('pcommon.confirm')}</ToolButton>
        </div>
      </form>
    </div>
  )
}

function ApptRow({ appt, doctor, hospital, onCancel, onReschedule, canManage }) {
  const { t, lang } = useI18n()
  const chip = dateChip(appt.appointment_date)
  // Policy §5: one free reschedule per appointment (hospital-configurable). Only
  // the patient's own moves count, so a hospital-side change never uses it up.
  const rescheduleUsedUp = (appt.reschedule_count ?? 0) >= (appt.reschedules_allowed ?? 1)
  const doctorName = translitName(doctor?.name, lang) || t('px.doctorNum', { id: appt.doctor_id })
  return (
    <li className="flex flex-wrap items-center gap-4 py-4">
      <Avatar name={doctorName} className="h-12 w-12" />
      <div className="min-w-[160px] leading-tight">
        <p className="text-[15px] font-bold text-brand-navy">{doctorName}</p>
        <p className="text-[13.5px] text-slate-500">{specialtyLabel(doctor?.specialization, lang) || appt.appointment_type}</p>
        {appt.family_member_name && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[13px] font-semibold text-purple-600">
            <UserRound className="h-3 w-3" /> {t('pm.forPerson', { name: translitName(appt.family_member_name, lang) })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-brand-blueLight px-3 py-1.5 text-center">
          <p className="text-[18px] font-extrabold leading-none text-brand-blue">{chip.day}</p>
          <p className="text-[13px] text-slate-500">{chip.month}</p>
        </div>
        {appt.slot_time && (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />{prettyTime(appt.slot_time)}
          </span>
        )}
      </div>
      <div className="min-w-[170px] leading-tight">
        <p className="text-[13.5px] font-semibold text-brand-navy">{translitName(hospital?.name, lang) || '—'}</p>
        {hospital && (
          <p className="flex items-center gap-1 text-[13px] text-slate-400">
            <MapPin className="h-3.5 w-3.5" />{translitName([hospital.city, hospital.state].filter(Boolean).join(', '), lang)}
          </p>
        )}
      </div>
      <div className="ml-auto flex flex-col items-end gap-1.5 text-right leading-tight">
        <span className="flex items-center gap-1 text-[13px] font-semibold text-slate-500">
          <IndianRupee className="h-3.5 w-3.5" />{Number(appt.consultation_fee)}
        </span>
        <StatusBadge status={statusLabel(appt.status)} />
        {canManage && (
          <>
            <div className="mt-1 flex gap-2">
              <button
                onClick={() => onReschedule(appt)}
                disabled={rescheduleUsedUp}
                title={rescheduleUsedUp ? t('ppage.rescheduleUsedHint') : undefined}
                className={`flex items-center gap-1 text-[13px] font-semibold ${
                  rescheduleUsedUp
                    ? 'cursor-not-allowed text-slate-300'
                    : 'text-brand-blue hover:underline'
                }`}
              >
                <CalendarClock className="h-3.5 w-3.5" />{t('ppage.reschedule')}
              </button>
              <button onClick={() => onCancel(appt)} className="text-[13px] font-semibold text-red-500 hover:underline">{t('ppage.cancel')}</button>
            </div>
            {rescheduleUsedUp && (
              <p className="max-w-[190px] text-[13px] leading-tight text-slate-400">{t('ppage.rescheduleUsed')}</p>
            )}
          </>
        )}
      </div>
    </li>
  )
}

/**
 * Live "time to leave" card for a today's appointment. Polls the token estimate
 * and works backwards from the call ETA to a leave-by time, flipping to a
 * "Leave now" alert once that moment arrives.
 */
function TravelPlanCard({ appt, doctor, hospital }) {
  const { t, lang } = useI18n()
  const [est, setEst] = useState(null)
  const [phase, setPhase] = useState('loading') // loading | pending | ready
  const navUrl = mapsDirectionsUrl({ lat: appt.origin_lat, lng: appt.origin_lng }, hospital)

  useEffect(() => {
    let active = true
    let timer
    const poll = async () => {
      try {
        const res = await tokensApi.estimate({ appointment_id: appt.appointment_id })
        if (!active) return
        setEst(res)
        setPhase('ready')
      } catch {
        // 404 = hospital hasn't issued the token yet; keep waiting quietly.
        if (active) setPhase((p) => (p === 'ready' ? 'ready' : 'pending'))
      } finally {
        if (active) timer = setTimeout(poll, 30000)
      }
    }
    poll()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [appt.appointment_id])

  const doctorName = translitName(doctor?.name, lang) || t('px.doctorNum', { id: appt.doctor_id })
  const leaveNow = phase === 'ready' && est?.should_leave_now
  const hasLeaveBy = phase === 'ready' && est?.leave_by

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${
        leaveNow ? 'border-amber-300 bg-amber-50' : 'border-brand-blue/15 bg-brand-blueLight/40'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${leaveNow ? 'bg-amber-500' : 'bg-brand-blue'}`}>
            {leaveNow ? <Footprints className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
          </span>
          <div className="leading-tight">
            <p className="text-[14px] font-bold text-brand-navy">{doctorName}</p>
            <p className="text-[13px] text-slate-500">{translitName(hospital?.name, lang) || t('ppage.hospital')}{appt.slot_time ? ` · ${t('ppage.slot', { time: prettyTime(appt.slot_time) })}` : ''}</p>
            {/* Whose visit this is. The rows below already say it; this card —
                the one a patient actually reads on the day — did not, so a
                parent travelling for a child had nothing naming the child. */}
            {appt.family_member_name && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[13px] font-semibold text-purple-600">
                <UserRound className="h-3 w-3" /> {t('pm.forPerson', { name: translitName(appt.family_member_name, lang) })}
              </span>
            )}
          </div>
        </div>
        {phase === 'ready' && est?.queue_position > 0 && (
          <span className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-brand-navy shadow-sm">
            {t('ppage.inQueue', { n: est.queue_position })}
          </span>
        )}
      </div>

      {phase === 'pending' && (
        <p className="mt-3 text-[13.5px] text-slate-500">
          {t('ppage.waitingForHospital')}
        </p>
      )}

      {phase === 'ready' && (
        <div className="mt-3">
          {leaveNow ? (
            <div className="flex items-center gap-2 text-[14px] font-extrabold text-amber-700">
              <Footprints className="h-5 w-5" /> {t('ppage.leaveNowTurn', { n: est.wait_min })}
            </div>
          ) : (
            /* Three facts, in the order the day happens: leave, arrive, be
               seen. "Leave by" was the one the card never showed, though it is
               the only one the patient has to act on — it was on the dashboard
               and in the booking confirmation, but not here. Two columns on a
               phone (the third drops underneath), three from sm up. */
            <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
              {est.leave_by && (
                <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{t('pdash.leaveByTitle')}</p>
                  <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-amber-600">
                    <Footprints className="h-4 w-4" />{clockISTWithDay(est.leave_by)}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">{t('ppage.tokenExpected')}</p>
                <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-brand-navy">
                  <Clock className="h-4 w-4 text-brand-blue" />{clockISTWithDay(est.estimated_time)}
                </p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                  {est.arrive_by ? t('px.appt.reachBy') : t('ppage.waitTime')}
                </p>
                <p className="flex items-center gap-1.5 text-[15px] font-extrabold text-brand-navy">
                  <Navigation className="h-4 w-4 text-brand-green" />
                  {est.arrive_by ? clockISTWithDay(est.arrive_by) : `~${t('pdash.min', { n: est.wait_min })}`}
                </p>
              </div>
            </div>
          )}
          {hasLeaveBy && !leaveNow && (
            <p className="mt-2 text-[13px] text-slate-500">
              {t('ppage.travelRemind', { d: humanMins(t, est.travel_min), from: est.origin_label ? t('ppage.travelFrom', { place: originLabelText(est.origin_label, t, lang) }) : '' })}
            </p>
          )}
          {!est?.travel_min && (
            <p className="mt-2 text-[13px] text-slate-400">
              {t('ppage.addStartLocation')}
            </p>
          )}
        </div>
      )}

      {navUrl && (
        <a
          href={navUrl}
          target="_blank"
          rel="noreferrer"
          className={`mt-3 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-bold text-white transition-colors ${
            leaveNow ? 'bg-amber-500 hover:bg-amber-600' : 'bg-brand-blue hover:bg-brand-blueDark'
          }`}
        >
          <Navigation className="h-4 w-4" />{t('pm.openInMaps')}</a>
      )}
    </div>
  )
}

/** Patient's appointments — upcoming + past, backed by the API. */
function Appointments() {
  const dialog = useDialog()
  const { t, lang } = useI18n()
  const { state } = useLocation()
  const { patient, resolveDoctor, resolveHospital, resolveAffiliation } = usePatientCtx()
  const [appts, setAppts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rescheduling, setRescheduling] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!patient) return
    if (!silent) setLoading(true)
    setError(null)
    try {
      const list = await patientsApi.appointments(patient.patient_id)
      // Newest first.
      list.sort((a, b) => (a.appointment_date < b.appointment_date ? 1 : -1))
      setAppts(list)
    } catch (e) {
      setError(e.message || t('ppage.couldNotLoadAppts'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [patient])

  useEffect(() => {
    load()
  }, [load])

  // A hospital cancelling or rescheduling a visit must reach the patient here
  // without them thinking to pull-to-refresh.
  useAutoRefresh(() => load({ silent: true }), { intervalMs: 30000, enabled: !!patient })

  const cancel = async (appt) => {
    if (!(await dialog.confirm({ message: t('ppage.confirmCancel'), confirmLabel: t('ppage.cancel') }))) return
    try {
      await appointmentsApi.cancel({ appointment_id: appt.appointment_id, reason: 'Patient cancelled' })
      load()
    } catch (e) {
      dialog.alert({ message: e.message || t('ppage.couldNotCancel'), tone: 'danger' })
    }
  }

  const today = todayISO()
  const upcoming = appts.filter((a) => ACTIVE_STATUSES.includes(a.status) && a.appointment_date >= today)
  const past = appts.filter((a) => !ACTIVE_STATUSES.includes(a.status) || a.appointment_date < today)
  const todays = upcoming.filter((a) => a.appointment_date === today)
  // A long journey has to START before the day of the appointment: someone
  // travelling eight hours to tomorrow's hospital must leave TODAY. Restricting
  // this card to `todays` meant the one instruction they needed appeared only
  // on the morning they'd already missed it.
  //
  // Future dates are included only when the booking recorded where the patient
  // travels from — without an origin there's no journey to plan, and the card
  // would just repeat the date. The card itself stays quiet until the server
  // returns a leave-by, so nothing renders for a short local trip booked weeks
  // out.
  const travelPlans = [
    ...todays,
    ...upcoming.filter((a) => a.appointment_date > today && a.origin_lat != null).slice(0, 3),
  ]

  // Show the practice location the patient actually booked (e.g. a personal
  // hospital or home practice), not just the parent hospital. Falls back to the
  // hospital for older bookings with no affiliation.
  const hospitalFor = (appt) =>
    resolveAffiliation(appt.affiliation_id) ||
    resolveHospital(appt.hospital_id) ||
    resolveHospital(resolveDoctor(appt.doctor_id)?.hospital_id)

  const renderRow = (a, canManage) => (
    <ApptRow
      key={a.appointment_id}
      appt={a}
      doctor={resolveDoctor(a.doctor_id)}
      hospital={hospitalFor(a)}
      onCancel={cancel}
      onReschedule={setRescheduling}
      canManage={canManage}
    />
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.apptsTitle')} subtitle={t('ppage.apptsSubtitle')} />

      {state?.booked && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13.5px] font-semibold text-green-700">
          {state.appointment?.doctor ? t('ppage.apptBookedWithDoc', { doctor: state.appointment.doctor }) : t('ppage.apptBookedNoDoc')}
        </div>
      )}

      {error && <Banner type="error">{error}</Banner>}

      {travelPlans.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-brand-navy">
            <Footprints className="h-4 w-4 text-brand-blue" /> {t('ppage.todayWhenToLeave')}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {travelPlans.map((a) => (
              <TravelPlanCard
                key={a.appointment_id}
                appt={a}
                doctor={resolveDoctor(a.doctor_id)}
                hospital={hospitalFor(a)}
              />
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="mb-3 text-[16px] font-bold text-brand-navy">{t('ppage.upcoming')}</h3>
        {loading ? (
          <p className="text-sm text-slate-400">{t('pcommon.loading')}</p>
        ) : upcoming.length === 0 ? (
          <p className="py-4 text-[13.5px] text-slate-400">{t('pdash.noUpcomingAppts')}</p>
        ) : (
          <ul className="divide-y divide-slate-50">{upcoming.map((a) => renderRow(a, true))}</ul>
        )}
      </Card>

      {past.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-[16px] font-bold text-brand-navy">{t('ppage.pastCancelled')}</h3>
          <ul className="divide-y divide-slate-50">{past.map((a) => renderRow(a, false))}</ul>
        </Card>
      )}

      {rescheduling && (
        <RescheduleModal appt={rescheduling} onClose={() => setRescheduling(null)} onDone={load} />
      )}
    </div>
  )
}

export default Appointments
