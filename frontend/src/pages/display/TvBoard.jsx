import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Maximize2, WifiOff, Clock3 } from 'lucide-react'
import { displayApi, fileUrl } from '../../api'

const REFRESH_MS = 3000
const PER_PAGE = 8          // tiles on one screen; more doctors rotate in pages
const PAGE_MS = 10000

const clock = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
const today = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })
// "OP-003" -> "3": the plain number, as the patient's own live queue shows it.
const num = (code) => { const m = String(code ?? '').match(/\d+/); return m ? String(parseInt(m[0], 10)) : code }
const drName = (n) => (!n ? '' : /^dr\b/i.test(n.trim()) ? n : `Dr. ${n}`)

/** Round photo, or initials when there is none (or it fails to load). */
function DoctorPhoto({ name, url }) {
  const [failed, setFailed] = useState(false)
  const initials = (name || '?').replace(/^dr\.?\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const size = 'h-[clamp(48px,4.2vw,80px)] w-[clamp(48px,4.2vw,80px)]'
  if (url && !failed) {
    return <img src={fileUrl(url)} alt={name} onError={() => setFailed(true)} className={`${size} shrink-0 rounded-full object-cover ring-2 ring-teal-300/40`} />
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-teal-500/25 text-[clamp(16px,1.5vw,28px)] font-extrabold text-teal-100 ring-2 ring-teal-300/30`}>
      {initials}
    </span>
  )
}

/**
 * The token track, like the patient's live queue: NOW in a teal circle, then
 * the real next tokens (emergencies jump ahead, missed ones drop out — so these
 * are who is actually coming, not a simple count) joined by a line.
 */
function TokenTrack({ now, next }) {
  const nodes = [...(now ? [{ code: now, kind: 'now' }] : []), ...next.map((c) => ({ code: c, kind: 'next' }))]
  if (!nodes.length) return <p className="text-[clamp(14px,1.25vw,22px)] text-white/40">No one waiting</p>
  const circle = 'flex shrink-0 items-center justify-center rounded-full font-black tabular-nums'
  const firstNext = nodes.findIndex((n) => n.kind === 'next')
  return (
    <div className="flex w-full items-start">
      {nodes.map((n, i) => (
        <Fragment key={`${n.kind}-${n.code}`}>
          {i > 0 && (
            <span className={`mt-[calc(clamp(30px,2.8vw,52px)/2)] h-[3px] min-w-[8px] max-w-[clamp(28px,4vw,90px)] flex-1 rounded-full ${i === 1 && nodes[0].kind === 'now' ? 'bg-teal-300/70' : 'bg-white/15'}`} />
          )}
          <div className="flex flex-col items-center gap-1">
            {n.kind === 'now' ? (
              <span className={`${circle} h-[clamp(30px,2.8vw,52px)] w-[clamp(30px,2.8vw,52px)] bg-teal-400 text-[clamp(13px,1.2vw,22px)] text-slate-950 shadow-[0_0_18px_rgba(45,212,191,0.55)]`}>{num(n.code)}</span>
            ) : (
              <span className={`${circle} h-[clamp(30px,2.8vw,52px)] w-[clamp(30px,2.8vw,52px)] border-2 border-white/25 bg-white/5 text-[clamp(12px,1.1vw,20px)] text-white`}>{num(n.code)}</span>
            )}
            <span className={`text-[clamp(9px,0.75vw,13px)] font-bold uppercase tracking-wider ${n.kind === 'now' ? 'text-teal-300' : i === firstNext ? 'text-white/50' : 'text-transparent'}`}>
              {n.kind === 'now' ? 'Now' : i === firstNext ? 'Next' : '·'}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  )
}

function DoctorTile({ d, flash }) {
  return (
    <div className={`flex min-h-0 flex-col rounded-3xl border bg-white/[0.06] p-5 transition-colors duration-700 ${
      flash ? 'border-amber-300 bg-amber-300/15' : 'border-white/10'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <DoctorPhoto name={d.name} url={d.photo_url} />
          <div className="min-w-0">
            <p className="truncate text-[clamp(18px,1.9vw,30px)] font-extrabold text-white">{drName(d.name)}</p>
            <p className="truncate text-[clamp(13px,1.1vw,18px)] text-teal-200/80">{d.specialization}</p>
            {d.duty?.state === 'on_break' && (
              <span className="mt-1 inline-block rounded-full bg-sky-400/20 px-2.5 py-0.5 text-[clamp(11px,0.9vw,15px)] font-bold text-sky-200">On break</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <span className="pb-1 text-[clamp(12px,1vw,16px)] font-bold uppercase tracking-widest text-teal-300">Now</span>
        <span className={`font-black leading-none tracking-tight ${d.now_serving ? 'text-white' : 'text-white/30'} text-[clamp(52px,6.5vw,120px)]`}>
          {d.now_serving ? num(d.now_serving) : '—'}
        </span>
      </div>

      <div className="mt-4">
        <TokenTrack now={d.now_serving} next={d.next || []} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-[clamp(12px,1vw,17px)] text-white/60">
        <span>Waiting <b className="text-white">{d.waiting}</b></span>
        <span>Done <b className="text-white">{d.completed}</b></span>
        {d.delay_min > 0 && (
          <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 font-bold text-amber-200">Running {d.delay_min} min late</span>
        )}
      </div>
    </div>
  )
}

/**
 * The waiting-room TV: every doctor at the hospital today — now serving, next,
 * waiting — refreshed every few seconds. Opened from the secret link the
 * hospital admin copies from OP Queue; no login. Token codes only, never names.
 */
export default function TvBoard() {
  const { key } = useParams()
  const [params] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)      // link refused (wrong / replaced)
  const [offline, setOffline] = useState(false) // network blip — keep the last board
  const [now, setNow] = useState(new Date())
  const [page, setPage] = useState(0)
  const [flash, setFlash] = useState({})        // doctor_id -> true for a few seconds after a new call
  const lastServing = useRef({})

  const load = useCallback(async () => {
    try {
      const b = await displayApi.board(key, params.get('doctors'))
      // Light up a tile when its "now serving" changes, so heads turn to it.
      const changed = {}
      for (const d of b.doctors || []) {
        const prev = lastServing.current[d.doctor_id]
        if (d.now_serving && prev !== undefined && prev !== d.now_serving) changed[d.doctor_id] = true
        lastServing.current[d.doctor_id] = d.now_serving
      }
      if (Object.keys(changed).length) {
        setFlash((f) => ({ ...f, ...changed }))
        setTimeout(() => setFlash((f) => {
          const next = { ...f }
          Object.keys(changed).forEach((k) => delete next[k])
          return next
        }), 6000)
      }
      setData(b)
      setError(null)
      setOffline(false)
    } catch (e) {
      if (e?.status === 404) setError(e.message || 'This display link is not valid.')
      else setOffline(true)
    }
  }, [key, params])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  const doctors = data?.doctors || []
  const pages = Math.max(1, Math.ceil(doctors.length / PER_PAGE))
  useEffect(() => {
    if (pages <= 1) { setPage(0); return undefined }
    const t = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS)
    return () => clearInterval(t)
  }, [pages])
  const shown = doctors.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)
  const cols = shown.length <= 1 ? 1 : shown.length <= 4 ? 2 : shown.length <= 6 ? 3 : 4

  const goFull = () => { document.documentElement.requestFullscreen?.().catch(() => {}) }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 p-8 text-center text-white">
        <div>
          <p className="text-3xl font-extrabold">Display link not valid</p>
          <p className="mt-3 text-lg text-white/60">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900 p-[clamp(12px,1.6vw,32px)] text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-4 pb-[clamp(10px,1.2vw,24px)]">
        <div className="min-w-0">
          <p className="truncate text-[clamp(22px,2.6vw,46px)] font-black tracking-tight">{data?.hospital_name || 'Loading…'}</p>
          <p className="text-[clamp(13px,1.1vw,20px)] text-teal-200/80">OP Queue · {today(now)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {offline && (
            <span className="flex items-center gap-2 rounded-full bg-red-500/20 px-4 py-2 text-[clamp(12px,1vw,18px)] font-bold text-red-200">
              <WifiOff className="h-5 w-5" /> Reconnecting…
            </span>
          )}
          <span className="flex items-center gap-2 text-[clamp(22px,2.4vw,44px)] font-extrabold tabular-nums">
            <Clock3 className="h-[0.8em] w-[0.8em] text-teal-300" /> {clock(now)}
          </span>
          <button type="button" onClick={goFull} title="Full screen" className="rounded-xl bg-white/10 p-2 text-white/70 hover:bg-white/20">
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Doctors */}
      {data && doctors.length === 0 ? (
        <div className="grid flex-1 place-items-center text-center">
          <p className="text-[clamp(20px,2.2vw,40px)] font-bold text-white/60">No doctors consulting right now</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-[clamp(10px,1.2vw,24px)]"
             style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}>
          {shown.map((d) => <DoctorTile key={d.doctor_id} d={d} flash={!!flash[d.doctor_id]} />)}
        </div>
      )}

      {/* Away today + paging */}
      <footer className="flex shrink-0 items-center justify-between gap-4 pt-[clamp(10px,1.2vw,24px)] text-[clamp(12px,1vw,18px)] text-white/55">
        <div className="min-w-0 truncate">
          {data?.off_today?.length > 0 && (
            <>
              <span className="mr-2 font-bold text-white/70">Away today:</span>
              {data.off_today.map((o) => `${drName(o.name)} (${o.label})`).join('  ·  ')}
            </>
          )}
        </div>
        {pages > 1 && <span className="shrink-0 font-semibold">Page {page + 1} of {pages}</span>}
      </footer>
    </div>
  )
}
