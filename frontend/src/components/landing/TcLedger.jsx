import { useState, useMemo, useEffect, useRef, createContext, useContext } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import TypeLoop from './TypeLoop.jsx'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, Timer, Apple, Lock } from 'lucide-react'
import { FOODS, MEALS, PLANS, REDUCE, SCHEDULES } from '../../lib/nutritionPlans.js'

/**
 * TapCure's 60-second check.
 *
 * The shape is deliberate: it asks the FEWEST questions that produce a real
 * number — height and weight — makes you guess, then shows your BMI and stops.
 * Everything else is offered afterwards as a choice, and each follow-on asks
 * only for what that particular figure needs. Nobody is made to fill in seven
 * sliders to find out one thing.
 *
 *   height + weight ──▶ guess ──▶ BMI
 *                                 └─▶ body fat      + age, sex
 *                                 └─▶ calories      + age, sex, activity
 *                                 └─▶ ideal weight  (nothing more)
 *                                 └─▶ minutes back  + waist, sleep, activity
 *                                 └─▶ due date      + last period
 *
 * The look is editorial rather than dashboard-like — enormous
 * numerals, 3px hairline rulers instead of gauges, serif word pickers with an
 * underline instead of buttons. It reads as a printed result, not a form.
 *
 * Maths, unchanged from the reference:
 *  - BMI bands are WHO **Asia-Pacific** — healthy tops out at 22.9, not 24.9.
 *    The European bands would tell much of this population they are fine when
 *    local guidance says otherwise.
 *  - Mifflin-St Jeor for BMR, activity factor for maintenance.
 *  - Waist-to-height rides alongside BMI because it predicts metabolic risk
 *    better; the advice ladder checks it first.
 *  - Deurenberg for body fat, so it needs no tape measure.
 *
 * Nothing leaves the browser, which is what the copy promises.
 */

const ACTIVITY = {
  sed: { label: 'tc.lg.act.sed', factor: 1.200, back: 60, why: 'tc.lg.act.sedWhy' },
  light: { label: 'tc.lg.act.light', factor: 1.375, back: 35, why: 'tc.lg.act.lightWhy' },
  mod: { label: 'tc.lg.act.mod', factor: 1.550, back: 12, why: 'tc.lg.act.modWhy' },
  high: { label: 'tc.lg.act.high', factor: 1.725, back: 0, why: '' },
}

const BMI_BANDS = [
  { to: 18.5, tone: 'low', name: 'tc.lg.band.under' },
  { to: 22.9, tone: 'ok', name: 'tc.lg.band.ok' },
  { to: 24.9, tone: 'warn', name: 'tc.lg.band.warn' },
  { to: 40.0, tone: 'high', name: 'tc.lg.band.high' },
]
const BMI_MIN = 15

const WHT_BANDS = [
  { to: 0.40, tone: 'low', name: 'tc.lg.band.under' },
  { to: 0.50, tone: 'ok', name: 'tc.lg.band.ok' },
  { to: 0.60, tone: 'warn', name: 'tc.lg.band.warn' },
  { to: 0.70, tone: 'high', name: 'tc.lg.band.high' },
]
const WHT_MIN = 0.35

const TONE_WORD = { low: 'tc.lg.band.under', ok: 'tc.lg.band.ok', warn: 'tc.lg.band.warn', high: 'tc.lg.band.high' }

/**
 * Fills {name} placeholders in a translated string. The weight-goal sentences
 * put the number in a different place in each language, so the copy has to own
 * the word order — building it from fragments in JSX would force English order
 * onto Telugu and Hindi.
 */
const fill = (s, vals) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? String(vals[k]) : m))

const bandAt = (bands, v) => bands.find((b) => v < b.to) || bands[bands.length - 1]

/**
 * Every tool ends the way the body-fat screen does: when the answer falls
 * outside the healthy band, name what it means and offer the doctor. A number
 * that reads "High" and then just sits there is the one thing this sheet must
 * not do — the whole point is to get someone to a consultation, not to hand
 * them a verdict and leave.
 *
 * Calories have no healthy band of their own, so that screen follows the BMI
 * reading behind it. A due date always nudges: antenatal care is not
 * conditional on a number.
 */
function toolNudge(tool, f, state) {
  const bmiTone = bandAt(BMI_BANDS, f.bmi).tone
  const whtTone = bandAt(WHT_BANDS, f.whtr).tone
  switch (tool) {
    case 'bmi':
    case 'cal':
      if (bmiTone === 'ok') return null
      return bmiTone === 'low' ? 'tc.lg.nudge.bmiLow' : 'tc.lg.nudge.bmiHigh'
    case 'whtr':
      if (whtTone === 'ok') return null
      return whtTone === 'low' ? 'tc.lg.nudge.whtrLow' : 'tc.lg.nudge.whtrHigh'
    case 'ideal':
      if (state.weight > f.idealHi) return 'tc.lg.nudge.idealOver'
      if (state.weight < f.idealLo) return 'tc.lg.nudge.idealUnder'
      return null
    case 'mins':
      return f.total >= 60 ? 'tc.lg.nudge.mins' : null
    case 'goal':
      if (f.goal.mode === 'under' || f.goal.mode === 'floor') return 'tc.lg.nudge.goal'
      // The plan itself may be perfectly sensible, but if the weight they are
      // starting from is outside the healthy band that still earns the nudge —
      // otherwise the one screen aimed at people who want to change their
      // weight is the one screen that never mentions a doctor.
      if (bmiTone === 'ok') return null
      return bmiTone === 'low' ? 'tc.lg.nudge.bmiLow' : 'tc.lg.nudge.bmiHigh'
    case 'due':
      return 'tc.lg.nudge.due'
    default:
      return null
  }
}
/**
 * The food plan a reading earns. Deliberately reads the same bands the ruler
 * above it draws, so the plan can never disagree with the verdict on screen:
 * if the card says "Healthy", the plan is the maintenance one.
 *
 * Minutes-back is about time, not food, and a due date is not a diet, so both
 * return nothing and the section simply does not appear.
 */
function toolPlan(tool, f, state) {
  const byTone = (tone) => (tone === 'low' ? 'gain' : tone === 'ok' ? 'maintain' : 'manage')
  switch (tool) {
    case 'bmi':
      return { plan: byTone(bandAt(BMI_BANDS, f.bmi).tone) }
    case 'cal':
      // A day's calories is a day's food, so this one gets the meal-by-meal plan.
      return { plan: 'mealplan' }
    case 'ideal':
      if (state.weight < f.idealLo) return { plan: 'gain' }
      if (state.weight > f.idealHi) return { plan: 'manage' }
      return { plan: 'maintain' }
    case 'whtr':
      return { plan: byTone(bandAt(WHT_BANDS, f.whtr).tone) }
    case 'goal':
      if (f.goal.mode === 'lose') return { plan: 'manage', schedule: 'lose' }
      if (f.goal.mode === 'gain') return { plan: 'gainPlus', schedule: 'gain' }
      // 'same', 'floor' and 'under' all mean: do not chase the number further.
      return { plan: 'maintain' }
    default:
      return {}
  }
}

const pctOf = (bands, min, v) => {
  const max = bands[bands.length - 1].to
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))
}

/** One food line: what, how much, when, how often, and why. */
function DietRow({ item }) {
  const { t } = useI18n()
  const food = FOODS[item.id]
  if (!food) return null
  return (
    <li className="hx-diet-row">
      <span className="hx-diet-emoji" aria-hidden="true">{food.emoji}</span>
      <span className="hx-diet-body">
        <b>{t(`nut.food.${item.id}.name`)}</b>
        <em>{t(`nut.qty.${item.qty}`)} · {t(`nut.when.${item.when}`)} · {t(`nut.freq.${item.freq}`)}</em>
        <span>{t(`nut.food.${item.id}.why`)}</span>
        {food.alt && <span className="hx-diet-alt">{t('nut.alt')}: {t(`nut.food.${item.id}.alt`)}</span>}
      </span>
    </li>
  )
}

/**
 * What to eat, attached to the number that earned it.
 *
 * A reading on its own is a verdict; this is the part someone can act on
 * tonight. It stays short on purpose — items, what to cut back on, one habit —
 * rather than becoming a medical report nobody reads.
 */
function LedgerDiet({ plan: planId, schedule: scheduleId }) {
  const { t } = useI18n()
  const plan = planId ? PLANS[planId] : null
  if (!plan) return null
  const flow = scheduleId ? SCHEDULES[scheduleId] : null
  const first = plan.reduce[0]
  return (
    <div className="hx-diet">
      <p className="hx-diet-h">
        {t('nut.heading')}
        <span>{t('nut.goalLabel')}: {t(`nut.goal.${planId}`)}</span>
      </p>

      {plan.sections
        ? plan.sections.map((sec) => (
            <div key={sec.meal} className="hx-diet-sec">
              <p className="hx-diet-meal">{MEALS[sec.meal]} {t(`nut.meal.${sec.meal}`)}</p>
              <ul className="hx-diet-list">
                {sec.items.map((item, i) => <DietRow key={`${item.id}-${i}`} item={item} />)}
              </ul>
            </div>
          ))
        : (
          <ul className="hx-diet-list">
            {plan.items.map((item, i) => <DietRow key={`${item.id}-${i}`} item={item} />)}
          </ul>
        )}

      {plan.note && <p className="hx-diet-note">{t(`nut.note.${planId}`)}</p>}

      {flow && (
        <div className="hx-diet-sec">
          <p className="hx-diet-meal">{t('nut.flow')}</p>
          <ul className="hx-diet-flow">
            {flow.map((row) => (
              <li key={row.time}><b>{row.time}</b><span>{t(`nut.flow.${row.key}`)}</span></li>
            ))}
          </ul>
        </div>
      )}

      <div className="hx-diet-sec">
        <p className="hx-diet-meal">{t('nut.reduce')}</p>
        <div className="hx-diet-chips">
          {plan.reduce.map((id) => (
            <span key={id} className="hx-diet-chip">{REDUCE[id].emoji} {t(`nut.reduce.${id}.name`)}</span>
          ))}
        </div>
        {REDUCE[first]?.why && <p className="hx-diet-why">{t(`nut.reduce.${first}.why`)}</p>}
      </div>

      <p className="hx-diet-habit"><b>{t('nut.habit')}</b> {t('nut.habitText')}</p>
      <p className="hx-diet-safe">{t('nut.safety')}</p>
    </div>
  )
}

/**
 * What the plan was worked out from, named on the button.
 *
 * "Your diet plan" on its own reads as generic advice; "based on your body fat
 * of 23.3%" is obviously about the number they just uncovered. The values come
 * from the same figures the rulers draw, so the button can never quote a number
 * that disagrees with the verdict above it.
 */
function dietBasis(tool, f, state, t) {
  switch (tool) {
    case 'bmi':
      return t('tc.lg.diet.basisBmi', { v: f.bmi.toFixed(1) })
    case 'cal':
      return t('tc.lg.diet.basisCal', { v: f.maintain.toLocaleString('en-IN') })
    case 'ideal':
      return t('tc.lg.diet.basisIdeal', { lo: f.idealLo.toFixed(0), hi: f.idealHi.toFixed(0) })
    case 'whtr':
      return t('tc.lg.diet.basisWhtr', { v: f.whtr.toFixed(2) })
    case 'goal':
      return t('tc.lg.diet.basisGoal', { v: num(state.target) })
    default:
      return null
  }
}

/**
 * The plan, behind an offer rather than under every answer.
 *
 * It used to render straight after the reading, which buried the number someone
 * had just worked for under a page of food. Collapsed by default — including on
 * the opening body-fat screen, where the reading deserves a beat of its own.
 */
function DietToggle({ plan, schedule, basis }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  if (!plan) return null
  return (
    <div className="hx-diet-wrap">
      <button
        type="button"
        className={`hx-diet-cta${open ? ' on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="hx-diet-cta-ic" aria-hidden="true">🥗</span>
        <span className="hx-diet-cta-txt">
          <b>{t('tc.lg.diet.title')}</b>
          {basis && <i>{basis}</i>}
        </span>
        <svg className="hx-diet-cta-ch" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <LedgerDiet plan={plan} schedule={schedule} />}
    </div>
  )
}

/** Deurenberg: body fat from BMI, age and sex — no tape measure needed. */
const bodyFat = (bmi, age, sex) => 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4
/** The plain word for a reading — same vocabulary as the ruler above. */
const fatWord = (pct, sex) => {
  const b = fatBands(sex).find((x) => pct < x.to) || fatBands(sex)[3]
  return b.name
}

/** Naegele's rule: last period + 280 days. */
const dueDate = (lmp) => {
  const d = new Date(lmp)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + 280)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * The follow-ons. `needs` is the whole point — each one asks only for what it
 * is missing, at the moment you ask for it.
 */
const TOOLS = [
  // Body fat is now the opening check, so BMI takes its place in the list.
  // BMI needs nothing new — height and weight were asked up front.
  {
    id: 'bmi', chip: 'tc.lg.chip.bmi', q: 'tc.lg.q.bmi', needs: [],
    guess: { start: 24, min: 15, max: 40, step: 0.1, unit: '', dp: 1,
             ask: 'tc.lg.ask.bmi' },
  },
  {
    id: 'cal', chip: 'tc.lg.chip.cal', q: 'tc.lg.q.cal', needs: ['age', 'sex', 'act'],
    guess: { start: 2000, min: 1000, max: 4000, step: 50, unit: 'kcal', dp: 0,
             ask: 'tc.lg.ask.cal' },
  },
  {
    id: 'ideal', chip: 'tc.lg.chip.ideal', q: 'tc.lg.q.ideal', needs: [],
    guess: { start: 65, min: 35, max: 130, step: 0.5, unit: 'kg', dp: 1,
             ask: 'tc.lg.ask.ideal' },
  },
  {
    id: 'mins', chip: 'tc.lg.chip.mins', q: 'tc.lg.q.mins', needs: ['waist', 'sleep', 'act'],
    guess: { start: 60, min: 0, max: 300, step: 5, unit: 'min', dp: 0,
             ask: 'tc.lg.ask.mins' },
  },
  {
    id: 'whtr', chip: 'tc.lg.chip.whtr', q: 'tc.lg.q.whtr', needs: ['waist'],
    guess: { start: 0.5, min: 0.35, max: 0.7, step: 0.01, unit: '', dp: 2,
             ask: 'tc.lg.ask.whtr' },
  },
  // No guess on either of these two. A due date is a date, and a weight goal is
  // a number you chose yourself a moment ago — there is nothing to guess at.
  { id: 'goal', chip: 'tc.lg.chip.goal', q: 'tc.lg.q.goal', needs: ['target', 'age', 'sex', 'act'] },
  { id: 'due', chip: 'tc.lg.chip.due', q: 'tc.lg.q.due', needs: ['lmp'] },
]

/**
 * Body-fat bands, per sex.
 *
 * The clinical scale has five (Essential / Athletic / Fit / Average / High) but
 * "Essential" is 3 points wide and "Fit" is 4 — on a ruler that spans 42 points
 * those labels sit in 7% and 9% slots and collide into each other. Merged to the
 * same four words the BMI ruler uses, so both scales read the same way and every
 * label has room.
 */
const fatBands = (sex) => (sex === 'male'
  ? [{ to: 6, tone: 'low', name: 'tc.lg.band.low' }, { to: 18, tone: 'ok', name: 'tc.lg.band.ok' },
     { to: 25, tone: 'warn', name: 'tc.lg.band.warn' }, { to: 45, tone: 'high', name: 'tc.lg.band.high' }]
  : [{ to: 14, tone: 'low', name: 'tc.lg.band.low' }, { to: 25, tone: 'ok', name: 'tc.lg.band.ok' },
     { to: 32, tone: 'warn', name: 'tc.lg.band.warn' }, { to: 50, tone: 'high', name: 'tc.lg.band.high' }])
const FAT_MIN = 3

/* ─────────────────────────────  PARTS  ───────────────────────────── */

function Scale({ name, bands, min, value, format, ghost }) {
  const { t } = useI18n()
  const max = bands[bands.length - 1].to
  const tone = bandAt(bands, value).tone
  let prev = min
  return (
    <div className="hx-scale">
      <div className="hx-scale-top">
        <span className="hx-scale-name">{name}</span>
        <span className="hx-scale-val">{format(value)}<i>{t(TONE_WORD[tone])}</i></span>
      </div>
      <div className="hx-track">
        {bands.map((b) => {
          const w = ((b.to - prev) / (max - min)) * 100
          prev = b.to
          return (
            <span className="hx-band" data-tone={b.tone} key={b.name} style={{ width: `${w}%` }}>
              <span>{t(b.name)}</span>
            </span>
          )
        })}
        {ghost != null && (
          <span className="hx-mark ghost" style={{ left: `${pctOf(bands, min, ghost)}%` }}>
            <i>{t('tc.lg.yourGuess')}</i>
          </span>
        )}
        <span className={`hx-mark ${tone}`} style={{ left: `${pctOf(bands, min, value)}%` }} />
      </div>
    </div>
  )
}

function Range({ id, value, min, max, step, onChange, label }) {
  const p = ((value - min) / (max - min)) * 100
  return (
    <input
      className="hx-range" type="range" id={id} aria-label={label}
      min={min} max={max} step={step} value={value}
      style={{ '--p': `${p}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  )
}

function Slider({ id, label, val, ...rest }) {
  return (
    <div className="hx-s">
      <div className="hx-s-top">
        <label htmlFor={id}>{label}</label>
        <span className="hx-s-val">{val}</span>
      </div>
      <Range id={id} label={label} {...rest} />
    </div>
  )
}

function BigNum({ value, className = '', children }) {
  const ref = useRef(null)
  const last = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || last.current === value) return
    last.current = value
    el.classList.remove('beat')
    void el.offsetWidth   // reflow, so the animation actually restarts
    el.classList.add('beat')
  }, [value])
  return <div ref={ref} className={`hx-big ${className}`}>{children}</div>
}

/** The extra questions a tool needs, asked inside that tool. */
function Asks({ needs, state, set, lmp, setLmp }) {
  const { t } = useI18n()
  const num = (v) => (v % 1 ? v.toFixed(1) : v)
  return (
    <div className="hx-asks">
      {needs.includes('age') && (
        <Slider id="tAge" label={t('calc.field.age')} val={t('lx.unit.nYrs', { n: state.age })}
          value={state.age} min={14} max={99} step={1} onChange={set('age')} />
      )}
      {needs.includes('waist') && (
        <Slider id="tWaist" label={t('lx.lg.waist')} val={`${num(state.waist)} cm`}
          value={state.waist} min={50} max={180} step={0.5} onChange={set('waist')} />
      )}
      {needs.includes('sleep') && (
        <Slider id="tSleep" label={t('lx.lg.sleep')} val={t('lx.unit.nHrs', { n: num(state.sleep) })}
          value={state.sleep} min={3} max={12} step={0.5} onChange={set('sleep')} />
      )}
      {needs.includes('sex') && (
        <div className="hx-f">
          <label>{t('tc.lg.youAre')}</label>
          <div className="hx-pick">
            {['female', 'male'].map((v) => (
              <button key={v} type="button" className="hx-opt"
                aria-pressed={state.sex === v} onClick={() => set('sex')(v)}>
                {v === 'female' ? t('calc.opt.female') : t('calc.opt.male')}
              </button>
            ))}
          </div>
        </div>
      )}
      {needs.includes('act') && (
        <div className="hx-f">
          <label>{t('tc.lg.howMuchMove')}</label>
          <div className="hx-pick tight">
            {Object.entries(ACTIVITY).map(([k, v]) => (
              <button key={k} type="button" className="hx-opt"
                aria-pressed={state.act === k} onClick={() => set('act')(k)}>
                {t(v.label)}
              </button>
            ))}
          </div>
        </div>
      )}
      {needs.includes('target') && (
        <Slider id="tTarget" label={t('tc.lg.targetWeight')} val={`${num(state.target)} kg`}
          value={state.target} min={35} max={150} step={0.5} onChange={set('target')} />
      )}
      {needs.includes('lmp') && (
        <div className="hx-f">
          <label htmlFor="tLmp">{t('tc.lg.lmp')}</label>
          <input id="tLmp" className="hx-tool-date" type="date" value={lmp} onChange={(e) => setLmp(e.target.value)} />
        </div>
      )}
    </div>
  )
}

/**
 * Guess, then reveal — the same move the BMI check opens with, reused for every
 * tool. Committing to a number before you see it is what turns a readout into a
 * game, and it works just as well for calories as it does for BMI.
 */
function GuessThenReveal({ cfg, actual, unit, children, sub, scale, foot }) {
  const { t } = useI18n()
  const [guess, setGuess] = useState(cfg.start)
  const [shown, setShown] = useState(false)
  const [roll, setRoll] = useState(null)

  const value = roll ?? actual
  const miss = Math.abs(actual - guess)
  const close = miss <= (cfg.max - cfg.min) * 0.03      // within 3% of the range
  const fmt = (v) => v.toFixed(cfg.dp)

  const reveal = () => {
    setShown(true)
    const t0 = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1000)
      setRoll(guess + (actual - guess) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(step)
      else setRoll(null)
    }
    requestAnimationFrame(step)
  }

  if (!shown) {
    return (
      <div className="hx-guess tool">
        <p className="hx-guess-q"><b>{t(cfg.ask)}</b></p>
        <div className="hx-guess-n">{fmt(guess)}<small>{unit}</small></div>
        <Range id={`g-${unit}`} label={t(cfg.ask)}
          value={guess} min={cfg.min} max={cfg.max} step={cfg.step} onChange={setGuess} />
        <div className="hx-guess-ends"><span>{cfg.min}</span><span>{cfg.max}</span></div>
        <button className="btn btn-primary btn-lg" onClick={reveal}>{t('tc.lg.showReal')}</button>
        <p className="hx-guess-note">{t('tc.lg.noPeeking')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="hx-tool-n">{fmt(value)}<small>{unit}</small></div>
      <p className="hx-verdict tool">
        {close
          ? <>{t('tc.lg.youGuessed')} <b>{fmt(guess)}</b>{t('tc.lg.veryClose')}</>
          : <>{t('tc.lg.youGuessed')} <b>{fmt(guess)}</b> {t('tc.lg.youAreOff')} <b>{fmt(miss)} {actual > guess ? t('tc.lg.higher') : t('tc.lg.lower')}</b> {t('tc.lg.thanThought')}</>}
      </p>
      {scale}
      {sub}
      {children}
      {/* after the reveal only — showing it sooner gives the answer away */}
      {foot}
    </>
  )
}

/* ─────────────────────────────  MATHS  ───────────────────────────── */

function useFigures(state) {
  const { t } = useI18n()
  return useMemo(() => {
    const h = state.height / 100
    const bmi = state.weight / (h * h)
    const whtr = state.waist / state.height
    const bmr = state.sex === 'male'
      ? 10 * state.weight + 6.25 * state.height - 5 * state.age + 5
      : 10 * state.weight + 6.25 * state.height - 5 * state.age - 161

    const rows = []
    const a = ACTIVITY[state.act]
    // t() here, not at render: the ledger rows below are plain strings by the
    // time they are printed, so a key left untranslated shows up raw.
    if (a.back) rows.push([t(a.why), a.back])
    const debt = Math.max(0, 7 - state.sleep)
    if (debt > 0) rows.push([t('lx.lg.rowSleep', { h: state.sleep }), Math.round(debt * 20)])
    const over = Math.max(0, bmi - 22.9)
    if (over > 0.05) rows.push([t('lx.lg.rowBmi', { v: bmi.toFixed(1) }), Math.round(over * 15)])
    const wOver = Math.max(0, whtr - 0.5)
    if (wOver > 0.005) rows.push([t('lx.lg.rowWaist', { v: Math.round(whtr * 100) }), Math.round((wOver / 0.05) * 20)])

    let advice
    if (whtr >= 0.6) advice = t('lx.lg.advice.waist60')
    else if (bmi >= 25) advice = t('lx.lg.advice.bmi')
    else if (whtr >= 0.5) advice = t('lx.lg.advice.waist50')
    else if (state.sleep < 6) advice = t('lx.lg.advice.sleep')
    else if (bmi < 18.5) advice = t('lx.lg.advice.under')
    else advice = t('lx.lg.advice.fine')

    const maintain = Math.round((bmr * ACTIVITY[state.act].factor) / 10) * 10
    const idealLo = 18.5 * h * h
    const idealHi = 22.9 * h * h

    /**
     * Getting to a chosen weight.
     *
     * Half a kilo a week is the pace that stays off, and 7700 kcal is roughly
     * one kilo of body fat — so the daily change is 550 kcal either way. The
     * floor matters more than the arithmetic: we never print an intake below
     * 1200 (female) / 1500 (male), we let the date slip instead. If maintenance
     * is already at that floor there is no safe cut left to suggest, and we say
     * so rather than showing a number nobody should eat to.
     */
    const FLOOR = state.sex === 'male' ? 1500 : 1200
    const gap = state.target - state.weight
    const losing = gap < 0
    let goal
    if (Math.abs(gap) < 0.25) {
      goal = { mode: 'same', kcal: maintain }
    } else if (state.target < idealLo) {
      goal = { mode: 'under' }
    } else {
      const wanted = maintain + (losing ? -550 : 550)
      const kcal = Math.max(FLOOR, Math.round(wanted / 10) * 10)
      if (losing && kcal >= maintain) {
        goal = { mode: 'floor' }
      } else {
        // The real daily deficit after the floor, so the date never promises a
        // pace the calorie number cannot actually deliver.
        const perDay = Math.abs(maintain - kcal)
        const weeks = Math.abs(gap) / ((perDay * 7) / 7700)
        const when = new Date()
        when.setDate(when.getDate() + Math.round(weeks * 7))
        goal = { mode: losing ? 'lose' : 'gain', kcal, when }
      }
    }

    return {
      bmi, whtr, bmr, advice, rows, maintain, idealLo, idealHi, goal,
      total: rows.reduce((s, r) => s + r[1], 0),
      water: (state.weight * 33) / 1000,
    }
    // t is a dependency because the rows above are translated in here, not at
    // render — without it, switching language leaves them in the old one until
    // some input happens to change.
  }, [state, t])
}

const DEFAULTS = { height: 172, weight: 78, guess: 22, waist: 92, sleep: 6, age: 34, sex: 'male', act: 'light', target: 72 }
const num = (v) => (v % 1 ? v.toFixed(1) : v)

/* ─────────────────────────────  STORE  ───────────────────────────── */

const LedgerCtx = createContext(null)

export function LedgerProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [touched, setTouched] = useState(false)
  const [state, setState] = useState(DEFAULTS)
  const f = useFigures(state)

  const set = (k) => (v) => {
    if (revealed && k !== 'guess') setTouched(true)
    setState((s) => ({ ...s, [k]: v }))
  }

  useEffect(() => {
    const openIt = () => setOpen(true)
    window.addEventListener('tc:open-ledger', openIt)
    return () => window.removeEventListener('tc:open-ledger', openIt)
  }, [])

  return (
    <LedgerCtx.Provider value={{ open, setOpen, revealed, setRevealed, touched, state, set, f }}>
      {children}
    </LedgerCtx.Provider>
  )
}

const useLedger = () => useContext(LedgerCtx)

/* ────────────────────────── HERO CARD ────────────────────────── */

export function LedgerHeroCard() {
  // above the early return: a hook must not sit behind a condition
  const { t } = useI18n()
  const ctx = useLedger()
  if (!ctx) return null
  const { f, touched, setOpen } = ctx
  const tone = bandAt(BMI_BANDS, f.bmi).tone
  const max = BMI_BANDS[BMI_BANDS.length - 1].to
  let prev = BMI_MIN

  return (
    <button type="button" className="glass float card-vitals card-ledger" onClick={() => setOpen(true)}>
      <span className="hxc-top">
        <span className="kicker">{touched ? t('lx.lg.card.winBack') : t('lx.lg.card.deskJob')}</span>
        <span className="pill good"><i className="live-dot" /> {t('tc.lg.live')}</span>
      </span>

      <span className="hxc-num">{f.total}<small>{t('tc.lg.minsADay')}</small></span>

      <span className="hxc-ecg" aria-hidden="true">
        <svg viewBox="0 0 320 40" preserveAspectRatio="none">
          <path className="e-base" d="M0 24 H40 l6-13 7 25 6-19 5 7 H108 l8-10 6 19 7-22 5 13 H196 l7-12 6 22 7-17 5 7 H320" />
          <path className="e-run" d="M0 24 H40 l6-13 7 25 6-19 5 7 H108 l8-10 6 19 7-22 5 13 H196 l7-12 6 22 7-17 5 7 H320" />
        </svg>
      </span>

      <span className="hxc-track" aria-hidden="true">
        {BMI_BANDS.map((b) => {
          const w = ((b.to - prev) / (max - BMI_MIN)) * 100
          prev = b.to
          return <span className="b" data-tone={b.tone} key={b.name} style={{ width: `${w}%` }} />
        })}
        <span className={`m ${tone}`} style={{ left: `${pctOf(BMI_BANDS, BMI_MIN, f.bmi)}%` }} />
      </span>

      <span className="hxc-cta">
        {t('lx.lg.card.cta')}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14m-6-7 7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  )
}

/* ─────────────────────────────  SHEET  ───────────────────────────── */

function LedgerSheet({ state, set, f, onClose, revealed, setRevealed }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const revealRef = useRef(null)
  const [tool, setTool] = useState(null)
  const [lmp, setLmp] = useState('')
  const [roll, setRoll] = useState(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const fat = bodyFat(f.bmi, state.age, state.sex)
  const gap = fat - state.guess
  const miss = Math.abs(gap)
  const bullseye = miss < 1              // body fat is a wider scale than BMI
  const shownFat = roll ?? fat
  const fatTone = bandAt(fatBands(state.sex), shownFat).tone
  const due = lmp ? dueDate(lmp) : null
  const open = TOOLS.find((x) => x.id === tool)
  const nudge = tool ? toolNudge(tool, f, state) : null
  const nudgeEl = nudge ? (
    <div className="hx-next">
      <p>{t(nudge)}</p>
      <button className="btn btn-primary" onClick={() => navigate('/search?q=General%20Physician')}>
        {t('tc.lg.bookGp')}
      </button>
    </div>
  ) : null
  // Food first, the doctor second: the plan is what someone can act on today,
  // and the nudge reads as the next step rather than the only one.
  const dietEl = tool
    ? <DietToggle {...toolPlan(tool, f, state)} basis={dietBasis(tool, f, state, t)} />
    : null
  const footEl = (dietEl || nudgeEl) ? <>{dietEl}{nudgeEl}</> : null

  /** The number rolls from the guess to the truth — the payoff of the whole thing. */
  const reveal = () => {
    setRevealed(true)
    const from = state.guess
    const to = fat
    const t0 = performance.now()
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1150)
      setRoll(from + (to - from) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) requestAnimationFrame(step)
      else setRoll(null)
    }
    requestAnimationFrame(step)
    setTimeout(() => revealRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  return (
    <div
      className={`hx-sheet on ${revealed ? 'revealed' : ''}`}
      role="dialog" aria-modal="true" aria-label={t('tc.lg.eyebrow')}
      onMouseDown={onClose}
    >
      <div className="hx-sheet-in" onMouseDown={(e) => e.stopPropagation()}>
        <button className="hx-x" onClick={onClose} aria-label={t('pm.close')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <span className="eyebrow"><TypeLoop text={t('tc.lg.eyebrow')} /></span>
        <h3>
          {revealed
            ? <>{t('tc.lg.hereIsNumber')}<br /><span className="serif grad">{t('tc.lg.nowFun')}</span></>
            : <>{t('tc.lg.fourQs')}<br /><span className="serif grad">{t('tc.lg.thenGuess')}</span></>}
        </h3>

        <div className="hx">
          {/* ── what body fat needs: height, weight, age, sex ── */}
          <div className="hx-inputs">
            <Slider id="hxHeight" label={t('lx.lg.howTall')} val={`${num(state.height)} cm`}
              value={state.height} min={130} max={215} step={1} onChange={set('height')} />
            <Slider id="hxWeight" label={t('lx.lg.howHeavy')} val={`${num(state.weight)} kg`}
              value={state.weight} min={30} max={200} step={0.5} onChange={set('weight')} />
            <Slider id="hxAge" label={t('lx.lg.howOld')} val={t('lx.unit.nYrs', { n: state.age })}
              value={state.age} min={14} max={99} step={1} onChange={set('age')} />
            <div className="hx-f">
              <label>{t('tc.lg.youAre')}</label>
              <div className="hx-pick">
                {['female', 'male'].map((v) => (
                  <button key={v} type="button" className="hx-opt"
                    aria-pressed={state.sex === v} onClick={() => set('sex')(v)}>
                    {v === 'female' ? t('calc.opt.female') : t('calc.opt.male')}
                  </button>
                ))}
              </div>
            </div>

            {!revealed && (
              <div className="hx-guess">
                <p className="hx-guess-q">{t('tc.lg.beforeShow')}<br /><b>{t('tc.lg.askFat')}</b></p>
                <div className="hx-guess-n">{state.guess.toFixed(1)}<small>%</small></div>
                <Range id="hxGuess" label={t('lx.lg.guessFat')}
                  value={state.guess} min={5} max={50} step={0.5} onChange={set('guess')} />
                <div className="hx-guess-ends"><span>5%</span><span>50%</span></div>
                <button className="btn btn-primary btn-lg" onClick={reveal}>{t('tc.lg.showReal')}</button>
                <p className="hx-guess-note">{t('tc.lg.mostFurther')}</p>
              </div>
            )}
          </div>

          {/* ── the answer, and only the answer ── */}
          {revealed && !open && (
            <div className="hx-out">
              <div className="hx-reveal" ref={revealRef}>
                <p className="hx-pre">
                  {t('lx.lg.yourBodyFat')}
                  {bullseye && <span className="hx-bull">{t('tc.lg.bullseye')}</span>}
                </p>
                <BigNum value={shownFat.toFixed(1)} className={`tone-${fatTone} ${bullseye && roll === null ? 'hit' : ''}`}>
                  {shownFat.toFixed(1)}<small>%</small>
                </BigNum>
                <p className="hx-verdict">
                  {bullseye
                    ? <>{t('tc.lg.youGuessed')} <b>{state.guess.toFixed(1)}%</b>{t('tc.lg.calledIt')}</>
                    : gap > 0
                      ? <>{t('tc.lg.youGuessed')} <b>{state.guess.toFixed(1)}%</b> {t('tc.lg.youAreOff')} <b>{gap.toFixed(1)} {t('tc.lg.higher')}</b> {t('tc.lg.thanThought')}</>
                      : <>{t('tc.lg.youGuessed')} <b>{state.guess.toFixed(1)}%</b> {t('tc.lg.youAreOff')} <b>{miss.toFixed(1)} {t('tc.lg.lower')}</b> {t('tc.lg.thanThought')}</>}
                </p>
                <p className="hx-score">
                  {bullseye ? t('tc.lg.almostNobody')
                    : <>{t('tc.lg.thatIs')} <b>{t(fatWord(fat, state.sex))}</b> — {state.age} {t('tc.lg.yearOld')}.</>}
                </p>
                <Scale name={t('tc.lg.whereThatSits')} bands={fatBands(state.sex)} min={FAT_MIN}
                  value={shownFat} ghost={bullseye ? null : state.guess} format={(v) => v.toFixed(1)} />
                <p className="hx-score">
                  {t('tc.lg.estimateNote')}
                </p>
                <DietToggle
                  plan={fatTone === 'high' || fatTone === 'warn' ? 'bodyfat' : 'maintain'}
                  basis={t('tc.lg.diet.basisFat', { v: shownFat.toFixed(1) })}
                />
              </div>

              {/* ── the offer ── */}
              <div className="hx-play">
                <p className="hx-play-q">{t('tc.lg.checkElse')}</p>
                <div className="hx-chips">
                  {TOOLS.map((tl) => (
                    <button key={tl.id} className="hx-chip" onClick={() => setTool(tl.id)}>
                      {t(tl.chip)}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 12h14m-6-7 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              <div className="hx-next">
                <p>{f.advice}</p>
                <button className="btn btn-primary" onClick={() => navigate('/search?q=General%20Physician')}>
                  {t('tc.lg.bookGp')}
                </button>
              </div>

              <p className="hx-priv">
                <b>{t('tc.lg.privacy')}</b> {t('lx.lg.privacyBody')}
              </p>
            </div>
          )}

          {/* ── a tool, opened as its own screen ── */}
          {revealed && open && (
            <div className="hx-out">
              <div className="hx-tool-screen">
                <button className="hx-back" onClick={() => setTool(null)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M19 12H5m6 7-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('lx.lg.backToBmi', { v: f.bmi.toFixed(1) })}
                </button>

                <div className="hx-tool">
                    <p className="hx-tool-q">{t(open.q)}</p>

                    {open.needs.length > 0 && (
                      <Asks needs={open.needs} state={state} set={set} lmp={lmp} setLmp={setLmp} />
                    )}

                    {tool === 'bmi' && (
                      <GuessThenReveal
                        cfg={open.guess} actual={f.bmi} unit="" foot={footEl}
                        scale={<Scale name={t('tc.lg.whereThatSits')} bands={BMI_BANDS} min={BMI_MIN}
                          value={f.bmi} format={(v) => v.toFixed(1)} />}
                        sub={
                          <p className="hx-tool-s">
                            {t('lx.lg.bmiNoteA')} <b>22.9</b> {t('lx.lg.bmiNoteB')}
                          </p>
                        }
                      />
                    )}

                    {tool === 'cal' && (
                      <GuessThenReveal
                        cfg={open.guess} actual={f.maintain} unit={t('lx.unit.kcalADay')} foot={footEl}
                        sub={
                          <p className="hx-tool-s">
                            {t('lx.lg.calA', { w: num(state.weight) })}{' '}
                            <b>{Math.round(f.bmr).toLocaleString('en-IN')} {t('lx.unit.kcal')}</b> {t('lx.lg.calB')}
                          </p>
                        }
                      />
                    )}

                    {tool === 'ideal' && (
                      <GuessThenReveal
                        cfg={open.guess} actual={(f.idealLo + f.idealHi) / 2} unit="kg" foot={footEl}
                        sub={
                          <p className="hx-tool-s">
                            {t('lx.lg.idealA')}{' '}
                            <b>{f.idealLo.toFixed(0)}&ndash;{f.idealHi.toFixed(0)} kg</b> {t('lx.lg.idealB', { h: num(state.height) })}{' '}
                            <b>{num(state.weight)} kg</b>
                            {state.weight > f.idealHi
                              ? <>{t('lx.lg.idealOver', { n: (state.weight - f.idealHi).toFixed(0) })}</>
                              : state.weight < f.idealLo
                                ? <>{t('lx.lg.idealUnder', { n: (f.idealLo - state.weight).toFixed(0) })}</>
                                : <>{t('tc.lg.rightWhere')}</>}
                          </p>
                        }
                      />
                    )}

                    {tool === 'mins' && (
                      <GuessThenReveal
                        cfg={open.guess} actual={f.total} unit={t('tc.lg.minsADay')} foot={footEl}
                        sub={
                          <p className="hx-tool-s">
                            {f.total === 0
                              ? t('lx.lg.minsNone')
                              : t('lx.lg.minsSome', { h: (f.total / 60).toFixed(1) })}
                          </p>
                        }
                      >
                        <Scale name={t('tc.lg.whtrScale')} bands={WHT_BANDS} min={WHT_MIN}
                          value={f.whtr} format={(v) => v.toFixed(2)} />
                        <div className="hx-ledger">
                          <h4>{t('tc.lg.takingTime')}</h4>
                          {f.rows.length ? (
                            <>
                              {f.rows.map(([why, mins]) => (
                                <div key={why}><span>{why}</span><span>{t('lx.lg.plusMin', { n: mins })}</span></div>
                              ))}
                              <div className="tot"><span>{t('tc.lg.winBack')}</span><span>{t('lx.lg.minADay', { n: f.total })}</span></div>
                            </>
                          ) : (
                            <p className="none">{t('tc.lg.nothingToAdd')}</p>
                          )}
                        </div>
                      </GuessThenReveal>
                    )}

                    {tool === 'whtr' && (
                      <GuessThenReveal
                        cfg={open.guess} actual={f.whtr} unit="" foot={footEl}
                        scale={<Scale name={t('tc.lg.whtrScale')} bands={WHT_BANDS} min={WHT_MIN}
                          value={f.whtr} format={(v) => v.toFixed(2)} />}
                        sub={
                          <p className="hx-tool-s">
                            {t('tc.lg.whtrNote')} {t('lx.lg.halfHeight')}{' '}
                            <b>{(state.height / 2).toFixed(0)} cm</b> {t('lx.lg.waistIs')} <b>{num(state.waist)} cm</b>.
                          </p>
                        }
                      />
                    )}

                    {tool === 'goal' && (
                      <>
                        <div className="hx-tool-n">
                          {f.goal.kcal ? f.goal.kcal.toLocaleString('en-IN') : '—'}
                          <small>{f.goal.kcal ? `${t('lx.unit.kcal')} ${t('tc.lg.goalAt')}` : ''}</small>
                        </div>
                        <p className="hx-tool-s">
                          {f.goal.mode === 'same' && fill(t('tc.lg.goalSame'), { kcal: f.goal.kcal.toLocaleString('en-IN') })}
                          {f.goal.mode === 'floor' && t('tc.lg.goalFloor')}
                          {f.goal.mode === 'under' && fill(t('tc.lg.goalUnder'), {
                            lo: f.idealLo.toFixed(0), hi: f.idealHi.toFixed(0),
                          })}
                          {(f.goal.mode === 'lose' || f.goal.mode === 'gain') && fill(
                            t(f.goal.mode === 'lose' ? 'tc.lg.goalLose' : 'tc.lg.goalGain'),
                            {
                              kcal: f.goal.kcal.toLocaleString('en-IN'),
                              target: num(state.target),
                              when: f.goal.when.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
                            },
                          )}
                        </p>
                        {footEl}
                      </>
                    )}

                    {tool === 'due' && (
                      due
                        ? <>
                            <div className="hx-tool-n">{due}</div>
                            <p className="hx-tool-s">{t('tc.lg.dueNote')}</p>
                            {footEl}
                          </>
                        : <p className="hx-tool-s">{t('tc.lg.duePick')}</p>
                    )}
                </div>

                {/* the other doors, from in here */}
                <div className="hx-play">
                  <p className="hx-play-q">{t('tc.lg.tryAnother')}</p>
                  <div className="hx-chips">
                    {TOOLS.filter((x) => x.id !== tool).map((tl) => (
                      <button key={tl.id} className="hx-chip" onClick={() => setTool(tl.id)}>
                        {t(tl.chip)}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 12h14m-6-7 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────  TEASER  ───────────────────────────── */

/**
 * The result cards beside the pitch.
 *
 * Every figure is computed from the same `useFigures` state the tool itself
 * runs on, so the preview can never disagree with what the check actually
 * shows you a moment later. Nothing here is a hardcoded marketing number.
 */
function ShowcaseCards({ f, state }) {
  const { t } = useI18n()
  const band = bandAt(BMI_BANDS, f.bmi)
  const fat = bodyFat(f.bmi, state.age, state.sex)
  const fatPct = Math.max(0, Math.min(100, ((fat - 5) / 40) * 100))

  // the ring: 0 at BMI 15, full at BMI 35
  const R = 52
  const C = 2 * Math.PI * R
  const ringPct = Math.max(0, Math.min(1, (f.bmi - 15) / 20))

  return (
    <div className="hx-show" aria-hidden="true">
      <span className="hx-show-wash" />

      <div className="hx-c hx-c-bmi">
        <span className="hx-c-k">{t('tc.lg.yourBmi')}</span>
        <div className="hx-ring">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={R} className="hx-ring-bg" />
            <circle
              cx="60" cy="60" r={R} className="hx-ring-fg"
              strokeDasharray={`${C * ringPct} ${C}`}
            />
          </svg>
          <span className="hx-ring-mid">
            <b>{f.bmi.toFixed(1)}</b>
            <i>{t(band.name)}</i>
          </span>
        </div>
        <span className={`hx-c-tag t-${band.tone}`}>{t(band.name)}</span>
      </div>

      <div className="hx-c hx-c-fat">
        <span className="hx-c-ic" data-i="fat" />
        <span className="hx-c-k">{t('tc.lg.bodyFat')}</span>
        <b className="hx-c-v">{fat.toFixed(0)}<small>%</small></b>
        <span className="hx-bar"><i style={{ width: `${fatPct}%` }} /></span>
        <span className="hx-c-note">{t(fatWord(fat, state.sex))}</span>
      </div>

      <div className="hx-c hx-c-ideal">
        <span className="hx-c-k">{t('tc.lg.idealWeight')}</span>
        <b className="hx-c-v">{f.idealHi.toFixed(1)}<small>kg</small></b>
        <span className="hx-c-note">{t('lx.lg.healthyRange', { lo: f.idealLo.toFixed(1), hi: f.idealHi.toFixed(1) })}</span>
      </div>

      <div className="hx-c hx-c-wt">
        <span className="hx-c-k">{t('tc.lg.weight')}</span>
        <b className="hx-c-v">{state.weight.toFixed(1)}<small>kg</small></b>
        <svg className="hx-spark" viewBox="0 0 120 34" preserveAspectRatio="none">
          <polyline points="2,26 20,22 38,25 56,16 74,18 92,10 118,6" />
        </svg>
        <span className="hx-c-note">{t('tc.lg.whatYouTold')}</span>
      </div>

      <div className="hx-c hx-c-cal">
        <span className="hx-c-ic" data-i="cal" />
        <span className="hx-c-k">{t('tc.lg.dailyCalories')}</span>
        <b className="hx-c-v">{f.maintain.toLocaleString('en-IN')}<small>{t('lx.unit.kcal')}</small></b>
        <span className="hx-c-note">{t('tc.lg.toStay')}</span>
      </div>
    </div>
  )
}

function TcLedger() {
  const { t } = useI18n()
  const { open, setOpen, revealed, setRevealed, state, set, f } = useLedger()

  return (
    <>
      <section className="sec hx-sec" id="health">
        <div className="wrap">
          <div className="hx-teaser rv">
            <div className="hx-teaser-copy">
              <span className="eyebrow"><TypeLoop text={t('tc.lg.heroTitle')} /></span>
              <h2>{t('tc.lg.h2a')}<br /><span className="serif grad">{t('tc.lg.h2b')}</span></h2>
              <p className="lede">{t('tc.lg.teaserLede')}</p>

              <div className="hx-teaser-act">
                <span className="hx-teaser-num">
                  {bodyFat(f.bmi, state.age, state.sex).toFixed(0)}
                  <small>{t('tc.lg.heroSub')}</small>
                </span>
                <button className="btn btn-primary btn-lg" onClick={() => setOpen(true)}>
                  {t('tc.lg.takeCheck')} <span aria-hidden="true">→</span>
                </button>
              </div>

              <ul className="hx-trust">
                {[
                  [CircleCheck, 'tc.lg.trust1.t', 'tc.lg.trust1.d'],
                  [Timer, 'tc.lg.trust2.t', 'tc.lg.trust2.d'],
                  [Apple, 'tc.lg.trust3.t', 'tc.lg.trust3.d'],
                  [Lock, 'tc.lg.trust4.t', 'tc.lg.trust4.d'],
                ].map(([Icon, title, note]) => (
                  <li key={title}>
                    <span className="hx-t-ic"><Icon size={17} strokeWidth={2.1} /></span>
                    <span>
                      <b>{t(title)}</b>
                      <i>{t(note)}</i>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ShowcaseCards f={f} state={state} />
          </div>
        </div>
      </section>

      {open && (
        <LedgerSheet
          state={state} set={set} f={f}
          revealed={revealed} setRevealed={setRevealed}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export default TcLedger
