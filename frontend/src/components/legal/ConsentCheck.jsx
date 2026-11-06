import { useI18n } from '../../i18n/index.jsx'

/**
 * Mandatory consent checkbox for the signup forms (patient / hospital / doctor).
 * The policy names open the full policy page in a NEW TAB, so the user can
 * read Terms / Privacy / Refund without leaving (and losing) the form.
 *
 * Controlled: parent owns `checked` and gates its submit on it. Pass `error` to
 * surface the "please accept" message. Theme-neutral (works on white forms).
 */
export default function ConsentCheck({ checked, onChange, error }) {
  const { t } = useI18n()
  const link = 'font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800'
  const policyLink = (href, label) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={link}>{label}</a>
  )

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
        />
        <span className="text-[13px] leading-snug text-slate-600">
          {t('lcon.pre')}
          {policyLink('/terms', t('lcon.terms'))}
          {t('lcon.sep')}
          {policyLink('/privacy', t('lcon.privacy'))}
          {t('lcon.and')}
          {policyLink('/cancellation-refund', t('lcon.refund'))}
          {t('lcon.post')}
        </span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  )
}
