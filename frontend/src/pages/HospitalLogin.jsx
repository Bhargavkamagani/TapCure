import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { takeSignedOutReason } from '../lib/signedOut.js'
import ForgotPasswordFlow from '../components/auth/ForgotPasswordFlow.jsx'
import Wordmark from '../components/common/Wordmark.jsx'
import { MODERN_FONT } from '../components/landing/ModernChrome.jsx'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mobileRe = /^\d{10}$/

/* ───────────────────────── look (2026-11-08) ─────────────────────────
 * A calm form on the left; on the right the same glass stage as the patient
 * Register page had (frosted disc, slow ring, floating object, soft shadow,
 * glass chips), holding the beating 3D glass heart.
 * On desktop the page is laid out on an 810px-tall canvas and zoomed to the
 * window, so it fits one screen, with no scroll, on every machine.
 */

const CANVAS_H = 810
const PANEL_W = 840

/** Desktop zoom for the canvas: { z, w } (w = canvas width), or null on phones. */
function useCanvasFit() {
  const measure = () => {
    if (typeof window === 'undefined' || window.innerWidth <= 900) return null
    const z = Math.min(window.innerHeight / CANVAS_H, window.innerWidth / 1400)
    return { z, w: window.innerWidth / z }
  }
  const [fit, setFit] = useState(measure)
  useEffect(() => {
    const on = () => setFit(measure())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return fit
}

/* three.js r128 + its GLTF loader, served from our own /vendor folder (the
   build's Content-Security-Policy only allows our own scripts). Loaded only on
   desktop, where the heart shows, so phones never fetch it. */
const VENDOR = '/vendor/three-r128/'
const addScript = (src) => new Promise((resolve, reject) => {
  const s = document.createElement('script')
  s.src = src
  s.async = false
  s.onload = resolve
  s.onerror = () => reject(new Error(src))
  document.head.appendChild(s)
})
let threeLoading = null
function loadThree() {
  if (window.THREE?.GLTFLoader && window.THREE.RoomEnvironment) return Promise.resolve(window.THREE)
  if (!threeLoading) {
    threeLoading = (window.THREE ? Promise.resolve() : addScript(`${VENDOR}three.min.js`))
      .then(() => Promise.all([addScript(`${VENDOR}GLTFLoader.js`), addScript(`${VENDOR}RoomEnvironment.js`)]))
      .then(() => window.THREE)
      .catch((e) => { threeLoading = null; throw e })
  }
  return threeLoading
}

/** An anatomical heart (NIH 3D, 3DPX-022787, public domain) drawn as deep red
 *  muscle under a thin glass layer with a bright glass edge. It turns slowly
 *  and beats lub-dub. Returns a cleanup function. */
function buildHeart(host, THREE) {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputEncoding = THREE.sRGBEncoding
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  host.appendChild(renderer.domElement)
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture
  scene.environment = envMap
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0.1, 5.2)
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 5); scene.add(key)
  const rim = new THREE.PointLight(0xff3355, 2.2, 12); rim.position.set(-3, 1, -2); scene.add(rim)
  const rim2 = new THREE.PointLight(0x2de2dc, 1.2, 12); rim2.position.set(3, -2, -3); scene.add(rim2)
  const pivot = new THREE.Group(); scene.add(pivot)

  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() }
  size()
  const ro = new ResizeObserver(size); ro.observe(host)

  let raf = 0, alive = true
  // The colour image is its own file, loaded as a plain <img>: an image packed
  // inside the .glb is unpacked through a blob: fetch, which the CSP blocks.
  const map = new THREE.TextureLoader().load('/patient-login/heart-texture.jpg')
  map.flipY = false
  map.encoding = THREE.sRGBEncoding
  new THREE.GLTFLoader().load('/patient-login/heart.glb', (gltf) => {
    if (!alive) return
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    model.position.sub(box.getCenter(new THREE.Vector3()))
    const holder = new THREE.Group(); holder.add(model)
    holder.scale.setScalar(2.05 / Math.max(...box.getSize(new THREE.Vector3()).toArray()))
    pivot.add(holder)
    const meshes = []
    model.traverse((o) => { if (o.isMesh) meshes.push(o) })
    meshes.forEach((o) => {
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals()
      o.material.dispose()
      // the anatomy, tinted to deep heart-muscle red
      o.material = new THREE.MeshPhysicalMaterial({ map, color: new THREE.Color('#8A1222'), roughness: 0.36, envMapIntensity: 0.75, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: new THREE.Color('#4A0612'), emissiveIntensity: 0.5 })
      // a thin glass layer over it…
      const shell = new THREE.Mesh(o.geometry, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, depthWrite: false }))
      shell.scale.setScalar(1.025); o.add(shell)
      // …and a glass edge, brighter where the surface turns away
      const edge = new THREE.Mesh(o.geometry, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.6); vec3 c = mix(vec3(0.75,1.0,0.98), vec3(1.0), f); gl_FragColor = vec4(c * f * 0.75, f * 0.75); }',
      }))
      edge.scale.setScalar(1.03); o.add(edge)
    })
    const clock = new THREE.Clock()
    const frame = () => {
      const t = clock.getElapsedTime()
      pivot.rotation.y = still ? 0.5 : 0.5 + t * 0.28
      pivot.rotation.x = still ? 0 : 0.06 * Math.sin(t * 0.6)
      const p = (t % 0.85) / 0.85   // lub-dub, about 70 a minute
      const beat = Math.exp(-(((p - 0.08) / 0.05) ** 2)) * 0.045 + Math.exp(-(((p - 0.26) / 0.06) ** 2)) * 0.028
      pivot.scale.setScalar(1 + (still ? 0 : beat))
      rim.intensity = 2.2 + beat * 30
      renderer.render(scene, camera)
      if (!still) raf = requestAnimationFrame(frame)
    }
    frame()
  })

  return () => {
    alive = false
    cancelAnimationFrame(raf); ro.disconnect()
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.() })
    map.dispose(); envMap.dispose(); pmrem.dispose(); renderer.dispose(); renderer.domElement.remove()
  }
}

/* Illustrative: this page is seen before anyone signs in, so there is no
   hospital whose real numbers these could be. */
const CROSS_CHIPS = [
  { b: 'OPD open', s: 'from 9:00 AM', at: 'left-[-4%] top-[10%] [animation-delay:-1s]', icon: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g> },
  { b: 'Queue live', s: '6 waiting', live: true, at: 'right-[-6%] top-[64%] [animation-delay:-3s]', icon: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 20v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="8" r="3.5" /><path d="M21 20v-1.5a3 3 0 0 0-3-3M3 20v-1.5a3 3 0 0 1 3-3" /></g> },
  { b: '4 doctors in', s: 'of 5 today', at: 'left-[-2%] bottom-[4%] [animation-delay:-4.5s]', icon: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v6a5 5 0 0 0 10 0V3" /><path d="M11 14v2a4 4 0 0 0 8 0v-1" /><circle cx="19" cy="13" r="2" /></g> },
]

/** The glass stage with the heart and three glass chips. */
function HeartScene() {
  const hostRef = useRef(null)
  useEffect(() => {
    let cleanup = null, alive = true
    loadThree().then((THREE) => { if (alive && hostRef.current) cleanup = buildHeart(hostRef.current, THREE) }).catch(() => {})
    return () => { alive = false; cleanup?.() }
  }, [])
  return (
    <div className="relative aspect-square w-[min(540px,100%)]">
      {/* frosted glass disc, a slow ring, and the shadow the floating heart casts */}
      <span aria-hidden="true" className="absolute inset-[7%] rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,.9),inset_0_-30px_60px_rgba(0,201,197,.12),0_40px_90px_-40px_rgba(11,33,80,.35)] [background:radial-gradient(circle_at_35%_30%,rgba(255,255,255,.85),rgba(255,255,255,.25)_45%,rgba(0,201,197,.10)_70%,rgba(225,29,72,.06))]" />
      <span aria-hidden="true" className="absolute inset-[-3%] rounded-full border border-[#0A9A96]/20 [mask-image:linear-gradient(120deg,#000,transparent_60%)] motion-safe:animate-[hlSpin_30s_linear_infinite]" />
      <span aria-hidden="true" className="absolute bottom-[4%] left-1/2 h-[26px] w-[40%] -translate-x-1/2 rounded-full [background:radial-gradient(closest-side,rgba(11,33,80,.28),transparent)] motion-safe:animate-[hlShadow_5s_ease-in-out_infinite]" />
      <div ref={hostRef} aria-hidden="true" className="absolute inset-0 motion-safe:animate-[hlFloat_5s_ease-in-out_infinite]" />
      {CROSS_CHIPS.map((c) => (
        <p key={c.b} className={`absolute z-[3] flex items-center gap-2.5 rounded-2xl bg-white/55 py-2.5 pl-2.5 pr-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.8),0_18px_36px_-22px_rgba(11,33,80,.45)] backdrop-blur-[14px] backdrop-saturate-150 motion-safe:animate-[hlFloat_6s_ease-in-out_infinite] ${c.at}`}>
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-[11px] bg-white text-[#0A9A96] shadow-[0_4px_10px_-6px_rgba(11,33,80,.4)]">
            <svg width="18" height="18" viewBox="0 0 24 24">{c.icon}</svg>
          </span>
          <span className="leading-tight">
            <b className="block text-[16px] font-bold text-[#0B2150]">
              {c.live && <i aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#00C9C5] align-[1px] motion-safe:animate-[hlBlink_1.4s_infinite]" />}
              {c.b}
            </b>
            <small className="block text-[12.5px] text-[#6B7A8F]">{c.s}</small>
          </span>
        </p>
      ))}
    </div>
  )
}

function HospitalLogin() {
  const navigate = useNavigate()
  const fit = useCanvasFit()
  const { user, loading, login, homeFor } = useAuth()
  const [form, setForm] = useState({ idf: '', password: '' })
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [forgot, setForgot] = useState(false)

  useEffect(() => { document.title = 'Hospital Login · TapCure' }, [])

  // Thrown back here by the app rather than by choice: one account holds one
  // session, and this one was signed in somewhere else. Say so — a login screen
  // with no explanation reads as the app losing the session on its own.
  // (Reception is exempt server-side, so a front desk never sees this.)
  const SIGNED_OUT = {
    'other-device': 'You were signed out because this account was used to sign in on another device. Please sign in again.',
    'credentials-changed': "You were signed out because this account's email or password was changed by your hospital admin.",
    ended: 'Your session has ended. Please sign in again.',
  }
  useEffect(() => {
    const msg = SIGNED_OUT[takeSignedOutReason()]
    if (msg) setBanner({ type: 'error', msg })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  // Already signed in (typed the URL, or landed here from stale history) —
  // send them to their own console instead of offering a second login.
  if (!loading && user) return <Navigate to={homeFor(user.role_name)} replace />

  const handleLogin = async (e) => {
    e.preventDefault()
    const err = {}
    const idf = form.idf.trim()
    // Hospital staff sign in with their registered email — a mobile number is the
    // PATIENT door and never resolves to a hospital login, so say so here rather
    // than letting the API answer 401.
    if (!idf) err.idf = 'Required'
    else if (mobileRe.test(idf)) err.idf = 'Use your registered email, not mobile'
    else if (!emailRe.test(idf)) err.idf = 'Enter a valid email address'
    if (!form.password.trim()) err.password = 'Required'
    setErrors(err)
    if (Object.keys(err).length) return

    setBusy(true)
    setBanner(null)
    try {
      // 'hospital' = admin / front desk / super admin. A doctor's credentials are
      // refused here and pointed at the Doctor login instead.
      const u = await login(idf, form.password, 'hospital')
      // REPLACE, not push: pushing left the login page one Back press behind
      // the console, so Back showed a login form to someone already signed in.
      navigate(homeFor(u.role_name), { replace: true })
    } catch (e2) {
      setBanner({
        type: 'error',
        msg: e2.status === 401 ? 'That email and password do not match. Please try again, or reset your password.' : e2.message || 'Login failed',
      })
      setBusy(false)
    }
  }

  const label = 'mb-2 flex items-baseline justify-between gap-2.5 text-[17.5px] font-semibold text-[#41526E]'
  const box = (bad) => `w-full rounded-[14px] border-[1.5px] bg-transparent px-5 py-[18px] text-[19px] font-medium text-[#0B2150] outline-none transition-colors placeholder:font-normal placeholder:text-[#6B7A8F] focus:border-[#0A9A96] ${bad ? 'border-[#C2410C]' : 'border-[#0B2150]/[.12]'}`
  const link = 'font-semibold text-[#0A9A96] hover:underline'

  return (
    <div className={`tc-type min-h-screen bg-[#F3F8F8] text-[#0B2150] antialiased ${fit ? 'h-screen overflow-hidden' : ''}`} style={{ fontFamily: MODERN_FONT }}>
      <style>{'@keyframes hlSpin{to{transform:rotate(360deg)}}@keyframes hlFloat{50%{transform:translateY(-12px)}}@keyframes hlShadow{50%{transform:translateX(-50%) scale(.86);opacity:.7}}@keyframes hlBlink{50%{opacity:.3}}'}</style>
      <div
        className="grid min-h-screen grid-cols-1"
        style={fit ? { zoom: fit.z, width: fit.w, height: CANVAS_H, minHeight: 0, gridTemplateColumns: `${PANEL_W}px 1fr` } : undefined}
      >
        {/* ── left: sign in ── */}
        <section className="flex min-h-screen flex-col bg-white px-5 pb-8 pt-5 sm:px-10 min-[901px]:h-full min-[901px]:min-h-0 min-[901px]:overflow-y-auto min-[901px]:px-[88px] min-[901px]:py-[26px]">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2" aria-label="TapCure">
              <img src="/tapcure-icon.png" alt="" className="h-8 w-8" />
              <Wordmark className="text-[22px]" />
            </Link>
            <Link to="/" className="inline-flex items-center gap-1 text-[17px] text-[#6B7A8F] hover:text-[#0A9A96]"><ArrowLeft className="h-4 w-4" /> Home</Link>
          </div>
          <div className="min-h-3 flex-[1]" aria-hidden="true" />

          <div>
            <p className="text-[18px] font-semibold text-[#0A9A96]">For Hospital Teams</p>
            <h1 className="mt-2.5 text-[46px] font-bold leading-[1.1] tracking-[-0.015em]">Hospital Login</h1>
            <p className="mt-2.5 text-[19px] text-[#41526E]">Admins and front desk sign in here to run today's OPD.</p>
            {banner && <p role="alert" className="mt-4 text-[15.5px] font-medium text-[#C2410C]">{banner.msg}</p>}

            {forgot ? (
              <div className="mt-7"><ForgotPasswordFlow portal="hospital" onBack={() => { setForgot(false); setBanner(null) }} /></div>
            ) : (
              <form onSubmit={handleLogin} noValidate className="mt-8 grid gap-[22px]">
                <div>
                  <label htmlFor="hl-email" className={label}>
                    <span>Email Address</span>
                    {errors.idf && <span role="alert" className="text-[15.5px] font-medium text-[#C2410C]">{errors.idf}</span>}
                  </label>
                  <input id="hl-email" type="text" inputMode="email" autoComplete="username" placeholder="Your registered hospital email"
                    value={form.idf} onChange={set('idf')} aria-invalid={!!errors.idf} className={box(errors.idf)} />
                </div>
                <div>
                  <div className={label}>
                    <label htmlFor="hl-pass">Password</label>
                    {errors.password
                      ? <span role="alert" className="text-[15.5px] font-medium text-[#C2410C]">{errors.password}</span>
                      : <button type="button" onClick={() => { setForgot(true); setBanner(null); setErrors({}) }} className={`text-[16.5px] ${link}`}>Forgot Password?</button>}
                  </div>
                  <div className="relative">
                    <input id="hl-pass" type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password"
                      value={form.password} onChange={set('password')} aria-invalid={!!errors.password} className={`${box(errors.password)} pr-[52px]`} />
                    <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[#6B7A8F] hover:text-[#0A9A96]">
                      {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <button disabled={busy} className="mt-1.5 rounded-full bg-[#0A9A96] py-5 text-[19.5px] font-semibold text-white transition-colors hover:bg-[#088582] disabled:opacity-65">
                  {busy ? 'Signing In…' : 'Login To Dashboard'}
                </button>
              </form>
            )}

            <div className="mt-[30px] grid gap-3 border-t border-[#0B2150]/10 pt-6 text-[17.5px] text-[#41526E]">
              <span>New hospital? <Link to="/hospital-signup" className={link}>Register your hospital →</Link></span>
              <span>Are you a doctor? <Link to="/doctor-login" className={link}>Doctor Login →</Link></span>
            </div>
            <p className="mt-4 text-[15.5px] text-[#6B7A8F]">Trouble signing in? <a href="https://wa.me/919346821621" target="_blank" rel="noopener noreferrer" className={link}>WhatsApp us at +91 93468 21621</a></p>
            <p className="mt-1.5 text-[15.5px] text-[#6B7A8F]">🔒 Encrypted and DPDP-ready. Every sign-in is logged.</p>
          </div>
          <div className="min-h-3 flex-[1.15]" aria-hidden="true" />
        </section>

        {/* ── right: the glass heart (desktop only) ── */}
        {fit && (
          <aside aria-label="TapCure for hospitals"
            className="relative grid h-full place-items-center overflow-hidden px-10 py-6 [background:radial-gradient(60%_50%_at_70%_20%,rgba(0,201,197,.20),transparent_70%),radial-gradient(50%_45%_at_20%_90%,rgba(51,105,255,.14),transparent_70%),#F3F8F8]">
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-[140px] bg-gradient-to-r from-white to-transparent" />
            <HeartScene />
          </aside>
        )}
      </div>
    </div>
  )
}

export default HospitalLogin
