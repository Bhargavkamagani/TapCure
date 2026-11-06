import { useState } from 'react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import { SETTING_GROUPS } from '../../data/doctorPagesData.js'

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-blue' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

function Settings() {
  const [state, setState] = useState(() =>
    SETTING_GROUPS.flatMap((g, gi) => g.items.map((it, ii) => [`${gi}-${ii}`, it.on])).reduce((o, [k, v]) => ((o[k] = v), o), {})
  )
  const toggle = (k) => setState((s) => ({ ...s, [k]: !s[k] }))

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Settings" subtitle="Manage notifications, queue behaviour and account preferences." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SETTING_GROUPS.map((g, gi) => (
          <Card key={g.group}>
            <h3 className="mb-2 text-[15px] font-bold text-brand-navy">{g.group}</h3>
            <ul className="divide-y divide-slate-50">
              {g.items.map((it, ii) => {
                const k = `${gi}-${ii}`
                return (
                  <li key={k} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-[13.5px] font-semibold text-brand-navy">{it.label}</p>
                      <p className="text-[12px] text-slate-500">{it.desc}</p>
                    </div>
                    <Toggle on={state[k]} onClick={() => toggle(k)} />
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default Settings
