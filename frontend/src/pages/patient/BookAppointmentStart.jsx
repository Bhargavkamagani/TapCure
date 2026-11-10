import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Mic, Sparkles, Stethoscope, UsersRound } from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { useI18n } from '../../i18n/index.jsx'

function ChoiceCard({ to, icon: Icon, title, desc, bullets, tone }) {
  const { t } = useI18n()
  const tones = {
    blue: {
      card: 'hover:border-brand-blue/40',
      icon: 'bg-brand-blue text-white shadow-[0_16px_35px_rgba(37,99,235,0.25)]',
      glow: 'bg-brand-blue/20',
      action: 'text-brand-blue',
    },
    green: {
      card: 'hover:border-brand-green/40',
      icon: 'bg-brand-green text-white shadow-[0_16px_35px_rgba(16,185,129,0.24)]',
      glow: 'bg-brand-green/20',
      action: 'text-brand-green',
    },
  }
  const style = tones[tone]

  return (
    <Link
      to={to}
      className={`group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)] ${style.card}`}
    >
      <span className={`absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl transition-transform group-hover:scale-125 ${style.glow}`} />
      <span className="relative flex flex-col gap-5">
        <span className="flex items-start justify-between gap-4">
          <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${style.icon}`}>
            <Icon className="h-8 w-8" />
          </span>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-[13px] font-bold text-slate-500">
            {t('ppage.startHere')}
          </span>
        </span>

        <span>
          <span className="block text-[22px] font-extrabold text-brand-navy">{title}</span>
          <span className="mt-1 block text-[13.5px] leading-relaxed text-slate-500">{desc}</span>
        </span>

        <span className="grid gap-2">
          {bullets.map((bullet) => (
            <span key={bullet} className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
              {bullet}
            </span>
          ))}
        </span>

        <span className={`inline-flex items-center gap-2 text-[13px] font-extrabold ${style.action}`}>
          {t('ppage.continue')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </span>
    </Link>
  )
}

function BookAppointmentStart() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.bookStartTitle')} subtitle={t('ppage.bookStartSubtitle')} />

      <Link
        to="/patient-dashboard/appointments/voice"
        className="group relative block overflow-hidden rounded-2xl border border-brand-blue/15 bg-gradient-to-r from-brand-blue via-brand-blue to-brand-blueDark p-5 text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)] transition-transform hover:-translate-y-0.5"
      >
        <div className="absolute right-8 top-6 h-20 w-20 animate-pulse rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-12 h-16 w-16 animate-pulse rounded-full bg-white/15 blur-xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/30">
              <Mic className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[16px] font-extrabold">{t('vbook.cardTitle')}</p>
              <p className="text-[13px] text-white/85">{t('vbook.cardSub')}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-brand-blue shadow-sm">
            <Sparkles className="h-4 w-4" /> {t('vbook.start')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChoiceCard
          to="/patient-dashboard/doctors"
          icon={Stethoscope}
          title={t('ppage.findDoctorTitle')}
          desc={t('ppage.findDoctorDesc')}
          bullets={[t('ppage.findDoctorB1'), t('ppage.findDoctorB2'), t('ppage.findDoctorB3')]}
          tone="blue"
        />
        <ChoiceCard
          to="/patient-dashboard/hospitals"
          icon={Building2}
          title={t('ppage.findHospitalTitle')}
          desc={t('ppage.findHospitalDesc')}
          bullets={[t('ppage.findHospitalB1'), t('ppage.findHospitalB2'), t('ppage.findHospitalB3')]}
          tone="green"
        />
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[14px] font-bold text-brand-navy">{t('ppage.alreadyHaveAppt')}</p>
            <p className="text-[13.5px] text-slate-500">{t('ppage.viewBookings')}</p>
          </div>
        </div>
        <Link to="/patient-dashboard/appointments" className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-bold text-brand-navy hover:bg-slate-50">
          {t('ppage.myAppointments')}
        </Link>
      </Card>
    </div>
  )
}

export default BookAppointmentStart
