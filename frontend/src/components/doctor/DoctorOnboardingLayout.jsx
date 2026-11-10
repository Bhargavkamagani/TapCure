import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { BadgeCheck, CalendarClock, Check, LogOut, Sparkles, UserRound } from 'lucide-react'
import Logo from '../common/Logo.jsx'
import Wordmark from '../common/Wordmark.jsx'
import Tagline from '../common/Tagline.jsx'
import { DoctorProvider } from '../../context/DoctorContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useDoctorSetupStatus, SetupSpinner } from './DoctorSetupGate.jsx'
import DoctorNotLinked from './DoctorNotLinked.jsx'

/** The three screens of first-login setup. Only the first two ask for input —
 *  `done` is the celebration the doctor lands on, so progress is counted out of
 *  the two input steps, never out of STEPS.length. */
const STEPS = [
  { key: 'availability', title: 'Consulting hours', sub: 'When patients can book you', icon: CalendarClock },
  { key: 'profile', title: 'Your profile', sub: 'Three short screens', icon: UserRound },
  { key: 'done', title: 'Go live', sub: 'Open your dashboard', icon: Sparkles },
]
const INPUT_STEPS = 2

function stepKeyFor(pathname) {
  return STEPS.find((s) => pathname.endsWith(`/${s.key}`))?.key || 'availability'
}

/** One row of the vertical rail in the dark pane. */
function RailStep({ step, index, state, onJump, last }) {
  const { icon: Icon } = step
  const clickable = Boolean(onJump)
  return (
    <li className="relative flex gap-4">
      {/* connector */}
      {!last && (
        <span className="absolute left-[19px] top-11 h-[calc(100%-16px)] w-px bg-white/15">
          <motion.span
            className="block w-full bg-emerald-400/70"
            initial={false}
            animate={{ height: state === 'done' ? '100%' : '0%' }}
            transition={{ duration: 0.4 }}
          />
        </span>
      )}
      <motion.span
        animate={state === 'active' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.55 }}
        className={`z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-colors ${
          state === 'done'
            ? 'border-emerald-400/60 bg-emerald-400 text-teal-950'
            : state === 'active'
              ? 'border-white/70 bg-white text-teal-900 shadow-[0_0_0_5px_rgba(255,255,255,0.12)]'
              : 'border-white/20 bg-white/5 text-white/40'
        }`}
      >
        {state === 'done' ? <Check className="h-[18px] w-[18px]" strokeWidth={3} /> : <Icon className="h-[18px] w-[18px]" />}
      </motion.span>

      <button
        type="button"
        disabled={!clickable}
        onClick={onJump || undefined}
        className={`min-w-0 flex-1 pb-8 text-left ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className={`block text-[12px] font-bold uppercase tracking-[0.16em] ${
          state === 'todo' ? 'text-white/35' : 'text-emerald-300/90'
        }`}>
          {index < INPUT_STEPS ? `Step ${index + 1}` : 'Finish'}
        </span>
        <span className={`mt-0.5 block text-[15px] font-bold transition-colors ${
          state === 'todo' ? 'text-white/45' : 'text-white'
        } ${clickable ? 'hover:text-emerald-200' : ''}`}>
          {step.title}
        </span>
        <span className={`mt-0.5 block text-[13.5px] ${state === 'todo' ? 'text-white/25' : 'text-white/50'}`}>
          {step.sub}
        </span>
      </button>
    </li>
  )
}

function SetupShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { doctor, loading, availability, sessionCount, profile, revisitReady, refresh } = useDoctorSetupStatus()

  // Re-count sessions whenever the doctor moves between steps, so going back to
  // fix something and returning shows an honest rail.
  useEffect(() => { refresh() }, [pathname, refresh])

  if (loading) return <SetupSpinner />
  if (!doctor) return <DoctorNotLinked />

  const stepKey = stepKeyFor(pathname)
  const profileReady = profile && revisitReady
  const doneMap = { availability, profile: profileReady, done: false }

  // Routing rules: never let the doctor skip ahead, and never show the finish
  // screen to someone who hasn't finished. Deliberately NOT auto-advancing off
  // the profile step the instant it becomes complete — the doctor presses
  // "Finish setup" themselves, or saving would teleport them. And deliberately
  // no "everything's done, jump to the finish screen" rule: it made a completed
  // step unreopenable from the rail.
  if (stepKey === 'profile' && !availability) return <Navigate to="/doctor-onboarding/availability" replace />
  if (stepKey === 'done' && !availability) return <Navigate to="/doctor-onboarding/availability" replace />
  if (stepKey === 'done' && !profileReady) return <Navigate to="/doctor-onboarding/profile" replace />

  // Any step whose prerequisites are met can be jumped to, in either direction.
  const reachable = { availability: true, profile: availability, done: availability && profileReady }
  const completed = (availability ? 1 : 0) + (profileReady ? 1 : 0)
  const pct = (completed / INPUT_STEPS) * 100
  const finished = stepKey === 'done'
  const firstName = doctor?.name?.trim().split(/\s+/)[0]

  return (
    <div className="theme-reception flex h-screen w-screen overflow-hidden bg-[#f6fbfa]">
      {/* ── Left pane: the constant. Deep, quiet, and the same on every step, so
             the bright working area on the right is the only thing that moves. */}
      <aside className="relative hidden w-[370px] shrink-0 flex-col overflow-hidden bg-gradient-to-b from-teal-900 via-teal-950 to-[#04211f] px-9 py-6 lg:flex xl:w-[410px]">
        {/* depth: two soft glows and a faint dot grid */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            maskImage: 'radial-gradient(ellipse at 30% 0%, black 10%, transparent 65%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 30% 0%, black 10%, transparent 65%)',
          }}
        />

        {/* min-h-0 lets the step list below actually shrink. Without it the list
            keeps its intrinsic height, the footer is pushed past the bottom of
            the h-screen rail, and overflow-hidden slices the log-out button in
            half on shorter laptops. */}
        <div className="relative z-10 flex h-full min-h-0 flex-col">
          {/* The same brand lockup every console rail uses — the icon knocked to
              white read as a stray glyph next to them. */}
          <div className="flex shrink-0 items-center gap-2.5">
            <Logo className="h-10 shrink-0" />
            <span className="leading-tight">
              <Wordmark tone="light" className="block text-[17px]" />
              <Tagline tone="dark" className="mt-0.5" />
            </span>
          </div>

          <div className="mt-4 shrink-0">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-emerald-300/80">Account setup</p>
            <h1 className="mt-1 font-display text-[30px] font-semibold leading-[1.05] text-white">
              {finished ? 'Your practice is live.' : (
                <>Welcome{firstName ? <>, <span className="whitespace-nowrap">Dr. {firstName}</span></> : ''}</>
              )}
            </h1>
            {/* Exactly two lines, one sentence each. The measure is 18rem — inside
                the rail's 298px content box (370px − px-9) — and the first
                sentence is pinned with nowrap (~257px at 13.5px Inter) so it can
                never break mid-sentence the way the single run of copy did. */}
            <p className="mt-1.5 max-w-[18rem] text-[13.5px] leading-[1.35] text-white/55">
              {finished
                ? 'Patients searching nearby can now book a token with you.'
                : (
                  <>
                    <span className="block whitespace-nowrap">Two steps and patients can start booking.</span>
                    <span className="block">Everything here can be changed later.</span>
                  </>
                )}
            </p>
          </div>

          <ol className="mt-5 min-h-0 flex-1 overflow-y-auto">
            {STEPS.map((step, i) => (
              <RailStep
                key={step.key}
                step={step}
                index={i}
                last={i === STEPS.length - 1}
                state={doneMap[step.key] ? 'done' : step.key === stepKey ? 'active' : 'todo'}
                onJump={step.key !== stepKey && reachable[step.key] ? () => navigate(`/doctor-onboarding/${step.key}`) : null}
              />
            ))}
          </ol>

          {/* shrink-0: this footer keeps its full height no matter how tight the
              rail gets, so the log-out button is never the thing that's cut. */}
          <div className="mt-6 shrink-0">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/40">Progress</span>
              <span className="text-[13px] font-bold text-emerald-300">{completed} of {INPUT_STEPS}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-teal-300 to-emerald-300"
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              />
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white/50">
                <BadgeCheck className="h-4 w-4 text-emerald-300" /> Credentials verified
              </span>
              {/* Red rather than white/40 — at that opacity on the dark teal it
                  read as decoration and doctors couldn't find it. */}
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 text-[13px] font-bold text-red-400 transition-colors hover:text-red-300"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right pane: the working area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact header, phones and tablets only — the left pane's job at lg+ */}
        <header className="shrink-0 border-b border-slate-200/70 bg-white px-5 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Logo className="h-8 shrink-0" />
              <Wordmark className="text-[16px]" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-bold text-teal-700">{completed} of {INPUT_STEPS} done</span>
              <button type="button" onClick={logout} className="text-red-500 hover:text-red-600">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
                initial={false}
                animate={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[13px] font-bold text-slate-400">
              {finished ? 'Finish' : `Step ${STEPS.findIndex((s) => s.key === stepKey) + 1}`} · {STEPS.find((s) => s.key === stepKey)?.title}
            </span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-9 sm:py-9">
          <div className="mx-auto flex min-h-full w-full max-w-[1240px] flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={stepKey}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col"
              >
                <Outlet context={{ availability, profile, sessionCount, refresh }} />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function DoctorOnboardingLayout() {
  return (
    <DoctorProvider>
      <SetupShell />
    </DoctorProvider>
  )
}
