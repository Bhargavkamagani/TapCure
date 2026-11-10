import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

/**
 * The sticky action bar at the bottom of an onboarding step.
 *
 * The requirements are shown as a live checklist — each item ticks green as it's
 * satisfied — rather than a single "complete the required fields" sentence over
 * a greyed-out button, which left the doctor guessing which field was missing.
 */
export default function OnboardingFooter({ checklist = [], onBack, backLabel = 'Back', onNext, nextLabel, hint, busy = false }) {
  const complete = checklist.every((item) => item.done)
  const remaining = checklist.filter((item) => !item.done).length
  const canContinue = complete && !busy

  return (
    <div className="sticky bottom-0 z-20 -mx-5 mt-5 border-t border-slate-200/70 bg-[#f6fbfa]/85 px-5 py-4 backdrop-blur-xl sm:-mx-9 sm:px-9">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className={`text-[13.5px] font-bold ${complete ? 'text-emerald-600' : 'text-slate-500'}`}>
            {complete ? 'All set — you can continue.' : `${remaining} ${remaining === 1 ? 'thing' : 'things'} left${hint ? ` — ${hint}` : ''}`}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {checklist.map((item) => (
              <li key={item.label}>
                <motion.span
                  layout
                  className={`flex items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-[13px] font-semibold transition-colors ${
                    item.done ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-400 ring-1 ring-slate-200'
                  }`}
                >
                  <span className={`grid h-4 w-4 place-items-center rounded-full ${item.done ? 'bg-emerald-500 text-white' : 'bg-slate-200'}`}>
                    {item.done && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                  </span>
                  {item.label}
                </motion.span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-white hover:text-brand-navy"
            >
              <ArrowLeft className="h-4 w-4" /> {backLabel}
            </button>
          )}
          <motion.button
            type="button"
            disabled={!canContinue}
            onClick={onNext}
            whileHover={canContinue ? { y: -1 } : undefined}
            whileTap={canContinue ? { scale: 0.98 } : undefined}
            className="group flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(13,148,136,0.8)] transition-shadow disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {nextLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-enabled:group-hover:translate-x-0.5" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
