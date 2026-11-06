import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, SkipForward, Megaphone, XCircle, CheckCircle2, PlayCircle, RefreshCw, Hash, Users, CheckCheck, Clock, Activity, Wallet, Stethoscope } from 'lucide-react'
import { Card, PageHeading, ToolButton, StatCard, Avatar } from '../../components/hospital/ui.jsx'
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx'
import { VitalsModal } from '../../components/patient/VitalsPanel.jsx'
import { doctorsApi, tokensApi, appointmentsApi } from '../../api'
import CollectPaymentModal, { paymentModeLabel } from '../../components/common/CollectPaymentModal.jsx'
import FreeRevisitChip from '../../components/common/FreeRevisitChip.jsx'
import { seenName, bookedBy } from '../../lib/patientDisplay.js'
import TravelChip from '../../components/common/TravelChip.jsx'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

const PRIORITY_PILL = {
  urgent: 'bg-amber-100 text-amber-700',
  emergency: 'bg-red-100 text-red-600',
}

/** One-line summary of a token's latest vitals for the queue card. */
function vitalsSummary(v) {
  if (!v) return null
  const parts = []
  if (v.bp) parts.push(`BP ${v.bp}`)
  if (v.pulse != null) parts.push(`${v.pulse}bpm`)
  if (v.temperature_f != null) parts.push(`${v.temperature_f}°F`)
  if (v.spo2 != null) parts.push(`SpO₂ ${v.spo2}%`)
  if (v.blood_sugar != null) parts.push(`Sugar ${v.blood_sugar}`)
  if (!parts.length && v.weight_kg != null) parts.push(`${v.weight_kg}kg`)
  return parts.join(' · ')
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } } }

export default function AssistantQueue() {
  const dialog = useDialog()
  const [params, setParams] = useSearchParams()
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState(params.get('doctor') || '')
  const [queue, setQueue] = useState(null)
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)   // what the token engine just did
  const [updatedAt, setUpdatedAt] = useState(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [vitalsFor, setVitalsFor] = useState(null)  // token whose patient we're recording vitals for

  // null = still loading, [] = genuinely none. The distinction matters: with no
  // bookable doctor the page has nothing to select, so it must say why instead
  // of rendering an empty queue that looks like a quiet morning.
  const [doctorsLoaded, setDoctorsLoaded] = useState(false)

  useEffect(() => {
    doctorsApi.list({ bookable: true })
      .then((d) => {
        setDoctors(d)
        if (!doctorId && d.length) setDoctorId(String(d[0].doctor_id))
      })
      .catch((e) => setErr(e.message || 'Could not load doctors.'))
      .finally(() => setDoctorsLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadQueue = async (id = doctorId, { silent = false } = {}) => {
    if (!id) return
    if (!silent) setErr(null)
    try {
      const [q, s] = await Promise.all([tokensApi.queue(id), tokensApi.stats(id)])
      setQueue(q)
      setStats(s)
      setUpdatedAt(new Date())
      setRefreshFailed(false)
    } catch (e) {
      // A blip during background polling must not replace a queue the desk is
      // working from with a red error card — keep the last good data and say,
      // quietly, that it may be stale.
      if (silent) setRefreshFailed(true)
      else setErr(e.message)
    }
  }
  useEffect(() => {
    if (doctorId) {
      setParams({ doctor: doctorId })
      loadQueue(doctorId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId])

  // Paused while an action is in flight or a modal is open, so rows never shift
  // under the hand of someone about to click Skip or No-show.
  useAutoRefresh(() => loadQueue(doctorId, { silent: true }), {
    enabled: !!doctorId,
    paused: busy || !!vitalsFor,
  })

  const act = async (fn) => {
    setBusy(true)
    setErr(null)
    setInfo(null)
    try {
      const res = await fn()
      // The token engine explains itself — "Called OP-004 · 2 skipped (payment
      // pending)", or "all with payment pending — collect to call them". That
      // message used to be thrown away, so pressing Call Next when everyone is
      // unpaid looked like a dead button.
      if (res?.message) setInfo(res.message)
      await loadQueue()
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  // Collect the consultation fee → marks the token Paid so it can be called.
  // Confirm first so the front desk understands exactly what the click does.
  // The popup also asks HOW they paid (cash / UPI / card), so the day's cash
  // count and the bank statement can each be matched.
  const [collectFor, setCollectFor] = useState(null)
  const collectPayment = (t) => setCollectFor(t)

  const current = queue?.current
  const waiting = queue?.waiting || []
  const doctor = doctors.find((d) => String(d.doctor_id) === String(doctorId))
  const unpaidCount = waiting.filter((t) => t.consultation_fee > 0 && !t.consultation_paid).length

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Live Queue" subtitle="Call, serve and clear tokens in real time.">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Avatar name={doctor?.name || 'Dr'} className="h-6 w-6 text-[9px]" />
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={doctors.length === 0}
            className="bg-transparent py-2 text-sm font-semibold text-brand-navy outline-none disabled:text-slate-400"
          >
            {doctors.length === 0 ? (
              <option value="">No doctors available</option>
            ) : (
              doctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>{d.name}</option>
              ))
            )}
          </select>
        </div>
        {/* The desk needs to know whether what it's reading is current — a live
            queue that quietly stopped updating is worse than an obviously stale one. */}
        <span className={`hidden items-center gap-1.5 text-[11.5px] font-semibold sm:inline-flex ${
          refreshFailed ? 'text-amber-600' : 'text-slate-400'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${refreshFailed ? 'bg-amber-500' : 'animate-pulse bg-teal-500'}`} />
          {refreshFailed
            ? 'Not updating — showing last known queue'
            : updatedAt
              ? `Live · updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
              : 'Live'}
        </span>
        <ToolButton icon={RefreshCw} onClick={() => loadQueue()}>Refresh</ToolButton>
      </PageHeading>

      <AnimatePresence>
        {err && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>
          </motion.div>
        )}
        {info && !err && (
          <motion.div key="info" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="flex items-center gap-2 border-blue-100 bg-blue-50 text-sm font-medium text-brand-blue">
              <Radio className="h-4 w-4 shrink-0" /> {info}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {doctorsLoaded && doctors.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Stethoscope className="h-8 w-8 text-slate-200" />
          <p className="text-[15px] font-bold text-brand-navy">No doctors available to run a queue</p>
          <p className="max-w-md text-[13px] text-slate-500">
            This hospital has no active, verified doctor. Add one from Hospital → Doctors, or ask the
            admin to activate an existing doctor. Until then there's no queue to show — this is not
            an empty day.
          </p>
        </Card>
      )}

      {/* KPI stats — staggered count-up */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <motion.div variants={item} whileHover={{ y: -4 }}>
          <StatCard value={<AnimatedNumber value={stats?.total ?? 0} />} label="Total Today" icon={Hash} tone="blue" />
        </motion.div>
        <motion.div variants={item} whileHover={{ y: -4 }}>
          <StatCard value={current ? 1 : 0} label="In Consultation" icon={Radio} tone="green" />
        </motion.div>
        <motion.div variants={item} whileHover={{ y: -4 }}>
          <StatCard value={<AnimatedNumber value={stats?.waiting ?? waiting.length} />} label="Waiting" icon={Users} tone="orange" />
        </motion.div>
        <motion.div variants={item} whileHover={{ y: -4 }}>
          <StatCard value={<AnimatedNumber value={stats?.served ?? 0} />} label="Completed" icon={CheckCheck} tone="teal" />
        </motion.div>
      </motion.div>

      {/* Now serving — hero */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-blue to-brand-blueDark shadow-card"
      >
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div
                key={current.token_id}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                className="flex items-center gap-5"
              >
                <div className="relative flex flex-col items-center justify-center rounded-2xl bg-white/15 px-5 py-3 backdrop-blur">
                  <span className="absolute right-2.5 top-2.5 flex h-2 w-2">
                    <motion.span
                      className="absolute inline-flex h-full w-full rounded-full bg-green-300"
                      animate={{ scale: [1, 2.4, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Now Serving</span>
                  <span className="text-[40px] font-extrabold leading-none text-white">{current.display_code}</span>
                </div>
                <div className="flex items-center gap-2.5 text-white">
                  <Avatar name={seenName(current)} tone="bg-white/20" className="h-11 w-11 text-base" />
                  <div className="leading-tight">
                    <p className="text-[18px] font-bold">{seenName(current)}{bookedBy(current) ? ` · booked by ${bookedBy(current)}` : ''}</p>
                    <p className="text-[13px] text-white/70">
                      {[current.patient_age && `${current.patient_age}y`, current.patient_gender].filter(Boolean).join(' · ') || 'In consultation'}
                    </p>
                    {current.reason && <p className="truncate text-[12.5px] text-white/85" title={current.reason}>Here for: {current.reason}</p>}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 text-white"
              >
                <Radio className="h-9 w-9 text-white/50" />
                <div>
                  <p className="text-[17px] font-bold">No patient in consultation</p>
                  <p className="text-[13px] text-white/70">{waiting.length ? 'Click Call Next to start the queue.' : 'No one is waiting yet.'}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2.5">
            {current && (
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => act(() => tokensApi.recall(current.token_id))}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/25 disabled:opacity-50"
              >
                <Megaphone className="h-4 w-4" /> Recall
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => act(() => (current ? tokensApi.complete(current.token_id) : tokensApi.next(doctorId)))}
              disabled={busy || (!current && waiting.length === 0)}
              className="hero-cta flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-blue shadow-sm hover:bg-blue-50 disabled:opacity-50"
            >
              {current ? <><CheckCircle2 className="h-4 w-4" /> Complete</> : <><PlayCircle className="h-4 w-4" /> Call Next</>}
            </motion.button>
          </div>
        </div>
        {current && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => act(() => tokensApi.next(doctorId))}
            disabled={busy || waiting.length === 0}
            className="flex w-full items-center justify-center gap-2 border-t border-white/15 bg-white/5 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
          >
            <PlayCircle className="h-4 w-4" /> Complete &amp; Call Next ({waiting.length} waiting)
          </motion.button>
        )}
      </motion.div>

      {/* Up next */}
      <Card className="!p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-brand-navy">Up Next</h3>
          <motion.span
            key={waiting.length}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-600"
          >
            {waiting.length} waiting
          </motion.span>
        </div>
        {unpaidCount > 0 && (
          <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-5 py-2.5 text-[12.5px] font-medium text-amber-800">
            <Wallet className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              {unpaidCount} {unpaidCount === 1 ? 'patient hasn’t' : 'patients haven’t'} paid.
              Tap <span className="font-bold">Collect ₹</span> on their row to take the fee and mark them Paid — the doctor can only call patients once they’re Paid.
            </span>
          </div>
        )}
        {waiting.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <Clock className="h-8 w-8 text-slate-300" />
            <p className="text-sm">The waiting queue is empty.</p>
          </motion.div>
        ) : (
          <ul className="divide-y divide-slate-50">
            <AnimatePresence initial={false}>
              {waiting.map((t) => (
                <motion.li
                  key={t.token_id}
                  layout
                  initial={{ opacity: 0, x: -24, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 28, height: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/70"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-blueLight text-[13px] font-extrabold text-brand-blue">
                      {t.queue_position}
                    </span>
                    <Avatar name={seenName(t)} className="h-9 w-9 text-[11px]" />
                    <div className="min-w-0 leading-tight">
                      <p className="flex items-center gap-1.5 truncate text-[14px] font-bold text-brand-navy">
                        {seenName(t)}
                        {bookedBy(t) && <span className="shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">by {bookedBy(t)}</span>}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-slate-500">{t.display_code}</span>
                        {t.priority !== 'normal' && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PRIORITY_PILL[t.priority] || 'bg-slate-100 text-slate-500'}`}>{t.priority}</span>
                        )}
                        {t.is_walkin && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">walk-in</span>}
                        {/* Journey recorded at booking — tells the desk whether
                            this patient is round the corner or hours out. */}
                        <TravelChip minutes={t.travel_minutes} origin={t.origin_label} />
                        {t.consultation_fee > 0 && !t.consultation_paid ? (
                          <motion.button
                            onClick={() => collectPayment(t)}
                            disabled={busy}
                            title={`Click to collect ₹${t.consultation_fee} and mark this token as Paid`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            animate={{ boxShadow: ['0 0 0 0 rgba(245,158,11,0.5)', '0 0 0 6px rgba(245,158,11,0)', '0 0 0 0 rgba(245,158,11,0)'] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11.5px] font-bold text-white hover:bg-amber-600 disabled:opacity-60"
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Collect ₹{t.consultation_fee}
                            <span className="font-semibold text-white/85">→ mark Paid</span>
                          </motion.button>
                        ) : t.free_revisit ? (
                          // Checked BEFORE "Paid": redeeming a free revisit also
                          // marks the visit paid (so the queue never skips it),
                          // which would otherwise hide why the fee is zero.
                          <FreeRevisitChip info={t.free_revisit} detail />
                        ) : t.consultation_paid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Paid{t.consultation_payment_method ? ` · ${paymentModeLabel(t.consultation_payment_method)}` : ''}
                          </span>
                        ) : (
                          // Fee is zero — nothing was collected, so don't claim
                          // "Paid" on a row the hospital may reconcile against.
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            No fee
                          </span>
                        )}
                      </div>
                      {/* Why they came, as typed at booking (or by the desk for a
                          walk-in). Stored on the appointment; the queue API
                          carries it onto the token row. */}
                      {t.reason && (
                        <p className="mt-1 truncate text-[11.5px] text-slate-500" title={t.reason}>
                          <span className="font-semibold text-slate-400">Reason:</span> {t.reason}
                        </p>
                      )}
                      {t.latest_vitals && (
                        <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${t.latest_vitals.abnormal ? 'text-red-600' : 'text-emerald-600'}`}>
                          <Activity className="h-3 w-3 shrink-0" /> {vitalsSummary(t.latest_vitals) || 'Vitals recorded'}
                          {t.latest_vitals.abnormal && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600">Check</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {t.patient_id && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setVitalsFor(t)}
                        title="Record vitals"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50"
                      >
                        <Activity className="h-4 w-4" />
                      </motion.button>
                    )}
                    {[
                      { icon: Megaphone, title: 'Recall', fn: () => tokensApi.recall(t.token_id), cls: 'border-slate-200 text-slate-500 hover:bg-slate-50' },
                      { icon: SkipForward, title: 'Skip', fn: () => tokensApi.skip(t.token_id), cls: 'border-slate-200 text-slate-500 hover:bg-slate-50' },
                      // Recall and Skip are recoverable; a no-show takes the
                      // patient out of the queue and feeds the hospital's no-show
                      // figures, so it asks first.
                      { icon: XCircle, title: 'No-show', confirm: true, fn: () => tokensApi.missed(t.token_id), cls: 'border-red-200 text-red-500 hover:bg-red-50' },
                    ].map(({ icon: Icon, title, fn, cls, confirm }) => (
                      <motion.button
                        key={title}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={async () => {
                          if (confirm && !(await dialog.confirm({
                            title: `Mark ${seenName(t, 'this patient')} as a no-show?`,
                            message: `Token ${t.display_code} leaves the queue and counts towards the hospital's no-show figures.`,
                            confirmLabel: 'Mark no-show',
                          }))) return
                          act(fn)
                        }}
                        disabled={busy}
                        title={title}
                        className={`flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-50 ${cls}`}
                      >
                        <Icon className="h-4 w-4" />
                      </motion.button>
                    ))}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      <AnimatePresence>
        {vitalsFor && (
          <VitalsModal
            patient={{ patient_id: vitalsFor.patient_id, name: seenName(vitalsFor), uhid: vitalsFor.patient_uhid }}
            appointmentId={vitalsFor.appointment_id}
            defaultFamilyMemberId={vitalsFor.family_member_id}
            onClose={() => setVitalsFor(null)}
            onSaved={() => loadQueue()}
          />
        )}
      </AnimatePresence>
      {collectFor && (
        <CollectPaymentModal
          amount={collectFor.consultation_fee}
          patientName={seenName(collectFor, '')}
          tokenCode={collectFor.display_code}
          onConfirm={async (method) => { await appointmentsApi.collectPayment(collectFor.appointment_id, method); await loadQueue() }}
          onClose={() => setCollectFor(null)}
        />
      )}
    </div>
  )
}
