import { useEffect, useState, useCallback } from 'react'
import { CalendarOff, Plus, Trash2, X } from 'lucide-react'
import { Card, StatusBadge, ToolButton } from '../../components/hospital/ui.jsx'
import { TextInput, Banner } from '../../components/common/FormControls.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { doctorsApi } from '../../api'
import { prettyDate, todayISO } from '../../lib/format.js'
import { useDialog } from '../../components/common/DialogProvider.jsx'

function AddHolidayModal({ onClose, onSave }) {
  const [date, setDate] = useState(todayISO())
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({ holiday_date: date, reason, is_full_day: true })
      onClose()
    } catch (err) {
      setError(err.message || 'Could not add holiday.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[17px] font-bold text-brand-navy">Add Holiday / Leave</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-4"><Banner type="error">{error}</Banner></div>}
        <div className="space-y-3">
          <TextInput label="Date" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} required />
          <TextInput label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Personal leave, Public holiday" />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <ToolButton type="button" onClick={onClose}>Cancel</ToolButton>
          <ToolButton type="submit" tone="primary" disabled={saving}>{saving ? 'Saving…' : 'Add'}</ToolButton>
        </div>
      </form>
    </div>
  )
}

export function HolidaysPanel() {
  const dialog = useDialog()
  const { doctorId } = useDoctorCtx()
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  // Adding a holiday can now cancel other people's appointments, so it has to
  // report what it did — "saved" alone hides the fact that eight patients were
  // just told not to travel.
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    if (!doctorId) return
    setLoading(true)
    try {
      setHolidays((await doctorsApi.holidays(doctorId)) || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [doctorId])

  useEffect(() => { load() }, [load])

  const add = async (body) => {
    const payload = { doctor_id: doctorId, ...body }
    try {
      await doctorsApi.addHoliday(payload)
      load()
      return
    } catch (e) {
      // 409 is not a failure — it's the server refusing until the doctor has
      // seen who is booked that day. Anything else is a real error.
      if (e?.status !== 409 || e?.detail?.code !== 'holiday_has_bookings') throw e
      const d = e.detail || {}
      const booked = (d.today_count || 0) + (d.future_count || 0)
      const ok = await dialog.confirm({
        title: `Mark this day off and cancel ${booked} appointment${booked === 1 ? '' : 's'}?`,
        message:
          `${booked} appointment${booked === 1 ? ' is' : 's are'} booked that day. `
          + 'They will be cancelled and those patients told not to travel.'
          + (d.paid_count ? ` ${d.paid_count} paid the booking fee online — they get a free rebooking, and the message tells them so.` : '')
          + (d.today_count ? ` This includes ${d.today_count} appointment(s) TODAY — those patients may already be travelling.` : ''),
        confirmLabel: 'Cancel them and mark day off',
        tone: 'danger',
      })
      if (!ok) return
      const res = await doctorsApi.addHoliday(payload, { confirm: true })
      if (res?.cancelled) {
        setError(null)
        setNotice(`Holiday added. ${res.cancelled} appointment(s) cancelled and those patients notified`
          + (res.free_rebooks_granted ? `, ${res.free_rebooks_granted} given a free rebooking.` : '.'))
      }
      load()
    }
  }
  const remove = async (id) => {
    if (!(await dialog.confirm({ title: 'Remove this holiday?', message: 'You will be shown as available on this date again.', confirmLabel: 'Remove' }))) return
    try {
      await doctorsApi.removeHoliday(id)
      load()
    } catch (e) {
      setError(e.message || 'Could not remove holiday.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-brand-navy">Holidays &amp; Leave</h3>
          <p className="text-[12px] font-medium text-slate-500">Mark days you&apos;re unavailable.</p>
        </div>
        <ToolButton icon={Plus} tone="primary" onClick={() => setAdding(true)}>Add Holiday</ToolButton>
      </div>

      {error && <Banner type="error">{error}</Banner>}
      {notice && <Banner type="success">{notice}</Banner>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : holidays.length === 0 ? (
        <Card className="p-8 text-center"><p className="text-[14px] font-semibold text-brand-navy">No holidays scheduled.</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {holidays.map((h) => (
            <Card key={h.holiday_id} className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500"><CalendarOff className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-brand-navy">{h.reason || 'Holiday'}</p>
                <p className="text-[12.5px] text-slate-500">{prettyDate(h.holiday_date)}</p>
                <div className="mt-2"><StatusBadge status={h.is_full_day ? 'Unavailable' : 'Partial'} /></div>
              </div>
              <button onClick={() => remove(h.holiday_id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </Card>
          ))}
        </div>
      )}

      {adding && <AddHolidayModal onClose={() => setAdding(false)} onSave={add} />}
    </div>
  )
}

/** Standalone page wrapper (route kept for direct access, no longer in sidebar). */
function Holidays() {
  return (
    <div className="flex flex-col gap-4">
      <HolidaysPanel />
    </div>
  )
}

export default Holidays
