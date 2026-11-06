import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Phone, CheckCircle2, Ticket, Clock, Stethoscope, AlertTriangle, MapPin, Gift } from 'lucide-react'
import { Card, PageHeading, Avatar } from '../../components/hospital/ui.jsx'
import { TextInput } from '../../components/common/FormControls.jsx'
import { doctorsApi, appointmentsApi, tokensApi, patientsApi, revisitPassesApi } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { todayISO } from '../../lib/format.js'
import { seenName } from '../../lib/patientDisplay.js'
import { toMobile } from '../../lib/phone.js'
import WhatsAppAlertsToggle from '../../components/common/WhatsAppAlertsToggle.jsx'
import { joinName, nameFields, nameParts } from '../../lib/personName.js'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

const TOKEN_STATUS = {
  waiting: 'Waiting',
  called: 'Called in',
  in_progress: 'In consultation',
  completed: 'Completed',
  missed: 'No-show',
  cancelled: 'Cancelled',
}

// Priority selection removed; all walk-ins use 'normal' priority.

export default function AssistantWalkIn() {
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({ doctor_id: '', first_name: '', last_name: '', phone: '', gender: '', blood_group: '', city: '', priority: 'normal', whatsapp_alerts: false })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState([])
  const [banner, setBanner] = useState(null)
  const [match, setMatch] = useState(null)        // existing patient on this phone
  const [checking, setChecking] = useState(false)
  const [useMatch, setUseMatch] = useState(false) // reception confirmed to use the matched record
  const [matchError, setMatchError] = useState(null)
  const [doctorsLoaded, setDoctorsLoaded] = useState(false)
  // A free revisit the confirmed patient holds with the chosen doctor, if any.
  const [freePass, setFreePass] = useState(null)
  const { user } = useAuth()
  const myHospitalId = user?.hospital_id
  // A hit from another hospital can't be reused here — hospital data is tenant-scoped.
  const matchIsLocal = match ? match.hospital_id === myHospitalId : false

  /**
   * Today's walk-in tokens, from the server.
   *
   * `issued` used to be a per-mount log: it started empty and only grew when
   * THIS component instance issued a token. The receptionist console swaps
   * pages through an <Outlet/>, so stepping over to the Queue and back
   * unmounted this page and wiped the list — the tokens were still live in the
   * database, but the card read "No walk-ins issued yet." A refresh, or a
   * second receptionist on another machine, saw the same empty card.
   *
   * Tokens carry `appointment_id` but no patient name, so the names come from
   * today's appointments (which do carry them) and are joined on that id — no
   * per-token lookup, and no backend change.
   */
  const loadIssued = useCallback(async (docs) => {
    if (!docs?.length) return
    const today = todayISO()
    const [lists, appts] = await Promise.all([
      Promise.all(docs.map((d) =>
        tokensApi.history(d.doctor_id, today)
          .then((rows) => ({ rows: rows || [], doc: d }))
          .catch(() => ({ rows: [], doc: d })),
      )),
      appointmentsApi.list({ date: today, size: 200 }).catch(() => []),
    ])
    const nameByAppt = Object.fromEntries((appts || []).map((a) => [a.appointment_id, seenName(a)]))
    const rows = lists.flatMap(({ rows: tokens, doc }) =>
      tokens
        .filter((t) => t.is_walkin)
        .map((t) => ({
          id: t.token_id,
          code: t.display_code,
          name: nameByAppt[t.appointment_id] || 'Walk-in patient',
          doctor: doc.name,
          status: t.status,
        })),
    )
    rows.sort((a, b) => String(b.id).localeCompare(String(a.id)))   // newest first (v7 ids sort by time)
    setIssued(rows)
  }, [])

  useEffect(() => {
    doctorsApi.list({ bookable: true })
      .then((d) => {
        setDoctors(d)
        if (d.length) setForm((f) => ({ ...f, doctor_id: String(d[0].doctor_id) }))
        loadIssued(d)
      })
      .catch((e) => setBanner({ type: 'error', msg: e.message || 'Could not load doctors.' }))
      .finally(() => setDoctorsLoaded(true))
  }, [loadIssued])

  // Look up an existing patient as soon as a full mobile number is entered, so a
  // returning patient is matched (not re-registered) and reception confirms it.
  //
  // Search can also return someone anchored to ANOTHER hospital who once booked
  // here. That's a different situation: the walk-in endpoint find-or-creates
  // strictly within this hospital, so their visit lands on a new local record.
  // Prefer a record at this hospital, and let the card say which case it is.
  useEffect(() => {
    const phone = form.phone
    setUseMatch(false)
    setMatchError(null)
    if (!/^\d{10}$/.test(phone)) { setMatch(null); return }
    setChecking(true)
    const id = setTimeout(() => {
      patientsApi.search(phone)
        .then((rows) => {
          const hits = (rows || []).filter((p) => p.phone === phone)
          setMatch(hits.find((p) => p.hospital_id === myHospitalId) || hits[0] || null)
        })
        .catch((e) => {
          setMatch(null)
          // Don't fail silently — the desk would register someone as new
          // without ever being told we couldn't check.
          setMatchError(e.message || "Couldn't check this number against existing patients.")
        })
        .finally(() => setChecking(false))
    }, 350)
    return () => clearTimeout(id)
  }, [form.phone, myHospitalId])

  const applyMatch = () => {
    if (!match) return
    // Carry across what the existing record already knows, so the desk isn't
    // asked again for a returning patient's gender/blood group.
    setForm((f) => ({
      ...f,
      first_name: nameParts(match).first || f.first_name,
      last_name: nameParts(match).last || f.last_name,
      gender: match.gender || f.gender,
      blood_group: match.blood_group || f.blood_group,
      city: match.city || f.city,
    }))
    setUseMatch(true)
    setErrors((e) => ({ ...e, name: undefined, match: undefined }))
  }

  // Once the desk confirms an existing patient and picks a doctor, check for a
  // free revisit with THAT doctor (passes are per doctor). Quiet on failure —
  // a missing perk must never block registering the visit.
  useEffect(() => {
    setFreePass(null)
    if (!match || !useMatch || !form.doctor_id) return undefined
    let active = true
    revisitPassesApi.lookup(match.patient_id, form.doctor_id)
      .then((p) => { if (active) setFreePass(p || null) })
      .catch(() => {})
    return () => { active = false }
  }, [match, useMatch, form.doctor_id])

  // Spend it: the server makes today's ₹0 visit and issues the token in one go.
  const redeemFreeRevisit = async () => {
    if (!freePass) return
    setBusy(true)
    setBanner(null)
    try {
      const r = await revisitPassesApi.redeem(freePass.pass_id)
      const doc = doctors.find((d) => String(d.doctor_id) === String(form.doctor_id))
      setIssued((list) => [
        { id: r.token_id, code: r.display_code, name: freePass.for_name || match?.name, doctor: doc?.name, wait: null, status: 'waiting' },
        ...list.filter((t) => t.id !== r.token_id),
      ])
      loadIssued(doctors)
      setBanner({ type: 'success', msg: `Free revisit used — token ${r.display_code || r.token_number} issued, no fee` })
      setForm((f) => ({ ...f, first_name: '', last_name: '', phone: '', gender: '', blood_group: '', city: '', priority: 'normal', whatsapp_alerts: false }))
      setMatch(null)
      setUseMatch(false)
      setFreePass(null)
    } catch (e2) {
      setBanner({ type: 'error', msg: e2.message || 'Could not use the free revisit' })
    }
    setBusy(false)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'phone' ? toMobile(e.target.value) : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const err = {}
    if (!form.doctor_id) err.doctor_id = 'Select a doctor'
    if (!form.first_name.trim()) err.first_name = 'Required'
    if (!/^\d{10}$/.test(form.phone)) err.phone = 'Enter a valid 10-digit number'
    // If this number already belongs to a patient, make reception acknowledge it
    // (the visit attaches to that record — no second registration is created).
    if (match && !useMatch) err.match = 'This number is already registered — confirm the patient below.'
    setErrors(err)
    if (Object.keys(err).length) return

    setBusy(true)
    setBanner(null)
    try {
      const appt = await appointmentsApi.walkIn({
        doctor_id: form.doctor_id,
        ...nameFields(form.first_name, form.last_name),
        phone: form.phone,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        city: form.city.trim() || null,
        whatsapp_alerts: form.whatsapp_alerts,
      })
      const { token, estimate } = await tokensApi.generate(appt.appointment_id, form.priority)
      const doc = doctors.find((d) => String(d.doctor_id) === String(form.doctor_id))
      // Optimistic row for instant feedback (it carries the live wait estimate,
      // which the history endpoint doesn't return), then reconcile with the
      // server so the card survives leaving the page.
      setIssued((list) => [
        { id: token.token_id, code: token.display_code, name: joinName(form.first_name, form.last_name), doctor: doc?.name, wait: estimate?.wait_min, status: 'waiting' },
        ...list.filter((t) => t.id !== token.token_id),
      ])
      loadIssued(doctors)
      setBanner({ type: 'success', msg: `Token ${token.display_code} issued — est. wait ~${estimate?.wait_min ?? '—'} min` })
      setForm((f) => ({ ...f, first_name: '', last_name: '', phone: '', gender: '', blood_group: '', city: '', priority: 'normal', whatsapp_alerts: false }))
      setMatch(null)
      setUseMatch(false)
    } catch (e2) {
      setBanner({ type: 'error', msg: e2.message || 'Could not register walk-in' })
    }
    setBusy(false)
  }

  const doc = doctors.find((d) => String(d.doctor_id) === String(form.doctor_id))

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Register Walk-in" subtitle="Add a walk-in patient and issue a queue token instantly." />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-slate-600">Doctor</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                  {doc && <Avatar name={doc.name} className="h-7 w-7 text-[9px]" />}
                  <select value={form.doctor_id} onChange={set('doctor_id')} disabled={doctors.length === 0}
                    className="w-full bg-transparent py-2.5 text-sm font-medium text-brand-navy outline-none disabled:text-slate-400">
                    {doctors.length === 0 ? (
                      <option value="">No doctors available</option>
                    ) : (
                      doctors.map((d) => (
                        <option key={d.doctor_id} value={d.doctor_id}>{d.name} — {d.specialization}</option>
                      ))
                    )}
                  </select>
                </div>
                {doctorsLoaded && doctors.length === 0 && (
                  <p className="mt-1 text-[11.5px] text-amber-700">
                    No active, verified doctor at this hospital — a walk-in can't be registered until one is
                    available. Add or activate a doctor from Hospital &rarr; Doctors.
                  </p>
                )}
                {errors.doctor_id && <p className="mt-1 text-xs text-red-500">{errors.doctor_id}</p>}
              </div>

              <div className="col-span-full grid grid-cols-2 gap-3"><TextInput icon={UserPlus} placeholder="First Name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} /><TextInput placeholder="Last Name (optional)" value={form.last_name} onChange={set('last_name')} /></div>
              <TextInput icon={Phone} prefix="+91" placeholder="Mobile Number" inputMode="numeric" value={form.phone} onChange={set('phone')} error={errors.phone} />

              <div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.gender} onChange={set('gender')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none">
                    <option value="">Gender (optional)</option>
                    <option>Male</option><option>Female</option><option>Other</option>
                  </select>
                  <select value={form.blood_group} onChange={set('blood_group')} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none">
                    <option value="">Blood group (optional)</option>
                    {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div className="mt-3">
                  <TextInput icon={MapPin} placeholder="City / Village (optional)" value={form.city} onChange={set('city')} />
                </div>
                <p className="mt-1 px-1 text-[11px] text-slate-400">Saved to the patient record — skip if the queue is busy.</p>
              </div>

              {/* Existing-patient match → confirm (no duplicate registration) */}
              <AnimatePresence>
                {checking && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[12px] text-slate-400">
                    Checking this number…
                  </motion.p>
                )}
                {match && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    className={`rounded-xl border p-3 ${useMatch ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/70'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={match.name} className="h-10 w-10 text-[12px]" />
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${useMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {useMatch
                            ? 'Using existing record'
                            : matchIsLocal ? 'Existing patient found' : 'Known from another hospital'}
                        </p>
                        <p className="truncate text-[14px] font-bold text-brand-navy">{match.name}</p>
                        <p className="text-[11.5px] text-slate-500">{[match.uhid, match.phone].filter(Boolean).join(' · ')}</p>
                      </div>
                      {useMatch ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      ) : (
                        <button type="button" onClick={applyMatch} className="shrink-0 rounded-lg bg-brand-blue px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-blueDark">
                          Use this patient
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-[11.5px] text-slate-500">
                      {matchIsLocal
                        ? "This walk-in will be added to this patient's record — no new registration."
                        : 'This patient is registered at another hospital, so we can’t write to that record. '
                          + 'A record will be created here under the same mobile number, and their visits here stay with this hospital.'}
                      {!useMatch && ' Confirm to continue.'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {errors.match && !useMatch && <p className="-mt-1 text-xs text-red-500">{errors.match}</p>}
              {freePass && (
                <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Gift className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="text-[13px] font-extrabold text-emerald-900">Free revisit available{freePass.for_name ? ` for ${freePass.for_name}` : ''}</p>
                      <p className="mt-0.5 text-[11.5px] text-emerald-800/80">
                        With Dr. {freePass.doctor_name} · paid visit on {new Date(`${freePass.issued_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · free until {new Date(`${freePass.valid_until}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={redeemFreeRevisit} disabled={busy}
                    className="mt-2.5 w-full rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {busy ? 'Issuing token…' : 'Use free revisit (₹0) — issue token'}
                  </button>
                  <p className="mt-1.5 text-[11px] text-slate-500">Registering below instead charges the normal fee and keeps the free revisit for later.</p>
                </div>
              )}
              {matchError && (
                <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] font-medium text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {matchError} You can still register — check afterwards that this isn’t a duplicate.
                </p>
              )}

              <WhatsAppAlertsToggle checked={form.whatsapp_alerts} onChange={(v) => setForm((f) => ({ ...f, whatsapp_alerts: v }))} />
              {/* Priority selection removed; priority stays 'normal'. */}

              <AnimatePresence>
                {banner && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm ${banner.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
                  >
                    {banner.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {banner.msg}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={busy || doctors.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60"
              >
                <Ticket className="h-4 w-4" /> {busy ? 'Issuing token…' : 'Register & Issue Token'}
              </motion.button>
            </form>
          </Card>
        </motion.div>

        {/* Issued tokens */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="!p-0">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-[15px] font-bold text-brand-navy">Tokens Issued</h3>
              <span className="text-[11px] font-semibold text-slate-400">today</span>
            </div>
            {issued.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
                <Stethoscope className="h-8 w-8 text-slate-200" />
                <p className="text-sm">No walk-ins issued today.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                <AnimatePresence initial={false}>
                  {issued.map((t) => (
                    <motion.li
                      key={t.id}
                      initial={{ opacity: 0, x: -24, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className="flex items-center gap-3 px-5 py-3"
                    >
                      <motion.span
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </motion.span>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-[14px] font-bold text-brand-navy">{t.code} · {t.name}</p>
                        <p className="flex items-center gap-1 text-[11px] text-slate-400"><Clock className="h-3 w-3" /> {t.doctor} · {t.wait != null ? `est. ~${t.wait} min` : (TOKEN_STATUS[t.status] || t.status || '—')}</p>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
