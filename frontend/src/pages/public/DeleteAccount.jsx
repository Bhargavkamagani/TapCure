import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, UserX } from 'lucide-react'
import StaticPageShell from '../../components/landing/StaticPageShell.jsx'
import DeleteAccountFlow from '../../components/patient/DeleteAccountFlow.jsx'
import { useI18n } from '../../i18n/index.jsx'

/**
 * Public page (route: /delete-account), no login. Google Play asks for a web
 * link where someone can delete their account without installing the app; the
 * in-app path is Profile → Delete my account. `?done=1` is where both land.
 */
export default function DeleteAccount() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const done = params.get('done') === '1'

  return (
    <StaticPageShell legal>
      <main className="mx-auto w-full max-w-xl px-4 pb-20 pt-10 sm:px-6">
        {done ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-12 w-12 text-teal-600" />
            <h1 className="mt-4 text-[24px] font-extrabold text-brand-navy">{t('adel.doneTitle')}</h1>
            <p className="mt-2 text-[14px] text-slate-600">{t('adel.doneDesc')}</p>
            <Link to="/" className="mt-6 inline-block rounded-xl bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">
              {t('adel.home')}
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest text-red-500">
              <UserX className="h-4 w-4" /> {t('adel.pageEyebrow')}
            </p>
            <h1 className="mt-2 text-[24px] font-extrabold text-brand-navy">{t('adel.pageTitle')}</h1>
            <p className="mb-5 mt-2 text-[14px] text-slate-600">{t('adel.pageDesc')}</p>
            <DeleteAccountFlow />
            <p className="mt-5 text-[13.5px] text-slate-400">{t('adel.inApp')}</p>
          </div>
        )}
      </main>
    </StaticPageShell>
  )
}
