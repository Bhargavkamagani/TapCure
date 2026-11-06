/**
 * Symptom → specialty helper UI strings (en / te / hi).
 * Merged into the global dictionary in i18n/index.jsx.
 * The tappable area/chip labels and specialty names are translated in
 * data/symptomSpecialty.js (they double as matcher data).
 */
export const symptomT = {
  'symptom.button': {
    en: 'Not sure which doctor?',
    te: 'ఏ డాక్టర్‌ను చూడాలో తెలియదా?',
    hi: 'कौन सा डॉक्टर? पता नहीं?',
  },
  'symptom.badge': {
    en: 'Find the right doctor',
    te: 'సరైన డాక్టర్‌ను కనుగొనండి',
    hi: 'सही डॉक्टर खोजें',
  },
  'symptom.title': {
    en: 'Not sure which doctor to see?',
    te: 'ఏ డాక్టర్‌ను చూడాలో తెలియదా?',
    hi: 'कौन सा डॉक्टर दिखाएं, पता नहीं?',
  },
  'symptom.subtitle': {
    en: "Tell us what's bothering you and we'll point you to the right specialist.",
    te: 'మీ సమస్య చెప్పండి, సరైన నిపుణుడిని మేము సూచిస్తాం.',
    hi: 'अपनी समस्या बताएं, हम आपको सही विशेषज्ञ बताएंगे।',
  },
  'symptom.placeholder': {
    en: 'Describe your problem — e.g. chest pain, skin rash, toothache',
    te: 'మీ సమస్యను వివరించండి — ఉదా. ఛాతీ నొప్పి, చర్మ దద్దుర్లు, పంటి నొప్పి',
    hi: 'अपनी समस्या बताएं — जैसे छाती में दर्द, त्वचा पर चकत्ते, दांत दर्द',
  },
  'symptom.emergencyTitle': {
    en: 'This may be an emergency.',
    te: 'ఇది అత్యవసర పరిస్థితి కావచ్చు.',
    hi: 'यह आपातकाल हो सकता है।',
  },
  'symptom.emergencyBody': {
    en: "Please call an ambulance (dial 108) or go to the nearest hospital emergency room right away — don't wait for an appointment.",
    te: 'దయచేసి అంబులెన్స్ (108) కు కాల్ చేయండి లేదా వెంటనే సమీప ఆసుపత్రి అత్యవసర విభాగానికి వెళ్లండి — అపాయింట్‌మెంట్ కోసం వేచి ఉండకండి.',
    hi: 'कृपया एम्बुलेंस (108) को कॉल करें या तुरंत नज़दीकी अस्पताल के आपातकालीन कक्ष में जाएं — अपॉइंटमेंट का इंतज़ार न करें।',
  },
  'symptom.suggested': {
    en: 'Suggested specialists',
    te: 'సూచించిన నిపుణులు',
    hi: 'सुझाए गए विशेषज्ञ',
  },
  'symptom.bestMatch': {
    en: 'Best match',
    te: 'ఉత్తమ సరిపోలిక',
    hi: 'सबसे उपयुक्त',
  },
  'symptom.matchesLabel': {
    en: 'Matches',
    te: 'సరిపోలికలు',
    hi: 'मिलान',
  },
  'symptom.showDoctors': {
    en: 'Show doctors',
    te: 'డాక్టర్లను చూపించు',
    hi: 'डॉक्टर दिखाएं',
  },
  'symptom.noMatch': {
    en: 'We couldn’t match that to a specialty. Try simpler words (like "cough" or "knee pain"), or tap a common issue below.',
    te: 'మేము దానిని ఒక విభాగానికి సరిపోల్చలేకపోయాం. సులభమైన పదాలు ప్రయత్నించండి (ఉదా. "దగ్గు" లేదా "మోకాలి నొప్పి"), లేదా క్రింద ఒక సాధారణ సమస్యను నొక్కండి.',
    hi: 'हम इसे किसी विशेषज्ञता से मिला नहीं पाए। सरल शब्द आज़माएं (जैसे "खांसी" या "घुटने का दर्द"), या नीचे कोई सामान्य समस्या चुनें।',
  },
  'symptom.gpFallback': {
    en: 'See a General Physician',
    te: 'జనరల్ ఫిజీషియన్‌ను చూడండి',
    hi: 'जनरल फिजिशियन को दिखाएं',
  },
  'symptom.orTap': {
    en: 'Or tap a common issue',
    te: 'లేదా ఒక సాధారణ సమస్యను నొక్కండి',
    hi: 'या कोई सामान्य समस्या चुनें',
  },
  'symptom.disclaimer': {
    en: 'This is general guidance to help you choose a doctor, not a medical diagnosis. When in doubt, a General Physician can assess you and refer you further.',
    te: 'ఇది సరైన డాక్టర్‌ను ఎంచుకోవడంలో సహాయపడే సాధారణ మార్గదర్శకం మాత్రమే, వైద్య నిర్ధారణ కాదు. సందేహం ఉంటే, జనరల్ ఫిజీషియన్ మిమ్మల్ని పరీక్షించి తగిన నిపుణుడికి సూచిస్తారు.',
    hi: 'यह सही डॉक्टर चुनने में मदद के लिए सामान्य मार्गदर्शन है, चिकित्सा निदान नहीं। संदेह होने पर, जनरल फिजिशियन आपकी जांच कर आगे रेफर कर सकते हैं।',
  },
  'symptom.showing': {
    en: 'Showing {specialty}',
    te: '{specialty} చూపిస్తోంది',
    hi: '{specialty} दिखा रहे हैं',
  },
  'symptom.clearAll': {
    en: 'Clear filter and show all doctors',
    te: 'ఫిల్టర్ తొలగించి అందరు డాక్టర్లను చూపించు',
    hi: 'फ़िल्टर हटाएं और सभी डॉक्टर दिखाएं',
  },
  'symptom.noneFound': {
    en: 'No {specialty} doctors found.',
    te: '{specialty} డాక్టర్లు కనబడలేదు.',
    hi: 'कोई {specialty} डॉक्टर नहीं मिला।',
  },
  'symptom.noneFoundRadius': {
    en: 'No {specialty} doctors found within {radius} km.',
    te: '{radius} కి.మీ లోపు {specialty} డాక్టర్లు కనబడలేదు.',
    hi: '{radius} किमी के भीतर कोई {specialty} डॉक्टर नहीं मिला।',
  },
}
