import { motion } from 'framer-motion'

/**
 * Shared compact hero for every static / legal page. One place to control the
 * banner so the whole site stays consistent.
 *
 * Layout: icon chip + heading on one row, with the category label (eyebrow)
 * sitting as a small pill BESIDE the heading — keeps the banner short.
 *
 * Props: icon (lucide component), eyebrow, title, subtitle?, chips? (string[]),
 * tone: 'brand' (teal→green, default) | 'warn' (ember, for the disclaimer).
 */
export default function PageHero({ icon: Icon, eyebrow, title, subtitle, chips = [], tone = 'brand' }) {
  const warn = tone === 'warn'
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`relative mt-8 overflow-hidden rounded-3xl px-7 py-7 sm:px-10 sm:py-8 ${
        warn
          ? 'border-2 border-ember/50 bg-ember/10'
          : 'bg-gradient-to-br from-teal-700 via-teal-600 to-green-600 text-white shadow-lift'
      }`}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full blur-3xl ${warn ? 'bg-ember/20' : 'bg-ember/25'}`} />
      {!warn && <div aria-hidden="true" className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-emerald-300/25 blur-2xl" />}

      <div className="relative">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${warn ? 'bg-ember text-primary-foreground' : 'bg-white/15 backdrop-blur-sm'}`}>
            <Icon className="h-5 w-5" />
          </span>
          <h1 className="font-serif text-2xl leading-tight sm:text-4xl">{title}</h1>
          {eyebrow && (
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${
              warn ? 'bg-ember/15 text-ember' : 'bg-white/15 text-sage backdrop-blur-sm'
            }`}>
              {eyebrow}
            </span>
          )}
        </div>

        {subtitle && (
          <p className={`mt-2.5 max-w-4xl text-[15px] leading-relaxed sm:text-base ${warn ? 'text-ink-soft' : 'text-white/85'}`}>
            {subtitle}
          </p>
        )}

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
            {chips.map((c) => (
              <span key={c} className="rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">{c}</span>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  )
}
