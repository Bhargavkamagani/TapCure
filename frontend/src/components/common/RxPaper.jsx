import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { prescriptionsApi, fileUrl } from '../../api'
import DownloadRxPdf from './DownloadRxPdf.jsx'

const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '')

function DoctorLines({ doctor, align = 'right' }) {
  if (!doctor) return null
  return (
    <div className={align === 'right' ? 'text-right' : 'text-left'}>
      <p className="text-[15px] font-extrabold text-slate-900">{doctor.name}</p>
      {doctor.qualification && <p className="text-[12px] text-slate-600">{doctor.qualification}</p>}
      {doctor.specialization && <p className="text-[12px] text-slate-600">{doctor.specialization}</p>}
      {doctor.registration_number && <p className="text-[12px] text-slate-600">Reg. No: {doctor.registration_number}</p>}
    </div>
  )
}

/**
 * A prescription drawn like the printed one — same letterhead, patient line,
 * medicines and signature as the PDF (GET /prescriptions/{id}/paper supplies the
 * letterhead; the medicines come from `rx`). Phone-friendly: the medicine table
 * becomes stacked cards on narrow screens.
 *
 * `actions` is shown in the bottom bar next to Download PDF (e.g. Book follow-up).
 */
export default function RxPaper({ rx, actions = null }) {
  const [paper, setPaper] = useState(null)
  const [broken, setBroken] = useState({})   // image key -> true when it failed to load

  useEffect(() => {
    let active = true
    prescriptionsApi.paper(rx.prescription_id).then((p) => { if (active) setPaper(p) }).catch(() => { if (active) setPaper(false) })
    return () => { active = false }
  }, [rx.prescription_id])

  const pr = paper?.practice
  const doctor = paper?.doctor || (rx.doctor_name ? { name: /^dr\b/i.test(rx.doctor_name) ? rx.doctor_name : `Dr. ${rx.doctor_name}`, specialization: rx.doctor_specialty } : null)
  const pt = paper?.patient
  const img = (k, url) => (url && !broken[k] ? fileUrl(url) : null)
  const header = img('header', pr?.header_url)
  const footer = img('footer', pr?.footer_url)
  const logo = img('logo', pr?.logo_url)
  const signature = img('sig', doctor?.signature_url)
  const fail = (k) => () => setBroken((b) => ({ ...b, [k]: true }))
  const items = rx.items || []
  const ageSex = pt ? [pt.age != null ? `${pt.age} yrs` : '', pt.gender].filter(Boolean).join(' / ') : ''

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)]">
      <div className="px-4 pt-4 sm:px-7 sm:pt-6">
        {/* Letterhead: the hospital's own image, or one built from its details */}
        {header ? (
          <>
            <img src={header} alt={pr?.name || 'Letterhead'} onError={fail('header')} className="w-full object-contain" />
            <div className="mt-3"><DoctorLines doctor={doctor} align="left" /></div>
          </>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              {logo && <img src={logo} alt="" onError={fail('logo')} className="h-14 w-14 shrink-0 rounded-lg object-contain sm:h-16 sm:w-16" />}
              <div className="min-w-0">
                <p className="text-[18px] font-extrabold leading-tight text-teal-700 sm:text-[20px]">{pr?.name || rx.hospital_name || ''}</p>
                {(pr?.address_lines || []).map((l) => <p key={l} className="text-[11.5px] text-slate-500">{l}</p>)}
                {pr?.contact && <p className="text-[11.5px] text-slate-500">{pr.contact}</p>}
                {pr?.registration && <p className="text-[11.5px] text-slate-500">{pr.registration}</p>}
              </div>
            </div>
            <div className="sm:max-w-[45%]"><DoctorLines doctor={doctor} align="right" /></div>
          </div>
        )}
        <div className="mt-3 h-[2px] w-full bg-teal-700" />

        {/* Patient line */}
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-lg border border-teal-100 bg-teal-50/70 px-3 py-2.5 text-[13px] sm:grid-cols-2">
          <p><b>Patient:</b> {pt?.name || rx.family_member_name || rx.patient_name || '—'}</p>
          <p><b>Date:</b> {fmtDateTime(paper?.written_at || rx.created_at)}</p>
          <p><b>Age / Sex:</b> {ageSex || '—'}</p>
          <p><b>Patient ID:</b> {pt?.uhid || '—'}</p>
          {pt?.account_holder && <p className="sm:col-span-2"><b>Account holder:</b> {pt.account_holder}</p>}
        </div>

        {rx.diagnosis && (
          <div className="mt-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-teal-700">Diagnosis</p>
            <p className="text-[14px]">{rx.diagnosis}</p>
          </div>
        )}

        {/* Medicines */}
        <p className="mt-4 text-[24px] font-black leading-none text-teal-700">Rx</p>
        {items.length === 0 ? (
          <p className="mt-2 text-[13px] text-slate-400">No medicines prescribed.</p>
        ) : (
          <>
            <table className="mt-2 hidden w-full text-left text-[13px] sm:table">
              <thead>
                <tr className="bg-teal-700 text-[12px] text-white">
                  <th className="px-2 py-1.5">#</th><th className="px-2 py-1.5">Medicine</th><th className="px-2 py-1.5">Dosage</th>
                  <th className="px-2 py-1.5">Frequency</th><th className="px-2 py-1.5">Duration</th><th className="px-2 py-1.5">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.item_id || i} className="border-b border-slate-200 align-top odd:bg-white even:bg-slate-50">
                    <td className="px-2 py-1.5 text-slate-500">{i + 1}</td>
                    <td className="px-2 py-1.5 font-bold">{it.drug_name}</td>
                    <td className="px-2 py-1.5">{it.dosage}</td>
                    <td className="px-2 py-1.5">{it.frequency}</td>
                    <td className="px-2 py-1.5">{it.duration}</td>
                    <td className="px-2 py-1.5 text-slate-600">{it.instructions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ol className="mt-2 space-y-2 sm:hidden">
              {items.map((it, i) => (
                <li key={it.item_id || i} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-[14px] font-bold">{i + 1}. {it.drug_name} {it.dosage && <span className="font-normal text-slate-500">· {it.dosage}</span>}</p>
                  <p className="text-[12.5px] text-slate-600">{[it.frequency, it.duration].filter(Boolean).join(' · ')}</p>
                  {it.instructions && <p className="text-[12px] text-slate-500">{it.instructions}</p>}
                </li>
              ))}
            </ol>
          </>
        )}

        {rx.advice && (
          <div className="mt-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-teal-700">Advice</p>
            <p className="whitespace-pre-line text-[14px]">{rx.advice}</p>
          </div>
        )}
        {rx.follow_up_date && <p className="mt-3 text-[13.5px]"><b>Follow-up on:</b> {fmtDate(rx.follow_up_date)}</p>}

        {/* Signature */}
        <div className="mt-6 flex justify-end">
          <div className="text-right">
            {signature ? <img src={signature} alt="Signature" onError={fail('sig')} className="ml-auto h-14 max-w-[180px] object-contain" /> : <div className="h-10" />}
            <DoctorLines doctor={doctor ? { name: doctor.name, qualification: doctor.qualification, registration_number: doctor.registration_number } : null} />
          </div>
        </div>
      </div>

      {footer && <img src={footer} alt="" onError={fail('footer')} className="mt-4 w-full object-contain px-4 sm:px-7" />}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 sm:px-7">
        <span className="text-[11px] text-slate-400">Rx #{paper?.ref || ''} · TapCure</span>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <DownloadRxPdf rxId={rx.prescription_id} />
        </div>
      </div>
    </article>
  )
}

/** The paper view in a full-screen pop-up (patient "View"). */
export function RxPaperModal({ rx, onClose, actions = null, badge = null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-6" onClick={onClose}>
      <div className="relative my-auto w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>{badge}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"><X className="h-5 w-5" /></button>
        </div>
        <RxPaper rx={rx} actions={actions} />
      </div>
    </div>
  )
}
