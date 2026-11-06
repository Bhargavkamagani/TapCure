/**
 * Voice-agent layer for the patient "Book by Voice" guide.
 *
 * Hearing the patient has two backends:
 *   1. Cloud (preferred): record a short clip with MediaRecorder and send it to
 *      the backend /voice/transcribe (OpenAI Whisper) — far better for Telugu /
 *      Hindi and noisy phones.
 *   2. On-device fallback: the browser Web Speech API (lib/voice.js `listen`),
 *      used automatically when no key is configured / the device can record but
 *      the server says cloud voice is off, or when recording isn't supported.
 *
 * Understanding the patient (mapping messy speech to a choice / yes-no / date)
 * goes through /voice/nlu, and every task has a pure local fallback so the flow
 * still works fully offline — just a little less forgiving of free-form phrasing.
 */
import { voiceApi } from '../api'
import { listen as browserListen, parseDigits, voiceStatus } from './voice.js'
import { todayISO } from './format.js'

// Cloud TTS lives in voice.js (so plain `speak()` callers get it too); re-export
// for the voice-booking page which probes/uses these directly.
export { cloudTtsAvailable, speakCloud, stopCloudSpeak } from './voice.js'

const SPEECH_CODE = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' }
export const speechCode = (lang) => SPEECH_CODE[lang] || 'en-IN'

export const canRecord = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined'

/** Has the backend got a cloud-voice (STT/NLU) key? */
export async function cloudVoiceAvailable() {
  return !!(await voiceStatus()).cloud_voice
}

/** Pick the recorder MIME type the browser actually supports. */
function pickMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const t of types) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t
  }
  return ''
}

/**
 * Start a microphone recording. Returns a handle with `stop()` -> Promise<Blob>
 * so the caller controls how long to listen (tap-to-stop, or auto-stop on a
 * timer). Always release the mic via the stream tracks when done.
 */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mime = pickMime()
  const rec = new window.MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks = []
  rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data)
  // Collect chunks throughout the recording. Some browsers do not reliably emit
  // a useful final chunk if start() is called without a timeslice.
  rec.start(250)

  const stop = () =>
    new Promise((resolve) => {
      const finish = () => {
        stream.getTracks().forEach((t) => t.stop())
        resolve(new Blob(chunks, { type: mime || 'audio/webm' }))
      }
      rec.onstop = finish
      if (rec.state !== 'inactive') {
        try { rec.requestData() } catch { /* ignore */ }
        rec.stop()
      } else {
        finish()
      }
    })

  return { stop }
}

/**
 * Transcribe a recorded clip. Tries the cloud (Whisper); if that's unavailable
 * the caller should have used `listenOnce` instead — but we still surface a
 * clear error so the UI can degrade.
 */
export async function transcribe(blob, lang) {
  const { text } = await voiceApi.transcribe(blob, lang)
  return (text || '').trim()
}

/**
 * One-shot browser speech recognition (the on-device fallback). Resolves with
 * the transcript or '' if nothing was heard.
 */
export async function listenOnce(lang) {
  try {
    return (await browserListen(speechCode(lang))) || ''
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------- intent ----
// Each interpret helper hits /voice/nlu, then falls back to local heuristics if
// the cloud is off or errors. Local matching is intentionally simple but covers
// the common cases in all three languages.

const YES_WORDS = [
  // English
  'yes', 'yeah', 'yep', 'yup', 'ya', 'sure', 'ok', 'okay', 'okey', 'correct',
  'confirm', 'confirmed', 'book', 'right', 'fine', 'good', 'done', 'proceed',
  'go ahead', 'do it', 'book it',
  // Telugu (romanized + script): avunu / sare / alaage / cheyandi / book / es
  'avunu', 'avunandi', 'sare', 'saree', 'alaage', 'alage', 'cheyandi', 'cheyyandi', 'cheyyi',
  '\u0c05\u0c35\u0c41\u0c28\u0c41', '\u0c05\u0c35\u0c41\u0c28\u0c02\u0c21\u0c3f',
  '\u0c38\u0c30\u0c47', '\u0c05\u0c32\u0c3e\u0c17\u0c47', '\u0c1a\u0c47\u0c2f\u0c02\u0c21\u0c3f',
  '\u0c1a\u0c46\u0c2f\u0c4d\u0c2f\u0c02\u0c21\u0c3f', '\u0c2c\u0c41\u0c15\u0c4d', '\u0c13\u0c15\u0c47', '\u0c0e\u0c38\u0c4d',
  // Hindi (romanized + script): haan / ji / theek / karo / kar do
  'haan', 'haa', 'han', 'hanji', 'haan ji', 'ji', 'theek', 'thik', 'theek hai', 'thik hai', 'karo', 'kar do',
  '\u0939\u093e\u0902', '\u0939\u093e\u0901', '\u0920\u0940\u0915', '\u0920\u0940\u0915 \u0939\u0948',
  '\u092c\u0941\u0915', '\u0915\u0930\u094b', '\u0915\u0930 \u0926\u094b', '\u095b\u0930\u0942\u0930',
  // Speech-to-text misspellings of అవును ("yes") heard in testing.
  'అవనో', 'అవను', 'అవునూ', 'అవునా', 'avuno', 'avanu',
  // "Add" said to "shall I add X?" is a yes. Only whole words / phrases: plain
  // "add" is left out so "don't add" can never read as yes.
  'చేర్చు', 'చేర్చండి', 'చేర్చేయ్', 'చేర్చేయండి', 'జోడించు', 'జోడించండి', 'cherchu', 'cherchandi',
  'add her', 'add him', 'add them', 'please add', 'add it',
  'जोड़ो', 'जोड़ दो', 'जोड़ दीजिए', 'जोड़ दें', 'jodo', 'jod do',
]
const NO_WORDS = [
  // English
  'no', 'nope', 'nah', 'cancel', 'wrong', 'change', 'back', 'go back', 'stop',
  // Telugu (romanized + script): kaadu / vaddu / ledu / maarchu / venakki
  'kaadu', 'kadu', 'vaddu', 'vadhu', 'ledu',
  '\u0c15\u0c3e\u0c26\u0c41', '\u0c35\u0c26\u0c4d\u0c26\u0c41', '\u0c32\u0c47\u0c26\u0c41',
  '\u0c2e\u0c3e\u0c30\u0c4d\u0c1a\u0c41', '\u0c35\u0c46\u0c28\u0c15\u0c4d\u0c15\u0c3f',
  // Hindi (romanized + script): nahi / galat / badlo
  'nahi', 'nahin', 'galat', 'badlo',
  '\u0928\u0939\u0940\u0902', '\u0917\u0932\u0924', '\u092c\u0926\u0932\u094b', '\u0930\u0926\u094d\u0926',
]

// A clear "don't" beats any yes word next to it: "don't add her" contains
// "add her", and "मत जोड़ो" contains "जोड़ो".
const NEGATED = [
  "don't", 'don t', 'dont', 'do not', 'मत',
  'చేర్చవద్దు', 'చేర్చకు', 'చేర్చొద్దు', 'వద్దండి', 'కాదండి',
]

function localYesNo(text) {
  const normalized = String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    // \p{M} keeps Telugu/Hindi vowel signs: without it "అవును" became "అవ న"
    // and no Telugu or Hindi word here could ever match (AI-off fallback).
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return ''
  const tokens = new Set(normalized.split(' '))
  // Single words must match a whole token (so "know" never matches "no");
  // multi-word entries match anywhere in the phrase. Yes wins ties so an
  // affirmative at the confirm step reliably books.
  const has = (list) => list.some((w) => (w.includes(' ') ? normalized.includes(w) : tokens.has(w)))
  if (has(NEGATED)) return 'no'
  if (has(YES_WORDS)) return 'yes'
  if (has(NO_WORDS)) return 'no'
  return ''
}
/** Cheap token-overlap score between a spoken phrase and an option label. */
function scoreMatch(text, label) {
  const norm = (s) =>
    (s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1)
  const spoken = new Set(norm(text))
  const words = norm(label)
  if (!words.length || !spoken.size) return 0
  let hit = 0
  for (const w of words) if (spoken.has(w)) hit += 1
  return hit / words.length
}

/** Ask the AI for the answer inside a messy sign-up reply ('' if none / offline). */
export async function extractAnswer(transcript, lang, field) {
  if (!String(transcript || '').trim()) return ''
  try {
    const r = await voiceApi.extract(transcript, lang, field)
    return String(r?.value || '').trim()
  } catch (err) {
    console.warn('[voice] AI extract failed, keeping local rules only:', err?.message || err)
    return ''
  }
}

// The backend waits up to 60s on the model; a patient on a yes/no shouldn't.
const YES_NO_AI_TIMEOUT_MS = 6000

/** Who a booking is for, read by the AI: { relation, name } (either may be ''),
 *  or null when the AI is off or failed — the caller then uses its word rules. */
export async function extractPerson(transcript, lang) {
  if (!String(transcript || '').trim()) return { relation: '', name: '' }
  try {
    const r = await voiceApi.extract(transcript, lang, 'person')
    return { relation: String(r?.relation || ''), name: String(r?.value || '').trim() }
  } catch (err) {
    console.warn('[voice] AI person extract failed, using local words:', err?.message || err)
    return null
  }
}

/** Resolve "yes/no" from speech. AI first — it reads "haan theek hai, but make
 *  it evening" or "అవును అదే కరెక్ట్" in context — and the word lists only when
 *  the AI is off, slow, fails, or can't tell. */
export async function interpretYesNo(transcript, lang, question = '') {
  try {
    if (await cloudVoiceAvailable()) {
      const r = await Promise.race([
        // The question matters: "add Anjali to the list" is only a yes once the
        // AI knows it was asked "shall I add Anjali?".
        voiceApi.nlu({ transcript, language: lang, task: 'yes_no', ...(question ? { hint: question } : {}) }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI yes/no timed out')), YES_NO_AI_TIMEOUT_MS)),
      ])
      if (r.value === 'yes' || r.value === 'no') return { value: r.value, reply: r.reply }
    }
  } catch (err) {
    console.warn('[voice] cloud yes/no failed, using local words:', err?.message || err)
  }
  return { value: localYesNo(transcript), reply: '' }
}

/**
 * Pick the best option (e.g. a doctor or a time slot) for a spoken reply.
 * `options` = [{ id, label }]. Also understands "first/second/third" and a
 * spoken ordinal number as a position into the list.
 */
export async function interpretChoice(transcript, lang, options, hint) {
  try {
    if (await cloudVoiceAvailable()) {
      const r = await voiceApi.nlu({ transcript, language: lang, task: 'match_option', options, hint })
      if (r.value && options.some((o) => String(o.id) === String(r.value))) {
        return { id: String(r.value), reply: r.reply }
      }
    }
  } catch (err) {
    // Falling back to local matching is correct, but doing it SILENTLY is how a
    // dead model went unnoticed — the flow just looked stupid instead of broken.
    console.warn('[voice] cloud NLU failed, using local matching:', err?.message || err)
  }

  // Local fallback: ordinal words, a spoken position number, then word overlap.
  const t = (transcript || '').toLowerCase()
  const ORD = [
    ['first', 'one', 'modati', 'మొదటి', 'pehla', 'pehli', 'पहला', 'पहली'],
    ['second', 'two', 'rendava', 'రెండవ', 'dusra', 'dusri', 'दूसरा', 'दूसरी'],
    ['third', 'three', 'moodava', 'మూడవ', 'teesra', 'tisri', 'तीसरा', 'तीसरी'],
  ]
  for (let i = 0; i < ORD.length && i < options.length; i += 1) {
    if (ORD[i].some((w) => t.includes(w))) return { id: String(options[i].id), reply: '' }
  }
  const digits = parseDigits(transcript)
  if (digits) {
    const pos = parseInt(digits, 10)
    if (pos >= 1 && pos <= options.length) return { id: String(options[pos - 1].id), reply: '' }
  }
  let best = null
  let bestScore = 0
  for (const o of options) {
    const s = scoreMatch(transcript, o.label)
    if (s > bestScore) {
      bestScore = s
      best = o
    }
  }
  if (best && bestScore >= 0.34) return { id: String(best.id), reply: '' }
  return { id: '', reply: '' }
}

/** Resolve a spoken day ("today", "tomorrow", a weekday) to an ISO date. */
export async function interpretDate(transcript, lang, today = todayISO()) {
  try {
    if (await cloudVoiceAvailable()) {
      const r = await voiceApi.nlu({ transcript, language: lang, task: 'pick_date', today })
      if (/^\d{4}-\d{2}-\d{2}$/.test(r.value) && r.value >= today) {
        return { value: r.value, reply: r.reply }
      }
    }
  } catch (err) {
    // Falling back to local matching is correct, but doing it SILENTLY is how a
    // dead model went unnoticed — the flow just looked stupid instead of broken.
    console.warn('[voice] cloud NLU failed, using local matching:', err?.message || err)
  }

  const t = (transcript || '').toLowerCase()
  const base = new Date(`${today}T00:00:00`)
  // Local date, NOT toISOString() — UTC conversion in IST rolls the day back by one.
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const TODAY = ['today', 'ivvala', 'ఈరోజు', 'ఇవాళ', 'aaj', 'आज']
  const TOMORROW = ['tomorrow', 'repu', 'రేపు', 'kal', 'कल']
  if (TODAY.some((w) => t.includes(w))) return { value: today, reply: '' }
  if (TOMORROW.some((w) => t.includes(w))) {
    const d = new Date(base)
    d.setDate(d.getDate() + 1)
    return { value: iso(d), reply: '' }
  }
  return { value: '', reply: '' }
}

// ---- Voice booking: corrections --------------------------------------------
// A correction check runs before every step's own handling, so it must never
// hold the patient up: past this, the step handles the reply as it always did.
const CORRECTION_AI_TIMEOUT_MS = 4000

/**
 * Is the patient CHANGING an earlier answer? ("no, her name is Sundari",
 * "make it Wednesday", "actually Dr. Satya"). `question` is what was just asked
 * and `card` what they have told us so far ({ who, symptom, doctor, … }).
 *
 * Returns { field, value, confidence } when the AI hears a correction, or null
 * — for "no correction", AI off, slow, or failing — and the caller then carries
 * on exactly as before. `quotaOut` is true when the AI refused for quota (HTTP
 * 429 upstream), so the caller can stop asking for the rest of the booking.
 * Only ever an extra: nothing depends on it being available.
 */
export async function detectCorrection(transcript, lang, { question, card }) {
  try {
    if (!String(transcript || '').trim() || !(await cloudVoiceAvailable())) return null
    const r = await Promise.race([
      voiceApi.nlu({
        transcript, language: lang, task: 'correction',
        hint: question || '', context: JSON.stringify(card || {}).slice(0, 2000),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI correction check timed out')), CORRECTION_AI_TIMEOUT_MS)),
    ])
    if (!r?.field || !String(r.value || '').trim()) return null
    return { field: r.field, value: String(r.value).trim(), confidence: Number(r.confidence) || 0 }
  } catch (err) {
    const msg = String(err?.message || err)
    console.warn('[voice] correction check skipped, step handles the reply:', msg)
    // Groq's "out of quota" reaches us as the backend's 502 carrying the upstream 429.
    if (/\b429\b|rate.?limit|quota/i.test(msg)) return { quotaOut: true }
    return null
  }
}
