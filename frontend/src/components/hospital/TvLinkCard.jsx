import { useEffect, useState } from 'react'
import { Tv, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react'
import { Card } from './ui.jsx'
import { displayApi } from '../../api'
import { useDialog } from '../common/DialogProvider.jsx'

/**
 * The waiting-room TV link for this hospital. Made once (the first time this box
 * loads) and then valid every day; "Make new link" replaces it and the old one
 * stops working on the TV's next refresh.
 */
export default function TvLinkCard({ hospitalId }) {
  const dialog = useDialog()
  const [link, setLink] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!hospitalId) return undefined
    let active = true
    displayApi.link(hospitalId)
      .then((l) => { if (active) setLink(l) })
      .catch((e) => { if (active) setError(e.message || 'Could not load the TV link') })
    return () => { active = false }
  }, [hospitalId])

  const url = link ? `${window.location.origin}${link.path}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy — select the link and copy it by hand.')
    }
  }

  const renew = async () => {
    const ok = await dialog.confirm({
      title: 'Make a new TV link?',
      message: 'The current link stops working straight away. Any TV showing it will need the new link opened once.',
      confirmLabel: 'Make new link',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try { setLink(await displayApi.renew(hospitalId)) } catch (e) { setError(e.message || 'Could not make a new link') }
    setBusy(false)
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><Tv className="h-5 w-5" /></span>
          <div className="leading-tight">
            <p className="text-[15px] font-bold text-brand-navy">TV display link</p>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Open this on the waiting-room TV. It shows every doctor's live queue and keeps working every day. Token numbers only — no patient names.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input readOnly value={url || 'Loading…'} onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12.5px] text-slate-700 outline-none" />
        <button type="button" onClick={copy} disabled={!url}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-3 py-2 text-[13px] font-bold text-white hover:bg-brand-blueDark disabled:opacity-50">
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
        </button>
        <a href={url || undefined} target="_blank" rel="noreferrer"
          className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 ${url ? '' : 'pointer-events-none opacity-50'}`}>
          <ExternalLink className="h-4 w-4" /> Open
        </a>
        <button type="button" onClick={renew} disabled={busy || !url}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> {busy ? 'Making…' : 'Make new link'}
        </button>
      </div>
      {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
    </Card>
  )
}
