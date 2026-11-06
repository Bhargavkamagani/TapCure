/**
 * Latin → Telugu / Devanagari transliteration for names typed by clinics.
 *
 * Doctor and clinic names live in the database exactly as staff typed them, in
 * English. No amount of UI translation reaches them, so a patient reading the
 * app in Telugu still meets "Dr. Lasya, Omega Hospitals" in Latin script.
 *
 * This SOUNDS OUT the name rather than translating it — "Omega Hospitals" is
 * written ఓమెగా హాస్పిటల్స్, which is how it is actually said and written in
 * Telugu, not "ఓమెగా ఆసుపత్రులు". That is the right call for a name: the patient
 * has to match it against a signboard.
 *
 * Deliberately rule-based and offline — same choice as the symptom helper. No
 * API key, no per-render network call, no cost, and it can't fail mid-screen.
 *
 * KNOWN LIMIT: English spelling doesn't determine pronunciation, so some names
 * come out approximate. Callers should keep the original visible nearby (a
 * subtitle or title attribute), never replace it outright — a patient standing
 * outside a clinic needs to recognise the board.
 */



/**
 * Place names, spelled properly rather than sounded out.
 *
 * "Hyderabad" letter-by-letter gives హ్య్డెరబడ్ — unreadable. Places are a known,
 * finite set with settled spellings in every Indian script, so a gazetteer is
 * the only honest way to render them. Covers the states, the metros, and the
 * Telugu-belt towns and Hyderabad localities this product actually serves;
 * anything unlisted still falls back to the phonetic rules.
 */
export const PLACES = {
  india: { te: 'ఇండియా', hi: 'भारत' },
  // states
  telangana: { te: 'తెలంగాణ', hi: 'तेलंगाना' },
  'andhra pradesh': { te: 'ఆంధ్రప్రదేశ్', hi: 'आंध्र प्रदेश' },
  karnataka: { te: 'కర్ణాటక', hi: 'कर्नाटक' },
  'tamil nadu': { te: 'తమిళనాడు', hi: 'तमिलनाडु' },
  kerala: { te: 'కేరళ', hi: 'केरल' },
  maharashtra: { te: 'మహారాష్ట్ర', hi: 'महाराष्ट्र' },
  odisha: { te: 'ఒడిశా', hi: 'ओडिशा' },
  // metros
  hyderabad: { te: 'హైదరాబాద్', hi: 'हैदराबाद' },
  secunderabad: { te: 'సికింద్రాబాద్', hi: 'सिकंदराबाद' },
  bengaluru: { te: 'బెంగళూరు', hi: 'बेंगलुरु' },
  bangalore: { te: 'బెంగళూరు', hi: 'बेंगलुरु' },
  chennai: { te: 'చెన్నై', hi: 'चेन्नई' },
  mumbai: { te: 'ముంబై', hi: 'मुंबई' },
  delhi: { te: 'ఢిల్లీ', hi: 'दिल्ली' },
  pune: { te: 'పూణే', hi: 'पुणे' },
  kolkata: { te: 'కోల్‌కతా', hi: 'कोलकाता' },
  // AP / Telangana towns
  vijayawada: { te: 'విజయవాడ', hi: 'विजयवाड़ा' },
  visakhapatnam: { te: 'విశాఖపట్నం', hi: 'विशाखापत्तनम' },
  vizag: { te: 'విశాఖ', hi: 'विशाखा' },
  guntur: { te: 'గుంటూరు', hi: 'गुंटूर' },
  tirupati: { te: 'తిరుపతి', hi: 'तिरुपति' },
  rajahmundry: { te: 'రాజమహేంద్రవరం', hi: 'राजमुंदरी' },
  kakinada: { te: 'కాకినాడ', hi: 'काकीनाडा' },
  amalapuram: { te: 'అమలాపురం', hi: 'अमलापुरम' },
  eluru: { te: 'ఏలూరు', hi: 'एलूरु' },
  nellore: { te: 'నెల్లూరు', hi: 'नेल्लोर' },
  kurnool: { te: 'కర్నూలు', hi: 'कुरनूल' },
  kadapa: { te: 'కడప', hi: 'कडपा' },
  anantapur: { te: 'అనంతపురం', hi: 'अनंतपुर' },
  warangal: { te: 'వరంగల్', hi: 'वारंगल' },
  nizamabad: { te: 'నిజామాబాద్', hi: 'निज़ामाबाद' },
  karimnagar: { te: 'కరీంనగర్', hi: 'करीमनगर' },
  khammam: { te: 'ఖమ్మం', hi: 'खम्मम' },
  ongole: { te: 'ఒంగోలు', hi: 'ओंगोल' },
  // Hyderabad localities
  kukatpally: { te: 'కూకట్‌పల్లి', hi: 'कूकटपल्ली' },
  gachibowli: { te: 'గచ్చిబౌలి', hi: 'गाचीबोवली' },
  ameerpet: { te: 'అమీర్‌పేట', hi: 'अमीरपेट' },
  madhapur: { te: 'మాదాపూర్', hi: 'माधापुर' },
  miyapur: { te: 'మియాపూర్', hi: 'मियापुर' },
  dilsukhnagar: { te: 'దిల్‌సుఖ్‌నగర్', hi: 'दिलसुखनगर' },
  begumpet: { te: 'బేగంపేట', hi: 'बेगमपेट' },
  banjara: { te: 'బంజారా', hi: 'बंजारा' },
  hills: { te: 'హిల్స్', hi: 'हिल्स' },
  colony: { te: 'కాలనీ', hi: 'कॉलोनी' },
  nagar: { te: 'నగర్', hi: 'नगर' },
  road: { te: 'రోడ్', hi: 'रोड' },
  street: { te: 'స్ట్రీట్', hi: 'स्ट्रीट' },
  main: { te: 'మెయిన్', hi: 'मेन' },
  cross: { te: 'క్రాస్', hi: 'क्रॉस' },
  phase: { te: 'ఫేజ్', hi: 'फेज़' },
  circle: { te: 'సర్కిల్', hi: 'सर्कल' },
  'bus stand': { te: 'బస్ స్టాండ్', hi: 'बस स्टैंड' },
  housing: { te: 'హౌసింగ్', hi: 'हाउसिंग' },
  board: { te: 'బోర్డ్', hi: 'बोर्ड' },
  shopping: { te: 'షాపింగ్', hi: 'शॉपिंग' },
}

/**
 * The English words that actually appear in clinic names, spelled the way each
 * script spells them. Letter-by-letter transliteration mangles exactly these —
 * "Care" became "కరె" and "diagnostics" became "డిఅజ్ఞొస్టిక్స్" — and they are
 * the majority of the words in a clinic's name, so a lexicon fixes more than
 * any amount of rule-tuning.
 */
const LEXICON = {
  hospital: { te: 'హాస్పిటల్', hi: 'हॉस्पिटल' },
  hospitals: { te: 'హాస్పిటల్స్', hi: 'हॉस्पिटल्स' },
  clinic: { te: 'క్లినిక్', hi: 'क्लिनिक' },
  clinics: { te: 'క్లినిక్స్', hi: 'क्लिनिक्स' },
  care: { te: 'కేర్', hi: 'केयर' },
  diagnostics: { te: 'డయాగ్నోస్టిక్స్', hi: 'डायग्नोस्टिक्स' },
  diagnostic: { te: 'డయాగ్నోస్టిక్', hi: 'डायग्नोस्टिक' },
  dental: { te: 'డెంటల్', hi: 'डेंटल' },
  medical: { te: 'మెడికల్', hi: 'मेडिकल' },
  centre: { te: 'సెంటర్', hi: 'सेंटर' },
  center: { te: 'సెంటర్', hi: 'सेंटर' },
  city: { te: 'సిటీ', hi: 'सिटी' },
  multispecialty: { te: 'మల్టీస్పెషాలిటీ', hi: 'मल्टीस्पेशलिटी' },
  speciality: { te: 'స్పెషాలిటీ', hi: 'स्पेशलिटी' },
  specialty: { te: 'స్పెషాలిటీ', hi: 'स्पेशलिटी' },
  nursing: { te: 'నర్సింగ్', hi: 'नर्सिंग' },
  home: { te: 'హోమ్', hi: 'होम' },
  health: { te: 'హెల్త్', hi: 'हेल्थ' },
  healthcare: { te: 'హెల్త్‌కేర్', hi: 'हेल्थकेयर' },
  lab: { te: 'ల్యాబ్', hi: 'लैब' },
  labs: { te: 'ల్యాబ్స్', hi: 'लैब्स' },
  pharmacy: { te: 'ఫార్మసీ', hi: 'फार्मेसी' },
  eye: { te: 'ఐ', hi: 'आई' },
  child: { te: 'చైల్డ్', hi: 'चाइल्ड' },
  children: { te: 'చిల్డ్రన్', hi: 'चिल्ड्रन' },
  women: { te: 'ఉమెన్', hi: 'वुमेन' },
  and: { te: 'అండ్', hi: 'एंड' },
  sai: { te: 'సాయి', hi: 'साई' },
  om: { te: 'ఓం', hi: 'ॐ' },
  rao: { te: 'రావు', hi: 'राव' },
  reddy: { te: 'రెడ్డి', hi: 'रेड्डी' },
  kumar: { te: 'కుమార్', hi: 'कुमार' },
  devi: { te: 'దేవి', hi: 'देवी' },
}

// Longest-first so digraphs win over single letters ("sh" before "s").
const CLUSTERS = [
  // "ksh" is the conjunct క్ష / क्ष (Lakshmi), not క్ష్ + a sounded-out "sh".
  ['ksh', { te: 'క్ష', hi: 'क्ष' }],
  ['chh', { te: 'ఛ', hi: 'छ' }], ['sch', { te: 'ష', hi: 'श' }],
  ['aa', { te: 'ా', hi: 'ा', matra: true }], ['ee', { te: 'ీ', hi: 'ी', matra: true }],
  ['ii', { te: 'ీ', hi: 'ी', matra: true }], ['oo', { te: 'ూ', hi: 'ू', matra: true }],
  ['uu', { te: 'ూ', hi: 'ू', matra: true }], ['ai', { te: 'ై', hi: 'ै', matra: true }],
  ['au', { te: 'ౌ', hi: 'ौ', matra: true }], ['ou', { te: 'ౌ', hi: 'ौ', matra: true }],
  ['ea', { te: 'ీ', hi: 'ी', matra: true }], ['ie', { te: 'ీ', hi: 'ी', matra: true }],
  ['kh', { te: 'ఖ', hi: 'ख' }], ['gh', { te: 'ఘ', hi: 'घ' }], ['ch', { te: 'చ', hi: 'च' }],
  // Indian names write the soft t as "th" (Sampath, Swathi, Geetha = సంపత్,
  // స్వాతి, గీత), so "th" is త — థ was never what the name meant.
  ['jh', { te: 'ఝ', hi: 'झ' }], ['th', { te: 'త', hi: 'त' }], ['dh', { te: 'ధ', hi: 'ध' }],
  ['ph', { te: 'ఫ', hi: 'फ' }], ['bh', { te: 'భ', hi: 'भ' }], ['sh', { te: 'ష', hi: 'श' }],
  ['ck', { te: 'క', hi: 'क' }], ['kk', { te: 'క్క', hi: 'क्क' }], ['tt', { te: 'ట్ట', hi: 'ट्ट' }],
  ['ll', { te: 'ల్ల', hi: 'ल्ल' }], ['nn', { te: 'న్న', hi: 'न्न' }], ['ss', { te: 'స్స', hi: 'स्स' }],
  ['ny', { te: 'న్య', hi: 'न्य' }], ['gn', { te: 'జ్ఞ', hi: 'ज्ञ' }],
]

// Consonants carry an inherent 'a'; a following vowel replaces it with a matra.
const CONSONANTS = {
  k: { te: 'క', hi: 'क' }, g: { te: 'గ', hi: 'ग' }, c: { te: 'క', hi: 'क' },
  j: { te: 'జ', hi: 'ज' }, t: { te: 'ట', hi: 'ट' }, d: { te: 'డ', hi: 'ड' },
  n: { te: 'న', hi: 'न' }, p: { te: 'ప', hi: 'प' }, b: { te: 'బ', hi: 'ब' },
  m: { te: 'మ', hi: 'म' }, y: { te: 'య', hi: 'य' }, r: { te: 'ర', hi: 'र' },
  l: { te: 'ల', hi: 'ल' }, v: { te: 'వ', hi: 'व' }, w: { te: 'వ', hi: 'व' },
  s: { te: 'స', hi: 'स' }, h: { te: 'హ', hi: 'ह' }, z: { te: 'జ', hi: 'ज' },
  f: { te: 'ఫ', hi: 'फ' }, q: { te: 'క', hi: 'क' }, x: { te: 'క్స', hi: 'क्स' },
}

// Independent vowels (word-initial) and their matras (after a consonant).
const VOWELS = {
  a: { te: ['అ', 'ా'], hi: ['अ', 'ा'], inherent: true },
  e: { te: ['ఎ', 'ె'], hi: ['ए', 'े'] },
  i: { te: ['ఇ', 'ి'], hi: ['इ', 'ि'] },
  o: { te: ['ఒ', 'ొ'], hi: ['ओ', 'ो'] },
  u: { te: ['ఉ', 'ు'], hi: ['उ', 'ु'] },
}

const VIRAMA = { te: '్', hi: '्' }

// n / m before one of these, after a vowel, is the nasal dot (anusvara):
// Anjali = అంజలి, Shankar = శంకర్, Sampath = సంపత్. Not before r, l, y, v or a
// vowel ("Amrita", "Sunrise", "Kumar" keep a full న / మ).
const ANUSVARA = { te: 'ం', hi: 'ं' }
const NASAL_BEFORE = 'kgcjtdpbsh'
// t / d are the soft (dental) త / ద after that nasal or before y, r, v:
// Chandra = చంద్ర, Sundari = సుందరి, Satya = సత్య, Vidya = విద్య.
const DENTAL = { t: { te: 'త', hi: 'त' }, d: { te: 'ద', hi: 'द' } }

/** One word, lower-cased Latin → target script. */
function word(w, lang) {
  let out = ''
  let i = 0
  let lastWasConsonant = false
  let afterNasal = false
  const src = w.toLowerCase()

  while (i < src.length) {
    // multi-letter clusters first
    const cluster = CLUSTERS.find(([k]) => src.startsWith(k, i))
    if (cluster) {
      const [key, val] = cluster
      if (val.matra) {
        // a vowel cluster: matra after a consonant, independent form otherwise
        out += lastWasConsonant ? val[lang] : (VOWELS.a[lang][0] + val[lang])
        lastWasConsonant = false
      } else {
        if (lastWasConsonant) out += VIRAMA[lang]
        out += val[lang]
        lastWasConsonant = true
      }
      i += key.length
      afterNasal = false
      continue
    }

    const ch = src[i]
    // 'c' is /s/ before e, i or y ("City", "Centre") and /k/ elsewhere.
    if (ch === 'c' && 'eiy'.includes(src[i + 1] || '')) {
      if (lastWasConsonant) out += VIRAMA[lang]
      out += lang === 'te' ? 'స' : 'स'
      lastWasConsonant = true
      i += 1
      continue
    }
    // A silent final 'e' lengthens the vowel before it rather than sounding.
    if (ch === 'e' && i === src.length - 1 && src.length > 2 && CONSONANTS[src[i - 1]]) {
      i += 1
      continue
    }
    // 'y' finishing a word is the vowel /i/, not the consonant ("Pally", "City").
    if (ch === 'y' && i === src.length - 1 && lastWasConsonant) {
      out += lang === 'te' ? 'ీ' : 'ी'
      lastWasConsonant = false
      i += 1
      continue
    }
    if (VOWELS[ch]) {
      const [independent, matra] = VOWELS[ch][lang]
      // 'a' straight after a consonant is already the inherent vowel
      if (lastWasConsonant) {
        if (ch !== 'a') out += matra
      } else {
        out += independent
      }
      lastWasConsonant = false
      i += 1
      continue
    }
    const next = src[i + 1] || ''
    // `next &&`: at the end of a word ''.includes check would be true (Kiran ≠ కిరం).
    if ((ch === 'n' || ch === 'm') && out && !lastWasConsonant && next && NASAL_BEFORE.includes(next)) {
      out += ANUSVARA[lang]
      afterNasal = true
      i += 1
      continue
    }
    if (CONSONANTS[ch]) {
      if (lastWasConsonant) out += VIRAMA[lang]
      out += DENTAL[ch] && (afterNasal || 'yrv'.includes(next)) ? DENTAL[ch][lang] : CONSONANTS[ch][lang]
      lastWasConsonant = true
      afterNasal = false
      i += 1
      continue
    }
    // digits, punctuation, anything else — pass through untouched
    if (lastWasConsonant && /[^a-z]/.test(ch)) {
      out += VIRAMA[lang]
      lastWasConsonant = false
    }
    out += ch
    i += 1
  }
  // A trailing consonant takes a virama in Telugu, so it isn't read with a stray
  // 'a'. Hindi drops a word-final 'a' when speaking, so it writes none (अखिल).
  if (lastWasConsonant && lang === 'te') out += VIRAMA[lang]
  return out
}

/** Titles are conventional, not phonetic — spell them the way each script does. */
const TITLES = {
  dr: { te: 'డా.', hi: 'डॉ.' },
  'dr.': { te: 'డా.', hi: 'डॉ.' },
  mr: { te: 'మి.', hi: 'श्री' },
  'mr.': { te: 'మి.', hi: 'श्री' },
  mrs: { te: 'శ్రీమతి', hi: 'श्रीमती' },
  'mrs.': { te: 'శ్రీమతి', hi: 'श्रीमती' },
}

/**
 * A name written in the reader's script. English is returned unchanged.
 *
 * Anything already in a non-Latin script is left alone — a clinic that typed
 * its name in Telugu should not be run through a Latin transliterator.
 */
export function translitName(name, lang) {
  if (!name || !lang || lang === 'en') return name || ''
  if (!/[A-Za-z]/.test(name)) return name
  // Multi-word places first ("Andhra Pradesh", "Bus Stand"), then per word.
  const segments = String(name).split(/(,\s*)/)
  return segments
    .map((seg) => {
      if (/^,\s*$/.test(seg) || !seg.trim()) return seg
      const whole = PLACES[seg.trim().toLowerCase()]
      if (whole) return whole[lang]
      return segment(seg, lang)
    })
    .join('')
}

function segment(name, lang) {
  return String(name)
    .split(/(\s+)/)
    .map((tok) => {
      if (/^\s+$/.test(tok)) return tok
      const title = TITLES[tok.toLowerCase()]
      if (title) return title[lang]
      if (!/[A-Za-z]/.test(tok)) return tok
      const key = tok.toLowerCase().replace(/[^a-z]/g, '')
      const lex = LEXICON[key] || PLACES[key]
      if (lex) return lex[lang]
      // An all-caps run of 2-5 letters is an initialism (KPHB, ENT, MGM).
      // Sounding those out gives "క్ఫ్బ్", which nobody can read back.
      if (/^[A-Z]{2,5}[^A-Za-z]*$/.test(tok)) return tok
      return word(tok, lang)
    })
    .join('')
}

/** Medical degrees as they are read out in Telugu / Hindi ("MBBS" ->
 *  "ఎంబీబీఎస్"). translitName leaves all-caps tokens alone and would garble
 *  mixed case ("PhD"), so degrees get their own list. Anything unknown is left
 *  exactly as typed — a wrong guess on a doctor's degree is worse than English. */
const DEGREES = {
  MBBS: { te: 'ఎంబీబీఎస్', hi: 'एमबीबीएस' },
  MD: { te: 'ఎండీ', hi: 'एमडी' },
  MS: { te: 'ఎంఎస్', hi: 'एमएस' },
  DM: { te: 'డీఎం', hi: 'डीएम' },
  BDS: { te: 'బీడీఎస్', hi: 'बीडीएस' },
  MDS: { te: 'ఎండీఎస్', hi: 'एमडीएस' },
  BAMS: { te: 'బీఏఎంఎస్', hi: 'बीएएमएस' },
  BHMS: { te: 'బీహెచ్‌ఎంఎస్', hi: 'बीएचएमएस' },
  BUMS: { te: 'బీయూఎంఎస్', hi: 'बीयूएमएस' },
  BNYS: { te: 'బీఎన్‌వైఎస్', hi: 'बीएनवाईएस' },
  BPT: { te: 'బీపీటీ', hi: 'बीपीटी' },
  MPT: { te: 'ఎంపీటీ', hi: 'एमपीटी' },
  MPH: { te: 'ఎంపీహెచ్', hi: 'एमपीएच' },
  PHD: { te: 'పీహెచ్‌డీ', hi: 'पीएचडी' },
  DNB: { te: 'డీఎన్‌బీ', hi: 'डीएनबी' },
  MCH: { te: 'ఎంసీహెచ్', hi: 'एमसीएच' },
  FRCS: { te: 'ఎఫ్‌ఆర్‌సీఎస్', hi: 'एफआरसीएस' },
  MRCP: { te: 'ఎంఆర్‌సీపీ', hi: 'एमआरसीपी' },
  DGO: { te: 'డీజీఓ', hi: 'डीजीओ' },
  DCH: { te: 'డీసీహెచ్', hi: 'डीसीएच' },
  DNYS: { te: 'డీఎన్‌వైఎస్', hi: 'डीएनवाईएस' },
  MSC: { te: 'ఎంఎస్సీ', hi: 'एमएससी' },
  BSC: { te: 'బీఎస్సీ', hi: 'बीएससी' },
}

export function translitDegrees(text, lang) {
  if (!text || !lang || lang === 'en') return text || ''
  return String(text).replace(/[A-Za-z.]+/g, (tok) => {
    const hit = DEGREES[tok.replace(/\./g, '').toUpperCase()]
    return hit ? hit[lang] : tok
  })
}
