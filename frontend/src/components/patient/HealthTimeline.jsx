import { useEffect, useMemo, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import {
  CalendarClock, Pill, Activity, FileText, CalendarPlus, Stethoscope, Droplet, ExternalLink, Trash2,
} from 'lucide-react'
import { VITAL_CHIPS } from './VitalsPanel.jsx'
import { patientsApi, prescriptionsApi, followUpsApi, fileUrl } from '../../api'
import { useI18n } from '../../i18n/index.jsx'
import { useDialog } from '../common/DialogProvider.jsx'

/**
 * One unified, chronological health story for a person (the account holder or a
 * dependent) — visits, prescriptions, vitals and reports woven into a single
 * timeline, with any pending follow-ups highlighted on top.
 *
 * Dependents aren't Patient rows, so everything is pulled for the account holder
 * and filtered by `family_member_id` (null = self). Uploaded documents have no
 * family_member_id, so they only appear on the self timeline.
 */

const STATUS_PILL = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  'no-show': 'bg-slate-200 text-slate-600',
  waiting: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-teal-100 text-teal-700',
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const ts = (d) => (d ? new Date(d).getTime() : 0)

// Per-event-type visual identity for the rail dot + icon chip.
const TYPE = {
  visit: { icon: CalendarClock, dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-600' },
  rx: { icon: Pill, dot: 'bg-teal-500', chip: 'bg-teal-100 text-teal-600' },
  vital: { icon: Activity, dot: 'bg-purple-500', chip: 'bg-purple-100 text-purple-600' },
  report: { icon: FileText, dot: 'bg-amber-500', chip: 'bg-amber-100 text-amber-600' },
}

// Filter chips: key 'all' shows everything, else matches an event type.
const FILTERS = [
  { key: 'all', tKey: 'ppage.fltAll' },
  { key: 'visit', tKey: 'ppage.fltVisits' },
  { key: 'rx', tKey: 'ppage.fltRx' },
  { key: 'vital', tKey: 'ppage.fltVitals' },
  { key: 'report', tKey: 'ppage.fltReports' },
]

function VitalSummary({ v }) {
  const { t } = useI18n()
  const chips = VITAL_CHIPS.map((c) => ({ label: c.labelKey ? t(c.labelKey) : c.label, value: c.val(v) })).filter((c) => c.value != null)
  if (!chips.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c.label} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] font-medium text-slate-600">
          {c.label} <span className="font-bold text-brand-navy">{c.value}</span>
        </span>
      ))}
    </div>
  )
}

export default function HealthTimeline({ member, patientId }) {
  const dialog = useDialog()
  const { t, lang } = useI18n()
  const tx = (prefix, v) => { const k = prefix + v; const s = t(k); return s === k ? v : s }
  const [data, setData] = useState(null) // { appts, rxs, vitals, docs, followups } | null
  const [filter, setFilter] = useState('all')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (!member) return
    let active = true
    const isSelf = !member.member_id
    const mine = (row) =>
      isSelf ? !row.family_member_id : String(row.family_member_id) === String(member.member_id)

    Promise.all([
      patientsApi.appointments(patientId).catch(() => []),
      prescriptionsApi.list().catch(() => []),
      patientsApi.vitals(patientId).catch(() => []),
      isSelf ? patientsApi.documents(patientId).catch(() => []) : Promise.resolve([]),
      followUpsApi.mine().catch(() => []),
    ]).then(([appts, rxs, vitals, docs, followups]) => {
      if (!active) return
      setData({
        appts: (appts || []).filter(mine),
        rxs: (rxs || []).filter(mine),
        vitals: (vitals || []).filter(mine),
        docs: docs || [],
        followups: (followups || []).filter(mine),
      })
    })
    return () => { active = false }
  }, [member, patientId])

  // Delete an uploaded report. The row is removed from local state rather than
  // refetching the whole timeline, so the list doesn't flicker.
  const removeDoc = async (doc) => {
    if (!doc?.document_id) return
    const ok = await dialog.confirm({
      title: t('px.tl.deleteTitle'),
      message: t('px.tl.deleteMsg', { name: doc.file_name || t('px.tl.thisReport') }),
      confirmLabel: t('ppage.delete'),
    })
    if (!ok) return
    setDeletingId(doc.document_id)
    try {
      await patientsApi.deleteDocument(doc.document_id)
      setData((prev) =>
        prev ? { ...prev, docs: prev.docs.filter((d) => d.document_id !== doc.document_id) } : prev
      )
    } catch (e) {
      dialog.alert({ title: t('px.tl.couldNotDelete'), message: e.message || t('px.tl.couldNotDeleteReport'), tone: 'danger' })
    } finally {
      setDeletingId(null)
    }
  }

  const events = useMemo(() => {
    if (!data) return []
    const rows = [
      ...data.appts.map((a) => ({ type: 'visit', date: a.appointment_date, data: a })),
      ...data.rxs.map((r) => ({ type: 'rx', date: r.created_at, data: r })),
      ...data.vitals.map((v) => ({ type: 'vital', date: v.recorded_at, data: v })),
      ...data.docs.map((d) => ({ type: 'report', date: d.created_at || d.uploaded_at, data: d })),
    ]
    return rows.sort((a, b) => ts(b.date) - ts(a.date))
  }, [data])

  if (!data) {
    return <p className="py-6 text-center text-[13px] text-slate-400">{t('pcommon.loading')}</p>
  }

  const upcoming = data.followups

  if (!events.length && !upcoming.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center">
        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
          <Activity className="h-5 w-5" />
        </span>
        <p className="text-[13px] font-semibold text-slate-500">{t('ppage.noHistory')}</p>
      </div>
    )
  }

  // Per-type counts (for the chip badges) + the currently visible slice.
  const counts = events.reduce((acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }), {})
  const visible = filter === 'all' ? events : events.filter((e) => e.type === filter)

  return (
    <div>
      {/* Filter chips */}
      {events.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.filter((f) => f.key === 'all' || counts[f.key]).map((f) => {
            const active = filter === f.key
            const n = f.key === 'all' ? events.length : counts[f.key]
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${
                  active ? 'bg-brand-blue text-white' : 'border border-slate-200 text-slate-500 hover:border-brand-blue/40 hover:text-brand-blue'
                }`}
              >
                {t(f.tKey)} <span className={active ? 'text-white/70' : 'text-slate-400'}>· {n}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Upcoming follow-ups — highlighted above the history (only in "All") */}
      {filter === 'all' && upcoming.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-teal-600">{t('ppage.upcoming')}</p>
          {upcoming.map((f) => (
            <div key={f.follow_up_id} className="flex items-center gap-2.5 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-600">
                <CalendarPlus className="h-4 w-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-bold text-brand-navy">{t('ppage.evtFollowUp')}</p>
                <p className="truncate text-[13px] text-slate-500">
                  {translitName(f.doctor_name, lang) || t('ppage.doctor')} · {fmtDate(f.due_date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chronological history rail */}
      {visible.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-[13.5px] text-slate-400">{t('ppage.noneOfType')}</p>
      ) : (
      <div className="relative pl-6">
        <span className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" aria-hidden="true" />
        {visible.map((ev, i) => {
          const meta = TYPE[ev.type]
          const Icon = meta.icon
          const d = ev.data
          const abnormal = ev.type === 'vital' && d.abnormal
          return (
            <div key={`${ev.type}-${i}`} className="relative mb-3">
              <span className={`absolute -left-[1.15rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${abnormal ? 'bg-red-500' : meta.dot}`} aria-hidden="true" />
              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${abnormal ? 'bg-red-100 text-red-500' : meta.chip}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    {/* VISIT */}
                    {ev.type === 'visit' && (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[13.5px] font-bold text-brand-navy">{translitName(d.doctor_name, lang) || t('ppage.evtVisit')}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[13px] font-semibold capitalize ${STATUS_PILL[d.status] || 'bg-slate-100 text-slate-500'}`}>{tx('px.status.', d.status)}</span>
                        </div>
                        {d.doctor_specialty && (
                          <p className="flex items-center gap-1 truncate text-[13px] text-slate-400">
                            <Stethoscope className="h-3 w-3" /> {d.doctor_specialty}
                          </p>
                        )}
                        <p className="mt-0.5 text-[13px] text-slate-500">{fmtDate(d.appointment_date)}</p>
                      </>
                    )}

                    {/* PRESCRIPTION */}
                    {ev.type === 'rx' && (
                      <>
                        <p className="truncate text-[13.5px] font-bold text-brand-navy">{t('ppage.evtRx')}</p>
                        <p className="truncate text-[13px] text-slate-400">
                          {translitName(d.doctor_name, lang) || '—'}{d.diagnosis ? ` · ${d.diagnosis}` : ''}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-[13px] text-slate-500">
                          {fmtDate(d.created_at)}
                          {d.items?.length > 0 && (
                            <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[13px] font-semibold text-teal-600">
                              {t('ppage.medsCount', { n: d.items.length })}
                            </span>
                          )}
                        </p>
                      </>
                    )}

                    {/* VITALS */}
                    {ev.type === 'vital' && (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="text-[13.5px] font-bold text-brand-navy">{t('ppage.evtVital')}</p>
                          {abnormal && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[13px] font-bold text-red-600">!</span>}
                        </div>
                        <p className="text-[13px] text-slate-500">{fmtDate(d.recorded_at)}</p>
                        <VitalSummary v={d} />
                      </>
                    )}

                    {/* REPORT / DOCUMENT */}
                    {ev.type === 'report' && (
                      <>
                        <p className="truncate text-[13.5px] font-bold text-brand-navy">{d.file_name || t('ppage.evtReport')}</p>
                        <p className="truncate text-[13px] capitalize text-slate-400">{d.document_type ? tx('px.docType.', d.document_type).replace('_', ' ') : t('px.document')}</p>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="text-[13px] text-slate-500">{fmtDate(d.created_at || d.uploaded_at)}</span>
                          <span className="flex items-center gap-2.5">
                            {d.file_url && (
                              <a href={fileUrl(d.file_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-blue hover:underline">
                                <ExternalLink className="h-3 w-3" />{t('pm.view')}</a>
                            )}
                            <button
                              type="button"
                              onClick={() => removeDoc(d)}
                              disabled={deletingId === d.document_id}
                              title={t('ppage.deleteReport')}
                              className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-400 transition-colors hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              {deletingId === d.document_id ? '…' : t('ppage.delete')}
                            </button>
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
