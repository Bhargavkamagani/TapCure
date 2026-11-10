import { useEffect, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarPlus, Stethoscope, AlertTriangle } from 'lucide-react'
import { Card } from '../hospital/ui.jsx'
import { followUpsApi } from '../../api'
import { useI18n } from '../../i18n/index.jsx'

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/**
 * "Upcoming follow-ups" — the patient's pending follow-ups (auto-created when a
 * doctor sets a return date on a prescription), each with a one-tap Book button
 * that deep-links into booking with the same doctor / person / date.
 *
 * Renders nothing when there are none, so it never clutters the dashboard.
 */
export default function FollowUpCard() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    followUpsApi.mine()
      .then((rows) => setItems(rows || []))
      .catch(() => setItems([]))
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || items.length === 0) return null

  const book = (f) => {
    const params = new URLSearchParams({ doctor: String(f.doctor_id) })
    if (f.family_member_id) params.set('for', String(f.family_member_id))
    if (f.due_date >= todayISO()) params.set('date', f.due_date)
    navigate(`/patient-dashboard/appointments/new?${params.toString()}`)
  }

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-blueLight text-brand-blue">
          <CalendarClock className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <h3 className="text-[14px] font-bold text-brand-navy">
            {t('pdash.followUpsTitle')} <span className="text-slate-400">· {items.length}</span>
          </h3>
          <p className="text-[13px] text-slate-400">{t('pdash.followUpsSub')}</p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.map((f) => {
          const overdue = f.due_date < todayISO()
          return (
            <li key={f.follow_up_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[13.5px] font-bold text-brand-navy">
                  {translitName(f.doctor_name, lang) || t('ppage.doctor')}
                  {f.family_member_name && (
                    <span className="ml-1 font-normal text-slate-400">· {t('ppage.forMember', { name: translitName(f.family_member_name, lang) })}</span>
                  )}
                </p>
                {f.doctor_specialty && (
                  <p className="flex items-center gap-1 truncate text-[13px] text-slate-400">
                    <Stethoscope className="h-3 w-3" /> {f.doctor_specialty}
                  </p>
                )}
                <p className={`mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold ${overdue ? 'text-red-500' : 'text-brand-blue'}`}>
                  {overdue && <AlertTriangle className="h-3 w-3" />}
                  {overdue ? t('ppage.overdue') : t('ppage.due')}: {fmtDate(f.due_date)}
                </p>
              </div>
              <button
                onClick={() => book(f)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-blueDark"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> {t('ppage.bookFollowUp')}
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
