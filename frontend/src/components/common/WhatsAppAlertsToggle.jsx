/**
 * Walk-in opt-in for WhatsApp queue alerts ("Almost your turn"). Off by
 * default: walk-ins are free, but one that gets the alerts counts as an
 * online booking on the hospital's plan.
 */
export default function WhatsAppAlertsToggle({ checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
      />
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold text-brand-navy">Send WhatsApp alerts</span>
        <span className="block text-[11.5px] text-slate-500">"Almost your turn" message. Counts as 1 online booking on your plan.</span>
      </span>
    </label>
  )
}
