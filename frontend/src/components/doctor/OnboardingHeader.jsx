import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/**
 * The top of every setup step: the ask on the left, a quotation on the right.
 *
 * Shared rather than written per screen so the three steps share one rhythm —
 * same eyebrow size, same heading scale, same gap before the content. The quote
 * is decorative and drops away below xl, where the column is too narrow to carry
 * two things side by side.
 */

/** Widely attributed lines on the practice of medicine. The card cycles these. */
const QUOTES = [
  {
    text: 'The good physician treats the disease; the great physician treats the patient who has the disease.',
    author: 'William Osler',
  },
  {
    text: 'Wherever the art of medicine is loved, there is also a love of humanity.',
    author: 'Hippocrates',
  },
]
const CYCLE_MS = 7000

/**
 * The quote sits in a dark card with a light that travels around its edge.
 *
 * The glow is a single white blob, blurred hard and parked off the top-left
 * corner. It lives inside a full-size layer that spins about the card's centre,
 * so the blob orbits; `overflow-hidden` on the outer shell clips it and the
 * inset inner panel masks the middle, leaving only the hairline border lit.
 * That border IS the outer div showing through — hence the 2px `inset-0.5`.
 */
export function OnboardingQuote({ className = '' }) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)

  // Cycle the quotes on a timer. One interval for the life of the card — the
  // functional update means it never needs `index` in its deps, so it isn't
  // torn down and restarted on every change (which would reset the clock).
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % QUOTES.length), CYCLE_MS)
    return () => clearInterval(id)
  }, [])

  const quote = QUOTES[index]

  // Width and padding are deliberately tight. This card sits opposite the step
  // heading in a flex row, so the row is as tall as whichever is taller — a
  // roomier card just pushes the first panel further down the page.
  return (
    <div className={`relative w-[21rem] overflow-hidden rounded-2xl bg-emerald-100/80 p-[3px] shadow-[0_12px_30px_-14px_rgba(15,39,66,0.28)] ${className}`}>
      {/* The green light. A blurred emerald blob parked off the top-left of a
          full-size layer that spins about the card's centre, so the blob orbits
          the edge. `overflow-hidden` clips it and the white panel below masks
          the middle, leaving only the 3px rim lit as it passes. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute -left-1/2 -top-1/2 h-48 w-56 bg-emerald-400 blur-[46px]" />
      </motion.div>

      {/* In flow, so it sizes the card; relative + z-[1] so it paints over the
          glow, leaving only the padding above lit. */}
      <figure className="relative z-[1] rounded-[13px] bg-white px-5 py-4">
        <span aria-hidden="true" className="block font-display text-[22px] leading-none text-emerald-400">&ldquo;</span>
        {/* Reserves room for the longer of the two quotes, so the card doesn't
            resize under the heading every time they swap. */}
        <div className="mt-0.5 min-h-[5.5rem]">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="text-[13px] italic leading-[1.55] text-ink-soft"
            >
              {quote.text}
              <footer className="mt-2.5 flex items-center gap-2 text-[12px] font-bold not-italic uppercase tracking-[0.16em] text-teal-600">
                <span className="h-px w-4 shrink-0 bg-teal-400/60" />
                {quote.author}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>
      </figure>
    </div>
  )
}

export default function OnboardingHeader({ eyebrow, title, sub, animateKey, children }) {
  return (
    <header className="mb-7 flex items-start justify-between gap-10">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-teal-600">{eyebrow}</p>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={animateKey || title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="mt-2 font-display text-[30px] font-semibold leading-[1.15] text-ink sm:text-[36px]">
              {title}
            </h1>
            {sub && <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-ink-soft">{sub}</p>}
          </motion.div>
        </AnimatePresence>
        {children}
      </div>

      <OnboardingQuote className="hidden shrink-0 xl:block" />
    </header>
  )
}
