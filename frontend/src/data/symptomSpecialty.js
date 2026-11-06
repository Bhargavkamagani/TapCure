/**
 * Symptom → specialty guidance (rule-based, offline — no LLM), trilingual (en/te/hi).
 *
 * Helps a patient who doesn't know which specialist to see. `matchSpecialties`
 * keyword-matches free text (English, Telugu, Hindi + common transliterations);
 * `SYMPTOM_GROUPS` powers the tappable common-complaint chips. Specialty keys MUST
 * match the doctor `specialization` values used across the app (SPECIALIZATIONS in
 * data/authData.js) so a result can drive the existing doctor filter — the keys
 * stay English; `SPECIALTY_LABELS` holds their te/hi display names.
 *
 * Guidance, not a diagnosis. `EMERGENCY` red-flag terms surface an urgent-care warning.
 */

import { translitName, translitDegrees } from '../lib/translit.js'

// Human-readable specialty names for display (the key is the English filter value).
export const SPECIALTY_LABELS = {
  'General Physician': { en: 'General Physician', te: 'జనరల్ ఫిజీషియన్', hi: 'जनरल फिजिशियन' },
  Cardiology: { en: 'Cardiology', te: 'కార్డియాలజీ (గుండె)', hi: 'कार्डियोलॉजी (हृदय)' },
  Dermatology: { en: 'Dermatology', te: 'చర్మ వైద్యం', hi: 'त्वचा रोग (डर्मेटोलॉजी)' },
  Orthopedics: { en: 'Orthopedics', te: 'ఆర్థోపెడిక్స్ (ఎముకలు)', hi: 'हड्डी रोग (ऑर्थोपेडिक्स)' },
  Pediatrics: { en: 'Pediatrics', te: 'పిల్లల వైద్యం', hi: 'बाल रोग' },
  Gynecology: { en: 'Gynecology', te: 'స్త్రీ వైద్యం', hi: 'स्त्री रोग' },
  ENT: { en: 'ENT', te: 'ఈఎన్‌టీ (చెవి-ముక్కు-గొంతు)', hi: 'ईएनटी (कान-नाक-गला)' },
  Ophthalmology: { en: 'Ophthalmology', te: 'కంటి వైద్యం', hi: 'नेत्र रोग' },
  Dental: { en: 'Dental', te: 'దంత వైద్యం', hi: 'दंत चिकित्सा' },
  Physiotherapy: { en: 'Physiotherapy', te: 'ఫిజియోథెరపీ', hi: 'फिजियोथेरेपी' },
  Psychiatry: { en: 'Psychiatry', te: 'మానసిక వైద్యం', hi: 'मनोचिकित्सा' },
  Nutrition: { en: 'Nutrition', te: 'పోషకాహారం', hi: 'पోషण' },

  // The rest of the picker's specialities (data/authData.js). These reach the
  // patient straight from the database in English, so without an entry here a
  // Telugu or Hindi user reads the one field that tells them whether this is
  // even the right kind of doctor — in English.
  'General Surgery': { en: 'General Surgery', te: 'సాధారణ శస్త్రచికిత్స', hi: 'सामान्य शल्य चिकित्सा' },
  Neurology: { en: 'Neurology', te: 'నరాల వైద్యం', hi: 'तंत्रिका रोग' },
  Neurosurgery: { en: 'Neurosurgery', te: 'నరాల శస్త్రచికిత్స', hi: 'तंत्रिका शल्य चिकित्सा' },
  Nephrology: { en: 'Nephrology', te: 'మూత్రపిండాల వైద్యం', hi: 'गुर्दा रोग' },
  Urology: { en: 'Urology', te: 'మూత్ర వ్యవస్థ వైద్యం', hi: 'मूत्र रोग' },
  Gastroenterology: { en: 'Gastroenterology', te: 'జీర్ణకోశ వైద్యం', hi: 'जठर रोग' },
  Pulmonology: { en: 'Pulmonology', te: 'ఊపిరితిత్తుల వైద్యం', hi: 'फेफड़ा रोग' },
  Endocrinology: { en: 'Endocrinology', te: 'హార్మోన్ల వైద్యం', hi: 'अंतःस्रावी रोग' },
  Diabetology: { en: 'Diabetology', te: 'మధుమేహ వైద్యం', hi: 'मधुमेह चिकित्सा' },
  Oncology: { en: 'Oncology', te: 'క్యాన్సర్ వైద్యం', hi: 'कैंसर रोग' },
  Rheumatology: { en: 'Rheumatology', te: 'కీళ్ల వైద్యం', hi: 'गठिया रोग' },
  Hematology: { en: 'Hematology', te: 'రక్త వైద్యం', hi: 'रक्त रोग' },
  'Plastic Surgery': { en: 'Plastic Surgery', te: 'ప్లాస్టిక్ సర్జరీ', hi: 'प्लास्टिक सर्जरी' },
  Radiology: { en: 'Radiology', te: 'రేడియాలజీ', hi: 'रेडियोलॉजी' },
  Anesthesiology: { en: 'Anesthesiology', te: 'మత్తు వైద్యం', hi: 'निश्चेतना' },
  Pathology: { en: 'Pathology', te: 'పాథాలజీ', hi: 'विकृति विज्ञान' },
  'Emergency Medicine': { en: 'Emergency Medicine', te: 'అత్యవసర వైద్యం', hi: 'आपातकालीन चिकित्सा' },
  Geriatrics: { en: 'Geriatrics', te: 'వృద్ధుల వైద్యం', hi: 'वृद्ध चिकित्सा' },
  'Speech Therapy': { en: 'Speech Therapy', te: 'స్పీచ్ థెరపీ', hi: 'वाक् चिकित्सा' },
  Audiology: { en: 'Audiology', te: 'వినికిడి వైద్యం', hi: 'श्रवण विज्ञान' },
  Ayurveda: { en: 'Ayurveda', te: 'ఆయుర్వేదం', hi: 'आयुर्वेद' },
  Homeopathy: { en: 'Homeopathy', te: 'హోమియోపతి', hi: 'होम्योपैथी' },
  Unani: { en: 'Unani', te: 'యునాని', hi: 'यूनानी' },
  Siddha: { en: 'Siddha', te: 'సిద్ధ', hi: 'सिद्ध' },
  'Naturopathy & Yoga': { en: 'Naturopathy & Yoga', te: 'ప్రకృతి వైద్యం & యోగా', hi: 'प्राकृतिक चिकित्सा एवं योग' },
}

/** Display name of a specialty in the given language (falls back to the key). */
export function specialtyLabel(specialty, lang = 'en') {
  const e = SPECIALTY_LABELS[specialty]
  if (e) return e[lang] || e.en
  // Free-text specializations typed by doctors ("MBBS", "Cardiologist") are not
  // in the list — spell them in the reader's script rather than leave English.
  if (!specialty || lang === 'en') return specialty
  return translitName(translitDegrees(specialty, lang), lang)
}

// Real-world variants a doctor's free-text `specialization` might use, so the
// filter is tolerant of naming/spelling differences (e.g. "Dentist" ≈ "Dental",
// "Psychology"/"Pscology" ≈ "Psychiatry", "MBBS" ≈ General Physician).
// Word-STEM aliases (single tokens are matched as word-prefixes; entries with a
// space are matched as a phrase). Kept as stems so "cardiolog" hits both
// "Cardiologist" and "Cardiology", "dentist" hits "Dentistry", etc.
export const SPECIALTY_ALIASES = {
  'General Physician': ['physician', 'mbbs', 'general medicine', 'general practitioner', 'internal medicine', 'family medicine', 'family physician', 'family doctor'],
  Cardiology: ['cardiolog', 'cardiac', 'heart'],
  Dermatology: ['dermatolog', 'derma', 'skin', 'cosmetolog', 'venereolog'],
  Orthopedics: ['orthop', 'orthoped', 'orthopaedic', 'bone'],
  Pediatrics: ['pediatric', 'paediatric', 'neonatolog', 'child', 'children', 'kids', 'baby'],
  Gynecology: ['gynec', 'gynaec', 'obstetric', 'obg', 'obgyn', 'women', 'woman', 'lady doctor', 'pregnan'],
  ENT: ['ent', 'otolaryng', 'otorhino', 'ear', 'ears', 'nose', 'throat'],
  Ophthalmology: ['ophthalm', 'optometr', 'eye'],
  Dental: ['dental', 'dentist', 'dentistry', 'orthodont', 'bds', 'oral', 'tooth', 'teeth'],
  Physiotherapy: ['physio', 'physiotherap', 'physical therapy', 'rehab'],
  Psychiatry: ['psychiat', 'psycholog', 'pscolog', 'psycolog', 'mental', 'counsel'],
  Nutrition: ['nutrition', 'diet', 'dietic', 'dietit', 'dietet'],
  Neurology: ['neurolog', 'nerve', 'brain'],
  Neurosurgery: ['neurosurg'],
  Urology: ['urolog', 'kidney', 'urine', 'bladder'],
  'General Surgery': ['surgeon', 'general surg'],
}

/**
 * The speciality a typed search NAMES ("dentist" -> Dental, "cardiologist" ->
 * Cardiology, "skin doctor" -> Dermatology), or ''. Search boxes matched only
 * letters, so "dentist" found nobody while "dental" found every dentist. Same
 * rule as matchesSpecialty: one-word aliases are word prefixes (so "ent" never
 * fires on "dentist"), phrases match anywhere. Mirrors the backend's
 * public_discovery._specialty_from_term.
 */
// A short everyday word ("heart", "ear", "ent") must be the whole word or its
// plural; only longer stems ("cardiolog", "dentist") match as a prefix.
// Otherwise "heartburn" became Cardiology and "entrance" became ENT.
const wordHits = (w, alias) => (alias.length <= 5 ? w === alias || w === `${alias}s` || w === `${alias}es` : w.startsWith(alias))

export function specialtyFromText(text) {
  const t = norm(text)
  const words = t.split(/[^a-z0-9]+/).filter(Boolean)
  if (!words.length) return ''
  for (const [specialty, aliases] of Object.entries(SPECIALTY_ALIASES)) {
    for (const alias of [norm(specialty), ...aliases]) {
      if (alias.includes(' ') ? t.includes(alias) : words.some((w) => wordHits(w, alias))) return specialty
    }
  }
  return ''
}

/**
 * True if a doctor's stored `specialization` corresponds to the given specialty.
 * Single-word aliases match on word boundaries (token starts-with, so a stem like
 * "dentist" hits "Dentistry" but "ent" never hits "Dentist"); phrase aliases
 * (with a space) match anywhere.
 */
export function matchesSpecialty(doctorSpecialization, specialty) {
  const d = norm(doctorSpecialization)
  if (!d || !specialty) return false
  if (d === norm(specialty)) return true
  const aliases = SPECIALTY_ALIASES[specialty] || [norm(specialty)]
  const tokens = d.split(/[^a-z0-9]+/).filter(Boolean)
  return aliases.some((a) =>
    a.includes(' ') ? d.includes(a) : tokens.some((tok) => tok.startsWith(a)),
  )
}

// Plain-language terms patients type/say — English + Telugu + Hindi + transliterations.
export const SPECIALTY_KEYWORDS = {
  'General Physician': [
    'fever', 'cold', 'cough', 'flu', 'body ache', 'body pain', 'weakness', 'fatigue',
    'tired', 'tiredness', 'infection', 'viral', 'diabetes', 'sugar', 'blood pressure',
    'bp', 'general', 'checkup', 'check up', 'stomach', 'stomach ache', 'stomach pain',
    'vomiting', 'loose motion', 'diarrhea', 'diarrhoea', 'dehydration', 'headache', 'head ache', 'head pain',
    'weight loss', 'not feeling well', 'sick', 'malaria', 'typhoid', 'dengue',
    // te
    'జ్వరం', 'జలుబు', 'దగ్గు', 'ఒళ్లు నొప్పులు', 'నీరసం', 'అలసట', 'చక్కెర', 'షుగర్',
    'కడుపు నొప్పి', 'వాంతులు', 'విరేచనాలు', 'తలనొప్పి', 'రక్తపోటు', 'బీపీ',
    // hi
    'बुखार', 'सर्दी', 'जुकाम', 'खांसी', 'बदन दर्द', 'कमजोरी', 'थकान', 'मधुमेह',
    'पेट दर्द', 'उल्टी', 'दस्त', 'सिरदर्द', 'बीपी',
    'bukhar', 'khansi', 'badan dard', 'kamzori', 'thakan', 'pet dard', 'sir dard', 'ulti', 'jukam',
    // Telugu spoken/transliterated — speech-to-text writes these in Latin
    'jwaram', 'jwram', 'jvaram', 'daggu', 'kadupu noppi', 'thalanoppi', 'thala noppi', 'nasalam',
  ],
  Cardiology: [
    'chest pain', 'chest', 'heart', 'heart pain', 'palpitation', 'palpitations',
    'heartbeat', 'irregular heartbeat', 'high bp', 'hypertension', 'cholesterol',
    'breathless', 'breathlessness', 'short of breath', 'fainting', 'cardiac',
    // te — both spellings of "chest" (ఛాతీ / చాతి) and both vowel lengths, so a
    // spoken complaint cannot fall through to a general physician.
    'ఛాతీ నొప్పి', 'ఛాతి నొప్పి', 'చాతీ నొప్పి', 'చాతి నొప్పి', 'ఛాతీ', 'చాతి',
    'గుండె', 'గుండె నొప్పి', 'గుండెల్లో నొప్పి', 'గుండె దడ', 'అధిక రక్తపోటు',
    'ఊపిరి ఆడకపోవడం', 'ఊపిరి అందడం లేదు',
    // hi
    'छाती में दर्द', 'सीने में दर्द', 'छाती', 'सीने', 'दिल', 'दिल का दर्द', 'धड़कन',
    'हाई बीपी', 'सांस फूलना',
    'seene mein dard', 'chhati dard', 'chaati noppi', 'chati noppi', 'gunde noppi',
    'gunde dada', 'dil ka dard', 'dhadkan', 'saans phoolna',
  ],
  Dermatology: [
    'skin', 'rash', 'rashes', 'acne', 'pimple', 'pimples', 'itching', 'itch', 'eczema',
    'psoriasis', 'hair fall', 'hair loss', 'baldness', 'dandruff', 'nail', 'nails',
    'fungal', 'fungus', 'skin allergy', 'pigmentation', 'dark spots', 'wart', 'warts',
    'boils', 'ringworm', 'dry skin',
    // te
    'చర్మం', 'దద్దుర్లు', 'మొటిమలు', 'దురద', 'జుట్టు రాలడం', 'చుండ్రు', 'తామర', 'ఫంగల్',
    // hi
    'त्वचा', 'चकत्ते', 'मुंहासे', 'खुजली', 'बाल झड़ना', 'रूसी', 'दाद', 'फंगल',
    'khujli', 'baal jhadna', 'muhase', 'chakatte',
  ],
  Orthopedics: [
    'bone', 'bones', 'joint', 'joint pain', 'knee', 'knee pain', 'back pain', 'backache',
    'fracture', 'sprain', 'shoulder', 'neck pain', 'arthritis', 'muscle', 'spine',
    'sports injury', 'hip pain', 'leg pain', 'ligament', 'slip disc', 'swelling joint',
    // te
    'కీళ్ల నొప్పులు', 'మోకాలి నొప్పి', 'వెన్నునొప్పి', 'ఎముక విరగడం', 'బెణుకు', 'మెడ నొప్పి', 'భుజం నొప్పి',
    // hi
    'जोड़ों का दर्द', 'घुटने का दर्द', 'कमर दर्द', 'हड्डी टूटना', 'मोच', 'गर्दन दर्द', 'कंधे में दर्द',
    'jodo ka dard', 'ghutne ka dard', 'kamar dard', 'haddi tootna', 'gardan dard',
  ],
  Pediatrics: [
    'child', 'children', 'baby', 'infant', 'kid', 'newborn', 'vaccination', 'vaccine',
    'child fever', 'growth', 'my son', 'my daughter', 'toddler', 'immunization',
    // te
    'పిల్లలు', 'శిశువు', 'బిడ్డ', 'పాప', 'పిల్లల జ్వరం', 'టీకా', 'నవజాత శిశువు',
    // hi
    'बच्चा', 'बच्चे', 'शिशु', 'बच्चे का बुखार', 'टीका', 'टीकाकरण', 'नवजात',
    'baccha', 'bachche', 'shishu',
  ],
  Gynecology: [
    'pregnancy', 'pregnant', 'period', 'periods', 'menstrual', 'menstruation', 'women',
    'pcos', 'pcod', 'fertility', 'infertility', 'gynec', 'uterus', 'ovary', 'white discharge',
    'menopause', 'irregular periods', 'conceive',
    // te
    'గర్భం', 'గర్భవతి', 'నెలసరి', 'రుతుక్రమం', 'మహిళలు', 'తెల్లబట్ట', 'సంతానలేమి',
    // hi
    'गर्भावस्था', 'गर्भवती', 'पीरियड', 'माहवारी', 'महिला', 'सफेद पानी', 'पीसीओडी', 'पीसीओएस',
    'mahvari', 'safed pani', 'garbh',
  ],
  ENT: [
    'ear', 'ear pain', 'nose', 'throat', 'sore throat', 'sinus', 'tonsils', 'hearing',
    'hearing loss', 'nose bleed', 'nosebleed', 'snoring', 'vertigo', 'blocked nose',
    'runny nose', 'ear infection', 'ear wax',
    // te
    'చెవి', 'చెవి నొప్పి', 'ముక్కు', 'గొంతు', 'గొంతు నొప్పి', 'సైనస్', 'వినికిడి', 'ముక్కు దిబ్బడ',
    // hi
    'कान', 'कान दर्द', 'नाक', 'गला', 'गले में खराश', 'साइनस', 'सुनाई', 'बंद नाक',
    'kaan dard', 'gale mein kharash', 'sunai',
  ],
  Ophthalmology: [
    'eye', 'eyes', 'vision', 'blurry vision', 'blurred vision', 'eye pain', 'red eye',
    'cataract', 'glasses', 'spectacles', 'eye infection', 'watery eyes', 'itchy eyes',
    'night blindness', 'eye power',
    // te
    'కన్ను', 'కళ్లు', 'చూపు', 'మసక చూపు', 'కంటి నొప్పి', 'కంటిశుక్లం', 'కంటి పవర్',
    // hi
    'आंख', 'आंखें', 'दृष्टि', 'नज़र', 'धुंधला दिखना', 'आंख में दर्द', 'मोतियाबिंद',
    'aankh dard', 'dhundhla dikhna', 'motiyabind',
  ],
  Dental: [
    'tooth', 'teeth', 'toothache', 'tooth pain', 'gum', 'gums', 'cavity', 'cavities',
    'dental', 'jaw pain', 'bad breath', 'braces', 'bleeding gums', 'wisdom tooth',
    'sensitive teeth', 'yellow teeth',
    // te — Telugu has several everyday words for "teeth" and two accepted
    // spellings of the commonest one (పళ్లు / పళ్ళు). A patient saying
    // "పళ్ళు నొప్పి" used to match nothing at all and land on a general
    // physician, so every common form is listed rather than the tidy one.
    'పన్ను', 'పన్ను నొప్పి', 'పళ్లు', 'పళ్ళు', 'పళ్ల నొప్పి', 'పళ్ళ నొప్పి', 'పళ్లు నొప్పి', 'పళ్ళు నొప్పి',
    'పండ్లు', 'పండ్ల నొప్పి', 'పంటి', 'పంటి నొప్పి', 'దంత', 'దంతాలు', 'దంతవైద్యుడు',
    'చిగుళ్లు', 'చిగుళ్ళు', 'పుచ్చు', 'నోటి దుర్వాసన',
    // hi
    'दांत', 'दांत दर्द', 'दंत', 'मसूड़े', 'कैविटी', 'मुंह की बदबू', 'मसूड़ों से खून',
    // Roman spellings people type or that speech-to-text falls back to.
    'daant dard', 'dant dard', 'daanth', 'danth', 'dant', 'daant', 'dantalu',
    'pallu', 'palu', 'pallu noppi', 'palla noppi', 'pandlu', 'pandla noppi',
    'pannu', 'pannu noppi', 'panti', 'panti noppi', 'chigullu', 'masude', 'muh ki badbu',
  ],
  Physiotherapy: [
    'physiotherapy', 'physio', 'rehab', 'rehabilitation', 'stiffness', 'posture',
    'mobility', 'physical therapy', 'recovery', 'paralysis', 'muscle stiffness',
    'frozen shoulder', 'exercise therapy',
    // te
    'ఫిజియోథెరపీ', 'బిగుసుకుపోవడం', 'కండరాల బిగుసుదల', 'రిహాబిలిటేషన్', 'ఫ్రోజెన్ షోల్డర్',
    // hi
    'फिजियोथेरेपी', 'अकड़न', 'मांसपेशियों में अकड़न', 'रिहैबिलिटेशन', 'फ्रोजन शोल्डर',
    'akadan',
  ],
  Psychiatry: [
    'mental', 'anxiety', 'depression', 'stress', 'sleep', 'insomnia', 'not sleeping',
    'mood', 'panic', 'panic attack', 'addiction', 'mind', 'sad', 'overthinking',
    'suicidal', 'mental health', 'counselling', 'counseling',
    // te
    'మానసిక', 'ఆందోళన', 'కుంగుబాటు', 'ఒత్తిడి', 'నిద్రలేమి', 'భయం', 'విచారం', 'మానసిక ఆరోగ్యం',
    // hi
    'मानसिक', 'चिंता', 'घबराहट', 'डिप्रेशन', 'अवसाद', 'तनाव', 'अनिद्रा', 'मानसिक स्वास्थ्य',
    'chinta', 'ghabrahat', 'tanav', 'neend nahi',
  ],
  Nutrition: [
    'diet', 'nutrition', 'weight gain', 'obesity', 'overweight', 'healthy eating',
    'dietician', 'dietitian', 'meal plan', 'weight management', 'nutritionist',
    // te
    'ఆహారం', 'పోషకాహారం', 'బరువు పెరుగుట', 'బరువు తగ్గడం', 'బరువు తగ్గించడం', 'ఊబకాయం', 'డైటీషియన్',
    // hi
    'डाइट', 'आहार', 'पोषण', 'वजन बढ़ना', 'वजन घटाना', 'वजन कम', 'मोटापा', 'डाइटीशियन',
    'motapa', 'aahar', 'vajan ghatana',
  ],
}

// Red-flag terms → urge emergency care (still map to the closest specialty).
export const EMERGENCY_KEYWORDS = [
  'severe chest pain', 'heart attack', 'cannot breathe', "can't breathe",
  'difficulty breathing', 'severe bleeding', 'unconscious', 'fainted', 'stroke',
  'slurred speech', 'face drooping', 'suicidal', 'severe injury', 'accident',
  'poisoning', 'seizure', 'not breathing',
  // te
  'తీవ్రమైన ఛాతీ నొప్పి', 'తీవ్రమైన చాతి నొప్పి', 'గుండెపోటు', 'గుండె పోటు',
  'ఊపిరి ఆడటం లేదు', 'ఊపిరి ఆడట్లేదు', 'స్పృహ కోల్పోవడం', 'పక్షవాతం',
  'తీవ్ర రక్తస్రావం', 'ప్రమాదం', 'మూర్ఛ', 'ఆత్మహత్య',
  // hi
  'हार्ट अटैक', 'दिल का दौरा', 'सांस नहीं आ रही', 'बेहोश', 'लकवा', 'स्ट्रोक',
  'तेज़ खून बहना', 'दुर्घटना', 'दौरा', 'आत्महत्या', 'saans nahi',
]

// Tappable common complaints, grouped by body area. Labels + chips are trilingual.
export const SYMPTOM_GROUPS = [
  {
    area: { en: 'Fever & General', te: 'జ్వరం & సాధారణం', hi: 'बुखार और सामान्य' },
    specialty: 'General Physician', icon: 'Thermometer',
    chips: [
      { en: 'Fever', te: 'జ్వరం', hi: 'बुखार' },
      { en: 'Cough & cold', te: 'దగ్గు & జలుబు', hi: 'खांसी-जुकाम' },
      { en: 'Body ache', te: 'ఒళ్లు నొప్పులు', hi: 'बदन दर्द' },
      { en: 'Weakness / fatigue', te: 'నీరసం / అలసట', hi: 'कमजोरी / थकान' },
      { en: 'Diabetes / BP', te: 'షుగర్ / బీపీ', hi: 'शुगर / बीपी' },
      { en: 'Stomach upset', te: 'కడుపు సమస్య', hi: 'पेट की समस्या' },
    ],
  },
  {
    area: { en: 'Heart & Chest', te: 'గుండె & ఛాతీ', hi: 'दिल और छाती' },
    specialty: 'Cardiology', icon: 'HeartPulse',
    chips: [
      { en: 'Chest pain', te: 'ఛాతీ నొప్పి', hi: 'छाती में दर्द' },
      { en: 'Palpitations', te: 'గుండె దడ', hi: 'धड़कन' },
      { en: 'High BP', te: 'అధిక బీపీ', hi: 'हाई बीपी' },
      { en: 'Breathlessness', te: 'ఊపిరి ఆడకపోవడం', hi: 'सांस फूलना' },
      { en: 'Cholesterol', te: 'కొలెస్ట్రాల్', hi: 'कोलेस्ट्रॉल' },
    ],
  },
  {
    area: { en: 'Skin, Hair & Nails', te: 'చర్మం, జుట్టు & గోళ్లు', hi: 'त्वचा, बाल और नाखून' },
    specialty: 'Dermatology', icon: 'Hand',
    chips: [
      { en: 'Skin rash', te: 'చర్మ దద్దుర్లు', hi: 'त्वचा पर चकत्ते' },
      { en: 'Acne / pimples', te: 'మొటిమలు', hi: 'मुंहासे' },
      { en: 'Hair fall', te: 'జుట్టు రాలడం', hi: 'बाल झड़ना' },
      { en: 'Itching', te: 'దురద', hi: 'खुजली' },
      { en: 'Fungal infection', te: 'ఫంగల్ ఇన్ఫెక్షన్', hi: 'फंगल संक्रमण' },
    ],
  },
  {
    area: { en: 'Bones & Joints', te: 'ఎముకలు & కీళ్లు', hi: 'हड्डियाँ और जोड़' },
    specialty: 'Orthopedics', icon: 'Bone',
    chips: [
      { en: 'Joint pain', te: 'కీళ్ల నొప్పులు', hi: 'जोड़ों का दर्द' },
      { en: 'Back pain', te: 'వెన్నునొప్పి', hi: 'कमर दर्द' },
      { en: 'Knee pain', te: 'మోకాలి నొప్పి', hi: 'घुटने का दर्द' },
      { en: 'Fracture / sprain', te: 'ఎముక విరగడం / బెణుకు', hi: 'फ्रैक्चर / मोच' },
      { en: 'Neck / shoulder', te: 'మెడ / భుజం', hi: 'गर्दन / कंधा' },
    ],
  },
  {
    area: { en: 'Eye', te: 'కన్ను', hi: 'आंख' },
    specialty: 'Ophthalmology', icon: 'Eye',
    chips: [
      { en: 'Blurry vision', te: 'మసక చూపు', hi: 'धुंधला दिखना' },
      { en: 'Eye pain', te: 'కంటి నొప్పి', hi: 'आंख में दर्द' },
      { en: 'Red / watery eyes', te: 'ఎర్ర / నీరు కారే కళ్లు', hi: 'लाल / पानी वाली आंखें' },
      { en: 'Cataract', te: 'కంటిశుక్లం', hi: 'मोतियाबिंद' },
      { en: 'Eye power', te: 'కంటి పవర్', hi: 'आंख का नंबर' },
    ],
  },
  {
    area: { en: 'Ear, Nose & Throat', te: 'చెవి, ముక్కు & గొంతు', hi: 'कान, नाक और गला' },
    specialty: 'ENT', icon: 'Ear',
    chips: [
      { en: 'Ear pain', te: 'చెవి నొప్పి', hi: 'कान दर्द' },
      { en: 'Sore throat', te: 'గొంతు నొప్పి', hi: 'गले में खराश' },
      { en: 'Sinus', te: 'సైనస్', hi: 'साइनस' },
      { en: 'Hearing problem', te: 'వినికిడి సమస్య', hi: 'सुनने की समस्या' },
      { en: 'Blocked nose', te: 'ముక్కు దిబ్బడ', hi: 'बंद नाक' },
    ],
  },
  {
    area: { en: 'Teeth & Gums', te: 'పళ్లు & చిగుళ్లు', hi: 'दांत और मसूड़े' },
    specialty: 'Dental', icon: 'Smile',
    chips: [
      { en: 'Toothache', te: 'పంటి నొప్పి', hi: 'दांत दर्द' },
      { en: 'Cavity', te: 'పంటి పుచ్చు', hi: 'कैविटी' },
      { en: 'Bleeding gums', te: 'చిగుళ్ల రక్తస్రావం', hi: 'मसूड़ों से खून' },
      { en: 'Bad breath', te: 'నోటి దుర్వాసన', hi: 'मुंह की बदबू' },
      { en: 'Braces', te: 'బ్రేసెస్', hi: 'ब्रेसेस' },
    ],
  },
  {
    area: { en: "Women's Health", te: 'మహిళల ఆరోగ్యం', hi: 'महिला स्वास्थ्य' },
    specialty: 'Gynecology', icon: 'Flower2',
    chips: [
      { en: 'Pregnancy care', te: 'గర్భధారణ సంరక్షణ', hi: 'गर्भावस्था देखभाल' },
      { en: 'Period problems', te: 'నెలసరి సమస్యలు', hi: 'पीरियड की समस्या' },
      { en: 'PCOS / PCOD', te: 'పీసీఓఎస్ / పీసీఓడీ', hi: 'पीसीओएस / पीसीओडी' },
      { en: 'Fertility', te: 'సంతానోత్పత్తి', hi: 'प्रजनन क्षमता' },
    ],
  },
  {
    area: { en: 'Child Health', te: 'పిల్లల ఆరోగ్యం', hi: 'बाल स्वास्थ्य' },
    specialty: 'Pediatrics', icon: 'Baby',
    chips: [
      { en: 'Child fever', te: 'పిల్లల జ్వరం', hi: 'बच्चे का बुखार' },
      { en: 'Vaccination', te: 'టీకాలు', hi: 'टीकाकरण' },
      { en: 'Growth / weight', te: 'ఎదుగుదల / బరువు', hi: 'विकास / वजन' },
      { en: 'Newborn care', te: 'నవజాత శిశు సంరక్షణ', hi: 'नवजात देखभाल' },
    ],
  },
  {
    area: { en: 'Mind & Sleep', te: 'మనసు & నిద్ర', hi: 'मन और नींद' },
    specialty: 'Psychiatry', icon: 'Brain',
    chips: [
      { en: 'Anxiety / stress', te: 'ఆందోళన / ఒత్తిడి', hi: 'चिंता / तनाव' },
      { en: 'Depression', te: 'కుంగుబాటు', hi: 'डिप्रेशन' },
      { en: 'Sleep problems', te: 'నిద్ర సమస్యలు', hi: 'नींद की समस्या' },
      { en: 'Panic attacks', te: 'భయాందోళనలు', hi: 'पैनिक अटैक' },
    ],
  },
  {
    area: { en: 'Diet & Weight', te: 'ఆహారం & బరువు', hi: 'आहार और वजन' },
    specialty: 'Nutrition', icon: 'Apple',
    chips: [
      { en: 'Weight loss', te: 'బరువు తగ్గడం', hi: 'वजन घटाना' },
      { en: 'Weight gain', te: 'బరువు పెరగడం', hi: 'वजन बढ़ाना' },
      { en: 'Diet plan', te: 'ఆహార ప్రణాళిక', hi: 'डाइट प्लान' },
      { en: 'Healthy eating', te: 'ఆరోగ్యకర ఆహారం', hi: 'स्वस्थ आहार' },
    ],
  },
  {
    area: { en: 'Physiotherapy & Rehab', te: 'ఫిజియోథెరపీ & రిహాబ్', hi: 'फिजियोथेरेपी और रिहैब' },
    specialty: 'Physiotherapy', icon: 'PersonStanding',
    chips: [
      { en: 'Muscle stiffness', te: 'కండరాల బిగుసుదల', hi: 'मांसपेशियों में अकड़न' },
      { en: 'Post-injury recovery', te: 'గాయం తర్వాత కోలుకోవడం', hi: 'चोट के बाद रिकवरी' },
      { en: 'Posture / mobility', te: 'భంగిమ / కదలిక', hi: 'मुद्रा / गतिशीलता' },
      { en: 'Frozen shoulder', te: 'ఫ్రోజెన్ షోల్డర్', hi: 'फ्रोजन शोल्डर' },
    ],
  },
]

/** Lower-case, collapse whitespace — and make Indic text comparable.
 *
 *  Speech-to-text and phone keyboards emit zero-width joiners inside Telugu and
 *  Devanagari conjuncts, and sometimes a decomposed form of the same glyph. Two
 *  strings that look identical then fail `includes()`, which is how a spoken
 *  complaint could match no specialty at all and fall through to a general
 *  physician.
 */
const norm = (s) => String(s || '')
  .normalize('NFC')
  .replace(/[​-‍﻿]/g, '')
  // Telugu writes the same geminate either way — పళ్ళు and పళ్లు are one
  // word, as are కళ్ళు/కళ్లు and కీళ్ళ/కీళ్ల. Folding them here fixes the whole
  // table at once, including keywords added later, instead of listing both
  // spellings of every word forever.
  .replace(/ళ్ళ/g, 'ళ్ల')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

/** Localised label from a {en,te,hi} object (falls back to en). */
export const tr = (obj, lang = 'en') => (obj && (obj[lang] || obj.en)) || ''

/** True if the text contains an emergency red-flag term. */
export function isEmergency(text) {
  const t = norm(text)
  return !!t && EMERGENCY_KEYWORDS.some((k) => t.includes(norm(k)))
}

/**
 * Rank specialties for a free-text complaint. Returns
 * `[{ specialty, score, matched: [terms] }]`, best first, score-weighted so
 * longer/more-specific phrase matches beat single generic words.
 */
export function matchSpecialties(text) {
  const t = norm(text)
  if (!t) return []
  const results = []
  for (const [specialty, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
    let score = 0
    const matched = []
    const seen = new Set()
    for (const kw of keywords) {
      const k = norm(kw)
      if (!k || seen.has(k)) continue   // spelling variants fold to one term
      seen.add(k)
      if (t.includes(k)) {
        // Multi-word phrases are stronger signals than single words.
        score += k.includes(' ') ? 3 : 1
        matched.push(kw)
      }
    }
    if (score > 0) results.push({ specialty, score, matched })
  }
  return results.sort((a, b) => b.score - a.score)
}
