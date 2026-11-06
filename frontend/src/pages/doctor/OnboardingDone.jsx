import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CalendarClock, Check, IndianRupee, LayoutDashboard } from 'lucide-react'
import { fileUrl } from '../../api'
import { Avatar } from '../../components/hospital/ui.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { OnboardingQuote } from '../../components/doctor/OnboardingHeader.jsx'

function Fact({ icon: Icon, label, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 24 }}
      className="flex items-center gap-3 rounded-2xl bg-slate-50/80 px-4 py-3.5 ring-1 ring-inset ring-slate-100"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-teal-600 shadow-sm">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 text-left">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="truncate text-[14.5px] font-bold text-ink">{value}</p>
      </div>
    </motion.div>
  )
}

export default function OnboardingDone() {
  const navigate = useNavigate()
  const { doctor, hospital } = useDoctorCtx()
  const { sessionCount = 0 } = useOutletContext() || {}

  const practice = hospital?.name || doctor?.hospital_name || 'your practice'

  return (
    <div className="flex w-full flex-1 items-center justify-center gap-12 py-4">
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-white bg-white p-8 text-center shadow-lift sm:p-11"
      >
        {/* a soft wash behind the tick, so the card has a focal point */}
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[28rem] -translate-x-1/2 rounded-full bg-emerald-200/35 blur-3xl" />

        <div className="relative">
          <motion.span
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 240, damping: 16 }}
            className="mx-auto grid h-[68px] w-[68px] place-items-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-[0_16px_34px_-14px_rgba(16,185,129,0.95)]"
          >
            <Check className="h-8 w-8" strokeWidth={3.5} />
          </motion.span>

          <h1 className="mt-6 font-display text-[32px] font-semibold leading-tight text-ink sm:text-[40px]">
            You&apos;re live.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
            Setup is complete. Patients searching near {practice} can find you, see your consulting
            hours and book a token straight away.
          </p>

          {/* who's live */}
          <div className="mx-auto mt-7 flex w-fit items-center gap-3 rounded-full bg-slate-50 py-2 pl-2 pr-5 ring-1 ring-inset ring-slate-100">
            {doctor?.profile_photo_url ? (
              <img
                src={fileUrl(doctor.profile_photo_url)}
                alt={doctor.name}
                className="h-11 w-11 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <Avatar name={doctor?.name} className="h-11 w-11" />
            )}
            <div className="text-left leading-tight">
              <p className="whitespace-nowrap text-[14.5px] font-bold text-ink">Dr. {doctor?.name}</p>
              <p className="text-[12px] font-semibold text-teal-700">{doctor?.specialization || 'Practitioner'}</p>
            </div>
          </div>

          <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
            <Fact icon={CalendarClock} label="Weekly sessions" value={`${sessionCount} added`} delay={0.3} />
            <Fact
              icon={IndianRupee}
              label="Consultation fee"
              value={doctor?.consultation_fee ? `₹${Number(doctor.consultation_fee)}` : 'Not set'}
              delay={0.37}
            />
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/doctor-onboarding/profile')}
              className="flex items-center gap-1.5 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" /> Back to profile
            </button>
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/doctor-dashboard', { replace: true })}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgba(13,148,136,0.95)]"
            >
              <LayoutDashboard className="h-4 w-4" /> Open my dashboard
            </motion.button>
          </div>

          <p className="mt-4 text-[12px] text-slate-400">
            Anything here can be changed later from your dashboard.
          </p>
        </div>
      </motion.section>

      <OnboardingQuote className="hidden shrink-0 xl:block" />
    </div>
  )
}
