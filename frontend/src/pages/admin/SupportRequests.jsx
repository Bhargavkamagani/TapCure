import { useCallback, useEffect, useState } from 'react'
import { LifeBuoy, Mail, Phone, MapPin, RefreshCw, CheckCircle2, Clock, MailWarning } from 'lucide-react'
import { Card, PageHeading, ToolButton, StatCard, StatusBadge } from '../../components/hospital/ui.jsx'
import { supportApi } from '../../api'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import { relativeTime } from '../../lib/format.js'
import { shortId } from '../../lib/shortId.js'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
]

const STATUS_TONE = {
  new: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-brand-blue',
  resolved: 'bg-green-100 text-green-700',
}

/**
 * Super-Admin inbox for enquiries submitted from the public Contact page.
 *
 * The database is the source of truth here, not email: the submit endpoint
 * stores first and only then tries to notify, so an enquiry still shows up
 * even when mail is off or the send fails (`notified: false` flags those).
 */
export default function SupportRequests() {
  const dialog = useDialog()
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setRows(await supportApi.list(filter ? { status: filter, size: 200 } : { size: 200 }))
    } catch (e) {
      setErr(e.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const setStatus = async (row, status) => {
    try {
      const updated = await supportApi.update(row.request_id, { status })
      setRows((list) => list.map((r) => (r.request_id === updated.request_id ? updated : r)))
    } catch (e) {
      dialog.alert({ title: 'Could not update', message: e.message, tone: 'danger' })
    }
  }

  const counts = {
    total: rows.length,
    open: rows.filter((r) => r.status === 'new').length,
    progress: rows.filter((r) => r.status === 'in_progress').length,
    unsent: rows.filter((r) => !r.notified).length,
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Support Requests" subtitle="Enquiries sent from the public Contact page.">
        <ToolButton icon={RefreshCw} onClick={load}>Refresh</ToolButton>
      </PageHeading>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard value={counts.total} label="Showing" icon={LifeBuoy} tone="blue" />
        <StatCard value={counts.open} label="New" icon={Clock} tone="orange" />
        <StatCard value={counts.progress} label="In progress" icon={RefreshCw} tone="teal" />
        <StatCard value={counts.unsent} label="Email not sent" icon={MailWarning} tone="purple" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              filter === f.key
                ? 'border-brand-blue bg-brand-blue text-white'
                : 'border-slate-200 bg-white text-brand-navy hover:border-brand-blue/40'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {err && <Card className="border-red-100 bg-red-50 text-sm text-red-600">{err}</Card>}

      <Card className="p-2">
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-[13.5px] text-slate-400">
            No support requests{filter ? ' with this status' : ' yet'}.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.request_id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold text-brand-navy">{r.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[13px] font-semibold text-slate-500">
                      {r.role}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${STATUS_TONE[r.status] || 'bg-slate-100 text-slate-500'}`}>
                      {r.status === 'in_progress' ? 'In progress' : r.status}
                    </span>
                    {!r.notified && (
                      <span
                        title="Saved here, but the notification email did not go out."
                        className="rounded-full bg-red-50 px-2 py-0.5 text-[13px] font-semibold text-red-500"
                      >
                        email not sent
                      </span>
                    )}
                    <span className="text-[13px] text-slate-400">#{shortId(r.request_id)} · {relativeTime(r.created_at)}</span>
                  </div>

                  <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-600">
                    {r.message}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 hover:text-brand-blue">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />{r.email}
                    </a>
                    {r.mobile && (
                      <a href={`tel:${r.mobile}`} className="flex items-center gap-1.5 hover:text-brand-blue">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />{r.mobile}
                      </a>
                    )}
                    {r.city && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />{r.city}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {r.status !== 'in_progress' && r.status !== 'resolved' && (
                    <button
                      onClick={() => setStatus(r, 'in_progress')}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] font-semibold text-brand-navy hover:border-brand-blue hover:text-brand-blue"
                    >
                      Start
                    </button>
                  )}
                  {r.status !== 'resolved' ? (
                    <button
                      onClick={() => setStatus(r, 'resolved')}
                      className="flex items-center gap-1.5 rounded-xl bg-green-600 px-3.5 py-2 text-[13.5px] font-bold text-white hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Resolve
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(r, 'new')}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-[13.5px] font-semibold text-slate-500 hover:border-slate-300"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
