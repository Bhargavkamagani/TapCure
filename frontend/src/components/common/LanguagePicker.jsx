import { DOCTOR_LANGUAGES } from '../../data/authData.js'

/** Split a stored "English, Hindi" string into clean parts. */
function parse(value) {
  return (value || '').split(',').map((s) => s.trim()).filter(Boolean)
}

/**
 * Checkbox picker for the languages a doctor consults in.
 *
 * Replaces a free-text box that produced eight different strings for three
 * languages — "telugu", "Hindi , telugu", "Telugu ,Hindi", "Engish,Hindi,Telugu".
 * Ticking boxes gives one canonical spelling, casing and separator every time.
 *
 * Stored comma-joined into the SAME string column the API already expects, so
 * no schema, migration or display change is needed anywhere.
 *
 * A stored language that isn't in the catalogue (an older free-text entry, or a
 * typo) is appended to the list and stays ticked, so opening a doctor's record
 * and saving can never silently drop a language.
 */
export default function LanguagePicker({ value = '', onChange, label = 'Languages' }) {
  const selected = parse(value)
  const known = (l) => DOCTOR_LANGUAGES.some((k) => k.toLowerCase() === l.toLowerCase())
  const extras = selected.filter((s) => !known(s))
  const options = [...DOCTOR_LANGUAGES, ...extras]

  const isOn = (l) => selected.some((s) => s.toLowerCase() === l.toLowerCase())

  const toggle = (l) => {
    const next = isOn(l)
      ? selected.filter((s) => s.toLowerCase() !== l.toLowerCase())
      : [...selected, l]
    onChange(next.join(', '))
  }

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</label>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
        {options.map((l) => (
          <label
            key={l}
            className="flex cursor-pointer items-center gap-1.5 text-[13px] text-slate-600"
          >
            <input
              type="checkbox"
              checked={isOn(l)}
              onChange={() => toggle(l)}
              className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className={isOn(l) ? 'font-semibold text-brand-navy' : ''}>{l}</span>
            {!known(l) && <span className="text-[10px] text-slate-400">(existing)</span>}
          </label>
        ))}
      </div>
    </div>
  )
}
