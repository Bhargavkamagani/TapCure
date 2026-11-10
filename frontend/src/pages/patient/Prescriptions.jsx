import { useEffect, useRef, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, FlaskConical, Eye, Download, Upload, ShieldCheck, X, Pill, CalendarPlus, Camera, BellRing, BellOff, Clock } from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { prescriptionsApi, patientsApi, medicineApi, fileUrl } from '../../api'
import { useI18n } from '../../i18n/index.jsx'
import { useDialog } from '../../components/common/DialogProvider.jsx'
import DownloadRxPdf from '../../components/common/DownloadRxPdf.jsx'
import { RxPaperModal } from '../../components/common/RxPaper.jsx'

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const TAB_KEYS = {
  Prescriptions: 'ppage.tabPrescriptions',
  'Lab Results': 'ppage.tabLabResults',
  // A prescription whose reminders are running lives here instead, so the
  // Prescriptions tab stays the list of things still needing a decision.
  'Medicine Reminders': 'pm.medicineReminders',
}
const TABS = ['Prescriptions', 'Lab Results', 'Medicine Reminders']

/* Short slugs so a link can name a tab without a URL-encoded space in it —
   "?tab=reminders" rather than "?tab=Medicine%20Reminders". Anything not in
   here falls back to Prescriptions, so a stale or hand-edited URL cannot put
   the page into a tab that does not exist. */
const TAB_SLUGS = { prescriptions: 'Prescriptions', lab: 'Lab Results', reminders: 'Medicine Reminders' }

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

// Map an uploaded document_type → one of our display tabs.
const DOC_TYPE_TAB = { lab_report: 'Lab Results', prescription: 'Prescriptions' }

function PatientUploadModal({ patient, onClose, onUploaded }) {
  const [documentType, setDocumentType] = useState('prescription')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const cameraRef = useRef(null)
  const { t } = useI18n()

  const submit = async () => {
    if (!file) return setError(t('px.rx.needFile'))
    if (!description.trim()) return setError(t('px.rx.needDesc'))
    setSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('patient_id', patient.patient_id)
      fd.append('document_type', documentType)
      fd.append('description', description.trim())
      fd.append('file', file)
      await patientsApi.uploadDocument(fd)
      await onUploaded()
      onClose()
    } catch (e) {
      setError(e.message || t('px.rx.uploadFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-[17px] font-bold text-brand-navy">{t('px.rx.uploadTitle')}</h3>
            <p className="mt-0.5 text-[13px] text-slate-500">{t('px.rx.uploadPrivate')}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]">
            <option value="prescription">{t('ppage.evtRx')}</option>
            <option value="lab_report">{t('px.labReport')}</option>
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3}
            placeholder={t('px.rx.descPlaceholder')}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-[13px]" />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] font-semibold text-brand-blue">
              <Camera className="h-4 w-4" /> {t('px.takePhoto')}
            </button>
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] font-semibold text-brand-blue">
              <Upload className="h-4 w-4" /> {t('px.chooseFile')}
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          {file && <p className="truncate rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">{t('px.selectedFile', { name: file.name })}</p>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>}
          <button type="button" onClick={submit} disabled={saving} className="w-full rounded-xl bg-brand-blue px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60">
            {saving ? t('pcommon.saving') : t('px.rx.saveSecurely')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Detail modal for a single prescription (diagnosis + medicines + advice). */
function RxModal({ rx, onClose, t }) {
  const { lang } = useI18n()   // names shown in the reader's script
  const navigate = useNavigate()

  // Book the follow-up with the SAME doctor (and same person, if it was for a
  // family member). Pre-fill the follow-up date only when it's today or later —
  // a past date can't be booked, so we let them pick a fresh one.
  const bookFollowUp = () => {
    const params = new URLSearchParams({ doctor: String(rx.doctor_id) })
    if (rx.family_member_id) params.set('for', String(rx.family_member_id))
    if (rx.follow_up_date && rx.follow_up_date >= todayISO()) params.set('date', rx.follow_up_date)
    onClose()
    navigate(`/patient-dashboard/appointments/new?${params.toString()}`)
  }

  return (
    <RxPaperModal
      rx={rx}
      onClose={onClose}
      badge={rx.family_member_name ? (
        <span className="inline-block rounded-full bg-purple-50 px-2.5 py-1 text-[13px] font-semibold text-purple-600">{t('pm.forPerson', { name: translitName(rx.family_member_name, lang) })}</span>
      ) : null}
      actions={rx.follow_up_date ? (
        <button
          onClick={bookFollowUp}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-blueDark"
        >
          <CalendarPlus className="h-3.5 w-3.5" /> {t('ppage.bookFollowUp')}
        </button>
      ) : null}
    />
  )
}

/** Health records & prescriptions, filterable by type. */
function Prescriptions() {
  const { t, lang } = useI18n()
  const dialog = useDialog()
  const [searchParams, setSearchParams] = useSearchParams()
  // Opened from a link that named a tab ("View all" on Today's Medicines), or
  // Prescriptions when it didn't.
  const [tab, setTab] = useState(
    () => TAB_SLUGS[(searchParams.get('tab') || '').toLowerCase()] || 'Prescriptions',
  )
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [active, setActive] = useState(null)     // prescription open in the modal
  const [me, setMe] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  // Reminder courses, so each prescription can offer "Set reminders" only when
  // there is actually something to start.
  const [courses, setCourses] = useState([])
  const [startingRx, setStartingRx] = useState(null)
  /* Which prescription's time panel is open, and the draft times keyed by
     course_id. Keyed rather than a flat list because one prescription can hold
     several medicines, each on its own schedule — the dashboard card edits a
     single medicine, this edits all of them together. */
  const [timesFor, setTimesFor] = useState(null)
  const [timeDraft, setTimeDraft] = useState({})

  const load = async () => {
    setLoading(true)
    setErr(null)
    try {
      const patient = await patientsApi.me()
      setMe(patient)
      const [rxs, docs, crs] = await Promise.all([
        prescriptionsApi.list(),
        patient ? patientsApi.documents(patient.patient_id) : Promise.resolve([]),
        // Never let the reminder lookup break the page — the records are the
        // point of this screen, the button is a bonus.
        medicineApi.courses().catch(() => []),
      ])
      setCourses(Array.isArray(crs) ? crs : [])
      const rxItems = rxs.map((r) => ({
        key: `rx-${r.prescription_id}`,
        kind: 'rx',
        type: 'Prescriptions',
        title: t('px.rx.prescribedBy', { name: translitName(r.doctor_name, lang) || t('ppage.doctor') }),
        sub: [r.doctor_specialty, translitName(r.hospital_name, lang)].filter(Boolean).join(' · ') || t('px.rx.doctorIssued'),
        forMember: r.family_member_name || null,
        date: r.created_at,
        rx: r,
      }))
      const docItems = (docs || []).map((d) => ({
        key: `doc-${d.document_id}`,
        kind: 'lab',
        type: DOC_TYPE_TAB[d.document_type] || null,
        title: d.file_name || t('px.document'),
        sub: d.document_type === 'lab_report' && d.hospital_name
          ? [d.description, translitName(d.hospital_name, lang), d.doctor_name && translitName(`Dr. ${d.doctor_name}`, lang)].filter(Boolean).join(' · ')
          : (d.description || (d.document_type === 'prescription' ? t('px.rx.privateUpload') : (d.document_type || 'document').replace('_', ' '))),
        date: d.consultation_date || d.created_at,
        url: d.file_url,
      }))
      setItems([...rxItems, ...docItems.filter((d) => d.type)].sort((a, b) => new Date(b.date) - new Date(a.date)))
      const requestedId = searchParams.get('open')
      if (requestedId) {
        const requested = requestedId && rxs.find((rx) => String(rx.prescription_id) === requestedId)
        if (requested) setActive(requested)
      }
    } catch (e) {
      setErr(e.message || t('px.rx.couldNotLoad'))
    }
    setLoading(false)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Which tab a row belongs in RIGHT NOW. Computed at render rather than baked
     into `items` at load, so a prescription hops between Prescriptions and
     Medicine Reminders the moment you start or stop it — baking it in would
     leave the row where it was until a full page reload. */
  // A prescription always stays in Prescriptions — it is the record of what the
  // doctor wrote — and is ALSO listed under Medicine Reminders while running.
  const inTab = (p, which) =>
    p.type === which
    || (which === 'Medicine Reminders' && p.kind === 'rx' && reminderState(p.rx.prescription_id) === 'running')

  /* What the reminder button should say for one prescription.
     'start'   — it has medicines not yet running (or stopped, which the API
                 also accepts), so offer to start them.
     'running' — already active; show a quiet confirmation, not a button.
     null      — no schedulable medicine on this prescription at all. Offering
                 anything here would 409 with "no medicine we can remind for",
                 which is worse than showing nothing. */
  const reminderState = (prescriptionId) => {
    const mine = courses.filter((c) => c.prescription_id === prescriptionId)
    if (!mine.length) return null
    if (mine.some((c) => c.status === 'active')) return 'running'
    if (mine.some((c) => c.status === 'awaiting_start' || c.status === 'stopped')) return 'start'
    return null   // all completed — nothing left to remind about
  }

  // One tap starts every medicine on that prescription; nobody wants to
  // confirm five drugs one at a time.
  const startRx = async (prescriptionId) => {
    setStartingRx(prescriptionId)
    setErr(null)
    try {
      await medicineApi.start({ prescription_id: prescriptionId })
      const crs = await medicineApi.courses().catch(() => [])
      setCourses(Array.isArray(crs) ? crs : [])
    } catch (e) {
      setErr(e.message || t('px.couldNotStartReminders'))
    } finally {
      setStartingRx(null)
    }
  }

  /** Medicines on this prescription the patient hasn't started — typically one
   *  the doctor added after the others were already running. */
  const newCourses = (prescriptionId) =>
    courses.filter((c) => c.prescription_id === prescriptionId && c.status === 'awaiting_start')

  const startNew = async (prescriptionId) => {
    setStartingRx(prescriptionId)
    setErr(null)
    try {
      for (const c of newCourses(prescriptionId)) await medicineApi.start({ course_id: c.course_id })
      const crs = await medicineApi.courses().catch(() => [])
      setCourses(Array.isArray(crs) ? crs : [])
    } catch (e) {
      setErr(e.message || t('px.couldNotStartReminders'))
    } finally {
      setStartingRx(null)
    }
  }

  /** Every running medicine on one prescription — the unit the panel edits. */
  const runningCourses = (prescriptionId) =>
    courses.filter((c) => c.prescription_id === prescriptionId && c.status === 'active')

  const openTimes = (prescriptionId) => {
    setErr(null)
    if (timesFor === prescriptionId) { setTimesFor(null); return }   // tap again to close
    const draft = {}
    for (const c of runningCourses(prescriptionId)) {
      draft[c.course_id] = (c.times_csv || '').split(',').filter(Boolean)
    }
    setTimeDraft(draft)
    setTimesFor(prescriptionId)
  }

  /* Saved per medicine, because that is what the API takes and because a
     prescription's medicines genuinely differ — a twice-daily tablet and a
     bedtime one cannot share a single set of boxes. */
  const saveTimes = async (prescriptionId) => {
    setStartingRx(prescriptionId)
    setErr(null)
    try {
      for (const c of runningCourses(prescriptionId)) {
        const times = timeDraft[c.course_id]
        if (times?.length) await medicineApi.setTimes(c.course_id, times)
      }
      const crs = await medicineApi.courses().catch(() => [])
      setCourses(Array.isArray(crs) ? crs : [])
      setTimesFor(null)
    } catch (e) {
      // The API's own message is specific ("needs 2 time(s)") — keep it.
      setErr(e.message || t('px.couldNotChangeTimes'))
    } finally {
      setStartingRx(null)
    }
  }

  /* Stopping is per-course on the API, so a prescription means every running
     course it produced. Confirmed first, matching how the dashboard card does
     it — this is reversible, but it should never happen on a stray tap. */
  const stopRx = async (prescriptionId) => {
    const running = courses.filter(
      (c) => c.prescription_id === prescriptionId && c.status === 'active',
    )
    if (!running.length) return
    const ok = await dialog.confirm({
      title: t('pm.stopRxTitle'),
      message: t('pm.stopRxBody'),
      confirmLabel: t('pm.stop'),
    })
    if (!ok) return
    setStartingRx(prescriptionId)
    setErr(null)
    try {
      for (const c of running) await medicineApi.stop(c.course_id)
      const crs = await medicineApi.courses().catch(() => [])
      setCourses(Array.isArray(crs) ? crs : [])
    } catch (e) {
      setErr(e.message || t('px.couldNotStopReminders'))
    } finally {
      setStartingRx(null)
    }
  }

  /* Declared AFTER the helpers above, deliberately. `inTab` calls
     `reminderState`, and these are const arrow functions — so filtering the
     list any earlier than this reads `reminderState` before it is initialised
     and throws on every render, blanking the page. A build cannot catch it:
     the syntax is perfectly valid. */
  const shown = items.filter((p) => inTab(p, tab))

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('ppage.rxTitle')} subtitle={t('ppage.rxSubtitle')}>
        <ToolButton icon={Upload} tone="primary" onClick={() => setUploadOpen(true)} disabled={!me}>
          {t('ppage.uploadNew')}
        </ToolButton>
      </PageHeading>

      <Card className="p-5">
        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100">
          {TABS.map((tabName) => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`-mb-px border-b-2 px-3 pb-2 text-[13px] font-semibold transition-colors ${
                tab === tabName ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-500 hover:text-brand-navy'
              }`}
            >
              {t(TAB_KEYS[tabName] || 'pcommon.noData')}
            </button>
          ))}
        </div>

        {err && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-600">{err}</p>}

        {loading ? (
          <p className="py-8 text-center text-[13px] text-slate-400">{t('pm.loading')}</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((p) => {
              const Icon = p.kind === 'lab' ? FlaskConical : FileText
              return (
                <li key={p.key} className="rounded-xl border border-slate-100 p-3">
                  {/* Column, not a row: the time panel opens underneath. As a
                      further flex child it would sit beside the buttons. */}
                  <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-blueLight text-brand-blue">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="flex items-center gap-2 truncate text-[14px] font-bold text-brand-navy">
                      {p.title}
                      {p.forMember && (
                        <span className="shrink-0 rounded-full bg-purple-50 px-2 py-0.5 text-[13px] font-semibold text-purple-600">{t('pm.forPerson', { name: translitName(p.forMember, lang) })}</span>
                      )}
                    </p>
                    <p className="truncate text-[13px] text-slate-400">{p.sub} · {TAB_KEYS[p.type] ? t(TAB_KEYS[p.type]) : p.type}</p>
                  </div>
                  <span className="hidden text-[13px] text-slate-400 sm:block">{fmtDate(p.date)}</span>
                  <div className="flex items-center gap-2">
                    {p.kind === 'rx' ? (
                      <>
                        {/* Shown only when this prescription actually has
                            medicines we can remind for — most older ones have
                            none, and a button that always 409s is worse than
                            no button. */}
                        {reminderState(p.rx.prescription_id) === 'start' && (
                          <button
                            onClick={() => startRx(p.rx.prescription_id)}
                            disabled={startingRx === p.rx.prescription_id}
                            className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[13px] font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-60"
                          >
                            <BellRing className="h-3.5 w-3.5" />
                            {startingRx === p.rx.prescription_id ? '…' : t('pm.setReminders')}
                          </button>
                        )}
                        {reminderState(p.rx.prescription_id) === 'running' && newCourses(p.rx.prescription_id).length > 0 && (
                          <button
                            onClick={() => startNew(p.rx.prescription_id)}
                            disabled={startingRx === p.rx.prescription_id}
                            className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[13px] font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-60"
                          >
                            <BellRing className="h-3.5 w-3.5" />
                            {startingRx === p.rx.prescription_id ? '…' : t('pm.startNewReminders', { n: newCourses(p.rx.prescription_id).length })}
                          </button>
                        )}
                        {reminderState(p.rx.prescription_id) === 'running' && (
                          <>
                            <button
                              onClick={() => openTimes(p.rx.prescription_id)}
                              title={t('pm.changeTimes')}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                                timesFor === p.rx.prescription_id
                                  ? 'border-brand-blue bg-brand-blueLight text-brand-blue'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <Clock className="h-3.5 w-3.5" /> {t('pm.changeTimes')}
                            </button>
                            <button
                              onClick={() => stopRx(p.rx.prescription_id)}
                              disabled={startingRx === p.rx.prescription_id}
                              title={t('pm.stopRxTitle')}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[13px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                            >
                              <BellOff className="h-3.5 w-3.5" />
                              {startingRx === p.rx.prescription_id ? '…' : t('pm.stop')}
                            </button>
                          </>
                        )}
                        <button onClick={() => setActive(p.rx)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[13px] font-semibold text-brand-blue hover:bg-brand-blueLight/40">
                          <Eye className="h-3.5 w-3.5" /> {t('pcommon.view')}
                        </button>
                        <DownloadRxPdf rxId={p.rx.prescription_id} compact />
                      </>
                    ) : (
                      <>
                        <a href={fileUrl(p.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[13px] font-semibold text-brand-blue hover:bg-brand-blueLight/40">
                          <Eye className="h-3.5 w-3.5" /> {t('pcommon.view')}
                        </a>
                        <a href={fileUrl(p.url)} download className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
                          <Download className="h-3.5 w-3.5" /> {t('pcommon.download')}
                        </a>
                      </>
                    )}
                  </div>
                  </div>

                  {/* Time panel — one line per running medicine, because a
                      prescription's medicines genuinely differ: a twice-daily
                      tablet and a bedtime one cannot share one set of boxes. */}
                  {p.kind === 'rx' && timesFor === p.rx.prescription_id && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      {runningCourses(p.rx.prescription_id).map((c) => (
                        <div key={c.course_id} className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="min-w-[7rem] text-[13.5px] font-semibold text-brand-navy">
                            {c.drug_name}
                          </span>
                          {(timeDraft[c.course_id] || []).map((val, i) => (
                            <input
                              key={i}
                              type="time"
                              value={val}
                              onChange={(e) =>
                                setTimeDraft((d) => ({
                                  ...d,
                                  [c.course_id]: d[c.course_id].map((x, j) => (j === i ? e.target.value : x)),
                                }))
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13.5px] font-semibold text-brand-navy outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10"
                            />
                          ))}
                          {c.food_note && <span className="text-[13px] text-slate-400">{c.food_note}</span>}
                        </div>
                      ))}
                      {newCourses(p.rx.prescription_id).map((c) => (
                        <div key={c.course_id} className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="min-w-[7rem] text-[13.5px] font-semibold text-brand-navy">{c.drug_name}</span>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-semibold text-amber-700">{t('pm.notStartedYet')}</span>
                        </div>
                      ))}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => saveTimes(p.rx.prescription_id)}
                          disabled={startingRx === p.rx.prescription_id}
                          className="rounded-lg bg-brand-blue px-3 py-1.5 text-[13px] font-bold text-white hover:bg-brand-blueDark disabled:opacity-60"
                        >
                          {startingRx === p.rx.prescription_id ? '…' : t('pm.save')}
                        </button>
                        <button
                          onClick={() => setTimesFor(null)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          {t('pm.cancel')}
                        </button>
                        <span className="text-[13px] text-slate-400">{t('pm.timesHint')}</span>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
            {shown.length === 0 && (
              <li className="py-8 text-center text-[13px] text-slate-400">
                {tab === 'Medicine Reminders' ? t('pm.noRemindersYet') : t('ppage.noDocsCategory')}
              </li>
            )}
          </ul>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-[13.5px] text-green-700">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {t('ppage.dataSecure')}
        </div>
      </Card>

      {active && <RxModal rx={active} onClose={() => { setActive(null); setSearchParams({}, { replace: true }) }} t={t} />}
      {uploadOpen && me && <PatientUploadModal patient={me} onClose={() => setUploadOpen(false)} onUploaded={load} />}
    </div>
  )
}

export default Prescriptions
