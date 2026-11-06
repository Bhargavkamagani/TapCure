import { LifeBuoy, LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * Shown when a DOCTOR login has no doctor record attached to it.
 *
 * Deliberately a dead end with an explanation rather than a redirect. Sending
 * them to /doctor-login would loop — they ARE authenticated, so the login page
 * bounces them straight back to /doctor-dashboard. And the previous behaviour
 * (quietly loading the first doctor in the hospital) meant this state was never
 * visible at all: the doctor just saw someone else's console.
 */
export default function DoctorNotLinked() {
  const { user, logout } = useAuth()
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-5">
      <div className="w-full max-w-md rounded-[26px] border border-white bg-white p-8 text-center shadow-soft">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-[20px] font-extrabold text-ink">This login isn&apos;t linked to a doctor</h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">
          You&apos;re signed in{user?.email ? <> as <span className="font-semibold text-ink">{user.email}</span></> : ''},
          but no doctor profile is attached to this account, so there is no practice to show.
        </p>
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[12.5px] leading-relaxed text-slate-500">
          Ask your hospital admin to link this login to your doctor record. If you registered your own
          practice, contact support and quote this email.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <a
            href="/contact"
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:border-slate-300 hover:text-ink"
          >
            <LifeBuoy className="h-4 w-4" /> Contact support
          </a>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-3 text-sm font-bold text-white"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </div>
    </div>
  )
}
