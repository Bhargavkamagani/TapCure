import { FOODS, MEALS, REDUCE, SCHEDULES, getPlan } from '../../lib/nutritionPlans.js'
import { useI18n } from '../../i18n/index.jsx'

/**
 * The food guidance under a calculator result: what to eat, how much, when,
 * and what to cut back on. `plan` and `schedule` are ids returned by the
 * calculator's compute() — see lib/nutritionPlans.js.
 *
 * Deliberately plain cards rather than a medical-looking report: the point is
 * that someone can act on it today, so quantity/when/frequency sit on one line
 * and the reason is one short sentence under it.
 */
function FoodCard({ item }) {
  const { t } = useI18n()
  const food = FOODS[item.id]
  if (!food) return null
  return (
    <div className="flex gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <span className="text-[17px] leading-none">{food.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-brand-navy">{t(`nut.food.${item.id}.name`)}</p>
        <p className="mt-0.5 text-[11.5px] font-semibold text-brand-green">
          {t(`nut.qty.${item.qty}`)} · {t(`nut.when.${item.when}`)} · {t(`nut.freq.${item.freq}`)}
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-slate-500">{t(`nut.food.${item.id}.why`)}</p>
        {food.alt && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            {t('nut.alt')}: {t(`nut.food.${item.id}.alt`)}
          </p>
        )}
      </div>
    </div>
  )
}

function NutritionTips({ plan: planId, schedule: scheduleId }) {
  const { t } = useI18n()
  const plan = getPlan(planId)
  if (!plan) return null

  const schedule = scheduleId ? SCHEDULES[scheduleId] : null

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-[14px] font-extrabold text-brand-navy">{t('nut.heading')}</h4>
        <p className="shrink-0 text-[11.5px] font-semibold text-brand-green">
          {t('nut.goalLabel')}: {t(`nut.goal.${planId}`)}
        </p>
      </div>

      {/* Grouped by meal (TDEE) or a flat list (everything else). */}
      {plan.sections ? (
        <div className="space-y-3">
          {plan.sections.map((s) => (
            <div key={s.meal}>
              <p className="mb-1.5 text-[12px] font-bold text-slate-600">
                {MEALS[s.meal]} {t(`nut.meal.${s.meal}`)}
              </p>
              <div className="space-y-2">
                {s.items.map((item, i) => <FoodCard key={`${item.id}-${i}`} item={item} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {plan.items.map((item, i) => <FoodCard key={`${item.id}-${i}`} item={item} />)}
        </div>
      )}

      {plan.note && (
        <p className="mt-3 rounded-xl bg-brand-greenLight px-3 py-2 text-[11.5px] leading-snug text-brand-navy">
          {t(`nut.note.${planId}`)}
        </p>
      )}

      {schedule && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-bold text-slate-600">{t('nut.flow')}</p>
          <ul className="overflow-hidden rounded-xl border border-slate-100">
            {schedule.map((row) => (
              <li
                key={row.time}
                className="flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-[12px] last:border-b-0 odd:bg-slate-50/70"
              >
                <span className="w-[68px] shrink-0 font-semibold text-slate-500">{row.time}</span>
                <span className="font-medium text-brand-navy">{t(`nut.flow.${row.key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-1.5 text-[12px] font-bold text-slate-600">{t('nut.reduce')}</p>
        <div className="flex flex-wrap gap-1.5">
          {plan.reduce.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-700"
            >
              <span>{REDUCE[id].emoji}</span>
              {t(`nut.reduce.${id}.name`)}
            </span>
          ))}
        </div>
        {REDUCE[plan.reduce[0]]?.why && (
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
            {t(`nut.reduce.${plan.reduce[0]}.why`)}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-brand-blueLight bg-brand-blueLight/40 px-3 py-2.5">
        <p className="text-[12px] font-bold text-brand-navy">{t('nut.habit')}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-slate-600">{t('nut.habitText')}</p>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-slate-400">{t('nut.safety')}</p>
    </div>
  )
}

export default NutritionTips
