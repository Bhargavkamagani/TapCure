import { useCallback, useEffect, useRef, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Pill, Sun, Moon, Check, Leaf, ArrowRight } from 'lucide-react'
import { Card } from '../hospital/ui.jsx'
import { medicineApi } from '../../api'
import { clockIST } from '../../lib/format.js'
import { useI18n } from '../../i18n/index.jsx'

/**
 * "Today's Medicines" — the day's doses, in order, with what the patient did.
 *
 * Deliberately per-DOSE, not per-medicine. The older card listed courses ("Dolo
 * 650, twice a day, 9 left"), which answers "what am I on?" but not the
 * question someone actually opens the app to ask: what do I take next, and have
 * I already taken the last one. Those are different rows — a twice-daily
 * medicine is two entries here, one possibly taken and one not.
 *
 * Times come from `clockIST`, never a bare `new Date()`. The backend stores
 * naive UTC, so read as local every row would show 5.5 hours out.
 */

/* Matches the dose popup's cadence. Two things go stale without it: a course
   started from the popup or the Prescriptions page never appears here, and a
   dose whose time arrives while the page sits open keeps saying "Upcoming"
   because nothing re-renders to notice. */
const POLL_MS = 60000

/* Sun or moon by the CLOCK, not by the prescribed slot.

   This was keyed off the slot until patients could choose their own times.
   That is no longer safe: move a "night" dose to midday and the row reads
   "12:00 PM" beside a moon — the icon contradicting the time printed next to
   it. Whatever the doctor called the slot, noon is daylight.

   Night runs 6pm to 5am. Doses land on the hour in practice, so the boundary
   only has to be defensible, not precise. */
const NIGHT_FROM = 18
const NIGHT_UNTIL = 5

/** Hour 0-23 of a naive-UTC timestamp, read in hospital-local time. */
function istHour(iso) {
  if (!iso) return null
  const d = new Date(/[Z]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime())) return null
  // formatToParts rather than parsing a formatted string: some locales render
  // midnight as "24", which would fall outside every comparison below.
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === 'hour')?.value)
  return Number.isNaN(h) ? null : h % 24
}

function isNightAt(iso) {
  const h = istHour(iso)
  if (h === null) return false          // unreadable time: assume daylight
  return h >= NIGHT_FROM || h < NIGHT_UNTIL
}

/* `onVisibleChange(bool)` lets the dashboard know whether this card is on
   screen, so its row can drop to two columns instead of leaving a gap where
   the card would be. Optional — other callers can ignore it. */
export default function TodayMedicines({ onVisibleChange }) {
  const { t, lang } = useI18n()
  const [doses, setDoses] = useState([])
  const [taken, setTaken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  /* A ref, not the state, because the poll's closure is rebuilt only when
     `load` changes — reading `busy` directly there would see whatever it was
     when the interval was created, forever. */
  const busyRef = useRef(null)
  useEffect(() => { busyRef.current = busy }, [busy])

  const load = useCallback(async () => {
    try {
      const d = await medicineApi.today()
      setDoses(Array.isArray(d?.doses) ? d.doses : [])
      setTaken(d?.taken || 0)
      setError(null)
    } catch (e) {
      setError(e.message || t('px.med.couldNotLoadToday'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    let alive = true
    const tick = () => {
      // Don't refetch over an in-flight "Take now" — the tap already reloads
      // when it lands, and a poll arriving mid-request would flip the row back
      // to its old state for a second.
      if (alive && !busyRef.current) load()
    }
    tick()
    const iv = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(iv) }
  }, [load])

  const markTaken = async (dose) => {
    setBusy(dose.reminder_id)
    setError(null)
    try {
      await medicineApi.markTaken(dose.reminder_id)
      await load()
    } catch (e) {
      setError(e.message || t('px.med.couldNotRecord'))
    } finally {
      setBusy(null)
    }
  }

  // Renders nothing at all when there is no plan for today, rather than an
  // empty box on a dashboard that already has plenty to show.
  const hidden = loading || (!doses.length && !error)
  useEffect(() => { onVisibleChange?.(!hidden) }, [hidden, onVisibleChange])
  if (hidden) return null

  const total = doses.length
  const pct = total ? Math.round((taken / total) * 100) : 0
  const now = Date.now()

  /* At most four rows on the dashboard. The full day lives one tap away on
     the Medicine Reminders tab; a patient on eight tablets was getting a card
     tall enough to stretch the whole row, with the dose that is actually due
     pushed off the bottom.
     Chosen by what is left TO DO, not by clock order: due first, then the next
     upcoming, and taken doses only if there is room. Straight chronological
     order meant that by evening the card showed four ticked-off morning
     tablets and nothing about tonight's. Whichever four are chosen, they are
     then shown in time order so the card still reads like a day.
     The counter and the bar above stay on the FULL day — "2 / 8 taken". */
  const MAX_ROWS = 4
  const at = (d) => new Date(`${d.send_at}${/[Z+]/.test(d.send_at) ? '' : 'Z'}`).getTime()
  const rank = (d) => (d.status === 'taken' ? 2 : at(d) <= now ? 0 : 1)
  const shown = [...doses]
    .sort((a, b) => rank(a) - rank(b) || at(a) - at(b))
    .slice(0, MAX_ROWS)
    .sort((a, b) => at(a) - at(b))
  const hiddenCount = total - shown.length

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        {/* Soft gradient rather than a flat tint — the capsule is the card's
            one piece of colour, so it carries the warmth. */}
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-100 to-rose-50 text-rose-500 ring-1 ring-rose-100/70">
          <Pill className="h-[22px] w-[22px]" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h3 className="text-[15.5px] font-bold tracking-tight text-brand-navy">{t('pm.todayTitle')}</h3>
          <p className="mt-0.5 text-[12px] text-slate-400">{t('pm.todaySub')}</p>
        </div>
        <div className="shrink-0 text-right">
          {/* Straight to the Medicine Reminders tab, not the records list —
              someone tapping "View all" from today's doses wants their
              running medicines, not their lab reports. */}
          <Link
            to="prescriptions?tab=reminders"
            className="group inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-blue transition-colors hover:text-brand-blueDark"
          >
            {t('pm.viewAll')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-1 text-[11.5px] font-semibold tabular-nums text-slate-500">
            {t('pm.takenCount', { n: taken, total })}
          </p>
          {/* Progress of the day, not of the course — this bar resets tomorrow. */}
          <div className="mt-1.5 h-2 w-28 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.55, ease: [0.22, 0.68, 0.28, 1] }}
            />
          </div>
        </div>
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] text-red-600">{error}</p>}

      <AnimatePresence initial={false}>
        {shown.map((d) => {
          const night = isNightAt(d.send_at)
          const Icon = night ? Moon : Sun
          const isTaken = d.status === 'taken'
          // "Due" means its time has arrived and it isn't taken yet — that is
          // the one row offering an action, and the only one tinted.
          const due = !isTaken && new Date(`${d.send_at}${/[Z+]/.test(d.send_at) ? '' : 'Z'}`).getTime() <= now
          return (
            <motion.div
              key={d.reminder_id}
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className={`mb-2 flex items-center gap-3 rounded-2xl p-3 transition-colors ${
                due
                  ? 'bg-rose-50/70 ring-1 ring-rose-100'
                  : isTaken
                  ? 'bg-emerald-50/40 ring-1 ring-emerald-100/60'
                  : 'bg-slate-50/60 ring-1 ring-slate-100 hover:bg-slate-50'
              }`}
            >
              {/* Icon sits in its own tinted disc: at 4px the bare glyph read
                  as debris next to the bolder type beside it. */}
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                night ? 'bg-indigo-50' : 'bg-amber-50'
              }`}>
                {/* Heavier stroke than lucide's default 2: at 18px a hairline
                    sun loses its rays against the tinted disc behind it. */}
                <Icon
                  className={`h-[18px] w-[18px] ${night ? 'text-indigo-500' : 'text-amber-500'}`}
                  strokeWidth={2.75}
                />
              </span>
              <span className="w-[62px] shrink-0 text-[12.5px] font-bold tabular-nums text-slate-600">
                {clockIST(d.send_at)}
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className={`truncate text-[13.5px] font-bold ${isTaken ? 'text-slate-500' : 'text-brand-navy'}`}>
                  {d.drug_name}
                  {d.family_member_name && (
                    <span className="ml-1 text-[11.5px] font-semibold text-brand-blue">
                      {t('pm.forPerson', { name: translitName(d.family_member_name, lang) })}
                    </span>
                  )}
                </p>
                <p className="truncate text-[11.5px] text-slate-400">
                  {[d.dosage, d.food_note].filter(Boolean).join(' · ')}
                </p>
              </div>

              {isTaken ? (
                <span className="shrink-0 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-right text-[11.5px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  <span className="flex items-center gap-1">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {t('pm.taken')}
                  </span>
                  {d.taken_at && (
                    <span className="block font-medium tabular-nums text-emerald-600">
                      {t('pm.takenAt', { time: clockIST(d.taken_at) })}
                    </span>
                  )}
                </span>
              ) : due ? (
                <motion.button
                  type="button"
                  onClick={() => markTaken(d)}
                  disabled={busy === d.reminder_id}
                  whileTap={{ scale: 0.96 }}
                  className="shrink-0 rounded-xl bg-rose-500 px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm shadow-rose-500/30 transition-colors hover:bg-rose-600 disabled:opacity-60"
                >
                  {busy === d.reminder_id ? '…' : t('pm.takeNow')}
                </motion.button>
              ) : (
                <span className="shrink-0 rounded-xl bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-400 ring-1 ring-slate-200">
                  {t('pm.upcoming')}
                </span>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Says what is being held back, and goes where the rest of them are. */}
      {hiddenCount > 0 && (
        <Link
          to="prescriptions?tab=reminders"
          className="mb-2 flex items-center justify-center gap-1 rounded-2xl bg-slate-50/60 px-3 py-2 text-[12.5px] font-bold text-brand-blue ring-1 ring-slate-100 transition-colors hover:bg-slate-50"
        >
          {t('pm.moreToday', { n: hiddenCount })}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50/60 px-3.5 py-3 ring-1 ring-emerald-100/70">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80 text-emerald-500">
          <Leaf className="h-4 w-4" />
        </span>
        <div className="leading-snug">
          <p className="text-[12.5px] font-bold text-emerald-800">{t('pm.consistencyTitle')}</p>
          <p className="text-[11.5px] text-emerald-700/90">{t('pm.consistencyBody')}</p>
        </div>
      </div>
    </Card>
  )
}
