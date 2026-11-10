import { useCallback, useEffect, useRef, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { motion, AnimatePresence } from 'framer-motion'
import { Pill, X, Check, Clock, UserRound } from 'lucide-react'
import { medicineApi } from '../../api'
import { prettyTime } from '../../lib/format.js'
import { useI18n } from '../../i18n/index.jsx'
import { osNotify } from '../common/DelayToaster.jsx'

/**
 * In-app popup at each dose time.
 *
 * The browser already knows when every dose is due — `next_dose_at` rides along
 * on each active course — so this needs nothing new from the backend and writes
 * nothing back. It simply acts on what the dashboard was already displaying as
 * "next in 5 h".
 *
 * Scope, stated plainly because it is easy to over-trust: this only fires while
 * TapCure is OPEN in a tab. A closed tab or a locked phone gets nothing. It
 * catches daytime doses for someone already browsing; it is not a substitute
 * for WhatsApp or web push, which are the only channels that reach a shut
 * phone.
 *
 * "Taken" deliberately stores nothing on the server — there is no column for it
 * yet. It dismisses this dose on this device, which is honest about what we
 * actually know, rather than implying adherence we never recorded.
 */

const POLL_MS = 60000
// How late a dose may be and still pop. Opening a tab at 9:10 should still
// surface the 9:00 dose; opening it at midnight should not.
const LATE_WINDOW_MIN = 30
const SNOOZE_MIN = 10
const SEEN_KEY = 'tapcure.dose-seen'
const MAX_STACK = 3

function readSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return [] // private mode, or someone hand-edited it
  }
}

function markSeen(key) {
  try {
    const list = readSeen()
    if (!list.includes(key)) list.push(key)
    // Capped: one row per dose would otherwise grow without bound, and only the
    // recent ones can still be inside the late window anyway.
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-50)))
  } catch {
    /* private mode — the dose just re-pops next poll, which is survivable */
  }
}

/** "Dolo 650 1 tablet · after food · for Ravi" */
function doseLine(c, t, lang) {
  return [
    [c.drug_name, c.dosage].filter(Boolean).join(' '),
    c.food_note,
    c.family_member_name ? t('ppage.forMember', { name: translitName(c.family_member_name, lang) }) : '',
  ].filter(Boolean).join(' · ')
}

/* ---- "new prescription" prompt -------------------------------------------
   Asked ONCE per prescription, as a popup, the moment the doctor's medicines
   arrive. Its dismissals are stored apart from the dose ones on purpose:
   saying "not now" to a new prescription must not also silence tonight's dose
   reminder, and vice versa. */
const RX_SEEN_KEY = 'tapcure.rx-prompt-seen'

function readRxSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(RX_SEEN_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function markRxSeen(key) {
  try {
    const list = readRxSeen()
    if (!list.includes(key)) list.push(key)
    localStorage.setItem(RX_SEEN_KEY, JSON.stringify(list.slice(-50)))
  } catch {
    /* private mode — it re-asks next time, which is survivable */
  }
}

/** Group un-started courses by the prescription they came from.
 *  A self-reported course has no prescription_id, so it keys on its own id —
 *  otherwise every patient-uploaded medicine would collapse into one bogus
 *  "null" group and start together. */
function groupAwaiting(courses) {
  const groups = new Map()
  for (const c of courses) {
    if (c.status !== 'awaiting_start') continue
    const key = c.prescription_id != null ? `rx:${c.prescription_id}` : `course:${c.course_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(c)
  }
  return groups
}

export default function DoseDueToaster() {
  const { t, lang } = useI18n()
  const [due, setDue] = useState([])
  // "Your doctor prescribed these — want reminders?" One entry per prescription.
  const [rxPrompts, setRxPrompts] = useState([])
  const [starting, setStarting] = useState(null)
  // Snoozes and OS-notify history live in refs: neither should re-render, and
  // both must survive the poll closure being rebuilt.
  const snoozed = useRef(new Map())
  const notified = useRef(new Set())

  const poll = useCallback(async () => {
    let courses
    try {
      courses = await medicineApi.courses()
    } catch {
      return // transient — try again next tick
    }
    if (!Array.isArray(courses)) return

    // Newly prescribed medicines the patient hasn't answered for yet. Same
    // response as the doses below — asking twice would double every request.
    const rxSeen = readRxSeen()
    const prompts = []
    // Remembered per MEDICINE (course), not per prescription: a doctor can add
    // a tablet to today's prescription after the patient already answered for
    // it, and keyed on the prescription that new tablet was never asked about —
    // its reminders sat waiting forever. The key names the unanswered courses,
    // so an added one makes a fresh prompt for just that one.
    for (const [key, group] of groupAwaiting(courses)) {
      const unanswered = group.filter((c) => !rxSeen.includes(`course:${c.course_id}`))
      if (!unanswered.length) continue
      prompts.push({ key: `${key}|${unanswered.map((c) => c.course_id).sort().join(',')}`, group: unanswered })
    }
    setRxPrompts((list) => {
      const have = new Set(list.map((p) => p.key))
      const merged = [...list, ...prompts.filter((p) => !have.has(p.key))]
      // Drop any the patient has since started elsewhere (e.g. the dashboard
      // card), so the popup never asks about something already running.
      const live = new Set(prompts.map((p) => p.key))
      return merged.filter((p) => live.has(p.key)).slice(-MAX_STACK)
    })

    const now = Date.now()
    const seen = readSeen()
    const fresh = []

    for (const c of courses) {
      if (c.status !== 'active' || !c.next_dose_at) continue
      // Append `Z` when the server sent no offset. `next_dose_at` is stored
      // NAIVE UTC, so a bare `new Date(...)` parsed it as local time and every
      // dose landed 5h30m early: a 9pm tablet popped at 3:30pm, and by 9pm it
      // was outside LATE_WINDOW_MIN so it never popped at all. The dose card
      // (TodayMedicines) has always done this; the popup did not.
      const at = new Date(`${c.next_dose_at}${/[Z]$|[+-]\d\d:?\d\d$/.test(c.next_dose_at) ? '' : 'Z'}`).getTime()
      if (Number.isNaN(at)) continue
      if (at > now) continue                              // not due yet
      if (now - at > LATE_WINDOW_MIN * 60000) continue    // too stale to nag about
      const key = `${c.course_id}:${c.next_dose_at}`
      if (seen.includes(key)) continue
      const until = snoozed.current.get(key)
      if (until && now < until) continue
      fresh.push({ key, course: c })
    }

    if (!fresh.length) return

    setDue((list) => {
      const have = new Set(list.map((d) => d.key))
      return [...list, ...fresh.filter((f) => !have.has(f.key))].slice(-MAX_STACK)
    })

    // One OS notification per dose, ever — a snooze re-shows the card but must
    // not fire a second desktop alert for the same dose.
    fresh.forEach((f) => {
      if (notified.current.has(f.key)) return
      notified.current.add(f.key)
      osNotify(t('pm.doseDueTitle'), doseLine(f.course, t, lang))
    })
  }, [t, lang])

  useEffect(() => {
    let alive = true
    const tick = () => { if (alive) poll() }
    tick()
    const iv = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(iv) }
  }, [poll])

  const drop = (key) => setDue((list) => list.filter((d) => d.key !== key))

  const taken = (key) => { markSeen(key); drop(key) }
  const snooze = (key) => {
    snoozed.current.set(key, Date.now() + SNOOZE_MIN * 60000)
    drop(key)
  }

  /* "Yes" starts every medicine on that prescription at once — nobody wants to
     confirm five drugs one at a time. A self-reported group has no
     prescription_id, so it starts by course_id instead. */
  const acceptRx = async ({ key, group }) => {
    setStarting(key)
    try {
      // Course by course: starting by prescription_id would also restart any
      // medicine on it the patient had deliberately stopped.
      for (const c of group) await medicineApi.start({ course_id: c.course_id })
      group.forEach((c) => markRxSeen(`course:${c.course_id}`))
      setRxPrompts((list) => list.filter((p) => p.key !== key))
    } catch {
      /* leave it on screen — they can try again */
    } finally {
      setStarting(null)
    }
  }

  // "Not now" is remembered, or it would re-ask on every page they open.
  const dismissRx = (key) => {
    const prompt = rxPrompts.find((p) => p.key === key)
    ;(prompt?.group || []).forEach((c) => markRxSeen(`course:${c.course_id}`))
    setRxPrompts((list) => list.filter((p) => p.key !== key))
  }

  /* A centred dialog must not leave the page behind it scrolling — on a phone
     the prompt slides out from under the thumb. Restored on cleanup, so an
     unmount while the prompt is open cannot leave the app unscrollable. */
  useEffect(() => {
    if (!rxPrompts.length) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [rxPrompts.length])

  if (!due.length && !rxPrompts.length) return null

  return (
    <>
      {/* The reminder prompt is a MODAL, not a corner toast. It asks once per
          prescription, so it earns an interruption — as a toast it sat bottom-
          right above the thumb area and read as a notification to ignore.
          The dose nudges below stay toasts on purpose: those fire several times
          a day, and blocking the screen for each would be punishing. */}
      <AnimatePresence>
        {rxPrompts.length > 0 && (
          <motion.div
            key="rx-prompt-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            /* Deliberately NO click-to-close on the backdrop. "Not now" is
               remembered for good via `markRxSeen`, so a stray tap outside the
               card would silently cost the patient their reminders. Closing
               takes the X or "Not now" — both explicit. */
            className="fixed inset-0 z-[200] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          >
            {/* ONE prescription at a time. "Yes, remind me" starts every
                medicine on that prescription at once, so two stacked in a
                single dialog would blur which list is being agreed to. The next
                prompt appears once this one is answered. */}
            {rxPrompts.slice(0, 1).map(({ key, group }) => (
          <motion.div
            key={key}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rx-prompt-title"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="w-[min(94vw,26rem)] rounded-2xl border-2 border-brand-blue bg-brand-blueLight p-5 shadow-[0_28px_70px_-12px_rgba(37,99,235,0.55)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-brand-blue">
                <Pill className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p id="rx-prompt-title" className="text-[15px] font-extrabold text-brand-navy">{t('pm.setRemindersQ')}</p>
                {/* Whose prescription this is. A prescription is written for ONE
                    person, so this belongs on the group, not repeated on every
                    medicine line. Without it, two prompts — yours and a family
                    member's — look nearly identical and you have to guess which
                    is which. Absent means it is the account holder's own. */}
                {group[0].family_member_name && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[13px] font-bold text-brand-blue">
                    <UserRound className="h-3 w-3" />
                    {t('pm.forPerson', { name: translitName(group[0].family_member_name, lang) })}
                  </span>
                )}
                <p className="mt-0.5 text-[13.5px] text-slate-600">{t('pm.newRxSub')}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissRx(key)}
                aria-label={t('pm.notNow')}
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-brand-navy"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-2 space-y-0.5">
              {group.map((c) => (
                /* Times shown BEFORE they agree. The dashboard card already did
                   this; the popup didn't, so the same decision looked different
                   depending on where you tapped yes. Nobody should be signed up
                   to a 9pm nudge without having seen "9:00 PM" first — and if it
                   is wrong, the card's times are editable in two taps. */
                <li key={c.course_id} className="truncate text-[13.5px] text-brand-navy">
                  • <span className="font-semibold">{c.drug_name}</span>
                  {c.dosage ? ` ${c.dosage}` : ''}
                  {c.times_csv
                    ? ` · ${c.times_csv.split(',').filter(Boolean).map(prettyTime).join(', ')}`
                    : ''}
                  {c.days ? ` · ${t('px.nDays', { n: c.days })}` : ''}
                  {c.food_note ? ` · ${c.food_note}` : ''}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => acceptRx({ key, group })}
                disabled={starting === key}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-blue py-2 text-[13px] font-bold text-white transition-colors hover:bg-brand-blueDark disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> {starting === key ? '…' : t('pm.yesRemindMe')}
              </button>
              <button
                type="button"
                onClick={() => dismissRx(key)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                {t('pm.notNow')}
              </button>
            </div>
          </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {due.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-3">
          <AnimatePresence initial={false}>
        {due.map(({ key, course }) => (
          <motion.div
            key={key}
            role="alert"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-auto w-[min(92vw,22rem)] rounded-2xl border-2 border-teal-400 bg-teal-50 p-4 shadow-[0_20px_50px_-10px_rgba(13,148,136,0.5)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-600">
                <Pill className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold text-teal-900">{t('pm.doseDueTitle')}</p>
                <p className="mt-0.5 text-[13.5px] leading-snug text-teal-800">{doseLine(course, t, lang)}</p>
              </div>
              <button
                type="button"
                onClick={() => taken(key)}
                aria-label={t('pm.taken')}
                className="shrink-0 rounded-lg p-1.5 text-teal-500 transition-colors hover:bg-teal-100 hover:text-teal-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => taken(key)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 py-2 text-[13px] font-bold text-white transition-colors hover:bg-teal-700"
              >
                <Check className="h-4 w-4" /> {t('pm.taken')}
              </button>
              <button
                type="button"
                onClick={() => snooze(key)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-2 text-[13px] font-semibold text-teal-700 transition-colors hover:bg-teal-50"
              >
                <Clock className="h-4 w-4" /> {t('pm.snooze')}
              </button>
            </div>
          </motion.div>
        ))}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}
