import { useCallback, useEffect, useState } from 'react'
import { X, Plus, Trash2, Pencil, Pill, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { prescriptionsApi, patientsApi, pharmacyApi } from '../../api'
import MedicineSearch from './MedicineSearch.jsx'
import { STOCK_STATUS, isStale, serverDate, timeAgo } from '../pharmacy/stockStatus.js'

// `stock` is the hospital-pharmacy result the doctor picked — display only, never sent.
const blankItem = () => ({ drug_name: '', dosage: '', frequency: '', duration: '', instructions: '', stock_id: null, stock: null, custom: false })

const fmtTime = (iso) => serverDate(iso)?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) || ''

// The doctor taps when the medicine is taken; the line still SAVES in the usual
// "1-0-1 after food" notation, which the prescription print, the pharmacy screen
// and services/medicine_schedule.py (reminder times) already read.
const SLOTS = [['Morning', 0], ['Afternoon', 1], ['Night', 2]]
const FOODS = ['before food', 'after food']

/** How much to take at a time, in the unit that fits the medicine. */
const doseChoices = (item) => {
  const text = `${item.stock?.form || ''} ${item.drug_name}`.toLowerCase()
  if (/syrup|susp|drop|liquid|solution|\bml\b/.test(text)) return ['2.5 ml', '5 ml', '10 ml']
  if (/\bcap/.test(text)) return ['1 capsule', '2 capsules']
  return ['½ tablet', '1 tablet', '2 tablets']
}

/** "1-0-1 after food" -> { slots:[1,0,1], food:'after food' }. Null when the
 *  doctor typed something freer (SOS, weekly once…) that buttons can't show. */
const readFrequency = (text) => {
  const s = (text || '').trim().toLowerCase()
  const food = s.includes('before food') ? 'before food' : s.includes('after food') ? 'after food' : ''
  if (!s) return { slots: [0, 0, 0], food: '' }
  const grid = s.match(/^([01])\s*-\s*([01])\s*-\s*([01])/)
  if (grid) return { slots: [1, 2, 3].map((i) => Number(grid[i])), food }
  // Food on its own is fine — the doctor picked "after food" before the timing.
  return s === food ? { slots: [0, 0, 0], food } : null
}

const writeFrequency = (slots, food) => {
  if (!slots.some(Boolean)) return food
  return `${slots.join('-')}${food ? ` ${food}` : ''}`
}

const Toggle = ({ on, children, ...props }) => (
  <button
    type="button"
    className={`rounded-lg border px-2.5 py-1 text-[13px] font-semibold transition-colors ${
      on ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-blue/50'
    }`}
    {...props}
  >
    {children}
  </button>
)

/**
 * Modal for a doctor to write a prescription for a patient.
 *
 * If this doctor already wrote one at this visit, the new medicines are ADDED
 * to it instead of starting a second prescription for the same consultation —
 * which is what made the earlier medicines look like they had disappeared.
 *
 * Props: patientId, doctorId, appointmentId?, patientName?, defaultFamilyMemberId?, onClose, onSaved?
 */
export default function RxComposer({ patientId, doctorId, appointmentId, patientName, defaultFamilyMemberId, onClose, onSaved }) {
  const [diagnosis, setDiagnosis] = useState('')
  const [advice, setAdvice] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [items, setItems] = useState([blankItem()])
  const [family, setFamily] = useState([])
  const [forWhom, setForWhom] = useState(defaultFamilyMemberId ? String(defaultFamilyMemberId) : 'self')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  // Does the hospital of this visit have a pharmacy stock list, and how old is it.
  // Null (no list, or no access) leaves the medicine box a plain text input.
  const [pharmacy, setPharmacy] = useState(null)
  // The prescription this doctor already wrote at this visit, if any.
  const [existing, setExisting] = useState(null)
  const [separate, setSeparate] = useState(false)
  // Which already-written line is asking "remove?" — an inline confirm, so a
  // mis-tap can't drop a medicine from the record in one click.
  const [confirmRemove, setConfirmRemove] = useState(null)

  useEffect(() => {
    if (!patientId) return
    patientsApi.family(patientId)
      .then((r) => setFamily((r || []).filter((m) => m.is_active)))
      .catch(() => setFamily([]))
  }, [patientId])

  useEffect(() => {
    pharmacyApi.search('', appointmentId)
      .then(setPharmacy)
      .catch(() => setPharmacy(null))
  }, [appointmentId])

  // Pulled out of the effect so correcting or removing a line can refresh the
  // summary straight away — otherwise the doctor fixes a dose and the list
  // above still shows the old one, which reads as "it didn't save".
  const loadExisting = useCallback(() => {
    if (!patientId || !appointmentId) return Promise.resolve()
    return prescriptionsApi.forPatient(patientId)
      .then((list) => {
        // The API returns newest first; the server allows adding for 12 hours.
        const cutoff = Date.now() - 12 * 60 * 60 * 1000
        const mine = (list || []).find((rx) =>
          String(rx.appointment_id) === String(appointmentId)
          && String(rx.doctor_id) === String(doctorId)
          && (serverDate(rx.created_at)?.getTime() || 0) > cutoff)
        setExisting(mine || null)
      })
      .catch(() => setExisting(null))
  }, [patientId, appointmentId, doctorId])

  useEffect(() => { loadExisting() }, [loadExisting])

  const hasPharmacy = !!pharmacy?.has_pharmacy
  const appending = !!existing && !separate

  const patchItem = (i, patch) =>
    setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const setItem = (i, k) => (e) => patchItem(i, { [k]: e.target.value })
  // Typing by hand unlinks the line from whatever stock row was picked before.
  const typeName = (i) => (text) => patchItem(i, { drug_name: text, stock_id: null, stock: null })
  // The strength is already part of the medicine name ("Dolo 650"), so it is NOT
  // copied into the dose box — that box answers "how much to take", which only
  // the doctor can say.
  const pickStock = (i) => (option, drugName) =>
    setItems((list) => list.map((it, idx) => (idx === i
      ? { ...it, drug_name: drugName, stock_id: option.stock_id, stock: option }
      : it)))
  const addItem = () => setItems((list) => [...list, blankItem()])
  const removeItem = (i) => setItems((list) => (list.length > 1 ? list.filter((_, idx) => idx !== i) : list))

  /* Correcting a line already on the prescription.

     The line is loaded into the SAME editor the doctor uses for a new medicine,
     carrying its `item_id`. That keeps one editor instead of two that drift
     apart, and `save` routes by that id: lines with one are corrected in place,
     lines without one are added. `custom` is set from readFrequency so a
     free-text frequency ("SOS") opens in the text box rather than silently
     losing itself in the buttons. */
  const editExisting = (m) => {
    setErr(null)
    setConfirmRemove(null)
    setItems((list) => {
      if (list.some((it) => it.item_id === m.item_id)) return list
      const kept = list.filter((it) => it.drug_name.trim() || it.item_id)
      return [...kept, {
        item_id: m.item_id,
        drug_name: m.drug_name || '',
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        duration: m.duration || '',
        instructions: m.instructions || '',
        stock_id: m.stock_id ?? null,
        stock: null,
        custom: readFrequency(m.frequency) === null,
      }]
    })
  }

  const removeExisting = async (m) => {
    setBusy(true)
    setErr(null)
    try {
      await prescriptionsApi.removeItem(existing.prescription_id, m.item_id)
      setItems((list) => {
        const kept = list.filter((it) => it.item_id !== m.item_id)
        return kept.length ? kept : [blankItem()]
      })
      setConfirmRemove(null)
      await loadExisting()
    } catch (e) {
      // The server refuses once the pharmacy has acted on the line, or once the
      // patient has started the course. Both messages say what to do instead.
      setErr(e.message || 'Could not remove that medicine')
    }
    setBusy(false)
  }

  const toggleSlot = (i, position, current) => {
    const slots = current.slots.map((v, idx) => (idx === position ? (v ? 0 : 1) : v))
    patchItem(i, { frequency: writeFrequency(slots, current.food) })
  }
  const toggleFood = (i, food, current) =>
    patchItem(i, { frequency: writeFrequency(current.slots, current.food === food ? '' : food) })

  const save = async () => {
    const meds = items.filter((it) => it.drug_name.trim())
    if (!meds.length) {
      setErr('Add at least one medicine.')
      return
    }
    /* A blank duration is why over half of prescribed medicines never get a
       reminder: with no end date nothing can be scheduled, and until now that
       failed silently — the doctor was never told, and the patient simply saw
       no reminders. "Ongoing" is a valid answer; empty is not.
       Named per medicine, because a prescription can hold several rows and
       "fill in the duration" would leave the doctor hunting for which. */
    const noDuration = meds.find((it) => !String(it.duration || '').trim())
    if (noDuration) {
      setErr(`How long for ${noDuration.drug_name.trim()}? Enter the days, or tap Ongoing if there is no end date.`)
      return
    }
    setBusy(true)
    setErr(null)
    /* A line carrying an `item_id` came from the prescription already written,
       so it is a CORRECTION and goes to the item endpoint; one without is a new
       medicine and joins the append. Kept as two calls rather than one mixed
       payload because they can fail for different reasons — a correction is
       refused once the pharmacy has handed that medicine over, and that refusal
       must not take the new medicines down with it. */
    const strip = ({ stock, custom, item_id, ...it }) => it // eslint-disable-line no-unused-vars
    const edits = meds.filter((it) => it.item_id)
    const fresh = meds.filter((it) => !it.item_id)
    try {
      if (appending) {
        for (const line of edits) {
          await prescriptionsApi.updateItem(existing.prescription_id, line.item_id, strip(line))
        }
        if (fresh.length) {
          await prescriptionsApi.addItems(existing.prescription_id, {
            items: fresh.map(strip),
            follow_up_date: !existing.follow_up_date && followUp ? followUp : null,
          })
        }
      } else {
        await prescriptionsApi.create({
          patient_id: patientId,
          doctor_id: doctorId,
          appointment_id: appointmentId || null,
          family_member_id: forWhom === 'self' ? null : forWhom,
          diagnosis: diagnosis.trim(),
          advice: advice.trim(),
          follow_up_date: followUp || null,
          items: meds.map(strip),
        })
      }
      onSaved?.()
      onClose()
    } catch (e) {
      setErr(e.message || 'Could not save prescription')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blueLight text-brand-blue"><Pill className="h-5 w-5" /></span>
            <div>
              <h3 className="text-[17px] font-bold text-brand-navy">{appending ? 'Add to Prescription' : 'Write Prescription'}</h3>
              {patientName && <p className="text-[13px] text-slate-400">For {patientName}</p>}
              {hasPharmacy && (
                <p className={`text-[13px] font-semibold ${isStale(pharmacy.last_updated_at) ? 'text-amber-600' : 'text-emerald-700'}`}>
                  Hospital pharmacy stock · updated {timeAgo(pharmacy.last_updated_at)}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {/* Already prescribed at this visit — new medicines join this prescription. */}
        {existing && (
          <div className={`mb-3 rounded-xl border px-3 py-2.5 ${separate ? 'border-slate-200 bg-slate-50' : 'border-emerald-100 bg-emerald-50/70'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-navy">
                <FileText className="h-4 w-4 text-emerald-700" />
                {separate
                  ? 'You already prescribed at this visit'
                  : `Adding to the prescription you wrote at ${fmtTime(existing.created_at)}`}
              </p>
              <button
                type="button"
                onClick={() => setSeparate((v) => !v)}
                className="text-[13px] font-semibold text-brand-blue hover:underline"
              >
                {separate ? 'Add to that prescription instead' : 'Write a separate prescription instead'}
              </button>
            </div>
            {/* Read-only while writing a SEPARATE prescription: those lines
                belong to the other one, and offering to edit them there would
                blur which prescription the doctor is working on. */}
            {separate ? (
              <p className="mt-1 text-[13px] text-slate-600">
                {(existing.items || []).map((m) => m.drug_name).join(', ') || 'No medicines on it'}
                {existing.diagnosis ? ` · ${existing.diagnosis}` : ''}
              </p>
            ) : (
              <div className="mt-1.5 space-y-1">
                {(existing.items || []).length === 0 && (
                  <p className="text-[13px] text-slate-600">No medicines on it</p>
                )}
                {(existing.items || []).map((m) => {
                  const editing = items.some((it) => it.item_id === m.item_id)
                  const detail = [m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')
                  return (
                    <div key={m.item_id} className="flex items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-600">
                        <span className="font-semibold text-brand-navy">{m.drug_name}</span>
                        {detail ? ` · ${detail}` : ''}
                      </span>
                      {editing ? (
                        <span className="shrink-0 text-[13px] font-semibold text-brand-blue">Editing below</span>
                      ) : confirmRemove === m.item_id ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeExisting(m)}
                            className="shrink-0 rounded-lg bg-red-500 px-2 py-0.5 text-[13px] font-semibold text-white disabled:opacity-60"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemove(null)}
                            className="shrink-0 px-1 text-[13px] font-semibold text-slate-500 hover:underline"
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            title={`Correct ${m.drug_name}`}
                            onClick={() => editExisting(m)}
                            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-brand-blueLight/50 hover:text-brand-blue"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={`Remove ${m.drug_name}`}
                            onClick={() => setConfirmRemove(m.item_id)}
                            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
                {existing.diagnosis && (
                  <p className="px-2 text-[13px] text-slate-500">{existing.diagnosis}</p>
                )}
              </div>
            )}
          </div>
        )}

        {!appending && family.length > 0 && (
          <div className="mb-3">
            <label className="mb-1 block text-[13px] font-semibold text-slate-600">Prescription for</label>
            <select value={forWhom} onChange={(e) => setForWhom(e.target.value)} className="field-input">
              <option value="self">{patientName || 'Self'}</option>
              {family.map((m) => (
                <option key={m.member_id} value={String(m.member_id)}>{m.name}{m.relation ? ` — ${m.relation}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {!appending && (
          <div className="mb-3">
            <label className="mb-1 block text-[13px] font-semibold text-slate-600">Diagnosis</label>
            <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Viral fever" className="field-input" />
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <label className="text-[13px] font-semibold text-slate-600">{appending ? 'More medicines' : 'Medicines'}</label>
          <button onClick={addItem} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[13px] font-semibold text-brand-blue hover:bg-brand-blueLight/40">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, i) => {
            const timing = readFrequency(it.frequency)
            const buttonsOff = it.custom || timing === null   // free text the buttons can't show
            const current = timing || { slots: [0, 0, 0], food: '' }
            return (
              <div key={i} className="rounded-xl border border-slate-100 p-2.5">
                <div className="flex items-center gap-2">
                  <MedicineSearch
                    value={it.drug_name}
                    enabled={hasPharmacy}
                    appointmentId={appointmentId}
                    onType={typeName(i)}
                    onPick={pickStock(i)}
                  />
                  <button onClick={() => removeItem(i)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
                {hasPharmacy && it.drug_name.trim() && (
                  <p className="mt-1.5 flex items-center gap-1.5 px-1 text-[13px]">
                    {it.stock ? (
                      <>
                        <span className={`h-2 w-2 rounded-full ${STOCK_STATUS[it.stock.status].dot}`} />
                        {/* Status only — the doctor doesn't need the shelf count. */}
                        <span className="font-semibold text-slate-600">
                          {STOCK_STATUS[it.stock.status].label} at hospital pharmacy
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">Not from hospital pharmacy. Patient may buy it outside.</span>
                    )}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Dose</span>
                  {doseChoices(it).map((dose) => (
                    <Toggle
                      key={dose}
                      on={it.dosage === dose}
                      onClick={() => patchItem(i, { dosage: it.dosage === dose ? '' : dose })}
                    >
                      {dose}
                    </Toggle>
                  ))}
                  <input
                    value={doseChoices(it).includes(it.dosage) ? '' : it.dosage}
                    onChange={setItem(i, 'dosage')}
                    placeholder="or type (1 sachet…)"
                    className="field-input w-40"
                  />
                </div>

                {buttonsOff ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={it.frequency}
                      onChange={setItem(i, 'frequency')}
                      placeholder="Frequency (1-0-1, SOS, weekly once…)"
                      className="field-input flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => patchItem(i, { custom: false, frequency: readFrequency(it.frequency) ? it.frequency : '' })}
                      className="shrink-0 text-[13px] font-semibold text-brand-blue hover:underline"
                    >
                      Use buttons
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">When</span>
                    {SLOTS.map(([label, position]) => (
                      <Toggle key={label} on={!!current.slots[position]} onClick={() => toggleSlot(i, position, current)}>
                        {label}
                      </Toggle>
                    ))}
                    <span className="ml-1 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Food</span>
                    {FOODS.map((food) => (
                      <Toggle key={food} on={current.food === food} onClick={() => toggleFood(i, food, current)}>
                        {food === 'before food' ? 'Before food' : 'After food'}
                      </Toggle>
                    ))}
                    <button
                      type="button"
                      onClick={() => patchItem(i, { custom: true })}
                      className="ml-auto text-[13px] font-semibold text-brand-blue hover:underline"
                    >
                      Type instead
                    </button>
                  </div>
                )}

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {/* Duration is required now, but "Ongoing" counts as an
                      answer. Forcing a number would make a doctor invent one
                      for lifelong medication — and reminders that stop after a
                      made-up 90 days are worse than none at all. */}
                  <div className="flex items-center gap-2">
                    <input
                      value={it.duration}
                      onChange={setItem(i, 'duration')}
                      placeholder="Duration (5 days) *"
                      className="field-input flex-1"
                    />
                    <Toggle
                      on={/ongoing/i.test(it.duration || '')}
                      onClick={() => patchItem(i, {
                        duration: /ongoing/i.test(it.duration || '') ? '' : 'Ongoing',
                      })}
                    >
                      Ongoing
                    </Toggle>
                  </div>
                  <input value={it.instructions} onChange={setItem(i, 'instructions')} placeholder="Other instructions (optional)" className="field-input" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {!appending && (
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-slate-600">Advice</label>
              <input value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="Rest, fluids…" className="field-input" />
            </div>
          )}
          {(!appending || !existing?.follow_up_date) && (
            <div>
              <label className="mb-1 block text-[13px] font-semibold text-slate-600">Follow-up date</label>
              <input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="field-input" />
            </div>
          )}
          {appending && existing?.follow_up_date && (
            <p className="self-end text-[13px] text-slate-500">Follow-up already set for {existing.follow_up_date}</p>
          )}
        </div>

        {err && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {err}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
            <CheckCircle2 className="h-4 w-4" /> {busy ? 'Saving…' : (appending ? 'Add to Prescription' : 'Save Prescription')}
          </button>
        </div>
      </div>
    </div>
  )
}
