import { useEffect, useState } from 'react'
import { translitName } from '../../lib/translit.js'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Users, Plus, Pencil, Trash2, CalendarPlus, Droplet, Bell, Link2 } from 'lucide-react'
import { Card } from '../hospital/ui.jsx'
import { Banner } from '../common/FormControls.jsx'
import { patientsApi } from '../../api'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { useI18n } from '../../i18n/index.jsx'
import { relLabel, genderLabel } from './personLabels.js'
import { MAX_MEMBERS, ageFromDob } from '../../lib/family.js'
import PersonAvatar from './PersonAvatar.jsx'
import FamilyMemberDrawer from './FamilyMemberDrawer.jsx'
import FamilyLinkInbox from './FamilyLinkInbox.jsx'
import EditFamilyMemberModal from './EditFamilyMemberModal.jsx'
import { useDialog } from '../common/DialogProvider.jsx'

/**
 * The patient's family roster — an avatar card grid where each person can be
 * viewed (health history), edited, removed, or booked for.
 *
 * The account holder appears as a non-removable "You" card, so every person the
 * patient books for is managed in one place. Self owns the rows with no
 * `family_member_id`; dependents are matched by `member_id`.
 *
 * Add/edit uses <EditFamilyMemberModal/> — the same shell as the patient's own
 * profile edit, so both feel identical.
 */
export default function FamilyMembers({ patientId, showHeader = true }) {
  const dialog = useDialog()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const { patient } = usePatientCtx()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // 'new' | member object | null
  const [err, setErr] = useState(null)
  const [viewing, setViewing] = useState(null) // person whose history drawer is open
  // Only the server can say whether a dependent's number belongs to a real
  // account, so the Invite button is driven by this list rather than by
  // anything on the member row itself.
  const [invitable, setInvitable] = useState([])
  const [inviting, setInviting] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const load = () => {
    setLoading(true)
    patientsApi.family(patientId)
      .then((r) => setMembers((r || []).filter((m) => m.is_active)))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
    patientsApi.linkInvitable()
      .then((r) => setInvitable((r || []).map((m) => m.member_id)))
      .catch(() => setInvitable([]))
  }

  const invite = async (member) => {
    setInviting(member.member_id)
    try { await patientsApi.linkInvite(member.member_id); load() }
    catch (e) { setErr(e.message) }
    finally { setInviting(null) }
  }
  useEffect(load, [patientId])

  // Open the add form straight away when arrived here via "Add family member"
  // (e.g. from the booking page), then clear the flag so it doesn't re-trigger.
  useEffect(() => {
    if (!searchParams.get('addFamily')) return
    setEditing('new')
    const sp = new URLSearchParams(searchParams)
    sp.delete('addFamily')
    setSearchParams(sp, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remove = async (m) => {
    if (!(await dialog.confirm({ message: t('ppage.removeConfirm', { name: translitName(m.name, lang) }), confirmLabel: t('pcommon.remove') }))) return
    try { await patientsApi.removeFamily(m.member_id); load() } catch (e) { setErr(e.message) }
  }

  // "You" (the account holder) and dependents share one shape so the card, the
  // drawer and the actions can treat them uniformly. Self has no member_id.
  const selfPerson = patient && {
    member_id: null,
    name: patient.name || t('ppage.you'),
    relation: t('ppage.you'),
    dob: patient.dob,
    gender: patient.gender,
    blood_group: patient.blood_group,
    phone: patient.phone,
  }

  // Booking for someone starts by choosing WHO the care is for (done — that's
  // this tile) and then WHO will provide it. Jumping straight into the wizard
  // dropped the patient on a date picker with no doctor chosen, so send them to
  // Find Doctors first and carry the person along in `?for=`.
  const bookForPerson = (p) =>
    navigate(p.member_id
      ? `/patient-dashboard/doctors?for=${p.member_id}`
      : '/patient-dashboard/doctors')

  const editPerson = (p) => (p.member_id ? setEditing(p) : navigate('/patient-dashboard/profile'))

  const atCap = members.length >= MAX_MEMBERS
  const pct = Math.round((members.length / MAX_MEMBERS) * 100)

  /** One person tile — used for both "You" and each dependent. */
  const PersonCard = ({ person, isSelf }) => {
    const age = ageFromDob(person.dob)
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setViewing(person)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewing(person) } }}
        title={t('ppage.viewHistoryHint')}
        className={`group cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-blue/30 ${
          isSelf ? 'border-brand-blue/30 bg-brand-blueLight/20' : 'border-slate-100 hover:border-brand-blue/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <PersonAvatar person={person} isSelf={isSelf} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[14px] font-bold text-brand-navy">{translitName(person.name, lang)}</p>
            <p className="truncate text-[13px] text-slate-400">
              {[isSelf ? t('ppage.accountHolder') : relLabel(t, person.relation), age != null ? `${age} ${t('ppage.years')}` : null]
                .filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>

        {/* Meta chips */}
        {(person.gender || person.blood_group || (person.notify_to === 'own' && person.phone)
          || person.link_status === 'linked' || person.link_status === 'pending_member') && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {person.gender && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[13px] font-medium text-slate-500">{genderLabel(t, person.gender)}</span>
            )}
            {person.blood_group && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[13px] font-semibold text-red-500">
                <Droplet className="h-3 w-3" /> {person.blood_group}
              </span>
            )}
            {person.notify_to === 'own' && person.phone && (
              <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[13px] font-semibold text-teal-600">
                <Bell className="h-3 w-3" /> {t('ppage.ownReminders')}
              </span>
            )}
            {person.link_status === 'linked' && (
              <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[13px] font-semibold text-green-600">
                <Link2 className="h-3 w-3" /> {t('ppage.linkLinked')}
              </span>
            )}
            {person.link_status === 'pending_member' && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[13px] font-semibold text-amber-600">
                <Link2 className="h-3 w-3" /> {t('ppage.linkPending')}
              </span>
            )}
          </div>
        )}

        {/* Only shown once that person actually holds an account on the number
            saved here — `invitable` comes from the server, so the button
            cannot appear for someone who never registered. */}
        {!isSelf && invitable.includes(person.member_id) && (
          <button
            onClick={(e) => { e.stopPropagation(); invite(person) }}
            disabled={inviting === person.member_id}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-brand-blue/30 bg-white px-3 py-2 text-[13px] font-bold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white disabled:opacity-50"
          >
            <Link2 className="h-3.5 w-3.5" /> {t('ppage.linkInvite')}
          </button>
        )}

        {/* Actions */}
        <div className="mt-3.5 flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); bookForPerson(person) }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-blueLight px-3 py-2 text-[13px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue hover:text-white"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> {t('ppage.bookAppointment')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); editPerson(person) }}
            title={t('pcommon.edit')}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-blue"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {!isSelf && (
            <button
              onClick={(e) => { e.stopPropagation(); remove(person) }}
              title={t('pcommon.remove')}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card className="p-5">
      {/* Anything awaiting a yes/no sits above the roster. Renders nothing when
          there is nothing to answer, which is the normal case. */}
      <div className="empty:hidden [&:not(:empty)]:mb-5">
        <FamilyLinkInbox onChanged={load} />
      </div>

      {/* Header (optional — the standalone page supplies its own) + usage meter */}
      <div className={`mb-4 flex items-start gap-3 ${showHeader ? 'justify-between' : 'justify-end'}`}>
        {showHeader && (
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <Users className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h3 className="text-[15px] font-bold text-brand-navy">{t('ppage.familyTitle')}</h3>
              <p className="text-[13px] text-slate-400">{t('ppage.familySubtitle')}</p>
            </div>
          </div>
        )}
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-semibold text-slate-400">
            {t('ppage.familyUsed', { used: members.length, max: MAX_MEMBERS })}
          </p>
          <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {err && <div className="mb-3"><Banner type="error">{err}</Banner></div>}

      {loading ? (
        <p className="py-6 text-center text-[13px] text-slate-400">{t('pcommon.loading')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {/* You — always first, never removable */}
          {selfPerson && <PersonCard person={selfPerson} isSelf />}

          {members.map((m) => <PersonCard key={m.member_id} person={m} />)}

          {/* Add tile */}
          {!atCap && (
            <button
              onClick={() => setEditing('new')}
              className="flex min-h-[9.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-brand-blue hover:bg-brand-blueLight/40 hover:text-brand-blue"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                <Plus className="h-5 w-5" />
              </span>
              <span className="text-[13.5px] font-semibold">{t('ppage.addMember')}</span>
            </button>
          )}
        </div>
      )}

      {!loading && (
        <p className="mt-3 text-center text-[13px] text-slate-400">
          {atCap ? t('ppage.familyMax') : t('ppage.viewHistoryHint')}
        </p>
      )}

      {/* Health-history drawer for the tapped person */}
      <FamilyMemberDrawer
        member={viewing}
        patientId={patientId}
        onClose={() => setViewing(null)}
        onBook={(p) => { setViewing(null); bookForPerson(p) }}
        onEdit={(p) => { setViewing(null); editPerson(p) }}
      />

      {/* Add / edit — same shell as the patient's own profile edit */}
      <EditFamilyMemberModal
        member={editing}
        patientId={patientId}
        accountPhone={patient?.phone}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </Card>
  )
}
