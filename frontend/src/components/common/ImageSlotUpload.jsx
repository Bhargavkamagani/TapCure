import { useState } from 'react'
import { fileUrl } from '../../api'

/**
 * A wide image slot with Upload / Change / Remove — the letterhead header and
 * footer, and the doctor's signature. JPG or PNG up to 3 MB, the same limit the
 * server enforces (services/storage.py MAX_IMAGE_MB).
 */
export default function ImageSlotUpload({ title, hint, emptyText, url, aspect = 'aspect-[6/1]', onUpload, onRemove, contain = true }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [broken, setBroken] = useState(false)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes((file.type || '').toLowerCase())) { setError('Please choose a JPG or PNG image'); return }
    if (file.size > 3 * 1024 * 1024) { setError('The image must be 3 MB or smaller'); return }
    const fd = new FormData()
    fd.append('file', file)
    setBusy(true); setError(null)
    try { await onUpload(fd); setBroken(false) } catch (err) { setError(err.message || 'Could not upload the image') }
    setBusy(false)
  }
  const remove = async () => {
    setBusy(true); setError(null)
    try { await onRemove() } catch (err) { setError(err.message || 'Could not remove the image') }
    setBusy(false)
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-slate-700">{title}</p>
      <div className="overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50/60">
        <div className={`relative ${aspect} w-full bg-white`}>
          {url && !broken
            ? <img src={fileUrl(url)} alt={title} onError={() => setBroken(true)} className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'}`} />
            : <div className="grid h-full w-full place-items-center px-3 text-center text-[12px] text-slate-400">{emptyText}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-3 py-2">
          <label className={`inline-flex cursor-pointer items-center rounded-lg bg-brand-blue px-3 py-1.5 text-[13px] font-bold text-white hover:bg-brand-blueDark ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? 'Saving…' : url ? 'Change' : 'Upload'}
            <input type="file" accept="image/png,image/jpeg" onChange={pick} className="sr-only" />
          </label>
          {url && (
            <button type="button" disabled={busy} onClick={remove} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Remove</button>
          )}
          {hint && <span className="text-[11.5px] text-slate-400">{hint}</span>}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
