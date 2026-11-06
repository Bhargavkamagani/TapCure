import { useEffect, useState, useCallback } from 'react'
import { BellRing, Clock, Users, Send, CheckCircle2 } from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { useDoctorCtx } from '../../context/DoctorContext.jsx'
import { doctorsApi, tokensApi } from '../../api'
import { prettyDate } from '../../lib/format.js'
import { useDialog } from '../../components/common/DialogProvider.jsx'

const PRESETS = [10, 15, 20, 30, 45]

function DelayAlert() {
  const dialog = useDialog()
  const { doctorId } = useDoctorCtx()
  const [waiting, setWaiting] = useState(0)
  const [log, setLog] = useState([])
  const [minutes, setMinutes] = useState(15)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const refresh = useCallback(async () => {
    if (!doctorId) return
    const [q, delays] = await Promise.all([
      tokensApi.queue(doctorId).catch(() => null),
      doctorsApi.delays(doctorId).catch(() => []),
    ])
    setWaiting(q?.total_waiting || 0)
    setLog((delays || []).slice().reverse())
  }, [doctorId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const send = async () => {
    setSending(true)
    try {
      await doctorsApi.logDelay({ doctor_id: doctorId, delay_minutes: minutes, reason: 'Running late' })
      setSent(true)
      refresh()
    } catch (e) {
      dialog.alert({ title: 'Delay alert not sent', message: e.message || 'Could not send delay alert.', tone: 'danger' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Doctor Delay Alert" subtitle="Notify waiting patients about a delay and revised wait time." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
        <Card>
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-brand-navy"><BellRing className="h-5 w-5 text-red-500" /> Send Delay Alert</h3>

          <div className="mb-3 flex items-center gap-3 rounded-xl bg-blue-50 p-3">
            <Users className="h-5 w-5 text-brand-blue" />
            <p className="text-[13px] text-slate-600"><span className="font-bold text-brand-navy">{waiting} waiting patients</span> will be notified.</p>
          </div>

          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-600">Estimated delay</label>
          <div className="mb-3 flex flex-wrap gap-2">
            {PRESETS.map((m) => (
              <button key={m} onClick={() => { setMinutes(m); setSent(false) }}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${minutes === m ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-200 text-brand-navy hover:border-slate-300'}`}>
                +{m} min
              </button>
            ))}
          </div>

          {sent ? (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13.5px] font-semibold text-green-700">
              <CheckCircle2 className="h-5 w-5" /> Alert logged (+{minutes} min).
            </div>
          ) : (
            <button onClick={send} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60">
              <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send Delay Alert'}
            </button>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 text-[15px] font-bold text-brand-navy">Recent Alerts</h3>
          {log.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No delay alerts yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {log.map((d) => (
                <li key={d.delay_id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-600"><Clock className="h-[18px] w-[18px]" /></span>
                  <div className="flex-1">
                    <p className="text-[13.5px] font-semibold text-brand-navy">+{d.delay_minutes} min delay{d.reason ? ` · ${d.reason}` : ''}</p>
                    <p className="text-[12px] text-slate-500">{d.notified_patients ? 'Patients notified' : 'Not notified'}</p>
                  </div>
                  <span className="text-[12px] text-slate-400">{prettyDate(d.delay_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

export default DelayAlert
