import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

/**
 * Shared building blocks for the text-heavy legal pages (Privacy, Terms,
 * Medical Disclaimer, Cancellation & Refund). Keeps the icon-chip card + typed
 * block rendering consistent across all of them.
 *
 * Block types: 'p' (paragraph), 'ul' (bulleted grid), 'sub' (sub-heading).
 * Section tone: 'default' | 'warn' (ember-accented callout).
 * Optional section.readMore: { label, to } renders a "Read more" link.
 */

export function Block({ block }) {
  if (block.type === 'ul') {
    return (
      <ul className="my-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-ink-soft">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage-deep/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (block.type === 'sub') {
    return <h3 className="mt-6 mb-1 font-semibold text-foreground">{block.text}</h3>
  }
  return <p className="my-3 leading-relaxed text-ink-soft">{block.text}</p>
}

export function SectionCard({ section }) {
  const Icon = section.icon
  const warn = section.tone === 'warn'
  return (
    <section
      id={`section-${section.id}`}
      className={
        warn
          ? 'scroll-mt-24 rounded-3xl border-2 border-ember/50 bg-ember/5 p-6 shadow-sm sm:p-8'
          : 'scroll-mt-24 rounded-3xl border border-white/50 bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8'
      }
    >
      <div className="flex items-center gap-4">
        <span
          className={
            warn
              ? 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ember text-primary-foreground'
              : 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-green-600 text-white'
          }
        >
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-serif text-2xl leading-tight sm:text-[1.7rem]">
          <span className="text-sage-deep">{section.id}.</span> {section.title}
        </h2>
      </div>
      <div className="mt-4">
        {section.blocks.map((block, i) => <Block key={i} block={block} />)}
      </div>
      {section.readMore && (
        <Link
          to={section.readMore.to}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sage-deep transition-all hover:gap-2"
        >
          {section.readMore.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  )
}
