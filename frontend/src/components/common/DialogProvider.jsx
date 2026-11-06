import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useI18n } from '../../i18n/index.jsx'

/**
 * App-wide replacement for the browser's native alert() and confirm().
 *
 * Both are exposed as promises so call sites keep their original shape:
 *
 *   await dialog.alert({ title: 'Action failed', message: err.message })
 *   if (!(await dialog.confirm({ message: 'Remove this session?' }))) return
 *
 * Native dialogs blocked the whole tab, ignored our styling, and on mobile
 * showed the site's origin in the title — this renders in-app instead.
 *
 * Deliberately NOT portalled to document.body: the console layouts put their
 * theme class on an ancestor, so a body-level portal would lose it. Rendering
 * inside the provider (which sits at the app root) keeps one predictable look,
 * built from neutral palette colours that read correctly on every console.
 */
const DialogCtx = createContext(null)

const TONES = {
  info: { icon: Info, ring: 'bg-brand-blueLight text-brand-blue', btn: 'bg-brand-blue hover:bg-brand-blueDark' },
  danger: { icon: AlertTriangle, ring: 'bg-red-50 text-red-500', btn: 'bg-red-500 hover:bg-red-600' },
  success: { icon: CheckCircle2, ring: 'bg-green-50 text-green-600', btn: 'bg-green-600 hover:bg-green-700' },
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  // Resolver for the promise handed back to the caller.
  const resolveRef = useRef(null)
  const confirmBtnRef = useRef(null)
  const { t } = useI18n()

  const close = useCallback((result) => {
    setDialog(null)
    const resolve = resolveRef.current
    resolveRef.current = null
    resolve?.(result)
  }, [])

  const open = useCallback((opts, type) => {
    // A second dialog while one is open would strand the first promise.
    resolveRef.current?.(type === 'confirm' ? false : undefined)
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialog({ type, ...(typeof opts === 'string' ? { message: opts } : opts) })
    })
  }, [])

  const api = useRef({
    alert: (opts) => open(opts, 'alert'),
    confirm: (opts) => open(opts, 'confirm'),
  }).current
  api.alert = (opts) => open(opts, 'alert')
  api.confirm = (opts) => open(opts, 'confirm')

  // Escape cancels; Enter confirms. Focus lands on the action button so a
  // keyboard user can answer without reaching for the mouse.
  useEffect(() => {
    if (!dialog) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') close(dialog.type === 'confirm' ? false : undefined)
      if (e.key === 'Enter') close(dialog.type === 'confirm' ? true : undefined)
    }
    document.addEventListener('keydown', onKey)
    confirmBtnRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [dialog, close])

  const tone = TONES[dialog?.tone || (dialog?.type === 'confirm' ? 'danger' : 'info')]
  const Icon = tone?.icon

  return (
    <DialogCtx.Provider value={api}>
      {children}

      {dialog && (
        <div
          className="fixed inset-0 z-[200] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => close(dialog.type === 'confirm' ? false : undefined)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start gap-3.5 p-5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone.ring}`}>
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                {dialog.title && (
                  <h3 className="text-[15.5px] font-bold text-brand-navy">{dialog.title}</h3>
                )}
                {dialog.message && (
                  <p className={`text-[13.5px] leading-relaxed text-slate-500 ${dialog.title ? 'mt-1' : ''}`}>
                    {dialog.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => close(dialog.type === 'confirm' ? false : undefined)}
                aria-label={t('pm.close')}
                className="shrink-0 text-slate-300 transition-colors hover:text-slate-500"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">
              {dialog.type === 'confirm' && (
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-brand-navy transition-colors hover:bg-slate-50"
                >
                  {dialog.cancelLabel || t('pcommon.cancel')}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => close(dialog.type === 'confirm' ? true : undefined)}
                className={`rounded-xl px-5 py-2.5 text-[13px] font-bold text-white transition-colors ${tone.btn}`}
              >
                {dialog.confirmLabel || (dialog.type === 'confirm' ? t('pcommon.confirm') : t('cmn.ok'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  )
}

/** `const dialog = useDialog()` → `dialog.alert(...)` / `await dialog.confirm(...)` */
export function useDialog() {
  const ctx = useContext(DialogCtx)
  if (ctx) return ctx
  // Outside the provider (tests, stories) fall back to native so nothing breaks.
  return {
    alert: (o) => { window.alert(typeof o === 'string' ? o : o.message); return Promise.resolve() },
    confirm: (o) => Promise.resolve(window.confirm(typeof o === 'string' ? o : o.message)),
  }
}
