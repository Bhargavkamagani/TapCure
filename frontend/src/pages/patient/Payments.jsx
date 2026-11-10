import { useEffect, useState } from 'react'
import { IndianRupee, Wallet, Receipt } from 'lucide-react'
import { Card, StatCard, StatusBadge, PageHeading } from '../../components/hospital/ui.jsx'
import { paymentsApi } from '../../api'
import { useI18n } from '../../i18n/index.jsx'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const inr = (n) => Number(n || 0).toLocaleString('en-IN')

/** Payment history — platform/booking fees and consultations. */
function Payments() {
  const { t } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let active = true
    paymentsApi
      .my()
      .then((d) => active && setData(d))
      .catch((e) => active && setErr(e.message || t('px.pay.couldNotLoad')))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const rows = data?.rows || []

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.paymentsTitle')} subtitle={t('ppage.paymentsSubtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard value={<><IndianRupee className="inline h-5 w-5" />{inr(data?.total_spent)}</>} label={t('ppage.totalSpent')} icon={Wallet} tone="blue" />
        <StatCard value={<><IndianRupee className="inline h-5 w-5" />{inr(data?.this_month)}</>} label={t('ppage.thisMonth')} icon={IndianRupee} tone="green" />
        <StatCard value={data?.transactions ?? 0} label={t('ppage.transactions')} icon={Receipt} tone="purple" />
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-[16px] font-bold text-brand-navy">{t('ppage.transactionHistory')}</h3>
        {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[13px] font-semibold text-slate-400">
                <th className="pb-3 pr-3">{t('ppage.colDate')}</th>
                <th className="pb-3 pr-3">{t('ppage.colDescription')}</th>
                <th className="pb-3 pr-3">{t('ppage.colToken')}</th>
                <th className="pb-3 pr-3">{t('ppage.colMethod')}</th>
                <th className="pb-3 pr-3">{t('ppage.colAmount')}</th>
                <th className="pb-3">{t('ppage.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="text-[13.5px]">
              {!loading && rows.map((p, i) => (
                <tr key={i} className="border-t border-slate-50">
                  <td className="py-2.5 pr-3 tabular-nums text-slate-500">{fmtDate(p.date)}</td>
                  <td className="py-2.5 pr-3 text-slate-700">{p.description}</td>
                  <td className="py-2.5 pr-3 font-bold text-brand-navy">{p.appointment_id ? `#${p.appointment_id}` : '—'}</td>
                  <td className="py-2.5 pr-3 text-slate-500">{p.method}</td>
                  <td className="py-2.5 pr-3 font-bold text-brand-navy">₹{inr(p.amount)}</td>
                  <td className="py-2.5"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="py-8 text-center text-[13px] text-slate-400">{t('pm.loading')}</p>}
          {!loading && rows.length === 0 && !err && (
            <p className="py-8 text-center text-[13px] text-slate-400">{t('pm.noPayments')}</p>
          )}
        </div>
      </Card>
    </div>
  )
}

export default Payments
