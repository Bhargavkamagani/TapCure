/**
 * Thin wrappers over the browser Web Speech API (free, on-device-ish). Used by
 * the patient voice login so prompts are read aloud and answers are captured by
 * voice. Everything degrades gracefully when the API is missing.
 */

import { voiceApi } from '../api'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export const sttSupported = () => !!SR
export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

const FALLBACK_LANGS = {
  'te-IN': ['te-IN', 'te'],
  'hi-IN': ['hi-IN', 'hi', 'en-IN', 'en'],
  'en-IN': ['en-IN', 'en'],
}

function readVoices() {
  if (!ttsSupported()) return []
  try {
    return window.speechSynthesis.getVoices() || []
  } catch {
    return []
  }
}

function loadVoices() {
  return new Promise((resolve) => {
    const initial = readVoices()
    if (initial.length) return resolve(initial)

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve(readVoices())
    }

    try {
      window.speechSynthesis.onvoiceschanged = finish
      setTimeout(finish, 600)
    } catch {
      finish()
    }
  })
}

function voiceScore(voice, code, index) {
  const lang = (voice.lang || '').toLowerCase()
  const target = code.toLowerCase()
  if (lang === target) return 100 - index
  if (lang.startsWith(`${target.split('-')[0]}-`)) return 80 - index
  if (lang.startsWith(target)) return 70 - index
  return 0
}

function voiceMatchesLang(voice, lang) {
  if (!voice) return false
  const voiceLang = (voice.lang || '').toLowerCase()
  const target = lang.toLowerCase()
  const base = target.split('-')[0]
  return voiceLang === target || voiceLang.startsWith(`${base}-`) || voiceLang === base
}

function pickVoice(voices, lang) {
  const chain = FALLBACK_LANGS[lang] || [lang, lang.split('-')[0], 'en-IN', 'en']
  for (const code of chain) {
    let best = null
    let bestScore = 0
    voices.forEach((voice, index) => {
      const score = voiceScore(voice, code, index)
      if (score > bestScore) {
        best = voice
        bestScore = score
      }
    })
    if (best) return best
  }
  return voices.find((v) => v.default) || voices[0] || null
}

export async function nativeTtsVoiceAvailable(lang = 'en-IN') {
  if (!ttsSupported()) return false
  const voices = await loadVoices()
  return voices.some((voice) => voiceMatchesLang(voice, lang))
}

// ----------------------------------------------------------- cloud TTS -------
// Server-side text-to-speech (Cartesia Sonic) for Telugu/Hindi prompts. When
// configured, prompts route through Cartesia only; browser speech is used only
// when cloud TTS is not configured.

let _status = null
/** Backend voice status (STT + TTS), cached after the first probe. */
export async function voiceStatus() {
  if (_status !== null) return _status
  try {
    _status = await voiceApi.status()
  } catch {
    _status = { cloud_voice: false, cloud_tts: false }
  }
  return _status
}

/** Is Cartesia TTS configured server-side? */
export async function cloudTtsAvailable() {
  return !!(await voiceStatus()).cloud_tts
}

// One shared <audio> element so a new prompt cancels any still-playing one.
let _ttsAudio = null
let _ttsDone = null // resolves the in-flight speakCloud() promise when we stop it

// Monotonic token: every speak()/stopSpeaking() bumps it, so a prompt that was
// started before a newer one (or before a stop) aborts instead of overlapping.
// This is what prevents the cloud voice and the browser voice — which play on
// separate channels — from ever sounding at the same time.
let _speakSeq = 0

/** Stop any cloud-TTS audio that's currently playing. */
export function stopCloudSpeak() {
  // Grab the refs and clear them first, then HARD-STOP the element. The old code
  // called _ttsDone(false) (which nulled _ttsAudio) before the pause block, so the
  // pause was skipped and the outgoing Cartesia clip kept playing — two voices at
  // once. Pause + reset the element explicitly so only the newest prompt is heard.
  const audio = _ttsAudio
  const finish = _ttsDone
  _ttsAudio = null
  _ttsDone = null
  if (audio) {
    try {
      audio.onended = audio.onerror = audio.onpause = null
      audio.pause()
      audio.currentTime = 0
      audio.src = ''
    } catch { /* ignore */ }
  }
  if (finish) {
    try { finish(false) } catch { /* ignore */ }
  }
}

/**
 * Speak `text` via Cartesia and resolve `true` when playback ends. Resolves
 * `false` (never throws) if TTS is unavailable or playback fails. `lang` is a
 * short code (en/te/hi).
 */
export async function speakCloud(text, lang = 'en') {
  if (!text) return false
  const seq = _speakSeq // abort if a newer prompt/stop happens while we fetch
  let url = null
  try {
    const blob = await voiceApi.tts(text, lang)
    url = URL.createObjectURL(blob)
  } catch {
    return false
  }
  if (seq !== _speakSeq) { URL.revokeObjectURL(url); return false }
  stopCloudSpeak()
  return new Promise((resolve) => {
    const audio = new Audio(url)
    _ttsAudio = audio
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      if (_ttsDone === done) _ttsDone = null
      if (_ttsAudio === audio) _ttsAudio = null
      URL.revokeObjectURL(url)
      resolve(ok)
    }
    _ttsDone = done
    audio.onended = () => done(true)
    audio.onerror = () => done(false)
    audio.onpause = () => {
      // Some browsers emit pause as part of natural completion. Do not report
      // that as a cloud failure, or speak() will repeat the prompt via the
      // browser fallback after Cartesia has already finished.
      if (audio.ended) done(true)
    }
    audio.play().catch(() => done(false))
  })
}

/** A voice that genuinely speaks the target language (same family), or null. */
function pickNativeVoice(voices, lang) {
  let best = null
  let bestScore = 0
  voices.forEach((voice, index) => {
    if (!voiceMatchesLang(voice, lang)) return
    // Prefer an exact lang match, then same base language; later voices lose ties.
    const score = voiceScore(voice, lang, index) || 1
    if (score > bestScore) { best = voice; bestScore = score }
  })
  return best
}


/**
 * Speak `text` in the given BCP-47 language; resolves when done (or instantly if
 * unsupported).
 *
 * Telugu should stay Telugu: no romanized/English browser fallback is used.
 */
export async function speak(text, lang = 'en-IN', options = {}) {
  // Returns TRUE only if the text was actually voiced. Callers need to know:
  // when Cartesia is out of credits, Telugu falls silent by design (there is no
  // usable Telugu browser voice), and a silent "Listen to instructions" button
  // is worst for exactly the patients it exists for — the ones who can't read
  // the screen. With a return value the UI can show the words instead.
  if (!text) return false

  // Cancel anything currently speaking (cloud or browser) and claim this turn.
  // If a newer speak()/stopSpeaking() happens while we await below, `seq` goes
  // stale and we bail out — so only the latest prompt is ever heard.
  stopSpeaking()
  const seq = _speakSeq

  // 0) Prefer cloud TTS (Cartesia). If it is configured, do not repeat the same
  //    prompt through browser speech if playback fails or finishes oddly.
  const shortLang = (options.lang || String(lang).split('-')[0] || 'en').toLowerCase()
  const isTelugu = String(lang).toLowerCase().startsWith('te') || shortLang === 'te'
  if (await cloudTtsAvailable()) {
    if (seq !== _speakSeq) return false
    const ok = await speakCloud(text, shortLang)
    if (ok) return true
    if (seq !== _speakSeq) return false
    // Cloud TTS was configured but FAILED (e.g. Cartesia credits exhausted, or a
    // network error). Rather than go completely silent, fall through to the free
    // on-device browser voice below. (Telugu has no reliable browser voice, so it
    // still stays silent without the cloud — handled by the isTelugu guard next.)
  }
  if (isTelugu) return false

  if (!ttsSupported() || seq !== _speakSeq) return false
  const voices = await loadVoices()
  if (seq !== _speakSeq) return false

  // 1) A real voice for this language reads the native-script text best.
  const native = pickNativeVoice(voices, lang)
  const voice = native || pickVoice(voices, lang)
  const speakText = text
  const rate = 0.95

  return new Promise((resolve) => {
    if (!ttsSupported() || !speakText) return resolve(false)
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(speakText)
      if (voice) {
        u.voice = voice
        u.lang = voice.lang || lang
      } else {
        u.lang = lang
      }
      u.rate = rate
      u.onend = () => resolve(true)
      u.onerror = () => resolve(false)
      window.speechSynthesis.speak(u)
    } catch {
      resolve(false)
    }
  })
}

export function stopSpeaking() {
  _speakSeq += 1 // invalidate any in-flight speak() so it won't start a 2nd voice
  stopCloudSpeak()
  if (ttsSupported()) {
    try { window.speechSynthesis.cancel() } catch { /* ignore */ }
  }
}

/**
 * The current speech "turn" id. Every speak()/stopSpeaking() bumps it. A chained
 * narration (e.g. the login voice guide) can capture the turn before a prompt and
 * check afterwards whether it was superseded by a newer voice (a button press),
 * so it can stop instead of talking over the new prompt. `speak()` bumps the turn
 * exactly once (its internal stopSpeaking), so `speakTurn() === before + 1` after
 * an `await speak()` means "not interrupted".
 */
export function speakTurn() {
  return _speakSeq
}

/**
 * Listen once and resolve with the recognised transcript (string), or reject
 * with an Error. Caller decides how to parse (name vs digits).
 */
export function listen(lang = 'en-IN') {
  return new Promise((resolve, reject) => {
    if (!SR) return reject(new Error('unsupported'))
    const rec = new SR()
    rec.lang = lang
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.continuous = false
    let done = false
    rec.onresult = (e) => {
      done = true
      resolve(e.results[0][0].transcript || '')
    }
    rec.onerror = (e) => {
      done = true
      reject(new Error(e.error || 'speech-error'))
    }
    rec.onend = () => {
      if (!done) reject(new Error('no-speech'))
    }
    try { rec.start() } catch { reject(new Error('start-failed')) }
    return rec
  })
}

// Spoken number words → digits, across en / hi / te, so "nine eight…" or
// "నైన్" or "नौ" all collapse to digits. Also strips spaces from "9 8 7…".
const WORD_DIGITS = {
  zero: '0', oh: '0', o: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', double: '', triple: '',
  // Hindi
  'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5',
  'छह': '6', 'छः': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
  // Telugu
  'సున్నా': '0', 'ఒకటి': '1', 'రెండు': '2', 'మూడు': '3', 'నాలుగు': '4', 'ఐదు': '5',
  'ఆరు': '6', 'ఏడు': '7', 'ఎనిమిది': '8', 'తొమ్మిది': '9',
}

/** Pull just the digits out of a spoken phrase (handles words + numerals). */
export function parseDigits(transcript) {
  if (!transcript) return ''
  let out = ''
  // First, any literal digits already present.
  const tokens = String(transcript).toLowerCase().split(/[\s,.-]+/)
  for (const tok of tokens) {
    if (/^\d+$/.test(tok)) {
      out += tok
    } else if (tok in WORD_DIGITS) {
      out += WORD_DIGITS[tok]
    } else {
      // mixed token like "98765" already handled; ignore others
      const onlyDigits = tok.replace(/\D/g, '')
      if (onlyDigits) out += onlyDigits
    }
  }
  return out
}

// Filler people wrap a name in ("my name is Ramu", "నా పేరు రాము అండి",
// "मेरा नाम रामू है"). Matched as whole words at the start / end only, so a
// name that merely contains one of these letters is never cut.
const NAME_LEAD = [
  'my name is', "my name's", 'my name', 'the name is', 'name is', 'this is',
  'i am', "i'm", 'im', 'it is', "it's", 'call me', 'myself', 'hello', 'hi', 'hey',
  'నా పేరు', 'నాపేరు', 'నేను', 'పేరు', 'naa peru', 'na peru', 'nenu',
  'मेरा नाम', 'नाम', 'मैं', 'मै', 'mera naam', 'mera nam', 'main',
].map((p) => p.split(' '))
const NAME_TAIL = [
  'here', 'sir', 'madam', 'please', 'thank you', 'thanks',
  'అండి', 'గారు', 'andi', 'garu',
  'है', 'हूँ', 'हूं', 'जी', 'hai', 'hoon', 'hun', 'ji',
].map((p) => p.split(' '))

function stripPhrases(words, phrases, fromEnd) {
  let changed = true
  while (changed && words.length > 1) {
    changed = false
    for (const p of phrases) {
      if (p.length >= words.length) continue
      const part = fromEnd ? words.slice(-p.length) : words.slice(0, p.length)
      if (part.every((w, i) => w.toLowerCase() === p[i])) {
        words = fromEnd ? words.slice(0, -p.length) : words.slice(p.length)
        changed = true
        break
      }
    }
  }
  return words
}

function spokenWords(transcript) {
  // \p{M} keeps Telugu/Hindi vowel signs: without it రాము became "రమ".
  return String(transcript || '')
    .replace(/[^\p{L}\p{M}\s']/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function titleWords(words) {
  return words
    .map((w) => w.replace(/'/g, ''))
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/** Pull just the name out of a spoken answer and capitalise it. */
export function parseName(transcript) {
  let words = spokenWords(transcript)
  words = stripPhrases(words, NAME_LEAD, false)
  words = stripPhrases(words, NAME_TAIL, true)
  return titleWords(words)
}

// Replies that answer "what's your name / city?" without giving one — greetings,
// yes/no, questions, "I don't know". Any of these in the answer means it is a
// sentence, not a name, so the guide asks again instead of saving it.
const NOT_AN_ANSWER = new Set([
  'hello', 'hi', 'hey', 'ok', 'okay', 'yes', 'yeah', 'no', 'not', 'what', 'why', 'how',
  'who', 'where', 'when', 'which', 'sorry', 'pardon', 'repeat', 'again', 'test',
  'testing', 'hmm', 'um', 'uh', 'nothing', 'wait', 'stop', 'cancel', 'skip', 'dont',
  'know', 'is', 'the', 'this', 'that', 'you', 'your', 'number', 'mobile', 'phone',
  'హలో', 'అవును', 'కాదు', 'సరే', 'ఏమిటి', 'ఏంటి', 'ఎందుకు', 'ఎవరు', 'ఎక్కడ',
  'తెలియదు', 'ఆగండి', 'వద్దు', 'నంబర్', 'avunu', 'kaadu', 'sare', 'enti', 'teliyadu',
  'हैलो', 'हेलो', 'हाँ', 'हां', 'नहीं', 'ठीक', 'क्या', 'क्यों', 'कौन', 'कहाँ', 'पता',
  'रुको', 'नंबर', 'haan', 'nahi', 'kya', 'kyon', 'pata',
])

function isPlainAnswer(transcript, cleaned, maxWords) {
  if (/\d/.test(String(transcript || ''))) return false   // a number was spoken
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (!words.length || words.length > maxWords) return false
  if (cleaned.replace(/\s/g, '').length < 2) return false
  return !words.some((w) => NOT_AN_ANSWER.has(w.toLowerCase()))
}

/** The name only if the answer actually sounds like a name, else ''. */
export function parseNameStrict(transcript) {
  const name = parseName(transcript)
  return isPlainAnswer(transcript, name, 4) ? name : ''
}

/** A valid Indian mobile (10 digits, starts 6-9) from speech, else ''.
 *  Drops a spoken +91 / leading 0 so "plus nine one ..." still works. */
export function parseMobile(transcript) {
  let d = parseDigits(transcript)
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return /^[6-9]\d{9}$/.test(d) ? d : ''
}

const CITY_LEAD = [
  'i am from', "i'm from", 'i live in', 'my city is', 'city is', 'the city is',
  'i am in', "i'm in", 'from', 'in',
  'మా ఊరు', 'మా నగరం', 'నేను', 'naa ooru', 'maa ooru',
  'मेरा शहर', 'मैं', 'mera shahar', 'main',
].map((p) => p.split(' '))
const CITY_TAIL = [
  'city', 'here', 'sir', 'madam', 'please',
  'అండి', 'నుండి', 'andi', 'nundi',
  'से', 'में', 'है', 'हूँ', 'हूं', 'se', 'mein', 'hai', 'hoon',
].map((p) => p.split(' '))

/** The city if the answer sounds like a place, else ''. Snaps to a served
 *  city's spelling when it matches one ("hyderabad" -> "Hyderabad"). */
export function parseCity(transcript, knownCities = []) {
  let words = spokenWords(transcript)
  words = stripPhrases(words, CITY_LEAD, false)
  words = stripPhrases(words, CITY_TAIL, true)
  const city = titleWords(words)
  if (!isPlainAnswer(transcript, city, 3)) return ''
  const key = city.toLowerCase().replace(/\s+/g, '')
  const known = knownCities.find((k) => String(k).toLowerCase().replace(/\s+/g, '') === key)
  return known || city
}

// Yes / no words across en / hi / te (native script + common romanisations), so
// a spoken consent answer maps to a decision. Multi-word entries are matched as
// substrings; single words are matched as whole tokens so "now" ≠ "no".
const AFFIRM_WORDS = [
  'yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure', 'agree', 'agreed', 'accept',
  'confirm', 'correct', 'fine', 'i agree', 'i accept',
  // Telugu
  'అవును', 'సరే', 'ఒప్పుకుంటున్నాను', 'అంగీకరిస్తున్నాను', 'avunu', 'sare',
  // Hindi
  'हाँ', 'हां', 'ठीक', 'ठीक है', 'स्वीकार', 'सहमत', 'जी', 'haan', 'han', 'theek', 'ji',
]
const DENY_WORDS = [
  'no', 'nope', 'dont', "don't", 'decline', 'disagree', 'cancel', 'not agree',
  // Telugu
  'కాదు', 'వద్దు', 'kaadu', 'vaddu',
  // Hindi
  'नहीं', 'ना', 'nahi', 'nahin', 'na',
]

/**
 * Classify a spoken consent answer as 'yes' | 'no' | '' (unclear). Checks
 * refusals first so "I don't agree" reads as no, not yes.
 */
export function parseAffirmative(transcript) {
  const s = String(transcript || '').toLowerCase().trim()
  if (!s) return ''
  const tokens = s.split(/[\s,.!?।]+/).filter(Boolean)
  const has = (list) => list.some((w) => (w.includes(' ') ? s.includes(w) : tokens.includes(w)))
  if (has(DENY_WORDS)) return 'no'
  if (has(AFFIRM_WORDS)) return 'yes'
  return ''
}
