import { Gift } from 'lucide-react'

const fmt = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '')

/**
 * "Free revisit · ₹0" — shown wherever staff see a visit that used a free
 * revisit pass, so nobody wonders why this patient pays nothing. `info` is the
 * appointment's / queue row's `free_revisit`: { earned_on, valid_until }.
 * `detail` adds the "paid visit on … · free until …" line under the chip.
 */
export default function FreeRevisitChip({ info, detail = false, dark = false }) {
  if (!info) return null
  const why = `Free revisit: paid visit on ${fmt(info.earned_on)}, free until ${fmt(info.valid_until)}`
  return (
    <span className="inline-flex flex-col items-start leading-tight" title={why}>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
        dark ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/40' : 'bg-emerald-100 text-emerald-700'
      }`}>
        <Gift className="h-3 w-3" /> Free revisit · ₹0
      </span>
      {detail && (
        <span className={`mt-0.5 text-[10.5px] ${dark ? 'text-white/60' : 'text-slate-500'}`}>
          Paid visit on {fmt(info.earned_on)} · free until {fmt(info.valid_until)}
        </span>
      )}
    </span>
  )
}
