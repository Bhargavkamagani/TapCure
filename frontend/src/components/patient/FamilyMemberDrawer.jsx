import { useEffect } from 'react'
import { translitName } from '../../lib/translit.js'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Phone, Droplet, CalendarPlus, Pencil, Bell, Activity } from 'lucide-react'
import PersonAvatar from './PersonAvatar.jsx'
import HealthTimeline from './HealthTimeline.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { relLabel, genderLabel } from './personLabels.js'
import { ageFromDob } from '../../lib/family.js'

/**
 * One person's health story, shown as a right-side drawer: header (identity +
 * quick actions) over a unified <HealthTimeline/> (visits · prescriptions ·
 * vitals · reports · upcoming follow-ups). Opened for the account holder ("You")
 * and each dependent from the family roster.
 */

export default function FamilyMemberDrawer({ member, patientId, onClose, onBook, onEdit }) {
  const { t, lang } = useI18n()

  // Close on Escape.
  useEffect(() => {
    if (!member) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [member, onClose])

  const age = member ? ageFromDob(member.dob) : null

  return createPortal(
    <AnimatePresence>
      {member && (
        <motion.div
          className="fixed inset-0 z-[100] flex justify-end bg-slate-900/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.aside
            className="theme-patient flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <PersonAvatar person={member} isSelf={!member.member_id} className="h-12 w-12 text-sm" />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[16px] font-bold text-brand-navy">{translitName(member.name, lang)}</p>
                  <p className="truncate text-[12px] text-slate-400">
                    {[relLabel(t, member.relation), age != null ? `${age} ${t('ppage.years')}` : null, genderLabel(t, member.gender)]
                      .filter(Boolean).join(' · ') || '—'}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {member.blood_group && (
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-500">
                        <Droplet className="h-3 w-3" /> {member.blood_group}
                      </span>
                    )}
                    {member.phone && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Phone className="h-3 w-3" /> {member.phone}
                      </span>
                    )}
                    {member.notify_to === 'own' && member.phone && (
                      <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-600">
                        <Bell className="h-3 w-3" /> {t('ppage.ownReminders')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <button
                onClick={() => onBook(member)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-blue px-3 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-blueDark"
              >
                <CalendarPlus className="h-4 w-4" /> {t('ppage.bookAppointment')}
              </button>
              <button
                onClick={() => onEdit(member)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" /> {t('pcommon.edit')}
              </button>
            </div>

            {/* Unified health timeline (visits · prescriptions · vitals · reports) */}
            <div className="flex-1 overflow-y-auto px-5 pb-8">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-400" />
                <h4 className="text-[13px] font-bold text-brand-navy">{t('ppage.timeline')}</h4>
              </div>
              <HealthTimeline member={member} patientId={patientId} />
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
