import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, RefreshCw, Activity, HeartPulse, Eye, AlertTriangle, Clock,
  Users, ClipboardPlus, TrendingUp,
} from 'lucide-react'
import { Card, PageHeading, ToolButton, Avatar } from '../../components/hospital/ui.jsx'
import AnimatedNumber from '../../components/common/AnimatedNumber.jsx'
import { VitalsModal, VITAL_CHIPS, VitalChip, VitalsSparkline } from '../../components/patient/VitalsPanel.jsx'
import PatientHistoryDrawer from '../../components/patient/PatientHistoryDrawer.jsx'
import { patientsApi } from '../../api'
import { seenName, bookedBy } from '../../lib/patientDisplay.js'
import useAutoRefresh from '../../hooks/useAutoRefresh.js'

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const isToday = (iso) => {
  if (!iso) return false
  const d = new Date(iso), n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } } }

export default function AssistantVitals() {
  const [recent, setRecent] = useState(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [recordFor, setRecordFor] = useState(null)
  const [viewPatient, setViewPatient] = useState(null)
  // A failed request used to render as an empty list — indistinguishable from
  // "nobody has been measured yet". At a front desk that's the difference
  // between a quiet morning and a broken screen.
  const [error, setError] = useState(null)
  const [searchError, setSearchError] = useState(null)
  // 'patient' = one card per patient (latest reading) · 'all' = every reading
  const [view, setView] = useState('patient')

  // The KPIs below are derived from whatever this call returns, so the window
  // has to be wide enough to hold a real day. At the old limit of 50, a hospital
  // that measured 60 patients would see "Recorded Today: 50" and never know the
  // number had stopped counting. 200 is the endpoint's maximum.
  const FEED_LIMIT = 200

  const loadRecent = useCallback(({ silent = false } = {}) => {
    // Blanking to null shows the skeleton; a background refresh must leave the
    // feed on screen and swap it only once the new data lands.
    if (!silent) setRecent(null)
    setError(null)
    patientsApi.recentVitals({ limit: FEED_LIMIT })
      .then(setRecent)
      .catch((e) => { if (!silent) setRecent([]); setError(e.message || 'Could not load recent vitals.') })
  }, [])
  useEffect(() => { loadRecent() }, [loadRecent])

  // Vitals are recorded from the queue screen and from other machines at the
  // desk; today's feed and its KPIs should reflect that without a reload.
  useAutoRefresh(() => loadRecent({ silent: true }))

  useEffect(() => {
    const term = q.trim()
    if (!term) { setResults([]); setSearchError(null); return }
    setSearching(true)
    setSearchError(null)
    const id = setTimeout(() => {
      patientsApi.search(term)
        .then((r) => setResults(r || []))
        .catch((e) => { setResults([]); setSearchError(e.message || 'Search failed.') })
        .finally(() => setSearching(false))
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const stats = useMemo(() => {
    const list = recent || []
    return {
      today: list.filter((v) => isToday(v.recorded_at)).length,
      attention: list.filter((v) => v.abnormal).length,
      patients: new Set(list.map((v) => v.patient_id)).size,
    }
  }, [recent])

  // Hitting the cap means older readings exist that neither the list nor the
  // counters above include. Never let a truncated view read as a complete one.
  const truncated = (recent?.length ?? 0) >= FEED_LIMIT

  // Collapse the feed to one card per patient (their latest reading), so a
  // patient with several readings isn't listed multiple times. `earlier` counts
  // their other readings — opening "View" shows the full history.
  const latestPerPatient = useMemo(() => {
    if (!recent) return null
    const seen = new Map()
    for (const v of recent) {
      let cur = seen.get(v.patient_id)
      if (!cur) { cur = { ...v, earlier: 0, _sys: [] }; seen.set(v.patient_id, cur) }
      else cur.earlier += 1
      if (v.bp_systolic != null) cur._sys.push(v.bp_systolic)   // recent is newest-first
    }
    return [...seen.values()].map((c) => ({ ...c, series: c._sys.slice().reverse() }))
  }, [recent])

  // Every reading as its own card — a chronological log. A re-check five minutes
  // after the first is a separate event here, which is what you want when
  // reviewing what actually happened at the desk this morning.
  const allReadings = useMemo(() => {
    if (!recent) return null
    const runningSeries = new Map()
    return recent.map((v) => {
      // Sparkline shows this patient's history UP TO this reading, so each card
      // reflects what was known at that moment rather than the final trend.
      const prior = runningSeries.get(v.patient_id) || []
      if (v.bp_systolic != null) runningSeries.set(v.patient_id, [v.bp_systolic, ...prior])
      return { ...v, earlier: 0, series: [v.bp_systolic, ...prior].filter((x) => x != null).slice().reverse() }
    })
  }, [recent])

  const cards = view === 'all' ? allReadings : latestPerPatient

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title="Vitals & Measurements" subtitle="Capture a patient's vitals at check-in and review what's been recorded.">
        <ToolButton icon={RefreshCw} onClick={loadRecent}>Refresh</ToolButton>
      </PageHeading>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-semibold">{error}</span>
          <span className="text-[12.5px] text-red-500">The list below is empty because of this error, not because nothing was recorded.</span>
          <button type="button" onClick={loadRecent}
            className="ml-auto rounded-lg border border-red-200 bg-white px-3 py-1 text-[12.5px] font-semibold text-red-600 hover:bg-red-50">
            Retry
          </button>
        </div>
      )}

      {/* Stat strip */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <motion.div variants={item} whileHover={{ y: -3 }}>
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-brand-blue"><ClipboardPlus className="h-5 w-5" /></span>
            <div>
              <p className="text-[24px] font-extrabold leading-none text-brand-blue"><AnimatedNumber value={stats.today} /></p>
              <p className="mt-1 text-[12px] font-medium text-slate-500">Recorded Today</p>
            </div>
          </div>
        </motion.div>
        <motion.div variants={item} whileHover={{ y: -3 }}>
          <div className={`flex items-center gap-3 rounded-2xl border p-4 ${stats.attention ? 'border-red-100 bg-gradient-to-br from-red-50 to-white' : 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white'}`}>
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${stats.attention ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-600'}`}><AlertTriangle className="h-5 w-5" /></span>
            <div>
              <p className={`text-[24px] font-extrabold leading-none ${stats.attention ? 'text-red-500' : 'text-emerald-600'}`}><AnimatedNumber value={stats.attention} /></p>
              <p className="mt-1 text-[12px] font-medium text-slate-500">Need Attention</p>
            </div>
          </div>
        </motion.div>
        <motion.div variants={item} whileHover={{ y: -3 }}>
          <div className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600"><Users className="h-5 w-5" /></span>
            <div>
              <p className="text-[24px] font-extrabold leading-none text-purple-600"><AnimatedNumber value={stats.patients} /></p>
              <p className="mt-1 text-[12px] font-medium text-slate-500">Patients</p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Find a patient → record vitals */}
      <Card className="overflow-hidden !p-0">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-white px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-500"><HeartPulse className="h-5 w-5" /></span>
          <div>
            <h3 className="text-[15px] font-bold text-brand-navy">Record Vitals</h3>
            <p className="text-[12px] text-slate-400">Search a patient to capture a new reading.</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-100 bg-slate-50/60 px-3 transition-colors focus-within:border-brand-blue focus-within:bg-white">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find patient by name, mobile or UHID…"
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400"
            />
            {searching && <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />}
          </div>
          <AnimatePresence>
            {q.trim() && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-2 overflow-hidden rounded-xl border border-slate-100"
              >
                {searching ? (
                  <p className="px-4 py-3 text-[13px] text-slate-400">Searching…</p>
                ) : searchError ? (
                  // Never say "no patients found" when the search itself failed —
                  // the desk would conclude the patient isn't registered.
                  <p className="px-4 py-3 text-[13px] font-semibold text-red-600">{searchError}</p>
                ) : results.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-slate-400">No patients found.</p>
                ) : (
                  <ul className="max-h-64 divide-y divide-slate-50 overflow-y-auto">
                    {results.map((p) => (
                      <li key={p.patient_id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/70">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={p.name} className="h-9 w-9 text-[11px]" />
                          <div className="min-w-0 leading-tight">
                            <p className="truncate text-[13.5px] font-bold text-brand-navy">{p.name}</p>
                            <p className="text-[11.5px] text-slate-400">{[p.uhid, p.phone].filter(Boolean).join(' · ')}</p>
                          </div>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setRecordFor(p)}
                          className="shrink-0 rounded-lg bg-brand-blue px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-blueDark"
                        >
                          <Activity className="mr-1 inline h-3.5 w-3.5" /> Record
                        </motion.button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Recently recorded */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold text-brand-navy">
            Recently Recorded {cards ? <span className="font-semibold text-slate-400">· {cards.length}</span> : null}
          </h3>
          {truncated && (
            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-700">
              Showing the latest {FEED_LIMIT} readings — older ones aren't listed, and the counters
              above cover this window only.
            </span>
          )}
          {/* One row per person, or one row per reading — a re-check is a
              separate event, and sometimes that's exactly what you're reviewing. */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {[
              ['patient', 'By patient', latestPerPatient?.length],
              ['all', 'All readings', allReadings?.length],
            ].map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                  view === key ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
                {count != null && (
                  <span className={view === key ? 'ml-1 text-brand-blue' : 'ml-1 text-slate-400'}>{count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {cards === null ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300"><HeartPulse className="h-7 w-7" /></span>
            <p className="text-sm font-semibold text-slate-500">No vitals recorded yet</p>
            <p className="text-[12.5px] text-slate-400">Search a patient above to capture their first reading.</p>
          </Card>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {cards.map((v) => {
              const chips = VITAL_CHIPS.map((c) => ({ c, value: c.val(v) })).filter((x) => x.value != null && x.value !== '')
              return (
                <motion.div
                  key={v.vital_id}
                  variants={item}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => setViewPatient({ patient_id: v.patient_id, name: seenName(v), uhid: v.patient_uhid })}
                  className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white p-4 pl-5 shadow-card transition-all hover:shadow-xl ${v.abnormal ? 'border-red-200 hover:border-red-300' : 'border-slate-100 hover:border-brand-blue/30'}`}
                >
                  {/* coloured status strip */}
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${v.abnormal ? 'bg-gradient-to-b from-red-400 to-red-500' : 'bg-gradient-to-b from-emerald-300 to-emerald-500'}`} />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative">
                        <Avatar name={seenName(v)} className="h-11 w-11 text-[13px] ring-2 ring-white" />
                        {v.abnormal && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 ring-2 ring-white">
                            <AlertTriangle className="h-2.5 w-2.5 text-white" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 leading-tight">
                        <p className="flex items-center gap-2 truncate text-[14.5px] font-bold text-brand-navy">
                          {seenName(v)}
                          {bookedBy(v) && (
                            <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-600">by {bookedBy(v)}</span>
                          )}
                          {v.earlier > 0 && (
                            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">+{v.earlier} earlier</span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" /> {fmtTime(v.recorded_at)}{v.recorded_by_name ? ` · ${v.recorded_by_name}` : ''}
                        </p>
                      </div>
                    </div>
                    {/* status pill */}
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${v.abnormal ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${v.abnormal ? 'bg-red-500' : 'bg-emerald-500'}`} />
                      {v.abnormal ? 'Needs attention' : 'Stable'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map(({ c, value }) => (
                        <VitalChip key={c.key} icon={c.icon} label={c.label} value={value}
                          status={c.flag ? v.flags?.[c.flag] : null} />
                      ))}
                    </div>
                    {v.series.length >= 2 && (
                      <div className="shrink-0 text-right">
                        <p className="mb-0.5 flex items-center justify-end gap-1 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
                          <TrendingUp className="h-3 w-3" /> BP trend
                        </p>
                        <VitalsSparkline data={v.series} color={v.abnormal ? '#ef4444' : '#2563eb'} />
                      </div>
                    )}
                  </div>

                  {v.notes && <p className="mt-2.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px] text-slate-500">{v.notes}</p>}

                  {/* quick actions — slide in on hover */}
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 opacity-100 transition-all md:max-h-0 md:overflow-hidden md:border-0 md:pt-0 md:opacity-0 md:group-hover:max-h-20 md:group-hover:border-t md:group-hover:pt-3 md:group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); setRecordFor({ patient_id: v.patient_id, name: seenName(v), uhid: v.patient_uhid }) }}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-blue py-1.5 text-[12px] font-semibold text-white hover:bg-brand-blueDark"
                    >
                      <Activity className="h-3.5 w-3.5" /> Re-record
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewPatient({ patient_id: v.patient_id, name: seenName(v), uhid: v.patient_uhid }) }}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-[12px] font-semibold text-brand-blue hover:bg-brand-blueLight/40"
                    >
                      <Eye className="h-3.5 w-3.5" /> History
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {recordFor && (
          <VitalsModal
            patient={recordFor}
            onClose={() => setRecordFor(null)}
            onSaved={() => { setRecordFor(null); loadRecent() }}
          />
        )}
        {viewPatient && <PatientHistoryDrawer patient={viewPatient} onClose={() => setViewPatient(null)} />}
      </AnimatePresence>
    </div>
  )
}
