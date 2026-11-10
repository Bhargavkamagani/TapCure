import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BRAND } from '../data/landingData.js'
import { AuthModalProvider, useAuthModal } from '../context/AuthModalContext.jsx'
import { useI18n, LANGS } from '../i18n/index.jsx'
import { Sun, Moon } from 'lucide-react'
import { discoveryApi } from '../api'
import TcSections from '../components/landing/TcSections.jsx'
import TypeLoop from '../components/landing/TypeLoop.jsx'
import Tagline from '../components/common/Tagline.jsx'
import { LedgerProvider, LedgerHeroCard } from '../components/landing/TcLedger.jsx'

/**
 * TapCure landing — "Leave-Now" direction, LIGHT.
 *
 * PHASE 1: nav + hero, ported from the supplied reference
 * (tapcure.zip). The remaining sections — Leave-Now engine, how-it-works,
 * specialties, doctors, stats, testimonials, app, FAQ, CTA — land in phase 2.
 *
 * Layout and motion are the reference's (type is Inter + Plus Jakarta Sans), with
 * one typeface throughout, glassmorphism and aurora (film grain and the
 * cursor spotlight were removed 2026-11-08). The PALETTE is not — the reference is near-black #05070B
 * and this is re-pitched onto light paper (#F6FBFA). See the token block for
 * what that costs: accents move darker to stay readable, and every
 * white-on-black translucency inverts rather than just losing alpha.
 *
 * EVERY rule below is scoped under `.tcx`. The reference ships as a standalone
 * page and styles `body`, `*` and `::selection` globally; dropped into this app
 * that would repaint every other console. The wrapper class is what keeps this
 * page's theme from leaking — do not lift these rules to index.css.
 */

/** Real destinations — translated, because these leave the page. */
const NAV_LINKS = [
  { key: 'doctors', i18n: 'land.nav.doctors', to: '/search?type=doctors' },
  { key: 'hospitals', i18n: 'land.nav.hospitals', to: '/search?type=hospitals' },
  { key: 'articles', i18n: 'land.nav.articles', to: '/health-articles' },
]

const ROLES = ['patient', 'doctor', 'hospital']

/* Remembered per browser. Wrapped because a locked-down browser throws on
   localStorage rather than returning null, and a themed page is not worth a
   blank one. */
const THEME_KEY = 'tapcure.landing.theme'
const readTheme = () => {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch { /* private mode, blocked storage */ }
  return 'light'
}

/* The doctor card shows the next four days rather than four frozen times. Read
   off the real date so the mock never advertises a day that has already gone. */
const NEXT_DAYS = Array.from({ length: 4 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return d
})
/* Day chips are printed in the UI language (Telugu/Hindi weekday names). */
const DAY_LOCALE = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' }

/* Display label for an English specialty name. The English stays the value —
   it is the search query — only what is shown is translated (lx.spec.*). */
const specKey = (s) => `lx.spec.${s.toLowerCase().replace(/[^a-z]/g, '')}`


const SPECIALTIES = [
  'General Physician', 'Cardiology', 'Dermatology', 'Paediatrics',
  'Orthopaedics', 'Dentistry', 'Gynaecology', 'Ophthalmology',
]


export function PageStyles() {
  return (
    <style>{`
      /* Fonts load once in index.html (Inter + Plus Jakarta Sans + Noto). */

      /* LIGHT palette. The reference ships near-black; these are the same roles
         re-pitched for a light surface. Two rules kept it honest: accent colours
         had to go DARKER to stay readable on white (mint #00C9C5 is unreadable
         as text on a light background — it survives only as a fill, so it is
         split into --mint for ink and --mint-fill for solids), and every
         white-on-black translucency had to invert to dark-on-white rather than
         just having its alpha reduced. */
      .tcx{
        /* Tinted paper, not white. #F6FBFA was so close to white that the
           brand read only in the accents; this carries the logo's teal into
           the surface itself while staying light enough for body copy. */
        --bg:#EAF4F3; --bg-2:#FFFFFF;
        /* Opaque surfaces. Split out so the dark theme has something to flip:
           --card is a raised card, --card-2 the alternating one, --card-3 its
           hover, --wash a tinted inset, --map the little street map. */
        --card:#FFFFFF; --card-2:#FBFEFE; --card-3:#F4FBF9; --wash:#F4FAF9; --map:#DCEAF0;
        --shadow:rgba(15,39,66,.35);
        --panel:rgba(255,255,255,.72); --panel-2:rgba(255,255,255,.88);
        --stroke:rgba(15,39,66,.10); --stroke-2:rgba(15,39,66,.16);
        /* --ink is the icon's own navy (#001243 sampled, lifted for reading) */
        --ink:#0B2150; --ink-2:#41526E; --muted:#6B7A8F; --faint:#93A3B8;
        /* straight off the logo: teal from "Cure", blue from "Tap" */
        --mint:#0A9A96; --mint-fill:#00C9C5; --mint-dim:#0B8C88; --cyan:#2F58B7; --violet:#3369FF;
        --amber:#C97A16; --rose:#E14356;
        /* The app's one text style (2026-11-08): Inter for reading text,
           Plus Jakarta Sans (--head) for headings, Noto for Telugu/Hindi.
           --serif and --mono are kept as tokens because dozens of rules use
           them: the headline accents and big numerals (--serif) follow the
           heading face, the small uppercase labels (--mono) the text face. */
        --sans:Inter, "Noto Sans Telugu", "Noto Sans Devanagari", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        --head:"Plus Jakarta Sans", "Noto Sans Telugu", "Noto Sans Devanagari", Inter, ui-sans-serif, system-ui, sans-serif;
        --serif:var(--head);
        --r-xs:8px; --r-sm:12px; --r-md:18px; --r-lg:26px; --r-xl:34px;
        --mono:var(--sans);
        /* The reference caps content at 1240px. On a 1600px+ viewport that
           leaves ~180px of dead margin each side and the page stops feeling
           fitted to the screen. Widened so it keeps filling; at 1280 and below
           this is inert, the padding still governs. */
        --pad:clamp(20px,4vw,56px); --maxw:1440px;
        --ease:cubic-bezier(.22,.61,.36,1); --ease-out:cubic-bezier(.16,1,.3,1);

        position:relative; min-height:100vh; width:100%; overflow-x:hidden;
        /* clip, not hidden: hidden stops the How-it-works phone from staying in place (sticky) */
        overflow-x:clip;
        color:var(--ink);
        background-color:var(--bg);
        background-image:
          radial-gradient(62% 48% at 0% 0%,     rgba(0,201,197,.42), transparent 70%),
          radial-gradient(58% 44% at 100% 6%,   rgba(51,105,255,.34), transparent 70%),
          radial-gradient(52% 40% at 100% 52%,  rgba(0,201,197,.30), transparent 72%),
          radial-gradient(56% 42% at 0% 58%,    rgba(47,88,183,.26), transparent 72%),
          radial-gradient(64% 46% at 50% 100%,  rgba(0,201,197,.34), transparent 72%);
        /* scroll-attached would slide the wash away down the page; fixed keeps
           both brand colours framing whatever screenful you are looking at. */
        background-attachment:fixed;
        font-family:var(--sans); font-size:16px; line-height:1.6;
        -webkit-font-smoothing:antialiased;
      }
      .tcx *,.tcx *::before,.tcx *::after{ box-sizing:border-box; }
      .tcx img,.tcx svg{ max-width:100%; display:block; }
      .tcx a{ color:inherit; text-decoration:none; }
      .tcx button,.tcx input,.tcx select{ font:inherit; color:inherit; }
      .tcx ::selection{ background:rgba(0,201,197,.28); }

      /* ---------- ambience ---------- */
      /* On black the aurora reads as light bleeding through; on white it has to
         read as tinted paper, so the alphas come down hard — at the reference's
         .42 the hero turned into a green wash and the copy stopped being legible. */
      .tcx .aurora{ position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
      .tcx .aurora i{ position:absolute; display:block; border-radius:50%; filter:blur(90px); opacity:.55; }
      /* Teal top-left, blue top-right — the logo's heart, blown up behind the
         page. Strong enough to see on paper; the cards sit on white so body
         copy never loses contrast against it. */
      .tcx .aurora .a1{ width:62vw; height:62vw; left:-18vw; top:-22vw;
        background:radial-gradient(circle at 40% 40%, rgba(0,201,197,.52), transparent 66%); }
      .tcx .aurora .a2{ width:56vw; height:56vw; right:-14vw; top:-10vw;
        background:radial-gradient(circle at 60% 40%, rgba(51,105,255,.40), transparent 66%); }
      .tcx .aurora .a3{ width:70vw; height:50vw; left:18vw; top:46vh;
        background:radial-gradient(circle at 50% 50%, rgba(47,88,183,.28), transparent 70%); }
      .tcx .aurora .a4{ width:58vw; height:44vw; right:-10vw; bottom:-14vw;
        background:radial-gradient(circle at 50% 50%, rgba(0,201,197,.34), transparent 70%); }


      /* ---------- layout ---------- */
      .tcx .wrap{ width:100%; max-width:var(--maxw); margin-inline:auto; padding-inline:var(--pad); position:relative; z-index:2; }
      .tcx section{ position:relative; z-index:2; }
      .tcx h1{ margin:0; letter-spacing:-.02em; line-height:1.06; font-weight:700; font-size:clamp(42px,6.4vw,82px); }
      .tcx :is(h1,h2,h3,h4){ font-family:var(--head); }
      .tcx .serif{ font-family:var(--serif); font-weight:400; font-style:normal; letter-spacing:-.01em; }
      .tcx .grad{
        background:linear-gradient(100deg, var(--mint) 0%, var(--cyan) 42%, var(--violet) 92%);
        -webkit-background-clip:text; background-clip:text; color:transparent;
      }
      .tcx .lede{ color:var(--ink-2); font-size:clamp(16px,1.35vw,19px); line-height:1.65; max-width:56ch; }
      /* Section labels: typed in colour by TypeLoop, same as the hero tagline.
         min-height keeps the heading below from jumping while a label is empty. */
      .tcx .eyebrow{ display:inline-flex; align-items:center; min-height:1.6em; font-size:15px; font-weight:650; white-space:pre; }
      @keyframes tcxPing{ 0%{box-shadow:0 0 0 0 rgba(0,201,197,.5)} 70%{box-shadow:0 0 0 10px rgba(0,201,197,0)} 100%{box-shadow:0 0 0 0 rgba(0,201,197,0)} }

      /* ---------- reveal ---------- */
      .tcx .rv{ opacity:0; transform:translateY(26px); transition:opacity .9s var(--ease-out), transform .9s var(--ease-out); }
      .tcx .rv.in{ opacity:1; transform:none; }
      .tcx .rv.d1{ transition-delay:.08s } .tcx .rv.d2{ transition-delay:.16s } .tcx .rv.d3{ transition-delay:.24s }
      .tcx .rv.d4{ transition-delay:.32s } .tcx .rv.d5{ transition-delay:.40s }

      /* ---------- buttons ---------- */
      .tcx .btn{
        --bh:52px;
        display:inline-flex; align-items:center; justify-content:center; gap:10px;
        height:var(--bh); padding:0 24px; border-radius:100px; border:1px solid transparent;
        font-weight:650; font-size:15px; letter-spacing:-.01em; cursor:pointer; position:relative;
        transition:transform .35s var(--ease-out), box-shadow .35s var(--ease), background .3s, border-color .3s, color .3s;
        white-space:nowrap; overflow:hidden; background:transparent;
      }
      .tcx .btn:active{ transform:scale(.97); }
      .tcx .btn-primary{
        color:#FFFFFF; background:linear-gradient(180deg,#16BEBA,#0A9A96);
        box-shadow:0 10px 30px -10px rgba(0,201,197,.65), inset 0 1px 0 rgba(255,255,255,.5);
      }
      .tcx .btn-primary:hover{ transform:translateY(-2px); box-shadow:0 18px 44px -12px rgba(0,201,197,.75), inset 0 1px 0 rgba(255,255,255,.6); }
      .tcx .btn-primary::after{
        content:""; position:absolute; inset:0; transform:translateX(-120%);
        background:linear-gradient(105deg, transparent, rgba(255,255,255,.55), transparent);
      }
      .tcx .btn-primary:hover::after{ animation:tcxSheen 1s var(--ease-out); }
      @keyframes tcxSheen{ to{ transform:translateX(120%);} }
      /* The hero "Book an appointment" — the one action the page exists for.
         A breathing glow ring, and the hover sheen replayed on its own every
         few seconds so the button catches the eye without being touched. */
      .tcx .btn-primary.cta-glow{ animation:tcxCtaGlow 2.8s ease-in-out infinite; }
      .tcx .btn-primary.cta-glow::after{ animation:tcxAutoSheen 4.5s ease-in-out 1.2s infinite; }
      .tcx .btn-primary.cta-glow:hover{ animation-play-state:paused; }
      @keyframes tcxCtaGlow{
        0%,100%{ box-shadow:0 0 0 0 rgba(0,201,197,.5), 0 10px 30px -10px rgba(0,201,197,.65), inset 0 1px 0 rgba(255,255,255,.5); }
        50%{ box-shadow:0 0 0 10px rgba(0,201,197,0), 0 16px 40px -10px rgba(0,201,197,.9), inset 0 1px 0 rgba(255,255,255,.5); }
      }
      @keyframes tcxAutoSheen{ 0%{ transform:translateX(-120%) } 30%,100%{ transform:translateX(120%) } }
      @media (prefers-reduced-motion:reduce){
        .tcx .btn-primary.cta-glow, .tcx .btn-primary.cta-glow::after,
        .tcx .nav-links .nav-magic, .tcx .nav-links .nav-magic > span[aria-hidden]{ animation:none; }
        .tcx .btn-primary.cta-glow{ box-shadow:0 0 0 4px rgba(0,201,197,.25), 0 14px 36px -10px rgba(0,201,197,.8); }
      }
      .tcx .btn-ghost{ border-color:var(--stroke-2); color:var(--ink); background:rgba(255,255,255,.75); backdrop-filter:blur(10px); }
      .tcx .btn-ghost:hover{ background:var(--card); border-color:rgba(15,39,66,.28); transform:translateY(-2px); }
      .tcx .btn-sm{ --bh:42px; padding:0 18px; font-size:14px; }
      .tcx .btn-lg{ --bh:58px; padding:0 32px; font-size:16px; }

      /* ---------- nav ---------- */
      .tcx .nav{ position:fixed; inset:14px 0 auto; z-index:60; display:flex; justify-content:center;
        transition:transform .5s var(--ease), opacity .4s; }
      .tcx .nav.hide{ transform:translateY(-140%); }
      .tcx .nav-inner{
        width:min(calc(100% - 32px), 1380px);
        display:flex; align-items:center; gap:12px;
        padding:11px 11px 11px 22px; border-radius:100px;
        border:1px solid var(--stroke); background:rgba(255,255,255,.72);
        backdrop-filter:blur(22px) saturate(160%);
        box-shadow:0 18px 44px -26px rgba(15,39,66,.40);
        transition:background .4s, border-color .4s, box-shadow .4s;
      }
      .tcx .nav.shrunk .nav-inner{ background:rgba(255,255,255,.93); border-color:rgba(15,39,66,.14); }
      .tcx .logo{ display:flex; align-items:center; gap:11px; font-weight:800; font-size:20px; letter-spacing:-.03em; background:none; border:0; cursor:pointer; padding:0; }
      .tcx .logo-img{ width:40px; height:40px; flex:none; object-fit:contain;
        filter:drop-shadow(0 4px 10px rgba(11,31,74,.22)); }
      .tcx .logo b{ color:var(--mint); font-weight:800; }
      .tcx .logo-lockup{ display:flex; flex-direction:column; align-items:flex-start; line-height:1.05; }
      .tcx .logo-line{ margin-top:3px; letter-spacing:0; }
      /* Phones: the header is already full; the tagline would push the
         login button off-screen (the console headers hide it too). */
      @media (max-width:560px){ .tcx .logo-line{ display:none; } }
      .tcx .nav-links{ display:flex; gap:4px; margin-left:auto; }
      .tcx .nav-links button,.tcx .nav-links a{
        padding:10px 14px; border-radius:100px; font-size:15.5px; font-weight:550; color:var(--ink-2);
        background:none; border:0; cursor:pointer; transition:color .25s, background .25s; white-space:nowrap;
      }
      .tcx .nav-links button:hover,.tcx .nav-links a:hover{ color:var(--ink); background:rgba(15,39,66,.06); }
      /* Shortcut to the health calculators. Tinted so it reads as a thing to try
         rather than another page link, but still a nav item — not a second CTA
         competing with "Log in / Sign up". */
      .tcx .nav-links .nav-magic{ display:inline-flex; align-items:center; gap:6px;
        color:var(--mint); font-weight:650; text-decoration:none;
        background:rgba(0,201,197,.10); border:1px solid rgba(10,154,150,.22); }
      .tcx .nav-links .nav-magic:hover{ color:#fff; border-color:transparent;
        background:linear-gradient(100deg, var(--mint-fill), var(--cyan)); }
      /* Highlighted (2026-09-19): filled by default rather than only on hover,
         with a slow glow pulse and a twinkling sparkle, so the calculators are
         found without hunting. The hover state just lifts it. */
      .tcx .nav-links .nav-magic{ color:#fff; border-color:transparent;
        background:linear-gradient(100deg, var(--mint-fill), var(--cyan));
        animation:tcxMagicGlow 2.6s ease-in-out infinite; }
      .tcx .nav-links .nav-magic:hover{ transform:translateY(-1px); filter:brightness(1.06); }
      .tcx .nav-links .nav-magic > span[aria-hidden]{ display:inline-block; animation:tcxTwinkle 2.6s ease-in-out infinite; }
      @keyframes tcxMagicGlow{
        0%,100%{ box-shadow:0 0 0 0 rgba(0,201,197,.45), 0 6px 18px -8px rgba(0,201,197,.6); }
        50%{ box-shadow:0 0 0 7px rgba(0,201,197,0), 0 10px 26px -6px rgba(0,201,197,.85); }
      }
      @keyframes tcxTwinkle{ 0%,100%{ transform:scale(1) rotate(0) } 50%{ transform:scale(1.25) rotate(15deg) } }
      .tcx .nav-cta{ display:flex; gap:9px; align-items:center; }
      .tcx .nav-cta .btn-sm{ --bh:46px; padding:0 20px; font-size:15.5px; }

      /* dropdowns keep the reference's glass, not the app's white menus */
      .tcx .menu{
        position:absolute; right:0; top:calc(100% + 10px); z-index:70; min-width:190px;
        border:1px solid var(--stroke); border-radius:var(--r-md); overflow:hidden;
        background:rgba(255,255,255,.98); backdrop-filter:blur(22px) saturate(160%);
        box-shadow:0 26px 60px -28px rgba(15,39,66,.40);
      }
      .tcx .menu button{
        display:flex; width:100%; align-items:center; gap:10px; padding:11px 15px; text-align:left;
        background:none; border:0; cursor:pointer; font-size:14px; color:var(--ink-2); transition:background .2s, color .2s;
      }
      .tcx .menu button:hover{ background:rgba(15,39,66,.05); color:var(--ink); }
      .tcx .menu button.on{ color:var(--mint); font-weight:700; }
      .tcx .menu .sub{ display:block; font-size:11.5px; color:var(--faint); }

      .tcx .burger{ display:none; width:42px; height:42px; border-radius:50%; border:1px solid var(--stroke);
        background:rgba(255,255,255,.75); align-items:center; justify-content:center; cursor:pointer; }
      .tcx .burger span{ display:block; width:16px; height:1.6px; background:var(--ink); border-radius:2px; position:relative; transition:.3s var(--ease); }
      .tcx .burger span::before,.tcx .burger span::after{ content:""; position:absolute; left:0; width:16px; height:1.6px; background:var(--ink); border-radius:2px; transition:.3s var(--ease); }
      .tcx .burger span::before{ top:-5px; } .tcx .burger span::after{ top:5px; }
      .tcx.menu-open .burger span{ background:transparent; }
      .tcx.menu-open .burger span::before{ transform:translateY(5px) rotate(45deg); }
      .tcx.menu-open .burger span::after{ transform:translateY(-5px) rotate(-45deg); }
      .tcx .mobile-menu{
        position:fixed; inset:0; z-index:55; background:rgba(246,251,250,.98); backdrop-filter:blur(20px);
        display:flex; flex-direction:column; justify-content:center; gap:6px; padding:0 var(--pad);
        opacity:0; visibility:hidden; transition:opacity .4s var(--ease), visibility .4s;
      }
      .tcx.menu-open .mobile-menu{ opacity:1; visibility:visible; }
      .tcx .mobile-menu button{ font-size:30px; font-weight:700; letter-spacing:-.03em; padding:14px 0;
        border:0; border-bottom:1px solid var(--stroke); background:none; text-align:left; cursor:pointer; color:var(--ink); }

      .tcx .mm-lang{ margin-top:22px; }
      .tcx .mm-lang-h{ display:block; font-size:12px; font-weight:700; letter-spacing:.13em;
        text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
      .tcx .mm-lang-row{ display:flex; flex-wrap:wrap; gap:10px; }
      .tcx .mobile-menu .mm-lang-row button{ font-size:17px; font-weight:650; letter-spacing:-.01em;
        padding:10px 20px; border:1px solid var(--stroke); border-radius:100px; color:var(--ink-2); }
      .tcx .mobile-menu .mm-lang-row button.on{ color:#fff; border-color:transparent;
        background:linear-gradient(100deg, var(--mint-fill), var(--cyan)); }

      /* ---------- hero ---------- */
      .tcx .hero{ padding:clamp(130px,15vw,180px) 0 clamp(50px,6vw,80px); position:relative; }
      .tcx .hero-grid{ display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr); gap:clamp(30px,4vw,56px); align-items:center; }
      .tcx .hero h1{ margin:22px 0 20px; font-size:clamp(38px,5.6vw,70px); }
      .tcx .hero-actions{ display:flex; flex-wrap:wrap; gap:12px; margin:28px 0 24px; }
      /* Hero tagline: typed out letter by letter, erased, typed again (TypeLoop).
         min-height keeps the headline from jumping while the line is empty. */
      .tcx .hero-type{ display:flex; align-items:center; min-height:1.6em; margin:0; font-size:16px; font-weight:650; white-space:pre; }
      /* TypeLoop text (hero tagline + section labels): brand colours (teal,
         blue, violet) flowing slowly through the letters. */
      .tcx .type-text{
        background:linear-gradient(90deg, var(--mint), var(--cyan), var(--violet), var(--mint));
        background-size:300% 100%; -webkit-background-clip:text; background-clip:text; color:transparent;
        animation:tcxTypeHue 6s linear infinite;
      }
      @keyframes tcxTypeHue{ to{ background-position:300% 0; } }
      .tcx .trust{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; color:var(--muted); font-size:13.5px; }
      .tcx .avatars{ display:flex; }
      .tcx .avatars i{
        width:34px; height:34px; border-radius:50%; border:2px solid var(--bg); margin-left:-11px;
        display:block; background:linear-gradient(140deg,#DCEDEC,#C3DBDE); position:relative;
      }
      .tcx .avatars i::after{ content:attr(data-i); position:absolute; inset:0; display:grid; place-items:center;
        font-size:11px; font-weight:700; color:var(--ink-2); font-style:normal; }
      .tcx .avatars i:first-child{ margin-left:0; }
      .tcx .stars{ color:var(--amber); letter-spacing:2px; font-size:13px; }

      .tcx .hero-visual{ position:relative; height:clamp(430px,50vw,540px); }
      /* The photo is atmosphere behind the three glass cards, not a hero image.
         The reference offset its mask to 60%/44% because its cards sat right of
         centre on a black page; here it is centred on the card stack and given a
         symmetric bleed, so it fills the middle of the visual column instead of
         drifting to one edge. */
      /* The photo is atmosphere behind the three glass cards, not a hero image.
         It is deliberately pulled UP and out of the column: the cards stack from
         roughly 36% downwards, so a photo centred on the column sat underneath
         them and left the top of the hero empty. The negative top / positive
         bottom inset lifts its centre of mass into that gap, where it reads as
         a backdrop to the headline instead of a smudge behind the cards. */
      .tcx .hero-photo{
        /* 2026-11-08: shifted left so the doctor's face is no longer under the
           Leave-home card and the family fills the gap beside the headline. */
        position:absolute; inset:-30% 12% 20% -28%; z-index:0; pointer-events:none;
        background-image:url("/hero.png"); background-size:cover; background-position:52% 40%; background-repeat:no-repeat;
        /* No grey and no horizontal fade — every face in this one is sharp, so
           there is nothing to hide. Contrast only, to keep the white coat from
           merging into the near-white page. */
        filter:contrast(1.04) saturate(1.02); opacity:.86;
        /* Strong through the middle, dissolving well before the boundary: the
           solid core stops at 26% and the falloff runs all the way to 84%, so
           the edges melt into the page instead of ending. */
        -webkit-mask-image:radial-gradient(62% 60% at 56% 46%, #000 32%, rgba(0,0,0,.45) 64%, transparent 84%);
                mask-image:radial-gradient(62% 60% at 56% 46%, #000 32%, rgba(0,0,0,.45) 64%, transparent 84%);
      }
      .tcx .glass{
        border:1px solid var(--stroke); background:linear-gradient(180deg, rgba(255,255,255,.88), rgba(255,255,255,.66));
        backdrop-filter:blur(20px) saturate(150%); border-radius:var(--r-lg);
        box-shadow:0 26px 60px -30px rgba(15,39,66,.32), inset 0 1px 0 rgba(255,255,255,.9);
      }
      .tcx .float{ position:absolute; will-change:transform; }
      .tcx .card-leave{ right:-4%; top:14%; width:min(340px,88%); padding:20px; z-index:3; }
      .tcx .card-doc{ left:-2%; top:36%; width:min(300px,80%); padding:16px; z-index:4; }
      .tcx .card-vitals{ right:6%; bottom:-7%; width:min(300px,80%); padding:16px 18px; z-index:2; }

      .tcx .kicker{ font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
      .tcx .leave-time{ font-size:42px; font-weight:800; letter-spacing:-.04em; line-height:1; margin:8px 0 4px; }
      .tcx .leave-time small{ font-size:17px; font-weight:600; color:var(--muted); margin-left:4px; letter-spacing:0; }
      .tcx .pill{ display:inline-flex; align-items:center; gap:7px; padding:5px 11px; border-radius:100px;
        font-size:11.5px; font-weight:650; border:1px solid var(--stroke); color:var(--ink-2); }
      .tcx .pill.good{ color:var(--mint); border-color:rgba(10,154,150,.28); background:rgba(0,201,197,.14); }
      .tcx .live-dot{ width:6px; height:6px; border-radius:50%; background:currentColor; animation:tcxPing 2.4s infinite; }

      .tcx .route-mini{ display:flex; align-items:center; gap:8px; margin-top:14px; padding-top:14px; border-top:1px dashed var(--stroke); }
      .tcx .route-mini .seg{ flex:1; text-align:center; }
      .tcx .route-mini .seg b{ display:block; font-size:14px; font-weight:700; }
      .tcx .route-mini .seg span{ font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
      .tcx .route-mini .arrow{ color:var(--faint); }

      .tcx .doc-row{ display:flex; align-items:center; gap:12px; }
      .tcx .doc-ava{ width:46px; height:46px; border-radius:14px; flex:none; border:1px solid var(--stroke);
        display:grid; place-items:center; font-weight:800; font-size:15px; color:#04130E;
        background:linear-gradient(145deg,#16C7C2,#0A9A96); }
      .tcx .doc-row b{ display:block; font-size:15px; letter-spacing:-.01em; }
      .tcx .doc-row .who{ font-size:12.5px; color:var(--muted); }
      .tcx .dateline{ display:flex; gap:6px; margin-top:12px; }
      .tcx .dateline i{ flex:1; text-align:center; font-style:normal; font-size:11.5px; font-weight:600;
        padding:7px 0; border-radius:8px; border:1px solid var(--stroke); color:var(--ink-2); }
      .tcx .dateline i.on{ background:var(--mint-fill); color:#FFFFFF; border-color:transparent; }

      .tcx .ecg{ width:100%; height:52px; margin-top:4px; }
      .tcx .ecg path{ fill:none; stroke:var(--mint); stroke-width:2; stroke-linecap:round; stroke-linejoin:round;
        filter:drop-shadow(0 0 5px rgba(0,201,197,.45)); stroke-dasharray:520; stroke-dashoffset:520; animation:tcxTrace 3.4s linear infinite; }
      @keyframes tcxTrace{ to{ stroke-dashoffset:-520; } }
      /* the hero's ledger card — a button, so it needs button resets */
      .tcx .card-ledger{ display:flex; flex-direction:column; gap:6px; text-align:left; cursor:pointer;
        font:inherit; color:inherit; transition:transform .35s var(--ease-out), box-shadow .35s var(--ease); }
      .tcx .card-ledger:hover{ transform:translateY(-3px);
        box-shadow:0 34px 70px -30px rgba(15,39,66,.4), inset 0 1px 0 rgba(255,255,255,.9); }
      .tcx .hxc-top{ display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .tcx .hxc-num{ font-size:34px; font-weight:800; letter-spacing:-.04em; line-height:1; color:var(--mint);
        font-variant-numeric:tabular-nums; }
      .tcx .hxc-num small{ font-size:13px; font-weight:600; color:var(--muted); letter-spacing:-.01em; }
      .tcx .hxc-cta{ display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700;
        color:var(--mint); margin-top:2px; }
      .tcx .vitals-row{ display:flex; justify-content:space-between; align-items:baseline; }
      .tcx .vitals-row b{ font-size:24px; font-weight:800; letter-spacing:-.03em; }
      .tcx .vitals-row b i{ font-size:12px; font-style:normal; color:var(--muted); font-weight:600; }

      /* ---------- booking bar ---------- */
      .tcx .bookbar{ display:grid; grid-template-columns:1.2fr 1fr auto; gap:6px; align-items:center; padding:8px; border-radius:100px; }
      .tcx .bookbar .fld{ padding:8px 16px; border-radius:100px; transition:background .25s; min-width:0; }
      /* White at 5% over white glass is invisible — the hover has to darken. */
      .tcx .bookbar .fld:hover{ background:rgba(15,39,66,.05); }
      .tcx .bookbar label{ display:block; font-size:11.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
      .tcx .bookbar input,.tcx .bookbar select{
        width:100%; background:transparent; border:0; outline:none; font-size:14.5px; font-weight:600;
        letter-spacing:-.01em; padding:2px 0; min-width:0; cursor:pointer;
      }
      .tcx .bookbar select option{ background:var(--card); color:var(--ink); }
      .tcx .bookbar input::placeholder{ color:var(--faint); }



      /* ============================================================
         SECTION SHELL
         ============================================================ */
      .tcx h2{ margin:0; font-size:clamp(32px,4.4vw,56px); line-height:1.08; letter-spacing:-.02em; font-weight:700; }
      .tcx h3{ margin:0; font-size:clamp(20px,2.2vw,26px); line-height:1.2; letter-spacing:-.02em; font-weight:700; }
      .tcx .sec{ padding:clamp(70px,9vw,120px) 0; }
      .tcx .sec-head{ display:flex; flex-direction:column; gap:18px; align-items:flex-start; margin-bottom:clamp(36px,5vw,64px); }
      .tcx .sec-head.center{ align-items:center; text-align:center; }
      .tcx .sec-head.center .lede{ text-align:center; }
      .tcx .pill.warn{ color:var(--amber); border-color:rgba(201,122,22,.3); background:rgba(255,183,101,.16); }
      .tcx .pill.bad{ color:var(--rose); border-color:rgba(225,67,86,.3); background:rgba(255,122,138,.14); }

      /* ============================================================
         LEAVE-NOW — "The Line"
         Ported from the reference's assets/leave.css. The whole section is one
         vertical line: a hairline spine with a mint fill that grows as you
         scroll, station dots that light as it passes them, and four numbered
         stops hung off it. Only the surface colours move for light paper.
         ============================================================ */
      .tcx .leavenow{ padding:clamp(70px,9vw,120px) 0; }
      .tcx .lnl{ position:relative; margin-top:clamp(26px,4vw,52px);
        --lnl-spine:clamp(10px,3.5vw,64px); --lnl-gap:clamp(22px,3.2vw,54px);
        --lnl-content:calc(var(--lnl-spine) + var(--lnl-gap));
        --lnl-pad:clamp(38px,5vw,74px);
        --lnl-serif:var(--head); }

      .tcx .lnl-spine{ position:absolute; left:var(--lnl-spine); top:0; bottom:0; width:1px;
        background:rgba(11,33,80,.10); z-index:0; }
      .tcx .lnl-spine i{ position:absolute; left:0; top:0; width:1px; display:block;
        background:linear-gradient(180deg, rgba(0,201,197,0) 0%, var(--mint) 7%, var(--mint) 100%);
        box-shadow:0 0 22px 1px rgba(0,201,197,.45); transition:height .25s linear; }

      .tcx .lnl-st{ position:relative; z-index:1; padding-left:var(--lnl-content); padding-block:var(--lnl-pad); }
      .tcx .lnl-st.lnl-open{ padding-top:clamp(12px,2vw,24px); }
      .tcx .lnl-st.lnl-last{ padding-bottom:clamp(28px,4vw,54px); }

      .tcx .lnl-dot{ position:absolute; left:var(--lnl-spine); top:calc(var(--lnl-pad) + 11px);
        width:9px; height:9px; margin-left:-4px; border-radius:50%;
        background:var(--bg); border:1px solid rgba(11,33,80,.24);
        transition:background .5s var(--ease-out), border-color .5s var(--ease-out), box-shadow .5s var(--ease-out); }
      .tcx .lnl-open .lnl-dot{ top:calc(clamp(12px,2vw,24px) + 9px); }
      .tcx .lnl-dot.lit{ background:var(--mint); border-color:var(--mint); box-shadow:0 0 0 5px rgba(0,201,197,.18); }

      .tcx .lnl-conn{ position:absolute; left:var(--lnl-spine); width:var(--lnl-gap); height:1px;
        top:calc(var(--lnl-pad) + 15px);
        background:linear-gradient(90deg, var(--mint), rgba(0,201,197,.12)); }

      .tcx .lnl-tag{ display:block; font-family:var(--mono); font-size:11.5px; text-transform:uppercase;
        letter-spacing:.16em; color:var(--muted); margin-bottom:20px; }
      .tcx .lnl-tag b{ color:var(--mint); font-weight:400; }
      .tcx .lnl-h{ font-family:var(--lnl-serif); font-weight:400; letter-spacing:-.015em;
        font-size:clamp(27px,3.6vw,46px); line-height:1.08; margin:0 0 14px; max-width:16ch; }
      .tcx .lnl-p{ color:var(--ink-2); max-width:52ch; margin:0 0 30px; font-size:16px; line-height:1.6; }

      .tcx .lnl-now{ font-family:var(--mono); font-size:15px; color:var(--ink-2); margin:0 0 26px; letter-spacing:.02em; }
      .tcx .lnl-pre{ font-size:12.5px; font-weight:600; text-transform:uppercase; letter-spacing:.22em;
        color:var(--ink-2); margin:0 0 6px; }
      .tcx .lnl-big{ font-family:var(--lnl-serif); font-weight:400; font-size:clamp(76px,13.5vw,196px);
        line-height:.82; letter-spacing:-.035em; color:var(--ink); transition:color .6s var(--ease-out); }
      .tcx .lnl-big small{ font-family:inherit; font-size:.17em; font-weight:400; color:var(--faint);
        margin-left:.1em; letter-spacing:0; }
      .tcx .lnl-st.is-warn .lnl-big{ color:#C97A16; }
      .tcx .lnl-st.is-bad .lnl-big{ color:#E14356; }
      .tcx .lnl-cd{ font-family:var(--mono); font-size:13px; color:var(--ink-2); margin:24px 0 0; letter-spacing:-.01em; }
      .tcx .lnl-cd b{ color:var(--mint); font-weight:600; }
      .tcx .lnl-meta{ font-family:var(--mono); font-size:11.5px; color:var(--muted); margin:12px 0 0;
        text-transform:uppercase; letter-spacing:.12em; }
      .tcx .lnl-day{ font-family:var(--mono); font-size:12px; letter-spacing:.14em; text-transform:uppercase;
        color:#C97A16; margin:14px 0 0; }
      .tcx .lnl .ln-panel{ padding:0; border-radius:0; display:block; gap:0; background:none; border:0; margin-top:26px; }
      .tcx .lnl .ln-panel h3{ font-family:var(--lnl-serif); font-weight:400; font-size:22px;
        letter-spacing:-.01em; margin:0; color:var(--ink-2); }

      /* 01 — modes as serif words, not buttons */
      .tcx .lnl-modes{ display:flex; flex-wrap:wrap; gap:0 clamp(20px,2.8vw,40px); margin:0 0 40px; }
      .tcx .lnl-mode{ font-family:var(--lnl-serif); font-size:clamp(24px,3.2vw,42px); line-height:1.5;
        background:none; border:0; border-bottom:1px solid transparent; color:var(--faint); cursor:pointer;
        padding:0 0 6px; letter-spacing:-.015em;
        transition:color .3s var(--ease-out), border-color .3s var(--ease-out); }
      .tcx .lnl-mode:hover{ color:var(--ink-2); }
      .tcx .lnl-mode[aria-pressed="true"]{ color:var(--ink); border-bottom-color:var(--mint); }

      /* 01 — fields are underlines, not glass boxes */
      .tcx .lnl-fields{ display:grid; grid-template-columns:repeat(auto-fit,minmax(215px,1fr));
        gap:26px 34px; max-width:820px; margin-bottom:38px; }
      .tcx .lnl-f{ position:relative; display:grid; gap:7px; align-content:start; }
      .tcx .lnl-f label{ font-family:var(--mono); font-size:11px; text-transform:uppercase;
        letter-spacing:.15em; color:var(--muted); }
      .tcx .lnl-f input{ font-family:inherit; font-size:16.5px; color:var(--ink); background:none;
        border:0; border-bottom:1px solid var(--stroke); padding:8px 0; width:100%; border-radius:0;
        transition:border-color .3s; }
      .tcx .lnl-f input:focus{ outline:0; border-bottom-color:var(--mint); }
      .tcx .lnl-f input::placeholder{ color:var(--faint); }

      .tcx .lnl-read{ margin:0; display:grid; max-width:520px; }
      .tcx .lnl-read div{ display:flex; justify-content:space-between; gap:20px; padding:13px 0;
        border-top:1px solid rgba(11,33,80,.09); font-family:var(--mono); font-size:12px;
        text-transform:uppercase; letter-spacing:.13em; }
      .tcx .lnl-read dt{ color:var(--muted); }
      .tcx .lnl-read dd{ margin:0; color:var(--ink); font-weight:500; }

      /* 02 — the map runs off the right edge of the screen */
      /* The reference bleeds this off the right edge, but our map is an image
         with the hospital AT its right edge — bleeding it pushed the destination
         off-screen. Contained, so both ends of the journey are visible. */
      .tcx .lnl-map{ position:relative; overflow:hidden; border-radius:var(--r-md);
        aspect-ratio:1419 / 475; height:auto; width:100%;
        border:1px solid var(--stroke); box-shadow:0 20px 46px -30px var(--shadow); }
      .tcx .lnl-map .map-demo{ position:absolute; inset:0;
        background:radial-gradient(120% 90% at 20% 10%, #F1FAF9 0%, #E2F1EF 60%, #D8EBE9 100%); }
      .tcx .lnl-map .map-demo svg{ width:100%; height:100%; display:block; }

      .tcx .lnl-map #demoPath{ filter:drop-shadow(0 0 9px rgba(0,201,197,.5)); }
      /* Overlaid it sat on top of the streets and was hard to read; below the
         map it reads as a caption. */
      .tcx .lnl-maptag{ position:static; margin:14px 0 0; z-index:2;
        display:flex; flex-wrap:wrap; gap:6px 22px; font-family:var(--mono); font-size:11.5px;
        letter-spacing:.06em; text-transform:uppercase; color:var(--ink-2); }
      .tcx .lnl-maptag b{ color:var(--ink); font-weight:500; }
      .tcx .lnl-maptag .jam{ color:#C97A16; }

      /* apartment blocks: three tones for volume, a window grid, a parapet lip
         and a rooftop water tank on the tall ones */
      .tcx .bldg{ stroke:#C4DCD9; stroke-width:.8; stroke-linejoin:round; }
      .tcx .b-roof{ fill:#FFFFFF; }
      .tcx .b-roof.tall{ fill:#F6FCFB; }
      .tcx .b-face{ fill:#EAF4F2; }
      .tcx .b-side{ fill:#D4E6E3; }
      .tcx .b-win{ fill:#C2D9D7; stroke:none; }
      .tcx .b-win.on{ fill:#8FCFCB; }
      .tcx .b-parapet{ stroke:#B4D2CE; stroke-width:1.4; }
      .tcx .b-tank{ fill:#D4E6E3; stroke:#B4D2CE; stroke-width:.8; }
      /* the home pin we draw over the image (the hospital's is painted in) */
      .tcx .map-pin .pin-card{ fill:#FFFFFF; stroke:#E2E6E1; stroke-width:1;
        filter:drop-shadow(0 8px 16px rgba(15,39,66,.28)); }
      .tcx .map-pin .pin-tail{ fill:#FFFFFF; }
      .tcx .map-pin .pin-cap{ fill:var(--mint); stroke:#FFFFFF; stroke-width:3; }
      .tcx .map-pin .pin-home{ fill:none; stroke:var(--mint); stroke-width:2.6;
        stroke-linecap:round; stroke-linejoin:round; }
      .tcx .map-pin .pin-name{ font:700 15px var(--sans); fill:var(--ink); }
      .tcx .map-pin .pin-sub{ font:500 12px var(--sans); fill:var(--muted); }

      /* ---------- the street map ---------- */
      .tcx .map-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain;
        display:block; }
      /* the moving segment */
      .tcx .map-run{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
      /* The image's centre dashes are painted on and static. This lays the same
         dash pattern over them and flows it, so the whole route runs rather
         than one segment sweeping along it. Slightly wider than the baked
         dashes so it covers them instead of doubling up. */
      .tcx .run-comet{ fill:none; stroke:#FFFFFF; stroke-width:4; stroke-linecap:butt;
        stroke-dasharray:13 11; animation:tcxRun 1.1s linear infinite; }
      @keyframes tcxRun{ to{ stroke-dashoffset:-24 } }
      @media (prefers-reduced-motion:reduce){ .tcx .run-comet{ animation:none; opacity:0 } }

      /* 03 — the timeline */
      .tcx .lnl .timeline{ max-width:640px; display:flex; flex-direction:column; }
      .tcx .tl-item{ display:grid; grid-template-columns:74px 22px 1fr auto; gap:12px; align-items:center; padding:9px 0; }
      .tcx .tl-time{ font-family:var(--mono); font-size:12.5px; font-weight:600; color:var(--ink-2); letter-spacing:-.02em; }
      .tcx .tl-rail{ position:relative; height:100%; display:grid; place-items:center; }
      .tcx .tl-rail::before{ content:""; position:absolute; top:-14px; bottom:-14px; width:1px; background:var(--stroke); }
      .tcx .tl-item:first-child .tl-rail::before{ top:50%; }
      .tcx .tl-item:last-child .tl-rail::before{ bottom:50%; }
      .tcx .tl-dot{ width:9px; height:9px; border-radius:50%; background:var(--card); border:2px solid var(--faint); position:relative; z-index:1; }
      .tcx .tl-item.hot .tl-dot{ background:var(--mint-fill); border-color:var(--mint); box-shadow:0 0 0 4px rgba(0,201,197,.20); }
      .tcx .tl-label{ font-size:14px; font-weight:600; letter-spacing:-.01em; }
      .tcx .tl-label span{ display:block; font-size:11.5px; color:var(--muted); font-weight:500; }
      .tcx .tl-dur{ font-size:12px; color:var(--muted); font-weight:600; white-space:nowrap; }
      .tcx .lnl .ln-note{ max-width:52ch; margin:24px 0 0; font-size:12.5px; color:var(--muted); line-height:1.6; }
      .tcx .lnl .ln-note b{ color:var(--ink-2); font-weight:600; }
      /* 2026-11-08 leave-time fixes: clock + appointment card side by side, times
         that add up (start + "to end"), minute chips next to each step. */
      .tcx .lnl-openGrid{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,400px); gap:clamp(24px,4vw,56px); align-items:center; }
      @media (max-width:900px){ .tcx .lnl-openGrid{ grid-template-columns:1fr; } }
      .tcx .lnl-cd{ font-family:var(--sans); font-size:17px; }
      .tcx .lnl-chips{ display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 0; }
      .tcx .ln-chip{ font-style:normal; font-size:13.5px; font-weight:600; border-radius:999px; padding:3px 11px; background:rgba(10,154,150,.12); color:var(--mint); white-space:nowrap; letter-spacing:0; }
      .tcx .ln-chip.warn{ background:rgba(201,122,22,.14); color:#B86E10; }
      .tcx .ln-chip.plain{ background:var(--card); color:var(--ink-2); box-shadow:inset 0 0 0 1px var(--stroke); }
      .tcx .ln-appt{ padding:20px; border-radius:var(--r-md); display:grid; gap:14px; }
      .tcx .ln-appt-row{ display:flex; gap:12px; align-items:center; }
      .tcx .ln-appt-row b{ display:block; font-family:var(--head); font-size:17px; }
      .tcx .ln-appt-row .who{ display:block; font-size:14px; color:var(--muted); }
      .tcx .ln-appt-facts{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:0; padding-top:14px; border-top:1px dashed var(--stroke); }
      .tcx .ln-appt-facts dt{ font-size:12.5px; color:var(--muted); }
      .tcx .ln-appt-facts dd{ margin:0; font-family:var(--head); font-weight:700; font-size:17px; color:var(--ink); }
      .tcx .lnl .timeline{ max-width:680px; }
      .tcx .tl-item{ grid-template-columns:112px 26px 1fr; align-items:start; padding:13px 0; }
      .tcx .tl-time{ font-family:var(--head); font-size:16px; font-weight:700; color:var(--ink); white-space:nowrap; }
      .tcx .tl-time small{ display:block; font-family:var(--sans); font-size:13px; font-weight:500; color:var(--muted); }
      .tcx .tl-rail{ padding-top:6px; }
      .tcx .tl-item.turn .tl-dot{ background:var(--cyan); border-color:var(--cyan); }
      .tcx .tl-label .tl-title{ display:flex !important; flex-wrap:wrap; align-items:center; gap:6px 10px; font-family:var(--head); font-size:18px; font-weight:700; color:var(--ink) !important; }
      .tcx .tl-label > span:last-child{ font-size:15px; color:var(--ink-2); font-weight:400; margin-top:2px; }
      .tcx .lnl .ln-note{ max-width:60ch; font-size:15px; color:var(--ink-2); padding:13px 16px; border-radius:14px; background:rgba(10,154,150,.10); }
      @media (max-width:560px){ .tcx .tl-item{ grid-template-columns:84px 20px 1fr; gap:10px; } }
      .tcx .lnl-acts{ display:flex; gap:10px; flex-wrap:wrap; margin-top:32px; }

      .tcx .ln-feats{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:20px; }
      .tcx .feat{ padding:20px; border-radius:var(--r-md); border:1px solid var(--stroke); background:var(--panel); transition:.4s var(--ease); }
      .tcx .feat:hover{ background:var(--panel-2); border-color:var(--stroke-2); transform:translateY(-4px); }
      .tcx .feat .ic{ width:38px; height:38px; border-radius:11px; display:grid; place-items:center; margin-bottom:12px;
        background:rgba(0,201,197,.14); border:1px solid rgba(10,154,150,.24); color:var(--mint); }
      .tcx .feat b{ display:block; font-size:15px; letter-spacing:-.015em; margin-bottom:5px; }
      .tcx .feat p{ margin:0; font-size:13px; color:var(--muted); line-height:1.55; }

      @media (max-width:700px){
        .tcx .lnl{ --lnl-spine:6px; --lnl-gap:20px; }
        .tcx .lnl-h{ max-width:none; }
        .tcx .lnl-modes{ gap:0 20px; }
        .tcx .lnl-maptag{ font-size:10.5px; }
      }

      /* ============================================================
         SPECIALTIES / DOCTORS
         ============================================================ */
      /* Specialties is a short section — eight one-line tiles. The page's
         default section chrome (115px of padding each side, a 64px gap under
         the heading) was costing more height than the content, so this one
         section gets tighter chrome. Scoped by id: every other section keeps
         the original rhythm. */
      .tcx #specialties{ padding:clamp(40px,4.4vw,58px) 0; }
      .tcx #specialties .sec-head{ gap:10px; margin-bottom:clamp(20px,2.4vw,30px); }
      .tcx #specialties .sec-head h2{ font-size:clamp(26px,3vw,38px); }
      .tcx .spec-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
      .tcx .spec{ position:relative; padding:14px 14px 13px; border-radius:var(--r-md); border:1px solid var(--stroke);
        background:var(--panel); cursor:pointer; overflow:hidden; transition:.45s var(--ease); text-align:left; font:inherit; color:inherit; }
      .tcx .spec::after{ content:""; position:absolute; inset:0; opacity:0; transition:opacity .45s;
        background:radial-gradient(120% 100% at 50% 0%, rgba(0,201,197,.20), transparent 65%); }
      .tcx .spec:hover{ transform:translateY(-6px); border-color:var(--stroke-2); }
      .tcx .spec:hover::after{ opacity:1; }
      /* Icon on the left, name + "Book today" beside it (was stacked under the icon). */
      .tcx .spec{ display:grid; grid-template-columns:auto 1fr; column-gap:12px; align-items:center; }
      .tcx .spec .em{ grid-column:1; grid-row:1 / span 2; font-size:26px; line-height:1; display:block; position:relative; }
      .tcx .spec b{ grid-column:2; display:block; font-size:14.5px; letter-spacing:-.015em; position:relative; padding-right:18px; }
      .tcx .spec > span:last-child{ grid-column:2; font-size:11.5px; color:var(--muted); position:relative; }
      .tcx .spec .go{ position:absolute; right:12px; top:13px; opacity:0; transform:translateX(-6px);
        transition:.4s var(--ease); color:var(--mint); z-index:1; }
      .tcx .spec:hover .go{ opacity:1; transform:none; }

      .tcx .doc-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
      .tcx .doc-card{ padding:16px; border-radius:var(--r-lg); border:1px solid var(--stroke); background:var(--panel);
        transition:.45s var(--ease); display:flex; flex-direction:column; gap:9px; }
      .tcx .doc-card:hover{ transform:translateY(-6px); border-color:var(--stroke-2); background:var(--panel-2); }
      .tcx .doc-head{ display:flex; gap:11px; align-items:center; }
      .tcx .doc-photo{ width:46px; height:46px; border-radius:14px; flex:none; display:grid; place-items:center;
        font-weight:800; font-size:16px; color:#FFFFFF; }
      .tcx .doc-meta b{ display:block; font-size:15px; letter-spacing:-.02em; }
      .tcx .doc-meta span{ display:block; font-size:12.5px; color:var(--muted); line-height:1.45; }
      /* One line: stars, rating, reviews, experience, and today's availability. */
      .tcx .doc-rate{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:0; }
      .tcx .doc-stars{ display:inline-flex; gap:1px; letter-spacing:-.5px; }
      .tcx .doc-stars i{ font-style:normal; font-size:12px; color:rgba(15,39,66,.18); line-height:1; }
      .tcx .doc-stars i.on{ color:#F5A623; }
      .tcx .doc-rate > b{ font:700 13px/1 var(--sans); color:var(--ink); }
      .tcx .doc-rev{ font:500 12px/1 var(--sans); color:var(--muted); }
      .tcx .doc-dot{ color:var(--muted); font-size:12px; line-height:1; }
      .tcx .doc-free{ font:650 11px/1 var(--sans); color:var(--mint); text-transform:uppercase; letter-spacing:.06em;
        padding:4px 8px; border-radius:999px; background:rgba(0,201,197,.12); border:1px solid rgba(10,154,150,.22); }
      .tcx .doc-langs{ margin:0; font-size:12px; color:var(--muted); line-height:1.4; }
      .tcx .doc-foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:auto;
        padding-top:9px; border-top:1px solid var(--stroke); }
      .tcx .fee{ font-size:12.5px; color:var(--muted); }
      .tcx .fee b{ color:var(--ink); font-size:15.5px; font-weight:750; letter-spacing:-.02em; }

      /* ============================================================
         STATS / QUOTES
         ============================================================ */
      .tcx .stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--stroke);
        border:1px solid var(--stroke); border-radius:var(--r-lg); overflow:hidden; }
      .tcx .stat{ background:var(--card); padding:clamp(14px,1.8vw,20px); text-align:center; transition:background .4s; }
      .tcx .stat:nth-child(odd){ background:var(--card-2); }
      .tcx .stat:hover{ background:var(--card-3); }
      .tcx .stat b{ display:block; font-size:clamp(22px,2.6vw,32px); font-weight:800; letter-spacing:-.04em;
        line-height:1; font-variant-numeric:tabular-nums; }
      .tcx .stat span{ display:block; margin-top:5px; font-size:12px; color:var(--muted); }

      .tcx .quotes{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
      .tcx .quote{ padding:26px; border-radius:var(--r-lg); border:1px solid var(--stroke); background:var(--panel);
        display:flex; flex-direction:column; gap:16px; transition:.45s var(--ease); }
      .tcx .quote:hover{ transform:translateY(-5px); background:var(--panel-2); border-color:var(--stroke-2); }
      .tcx .quote p{ margin:0; font-size:15.5px; line-height:1.65; color:var(--ink-2); letter-spacing:-.01em; }
      /* The CSS escape \\201C cannot be written raw here — inside a JS template
         literal it parses as a legacy octal escape and fails the build. The
         literal character does the same job. */
      .tcx .quote p::before{ content:"“"; font-family:var(--serif); font-size:44px; color:var(--mint);
        line-height:0; vertical-align:-8px; margin-right:4px; }
      .tcx .quote-by{ display:flex; align-items:center; gap:11px; margin-top:auto; }
      .tcx .quote-by .ava{ width:40px; height:40px; border-radius:50%; display:grid; place-items:center;
        font-weight:800; font-size:14px; color:#FFFFFF; flex:none; }
      .tcx .quote-by b{ display:block; font-size:14px; letter-spacing:-.01em; }
      .tcx .quote-by span span{ font-size:12px; color:var(--muted); }

      /* ============================================================
         APP / PHONE - the handset stays DARK on purpose: it reads as a real
         device against the light page, so its internals keep dark-theme colours
         rather than inheriting the page tokens (which would go invisible).
         ============================================================ */
      /* Bottom padding is small because the CTA section that follows sets
         paddingTop:0 — it used to rely on the FAQ section in between to supply
         the gap, and that section is gone. */
      .tcx .app-sec{ padding:clamp(70px,9vw,120px) 0 clamp(28px,3.2vw,44px); }
      .tcx .app-grid{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,.85fr); gap:clamp(30px,5vw,70px); align-items:center; }
      .tcx .checks{ display:flex; flex-direction:column; gap:14px; margin:26px 0 30px; }
      .tcx .check{ display:flex; gap:12px; align-items:flex-start; }
      .tcx .check .tick{ width:24px; height:24px; border-radius:50%; flex:none; display:grid; place-items:center;
        background:rgba(0,201,197,.18); border:1px solid rgba(10,154,150,.3); color:var(--mint); margin-top:1px; }
      .tcx .check b{ display:block; font-size:15px; letter-spacing:-.015em; }
      .tcx .check span span{ font-size:13.5px; color:var(--muted); }
      .tcx .stores{ display:flex; gap:12px; flex-wrap:wrap; }

      .tcx .phone-stage{ position:relative; display:grid; place-items:center; }
      .tcx .phone{ width:min(300px,80%); aspect-ratio:9/19.2; border-radius:44px; padding:11px; position:relative;
        background:linear-gradient(160deg,#20304A,#0F1B2E); border:1px solid rgba(15,39,66,.22);
        box-shadow:0 50px 90px -40px rgba(15,39,66,.55), inset 0 1px 0 rgba(255,255,255,.18); }
      .tcx .phone-screen{ width:100%; height:100%; border-radius:34px; overflow:hidden;
        background:linear-gradient(180deg,var(--card) 0%,var(--bg) 100%);
        position:relative; display:flex; flex-direction:column; color:var(--ink); }
      .tcx .notch{ position:absolute; top:9px; left:50%; transform:translateX(-50%); width:76px; height:22px;
        border-radius:100px; background:#0F1B2E; z-index:5; }
      .tcx .ph-top{ padding:34px 18px 12px; }
      .tcx .ph-hello{ font-size:11px; color:var(--muted); }
      .tcx .ph-name{ font-size:17px; font-weight:750; letter-spacing:-.02em; }
      .tcx .ph-card{ margin:0 14px; padding:14px; border-radius:18px;
        background:linear-gradient(150deg, rgba(0,201,197,.16), rgba(51,105,255,.08)); border:1px solid rgba(10,154,150,.30); }
      .tcx .ph-card .kicker{ font-size:9px; color:var(--mint); }
      .tcx .ph-card .t{ font-size:28px; font-weight:800; letter-spacing:-.04em; line-height:1.05; margin:4px 0 2px;
        font-variant-numeric:tabular-nums; }
      .tcx .ph-card .s{ font-size:11px; color:var(--ink-2); }
      .tcx .ph-map{ margin:12px 14px 0; height:110px; border-radius:16px; border:1px solid var(--stroke-2);
        overflow:hidden; position:relative; background:var(--map); }
      .tcx .ph-map svg{ width:100%; height:100%; }
      .tcx .ph-list{ padding:12px 14px; display:flex; flex-direction:column; gap:8px; }
      .tcx .ph-row{ display:flex; align-items:center; gap:10px; padding:10px; border-radius:14px;
        background:var(--card); border:1px solid var(--stroke-2); }
      .tcx .ph-row .ic{ width:30px; height:30px; border-radius:9px; display:grid; place-items:center;
        background:rgba(51,105,255,.12); color:var(--violet); flex:none; }
      .tcx .ph-row b{ display:block; font-size:11.5px; letter-spacing:-.01em; }
      .tcx .ph-row span span{ font-size:10px; color:var(--muted); }
      .tcx .ph-tabs{ margin-top:auto; display:flex; justify-content:space-around; padding:12px 0 18px;
        border-top:1px solid var(--stroke-2); background:rgba(255,255,255,.7); }
      .tcx .ph-tabs i{ width:22px; height:22px; border-radius:7px; background:rgba(15,39,66,.12); display:block; }
      .tcx .ph-tabs i.on{ background:var(--mint-fill); box-shadow:0 0 14px rgba(0,201,197,.6); }
      .tcx .phone-glow{ position:absolute; width:70%; height:60%; border-radius:50%; filter:blur(80px);
        background:rgba(0,201,197,.30); z-index:0; }

      /* ============================================================
         FAQ / CTA / FOOTER
         ============================================================ */
      /* ---- FAQ ---- */
      .tcx .faq-wrap{ max-width:880px; margin:0 auto; }
      .tcx .faq-tabs{
        display:flex; gap:6px; padding:6px; margin:0 auto 26px; width:fit-content; max-width:100%;
        background:var(--card); border:1px solid var(--stroke); border-radius:999px; overflow-x:auto;
      }
      .tcx .faq-tab{
        flex:0 0 auto; padding:9px 20px; border:0; border-radius:999px; background:transparent;
        font:600 14.5px/1 var(--sans); letter-spacing:-.01em; color:var(--muted); cursor:pointer;
        transition:color .18s ease, background .18s ease, box-shadow .18s ease;
      }
      .tcx .faq-tab:hover{ color:var(--ink); }
      .tcx .faq-tab.on{
        color:#fff; background:linear-gradient(135deg,var(--mint) 0%,var(--cyan) 100%);
        box-shadow:0 4px 14px -4px rgba(10,154,150,.5);
      }
      .tcx .faq{ display:flex; flex-direction:column; border-top:1px solid var(--stroke); }
      .tcx .faq-row{ border-bottom:1px solid var(--stroke); }
      .tcx .faq-q{
        display:flex; align-items:center; gap:20px; width:100%; padding:22px 4px;
        border:0; background:none; text-align:left; cursor:pointer;
        font:600 clamp(16px,1.35vw,18px)/1.4 var(--sans); letter-spacing:-.015em; color:var(--ink);
        transition:color .18s ease;
      }
      .tcx .faq-q span{ flex:1; }
      .tcx .faq-q:hover{ color:var(--mint); }
      .tcx .faq-mark{
        flex:0 0 auto; position:relative; width:15px; height:15px;
        transition:transform .3s cubic-bezier(.4,0,.2,1);
      }
      .tcx .faq-mark::before,
      .tcx .faq-mark::after{
        content:''; position:absolute; inset:50% 0 auto 0; height:1.5px; margin-top:-.75px;
        background:var(--mint); border-radius:2px; transition:opacity .3s ease, transform .3s ease;
      }
      .tcx .faq-mark::after{ transform:rotate(90deg); }
      .tcx .faq-row.on .faq-mark{ transform:rotate(180deg); }
      .tcx .faq-row.on .faq-mark::after{ opacity:0; }
      .tcx .faq-a{
        display:grid; grid-template-rows:0fr; transition:grid-template-rows .32s cubic-bezier(.4,0,.2,1);
      }
      .tcx .faq-row.on .faq-a{ grid-template-rows:1fr; }
      .tcx .faq-a > p{
        overflow:hidden; margin:0; padding:0 44px 0 4px;
        font:400 clamp(14.5px,1.15vw,15.75px)/1.72 var(--sans); color:var(--ink-2);
        opacity:0; transition:opacity .28s ease, padding .32s cubic-bezier(.4,0,.2,1);
      }
      .tcx .faq-row.on .faq-a > p{ opacity:1; padding-bottom:24px; }
      .tcx .faq-contact{
        display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap;
        margin-top:40px; padding:24px 28px; border:1px solid var(--stroke); border-radius:18px;
        background:linear-gradient(135deg,rgba(0,201,197,.07) 0%,rgba(51,105,255,.06) 100%);
      }
      .tcx .faq-contact-copy{ display:flex; flex-direction:column; gap:5px; }
      .tcx .faq-contact-copy b{ font:600 16.5px/1.3 var(--sans); letter-spacing:-.015em; color:var(--ink); }
      .tcx .faq-contact-copy span{ font:400 14.5px/1.5 var(--sans); color:var(--muted); }
      @media (max-width:560px){
        .tcx .faq-a > p{ padding-right:4px; }
        .tcx .faq-contact{ flex-direction:column; align-items:flex-start; }
      }

      .tcx .cta{ position:relative; overflow:hidden; border-radius:var(--r-xl);
        padding:clamp(40px,6vw,80px) clamp(24px,5vw,64px); text-align:center; border:1px solid var(--stroke-2);
        background:radial-gradient(90% 130% at 50% 0%, rgba(0,201,197,.26), rgba(51,105,255,.10) 45%, transparent 72%), var(--card); }
      .tcx .cta::after{ content:""; position:absolute; inset:auto 0 -60% 0; height:80%; filter:blur(70px);
        background:radial-gradient(50% 100% at 50% 100%, rgba(47,88,183,.22), transparent 70%); }
      .tcx .cta > *{ position:relative; z-index:1; }
      .tcx .cta .btns{ display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:30px; }
      .tcx .cta .fine{ margin-top:18px; font-size:12.5px; color:var(--muted); }

      /* ---------- hospital plans (TcPricing — the closing .cta holds only this) ---------- */
      .tcx .pr{ --sky:#38BDF8; --sky-soft:rgba(56,189,248,.16); --sky-wash:rgba(186,230,253,.55); }
      .tcx .pr-h2{ margin:0 0 14px; }
      .tcx .pr-lede{ margin:0 auto; max-width:62ch; color:var(--ink-2); font-size:clamp(15px,1.2vw,17px); line-height:1.6; }
      .tcx .pr-for{ display:block; text-align:center; margin-bottom:10px; }
      .tcx .pr-patfree{ display:table; margin:14px auto 0; padding:8px 16px; border-radius:999px; background:rgba(10,154,150,.12); color:var(--ink); font-weight:600; font-size:15px; }
      .tcx .pr-toggle{ display:inline-flex; gap:4px; margin-top:26px; padding:4px; border-radius:999px;
        background:var(--panel-2); border:1px solid var(--stroke-2); box-shadow:0 10px 30px -22px var(--shadow); }
      .tcx .pr-toggle button{ display:inline-flex; align-items:center; gap:8px; padding:10px 20px; border:0; border-radius:999px;
        background:transparent; color:var(--ink-2); font:inherit; font-size:14px; font-weight:600; cursor:pointer;
        transition:background .3s var(--ease), color .3s var(--ease), box-shadow .3s var(--ease); }
      .tcx .pr-toggle button.on{ background:linear-gradient(100deg,var(--mint-fill),var(--sky)); color:#fff;
        box-shadow:0 8px 22px -10px rgba(56,189,248,.8); }
      .tcx .pr-save{ padding:2px 8px; border-radius:999px; font-size:11.5px; font-weight:700; color:var(--mint-dim); background:rgba(0,201,197,.16); }
      .tcx .pr-toggle button.on .pr-save{ color:#fff; background:rgba(255,255,255,.22); }

      .tcx .pr-grid{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:18px; margin-top:34px; text-align:left; align-items:stretch; }
      .tcx .pr-card{ position:relative; overflow:hidden; display:flex; flex-direction:column; padding:24px 20px 20px; border-radius:var(--r-lg);
        background:var(--panel-2); border:1.5px solid var(--stroke-2); backdrop-filter:blur(12px);
        box-shadow:0 18px 40px -30px var(--shadow);
        opacity:0; transform:translateY(34px) scale(.98);
        transition:opacity .7s var(--ease-out), transform .7s var(--ease-out), border-color .6s var(--ease), box-shadow .6s var(--ease), background .6s var(--ease);
        transition-delay:calc(var(--i) * 140ms), calc(var(--i) * 140ms), 0s, 0s, 0s; }
      .tcx .pr.shown .pr-card{ opacity:1; transform:none; }
      .tcx .pr-card.pop{ border-color:rgba(0,201,197,.45); }
      /* the moving light: light-blue wash, glow and a sheen that sweeps across */
      .tcx .pr.shown .pr-card.lit{ transform:translateY(-8px); border-color:var(--sky);
        background:linear-gradient(180deg, var(--sky-wash), rgba(186,230,253,.08) 46%, transparent 70%), var(--panel-2);
        box-shadow:0 0 0 5px var(--sky-soft), 0 34px 64px -30px rgba(56,189,248,.65); transition-delay:0s; }
      .tcx .pr-shine{ position:absolute; inset:-40% -60%; pointer-events:none; opacity:0;
        background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.75) 50%, transparent 62%); transform:translateX(-60%); }
      .tcx .pr-card.lit .pr-shine{ animation:prSweep 1.4s var(--ease-out) forwards; }
      @keyframes prSweep{ 0%{ opacity:0; transform:translateX(-60%) } 20%{ opacity:1 } 100%{ opacity:0; transform:translateX(60%) } }
      .tcx .pr-card > *:not(.pr-shine):not(.pr-glow):not(.pr-sparks){ position:relative; z-index:1; }

      /* glitter on hover: light under the cursor, twinkling stars, repeating sheen */
      .tcx .pr-glow{ position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity .35s var(--ease);
        background:radial-gradient(260px circle at var(--mx,50%) var(--my,30%), rgba(56,189,248,.26), rgba(0,201,197,.10) 40%, transparent 70%); }
      .tcx .pr-sparks{ position:absolute; inset:0; pointer-events:none; z-index:2; }
      .tcx .pr-spark{ position:absolute; color:#7DD3FC; opacity:0; transform:scale(0) rotate(0deg);
        filter:drop-shadow(0 0 6px rgba(56,189,248,.9)); }
      .tcx .pr-spark:nth-child(3n){ color:#5EEAD4; filter:drop-shadow(0 0 6px rgba(0,201,197,.9)); }
      .tcx .pr-spark:nth-child(4n){ color:#fff; filter:drop-shadow(0 0 7px rgba(125,211,252,1)); }
      @keyframes prTwinkle{
        0%,100%{ opacity:0; transform:scale(0) rotate(0deg) }
        45%{ opacity:1; transform:scale(1) rotate(45deg) }
        60%{ opacity:.9; transform:scale(.85) rotate(70deg) }
      }
      @keyframes prSweepLoop{ 0%{ opacity:0; transform:translateX(-60%) } 15%{ opacity:1 } 55%,100%{ opacity:0; transform:translateX(60%) } }
      @media (hover:hover){
        .tcx .pr-card:hover .pr-glow{ opacity:1; }
        .tcx .pr-card:hover .pr-spark{ animation:prTwinkle 1.6s ease-in-out infinite; }
        .tcx .pr-card:hover .pr-shine{ animation:prSweepLoop 2.2s var(--ease-out) infinite; }
        .tcx .pr-card:hover .pr-badge{ animation:prBadgeGlint 1.6s ease-in-out infinite; }
      }
      @keyframes prBadgeGlint{ 0%,100%{ box-shadow:0 6px 16px -8px rgba(56,189,248,.9) } 50%{ box-shadow:0 0 0 4px rgba(56,189,248,.22), 0 8px 22px -6px rgba(56,189,248,1) } }

      .tcx .pr-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .tcx .pr-badge{ padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.02em; color:#fff; white-space:nowrap;
        background:linear-gradient(100deg,var(--mint),var(--sky)); box-shadow:0 6px 16px -8px rgba(56,189,248,.9); }
      .tcx .pr-name{ margin:0; font-size:19px; font-weight:700; letter-spacing:-.015em; }
      .tcx .pr-tag{ margin:6px 0 0; min-height:2.9em; font-size:13.5px; line-height:1.45; color:var(--muted); }
      .tcx .pr-price{ display:flex; align-items:baseline; flex-wrap:wrap; gap:6px; margin-top:14px; }
      .tcx .pr-amt{ font-size:clamp(30px,2.6vw,40px); font-weight:750; letter-spacing:-.03em; color:var(--ink); transition:color .5s var(--ease); }
      /* Gradient text only on the popular card, which never changes class: a
         gradient clipped to text that is switched on mid-transition renders
         blank in Chrome, so the moving light uses a solid sky blue instead. */
      .tcx .pr-card.pop .pr-amt{ background:linear-gradient(100deg,var(--mint),var(--sky) 55%,var(--violet));
        -webkit-background-clip:text; background-clip:text; color:transparent; }
      .tcx .pr-card.lit:not(.pop) .pr-amt{ color:#0284C7; }
      .tcx .pr-per{ font-size:13px; color:var(--muted); font-weight:550; }
      .tcx .pr-was{ margin:2px 0 0; min-height:1.3em; font-size:13px; color:var(--faint); text-decoration:line-through; }
      .tcx .pr-was.empty{ visibility:hidden; }
      .tcx .pr-btn{ width:100%; justify-content:center; margin-top:auto; }

      /* four numbers as tiles — the data, without a table */
      .tcx .pr-tiles{ display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:16px 0 0; }
      .tcx .pr-tile{ display:flex; flex-direction:column; gap:2px; padding:11px 12px; border-radius:14px;
        background:var(--card-3); border:1px solid var(--stroke); transition:background .6s var(--ease), border-color .6s var(--ease); }
      .tcx .pr-tile-v{ font-size:19px; font-weight:750; letter-spacing:-.02em; line-height:1.15; color:var(--ink); }
      .tcx .pr-tile-v.inf{ font-size:27px; line-height:.85; font-weight:600; }
      .tcx .pr-tile-l{ font-size:11.5px; line-height:1.3; color:var(--muted); }
      .tcx .pr-card.lit .pr-tile{ background:rgba(56,189,248,.10); border-color:rgba(56,189,248,.28); }
      .tcx .pr-card.lit .pr-tile-v{ color:#0369A1; }

      /* two or three highlights — what sets the plan apart */
      .tcx .pr-hl{ list-style:none; margin:16px 0 16px; padding:0; display:flex; flex-direction:column; gap:9px; }
      .tcx .pr-hl li{ display:flex; align-items:center; gap:9px; font-size:13.5px; line-height:1.35; color:var(--ink-2); }
      .tcx .pr-hl li.off{ color:var(--faint); }

      .tcx .pr-mark{ width:18px; height:18px; border-radius:50%; flex:none; display:grid; place-items:center; }
      .tcx .pr-mark.yes{ background:rgba(0,201,197,.16); border:1px solid rgba(10,154,150,.3); color:var(--mint); }
      .tcx .pr-mark.no{ background:rgba(147,163,184,.14); border:1px solid rgba(147,163,184,.3); color:var(--faint); }

      /* what every plan has — small and quiet, at the bottom of each card */
      .tcx .pr-inc{ margin:0 0 20px; padding-top:14px; border-top:1px dashed var(--stroke-2); }
      .tcx .pr-inc-title{ display:block; margin-bottom:9px; font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); }
      .tcx .pr-inc ul{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
      .tcx .pr-inc li{ display:flex; align-items:center; gap:8px; font-size:12.5px; line-height:1.35; color:var(--muted); }
      .tcx .pr-inc .pr-mark{ width:15px; height:15px; background:transparent; border-color:rgba(10,154,150,.25); }
      .tcx .pr-inc .pr-mark svg{ width:8px; height:8px; }

      /* "See details": one switch opens every card together, so they stay level */
      .tcx .pr-more-btn{ display:inline-flex; align-items:center; justify-content:center; gap:6px; width:100%;
        margin:14px 0 0; padding:9px 0 2px; border:0; border-top:1px dashed var(--stroke-2); background:none;
        cursor:pointer; font:inherit; font-size:13px; font-weight:650; color:var(--mint); }
      .tcx .pr-more-btn:hover{ color:var(--ink); }
      .tcx .pr-more-btn svg{ transition:transform .3s var(--ease); }
      .tcx .pr-more-btn.on svg{ transform:rotate(180deg); }
      .tcx .pr-more{ display:grid; grid-template-rows:0fr; margin-bottom:16px; transition:grid-template-rows .4s var(--ease); }
      .tcx .pr-more.open{ grid-template-rows:1fr; }
      .tcx .pr-more-in{ min-height:0; overflow:hidden; }
      .tcx .pr-more .pr-tiles{ margin-top:8px; }
      .tcx .pr-more .pr-inc{ margin-bottom:0; }
      @media (prefers-reduced-motion:reduce){ .tcx .pr-more, .tcx .pr-more-btn svg{ transition:none; } }

      .tcx .pr-hosp{ display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; margin-top:18px;
        padding:20px 22px; border-radius:var(--r-lg); text-align:left; border:1.5px solid var(--stroke-2);
        background:linear-gradient(100deg, rgba(56,189,248,.14), rgba(51,105,255,.05) 60%, transparent), var(--panel-2); }
      .tcx .pr-hosp .pr-tag{ min-height:0; }
      .tcx .pr-hosp-price{ margin-left:8px; font-size:14px; font-weight:650; color:#0284C7; }
      .tcx .pr-hosp .pr-btn{ width:auto; margin-top:0; }

      @media (max-width:1180px){ .tcx .pr-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:620px){
        .tcx .pr-grid{ grid-template-columns:1fr; gap:20px; }
        .tcx .pr-tag{ min-height:0; }
        .tcx .pr-hosp .pr-btn{ width:100%; }
        .tcx .pr-toggle button{ padding:9px 14px; }
      }
      @media (prefers-reduced-motion:reduce){
        .tcx .pr-card, .tcx .pr.shown .pr-card.lit{ transition:none; transform:none; opacity:1; }
        .tcx .pr-card.lit .pr-shine, .tcx .pr-card:hover .pr-shine, .tcx .pr-card:hover .pr-spark,
        .tcx .pr-card:hover .pr-badge{ animation:none; }
        .tcx .pr-spark{ display:none; }
      }
      .tcx[data-theme="dark"] .pr{ --sky-wash:rgba(56,189,248,.16); }
      .tcx[data-theme="dark"] .pr-card.lit .pr-tile-v{ color:#7DD3FC; }
      .tcx[data-theme="dark"] .pr-shine{ background:linear-gradient(115deg, transparent 38%, rgba(125,211,252,.18) 50%, transparent 62%); }
      .tcx[data-theme="dark"] .pr-hosp-price{ color:#7DD3FC; }
      .tcx[data-theme="dark"] .pr-glow{ background:radial-gradient(260px circle at var(--mx,50%) var(--my,30%), rgba(56,189,248,.20), rgba(31,227,165,.07) 40%, transparent 70%); }
      .tcx[data-theme="dark"] .pr-card.lit:not(.pop) .pr-amt{ color:#7DD3FC; }

      .tcx footer{ position:relative; margin-top:clamp(60px,8vw,110px); border-top:1px solid var(--stroke);
        padding:clamp(40px,5vw,64px) 0 34px; position:relative; z-index:2; }
      .tcx footer::before{ content:''; position:absolute; inset:0 0 auto 0; height:3px;
        background:linear-gradient(90deg, var(--mint-fill), #34d399, var(--cyan)); }
      .tcx .f-grid{ display:grid; grid-template-columns:1.5fr .85fr .85fr .95fr 1.15fr; gap:30px; }
      .tcx .f-brand p{ color:var(--muted); font-size:14px; margin:14px 0 18px; max-width:34ch; line-height:1.6; }
      /* Restored pre-redesign footer: brand + tagline + CTA, then Explore /
         Legal / Reach us. Colours come from the .tcx palette, not the editorial
         theme the original used. */
      .tcx .f-word{ display:block; text-align:left; line-height:1.15; }
      .tcx .f-word i{ display:block; }
      .tcx .f-word i{ font-style:normal; font-size:11px; letter-spacing:.06em; color:var(--muted);
        margin-top:4px; font-weight:600; }
      .tcx .f-cta{ display:inline-flex; align-items:center; gap:8px; margin:20px 0 22px;
        padding:10px 20px; border:0; border-radius:999px; cursor:pointer; font:inherit;
        font-size:14px; font-weight:700; color:#fff;
        background:linear-gradient(100deg, var(--mint-fill), var(--cyan));
        transition:transform .25s, box-shadow .25s; }
      .tcx .f-cta:hover{ transform:scale(1.03); box-shadow:0 8px 22px rgba(10,154,150,.28); }
      .tcx .f-ctas{ display:flex; flex-wrap:wrap; gap:10px; }
      .tcx .f-ctas .f-cta{ margin:20px 0 22px; }
      /* Secondary CTA: same shape, outlined, so "Become a Partner" reads as
         the second choice rather than competing with "Get in touch". */
      .tcx .f-cta-alt{ background:transparent; color:var(--mint);
        border:1.5px solid rgba(10,154,150,.38); }
      .tcx .f-cta-alt:hover{ background:rgba(0,201,197,.10); box-shadow:none; }
      .tcx .f-col.f-reach a,.tcx .f-col.f-reach .f-line{ display:flex; align-items:center; gap:10px;
        padding:7px 0; font-size:13.5px; color:var(--ink-2); text-decoration:none;
        flex-wrap:nowrap; }
      .tcx .f-col.f-reach a:hover{ color:var(--mint); transform:none; }
      /* The address is long; let the TEXT wrap inside its own box so the icon
         can never be pushed onto a line of its own. */
      .tcx .f-txt{ min-width:0; overflow-wrap:anywhere; line-height:1.35; }
      .tcx .f-ico{ display:grid; place-items:center; width:28px; height:28px; flex:0 0 28px;
        border-radius:9px; background:rgba(0,201,197,.12); color:var(--mint); }
      .tcx .fr-i{ width:14px; height:14px; }
      .tcx .fc-i{ width:15px; height:15px; }
      .tcx .fs-i{ width:15px; height:15px; }
      .tcx .f-social{ display:flex; gap:8px; }
      .tcx .f-social a{ width:36px; height:36px; border-radius:50%; border:1px solid var(--stroke);
        display:grid; place-items:center; color:var(--muted); transition:.3s; }
      .tcx .f-social a{ color:var(--muted); text-decoration:none; }
      .tcx .f-social a:hover{ color:var(--mint); border-color:rgba(10,154,150,.4);
        background:rgba(0,201,197,.10); transform:translateY(-2px); }
      .tcx .f-col h4{ font-size:12px; letter-spacing:.13em; text-transform:uppercase; color:var(--muted);
        margin:0 0 16px; font-weight:700; }
      .tcx .f-col a,.tcx .f-col button{ display:block; padding:6px 0; font-size:14px; color:var(--ink-2);
        transition:color .25s, transform .25s; background:none; border:0; cursor:pointer; text-align:left; font:inherit; }
      .tcx .f-col a:hover,.tcx .f-col button:hover{ color:var(--mint); transform:translateX(3px); }
      .tcx .f-bot{ margin-top:44px; padding-top:22px; border-top:1px solid var(--stroke); display:flex;
        justify-content:space-between; gap:14px; flex-wrap:wrap; font-size:12.5px; color:var(--faint); }
      .tcx .f-bot button{ background:none; border:0; cursor:pointer; font:inherit; color:var(--faint); padding:0; }
      .tcx .f-bot button:hover{ color:var(--ink-2); }


      /* ============================================================
         THE MINUTES LEDGER
         Faithful port of the reference's assets/health.css. The look is
         deliberately editorial: huge numerals, 3px hairline
         rulers instead of gauges, serif word-pickers with an underline instead
         of segmented buttons, mono uppercase micro-labels. Only the surface
         colours are re-pitched for light - every white-on-black translucency
         becomes dark-on-white, and the accent moves to the readable mint.
         ============================================================ */
      .tcx .hx-sec{ padding-top:0; padding-bottom:clamp(36px,4vw,52px); }
      .tcx .hx{ display:block; margin-top:0; --hx-serif:var(--head); }
      /* once the real number is out, the panel opens into two columns */
      .tcx .hx-sheet.revealed .hx{ display:grid; grid-template-columns:minmax(0,330px) minmax(0,1fr); gap:clamp(30px,4.5vw,74px); }

      /* ---------- inputs: underlines and words, no boxes ---------- */
      .tcx .hx-inputs{ display:grid; gap:30px; align-content:start; max-width:540px; margin-inline:auto; }
      .tcx .hx-sheet.revealed .hx-inputs{ max-width:none; margin-inline:0; gap:26px; }
      .tcx .hx-f{ display:grid; gap:7px; }
      .tcx .hx-f label{ font-family:var(--mono); font-size:11px; text-transform:uppercase;
        letter-spacing:.15em; color:var(--muted); }

      .tcx .hx-pick{ display:flex; flex-wrap:wrap; gap:0 20px; margin-top:1px; }
      .tcx .hx-opt{ font-family:var(--hx-serif); font-size:24px; line-height:1.45; background:none; border:0;
        border-bottom:1px solid transparent; color:var(--faint); cursor:pointer; padding:0 0 4px;
        letter-spacing:-.015em; transition:color .3s var(--ease-out), border-color .3s var(--ease-out); }
      .tcx .hx-opt:hover{ color:var(--ink-2); }
      .tcx .hx-opt[aria-pressed="true"]{ color:var(--ink); border-bottom-color:var(--mint); }
      .tcx .hx-pick.tight .hx-opt{ font-size:19px; }

      /* ---------- the number ---------- */
      .tcx .hx-pre{ font-size:12.5px; font-weight:600; text-transform:uppercase; letter-spacing:.22em;
        color:var(--ink-2); margin:0 0 6px; }
      .tcx .hx-big{ font-family:var(--hx-serif); font-weight:400; font-size:clamp(72px,11.5vw,164px);
        line-height:.84; letter-spacing:-.035em; color:var(--mint); transition:color .5s var(--ease-out); }
      .tcx .hx-big small{ font-family:var(--sans); font-size:.15em; font-weight:700; color:var(--faint);
        margin-left:.12em; letter-spacing:-.01em; }
      .tcx .hx-big.calm{ color:var(--ink); }
      .tcx .hx-big.beat{ animation:hxBeat .45s var(--ease-out); }
      @keyframes hxBeat{ 0%{ opacity:.2; transform:translateY(7px) } 100%{ opacity:1; transform:none } }
      .tcx .hx-big.tone-ok{ color:var(--mint); }
      .tcx .hx-big.tone-low{ color:var(--ink); }
      .tcx .hx-big.tone-warn{ color:#C97A16; }
      .tcx .hx-big.tone-high{ color:#E14356; }
      .tcx .hx-sub{ color:var(--ink-2); max-width:46ch; margin:20px 0 0; font-size:15.5px; line-height:1.6; }

      /* ---------- the scales: hairline rulers, not gauges ---------- */
      /* The track is 3px tall but its labels are absolutely positioned BELOW it —
         band names at 12px, the ghost marker's "your guess" at 26px. Without
         reserved space they overflow onto whatever paragraph follows, which is
         exactly what they were doing. */
      .tcx .hx-scale{ position:relative; margin-top:clamp(30px,4vw,46px); padding-bottom:48px; }
      .tcx .hx-scale-top{ display:flex; justify-content:space-between; align-items:baseline; gap:16px; margin-bottom:26px; }
      .tcx .hx-scale-name{ font-family:var(--mono); font-size:11px; text-transform:uppercase;
        letter-spacing:.15em; color:var(--muted); }
      .tcx .hx-scale-val{ font-family:var(--hx-serif); font-size:30px; line-height:1; letter-spacing:-.02em; }
      .tcx .hx-scale-val i{ font-style:normal; font-family:var(--mono); font-size:11px; letter-spacing:.14em;
        text-transform:uppercase; margin-left:12px; color:var(--muted); }

      .tcx .hx-track{ position:relative; display:flex; height:3px; border-radius:2px; overflow:visible; }
      .tcx .hx-band{ height:3px; position:relative; display:block; }
      .tcx .hx-band:first-child{ border-radius:2px 0 0 2px; }
      .tcx .hx-band:last-child{ border-radius:0 2px 2px 0; }
      .tcx .hx-band[data-tone="low"]{ background:rgba(15,39,66,.13); }
      .tcx .hx-band[data-tone="ok"]{ background:var(--mint-fill); }
      .tcx .hx-band[data-tone="warn"]{ background:rgba(255,180,84,.75); }
      .tcx .hx-band[data-tone="high"]{ background:rgba(255,122,138,.7); }
      /* A narrow band's label would otherwise run under its neighbour's. The
         first label hugs the left edge, the rest sit just inside their own
         segment, and anything under ~12% of the ruler drops its label — the
         marker colour and the word beside the value still carry it. */
      .tcx .hx-band span{ position:absolute; top:12px; left:0; white-space:nowrap; font-family:var(--mono);
        font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);
        max-width:100%; overflow:hidden; text-overflow:clip; }

      .tcx .hx-mark{ position:absolute; top:-16px; bottom:-16px; width:1px; background:var(--ink);
        transform:translateX(-.5px); transition:left .55s var(--ease-out); }
      .tcx .hx-mark::after{ content:""; position:absolute; left:-3.5px; top:12px; width:8px; height:8px;
        border-radius:50%; background:var(--ink); box-shadow:0 0 0 4px #F4FAF9; }
      .tcx .hx-mark.warn,.tcx .hx-mark.warn::after{ background:#C97A16; }
      .tcx .hx-mark.high,.tcx .hx-mark.high::after{ background:#E14356; }
      .tcx .hx-mark.ok,.tcx .hx-mark.ok::after{ background:var(--mint); }

      /* ---------- readout + receipt ---------- */
      .tcx .hx-read{ margin:clamp(40px,5vw,60px) 0 0; display:grid; max-width:600px; }
      .tcx .hx-read div{ display:flex; justify-content:space-between; gap:20px; padding:13px 0;
        border-top:1px solid rgba(15,39,66,.09); font-family:var(--mono); font-size:12px;
        text-transform:uppercase; letter-spacing:.13em; }
      .tcx .hx-read dt{ color:var(--muted); }
      .tcx .hx-read dd{ margin:0; color:var(--ink); font-weight:500; }

      .tcx .hx-ledger{ margin-top:clamp(40px,5vw,60px); max-width:600px; font-family:var(--mono); font-size:13px; }
      .tcx .hx-ledger h4{ font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:.15em;
        color:var(--muted); font-weight:400; margin:0 0 6px; }
      .tcx .hx-ledger div{ display:flex; justify-content:space-between; align-items:baseline; gap:20px;
        padding:12px 0; border-top:1px solid rgba(15,39,66,.09); color:var(--ink-2); }
      .tcx .hx-ledger div span:last-child{ color:var(--ink); }
      .tcx .hx-ledger .tot{ border-top:1px solid var(--mint); margin-top:6px; padding-top:16px; color:var(--ink); }
      .tcx .hx-ledger .tot span:last-child{ color:var(--mint); font-size:19px; }
      .tcx .hx-ledger .none{ color:var(--muted); border-top:1px solid rgba(15,39,66,.09); padding:14px 0 0; }

      /* The offer that opens the plan. Full-width and quiet until hovered — it
         is an invitation, not the answer someone came for. */
      .tcx .hx-diet-wrap{ margin-top:clamp(28px,3.5vw,40px); }
      .tcx .hx-diet-cta{ display:flex; align-items:center; gap:13px; width:100%; text-align:left;
        padding:14px 16px; border-radius:var(--r-md); cursor:pointer;
        border:1px solid rgba(10,154,150,.30); background:rgba(0,201,197,.09);
        font:inherit; color:inherit; transition:background .25s var(--ease-out), border-color .25s; }
      .tcx .hx-diet-cta:hover{ background:rgba(0,201,197,.15); border-color:rgba(10,154,150,.46); }
      .tcx .hx-diet-cta-ic{ flex:none; display:grid; place-items:center; width:36px; height:36px;
        border-radius:11px; background:var(--card); font-size:17px; }
      .tcx .hx-diet-cta-txt{ flex:1; min-width:0; }
      .tcx .hx-diet-cta-txt b{ display:block; font:650 14px/1.3 var(--sans); letter-spacing:-.01em; color:var(--ink); }
      .tcx .hx-diet-cta-txt i{ display:block; margin-top:2px; font-style:normal;
        font-size:12px; line-height:1.4; color:var(--muted); }
      .tcx .hx-diet-cta-ch{ flex:none; color:var(--mint); transition:transform .3s var(--ease-out); }
      .tcx .hx-diet-cta.on .hx-diet-cta-ch{ transform:rotate(180deg); }
      /* Inside the wrapper the plan follows the button, so it drops the rule and
         the big top margin it uses when it stands alone. */
      .tcx .hx-diet-wrap .hx-diet{ margin-top:16px; padding-top:0; border-top:0; }

      /* ---------- what to eat ----------
         LedgerDiet (TcLedger.jsx) shipped with its markup but no stylesheet, so
         every one of these classes was inert: the <b>/<em>/<span> inside a food
         row are inline by default and ran together into one paragraph
         ("Egg1-2 · Breakfast or lunchHigh-quality protein.Instead:"). Each one
         is given a line of its own here. */
      .tcx .hx-diet{ margin-top:clamp(34px,4.5vw,52px); padding-top:clamp(24px,3vw,32px);
        border-top:1px solid var(--stroke); }
      .tcx .hx-diet-h{ display:flex; flex-wrap:wrap; justify-content:space-between; align-items:baseline;
        gap:10px; margin:0 0 4px; font-family:var(--hx-serif); font-size:clamp(19px,2.2vw,25px);
        line-height:1.25; letter-spacing:-.012em; color:var(--ink); }
      .tcx .hx-diet-h span{ font-family:var(--mono); font-size:10.5px; letter-spacing:.14em;
        text-transform:uppercase; color:var(--mint); }

      .tcx .hx-diet-sec{ margin-top:22px; }
      .tcx .hx-diet-meal{ margin:0 0 8px; font-family:var(--mono); font-size:11px; letter-spacing:.15em;
        text-transform:uppercase; color:var(--muted); }

      .tcx .hx-diet-list{ list-style:none; margin:10px 0 0; padding:0; }
      .tcx .hx-diet-row{ display:flex; align-items:flex-start; gap:12px; padding:13px 0;
        border-top:1px solid rgba(15,39,66,.09); }
      .tcx .hx-diet-list .hx-diet-row:first-child{ border-top:0; padding-top:4px; }
      .tcx .hx-diet-emoji{ flex:none; width:22px; font-size:17px; line-height:1.3; }
      .tcx .hx-diet-body{ flex:1; min-width:0; }
      /* The four lines of a food row. Without display:block these are inline and
         the whole row reads as one run-on sentence. */
      .tcx .hx-diet-body b{ display:block; font:600 13.5px/1.35 var(--sans); letter-spacing:-.01em; color:var(--ink); }
      .tcx .hx-diet-body em{ display:block; margin-top:3px; font-style:normal;
        font-family:var(--mono); font-size:10.5px; letter-spacing:.06em; color:var(--mint); }
      .tcx .hx-diet-body > span{ display:block; margin-top:5px; font-size:12.5px; line-height:1.5; color:var(--ink-2); }
      .tcx .hx-diet-body .hx-diet-alt{ margin-top:3px; font-size:11.5px; color:var(--muted); }

      .tcx .hx-diet-note{ margin:16px 0 0; padding:11px 13px; border-radius:var(--r-md);
        background:rgba(0,201,197,.10); border:1px solid rgba(10,154,150,.22);
        font-size:12px; line-height:1.55; color:var(--ink-2); }

      .tcx .hx-diet-flow{ list-style:none; margin:0; padding:0; border:1px solid var(--stroke);
        border-radius:var(--r-md); overflow:hidden; }
      .tcx .hx-diet-flow li{ display:flex; align-items:baseline; gap:14px; padding:9px 13px;
        border-bottom:1px solid var(--stroke); font-size:12.5px; color:var(--ink-2); }
      .tcx .hx-diet-flow li:last-child{ border-bottom:0; }
      .tcx .hx-diet-flow li:nth-child(odd){ background:rgba(15,39,66,.028); }
      .tcx .hx-diet-flow b{ flex:none; width:66px; font-family:var(--mono); font-size:10.5px;
        letter-spacing:.06em; color:var(--muted); font-weight:400; }

      .tcx .hx-diet-chips{ display:flex; flex-wrap:wrap; gap:7px; }
      .tcx .hx-diet-chip{ display:inline-flex; align-items:center; gap:6px; padding:5px 11px;
        border-radius:999px; background:rgba(245,166,35,.13); border:1px solid rgba(245,166,35,.28);
        font-size:11.5px; font-weight:500; color:#9A6508; }
      .tcx .hx-diet-why{ margin:9px 0 0; font-size:11.5px; line-height:1.5; color:var(--muted); }

      .tcx .hx-diet-habit{ margin:22px 0 0; padding:12px 14px; border-radius:var(--r-md);
        background:rgba(47,88,183,.07); border:1px solid rgba(47,88,183,.16);
        font-size:12.5px; line-height:1.55; color:var(--ink-2); }
      .tcx .hx-diet-habit b{ color:var(--ink); font-weight:650; }
      .tcx .hx-diet-safe{ margin:14px 0 0; font-size:11px; line-height:1.55; color:var(--muted); }

      /* ---------- what to do about it ---------- */
      .tcx .hx-next{ margin-top:clamp(40px,5vw,58px); padding-top:clamp(28px,3.5vw,38px); border-top:1px solid var(--stroke); }
      .tcx .hx-next p{ font-family:var(--hx-serif); font-size:clamp(21px,2.5vw,30px); line-height:1.28;
        letter-spacing:-.012em; margin:0 0 24px; max-width:34ch; color:var(--ink); }
      .tcx .hx-next .btn{ margin-right:10px; }
      .tcx .hx-priv{ margin:26px 0 0; font-size:12px; color:var(--muted); max-width:56ch; line-height:1.6; }
      .tcx .hx-priv b{ color:var(--ink-2); font-weight:600; }

      /* ---------- the popup ---------- */
      .tcx .hx-sheet{ position:fixed; inset:0; z-index:110; display:grid; place-items:center;
        padding:clamp(0px,3vw,34px); background:rgba(15,39,66,.38); backdrop-filter:blur(8px);
        opacity:0; pointer-events:none; transition:opacity .35s var(--ease-out); }
      .tcx .hx-sheet.on{ opacity:1; pointer-events:auto; }
      /* The reference's sheet is #080C12 on a black page — inverted to plain
         white it read as a blank slab with no brand on it at all. Same tinted
         paper the page uses, with a teal glow at the top-left and a blue one
         bottom-right, so the popup belongs to TapCure rather than the browser. */
      .tcx .hx-sheet-in{ position:relative; width:min(1080px,100%); max-height:94vh; overflow:auto;
        border:1px solid rgba(10,154,150,.22); border-radius:24px;
        background-color:var(--wash);
        background-image:
          radial-gradient(58% 42% at 0% 0%, rgba(0,201,197,.24), transparent 66%),
          radial-gradient(52% 40% at 100% 4%, rgba(47,88,183,.16), transparent 66%),
          radial-gradient(64% 44% at 90% 100%, rgba(0,201,197,.18), transparent 70%);
        padding:clamp(26px,3.4vw,46px); transform:translateY(18px); transition:transform .45s var(--ease-out);
        box-shadow:0 60px 120px -50px rgba(15,39,66,.55); }
      .tcx .hx-sheet.on .hx-sheet-in{ transform:none; }
      .tcx .hx-x{ position:absolute; right:clamp(16px,2vw,24px); top:clamp(16px,2vw,24px); width:36px; height:36px;
        border-radius:50%; z-index:2; border:1px solid var(--stroke); background:rgba(255,255,255,.9);
        color:var(--ink); cursor:pointer; display:grid; place-items:center; transition:border-color .25s; }
      .tcx .hx-x:hover{ border-color:rgba(15,39,66,.36); }
      .tcx .hx-sheet h3{ font-family:var(--hx-serif); font-weight:400; font-size:clamp(27px,3.4vw,42px);
        line-height:1.08; letter-spacing:-.018em; margin:14px 0 clamp(26px,3vw,38px); max-width:22ch; }

      /* ---------- sliders ---------- */
      .tcx .hx-s{ display:grid; gap:10px; }
      .tcx .hx-s-top{ display:flex; justify-content:space-between; align-items:baseline; gap:16px; }
      .tcx .hx-s-top label{ font-family:var(--mono); font-size:11px; text-transform:uppercase;
        letter-spacing:.15em; color:var(--muted); }
      .tcx .hx-s-val{ font-family:var(--hx-serif); font-size:26px; line-height:1; letter-spacing:-.02em; color:var(--ink); }

      .tcx .hx-range{ -webkit-appearance:none; appearance:none; width:100%; height:22px; background:none;
        cursor:grab; margin:0; padding:0; }
      .tcx .hx-range:active{ cursor:grabbing; }
      .tcx .hx-range:focus{ outline:0; }
      .tcx .hx-range:focus-visible{ outline:2px solid var(--mint); outline-offset:6px; border-radius:3px; }
      .tcx .hx-range::-webkit-slider-runnable-track{ height:3px; border-radius:2px;
        background:linear-gradient(90deg, var(--mint) var(--p,50%), rgba(15,39,66,.14) var(--p,50%)); }
      .tcx .hx-range::-webkit-slider-thumb{ -webkit-appearance:none; width:17px; height:17px; border-radius:50%;
        background:var(--ink); border:0; margin-top:-7px; box-shadow:0 0 0 4px #F4FAF9, 0 6px 18px -6px rgba(15,39,66,.6);
        transition:transform .18s var(--ease-out); }
      .tcx .hx-range:active::-webkit-slider-thumb{ transform:scale(1.18); }
      .tcx .hx-range::-moz-range-track{ height:3px; border-radius:2px; background:rgba(15,39,66,.14); }
      .tcx .hx-range::-moz-range-progress{ height:3px; border-radius:2px; background:var(--mint); }
      .tcx .hx-range::-moz-range-thumb{ width:17px; height:17px; border-radius:50%; background:var(--ink);
        border:0; box-shadow:0 0 0 4px #fff; }

      /* ---------- the guess ---------- */
      .tcx .hx-guess{ margin-top:clamp(26px,3.5vw,40px); padding-top:clamp(26px,3.5vw,38px); border-top:1px solid var(--stroke); }
      .tcx .hx-guess-q{ font-family:var(--hx-serif); font-size:clamp(21px,2.6vw,28px); line-height:1.25;
        letter-spacing:-.012em; margin:0 0 6px; color:var(--muted); }
      .tcx .hx-guess-q b{ color:var(--ink); font-weight:400; }
      .tcx .hx-guess-n{ font-family:var(--hx-serif); font-size:clamp(64px,10vw,108px); line-height:.9;
        letter-spacing:-.035em; color:var(--ink); margin:10px 0 6px; }
      .tcx .hx-guess-ends{ display:flex; justify-content:space-between; font-family:var(--mono);
        font-size:11px; color:var(--muted); margin-top:4px; }
      .tcx .hx-guess .btn{ margin-top:26px; width:100%; }
      .tcx .hx-guess-note{ margin:14px 0 0; font-size:12.5px; color:var(--muted); text-align:center; }

      /* ---------- the reveal ---------- */
      .tcx .hx-verdict{ font-family:var(--hx-serif); font-size:clamp(19px,2.2vw,26px); line-height:1.3;
        letter-spacing:-.012em; color:var(--muted); margin:18px 0 clamp(34px,4vw,48px); max-width:30ch; }
      .tcx .hx-verdict b{ color:var(--ink); font-weight:400; }
      /* the guess, left as a ghost on the ruler so the miss is visible */
      .tcx .hx-mark.ghost{ background:rgba(11,33,80,.28); }
      .tcx .hx-mark.ghost::after{ background:rgba(11,33,80,.28); box-shadow:0 0 0 4px #fff; width:7px; height:7px; left:-3px; }
      .tcx .hx-mark.ghost i{ position:absolute; top:30px; left:50%; transform:translateX(-50%); white-space:nowrap;
        font-family:var(--mono); font-size:9px; letter-spacing:.1em; text-transform:uppercase;
        color:var(--faint); font-style:normal;
        background:var(--wash); padding:1px 5px; border-radius:3px; }

      /* the score line — turns a bare miss into a result */
      .tcx .hx-score{ font-family:var(--mono); font-size:11.5px; letter-spacing:.06em; color:var(--muted);
        margin:-18px 0 clamp(30px,3.5vw,42px); }
      .tcx .hx-score b{ color:var(--mint); font-weight:700; }

      /* a called guess earns a chip and one pulse, nothing more */
      .tcx .hx-bull{ display:inline-block; margin-left:12px; padding:3px 10px; border-radius:100px;
        background:var(--mint-fill); color:#fff; font-family:var(--sans); font-size:10px; font-weight:800;
        letter-spacing:.14em; vertical-align:middle; animation:hxPop .5s var(--ease-out); }
      @keyframes hxPop{ 0%{ transform:scale(.6); opacity:0 } 60%{ transform:scale(1.12) } 100%{ transform:scale(1); opacity:1 } }
      .tcx .hx-big.hit{ animation:hxHit .7s var(--ease-out); }
      @keyframes hxHit{ 0%{ transform:scale(1) } 35%{ transform:scale(1.06) } 100%{ transform:scale(1) } }

      /* ---------- the follow-on calculators ---------- */
      .tcx .hx-play{ margin-top:clamp(34px,4vw,46px); padding-top:clamp(26px,3vw,34px); border-top:1px solid var(--stroke); }
      .tcx .hx-play-q{ font-family:var(--mono); font-size:11px; letter-spacing:.15em; text-transform:uppercase;
        color:var(--muted); margin:0 0 14px; }
      .tcx .hx-chips{ display:flex; flex-wrap:wrap; gap:8px; }
      .tcx .hx-chip{ font-family:var(--hx-serif); font-size:20px; line-height:1.3; padding:6px 16px;
        border-radius:100px; border:1px solid var(--stroke); background:rgba(255,255,255,.75);
        color:var(--ink-2); cursor:pointer; letter-spacing:-.015em;
        transition:border-color .3s var(--ease-out), color .3s, background .3s, transform .3s var(--ease-out); }
      .tcx .hx-chip:hover{ color:var(--ink); border-color:rgba(10,154,150,.5); transform:translateY(-2px); }
      .tcx .hx-chip.on{ background:var(--mint); border-color:transparent; color:#fff; }

      /* a tool opened as its own screen: it slides in from the right, so
         picking a chip reads as going somewhere rather than unfolding */
      .tcx .hx-tool-screen{ animation:hxScreenIn .42s var(--ease-out); }
      @keyframes hxScreenIn{ from{ opacity:0; transform:translateX(22px) } to{ opacity:1; transform:none } }
      .tcx .hx-back{ display:inline-flex; align-items:center; gap:8px; margin-bottom:22px;
        font-family:var(--mono); font-size:10.5px; letter-spacing:.15em; text-transform:uppercase;
        color:var(--muted); background:none; border:0; cursor:pointer; padding:6px 0;
        transition:color .25s; }
      .tcx .hx-back:hover{ color:var(--mint); }
      .tcx .hx-tool-screen .hx-tool{ margin-top:0; }
      .tcx .hx-tool-screen .hx-play{ margin-top:clamp(30px,3.5vw,42px); }
      .tcx .hx-chip{ display:inline-flex; align-items:center; gap:9px; }
      .tcx .hx-chip svg{ opacity:.5; transition:transform .3s var(--ease-out), opacity .3s; }
      .tcx .hx-chip:hover svg{ transform:translateX(3px); opacity:1; }

      .tcx .hx-tool{ margin-top:18px; padding:clamp(18px,2.4vw,26px); border-radius:var(--r-lg);
        border:1px solid rgba(10,154,150,.28);
        background:linear-gradient(135deg, rgba(0,201,197,.16), rgba(47,88,183,.06) 60%, transparent);
        animation:hxToolIn .42s var(--ease-out); }
      @keyframes hxToolIn{ from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:none } }
      /* the extra questions a tool asks for itself */
      .tcx .hx-asks{ display:grid; gap:20px; margin:4px 0 22px; padding-bottom:20px;
        border-bottom:1px dashed rgba(10,154,150,.35); }
      .tcx .hx-asks .hx-s-val{ font-size:22px; }
      .tcx .hx-asks .hx-opt{ font-size:20px; }
      .tcx .hx-asks .hx-pick.tight .hx-opt{ font-size:17px; }
      .tcx .hx-tool .hx-scale{ margin-top:26px; }
      .tcx .hx-tool .hx-ledger{ margin-top:28px; }
      .tcx .hx-tool-q{ font-family:var(--mono); font-size:10.5px; letter-spacing:.16em; text-transform:uppercase;
        color:var(--muted); margin:0 0 8px; }
      /* a tool's own guess block — smaller than the BMI one, same idea */
      .tcx .hx-guess.tool{ margin-top:0; padding-top:0; border-top:0; }
      .tcx .hx-guess.tool .hx-guess-q{ font-size:clamp(19px,2.2vw,24px); margin-bottom:10px; }
      .tcx .hx-guess.tool .hx-guess-n{ font-size:clamp(52px,7vw,84px); }
      .tcx .hx-guess.tool .hx-guess-n small{ font-family:var(--sans); font-size:.2em; font-weight:700;
        color:var(--muted); margin-left:.25em; letter-spacing:-.01em; }
      .tcx .hx-verdict.tool{ font-size:clamp(17px,1.9vw,21px); margin:14px 0 0; max-width:34ch; }

      .tcx .hx-tool-n{ font-family:var(--hx-serif); font-size:clamp(46px,6vw,74px); line-height:.9;
        letter-spacing:-.04em; color:var(--mint); }
      .tcx .hx-tool-n small{ font-family:var(--sans); font-size:.22em; font-weight:700; color:var(--muted);
        margin-left:.3em; letter-spacing:-.01em; }
      .tcx .hx-tool-warn{ font-family:var(--mono); font-size:10.5px; line-height:1.6; letter-spacing:.04em;
        color:var(--muted); margin:0 0 14px; padding-left:12px; border-left:1px solid var(--amber); max-width:44ch; }
      .tcx .hx-tool-warn b{ color:var(--ink-2); font-weight:500; }
      .tcx .hx-tool-s{ margin:14px 0 0; font-size:14px; line-height:1.6; color:var(--ink-2); max-width:48ch; }
      .tcx .hx-tool-s b{ color:var(--ink); }
      .tcx .hx-tool-lbl{ display:block; font-family:var(--mono); font-size:10.5px; letter-spacing:.14em;
        text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
      .tcx .hx-tool-date{ font-family:inherit; font-size:15px; font-weight:600; color:var(--ink);
        padding:10px 14px; border-radius:12px; border:1px solid var(--stroke); background:var(--card); }

      .tcx .hx-deep{ margin-top:clamp(40px,5vw,64px); }
      .tcx .hx-mins-pre{ margin-top:clamp(44px,5vw,66px); }
      .tcx .hx-big.mins{ color:var(--mint); font-size:clamp(62px,9vw,132px); }
      .tcx .hx-big.mins.calm{ color:var(--ink); }
      .tcx .hx-hint{ font-family:var(--mono); font-size:11.5px; line-height:1.6; letter-spacing:.02em;
        color:var(--muted); margin:0 0 clamp(30px,3.5vw,44px); padding-left:14px;
        border-left:1px solid var(--mint); max-width:44ch; }
      .tcx .hx-sheet.touched .hx-hint{ display:none; }

      /* ---------- the teaser left on the page ---------- */
      /* The reference leaves this block bare because it sits on a black page and
         reads as a section. On light paper, next to a page of cards, bare looks
         unfinished — so it becomes a card in the same language as the rest:
         white glass, teal edge, and a brand teal-to-blue wash behind it. */
      .tcx .hx-teaser{ position:relative; overflow:hidden;
        display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr); align-items:center;
        gap:clamp(24px,3vw,42px);
        padding:clamp(22px,2.6vw,34px); border-radius:var(--r-xl);
        border:1px solid rgba(10,154,150,.26);
        background:
          radial-gradient(80% 120% at 0% 0%, rgba(0,201,197,.20), transparent 62%),
          radial-gradient(70% 110% at 100% 100%, rgba(47,88,183,.14), transparent 65%),
          linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.74));
        backdrop-filter:blur(20px) saturate(150%);
        box-shadow:0 26px 60px -34px var(--shadow), inset 0 1px 0 rgba(255,255,255,.9); }
      .tcx .hx-teaser-copy{ max-width:none; min-width:0; }
      .tcx .hx-teaser-copy h2{ margin-bottom:9px; margin-top:8px; font-size:clamp(26px,3vw,38px); }
      .tcx .hx-teaser-copy .lede{ max-width:52ch; font-size:clamp(14.5px,1.15vw,16px); line-height:1.5; }
      .tcx .hx-teaser-act{ display:flex; align-items:flex-end; gap:clamp(20px,2.4vw,30px);
        flex-wrap:wrap; margin-top:clamp(16px,2vw,24px); }

      /* ---------- the four assurances ---------- */
      .tcx .hx-trust{ list-style:none; margin:clamp(16px,2vw,24px) 0 0; padding:0;
        display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px 20px;
        border-top:1px solid var(--stroke); padding-top:clamp(14px,1.8vw,20px); }
      .tcx .hx-trust li{ display:flex; align-items:flex-start; gap:9px; }
      .tcx .hx-t-ic{ flex:none; width:27px; height:27px; border-radius:9px; display:grid; place-items:center;
        background:rgba(0,201,197,.13); color:var(--mint); }
      .tcx .hx-trust b{ display:block; font:650 12.5px/1.3 var(--sans); letter-spacing:-.01em; color:var(--ink); }
      .tcx .hx-trust i{ display:block; margin-top:2px; font:400 11.5px/1.4 var(--sans);
        font-style:normal; color:var(--muted); }

      /* ---------- the result cards ---------- */
      .tcx .hx-show{ position:relative; min-height:clamp(340px,35vw,436px); }
      .tcx .hx-show-wash{ position:absolute; inset:6% 2% 4% 4%; border-radius:50%; z-index:0;
        background:radial-gradient(circle at 50% 45%, rgba(0,201,197,.22), rgba(51,105,255,.10) 55%, transparent 74%);
        filter:blur(24px); }
      .tcx .hx-c{ position:absolute; z-index:1; display:flex; flex-direction:column; gap:5px;
        padding:14px 16px; border-radius:16px; background:var(--card);
        border:1px solid var(--stroke-2);
        box-shadow:0 20px 40px -24px rgba(15,39,66,.42), 0 2px 5px -2px rgba(15,39,66,.10); }
      .tcx .hx-c-k{ font:600 11.5px/1.2 var(--sans); letter-spacing:-.005em; color:var(--muted); }
      .tcx .hx-c-v{ font:800 clamp(21px,2.2vw,27px)/1 var(--sans); letter-spacing:-.035em; color:var(--ink);
        font-variant-numeric:tabular-nums; }
      .tcx .hx-c-v small{ font-size:.5em; font-weight:600; margin-left:3px; color:var(--muted); }
      .tcx .hx-c-note{ font:500 10.5px/1.35 var(--sans); color:var(--faint); }

      .tcx .hx-c-bmi{ top:0; left:6%; width:min(216px,52%); align-items:center; gap:7px; padding:14px 16px 12px; }
      .tcx .hx-ring{ position:relative; width:108px; height:108px; }
      .tcx .hx-ring svg{ width:100%; height:100%; transform:rotate(-90deg); }
      .tcx .hx-ring circle{ fill:none; stroke-width:9; stroke-linecap:round; }
      .tcx .hx-ring-bg{ stroke:rgba(15,39,66,.09); }
      .tcx .hx-ring-fg{ stroke:var(--mint-fill); }
      .tcx .hx-ring-mid{ position:absolute; inset:0; display:grid; place-content:center; text-align:center; }
      .tcx .hx-ring-mid b{ display:block; font:800 26px/1 var(--sans); letter-spacing:-.04em; color:var(--ink);
        font-variant-numeric:tabular-nums; }
      .tcx .hx-ring-mid i{ display:block; margin-top:4px; font:500 11px/1 var(--sans); font-style:normal;
        color:var(--muted); }
      .tcx .hx-c-tag{ font:600 10.5px/1 var(--sans); padding:6px 11px; border-radius:999px;
        background:rgba(0,201,197,.13); color:var(--mint); }
      .tcx .hx-c-tag.t-warn{ background:rgba(245,166,35,.16); color:#B0740B; }
      .tcx .hx-c-tag.t-high,
      .tcx .hx-c-tag.t-low{ background:rgba(224,90,74,.14); color:#C0432F; }

      .tcx .hx-c-fat{ top:4%; right:0; width:min(198px,48%); }
      .tcx .hx-bar{ display:block; height:5px; border-radius:99px; background:rgba(15,39,66,.09); overflow:hidden; }
      .tcx .hx-bar i{ display:block; height:100%; border-radius:99px;
        background:linear-gradient(90deg,var(--mint-fill),var(--violet)); }

      .tcx .hx-c-ideal{ bottom:16%; left:0; width:min(206px,50%); }
      .tcx .hx-c-wt{ top:38%; right:2%; width:min(190px,46%); }
      .tcx .hx-spark{ width:100%; height:30px; }
      .tcx .hx-spark polyline{ fill:none; stroke:var(--mint); stroke-width:2.2;
        stroke-linecap:round; stroke-linejoin:round; }
      .tcx .hx-c-cal{ bottom:0; right:6%; width:min(198px,48%); }
      .tcx .hx-c-ic{ position:absolute; top:13px; right:14px; width:26px; height:26px; border-radius:8px;
        display:grid; place-items:center; font-size:13px; }
      .tcx .hx-c-ic[data-i="fat"]{ background:rgba(0,201,197,.14); }
      .tcx .hx-c-ic[data-i="fat"]::before{ content:'🧍'; }
      .tcx .hx-c-ic[data-i="cal"]{ background:rgba(245,166,35,.16); }
      .tcx .hx-c-ic[data-i="cal"]::before{ content:'🔥'; }
      .tcx .hx-teaser-num{ font-family:var(--hx-serif);
        font-size:clamp(46px,5.4vw,72px); line-height:.86; letter-spacing:-.035em; color:var(--mint); }
      .tcx .hx-teaser-num small{ display:block; font-family:inherit; font-size:.18em; font-weight:400;
        text-transform:uppercase; letter-spacing:.18em; color:var(--muted); margin-top:8px; }

      /* ---------- the hero card ---------- */
      .tcx .card-ledger{ -webkit-appearance:none; appearance:none; font-family:inherit; text-align:left;
        cursor:pointer; color:var(--ink); display:flex; flex-direction:column; gap:11px;
        transition:border-color .3s var(--ease-out), box-shadow .3s var(--ease-out); }
      .tcx .card-ledger:hover{ border-color:rgba(10,154,150,.45); box-shadow:0 18px 50px -30px rgba(10,154,150,.6); }
      .tcx .hxc-top{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .tcx .hxc-num{ font-family:var(--hx-serif); font-size:46px; line-height:1;
        letter-spacing:-.03em; color:var(--mint); }
      .tcx .hxc-num small{ font-family:inherit; font-size:.29em; font-weight:400; color:var(--muted);
        margin-left:9px; letter-spacing:0; }
      .tcx .hxc-cta{ display:flex; align-items:center; gap:6px; margin-top:1px; font-size:12px;
        font-weight:700; letter-spacing:-.01em; color:var(--mint); }

      /* the mini band ruler on the hero card, with a marker that tracks BMI */
      .tcx .hxc-track{ position:relative; display:flex; height:3px; border-radius:2px; margin:3px 0 2px; }
      .tcx .hxc-track .b{ height:3px; display:block; }
      .tcx .hxc-track .b[data-tone="low"]{ background:rgba(15,39,66,.13); }
      .tcx .hxc-track .b[data-tone="ok"]{ background:var(--mint-fill); }
      .tcx .hxc-track .b[data-tone="warn"]{ background:rgba(255,180,84,.75); }
      .tcx .hxc-track .b[data-tone="high"]{ background:rgba(255,122,138,.7); }
      .tcx .hxc-track .m{ position:absolute; top:-3px; width:9px; height:9px; border-radius:50%;
        margin-left:-4.5px; background:var(--ink); box-shadow:0 0 0 3px #fff;
        transition:left .55s var(--ease-out), background .4s; }
      .tcx .hxc-track .m.ok{ background:var(--mint); }
      .tcx .hxc-track .m.warn{ background:#C97A16; }
      .tcx .hxc-track .m.high{ background:#E14356; }

      /* The trace — the one thing here that looks like medicine. It stays mint
         whatever the numbers say: a red heartbeat would imply a cardiac finding
         nobody on this page has measured. */
      .tcx .hxc-ecg{ display:block; margin:2px 0 1px; }
      .tcx .hxc-ecg svg{ width:100%; height:30px; display:block; overflow:visible; }
      .tcx .hxc-ecg path{ fill:none; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round;
        vector-effect:non-scaling-stroke; }
      .tcx .hxc-ecg .e-base{ stroke:rgba(15,39,66,.16); }
      .tcx .hxc-ecg .e-run{ stroke:var(--mint); stroke-dasharray:46 600;
        animation:ecgRun 2.9s linear infinite; filter:drop-shadow(0 0 5px rgba(0,201,197,.6)); }
      @keyframes ecgRun{ from{ stroke-dashoffset:646 } to{ stroke-dashoffset:0 } }
      @media (prefers-reduced-motion:reduce){
        .tcx .hxc-ecg .e-run{ animation:none; stroke-dasharray:none; opacity:.85; }
      }

      @media (max-width:940px){
        .tcx .hx-sheet.revealed .hx{ grid-template-columns:1fr; gap:42px; }
        .tcx .hx-inputs,.tcx .hx-sheet.revealed .hx-inputs{ max-width:560px; margin-inline:auto; }
      }
      @media (max-width:1000px){
        .tcx .hx-teaser{ grid-template-columns:1fr; }
        .tcx .hx-show{ min-height:440px; }
      }
      @media (max-width:700px){
        .tcx .hx-trust{ grid-template-columns:1fr; }
        .tcx .hx-sheet{ padding:0; }
        .tcx .hx-sheet-in{ max-height:100dvh; height:100%; border-radius:0; border:0; }
        .tcx .hx-teaser-act{ width:100%; justify-content:space-between; }
      }
      @media (max-width:560px){
        .tcx .hx-band span{ font-size:9px; letter-spacing:.08em; }
        .tcx .hx-scale-val{ font-size:25px; }
        .tcx .hx-band[data-tone="warn"] span{ display:none; }
      }
      @media (prefers-reduced-motion:reduce){
        .tcx .hx-big.beat{ animation:none; }
        .tcx .hx-mark{ transition:none; }
      }


      .tcx .theme-tgl{ display:grid; place-items:center; width:36px; height:36px; flex:none;
        border-radius:11px; cursor:pointer; color:var(--ink-2);
        border:1px solid var(--stroke-2); background:var(--card);
        transition:color .2s ease, background .2s ease, border-color .2s ease, transform .2s ease; }
      .tcx .theme-tgl:hover{ color:var(--mint); border-color:rgba(10,154,150,.4); transform:translateY(-1px); }

      /* ============================================================
         DARK THEME
         Only the colour tokens are redefined - every rule above reads
         through them, so nothing needs a second copy. The brand teal
         and blue are lifted a little because saturated mid-tones go
         muddy on a dark ground.
         ============================================================ */
      .tcx[data-theme="dark"]{
        /* surface - straight from the reference's :root */
        --bg:#05070B; --bg-2:#080C12;
        --panel:rgba(255,255,255,.035); --panel-2:rgba(255,255,255,.055);
        --stroke:rgba(255,255,255,.09); --stroke-2:rgba(255,255,255,.16);

        /* the opaque surfaces this port added. The reference builds its cards
           from translucent white over the near-black ground rather than from a
           solid grey, which is what gives it the glassy look. */
        --card:rgba(255,255,255,.035); --card-2:rgba(255,255,255,.055);
        --card-3:rgba(255,255,255,.085); --wash:rgba(255,255,255,.025);
        --map:#080C12; --shadow:rgba(0,0,0,.9);

        /* ink */
        --ink:#EEF3F6; --ink-2:#B7C3CE; --muted:#7C8B9B; --faint:#4C5866;

        /* brand */
        --mint:#1FE3A5; --mint-fill:#1FE3A5; --mint-dim:#0FA97B;
        --cyan:#38C9F5; --violet:#8E7CFF;
        --amber:#FFB765; --rose:#FF7A8A;
      }
      /* The hero photo and the phone chassis are the two places that were
         already dark; in dark mode they need to sit back, not glow. */
      /* The reference's page is FLAT #05070B - it carries no surface wash at
         all. The five radials below are this port's light-mode invention; on a
         dark ground they read as coloured fog rather than depth, so dark turns
         them off and lets the aurora do the work, exactly as the reference
         does. */
      .tcx[data-theme="dark"]{ background-image:none; }
      .tcx[data-theme="dark"] .aurora i{ filter:blur(90px); opacity:.5; }
      .tcx[data-theme="dark"] .aurora .a1{ width:52vw; height:52vw; left:-14vw; top:-18vw;
        background:radial-gradient(circle at 40% 40%, rgba(31,227,165,.42), transparent 65%); }
      .tcx[data-theme="dark"] .aurora .a2{ width:46vw; height:46vw; right:-12vw; top:-6vw;
        background:radial-gradient(circle at 60% 40%, rgba(56,201,245,.30), transparent 65%); }
      .tcx[data-theme="dark"] .aurora .a3{ width:60vw; height:44vw; left:22vw; top:52vh;
        background:radial-gradient(circle at 50% 50%, rgba(142,124,255,.20), transparent 68%); }
      /* the reference has three blobs, not four */
      .tcx[data-theme="dark"] .aurora .a4{ display:none; }

      /* ---- the Leave-Now map ---- */
      /* leave-route-map.webp is a raster baked on a light ground, so no token
         can reach inside it. Inverting the lightness and rotating the hue back
         180deg is the standard trick for a light map on a dark page: the paper
         goes dark, the roads go light, and the teal route stays teal. The
         animated overlay sits ABOVE the image and is unaffected. */
      .tcx[data-theme="dark"] .map-img{
        filter:invert(1) hue-rotate(180deg) brightness(.94) contrast(.95) saturate(1.15); }
      .tcx[data-theme="dark"] .lnl-map{ border-color:var(--stroke-2); }
      .tcx[data-theme="dark"] .lnl-map .map-demo{
        background:radial-gradient(120% 90% at 20% 10%, #0C121B 0%, #080C12 60%, #05070B 100%); }
      .tcx[data-theme="dark"] .avatars i{ background:#16232F; border-color:rgba(255,255,255,.14); }

      /* ---- surfaces that are literal white veils ---- */
      .tcx[data-theme="dark"] .nav-inner{ background:rgba(255,255,255,.05); }
      .tcx[data-theme="dark"] .nav.shrunk .nav-inner{ background:rgba(8,12,18,.88); }
      .tcx[data-theme="dark"] .glass{
        background:linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.028));
        box-shadow:0 26px 60px -30px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.10); }
      .tcx[data-theme="dark"] .btn-ghost{ background:rgba(255,255,255,.06); }
      .tcx[data-theme="dark"] .burger{ background:rgba(255,255,255,.06); }
      .tcx[data-theme="dark"] .theme-tgl{ background:rgba(255,255,255,.06); }
      .tcx[data-theme="dark"] .menu{ background:rgba(8,12,18,.98); }
      .tcx[data-theme="dark"] .hx-chip{ background:rgba(255,255,255,.06); }
      .tcx[data-theme="dark"] .hx-x{ background:rgba(255,255,255,.09); }
      .tcx[data-theme="dark"] .ph-tabs{ background:rgba(255,255,255,.04); }
      .tcx[data-theme="dark"] .hx-teaser{
        border-color:var(--stroke-2);
        background:
          radial-gradient(80% 120% at 0% 0%, rgba(31,227,165,.14), transparent 62%),
          radial-gradient(70% 110% at 100% 100%, rgba(142,124,255,.10), transparent 65%),
          linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03)); }
      /* the inset top highlight is a paper trick; at .9 it is a bright line in dark */
      .tcx[data-theme="dark"] .hx-sheet-in,
      .tcx[data-theme="dark"] .cta{ box-shadow:0 30px 70px -30px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.12); }

      /* The photo and the phone were built for a light page; on the
         reference's near-black ground they have to sit right back. */
      .tcx[data-theme="dark"] .hero-photo{ opacity:.42; filter:contrast(1.05) saturate(.9) brightness(.7); }
      .tcx[data-theme="dark"] .phone{ background:linear-gradient(160deg,#1a2330,#0a0f16);
        border-color:rgba(255,255,255,.10);
        box-shadow:0 50px 100px -40px rgba(0,0,0,1), inset 0 1px 0 rgba(255,255,255,.16); }
      .tcx[data-theme="dark"] .notch{ background:#04070A; }
      .tcx[data-theme="dark"] .hx-ring-bg{ stroke:rgba(255,255,255,.10); }
      .tcx[data-theme="dark"] .hx-bar{ background:rgba(255,255,255,.10); }
      .tcx[data-theme="dark"] .ph-map svg rect{ fill:#080D13; }
      .tcx[data-theme="dark"] .ph-map svg g{ stroke:#16212C; }
      .tcx[data-theme="dark"] .doc-stars i{ color:rgba(255,255,255,.18); }
      .tcx[data-theme="dark"] .doc-stars i.on{ color:var(--amber); }
      /* the reference's own card depth */
      .tcx[data-theme="dark"] .stat,
      .tcx[data-theme="dark"] .doc-card,
      .tcx[data-theme="dark"] .hx-c{ box-shadow:0 20px 50px -24px rgba(0,0,0,.9); }

      /* The diet block is token-driven apart from three light-mode literals:
         the row hairlines, the flow striping and the amber chip text. Left
         alone they go muddy on the dark ground. */
      .tcx[data-theme="dark"] .hx-diet-row{ border-top-color:rgba(255,255,255,.09); }
      .tcx[data-theme="dark"] .hx-diet-flow li:nth-child(odd){ background:rgba(255,255,255,.04); }
      .tcx[data-theme="dark"] .hx-diet-chip{ background:rgba(245,166,35,.16); color:#F0B44A;
        border-color:rgba(245,166,35,.34); }
      .tcx[data-theme="dark"] .stat:nth-child(odd){ background:var(--card-2); }
      .tcx[data-theme="dark"] .stat:hover{ background:var(--card-3); }

      /* ============================================================
         SECTION RESPONSIVE
         ============================================================ */
      @media (max-width:1000px){
        .tcx .ln-grid{ grid-template-columns:1fr; }
        .tcx .ln-feats{ grid-template-columns:repeat(2,1fr); }
        .tcx .spec-grid{ grid-template-columns:repeat(2,1fr); }
        .tcx .doc-grid{ grid-template-columns:1fr; }
        .tcx .stats{ grid-template-columns:repeat(2,1fr); }
        .tcx .quotes{ grid-template-columns:1fr; }
        .tcx .app-grid{ grid-template-columns:1fr; }
        .tcx .f-grid{ grid-template-columns:repeat(3,1fr); }
      }
      @media (max-width:640px){
        .tcx .stats{ grid-template-columns:1fr; }
        .tcx .ln-feats{ grid-template-columns:1fr; }
        .tcx .spec-grid{ grid-template-columns:1fr; }
        .tcx .f-grid{ grid-template-columns:1fr; }
        .tcx .two{ grid-template-columns:1fr; }
        .tcx .tl-item{ grid-template-columns:84px 20px 1fr; }
        .tcx .tl-dur{ display:none; }
        .tcx .qa .ans p{ padding-right:8px; }
      }

      /* ---------- responsive ---------- */
      /* Tablets (2026-10-27): the full link row only fits from ~1180px — at
         1024px "Log in / Sign up" was pushed off the screen — so the burger
         takes over up to 1180px. */
      @media (max-width:1180px){
        .tcx .nav-links{ display:none; }
        .tcx .burger{ display:flex; }
        /* The hidden links were what pushed the buttons right (margin-left:auto);
           without them the buttons bunched up next to the logo. */
        .tcx .nav-cta{ margin-left:auto; }
      }
      /* One-column hero up to 1100px (iPad Pro portrait squeezed the search
         fields in two columns). In one column the photo is NOT pulled up —
         that lift is for the desktop layout and here slid it under the search bar. */
      @media (max-width:1100px){
        .tcx .hero-grid{ grid-template-columns:1fr; }
        .tcx .hero-visual{ height:clamp(380px,80vw,460px); }
        .tcx .hero-photo{ inset:0 -6% 0 -8%; }
        /* Line the doctor card up with the text edge above it (it hung 15-20px
           past it on tablet/phone). */
        .tcx .card-doc{ left:0; }
      }
      /* Phones: logo + theme + "Log In / Sign Up" + burger don't fit in the bar —
         the login button poked out and pushed the burger off-screen. The burger
         menu already lists every login role, so drop the separate button here. */
      @media (max-width:480px){
        .tcx .nav-login{ display:none; }
      }
      @media (max-width:700px){
        .tcx .bookbar{ grid-template-columns:1fr 1fr; border-radius:var(--r-lg); }
        .tcx .bookbar .btn{ grid-column:span 2; width:100%; }
        .tcx .bookbar .fld{ border-radius:var(--r-sm); }
        .tcx .nav-cta .btn-ghost{ display:none; }
      }

      /* ---------- Telugu / Hindi text sizes ----------
         Same px size looks much bigger in Telugu (marks above and below every
         letter) and the sentences are longer, so the hero headline grew 33% taller
         and pushed the search bar 110px down. Only text is resized here —
         numbers (4:12, 121) stay as they are. English is untouched.
         <html lang> is set by the i18n provider. Telugu ~25% smaller headings,
         Hindi (milder) ~12%. Extra line-height keeps the marks from touching. */
      html[lang="te"] .tcx .hero h1{ font-size:clamp(29px,4.2vw,52px); line-height:1.24; }
      html[lang="te"] .tcx h2{ font-size:clamp(25px,3.5vw,44px); line-height:1.28; }
      html[lang="te"] .tcx #specialties .sec-head h2,
      html[lang="te"] .tcx .hx-teaser-copy h2{ font-size:clamp(21px,2.4vw,30px); }
      html[lang="te"] .tcx h3{ font-size:clamp(17px,1.9vw,22px); line-height:1.38; }
      html[lang="te"] .tcx .lnl-h{ font-size:clamp(22px,2.8vw,36px); line-height:1.3; }
      html[lang="te"] .tcx .lnl-mode{ font-size:clamp(19px,2.5vw,32px); }
      html[lang="te"] .tcx .hx-sheet h3{ font-size:clamp(22px,2.7vw,33px); line-height:1.3; }
      html[lang="te"] .tcx .hx-next p,
      html[lang="te"] .tcx .hx-guess-q{ font-size:clamp(17px,2vw,23px); line-height:1.4; }
      html[lang="te"] .tcx .hx-verdict{ font-size:clamp(16px,1.8vw,21px); line-height:1.45; }
      html[lang="te"] .tcx .lede{ font-size:clamp(15px,1.25vw,17.5px); line-height:1.75; }

      html[lang="hi"] .tcx .hero h1{ font-size:clamp(33px,4.9vw,62px); line-height:1.18; }
      html[lang="hi"] .tcx h2{ font-size:clamp(28px,3.9vw,49px); line-height:1.2; }
      html[lang="hi"] .tcx #specialties .sec-head h2,
      html[lang="hi"] .tcx .hx-teaser-copy h2{ font-size:clamp(23px,2.65vw,33px); }
      html[lang="hi"] .tcx h3{ font-size:clamp(18px,2vw,23.5px); line-height:1.3; }
      html[lang="hi"] .tcx .lnl-h{ font-size:clamp(24px,3.2vw,41px); line-height:1.2; }
      html[lang="hi"] .tcx .lnl-mode{ font-size:clamp(21px,2.8vw,37px); }
      html[lang="hi"] .tcx .hx-sheet h3{ font-size:clamp(24px,3vw,37px); line-height:1.22; }
      html[lang="hi"] .tcx .hx-next p,
      html[lang="hi"] .tcx .hx-guess-q{ font-size:clamp(19px,2.25vw,26px); line-height:1.35; }
      html[lang="hi"] .tcx .hx-verdict{ font-size:clamp(17px,2vw,23.5px); line-height:1.4; }
      html[lang="hi"] .tcx .lede{ font-size:clamp(15.5px,1.3vw,18px); line-height:1.7; }

      @media (prefers-reduced-motion: reduce){
        .tcx .rv{ opacity:1; transform:none; transition:none; }
        .tcx .ecg path,.tcx .eyebrow .dot,.tcx .live-dot{ animation:none !important; }
        .tcx .type-text{ animation:none; }
      }

      /* ── 2026-11-08 readable text (comes last, so these win) ───────────────
         1. Small labels: 13.5px in normal letters, darker — no tiny grey
            CAPITALS with wide spacing.
         2. Headings and big numbers: one bold weight everywhere.
         3. Details: 13–15px, readable grey; nothing under 13px. */
      .tcx .kicker, .tcx .route-mini .seg span, .tcx .bookbar label, .tcx .lnl-tag, .tcx .lnl-pre,
      .tcx .lnl-day, .tcx .lnl-f label, .tcx .pr-inc-title, .tcx .f-col h4, .tcx .hx-f label, .tcx .hx-pre,
      .tcx .hx-scale-name, .tcx .hx-ledger h4, .tcx .hx-diet-h span, .tcx .hx-diet-meal, .tcx .hx-s-top label,
      .tcx .hx-play-q, .tcx .hx-tool-q, .tcx .hx-tool-lbl, .tcx .mm-lang-h{
        font-family:var(--sans); font-size:13.5px; font-weight:650; letter-spacing:0; text-transform:none; color:var(--ink-2); }
      .tcx .lnl-tag b{ font-weight:700; }
      .tcx .route-mini .seg span{ font-size:13px; font-weight:500; }
      .tcx .f-col h4{ font-size:14px; font-weight:700; color:var(--ink); }
      .tcx .doc-free{ font-size:12.5px; letter-spacing:0; text-transform:none; }

      .tcx .serif{ font-weight:inherit; }
      .tcx .lnl-h, .tcx .hx-sheet h3{ font-weight:800; letter-spacing:-.025em; }
      .tcx .lnl-big, .tcx .hx-big, .tcx .hx-teaser-num{ font-weight:700; }
      .tcx .lnl .ln-panel h3{ font-weight:700; }

      .tcx .doc-row .who, .tcx .dateline i, .tcx .hxc-cta, .tcx .spec > span:last-child, .tcx .doc-langs,
      .tcx .quote-by span span, .tcx .pr-tile-l, .tcx .menu .sub, .tcx .hx-diet-alt, .tcx .hx-diet-safe,
      .tcx .hx-score, .tcx .hx-tool-warn, .tcx .lnl-maptag, .tcx .pr-save, .tcx .pr-badge{ font-size:13px; }
      .tcx .doc-meta span, .tcx .fee, .tcx .stat span, .tcx .cta .fine, .tcx .pr-inc li, .tcx .pr-per,
      .tcx .hx-priv, .tcx .hx-diet-body > span, .tcx .hx-diet-why, .tcx .hx-guess-note, .tcx .hx-hint,
      .tcx .ln-appt-facts dt{ font-size:14px; }
      .tcx .feat b{ font-size:16.5px; }
      .tcx .feat p{ font-size:15px; color:var(--ink-2); }
      .tcx .spec > span:last-child, .tcx .doc-meta span, .tcx .doc-langs, .tcx .stat span, .tcx .feat p,
      .tcx .pr-inc li, .tcx .hx-priv, .tcx .cta .fine{ color:var(--ink-2); }
      .tcx .feat .ic{ color:var(--mint); }

      .tcx .hx-trust b{ font-size:15px; }
      .tcx .hx-trust i{ font-size:14px; color:var(--ink-2); }
      .tcx .hx-teaser-num small{ font-family:var(--sans); font-size:14px; font-weight:600; letter-spacing:0; text-transform:none; color:var(--ink-2); }
      .tcx .check b{ font-size:16px; }
      .tcx .check span span{ font-size:15px; color:var(--ink-2); }

      /* the phone picture: still small, but readable */
      .tcx .ph-hello{ font-size:12.5px; }
      .tcx .ph-card .kicker{ font-size:11.5px; color:var(--mint); }
      .tcx .ph-card .s{ font-size:12px; }
      .tcx .ph-row b{ font-size:12.5px; }
      .tcx .ph-row span span{ font-size:11.5px; }

      /* ── 2026-11-08 calm motion ────────────────────────────────────────────
         One story that moves (the leave-time steps light up as you scroll, the
         clock turns green → orange → red as leaving time gets close); quick,
         one-time reveals; buttons that respond to a tap. Grain, the cursor light
         and the moving specialty strip are gone. */
      .tcx .rv{ transform:translateY(14px); transition:opacity .55s var(--ease-out), transform .55s var(--ease-out); }
      .tcx .rv.d1{ transition-delay:.05s } .tcx .rv.d2{ transition-delay:.1s } .tcx .rv.d3{ transition-delay:.15s }
      .tcx .rv.d4{ transition-delay:.2s } .tcx .rv.d5{ transition-delay:.25s }

      .tcx .lnl-big{ color:var(--mint); transition:color .8s var(--ease); }
      .tcx .lnl-cd b{ transition:color .8s var(--ease); }
      .tcx .lnl-st.is-warn .lnl-cd b{ color:#C97A16; }
      .tcx .lnl-st.is-bad .lnl-cd b{ color:#E14356; }

      .tcx .tl-item{ opacity:.5; transition:opacity .5s var(--ease); }
      .tcx .tl-item.on{ opacity:1; }
      .tcx .tl-item .tl-dot{ transition:background .4s var(--ease), border-color .4s var(--ease), box-shadow .4s var(--ease); }
      .tcx .tl-item.on .tl-dot{ background:var(--mint-fill); border-color:var(--mint); box-shadow:0 0 0 4px rgba(0,201,197,.18); }
      .tcx .tl-item.turn.on .tl-dot{ background:var(--cyan); border-color:var(--cyan); box-shadow:0 0 0 4px rgba(47,88,183,.18); }
      .tcx .tl-rail::before{ transition:background .5s var(--ease); }
      .tcx .tl-item.on + .tl-item.on .tl-rail::before, .tcx .tl-item.on .tl-rail::before{ background:rgba(10,154,150,.45); }

      .tcx .btn{ transition:transform .18s var(--ease), box-shadow .25s var(--ease), background .25s var(--ease); }
      .tcx .btn:hover{ transform:translateY(-1px); }
      .tcx .btn:active{ transform:translateY(1px) scale(.98); }

      @media (prefers-reduced-motion: reduce){
        .tcx .tl-item{ opacity:1; transition:none; }
        .tcx .lnl-big, .tcx .lnl-cd b, .tcx .tl-item .tl-dot, .tcx .btn{ transition:none; }
        .tcx .btn:hover, .tcx .btn:active{ transform:none; }
      }

      /* ── 2026-11-08 two sides at every stop: the journey stays on the left along
         the road; the right holds a card that sums the stop up, like the
         appointment card at the clock stop. Phones stack them. */
      .tcx .ln-two{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,380px); gap:clamp(32px,6vw,96px); align-items:center; }
      .tcx .ln-card{ padding:22px; border-radius:var(--r-md); display:grid; gap:14px; }
      .tcx .ln-card-big{ margin:0; font-family:var(--head); font-size:40px; font-weight:800; letter-spacing:-.03em; line-height:1; color:var(--ink); }
      .tcx .ln-bar{ display:flex; gap:4px; height:12px; }
      .tcx .ln-bar i{ border-radius:99px; background:var(--mint); }
      .tcx .ln-bar i.warn{ background:#E0A04A; }
      .tcx .ln-bar i.old{ background:rgba(225,67,86,.55); }
      .tcx .ln-bar i.empty{ background:var(--stroke); }
      .tcx .ln-card-rows{ display:grid; gap:8px; margin:0; }
      .tcx .ln-card-rows div{ display:flex; justify-content:space-between; gap:12px; font-size:15px; }
      .tcx .ln-card-rows dt{ display:flex; align-items:center; gap:8px; color:var(--ink-2); }
      .tcx .ln-card-rows dd{ margin:0; font-weight:700; color:var(--ink); }
      .tcx .ln-card-rows .sw{ width:10px; height:10px; border-radius:3px; background:var(--mint); }
      .tcx .ln-card-rows .sw.warn{ background:#E0A04A; }
      .tcx .lnl .ln-card .ln-note{ margin:0; }
      .tcx .ln-cmp{ display:grid; gap:8px; }
      .tcx .ln-cmp p{ margin:6px 0 0; display:flex; justify-content:space-between; gap:12px; font-size:15px; color:var(--ink-2); }
      .tcx .ln-cmp b{ color:var(--ink); }
      .tcx .ln-cmp b.good{ color:var(--mint); }
      @media (max-width:900px){ .tcx .ln-two{ grid-template-columns:1fr; gap:24px; } }
    `}</style>
  )
}

/** Arrow used on the primary CTAs. */
function ArrowIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-6-7 7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LandingPage() {
  return (
    <AuthModalProvider>
      <LedgerProvider>
        <LandingShell />
      </LedgerProvider>
    </AuthModalProvider>
  )
}

function LandingShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState(readTheme)

  /* Persist the choice. Storage can throw outright in a locked-down browser,
     so a failure here must not take the page with it. */
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, theme) } catch { /* not fatal */ }
  }, [theme])
  const rootRef = useRef(null)

  // Scroll reveals. One observer for the whole page; each element unobserves
  // itself once shown, so nothing keeps firing as the page scrolls.
  useEffect(() => {
    const targets = rootRef.current?.querySelectorAll('.rv')
    if (!targets?.length) return undefined
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('in'))
      return undefined
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('in')
        io.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={rootRef}
      data-theme={theme}
      className={`tcx ${menuOpen ? 'menu-open' : ''}`}
    >
      <PageStyles />
      <div className="aurora" aria-hidden="true"><i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" /></div>

      <Nav menuOpen={menuOpen} setMenuOpen={setMenuOpen} theme={theme} setTheme={setTheme} />
      <main>
        <Hero />
        <TcSections />
      </main>
    </div>
  )
}

/* ─────────────────────────────  NAV  ───────────────────────────── */

function Nav({ menuOpen, setMenuOpen, theme, setTheme }) {
  const navigate = useNavigate()
  const { openAuth } = useAuthModal()
  const { lang, setLang, t } = useI18n()
  const [shrunk, setShrunk] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setShrunk(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setLangOpen(false); setRoleOpen(false) }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Hospital has its own login screen; patient and doctor open the shared modal.
  const go = (role) => {
    setRoleOpen(false)
    setMenuOpen(false)
    if (role === 'hospital') return navigate('/hospital-login')
    openAuth(role)
  }

  const goTo = (to) => { setMenuOpen(false); navigate(to) }

  return (
    <>
      <header className={`nav ${shrunk ? 'shrunk' : ''}`}>
        <div className="nav-inner" ref={wrapRef}>
          <button className="logo" onClick={() => navigate('/')}>
            {/* The real TapCure mark. The reference shipped a generic plus-in-a
                -square here; using it would have thrown away the brand. */}
            <img src="/tapcure-icon.png" alt="" className="logo-img" />
            {/* Wordmark over the brand line, as on every console header. */}
            <span className="logo-lockup">
              <span>Tap<b>Cure</b></span>
              <Tagline text={t('tc.foot.tagline')} className="logo-line" />
            </span>
          </button>

          <nav className="nav-links">
            {NAV_LINKS.map((l) => (
              <button key={l.key} onClick={() => goTo(l.to)}>{t(l.i18n)}</button>
            ))}
            {/* Opens the sixty-second check straight away. LedgerProvider already
                listens for `tc:open-ledger`, so the nav does not need the ledger
                context — it just fires the event the provider waits for. */}
            <button
              className="nav-magic"
              onClick={() => window.dispatchEvent(new Event('tc:open-ledger'))}
            >
              <span aria-hidden="true">✨</span> {t('land.nav.magic')}
            </button>
          </nav>

          <div className="nav-cta">
            {/* theme */}
            <button
              className="theme-tgl"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? t('lx.nav.toLight') : t('lx.nav.toDark')}
              title={theme === 'dark' ? t('lx.nav.lightMode') : t('lx.nav.darkMode')}
            >
              {theme === 'dark' ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
            </button>

            {/* language */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setLangOpen((o) => !o); setRoleOpen(false) }}
              >
                {LANGS[lang].label}
              </button>
              {langOpen && (
                <div className="menu" style={{ minWidth: 140 }}>
                  {Object.entries(LANGS).map(([code, meta]) => (
                    <button
                      key={code}
                      className={code === lang ? 'on' : ''}
                      onClick={() => { setLang(code); setLangOpen(false) }}
                    >
                      {meta.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* login */}
            <div className="nav-login" style={{ position: 'relative' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setRoleOpen((o) => !o); setLangOpen(false) }}
              >
                {t('land.nav.login')}
              </button>
              {roleOpen && (
                <div className="menu">
                  {ROLES.map((role) => (
                    <button key={role} onClick={() => go(role)}>
                      <span>
                        <b style={{ display: 'block', fontSize: 14 }}>{t('land.role.' + role)}</b>
                        <span className="sub">{t('land.role.' + role + 'Desc')}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="burger"
              aria-label={t('land.nav.menu')}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span />
            </button>
          </div>
        </div>
      </header>

      <div className="mobile-menu">
        {NAV_LINKS.map((l) => (
          <button key={l.key} onClick={() => goTo(l.to)}>{t(l.i18n)}</button>
        ))}
        {ROLES.map((role) => (
          <button key={role} onClick={() => go(role)}>{t('land.role.' + role)}</button>
        ))}
        <button onClick={() => { setMenuOpen(false); window.dispatchEvent(new Event('tc:open-ledger')) }}>
          ✨ {t('land.nav.magic')}
        </button>
        {/* Language. The desktop switcher is hidden below 700px, so without this
            row a phone user — most of the audience — had no way to reach Telugu
            or Hindi at all. Shown as three tappable chips rather than a
            dropdown: on a small screen a menu inside a menu is a trap, and the
            native script is the whole point of the choice. */}
        <div className="mm-lang">
          <span className="mm-lang-h">{t('land.nav.language')}</span>
          <div className="mm-lang-row">
            {Object.entries(LANGS).map(([code, meta]) => (
              <button
                key={code}
                className={code === lang ? 'on' : ''}
                onClick={() => { setLang(code); setMenuOpen(false) }}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────  HERO  ───────────────────────────── */

function Hero() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { openAuth } = useAuthModal()
  const [spec, setSpec] = useState(SPECIALTIES[0])
  const [city, setCity] = useState(() => {
    try { return localStorage.getItem('tapcure.search-city') || '' } catch { return '' }
  })
  const [cities, setCities] = useState([])

  // Cities TapCure actually serves. Same cache the old hero used, so a repeat
  // visit never flashes an empty control.
  useEffect(() => {
    let active = true
    const CACHE_KEY = 'tapcure.cities'
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
      if (Array.isArray(cached) && cached.length) setCities(cached)
    } catch { /* ignore a corrupt cache and refetch */ }

    discoveryApi.cities()
      .then((result) => {
        if (!active) return
        const available = (result?.cities || []).filter(Boolean)
        if (!available.length) return
        setCities(available)
        setCity((current) => {
          if (!current || available.includes(current)) return current
          try { localStorage.removeItem('tapcure.search-city') } catch { /* ignore */ }
          return ''
        })
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(available)) } catch { /* private mode */ }
      })
      .catch(() => { /* keep whatever is showing */ })
    return () => { active = false }
  }, [])

  const chooseCity = (value) => {
    setCity(value)
    try {
      if (value) localStorage.setItem('tapcure.search-city', value)
      else localStorage.removeItem('tapcure.search-city')
    } catch { /* search still works without storage */ }
  }

  // The booking bar is a real search: same `?q=&city=` contract the rest of the
  // app uses, so results are live doctors rather than a demo.
  const findSlots = () => {
    const params = new URLSearchParams()
    if (spec) params.set('q', spec)
    if (city) params.set('city', city)
    navigate(`/search${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero-grid">

          <div className="hero-copy">
            <p className="hero-type rv">
              <TypeLoop text={t('tc.hero.eyebrow')} />
            </p>

            <h1 className="rv d1">
              {t('tc.hero.h1a')}<br />
              <span className="serif grad">{t('tc.hero.h1b')}</span> {t('tc.hero.h1c')}
            </h1>

            <p className="lede rv d2">
              {t('tc.hero.ledeA')} <b style={{ color: 'var(--ink)' }}>{t('tc.hero.exactMinute')}</b> {t('tc.hero.ledeB')}
            </p>

            <div className="hero-actions rv d3">
              <button className="btn btn-primary btn-lg cta-glow" onClick={() => openAuth('patient')}>
                {t('tc.hero.book')} <ArrowIcon />
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => navigate('/search')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                {t('tc.hero.browse')}
              </button>
            </div>

            <div className="trust rv d4">
              <span className="avatars" aria-hidden="true">
                <i data-i="AR" /><i data-i="SM" /><i data-i="KP" /><i data-i="DV" /><i data-i="+9" />
              </span>
              <span><b style={{ color: 'var(--ink)' }}>25,000+</b> {t('tc.hero.keptOnTime')}</span>
              <span className="stars">★★★★★</span>
              <span>4.8 / 5 · 1,240 {t('tc.hero.reviews')}</span>
            </div>

            <div className="glass bookbar rv d5" style={{ marginTop: 28 }}>
              <div className="fld">
                <label htmlFor="qSpec">{t('tc.hero.specialty')}</label>
                <select id="qSpec" value={spec} onChange={(e) => setSpec(e.target.value)}>
                  {SPECIALTIES.map((s) => <option key={s} value={s}>{t(specKey(s))}</option>)}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="qCity">{t('tc.hero.location')}</label>
                <select id="qCity" value={city} onChange={(e) => chooseCity(e.target.value)}>
                  <option value="">{t('tc.hero.allCities')}</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={findSlots}>{t('tc.hero.findSlots')}</button>
            </div>
          </div>

          {/* floating stack */}
          <div className="hero-visual rv d3">
            <div className="hero-photo" aria-hidden="true" />

            <div className="glass float card-leave">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kicker">{t('tc.hero.leaveHomeBy')}</span>
                <span className="pill good"><i className="live-dot" /> {t('tc.hero.live')}</span>
              </div>
              <div className="leave-time">4:12<small>PM</small></div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                {t('tc.hero.ammaCheckup')} · <b style={{ color: 'var(--ink)' }}>5:00 PM</b> {t('tc.hero.with')} {t('lx.demo.Dr. Anaya Rao')}
              </div>
              <div className="route-mini">
                <div className="seg"><b>{t('lx.hero.minShort', { n: 18 })}</b><span>{t('tc.hero.drive')}</span></div>
                <span className="arrow">›</span>
                <div className="seg"><b>{t('lx.hero.minShort', { n: 30 })}</b><span>{t('tc.hero.checkIn')}</span></div>
              </div>
            </div>

            <div className="glass float card-doc">
              <div className="doc-row">
                <span className="doc-ava">AR</span>
                <span>
                  <b>{t('lx.demo.Dr. Anaya Rao')}</b>
                  <span className="who">{t('tc.hero.docWho')}</span>
                </span>
              </div>
              <div className="dateline">
                {NEXT_DAYS.map((d, i) => (
                  <i key={i} className={i === 0 ? 'on' : undefined}>
                    {i === 0
                      ? t('tc.doc.today')
                      : d.toLocaleDateString(DAY_LOCALE[lang] || 'en-IN', { weekday: 'short', day: 'numeric' })}
                  </i>
                ))}
              </div>
            </div>

            {/* The reference's third card is the minutes-ledger trigger, not a
                read-out — clicking it opens the 60-second check. The ledger
                lives further down the page, so it is opened by event. */}
            {/* Live readout wired to the ledger's own state — the number and the
                marker move as the check is filled in, exactly as the reference's
                paintEntry() does. */}
            <LedgerHeroCard />
          </div>
        </div>
      </div>
    </section>
  )
}

export default LandingPage
