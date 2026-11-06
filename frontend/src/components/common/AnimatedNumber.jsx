import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'

/** Smoothly counts up to `value` whenever it changes. Non-numbers render as-is. */
export default function AnimatedNumber({ value, className = '' }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString())

  useEffect(() => {
    if (typeof value !== 'number') return
    const controls = animate(mv, value, { duration: 0.7, ease: 'easeOut' })
    return controls.stop
  }, [value, mv])

  if (typeof value !== 'number') return <span className={className}>{value}</span>
  return <motion.span className={className}>{rounded}</motion.span>
}
