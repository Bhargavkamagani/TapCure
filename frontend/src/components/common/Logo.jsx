/**
 * TapCure app icon — the "T" monogram with the medical cross and pulse line.
 * Square, transparent PNG, so it sits cleanly on light or dark backgrounds.
 *
 * Every surface reads the same file (`/tapcure-icon.png`): this component, the
 * landing navbar, the browser favicon and the desktop notification icon. Swap
 * that one file to rebrand everywhere; the previous mark is kept alongside it
 * as `tapcure-icon-previous.png`.
 *
 * Height is driven via className (e.g. "h-24"); defaults to h-16 when none given.
 */
function Logo({ className = '' }) {
  const hasHeight = /\bh-/.test(className)
  return (
    <img
      src="/tapcure-icon.png"
      alt="TapCure"
      className={`${hasHeight ? '' : 'h-16'} w-auto object-contain ${className}`}
    />
  )
}

export default Logo
