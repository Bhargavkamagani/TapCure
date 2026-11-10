import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Search, Stethoscope, ArrowRight, AlertTriangle, Sparkles,
  Thermometer, HeartPulse, Hand, Bone, Eye, Ear, Smile, Flower2, Baby, Brain,
  Apple, PersonStanding,
} from 'lucide-react'
import {
  SYMPTOM_GROUPS, matchSpecialties, isEmergency, specialtyLabel, tr,
} from '../../data/symptomSpecialty.js'
import { useI18n } from '../../i18n/index.jsx'

const ICONS = {
  Thermometer, HeartPulse, Hand, Bone, Eye, Ear, Smile, Flower2, Baby, Brain,
  Apple, PersonStanding,
}

/**
 * "Not sure which doctor?" helper. The patient types or taps a complaint; we map
 * it to a specialty (rule-based, en/te/hi) and call `onPick(specialty)` so the
 * caller can filter the doctor list. Guidance only — not a diagnosis.
 */
export default function SymptomHelper({ open, onClose, onPick }) {
  const { t, lang } = useI18n()
  const [text, setText] = useState('')
  if (!open) return null

  const trimmed = text.trim()
  const emergency = isEmergency(trimmed)
  const matches = matchSpecialties(trimmed).slice(0, 3)

  const choose = (specialty) => { onPick(specialty); onClose() }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className="relative my-auto w-full max-w-[680px] overflow-hidden rounded-3xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header — brand teal→green */}
        <div className="relative bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#16a34a] px-7 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            aria-label={t('pm.close')}
          >
            <X className="h-5 w-5" />
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5" /> {t('symptom.badge')}
          </span>
          <h2 className="mt-3 font-serif text-2xl">{t('symptom.title')}</h2>
          <p className="mt-1 text-[13px] text-green-50/85">{t('symptom.subtitle')}</p>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-7 py-5">
          {/* Free-text */}
          <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-teal-500 focus-within:bg-white">
            <Search className="h-5 w-5 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('symptom.placeholder')}
              className="w-full bg-transparent text-sm text-brand-navy outline-none placeholder:text-slate-400"
            />
            {text && (
              <button onClick={() => setText('')} className="text-slate-400 hover:text-slate-600" aria-label={t('pm.clear')}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Emergency red-flag */}
          {emergency && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="text-[13px] leading-snug text-red-700">
                <b className="font-bold">{t('symptom.emergencyTitle')}</b> {t('symptom.emergencyBody')}
              </div>
            </div>
          )}

          {/* Free-text results */}
          {trimmed && matches.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                {t('symptom.suggested')}
              </p>
              <div className="space-y-2">
                {matches.map((m, i) => (
                  <button
                    key={m.specialty}
                    onClick={() => choose(m.specialty)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors hover:border-teal-500 hover:bg-teal-50/50 ${
                      i === 0 ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200'
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d9f2e6] text-[#0f766e]">
                      <Stethoscope className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-brand-navy">
                        {specialtyLabel(m.specialty, lang)}
                        {i === 0 && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[13px] font-semibold text-teal-700">{t('symptom.bestMatch')}</span>}
                      </p>
                      <p className="truncate text-[13px] text-slate-500">{t('symptom.matchesLabel')}: {m.matched.slice(0, 3).join(', ')}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-teal-700">
                      {t('symptom.showDoctors')} <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {trimmed && matches.length === 0 && !emergency && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[13px] text-slate-600">{t('symptom.noMatch')}</p>
              <button onClick={() => choose('General Physician')} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-700 hover:underline">
                <Stethoscope className="h-4 w-4" /> {t('symptom.gpFallback')} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Common complaints, grouped by body area (shown when not typing) */}
          {!trimmed && (
            <div className="mt-4">
              <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                {t('symptom.orTap')}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {SYMPTOM_GROUPS.map((g) => {
                  const Icon = ICONS[g.icon] || Stethoscope
                  return (
                    <div key={g.specialty} className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                      <button
                        onClick={() => choose(g.specialty)}
                        className="flex w-full items-center gap-2.5 text-left"
                        title={specialtyLabel(g.specialty, lang)}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#d9f2e6] text-[#0f766e]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold text-brand-navy">{tr(g.area, lang)}</p>
                          <p className="truncate text-[13px] text-teal-700">{specialtyLabel(g.specialty, lang)}</p>
                        </div>
                      </button>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {g.chips.map((c) => (
                          <button
                            key={c.en}
                            onClick={() => choose(g.specialty)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[13px] font-medium text-slate-600 transition-colors hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700"
                          >
                            {tr(c, lang)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="border-t border-slate-100 bg-slate-50 px-7 py-3">
          <p className="text-[13px] leading-snug text-slate-400">{t('symptom.disclaimer')}</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
