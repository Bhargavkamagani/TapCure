import { useEffect, useState } from 'react'
import { BadgeCheck, CalendarClock, UserRound } from 'lucide-react'
import { Card } from '../hospital/ui.jsx'
import { revisitPassesApi } from '../../api'
import { useI18n } from '../../i18n/index.jsx'
import { translitName } from '../../lib/translit.js'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/**
 * "Free revisit available" — the no-charge return visit a patient earns after a
 * paid consultation, valid with the SAME doctor for the window the hospital set.
 *
 * There is no Book button on purpose: the whole point is that no appointment is
 * needed. The patient walks in and the front desk redeems the pass, so a button
 * here would send them down a booking flow the feature exists to avoid.
 *
 * Every pass names the person it belongs to. One account can hold several — a
 * visit booked for a dependant earns the pass for THAT dependant, not for the
 * account holder — and an unlabelled "Free revisit available" would send the
 * wrong family member to the hospital expecting a free consultation.
 *
 * Renders nothing when there are no live passes, so it never clutters the
 * dashboard for the majority who hold none.
 */
export default function RevisitPassCard() {
  const { t, lang } = useI18n()
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    revisitPassesApi.mine()
      .then((rows) => setItems(rows || []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || items.length === 0) return null

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <BadgeCheck className="h-4 w-4 text-emerald-600" />
        <h3 className="text-[14px] font-bold text-brand-navy">{t('rvp.title')}</h3>
      </div>
      {/* A lone pass takes the full width — in a fixed two-column grid it would
          sit in the left half with dead space beside it. Two or more split the
          row instead of stacking, which pushed the dashboard down. Always one
          column on a phone, where two across would be unreadable. */}
      <div className={`grid gap-2.5 ${items.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {items.map((p) => (
          <div key={p.pass_id}
               className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
            {p.for_name ? (
              <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5
                            text-[13px] font-bold text-emerald-800">
                <UserRound className="h-3 w-3" />
                {t('rvp.for', { name: translitName(p.for_name, lang) })}
              </p>
            ) : null}
            <p className="text-[13.5px] font-semibold text-emerald-900">
              {t('rvp.line', {
                doctor: translitName(p.doctor_name, lang),
                date: fmtDate(p.valid_until),
              })}
            </p>
            <p className="mt-0.5 text-[13px] text-emerald-800">{t('rvp.walkIn')}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5
                               text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <CalendarClock className="h-3.5 w-3.5" />
                {p.days_left > 0 ? t('rvp.daysLeft', { n: p.days_left }) : t('rvp.lastDay')}
              </span>
              {p.hospital_name ? (
                <span className="text-[13px] text-emerald-700">
                  {translitName(p.hospital_name, lang)}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
