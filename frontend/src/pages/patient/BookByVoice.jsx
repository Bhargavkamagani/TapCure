import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic, Square, Volume2, ArrowLeft, CheckCircle2, Stethoscope, MapPin,
  CalendarDays, Sparkles, RotateCcw, Loader2, Languages, BadgeCheck, Info,
} from 'lucide-react'
import { Card, PageHeading } from '../../components/hospital/ui.jsx'
import AddressAutocomplete from '../../components/common/AddressAutocomplete.jsx'
import { usePatientCtx } from '../../context/PatientContext.jsx'
import { useI18n, LANGS } from '../../i18n/index.jsx'
import { appointmentsApi, tokensApi, patientsApi } from '../../api'
// import { paymentsApi } from '../../api'
import { prettyDate, todayISO, clockISTWithDay, humanMins } from '../../lib/format.js'
import { speak, stopSpeaking, ttsSupported } from '../../lib/voice.js'
import {
  canRecord, cloudVoiceAvailable, startRecording, transcribe, listenOnce,
  interpretChoice, interpretDate, interpretYesNo, speechCode, cloudTtsAvailable,
  extractPerson, detectCorrection,
} from '../../lib/voiceAgent.js'
import { getCurrentPosition, roadTravelMinutes, geocodeAddress } from '../../lib/geo.js'
import { searchPlaces } from '../../lib/places.js'
import { englishSymptomNote, romanizeDevanagari, toEnglishText } from '../../lib/englishText.js'
import { NAME_STOP, bestNameMatch, matchSpokenCity, norm, romanizeName, spokenMatcher } from '../../lib/nameMatch.js'
import { matchSpecialties, matchesSpecialty, specialtyLabel } from '../../data/symptomSpecialty.js'
import { translitName } from '../../lib/translit.js'
// import { realEmail } from '../../lib/patientDisplay.js'

// Spoken ways of saying "go back", across the three languages the app speaks
// plus the transliterations speech-to-text actually produces. Checked before
// the per-step handlers: at the doctor step, "back" would otherwise be matched
// against doctor names and cheerfully pick somebody.
// Words for a relationship, in the three languages people actually speak them.
// Used to pull "my father" apart into a relation and a name. Anyone the list
// doesn't know used to come back as the NAME ("for my friend" -> a member
// called "friend"), so it covers friends, in-laws and neighbours too. The labels
// match PERSON_RELATIONS in the backend's voice.py.
const RELATIONS = [
  ['Father', ['father', 'dad', 'daddy', 'appa', 'nanna', 'నాన్న', 'తండ్రి', 'पिता', 'पापा', 'papa']],
  ['Mother', ['mother', 'mom', 'mummy', 'amma', 'అమ్మ', 'తల్లి', 'माँ', 'माता', 'मम्मी']],
  ['Son', ['son', 'koduku', 'కొడుకు', 'బాబు', 'बेटा']],
  ['Daughter', ['daughter', 'koothuru', 'కూతురు', 'పాప', 'बेटी']],
  ['Wife', ['wife', 'bharya', 'భార్య', 'पत्नी', 'बीवी']],
  ['Husband', ['husband', 'bharta', 'భర్త', 'पति']],
  ['Brother', ['brother', 'anna', 'thammudu', 'అన్న', 'తమ్ముడు', 'भाई']],
  ['Sister', ['sister', 'akka', 'chelli', 'అక్క', 'చెల్లి', 'बहन']],
  ['Grandfather', ['grandfather', 'grandpa', 'thatha', 'తాత', 'दादा', 'नाना']],
  ['Grandmother', ['grandmother', 'grandma', 'ammamma', 'nanamma', 'అమ్మమ్మ', 'నానమ్మ', 'दादी', 'नानी']],
  ['Grandson', ['grandson', 'manavadu', 'మనవడు', 'पोता', 'नाती']],
  ['Granddaughter', ['granddaughter', 'manavaralu', 'మనవరాలు', 'पोती', 'नातिन']],
  ['Uncle', ['uncle', 'babai', 'mamayya', 'బాబాయ్', 'బాబాయి', 'మామయ్య', 'అంకుల్', 'चाचा', 'मामा', 'अंकल']],
  ['Aunt', ['aunt', 'aunty', 'auntie', 'pinni', 'ఆంటీ', 'పిన్ని', 'అత్త', 'चाची', 'मौसी', 'बुआ', 'आंटी']],
  ['Cousin', ['cousin', 'కజిన్', 'कज़िन', 'कजिन']],
  ['Nephew', ['nephew', 'మేనల్లుడు', 'भतीजा', 'भांजा']],
  ['Niece', ['niece', 'మేనకోడలు', 'भतीजी', 'भांजी']],
  ['Father-in-law', ['father in law', 'mamagaru', 'మామగారు', 'ससुर']],
  ['Mother-in-law', ['mother in law', 'attagaru', 'అత్తగారు', 'सास']],
  ['Son-in-law', ['son in law', 'alludu', 'అల్లుడు', 'दामाद']],
  ['Daughter-in-law', ['daughter in law', 'kodalu', 'కోడలు', 'बहू']],
  ['Brother-in-law', ['brother in law', 'bava', 'బావ', 'जीजा', 'साला', 'देवर']],
  ['Sister-in-law', ['sister in law', 'vadina', 'వదిన', 'మరదలు', 'भाभी', 'ननद', 'साली']],
  ['Friend', ['friend', 'dost', 'dosth', 'ఫ్రెండ్', 'స్నేహితుడు', 'స్నేహితురాలు', 'మిత్రుడు', 'दोस्त', 'मित्र', 'सहेली']],
  ['Neighbour', ['neighbour', 'neighbor', 'పొరుగువారు', 'పక్కింటి', 'पड़ोसी']],
  ['Colleague', ['colleague', 'coworker', 'సహోద్యోగి', 'सहकर्मी']],
]

// How the relation is spoken back: "What is {who} name?" and "Kiran ({label})".
const RELATION_SPOKEN = {
  Father: { en: 'your father', te: 'మీ నాన్నగారి', hi: 'आपके पिताजी', label: { te: 'నాన్న', hi: 'पिता' } },
  Mother: { en: 'your mother', te: 'మీ అమ్మగారి', hi: 'आपकी माँ', label: { te: 'అమ్మ', hi: 'माँ' } },
  Son: { en: 'your son', te: 'మీ అబ్బాయి', hi: 'आपके बेटे', label: { te: 'కొడుకు', hi: 'बेटा' } },
  Daughter: { en: 'your daughter', te: 'మీ అమ్మాయి', hi: 'आपकी बेटी', label: { te: 'కూతురు', hi: 'बेटी' } },
  Wife: { en: 'your wife', te: 'మీ భార్య', hi: 'आपकी पत्नी', label: { te: 'భార్య', hi: 'पत्नी' } },
  Husband: { en: 'your husband', te: 'మీ భర్త', hi: 'आपके पति', label: { te: 'భర్త', hi: 'पति' } },
  Brother: { en: 'your brother', te: 'మీ సోదరుడి', hi: 'आपके भाई', label: { te: 'సోదరుడు', hi: 'भाई' } },
  Sister: { en: 'your sister', te: 'మీ సోదరి', hi: 'आपकी बहन', label: { te: 'సోదరి', hi: 'बहन' } },
  Grandfather: { en: 'your grandfather', te: 'మీ తాతగారి', hi: 'आपके दादाजी', label: { te: 'తాత', hi: 'दादा' } },
  Grandmother: { en: 'your grandmother', te: 'మీ అమ్మమ్మగారి', hi: 'आपकी दादीजी', label: { te: 'అమ్మమ్మ', hi: 'दादी' } },
  Grandson: { en: 'your grandson', te: 'మీ మనవడి', hi: 'आपके पोते', label: { te: 'మనవడు', hi: 'पोता' } },
  Granddaughter: { en: 'your granddaughter', te: 'మీ మనవరాలి', hi: 'आपकी पोती', label: { te: 'మనవరాలు', hi: 'पोती' } },
  Uncle: { en: 'your uncle', te: 'మీ బాబాయి', hi: 'आपके अंकल', label: { te: 'బాబాయి', hi: 'अंकल' } },
  Aunt: { en: 'your aunt', te: 'మీ పిన్ని', hi: 'आपकी आंटी', label: { te: 'పిన్ని', hi: 'आंटी' } },
  Cousin: { en: 'your cousin', te: 'మీ కజిన్', hi: 'आपके कज़िन', label: { te: 'కజిన్', hi: 'कज़िन' } },
  Nephew: { en: 'your nephew', te: 'మీ మేనల్లుడి', hi: 'आपके भतीजे', label: { te: 'మేనల్లుడు', hi: 'भतीजा' } },
  Niece: { en: 'your niece', te: 'మీ మేనకోడలి', hi: 'आपकी भतीजी', label: { te: 'మేనకోడలు', hi: 'भतीजी' } },
  'Father-in-law': { en: 'your father-in-law', te: 'మీ మామగారి', hi: 'आपके ससुरजी', label: { te: 'మామగారు', hi: 'ससुर' } },
  'Mother-in-law': { en: 'your mother-in-law', te: 'మీ అత్తగారి', hi: 'आपकी सासू माँ', label: { te: 'అత్తగారు', hi: 'सास' } },
  'Son-in-law': { en: 'your son-in-law', te: 'మీ అల్లుడి', hi: 'आपके दामाद', label: { te: 'అల్లుడు', hi: 'दामाद' } },
  'Daughter-in-law': { en: 'your daughter-in-law', te: 'మీ కోడలి', hi: 'आपकी बहू', label: { te: 'కోడలు', hi: 'बहू' } },
  'Brother-in-law': { en: 'your brother-in-law', te: 'మీ బావగారి', hi: 'आपके जीजाजी', label: { te: 'బావ', hi: 'जीजा' } },
  'Sister-in-law': { en: 'your sister-in-law', te: 'మీ వదిన', hi: 'आपकी भाभी', label: { te: 'వదిన', hi: 'भाभी' } },
  Friend: { en: 'your friend', te: 'మీ స్నేహితుడి', hi: 'आपके दोस्त', label: { te: 'స్నేహితుడు', hi: 'दोस्त' } },
  Neighbour: { en: 'your neighbour', te: 'మీ పొరుగువారి', hi: 'आपके पड़ोसी', label: { te: 'పొరుగువారు', hi: 'पड़ोसी' } },
  Colleague: { en: 'your colleague', te: 'మీ సహోద్యోగి', hi: 'आपके सहकर्मी', label: { te: 'సహోద్యోగి', hi: 'सहकर्मी' } },
}
const relationWho = (relation, lang) => RELATION_SPOKEN[relation]?.[lang] || RELATION_SPOKEN[relation]?.en || ''
const relationLabel = (relation, lang) => RELATION_SPOKEN[relation]?.label?.[lang] || relation

// Filler around a name when someone answers "who is this for?" out loud.
const PERSON_FILLER = [
  'book for', 'for my', 'for', 'my', 'name is', 'called', 'add', 'it', "it's", 'its',
  'is', 'his', 'her', 'their', 'the', 'a', 'this', 'appointment', 'please',
  'నా', 'మా', 'కోసం', 'పేరు', 'ది', 'मेरे', 'लिए', 'के', 'नाम', 'है', 'मेरी', 'मेरा',
]

// Every relation phrase as tokens, longest first, so "grandfather" is never
// read as "father" and "father in law" never as "father".
const RELATION_PHRASES = RELATIONS
  .flatMap(([label, words]) => words.map((w) => ({ label, toks: norm(w).split(/\s+/) })))
  .sort((a, b) => b.toks.length - a.toks.length || b.toks.join('').length - a.toks.join('').length)

/** "for my father Ramesh" -> { relation: 'Father', name: 'Ramesh' }
 *  Whole words only: the old substring match read "Sonu" as son + "u", and
 *  "grandfather" as Father. */
function parsePerson(text) {
  const toks = String(text || '')
    .replace(/[.,!?]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/'s(?=\s|$)/gi, '')
    .split(/\s+/)
    .filter(Boolean)
  const low = toks.map(norm)
  let relation = ''
  let cut = null
  for (const p of RELATION_PHRASES) {
    const at = low.findIndex((_, i) => p.toks.every((w, k) => low[i + k] === w))
    if (at >= 0) { relation = p.label; cut = [at, at + p.toks.length]; break }
  }
  const rest = cut ? [...toks.slice(0, cut[0]), ...toks.slice(cut[1])] : toks
  const drop = new Set(PERSON_FILLER.flatMap((f) => f.split(' ')).map(norm))
  const name = rest.filter((tok) => !drop.has(norm(tok))).join(' ').trim()
  return { relation, name }
}

// "No" / "not" in a reply like "no, not Sudhi, Sundari" — never part of a name.
const NOT_NAME_WORDS = new Set(['no', 'not', 'nope', 'nahi', 'nahin', 'नहीं', 'ना', 'కాదు', 'kadu', 'kaadu', 'లేదు', 'ledu', 'వద్దు', 'vaddu', 'yes', 'avunu', 'అవును', 'haan', 'हाँ', 'हां'])

/** AI first (Book by Voice rule), word rules if the AI is off or failed. A
 *  relation word the AI let slip into the name is still caught by the rules. */
async function readPerson(text, lang) {
  const ai = await extractPerson(text, lang)
  const local = parsePerson(text)
  if (!ai) return local
  const name = ai.name && !RELATION_PHRASES.some((p) => p.toks.join(' ') === norm(ai.name)) ? ai.name : ''
  return { relation: ai.relation || local.relation, name }
}

const BACK_WORDS = [
  'back', 'go back', 'previous', 'last question', 'change',
  'venakki', 'venaki', 'venuku', 'వెనక్కి', 'వెనుకకు', 'మార్చు',
  'peeche', 'piche', 'wapas', 'vapas', 'पीछे', 'वापस', 'बदल',
]

// Words to peel off a spoken starting address: "I'm coming from KPHB metro",
// "అమలాపురం నుండి", "Ameerpet se". Only the place should reach the search.
const ORIGIN_FILLER = [
  "i'm coming from", 'i am coming from', 'coming from', "i'm starting from", 'i am starting from',
  'starting from', 'start from', 'my address is', 'address is', 'i am at', "i'm at", 'i am in', "i'm in", 'from',
  'nundi', 'nunchi', 'nunche', 'నుండి', 'నుంచి', 'se', 'से', 'mein hoon', 'में हूँ', 'मैं', 'में', 'हूँ', 'हूं', 'నేను', 'ఉన్నాను',
]
// "Skip" at the starting-address question: book without a leave-by reminder.
const SKIP_WORDS = ['skip', 'no address', 'vaddu', 'వద్దు', 'chodo', 'chhodo', 'छोड़ो', 'rehne do', 'रहने दो']

/** Spoken reply → search text: filler words dropped, Telugu/Hindi script
 *  romanised ("టి చల్లపల్లె" → "ti challapalle") because the map search
 *  only understands Latin letters. */
function originQuery(text) {
  let q = ` ${norm(text).replace(/[.,!?।]/g, ' ')} `
  for (const w of ORIGIN_FILLER) q = q.split(` ${w} `).join(' ')
  // Telugu "in" is a suffix, not a word: అమలాపురంలో = in Amalapuram.
  q = q.replace(/లో(?=[ ,.]|$)/g, ' ')
  q = q.replace(/\s+/g, ' ').trim()
  if (/[\u0900-\u097f]/.test(q)) q = romanizeDevanagari(q)
  return /[^\u0000-\u024f]/.test(q) ? romanizeName(q) : q
}

/** First few parts of a place label — what the assistant reads back. Pincode
 *  and "India" are noise when spoken. */
const spokenPlace = (label) => String(label || '').split(',').map((s) => s.trim())
  .filter((s) => s && !/^\d{6}$/.test(s) && s.toLowerCase() !== 'india').slice(0, 3).join(', ')

// Voice-booking steps that ask for a value outright. There a "correction" of
// that same value is simply the answer ("Tomorrow" at "which date?"), so the
// step's own handling takes it. Yes/no steps (addPerson, confirmDoctor,
// originConfirm, confirm) aren't listed: "no, Dr. Satya" at "is it Dr. Lasya?"
// IS a correction.
const STEP_ASKS = {
  who: 'who', addPersonName: 'person_name', symptom: 'symptom', particular: 'doctor',
  location: 'location', doctor: 'doctor', origin: 'origin', date: 'date', unavailable: 'date',
}

const STEPS = ['who', 'symptom', 'preference', 'particular', 'confirmDoctor', 'location', 'doctor', 'date', 'confirm']

// Razorpay booking checkout is disabled for now.
// function loadRazorpay() {
//   return new Promise((resolve) => {
//     if (window.Razorpay) return resolve(true)
//     const s = document.createElement('script')
//     s.src = 'https://checkout.razorpay.com/v1/checkout.js'
//     s.onload = () => resolve(true)
//     s.onerror = () => resolve(false)
//     document.body.appendChild(s)
//   })
// }

/**
 * Rank doctors for a spoken complaint.
 *
 * Uses the SHARED symptom table (data/symptomSpecialty.js) rather than the
 * cut-down copy that used to live here. That copy had 9 specialties and 99
 * keywords against the shared table's 25 and 642, so the voice flow quietly
 * understood far less than the tap-based symptom helper on the same app:
 * "daant dard" found nobody by voice while working fine by tap.
 *
 * Specialty ranking is the shared matcher's; matching a doctor to a specialty
 * is `matchesSpecialty`, which already knows the real-world spellings a hospital
 * types ("Dentist" ~ "Dental", "MBBS" ~ General Physician).
 */
function rankDoctorsForSymptom(text, doctors, hospitalNameOf) {
  const ranked = matchSpecialties(text)
  if (!ranked.length) return []
  return doctors
    .map((doctor) => {
      const hit = ranked.find((r) => matchesSpecialty(doctor.specialization, r.specialty))
      // Fall back to the hospital's name ("… Dental Care") only when the doctor's
      // own specialisation says nothing — it's a weaker signal, so it scores less.
      const viaHospital = !hit && ranked.find((r) =>
        norm(hospitalNameOf(doctor) || '').includes(norm(r.specialty)))
      return { doctor, score: hit ? hit.score * 10 : (viaHospital ? viaHospital.score : 0) }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.doctor.name).localeCompare(String(b.doctor.name)))
    .map((item) => item.doctor)
}

const locationOf = (affiliation, resolveHospital) => {
  const hospital = affiliation?.hospital_id ? resolveHospital(affiliation.hospital_id) : null
  return affiliation?.city || hospital?.city || ''
}


function nextDays(n, t) {
  const out = []
  const base = new Date(`${todayISO()}T00:00:00`)
  for (let i = 0; i < n; i += 1) {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    // Local date, NOT toISOString() — in IST, UTC midnight rolls back a day, so
    // "today" would book yesterday.
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = i === 0 ? t('pcommon.today') || 'Today'
      : i === 1 ? t('pcommon.tomorrow') || 'Tomorrow'
      : prettyDate(iso)
    out.push({ iso, label })
  }
  return out
}

function BookByVoice() {
  const { t, lang, setLang } = useI18n()
  const navigate = useNavigate()
  const { patient, doctorsById, affiliationsByDoctor, resolveHospital, loading: ctxLoading } = usePatientCtx()

  const [started, setStarted] = useState(false)
  const [step, setStep] = useState('symptom')
  const [phase, setPhase] = useState('idle') // idle | listening | thinking | speaking
  const [heard, setHeard] = useState('')
  const [hint, setHint] = useState('') // small helper line (e.g. "didn't catch that")
  const [cloud, setCloud] = useState(false)
  const [cloudTts, setCloudTts] = useState(false) // Cartesia voices available

  // Selections gathered across the flow.
  const [doctorShortlist, setDoctorShortlist] = useState([])
  const [symptomDoctors, setSymptomDoctors] = useState([])
  const [preferredDoctors, setPreferredDoctors] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [affiliationId, setAffiliationId] = useState('')
  const [date, setDate] = useState('')
  const [result, setResult] = useState(null) // { token_number, leave_by, doctorName }
  const [symptom, setSymptom] = useState('')
  const [family, setFamily] = useState([])
  // A person the patient named who isn't in their family list yet.
  const [pendingPerson, setPendingPerson] = useState({ name: '', relation: '' })
  const [bookingFor, setBookingFor] = useState('self')   // 'self' or family member_id
  // const [payCfg, setPayCfg] = useState({ enabled: false, booking_fee: 0 })
  // What we offer when the chosen doctor doesn't consult on the chosen day:
  // their next open days, plus other suitable doctors who ARE free that day.
  const [alt, setAlt] = useState({ dates: [], doctors: [], reason: '' })
  // Starting location for the "leave by" reminder — GPS by default, with a typed
  // address fallback (same controls as the manual booking screen).
  const [trip, setTrip] = useState({ lat: null, lng: null, label: '', address: '', geoLoading: false, geoError: null })
  const [showAddr, setShowAddr] = useState(false)
  // Asked by voice only when there is no GPS: places matching what the patient
  // said, best first; the first is read back for a yes/no.
  const [originMatches, setOriginMatches] = useState([])

  useEffect(() => {
    if (!patient?.patient_id) return
    patientsApi.family(patient.patient_id)
      .then((r) => setFamily((r || []).filter((m) => m.is_active)))
      .catch(() => setFamily([]))
  }, [patient?.patient_id])

  // Booking-fee config lookup disabled with checkout:
  // useEffect(() => {
  //   paymentsApi.config().then(setPayCfg).catch(() => {})
  // }, [])

  const recRef = useRef(null)        // active MediaRecorder handle (cloud mode)
  const autoStopRef = useRef(null)   // safety timer that stops recording on its own
  const originRef = useRef(null)     // {lat,lng} captured quietly for leave-by

  const bookableDoctors = useMemo(
    () => Object.values(doctorsById).filter((d) => d.status === 'active' || d.is_available_today),
    [doctorsById],
  )
  const doctor = doctorId ? doctorsById[doctorId] : null
  const affiliations = doctorId ? affiliationsByDoctor[doctorId] || [] : []
  const affiliation = affiliations.find((a) => String(a.affiliation_id) === String(affiliationId)) || affiliations[0] || null
  const hospital = affiliation?.hospital_id ? resolveHospital(affiliation.hospital_id) : doctor ? resolveHospital(doctor.hospital_id) : null
  const destination = affiliation?.latitude != null && affiliation?.longitude != null
    ? { ...affiliation, latitude: affiliation.latitude, longitude: affiliation.longitude }
    : hospital
  const hospitalNameOf = useCallback((d) => resolveHospital(d?.hospital_id)?.name || '', [resolveHospital])
  const affiliationsOf = useCallback((d) => affiliationsByDoctor[d?.doctor_id] || [], [affiliationsByDoctor])
  const doctorLocations = useCallback((d) => {
    const values = affiliationsOf(d).map((a) => locationOf(a, resolveHospital)).filter(Boolean)
    const hospitalCity = resolveHospital(d?.hospital_id)?.city
    if (hospitalCity) values.push(hospitalCity)
    return [...new Set(values)]
  }, [affiliationsOf, resolveHospital])
  const availableLocations = useMemo(() => {
    const source = preferredDoctors.length ? preferredDoctors : symptomDoctors
    return [...new Set(source.flatMap(doctorLocations))].sort((a, b) => a.localeCompare(b))
  }, [doctorLocations, preferredDoctors, symptomDoctors])
  // Shown on screen (and spoken): the doctor, hospital and city in the patient's
  // own script. The plain `docLabel` below stays English because it doubles as
  // the option label sent to the language model, where a stable, consistent
  // spelling matches better than a transliteration.
  // The prompt builder reads names straight off the doctor map, so give it a
  // view whose names are already in the patient's script.
  const localDoctorsById = useMemo(() => {
    if (lang === 'en') return doctorsById
    return Object.fromEntries(Object.entries(doctorsById).map(([id, d]) => [id, { ...d, name: translitName(d.name, lang) }]))
  }, [doctorsById, lang])

  const docLabelLocal = useCallback((d) => {
    const hospitalName = hospitalNameOf(d)
    const city = doctorLocations(d)[0] || ''
    return [translitName(d?.name, lang), specialtyLabel(d?.specialization, lang),
            translitName(hospitalName, lang), translitName(city, lang)]
      .filter(Boolean).join(' - ').replace(' - ', ' - ')
  }, [hospitalNameOf, doctorLocations, lang])

  const docLabel = useCallback((d) => {
    const hospitalName = hospitalNameOf(d)
    const city = doctorLocations(d)[0]
    return `${d.name} - ${d.specialization}${hospitalName ? `, ${hospitalName}` : ''}${city ? `, ${city}` : ''}`
  }, [hospitalNameOf, doctorLocations])

  // Probe cloud voice once, and quietly try to get the patient's location so the
  // leave-by reminder can be computed (non-blocking; failure is fine).
  useEffect(() => {
    cloudVoiceAvailable().then(setCloud)
    cloudTtsAvailable().then(setCloudTts)
    getCurrentPosition().then((p) => {
      originRef.current = p
      // Reflect the silent GPS grab in the card so it shows "captured" — unless
      // the patient has already set a location by hand.
      setTrip((tr) => (tr.lat == null ? { ...tr, lat: p.lat, lng: p.lng, source: 'gps', label: t('ppage.myCurrentLocation') } : tr))
    }).catch(() => {})
    return () => stopSpeaking()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Capture the patient's current location on demand (GPS).
  const useMyLocation = async () => {
    setTrip((tr) => ({ ...tr, geoLoading: true, geoError: null }))
    try {
      const { lat, lng } = await getCurrentPosition()
      originRef.current = { lat, lng }
      setTrip((tr) => ({ ...tr, lat, lng, source: 'gps', geoLoading: false, geoError: null, label: t('ppage.myCurrentLocation') }))
    } catch (err) {
      setTrip((tr) => ({ ...tr, geoLoading: false, geoError: err.message }))
    }
  }

  // Fallback when GPS is denied: geocode a typed address into coordinates.
  const locateFromAddress = async () => {
    if (!trip.address.trim()) { setTrip((tr) => ({ ...tr, geoError: t('ppage.enterAddressFirst') })); return }
    setTrip((tr) => ({ ...tr, geoLoading: true, geoError: null }))
    try {
      const g = await geocodeAddress({ address: trip.address })
      if (!g) { setTrip((tr) => ({ ...tr, geoLoading: false, geoError: t('ppage.couldNotFindAddress') })); return }
      // City-level match only: the pin could be far off, so ask instead.
      if (g.approximate) { setTrip((tr) => ({ ...tr, geoLoading: false, geoError: t('ppage.onlyCityFound') })); return }
      originRef.current = { lat: g.lat, lng: g.lng }
      setTrip((tr) => ({ ...tr, lat: g.lat, lng: g.lng, geoLoading: false, geoError: null, label: tr.address.trim() }))
    } catch (err) {
      setTrip((tr) => ({ ...tr, geoLoading: false, geoError: err.message || t('ppage.addressLookupFailed') }))
    }
  }

  // Read the how-to instructions aloud for Telugu patients (many can't read the
  // screen). Plays once shortly after the intro screen appears; replayable via
  // the "Listen to instructions" button below.
  // True once we know the guide could NOT be voiced — then we show the words on
  // screen instead. Silence is the one outcome this button must never produce.
  const [guideSilent, setGuideSilent] = useState(false)
  const speakGuide = useCallback(async () => {
    stopSpeaking()
    const spoke = await speak(t('vbook.guideSpoken'), speechCode('te'))
    setGuideSilent(!spoke)
  }, [t])

  useEffect(() => {
    if (lang !== 'te' || started) return undefined
    const id = setTimeout(speakGuide, 600)
    return () => clearTimeout(id)
  }, [lang, started, speakGuide])

  // -- Speak a prompt in the chosen language. `speak()` prefers Cartesia and,
  //    for Telugu, never falls back to English/romanized browser narration.
  const say = useCallback(async (text) => {
    if (!text) return
    setPhase('speaking')
    await speak(text, speechCode(lang))
    setPhase('idle')
  }, [lang])

  // The confirmation prompt. The overrides let callers pass a freshly picked
  // date/doctor without waiting on the async state.
  const confirmText = useCallback((dateOverride, doctorOverride) => {
    return t('vbook.confirm', {
      doctor: doctorsById[doctorOverride || doctorId]?.name || '',
      date: prettyDate(dateOverride || date),
    })
    // Previous booking-fee prompt (disabled):
    // return feeApplies ? `${base} ${t('vbook.confirmFee', { amount: payCfg.booking_fee })}` : base
  }, [doctorsById, doctorId, date, t])

  // "What is your friend's name?" when we know the relation, else the old
  // generic "What is their name?".
  const personNamePrompt = useCallback((relation) => (
    relation ? t('vbook.askRelationName', { who: relationWho(relation, lang) }) : t('vbook.askPersonName')
  ), [lang, t])
  // "Kiran (Friend) is not in your family list yet. Shall I add them?"
  const addPersonPrompt = useCallback(({ name, relation }) => t('vbook.askAddPerson', {
    name: relation ? `${name} (${relationLabel(relation, lang)})` : name,
  }), [lang, t])

  // ---- Step handlers: each takes the transcript and advances the flow. ------
  // First question: who is the visit for — the patient, or a family member?
  const handleWho = useCallback(async (text) => {
    const options = [
      { id: 'self', label: t('ppage.myself') },
      ...family.map((m) => ({ id: String(m.member_id), label: `${m.name}${m.relation ? ` (${m.relation})` : ''}` })),
    ]
    const { id } = await interpretChoice(
      text, lang, options,
      'The patient is saying who the check-up is for: themselves ("me", "myself", "for me", "నా కోసం", "నేనే", "मेरे लिए") → return "self"; otherwise the named family member.',
    )
    if (!id) {
      // They named somebody who isn't in the family list. Looping "sorry, I
      // didn't catch that" was a dead end: the patient had to abandon the
      // booking, add the person on the Family screen and start over. Offer to
      // add them right here instead.
      const person = await readPerson(text, lang)
      if (person.name) {
        setPendingPerson(person)
        setStep('addPerson')
        await say(addPersonPrompt(person))
      } else if (person.relation) {
        // "for my friend" — we know who, not their name: ask for it by relation.
        setPendingPerson({ name: '', relation: person.relation })
        setStep('addPersonName')
        await say(personNamePrompt(person.relation))
      } else {
        setHint(t('vbook.didntCatch'))
        await say(t('vbook.askWho'))
      }
      return
    }
    setBookingFor(id)
    setStep('symptom')
    await say(t('vbook.askSymptom'))
  }, [family, lang, say, t, addPersonPrompt, personNamePrompt])

  /** Create the family member, then carry straight on with the booking. */
  const createPerson = useCallback(async ({ name, relation }) => {
    // Returning silently here would look identical to the bug above — the step
    // never changes, so the same question is asked again and again.
    if (!patient?.patient_id || !name) {
      setHint(t('vbook.couldNotAdd'))
      setStep('who')
      await say(t('vbook.askWho'))
      return
    }
    setPhase('busy')
    try {
      // Saved in English letters (సత్య → Satya): the database is English-only.
      // The relation is already one of the English labels.
      const member = await patientsApi.addFamily({
        patient_id: patient.patient_id, name: toEnglishText(name), relation: relation || '',
      })
      const list = await patientsApi.family(patient.patient_id).catch(() => null)
      if (list) setFamily(list)
      setBookingFor(String(member.member_id))
      setPendingPerson({ name: '', relation: '' })
      await say(t('vbook.personAdded', { name }))
      setStep('symptom')
      await say(t('vbook.askSymptom'))
    } catch (e) {
      setHint(e.message || t('vbook.couldNotAdd'))
      setStep('who')
      await say(t('vbook.askWho'))
    } finally {
      setPhase('idle')
    }
  }, [patient, say, t])

  const handleAddPerson = useCallback(async (text) => {
    // `interpretYesNo` returns { value, reply } — comparing the OBJECT to 'yes'
    // is always false, which is why saying "అవును" just re-asked forever.
    const { value } = await interpretYesNo(text, lang, addPersonPrompt(pendingPerson))
    if (value === 'yes') return createPerson(pendingPerson)
    // A name in the reply is the correction speech-to-text made necessary
    // ("Sundari" heard as "Sudhi"): "no, her name is Sundari" or just "Sundari".
    // Before, "no" threw the name away and restarted at "who is this for?".
    const oldName = norm(pendingPerson.name)
    const spoken = (await readPerson(text, lang)).name
    const newName = String(spoken || '').split(/\s+/)
      .filter((w) => w && !NOT_NAME_WORDS.has(norm(w)) && norm(w) !== oldName).join(' ').trim()
    // Only when they clearly rejected the name or gave one ("name is …"):
    // otherwise any unclear sound ("hmm") would become the new name.
    const gaveName = value === 'no' || /name|పేరు|नाम/i.test(text)
    if (newName && gaveName && norm(newName) !== oldName) {
      const person = { ...pendingPerson, name: newName }
      setPendingPerson(person)
      await say(addPersonPrompt(person))
      return
    }
    if (value === 'no') {
      // Keep the relation we already have; only the name was wrong.
      if (pendingPerson.relation) {
        setStep('addPersonName')
        await say(personNamePrompt(pendingPerson.relation))
        return
      }
      setStep('who'); await say(t('vbook.askWho')); return
    }
    setHint(t('vbook.didntCatch'))
    await say(addPersonPrompt(pendingPerson))
  }, [createPerson, lang, pendingPerson, say, t, addPersonPrompt, personNamePrompt])

  // Answer to "What is your friend's name?". AI first, so "his name is Kiran"
  // gives Kiran; then read the name back before adding anyone.
  const handleAddPersonName = useCallback(async (text) => {
    const { name, relation } = await readPerson(text, lang)
    if (!name) { setHint(t('vbook.didntCatch')); await say(personNamePrompt(pendingPerson.relation)); return }
    const person = { name, relation: pendingPerson.relation || relation }
    setPendingPerson(person)
    setStep('addPerson')
    await say(addPersonPrompt(person))
  }, [lang, pendingPerson, say, t, addPersonPrompt, personNamePrompt])

  const handleSymptom = useCallback(async (text) => {
    setSymptom(text)
    if (!bookableDoctors.length) { setHint(t('vbook.noDoctors')); setPhase('idle'); return }
    const symptomMatches = rankDoctorsForSymptom(text, bookableDoctors, hospitalNameOf)
    // If the complaint maps to a specialty, offer those doctors. Otherwise default
    // to GENERAL PHYSICIANS (right for general complaints like fever/cold) — never
    // the whole directory, so a dentist can't surface for a fever.
    const gps = bookableDoctors.filter((d) => /general|physician|medicine|mbbs/i.test(d.specialization || ''))
    const shortlist = symptomMatches.length ? symptomMatches : (gps.length ? gps : bookableDoctors)
    setSymptomDoctors(shortlist)
    setPreferredDoctors(shortlist)
    setStep('preference')
    await say(t('vbook.askPreference'))
  }, [bookableDoctors, hospitalNameOf, say, t])

  const handlePreference = useCallback(async (text) => {
    const options = [
      { id: 'suitable', label: t('vbook.findSuitable') },
      { id: 'particular', label: t('vbook.particularDoctor') },
    ]
    const { id } = await interpretChoice(text, lang, options, 'Choose whether the patient wants a particular doctor or hospital, or wants us to find a suitable doctor.')
    if (!id) { setHint(t('vbook.didntCatch')); await say(t('vbook.askPreference')); return }
    if (id === 'particular') {
      setStep('particular')
      await say(t('vbook.askParticular'))
      return
    }
    setPreferredDoctors(symptomDoctors)
    setStep('location')
    await say(t('vbook.askLocation'))
  }, [lang, say, symptomDoctors, t])

  const handleParticular = useCallback(async (text) => {
    // The patient named a specific doctor/hospital, so search the WHOLE directory —
    // not just the symptom shortlist (they may want a doctor the symptom filter
    // dropped, e.g. asking for "Dr Satya" after a generic complaint).
    // Romanise Telugu/Hindi speech ("సత్య" → "satya") so it matches the Latin
    // doctor names; also match filler words like "డాక్టర్"/"doctor".
    // Drop generic words so "omega hospitals" matches on "omega", not "hospitals"
    // (which would otherwise match every hospital).
    const tokMatch = spokenMatcher(text)
    const hospitalTokensOf = (d) => [resolveHospital(d.hospital_id)?.name, ...affiliationsOf(d).map((a) => a.name)]
      .filter(Boolean).flatMap((s) => norm(s).split(/\s+/)).filter((tok) => tok.length >= 2 && !NAME_STOP.has(tok))
    // Prefer a match on the DOCTOR's own name; only fall back to hospital/hospital
    // names if no doctor name matched — otherwise "Satya Hospitals" would hijack a
    // search for "Dr Satya" (and pull in every doctor who works there).
    // A name that fuzzy-matches several doctors ("pawan kalyan" hits Pawan,
    // Kalyan and Pawan Kalyan) resolves to the one whose whole name was spoken.
    const { best, matches: nameMatches } = bestNameMatch(text, bookableDoctors)
    let matches = best ? [best]
      : nameMatches.length ? nameMatches
      : bookableDoctors.filter((d) => tokMatch(hospitalTokensOf(d)))
    // Still nothing? Names are hard for speech-to-text — let the language model
    // pick the closest doctor/hospital by name from the full list.
    if (!matches.length) {
      const opts = bookableDoctors.map((d) => ({ id: String(d.doctor_id), label: docLabel(d) }))
      const { id } = await interpretChoice(text, lang, opts,
        'The patient named a specific doctor or hospital. Pick the closest match by name, allowing for spelling/pronunciation differences from speech-to-text.')
      const picked = id ? bookableDoctors.find((d) => String(d.doctor_id) === id) : null
      if (picked) matches = [picked]
    }
    setPreferredDoctors(matches.length ? matches : bookableDoctors)
    // Named exactly one doctor → confirm it's the right one (yes → proceed,
    // no → show other suitable doctors) instead of asking "pick from the list".
    if (matches.length === 1) {
      setDoctorShortlist(matches)
      setStep('confirmDoctor')
      await say(t('vbook.confirmDoctor', { doctor: translitName(matches[0].name, lang) }))
      return
    }
    if (!matches.length) {
      setHint(t('vbook.noParticular'))
      await say(t('vbook.noParticular'))
    }
    setStep('location')
    await say(t('vbook.askLocation'))
  }, [affiliationsOf, bookableDoctors, docLabel, lang, resolveHospital, say, t])

  // Narrow the pool to one town and move to the doctor question. Split out of
  // `handleLocation` so a town named at another point in the flow (e.g. "look in
  // Kakinada" when the chosen doctor is off) reuses it without a second NLU call.
  const applyLocation = useCallback(async (requested, sourceOverride) => {
    const source = sourceOverride || (preferredDoctors.length ? preferredDoctors : symptomDoctors)
    setSelectedLocation(requested)
    const local = source.filter((d) => doctorLocations(d).some((city) => {
      const a = norm(city); const b = norm(requested)
      return a === b || a.includes(b) || b.includes(a)
    }))
    const shortlist = (local.length ? local : source).slice(0, 12)
    setDoctorShortlist(shortlist)
    setHint('')
    setStep('doctor')
    if (!local.length) {
      setHint(t('vbook.noDoctorsInLocation', { location: requested }))
      await say(t('vbook.noDoctorsInLocation', { location: requested }))
    }
    await say(t('vbook.askDoctor'))
  }, [doctorLocations, preferredDoctors, say, symptomDoctors, t])

  const handleLocation = useCallback(async (text) => {
    const options = availableLocations.map((city) => ({ id: city, label: city }))
    const { id } = await interpretChoice(text, lang, options, 'Pick the city or locality where the patient wants the check-up.')
    const requested = id || text.trim()
    if (!requested) { setHint(t('vbook.didntCatch')); await say(t('vbook.askLocation')); return }
    await applyLocation(requested)
  }, [applyLocation, availableLocations, lang, say, t])

  const selectDoctor = useCallback(async (id) => {
    setDoctorId(String(id))
    const doctorAffiliations = affiliationsByDoctor[id] || []
    const locationMatch = doctorAffiliations.find((a) => norm(locationOf(a, resolveHospital)) === norm(selectedLocation))
    const selectedAffiliation = locationMatch || doctorAffiliations[0]
    setAffiliationId(selectedAffiliation ? String(selectedAffiliation.affiliation_id) : '')
    // No GPS (denied, unsupported, or not answered yet) and nothing typed on the
    // card: ask where they'll start from before the date, so the date check
    // can already tell them if they can't reach the hospital in time.
    if (!originRef.current && trip.lat == null) {
      setOriginMatches([])
      setStep('origin')
      await say(t('vbook.askOrigin'))
      return
    }
    setStep('date')
    await say(t('vbook.askDate'))
  }, [affiliationsByDoctor, resolveHospital, say, selectedLocation, t, trip.lat])

  // ---- starting address by voice (only asked when there is no GPS) ----------
  const toDateStep = useCallback(async () => {
    setStep('date')
    await say(t('vbook.askDate'))
  }, [say, t])

  const applyOrigin = useCallback(async (place) => {
    originRef.current = { lat: place.lat, lng: place.lng }
    setTrip((tr) => ({ ...tr, lat: place.lat, lng: place.lng, address: place.label, label: place.label, geoError: null }))
    setOriginMatches([])
    setHint('')
    await toDateStep()
  }, [toDateStep])

  const handleOrigin = useCallback(async (text) => {
    if (SKIP_WORDS.some((w) => norm(text).includes(w))) return toDateStep()
    const q = originQuery(text)
    if (q.length < 3) { setHint(t('vbook.didntCatch')); await say(t('vbook.askOrigin')); return }
    // Bias toward the chosen hospital: most patients live near where they book.
    const found = await searchPlaces(q, { limit: 3, lat: destination?.latitude, lng: destination?.longitude })
    if (!found.length) {
      setHint(t('vbook.originNotFound'))
      await say(t('vbook.originNotFound'))
      return
    }
    setOriginMatches(found)
    setStep('originConfirm')
    await say(t('vbook.confirmOrigin', { place: spokenPlace(found[0].label) }))
  }, [destination?.latitude, destination?.longitude, say, t, toDateStep])

  const handleOriginConfirm = useCallback(async (text) => {
    const { value } = await interpretYesNo(text, lang, t('vbook.confirmOrigin', { place: spokenPlace(originMatches[0]?.label) }))
    if (value === 'yes' && originMatches[0]) return applyOrigin(originMatches[0])
    if (value === 'no') {
      setStep('origin')
      await say(t('vbook.askOriginAgain'))
      return
    }
    setHint(t('vbook.didntCatch'))
    await say(t('vbook.confirmOriginRetry'))
  }, [applyOrigin, lang, originMatches, say, t])

  const handleDoctor = useCallback(async (text) => {
    const options = doctorShortlist.map((d) => ({ id: String(d.doctor_id), label: docLabel(d) }))
    const { id } = await interpretChoice(text, lang, options, 'Pick the doctor the patient chose.')
    if (!id) { setHint(t('vbook.didntCatch')); await say(t('vbook.askDoctor')); return }
    await selectDoctor(id)
  }, [doctorShortlist, docLabel, lang, say, selectDoctor, t])

  // After a single named doctor is found: "is this the one?" yes → proceed to
  // date; no → show the other suitable doctors to choose from.
  const showOtherDoctors = useCallback(async () => {
    const rejectedId = doctorShortlist[0]?.doctor_id
    const others = symptomDoctors.filter((d) => d.doctor_id !== rejectedId)
    const list = (others.length ? others : symptomDoctors).slice(0, 12)
    setPreferredDoctors(list)
    setDoctorShortlist(list.length ? list : bookableDoctors.slice(0, 12))
    setStep('doctor')
    await say(t('vbook.askDoctor'))
  }, [doctorShortlist, symptomDoctors, bookableDoctors, say, t])

  const handleConfirmDoctor = useCallback(async (text) => {
    const cand = doctorShortlist[0]
    const { value } = await interpretYesNo(text, lang, t('vbook.confirmDoctor', { doctor: cand?.name || '' }))
    if (value === 'yes' && cand) return selectDoctor(cand.doctor_id)
    if (value === 'no') return showOtherDoctors()
    setHint(t('vbook.didntCatch'))
    await say(t('vbook.confirmDoctorRetry'))
  }, [doctorShortlist, lang, selectDoctor, showOtherDoctors, say, t])

  // The doctor doesn't consult on the day the patient asked for. Gather the two
  // ways out — their next open days, and other suitable doctors who ARE free
  // that day — and ask which the patient wants.
  /** "Sunrise Hospital is about 1 hr 10 min away from you, so you cannot get
   *  there before it closes on Monday" — in the patient's own language. The
   *  server sends this sentence too, but only in English; a Telugu-speaking
   *  patient hearing an English refusal is exactly the problem this flow
   *  exists to solve. */
  const unreachableLine = useCallback((iso, minutes, forDoctorId) => {
    const d = doctorsById[forDoctorId || doctorId]
    const name = translitName(hospitalNameOf(d), lang) || translitName(d?.name, lang) || ''
    if (!name || !minutes) return t('vbook.cantReachShort')
    return t('vbook.cantReach', { hospital: name, d: humanMins(t, minutes), date: prettyDate(iso) })
  }, [hospitalNameOf, doctorId, doctorsById, lang, t])

  const offerAlternatives = useCallback(async (iso, reason, forDoctorId, forAffId, spokenReason) => {
    setPhase('thinking')
    const activeDoctor = forDoctorId || doctorId
    const activeAff = forAffId !== undefined ? forAffId : affiliationId
    const pool = (doctorShortlist.length ? doctorShortlist : preferredDoctors)
      .filter((d) => String(d.doctor_id) !== String(activeDoctor))
      .slice(0, 8)
    const [dates, others] = await Promise.all([
      appointmentsApi
        .nextAvailableDates(activeDoctor, iso, { days: 21, limit: 3, affiliationId: activeAff || undefined })
        .then((r) => r?.dates || []).catch(() => []),
      pool.length
        ? appointmentsApi.dayAvailability(pool.map((d) => d.doctor_id), iso)
          .then((r) => (r?.doctors || []).filter((row) => row.available)).catch(() => [])
        : Promise.resolve([]),
    ])
    const freeDoctors = others
      .map((row) => ({ doctor: doctorsById[row.doctor_id], affiliationId: row.affiliation_id }))
      .filter((row) => row.doctor)
      .slice(0, 4)
    setAlt({ dates, doctors: freeDoctors, reason: reason || '' })
    setHint(reason || '')
    setStep('unavailable')
    // `spokenReason` is for cases where the day is fine but this patient can't
    // use it (too far to reach in time) — saying "the doctor is not available"
    // there would be false, and would push them onto a different doctor when
    // what they need is a different day.
    const spoken = spokenReason
      || t('vbook.notAvailable', { doctor: doctorsById[activeDoctor]?.name || '', date: prettyDate(iso) })
    const follow = dates.length || freeDoctors.length ? t('vbook.askAlternative') : t('vbook.noAlternatives')
    await say(`${spoken} ${follow}`)
  }, [affiliationId, doctorId, doctorShortlist, doctorsById, preferredDoctors, say, t])

  // Token model: no time-slot pick. But the day must still be checked BEFORE the
  // confirm step, because confirming starts the payment — a doctor on leave used
  // to be discovered only by the post-payment booking call, after the fee was
  // taken.
  // `forDoctorId` re-runs the check for a doctor the patient just named, without
  // waiting on the async state update.
  const chooseDate = useCallback(async (iso, forDoctorId, forAffId) => {
    const activeDoctor = forDoctorId || doctorId
    const activeAff = forDoctorId ? forAffId : affiliationId
    setDate(iso)
    if (forDoctorId) {
      setDoctorId(String(forDoctorId))
      setAffiliationId(forAffId ? String(forAffId) : '')
    }
    setPhase('thinking')
    // Sending the origin makes the day check travel-aware: the response gains a
    // `travel.day` verdict saying whether this patient can still reach the
    // hospital before it closes. Without it the impossible trip is only caught by
    // the server at booking time — after the booking fee is taken.
    const origin = (trip.lat != null && trip.lng != null) ? { lat: trip.lat, lng: trip.lng } : originRef.current
    let avail = null
    try {
      avail = await appointmentsApi.availableSlots(activeDoctor, iso, activeAff || undefined, origin || undefined)
    } catch {
      avail = null // lookup failed — carry on; the server re-checks before charging
    }
    if (avail && !avail.available) {
      await offerAlternatives(iso, avail.reason, activeDoctor, activeAff)
      return
    }
    const day = avail?.travel?.day
    if (day && day.reachable === false) {
      await offerAlternatives(iso, t('vbook.cantReachShort'), activeDoctor, activeAff,
        unreachableLine(iso, day.travel_minutes ?? avail?.travel?.minutes, activeDoctor))
      return
    }
    setStep('confirm')
    await say(confirmText(iso, activeDoctor))
  }, [affiliationId, doctorId, confirmText, offerAlternatives, say, t, trip.lat, trip.lng, unreachableLine])

  const handleDate = useCallback(async (text) => {
    const { value } = await interpretDate(text, lang)
    if (!value) { setHint(t('vbook.didntCatch')); await say(t('vbook.askDate')); return }
    await chooseDate(value)
  }, [lang, chooseDate, say, t])

  // Switching to a doctor we just confirmed is free on this date — keep the date
  // and go straight to confirmation instead of asking for the day again.
  const pickAltDoctor = useCallback(async (id) => {
    const row = alt.doctors.find((x) => String(x.doctor.doctor_id) === String(id))
    const fallbackAff = (affiliationsByDoctor[id] || [])[0]?.affiliation_id
    const chosenAff = row?.affiliationId || fallbackAff
    setDoctorId(String(id))
    setAffiliationId(chosenAff ? String(chosenAff) : '')
    setHint('')
    setStep('confirm')
    await say(confirmText(date, id))
  }, [alt.doctors, affiliationsByDoctor, confirmText, date, say])

  // "Search somewhere else". The shortlist that dead-ended was filtered to one
  // town (or to one named doctor), so widen back to every doctor suitable for
  // the symptom before re-asking — otherwise the location question would offer
  // the same town again.
  // The pool to fall back on once the current town/doctor has dead-ended: every
  // doctor suitable for the symptom, across all locations.
  const widenedPool = useMemo(
    () => (symptomDoctors.length ? symptomDoctors : bookableDoctors),
    [bookableDoctors, symptomDoctors],
  )
  const widenedLocations = useMemo(
    () => [...new Set(widenedPool.flatMap(doctorLocations))].sort((a, b) => a.localeCompare(b)),
    [doctorLocations, widenedPool],
  )

  const goToLocationSearch = useCallback(async () => {
    setPreferredDoctors(widenedPool)
    setSelectedLocation('')
    setHint('')
    setStep('location')
    await say(t('vbook.askLocation'))
  }, [say, t, widenedPool])

  // A town named here goes straight to that town's doctors — no need to bounce
  // through the location question just to repeat what they already said.
  const searchInLocation = useCallback(async (city) => {
    setPreferredDoctors(widenedPool)
    await applyLocation(city, widenedPool)
  }, [applyLocation, widenedPool])

  // A doctor named here: if we already know they're free that day, confirm;
  // otherwise re-run the availability check for them on the same date (which may
  // simply land back on this step with their own alternatives).
  const switchDoctor = useCallback(async (id) => {
    const known = alt.doctors.find((x) => String(x.doctor.doctor_id) === String(id))
    if (known) return pickAltDoctor(id)
    setHint('')
    const aff = (affiliationsByDoctor[id] || [])[0]?.affiliation_id || ''
    await chooseDate(date, id, aff)
  }, [affiliationsByDoctor, alt.doctors, chooseDate, date, pickAltDoctor])

  const handleUnavailable = useCallback(async (text) => {
    // The answer set has to cover everything the question invites. It used to
    // hold only the suggested dates and the free doctors, so naming any OTHER
    // doctor — or naming a town at all — fell through to "didn't catch that".
    const suggested = alt.doctors.map((x) => x.doctor)
    const doctorPool = [...suggested, ...widenedPool]
      .filter((d, i, list) => list.findIndex((o) => o.doctor_id === d.doctor_id) === i)
      .slice(0, 14)

    // Resolve names locally first: instant, and it keeps working when the NLU is
    // rate-limited or offline. An ambiguous name falls through to the model.
    const { best, matches } = bestNameMatch(text, doctorPool)
    if (best) return switchDoctor(best.doctor_id)
    if (!matches.length) {
      const city = matchSpokenCity(text, widenedLocations)
      if (city) return searchInLocation(city)
    }

    const options = [
      ...alt.dates.map((d) => ({ id: `date:${d.date}`, label: prettyDate(d.date) })),
      ...doctorPool.map((d) => ({ id: `doc:${d.doctor_id}`, label: docLabel(d) })),
      ...widenedLocations.map((city) => ({ id: `loc:${city}`, label: city })),
      { id: 'otherDay', label: t('vbook.pickAnotherDay') },
      { id: 'otherDoctor', label: t('vbook.pickAnotherDoctor') },
      { id: 'otherLocation', label: t('vbook.pickAnotherLocation') },
    ]
    const { id } = await interpretChoice(text, lang, options,
      'The chosen doctor is not available on the day the patient asked for. The patient may answer with: '
      + 'a DATE (ids starting doc/date above), a DOCTOR NAME — match the closest doc: option even if the '
      + 'spelling differs from speech-to-text — a TOWN or LOCALITY name (the loc: options), or a general '
      + 'request for a different day (otherDay), a different doctor (otherDoctor), or a different '
      + 'place (otherLocation, e.g. "somewhere else", "వేరే ఊరు", "दूसरी जगह").')
    if (!id) { setHint(t('vbook.didntCatch')); await say(t('vbook.askAlternative')); return }
    if (id.startsWith('date:')) return chooseDate(id.slice(5))
    if (id.startsWith('doc:')) return switchDoctor(id.slice(4))
    if (id.startsWith('loc:')) return searchInLocation(id.slice(4))
    setHint('')
    if (id === 'otherDay') { setStep('date'); await say(t('vbook.askDate')); return }
    if (id === 'otherLocation') return goToLocationSearch()
    setStep('doctor')
    await say(t('vbook.askDoctor'))
  }, [alt, chooseDate, docLabel, goToLocationSearch, lang, say, searchInLocation, switchDoctor, t, widenedLocations, widenedPool])

  const doBooking = useCallback(async () => {
    // Guard against missing selections so we never send a malformed booking that
    // the backend rejects with a confusing error.
    if (!patient?.patient_id || !doctorId || !date) {
      setHint(t('vbook.bookFailed'))
      setStep('confirm')
      await say(t('vbook.confirmRetry'))
      return
    }
    setStep('booking')
    setPhase('thinking')
    // Prefer the location the patient set on the card; otherwise the silent GPS grab.
    const origin = (trip.lat != null && trip.lng != null) ? { lat: trip.lat, lng: trip.lng } : originRef.current
    // Real road time — the top of the map's range, same as manual booking — so
    // the leave-by reminder isn't built on a straight-line guess (often half the
    // real trip). roadTravelMinutes falls back to that guess by itself.
    const travelMin = origin ? await roadTravelMinutes(origin, destination) : null
    const resolvedAffiliation = affiliationId || affiliation?.affiliation_id
    const booking = {
      doctor_id: doctorId,
      affiliation_id: resolvedAffiliation || null,
      patient_id: patient.patient_id,
      family_member_id: bookingFor === 'self' ? null : bookingFor,
      appointment_date: date,
      appointment_type: 'online',
      // English only in the database: a Telugu/Hindi complaint becomes English
      // symptom words plus the patient's words in English letters.
      notes: englishSymptomNote(symptom) || 'Booked by voice assistant',
      source: 'app',
      origin_lat: origin?.lat ?? null,
      origin_lng: origin?.lng ?? null,
      // The on-screen label is translated ("నా ప్రస్తుత స్థానం"); what is saved is English.
      origin_label: trip.source === 'gps' ? 'My current location'
        : toEnglishText(trip.label) || (origin ? 'Voice booking location' : ''),
      travel_minutes: travelMin,
    }
    try {
      // Previous booking-fee checkout flow (disabled):
      // const order = await paymentsApi.createOrder(booking)
      // let appt
      // if (order.payment_required) {
      //   const rupees = Math.round((order.amount || 0) / 100) || payCfg.booking_fee
      //   await say(t('vbook.payPrompt', { amount: rupees }))
      //   const ready = await loadRazorpay()
      //   if (!ready) throw new Error(t('vbook.payGatewayFailed'))
      //   appt = await new Promise((resolve, reject) => {
      //     const rzp = new window.Razorpay({
      //       key: order.key_id,
      //       order_id: order.order_id,
      //       amount: order.amount,
      //       currency: order.currency,
      //       name: 'TapCure',
      //       description: t('px.book.consultWith', { name: doctor?.name || t('ppage.doctor') }),
      //       prefill: { name: patient?.name || '', contact: patient?.phone || '', email: realEmail(patient) || '' },
      //       theme: { color: '#2563eb' },
      //       handler: (resp) => {
      //         paymentsApi.confirm({
      //           razorpay_order_id: resp.razorpay_order_id,
      //           razorpay_payment_id: resp.razorpay_payment_id,
      //           razorpay_signature: resp.razorpay_signature,
      //           booking,
      //         }).then(resolve).catch(reject)
      //       },
      //       modal: { ondismiss: () => reject(new Error(t('vbook.payCancelled'))) },
      //     })
      //     rzp.open()
      //   })
      // } else {
      //   await say(t('vbook.booking'))
      //   appt = await appointmentsApi.book(booking)
      // }
      await say(t('vbook.booking'))
      const appt = await appointmentsApi.book(booking)
      let est = null
      try { est = await tokensApi.estimate({ appointment_id: appt.appointment_id }) } catch { /* token may lag */ }
      // WithDay, not bare clockIST: a long journey means setting off the day
      // BEFORE the visit, and a bare "12:39 AM" reads as this morning. This is
      // also SPOKEN aloud below, where the missing day is even easier to miss.
      const leaveBy = est?.leave_by ? clockISTWithDay(est.leave_by) : ''
      const tokenNo = est?.token_number || est?.display_code || ''
      setResult({ tokenNo, leaveBy, doctorName: doctorsById[doctorId]?.name || '' })
      setStep('done')
      await say(leaveBy ? t('vbook.doneSpoken', { token: tokenNo, leave: leaveBy }) : t('vbook.doneTitle'))
    } catch (e) {
      // Surface the real reason (e.g. "Slot already booked", "Payment cancelled").
      console.error('Voice booking failed:', e)
      // 409 = the day stopped being bookable between the check and the booking
      // (leave approved, day filled up). Offer other days / doctors rather than
      // dead-ending on a confirm step the patient can only repeat.
      if (e?.status === 409) {
        // The unreachable-trip refusal is a different story from "the day
        // closed": the doctor is free, the patient just can't get there. Say
        // that, in their language, and steer them to a later day.
        if (e?.detail?.code === 'unreachable_slot') {
          const line = unreachableLine(date, e.detail.travel_minutes)
          setHint(t('vbook.cantReachShort'))
          await offerAlternatives(date, t('vbook.cantReachShort'), undefined, undefined, line)
          return
        }
        setHint(e.message || '')
        await offerAlternatives(date, e.message)
        return
      }
      setHint(e?.message || t('vbook.bookFailed'))
      setStep('confirm')
      await say(e?.message || t('vbook.bookFailed'))
    }
  }, [affiliation, affiliationId, doctorId, patient, date, symptom, destination, doctorsById, bookingFor, hospital, doctor, trip, offerAlternatives, say, t, unreachableLine])

  const handleConfirm = useCallback(async (text) => {
    const { value } = await interpretYesNo(text, lang, confirmText())
    if (value === 'yes') return doBooking()
    if (value === 'no') {
      // Step back to the doctor list to try again.
      setStep('doctor')
      await say(t('vbook.askDoctor'))
      return
    }
    // Unclear — re-ask instead of dead-ending so the user can simply say "yes".
    setHint(t('vbook.didntCatch'))
    await say(t('vbook.confirmRetry'))
  }, [lang, doBooking, confirmText, say, t])

  // ---- Going back ----------------------------------------------------------
  // The flow could only ever move FORWARD: mishear the city at step three and
  // the patient's only escape was to abandon the booking and start again. A few
  // screens had bespoke "back to date / doctor / location" buttons; this makes
  // it general, for every step, by voice as well as by tap.
  const historyRef = useRef([])
  const prevStepRef = useRef(step)
  const goingBackRef = useRef(false)

  useEffect(() => {
    if (prevStepRef.current === step) return
    // A back-navigation must not push the step it just left, or Back would
    // bounce between two screens forever.
    if (goingBackRef.current) goingBackRef.current = false
    else historyRef.current.push(prevStepRef.current)
    prevStepRef.current = step
  }, [step])

  // What to re-ask when we land back on a step.
  const PROMPT_FOR = {
    who: 'vbook.askWho',
    symptom: 'vbook.askSymptom',
    preference: 'vbook.askPreference',
    particular: 'vbook.askParticular',
    location: 'vbook.askLocation',
    doctor: 'vbook.askDoctor',
    origin: 'vbook.askOrigin',
    date: 'vbook.askDate',
  }
  const canGoBack = historyRef.current.length > 0 && !['booking', 'done'].includes(step)

  const goBack = useCallback(async () => {
    const previous = historyRef.current.pop()
    if (!previous) return
    goingBackRef.current = true
    stopSpeaking()
    setHeard('')
    setHint('')
    setStep(previous)
    const key = PROMPT_FOR[previous]
    if (key) await say(t(key))
    // Steps with no fixed prompt (confirm, confirmDoctor, unavailable) keep
    // whatever is on screen — re-reading a stale summary would be worse.
  }, [say, t])

  // ---- corrections (Stage 1) -------------------------------------------------
  // Before a step handles a reply, ask the AI whether the patient is CHANGING
  // something they already answered ("no, her name is Sundari", "make it
  // Wednesday", "actually Dr. Satya"). Only an extra: with no correction, the
  // AI unsure, slow (4s), down or out of quota, the step handles the reply
  // exactly as it did before this existed.
  const correctionOffRef = useRef(false)   // AI out of quota: stop asking this booking

  const bookingCard = useCallback(() => {
    const card = {}
    if (['addPerson', 'addPersonName'].includes(step)) {
      if (pendingPerson.name) card.person_name = pendingPerson.name
      if (pendingPerson.relation) card.relation = pendingPerson.relation
    } else if (step !== 'who') {
      card.who = bookingFor === 'self' ? 'myself'
        : (family.find((m) => String(m.member_id) === String(bookingFor))?.name || 'a family member')
    }
    if (symptom) card.symptom = symptom
    if (selectedLocation) card.location = selectedLocation
    if (doctorId) card.doctor = doctorsById[doctorId]?.name || ''
    if (date) card.date = date
    if (trip.lat != null && trip.source !== 'gps' && trip.label) card.origin = trip.label
    return card
  }, [bookingFor, date, doctorId, doctorsById, family, pendingPerson, selectedLocation, step, symptom, trip])

  const currentQuestion = useCallback(() => {
    if (step === 'addPerson') return addPersonPrompt(pendingPerson)
    if (step === 'confirmDoctor') return t('vbook.confirmDoctor', { doctor: doctorShortlist[0]?.name || '' })
    if (step === 'originConfirm') return t('vbook.confirmOrigin', { place: spokenPlace(originMatches[0]?.label) })
    if (step === 'confirm') return confirmText()
    return PROMPT_FOR[step] ? t(PROMPT_FOR[step]) : ''
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPersonPrompt, confirmText, doctorShortlist, originMatches, pendingPerson, step, t])

  /** Say "okay, changed" and ask the current question again. */
  const ackAndReask = useCallback(async () => {
    const q = currentQuestion()
    await say(q ? `${t('vbook.corrOk')} ${q}` : t('vbook.corrOk'))
  }, [currentQuestion, say, t])

  /** Apply a correction the AI heard. true = handled; false = let the step
   *  handle the reply as usual (value couldn't be verified or doesn't apply). */
  const applyCorrection = useCallback(async ({ field, value }) => {
    if (field === 'person_name') {
      if (!['addPerson', 'addPersonName'].includes(step)) return false
      const person = { ...pendingPerson, name: value }
      setPendingPerson(person)
      setStep('addPerson')
      await say(addPersonPrompt(person))
      return true
    }
    if (field === 'who') {
      const options = [
        { id: 'self', label: t('ppage.myself') },
        ...family.map((m) => ({ id: String(m.member_id), label: `${m.name}${m.relation ? ` (${m.relation})` : ''}` })),
      ]
      const { id } = await interpretChoice(value, lang, options, 'Who the check-up is for: themselves → "self", otherwise the named family member.')
      if (!id) return false     // someone new: the normal "who" handling can add them
      setBookingFor(id)
      await ackAndReask()
      return true
    }
    if (field === 'symptom') {
      if (!doctorId) { await handleSymptom(value); return true }   // doctors not picked yet: re-match
      setSymptom(value)                                            // doctor chosen: just the note
      await ackAndReask()
      return true
    }
    if (field === 'doctor') {
      const { best, matches } = bestNameMatch(value, bookableDoctors)
      const list = best ? [best] : matches
      if (!list.length) return false
      setDoctorShortlist(list.slice(0, 12))
      if (list.length === 1) {
        setStep('confirmDoctor')
        await say(t('vbook.confirmDoctor', { doctor: translitName(list[0].name, lang) }))
      } else {
        setStep('doctor')
        await say(t('vbook.askDoctor'))
      }
      return true
    }
    if (field === 'location') { await applyLocation(value); return true }
    if (field === 'date') {
      if (!doctorId) return false
      const { value: iso } = await interpretDate(value, lang)
      if (!iso) return false
      await chooseDate(iso)
      return true
    }
    if (field === 'origin') { await handleOrigin(value); return true }
    return false
  }, [ackAndReask, addPersonPrompt, applyLocation, bookableDoctors, chooseDate, doctorId, family, handleOrigin, handleSymptom, lang, pendingPerson, say, step, t])

  const tryCorrection = useCallback(async (text) => {
    if (correctionOffRef.current || !cloud) return false
    const card = bookingCard()
    if (!Object.keys(card).length) return false          // nothing answered yet
    const r = await detectCorrection(text, lang, { question: currentQuestion(), card })
    if (r?.quotaOut) { correctionOffRef.current = true; return false }
    if (!r || r.confidence < 0.6 || STEP_ASKS[step] === r.field) return false
    return applyCorrection(r)
  }, [applyCorrection, bookingCard, cloud, currentQuestion, lang, step])

  const dispatch = useCallback(async (text) => {
    if (text == null) return // recording just started (cloud push-to-talk)
    setHeard(text)
    if (!text) { setPhase('idle'); setHint(t('vbook.didntCatch')); return }
    // "Back" is checked BEFORE the per-step handlers: at the doctor step the
    // word would otherwise be matched against doctor names and pick someone.
    if (BACK_WORDS.some((w) => norm(text).includes(w)) && historyRef.current.length) {
      return goBack()
    }
    // A correction to an earlier answer, if the AI hears one; otherwise (or with
    // the AI unavailable) the step below handles the reply as it always has.
    if (await tryCorrection(text)) return
    if (step === 'who') return handleWho(text)
    if (step === 'addPerson') return handleAddPerson(text)
    if (step === 'addPersonName') return handleAddPersonName(text)
    if (step === 'symptom') return handleSymptom(text)
    if (step === 'preference') return handlePreference(text)
    if (step === 'particular') return handleParticular(text)
    if (step === 'confirmDoctor') return handleConfirmDoctor(text)
    if (step === 'location') return handleLocation(text)
    if (step === 'doctor') return handleDoctor(text)
    if (step === 'origin') return handleOrigin(text)
    if (step === 'originConfirm') return handleOriginConfirm(text)
    if (step === 'date') return handleDate(text)
    if (step === 'unavailable') return handleUnavailable(text)
    if (step === 'confirm') return handleConfirm(text)
  }, [step, goBack, tryCorrection, handleWho, handleAddPerson, handleAddPersonName, handleSymptom, handlePreference, handleParticular, handleConfirmDoctor, handleLocation, handleDoctor, handleOrigin, handleOriginConfirm, handleDate, handleUnavailable, handleConfirm, t])

  // Stop the active cloud recording, transcribe it, and advance the flow. Used
  // by both the manual "tap to stop" and the auto-stop safety timer, so the
  // reply is always sent even if the user only taps once.
  const finishCapture = useCallback(async () => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
    const rec = recRef.current
    if (!rec) return
    recRef.current = null
    setPhase('thinking')
    let text = ''
    try { text = await transcribe(await rec.stop(), lang) } catch { text = '' }
    await dispatch(text)
  }, [lang, dispatch])

  // Mic button. Cloud mode: first tap starts recording and it auto-stops after a
  // few seconds (tapping again stops sooner). Browser fallback is one-shot.
  const onMic = useCallback(async () => {
    if (recRef.current) return finishCapture() // already recording → stop now
    stopSpeaking()
    setHint('')
    if (cloud && canRecord()) {
      try {
        recRef.current = await startRecording()
        setPhase('listening')
        // Safety net: stop and transcribe even if the user never taps again.
        autoStopRef.current = setTimeout(() => { finishCapture() }, 7000)
      } catch {
        setHint(t('vbook.micDenied'))
        setPhase('idle')
      }
      return
    }
    // Browser fallback: one-shot recognition that stops on its own.
    setPhase('listening')
    const text = await listenOnce(lang)
    setPhase('thinking')
    await dispatch(text)
  }, [cloud, lang, t, finishCapture, dispatch])

  // Tapping an option is the always-available fallback to speaking.
  const pickWho = (id) => async () => {
    setHeard('')
    if (id === '__add__') { navigate('/patient-dashboard/family?addFamily=1'); return }
    setBookingFor(id); setStep('symptom'); await say(t('vbook.askSymptom'))
  }
  const pickPreference = (id) => async () => {
    setHeard('')
    if (id === 'particular') { setStep('particular'); await say(t('vbook.askParticular')); return }
    setPreferredDoctors(symptomDoctors); setStep('location'); await say(t('vbook.askLocation'))
  }
  const pickLocation = (city) => async () => { setHeard(''); await handleLocation(city) }
  const pickDoctor = (id) => async () => { setHeard(''); await selectDoctor(id) }
  const pickDate = (iso) => async () => { setHeard(''); await chooseDate(iso) }
  const pickAltDate = (iso) => async () => { setHeard(''); await chooseDate(iso) }
  const pickFreeDoctor = (id) => async () => { setHeard(''); await pickAltDoctor(id) }
  const backToDate = async () => { setHeard(''); setHint(''); setStep('date'); await say(t('vbook.askDate')) }
  const backToDoctor = async () => { setHeard(''); setHint(''); setStep('doctor'); await say(t('vbook.askDoctor')) }
  const backToLocation = async () => { setHeard(''); await goToLocationSearch() }
  const confirmDoctorYes = async () => { setHeard(''); const c = doctorShortlist[0]; if (c) await selectDoctor(c.doctor_id) }
  const confirmDoctorNo = async () => { setHeard(''); await showOtherDoctors() }

  const begin = async () => {
    stopSpeaking() // cut any intro narration before the first question
    setStarted(true)
    // Always ask "who is this for?" first — even with no family members yet, so
    // the patient can confirm it's for themselves (or add a dependent from here).
    setStep('who')
    await say(t('vbook.askWho'))
  }

  const restart = () => {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null }
    recRef.current = null
    setStarted(false); setStep('symptom'); setHeard(''); setHint(''); setResult(null)
    setDoctorId(''); setAffiliationId(''); setDate(''); setDoctorShortlist([])
    setSymptomDoctors([]); setPreferredDoctors([]); setSelectedLocation(''); setSymptom('')
    setAlt({ dates: [], doctors: [], reason: '' })
    setOriginMatches([])
  }

  const replay = () => {
    const prompt = {
      who: 'vbook.askWho', symptom: 'vbook.askSymptom', preference: 'vbook.askPreference', particular: 'vbook.askParticular',
      location: 'vbook.askLocation', doctor: 'vbook.askDoctor', origin: 'vbook.askOrigin', date: 'vbook.askDate',
    }[step]
    if (step === 'confirm') {
      say(confirmText())
    } else if (step === 'originConfirm') {
      say(t('vbook.confirmOrigin', { place: spokenPlace(originMatches[0]?.label) }))
    } else if (step === 'confirmDoctor') {
      say(t('vbook.confirmDoctor', { doctor: translitName(doctorShortlist[0]?.name, lang) || '' }))
    } else if (step === 'unavailable') {
      const spoken = t('vbook.notAvailable', { doctor: translitName(doctorsById[doctorId]?.name, lang) || '', date: prettyDate(date) })
      const follow = alt.dates.length || alt.doctors.length ? t('vbook.askAlternative') : t('vbook.noAlternatives')
      say(`${spoken} ${follow}`)
    } else if (prompt) say(t(prompt))
  }

  if (ctxLoading) return <p className="text-sm text-slate-400">{t('pcommon.loading')}</p>

  const listening = phase === 'listening'
  const busy = phase === 'thinking' || step === 'booking'
  // 'unavailable' is a detour off the date question, not a step of its own —
  // counting it would inflate "step N of 9" for everyone.
  // The starting-address question only appears without GPS — also a detour.
  const stepIndex = STEPS.indexOf(['unavailable', 'origin', 'originConfirm'].includes(step) ? 'date' : step)

  return (
    <div className="flex flex-col gap-5">
      <PageHeading title={t('vbook.title')} subtitle={t('vbook.subtitle')}>
        <button
          type="button"
          onClick={() => navigate('/patient-dashboard')}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy hover:border-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> {t('ppage.backToDashboard')}
        </button>
      </PageHeading>

      <Card className="p-6">
        {/* Language + voice-quality badges */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-slate-400" />
            {Object.entries(LANGS).map(([code, { label }]) => (
              <button
                key={code}
                type="button"
                onClick={() => { stopSpeaking(); setLang(code) }}
                className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors ${
                  lang === code ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${
            cloud || cloudTts ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
          }`}>
            <BadgeCheck className="h-3.5 w-3.5" />
            {cloud || cloudTts ? t('vbook.voiceHigh') : t('vbook.voiceOnDevice')}
          </span>
        </div>

        {/* "How to book by voice" steps — always shown on the intro screen so
            the user knows the process, and kept visible during the Telugu flow. */}
        {(!started || (lang === 'te' && step !== 'done')) && (
          <div className="mb-5 rounded-2xl border border-brand-blue/15 bg-brand-blueLight/40 p-4">
            <p className="mb-2 flex items-center gap-2 text-[14px] font-extrabold text-brand-navy">
              <Info className="h-4 w-4 text-brand-blue" /> {t('vbook.guideTitle')}
            </p>
            <ol className="list-decimal space-y-1.5 pl-6 text-[13.5px] leading-relaxed text-slate-600">
              <li>{t('vbook.guideStep1')}</li>
              <li>{t('vbook.guideStep2')}</li>
              <li>{t('vbook.guideStep3')}</li>
              <li>{t('vbook.guideStep4')}</li>
            </ol>
            {lang === 'te' && (
              <button
                type="button"
                onClick={speakGuide}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-blueDark"
              >
                <Volume2 className="h-4 w-4" /> {t('vbook.listenGuide')}
              </button>
            )}
            {/* Cloud voice unavailable (out of credits, offline, or no Telugu
                voice on this device). Show the instructions rather than leaving
                a patient tapping a button that does nothing. */}
            {lang === 'te' && guideSilent && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-left">
                <p className="text-[13.5px] font-bold text-amber-900">{t('vbook.voiceUnavailable')}</p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-amber-800">
                  {t('vbook.guideSpoken')}
                </p>
              </div>
            )}
          </div>
        )}

        {!started ? (
          // ---- Intro / start ----
          <div className="flex flex-col items-center gap-5 py-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
              <Sparkles className="h-10 w-10" />
            </span>
            <div>
              <p className="text-[20px] font-extrabold text-brand-navy">{t('vbook.cardTitle')}</p>
              <p className="mt-1 text-[14px] text-slate-500">{t('vbook.cardSub')}</p>
            </div>

            {/* Starting location — powers the "leave by" travel reminder. GPS by
                default; typed-address fallback when GPS is denied. Tap-based (not
                a voice question), so it stays quick and accurate. */}
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-left">
              <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-brand-navy">
                <MapPin className="h-4 w-4 text-brand-blue" /> {t('vbook.locationTitle')}
              </p>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={trip.geoLoading}
                className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold transition-colors disabled:opacity-60 ${
                  trip.lat != null ? 'border border-green-200 bg-green-50 text-green-700' : 'bg-brand-blue text-white hover:bg-brand-blueDark'
                }`}
              >
                {trip.geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : trip.lat != null ? <CheckCircle2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                {trip.geoLoading ? t('ppage.locating') : trip.lat != null ? t('ppage.locationCaptured') : t('ppage.useCurrentLocation')}
              </button>
              <button type="button" onClick={() => setShowAddr((s) => !s)} className="mt-2 text-[13.5px] font-semibold text-brand-blue hover:underline">
                {showAddr ? t('vbook.hideAddress') : t('vbook.enterAddressInstead')}
              </button>
              {showAddr && (
                <div className="mt-2 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <AddressAutocomplete
                      value={trip.address}
                      onChange={(address) => setTrip((tr) => ({ ...tr, address }))}
                      onSelect={(place) => {
                        if (place.lat == null || place.lng == null) return
                        originRef.current = { lat: place.lat, lng: place.lng }
                        setTrip((tr) => ({
                          ...tr,
                          address: place.label,
                          lat: place.lat,
                          lng: place.lng,
                          label: place.label,
                          geoError: null,
                        }))
                      }}
                      placeholder={t('ppage.yourAddress')}
                      biasLat={trip.lat}
                      biasLng={trip.lng}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-9 text-[13px] outline-none focus:border-brand-blue"
                    />
                  </div>
                  <button type="button" onClick={locateFromAddress} disabled={trip.geoLoading}
                    className="shrink-0 rounded-xl bg-brand-blue px-3 py-2 text-[13px] font-bold text-white hover:bg-brand-blueDark disabled:opacity-60">
                    {t('ppage.find')}
                  </button>
                </div>
              )}
              {trip.label && trip.lat != null && <p className="mt-2 truncate text-[13px] text-slate-500">📍 {trip.label}</p>}
              {trip.geoError && <p className="mt-1 text-[13px] text-amber-600">{trip.geoError}</p>}
            </div>

            <button
              type="button"
              onClick={begin}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand-blue px-8 py-4 text-[16px] font-extrabold text-white shadow-[0_16px_35px_rgba(37,99,235,0.28)] hover:bg-brand-blueDark"
            >
              <Mic className="h-5 w-5" /> {t('vbook.start')}
            </button>
            {!ttsSupported() && (
              <p className="text-[13px] text-amber-600">{t('auth.voiceUnsupported')}</p>
            )}
          </div>
        ) : step === 'done' ? (
          // ---- Success ----
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-12 w-12" />
            </span>
            <p className="text-[22px] font-extrabold text-brand-navy">{t('vbook.doneTitle')}</p>
            <div className="flex flex-wrap items-stretch justify-center gap-3">
              <div className="rounded-2xl border border-green-100 bg-green-50 px-6 py-4">
                <p className="text-[12px] font-bold uppercase tracking-wide text-green-600">{t('vbook.tokenNo')}</p>
                <p className="text-[34px] font-black leading-tight text-green-700">{result?.tokenNo || '—'}</p>
              </div>
              {result?.leaveBy && (
                <div className="rounded-2xl border border-brand-blue/15 bg-brand-blueLight/50 px-6 py-4">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-brand-blue">{t('vbook.leaveBy')}</p>
                  <p className="text-[34px] font-black leading-tight text-brand-navy">{result.leaveBy}</p>
                </div>
              )}
            </div>
            <p className="text-[14px] text-slate-500">{translitName(result?.doctorName, lang)} · {prettyDate(date)}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button onClick={() => navigate('/patient-dashboard/appointments')} className="rounded-xl bg-brand-blue px-5 py-3 text-sm font-bold text-white hover:bg-brand-blueDark">
                {t('vbook.viewAppts')}
              </button>
              <button onClick={restart} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-brand-navy hover:bg-slate-50">
                <RotateCcw className="h-4 w-4" /> {t('vbook.bookAnother')}
              </button>
            </div>
          </div>
        ) : (
          // ---- Active conversation ----
          <div className="flex flex-col gap-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
              {t('vbook.stepOf', { n: stepIndex + 1, total: STEPS.length })}
            </p>

            {/* Assistant prompt */}
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white">
                <Volume2 className="h-4.5 w-4.5" />
              </span>
              <p className="text-[15px] font-semibold leading-relaxed text-brand-navy">{currentPromptText(step, t, { doctorsById: localDoctorsById, doctorId, date, prettyDate, candidateName: translitName(doctorShortlist[0]?.name, lang), alt, pendingPerson, lang, originPlace: spokenPlace(originMatches[0]?.label) })}</p>
            </div>

            {heard && (
              <p className="text-[13px] text-slate-500">
                <span className="font-bold">{t('vbook.youSaid')}:</span> “{heard}”
              </p>
            )}
            {hint && <p className="text-[13px] font-semibold text-amber-600">{hint}</p>}

            {/* Big mic button */}
            <div className="flex flex-col items-center gap-3 py-2">
              <button
                type="button"
                onClick={onMic}
                disabled={busy || phase === 'speaking'}
                className={`relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition-all disabled:opacity-50 ${
                  listening ? 'bg-red-500 animate-pulse' : 'bg-brand-blue hover:bg-brand-blueDark hover:scale-105'
                }`}
              >
                {busy ? <Loader2 className="h-10 w-10 animate-spin" />
                  : listening ? <Square className="h-9 w-9" />
                  : <Mic className="h-10 w-10" />}
                {listening && <span className="absolute -inset-1.5 animate-ping rounded-full border-2 border-red-300" />}
              </button>
              <p className="text-[14px] font-bold text-brand-navy">
                {busy ? t('vbook.thinking')
                  : listening ? (cloud && canRecord() ? t('vbook.tapToStop') : t('vbook.listening'))
                  : t('vbook.tapToSpeak')}
              </p>
              <div className="flex items-center gap-3">
                {/* Tap equivalent of saying "back". Hidden on the first question
                    and once the booking is being made — there is nothing to
                    return to, and a dead control is worse than none. */}
                {canGoBack && (
                  <button type="button" onClick={goBack} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-500 hover:text-brand-navy hover:underline">
                    <ArrowLeft className="h-3.5 w-3.5" /> {t('vbook.back')}
                  </button>
                )}
                <button type="button" onClick={replay} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-blue hover:underline">
                  <Volume2 className="h-3.5 w-3.5" /> {t('vbook.repeat')}
                </button>
              </div>
            </div>

            {/* Tappable options (fallback + accessibility) */}
            <Options
              step={step}
              t={t}
              family={family}
              pickWho={pickWho}
              doctorShortlist={doctorShortlist}
              locations={availableLocations}
              docLabel={docLabelLocal}
              days={nextDays(5, t)}
              alt={alt}
              doctorName={translitName(doctorsById[doctorId]?.name, lang) || ''}
              chosenDate={date}
              pickPreference={pickPreference}
              pickLocation={pickLocation}
              pickDoctor={pickDoctor}
              pickDate={pickDate}
              pickAltDate={pickAltDate}
              pickFreeDoctor={pickFreeDoctor}
              pendingPerson={pendingPerson}
              onAddPersonYes={() => { setHeard(''); createPerson(pendingPerson) }}
              onAddPersonNo={async () => { setHeard(''); setStep('who'); await say(t('vbook.askWho')) }}
              onBackToDate={backToDate}
              onBackToDoctor={backToDoctor}
              onBackToLocation={backToLocation}
              onConfirmDoctorYes={confirmDoctorYes}
              onConfirmDoctorNo={confirmDoctorNo}
              originMatches={originMatches}
              onPickOrigin={async (place) => { setHeard(''); await applyOrigin(place) }}
              onOriginNo={async () => { setHeard(''); setStep('origin'); await say(t('vbook.askOriginAgain')) }}
              onSkipOrigin={async () => { setHeard(''); await toDateStep() }}
              onConfirmYes={doBooking}
              onConfirmNo={async () => { setStep('doctor'); await say(t('vbook.askDoctor')) }}
            />
          </div>
        )}
      </Card>
    </div>
  )
}

// The prompt text shown for the current step (kept out of JSX for clarity).
function currentPromptText(step, t, ctx) {
  if (step === 'who') return t('vbook.askWho')
  if (step === 'symptom') return t('vbook.askSymptom')
  if (step === 'preference') return t('vbook.askPreference')
  if (step === 'particular') return t('vbook.askParticular')
  if (step === 'confirmDoctor') return t('vbook.confirmDoctor', { doctor: ctx.candidateName || '' })
  if (step === 'location') return t('vbook.askLocation')
  if (step === 'doctor') return t('vbook.askDoctor')
  if (step === 'origin') return t('vbook.askOrigin')
  if (step === 'originConfirm') return t('vbook.confirmOrigin', { place: ctx.originPlace || '' })
  if (step === 'date') return t('vbook.askDate')
  if (step === 'unavailable') {
    const head = t('vbook.notAvailable', {
      doctor: ctx.doctorsById[ctx.doctorId]?.name || '',
      date: ctx.prettyDate(ctx.date),
    })
    const has = ctx.alt && (ctx.alt.dates.length || ctx.alt.doctors.length)
    return `${head} ${has ? t('vbook.askAlternative') : t('vbook.noAlternatives')}`
  }
  if (step === 'confirm') {
    const base = t('vbook.confirm', {
      doctor: ctx.doctorsById[ctx.doctorId]?.name || '',
      date: ctx.prettyDate(ctx.date),
    })
    return base
    // Previous fee prompt (disabled):
    // return ctx.feeApplies ? `${base} ${t('vbook.confirmFee', { amount: ctx.bookingFee })}` : base
  }
  if (step === 'booking') return t('vbook.booking')
  if (step === 'addPersonName') {
    const rel = ctx.pendingPerson?.relation
    return rel ? t('vbook.askRelationName', { who: relationWho(rel, ctx.lang) }) : t('vbook.askPersonName')
  }
  if (step === 'addPerson' && ctx.pendingPerson?.name) {
    const { name, relation } = ctx.pendingPerson
    return t('vbook.askAddPerson', { name: relation ? `${name} (${relationLabel(relation, ctx.lang)})` : name })
  }
  return ''
}

function Options({ step, t, pendingPerson, onAddPersonYes, onAddPersonNo, family = [], pickWho, doctorShortlist, locations, docLabel, days, alt = { dates: [], doctors: [] }, doctorName, chosenDate, pickPreference, pickLocation, pickDoctor, pickDate, pickAltDate, pickFreeDoctor, onBackToDate, onBackToDoctor, onBackToLocation, onConfirmDoctorYes, onConfirmDoctorNo, originMatches = [], onPickOrigin, onOriginNo, onSkipOrigin, onConfirmYes, onConfirmNo }) {
  const { lang } = useI18n()   // names shown in the reader's script
  if (step === 'addPerson') {
    return (
      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={onAddPersonYes} className="rounded-xl bg-brand-blue px-5 py-2.5 text-[14px] font-bold text-white hover:bg-brand-blueDark">
          {t('vbook.addYes')}{pendingPerson?.name ? ` — ${translitName(pendingPerson.name, lang)}` : ''}
        </button>
        <button onClick={onAddPersonNo} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-semibold text-brand-navy hover:bg-slate-50">
          {t('vbook.addNo')}
        </button>
      </div>
    )
  }

  const grid = 'grid grid-cols-1 gap-2 sm:grid-cols-2'
  if (step === 'unavailable') {
    return (
      <div className="flex flex-col gap-4">
        {alt.dates.length > 0 && (
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-slate-400">{t('vbook.altDatesTitle', { doctor: doctorName })}</p>
            <div className="flex flex-wrap gap-2">
              {alt.dates.map((d) => (
                <button key={d.date} onClick={pickAltDate(d.date)}
                  className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-[14px] font-bold text-green-700 hover:bg-green-100">
                  <CalendarDays className="h-4 w-4" />{prettyDate(d.date)}
                </button>
              ))}
            </div>
          </div>
        )}
        {alt.doctors.length > 0 && (
          <div>
            <p className="mb-2 text-[13.5px] font-semibold text-slate-400">{t('vbook.altDoctorsTitle', { date: prettyDate(chosenDate) })}</p>
            <div className={grid}>
              {alt.doctors.map(({ doctor: d }) => (
                <button key={d.doctor_id} onClick={pickFreeDoctor(d.doctor_id)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-blue/40 hover:bg-brand-blue/5">
                  <Stethoscope className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-[14px] font-bold text-brand-navy">{docLabel(d)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={onBackToDate} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-semibold text-brand-navy hover:bg-slate-50">
            {t('vbook.pickAnotherDay')}
          </button>
          <button onClick={onBackToDoctor} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-semibold text-brand-navy hover:bg-slate-50">
            {t('vbook.pickAnotherDoctor')}
          </button>
          <button onClick={onBackToLocation} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-semibold text-brand-navy hover:bg-slate-50">
            <MapPin className="h-4 w-4 text-slate-400" /> {t('vbook.pickAnotherLocation')}
          </button>
        </div>
      </div>
    )
  }
  if (step === 'origin') {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-[13.5px] font-semibold text-slate-400">{t('vbook.originHint')}</p>
        <button onClick={onSkipOrigin} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-semibold text-brand-navy hover:bg-slate-50">
          {t('vbook.skipOrigin')}
        </button>
      </div>
    )
  }
  if (step === 'originConfirm' && originMatches.length) {
    // The first match is the one read out; the others are there to tap when
    // the assistant picked the wrong same-named village.
    return (
      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-400">{t('vbook.orTap')}</p>
        <div className="flex flex-col gap-2">
          {originMatches.map((place, i) => (
            <button key={`${place.lat},${place.lng},${i}`} onClick={() => onPickOrigin(place)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-left text-[14px] font-bold text-brand-navy hover:border-brand-blue/40 hover:bg-brand-blue/5 ${i === 0 ? 'border-brand-blue/40 bg-brand-blue/5' : 'border-slate-200 bg-white'}`}>
              <MapPin className="h-4 w-4 shrink-0 text-brand-blue" />{place.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button onClick={onOriginNo} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-semibold text-brand-navy hover:bg-slate-50">
            {t('vbook.sayAgain')}
          </button>
          <button onClick={onSkipOrigin} className="rounded-xl border border-slate-200 px-5 py-2.5 text-[14px] font-semibold text-slate-500 hover:bg-slate-50">
            {t('vbook.skipOrigin')}
          </button>
        </div>
      </div>
    )
  }
  if (step === 'confirmDoctor') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={onConfirmDoctorYes} className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-6 py-3 text-[15px] font-bold text-white hover:opacity-90">
          <CheckCircle2 className="h-5 w-5" /> {t('vbook.yesThisDoctor')}
        </button>
        <button onClick={onConfirmDoctorNo} className="rounded-xl border border-slate-200 px-6 py-3 text-[15px] font-semibold text-brand-navy hover:bg-slate-50">
          {t('vbook.showOthers')}
        </button>
      </div>
    )
  }
  if (step === 'who') {
    return (
      <div>
        <p className='mb-2 text-[13.5px] font-semibold text-slate-400'>{t('vbook.orTap')}</p>
        <div className={grid}>
          <button onClick={pickWho('self')} className='rounded-xl border border-slate-200 bg-white p-3 text-left text-[14px] font-bold text-brand-navy hover:border-brand-blue/40 hover:bg-brand-blue/5'>
            {t('ppage.myself')}
          </button>
          {family.map((m) => (
            <button key={m.member_id} onClick={pickWho(String(m.member_id))} className='rounded-xl border border-slate-200 bg-white p-3 text-left text-[14px] font-bold text-brand-navy hover:border-brand-blue/40 hover:bg-brand-blue/5'>
              {translitName(m.name, lang)}{m.relation ? ` — ${relationLabel(m.relation, lang)}` : ''}
            </button>
          ))}
          <button onClick={pickWho('__add__')} className='rounded-xl border border-dashed border-slate-300 bg-white p-3 text-left text-[14px] font-semibold text-brand-blue hover:bg-brand-blue/5'>
            {t('ppage.addFamilyMember')}
          </button>
        </div>
      </div>
    )
  }
  if (step === 'preference') {
    return (
      <div>
        <p className='mb-2 text-[13.5px] font-semibold text-slate-400'>{t('vbook.orTap')}</p>
        <div className={grid}>
          <button onClick={pickPreference('suitable')} className='rounded-xl border border-slate-200 bg-white p-3 text-left text-[14px] font-bold text-brand-navy'>
            {t('vbook.findSuitable')}
          </button>
          <button onClick={pickPreference('particular')} className='rounded-xl border border-slate-200 bg-white p-3 text-left text-[14px] font-bold text-brand-navy'>
            {t('vbook.particularDoctor')}
          </button>
        </div>
      </div>
    )
  }
  if (step === 'location' && locations.length) {
    return (
      <div>
        <p className='mb-2 text-[13.5px] font-semibold text-slate-400'>{t('vbook.orTap')}</p>
        <div className='flex flex-wrap gap-2'>
          {locations.map((city) => (
            <button key={city} onClick={pickLocation(city)} className='rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-bold text-brand-navy'>
              {city}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (step === 'doctor' && doctorShortlist.length) {
    return (
      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-400">{t('vbook.orTap')}</p>
        <div className={grid}>
          {doctorShortlist.map((d, i) => (
            <button key={d.doctor_id} onClick={pickDoctor(d.doctor_id)}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-blue/40 hover:bg-brand-blue/5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/10 text-[13px] font-black text-brand-blue">{i + 1}</span>
              <span className="flex items-center gap-2 text-[14px] font-bold text-brand-navy"><Stethoscope className="h-4 w-4 text-slate-400" />{docLabel(d)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (step === 'date') {
    return (
      <div>
        <p className="mb-2 text-[13.5px] font-semibold text-slate-400">{t('vbook.orTap')}</p>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button key={d.iso} onClick={pickDate(d.iso)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-bold text-brand-navy hover:border-brand-blue/40 hover:bg-brand-blue/5">
              <CalendarDays className="h-4 w-4 text-slate-400" />{d.label}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (step === 'confirm') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={onConfirmYes} className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-6 py-3 text-[15px] font-bold text-white hover:opacity-90">
          <CheckCircle2 className="h-5 w-5" /> {t('pcommon.confirm')}
        </button>
        <button onClick={onConfirmNo} className="rounded-xl border border-slate-200 px-6 py-3 text-[15px] font-semibold text-brand-navy hover:bg-slate-50">
          {t('pcommon.cancel')}
        </button>
      </div>
    )
  }
  return null
}

export default BookByVoice
