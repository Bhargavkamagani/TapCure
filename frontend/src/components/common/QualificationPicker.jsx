import { Award, X } from 'lucide-react'
import { SelectInput } from './FormControls.jsx'
import { QUALIFICATION_GROUPS } from '../../data/authData.js'

/**
 * Qualification picker for doctor registration and the doctor profile.
 *
 * Replaces a free-text box that accepted literally anything (a registering
 * doctor could enter "Mechanical Engineer"). Specialization was already a
 * dropdown; this brings qualification in line.
 *
 * Multi-select, because a doctor normally holds several degrees — MBBS, then an
 * MD, then possibly a super-specialty. Selections are stored comma-joined into
 * the SAME single string the API already expects, so nothing changes in the
 * schema, the database column, or any screen that displays the value.
 *
 * Anything already stored that isn't in the catalogue (typed before this
 * existed) is preserved and shown as a chip, so opening the profile and saving
 * never silently drops a real qualification.
 */
export default function QualificationPicker({
  value = '',
  onChange,
  label = 'Qualification',
  required = false,
  error,
}) {
  const selected = value
    ? value.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const add = (event) => {
    const picked = event.target.value
    if (!picked || selected.includes(picked)) return
    onChange([...selected, picked].join(', '))
  }

  const remove = (q) => onChange(selected.filter((s) => s !== q).join(', '))

  return (
    <div>
      <SelectInput
        label={label}
        required={required}
        error={error}
        icon={Award}
        value=""
        onChange={add}
      >
        <option value="">
          {selected.length ? 'Add another qualification…' : 'Select qualification'}
        </option>
        {QUALIFICATION_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.items.map((item) => (
              <option key={item} value={item} disabled={selected.includes(item)}>
                {item}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectInput>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((q) => (
            <span
              key={q}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blueLight px-2.5 py-1 text-[12.5px] font-semibold text-brand-blue"
            >
              {q}
              <button
                type="button"
                onClick={() => remove(q)}
                aria-label={`Remove ${q}`}
                className="text-brand-blue/60 transition-colors hover:text-brand-blue"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
