import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Loader2 } from 'lucide-react'
import { searchPlaces, resolvePlaceCoords } from '../../lib/places.js'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Type-ahead address input backed by the free Photon geocoder (no API key).
 *
 * Controlled by `value` / `onChange` (the text) and `onSelect` which fires with
 * `{ lat, lng, label }` when the user picks a suggestion — the caller stores the
 * coordinates to compute travel time / leave-by. `biasLat`/`biasLng` nudge
 * results toward a region (pass the hospital so nearby places rank first).
 *
 * `context` (optional, e.g. "Madhapur, Hyderabad") narrows the search: its
 * parts are appended to whatever is typed, unless already typed, and focusing
 * an empty box suggests places for the context alone.
 *
 * Keyboard: ArrowUp/Down to move, Enter to pick, Escape to dismiss.
 */
/** "sai hospital" + "Madhapur, Hyderabad" → "sai hospital, Madhapur, Hyderabad",
 *  skipping context parts the user already typed. */
function withContext(query, context) {
  const typed = query.toLowerCase()
  const extra = context.split(',').map((s) => s.trim())
    .filter((part) => part && !typed.includes(part.toLowerCase()))
  return [query, ...extra].join(', ')
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  biasLat,
  biasLng,
  context,
  className = '',
}) {
  const { t } = useI18n()
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const [focused, setFocused] = useState(false)
  const focusedRef = useRef(false)
  const boxRef = useRef(null)
  const abortRef = useRef(null)
  const ctx = (context || '').trim()
  // Only an empty, focused box browses the context — so blurring a box that
  // holds typed text doesn't rerun (and re-bill) the search.
  const browseQuery = !(value || '').trim() && focused ? ctx : ''
  // Text of the suggestion the user last picked. While the input still holds
  // that exact text we must NOT reopen the dropdown — otherwise selecting a
  // place (which updates the caller's coords, and thus biasLat/biasLng) would
  // retrigger this effect and pop the suggestions straight back up.
  const lastPicked = useRef(value ?? '')
  const listId = useId()

  // Debounced search whenever the text changes.
  useEffect(() => {
    const q = (value || '').trim()
    if (q && q === (lastPicked.current || '').trim()) {
      setOpen(false); setLoading(false); return
    }
    let query
    if (q.length >= 3) query = withContext(q, ctx)
    else if (browseQuery.length >= 3) query = browseQuery
    else { setResults([]); setOpen(false); setLoading(false); return }
    setLoading(true)
    const id = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const found = await searchPlaces(query, { lat: biasLat, lng: biasLng, signal: ctrl.signal })
      setResults(found)
      setActive(-1)
      // With a context, editing city/area elsewhere reruns this; don't pop the
      // list open under a field the user isn't in.
      setOpen(found.length > 0 && (!ctx || focusedRef.current))
      setLoading(false)
    }, 300)
    return () => clearTimeout(id)
  }, [value, biasLat, biasLng, ctx, browseQuery])

  // Close the dropdown on an outside click.
  useEffect(() => {
    const onDocClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const choose = async (place) => {
    lastPicked.current = place.label
    onChange?.(place.label)
    setOpen(false)
    setResults([])
    setActive(-1)
    // Google predictions carry a placeId but no coords — resolve them now.
    let resolved = place
    if ((place.lat == null || place.lng == null) && place.placeId) {
      const coords = await resolvePlaceCoords(place.placeId)
      if (coords) resolved = { ...place, ...coords }
    }
    onSelect?.(resolved)
  }

  const onKeyDown = (e) => {
    if (!open || !results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(results[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => {
            focusedRef.current = true
            setFocused(true)
            if (results.length) setOpen(true)
          }}
          onBlur={() => { focusedRef.current = false; setFocused(false) }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? t('cmn.searchAddress')}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className={className || 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-sm text-brand-navy outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10'}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
        </span>
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-[1100] mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            {results.map((place, i) => (
              <li key={`${place.lat},${place.lng},${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // Keep focus in the input: a blur here would clear a
                  // context-browse list before the click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(place)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                    i === active ? 'bg-brand-blue/10 text-brand-navy' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-blue" />
                  <span className="leading-snug">{place.label}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
