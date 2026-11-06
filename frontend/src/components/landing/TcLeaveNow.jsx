import { useState, useEffect, useMemo, useRef } from 'react'
import { useI18n } from '../../i18n/index.jsx'
import TypeLoop from './TypeLoop.jsx'

/**
 * The Leave-Now engine — "The Line".
 *
 * A faithful port of the reference's `assets/leave.css` + the `lnl-*` markup in
 * its index.html. The whole section is ONE vertical line: a hairline spine down
 * the left with a mint fill that grows as you scroll, station dots that light
 * as they pass, and four numbered stops — the number, Depart, Drive, Arrive,
 * Seen — hung off it.
 *
 * (An earlier pass built this from the `ln-*` classes in sections.css. Those are
 * leftovers: the reference's page uses them once and the `lnl-*` set 44 times.
 * This is the design the page actually renders.)
 *
 * Demo mode, as the reference ships it: a modelled Indian-metro congestion curve
 * and a stylised SVG route. No Google key, no network. The real engine already
 * exists in the patient console and is not touched here.
 */

/* The engine works in DRIVING time plus one 30-minute arrival cushion
   (ARRIVAL_BUFFER_MIN in token_engine.py). These four are a demo control so the
   number visibly moves as you try things — the labels below no longer claim the
   app books differently per mode, because it does not. */
const MODES = [
  { id: 'car', label: 'tc.ln.mode.car', park: 0, checkin: 0, safety: 30 },
  { id: 'cab', label: 'tc.ln.mode.cab', park: 0, checkin: 0, safety: 30 },
  { id: 'metro', label: 'tc.ln.mode.metro', park: 0, checkin: 0, safety: 34 },
  { id: 'bike', label: 'tc.ln.mode.bike', park: 0, checkin: 0, safety: 28 },
]

/** Two commute humps, a quiet midday, a dead night. Multiplies free-flow time. */
const TRAFFIC = [
  0.70, 0.66, 0.64, 0.64, 0.68, 0.80, 1.00, 1.34, 1.62, 1.48, 1.22, 1.14,
  1.16, 1.18, 1.20, 1.30, 1.52, 1.74, 1.80, 1.58, 1.26, 1.02, 0.86, 0.76,
]
const FREE_FLOW = 18
const KM = 14.2

const pad = (n) => String(n).padStart(2, '0')
const clock = (d) => {
  const h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}`
}
const ampmOf = (d) => (d.getHours() >= 12 ? 'PM' : 'AM')

function TcLeaveNow() {
  const { t } = useI18n()
  // The Depart station is gone — the app does not ask for a travel mode or an
  // address on this page, and offering four modes implied it did. What is left
  // is an illustration of one journey, so these are constants.
  const mode = 'car'
  const appt = '17:00'
  const [now, setNow] = useState(() => new Date())
  const [fill, setFill] = useState(0)
  const [lit, setLit] = useState(0)
  const lineRef = useRef(null)
  const dotRefs = useRef([])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  /* The spine fills to wherever the viewport's middle has reached, and a dot
     lights once the line has passed it. One scroll handler for the section. */
  useEffect(() => {
    const onScroll = () => {
      const el = lineRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const mid = window.innerHeight * 0.55
      const done = Math.max(0, Math.min(r.height, mid - r.top))
      setFill(done)
      setLit(dotRefs.current.filter((d) => d && d.offsetTop <= done).length)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const plan = useMemo(() => {
    const cfg = MODES.find((m) => m.id === mode)
    const [hh, mm] = appt.split(':').map(Number)
    const slot = new Date(now)
    slot.setHours(hh, mm, 0, 0)
    // A slot already gone today is tomorrow's, or the countdown reads negative.
    const rolled = slot.getTime() < now.getTime() - 3600000
    if (rolled) slot.setDate(slot.getDate() + 1)

    const drive = Math.round(FREE_FLOW * TRAFFIC[slot.getHours()])
    const total = drive + cfg.park + cfg.checkin + cfg.safety
    const leaveBy = new Date(slot.getTime() - total * 60000)
    const left = leaveBy.getTime() - now.getTime()
    const mins = Math.floor(left / 60000)

    const tone = left <= 0 ? 'is-bad' : mins < 20 ? 'is-bad' : mins < 60 ? 'is-warn' : ''
    const abs = Math.abs(left)
    const cd = `${pad(Math.floor(abs / 3600000))}:${pad(Math.floor(abs / 60000) % 60)}:${pad(Math.floor(abs / 1000) % 60)}`

    return {
      cfg, slot, drive, total, leaveBy, left, tone, cd, rolled,
      jam: drive > FREE_FLOW * 1.35,
      steps: [
        // Three real steps. The old list had separate "Parked" and "Checked in"
        // rows with their own learned minutes — the engine has neither, so they
        // showed 0 min and claimed papers were pre-filled.
        ['tc.ln.step.leaveHome', clock(leaveBy), 'tc.ln.step.leaveHomeSub', ''],
        ['tc.ln.step.onRoad', clock(new Date(leaveBy.getTime() + drive * 60000)), drive > FREE_FLOW * 1.35 ? 'tc.ln.step.heavy' : 'tc.ln.step.clear', t('lx.min', { n: drive })],
        ['tc.ln.step.atHospital', clock(new Date(leaveBy.getTime() + drive * 60000)), 'tc.ln.step.waiting', `${cfg.safety} ${t('tc.ln.step.cushion')}`],
        ['tc.ln.step.called', clock(slot), 'tc.ln.step.calledSub', ''],
      ],
    }
  }, [mode, appt, now, t])

  const dot = (i) => (el) => { dotRefs.current[i] = el }

  return (
    <section className="leavenow" id="leave">
      <div className="wrap">
        <div className="sec-head rv">
          <span className="eyebrow"><TypeLoop text={t('tc.ln.eyebrow')} /></span>
          <h2>{t('tc.ln.h2a')}<br /><span className="serif grad">{t('tc.ln.h2b')}</span></h2>
          <p className="lede">
            {t('tc.ln.ledeA')} <b style={{ color: 'var(--ink)' }}>{t('tc.ln.leaveWord')}</b>{t('tc.ln.ledeB')}
          </p>
        </div>

        <div className="lnl" ref={lineRef}>
          <span className="lnl-spine" aria-hidden="true"><i style={{ height: `${fill}px` }} /></span>

          {/* ── the number ── */}
          <div className={`lnl-st lnl-open ${plan.tone}`}>
            <span ref={dot(0)} className={`lnl-dot ${lit > 0 ? 'lit' : ''}`} aria-hidden="true" />
            <p className="lnl-now">
              {t('lx.ln.nowSlot', { now: clock(now), nowAp: ampmOf(now), slot: clock(plan.slot), slotAp: ampmOf(plan.slot) })}
            </p>
            <p className="lnl-pre">{t('tc.ln.leaveHomeAt')}</p>
            <div className="lnl-big">{clock(plan.leaveBy)}<small>{ampmOf(plan.leaveBy)}</small></div>
            <p className="lnl-cd">
              {plan.left <= 0
                ? <>{t('tc.ln.shouldHaveLeft')} <b>{plan.cd}</b> {t('tc.ln.ago')}</>
                : <>{t('tc.ln.thatIs')} <b>{plan.cd}</b> {t('tc.ln.fromNow')}</>}
            </p>
            <p className="lnl-meta">{plan.total} {t('tc.ln.doorToChair')} · {KM} km</p>
            {plan.rolled && <p className="lnl-day">{t('tc.ln.rolled')}</p>}
            <div className="ln-panel">
              <h3>{t('lx.demo.Dr. Anaya Rao')} <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 15 }}>· {t('tc.spec.cardiology')}</span></h3>
            </div>
          </div>

          {/* ── 01 drive ── */}
          <div className="lnl-st">
            <span ref={dot(1)} className={`lnl-dot ${lit > 1 ? 'lit' : ''}`} aria-hidden="true" />
            <span className="lnl-conn" aria-hidden="true" />
            <span className="lnl-tag"><b>01</b> &nbsp;/&nbsp; {t('tc.ln.drive')}</span>
            <h3 className="lnl-h">{t('tc.ln.driveH')}</h3>
            <p className="lnl-p">{t('tc.ln.driveP')}</p>

            <div className="lnl-map">
              <DemoMap jam={plan.jam} />
              <p className="lnl-maptag">
                <span><b>{t('lx.min', { n: plan.drive })}</b> {t('tc.ln.onRoad')} · {KM} km</span>
                {plan.jam && <span className="jam">{t('tc.ln.jam')}</span>}
              </p>
            </div>
          </div>

          {/* ── 02 arrive ── */}
          <div className="lnl-st">
            <span ref={dot(2)} className={`lnl-dot ${lit > 2 ? 'lit' : ''}`} aria-hidden="true" />
            <span className="lnl-tag"><b>02</b> &nbsp;/&nbsp; {t('tc.ln.arrive')}</span>
            <h3 className="lnl-h">{t('tc.ln.arriveH')}</h3>
            <p className="lnl-p">{t('tc.ln.arriveP')}</p>

            <div className="timeline">
              {plan.steps.map(([label, time, sub, dur], i) => (
                <div className={`tl-item ${i === 0 ? 'hot' : ''}`} key={label}>
                  <span className="tl-time">{time}</span>
                  <span className="tl-rail"><i className="tl-dot" /></span>
                  <span className="tl-label">{t(label)}<span>{t(sub)}</span></span>
                  <span className="tl-dur">{dur}</span>
                </div>
              ))}
            </div>

            <p className="ln-note">
              {t('tc.ln.noteA')} <b>{t('lx.min', { n: plan.cfg.safety })}</b> {t('tc.ln.noteB')}
            </p>
          </div>

          {/* ── 03 seen ── */}
          <div className="lnl-st lnl-last">
            <span ref={dot(3)} className={`lnl-dot ${lit > 3 ? 'lit' : ''}`} aria-hidden="true" />
            <span className="lnl-tag"><b>03</b> &nbsp;/&nbsp; {t('tc.ln.seen')}</span>
            <h3 className="lnl-h">{t('tc.ln.seenH')}</h3>
            <p className="lnl-p">{t('tc.ln.seenP')}</p>
          </div>
        </div>

        <div className="ln-feats">
          {[
            /* Each of these is something the app actually does. The old set promised
               per-hour parking data, a navigation hand-off and automatic re-slotting —
               none of which exist. */
            ['tc.ln.feat1.t', 'tc.ln.feat1.d'],
            ['tc.ln.feat2.t', 'tc.ln.feat2.d'],
            ['tc.ln.feat3.t', 'tc.ln.feat3.d'],
            ['tc.ln.feat4.t', 'tc.ln.feat4.d'],
          ].map(([tk, dk], i) => (
            <div className={`feat rv d${i + 1}`} key={tk}>
              <span className="ic">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 12h4l3-8 4 16 3-8h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <b>{t(tk)}</b>
              <p>{t(dk)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * The map.
 *
 * This is a rendered street map, not a drawing. Earlier passes built it as SVG
 * — blocks, roads, POI labels — and it never read as a real place; a map is
 * exactly the kind of thing that looks wrong when it is approximated. The image
 * carries the streets, the buildings, the named places and the route; the only
 * things drawn on top are the live readouts, which have to change.
 */
function DemoMap({ jam }) {
  const { t } = useI18n()
  // Traced over the route baked into the image, in its own pixel space.
  // Measured off the image itself, not eyeballed: sampling the route pixels puts
  // the teal at x=222, the red leg at y=214 (not 207 — that miss is why the red
  // stretch never animated), the navy riser at x=798 and its run at y=71.
  const ROUTE = 'M222 406 L222 214 L798 214 L798 71 L1272 71'
  return (
    <div className="map-demo">
      <img src="/leave-route-map.webp" alt="" className="map-img" />
      {/* A short bright segment running the route — the image's own dashes are
          static, so without this nothing on the map moves. */}
      <svg className="map-run" viewBox="0 0 1419 475" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path className="run-comet" d={ROUTE} />

        {/* The image only carries a pin at the hospital end — the route just runs
            off the bottom at the other. A matching card marks where you start. */}
        <g className="map-pin" transform="translate(196,342)">
          <rect className="pin-card" x="0" y="0" width="52" height="52" rx="14" />
          <path className="pin-home" d="M14 27 L26 16 L38 27 M17 25 V38 H35 V25 M23 38 V31 H29 V38" />
          <rect className="pin-tail" x="22" y="50" width="8" height="12" rx="3" />
          {/* the image's teal leg runs a little past this point; the disc caps it
              so the route ends AT the house instead of sliding underneath it */}
          <circle className="pin-cap" cx="26" cy="64" r="11" />
          <text className="pin-name" x="62" y="24">{t('tc.ln.map.home')}</text>
          <text className="pin-sub" x="62" y="41">{t('lx.demo.Kondapur')}</text>
        </g>
      </svg>
    </div>
  )
}

export default TcLeaveNow
