import { useEffect, useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { Sparkles, CalendarCheck, Ticket, Stethoscope, Mail, Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { takeSignedOutReason } from '../lib/signedOut.js'
import GlassBackdrop from '../components/common/GlassBackdrop.jsx'
import BackToHome from '../components/common/BackToHome.jsx'
import ForgotPasswordFlow from '../components/auth/ForgotPasswordFlow.jsx'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mobileRe = /^\d{10}$/

/* Illustrative: this page is seen before anyone signs in, so there is no
   hospital whose real numbers these could be. Sized for one busy practice. */
const STATS = [
  { icon: CalendarCheck, label: "Today's appointments", value: '24', note: 'across two sessions', at: 'left-[18%] top-[-16%]' },
  { icon: Users, label: 'Patients seen', value: '56', note: 'this week', at: 'left-[-12%] top-[14%]' },
  { icon: Ticket, label: 'Live tokens', value: '8', note: 'in queue', at: 'right-[1%] top-[6%]' },
]

const FEATURES = [
  { icon: CalendarCheck, title: 'Online Appointment Booking', desc: 'Let patients book appointments anytime.' },
  { icon: Ticket, title: 'Digital Token Management', desc: 'Streamline queue and reduce waiting time.' },
  { icon: Stethoscope, title: 'Doctor & Schedule', desc: 'Manage doctors, timings and availability easily.' },
]

function HospitalLogin() {
  const navigate = useNavigate()
  const { user, loading, login, homeFor } = useAuth()
  const [form, setForm] = useState({ idf: '', password: '' })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [forgot, setForgot] = useState(false)

  // Thrown back here by the app rather than by choice: one account holds one
  // session, and this one was signed in somewhere else. Say so — a login screen
  // with no explanation reads as the app losing the session on its own.
  // (Reception is exempt server-side, so a front desk never sees this.)
  const SIGNED_OUT = {
    'other-device': 'You were signed out because this account was used to sign in on another device. Please sign in again.',
    'credentials-changed': "You were signed out because this account's email or password was changed by your hospital admin.",
    ended: 'Your session has ended. Please sign in again.',
  }
  useEffect(() => {
    const msg = SIGNED_OUT[takeSignedOutReason()]
    if (msg) setBanner({ type: 'error', msg })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Already signed in (typed the URL, or landed here from stale history) —
  // send them to their own console instead of offering a second login.
  if (!loading && user) return <Navigate to={homeFor(user.role_name)} replace />

  const handleLogin = async (e) => {
    e.preventDefault()
    const err = {}
    const idf = form.idf.trim()
    // Hospital staff sign in with their registered email — a mobile number is the
    // PATIENT door and never resolves to a hospital login, so say so here rather
    // than letting the API answer 401.
    if (!idf) err.idf = 'Required'
    else if (mobileRe.test(idf)) err.idf = 'Sign in with your registered email address.'
    else if (!emailRe.test(idf)) err.idf = 'Enter a valid email address'
    if (!form.password.trim()) err.password = 'Required'
    setErrors(err)
    if (Object.keys(err).length) return

    setBusy(true)
    setBanner({ type: 'success', msg: 'Signing you in…' })
    try {
      // 'hospital' = admin / front desk / super admin. A doctor's credentials are
      // refused here and pointed at the Doctor login instead.
      const u = await login(idf, form.password, 'hospital')
      // REPLACE, not push: pushing left the login page one Back press behind
      // the console, so Back showed a login form to someone already signed in.
      navigate(homeFor(u.role_name), { replace: true })
    } catch (e2) {
      setBanner({
        type: 'error',
        msg: e2.status === 401 ? 'Invalid credentials. Use the demo credentials below.' : e2.message || 'Login failed',
      })
      setBusy(false)
    }
  }

  return (
    /* Full-bleed: the two panels ARE the screen — no page padding, no width cap,
       no gap. Each half owns its own vertical scroll, so a short window scrolls
       the column that overflows instead of the whole page, and neither half can
       ever push the other off-screen. */
    <div className="login-glass-page theme-editorial relative isolate min-h-screen overflow-x-hidden bg-gradient-to-br from-emerald-50 via-white to-teal-50 font-sans text-slate-700 lg:h-screen lg:overflow-hidden">
      <GlassBackdrop />
      <BackToHome className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6" />
      <div className="grid w-full max-w-full grid-rows-[auto_auto] overflow-x-hidden lg:h-full lg:grid-cols-2 lg:grid-rows-1 lg:overflow-visible">
        {/* ── Left: pitch + features ──────────────────────────────────────── */}
        <section className="relative flex w-full min-w-0 flex-col justify-center px-6 pb-10 pt-24 sm:px-10 lg:h-full lg:overflow-hidden lg:p-12 lg:pt-12">
          {/* Artwork sits in the cell, the copy in a bounded block inside it,
              so the building can use the width the text does not need. */}
          <div aria-hidden="true" className="pointer-events-none absolute right-[1%] top-[13%] hidden w-[47%] max-w-[440px] xl:block">
            <img src="/hospital-login-art.webp" alt="" className="w-full select-none" />
            {STATS.map(({ icon: Icon, label, value, note, at }) => (
              <span key={label} className={`absolute flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/85 px-3.5 py-2.5 shadow-lg backdrop-blur-sm ${at}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[10.5px] font-medium text-slate-500">{label}</span>
                  <b className="block text-[19px] font-extrabold tracking-tight text-[#0f2742]">{value}</b>
                  <span className="block text-[10px] text-slate-400">{note}</span>
                </span>
              </span>
            ))}
          </div>

          <div className="relative z-10 w-full lg:ml-auto lg:max-w-[640px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3.5 py-1.5 text-[13px] font-semibold text-teal-700">
            <Sparkles className="h-4 w-4" /> Trusted by Hospitals, Loved by Patients
          </span>

          <h1 className="mt-6 max-w-[22rem] text-[2.1rem] font-extrabold leading-[1.08] tracking-tight text-[#0f2742] sm:text-[2.7rem] xl:text-[3.4rem] xl:leading-[1.06]">
            Grow your hospital with{' '}
            <span className="bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">TapCure</span>
          </h1>
          <div className="mt-4 h-1 w-20 rounded-full bg-gradient-to-r from-teal-600 to-green-600" />

          <p className="mt-4 max-w-[24rem] text-[15.5px] leading-relaxed text-slate-500 sm:mt-5 sm:text-[17.5px]">
            Manage appointments, tokens, doctors and patient visits — all in one
            smart platform designed for modern hospitals.
          </p>

          <div className="mt-8 grid max-w-[38rem] gap-3 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-white/70 bg-white/55 p-4 backdrop-blur-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-[15px] font-bold leading-tight text-[#0f2742]">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-snug text-slate-500">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/70 bg-emerald-50/70 p-3.5 backdrop-blur-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-green-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <p className="text-[13px] leading-snug text-slate-600">
              <b className="font-bold text-[#0f2742]">Encrypted &amp; DPDP-ready.</b> Built for
              India's hospitals — patient data is encrypted in transit and at rest, and access is
              logged.
            </p>
          </div>
          </div>
        </section>

        {/* ── Right: login card ───────────────────────────────────────────── */}
        <section className="flex w-full min-w-0 items-center justify-center px-5 pb-12 sm:px-8 lg:h-full lg:overflow-y-auto lg:p-10">
          <div className="w-full max-w-[560px] rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-xl backdrop-blur-xl sm:p-9 lg:p-11">
          <div className="flex flex-col items-center text-center">
            {/* An illustration rather than a glyph, so it fills the tile
                instead of floating at icon size inside it — matching how the
                doctor login carries its avatar. The teal ground stays visible
                behind the transparent corners. */}
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-teal-50 text-teal-600">
              <img
                src="/hospital-avatar.png"
                alt=""
                aria-hidden="true"
                className="h-full w-full scale-[1.08] object-contain select-none"
              />
            </span>
            <h2 className="mt-4 text-[1.75rem] font-extrabold tracking-tight text-[#0f2742] sm:mt-5 sm:text-[2.35rem]">Hospital Login</h2>
            <p className="mt-3 max-w-md text-[15.5px] text-slate-500">
              Sign in to access your hospital dashboard and manage your practice.
            </p>
          </div>

          {banner && (
            <div
              className={`mt-5 rounded-xl border px-4 py-2.5 text-sm ${
                banner.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-green-200 bg-green-50 text-green-700'
              }`}
            >
              {banner.msg}
            </div>
          )}

          {forgot ? (
            <div className="mt-6"><ForgotPasswordFlow portal="hospital" onBack={() => { setForgot(false); setBanner(null) }} /></div>
          ) : (
          <>
          <form onSubmit={handleLogin} className="mt-6 space-y-3">
            <div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/55 px-4 py-3.5 backdrop-blur-md transition-colors focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/10">
                <Mail className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  type="text"
                  placeholder="Registered hospital email address"
                  value={form.idf}
                  onChange={set('idf')}
                  className="flex-1 bg-transparent text-sm text-[#0f2742] placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              {errors.idf && <p className="mt-1 pl-1 text-xs text-red-600">{errors.idf}</p>}
            </div>

            <div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/55 px-4 py-3.5 backdrop-blur-md transition-colors focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/10">
                <Lock className="h-5 w-5 shrink-0 text-slate-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Password"
                  value={form.password}
                  onChange={set('password')}
                  className="flex-1 bg-transparent text-sm text-[#0f2742] placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="text-slate-400 transition-colors hover:text-teal-600"
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 pl-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-green-600 py-4 text-sm font-bold text-white shadow-sm transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Login to Dashboard'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-teal-100" /> or <span className="h-px flex-1 bg-teal-100" />
          </div>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => { setForgot(true); setBanner(null); setErrors({}) }}
              className="font-semibold text-teal-700 hover:underline"
            >
              Forgot password?
            </button>
            <span className="text-slate-500">
              New hospital?{' '}
              <Link to="/hospital-signup" className="font-bold text-teal-700 hover:underline">
                Register here
              </Link>
            </span>
          </div>
          </>
          )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default HospitalLogin
