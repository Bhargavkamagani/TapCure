import { useState } from 'react'
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react'
import { authApi } from '../../api'
import { Banner, PasswordInput, TextInput } from '../common/FormControls.jsx'
import { emailTypoSuggestion } from '../../lib/emailTypos.js'
import { useI18n } from '../../i18n/index.jsx'

export default function ForgotPasswordFlow({ portal, onBack }) {
  const { t } = useI18n()
  const [step, setStep] = useState('request')
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const requestOtp = async (event) => {
    event?.preventDefault?.()
    const value = identifier.trim()
    if (!value) { setError(t('ax.fp.enterEmail')); return }
    if (/^\d{10}$/.test(value)) { setError(t('ax.fp.emailOnly')); return }
    if (!/^\S+@\S+\.\S+$/.test(value)) { setError(t('ax.fp.invalidEmail')); return }
    // Worth catching on the RESET path too: a reset code sent to a misspelt
    // address is silently lost, and the person is left locked out with no
    // indication of why nothing arrived.
    const typo = emailTypoSuggestion(value)
    if (typo) { setError(t('pm.emailTypo', { d: typo })); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await authApi.forgotPassword(value, portal)
      setIdentifier(value); setStep('reset')
      setNotice(result.dev_otp ? t('ax.fp.devOtp', { otp: result.dev_otp }) : t('ax.fp.codeSent'))
    } catch (e) { setError(e.message || t('ax.fp.requestFailed')) }
    finally { setBusy(false) }
  }

  const resetPassword = async (event) => {
    event.preventDefault()
    if (!/^\d{4,8}$/.test(otp.trim())) { setError(t('ax.fp.enterOtp')); return }
    if (password.length < 8) { setError(t('ax.fp.min6')); return }
    if (password !== confirm) { setError(t('ax.fp.mismatch')); return }
    setBusy(true); setError('')
    try {
      await authApi.resetPassword(identifier, otp.trim(), password)
      setStep('done'); setNotice(t('ax.fp.resetDone'))
    } catch (e) { setError(e.message || t('ax.fp.resetFailed')) }
    finally { setBusy(false) }
  }

  if (step === 'done') return <div className="space-y-4"><Banner type="success">{notice}</Banner><button type="button" onClick={onBack} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark">{t('ax.fp.backToLogin')}</button></div>

  return <form onSubmit={step === 'request' ? requestOtp : resetPassword} className="space-y-3">
    <button type="button" onClick={onBack} className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"><ArrowLeft className="h-4 w-4" /> {t('ax.fp.backToLogin')}</button>
    <div><h3 className="text-lg font-bold text-brand-navy">{t('ax.fp.title')}</h3><p className="mt-1 text-[13px] text-slate-500">{step === 'request' ? t('ax.fp.requestHelp') : t('ax.fp.otpSentFor', { email: identifier })}</p></div>
    {error && <Banner type="error">{error}</Banner>}{notice && <Banner type="success">{notice}</Banner>}
    {step === 'request' ? <TextInput icon={Mail} placeholder={t('ax.fp.emailPh')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} /> : <><TextInput icon={KeyRound} placeholder={t('ax.fp.otpPh')} inputMode="numeric" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} /><PasswordInput icon={Lock} placeholder={t('ax.fp.newPw')} value={password} onChange={(e) => setPassword(e.target.value)} /><PasswordInput icon={Lock} placeholder={t('ax.fp.confirmPw')} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></>}
    <button disabled={busy} className="w-full rounded-xl bg-brand-blue py-3 text-sm font-semibold text-white hover:bg-brand-blueDark disabled:opacity-60">{busy ? t('ax.fp.wait') : step === 'request' ? t('ax.fp.sendOtp') : t('ax.fp.resetBtn')}</button>
    {step === 'reset' && <button type="button" disabled={busy} onClick={requestOtp} className="w-full text-[13px] font-medium text-brand-blue hover:underline disabled:opacity-50">{t('ax.fp.resend')}</button>}
  </form>
}