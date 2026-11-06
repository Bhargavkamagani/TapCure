import { Search, Send } from 'lucide-react'
import { Card, PageHeading, Avatar } from '../../components/hospital/ui.jsx'
import { MESSAGES } from '../../data/doctorPagesData.js'

function Messages() {
  const active = MESSAGES[0]

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Messages" subtitle="Conversations with patients and hospital staff." />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Thread list */}
        <Card className="p-0">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input placeholder="Search messages…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
          </div>
          <ul>
            {MESSAGES.map((m, i) => (
              <li key={m.name} className={`flex cursor-pointer items-center gap-3 border-b border-slate-50 px-4 py-3 hover:bg-slate-50 ${i === 0 ? 'bg-brand-blueLight/40' : ''}`}>
                <Avatar name={m.name} className="h-10 w-10 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-[13.5px] font-bold text-brand-navy">{m.name}</p>
                    <span className="text-[11px] text-slate-400">{m.time}</span>
                  </div>
                  <p className="truncate text-[12.5px] text-slate-500">{m.preview}</p>
                </div>
                {m.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-blue px-1.5 text-[11px] font-bold text-white">{m.unread}</span>}
              </li>
            ))}
          </ul>
        </Card>

        {/* Conversation */}
        <Card className="flex min-h-[420px] flex-col">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <Avatar name={active.name} className="h-10 w-10 text-sm" />
            <p className="text-[15px] font-bold text-brand-navy">{active.name}</p>
          </div>
          <div className="flex-1 space-y-3 py-4">
            <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-2 text-[13.5px] text-brand-navy">{active.preview}</div>
            <div className="ml-auto max-w-[70%] rounded-2xl rounded-tr-sm bg-brand-blue px-4 py-2 text-[13.5px] text-white">Glad to hear that! Take rest and complete the medication.</div>
          </div>
          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <input placeholder="Type a message…" className="field-input flex-1" />
            <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue text-white hover:bg-brand-blueDark"><Send className="h-4 w-4" /></button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Messages
