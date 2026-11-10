import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Clock, Loader2, MapPin, Navigation, Search } from 'lucide-react'
import { MapContainer, Marker, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ConsentCheck from '../components/legal/ConsentCheck.jsx'
import Wordmark from '../components/common/Wordmark.jsx'
import { MODERN_FONT } from '../components/landing/ModernChrome.jsx'
import { useI18n } from '../i18n/index.jsx'
import { authApi } from '../api'
import { toMobile } from '../lib/phone.js'
import { geocodeAddress, getCurrentPosition } from '../lib/geo.js'
import { searchPlaces } from '../lib/places.js'
import { validateHospitalRegNo, MAX_REG_NO, REG_NO_PLACEHOLDER } from '../lib/regNumber.js'
import { emailTypoError } from '../lib/emailTypos.js'
import { joinName } from '../lib/personName.js'

/**
 * Hospital registration (/hospital-signup) — the map signup, 2026-11-06.
 *
 * The owner finds the hospital on the map (the app's own place search,
 * lib/places.js via AddressAutocomplete) and its name, address, city, state,
 * pincode and location are filled from the pick. Hospitals that are not on the
 * map type the address instead. Then the owner's details, the registration
 * number, a password and the policies. Nothing else is asked at signup.
 *
 * Logo, photo, services, opening hours, working days and consultation time
 * moved to after approval: the backend takes them as optional (auth.py
 * register_hospital — the logo became optional the same day), the hospital adds
 * them from its dashboard (Profile has the logo upload), and maps show a plain
 * pin until a logo exists. always_open is sent true so the hospital puts no
 * window or week on its doctors until it sets one.
 *
 * Previous design (3 long steps, 20 fields): see git history / the backups.
 * The page's en/te/hi text lives in TX below so no shared file changes.
 */

const TX = {
  forHospitals: { en: 'For hospitals', te: 'ఆసుపత్రుల కోసం', hi: 'अस्पतालों के लिए' },
  pilot: { en: 'Free 30-day pilot', te: '30 రోజుల ఉచిత పైలట్', hi: '30 दिन का मुफ़्त पायलट' },
  h1a: { en: 'Find your hospital.', te: 'మీ ఆసుపత్రిని వెతకండి.', hi: 'अपना अस्पताल खोजें।' },
  h1b: { en: 'We fill in the rest.', te: 'మిగతాది మేమే నింపుతాం.', hi: 'बाकी हम भर देंगे।' },
  lede: {
    en: 'Search your hospital on the map. Name, address and location are filled for you.',
    te: 'మ్యాప్‌లో మీ ఆసుపత్రిని వెతకండి. పేరు, చిరునామా, లొకేషన్ మీ కోసం నింపబడతాయి.',
    hi: 'नक्शे पर अपना अस्पताल खोजें। नाम, पता और लोकेशन अपने-आप भर जाएँगे।',
  },
  searchPh: { en: "Your hospital's name and town", te: 'మీ ఆసుపత్రి పేరు, ఊరు', hi: 'अपने अस्पताल का नाम और शहर' },
  searchHint: {
    en: 'Type at least 3 letters, then pick your hospital from the list.',
    te: 'కనీసం 3 అక్షరాలు టైప్ చేసి, జాబితా నుంచి మీ ఆసుపత్రిని ఎంచుకోండి.',
    hi: 'कम से कम 3 अक्षर लिखें, फिर सूची से अपना अस्पताल चुनें।',
  },
  notOnMap: { en: 'Not on the map?', te: 'మ్యాప్‌లో లేదా?', hi: 'नक्शे पर नहीं है?' },
  enterManual: { en: 'Enter your address instead', te: 'చిరునామాను మీరే నమోదు చేయండి', hi: 'पता खुद लिखें' },
  already: { en: 'Already registered?', te: 'ఇప్పటికే రిజిస్టర్ అయ్యారా?', hi: 'पहले से रजिस्टर हैं?' },
  hospLogin: { en: 'Hospital login', te: 'హాస్పిటల్ లాగిన్', hi: 'अस्पताल लॉगिन' },
  backHome: { en: 'Back to home', te: 'హోమ్‌కు వెళ్లండి', hi: 'होम पर जाएँ' },
  tabTitle: { en: 'Register your hospital', te: 'మీ ఆసుపత్రిని రిజిస్టర్ చేయండి', hi: 'अपना अस्पताल रजिस्टर करें' },
  appearsHere: { en: 'Your hospital will appear here', te: 'మీ ఆసుపత్రి ఇక్కడ కనిపిస్తుంది', hi: 'आपका अस्पताल यहाँ दिखेगा' },
  nearMe: { en: 'Search near my location', te: 'నా లొకేషన్ దగ్గర వెతకండి', hi: 'मेरी लोकेशन के पास खोजें' },
  nearAsking: { en: 'Finding your location…', te: 'మీ లొకేషన్ కనుగొంటోంది…', hi: 'आपकी लोकेशन ढूँढ रहे हैं…' },
  nearOn: { en: 'Showing hospitals near you', te: 'మీ దగ్గరి ఆసుపత్రులు చూపిస్తోంది', hi: 'आपके पास के अस्पताल दिख रहे हैं' },
  nearDenied: {
    en: "Location wasn't allowed. Add your area to the search instead.",
    te: 'లొకేషన్ అనుమతి ఇవ్వలేదు. బదులుగా మీ ప్రాంతం పేరు కూడా టైప్ చేయండి.',
    hi: 'लोकेशन की अनुमति नहीं मिली। खोज में अपने इलाके का नाम भी लिखें।',
  },
  dontSee: { en: "Don't see your hospital?", te: 'మీ ఆసుపత్రి కనిపించలేదా?', hi: 'आपका अस्पताल नहीं दिखा?' },
  noMatch: { en: 'We couldn\'t find "{q}" on the map.', te: '"{q}" మ్యాప్‌లో దొరకలేదు.', hi: '"{q}" नक्शे पर नहीं मिला।' },
  geoLooking: { en: 'Finding this address on the map…', te: 'ఈ చిరునామాను మ్యాప్‌లో వెతుకుతోంది…', hi: 'यह पता नक्शे पर ढूँढ रहे हैं…' },
  geoFound: { en: 'Shown on the map. Is the pin in the right place?', te: 'మ్యాప్‌లో చూపించాం. పిన్ సరైన చోట ఉందా?', hi: 'नक्शे पर दिखा दिया। क्या पिन सही जगह है?' },
  geoApprox: {
    en: "We couldn't find the exact address, so the pin is on your area or city.",
    te: 'ఖచ్చితమైన చిరునామా దొరకలేదు, కాబట్టి పిన్ మీ ప్రాంతం లేదా నగరంపై ఉంది.',
    hi: 'सटीक पता नहीं मिला, इसलिए पिन आपके इलाके या शहर पर है।',
  },
  geoNone: {
    en: "We couldn't find this address on the map. You can still continue.",
    te: 'ఈ చిరునామా మ్యాప్‌లో దొరకలేదు. అయినా మీరు కొనసాగవచ్చు.',
    hi: 'यह पता नक्शे पर नहीं मिला। फिर भी आप आगे बढ़ सकते हैं।',
  },
  geoFix: {
    en: 'You can fix the exact spot later from your hospital profile.',
    te: 'ఖచ్చితమైన చోటును తర్వాత మీ ఆసుపత్రి ప్రొఫైల్‌లో సరిచేయవచ్చు.',
    hi: 'सटीक जगह बाद में अपने अस्पताल प्रोफ़ाइल से ठीक कर सकते हैं।',
  },

  isThis: { en: 'Is this your hospital?', te: 'ఇది మీ ఆసుపత్రేనా?', hi: 'क्या यह आपका अस्पताल है?' },
  address: { en: 'Address', te: 'చిరునామా', hi: 'पता' },  city: { en: 'City', te: 'నగరం', hi: 'शहर' },
  location: { en: 'Location', te: 'లొకేషన్', hi: 'लोकेशन' },
  filled: { en: 'Filled from the map. You can edit anything.', te: 'మ్యాప్ నుంచి నింపబడింది. ఏదైనా మార్చవచ్చు.', hi: 'नक्शे से भरा गया। आप कुछ भी बदल सकते हैं।' },
  yes: { en: 'Yes, this is my hospital', te: 'అవును, ఇది నా ఆసుపత్రి', hi: 'हाँ, यह मेरा अस्पताल है' },
  edit: { en: 'Edit details', te: 'వివరాలు మార్చండి', hi: 'जानकारी बदलें' },
  searchAgain: { en: 'Search again', te: 'మళ్లీ వెతకండి', hi: 'फिर से खोजें' },

  whereT: { en: 'Where is your hospital?', te: 'మీ ఆసుపత్రి ఎక్కడ ఉంది?', hi: 'आपका अस्पताल कहाँ है?' },
  whereS: { en: 'Check the details or type them yourself.', te: 'వివరాలు సరిచూడండి లేదా మీరే టైప్ చేయండి.', hi: 'जानकारी जाँचें या खुद लिखें।' },
  name: { en: 'Hospital Name', te: 'ఆసుపత్రి పేరు', hi: 'अस्पताल का नाम' },
  fullAddress: { en: 'Full Address', te: 'పూర్తి చిరునామా', hi: 'पूरा पता' },
  area: { en: 'Area / Locality', te: 'ప్రాంతం / లొకాలిటీ', hi: 'इलाका / मोहल्ला' },
  state: { en: 'State', te: 'రాష్ట్రం', hi: 'राज्य' },
  chooseState: { en: 'Select State', te: 'రాష్ట్రం ఎంచుకోండి', hi: 'राज्य चुनें' },
  pincode: { en: 'Pincode', te: 'పిన్‌కోడ్', hi: 'पिनकोड' },
  pinBad: { en: 'Enter a valid 6-digit pincode', te: 'సరైన 6 అంకెల పిన్‌కోడ్ నమోదు చేయండి', hi: 'सही 6 अंकों का पिनकोड लिखें' },
  optional: { en: '(Optional)', te: '(ఐచ్ఛికం)', hi: '(वैकल्पिक)' },
  back: { en: 'Back', te: 'వెనక్కి', hi: 'पीछे' },
  continue: { en: 'Continue', te: 'కొనసాగించండి', hi: 'आगे बढ़ें' },

  ownerT: { en: 'Who runs the hospital?', te: 'ఆసుపత్రిని ఎవరు నడుపుతున్నారు?', hi: 'अस्पताल कौन चलाता है?' },
  change: { en: 'Change', te: 'మార్చండి', hi: 'बदलें' },
  first: { en: 'First Name', te: 'మొదటి పేరు', hi: 'पहला नाम' },
  last: { en: 'Last Name', te: 'ఇంటి పేరు', hi: 'उपनाम' },
  mobile: { en: 'Mobile Number', te: 'మొబైల్ నంబర్', hi: 'मोबाइल नंबर' },
  email: { en: 'Email Address', te: 'ఈమెయిల్', hi: 'ईमेल' },
  emailHelp: { en: "You'll sign in with this email.", te: 'ఈ ఈమెయిల్‌తో మీరు లాగిన్ అవుతారు.', hi: 'आप इसी ईमेल से लॉग इन करेंगे।' },

  emailTaken: { en: 'This email is already registered.', te: 'ఈ ఇమెయిల్ ఇప్పటికే రిజిస్టర్ అయింది.', hi: 'यह ईमेल पहले से रजिस्टर है।' },
  phoneTaken: { en: 'This mobile number is already registered.', te: 'ఈ మొబైల్ నంబర్ ఇప్పటికే రిజిస్టర్ అయింది.', hi: 'यह मोबाइल नंबर पहले से रजिस्टर है।' },
  loginInstead: { en: 'Log in instead', te: 'లాగిన్ అవ్వండి', hi: 'लॉग इन करें' },
  orDifferent: { en: 'or use a different one.', te: 'లేదా వేరేది ఉపయోగించండి.', hi: 'या दूसरा इस्तेमाल करें।' },
  dragHint: { en: 'Drag the pin to your main entrance', te: 'పిన్‌ను మీ ప్రధాన ద్వారం వద్దకు లాగండి', hi: 'पिन को अपने मुख्य गेट तक खींचें' },
  dragDone: { en: 'Pin moved. Patients will be guided here.', te: 'పిన్ మార్చబడింది. రోగులకు ఇక్కడికే దారి చూపిస్తాం.', hi: 'पिन बदल गया। मरीज़ों को यहीं का रास्ता दिखेगा।' },
  stepOf: { en: 'Step {n} Of 3', te: 'దశ {n} / 3', hi: 'चरण {n} / 3' },
  verifyT: { en: 'Verify and secure', te: 'నిర్ధారించి, సురక్షితం చేయండి', hi: 'पुष्टि करें और सुरक्षित करें' },
  verifyS: {
    en: 'Our team checks the registration number before you go live.',
    te: 'మీరు లైవ్‌కి వెళ్లే ముందు మా బృందం రిజిస్ట్రేషన్ నంబర్‌ను పరిశీలిస్తుంది.',
    hi: 'लाइव होने से पहले हमारी टीम रजिस्ट्रेशन नंबर जाँचती है।',
  },
  reg: { en: 'Hospital Registration Number', te: 'ఆసుపత్రి రిజిస్ట్రేషన్ నంబర్', hi: 'अस्पताल का रजिस्ट्रेशन नंबर' },
  password: { en: 'Create Password', te: 'పాస్‌వర్డ్ సృష్టించండి', hi: 'पासवर्ड बनाएँ' },
  pwPh: { en: 'At least 6 characters', te: 'కనీసం 6 అక్షరాలు', hi: 'कम से कम 6 अक्षर' },
  show: { en: 'Show', te: 'చూపించు', hi: 'दिखाएँ' },
  hide: { en: 'Hide', te: 'దాచు', hi: 'छिपाएँ' },
  register: { en: 'Register my hospital', te: 'నా ఆసుపత్రిని రిజిస్టర్ చేయండి', hi: 'मेरा अस्पताल रजिस्टर करें' },
  registering: { en: 'Registering…', te: 'రిజిస్టర్ అవుతోంది…', hi: 'रजिस्टर हो रहा है…' },

  registered: { en: 'Registered', te: 'రిజిస్టర్ అయింది', hi: 'रजिस्टर हो गया' },
  awaiting: { en: 'Awaiting approval', te: 'ఆమోదం కోసం వేచి ఉంది', hi: 'मंज़ूरी का इंतज़ार' },
  doneT: { en: '{name} is registered with TapCure.', te: '{name} TapCure లో రిజిస్టర్ అయింది.', hi: '{name} TapCure पर रजिस्टर हो गया।' },
  token: { en: 'Registration token', te: 'రిజిస్ట్రేషన్ టోకెన్', hi: 'रजिस्ट्रेशन टोकन' },
  n1: { en: 'We check your registration number', te: 'మేము మీ రిజిస్ట్రేషన్ నంబర్‌ను పరిశీలిస్తాము', hi: 'हम आपका रजिस्ट्रेशन नंबर जाँचते हैं' },
  n1b: { en: 'Our team reviews it first.', te: 'మా బృందం ముందుగా దీన్ని పరిశీలిస్తుంది.', hi: 'हमारी टीम पहले इसे देखती है।' },
  n2: { en: "We email you when it's approved", te: 'ఆమోదం రాగానే మీకు ఈమెయిల్ చేస్తాము', hi: 'मंज़ूरी मिलते ही हम ईमेल करेंगे' },
  n2b: { en: 'At {email}. You can log in after that.', te: '{email} కి. ఆ తర్వాత లాగిన్ చేయవచ్చు.', hi: '{email} पर। उसके बाद लॉग इन कर सकते हैं।' },
  n3: { en: 'Finish setup and go live', te: 'సెటప్ పూర్తి చేసి లైవ్‌కి వెళ్లండి', hi: 'सेटअप पूरा करें और लाइव हों' },
  n3b: {
    en: 'Add your logo, doctors, services and hours in the dashboard.',
    te: 'డాష్‌బోర్డ్‌లో మీ లోగో, డాక్టర్లు, సేవలు, సమయాలు జోడించండి.',
    hi: 'डैशबोर्ड में अपना लोगो, डॉक्टर, सेवाएँ और समय जोड़ें।',
  },
  goLogin: { en: 'Go to hospital login', te: 'హాస్పిటల్ లాగిన్‌కు వెళ్లండి', hi: 'अस्पताल लॉगिन पर जाएँ' },

  required: { en: 'Required', te: 'తప్పనిసరి', hi: 'ज़रूरी है' },
  mobileBad: { en: 'Enter a valid 10-digit number', te: 'సరైన 10 అంకెల నంబర్ నమోదు చేయండి', hi: 'सही 10 अंकों का नंबर लिखें' },
  emailMax: { en: 'Max {n} characters', te: 'గరిష్ఠంగా {n} అక్షరాలు', hi: 'अधिकतम {n} अक्षर' },
  emailBad: { en: 'Enter a valid email address', te: 'సరైన ఈమెయిల్ చిరునామా నమోదు చేయండి', hi: 'सही ईमेल पता लिखें' },
  pwMin: { en: 'Use at least {n} characters', te: 'కనీసం {n} అక్షరాలు వాడండి', hi: 'कम से कम {n} अक्षर रखें' },
  terms: { en: 'Please accept the Terms, Privacy and Refund policies.', te: 'దయచేసి నిబంధనలు, గోప్యత, రీఫండ్ విధానాలను అంగీకరించండి.', hi: 'कृपया नियम, गोपनीयता और रिफ़ंड नीतियाँ स्वीकार करें।' },
  regFail: { en: 'Registration failed. Please try again.', te: 'రిజిస్ట్రేషన్ విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.', hi: 'रजिस्ट्रेशन नहीं हो सका। कृपया फिर से कोशिश करें।' },
}

/** This page's translator: same rules as i18n's t(), reading TX instead. */
function useTx() {
  const { lang } = useI18n()
  return useCallback((key, vars) => {
    const entry = TX[key]
    let str = (entry && (entry[lang] ?? entry.en)) ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v)
    return str
  }, [lang])
}

// users.email is String(100); password min 6 (schemas/security.py).
const MAX_EMAIL = 100
const MIN_PASSWORD = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Tell the browser what each box is. Without it Edge took the registration
// number for a driving licence and offered to save it.
const AUTOCOMPLETE = {
  name: 'organization', address: 'street-address', area: 'address-level3', city: 'address-level2',
  state: 'address-level1', pincode: 'postal-code', first: 'given-name', last: 'family-name', mobile: 'tel-national', email: 'email', password: 'new-password', reg: 'off',
}

const EMPTY = {
  name: '', address: '', area: '', city: '', state: '', pincode: '', latitude: null, longitude: null,
  first: '', last: '', mobile: '', email: '', reg: '', password: '',
}

// States and union territories, for the State dropdown (GST needs the state;
// a list avoids spellings like "Telengana").
const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal',
]
const PINCODE_RE = /^[1-9]\d{5}$/
const squash = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '')
const STATE_ALIASES = { orissa: 'Odisha', pondicherry: 'Puducherry', nctofdelhi: 'Delhi', newdelhi: 'Delhi', uttaranchal: 'Uttarakhand' }
/** A map's state name → the dropdown's spelling ("Orissa" → "Odisha"). Unknown names are kept as they are. */
function toState(s) {
  const k = squash(s)
  if (!k) return ''
  return STATES.find((x) => squash(x) === k) || STATE_ALIASES[k] || String(s).trim()
}
const toPincode = (s) => String(s || '').replace(/\D/g, '').slice(0, 6)

/** Name, area, city… out of a place-search pick. The label starts with the
 *  place's own name (lib/places.js builds it name-first). */
function fromPlace(p) {
  const parts = String(p.label || '').split(',').map((s) => s.trim()).filter(Boolean)
  const skip = new Set([p.city, p.state, p.pincode, p.country, 'India'].filter(Boolean).map((s) => s.toLowerCase()))
  const area = parts.slice(1).find((s) => !skip.has(s.toLowerCase()) && !/^\d{6}$/.test(s)) || ''
  return {
    name: parts[0] || '',
    address: p.label || '',
    area,
    city: p.city || '',
    state: p.state || '',
    pincode: p.pincode || '',
    latitude: Number.isFinite(Number(p.lat)) ? Number(p.lat) : null,
    longitude: Number.isFinite(Number(p.lng)) ? Number(p.lng) : null,
  }
}

/* ── hospital search ──────────────────────────────────────────────────────
   The app's address search (lib/places.js) is tuned for addresses and mixes
   in shops and streets, and Mapbox finds nothing when the area is part of the
   text ("Lifecare hospital Bandlaguda" → 0; "Lifecare" near Hyderabad → 10,
   tested 2026-11-06). So signup asks Mapbox for places directly: near the
   owner when they allow location, retrying with the area split off and used
   as the "near" point, health places first, up to 10. The app's usual
   search (Mapbox + OpenStreetMap) is the last resort. Same public token. */
const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN || '').trim()
const MAPBOX_URL = 'https://api.mapbox.com/search/searchbox/v1/forward'
const HEALTH = /hospital|clinic|health|medical|doctor|nursing|maternity|dental|diagnostic|physio|eye care|surgeon/i

function toPlace(feature) {
  const [lng, lat] = feature.geometry?.coordinates || []
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const p = feature.properties || {}
  const c = p.context || {}
  const street = c.street?.name && !/^unnamed road$/i.test(c.street.name) ? c.street.name : ''
  const area = c.neighborhood?.name || c.locality?.name || ''
  const city = c.place?.name || c.district?.name || ''
  const cats = p.poi_category || []
  return {
    name: p.name || '',
    address: p.full_address || [p.name, street, area, city, c.region?.name, c.postcode?.name].filter(Boolean).join(', '),
    area, city,
    state: c.region?.name || '',
    pincode: c.postcode?.name || '',
    latitude: lat, longitude: lng,
    health: cats.some((x) => HEALTH.test(x)) || HEALTH.test(p.name || ''),
    kind: cats.find((x) => HEALTH.test(x)) || '',
  }
}

async function mapboxSearch(q, { near, types = 'poi', limit = 10, signal } = {}) {
  if (!MAPBOX_TOKEN || q.trim().length < 2) return []
  const params = new URLSearchParams({ q, country: 'in', language: 'en', limit: String(limit), types, access_token: MAPBOX_TOKEN })
  if (near) params.set('proximity', `${near.longitude ?? near.lng},${near.latitude ?? near.lat}`)
  try {
    const res = await fetch(`${MAPBOX_URL}?${params.toString()}`, { signal })
    if (!res.ok) return []
    const data = await res.json()
    return (data.features || []).map(toPlace).filter(Boolean)
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return []
  }
}

async function findHospitals(text, near, signal) {
  const q = text.trim()
  let found = await mapboxSearch(q, { near, signal })
  if (!found.some((p) => p.health)) {
    // Split the last word or two off as the area, find that area, and search
    // the rest near it: "Lifecare hospital | Bandlaguda".
    const words = q.replace(/,/g, ' ').split(/\s+/).filter(Boolean)
    for (const k of [1, 2]) {
      const name = words.slice(0, -k).join(' ')
      if (words.length <= k || name.length < 3) break
      const [spot] = await mapboxSearch(words.slice(-k).join(' '), { near, types: 'neighborhood,locality,place,district', limit: 1, signal })
      if (!spot) continue
      const hits = await mapboxSearch(name, { near: spot, signal })
      if (hits.some((p) => p.health)) { found = hits; break }
    }
  }
  if (!found.length) {
    const other = await searchPlaces(q, { lat: near?.lat, lng: near?.lng, signal })
    found = other.filter((p) => p.lat != null).map((p) => ({ ...fromPlace(p), health: HEALTH.test(p.label || ''), kind: '' }))
  }
  return [...found.filter((p) => p.health), ...found.filter((p) => !p.health)].slice(0, 10)
}

const PAGE_STYLE = {
  fontFamily: MODERN_FONT,
  // TapCure teal + navy for anything that reads the shared brand variables.
  '--brand-blue': '10 154 150',
  '--brand-blueDark': '11 140 136',
  '--brand-blueLight': '231 246 245',
  '--brand-navy': '11 33 80',
}

/* ── The live map on the right. Built here (not the shared HospitalMap) so it can
   show search results, fly between places and let the owner drag the pin,
   without changing any other page's map. ── */
const INDIA = [22.6, 79.0]
const INDIA_ZOOM = 5

function pinIcon(size, color, pulse = false) {
  const h = Math.round(size * 1.4)
  return L.divIcon({
    className: 'hs-pin',
    html: `${pulse ? '<span class="hs-pulse"></span>' : ''}<svg width="${size}" height="${h}" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 22 12 22s12-13.6 12-22C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4.6" fill="#ffffff"/></svg>`,
    iconSize: [size, h],
    iconAnchor: [size / 2, h],
    tooltipAnchor: [0, -h],
  })
}
const PIN_MAIN = pinIcon(38, '#0A9A96', true)
const PIN_RESULT = pinIcon(24, '#4FBDB9')
const PIN_HOT = pinIcon(34, '#0B2150')

/** Moves the view: to the hospital pin, else around the search results, else
 *  to the owner's location, else all of India. Skips the move after a drag. */
function Camera({ pin, results, near, skipFly }) {
  const map = useMap()
  const pinKey = pin ? pin.join(',') : ''
  const resKey = results.map((r) => `${r.latitude},${r.longitude}`).join('|')
  const nearKey = near ? `${near.lat},${near.lng}` : ''
  useEffect(() => {
    if (skipFly.current) { skipFly.current = false; return }
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const opts = { animate: !still, duration: 1.3 }
    if (pin) map.flyTo(pin, 16, opts)
    else if (results.length > 1) map.flyToBounds(results.map((r) => [r.latitude, r.longitude]), { ...opts, padding: [70, 70], maxZoom: 15 })
    else if (results.length === 1) map.flyTo([results[0].latitude, results[0].longitude], 15, opts)
    else if (near) map.flyTo([near.lat, near.lng], 13, opts)
    else map.flyTo(INDIA, INDIA_ZOOM, opts)
  }, [map, pinKey, resKey, nearKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function LiveMap({ pin, label, results, hot, near, draggable, skipFly, onMove, onPickResult, onHot }) {
  return (
    <MapContainer center={INDIA} zoom={INDIA_ZOOM} zoomControl={false} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomControl position="bottomright" />
      <Camera pin={pin} results={results} near={near} skipFly={skipFly} />
      {results.map((r, i) => (
        <Marker
          key={`${r.latitude},${r.longitude},${i}`}
          position={[r.latitude, r.longitude]}
          icon={r === hot ? PIN_HOT : PIN_RESULT}
          zIndexOffset={r === hot ? 1000 : 0}
          eventHandlers={{ click: () => onPickResult(r), mouseover: () => onHot(r), mouseout: () => onHot(null) }}
        >
          {r === hot && <Tooltip permanent direction="top" className="hs-tip">{r.name || r.address}</Tooltip>}
        </Marker>
      ))}
      {pin && (
        <Marker
          position={pin}
          icon={PIN_MAIN}
          draggable={draggable}
          zIndexOffset={2000}
          eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onMove(p.lat, p.lng) } }}
        >
          <Tooltip permanent direction="top" className="hs-tip">{label}</Tooltip>
        </Marker>
      )}
    </MapContainer>
  )
}

/** A booking-bar style field: small label inside the box, help or error below. */
function Field({ k, label, value, onChange, error, type = 'text', placeholder, prefix, mode, maxLength, extra, optionalText, help }) {
  const id = `hs-${k}`
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className={`relative block rounded-2xl border bg-white px-4 pb-2.5 pt-3 transition-shadow focus-within:border-[#0A9A96]/60 focus-within:shadow-[0_0_0_4px_rgba(0,201,197,.14)] ${error ? 'border-[#E14356]/70' : 'border-[#0F2742]/15'}`}
      >
        <span className="block text-[13px] font-medium text-[#6B7A8F]">
          {label}{optionalText && <span className="text-[#93A3B8]"> {optionalText}</span>}
        </span>
        {prefix && <span className="absolute bottom-2.5 left-4 text-[16px] font-medium text-[#6B7A8F]">{prefix}</span>}
        <input
          id={id}
          name={k === 'reg' ? 'tc-hospital-reg-no' : k}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          inputMode={mode}
          maxLength={maxLength}
          autoComplete={AUTOCOMPLETE[k] || 'off'}
          data-lpignore={k === 'reg' ? 'true' : undefined}
          className={`w-full bg-transparent pt-1 text-[16px] font-medium text-[#0B2150] outline-none placeholder:font-normal placeholder:text-[#93A3B8] ${prefix ? 'pl-9' : ''} ${extra ? 'pr-14' : ''}`}
        />
        {extra}
      </label>
      {error
        ? <p className="mt-1.5 px-1 text-[13px] font-medium text-[#E14356]">{error}</p>
        : help && <p className="mt-1.5 px-1 text-[13px] text-[#6B7A8F]">{help}</p>}
    </div>
  )
}

/** The State dropdown, drawn like Field. A map name not in the list stays selectable. */
function StateField({ label, placeholder, value, onChange, error }) {
  const options = value && !STATES.includes(value) ? [value, ...STATES] : STATES
  return (
    <div className="min-w-0">
      <label
        htmlFor="hs-state"
        className={`relative block rounded-2xl border bg-white px-4 pb-2.5 pt-3 transition-shadow focus-within:border-[#0A9A96]/60 focus-within:shadow-[0_0_0_4px_rgba(0,201,197,.14)] ${error ? 'border-[#E14356]/70' : 'border-[#0F2742]/15'}`}
      >
        <span className="block text-[13px] font-medium text-[#6B7A8F]">{label}</span>
        <select
          id="hs-state" name="state" value={value} onChange={onChange} autoComplete={AUTOCOMPLETE.state}
          className={`w-full cursor-pointer appearance-none bg-transparent pr-7 pt-1 text-[16px] font-medium outline-none ${value ? 'text-[#0B2150]' : 'text-[#93A3B8]'}`}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((s) => <option key={s} value={s} className="text-[#0B2150]">{s}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute bottom-3 right-3.5 h-4 w-4 text-[#6B7A8F]" />
      </label>
      {error && <p className="mt-1.5 px-1 text-[13px] font-medium text-[#E14356]">{error}</p>}
    </div>
  )
}

const btnMain ='hs-btn inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#16BEBA] to-[#0A9A96] px-6 text-[15px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(0,201,197,.65),inset_0_1px_0_rgba(255,255,255,.5)] transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0'
const btnGhost = 'hs-btn inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-[#0F2742]/15 bg-white/80 px-5 text-[15px] font-semibold text-[#0B2150] transition-colors hover:bg-white'
const link = 'font-semibold text-[#0A9A96] underline-offset-[3px] hover:text-[#0B8C88] hover:underline'

function Bars({ n, label }) {
  return (
    <div className="mb-4">
      {label && <span className="mb-2.5 block text-[13.5px] font-semibold text-[#0A9A96]">{label}</span>}
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <i key={i} className={`h-1 flex-1 rounded ${i <= n ? 'bg-gradient-to-r from-[#00C9C5] to-[#2F58B7]' : 'bg-[#0F2742]/10'}`} />
        ))}
      </div>
    </div>
  )
}

function PinMark() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#16C7C2] to-[#0A9A96] text-white">
      <MapPin className="h-4 w-4" />
    </span>
  )
}

/** Search box + results for step one. Picks go to onPick; onManual opens the
 *  type-the-address step. */
function HospitalSearch({ tx, onPick, onManual, hot, onHot, onResults, onNear }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState(null)       // null = nothing searched yet
  const [loading, setLoading] = useState(false)
  const [near, setNear] = useState(null)
  const [nearState, setNearState] = useState('idle') // idle | asking | on | denied

  // The map shows the same results as pins.
  useEffect(() => {
    onResults((list || []).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)))
    onHot(null)
  }, [list]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onNear(near) }, [near]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const text = q.trim()
    if (text.length < 3) { setList(null); setLoading(false); return undefined }
    setLoading(true)
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      try {
        const found = await findHospitals(text, near, ctrl.signal)
        if (!ctrl.signal.aborted) { setList(found); setLoading(false) }
      } catch { /* a newer keystroke took over */ }
    }, 350)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [q, near])

  const useMyLocation = async () => {
    setNearState('asking')
    try { setNear(await getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 })); setNearState('on') }
    catch { setNearState('denied') }
  }

  return (
    <>
      <div className="hs-search relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7A8F]" />
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('searchPh')}
          aria-label={tx('searchPh')} autoComplete="off" name="tc-hospital-search"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#0A9A96]" />}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {nearState === 'on' ? (
          <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#0B8C88]"><Navigation className="h-3.5 w-3.5" /> {tx('nearOn')}</span>
        ) : nearState === 'denied' ? (
          <span className="hs-note text-[13.5px] text-[#6B7A8F]">{tx('nearDenied')}</span>
        ) : (
          <button type="button" onClick={useMyLocation} disabled={nearState === 'asking'}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0F2742]/15 bg-white/80 px-3 py-1.5 text-[13.5px] font-semibold text-[#41526E] hover:border-[#0A9A96]/50 hover:text-[#0A9A96] disabled:opacity-60">
            <Navigation className="h-3.5 w-3.5" /> {nearState === 'asking' ? tx('nearAsking') : tx('nearMe')}
          </button>
        )}
      </div>

      {list === null && <p className="hs-note mt-2.5 text-[13.5px] text-[#6B7A8F]">{tx('searchHint')}</p>}

      {list && list.length > 0 && (
        <ul className="mt-3 grid max-h-[300px] gap-0.5 overflow-auto rounded-2xl border border-[#0F2742]/10 bg-white/90 p-1.5">
          {list.map((p, i) => (
            <li key={`${p.latitude},${p.longitude},${i}`}>
              <button
                type="button" onClick={() => onPick(p)}
                onMouseEnter={() => onHot(p)} onMouseLeave={() => onHot(null)} onFocus={() => onHot(p)} onBlur={() => onHot(null)}
                className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[#00C9C5]/10 focus-visible:bg-[#00C9C5]/10 ${hot === p ? 'bg-[#00C9C5]/10' : ''}`}
              >
                <PinMark />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{p.name || p.address}</b>
                  <span className="block truncate text-[13px] text-[#6B7A8F]">{[p.area, p.city].filter(Boolean).join(', ') || p.address}</span>
                </span>
                {p.health && p.kind && <span className="shrink-0 rounded-full bg-[#00C9C5]/15 px-2 py-0.5 text-[11.5px] font-semibold capitalize text-[#0B8C88]">{p.kind}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {list && list.length === 0 && (
        <p className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-[14.5px] text-[#41526E]">{tx('noMatch', { q: q.trim() })}</p>
      )}

      {list !== null ? (
        <p className="mt-3 rounded-2xl border border-dashed border-[#0A9A96]/40 bg-[#00C9C5]/5 px-4 py-3 text-[14.5px] text-[#41526E]">
          <b className="text-[#0B2150]">{tx('dontSee')}</b>{' '}
          <button type="button" onClick={onManual} className={link}>{tx('enterManual')}</button>
        </p>
      ) : (
        <p className="mt-5 border-t border-dashed border-[#0F2742]/15 pt-4 text-[14.5px] text-[#6B7A8F]">
          {tx('notOnMap')} <button type="button" onClick={onManual} className={link}>{tx('enterManual')}</button>
        </p>
      )}
    </>
  )
}

function HospitalSignup() {
  const navigate = useNavigate()
  const tx = useTx()
  const [step, setStep] = useState('find')   // find → confirm | where → owner → verify → done
  const [f, setF] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  // Where the pin came from: 'map' (picked from search) or 'typed' (looked up
  // from the address the owner typed or pasted). geo = that lookup's status.
  const [pinSource, setPinSource] = useState(null)
  const [geo, setGeo] = useState('idle')        // idle | looking | found | approx | none
  const mapPin = useRef(null)
  const [agreed, setAgreed] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [done, setDone] = useState(null)
  // The live map: search results as pins, the one under the mouse, the owner's
  // location, and whether the pin was dragged by hand (then typing won't move it).
  const [results, setResults] = useState([])
  const [hot, setHot] = useState(null)
  const [near, setNear] = useState(null)
  const [dragged, setDragged] = useState(false)
  const skipFly = useRef(false)

  // Opens at the top (the router keeps the footer's scroll position) and names the tab.
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useEffect(() => {
    const before = document.title
    document.title = `${tx('tabTitle')} · TapCure`
    return () => { document.title = before }
  }, [tx])

  const set = (k) => (e) => {
    const v = k === 'mobile' ? toMobile(e.target.value) : k === 'pincode' ? toPincode(e.target.value) : e.target.value
    setF((cur) => ({ ...cur, [k]: v }))
    setErrors((cur) => ({ ...cur, [k]: undefined }))
    if (step === 'where' && !dragged && ['address', 'area', 'city', 'pincode'].includes(k)) setPinSource('typed')
  }
  // The owner dragged the pin to the exact spot: keep it, and don't fly the map.
  const movePin = (lat, lng) => {
    skipFly.current = true
    mapPin.current = { latitude: lat, longitude: lng }
    setF((cur) => ({ ...cur, latitude: lat, longitude: lng }))
    setPinSource('map'); setGeo('idle'); setDragged(true)
  }
  const go = (s) => { setErrors({}); setSubmitError(null); setStep(s); window.scrollTo({ top: 0 }) }

  const pick = (place) => {
    const { health, kind, ...p } = place   // eslint-disable-line no-unused-vars
    mapPin.current = { latitude: p.latitude, longitude: p.longitude }
    setF((cur) => ({ ...cur, ...p, state: toState(p.state), pincode: toPincode(p.pincode) }))
    setPinSource('map'); setGeo('idle'); setDragged(false)
    go('confirm')
  }
  const startManual = () => {
    mapPin.current = null
    setF((cur) => ({ ...cur, latitude: null, longitude: null }))
    setPinSource(null); setGeo('idle'); setDragged(false)
    go('where')
  }

  // A typed or pasted address: look it up as they type and show the pin, the
  // same way a picked suggestion does. geocodeAddress tries Mapbox, then
  // OpenStreetMap, and says when it only found the area or city.
  useEffect(() => {
    if (step !== 'where' || pinSource !== 'typed') return undefined
    const address = f.address.trim(), city = f.city.trim()
    if (address.length < 6 && city.length < 3) { setGeo('idle'); return undefined }
    setGeo('looking')
    let live = true
    const id = setTimeout(async () => {
      try {
        const g = await geocodeAddress({ address: [address, f.area.trim()].filter(Boolean).join(', '), city, pincode: f.pincode })
        if (!live) return
        // A pin picked on the map beats a city-level guess from an edit.
        if (g && !(g.approximate && mapPin.current)) {
          setF((cur) => ({ ...cur, latitude: g.lat, longitude: g.lng }))
          setGeo(g.approximate ? 'approx' : 'found')
        } else setGeo(g ? 'found' : 'none')
      } catch { if (live) setGeo('none') }
    }, 900)
    return () => { live = false; clearTimeout(id) }
  }, [step, pinSource, f.address, f.area, f.city, f.pincode])

  /* Checks — the same rules as before for every field still asked. */
  const emailError = (value) => {
    const email = value.trim()
    if (email.length > MAX_EMAIL) return tx('emailMax', { n: MAX_EMAIL })
    if (!EMAIL_RE.test(email)) return tx('emailBad')
    return emailTypoError(email) || null
  }
  const check = (keys) => {
    const e = {}
    keys.forEach((k) => { if (!String(f[k] ?? '').trim()) e[k] = tx('required') })
    if (keys.includes('mobile') && f.mobile && !/^\d{10}$/.test(f.mobile)) e.mobile = tx('mobileBad')
    if (keys.includes('pincode') && f.pincode && !PINCODE_RE.test(f.pincode)) e.pincode = tx('pinBad')
    if (keys.includes('email') && f.email.trim()) { const m = emailError(f.email); if (m) e.email = m }
    if (keys.includes('reg') && f.reg.trim()) { const m = validateHospitalRegNo(f.reg); if (m) e.reg = m }
    if (keys.includes('password') && f.password && f.password.length < MIN_PASSWORD) e.password = tx('pwMin', { n: MIN_PASSWORD })
    setErrors(e)
    return !Object.keys(e).length
  }

  const submitWhere = (e) => { e.preventDefault(); if (check(['name', 'address', 'city', 'state', 'pincode'])) go('owner') }
  // A map pick without a state or a good pincode goes to the address step to add them.
  const confirmYes = () => {
    if (f.state && PINCODE_RE.test(f.pincode)) go('owner')
    else { go('where'); check(['state', 'pincode']) }
  }
  const submitOwner = (e) => { e.preventDefault(); if (check(['first', 'last', 'mobile', 'email'])) go('verify') }

  const submitVerify = async (e) => {
    e.preventDefault()
    const ok = check(['reg', 'password'])
    if (!agreed) { setErrors((cur) => ({ ...cur, terms: tx('terms') })); return }
    if (!ok) return
    setBusy(true)
    setSubmitError(null)
    try {
      // A typed address has no coordinates yet; look it up so the hospital gets a
      // map pin. Registration still goes through if the lookup fails — the pin
      // can be set later from Hospital Profile.
      let { latitude, longitude } = f
      if ((latitude == null || longitude == null) && f.address.trim()) {
        try {
          const g = await geocodeAddress({ address: f.address, city: f.city, pincode: f.pincode })
          if (g) { latitude = g.lat; longitude = g.lng }
        } catch { /* not a registration blocker */ }
      }
      const res = await authApi.registerHospital({
        hospital_name: f.name.trim(),
        registration_number: f.reg.trim(),
        city: f.city.trim(),
        area: f.area.trim(),
        address: f.address.trim(),
        pincode: f.pincode || '',
        state: f.state || '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        owner_name: joinName(f.first, f.last),
        owner_first_name: f.first.trim(),
        owner_last_name: f.last.trim(),
        phone: f.mobile,
        email: f.email.trim(),
        password: f.password,
        // Set up later in the dashboard; the backend fills its defaults.
        always_open: true,
        consultation_minutes: 10,
        working_days: [],
        services: [],
        terms_accepted: true,
      }, null, null)
      setDone(res || {})
      go('done')
    } catch (err) {
      const msg = err?.message || tx('regFail')
      // Email / phone problems belong to the owner step: send them back there and
      // show it once, under that field (not again in the red box at the top).
      if (/email|phone|mobile/i.test(msg)) {
        const k = /email/i.test(msg) ? 'email' : 'mobile'
        const taken = /already|exist|registered|in use/i.test(msg)
        setStep('owner')
        setErrors({
          [k]: taken
            ? <>{tx(k === 'email' ? 'emailTaken' : 'phoneTaken')} <Link to="/hospital-login" className={link}>{tx('loginInstead')}</Link> {tx('orDifferent')}</>
            : msg,
        })
      } else setSubmitError(msg)
    }
    setBusy(false)
  }

  const hasPin = f.latitude != null && f.longitude != null
  const place = [f.area, f.city].filter((s) => s && s.trim()).join(', ')

  return (
    <div className="tc-type relative min-h-screen bg-[#EAF4F3] text-[#0B2150] antialiased" style={PAGE_STYLE}>
      <style>{`
        .hs-card > .hs-step{ animation:hsRise .45s cubic-bezier(.16,1,.3,1) both }
        @keyframes hsRise{ from{ opacity:0; transform:translateY(8px) } to{ opacity:1; transform:none } }
        @media (prefers-reduced-motion: reduce){ .hs-card > .hs-step{ animation:none } }
        .hs-search input{ height:52px; border-radius:999px; padding:0 44px 0 46px; font-size:16px; font-weight:600; color:#0B2150;
          background:#fff; border:1px solid rgba(15,39,66,.16); outline:none; width:100%;
          box-shadow:0 14px 34px -22px rgba(15,39,66,.45); transition:border-color .25s, box-shadow .25s }
        .hs-search input:focus{ border-color:rgba(10,154,150,.6); box-shadow:0 0 0 4px rgba(0,201,197,.14), 0 14px 34px -22px rgba(15,39,66,.45) }
        .hs-search input::placeholder{ color:#93A3B8; font-weight:500 }
        /* Big screens: the card is fixed-size and the app's root font is 80%
           (index.css), so on a 1920px screen it looked small. Grow it here. */
        @media (min-width:1440px){
          .hs-card h1{ font-size:40px }
          .hs-card h2{ font-size:28px }
          .hs-card .hs-lede{ font-size:18px }
          .hs-card input, .hs-card select{ font-size:17.5px }
          .hs-search input{ height:58px; font-size:17.5px }
          .hs-card label > span:first-child{ font-size:14px }
          .hs-card .hs-btn{ height:56px; font-size:16.5px }
          .hs-card dl, .hs-card .hs-note{ font-size:15.5px }
        }
        /* Calmer map so it supports the form instead of competing with it. */
        .hs-map .leaflet-tile-pane{ filter:saturate(.55) brightness(1.04) contrast(.95) }
        /* If a small screen ever needs to scroll the panel: a thin, quiet bar. */
        .hs-panel{ scrollbar-width:thin; scrollbar-color:rgba(15,39,66,.18) transparent }
        .hs-panel::-webkit-scrollbar{ width:6px }
        .hs-panel::-webkit-scrollbar-thumb{ background:rgba(15,39,66,.18); border-radius:6px }
        .hs-map .leaflet-container{ background:#EAF4F3; font-family:inherit }
        .hs-pin{ background:none; border:0 }
        .hs-pin svg{ position:relative; display:block; filter:drop-shadow(0 4px 6px rgba(11,33,80,.35)); transition:transform .2s }
        .hs-pin .hs-pulse{ position:absolute; left:50%; bottom:-6px; width:22px; height:10px; margin-left:-11px; border-radius:50%;
          background:rgba(0,201,197,.45); animation:hsPulse 1.8s ease-out infinite }
        @keyframes hsPulse{ from{ transform:scale(.6); opacity:1 } to{ transform:scale(2.6); opacity:0 } }
        .leaflet-marker-draggable.hs-pin{ cursor:grab }
        .leaflet-marker-draggable.hs-pin:active{ cursor:grabbing }
        .hs-map .hs-tip{ border:0; border-radius:999px; padding:5px 12px; font-weight:600; font-size:13px; color:#0B2150;
          box-shadow:0 8px 20px -8px rgba(11,33,80,.45) }
        @media (prefers-reduced-motion: reduce){ .hs-pin .hs-pulse{ animation:none } }
      `}</style>

      {/* ── the live map: search results as pins, flies to the picked hospital,
           and the pin can be dragged to the exact gate. On desktop it fills only
           the right side, so the pin is never under the form. ── */}
      <div className="hs-map fixed inset-x-0 top-0 z-0 h-[40vh] md:inset-y-0 md:left-[440px] md:right-0 md:h-auto lg:left-[500px] min-[1440px]:left-[600px] min-[1800px]:left-[680px]">
        <LiveMap
          pin={hasPin ? [f.latitude, f.longitude] : null}
          label={f.name || tx('name')}
          results={step === 'find' ? results : []}
          hot={hot}
          near={near}
          draggable={hasPin && step !== 'find' && step !== 'done'}
          skipFly={skipFly}
          onMove={movePin}
          onPickResult={pick}
          onHot={setHot}
        />
        {/* Tells the owner the pin can be moved, then thanks them once they do. */}
        {hasPin && step !== 'find' && step !== 'done' && (
          <span className={`pointer-events-none absolute left-1/2 top-4 z-[1000] inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-semibold shadow-md backdrop-blur ${dragged ? 'bg-[#0A9A96]/95 text-white' : 'bg-white/95 text-[#0B2150]'}`}>
            {dragged ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4 text-[#0A9A96]" />}
            {tx(dragged ? 'dragDone' : 'dragHint')}
          </span>
        )}
        {!hasPin && results.length === 0 && (
          <>
            {/* Fills the empty side and says what happens next. */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 md:flex" aria-hidden="true">
              <span className="relative grid h-16 w-16 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#00C9C5]/20 motion-reduce:animate-none" />
                <span className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-[#0A9A96]/50 bg-white/80 text-[#0A9A96] backdrop-blur">
                  <MapPin className="h-6 w-6" />
                </span>
              </span>
              <span className="rounded-full border border-[#0F2742]/10 bg-white/85 px-4 py-1.5 text-[14px] font-semibold text-[#41526E] shadow-sm backdrop-blur">{tx('appearsHere')}</span>
            </div>
          </>
        )}
        {/* Desktop: the map fades out of the white panel, so the page reads as one surface, not two boxes. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-[401] hidden w-[120px] bg-gradient-to-r from-white via-white/70 to-transparent md:block min-[1440px]:w-[160px]" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(50% 45% at 0% 0%, rgba(0,201,197,.28), transparent 70%), radial-gradient(45% 40% at 100% 0%, rgba(51,105,255,.18), transparent 70%)' }}
        />
      </div>

      {/* ── the form panel: a sheet under the map on phones, a full-height left panel on desktop ── */}
      <main className="hs-panel pointer-events-none relative z-[1200] pt-[36vh] md:pointer-events-auto md:fixed md:inset-y-0 md:left-0 md:w-[440px] md:overflow-y-auto md:bg-white md:pt-0 lg:w-[500px] min-[1440px]:w-[600px] min-[1800px]:w-[680px]">
        <section className="hs-card pointer-events-auto flex flex-col rounded-t-[26px] border border-[#0F2742]/10 bg-white p-5 pb-8 shadow-[0_-20px_50px_-30px_rgba(15,39,66,.38)] sm:p-7 md:mx-auto md:min-h-full md:max-w-[500px] md:rounded-none md:border-0 md:px-9 md:py-8 md:shadow-none min-[1440px]:max-w-[540px] min-[1440px]:px-0 min-[1440px]:py-10">
          {/* No site menu here: one job on this page. The logo and two links are the way out. */}
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#0F2742]/10 pb-4 md:mb-6">
            <Link to="/" className="flex items-center gap-2" aria-label="TapCure">
              <img src="/tapcure-icon.png" alt="" className="h-8 w-8" />
              <Wordmark className="text-[19px]" />
            </Link>
            <Link to="/" className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#41526E] hover:text-[#0A9A96]">
              <ArrowLeft className="h-4 w-4" /> {tx('backHome')}
            </Link>
          </div>

          {/* Desktop: the step sits a little above the middle. Two flexible spacers
              (1 above, 1.5 below) do it; they shrink to nothing, so they never cause a scroll. */}
          <div className="hidden md:block md:flex-[1]" aria-hidden="true" />
          <div>
          {submitError && step !== 'done' && (
            <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13.5px] font-medium text-red-600">{submitError}</p>
          )}

          {step === 'find' && (
            <div className="hs-step">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-[#0A9A96]">{tx('forHospitals')}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0A9A96]/30 bg-[#00C9C5]/10 px-3 py-1 text-[12px] font-semibold text-[#0A9A96]">
                  <i className="h-1.5 w-1.5 rounded-full bg-current" /> {tx('pilot')}
                </span>
              </div>
              <h1 className="mt-3 text-[30px] font-bold leading-[1.08] tracking-[-0.025em] sm:text-[34px]">
                <span className="block">{tx('h1a')}</span>
                <span className="block bg-gradient-to-r from-[#0A9A96] via-[#2F58B7] to-[#3369FF] bg-clip-text text-transparent">{tx('h1b')}</span>
              </h1>
              <p className="hs-lede mt-2.5 text-[16px] leading-relaxed text-[#41526E]">{tx('lede')}</p>
              <HospitalSearch tx={tx} onPick={pick} onManual={startManual} hot={hot} onHot={setHot} onResults={setResults} onNear={setNear} />
            </div>
          )}

          {step === 'confirm' && (
            <div className="hs-step">
              <Bars n={1} label={tx('stepOf', { n: 1 })} />
              <h2 className="text-[24px] font-bold tracking-[-0.02em]">{tx('isThis')}</h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#0F2742]/10 bg-white">
                <div className="flex items-center gap-3 border-b border-[#0F2742]/10 px-4 py-3">
                  <PinMark />
                  <span className="min-w-0"><b className="block text-[16.5px] leading-snug">{f.name}</b><span className="text-[14px] text-[#6B7A8F]">{place}</span></span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-3 text-[14.5px]">
                  <dt className="text-[#6B7A8F]">{tx('address')}</dt><dd className="m-0 break-words font-semibold">{f.address}</dd>
                  <dt className="text-[#6B7A8F]">{tx('city')}</dt><dd className="m-0 font-semibold">{[f.city, f.pincode].filter(Boolean).join(' ') || '—'}</dd>
                  <dt className="text-[#6B7A8F]">{tx('state')}</dt><dd className="m-0 font-semibold">{f.state || '—'}</dd>
                  {hasPin && <><dt className="text-[#6B7A8F]">{tx('location')}</dt><dd className="m-0 font-semibold tabular-nums">{f.latitude.toFixed(4)}° N, {f.longitude.toFixed(4)}° E</dd></>}
                </dl>
                <p className="flex items-center gap-2 bg-[#00C9C5]/10 px-4 py-2.5 text-[14px] font-semibold text-[#0B8C88]">
                  <Check className="h-4 w-4" /> {tx('filled')} <button type="button" onClick={() => go('where')} className={`ml-auto ${link}`}>{tx('edit')}</button>
                </p>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => { mapPin.current = null; setPinSource(null); setDragged(false); setF(EMPTY); go('find') }} className={btnGhost}>{tx('searchAgain')}</button>
                <button type="button" onClick={confirmYes} className={btnMain}>{tx('yes')}</button>
              </div>
            </div>
          )}

          {step === 'where' && (
            <form className="hs-step" onSubmit={submitWhere} noValidate>
              <Bars n={1} label={tx('stepOf', { n: 1 })} />
              <h2 className="text-[24px] font-bold tracking-[-0.02em]">{tx('whereT')}</h2>
              <p className="mt-1.5 text-[15px] text-[#41526E]">{tx('whereS')}</p>
              <div className="mt-5 grid gap-3.5">
                <Field k="name" label={tx('name')} value={f.name} onChange={set('name')} error={errors.name} placeholder="Sri Sai Hospital" />
                <Field k="address" label={tx('fullAddress')} value={f.address} onChange={set('address')} error={errors.address} />
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field k="area" label={tx('area')} optionalText={tx('optional')} value={f.area} onChange={set('area')} />
                  <Field k="city" label={tx('city')} value={f.city} onChange={set('city')} error={errors.city} />
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <StateField label={tx('state')} placeholder={tx('chooseState')} value={f.state} onChange={set('state')} error={errors.state} />
                  <Field k="pincode" label={tx('pincode')} mode="numeric" maxLength={6} value={f.pincode} onChange={set('pincode')} error={errors.pincode} placeholder="500039" />
                </div>
                {geo !== 'idle' && (
                  <p role="status" className={`flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[14px] ${geo === 'found' ? 'bg-[#00C9C5]/10 text-[#0B8C88]' : geo === 'looking' ? 'bg-white/80 text-[#41526E]' : 'bg-amber-50 text-amber-800'}`}>
                    {geo === 'looking' ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" /> : <MapPin className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>
                      <b className="font-semibold">{tx({ looking: 'geoLooking', found: 'geoFound', approx: 'geoApprox', none: 'geoNone' }[geo])}</b>
                      {geo !== 'looking' && <span className="block text-[13px] opacity-80">{tx('geoFix')}</span>}
                    </span>
                  </p>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => go(hasPin ? 'confirm' : 'find')} className={btnGhost}>{tx('back')}</button>
                <button className={btnMain}>{tx('continue')}</button>
              </div>
            </form>
          )}

          {step === 'owner' && (
            <form className="hs-step" onSubmit={submitOwner} noValidate>
              <Bars n={2} label={tx('stepOf', { n: 2 })} />
              <h2 className="text-[24px] font-bold tracking-[-0.02em]">{tx('ownerT')}</h2>
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#00C9C5]/10 px-3.5 py-2.5">
                <PinMark />
                <span className="min-w-0"><b className="block truncate text-[15px]">{f.name}</b><span className="text-[13px] text-[#6B7A8F]">{place}</span></span>
                <button type="button" onClick={() => go('where')} className={`ml-auto text-[14px] ${link}`}>{tx('change')}</button>
              </div>
              <div className="mt-5 grid gap-3.5">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field k="first" label={tx('first')} value={f.first} onChange={set('first')} error={errors.first} placeholder="Ravi" />
                  <Field k="last" label={tx('last')} value={f.last} onChange={set('last')} error={errors.last} placeholder="Kumar" />
                </div>
                <Field k="mobile" label={tx('mobile')} prefix="+91" mode="numeric" value={f.mobile} onChange={set('mobile')} error={errors.mobile} placeholder="98765 43210" />
                <Field k="email" type="email" label={tx('email')} help={tx('emailHelp')} maxLength={MAX_EMAIL} value={f.email} onChange={set('email')} error={errors.email} placeholder="name@hospital.in" />
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => go(hasPin && f.address ? 'confirm' : 'where')} className={btnGhost}>{tx('back')}</button>
                <button className={btnMain}>{tx('continue')}</button>
              </div>
            </form>
          )}

          {step === 'verify' && (
            <form className="hs-step" onSubmit={submitVerify} noValidate>
              <Bars n={3} label={tx('stepOf', { n: 3 })} />
              <h2 className="text-[24px] font-bold tracking-[-0.02em]">{tx('verifyT')}</h2>
              <p className="mt-1.5 text-[15px] text-[#41526E]">{tx('verifyS')}</p>
              <div className="mt-5 grid gap-3.5">
                <Field k="reg" label={tx('reg')} maxLength={MAX_REG_NO} value={f.reg} onChange={set('reg')} error={errors.reg} placeholder={REG_NO_PLACEHOLDER} />
                <Field
                  k="password" type={showPw ? 'text' : 'password'} label={tx('password')} value={f.password} onChange={set('password')}
                  error={errors.password} placeholder={tx('pwPh')}
                  extra={<button type="button" onClick={() => setShowPw((s) => !s)} className="absolute bottom-1.5 right-3 p-1 text-[13px] font-semibold text-[#0A9A96]">{showPw ? tx('hide') : tx('show')}</button>}
                />
                <div className="rounded-2xl border border-[#0F2742]/15 bg-white px-3.5 py-3">
                  <ConsentCheck checked={agreed} onChange={(v) => { setAgreed(v); if (v) setErrors((cur) => ({ ...cur, terms: undefined })) }} error={errors.terms} />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => go('owner')} className={btnGhost}>{tx('back')}</button>
                <button disabled={busy} className={btnMain}>{busy ? tx('registering') : tx('register')}</button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="hs-step">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#16C7C2] to-[#0A9A96] text-white shadow-[0_12px_30px_-12px_rgba(0,201,197,.7)]">
                <Check className="h-7 w-7" strokeWidth={3} />
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-[#0A9A96]">{tx('registered')}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-[12px] font-semibold text-amber-700">
                  <Clock className="h-3.5 w-3.5" /> {tx('awaiting')}
                </span>
              </div>
              <h2 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em]">{tx('doneT', { name: f.name })}</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#0F2742]/10 bg-white">
                <ol className="m-0 grid list-none gap-3 p-4">
                  {[['n1', 'n1b'], ['n2', 'n2b'], ['n3', 'n3b']].map(([h, b], i) => (
                    <li key={h} className="grid grid-cols-[26px_1fr] gap-2.5 text-[14px] text-[#6B7A8F]">
                      <i className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[#00C9C5]/15 text-[12px] font-extrabold not-italic text-[#0B8C88]">{i + 1}</i>
                      <span><b className="block text-[14.5px] text-[#0B2150]">{tx(h)}</b>{tx(b, { email: f.email })}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="mt-6 flex gap-3">
                <Link to="/" className={btnGhost}>{tx('backHome')}</Link>
                <button type="button" onClick={() => navigate('/hospital-login')} className={btnMain}>{tx('goLogin')}</button>
              </div>
            </div>
          )}
          </div>
          <div className="hidden md:block md:flex-[1.5]" aria-hidden="true" />

          {step !== 'done' && (
            <p className="mt-5 border-t md:mt-6 border-[#0F2742]/10 pt-3.5 text-[14px] text-[#6B7A8F]">
              {tx('already')} <Link to="/hospital-login" className={link}>{tx('hospLogin')}</Link>
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

export default HospitalSignup
