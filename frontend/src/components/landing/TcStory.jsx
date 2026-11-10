import { useEffect, useRef, useState } from 'react'
import { BRAND } from '../../data/landingData.js'
import { useI18n } from '../../i18n/index.jsx'

/**
 * The OP-day story, shared by the Features page (all steps) and the homepage
 * (a short pick of them). One phone (patients) or desk screen (hospitals) stays
 * in place while the day plays out beside it; a time ruler fills as you scroll.
 * Names, times and numbers on the screens are examples and the page says so.
 * Text colours read the homepage's theme tokens when they are there (so dark
 * mode works) and fall back to the light colours on the Features page.
 */

// `screen` is the device screen each step shows, so a page can pick a few steps.
export const PATIENT_STEPS = [
  { time: '8:00 AM', h: 'sfeat.s.p1.h', b: 'sfeat.s.p1.b', feats: ['sfeat.p.search.title', 'sfeat.p.booking.title'] },
  { time: '9:02 AM', h: 'sfeat.s.p2.h', b: 'sfeat.s.p2.b', feats: ['sfeat.p.token.title', 'sfeat.p.queue.title'] },
  { time: '10:48 AM', h: 'sfeat.s.p3.h', b: 'sfeat.s.p3.b', feats: ['sfeat.p.reminders.title', 'sfeat.c.delay.title'] },
  { time: '11:20 AM', h: 'sfeat.s.p4.h', b: 'sfeat.s.p4.b', feats: ['sfeat.p.travel.title'] },
  { time: '12:05 PM', h: 'sfeat.s.p5.h', b: 'sfeat.s.p5.b', feats: [] },
].map((s, screen) => ({ ...s, screen }))

export const HOSPITAL_STEPS = [
  { time: '9:00 AM', h: 'sfeat.s.h1.h', b: 'sfeat.s.h1.b', feats: ['sfeat.c.queue.title', 'sfeat.c.dash.title'] },
  { time: '10:15 AM', h: 'sfeat.s.h2.h', b: 'sfeat.s.h2.b', feats: ['sfeat.c.walkin.title'] },
  { time: '11:05 AM', h: 'sfeat.s.h3.h', b: 'sfeat.s.h3.b', feats: ['sfeat.c.delay.title', 'sfeat.c.comm.title'] },
  { time: '2:30 PM', h: 'sfeat.s.h4.h', b: 'sfeat.s.h4.b', feats: ['sfeat.c.reports.title'] },
].map((s, screen) => ({ ...s, screen }))

/* ── the example screens ───────────────────────────────────────────────── */

/** One screen of the device: fades in when its step is the one being read. */
function Layer({ on, className = '', children }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col transition-all duration-500 motion-reduce:transition-none ${
        on ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}

const muted = 'text-[13.5px] text-[#6B7A8F]'
const row = 'flex items-center justify-between border-t border-[#0B2150]/10 py-3 text-[15px]'

function Live({ label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0A9A96]">
      <i className="h-2 w-2 animate-pulse rounded-full bg-current motion-reduce:animate-none" /> {label}
    </span>
  )
}

function PhoneScreens({ active, clock }) {
  const { t } = useI18n()
  return (
    <div className="h-[600px] w-[300px] rounded-[46px] bg-[#0B2150] p-3 shadow-[0_50px_90px_-40px_rgba(11,33,80,.65)]">
      <div className="relative h-full overflow-hidden rounded-[36px] bg-white text-[#0B2150]">
        <span className="absolute left-1/2 top-0 z-[3] h-6 w-24 -translate-x-1/2 rounded-b-[15px] bg-[#0B2150]" />
        <div className="absolute inset-x-6 top-2 z-[2] flex justify-between text-[12px] font-semibold tabular-nums">
          <span>{clock}</span><span>4G ▮▮▮</span>
        </div>

        <Layer on={active === 0} className="px-5 pb-6 pt-12">
          <p className="text-[19px] font-bold">{t('sfeat.m.gm')}</p>
          <p className={muted}>{t('sfeat.m.near')}</p>
          <div className="mt-2 grid grid-cols-[44px_1fr] items-center gap-3 border-b border-[#0B2150]/10 py-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#00C9C5] to-[#2F58B7] font-bold text-white">AR</span>
            <div><b>Dr. Anitha Rao</b><p className={muted}>MBBS, MD · 2.1 km</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['10:30', '11:30', '12:00', '12:30'].map((s) => (
              <span key={s} className={`rounded-[10px] border px-2.5 py-1.5 text-[13px] font-semibold ${s === '11:30' ? 'border-[#0A9A96] bg-[#0A9A96] text-white' : 'border-[#0B2150]/10 text-[#41526E]'}`}>{s}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-[44px_1fr] items-center gap-3 border-b border-[#0B2150]/10 py-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#0B2150]/10 font-bold text-[#6B7A8F]">SK</span>
            <div><b>Dr. S. Kumar</b><p className={muted}>MBBS · 3.4 km</p></div>
          </div>
          <p className="mt-3.5 rounded-xl bg-[#0A9A96]/10 px-3 py-2.5 text-[14px] font-semibold text-[#0A9A96]">✓ {t('sfeat.m.booked')}</p>
          <p className="mt-auto rounded-full bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] py-3.5 text-center font-semibold text-white">{t('sfeat.m.confirmed')}</p>
        </Layer>

        <Layer on={active === 1} className="px-5 pb-6 pt-12">
          <p className="text-[19px] font-bold">{t('sfeat.m.yourToken')}</p>
          <p className={muted}>Dr. Anitha Rao · OPD</p>
          <p className="mt-5 bg-gradient-to-b from-[#0A9A96] to-[#2F58B7] bg-clip-text text-center text-[104px] font-bold leading-none tracking-[-0.05em] text-transparent">14</p>
          <div className="mt-auto">
            <div className={row}><span className={muted}>{t('sfeat.m.nowServing')}</span><b className="tabular-nums">6</b></div>
            <div className={row}><span className={muted}>{t('sfeat.m.ahead')}</span><b className="tabular-nums">8</b></div>
            <div className={row}><span className={muted}>{t('sfeat.m.status')}</span><Live label={t('sfeat.m.live')} /></div>
          </div>
        </Layer>

        <Layer on={active === 2} className="bg-[#ECE5DD] px-5 pb-6 pt-12">
          <div className="-mx-5 -mt-12 mb-3 flex items-center gap-2.5 bg-[#0A9A96] px-4 pb-3 pt-11 text-white">
            <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/25 text-[14px] font-bold">TC</span>
            <div><b>TapCure</b><p className="text-[12px] opacity-85">WhatsApp</p></div>
          </div>
          {[['sfeat.m.wa1', '9:02 AM'], ['sfeat.m.wa2', '10:48 AM']].map(([k, time]) => (
            <div key={k} className="mt-2.5 max-w-[92%] rounded-[16px_16px_16px_4px] bg-[#DCF8C6] px-3 py-2.5 text-[14.5px] leading-snug text-[#123B22] shadow-sm">
              {t(k)}<small className="mt-0.5 block text-right text-[11px] opacity-60">{time}</small>
            </div>
          ))}
        </Layer>

        <Layer on={active === 3} className="px-5 pb-6 pt-12">
          <p className="text-[19px] font-bold">{t('sfeat.m.leaveTitle')}</p>
          <p className={muted}>{t('sfeat.m.ahead3')}</p>
          <div className="relative mt-3 flex-1 overflow-hidden rounded-[18px] bg-[#E4EFEC]">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 260 300" preserveAspectRatio="xMidYMid slice">
              <g stroke="#FFFFFF" strokeWidth="10" fill="none" strokeLinecap="round">
                <path d="M-10 70 H270" /><path d="M-10 190 H270" /><path d="M60 -10 V310" /><path d="M190 -10 V310" /><path d="M-10 280 L270 120" />
              </g>
              <path d="M60 250 V190 H190 V70" stroke="#0A9A96" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="10 8" />
              <circle cx="60" cy="250" r="9" fill="#2F58B7" stroke="#fff" strokeWidth="3" />
              <path d="M190 48c-9 0-15 7-15 15 0 11 15 24 15 24s15-13 15-24c0-8-6-15-15-15z" fill="#0A9A96" stroke="#fff" strokeWidth="2" />
              <circle cx="190" cy="63" r="5" fill="#fff" />
            </svg>
          </div>
          <div className="mt-3.5 flex items-end justify-between">
            <div><p className={muted}>{t('sfeat.m.leaveNow')}</p><b className="text-[30px] tracking-[-0.03em]">{t('sfeat.m.min', { n: 18 })}</b></div>
            <span className={muted}>{t('sfeat.m.drive')}</span>
          </div>
        </Layer>

        <Layer on={active === 4} className="px-5 pb-6 pt-12">
          <p className="text-center text-[19px] font-bold">Dr. Anitha Rao</p>
          <div className="relative mx-auto mb-2 mt-6 h-[200px] w-[200px]">
            <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
              <circle cx="100" cy="100" r="86" fill="none" stroke="rgba(11,33,80,.1)" strokeWidth="14" />
              <circle cx="100" cy="100" r="86" fill="none" stroke="#0A9A96" strokeWidth="14" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <span className={muted}>{t('sfeat.m.token')}</span><b className="text-[56px] leading-none tracking-[-0.04em]">14</b>
            </div>
          </div>
          <p className="mt-2 text-center text-[24px] font-bold">{t('sfeat.m.turn')}</p>
          <p className={`mt-1 text-center ${muted}`}>{t('sfeat.m.room')}</p>
        </Layer>
      </div>
    </div>
  )
}

function DeskScreens({ active, clock }) {
  const { t } = useI18n()
  const q = (tok, name, tag, kind = '') => (
    <div key={tok} className={`grid grid-cols-[52px_1fr_auto] items-center gap-3 border-b border-[#0B2150]/10 px-5 py-3 text-[15px] ${kind === 'now' ? 'bg-[#0A9A96]/10' : kind === 'new' ? 'bg-amber-100/70' : ''}`}>
      <span className="font-bold tabular-nums">#{tok}</span><span>{name}</span>
      <span className={`text-[12.5px] font-semibold ${kind === 'now' ? 'text-[#0A9A96]' : kind === 'new' ? 'text-amber-700' : 'text-[#6B7A8F]'}`}>{tag}</span>
    </div>
  )
  return (
    <div className="relative h-[520px] w-[420px] overflow-hidden rounded-[22px] bg-white text-[#0B2150] shadow-[0_50px_90px_-44px_rgba(11,33,80,.65)]">
      <div className="flex items-center justify-between border-b border-[#0B2150]/10 px-5 py-4">
        <b>Dr. Anitha Rao · OPD</b><Live label={clock} />
      </div>

      <Layer on={active === 0} className="pt-[61px]">
        {q(1, 'Ravi Kumar', t('sfeat.m.withDoc'), 'now')}
        {q(2, 'Sana Begum', t('sfeat.m.next'))}
        {q(3, 'Prakash Reddy', t('sfeat.m.bookedTag'))}
        {q(4, 'Meena K', t('sfeat.m.bookedTag'))}
        {q(5, 'Arjun S', t('sfeat.m.bookedTag'))}
        <p className={`px-5 py-3.5 ${muted}`}>{t('sfeat.m.more')}</p>
      </Layer>

      <Layer on={active === 1} className="pt-[61px]">
        {q(11, 'Kiran B', t('sfeat.m.withDoc'), 'now')}
        {q(12, 'Fatima N', t('sfeat.m.next'))}
        {q(13, 'Suresh P', t('sfeat.m.bookedTag'))}
        {q(14, 'Anil M', t('sfeat.m.bookedTag'))}
        {q(15, 'Lakshmi Devi', t('sfeat.m.walkin'), 'new')}
      </Layer>

      <Layer on={active === 2} className="pt-[61px]">
        <p className="mx-5 mb-1 mt-3.5 rounded-[14px] bg-[#E14356]/10 px-3.5 py-3 text-[14.5px] font-semibold text-[#E14356]">{t('sfeat.m.lateSent')}</p>
        {q(16, 'Rahul T', t('sfeat.m.withDoc'), 'now')}
        {q(17, 'Divya S', t('sfeat.m.newTime', { t: '11:40' }))}
        {q(18, 'Mohan R', t('sfeat.m.newTime', { t: '11:50' }))}
        {q(19, 'Geeta L', t('sfeat.m.newTime', { t: '12:00' }))}
      </Layer>

      <Layer on={active === 3} className="pt-[61px]">
        <p className="px-5 pt-4 text-[19px] font-bold">{t('sfeat.m.today')}</p>
        <div className="mt-1.5 grid grid-cols-2">
          {[['38', 'sfeat.m.seen'], ['6', 'sfeat.m.walkins'], ['3', 'sfeat.m.noshows'], [t('sfeat.m.min', { n: 14 }), 'sfeat.m.avgWait']].map(([n, k], i) => (
            <div key={k} className={`border-b border-[#0B2150]/10 px-5 py-5 ${i % 2 === 0 ? 'border-r' : ''}`}>
              <b className="block text-[42px] leading-none tracking-[-0.04em] tabular-nums">{n}</b>
              <span className={muted}>{t(k)}</span>
            </div>
          ))}
        </div>
      </Layer>
    </div>
  )
}

/* ── the story: steps on one side, the device stays in place ──────────── */

export function Story({ steps, device }) {
  const { t } = useI18n()
  const brand = BRAND.name
  const wrap = useRef(null)
  const fill = useRef(null)
  const [active, setActive] = useState(0)

  // The step nearest the middle of the screen is the one being read; the
  // ruler fills with how far the reader is through the story.
  useEffect(() => {
    const onScroll = () => {
      const el = wrap.current
      if (!el) return
      const mid = window.innerHeight / 2
      let a = 0
      el.querySelectorAll('[data-step]').forEach((s, i) => { if (s.getBoundingClientRect().top < mid) a = i })
      setActive(a)
      const bar = fill.current?.parentElement?.getBoundingClientRect()
      if (bar) fill.current.style.height = `${Math.max(0, Math.min(1, (mid - bar.top) / bar.height)) * 100}%`
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const clock = steps[active].time
  const screen = steps[active].screen
  const isPhone = device === 'phone'

  return (
    <div ref={wrap} className="grid py-10 md:grid-cols-[minmax(0,1fr)_380px] md:gap-16">
      <div className="relative pl-16 md:pl-24">
        <div aria-hidden="true" className="absolute bottom-[12vh] left-[34px] top-[12vh] w-[3px] rounded bg-[color:var(--stroke-2,rgba(11,33,80,.1))] md:left-[58px]">
          <i ref={fill} className="absolute left-0 top-0 block h-0 w-full rounded bg-gradient-to-b from-[#00C9C5] to-[#2F58B7]" />
        </div>
        {steps.map((s, i) => (
          <article
            key={s.h}
            data-step
            className={`relative flex min-h-[calc(var(--app-vh,1vh)*62)] flex-col justify-center transition-opacity duration-500 motion-reduce:transition-none md:min-h-[calc(var(--app-vh,1vh)*78)] ${i === active ? 'opacity-100' : 'opacity-30'}`}
          >
            <span className={`absolute -left-16 top-1/2 w-14 -translate-y-[140%] text-right text-[13px] font-bold tabular-nums md:-left-24 md:w-[76px] md:text-[15px] ${i === active ? 'text-[color:var(--mint,#0A9A96)]' : 'text-[color:var(--muted,#6B7A8F)]'}`}>
              {s.time}
            </span>
            <span
              aria-hidden="true"
              className={`absolute -left-[37px] top-1/2 -mt-[58px] h-[15px] w-[15px] rounded-full border-[3px] transition-colors md:-left-[44px] ${i <= active ? 'border-[color:var(--mint,#0A9A96)] bg-[color:var(--mint,#0A9A96)]' : 'border-[color:var(--stroke-2,rgba(11,33,80,.15))] bg-[color:var(--bg,#EAF4F3)]'}`}
            />
            <h2 className="max-w-[13ch] text-[32px] font-bold leading-[1.06] tracking-[-0.03em] sm:text-[44px] lg:text-[52px]">{t(s.h)}</h2>
            <p className="mt-4 max-w-[40ch] text-[17px] leading-relaxed text-[color:var(--ink-2,#41526E)] sm:text-[18.5px]">{t(s.b, { brand })}</p>
            {s.feats.length > 0 && (
              <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14.5px] font-semibold text-[color:var(--mint,#0A9A96)]">
                {s.feats.map((k) => <span key={k}>✓ {t(k)}</span>)}
              </p>
            )}
          </article>
        ))}
      </div>

      {/* The device: on top and smaller on phones, beside the steps on desktop. */}
      {/* --app-vh: the real window height even when DisplayScale zooms the page (plain vh would be zoomed too). */}
      <div aria-hidden="true" className="sticky top-[76px] z-10 -order-1 grid place-items-center py-2 md:order-none md:top-[max(80px,calc(var(--app-vh,1vh)*50_-_300px))] md:h-[620px] md:py-0">
        <div>
          <div className={`relative ${isPhone ? 'h-[400px] w-[200px] md:h-[600px] md:w-[300px]' : 'h-[364px] w-[294px] md:h-[520px] md:w-[420px]'}`}>
            <div className="absolute left-0 top-0 origin-top-left scale-[.667] md:scale-100">
              {isPhone ? <PhoneScreens active={screen} clock={clock.replace(/ [AP]M/, '')} /> : <DeskScreens active={screen} clock={clock} />}
            </div>
          </div>
          <p className="mt-3 hidden text-center text-[12.5px] text-[color:var(--muted,#6B7A8F)] md:block">{t('sfeat.example')}</p>
        </div>
      </div>
    </div>
  )
}
export default Story
