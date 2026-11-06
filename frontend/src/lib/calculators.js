/**
 * Health-calculator definitions for the landing-page sidebar. Each entry is
 * self-contained: the fields to collect and a pure `compute(values)` that
 * returns { headline, unit, label, tone, note } — or null if inputs are
 * incomplete/invalid. Keyed by the same `label` used in landingData.js.
 */

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const ACTIVITY = [
  { value: '1.2', label: 'Sedentary (little/no exercise)' },
  { value: '1.375', label: 'Light (1–3 days/week)' },
  { value: '1.55', label: 'Moderate (3–5 days/week)' },
  { value: '1.725', label: 'Active (6–7 days/week)' },
  { value: '1.9', label: 'Very active (hard training/job)' },
]

const SEX = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

// Only the BMR calculator asks this outright; everywhere else the goal is
// implied by the result (a BMI of 31 does not need to be asked).
const GOALS = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
]

const GOAL_PLANS = { lose: 'manage', maintain: 'maintain', gain: 'gain' }

// Mifflin-St Jeor basal metabolic rate (kcal/day).
function mifflinBMR({ sex, age, height, weight }) {
  const base = 10 * weight + 6.25 * height - 5 * age
  return sex === 'female' ? base - 161 : base + 5
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', tone: 'amber' }
  if (bmi < 25) return { label: 'Normal weight', tone: 'green' }
  if (bmi < 30) return { label: 'Overweight', tone: 'amber' }
  return { label: 'Obese', tone: 'red' }
}

export const CALCULATORS = {
  'BMI Calculator': {
    blurb: 'Body Mass Index from your height and weight.',
    fields: [
      { name: 'height', label: 'Height', unit: 'cm', type: 'number' },
      { name: 'weight', label: 'Weight', unit: 'kg', type: 'number' },
    ],
    compute: (v) => {
      const h = num(v.height)
      const w = num(v.weight)
      if (!h || !w || h < 50 || w < 10) return null
      const m = h / 100
      const bmi = w / (m * m)
      const cat = bmiCategory(bmi)
      return {
        headline: bmi.toFixed(1),
        unit: 'kg/m²',
        label: cat.label,
        tone: cat.tone,
        plan: bmi < 18.5 ? 'gain' : bmi < 25 ? 'maintain' : 'manage',
      }
    },
  },

  'Calorie Calculator': {
    blurb: 'Daily calories to maintain your current weight (TDEE).',
    fields: [
      { name: 'sex', label: 'Sex', type: 'select', options: SEX },
      { name: 'age', label: 'Age', unit: 'yrs', type: 'number' },
      { name: 'height', label: 'Height', unit: 'cm', type: 'number' },
      { name: 'weight', label: 'Weight', unit: 'kg', type: 'number' },
      { name: 'activity', label: 'Activity level', type: 'select', options: ACTIVITY },
    ],
    compute: (v) => {
      const age = num(v.age)
      const height = num(v.height)
      const weight = num(v.weight)
      const factor = num(v.activity)
      if (!v.sex || !age || !height || !weight || !factor) return null
      const tdee = mifflinBMR({ sex: v.sex, age, height, weight }) * factor
      return {
        headline: Math.round(tdee).toLocaleString('en-IN'),
        unit: 'kcal/day',
        label: 'Maintenance calories',
        tone: 'blue',
        note: `Lose weight: ~${Math.round(tdee - 500).toLocaleString('en-IN')} · Gain: ~${Math.round(tdee + 500).toLocaleString('en-IN')} kcal/day`,
        plan: 'mealplan',
      }
    },
  },

  'Body Fat Calculator': {
    blurb: 'Estimated body-fat % using the U.S. Navy method.',
    fields: [
      { name: 'sex', label: 'Sex', type: 'select', options: SEX },
      { name: 'height', label: 'Height', unit: 'cm', type: 'number' },
      { name: 'neck', label: 'Neck', unit: 'cm', type: 'number' },
      { name: 'waist', label: 'Waist', unit: 'cm', type: 'number' },
      { name: 'hip', label: 'Hip (women only)', unit: 'cm', type: 'number', optional: true },
    ],
    compute: (v) => {
      const height = num(v.height)
      const neck = num(v.neck)
      const waist = num(v.waist)
      const hip = num(v.hip)
      if (!v.sex || !height || !neck || !waist) return null
      const log10 = Math.log10
      let bf
      if (v.sex === 'female') {
        if (!hip) return null
        bf = 495 / (1.29579 - 0.35004 * log10(waist + hip - neck) + 0.221 * log10(height)) - 450
      } else {
        if (waist - neck <= 0) return null
        bf = 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
      }
      if (!Number.isFinite(bf) || bf <= 0) return null
      const healthy = v.sex === 'female' ? bf <= 31 : bf <= 25
      return {
        headline: bf.toFixed(1),
        unit: '%',
        label: healthy ? 'Within healthy range' : 'Above healthy range',
        tone: healthy ? 'green' : 'amber',
        plan: healthy ? 'maintain' : 'bodyfat',
      }
    },
  },

  'BMR Calculator': {
    blurb: 'Calories your body burns at complete rest (Mifflin-St Jeor).',
    fields: [
      { name: 'sex', label: 'Sex', type: 'select', options: SEX },
      { name: 'age', label: 'Age', unit: 'yrs', type: 'number' },
      { name: 'height', label: 'Height', unit: 'cm', type: 'number' },
      { name: 'weight', label: 'Weight', unit: 'kg', type: 'number' },
      { name: 'goal', label: 'Goal', type: 'select', options: GOALS, optional: true },
    ],
    compute: (v) => {
      const age = num(v.age)
      const height = num(v.height)
      const weight = num(v.weight)
      if (!v.sex || !age || !height || !weight) return null
      const bmr = mifflinBMR({ sex: v.sex, age, height, weight })
      return {
        headline: Math.round(bmr).toLocaleString('en-IN'),
        unit: 'kcal/day',
        label: 'Basal metabolic rate',
        tone: 'blue',
        // BMR on its own earns no food list — it is a number at rest, not a
        // daily requirement. Say that, and only suggest food once the person
        // has told us which way they are trying to go.
        explain: 'nut.note.bmr',
        plan: GOAL_PLANS[v.goal] || null,
      }
    },
  },

  'Ideal Weight Calculator': {
    blurb: 'A healthy weight range for your height, and where you sit in it.',
    fields: [
      { name: 'sex', label: 'Sex', type: 'select', options: SEX },
      { name: 'height', label: 'Height', unit: 'cm', type: 'number' },
      { name: 'weight', label: 'Weight', unit: 'kg', type: 'number' },
    ],
    compute: (v) => {
      const height = num(v.height)
      const weight = num(v.weight)
      if (!v.sex || !height || height < 120 || !weight || weight < 15) return null
      const m = height / 100
      const min = 18.5 * m * m
      const max = 24.9 * m * m
      // Devine ideal weight for reference.
      const inchesOver5ft = Math.max(0, height / 2.54 - 60)
      const devine = (v.sex === 'female' ? 45.5 : 50) + 2.3 * inchesOver5ft
      const below = weight < min
      const within = !below && weight <= max
      return {
        headline: `${min.toFixed(0)}–${max.toFixed(0)}`,
        unit: 'kg',
        label: below ? 'You are below this range' : within ? 'You are within this range' : 'You are above this range',
        tone: within ? 'green' : 'amber',
        note: `Ideal (Devine formula): ~${devine.toFixed(1)} kg`,
        plan: below ? 'gain' : within ? 'maintain' : 'manage',
      }
    },
  },

  'Waist-to-Height Ratio': {
    blurb: 'A quick check for belly fat — keep your waist under half your height.',
    fields: [
      { name: 'height', label: 'Height', unit: 'cm', type: 'number' },
      { name: 'waist', label: 'Waist', unit: 'cm', type: 'number' },
    ],
    compute: (v) => {
      const height = num(v.height)
      const waist = num(v.waist)
      if (!height || !waist || height < 50 || waist < 30) return null
      const ratio = waist / height
      // Consensus cut-offs: half your height is the line that matters, and 0.6
      // is where risk stops being "keep an eye on it" and starts being "act".
      const cat =
        ratio < 0.4 ? { label: 'Below healthy range', tone: 'amber' }
        : ratio < 0.5 ? { label: 'Healthy', tone: 'green' }
        : ratio < 0.6 ? { label: 'Increased risk', tone: 'amber' }
        : { label: 'High risk', tone: 'red' }
      return {
        headline: ratio.toFixed(2),
        unit: '',
        label: cat.label,
        tone: cat.tone,
        note: `Aim to keep your waist under ${(height / 2).toFixed(0)} cm — half your height.`,
        plan: ratio < 0.4 ? 'gain' : ratio < 0.5 ? 'maintain' : 'manage',
      }
    },
  },

  'Weight Goal Calculator': {
    blurb: 'Daily calories and a realistic timeline to reach your goal weight.',
    fields: [
      { name: 'sex', label: 'Sex', type: 'select', options: SEX },
      { name: 'age', label: 'Age', unit: 'yrs', type: 'number' },
      { name: 'height', label: 'Height', unit: 'cm', type: 'number' },
      { name: 'current', label: 'Current weight', unit: 'kg', type: 'number' },
      { name: 'target', label: 'Goal weight', unit: 'kg', type: 'number' },
      { name: 'activity', label: 'Activity level', type: 'select', options: ACTIVITY },
    ],
    compute: (v) => {
      const age = num(v.age)
      const height = num(v.height)
      const current = num(v.current)
      const target = num(v.target)
      const factor = num(v.activity)
      if (!v.sex || !age || !height || !current || !target || !factor) return null
      if (height < 120 || current < 25 || target < 25) return null

      const m = height / 100
      const range = `${(18.5 * m * m).toFixed(0)}–${(24.9 * m * m).toFixed(0)} kg`
      const tdee = mifflinBMR({ sex: v.sex, age, height, weight: current }) * factor
      const diff = current - target

      // Within half a kilo of the goal there is nothing to plan — eat to hold.
      if (Math.abs(diff) < 0.5) {
        return {
          headline: Math.round(tdee).toLocaleString('en-IN'),
          unit: 'kcal/day',
          label: 'Maintain your current weight',
          tone: 'green',
          note: `You are already at your goal. Healthy range for your height: ${range}.`,
          plan: 'maintain',
        }
      }

      // 500 kcal/day is roughly 0.5 kg/week, the rate most guidance calls
      // sustainable. The floor matters more than the rate: a calculator should
      // never put an unsafe intake on screen, so hold there and let the
      // timeline stretch instead of chasing the number down.
      const losing = diff > 0
      const floor = v.sex === 'female' ? 1200 : 1500
      const raw = losing ? tdee - 500 : tdee + 500
      const calories = losing ? Math.max(raw, floor) : raw
      const dailyGap = Math.abs(tdee - calories)
      if (losing && dailyGap < 50) {
        // Maintenance already sits at or under a safe intake, so there is no
        // room left to cut. Say that plainly rather than rendering nothing.
        return {
          headline: Math.round(Math.max(tdee, floor)).toLocaleString('en-IN'),
          unit: 'kcal/day',
          label: 'No safe room to cut calories',
          plan: 'maintain',
          tone: 'amber',
          note: `Maintenance is already about ${Math.round(tdee).toLocaleString('en-IN')} kcal/day, at the ${floor.toLocaleString('en-IN')} kcal/day floor. Add activity rather than eating less, and check with a doctor first.`,
        }
      }
      if (dailyGap < 50) return null

      const KCAL_PER_KG = 7700
      const rate = (dailyGap * 7) / KCAL_PER_KG
      const weeks = Math.max(1, Math.ceil((Math.abs(diff) * KCAL_PER_KG) / (dailyGap * 7)))
      const when = new Date(Date.now() + weeks * 7 * 86400000).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })

      let tone = 'blue'
      let note = `${losing ? 'Lose' : 'Gain'} ${Math.abs(diff).toFixed(1)} kg at ~${rate.toFixed(1)} kg/week — about ${weeks} week${weeks === 1 ? '' : 's'}, around ${when}.`
      const targetBmi = target / (m * m)
      if (targetBmi < 18.5) {
        tone = 'red'
        note += ` Careful: that goal is below the healthy range for your height (${range}).`
      } else if (targetBmi > 24.9) {
        tone = 'amber'
        note += ` That goal is still above the healthy range (${range}).`
      }
      if (losing && raw < floor) {
        note += ` Held at a ${floor.toLocaleString('en-IN')} kcal/day floor — go slower rather than lower.`
      }

      return {
        headline: Math.round(calories).toLocaleString('en-IN'),
        unit: 'kcal/day',
        label: `Daily calories to reach ${target} kg`,
        tone,
        note,
        plan: losing ? 'manage' : 'gainPlus',
        schedule: losing ? 'lose' : 'gain',
      }
    },
  },

  'Pregnancy Calculator': {
    blurb: 'Estimated due date from your last menstrual period (Naegele’s rule).',
    fields: [
      { name: 'lmp', label: 'First day of last period', type: 'date' },
    ],
    compute: (v) => {
      if (!v.lmp) return null
      const lmp = new Date(v.lmp)
      if (Number.isNaN(lmp.getTime())) return null
      const due = new Date(lmp.getTime() + 280 * 86400000)
      const days = Math.floor((Date.now() - lmp.getTime()) / 86400000)
      const weeks = Math.floor(days / 7)
      const dueStr = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      const valid = days >= 0 && weeks <= 45
      return {
        headline: dueStr,
        unit: '',
        label: 'Estimated due date',
        tone: 'blue',
        note: valid ? `You are about ${weeks} week${weeks === 1 ? '' : 's'} along.` : 'Check the date — it looks out of range.',
      }
    },
  },
}
