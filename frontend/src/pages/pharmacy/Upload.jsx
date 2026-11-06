import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, ArrowLeft, ArrowRight, Check, Info,
} from 'lucide-react'
import { Card, PageHeading, ToolButton } from '../../components/hospital/ui.jsx'
import { pharmacyApi } from '../../api'
import { fmtExpiry } from '../../components/pharmacy/stockStatus.js'

const STEPS = ['Choose file', 'Match columns', 'Check & confirm']

// How the sheet meets the list that's already there.
const MODES = [
  {
    key: 'replace',
    title: 'Full stock sheet',
    hint: 'This sheet is my whole stock. Medicines missing from it are removed from the list.',
  },
  {
    key: 'merge',
    title: 'New purchases only',
    hint: 'Just the medicines that came in. Their quantities are ADDED to the shelf and nothing is removed.',
  },
]

function Stepper({ step }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((label, i) => {
        const done = step > i
        const current = step === i
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${
                done ? 'bg-emerald-500 text-white' : current ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-[13px] font-semibold ${current ? 'text-brand-navy' : 'text-slate-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-8 bg-slate-200" />}
          </div>
        )
      })}
    </div>
  )
}

function Stat({ tone, value, label, sub }) {
  const tones = {
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    red: 'border-red-100 bg-red-50 text-red-600',
    slate: 'border-slate-100 bg-slate-50 text-slate-600',
    blue: 'border-sky-100 bg-sky-50 text-sky-700',
  }
  return (
    <div className={`rounded-2xl border p-3.5 ${tones[tone]}`}>
      <p className="text-[22px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[12.5px] font-semibold">{label}</p>
      {sub && <p className="mt-0.5 text-[11.5px] opacity-80">{sub}</p>}
    </div>
  )
}

/**
 * Upload the pharmacy's stock sheet in three steps. Nothing is saved until
 * "Make this the live stock list" — preview reads the file and reports what
 * WOULD change, and confirm sends the same file again.
 */
export default function PharmacyUpload() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [map, setMap] = useState(null)
  const [step, setStep] = useState(0) // 0 choose · 1 match · 2 check · 3 done
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [showAllErrors, setShowAllErrors] = useState(false)
  const [mode, setMode] = useState('replace')

  const reset = () => {
    setFile(null)
    setPreview(null)
    setMap(null)
    setDone(null)
    setErr(null)
    setShowAllErrors(false)
    setStep(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const readFile = async (f, useMode = mode) => {
    if (!f) return
    setErr(null)
    setBusy(true)
    setFile(f)
    setShowAllErrors(false)
    try {
      const p = await pharmacyApi.preview(f, null, useMode)
      setPreview(p)
      setMap(p.column_map)
      // This hospital's remembered layout still fits → skip straight to checking.
      setStep(p.mapping_source === 'saved' && p.missing_required.length === 0 ? 2 : 1)
    } catch (e) {
      setErr(e.message)
      setFile(null)
      setStep(0)
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const applyMap = async () => {
    const missing = preview.sheet_fields.filter((f) => f.required && !map?.[f.key])
    if (missing.length) {
      setErr(`Choose the column for: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const p = await pharmacyApi.preview(file, map, mode)
      setPreview(p)
      setMap(p.column_map)
      setStep(2)
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  const confirm = async () => {
    setErr(null)
    setBusy(true)
    try {
      // The exact matching AND mode this preview was built with, so what goes
      // live is what was checked on screen.
      setDone(await pharmacyApi.confirm(file, preview.column_map, preview.mode))
      setStep(3)
    } catch (e) {
      setErr(e.message)
    }
    setBusy(false)
  }

  const downloadTemplate = async () => {
    try {
      const blob = await pharmacyApi.template()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'pharmacy-stock-template.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setErr(e.message)
    }
  }

  const bigRemoval = preview && preview.current_count > 0 && preview.will_remove >= Math.max(5, preview.current_count / 2)
  const fieldLabel = (key) => preview?.sheet_fields.find((f) => f.key === key)?.label || key
  const errorsShown = preview ? (showAllErrors ? preview.errors : preview.errors.slice(0, 5)) : []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeading title="Upload Stock" subtitle="Upload your stock sheet. Nothing changes until you confirm.">
        <ToolButton icon={Download} onClick={downloadTemplate}>Download template</ToolButton>
      </PageHeading>

      <Stepper step={step} />

      {err && (
        <div className="flex items-start gap-2 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {err}
        </div>
      )}

      {/* Step 1 — choose file */}
      {step === 0 && (
        <Card className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  mode === m.key ? 'border-teal-500 bg-teal-50/70' : 'border-slate-200 bg-white hover:border-teal-300'
                }`}
              >
                <p className="flex items-center gap-2 text-[13.5px] font-bold text-brand-navy">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    mode === m.key ? 'border-teal-600 bg-teal-600' : 'border-slate-300'
                  }`}>
                    {mode === m.key && <Check className="h-3 w-3 text-white" />}
                  </span>
                  {m.title}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">{m.hint}</p>
              </button>
            ))}
          </div>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files?.[0]) }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
              dragOver ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/40'
            } ${busy ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.csv"
              className="hidden"
              onChange={(e) => readFile(e.target.files?.[0])}
            />
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              {busy ? <FileSpreadsheet className="h-7 w-7 animate-pulse" /> : <Upload className="h-7 w-7" />}
            </span>
            <p className="text-[15px] font-bold text-brand-navy">
              {busy ? `Reading ${file?.name || 'your sheet'}…` : 'Drop your stock sheet here, or click to choose'}
            </p>
            <p className="text-[12.5px] text-slate-400">Excel (.xlsx) or CSV · up to 5 MB</p>
          </label>
          <div className="grid gap-2 text-[12.5px] text-slate-500 sm:grid-cols-3">
            <p className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> Use your own sheet — we'll match its columns. Only medicine name and quantity are required.</p>
            <p className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> Add a generic name column so doctors see substitutes when something is out of stock.</p>
            <p className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /> Add expiry dates and expired medicines are never shown to doctors as available.</p>
          </div>
        </Card>
      )}

      {/* Step 2 — match columns */}
      {step === 1 && preview && (
        <Card className="flex flex-col gap-4">
          <div>
            <h3 className="text-[16px] font-bold text-brand-navy">Match your sheet's columns</h3>
            <p className="mt-0.5 text-[13px] text-slate-500">
              We read <span className="font-semibold text-brand-navy">{preview.file_name}</span> — {preview.total_rows} rows, column names on row {preview.header_row}.
              Tell us which of your columns holds each detail. We'll remember this for next time.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {preview.sheet_fields.map((f) => (
              <div key={f.key} className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[190px_1fr] sm:gap-3">
                <label className="text-[13px] font-semibold text-slate-600">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={map?.[f.key] || ''}
                  onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value || null }))}
                  className={`field-input ${f.required && !map?.[f.key] ? 'border-red-300' : ''}`}
                >
                  <option value="">{f.required ? '— Choose a column —' : '— Not in my sheet —'}</option>
                  {preview.columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button onClick={reset} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> Choose another file
            </button>
            <button onClick={applyMap} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">
              {busy ? 'Checking…' : 'Next: check rows'} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Card>
      )}

      {/* Step 3 — check & confirm */}
      {step === 2 && preview && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat tone="green" value={preview.valid_count} label="Medicines ready" sub={preview.merged_count ? `${preview.merged_count} duplicate lines added together` : null} />
            <Stat tone={preview.error_count ? 'red' : 'slate'} value={preview.error_count} label="Rows with problems" sub={preview.error_count ? 'These will be skipped' : 'None'} />
            <Stat tone="slate" value={preview.expired_count} label="Expired" sub="Saved, never shown as available" />
            <Stat
              tone="blue"
              value={preview.valid_count}
              label={`Your list: ${preview.current_count} → ${preview.valid_count}`}
              sub={`${preview.will_add} new · ${preview.will_update} updated · ${preview.will_remove} removed`}
            />
          </div>

          {bigRemoval && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This will remove <b>{preview.will_remove}</b> of the <b>{preview.current_count}</b> medicines in your current list.
                A new upload replaces the whole list — make sure this is your complete stock sheet.
              </span>
            </div>
          )}

          {/* Composition is what links brands of the same tablet (Dolo 650 = Calpol 650).
              Not required — the upload still works — but without it doctors get no
              other-brand suggestions, and most billing software can export it. */}
          {preview.valid_count > 0 && (!preview.composition_mapped || preview.missing_composition > 0) && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {!preview.composition_mapped ? (
                  <>
                    <b>Your sheet has no composition / generic column.</b> When a medicine is out of stock, doctors
                    won&apos;t be shown other brands of the same tablet (e.g. Calpol 650 for Dolo 650).
                  </>
                ) : (
                  <>
                    <b>{preview.missing_composition} of {preview.valid_count} medicines have no composition.</b> Doctors
                    won&apos;t be shown other brands of the same tablet for those.
                  </>
                )}
                {' '}If your billing software can export the composition (salt), add that column and upload again.
                You can still upload this sheet as it is.
              </span>
            </div>
          )}

          {/* Which way this sheet is being applied — switchable here, and the
              preview is read again so the numbers above always match. */}
          <Card className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px]">
            <span className="font-semibold text-slate-600">Applying as:</span>
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                disabled={busy}
                onClick={() => { setMode(m.key); readFile(file, m.key) }}
                className={`rounded-lg border px-2.5 py-1 font-semibold transition-colors ${
                  preview.mode === m.key ? 'border-teal-500 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'
                }`}
              >
                {m.title}
              </button>
            ))}
            <span className="text-slate-500">
              {preview.mode === 'merge'
                ? 'Quantities are ADDED to the shelf; nothing is removed.'
                : 'This sheet becomes the whole list; medicines missing from it are removed.'}
            </span>
          </Card>

          {preview.mode === 'merge' && preview.will_update > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>{preview.will_update}</b> of these medicines are already on your list, and their quantities will be
                <b> added on top</b>. Use this only for a sheet of newly purchased stock — for a full stock report,
                switch to <b>Full stock sheet</b> above, or the counts will double.
              </span>
            </div>
          )}

          <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate-500">
            <span className="font-semibold text-slate-600">Columns used:</span>
            {Object.entries(preview.column_map).filter(([, col]) => col).map(([key, col]) => (
              <span key={key}>{fieldLabel(key)} ← <span className="font-semibold text-brand-navy">{col}</span></span>
            ))}
            <button onClick={() => { setErr(null); setStep(1) }} className="ml-auto font-semibold text-brand-blue hover:underline">
              Change
            </button>
          </Card>

          {preview.error_count > 0 && (
            <Card className="border-red-100">
              <p className="mb-2 text-[13px] font-bold text-red-600">Rows we'll skip — fix them in your sheet and upload again if needed</p>
              <ul className="space-y-1 text-[12.5px] text-slate-600">
                {errorsShown.map((e, i) => (
                  <li key={i}><span className="font-semibold text-slate-800">Row {e.row}:</span> {e.message}</li>
                ))}
              </ul>
              {preview.errors.length > 5 && (
                <button onClick={() => setShowAllErrors((v) => !v)} className="mt-2 text-[12.5px] font-semibold text-brand-blue hover:underline">
                  {showAllErrors ? 'Show fewer' : `Show all ${preview.errors.length}${preview.error_count > preview.errors.length ? ` of ${preview.error_count}` : ''}`}
                </button>
              )}
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <p className="border-b border-slate-100 px-4 py-2.5 text-[13px] font-bold text-brand-navy">
              First {preview.sample.length} of {preview.valid_count} medicines
            </p>
            <div className="max-h-[360px] overflow-auto">
              <table className="w-full min-w-[760px] text-left text-[12.5px]">
                <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Row</th>
                    <th className="px-3 py-2">Medicine</th>
                    <th className="px-3 py-2">Generic</th>
                    <th className="px-3 py-2">Strength</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">Expiry</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((r) => (
                    <tr key={`${r.row}-${r.batch_no}`} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-400">{r.row}</td>
                      <td className="px-3 py-2 font-semibold text-brand-navy">{r.medicine_name}</td>
                      <td className="px-3 py-2 text-slate-500">{r.generic_name || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.strength || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.batch_no || '—'}</td>
                      <td className={`px-3 py-2 ${r.expired ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                        {fmtExpiry(r.expiry_date)}{r.expired && ' (expired)'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-brand-navy">{r.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap justify-between gap-2">
            <button onClick={reset} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" /> Choose another file
            </button>
            <button
              onClick={confirm}
              disabled={busy || preview.valid_count === 0}
              className="flex items-center gap-2 rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? 'Saving…' : preview.mode === 'merge'
                ? `Add to stock (${preview.valid_count})`
                : `Make this the live stock list (${preview.valid_count})`}
            </button>
          </div>
        </>
      )}

      {/* Done */}
      {step === 3 && done && (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <p className="text-[18px] font-extrabold text-brand-navy">Stock list is live</p>
          <p className="text-[13px] text-slate-500">
            {done.active_count} medicines are now visible to doctors while they prescribe.
          </p>
          <p className="text-[12.5px] text-slate-400">
            {done.added} new · {done.updated} updated · {done.removed} removed
            {done.skipped_rows ? ` · ${done.skipped_rows} rows skipped` : ''}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => navigate('/pharmacy-dashboard')} className="rounded-xl bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:bg-brand-blueDark">
              View stock list
            </button>
            <button onClick={reset} className="rounded-xl border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Upload another
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
