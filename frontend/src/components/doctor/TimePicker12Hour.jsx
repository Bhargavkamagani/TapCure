const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

function splitTime(value = '09:00') {
  const [rawHour = '9', minute = '00'] = value.split(':')
  const hour24 = Number(rawHour)
  return {
    hour: String(hour24 % 12 || 12),
    minute: MINUTES.includes(minute) ? minute : String(Math.round(Number(minute) / 5) * 5 % 60).padStart(2, '0'),
    period: hour24 >= 12 ? 'PM' : 'AM',
  }
}

function joinTime(hour, minute, period) {
  let hour24 = Number(hour) % 12
  if (period === 'PM') hour24 += 12
  return `${String(hour24).padStart(2, '0')}:${minute}`
}

export default function TimePicker12Hour({ label, value, onChange, error = false }) {
  const current = splitTime(value)
  const update = (part, next) => {
    const changed = { ...current, [part]: next }
    onChange(joinTime(changed.hour, changed.minute, changed.period))
  }
  const selectClass = `h-12 rounded-xl border bg-white px-2 text-[14px] font-bold text-brand-navy outline-none transition focus:ring-4 focus:ring-teal-500/10 ${error ? 'border-red-300' : 'border-slate-200 focus:border-teal-500'}`

  return (
    <fieldset className="min-w-[230px] rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <legend className="px-1 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</legend>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold uppercase text-slate-400">Hour</span>
          <select aria-label={`${label} hour`} value={current.hour} onChange={(e) => update('hour', e.target.value)} className={`w-full ${selectClass}`}>
            {HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold uppercase text-slate-400">Minutes</span>
          <select aria-label={`${label} minutes`} value={current.minute} onChange={(e) => update('minute', e.target.value)} className={`w-full ${selectClass}`}>
            {MINUTES.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-semibold uppercase text-slate-400">AM/PM</span>
          <select aria-label={`${label} AM or PM`} value={current.period} onChange={(e) => update('period', e.target.value)} className={selectClass}>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </label>
      </div>
    </fieldset>
  )
}
