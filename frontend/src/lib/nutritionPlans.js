/**
 * Food-first guidance shown under a health-calculator result.
 *
 * A calculator's `compute()` returns a `plan` id (and optionally a `schedule`
 * id); everything a person reads lives here, keyed for i18n — see
 * `i18n/dict/nutrition.js` for the en/te/hi strings.
 *
 * Foods are defined ONCE and referenced by id. Dal, curd, fruit and nuts turn
 * up in almost every plan, so repeating their name/why/alternative per plan
 * would mean the same sentence translated many times over, and three languages
 * drifting apart the first time one copy is edited.
 *
 * Quantity / when / frequency are also ids rather than free text, for the same
 * reason: "1 bowl" and "Daily" appear dozens of times between them.
 *
 * This is general guidance for a signed-out landing page, never a prescription
 * — every plan renders with the safety line in `nut.safety`.
 */

// id -> emoji, and whether the food offers an "instead" suggestion.
export const FOODS = {
  banana: { emoji: '🍌', alt: true },
  milk: { emoji: '🥛', alt: true },
  peanuts: { emoji: '🥜', alt: true },
  dal: { emoji: '🥣', alt: true },
  egg: { emoji: '🥚', alt: true },
  curd: { emoji: '🥛', alt: true },
  rice: { emoji: '🍚', alt: true },
  vegetables: { emoji: '🥗', alt: true },
  fruit: { emoji: '🍎', alt: true },
  nuts: { emoji: '🥜', alt: true },
  cucumber: { emoji: '🥒', alt: true },
  greens: { emoji: '🥦', alt: true },
  wholeFruit: { emoji: '🍎', alt: true },
  chana: { emoji: '🫘', alt: true },
  oats: { emoji: '🥣', alt: true },
  fish: { emoji: '🐟', alt: true },
  protein: { emoji: '🍳', alt: true },
  sweetPotato: { emoji: '🍠', alt: true },
}

// Things to cut back on. Only the first carries a "why" — the rest are obvious
// enough that a reason per line would just be noise.
export const REDUCE = {
  softDrinks: { emoji: '🥤', why: true },
  sweets: { emoji: '🍬' },
  fried: { emoji: '🍟' },
  fastFood: { emoji: '🍔' },
  processed: { emoji: '🍪' },
  bigPortions: { emoji: '🍽️' },
  alcohol: { emoji: '🍺' },
}

export const MEALS = {
  breakfast: '🌅',
  midMorning: '☀️',
  lunch: '🍛',
  evening: '🌇',
  dinner: '🌙',
}

const f = (id, qty, when, freq) => ({ id, qty, when, freq })

export const PLANS = {
  // Under the healthy range — add energy from food worth eating.
  gain: {
    items: [
      f('banana', 'oneMedium', 'breakfastEvening', 'daily'),
      f('milk', 'ml200_250', 'breakfastEvening', 'dailyIfTolerated'),
      f('peanuts', 'g25_30', 'eveningSnack', 'dailyOrOften'),
      f('dal', 'oneBowl', 'lunchDinner', 'daily'),
      f('egg', 'oneOrTwo', 'breakfastLunch', 'dailyIfSuitable'),
      f('curd', 'oneBowl', 'lunch', 'dailyIfTolerated'),
      f('rice', 'individual', 'lunchDinner', 'asAppropriate'),
    ],
    reduce: ['softDrinks', 'sweets', 'fried', 'fastFood', 'processed'],
    note: true,
  },

  // Within the healthy range — keep it there.
  maintain: {
    items: [
      f('vegetables', 'twoServings', 'lunchDinner', 'daily'),
      f('fruit', 'oneServing', 'morningEvening', 'onceTwiceDaily'),
      f('dal', 'oneBowl', 'lunchDinner', 'daily'),
      f('curd', 'oneBowl', 'lunch', 'dailyIfTolerated'),
      f('nuts', 'handful', 'snack', 'mostDays'),
      f('rice', 'individual', 'meals', 'asAppropriate'),
    ],
    reduce: ['softDrinks', 'fried', 'sweets', 'bigPortions'],
  },

  // Above the healthy range, or a waist that says central fat — volume and
  // protein first, so the cut does not feel like going hungry.
  manage: {
    items: [
      f('cucumber', 'g100_150', 'lunchEvening', 'daily'),
      f('dal', 'oneBowl', 'lunchDinner', 'daily'),
      f('greens', 'twoServings', 'lunchDinner', 'daily'),
      f('wholeFruit', 'oneServing', 'morningEvening', 'onceTwiceDaily'),
      f('curd', 'oneBowl', 'lunch', 'dailyIfTolerated'),
      f('chana', 'g25_30', 'evening4to6', 'severalWeek'),
    ],
    reduce: ['softDrinks', 'sweets', 'fried', 'fastFood', 'bigPortions'],
  },

  // Higher body fat — protein-forward, and it says so about training.
  bodyfat: {
    items: [
      f('egg', 'oneOrTwo', 'breakfastLunch', 'individualNeeds'),
      f('dal', 'oneBowl', 'lunchDinner', 'daily'),
      f('greens', 'twoServings', 'lunchDinner', 'daily'),
      f('wholeFruit', 'oneServing', 'snack', 'onceTwiceDaily'),
      f('nuts', 'g20_30', 'snack', 'mostDays'),
      f('fish', 'individual', 'lunchDinner', 'individualNeeds'),
    ],
    reduce: ['softDrinks', 'sweets', 'fried', 'processed', 'alcohol'],
    note: true,
  },

  // The TDEE answer is a number for a whole day, so this plan is the day.
  mealplan: {
    sections: [
      { meal: 'breakfast', items: [f('oats', 'oneServing', 'breakfast', 'daily'), f('milk', 'ml200', 'breakfast', 'dailyIfTolerated')] },
      { meal: 'midMorning', items: [f('fruit', 'oneServing', 'midMorning', 'daily')] },
      { meal: 'lunch', items: [f('dal', 'oneBowl', 'lunch', 'daily'), f('vegetables', 'twoServings', 'lunch', 'daily'), f('rice', 'byCalories', 'lunch', 'daily')] },
      { meal: 'evening', items: [f('chana', 'g25_30', 'evening4to6', 'severalWeek')] },
      { meal: 'dinner', items: [f('greens', 'twoServings', 'dinner', 'daily'), f('protein', 'individual', 'dinner', 'daily')] },
    ],
    reduce: ['softDrinks', 'sweets', 'fried', 'bigPortions'],
  },
}

// Weight Goal adds clock times on top of a plan: the same food, laid out as a
// day someone can actually follow.
export const SCHEDULES = {
  lose: [
    { time: '7:30 AM', key: 'breakfast' },
    { time: '10:30 AM', key: 'fruit' },
    { time: '1:30 PM', key: 'lunch' },
    { time: '5:00 PM', key: 'snack' },
    { time: '8:00 PM', key: 'dinner' },
  ],
  gain: [
    { time: '7:30 AM', key: 'bigBreakfast' },
    { time: '10:30 AM', key: 'fruitNuts' },
    { time: '1:30 PM', key: 'bigLunch' },
    { time: '5:00 PM', key: 'milkSnack' },
    { time: '8:00 PM', key: 'bigDinner' },
  ],
}

// The gain plan gets one extra food when it is reached through Weight Goal,
// where the person has told us they are deliberately adding weight.
PLANS.gainPlus = {
  ...PLANS.gain,
  items: [...PLANS.gain.items, f('sweetPotato', 'oneServing', 'lunchDinner', 'severalWeek')],
}

export const getPlan = (id) => PLANS[id] || null
