import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, IndianRupee, Lock, Save } from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { doctorsApi, revisitPassesApi } from '../../api'

/**
 * The consultation fee is set by the hospital, not the doctor — so that card is
 * read-only. The hospital admin manages it from the Doctors page.
 *
 * The free revisit lives on this page rather than a page of its own because it
 * IS a fee decision — a waiver of the next consultation — and whoever owns the
 * fee owns the waiver. That rule is enforced server-side, not here.
 */

/**
 * "Free revisit" — how many days after a paid consultation a patient may come
 * back to this doctor at no charge.
 *
 * One card per practice, because a doctor may consult at a hospital AND run their
 * own: the hospital's window is theirs to set, the doctor's own practice is the
 * doctor's. `editable` comes from the server, which is the only side that knows
 * which is which — the frontend must not infer it from `is_self_registered`,
 * because a self-registered doctor can later join a hospital and hold both.
 *
 * The number is a digit-filtered text input rather than <input type="number">
 * on purpose — a focused number input changes value on mouse-wheel scroll, and
 * silently turning a 15-day window into a 5-day one is exactly the kind of bug
 * nobody notices until a patient is refused at the counter.
 */
export function RevisitWindowCard({ row, onSaved }) {
  const [days, setDays] = useState(row.days == null ? '' : String(row.days))
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState(null)

  const save = async () => {
    const trimmed = days.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value !== null && (!Number.isFinite(value) || value < 1 || value > 365)) {
      setNote({ type: 'error', text: 'Enter a number of days between 1 and 365, or leave it blank to turn the offer off.' })
      return
    }
    setSaving(true)
    setNote(null)
    try {
      const saved = await doctorsApi.updateAffiliation(row.affiliation_id, { free_revisit_days: value })
      const applied = saved.free_revisit_days
      setDays(applied == null ? '' : String(applied))
      setNote(applied
        ? { type: 'success', text: `Saved. Patients may see you again free within ${applied} days of a paid consultation.` }
        : { type: 'success', text: 'Saved. This practice does not offer a free revisit.' })
      onSaved?.()
    } catch (e) {
      setNote({ type: 'error', text: e.message || 'Could not save the free revisit window.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="w-full p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <h3 className="text-[16px] font-bold text-brand-navy">Free Revisit</h3>
          </div>
          <p className="mt-1 text-[13.5px] text-slate-500">
            {row.practice_name ? <span className="font-semibold text-slate-600">{row.practice_name} · </span> : null}
            After a paid consultation, a patient may see you again free of charge within
            this many days. They walk in — no booking needed.
          </p>
        </div>
      </div>

      {row.editable ? (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Days</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              inputMode="numeric"
              value={days}
              placeholder="e.g. 15"
              onChange={(e) => { setDays(e.target.value.replace(/[^0-9]/g, '')); setNote(null) }}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[16px] font-bold text-brand-navy outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
            />
            <span className="flex-1 text-[13.5px] text-slate-400">
              {days.trim() === '' ? 'not offered' : 'days from the consultation date'}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md bg-brand-blue px-2.5 text-[13px] font-bold text-white transition hover:bg-brand-blueDark disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[78px]"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-[26px] font-extrabold leading-none text-brand-navy">
              {row.days == null ? 'Not offered' : `${row.days} days`}
            </p>
            {row.days != null && (
              <span className="text-[13px] text-slate-400">from the consultation date</span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[13.5px] text-slate-500">
            <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Set by your hospital, like your fee. Contact your hospital admin to change it.
          </div>
        </>
      )}

      {note && (
        <div className={`mt-4 rounded-xl border px-3.5 py-2.5 text-[13.5px] font-medium ${
          note.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {note.text}
        </div>
      )}
    </Card>
  )
}

function Fees() {
  const { doctor, loading } = useDoctorCtx()
  const [windows, setWindows] = useState(null)

  const loadWindows = useCallback(() => {
    // Failure is silent: the consultation fee is the page's job, and a missing
    // revisit window must never blank it.
    revisitPassesApi.windows().then((r) => setWindows(r || [])).catch(() => setWindows([]))
  }, [])

  useEffect(() => { loadWindows() }, [loadWindows])

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!doctor) return <p className="text-sm text-slate-400">No doctor profile found.</p>

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Consultation Fee" subtitle="Your consultation fee, set by the hospital." />

      <Card className="flex items-center gap-4 md:max-w-md">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-blueLight text-brand-blue">
          <IndianRupee className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-brand-navy">Standard Consultation</p>
          <p className="text-[13.5px] text-slate-500">{doctor.specialization}</p>
        </div>
        <div className="text-right">
          <p className="text-[26px] font-extrabold leading-none text-brand-navy">₹{Number(doctor.consultation_fee)}</p>
          <p className="text-[13px] text-slate-400">per visit</p>
        </div>
      </Card>

      <div className="flex items-center gap-2 text-[13.5px] text-slate-500 md:max-w-md">
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        This fee is set by your hospital. Contact your hospital admin to change it.
      </div>

      {(windows || []).map((row) => (
        <RevisitWindowCard key={row.affiliation_id} row={row} onSaved={loadWindows} />
      ))}
    </div>
  )
}

export default Fees
