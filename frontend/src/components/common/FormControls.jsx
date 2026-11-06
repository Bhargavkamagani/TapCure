import { useState } from 'react'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'

/** Shared field shell — label, bordered control wrapper, error text. */
function FieldShell({ label, required, error, children }) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {/* `data-field-error` is a hook for forms that need to scroll the first
          invalid field into view after a failed submit. Marker only — it has no
          styling and changes nothing visually. */}
      {error && <p data-field-error className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const baseWrap = (error) =>
  `flex items-center gap-2.5 rounded-xl border bg-white px-3.5 transition-colors focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/10 ${
    error ? 'border-red-300' : 'border-slate-200'
  }`

export function TextInput({ label, required, error, icon: Icon, prefix, onWheel, ...props }) {
  /**
   * A focused `type="number"` input treats the mouse wheel as its spinner, so
   * scrolling the page with the cursor still over the field silently counts the
   * value up or down — one step per tick, with no keystroke and no visible
   * cause. It put doctors into the database on ₹489 and ₹289 when they had
   * typed 500 and 300: they filled the fee in and scrolled on down the signup
   * form, 11 ticks' worth, without clicking away first.
   *
   * Blurring on wheel drops the spinner before the browser applies it, and the
   * page still scrolls normally.
   */
  const guardWheel = (e) => {
    if (props.type === 'number') e.currentTarget.blur()
    onWheel?.(e)
  }
  return (
    <FieldShell label={label} required={required} error={error}>
      <div className={baseWrap(error)}>
        {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-slate-400" />}
        {prefix && (
          <span className="shrink-0 border-r border-slate-200 pr-2.5 text-sm font-medium text-slate-500">
            {prefix}
          </span>
        )}
        <input
          {...props}
          onWheel={guardWheel}
          className="w-full bg-transparent py-2.5 text-sm text-brand-navy outline-none placeholder:text-slate-400"
        />
      </div>
    </FieldShell>
  )
}

export function PasswordInput({ label, required, error, icon: Icon, ...props }) {
  const [show, setShow] = useState(false)
  return (
    <FieldShell label={label} required={required} error={error}>
      <div className={baseWrap(error)}>
        {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-slate-400" />}
        <input
          {...props}
          type={show ? 'text' : 'password'}
          className="password-control w-full bg-transparent py-2.5 text-sm text-brand-navy outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="shrink-0 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </FieldShell>
  )
}

export function SelectInput({ label, required, error, icon: Icon, children, ...props }) {
  return (
    <FieldShell label={label} required={required} error={error}>
      <div className={`${baseWrap(error)} relative`}>
        {Icon && <Icon className="h-[18px] w-[18px] shrink-0 text-slate-400" />}
        <select
          {...props}
          className="w-full appearance-none bg-transparent py-2.5 text-sm text-brand-navy outline-none"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-slate-400" />
      </div>
    </FieldShell>
  )
}

export function Checkbox({ checked, onChange, children, className = '' }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
      />
      <span className="text-[13px] leading-snug text-slate-600">{children}</span>
    </label>
  )
}

/** Inline success / error banner used across the auth screens. */
export function Banner({ type = 'success', children }) {
  const styles =
    type === 'success'
      ? 'border-green-200 bg-green-50 text-green-700'
      : type === 'info'
        ? 'border-teal-200 bg-teal-50 text-teal-800'
        : 'border-red-200 bg-red-50 text-red-600'
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 text-[13px] font-medium ${styles}`}>
      {children}
    </div>
  )
}
