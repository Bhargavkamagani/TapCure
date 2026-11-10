import { useEffect, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { Link2, Check, X } from 'lucide-react'
import { patientsApi } from '../../api'
import { useI18n } from '../../i18n/index.jsx'

/**
 * The two questions a family link can put to this account, in one place.
 *
 * `requests` are waiting on me as the account holder — someone registered on a
 * number I saved for a dependent. `invitations` are waiting on me as the
 * dependent — a holder vouched for me and I decide whether their bookings for
 * me show up here.
 *
 * Both sides must agree before anything is shared, because a matching phone
 * number is only evidence: numbers get recycled and mistyped, and a wrong link
 * would show one family's appointments to a stranger. Renders nothing at all
 * when there is nothing to answer, so it stays invisible for most people.
 */
export default function FamilyLinkInbox({ onChanged }) {
  const { t, lang } = useI18n()
  const [requests, setRequests] = useState([])
  const [invitations, setInvitations] = useState([])
  const [busy, setBusy] = useState(null)

  const load = () => {
    patientsApi.linkRequests().then(setRequests).catch(() => setRequests([]))
    patientsApi.linkInvitations().then(setInvitations).catch(() => setInvitations([]))
  }
  useEffect(load, [])

  const act = async (memberId, fn) => {
    setBusy(memberId)
    try { await fn(memberId); load(); onChanged?.() } finally { setBusy(null) }
  }

  if (!requests.length && !invitations.length) return null

  const Row = ({ id, text, onYes, onNo }) => (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:flex-row sm:items-center">
      <p className="flex-1 text-[13px] leading-snug text-slate-600">{text}</p>
      <div className="flex shrink-0 gap-2">
        <button
          disabled={busy === id}
          onClick={() => act(id, onYes)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-green px-4 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> {t('ppage.linkAccept')}
        </button>
        <button
          disabled={busy === id}
          onClick={() => act(id, onNo)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-500 transition-colors hover:text-red-500 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> {t('ppage.linkDecline')}
        </button>
      </div>
    </div>
  )

  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-brand-navy">
        <Link2 className="h-4 w-4 text-brand-blue" /> {t('ppage.linkInboxTitle')}
      </h3>
      {requests.map((m) => (
        <Row
          key={`req-${m.member_id}`}
          id={m.member_id}
          text={t('ppage.linkAskHolder', { name: translitName(m.name, lang) })}
          onYes={patientsApi.linkApprove}
          onNo={patientsApi.linkDecline}
        />
      ))}
      {invitations.map((m) => (
        <Row
          key={`inv-${m.member_id}`}
          id={m.member_id}
          /* `holder_name` is who is ASKING. `m.name` is the dependent's own
             name — using that would say "you have listed you as family". */
          text={t('ppage.linkAskMember', { name: m.holder_name || t('ppage.linkSomeone') })}
          onYes={patientsApi.linkAccept}
          onNo={patientsApi.linkReject}
        />
      ))}
    </section>
  )
}
