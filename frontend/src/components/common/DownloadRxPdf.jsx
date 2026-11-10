import { useState } from 'react'
import { Download } from 'lucide-react'
import { prescriptionsApi } from '../../api'
import { shortId } from '../../lib/shortId.js'
import { useI18n } from '../../i18n/index.jsx'

/**
 * "Download PDF" for one doctor-written prescription. The server builds the
 * PDF fresh on the practice's letterhead (GET /prescriptions/{id}/pdf), with
 * the same who-may-see-it rule as the prescription itself.
 *
 * Fetched as a blob rather than opened as a link: the API needs the access
 * token in a header, which a plain <a href> cannot send.
 */
export default function DownloadRxPdf({ rxId, className = '', compact = false }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const download = async (e) => {
    e?.stopPropagation()
    setBusy(true)
    setErr(null)
    try {
      const blob = await prescriptionsApi.pdf(rxId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prescription-${shortId(rxId)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e2) {
      setErr(e2.message || t('px.rx.pdfFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        title={t('px.rx.downloadPdf')}
        className={className || 'flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60'}
      >
        <Download className="h-3.5 w-3.5" />
        {busy ? t('px.rx.preparingPdf') : compact ? 'PDF' : t('px.rx.downloadPdf')}
      </button>
      {err && <span className="mt-0.5 text-[13px] text-red-500">{err}</span>}
    </span>
  )
}
