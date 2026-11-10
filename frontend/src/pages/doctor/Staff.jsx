import { Info } from 'lucide-react'
import { Card, StatusBadge, PageHeading, Avatar } from '../../components/hospital/ui.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'

/**
 * The DOCTOR role can only read doctor records (not the users/receptionist
 * directories — those are hospital-admin scoped), so this lists the medical
 * staff at the hospital.
 */
function Staff() {
  const { doctorsById, loading } = useDoctorCtx()
  const staff = Object.values(doctorsById)

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Hospital Staff" subtitle="Doctors practising at your hospital." />

      <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-[13.5px] text-brand-blue">
        <Info className="h-4 w-4 shrink-0" />
        Front-desk and admin user management is handled in the hospital admin console.
      </div>

      <Card>
        <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[13px] font-semibold text-slate-400">
              <th className="pb-3 pr-4">Name</th><th className="pb-3 pr-4">Specialization</th><th className="pb-3 pr-4">Experience</th><th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="text-[13.5px]">
            {staff.map((s) => (
              <tr key={s.doctor_id} className="border-t border-slate-50">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.name} className="h-9 w-9 text-xs" />
                    <span className="font-medium text-brand-navy">{s.name}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-slate-500">{s.specialization}</td>
                <td className="py-3 pr-4 text-slate-500">{s.experience_years != null ? `${s.experience_years} yrs` : '—'}</td>
                <td className="py-3"><StatusBadge status={s.status === 'active' ? 'Active' : s.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No staff found.</p>
        ) : null}
      </Card>
    </div>
  )
}

export default Staff
