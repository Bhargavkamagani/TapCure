import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, Check, Clock, MapPin, Plus, Ticket, Trash2, X } from 'lucide-react'
import { Banner } from '../../components/common/FormControls.jsx'
import OnboardingFooter from '../../components/doctor/OnboardingFooter.jsx'
import OnboardingHeader from '../../components/doctor/OnboardingHeader.jsx'
import { PracticeModal } from './Profile.jsx'
import { doctorsApi, hospitalsApi } from '../../api'
import { prettyTime } from '../../lib/format.js'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { validateMaxTokens, validateSessionTimes, MIN_CONSULT_MINS } from '../../components/doctor/onboardingValidation.js'
import TimePicker12Hour from '../../components/doctor/TimePicker12Hour.jsx'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_ONLY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const PANEL = 'rounded-[26px] border border-white bg-white shadow-soft'

/**
 * Step 1 of first-login setup.
 *
 * The dashboard's Availability page is built for maintenance — pick a day, open
 * a form, save, repeat — which means seven passes before a new doctor can move
 * on. Here the composer comes first and applies one timing to every day picked
 * at once, so a typical week is two actions (Mon–Sat morning, Mon–Fri evening).
 * The week below is a read-out of what's been added.
 */
export default function OnboardingAvailability() {
  const navigate = useNavigate()
  const setup = useOutletContext()
  const { doctor, doctorId, loading: doctorLoading } = useDoctorCtx()

  const [affiliations, setAffiliations] = useState([])
  const [affiliationId, setAffiliationId] = useState('')
  const [schedules, setSchedules] = useState([])
  const [hospitalRules, setHospitalRules] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addingPractice, setAddingPractice] = useState(false)

  // Composer state
  const [days, setDays] = useState([])
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('12:00')
  const [maxTokens, setMaxTokens] = useState('40')
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showComposerErrors, setShowComposerErrors] = useState(false)

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
      setSchedules(selectedId ? (await doctorsApi.schedule(doctorId, selectedId)) || [] : [])

      const selected = affs.find((a) => String(a.affiliation_id) === String(selectedId))
      if (selected?.managed_by_hospital && selected.hospital_id) {
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

  // A hospital owns its opening hours; a session outside them is refused by the
  // backend, so those days simply aren't offered. A 24/7 hospital owns none of
  // that — the doctor's own sessions are then the only constraint.
  const alwaysOpen = Boolean(hospitalRules?.always_open)
  const openDays = alwaysOpen ? [] : (hospitalRules?.working_days || '').split(',').map((d) => d.trim()).filter(Boolean)
  const isOpenOn = (day) => alwaysOpen || openDays.length === 0 || openDays.includes(day)
  const minTime = alwaysOpen ? undefined : hospitalRules?.op_start_time?.slice(0, 5)
  const maxTime = alwaysOpen ? undefined : hospitalRules?.op_end_time?.slice(0, 5)

  const toggleDay = (day) => {
    if (!isOpenOn(day)) return
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))
  }
  const pickPreset = (preset) => setDays(preset.filter(isOpenOn))

  // Validated on every render so the button state and the messages under the
  // controls always agree.
  const timeError = validateSessionTimes(start, end, MIN_CONSULT_MINS)
  const tokensError = validateMaxTokens(maxTokens)
  const composerValid = !timeError && !tokensError && days.length > 0 && Boolean(affiliationId)

  const addSessions = async () => {
    if (!affiliationId) {
      setError('Add a practice location before adding sessions.')
      return
    }
    if (timeError || tokensError) {
      setShowComposerErrors(true)
      return
    }
    setBusy(true)
    setError(null)
    setShowComposerErrors(false)

    // Each day is its own request, so a rejection partway through (an overlap
    // 409, or hours outside the hospital's) leaves the earlier days saved. Report
    // exactly which ones landed instead of a bare failure over a half-done week.
    const failed = []
    for (const day of days) {
      try {
        await doctorsApi.addSchedule({
          doctor_id: doctorId,
          affiliation_id: affiliationId,
          day_of_week: day,
          consultation_mins: MIN_CONSULT_MINS,
          start_time: start,
          end_time: end,
          max_tokens: Number(maxTokens),
        })
      } catch (e) {
        failed.push({ day, message: e.message || 'rejected' })
      }
    }

    const added = days.filter((d) => !failed.some((f) => f.day === d))
    if (failed.length) {
      setError(
        `${added.length ? `Added ${added.join(', ')}. ` : ''}` +
        `Couldn't add ${failed.map((f) => f.day).join(', ')} — ${failed[0].message}`,
      )
    }
    setDays(failed.map((f) => f.day))
    await load()
    // Awaited, not fired and forgotten: the shell routes off this flag, and
    // releasing the button before it lands lets the doctor reach step 2 while
    // the shell still believes no hours exist — which bounces them back here.
    await setup?.refresh?.()
    setBusy(false)
  }

  const removeSession = async (id) => {
    setError(null)
    try {
      await doctorsApi.removeSchedule(id)
      await load()
      await setup?.refresh?.()
    } catch (e) {
      setError(e.message || 'Could not remove that session.')
    }
  }

  const byDay = (day) => schedules.filter((s) => s.day_of_week === day)
  const total = schedules.length
  const selectedPractice = affiliations.find((a) => String(a.affiliation_id) === String(affiliationId))

  return (
    <div className="flex w-full flex-1 flex-col">
      <OnboardingHeader
        eyebrow="Step 1"
        title="Set your consulting hours"
        sub="Pick the days that share a timing and add them together. Each session becomes bookable tokens for your patients."
      />

      {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}
      {!doctorLoading && !doctorId && (
        <div className="mb-4"><Banner type="error">This login isn&apos;t linked to a doctor record yet. Please contact support.</Banner></div>
      )}

      {/* Composer — the hero of this step. The practice lives in its header
          rather than in a bar of its own: it's context for the session you're
          about to add, so it belongs to the same surface. */}
      <section className={`${PANEL} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-teal-50/80 to-transparent px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-[0_6px_16px_-6px_rgba(13,148,136,0.9)]">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[15.5px] font-bold text-ink">Add a session</h2>
              <p className="text-[13.5px] text-ink-soft">
                Same timing across several days? Select them all.
                {minTime && maxTime && <> Hospital open {prettyTime(minTime)} – {prettyTime(maxTime)}.</>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {affiliations.length > 1 ? (
              affiliations.map((a) => (
                <button
                  key={a.affiliation_id}
                  type="button"
                  onClick={() => setAffiliationId(String(a.affiliation_id))}
                  className={`rounded-xl px-3 py-1.5 text-[13.5px] font-bold transition-colors ${
                    String(affiliationId) === String(a.affiliation_id)
                      ? 'bg-teal-600 text-white'
                      : 'bg-white text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50'
                  }`}
                >
                  {a.name}
                </button>
              ))
            ) : !loading && affiliations.length === 0 ? (
              <button
                type="button"
                onClick={() => setAddingPractice(true)}
                className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-[13.5px] font-bold text-white hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" /> Add practice location
              </button>
            ) : selectedPractice ? (
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/80 px-3 py-1.5 text-[13px] font-bold text-teal-700 ring-1 ring-teal-100">
                <MapPin className="h-3.5 w-3.5" /> {selectedPractice.name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1fr_auto] xl:gap-10">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[13px] font-bold text-white">1</span>
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">Choose days</span>
              <span className="h-3 w-px bg-slate-200" />
              <button type="button" onClick={() => pickPreset(WEEKDAYS_ONLY)} className="rounded-full px-2.5 py-0.5 text-[13px] font-bold text-teal-700 transition-colors hover:bg-teal-50">Mon–Fri</button>
              <button type="button" onClick={() => pickPreset(WEEK_DAYS)} className="rounded-full px-2.5 py-0.5 text-[13px] font-bold text-teal-700 transition-colors hover:bg-teal-50">All week</button>
              {days.length > 0 && (
                <button type="button" onClick={() => setDays([])} className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold text-slate-400 transition-colors hover:bg-slate-100">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {WEEK_DAYS.map((day) => {
                const open = isOpenOn(day)
                const picked = days.includes(day)
                return (
                  <motion.button
                    key={day}
                    type="button"
                    whileTap={open ? { scale: 0.93 } : undefined}
                    disabled={!open}
                    onClick={() => toggleDay(day)}
                    title={open ? undefined : 'The hospital is closed on this day'}
                    className={`relative h-[52px] w-[68px] rounded-2xl text-[13.5px] font-bold transition-all ${
                      !open
                        ? 'cursor-not-allowed bg-slate-50 text-slate-300'
                        : picked
                          ? 'bg-gradient-to-br from-teal-600 to-emerald-600 text-white shadow-[0_8px_18px_-8px_rgba(13,148,136,0.95)]'
                          : 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200/80 hover:bg-white hover:ring-teal-300'
                    }`}
                  >
                    {day}
                    {picked && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-teal-600 shadow"
                      >
                        <Check className="h-3 w-3" strokeWidth={4} />
                      </motion.span>
                    )}
                    {!open && <span className="absolute inset-x-3 top-1/2 h-px bg-slate-300" />}
                  </motion.button>
                )
              })}
            </div>
          </div>

          <div className="xl:border-l xl:border-slate-100 xl:pl-10">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[13px] font-bold text-white">2</span>
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">Choose time and capacity</span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <TimePicker12Hour label="From" value={start} error={showComposerErrors && Boolean(timeError)}
                onChange={(value) => { setStart(value); setShowComposerErrors(false) }} />
              <TimePicker12Hour label="To" value={end} error={showComposerErrors && Boolean(timeError)}
                onChange={(value) => { setEnd(value); setShowComposerErrors(false) }} />
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Max tokens</span>
                {/* Text, not type="number": the number control let `-` and `e`
                    through, and `Number(x) || 40` then sent -5 to the API as a
                    negative token cap, or silently turned 0 into 40. */}
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={maxTokens}
                  onChange={(e) => { setMaxTokens(e.target.value.replace(/\D/g, '')); setShowComposerErrors(false) }}
                  className={`h-[52px] w-[92px] rounded-2xl border bg-slate-50/60 px-3.5 text-[15px] font-bold text-ink outline-none transition-colors focus:bg-white focus:ring-4 focus:ring-teal-500/10 ${
                    showComposerErrors && tokensError ? 'border-red-300' : 'border-slate-200 focus:border-teal-500'
                  }`} />
              </label>
              <div className="basis-full rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[13px] font-bold text-white">3</span>
                  <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Review and save</span>
                </div>
                <p className="text-[13px] font-bold text-ink">
                  {days.length
                    ? `${days.join(', ')} · ${prettyTime(start)} – ${prettyTime(end)} · up to ${maxTokens || 0} patients`
                    : 'Choose at least one day above'}
                </p>
                <p className="mt-0.5 text-[13px] text-slate-500">Your hours are not saved until you click the button below.</p>
              </div>
              <motion.button
                type="button"
                whileHover={composerValid && !busy ? { y: -1 } : undefined}
                whileTap={composerValid && !busy ? { scale: 0.98 } : undefined}
                disabled={busy || !composerValid}
                onClick={addSessions}
                className="flex h-[54px] basis-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 text-[14px] font-bold text-white shadow-[0_12px_26px_-12px_rgba(13,148,136,0.9)] transition-colors disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                <Check className="h-4 w-4" />
                {busy ? 'Saving availability…' : days.length ? `Save availability for ${days.length} day${days.length === 1 ? '' : 's'}` : 'Choose days first'}
              </motion.button>
            </div>

            {(timeError || tokensError) && (
              <p className={`mt-2 text-[13px] font-medium ${showComposerErrors ? 'text-red-500' : 'text-slate-400'}`}>
                {timeError || tokensError}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* The week so far */}
      <section className={`${PANEL} mt-4 flex flex-1 flex-col p-5 sm:p-7`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15.5px] font-bold text-ink">Your week</h2>
            <p className="text-[13.5px] text-ink-soft">Every session a patient can book a token in.</p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-bold ${
            total ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
          }`}>
            {total} session{total === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex-1 divide-y divide-slate-100">
          {WEEK_DAYS.map((day) => {
            const rows = byDay(day)
            const open = isOpenOn(day)
            return (
              <div key={day} className="flex items-center gap-4 py-2.5 first:pt-0">
                {/* Day label — fixed width so every row's sessions start on the
                    same left edge, which a 7-column grid could never give us. */}
                <span className={`w-11 shrink-0 text-[13px] font-bold ${
                  rows.length ? 'text-ink' : open ? 'text-slate-400' : 'text-slate-300'
                }`}>
                  {day}
                </span>

                <div className="flex min-h-[38px] flex-1 flex-wrap items-center gap-2">
                  {rows.map((s) => (
                    <motion.span
                      key={s.schedule_id}
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group flex items-center gap-2.5 rounded-full bg-teal-50 py-1.5 pl-3 pr-1.5 ring-1 ring-inset ring-teal-100"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                      <span className="whitespace-nowrap text-[13.5px] font-bold text-teal-900">
                        {prettyTime(s.start_time)} – {prettyTime(s.end_time)}
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap border-l border-teal-200 pl-2.5 text-[13px] font-semibold text-teal-600">
                        <Ticket className="h-3 w-3" /> {s.max_tokens}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSession(s.schedule_id)}
                        aria-label={`Remove ${day} ${prettyTime(s.start_time)} session`}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-teal-400 transition-colors hover:bg-red-100 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </motion.span>
                  ))}
                  {rows.length === 0 && (
                    <span className="text-[13.5px] text-slate-300">
                      {open ? 'No sessions yet' : 'Hospital closed'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <OnboardingFooter
        hint="pick your days above and add a session"
        checklist={[
          { label: 'A practice location', done: affiliations.length > 0 },
          { label: total > 0 ? `${total} weekly session${total === 1 ? '' : 's'}` : 'At least one weekly session', done: total > 0 },
        ]}
        busy={leaving}
        nextLabel={leaving ? 'Checking…' : 'Continue to profile'}
        onNext={async () => {
          // The shell decides whether step 2 is reachable from a cached "does
          // this doctor have hours?" flag. Re-read it before navigating: the
          // sessions save fine, but a click that outruns the refresh makes the
          // shell send the doctor straight back to this step.
          setLeaving(true)
          await setup?.refresh?.()
          setLeaving(false)
          navigate('/doctor-onboarding/profile')
        }}
      />

      {addingPractice && doctor && (
        <PracticeModal
          doctor={doctor}
          onClose={() => setAddingPractice(false)}
          onSaved={async () => { setAddingPractice(false); await load(); await setup?.refresh?.() }}
        />
      )}
    </div>
  )
}
