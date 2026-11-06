import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Content-Security-Policy, written into index.html as a <meta> tag on BUILD
 * only. The dev server injects an inline React-refresh script that this policy
 * would block, so `npm run dev` stays unrestricted; test with build + preview.
 *
 * The point is XSS: auth tokens live in localStorage, so any script that gets
 * onto the page can read them. With no 'unsafe-inline' in script-src, injected
 * <script> tags, onerror= handlers and javascript: URLs do not run.
 *
 * Every origin below is one the app really loads from. When a feature starts
 * calling a new host, add it here — otherwise the browser blocks it silently
 * (look for "Content-Security-Policy" in the console).
 */
function cspPlugin(env) {
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000' // same default as api/client.js
  const api = apiUrl.startsWith('/') ? "'self'" : new URL(apiUrl).origin
  const google = !!env.VITE_GOOGLE_MAPS_API_KEY // lib/googleMaps.js only loads with a key

  const razorpay = 'https://*.razorpay.com' // checkout.js, its iframe and API calls
  const s3 = 'https://*.amazonaws.com' // presigned photo/document URLs (services/storage.py)
  const mapTiles = 'https://api.mapbox.com https://*.tile.openstreetmap.org' // components/common/ClinicMap.jsx
  const geocoders = 'https://api.mapbox.com https://photon.komoot.io https://nominatim.openstreetmap.org' // lib/geo.js, lib/places.js
  const lottieWasm = 'https://cdn.jsdelivr.net https://unpkg.com' // dotlottie-web fetches its .wasm from these

  // Google's documented allowlist for the Maps JS API, which needs 'unsafe-eval'.
  // Only added when a key is configured, so builds without Maps stay stricter.
  const g = google
    ? {
        script: " 'unsafe-eval' blob: https://*.googleapis.com https://maps.gstatic.com https://*.ggpht.com",
        img: ' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com',
        connect: ' https://*.googleapis.com https://*.google.com https://*.gstatic.com',
        frame: ' https://*.google.com',
      }
    : { script: '', img: '', connect: '', frame: '' }

  const policy = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${razorpay}${g.script}`,
    // 'unsafe-inline' for styles only: LandingPage renders a <style> block and
    // Leaflet/framer-motion set inline styles. Inline CSS cannot run script.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${api} ${s3} ${mapTiles} ${razorpay}${g.img}`,
    `connect-src 'self' ${api} ${geocoders} ${lottieWasm} ${razorpay}${g.connect}`,
    "media-src 'self' blob:", // voice TTS plays from a blob: URL (lib/voice.js)
    `frame-src ${razorpay}${g.frame}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${razorpay}`,
  ].join('; ')

  return {
    name: 'tapcure-csp',
    apply: 'build',
    // Right after <meta charset> (which must stay within the first 1024 bytes)
    // and before every script and stylesheet, since a meta CSP only governs
    // what the parser meets after it.
    transformIndexHtml: (html) =>
      html.replace(
        /(<meta charset="UTF-8" \/>)/,
        `$1\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      ),
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), cspPlugin(loadEnv(mode, process.cwd(), 'VITE_'))],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split stable framework libs into their own chunk so they stay cached
        // across deploys — a new release only re-downloads app code, not React.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'react-vendor'
            }
            if (id.includes('framer-motion')) return 'motion'
          }
        },
      },
    },
  },
}))
