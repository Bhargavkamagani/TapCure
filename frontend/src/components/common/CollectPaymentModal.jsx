import { useState } from 'react'
import { Banknote, Smartphone, CreditCard, MoreHorizontal, X, Wallet } from 'lucide-react'

/** The modes the API accepts (schemas/appointment.py CollectPaymentRequest). */
export const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
]
const LABEL = Object.fromEntries(PAYMENT_MODES.map((m) => [m.value, m.label]))
/** "UPI" for a stored method, '' when none was recorded (older rows). */
export const paymentModeLabel = (m) => (m ? LABEL[m] || m : '')

/**
 * "Collect ₹300" → pick how the money came in, then confirm. Recording the mode
 * is what lets the end-of-day cash count match the drawer, and UPI/card match
 * the bank statement. Nothing is pre-selected on purpose: a default of Cash
 * would be clicked through and every UPI payment would be counted as cash.
 *
 * `onConfirm(method)` does the API call; the modal closes when it resolves.
 */
export default function CollectPaymentModal({ amount, patientName, tokenCode, onConfirm, onClose }) {
  const [method, setMethod] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    if (!method) { setError('Choose how the patient paid'); return }
    setBusy(true)
    setError(null)
    try {
      await onConfirm(method)
      onClose()
    } catch (e) {
      setError(e?.message || 'Could not record the payment')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-900/40 p-4" onClick={busy ? undefined : onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600"><Wallet className="h-5 w-5" /></span>
            <div className="leading-tight">
              <p className="text-[16px] font-extrabold text-brand-navy">Collect ₹{amount}</p>
              <p className="mt-0.5 text-[13.5px] text-slate-500">
                {patientName ? `From ${patientName}` : 'From this patient'}{tokenCode ? ` · token ${tokenCode}` : ''}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-slate-400">How did they pay?</p>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_MODES.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" onClick={() => { setMethod(value); setError(null) }}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-[13.5px] font-bold transition-colors ${
                method === value ? 'border-green-600 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[13px] text-slate-500">This marks the token as PAID so the doctor can call them. Only confirm once you've received the money.</p>
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={confirm} disabled={busy || !method}
            className="flex-1 rounded-xl bg-green-600 px-3 py-2.5 text-[13px] font-bold text-white hover:bg-green-700 disabled:opacity-50">
            {busy ? 'Saving…' : method ? `Paid by ${LABEL[method]}` : 'Mark as paid'}
          </button>
        </div>
      </div>
    </div>
  )
}
