import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronDown, Salad, TriangleAlert, X } from 'lucide-react'
import { CALCULATORS } from '../../lib/calculators.js'
import { getPlan } from '../../lib/nutritionPlans.js'
import { useI18n } from '../../i18n/index.jsx'
import NutritionTips from './NutritionTips.jsx'

const TONE = {
  green: 'border-green-200 bg-green-50 text-green-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-600',
  blue: 'border-blue-200 bg-blue-50 text-brand-blue',
}

/**
 * The plain-language verdict beside the number.
 *
 * Only for calculators that actually judge. `blue` is a readout with no
 * judgement in it — maintenance calories, a BMR, a due date — and stamping
 * "Looks good" on a due date would be meaningless at best.
 */
const VERDICT = {
  green: { key: 'calc.verdict.good', icon: Check, cls: 'bg-green-600/10 text-green-700' },
  amber: { key: 'calc.verdict.watch', icon: TriangleAlert, cls: 'bg-amber-500/15 text-amber-700' },
  red: { key: 'calc.verdict.high', icon: TriangleAlert, cls: 'bg-red-500/10 text-red-600' },
}

/** How many foods the plan lists — worth naming on the button. */
function foodCount(planId) {
  const plan = getPlan(planId)
  if (!plan) return 0
  return plan.sections
    ? plan.sections.reduce((n, s) => n + s.items.length, 0)
    : plan.items.length
}

// Map an option's English value to its translation key (calc.opt.*).
const OPT_KEY = {
  male: 'male',
  female: 'female',
  '1.2': 'sedentary',
  '1.375': 'light',
  '1.55': 'moderate',
  '1.725': 'active',
  '1.9': 'veryActive',
  lose: 'goalLose',
  maintain: 'goalMaintain',
  gain: 'goalGain',
}

/**
 * compute() in lib/calculators.js returns English sentences (it is shared with
 * the /calculators page). The maths stays there untouched; this maps its fixed
 * label/note templates onto lx.calc.* keys at render, pulling the numbers back
 * out of the English. Anything unrecognised is shown as-is rather than blank.
 */
const RESULT_LABEL = {
  Underweight: 'lx.calc.underweight',
  'Normal weight': 'lx.calc.normal',
  Overweight: 'lx.calc.overweight',
  Obese: 'lx.calc.obese',
  'Maintenance calories': 'lx.calc.maintenance',
  'Within healthy range': 'lx.calc.withinHealthy',
  'Above healthy range': 'lx.calc.aboveHealthy',
  'Basal metabolic rate': 'lx.calc.bmr',
  'You are below this range': 'lx.calc.youBelow',
  'You are within this range': 'lx.calc.youWithin',
  'You are above this range': 'lx.calc.youAbove',
  'Below healthy range': 'lx.calc.belowHealthy',
  Healthy: 'lx.calc.healthy',
  'Increased risk': 'lx.calc.increasedRisk',
  'High risk': 'lx.calc.highRisk',
  'Maintain your current weight': 'lx.calc.maintainCurrent',
  'No safe room to cut calories': 'lx.calc.noSafeCut',
  'Estimated due date': 'lx.calc.dueDate',
}

// [pattern, key, capture-group names]. Order matters only for readability —
// each sentence template is distinct.
const NOTE_PATTERNS = [
  [/Lose weight: ~([\d,]+) · Gain: ~([\d,]+) kcal\/day/, 'lx.calc.note.loseGain', ['lose', 'gain']],
  [/Ideal \(Devine formula\): ~([\d.]+) kg/, 'lx.calc.note.devine', ['v']],
  [/Aim to keep your waist under (\d+) cm — half your height\./, 'lx.calc.note.waistAim', ['v']],
  [/You are already at your goal\. Healthy range for your height: ([\d–]+) kg\./, 'lx.calc.note.atGoal', ['range']],
  [/Maintenance is already about ([\d,]+) kcal\/day, at the ([\d,]+) kcal\/day floor\. Add activity rather than eating less, and check with a doctor first\./, 'lx.calc.note.atFloor', ['tdee', 'floor']],
  [/Lose ([\d.]+) kg at ~([\d.]+) kg\/week — about (1) week, around ([^.]+)\./, 'lx.calc.note.loseOne', ['kg', 'rate', 'weeks', 'when']],
  [/Lose ([\d.]+) kg at ~([\d.]+) kg\/week — about (\d+) weeks, around ([^.]+)\./, 'lx.calc.note.loseMany', ['kg', 'rate', 'weeks', 'when']],
  [/Gain ([\d.]+) kg at ~([\d.]+) kg\/week — about (1) week, around ([^.]+)\./, 'lx.calc.note.gainOne', ['kg', 'rate', 'weeks', 'when']],
  [/Gain ([\d.]+) kg at ~([\d.]+) kg\/week — about (\d+) weeks, around ([^.]+)\./, 'lx.calc.note.gainMany', ['kg', 'rate', 'weeks', 'when']],
  [/Careful: that goal is below the healthy range for your height \(([\d–]+) kg\)\./, 'lx.calc.note.goalBelow', ['range']],
  [/That goal is still above the healthy range \(([\d–]+) kg\)\./, 'lx.calc.note.goalAbove', ['range']],
  [/Held at a ([\d,]+) kcal\/day floor — go slower rather than lower\./, 'lx.calc.note.heldFloor', ['floor']],
  [/You are about (1) week along\./, 'lx.calc.note.pregOne', ['weeks']],
  [/You are about (\d+) weeks along\./, 'lx.calc.note.pregMany', ['weeks']],
  [/Check the date — it looks out of range\./, 'lx.calc.note.badDate', []],
]

function localizeLabel(label, t) {
  if (!label) return label
  if (RESULT_LABEL[label]) return t(RESULT_LABEL[label])
  const m = /^Daily calories to reach (.+) kg$/.exec(label)
  if (m) return t('lx.calc.reachTarget', { target: m[1] })
  return label
}

function localizeNote(note, t) {
  if (!note) return note
  let out = note
  for (const [re, key, names] of NOTE_PATTERNS) {
    out = out.replace(re, (...g) => t(key, Object.fromEntries(names.map((n, i) => [n, g[i + 1]]))))
  }
  return out
}

const UNIT_KEY = { 'kcal/day': 'lx.unit.kcalPerDay', yrs: 'lx.unit.yrs' }
const localizeUnit = (u, t) => (UNIT_KEY[u] ? t(UNIT_KEY[u]) : u)

/**
 * Pop-over for a single health calculator. `name` is the calculator's label
 * (key into CALCULATORS); result recomputes live as the user types.
 */
function CalculatorModal({ name, onClose }) {
  const { t } = useI18n()
  const calc = name ? CALCULATORS[name] : null
  const [values, setValues] = useState({})
  // The food plan is opened on request, not dumped under every result — it is
  // longer than the answer someone came for.
  const [showDiet, setShowDiet] = useState(false)

  // Switching calculators must not leave the previous one's plan expanded.
  useEffect(() => { setShowDiet(false) }, [name])

  const result = useMemo(() => {
    if (!calc) return null
    try {
      return calc.compute(values)
    } catch {
      return null
    }
  }, [calc, values])

  if (!name || !calc) return null

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/40 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="text-[18px] font-extrabold text-brand-navy">{t(`calc.label.${name}`)}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-4 text-[13px] text-slate-500">{t(`calc.blurb.${name}`)}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {calc.fields.map((f) => (
              <div key={f.name} className={f.type === 'date' ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-[12.5px] font-semibold text-slate-600">
                  {t(`calc.field.${f.name}`)}{f.unit ? ` (${localizeUnit(f.unit, t)})` : ''}
                </label>
                {f.type === 'select' ? (
                  <select
                    value={values[f.name] || ''}
                    onChange={set(f.name)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                  >
                    <option value="">{t('calc.selectPlaceholder')}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {OPT_KEY[o.value] ? t(`calc.opt.${OPT_KEY[o.value]}`) : o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    inputMode={f.type === 'number' ? 'decimal' : undefined}
                    value={values[f.name] || ''}
                    onChange={set(f.name)}
                    placeholder={f.type === 'number' ? '0' : undefined}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-navy outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Result */}
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={`${result.headline}-${result.label}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`mt-4 rounded-2xl border px-4 py-4 ${TONE[result.tone] || TONE.blue}`}
              >
                {/* The number leads. The old card put it in a corner at 28px
                    with the verdict as a 12px label, so the one thing someone
                    came for was the least visible thing on the card. */}
                <div className="flex items-baseline gap-2">
                  <span className="text-[40px] font-extrabold leading-none tracking-tight">
                    {result.headline}
                  </span>
                  {result.unit && (
                    <span className="text-[15px] font-bold opacity-70">{localizeUnit(result.unit, t)}</span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {VERDICT[result.tone] && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${VERDICT[result.tone].cls}`}>
                      {(() => { const I = VERDICT[result.tone].icon; return <I className="h-3.5 w-3.5" /> })()}
                      {t(VERDICT[result.tone].key)}
                    </span>
                  )}
                  <span className="text-[13px] font-semibold opacity-90">{localizeLabel(result.label, t)}</span>
                </div>

                {result.note && (
                  <p className="mt-2 text-[11.5px] font-medium leading-snug opacity-80">{localizeNote(result.note, t)}</p>
                )}
              </motion.div>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-[12.5px] text-slate-400">
                {t('calc.fillHint')}
              </p>
            )}
          </AnimatePresence>

          {result?.explain && (
            <p className="mt-3 rounded-xl bg-brand-blueLight/50 px-3 py-2 text-[11.5px] leading-snug text-brand-navy">
              {t(result.explain)}
            </p>
          )}

          {/* The food plan is the most useful thing here, but it is also the
              longest — behind a button it stays an offer rather than a wall of
              text under every answer. */}
          {result?.plan && (
            <>
              <button
                type="button"
                onClick={() => setShowDiet((v) => !v)}
                aria-expanded={showDiet}
                className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-brand-green/30 bg-brand-greenLight px-3.5 py-3 text-left transition-colors hover:bg-brand-greenLight/70"
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-green">
                    <Salad className="h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-bold text-brand-navy">
                    {showDiet
                      ? t('calc.diet.hide')
                      : t('calc.diet.show', { n: foodCount(result.plan) })}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-brand-green transition-transform ${showDiet ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {showDiet && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <NutritionTips plan={result.plan} schedule={result.schedule} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          <p className="mt-3 text-[11px] text-slate-400">
            {t('calc.disclaimer')}
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default CalculatorModal
