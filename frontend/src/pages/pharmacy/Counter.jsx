import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, RefreshCw, Plus, ClipboardList, ShoppingBag } from 'lucide-react'
import { PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { PrescriptionsPanel } from './Prescriptions.jsx'
import { WalkinSalesPanel } from './WalkinSales.jsx'

const RANGES = [[1, 'Today'], [7, '7 days'], [30, '30 days']]
const TABS = [
  { key: 'prescriptions', label: 'Prescriptions', icon: ClipboardList },
  { key: 'walkin', label: 'Walk-in sales', icon: ShoppingBag },
]

/**
 * The pharmacy counter: prescriptions from this hospital's doctors and walk-in
 * sales to outside customers on one page. Search and date range are shared;
 * the tab lives in the URL (?tab=walkin) so a refresh keeps it. Both panels
 * stay mounted so switching back keeps each list's filters and page, but only
 * the visible one polls.
 */
export default function PharmacyCounter() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'walkin' ? 'walkin' : 'prescriptions'
  const setTab = (key) => setParams(key === 'walkin' ? { tab: 'walkin' } : {}, { replace: true })

  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [days, setDays] = useState(1)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeading
        title="Pharmacy Counter"
        subtitle="Prescriptions from this hospital's doctors and walk-in sales to outside customers. Stock updates with every hand-over."
      >
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'walkin' ? 'Customer name, mobile, doctor…' : 'Patient name, mobile or UHID…'}
            className="w-56 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-white p-1 text-[12.5px] font-semibold">
          {RANGES.map(([n, label]) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={`rounded-lg px-3 py-1 ${days === n ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ToolButton icon={RefreshCw} onClick={() => setRefreshKey((k) => k + 1)}>Refresh</ToolButton>
        <ToolButton icon={Plus} tone="primary" onClick={() => { setTab('walkin'); setShowNew(true) }}>New walk-in sale</ToolButton>
      </PageHeading>

      <div className="flex gap-1 border-b border-slate-200" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-[13px] font-semibold transition-colors ${
              tab === key ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      <div className={`${tab === 'prescriptions' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col gap-3`}>
        <PrescriptionsPanel query={query} days={days} active={tab === 'prescriptions'} refreshKey={refreshKey} />
      </div>
      <div className={`${tab === 'walkin' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col gap-3`}>
        <WalkinSalesPanel
          query={query}
          days={days}
          active={tab === 'walkin'}
          refreshKey={refreshKey}
          showNew={showNew}
          setShowNew={setShowNew}
        />
      </div>
    </div>
  )
}
