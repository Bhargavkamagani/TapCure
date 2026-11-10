/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    /**
     * Which colours may be used as a SHADOW colour (`shadow-black` etc).
     *
     * This normally defaults to the whole `colors` palette — and that quietly
     * broke every card. `colors.card` is `#ffffff` (it backs `bg-card`), so
     * Tailwind also emitted a `shadow-card` *colour* utility, which collided
     * with the `boxShadow.card` token of the same name:
     *
     *   .shadow-card{--tw-shadow: 0 2px 10px rgba(15,39,66,.06); ...}  <- token
     *   .shadow-card{--tw-shadow-color:#fff; --tw-shadow:var(--tw-shadow-colored)}
     *
     * Same specificity, and the colour one is emitted later, so it won: every
     * element with `shadow-card` — which is the shared <Card/> — was painted
     * with a solid WHITE box-shadow. On the light consoles that is invisible
     * (white glow on a near-white page); in dark mode it read as a white halo
     * behind every card.
     *
     * Restricting the list to the four that are actually used as shadow
     * colours stops the collision. `shadow-black` is the only one in the app.
     */
    boxShadowColor: {
      transparent: 'transparent',
      current: 'currentColor',
      black: '#000',
      white: '#fff',
    },
    extend: {
      colors: {
        // Brand palette driven by CSS variables (RGB channels) so a single
        // console can re-skin itself by overriding the vars on a wrapper (see
        // index.css `.theme-reception`). Defaults = the original royal-blue brand,
        // so every console that doesn't opt in looks exactly as before.
        brand: {
          blue: 'rgb(var(--brand-blue) / <alpha-value>)',
          blueDark: 'rgb(var(--brand-blueDark) / <alpha-value>)',
          blueLight: 'rgb(var(--brand-blueLight) / <alpha-value>)',
          teal: 'rgb(var(--brand-teal) / <alpha-value>)',
          green: 'rgb(var(--brand-green) / <alpha-value>)',
          greenLight: 'rgb(var(--brand-greenLight) / <alpha-value>)',
          navy: 'rgb(var(--brand-navy) / <alpha-value>)',
        },

        // Landing "sweet-looker" layout tokens, tuned to the TapCure brand:
        // teal primary + navy ink + green/amber accents on a soft teal paper.
        // Only the landing page uses these tokens.
        background: '#f6fbfa',
        foreground: '#0f2742',
        border: '#d8e7e4',
        input: '#d8e7e4',
        ring: '#0d9488',
        cream: '#e9f7f4',
        clay: '#16a34a',
        ember: '#ef4444',
        ink: { DEFAULT: '#0f2742', soft: '#475569' },
        sage: { DEFAULT: '#ccfbf1', deep: '#0f766e' },
        card: { DEFAULT: '#ffffff', foreground: '#0f2742' },
        primary: { DEFAULT: '#0d9488', foreground: '#ffffff' },
        muted: { DEFAULT: '#eef5f3', foreground: '#64748b' },
      },
      fontFamily: {
        // One text style for the whole app (2026-11-08): Inter for reading text,
        // Plus Jakarta Sans for headings, Noto for Telugu and Hindi letters
        // (Inter and Jakarta have none, so phones each picked their own font).
        sans: ['Inter', '"Noto Sans Telugu"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', '"Noto Sans Telugu"', '"Noto Sans Devanagari"', 'Inter', 'system-ui', 'sans-serif'],
        // The old serif and rounded heading faces now point at the heading font,
        // so every `font-serif` / `font-display` heading matches the rest.
        serif: ['"Plus Jakarta Sans"', '"Noto Sans Telugu"', '"Noto Sans Devanagari"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', '"Noto Sans Telugu"', '"Noto Sans Devanagari"', 'Inter', 'system-ui', 'sans-serif'],
      },
      // Text sizes in px (2026-11-08). index.css shrinks the root to 80%, which
      // made the rem defaults tiny (text-xs was 9.6px, text-sm 11.2px). Fixed px
      // keep every label readable (13px and up) while spacing stays as it is.
      fontSize: {
        xs: ['13px', { lineHeight: '18px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['17px', { lineHeight: '26px' }],
        xl: ['19px', { lineHeight: '28px' }],
        '2xl': ['22px', { lineHeight: '30px' }],
        '3xl': ['27px', { lineHeight: '34px' }],
        '4xl': ['32px', { lineHeight: '38px' }],
        '5xl': ['40px', { lineHeight: '1.1' }],
        '6xl': ['50px', { lineHeight: '1.05' }],
      },
      boxShadow: {
        card: '0 2px 10px rgba(15, 39, 66, 0.06)',
        cardHover: '0 6px 20px rgba(15, 39, 66, 0.10)',
        soft: '0 1px 2px rgba(30, 43, 36, 0.04), 0 8px 24px rgba(30, 43, 36, 0.06)',
        lift: '0 2px 4px rgba(30, 43, 36, 0.05), 0 20px 48px rgba(30, 43, 36, 0.10)',
      },
    },
  },
  plugins: [],
}
