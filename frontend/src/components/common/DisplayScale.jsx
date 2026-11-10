import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Makes the app render identically on every machine.
 *
 * The consoles are built in fixed pixels (`text-[13.5px]`, `w-[370px]`,
 * `max-w-[1240px]`) on top of Tailwind's width breakpoints. Browser zoom changes
 * how many CSS pixels the window reports, so the SAME code produced two
 * different designs: a 1920 monitor at 80% zoom reports 2400 CSS px and gets the
 * roomy `xl:` layout, while a 1366 laptop at 100% reports 1366 and gets the
 * cramped `lg:` one — different rail widths, different column counts.
 *
 * So instead of letting the window width drive the layout, we pin the layout to
 * one design width and scale it to fill whatever window it lands in. Every
 * machine now lays out at exactly DESIGN_WIDTH; only the final scale differs.
 *
 * `zoom` rather than `transform: scale()` on purpose — zoom participates in
 * layout, so scrollbars, hit-testing and `position: fixed` keep working. A
 * transform would visually shrink the page while the document kept its original
 * size, leaving phantom scroll space and mis-aimed clicks.
 *
 * Desktop only. Below `lg` the real responsive layout is the correct one —
 * squeezing a 1440px design onto a 390px phone would make it unreadable.
 */
/**
 * Two pinned surfaces, each with its own reference width.
 *
 * `/` (landing) is pinned at 1280 — the CSS viewport it was signed off on, so
 * every visitor sees the marketing page exactly as approved instead of a layout
 * that reflows with their monitor or zoom.
 *
 * NOTE ON 1280: the sign-off machine is a 1920x1080 screen running Windows
 * display scaling at 150%, so its CSS viewport is 1920 / 1.5 = 1280. Screenshots
 * from it are 1920px wide because those are PHYSICAL pixels. Do not "correct"
 * this to 1920 — that renders the page at 0.67x and shrinks everything.
 *
 * The consoles are pinned at 1440, the width they were built against.
 * The remaining public pages stay fluid.
 */
/**
 * `width` = the layout is always laid out at this width.
 * `from`  = below this window width the pin switches off and the page's real
 *           responsive layout takes over.
 *
 * BOTH floors are 1024 (Tailwind's `lg`) and must stay there. `zoom` scales the
 * box but CANNOT move a media query: `lg:` is evaluated against the real
 * viewport, so under 1024 the page switches to its stacked mobile layout no
 * matter how wide the pinned box is. A floor of 768 was tried and produced the
 * worst of both — the vertical mobile layout stretched inside a 1280-wide frame.
 * Pinning the geometry is possible; pinning the breakpoints is not.
 */
/**
 * `height` pins the VERTICAL composition as well. Only the landing sets it: with
 * a fixed design height, `--app-vh` becomes a constant, so `h-[calc(100vh-5rem)]`
 * on the hero always resolves to the same proportion instead of squashing when
 * the window gets shorter.
 *
 * The consoles must NOT pin height — they are `h-screen overflow-hidden` and
 * have to fill the real window exactly. A fixed height there would clip the
 * bottom on a short window and leave dead space on a tall one.
 *
 * Scale stays driven by WIDTH alone, so the page always fills the window
 * horizontally — no bars down the sides. A taller window simply reveals more of
 * the section below the hero, which reads naturally on a long scrolling page.
 */
// const LANDING = { width: 1280, height: 585, from: 1024 }
const LANDING = { width: 1600, height: 735, from: 1024 }
const CONSOLE = { width: 1440, height: null, from: 1024 }   // 1024 = Tailwind's `lg`

// The redesigned footer pages (2026-11-07) pin to the landing's width so they look
// the same on every laptop and monitor as the homepage does. Width only: they are
// long scrolling pages, so a fixed height would clip them.
const STATIC = { width: 1600, height: null, from: 1024 }
const STATIC_ROUTES = [
  '/about', '/features', '/pricing', '/faq', '/contact', '/health-articles',
  // The four policies share one reader (PolicyReader, 2026-11-07).
  '/privacy', '/terms', '/cancellation-refund', '/medical-disclaimer',
]

const CONSOLE_ROUTES = [
  '/patient-dashboard',
  '/doctor-dashboard',
  '/doctor-onboarding',
  '/hospital-dashboard',
  '/assistant-dashboard',
  '/admin',
]

/** Which pin applies to this route, or null when it should render fluid. */
function targetFor(pathname) {
  // Exact match: every path starts with '/', so a prefix test would pin the
  // entire site.
  // Landing pinned at the approved 80% view so every laptop shows the same layout.
  if (pathname === '/') return LANDING
  if (STATIC_ROUTES.includes(pathname)) return STATIC
  return CONSOLE_ROUTES.some((route) => pathname.startsWith(route)) ? CONSOLE : null
}
// Deliberately wide bounds: this is a backstop against a pathological window
// size, NOT a design constraint. Neutralising browser zoom is the whole point,
// and zoom pushes the reported width a long way — a 1920 monitor at 80% reports
// 2400px and needs 1.67x, at 50% it reports 3840px and needs 2.67x. Clamp those
// and the layout stops being identical, which is exactly what we're fixing.
const MIN_SCALE = 0.6
const MAX_SCALE = 3

const clamp = (n) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, n))

/**
 * The wrapper's size in ITS OWN (pre-zoom) coordinates, so that once `zoom` is
 * applied it renders at exactly the window size. Measured from `window`, which
 * is outside the zoomed subtree and therefore never reports a scaled value —
 * measuring from inside would feed the scale back into itself.
 */
function measure(designWidth, designHeight, from) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!designWidth || vw < from) return { scale: 1, width: vw, height: vh }
  const scale = clamp(vw / designWidth)
  // A pinned height is used as-is; otherwise the height tracks the real window
  // so a full-height console still fits it exactly.
  return { scale, width: vw / scale, height: designHeight || vh / scale }
}

export default function DisplayScale({ children }) {
  const { pathname } = useLocation()
  const target = targetFor(pathname)
  // Kept as primitives, not the object: a fresh object every render would make
  // the effect below re-run forever.
  const designWidth = target ? target.width : 0
  const designHeight = target ? target.height : 0
  const from = target ? target.from : 0
  const [box, setBox] = useState(() => measure(designWidth, designHeight, from))

  useEffect(() => {
    const apply = () => setBox(measure(designWidth, designHeight, from))
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [designWidth, designHeight, from])

  // `100vh` inside a zoomed subtree still means the real window, not the
  // wrapper's coordinate space, so every full-height shell would overflow by
  // the scale factor. Publish the wrapper's own 1vh/1vw as lengths and let
  // index.css re-point the viewport utilities at them.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--app-vh', `${box.height / 100}px`)
    root.style.setProperty('--app-vw', `${box.width / 100}px`)
    root.dataset.appScaled = box.scale === 1 ? 'off' : 'on'
  }, [box])

  return (
    <div
      id="app-scale"
      style={box.scale === 1 ? undefined : {
        zoom: box.scale,
        width: `${box.width}px`,
        minHeight: `${box.height}px`,
      }}
    >
      {children}
    </div>
  )
}
