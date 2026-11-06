/**
 * English-only values for the database.
 *
 * POLICY (2026-09-29): nothing is stored in Telugu or Hindi script. A patient
 * booking or signing up by voice in Telugu used to save exactly what was heard
 * — "సత్య" as a family member, "దగ్గు" as the visit note, "నా ప్రస్తుత స్థానం"
 * as the start location — and from there it went into notifications and SMS.
 *
 * Rule-based and offline on purpose: no AI, no API key, no cost, and nothing
 * can be invented. Two tools:
 *   - toEnglishText: writes Telugu/Hindi out in English letters ("సత్య" →
 *     "Satya"), with the place list from translit.js so a city comes out spelt
 *     properly ("హైదరాబాద్" → "Hyderabad", not "Haidarabad").
 *   - englishSymptomNote: turns a spoken complaint into English symptom words
 *     using the app's own symptom list ("జ్వరం, ఒళ్ళు నొప్పులు" → "Fever, Body
 *     ache"), keeping the patient's words in English letters for the details.
 *
 * The backend applies the same rule to every patient text field as a safety net
 * (services/english_text.py); doing it here first gets better English.
 */

import { romanizeName } from './nameMatch.js'
import { PLACES, translitName } from './translit.js'
import { SYMPTOM_GROUPS } from '../data/symptomSpecialty.js'

const INDIC = /[ऀ-ॿఀ-౿]/
const DEVANAGARI = /[ऀ-ॿ]/

export const hasIndic = (s) => INDIC.test(String(s || ''))

const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1) : w)
const titleCase = (s) => String(s).split(' ').map(cap).join(' ')

/** Hindi script → English letters. A vowel sign or virama replaces the
 *  consonant's built-in "a" ("कूकटपल्ली" → "kukatapalli"), and a word-final
 *  built-in "a" is dropped because Hindi doesn't say it ("अमीरपेट" → "amirpet")
 *  — but a written final "ा" stays ("सुनीता" → "sunita"). */
export function romanizeDevanagari(str) {
  const CONS = { 'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n', 'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h' }
  const SIGN = { 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ru' }
  const VOWEL = { 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au' }
  const INHERENT = '\u0001'   // a built-in "a", until we know if it is silent
  const chars = [...str].filter((c) => c !== '़')   // nukta: no effect here
  let out = ''
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i]
    const next = chars[i + 1]
    if (CONS[c]) {
      out += CONS[c]
      if (next === '्') i += 1
      else if (SIGN[next]) { out += SIGN[next]; i += 1 }
      else out += INHERENT
    } else if (VOWEL[c]) out += VOWEL[c]
    else if (c === 'ं' || c === 'ँ') out += 'n'
    else if (!SIGN[c] && c !== '्' && c !== '।') out += c
  }
  return out.replace(new RegExp(`${INHERENT}(?=[\\s,.]|$)`, 'g'), '').replaceAll(INHERENT, 'a')
}

// Telugu/Hindi spelling of a place → its English name, from translit.js.
const PLACE_BY_SCRIPT = (() => {
  const map = new Map()
  for (const [en, v] of Object.entries(PLACES)) {
    for (const script of [v.te, v.hi]) if (script) map.set(script.trim(), titleCase(en))
  }
  return map
})()

// Telugu ం is heard as "n" before most consonants (శంకర్ = Shankar) and as "m"
// before p/b/m or at a word's end (సంపత్ = Sampath, స్థానం = Sthanam).
// romanizeName (shared with doctor matching) always writes "m", so rewrite it
// as న్ first where it is an "n".
const TE_NASAL_N = /ం(?=[కఖగఘఙచఛజఝఞటఠడఢణతథదధనయరలవశషసహళ])/g

function romanizeWord(word) {
  if (!hasIndic(word)) return word
  return DEVANAGARI.test(word) ? romanizeDevanagari(word) : romanizeName(word.replace(TE_NASAL_N, 'న్'))
}

/** Any text → English letters. English input comes back exactly as given.
 *  `capitalize` (default) title-cases converted words — right for names,
 *  places and labels; pass false for sentences. */
export function toEnglishText(value, { capitalize = true } = {}) {
  const s = String(value ?? '')
  if (!hasIndic(s)) return value
  return s.split(/(,\s*)/).map((seg) => {
    const t = seg.trim()
    if (!t || /^,\s*$/.test(seg)) return seg
    if (PLACE_BY_SCRIPT.has(t)) return PLACE_BY_SCRIPT.get(t)
    return t.split(/\s+/).map((w) => {
      if (PLACE_BY_SCRIPT.has(w)) return PLACE_BY_SCRIPT.get(w)
      const r = romanizeWord(w)
      return capitalize && r !== w ? cap(r) : r
    }).join(' ')
  }).join('').replace(/\s+/g, ' ').trim()
}

/** The saved start location, shown in the patient's language. The database
 *  holds English ("My current location", or a place like "KPHB Metro,
 *  Hyderabad"); on screen the fixed labels are translated and place names
 *  written in Telugu/Hindi letters. */
export function originLabelText(label, t, lang) {
  if (label === 'My current location') return t('ppage.myCurrentLocation')
  if (label === "Patient's current location") return t('ppage.patientCurrentLocation')
  return translitName(label, lang)
}

// ---- symptoms ---------------------------------------------------------------

// Common spoken complaints the symptom chips don't word the same way.
const EXTRA_SYMPTOMS = [
  { en: 'Headache', te: 'తలనొప్పి', hi: 'सिर दर्द' },
  { en: 'Headache', te: 'తల నొప్పి', hi: 'सिरदर्द' },
  { en: 'Stomach pain', te: 'కడుపు నొప్పి', hi: 'पेट दर्द' },
  { en: 'Stomach pain', te: 'కడుపునొప్పి', hi: 'पेट में दर्द' },
  { en: 'Vomiting', te: 'వాంతులు', hi: 'उल्टी' },
  { en: 'Vomiting', te: 'వాంతి', hi: 'उलटी' },
  { en: 'Loose motions', te: 'విరేచనాలు', hi: 'दस्त' },
  { en: 'Dizziness', te: 'తల తిరగడం', hi: 'चक्कर' },
  { en: 'Dizziness', te: 'కళ్లు తిరగడం', hi: 'चक्कर आना' },
  { en: 'Knee pain', te: 'మోకాలు నొప్పి', hi: 'घुटनों में दर्द' },
  { en: 'Back pain', te: 'నడుము నొప్పి', hi: 'पीठ दर्द' },
  { en: 'Cold', te: 'జలుబు', hi: 'जुकाम' },
  { en: 'Cough', te: 'దగ్గు', hi: 'खांसी' },
  { en: 'Leg pain', te: 'కాలు నొప్పి', hi: 'पैर में दर्द' },
  { en: 'Burning urination', te: 'మూత్రంలో మంట', hi: 'पेशाब में जलन' },
]

// Speech-to-text spells some letters two ways (ఒళ్ళు / ఒళ్లు); compare loosely.
const loose = (s) => String(s || '')
  .replace(/[‌‍]/g, '')
  .replace(/ళ/g, 'ల')
  .replace(/़/g, '')
  .replace(/ँ/g, 'ं')
  .toLowerCase()

// [script phrase, English] pairs, longest first so "పిల్లల జ్వరం" (Child fever)
// wins over "జ్వరం" (Fever) inside it.
const SYMPTOM_PAIRS = (() => {
  const pairs = []
  const add = (script, en) => { if (script && en) pairs.push([loose(script.trim()), en.trim()]) }
  const chips = SYMPTOM_GROUPS.flatMap((g) => g.chips)
  for (const chip of [...chips, ...EXTRA_SYMPTOMS]) {
    for (const lang of ['te', 'hi']) {
      const script = chip[lang]
      add(script, chip.en)
      // "దగ్గు & జలుబు" = "Cough & cold": also match each half on its own.
      const sParts = String(script || '').split(/\s*[&/]\s*|-/)
      const eParts = chip.en.split(/\s*[&/]\s*/)
      if (sParts.length > 1 && sParts.length === eParts.length) {
        sParts.forEach((p, i) => add(p, cap(eParts[i])))
      }
    }
  }
  return pairs.sort((a, b) => b[0].length - a[0].length)
})()

/** A spoken complaint → an English note for the doctor.
 *  "నాకు జ్వరం, ఒళ్ళు నొప్పులు" → "Fever, Body ache (patient said: naaku
 *  jvaram, ollu noppulu)". English input comes back unchanged. When no known
 *  symptom is recognised, the patient's words are kept in English letters. */
export function englishSymptomNote(text) {
  const raw = String(text || '').trim()
  if (!raw || !hasIndic(raw)) return raw
  let rest = loose(raw)
  const found = []                             // [position in what was said, English]
  for (const [script, en] of SYMPTOM_PAIRS) {
    const at = script ? rest.indexOf(script) : -1
    if (at < 0) continue
    if (!found.some(([, e]) => e === en)) found.push([at, en])
    // Blank it out (same length, so later positions stay true) so its parts
    // don't match again.
    rest = rest.split(script).join(' '.repeat(script.length))
  }
  const said = toEnglishText(raw, { capitalize: false })
  const words = found.sort((a, b) => a[0] - b[0]).map(([, en]) => en)
  return words.length ? `${words.join(', ')} (patient said: ${said})` : `Patient said: ${said}`
}
