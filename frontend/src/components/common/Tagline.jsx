/**
 * "— One tap to cure —" : the brand line, ruled on both sides.
 *
 * Deliberately small and quiet. It sits under the TapCure wordmark, so it has
 * to read as a whisper next to the name rather than compete with it — the rules
 * give it shape at a size where plain text would just look like stray words.
 *
 * `tone` picks the palette: 'light' for white/cream surfaces, 'dark' for the
 * teal console rails. `text` lets a translated page pass its own wording.
 */
const TONES = {
  light: { text: 'text-teal-600/90', rule: 'bg-teal-500/50' },
  dark: { text: 'text-teal-300/70', rule: 'bg-teal-300/40' },
  teal: { text: 'text-teal-700/70', rule: 'bg-teal-500/40' },
}

export default function Tagline({ tone = 'light', className = '', text = 'One tap to cure' }) {
  const t = TONES[tone] || TONES.light
  return (
    <span className={`flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <span className={`h-px w-3 shrink-0 ${t.rule}`} />
      <span className={`text-[8.5px] font-semibold uppercase tracking-[0.16em] ${t.text}`}>
        {text}
      </span>
      <span className={`h-px w-3 shrink-0 ${t.rule}`} />
    </span>
  )
}
