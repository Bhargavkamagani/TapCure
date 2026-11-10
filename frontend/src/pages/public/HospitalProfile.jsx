import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, Building2, MapPin, Phone, ShieldCheck, Stethoscope, Users } from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import HospitalMap from '../../components/common/HospitalMap.jsx'
import { discoveryApi, fileUrl } from '../../api'
import { useAuth } from '../../context/AuthContext.jsx'
import { beginBooking } from '../../lib/bookingIntent.js'
import { useI18n } from '../../i18n/index.jsx'
import { translitName, translitDegrees } from '../../lib/translit.js'
import { specialtyLabel } from '../../data/symptomSpecialty.js'
import { InsuranceList } from '../../components/common/Insurance.jsx'

export default function PublicHospitalProfile() {
  const { hospitalId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, lang } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    discoveryApi.hospital(hospitalId)
      .then((result) => { if (active) setData(result) })
      .catch((err) => { if (active) setError(err.status === 404 ? 'pclinic.notAvailable' : err.message || 'pclinic.loadFailed') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hospitalId])

  const book = (doctor) => beginBooking({
    user,
    navigate,
    doctorId: doctor.doctor_id,
    affiliationId: doctor.affiliation_id,
  })

  return (
    <StaticPageShell>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="h-[420px] animate-pulse rounded-[2rem] border border-white/60 bg-white/60" />
        ) : error || !data ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center">
            <h1 className="font-serif text-3xl">{t('pclinic.unavailableTitle')}</h1>
            <p className="mt-2 text-sm text-red-700">{error ? t(error) : ''}</p>
            <Link to="/search?type=hospitals" className="mt-5 inline-block text-sm font-semibold text-teal-700 underline">{t('pclinic.browseHospitals')}</Link>
          </div>
        ) : (
          <>
            <section className="grid gap-6 rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur md:grid-cols-[auto_1fr] md:p-8">
              {data.logo_url ? (
                <img src={fileUrl(data.logo_url)} alt={data.name} className="h-28 w-28 rounded-3xl object-cover ring-4 ring-teal-100" />
              ) : (
                <span className="grid h-28 w-28 place-items-center rounded-3xl bg-emerald-100 text-emerald-700"><Building2 className="h-12 w-12" /></span>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-4xl tracking-tight">{translitName(data.name, lang)}</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700"><BadgeCheck className="h-4 w-4" /> {t('psearch.verifiedHospital')}</span>
                </div>
                <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sage-deep" />{[data.address, data.city, data.state, data.pincode].filter(Boolean).map((x) => translitName(x, lang)).join(', ')}</p>
                <div className="mt-3 flex flex-wrap gap-5 text-sm text-ink-soft">
                  <span className="flex items-center gap-2"><Users className="h-4 w-4 text-sage-deep" />{t('pclinic.doctorsCount', { n: data.doctors?.length || 0 })}</span>
                  {data.phone && <a href={`tel:${data.phone}`} className="flex items-center gap-2 hover:text-sage-deep"><Phone className="h-4 w-4 text-sage-deep" />{data.phone}</a>}
                </div>
              </div>
            </section>

            {/* Insurers / schemes accepted — full list (2026-11-03). */}
            <section className="mt-6 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
                <ShieldCheck className="h-5 w-5 text-sage-deep" />{t('ins.accepted')}
              </h2>
              <InsuranceList codes={data.insurance_partners} />
            </section>

            {data.latitude != null && data.longitude != null && (
              <HospitalMap hospital={data} hospitalLabel={data.name} height={260} className="mt-6 overflow-hidden rounded-3xl border border-white/60 shadow-sm" />
            )}

            <section className="mt-8">
              <h2 className="font-serif text-3xl">{t('pclinic.doctorsAt', { name: translitName(data.name, lang) })}</h2>
              <p className="mt-1 text-sm text-ink-soft">{t('pclinic.selectDoctor')}</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(data.doctors || []).map((doctor) => (
                  <article key={doctor.doctor_id} className="flex flex-col rounded-3xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur">
                    <div className="flex items-start gap-3">
                      {doctor.profile_photo_url ? (
                        <img src={fileUrl(doctor.profile_photo_url)} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700"><Stethoscope className="h-5 w-5" /></span>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-foreground">{translitName(doctor.name, lang)}</h3>
                        <p className="text-sm text-sage-deep">{specialtyLabel(doctor.specialization, lang)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{translitDegrees(doctor.qualification, lang)}</p>
                      </div>
                    </div>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                      <Link to={`/doctors/${doctor.doctor_id}`} className="rounded-xl border border-teal-600 px-3 py-2 text-center text-sm font-semibold text-teal-700">{t('pclinic.profile')}</Link>
                      {doctor.has_timings === false
                        ? <span className="cursor-not-allowed rounded-xl bg-slate-200 px-3 py-2 text-center text-sm font-bold text-slate-500">{t('pdoc.notAvailableShort')}</span>
                        : <button onClick={() => book(doctor)} className="rounded-xl bg-teal-700 px-3 py-2 text-sm font-bold text-white">{t('psearch.book')}</button>}
                    </div>
                  </article>
                ))}
              </div>
              {!data.doctors?.length && <p className="mt-4 rounded-2xl bg-white/60 p-6 text-sm text-ink-soft">{t('pclinic.noDoctors')}</p>}
            </section>
          </>
        )}
      </main>
    </StaticPageShell>
  )
}
