import { motion } from 'framer-motion'
import { Hammer } from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'

/** Placeholder for receptionist pages whose UI is planned but backend is pending. */
export default function ComingSoon({ title = 'Coming Soon', subtitle = 'This page is being built.' }) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={title} subtitle={subtitle} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <motion.span
            animate={{ rotate: [0, -12, 12, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-blueLight text-brand-blue"
          >
            <Hammer className="h-8 w-8" />
          </motion.span>
          <div>
            <p className="text-[16px] font-bold text-brand-navy">{title}</p>
            <p className="mt-1 text-sm text-slate-400">UI is planned — backend wiring coming next.</p>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
