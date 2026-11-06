/**
 * The landing page's ambient "green glass" blobs, shared by every console shell
 * so frosted cards have warm teal/emerald depth to blur over. Fixed + behind
 * everything (`-z-10`), non-interactive. Pair with the `glass-console` class and
 * the `bg-gradient-to-br from-emerald-50 via-white to-teal-50` background.
 */
export default function GlassBackdrop() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed -left-40 top-8 -z-10 h-[34rem] w-[34rem] rounded-full bg-teal-300/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none fixed -right-32 top-1/3 -z-10 h-[36rem] w-[36rem] rounded-full bg-emerald-300/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none fixed -bottom-24 left-1/3 -z-10 h-[30rem] w-[30rem] rounded-full bg-green-200/30 blur-3xl" />
    </>
  )
}
