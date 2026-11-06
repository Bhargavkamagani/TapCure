import { useState } from 'react'
import { Trash2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { authApi } from '../../api'
import { endSession } from '../../api/client.js'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Warning → OTP → deleted. Used in two places (both required by Google Play /
 * the App Store): the patient Profile (`loggedIn` — the OTP goes to the
 * account's own number) and the public /delete-account page (phone typed in).
 */
export default function DeleteAccountFlow({ loggedIn = false, onCancel }) {
  const { t } = useI18n()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(null)      // { last4, dev_otp? }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sendOtp = async () => {
    setError('')
    if (!loggedIn && !/^\d{10}$/.test(phone)) { setError(t('adel.phoneReq')); return }
    setBusy(true)
    try {
      const r = await authApi.deleteAccountOtp(loggedIn ? undefined : phone)
      setSent({ last4: r.phone_last4, dev: r.dev_otp })
    } catch (e) {
      setError(e.message || t('adel.failed'))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async () => {
    setError('')
    if (!otp.trim()) { setError(t('adel.otpReq')); return }
    setBusy(true)
    try {
      if (loggedIn) {
        await authApi.deleteMyAccount(otp.trim())
        // Signed out everywhere on the server already; clear this browser too.
        await endSession()
        window.location.replace('/delete-account?done=1')
        return
      }
      await authApi.deleteAccountPublic(phone, otp.trim())
      window.location.replace('/delete-account?done=1')
    } catch (e) {
      setError(e.message || t('adel.failed'))
      setBusy(false)
    }
  }

  const digits = (v) => v.replace(/\D/g, '')
  const input = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] tracking-wide outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100'

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
        <p className="mb-2 flex items-center gap-2 text-[14px] font-bold text-red-700">
          <Trash2 className="h-4 w-4" /> {t('adel.deletedHead')}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-700">
          <li>{t('adel.del1')}</li>
          <li>{t('adel.del2')}</li>
          <li>{t('adel.del3')}</li>
        </ul>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-1 flex items-center gap-2 text-[14px] font-bold text-brand-navy">
          <ShieldCheck className="h-4 w-4 text-teal-600" /> {t('adel.keptHead')}
        </p>
        <p className="text-[13px] text-slate-600">{t('adel.kept')}</p>
      </div>
      <p className="flex items-start gap-2 text-[13px] font-medium text-amber-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t('adel.cannotUndo')}
      </p>

      {!loggedIn && (
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-brand-navy">
          {t('adel.phone')}
          <input className={input} inputMode="numeric" maxLength={10} value={phone} disabled={!!sent}
                 onChange={(e) => setPhone(digits(e.target.value))} placeholder="9876543210" />
        </label>
      )}

      {sent && (
        <>
          <p className="text-[13px] text-teal-700">{t('adel.otpSent', { last4: sent.last4 })}{sent.dev ? ` (dev: ${sent.dev})` : ''}</p>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-brand-navy">
            {t('adel.otp')}
            <input className={input} inputMode="numeric" maxLength={8} value={otp} autoFocus
                   onChange={(e) => setOtp(digits(e.target.value))} placeholder="••••••" />
          </label>
        </>
      )}

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:border-slate-300">
            {t('adel.cancel')}
          </button>
        )}
        {sent && (
          <button type="button" onClick={sendOtp} disabled={busy}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:text-brand-navy">
            {t('adel.resend')}
          </button>
        )}
        {!sent ? (
          <button type="button" onClick={sendOtp} disabled={busy}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {busy ? t('adel.sending') : t('adel.sendOtp')}
          </button>
        ) : (
          <button type="button" onClick={confirm} disabled={busy}
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            <Trash2 className="h-4 w-4" /> {busy ? t('adel.deleting') : t('adel.confirm')}
          </button>
        )}
      </div>
    </div>
  )
}
