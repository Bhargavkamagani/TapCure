import { useState, useEffect, useMemo, useRef } from 'react'
import { Car, ListOrdered, BellRing, HeartHandshake } from 'lucide-react'
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
const clockAp = (d) => `${clock(d)} ${ampmOf(d)}`
// Countdown in words people use: "45 min", "1 hr 12 min".
const inWords = (ms, t) => {
  const m = Math.max(1, Math.round(Math.abs(ms) / 60000))
  return m < 60 ? t('lx.min', { n: m }) : t('tc.ln.hrMin', { h: Math.floor(m / 60), m: m % 60 })
}

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
  const [stepsOn, setStepsOn] = useState(0)
  const lineRef = useRef(null)
  const tlRef = useRef(null)
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
      // DisplayScale zooms the page, so screen sizes (getBoundingClientRect)
      // and CSS sizes (the fill's height, dot offsetTop) differ by the zoom.
      // Work in CSS pixels, or the road stops filling at about two-thirds.
      const zoom = el.offsetHeight ? r.height / el.offsetHeight : 1
      const done = Math.max(0, Math.min(el.offsetHeight, (mid - r.top) / zoom))
      setFill(done)
      setLit(dotRefs.current.filter((d) => d && d.offsetTop <= done).length)
      // The leave-time steps light up one by one as they reach the middle of
      // the screen: Leave home, Travel, Wait, Your turn.
      const rows = tlRef.current?.querySelectorAll('.tl-item') || []
      setStepsOn([...rows].filter((row) => row.getBoundingClientRect().top < window.innerHeight * 0.62).length)
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
      // Each row: label, start, end (travel and wait are spans, so the times
      // add up: leave + travel = arrive, arrive + wait = your turn), sub-line,
      // minutes chip, chip tone.
      steps: [
        ['tc.ln.step.leaveHome', clockAp(leaveBy), '', 'tc.ln.step.leaveHomeSub', '', ''],
        ['tc.ln.step.onRoad', clockAp(leaveBy), clockAp(new Date(leaveBy.getTime() + drive * 60000)), drive > FREE_FLOW * 1.35 ? 'tc.ln.step.heavy' : 'tc.ln.step.clear', t('lx.min', { n: drive }), drive > FREE_FLOW * 1.35 ? 'warn' : ''],
        ['tc.ln.step.atHospital', clockAp(new Date(leaveBy.getTime() + drive * 60000)), clockAp(slot), 'tc.ln.step.waiting', t('lx.min', { n: cfg.safety }), ''],
        ['tc.ln.step.called', clockAp(slot), '', 'tc.ln.step.calledSub', '', ''],
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
            {/* Clock on the left, the appointment it is counting to on the right
                (the right half used to be empty). */}
            <div className="lnl-openGrid">
              <div>
                <p className="lnl-now">
                  {t('lx.ln.nowSlot', { now: clock(now), nowAp: ampmOf(now), slot: clock(plan.slot), slotAp: ampmOf(plan.slot) })}
                </p>
                <p className="lnl-pre">{t('tc.ln.leaveHomeAt')}</p>
                <div className="lnl-big">{clock(plan.leaveBy)}<small>{ampmOf(plan.leaveBy)}</small></div>
                <p className="lnl-cd">
                  {plan.left <= 0
                    ? <>{t('tc.ln.shouldHaveLeft')} <b>{inWords(plan.left, t)}</b> {t('tc.ln.ago')}</>
                    : <>{t('tc.ln.thatIs')} <b>{inWords(plan.left, t)}</b></>}
                </p>
                {/* how the time is made: travel + wait, never one unexplained total */}
                <p className="lnl-chips">
                  <span className={`ln-chip ${plan.jam ? 'warn' : ''}`}>{t('tc.ln.travelChip', { n: plan.drive })}</span>
                  <span className="ln-chip">{t('tc.ln.waitChip', { n: plan.cfg.safety })}</span>
                  <span className="ln-chip plain">{KM} km</span>
                </p>
                {plan.rolled && <p className="lnl-day">{t('tc.ln.rolled')}</p>}
              </div>
              <div className="glass ln-appt">
                <span className="kicker">{t('tc.ln.yourAppt')}</span>
                <div className="ln-appt-row">
                  <span className="doc-ava">AR</span>
                  <span>
                    <b>{t('lx.demo.Dr. Anaya Rao')}</b>
                    <span className="who">{t('tc.spec.cardiology')} · {t('lx.demo.Sunrise Hospital, Jubilee Hills')}</span>
                  </span>
                </div>
                <dl className="ln-appt-facts">
                  <div><dt>{t('tc.ln.token')}</dt><dd>A-14</dd></div>
                  <div><dt>{t('tc.ln.yourTurn')}</dt><dd>{clockAp(plan.slot)}</dd></div>
                  <div><dt>{t('tc.ln.before')}</dt><dd>{t('tc.ln.people', { n: 6 })}</dd></div>
                </dl>
              </div>
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
          {/* The steps are the journey, so they stay on the left along the road.
              The right side holds a card that sums them up, like the appointment
              card at the clock stop. */}
          <div className="lnl-st">
            <span ref={dot(2)} className={`lnl-dot ${lit > 2 ? 'lit' : ''}`} aria-hidden="true" />
            <div className="ln-two">
              <div>
                <span className="lnl-tag"><b>02</b> &nbsp;/&nbsp; {t('tc.ln.arrive')}</span>
                <h3 className="lnl-h">{t('tc.ln.arriveH')}</h3>
                <p className="lnl-p">{t('tc.ln.arriveP')}</p>

                <div className="timeline" ref={tlRef}>
                  {plan.steps.map(([label, start, end, sub, mins, tone], i) => (
                    <div className={`tl-item ${i === 0 ? 'hot' : ''} ${i === plan.steps.length - 1 ? 'turn' : ''} ${i < stepsOn ? 'on' : ''}`} key={label}>
                      <span className="tl-time">{start}{end && <small>{t('tc.ln.to', { time: end })}</small>}</span>
                      <span className="tl-rail"><i className="tl-dot" /></span>
                      <span className="tl-label">
                        <span className="tl-title">{t(label)}{mins && <i className={`ln-chip ${tone}`}>{mins}</i>}</span>
                        <span>{t(sub)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass ln-card">
                <span className="kicker">{t('tc.ln.sumK')}</span>
                <p className="ln-card-big">{t('lx.min', { n: plan.drive + plan.cfg.safety })}</p>
                <div className="ln-bar" aria-hidden="true">
                  <i className={plan.jam ? 'warn' : ''} style={{ flex: plan.drive }} />
                  <i style={{ flex: plan.cfg.safety }} />
                </div>
                <dl className="ln-card-rows">
                  <div><dt><i className={`sw ${plan.jam ? 'warn' : ''}`} />{t('tc.ln.step.onRoad')}</dt><dd>{t('lx.min', { n: plan.drive })}</dd></div>
                  <div><dt><i className="sw" />{t('tc.ln.step.atHospital')}</dt><dd>{t('lx.min', { n: plan.cfg.safety })}</dd></div>
                </dl>
                <p className="ln-note">
                  {t('tc.ln.noteA')} <b>{t('lx.min', { n: plan.cfg.safety })}</b> {t('tc.ln.noteB')}
                </p>
              </div>
            </div>
          </div>

          {/* ── 03 seen ── */}
          <div className="lnl-st lnl-last">
            <span ref={dot(3)} className={`lnl-dot ${lit > 3 ? 'lit' : ''}`} aria-hidden="true" />
            <div className="ln-two">
              <div>
                <span className="lnl-tag"><b>03</b> &nbsp;/&nbsp; {t('tc.ln.seen')}</span>
                <h3 className="lnl-h">{t('tc.ln.seenH')}</h3>
                <p className="lnl-p">{t('tc.ln.seenP')}</p>
              </div>
              <div className="glass ln-card">
                <span className="kicker">{t('tc.ln.cmpK')}</span>
                <div className="ln-cmp">
                  <p><span>{t('tc.ln.cmpWithout')}</span><b>{t('tc.ln.cmpHours', { n: 3 })}</b></p>
                  <div className="ln-bar" aria-hidden="true"><i className="old" style={{ flex: 1 }} /></div>
                  <p><span>{t('tc.ln.cmpWith')}</span><b className="good">{t('lx.min', { n: plan.cfg.safety })}</b></p>
                  <div className="ln-bar" aria-hidden="true"><i style={{ flex: 1 }} /><i className="empty" style={{ flex: 5 }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ln-feats">
          {[
            /* Each of these is something the app actually does. The old set promised
               per-hour parking data, a navigation hand-off and automatic re-slotting —
               none of which exist. */
            // Each card has its own icon, so the four can be told apart at a glance.
            [Car, 'tc.ln.feat1.t', 'tc.ln.feat1.d'],
            [ListOrdered, 'tc.ln.feat2.t', 'tc.ln.feat2.d'],
            [BellRing, 'tc.ln.feat3.t', 'tc.ln.feat3.d'],
            [HeartHandshake, 'tc.ln.feat4.t', 'tc.ln.feat4.d'],
          ].map(([Icon, tk, dk], i) => (
            <div className={`feat rv d${i + 1}`} key={tk}>
              <span className="ic"><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
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
