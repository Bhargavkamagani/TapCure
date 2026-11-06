/**
 * The "TapCure" wordmark — the "Soft Rounded" lockup.
 *
 * Fredoka's rounded terminals at semibold, set FLAT: no 3D extrusion and no
 * gradient. The two-colour split does the work — navy "Tap", teal "Cure" —
 * which is what keeps it legible when it shrinks to 17px in a console rail.
 *
 * Colours live in .wordmark-tap / .wordmark-cure (index.css), so the mark can
 * be recoloured in one place.
 *
 * tone:
 *   'color' — light surfaces: navy + teal (landing, patient topbar)
 *   'light' — deep-teal console rails, where navy vanishes: white + aqua
 */
export default function Wordmark({ tone = 'color', className = '' }) {
  return (
    <span className={`wordmark ${tone === 'light' ? 'wordmark-onDark' : ''} inline-block ${className}`}>
      <span className="wordmark-tap">Tap</span><span className="wordmark-cure">Cure</span>
    </span>
  )
}
