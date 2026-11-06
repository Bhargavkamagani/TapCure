/**
 * Matching a spoken name against the database.
 *
 * Speech-to-text gives us a messy transcript in whatever script the patient
 * spoke, while doctor / hospital / city names are stored in Latin letters. These
 * helpers bridge the two: romanise the transcript, drop generic filler words,
 * then allow a few characters of slop per word.
 *
 * Kept out of the page components so the voice flow and any other name search
 * share one implementation (and so it can be exercised on its own).
 */

export const norm = (value) => String(value || '').toLowerCase()

// Levenshtein edit distance + a fuzzy word match, so speech-to-text spellings of
// a doctor's name ("satya" heard as "sathya" / "satyam") still match.
export function editDistance(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i += 1) dp[i][0] = i
  for (let j = 0; j <= n; j += 1) dp[0][j] = j
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
  }
  return dp[m][n]
}

export function fuzzyWord(a, b) {
  if (a === b || a.includes(b) || b.includes(a)) return true
  const len = Math.max(a.length, b.length)
  if (len < 4) return false
  return editDistance(a, b) <= (len >= 7 ? 3 : 2) // allow ~1 slip per 3-4 letters
}

// Doctor names are stored in Latin letters, but a Telugu/Hindi speaker's name is
// transcribed in native script (సత్య / लक्ष्मी). Romanise it first so name
// matching lines up ("సత్య" → "satya"). Latin text passes through unchanged.
const TE_CONS = { 'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'ng', 'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'ny', 'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n', 'త': 't', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n', 'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm', 'య': 'y', 'ర': 'r', 'ల': 'l', 'వ': 'v', 'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h', 'ళ': 'l', 'ఱ': 'r' }
const TE_MATRA = { 'ా': 'a', 'ి': 'i', 'ీ': 'i', 'ు': 'u', 'ూ': 'u', 'ృ': 'ru', 'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au' }
const TE_VOWEL = { 'అ': 'a', 'ఆ': 'a', 'ఇ': 'i', 'ఈ': 'i', 'ఉ': 'u', 'ఊ': 'u', 'ఋ': 'ru', 'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au' }
const HI_MAP = { 'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na', 'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na', 'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma', 'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va', 'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha', 'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', '्': '', 'ं': 'm', 'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ए': 'e', 'ओ': 'o' }

export function romanizeName(str) {
  const chars = [...String(str || '')]
  let out = ''
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i]
    if (TE_CONS[c]) {
      out += TE_CONS[c]
      const next = chars[i + 1]
      if (next === '్') { i += 1 } // virama → drop inherent 'a'
      else if (TE_MATRA[next]) { out += TE_MATRA[next]; i += 1 }
      else out += 'a'
    } else if (TE_VOWEL[c]) out += TE_VOWEL[c]
    else if (c === 'ం' || c === 'ঁ') out += 'm'
    else if (TE_MATRA[c]) out += TE_MATRA[c]
    else if (HI_MAP[c] != null) out += HI_MAP[c]
    else out += c
  }
  return out
}

// Generic words that must not drive a name match, so "omega hospitals" matches
// on "omega" rather than on "hospitals" (which every hospital would answer to).
export const NAME_STOP = new Set(['doctor', 'clinic', 'clinics', 'hospital', 'hospitals', 'care', 'daaktar', 'daktar', 'dr', 'the'])

// Words that express an intent ("show me another doctor") rather than a name.
// Without this, "another doctor" fuzzy-matches a doctor actually called Anand,
// and the patient asking to see the list gets booked with a stranger instead.
const INTENT_WORDS = new Set([
  'another', 'other', 'others', 'different', 'else', 'somewhere', 'anywhere', 'place',
  'places', 'location', 'town', 'city', 'area', 'day', 'date', 'today', 'tomorrow',
  'next', 'show', 'want', 'please', 'yes', 'no', 'change', 'search', 'find', 'look',
])

/** "Did they say this name?" — a matcher over a set of candidate tokens. */
export function spokenMatcher(text) {
  const wanted = norm(romanizeName(text)).trim()
  const words = wanted
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NAME_STOP.has(w) && !INTENT_WORDS.has(w))
  return (tokens) => tokens.some((tok) => (
    (tok.length >= 4 && wanted.includes(tok)) || words.some((w) => fuzzyWord(w, tok))
  ))
}

export const nameTokensOf = (doctor) => norm(doctor.name).split(/\s+/).filter((tok) => tok.length >= 2)

/**
 * Which doctor did they name? Fuzzy matching alone is ambiguous when names
 * overlap — "pawan kalyan" matches Pawan, Kalyan AND Pawan Kalyan — so a
 * candidate whose WHOLE name was spoken wins, longest first. That picks
 * "Pawan Kalyan" over "Pawan", and "Subbarao" over "Rao".
 *
 * Returns { best, matches }: `best` is set only when one candidate clearly
 * leads; otherwise the caller should disambiguate (ask, or let the NLU choose).
 */
export function bestNameMatch(text, doctors) {
  const hit = spokenMatcher(text)
  const wanted = norm(romanizeName(text)).trim()
  const matches = (doctors || []).filter((d) => hit(nameTokensOf(d)))
  if (matches.length <= 1) return { best: matches[0] || null, matches }
  const spoken = matches
    .filter((d) => wanted.includes(norm(d.name)))
    .sort((a, b) => norm(b.name).length - norm(a.name).length)
  // A tie on length is a genuine ambiguity (two doctors with the same name).
  if (spoken.length && (spoken.length === 1 || norm(spoken[0].name).length > norm(spoken[1].name).length)) {
    return { best: spoken[0], matches }
  }
  return { best: null, matches }
}

/**
 * A town said aloud. Tokens must be 4+ characters — a short one would match
 * almost any sentence and send the patient to the wrong place.
 */
export function matchSpokenCity(text, cities) {
  const hit = spokenMatcher(text)
  return (cities || []).find((city) => hit(norm(city).split(/\s+/).filter((tok) => tok.length >= 4))) || ''
}
