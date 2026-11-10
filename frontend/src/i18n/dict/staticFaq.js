/**
 * Telugu/Hindi strings added in the 2026-09-19 translation sweep (staticFaq).
 *
 * sfaq.*  — pages/static/FAQ.jsx
 * sart.*  — pages/static/HealthArticles.jsx (+ data/healthArticles.js content, by index)
 * sres.*  — pages/static/Resources.jsx
 * scalc.* — pages/static/Calculators.jsx
 */
export const staticFaqT = {
  // ─────────────────────────── FAQ page ───────────────────────────
  'sfaq.eyebrow': { en: '{brand} Help Center', te: '{brand} సహాయ కేంద్రం', hi: '{brand} सहायता केंद्र' },
  'sfaq.title': { en: 'Frequently Asked Questions', te: 'తరచుగా అడిగే ప్రశ్నలు', hi: 'अक्सर पूछे जाने वाले सवाल' },
  'sfaq.subtitle': {
    en: 'Answers for patients, hospitals and doctors — pick who you are to see the questions that matter to you.',
    te: 'రోగులు, ఆసుపత్రులు మరియు డాక్టర్ల కోసం సమాధానాలు — మీకు సంబంధించిన ప్రశ్నలు చూడటానికి మీరు ఎవరో ఎంచుకోండి.',
    hi: 'मरीज़ों, अस्पतालों और डॉक्टरों के लिए जवाब — अपने काम के सवाल देखने के लिए चुनें कि आप कौन हैं।',
  },
  'sfaq.stillQ': { en: 'Still have questions?', te: 'ఇంకా ప్రశ్నలు ఉన్నాయా?', hi: 'अब भी कोई सवाल है?' },
  'sfaq.stillBody': {
    en: 'Our team is happy to help with bookings, hospital onboarding, or anything else about {brand}.',
    te: 'బుకింగ్‌లు, ఆసుపత్రి ఆన్‌బోర్డింగ్ లేదా {brand} గురించి మరేదైనా విషయంలో మా బృందం సంతోషంగా సహాయం చేస్తుంది.',
    hi: 'बुकिंग, अस्पताल ऑनबोर्डिंग या {brand} से जुड़ी किसी भी बात में हमारी टीम ख़ुशी से मदद करेगी।',
  },
  'sfaq.contact': { en: 'Contact Us', te: 'మమ్మల్ని సంప్రదించండి', hi: 'संपर्क करें' },

  // FAQ redesign (2026-11-07): search, groups, new pricing answers.
  'sfaq.h1a': { en: 'Questions?', te: 'ప్రశ్నలు ఉన్నాయా?', hi: 'कोई सवाल?' },
  'sfaq.h1b': { en: 'Ask away.', te: 'అడగండి.', hi: 'पूछिए।' },
  'sfaq.searchPh': { en: 'Type your question…', te: 'మీ ప్రశ్న టైప్ చేయండి…', hi: 'अपना सवाल लिखें…' },
  'sfaq.clear': { en: 'Clear search', te: 'వెతుకుట తొలగించు', hi: 'खोज साफ़ करें' },
  'sfaq.try': { en: 'Try:', te: 'ప్రయత్నించండి:', hi: 'आज़माएँ:' },
  'sfaq.tryWords': { en: 'fee|family|walk-in|30 days', te: 'ఫీజు|కుటుంబ|టోకెన్|30 రోజులు', hi: 'शुल्क|परिवार|टोकन|30 दिन' },
  'sfaq.for': { en: 'Questions for', te: 'ఎవరి ప్రశ్నలు', hi: 'किसके सवाल' },
  'sfaq.hits': { en: '{n} answers', te: '{n} సమాధానాలు', hi: '{n} जवाब' },
  'sfaq.hit1': { en: '1 answer', te: '1 సమాధానం', hi: '1 जवाब' },
  'sfaq.none': { en: 'No answer for "{q}" yet.', te: '"{q}" కి ఇంకా సమాధానం లేదు.', hi: '"{q}" का अभी कोई जवाब नहीं है।' },
  'sfaq.askTeam': { en: 'Ask our team', te: 'మా బృందాన్ని అడగండి', hi: 'हमारी टीम से पूछें' },
  'sfaq.stillLine': { en: 'Still have a question?', te: 'ఇంకా ప్రశ్న ఉందా?', hi: 'अब भी कोई सवाल है?' },
  'sfaq.contactTeam': { en: 'Contact our team', te: 'మా బృందాన్ని సంప్రదించండి', hi: 'हमारी टीम से संपर्क करें' },
  'sfaq.seePrice': { en: 'See your exact price', te: 'మీ సరైన ధర చూడండి', hi: 'अपनी सही कीमत देखें' },
  'sfaq.readPrivacy': { en: 'Read the Privacy Policy', te: 'ప్రైవసీ పాలసీ చదవండి', hi: 'प्राइवेसी पॉलिसी पढ़ें' },
  'sfaq.who.patient': { en: 'For patients', te: 'రోగుల కోసం', hi: 'मरीज़ों के लिए' },
  'sfaq.who.hospital': { en: 'For hospitals', te: 'ఆసుపత్రుల కోసం', hi: 'अस्पतालों के लिए' },
  'sfaq.who.doctor': { en: 'For doctors', te: 'డాక్టర్ల కోసం', hi: 'डॉक्टरों के लिए' },
  'sfaq.g.start': { en: 'Getting started', te: 'మొదలుపెట్టడం', hi: 'शुरुआत' },
  'sfaq.g.booking': { en: 'Booking and fees', te: 'బుకింగ్ మరియు ఫీజులు', hi: 'बुकिंग और शुल्क' },
  'sfaq.g.queue': { en: 'Token and queue', te: 'టోకెన్ మరియు క్యూ', hi: 'टोकन और कतार' },
  'sfaq.g.data': { en: 'Prescriptions and your data', te: 'ప్రిస్క్రిప్షన్లు మరియు మీ డేటా', hi: 'प्रिस्क्रिप्शन और आपका डेटा' },
  'sfaq.g.joining': { en: 'Joining', te: 'చేరడం', hi: 'जुड़ना' },
  'sfaq.g.price': { en: 'Price', te: 'ధర', hi: 'कीमत' },
  'sfaq.g.opd': { en: 'Running your OPD', te: 'మీ OPD నిర్వహణ', hi: 'अपना OPD चलाना' },
  'sfaq.g.practice': { en: 'Your practice', te: 'మీ ప్రాక్టీస్', hi: 'आपकी प्रैक्टिस' },
  'sfaq.hospital.after.q': { en: 'What happens after the 30 free days?', te: '30 ఉచిత రోజుల తర్వాత ఏమవుతుంది?', hi: '30 मुफ़्त दिनों के बाद क्या होगा?' },
  'sfaq.hospital.after.a': {
    en: "Pick a plan from your dashboard. If you don't, online bookings pause. Walk-ins and your records keep working.",
    te: 'మీ డాష్‌బోర్డ్ నుంచి ప్లాన్ ఎంచుకోండి. ఎంచుకోకపోతే ఆన్‌లైన్ బుకింగ్‌లు ఆగిపోతాయి. నేరుగా వచ్చేవారు, మీ రికార్డులు పనిచేస్తూనే ఉంటాయి.',
    hi: 'अपने डैशबोर्ड से प्लान चुनें। न चुनें तो ऑनलाइन बुकिंग रुक जाती है। सीधे आने वाले मरीज़ और आपके रिकॉर्ड चलते रहते हैं।',
  },
  'sfaq.hospital.walkinCount.q': { en: 'Do walk-in patients count as bookings?', te: 'నేరుగా వచ్చే పేషెంట్లు బుకింగ్‌లుగా లెక్కకు వస్తారా?', hi: 'क्या सीधे आने वाले मरीज़ बुकिंग में गिने जाते हैं?' },
  'sfaq.hospital.walkinCount.a': {
    en: 'No. Walk-ins are free and unlimited on every plan.',
    te: 'లేదు. ప్రతి ప్లాన్‌లో నేరుగా వచ్చేవారు ఉచితం, అపరిమితం.',
    hi: 'नहीं। हर प्लान में सीधे आने वाले मरीज़ मुफ़्त और असीमित हैं।',
  },

  'sfaq.patient.label': { en: 'For Patients', te: 'రోగుల కోసం', hi: 'मरीज़ों के लिए' },
  'sfaq.hospital.label': { en: 'For Hospitals', te: 'ఆసుపత్రుల కోసం', hi: 'अस्पतालों के लिए' },
  'sfaq.doctor.label': { en: 'For Doctors', te: 'డాక్టర్ల కోసం', hi: 'डॉक्टरों के लिए' },

  // Patients
  'sfaq.patient.what.q': { en: 'What is TapCure?', te: 'TapCure అంటే ఏమిటి?', hi: 'TapCure क्या है?' },
  'sfaq.patient.what.a': {
    en: 'TapCure is an online doctor appointment and digital OP queue management platform for patients, doctors, and hospitals.',
    te: 'TapCure అనేది రోగులు, డాక్టర్లు మరియు ఆసుపత్రుల కోసం ఆన్‌లైన్ డాక్టర్ అపాయింట్‌మెంట్ మరియు డిజిటల్ OP క్యూ నిర్వహణ ప్లాట్‌ఫామ్.',
    hi: 'TapCure मरीज़ों, डॉक्टरों और अस्पतालों के लिए ऑनलाइन डॉक्टर अपॉइंटमेंट और डिजिटल OP कतार प्रबंधन प्लेटफ़ॉर्म है।',
  },
  'sfaq.patient.hospital.q': { en: 'Is TapCure a hospital?', te: 'TapCure ఒక ఆసుపత్రా?', hi: 'क्या TapCure एक अस्पताल है?' },
  'sfaq.patient.hospital.a': {
    en: 'No. TapCure is a technology platform. Medical services are provided by independent doctors and hospitals.',
    te: 'కాదు. TapCure ఒక టెక్నాలజీ ప్లాట్‌ఫామ్. వైద్య సేవలను స్వతంత్ర డాక్టర్లు మరియు ఆసుపత్రులు అందిస్తాయి.',
    hi: 'नहीं। TapCure एक टेक्नोलॉजी प्लेटफ़ॉर्म है। चिकित्सा सेवाएँ स्वतंत्र डॉक्टर और अस्पताल देते हैं।',
  },
  'sfaq.patient.booking.q': { en: 'How does online token booking work?', te: 'ఆన్‌లైన్ టోకెన్ బుకింగ్ ఎలా పనిచేస్తుంది?', hi: 'ऑनलाइन टोकन बुकिंग कैसे काम करती है?' },
  'sfaq.patient.booking.a': {
    en: 'Search for a doctor, select a slot, and confirm your booking to receive a digital OP token. There is no platform booking fee.',
    te: 'డాక్టర్‌ను వెతికి, స్లాట్‌ను ఎంచుకుని, బుకింగ్‌ను ధృవీకరించండి. మీకు డిజిటల్ OP టోకెన్ వస్తుంది. ప్లాట్‌ఫారమ్ బుకింగ్ ఫీజు లేదు.',
    hi: 'डॉक्टर खोजें, स्लॉट चुनें और बुकिंग की पुष्टि करें। आपको डिजिटल OP टोकन मिलेगा। बुकिंग के लिए कोई प्लेटफ़ॉर्म शुल्क नहीं है।',
  },
  /*
  //   en: 'You search for a doctor, select a slot, pay the platform fee, and receive a digital OP token number.',
  //   te: 'మీరు డాక్టర్‌ను వెతికి, ఒక స్లాట్ ఎంచుకుని, ప్లాట్‌ఫామ్ ఫీజు చెల్లిస్తే, మీకు డిజిటల్ OP టోకెన్ నంబర్ వస్తుంది.',
  //   hi: 'आप डॉक्टर खोजते हैं, स्लॉट चुनते हैं, प्लेटफ़ॉर्म फ़ीस चुकाते हैं और आपको डिजिटल OP टोकन नंबर मिल जाता है।',
  */
  // Previous fee question: 'sfaq.patient.cost.q': { en: 'How much does TapCure charge?', te: 'TapCure ఎంత ఛార్జ్ చేస్తుంది?', hi: 'TapCure कितना शुल्क लेता है?' },
  'sfaq.patient.cost.q': { en: 'Is there a fee to book an appointment?', te: 'అపాయింట్‌మెంట్ బుక్ చేయడానికి ఫీజు ఉందా?', hi: 'क्या अपॉइंटमेंट बुक करने का कोई शुल्क है?' },
  'sfaq.patient.cost.a': {
    en: 'No. There is no platform fee for booking. The doctor’s consultation fee, if applicable, is paid separately at the hospital.',
    te: 'లేదు. బుకింగ్‌కు ప్లాట్‌ఫారమ్ ఫీజు లేదు. వర్తిస్తే, డాక్టర్ కన్సల్టేషన్ ఫీజును ఆసుపత్రిలో విడిగా చెల్లించాలి.',
    hi: 'नहीं। बुकिंग के लिए कोई प्लेटफ़ॉर्म शुल्क नहीं है। यदि लागू हो, तो डॉक्टर की परामर्श फ़ीस अस्पताल में अलग से दी जाती है।',
  },
  /*
  //   en: 'TapCure charges only a ₹10 platform fee for online token booking.',
  //   te: 'ఆన్‌లైన్ టోకెన్ బుకింగ్ కోసం TapCure కేవలం ₹10 ప్లాట్‌ఫామ్ ఫీజు మాత్రమే తీసుకుంటుంది.',
  //   hi: 'ऑनलाइन टोकन बुकिंग के लिए TapCure सिर्फ़ ₹10 प्लेटफ़ॉर्म फ़ीस लेता है।',
  */
  'sfaq.patient.consultFee.q': { en: 'Do I pay the doctor consultation fee online?', te: 'డాక్టర్ కన్సల్టేషన్ ఫీజు ఆన్‌లైన్‌లో చెల్లించాలా?', hi: 'क्या डॉक्टर की परामर्श फ़ीस ऑनलाइन चुकानी होती है?' },
  'sfaq.patient.consultFee.a': {
    en: 'No. You pay the doctor consultation fee directly at the hospital.',
    te: 'లేదు. డాక్టర్ కన్సల్టేషన్ ఫీజును మీరు నేరుగా ఆసుపత్రిలోనే చెల్లిస్తారు.',
    hi: 'नहीं। डॉक्टर की परामर्श फ़ीस आप सीधे अस्पताल में चुकाते हैं।',
  },
  'sfaq.patient.token.q': { en: 'What is a digital OP token?', te: 'డిజిటల్ OP టోకెన్ అంటే ఏమిటి?', hi: 'डिजिटल OP टोकन क्या है?' },
  'sfaq.patient.token.a': {
    en: 'A digital OP token is your queue number for the selected doctor or hospital session.',
    te: 'మీరు ఎంచుకున్న డాక్టర్ లేదా ఆసుపత్రి సెషన్‌లో మీ క్యూ నంబరే డిజిటల్ OP టోకెన్.',
    hi: 'डिजिटल OP टोकन चुने गए डॉक्टर या अस्पताल सेशन में आपका कतार नंबर है।',
  },
  'sfaq.patient.track.q': { en: 'Can I track the current token?', te: 'ప్రస్తుత టోకెన్‌ను నేను ట్రాక్ చేయవచ్చా?', hi: 'क्या मौजूदा टोकन ट्रैक किया जा सकता है?' },
  'sfaq.patient.track.a': {
    en: 'Yes. If the hospital updates queue status, you can view the current running token and your token number from your phone.',
    te: 'అవును. ఆసుపత్రి క్యూ స్థితిని అప్‌డేట్ చేస్తుంటే, ప్రస్తుతం నడుస్తున్న టోకెన్‌ను మరియు మీ టోకెన్ నంబర్‌ను మీ ఫోన్‌లోనే చూడవచ్చు.',
    hi: 'हाँ। अगर अस्पताल कतार की स्थिति अपडेट करता है, तो आप अपने फ़ोन पर अभी चल रहा टोकन और अपना टोकन नंबर देख सकते हैं।',
  },
  'sfaq.patient.travel.q': { en: 'What is smart travel timing?', te: 'స్మార్ట్ ట్రావెల్ టైమింగ్ అంటే ఏమిటి?', hi: 'स्मार्ट ट्रैवल टाइमिंग क्या है?' },
  'sfaq.patient.travel.a': {
    en: 'Smart travel timing estimates when you should start from home based on your token, the current queue, and your travel time — so you reach the hospital at the right moment.',
    te: 'మీ టోకెన్, ప్రస్తుత క్యూ మరియు మీ ప్రయాణ సమయం ఆధారంగా మీరు ఇంటి నుండి ఎప్పుడు బయలుదేరాలో స్మార్ట్ ట్రావెల్ టైమింగ్ అంచనా వేస్తుంది — దీంతో మీరు సరైన సమయానికి ఆసుపత్రికి చేరుకుంటారు.',
    hi: 'स्मार्ट ट्रैवल टाइमिंग आपके टोकन, मौजूदा कतार और आपके सफ़र के समय के आधार पर अंदाज़ा लगाती है कि आपको घर से कब निकलना चाहिए — ताकि आप सही समय पर अस्पताल पहुँचें।',
  },
  'sfaq.patient.family.q': { en: 'Can I book for my family member?', te: 'నా కుటుంబ సభ్యుల కోసం బుక్ చేయవచ్చా?', hi: 'क्या परिवार के सदस्य के लिए बुकिंग की जा सकती है?' },
  'sfaq.patient.family.a': {
    en: 'Yes. You can add up to 5 family members and book appointments for them. Each member can have their own profile, and you can choose to send their reminders to their own mobile number.',
    te: 'అవును. మీరు గరిష్టంగా 5 మంది కుటుంబ సభ్యులను జోడించి వారి కోసం అపాయింట్‌మెంట్లు బుక్ చేయవచ్చు. ప్రతి సభ్యునికి సొంత ప్రొఫైల్ ఉండవచ్చు, వారి రిమైండర్లను వారి సొంత మొబైల్ నంబర్‌కే పంపేలా మీరు ఎంచుకోవచ్చు.',
    hi: 'हाँ। आप परिवार के अधिकतम 5 सदस्य जोड़कर उनके लिए अपॉइंटमेंट बुक कर सकते हैं। हर सदस्य की अपनी प्रोफ़ाइल हो सकती है, और आप चाहें तो उनके रिमाइंडर उनके अपने मोबाइल नंबर पर भिजवा सकते हैं।',
  },
  'sfaq.patient.delay.q': { en: 'What happens if the doctor is delayed?', te: 'డాక్టర్ ఆలస్యమైతే ఏమవుతుంది?', hi: 'अगर डॉक्टर को देर हो जाए तो क्या होगा?' },
  'sfaq.patient.delay.a': {
    en: 'The hospital can send a delay alert through the platform, so you know before you leave home.',
    te: 'ఆసుపత్రి ప్లాట్‌ఫామ్ ద్వారా ఆలస్య హెచ్చరిక పంపగలదు, కాబట్టి మీరు ఇంటి నుండి బయలుదేరే ముందే మీకు తెలుస్తుంది.',
    hi: 'अस्पताल प्लेटफ़ॉर्म के ज़रिए देरी का अलर्ट भेज सकता है, ताकि घर से निकलने से पहले ही आपको पता चल जाए।',
  },
  'sfaq.patient.upload.q': { en: 'Can I upload prescriptions?', te: 'ప్రిస్క్రిప్షన్లు అప్‌లోడ్ చేయవచ్చా?', hi: 'क्या प्रिस्क्रिप्शन अपलोड किए जा सकते हैं?' },
  'sfaq.patient.upload.a': {
    // 2026-11-07: "where enabled" dropped — upload and medicine reminders are in the patient app.
    en: 'Yes. Upload prescriptions and lab reports from your phone, keep them in one place, and set medicine reminders.',
    te: 'అవును. మీ ఫోన్ నుంచి ప్రిస్క్రిప్షన్లు, ల్యాబ్ రిపోర్టులు అప్‌లోడ్ చేసి ఒకే చోట ఉంచుకోండి, మందుల రిమైండర్లు సెట్ చేసుకోండి.',
    hi: 'हाँ। अपने फ़ोन से प्रिस्क्रिप्शन और लैब रिपोर्ट अपलोड करें, उन्हें एक जगह रखें, और दवा के रिमाइंडर सेट करें।',
  },
  'sfaq.patient.ai.q': { en: 'Can AI explain my prescription?', te: 'AI నా ప్రిస్క్రిప్షన్‌ను వివరించగలదా?', hi: 'क्या AI मेरा प्रिस्क्रिप्शन समझा सकता है?' },
  'sfaq.patient.ai.a': {
    en: 'If enabled, AI explanation is only for general understanding. Always follow your doctor’s advice.',
    te: 'అందుబాటులో ఉంటే, AI వివరణ కేవలం సాధారణ అవగాహన కోసం మాత్రమే. ఎల్లప్పుడూ మీ డాక్టర్ సలహానే పాటించండి.',
    hi: 'अगर यह सुविधा चालू है, तो AI की व्याख्या सिर्फ़ सामान्य समझ के लिए है। हमेशा अपने डॉक्टर की सलाह मानें।',
  },
  'sfaq.patient.langs.q': { en: 'Which languages are supported?', te: 'ఏ భాషలు అందుబాటులో ఉన్నాయి?', hi: 'कौन-सी भाषाएँ उपलब्ध हैं?' },
  'sfaq.patient.langs.a': {
    en: 'TapCure supports English, Hindi, and Telugu — across the interface and voice booking.',
    te: 'TapCure ఇంగ్లీష్, హిందీ మరియు తెలుగు భాషలకు సపోర్ట్ చేస్తుంది — స్క్రీన్లలోనూ, వాయిస్ బుకింగ్‌లోనూ.',
    hi: 'TapCure अंग्रेज़ी, हिंदी और तेलुगु को सपोर्ट करता है — स्क्रीन पर भी और वॉइस बुकिंग में भी।',
  },
  'sfaq.patient.safe.q': { en: 'Is my data safe?', te: 'నా డేటా సురక్షితంగా ఉంటుందా?', hi: 'क्या मेरा डेटा सुरक्षित है?' },
  'sfaq.patient.safe.a': {
    en: 'We use reasonable security practices to protect your data. Please read our Privacy Policy for details.',
    te: 'మీ డేటాను రక్షించడానికి మేము తగిన భద్రతా పద్ధతులను ఉపయోగిస్తాము. వివరాల కోసం దయచేసి మా ప్రైవసీ పాలసీ చదవండి.',
    hi: 'आपके डेटा की सुरक्षा के लिए हम उचित सुरक्षा उपाय अपनाते हैं। विवरण के लिए कृपया हमारी प्राइवेसी पॉलिसी पढ़ें।',
  },

  // Hospitals
  'sfaq.hospital.join.q': { en: 'How can our hospital join TapCure?', te: 'మా ఆసుపత్రి TapCureలో ఎలా చేరవచ్చు?', hi: 'हमारा अस्पताल TapCure से कैसे जुड़ सकता है?' },
  'sfaq.hospital.join.a': {
    en: 'Use the “Register Your Hospital” option to submit your hospital details. Your registration is reviewed and approved before it goes live.',
    te: '“మీ ఆసుపత్రిని నమోదు చేయండి” ఆప్షన్ ద్వారా మీ ఆసుపత్రి వివరాలు సమర్పించండి. లైవ్‌లోకి వచ్చే ముందు మీ నమోదును పరిశీలించి ఆమోదిస్తారు.',
    hi: '“अपना अस्पताल रजिस्टर करें” विकल्प से अपने अस्पताल का विवरण भेजें। लाइव होने से पहले आपके रजिस्ट्रेशन की जाँच होती है और मंज़ूरी दी जाती है।',
  },
  'sfaq.hospital.cost.q': { en: 'What does it cost for hospitals?', te: 'ఆసుపత్రులకు ఖర్చు ఎంత?', hi: 'अस्पतालों के लिए इसकी क्या लागत है?' },
  'sfaq.hospital.cost.a': {
    // 2026-11-07: was "free during the initial launch, plans later" — the 30-day pilot and paid plans are live.
    en: 'Your first 30 days are free, starting on your first OPD day. After that, pick a plan from ₹499 a month (+ GST).',
    te: 'మీ మొదటి 30 రోజులు ఉచితం, మీ మొదటి OPD రోజు నుంచి. ఆ తర్వాత నెలకు ₹499 (+ GST) నుంచి ప్లాన్ ఎంచుకోండి.',
    hi: 'आपके पहले 30 दिन मुफ़्त हैं, आपके पहले OPD दिन से। उसके बाद ₹499 महीना (+ GST) से प्लान चुनें।',
  },
  'sfaq.hospital.queue.q': { en: 'How do we manage the OP queue?', te: 'OP క్యూను మేము ఎలా నిర్వహించాలి?', hi: 'हम OP कतार कैसे संभालें?' },
  'sfaq.hospital.queue.a': {
    en: 'The hospital dashboard shows the current token, next patients, waiting patients and completed visits, so your front desk can run the whole queue from one screen.',
    te: 'ఆసుపత్రి డాష్‌బోర్డ్‌లో ప్రస్తుత టోకెన్, తర్వాతి రోగులు, వేచి ఉన్న రోగులు మరియు పూర్తైన విజిట్‌లు కనిపిస్తాయి, కాబట్టి మీ ఫ్రంట్ డెస్క్ మొత్తం క్యూను ఒకే స్క్రీన్ నుండి నడపగలదు.',
    hi: 'अस्पताल डैशबोर्ड पर मौजूदा टोकन, अगले मरीज़, इंतज़ार कर रहे मरीज़ और पूरी हो चुकी विज़िट दिखती हैं, ताकि आपका फ़्रंट डेस्क पूरी कतार एक ही स्क्रीन से चला सके।',
  },
  'sfaq.hospital.walkin.q': { en: 'Can we add walk-in patients?', te: 'వాక్-ఇన్ రోగులను జోడించవచ్చా?', hi: 'क्या हम वॉक-इन मरीज़ जोड़ सकते हैं?' },
  'sfaq.hospital.walkin.a': {
    en: 'Yes. Walk-in (offline) patients can be added into the same digital queue alongside online bookings.',
    te: 'అవును. వాక్-ఇన్ (ఆఫ్‌లైన్) రోగులను ఆన్‌లైన్ బుకింగ్‌లతో పాటు అదే డిజిటల్ క్యూలో జోడించవచ్చు.',
    hi: 'हाँ। वॉक-इन (ऑफ़लाइन) मरीज़ों को ऑनलाइन बुकिंग के साथ उसी डिजिटल कतार में जोड़ा जा सकता है।',
  },
  'sfaq.hospital.doctors.q': { en: 'Can we manage multiple doctors?', te: 'అనేక మంది డాక్టర్లను నిర్వహించవచ్చా?', hi: 'क्या हम कई डॉक्टरों को संभाल सकते हैं?' },
  'sfaq.hospital.doctors.a': {
    en: 'Yes. You can add multiple doctors, set their working hours, holidays and availability, and manage their appointments and queues.',
    te: 'అవును. మీరు అనేక మంది డాక్టర్లను జోడించి, వారి పని వేళలు, సెలవులు మరియు అందుబాటును సెట్ చేసి, వారి అపాయింట్‌మెంట్లు మరియు క్యూలను నిర్వహించవచ్చు.',
    hi: 'हाँ। आप कई डॉक्टर जोड़ सकते हैं, उनके काम के घंटे, छुट्टियाँ और उपलब्धता तय कर सकते हैं, और उनके अपॉइंटमेंट व कतारें संभाल सकते हैं।',
  },
  'sfaq.hospital.notify.q': { en: 'How do we notify patients about delays?', te: 'ఆలస్యం గురించి రోగులకు ఎలా తెలియజేయాలి?', hi: 'देरी के बारे में मरीज़ों को कैसे बताएँ?' },
  'sfaq.hospital.notify.a': {
    en: 'You can send a doctor-delay alert from the dashboard, and patients receive it before they travel.',
    te: 'డాష్‌బోర్డ్ నుండి డాక్టర్ ఆలస్య హెచ్చరిక పంపవచ్చు, రోగులు ప్రయాణం మొదలుపెట్టే ముందే అది వారికి అందుతుంది.',
    hi: 'आप डैशबोर्ड से डॉक्टर-देरी का अलर्ट भेज सकते हैं, और मरीज़ों को यह निकलने से पहले ही मिल जाता है।',
  },
  'sfaq.hospital.reports.q': { en: 'What reports do we get?', te: 'మాకు ఏ రిపోర్టులు వస్తాయి?', hi: 'हमें कौन-सी रिपोर्ट मिलती हैं?' },
  'sfaq.hospital.reports.a': {
    en: 'You get daily reports on appointments, queue status, no-shows and OP performance, including money actually collected across your doctors.',
    te: 'అపాయింట్‌మెంట్లు, క్యూ స్థితి, రాని రోగులు (no-shows) మరియు OP పనితీరుపై రోజువారీ రిపోర్టులు వస్తాయి — మీ డాక్టర్లందరి ద్వారా నిజంగా వసూలైన డబ్బుతో సహా.',
    hi: 'आपको अपॉइंटमेंट, कतार की स्थिति, न आने वाले मरीज़ों (no-shows) और OP प्रदर्शन पर रोज़ाना रिपोर्ट मिलती हैं — आपके सभी डॉक्टरों के ज़रिए असल में वसूले गए पैसे समेत।',
  },
  'sfaq.hospital.verify.q': { en: 'Who verifies our hospital?', te: 'మా ఆసుపత్రిని ఎవరు ధృవీకరిస్తారు?', hi: 'हमारे अस्पताल का सत्यापन कौन करता है?' },
  'sfaq.hospital.verify.a': {
    en: 'A platform administrator reviews and approves each hospital before it is published, to keep the directory trustworthy.',
    te: 'డైరెక్టరీ నమ్మదగినదిగా ఉండేందుకు, ప్రతి ఆసుపత్రిని ప్రచురించే ముందు ప్లాట్‌ఫామ్ అడ్మినిస్ట్రేటర్ పరిశీలించి ఆమోదిస్తారు.',
    hi: 'डायरेक्टरी भरोसेमंद बनी रहे, इसके लिए प्लेटफ़ॉर्म एडमिनिस्ट्रेटर हर अस्पताल को प्रकाशित करने से पहले जाँचकर मंज़ूरी देता है।',
  },

  // Doctors
  'sfaq.doctor.join.q': { en: 'How do I join TapCure as a doctor?', te: 'డాక్టర్‌గా TapCureలో ఎలా చేరాలి?', hi: 'डॉक्टर के रूप में TapCure से कैसे जुड़ें?' },
  'sfaq.doctor.join.a': {
    en: 'Use the doctor sign-up to register your independent practice. You’ll enter your professional details and upload credentials for verification.',
    te: 'మీ స్వతంత్ర ప్రాక్టీస్‌ను నమోదు చేయడానికి డాక్టర్ సైన్-అప్‌ను ఉపయోగించండి. మీ వృత్తిపరమైన వివరాలు నమోదు చేసి, ధృవీకరణ కోసం మీ సర్టిఫికెట్లను అప్‌లోడ్ చేస్తారు.',
    hi: 'अपनी स्वतंत्र प्रैक्टिस रजिस्टर करने के लिए डॉक्टर साइन-अप का उपयोग करें। आप अपनी पेशेवर जानकारी भरेंगे और सत्यापन के लिए अपने प्रमाण-पत्र अपलोड करेंगे।',
  },
  'sfaq.doctor.docs.q': { en: 'What documents do I need to upload?', te: 'నేను ఏ పత్రాలు అప్‌లోడ్ చేయాలి?', hi: 'मुझे कौन-से दस्तावेज़ अपलोड करने होंगे?' },
  'sfaq.doctor.docs.a': {
    en: 'Your medical registration certificate and degree certificate are required; a medical council proof and ID proof are optional but help speed up verification.',
    te: 'మీ మెడికల్ రిజిస్ట్రేషన్ సర్టిఫికెట్ మరియు డిగ్రీ సర్టిఫికెట్ తప్పనిసరి; మెడికల్ కౌన్సిల్ రుజువు మరియు ID రుజువు ఐచ్ఛికం, కానీ అవి ధృవీకరణను వేగవంతం చేస్తాయి.',
    hi: 'आपका मेडिकल रजिस्ट्रेशन सर्टिफ़िकेट और डिग्री सर्टिफ़िकेट ज़रूरी हैं; मेडिकल काउंसिल का प्रमाण और ID प्रमाण वैकल्पिक हैं, पर इनसे सत्यापन जल्दी होता है।',
  },
  'sfaq.doctor.verify.q': { en: 'How does verification work?', te: 'ధృవీకరణ ఎలా జరుగుతుంది?', hi: 'सत्यापन कैसे होता है?' },
  'sfaq.doctor.verify.a': {
    en: 'A platform administrator manually reviews your uploaded documents. Your account activates once approved — you’ll be notified, and can log in after that.',
    te: 'మీరు అప్‌లోడ్ చేసిన పత్రాలను ప్లాట్‌ఫామ్ అడ్మినిస్ట్రేటర్ స్వయంగా పరిశీలిస్తారు. ఆమోదం పొందగానే మీ ఖాతా యాక్టివేట్ అవుతుంది — మీకు సమాచారం వస్తుంది, ఆ తర్వాత లాగిన్ అవ్వవచ్చు.',
    hi: 'प्लेटफ़ॉर्म एडमिनिस्ट्रेटर आपके अपलोड किए दस्तावेज़ों की ख़ुद जाँच करता है। मंज़ूरी मिलते ही आपका खाता चालू हो जाता है — आपको सूचना मिलेगी, और उसके बाद आप लॉग इन कर सकते हैं।',
  },
  'sfaq.doctor.avail.q': { en: 'Can I manage my own availability and fees?', te: 'నా అందుబాటు మరియు ఫీజులను నేనే నిర్వహించవచ్చా?', hi: 'क्या अपनी उपलब्धता और फ़ीस ख़ुद तय की जा सकती है?' },
  'sfaq.doctor.avail.a': {
    en: 'Yes. You control your working hours, holidays, consultation fee and availability from your dashboard.',
    te: 'అవును. మీ పని వేళలు, సెలవులు, కన్సల్టేషన్ ఫీజు మరియు అందుబాటును మీ డాష్‌బోర్డ్ నుండి మీరే నియంత్రిస్తారు.',
    hi: 'हाँ। अपने काम के घंटे, छुट्टियाँ, परामर्श फ़ीस और उपलब्धता आप अपने डैशबोर्ड से ख़ुद नियंत्रित करते हैं।',
  },
  'sfaq.doctor.queue.q': { en: 'How do I see my live queue?', te: 'నా లైవ్ క్యూను ఎలా చూడాలి?', hi: 'मैं अपनी लाइव कतार कैसे देखूँ?' },
  'sfaq.doctor.queue.a': {
    en: 'Your dashboard shows a live queue of waiting patients so you can call them in order and keep the session moving.',
    te: 'మీ డాష్‌బోర్డ్‌లో వేచి ఉన్న రోగుల లైవ్ క్యూ కనిపిస్తుంది, దీంతో మీరు వారిని వరుసగా పిలుస్తూ సెషన్‌ను సాఫీగా నడపవచ్చు.',
    hi: 'आपके डैशबोर्ड पर इंतज़ार कर रहे मरीज़ों की लाइव कतार दिखती है, ताकि आप उन्हें क्रम से बुला सकें और सेशन चलता रहे।',
  },
  'sfaq.doctor.rx.q': { en: 'Can I write prescriptions on the platform?', te: 'ప్లాట్‌ఫామ్‌లో ప్రిస్క్రిప్షన్లు రాయవచ్చా?', hi: 'क्या प्लेटफ़ॉर्म पर प्रिस्क्रिप्शन लिखे जा सकते हैं?' },
  'sfaq.doctor.rx.a': {
    en: 'Yes. You can compose a prescription (diagnosis, medicines and advice) directly from the live queue, and it’s linked to that patient’s visit.',
    te: 'అవును. లైవ్ క్యూ నుండే నేరుగా ప్రిస్క్రిప్షన్ (నిర్ధారణ, మందులు మరియు సలహా) రాయవచ్చు, అది ఆ రోగి విజిట్‌కు లింక్ అవుతుంది.',
    hi: 'हाँ। आप लाइव कतार से ही सीधे प्रिस्क्रिप्शन (निदान, दवाएँ और सलाह) लिख सकते हैं, और यह उस मरीज़ की विज़िट से जुड़ जाता है।',
  },
  'sfaq.doctor.delay.q': { en: 'Can I send a delay alert to waiting patients?', te: 'వేచి ఉన్న రోగులకు ఆలస్య హెచ్చరిక పంపవచ్చా?', hi: 'क्या इंतज़ार कर रहे मरीज़ों को देरी का अलर्ट भेजा जा सकता है?' },
  'sfaq.doctor.delay.a': {
    en: 'Yes. If you’re running late, you can send a delay alert so waiting patients are informed before they travel.',
    te: 'అవును. మీరు ఆలస్యంగా వస్తుంటే, ఆలస్య హెచ్చరిక పంపవచ్చు — దీంతో వేచి ఉన్న రోగులకు ప్రయాణానికి ముందే తెలుస్తుంది.',
    hi: 'हाँ। अगर आपको देर हो रही है, तो आप देरी का अलर्ट भेज सकते हैं ताकि इंतज़ार कर रहे मरीज़ों को निकलने से पहले पता चल जाए।',
  },
  'sfaq.doctor.reports.q': { en: 'Do I get reports of my consultations?', te: 'నా కన్సల్టేషన్ల రిపోర్టులు నాకు వస్తాయా?', hi: 'क्या मुझे अपने परामर्शों की रिपोर्ट मिलती है?' },
  'sfaq.doctor.reports.a': {
    en: 'Yes. You get reports and analytics on your appointments, tokens and the consultation and booking fees actually collected.',
    te: 'అవును. మీ అపాయింట్‌మెంట్లు, టోకెన్లు మరియు నిజంగా వసూలైన కన్సల్టేషన్, బుకింగ్ ఫీజులపై రిపోర్టులు మరియు విశ్లేషణలు వస్తాయి.',
    hi: 'हाँ। आपको अपने अपॉइंटमेंट, टोकन और असल में वसूली गई परामर्श व बुकिंग फ़ीस पर रिपोर्ट और विश्लेषण मिलते हैं।',
  },
  'sfaq.doctor.multi.q': { en: 'Can I work at more than one hospital?', te: 'ఒకటి కంటే ఎక్కువ ఆసుపత్రుల్లో పని చేయవచ్చా?', hi: 'क्या एक से ज़्यादा अस्पतालों में काम किया जा सकता है?' },
  'sfaq.doctor.multi.a': {
    en: 'Yes. You can practise independently and/or be affiliated with hospitals — your personal practice and hospital work stay separated.',
    te: 'అవును. మీరు స్వతంత్రంగా ప్రాక్టీస్ చేయవచ్చు మరియు/లేదా ఆసుపత్రులతో అనుబంధంగా ఉండవచ్చు — మీ వ్యక్తిగత ప్రాక్టీస్ మరియు ఆసుపత్రి పని వేర్వేరుగానే ఉంటాయి.',
    hi: 'हाँ। आप स्वतंत्र रूप से प्रैक्टिस कर सकते हैं और/या अस्पतालों से जुड़ सकते हैं — आपकी निजी प्रैक्टिस और अस्पताल का काम अलग-अलग रहते हैं।',
  },
  'sfaq.doctor.cost.q': { en: 'Is there a cost for doctors?', te: 'డాక్టర్లకు ఏమైనా ఖర్చు ఉందా?', hi: 'क्या डॉक्टरों के लिए कोई शुल्क है?' },
  'sfaq.doctor.cost.a': {
    en: 'No. Doctors can use TapCure free during the initial launch period.',
    te: 'లేదు. ప్రారంభ లాంచ్ కాలంలో డాక్టర్లు TapCureను ఉచితంగా ఉపయోగించవచ్చు.',
    hi: 'नहीं। शुरुआती लॉन्च अवधि के दौरान डॉक्टर TapCure मुफ़्त इस्तेमाल कर सकते हैं।',
  },

  // ─────────────────────────── Health Articles page ───────────────────────────
  'sart.eyebrow': { en: '{brand} Health Articles', te: '{brand} ఆరోగ్య వ్యాసాలు', hi: '{brand} स्वास्थ्य लेख' },
  'sart.title': { en: 'Health Articles', te: 'ఆరోగ్య వ్యాసాలు', hi: 'स्वास्थ्य लेख' },
  'sart.subtitle': {
    en: 'Plain-language notes on common health conditions — what they are, what to watch for, and when to see a doctor. Written to help you ask better questions, not to answer them for you.',
    te: 'సాధారణ ఆరోగ్య సమస్యలపై సులభమైన భాషలో వివరణలు — అవి ఏమిటి, వేటిని గమనించాలి, డాక్టర్‌ను ఎప్పుడు కలవాలి. ఇవి మీ ప్రశ్నలకు జవాబులు ఇవ్వడానికి కాదు, మీరు మంచి ప్రశ్నలు అడగడానికి సహాయపడేందుకు రాసినవి.',
    hi: 'आम स्वास्थ्य समस्याओं पर आसान भाषा में जानकारी — ये क्या हैं, किन बातों पर ध्यान दें, और डॉक्टर को कब दिखाएँ। ये आपके सवालों के जवाब देने के लिए नहीं, बल्कि बेहतर सवाल पूछने में आपकी मदद के लिए लिखे गए हैं।',
  },
  'sart.disclaimerStrong': {
    en: 'These articles are general information, not medical advice.',
    te: 'ఈ వ్యాసాలు సాధారణ సమాచారం మాత్రమే, వైద్య సలహా కాదు.',
    hi: 'ये लेख सामान्य जानकारी हैं, चिकित्सा सलाह नहीं।',
  },
  'sart.disclaimerBody': {
    en: 'They cannot diagnose you, and no article can account for your own history, medicines or pregnancy. For anything about your health, ask a qualified doctor. In an emergency, go to the nearest hospital — do not wait to read.',
    te: 'ఇవి మీ వ్యాధిని నిర్ధారించలేవు, మీ వైద్య చరిత్ర, మీరు వాడే మందులు లేదా గర్భధారణను ఏ వ్యాసమూ పరిగణనలోకి తీసుకోలేదు. మీ ఆరోగ్యానికి సంబంధించిన ఏ విషయమైనా అర్హత కలిగిన డాక్టర్‌ను అడగండి. అత్యవసర పరిస్థితిలో దగ్గరలోని ఆసుపత్రికి వెళ్లండి — చదువుతూ ఆలస్యం చేయకండి.',
    hi: 'ये आपकी बीमारी का निदान नहीं कर सकते, और कोई भी लेख आपके स्वास्थ्य इतिहास, दवाओं या गर्भावस्था को ध्यान में नहीं रख सकता। अपनी सेहत से जुड़ी किसी भी बात के लिए योग्य डॉक्टर से पूछें। आपात स्थिति में नज़दीकी अस्पताल जाएँ — पढ़ने में समय न गँवाएँ।',
  },
  'sart.all': { en: 'All', te: 'అన్నీ', hi: 'सभी' },
  'sart.minRead': { en: '{n} min read', te: '{n} నిమిషాల పఠనం', hi: '{n} मिनट में पढ़ें' },
  'sart.whenDoctor': { en: 'When to see a doctor: ', te: 'డాక్టర్‌ను ఎప్పుడు కలవాలి: ', hi: 'डॉक्टर को कब दिखाएँ: ' },
  'sart.readMore': { en: 'Read More', te: 'ఇంకా చదవండి', hi: 'और पढ़ें' },
  'sart.consultTitle': { en: 'Consult a {specialty} doctor', te: '{specialty} డాక్టర్‌ను సంప్రదించండి', hi: '{specialty} डॉक्टर से परामर्श लें' },
  'sart.consultSub': { en: 'Verified doctors on TapCure you can book today.', te: 'ఈరోజే బుక్ చేసుకోగల TapCure ధృవీకరించిన డాక్టర్లు.', hi: 'TapCure के सत्यापित डॉक्टर, आज ही बुक करें।' },
  'sart.seeAllDoctors': { en: 'See all {specialty} doctors', te: 'అన్ని {specialty} డాక్టర్లను చూడండి', hi: 'सभी {specialty} डॉक्टर देखें' },
  'sart.showLess': { en: 'Show less', te: 'తక్కువ చూపించు', hi: 'कम दिखाएँ' },
  'sart.news.eyebrow': { en: 'Public health updates', te: 'ప్రజారోగ్య అప్‌డేట్‌లు', hi: 'जन स्वास्थ्य अपडेट' },
  'sart.news.title': { en: 'From official health newsrooms', te: 'అధికారిక ఆరోగ్య న్యూస్‌రూమ్‌ల నుండి', hi: 'आधिकारिक स्वास्थ्य न्यूज़रूम से' },
  'sart.news.sub': {
    en: 'Published by the organisations named on each item, not by {brand}. Links open on their site.',
    te: 'వీటిని ప్రచురించింది ప్రతి అంశంపై పేర్కొన్న సంస్థలు, {brand} కాదు. లింక్‌లు వారి వెబ్‌సైట్‌లో తెరుచుకుంటాయి.',
    hi: 'इन्हें हर आइटम पर लिखे संगठनों ने प्रकाशित किया है, {brand} ने नहीं। लिंक उनकी साइट पर खुलते हैं।',
  },
  'sart.news.readOn': { en: 'Read on {source}', te: '{source}లో చదవండి', hi: '{source} पर पढ़ें' },
  // Redesigned page (2026-11-07): search, photo cards, full-page reader.
  'sart.lede': { en: 'Simple notes on common health problems, and when to see a doctor.', te: 'సాధారణ ఆరోగ్య సమస్యలపై సులభమైన వ్యాసాలు, డాక్టర్‌ను ఎప్పుడు కలవాలో కూడా.', hi: 'आम स्वास्थ्य समस्याओं पर आसान लेख, और डॉक्टर को कब दिखाएँ।' },
  'sart.searchPh': { en: "What's worrying you? Fever, sugar, chest pain…", te: 'మిమ్మల్ని ఏది బాధపెడుతోంది? జ్వరం, షుగర్, ఛాతీ నొప్పి…', hi: 'आपको किस बात की चिंता है? बुखार, शुगर, सीने में दर्द…' },
  'sart.searchLabel': { en: 'Search health articles', te: 'ఆరోగ్య వ్యాసాలను వెతకండి', hi: 'स्वास्थ्य लेख खोजें' },
  'sart.clear': { en: 'Clear', te: 'తొలగించు', hi: 'साफ़ करें' },
  'sart.count': { en: '{n} articles', te: '{n} వ్యాసాలు', hi: '{n} लेख' },
  'sart.count1': { en: '1 article', te: '1 వ్యాసం', hi: '1 लेख' },
  'sart.countIn': { en: '{count} in {tag}', te: '{tag}లో {count}', hi: '{tag} में {count}' },
  'sart.countFor': { en: '{count} for “{q}”', te: '“{q}” కోసం {count}', hi: '“{q}” के लिए {count}' },
  'sart.none': { en: 'Nothing found. If you are unwell,', te: 'ఏమీ దొరకలేదు. మీకు ఆరోగ్యం బాగోలేకపోతే,', hi: 'कुछ नहीं मिला। अगर आपकी तबीयत ठीक नहीं है,' },
  'sart.findDoctor': { en: 'find a doctor near you', te: 'మీ దగ్గర డాక్టర్‌ను కనుగొనండి', hi: 'अपने पास डॉक्टर खोजें' },
  'sart.readMins': { en: 'Read · {n} min', te: 'చదవండి · {n} నిమి', hi: 'पढ़ें · {n} मिनट' },
  'sart.back': { en: 'All Articles', te: 'అన్ని వ్యాసాలు', hi: 'सभी लेख' },
  'sart.close': { en: 'Close', te: 'మూసివేయి', hi: 'बंद करें' },
  'sart.shortNote': { en: 'General information, not medical advice. In an emergency, go to the nearest hospital.', te: 'ఇది సాధారణ సమాచారం, వైద్య సలహా కాదు. అత్యవసర పరిస్థితిలో దగ్గరి ఆసుపత్రికి వెళ్లండి.', hi: 'यह सामान्य जानकारी है, चिकित्सा सलाह नहीं। आपात स्थिति में नज़दीकी अस्पताल जाएँ।' },
  'sart.whenDoctorHead': { en: 'When to see a doctor', te: 'డాక్టర్‌ను ఎప్పుడు కలవాలి', hi: 'डॉक्टर को कब दिखाएँ' },
  'sart.bookTitle': { en: 'Book a {specialty} doctor', te: '{specialty} డాక్టర్‌ను బుక్ చేయండి', hi: '{specialty} डॉक्टर बुक करें' },
  'sart.bookSub': { en: 'Verified doctors on TapCure.', te: 'TapCure ధృవీకరించిన డాక్టర్లు.', hi: 'TapCure के सत्यापित डॉक्टर।' },
  'sart.news.head': { en: 'Health News', te: 'ఆరోగ్య వార్తలు', hi: 'स्वास्थ्य समाचार' },
  'sart.news.subShort': { en: 'From official health newsrooms. Links open on their site.', te: 'అధికారిక ఆరోగ్య న్యూస్‌రూమ్‌ల నుండి. లింక్‌లు వారి సైట్‌లో తెరుచుకుంటాయి.', hi: 'आधिकारिक स्वास्थ्य न्यूज़रूम से। लिंक उनकी साइट पर खुलते हैं।' },

  // Article tags (keyed by the English tag in data/healthArticles.js)
  'sart.tag.Heart Health': { en: 'Heart Health', te: 'గుండె ఆరోగ్యం', hi: 'हृदय स्वास्थ्य' },
  'sart.tag.Diabetes': { en: 'Diabetes', te: 'మధుమేహం', hi: 'डायबिटीज़' },
  'sart.tag.Child Health': { en: 'Child Health', te: 'పిల్లల ఆరోగ్యం', hi: 'बच्चों का स्वास्थ्य' },
  'sart.tag.Medicines': { en: 'Medicines', te: 'మందులు', hi: 'दवाएँ' },
  'sart.tag.Women’s Health': { en: 'Women’s Health', te: 'మహిళల ఆరోగ్యం', hi: 'महिलाओं का स्वास्थ्य' },
  'sart.tag.Prevention': { en: 'Prevention', te: 'నివారణ', hi: 'बचाव' },
  'sart.tag.Mental Health': { en: 'Mental Health', te: 'మానసిక ఆరోగ్యం', hi: 'मानसिक स्वास्थ्य' },
  'sart.tag.Nutrition': { en: 'Nutrition', te: 'పోషణ', hi: 'पोषण' },

  // Article content — keyed by position in HEALTH_ARTICLES (sart.<index>.*)
  // 0 — High blood pressure
  'sart.0.title': { en: 'High Blood Pressure: Why They Call It the Silent One', te: 'అధిక రక్తపోటు: దీన్ని "సైలెంట్" వ్యాధి అని ఎందుకు అంటారు', hi: 'हाई ब्लड प्रेशर: इसे "साइलेंट" बीमारी क्यों कहते हैं' },
  'sart.0.blurb': {
    en: 'It usually causes no symptoms at all — which is exactly what makes it worth checking.',
    te: 'సాధారణంగా దీనికి ఎలాంటి లక్షణాలూ ఉండవు — అందుకే దీన్ని తప్పకుండా చెక్ చేయించుకోవాలి.',
    hi: 'आमतौर पर इसके कोई लक्षण नहीं होते — और यही वजह है कि इसकी जाँच करवाना ज़रूरी है।',
  },
  'sart.0.body.0': {
    en: 'Blood pressure is the force of blood pushing against the walls of your arteries. When it stays high over months and years, the heart works harder than it should and the vessels take damage — quietly, without pain or any obvious sign.',
    te: 'రక్తపోటు అంటే మీ ధమనుల గోడలపై రక్తం కలిగించే ఒత్తిడి. ఇది నెలల తరబడి, సంవత్సరాల తరబడి ఎక్కువగా ఉంటే, గుండె అవసరానికి మించి కష్టపడుతుంది, రక్తనాళాలు దెబ్బతింటాయి — నిశ్శబ్దంగా, నొప్పి గానీ స్పష్టమైన సంకేతం గానీ లేకుండా.',
    hi: 'ब्लड प्रेशर वह दबाव है जो ख़ून आपकी धमनियों की दीवारों पर डालता है। जब यह महीनों और सालों तक ऊँचा बना रहता है, तो दिल को ज़रूरत से ज़्यादा मेहनत करनी पड़ती है और नसों को नुक़सान पहुँचता है — चुपचाप, बिना दर्द या किसी साफ़ संकेत के।',
  },
  'sart.0.body.1': {
    en: 'That is the difficulty with it. Most people with high blood pressure feel completely well, and find out only when it is measured for something else. Headaches and giddiness are far more often something other than blood pressure, and waiting to feel unwell is not a way to catch it.',
    te: 'అదే దీనితో ఉన్న సమస్య. అధిక రక్తపోటు ఉన్న చాలా మందికి పూర్తిగా బాగానే ఉన్నట్లు అనిపిస్తుంది, వేరే కారణంతో కొలిచినప్పుడే వారికి తెలుస్తుంది. తలనొప్పి, తల తిరగడం చాలావరకు రక్తపోటు వల్ల కాకుండా ఇతర కారణాల వల్లే వస్తాయి, కాబట్టి ఒంట్లో బాగోలేనప్పుడు చూద్దాంలే అని ఎదురుచూడటం దీన్ని పట్టుకునే మార్గం కాదు.',
    hi: 'यही इसकी मुश्किल है। हाई ब्लड प्रेशर वाले ज़्यादातर लोग बिल्कुल ठीक महसूस करते हैं, और उन्हें तभी पता चलता है जब किसी और वजह से इसे नापा जाता है। सिरदर्द और चक्कर ज़्यादातर ब्लड प्रेशर के अलावा किसी और कारण से होते हैं, और तबीयत ख़राब होने का इंतज़ार करना इसे पकड़ने का तरीका नहीं है।',
  },
  'sart.0.body.2': {
    en: 'It is measured in a minute, costs almost nothing, and is not diagnosed from a single reading — a doctor confirms it over repeated measurements, often on more than one visit, because a single high reading can simply mean you climbed stairs or were anxious.',
    te: 'దీన్ని ఒక్క నిమిషంలో కొలవచ్చు, దాదాపు ఖర్చే ఉండదు, మరియు ఒక్క రీడింగ్‌తో నిర్ధారించరు — డాక్టర్ పలుమార్లు కొలిచి, తరచూ ఒకటి కంటే ఎక్కువ విజిట్‌లలో దీన్ని నిర్ధారిస్తారు, ఎందుకంటే ఒక్కసారి ఎక్కువ రీడింగ్ వచ్చిందంటే మీరు మెట్లు ఎక్కి వచ్చారని లేదా ఆందోళనగా ఉన్నారని మాత్రమే కావచ్చు.',
    hi: 'इसे एक मिनट में नापा जा सकता है, इसमें लगभग कोई ख़र्च नहीं होता, और इसका निदान एक रीडिंग से नहीं होता — डॉक्टर इसे बार-बार नापकर, अक्सर एक से ज़्यादा विज़िट में, पक्का करते हैं, क्योंकि एक बार की ऊँची रीडिंग का मतलब बस इतना भी हो सकता है कि आप सीढ़ियाँ चढ़कर आए थे या घबराए हुए थे।',
  },
  'sart.0.body.3': {
    en: 'What helps is unglamorous and well established: less salt, more movement, keeping weight in a healthy range, less alcohol, no smoking, and sleep. Where medicine is prescribed it is usually long-term, and stopping because you feel fine is the most common way people lose the benefit.',
    te: 'సహాయపడేవి సాదాసీదావే, కానీ బాగా నిరూపితమైనవి: ఉప్పు తగ్గించడం, ఎక్కువగా కదలడం, బరువును ఆరోగ్యకరమైన పరిధిలో ఉంచుకోవడం, మద్యం తగ్గించడం, పొగతాగకపోవడం, సరిపడా నిద్ర. మందులు సూచిస్తే అవి సాధారణంగా దీర్ఘకాలం వాడాల్సినవి, బాగానే ఉన్నాను కదా అని ఆపేయడమే ప్రజలు వాటి ప్రయోజనాన్ని కోల్పోయే అత్యంత సాధారణ మార్గం.',
    hi: 'जो मदद करता है वह साधारण है पर अच्छी तरह साबित है: कम नमक, ज़्यादा चलना-फिरना, वज़न को स्वस्थ सीमा में रखना, कम शराब, धूम्रपान बिल्कुल नहीं, और अच्छी नींद। जहाँ दवा दी जाती है, वह आमतौर पर लंबे समय तक लेनी होती है, और ठीक महसूस होने पर दवा बंद कर देना ही वह सबसे आम तरीका है जिससे लोग इसका फ़ायदा खो देते हैं।',
  },
  'sart.0.see': {
    en: 'Get it checked at any visit, particularly if a parent or sibling has it. Chest pain, breathlessness, sudden weakness on one side, or trouble speaking need emergency care immediately.',
    te: 'ఏ విజిట్‌లోనైనా చెక్ చేయించుకోండి, ముఖ్యంగా తల్లిదండ్రులకు లేదా తోబుట్టువులకు ఇది ఉంటే. ఛాతీ నొప్పి, ఊపిరి ఆడకపోవడం, ఒక వైపు హఠాత్తుగా బలహీనత, లేదా మాట్లాడటంలో ఇబ్బంది ఉంటే వెంటనే అత్యవసర చికిత్స అవసరం.',
    hi: 'किसी भी विज़िट पर इसकी जाँच करवाएँ, ख़ासकर अगर माता-पिता या भाई-बहन को यह हो। सीने में दर्द, साँस फूलना, शरीर के एक तरफ़ अचानक कमज़ोरी, या बोलने में दिक्कत हो तो तुरंत आपातकालीन इलाज ज़रूरी है।',
  },

  // 1 — Type 2 diabetes
  'sart.1.title': { en: 'Type 2 Diabetes: The Early Signs People Explain Away', te: 'టైప్ 2 మధుమేహం: చాలా మంది తేలిగ్గా తీసిపారేసే తొలి సంకేతాలు', hi: 'टाइप 2 डायबिटीज़: शुरुआती लक्षण जिन्हें लोग टाल देते हैं' },
  'sart.1.blurb': {
    en: 'Thirst, tiredness and frequent urination get blamed on the weather far more often than they should be.',
    te: 'దాహం, అలసట, తరచూ మూత్రవిసర్జనను చాలాసార్లు అనవసరంగా వాతావరణం మీదకు నెట్టేస్తుంటారు.',
    hi: 'प्यास, थकान और बार-बार पेशाब आने को अक्सर बेवजह मौसम पर डाल दिया जाता है।',
  },
  'sart.1.body.0': {
    en: 'In type 2 diabetes the body still makes insulin but stops responding to it properly, so sugar stays in the blood instead of moving into cells. It builds slowly, often over years, and the early stretch is where it is easiest to act.',
    te: 'టైప్ 2 మధుమేహంలో శరీరం ఇంకా ఇన్సులిన్ తయారు చేస్తుంది కానీ దానికి సరిగా స్పందించదు, దాంతో చక్కెర కణాల్లోకి వెళ్లకుండా రక్తంలోనే ఉండిపోతుంది. ఇది నెమ్మదిగా, తరచూ సంవత్సరాల పాటు పెరుగుతుంది, ఆ తొలి దశలోనే చర్య తీసుకోవడం అత్యంత సులువు.',
    hi: 'टाइप 2 डायबिटीज़ में शरीर इंसुलिन तो बनाता है, पर उस पर ठीक से प्रतिक्रिया नहीं करता, इसलिए शुगर कोशिकाओं में जाने के बजाय ख़ून में ही रह जाती है। यह धीरे-धीरे, अक्सर सालों में बढ़ती है, और शुरुआती दौर में ही इस पर क़दम उठाना सबसे आसान होता है।',
  },
  'sart.1.body.1': {
    en: 'The signs are easy to dismiss because each one has an innocent explanation: passing urine more often, being thirsty a lot, tiredness that does not lift, blurred vision, cuts that heal slowly, unexplained weight loss. Any of them on their own may be nothing. Together, or persisting, they are worth a blood test.',
    te: 'ఈ సంకేతాలను తీసిపారేయడం సులువు, ఎందుకంటే ప్రతిదానికీ ఏదో ఒక మామూలు కారణం కనిపిస్తుంది: తరచూ మూత్రవిసర్జన, ఎక్కువగా దాహం వేయడం, తగ్గని అలసట, చూపు మసకబారడం, నెమ్మదిగా మానే గాయాలు, కారణం లేకుండా బరువు తగ్గడం. వీటిలో ఏదైనా ఒక్కటే ఉంటే అది ఏమీ కాకపోవచ్చు. కానీ కలిసి ఉంటే, లేదా తగ్గకుండా కొనసాగితే, రక్త పరీక్ష చేయించుకోవడం మంచిది.',
    hi: 'इन लक्षणों को टालना आसान है क्योंकि हर एक की कोई मामूली वजह मिल जाती है: बार-बार पेशाब आना, बहुत प्यास लगना, थकान जो जाती ही नहीं, धुंधला दिखना, कटे-छिले का धीरे भरना, बिना वजह वज़न घटना। इनमें से कोई एक अकेले शायद कुछ भी न हो। पर अगर ये साथ में हों, या बने रहें, तो ख़ून की जाँच करवाना ठीक है।',
  },
  'sart.1.body.2': {
    en: 'Risk is higher if a close relative has diabetes, if you carry extra weight around the middle, if you sit most of the day, or if you had diabetes during a pregnancy. South Asians tend to develop it younger and at lower body weights than many other populations, so "I am not overweight" is not a reason to skip the test.',
    te: 'దగ్గరి బంధువులకు మధుమేహం ఉంటే, పొట్ట చుట్టూ అదనపు బరువు ఉంటే, రోజులో ఎక్కువ సమయం కూర్చునే ఉంటే, లేదా గర్భధారణ సమయంలో మధుమేహం వచ్చి ఉంటే ప్రమాదం ఎక్కువ. దక్షిణాసియా వారికి ఇది చాలా ఇతర జనాభాల కంటే చిన్న వయసులోనే, తక్కువ బరువులోనే వస్తుంది, కాబట్టి "నేను లావుగా లేను" అన్నది పరీక్ష మానేయడానికి కారణం కాదు.',
    hi: 'ख़तरा ज़्यादा होता है अगर किसी क़रीबी रिश्तेदार को डायबिटीज़ हो, पेट के आसपास अतिरिक्त वज़न हो, आप दिन का ज़्यादातर समय बैठे रहते हों, या गर्भावस्था के दौरान आपको डायबिटीज़ हुई हो। दक्षिण एशियाई लोगों में यह कई दूसरी आबादियों की तुलना में कम उम्र में और कम वज़न पर ही हो जाती है, इसलिए "मेरा वज़न ज़्यादा नहीं है" जाँच छोड़ने की वजह नहीं है।',
  },
  'sart.1.body.3': {
    en: 'It is manageable, and manageable early is far easier than managed late. Diet, activity and — when a doctor decides it is needed — medication all work, and the checks that come with it (eyes, feet, kidneys) exist to catch complications long before they are felt.',
    te: 'దీన్ని నియంత్రించవచ్చు, మరియు ఆలస్యంగా కంటే తొలిదశలోనే నియంత్రించడం చాలా సులువు. ఆహారం, వ్యాయామం, మరియు — డాక్టర్ అవసరమని నిర్ణయించినప్పుడు — మందులు అన్నీ పనిచేస్తాయి, దీనితో పాటు చేసే పరీక్షలు (కళ్లు, పాదాలు, కిడ్నీలు) సమస్యలు బయటపడకముందే వాటిని గుర్తించడానికే ఉన్నాయి.',
    hi: 'इसे संभाला जा सकता है, और देर से संभालने के मुक़ाबले शुरुआत में संभालना कहीं आसान है। खान-पान, शारीरिक गतिविधि और — जब डॉक्टर ज़रूरी समझें — दवा, सब असर करते हैं, और इसके साथ होने वाली जाँचें (आँखें, पैर, किडनी) इसलिए होती हैं ताकि जटिलताएँ महसूस होने से बहुत पहले पकड़ में आ जाएँ।',
  },
  'sart.1.see': {
    en: 'Ask for a blood sugar test if these signs persist, or if diabetes runs in your family. Confusion, drowsiness, vomiting or very fast breathing in someone with diabetes is an emergency.',
    te: 'ఈ సంకేతాలు కొనసాగుతుంటే, లేదా మీ కుటుంబంలో మధుమేహం ఉంటే, బ్లడ్ షుగర్ పరీక్ష అడగండి. మధుమేహం ఉన్న వ్యక్తిలో అయోమయం, మగత, వాంతులు లేదా చాలా వేగంగా ఊపిరి తీసుకోవడం అత్యవసర పరిస్థితి.',
    hi: 'अगर ये लक्षण बने रहें, या परिवार में डायबिटीज़ हो, तो ब्लड शुगर जाँच के लिए कहें। डायबिटीज़ वाले व्यक्ति में भ्रम, बहुत नींद आना, उल्टी या बहुत तेज़ साँस चलना आपात स्थिति है।',
  },

  // 2 — Fever in children
  'sart.2.title': { en: 'Fever in Children: What Actually Needs a Doctor', te: 'పిల్లల్లో జ్వరం: నిజంగా డాక్టర్ అవసరమయ్యేది ఎప్పుడు', hi: 'बच्चों में बुख़ार: कब सच में डॉक्टर की ज़रूरत है' },
  'sart.2.blurb': {
    en: 'The number on the thermometer matters less than how the child looks and behaves.',
    te: 'థర్మామీటర్‌లోని సంఖ్య కంటే, బిడ్డ ఎలా కనిపిస్తోంది, ఎలా ప్రవర్తిస్తోంది అన్నదే ముఖ్యం.',
    hi: 'थर्मामीटर के नंबर से ज़्यादा ज़रूरी है कि बच्चा कैसा दिख रहा है और कैसा बर्ताव कर रहा है।',
  },
  'sart.2.body.0': {
    en: 'Fever is not an illness. It is the body responding to one, usually an infection, and usually one the child will fight off. That is why experienced doctors ask less about the reading and more about the child.',
    te: 'జ్వరం ఒక వ్యాధి కాదు. అది ఒక వ్యాధికి — సాధారణంగా ఇన్ఫెక్షన్‌కి — శరీరం స్పందించే తీరు, చాలావరకు బిడ్డ దాన్ని తానే ఎదుర్కొంటుంది. అందుకే అనుభవం ఉన్న డాక్టర్లు రీడింగ్ గురించి కంటే బిడ్డ గురించే ఎక్కువగా అడుగుతారు.',
    hi: 'बुख़ार कोई बीमारी नहीं है। यह किसी बीमारी पर — आमतौर पर किसी संक्रमण पर — शरीर की प्रतिक्रिया है, और आमतौर पर बच्चा उससे ख़ुद लड़ लेता है। इसीलिए अनुभवी डॉक्टर रीडिंग के बारे में कम और बच्चे के बारे में ज़्यादा पूछते हैं।',
  },
  'sart.2.body.1': {
    en: 'What is reassuring: drinking fluids, passing urine normally, alert between temperature spikes, playing even if less than usual. What is not: refusing fluids, unusually drowsy or difficult to wake, breathing fast or struggling, a rash that does not fade when pressed, a stiff neck, or a fever that keeps returning over several days.',
    te: 'ధైర్యం కలిగించేవి: ద్రవాలు తాగుతుండటం, మామూలుగా మూత్రం పోస్తుండటం, జ్వరం పెరిగే మధ్యలో చురుకుగా ఉండటం, మామూలు కంటే తక్కువైనా ఆడుకుంటుండటం. ఆందోళన కలిగించేవి: ద్రవాలు తాగడానికి నిరాకరించడం, అసాధారణంగా మగతగా ఉండటం లేదా లేపడం కష్టమవడం, వేగంగా లేదా కష్టంగా ఊపిరి తీసుకోవడం, నొక్కినా మాయం కాని దద్దుర్లు, మెడ బిగుసుకుపోవడం, లేదా చాలా రోజులుగా మళ్లీ మళ్లీ వచ్చే జ్వరం.',
    hi: 'तसल्ली देने वाली बातें: तरल ले रहा हो, पेशाब सामान्य हो, बुख़ार चढ़ने के बीच-बीच में चुस्त हो, कम ही सही पर खेल रहा हो। चिंता की बातें: तरल लेने से मना करना, असामान्य रूप से सुस्त होना या जगाने में मुश्किल, तेज़ या मुश्किल से साँस लेना, ऐसे दाने जो दबाने पर फीके न पड़ें, गर्दन में अकड़न, या कई दिनों तक बार-बार लौटता बुख़ार।',
  },
  'sart.2.body.2': {
    en: 'Age changes the threshold. In a baby under three months, any fever is a reason to be seen the same day, regardless of how well they seem.',
    te: 'వయసును బట్టి ప్రమాణం మారుతుంది. మూడు నెలల లోపు శిశువుకు ఏ జ్వరం వచ్చినా, ఎంత బాగున్నట్లు కనిపించినా, అదే రోజు డాక్టర్‌కు చూపించాలి.',
    hi: 'उम्र के हिसाब से पैमाना बदलता है। तीन महीने से कम उम्र के शिशु में कोई भी बुख़ार हो, तो उसी दिन डॉक्टर को दिखाना चाहिए, चाहे शिशु कितना भी ठीक लगे।',
  },
  'sart.2.body.3': {
    en: 'For comfort, fluids and rest do most of the work. Any medicine for fever should be given at the dose your doctor or pharmacist sets for that child, by weight — never a share of an adult tablet, and never aspirin for a child.',
    te: 'ఉపశమనం కోసం ద్రవాలు, విశ్రాంతి చాలావరకు సరిపోతాయి. జ్వరానికి ఏ మందు ఇచ్చినా, ఆ బిడ్డ బరువు ఆధారంగా మీ డాక్టర్ లేదా ఫార్మసిస్ట్ నిర్ణయించిన మోతాదులోనే ఇవ్వాలి — పెద్దవాళ్ల టాబ్లెట్‌లో ముక్క ఎప్పుడూ ఇవ్వకండి, పిల్లలకు ఆస్పిరిన్ ఎప్పుడూ ఇవ్వకండి.',
    hi: 'आराम के लिए तरल और आराम ही ज़्यादातर काम करते हैं। बुख़ार की कोई भी दवा उसी ख़ुराक में दें जो आपके डॉक्टर या फ़ार्मासिस्ट ने उस बच्चे के वज़न के हिसाब से तय की हो — बड़ों की गोली का टुकड़ा कभी नहीं, और बच्चे को एस्पिरिन कभी नहीं।',
  },
  'sart.2.see': {
    en: 'Any fever under three months of age, difficulty breathing, a non-fading rash, a fit or seizure, refusing to drink, or a child who is unusually drowsy — go now, do not wait.',
    te: 'మూడు నెలల లోపు వయసులో ఏ జ్వరమైనా, ఊపిరి తీసుకోవడంలో ఇబ్బంది, మాయం కాని దద్దుర్లు, ఫిట్స్ లేదా మూర్ఛ, తాగడానికి నిరాకరించడం, లేదా అసాధారణంగా మగతగా ఉన్న బిడ్డ — ఇప్పుడే వెళ్లండి, ఆలస్యం చేయకండి.',
    hi: 'तीन महीने से कम उम्र में कोई भी बुख़ार, साँस लेने में दिक्कत, दबाने पर फीके न पड़ने वाले दाने, दौरा या झटके, पीने से मना करना, या असामान्य रूप से सुस्त बच्चा — अभी जाएँ, इंतज़ार न करें।',
  },

  // 3 — Antibiotic course
  'sart.3.title': { en: 'Why Finishing the Antibiotic Course Matters', te: 'యాంటీబయాటిక్ కోర్సు పూర్తి చేయడం ఎందుకు ముఖ్యం', hi: 'एंटीबायोटिक का कोर्स पूरा करना क्यों ज़रूरी है' },
  'sart.3.blurb': {
    en: 'Feeling better is not the same as being clear of the infection.',
    te: 'బాగున్నట్లు అనిపించడం అంటే ఇన్ఫెక్షన్ పూర్తిగా తగ్గినట్లు కాదు.',
    hi: 'बेहतर महसूस करने का मतलब यह नहीं कि संक्रमण पूरी तरह ख़त्म हो गया।',
  },
  'sart.3.body.0': {
    en: 'Antibiotics kill bacteria. They do nothing at all against viruses, which is why they will not help an ordinary cold or most sore throats — and why a doctor declining to prescribe one is often the correct treatment, not a lesser one.',
    te: 'యాంటీబయాటిక్స్ బ్యాక్టీరియాను చంపుతాయి. వైరస్‌లపై అవి ఏమాత్రం పనిచేయవు, అందుకే మామూలు జలుబుకు లేదా చాలా గొంతు నొప్పులకు అవి సహాయపడవు — అలాగే డాక్టర్ యాంటీబయాటిక్ రాయకపోవడమే చాలాసార్లు సరైన చికిత్స, తక్కువ చికిత్స కాదు.',
    hi: 'एंटीबायोटिक बैक्टीरिया को मारते हैं। वायरस पर इनका कोई असर नहीं होता, इसीलिए ये आम ज़ुकाम या ज़्यादातर गले की ख़राश में मदद नहीं करते — और इसीलिए डॉक्टर का एंटीबायोटिक न लिखना अक्सर सही इलाज होता है, कमतर इलाज नहीं।',
  },
  'sart.3.body.1': {
    en: 'When they are prescribed, symptoms usually settle before the bacteria are gone. Stopping there leaves the hardiest behind, and those are the ones that go on to multiply. Repeated across a population, this is how infections stop responding to the medicines that used to treat them.',
    te: 'అవి రాసినప్పుడు, బ్యాక్టీరియా పూర్తిగా పోకముందే సాధారణంగా లక్షణాలు తగ్గిపోతాయి. అక్కడే ఆపేస్తే అత్యంత బలమైనవి మిగిలిపోతాయి, అవే మళ్లీ పెరుగుతాయి. జనాభా అంతటా ఇలా పదే పదే జరిగితే, ఒకప్పుడు పనిచేసిన మందులకు ఇన్ఫెక్షన్లు లొంగకుండా పోతాయి.',
    hi: 'जब ये दिए जाते हैं, तो आमतौर पर बैक्टीरिया ख़त्म होने से पहले ही लक्षण ठीक हो जाते हैं। वहीं रुक जाने पर सबसे मज़बूत बैक्टीरिया बच जाते हैं, और वही आगे बढ़ते हैं। पूरी आबादी में बार-बार ऐसा होने से ही संक्रमण उन दवाओं पर असर दिखाना बंद कर देते हैं जिनसे पहले इलाज होता था।',
  },
  'sart.3.body.2': {
    en: 'Two habits matter as much as finishing: never take antibiotics left over from a previous illness, and never take someone else\'s. The right antibiotic depends on the organism, the site of infection and the person, and leftovers are almost never the right one or a full course.',
    te: 'కోర్సు పూర్తి చేయడంతో పాటు రెండు అలవాట్లు కూడా అంతే ముఖ్యం: గతంలో వచ్చిన జబ్బు నుండి మిగిలిన యాంటీబయాటిక్స్ ఎప్పుడూ వేసుకోకండి, ఇతరుల మందులు ఎప్పుడూ వేసుకోకండి. సరైన యాంటీబయాటిక్ అనేది క్రిమి రకం, ఇన్ఫెక్షన్ ఉన్న చోటు మరియు వ్యక్తిపై ఆధారపడి ఉంటుంది, మిగిలిపోయిన మందులు దాదాపు ఎప్పుడూ సరైనవి కావు, పూర్తి కోర్సు కూడా కావు.',
    hi: 'कोर्स पूरा करने जितनी ही दो आदतें ज़रूरी हैं: पिछली बीमारी से बचे हुए एंटीबायोटिक कभी न लें, और किसी और के एंटीबायोटिक कभी न लें। सही एंटीबायोटिक कीटाणु, संक्रमण की जगह और व्यक्ति पर निर्भर करता है, और बची हुई दवा लगभग कभी सही दवा या पूरा कोर्स नहीं होती।',
  },
  'sart.3.see': {
    en: 'Take the full course as prescribed. If it makes you unwell — a rash, swelling, severe diarrhoea, or breathing difficulty — stop and contact your doctor straight away.',
    te: 'సూచించిన విధంగా పూర్తి కోర్సు తీసుకోండి. అది మీకు ఇబ్బంది కలిగిస్తే — దద్దుర్లు, వాపు, తీవ్రమైన విరేచనాలు, లేదా ఊపిరి తీసుకోవడంలో ఇబ్బంది — ఆపేసి, వెంటనే మీ డాక్టర్‌ను సంప్రదించండి.',
    hi: 'पूरा कोर्स वैसे ही लें जैसा लिखा गया है। अगर इससे तबीयत बिगड़े — दाने, सूजन, तेज़ दस्त, या साँस लेने में दिक्कत — तो दवा रोकें और तुरंत अपने डॉक्टर से संपर्क करें।',
  },

  // 4 — Anaemia
  'sart.4.title': { en: 'Anaemia: Common, Treatable, and Often Ignored', te: 'రక్తహీనత: సాధారణం, చికిత్స చేయగలిగేది, అయినా తరచూ నిర్లక్ష్యం చేసేది', hi: 'एनीमिया (ख़ून की कमी): आम, इलाज योग्य, और अक्सर अनदेखा' },
  'sart.4.blurb': {
    en: 'Constant tiredness gets accepted as normal life far more often than it should be.',
    te: 'ఎప్పుడూ ఉండే అలసటను చాలాసార్లు అనవసరంగా మామూలు జీవితంలో భాగమని సరిపెట్టుకుంటారు.',
    hi: 'लगातार थकान को अक्सर बेवजह आम ज़िंदगी का हिस्सा मान लिया जाता है।',
  },
  'sart.4.body.0': {
    en: 'Anaemia means too few healthy red blood cells to carry oxygen around the body. It is very common in India, particularly among women and adolescent girls, and it is one of the more straightforward things to find and to treat.',
    te: 'రక్తహీనత అంటే శరీరమంతా ఆక్సిజన్‌ను తీసుకెళ్లడానికి సరిపడా ఆరోగ్యకరమైన ఎర్ర రక్తకణాలు లేకపోవడం. భారతదేశంలో ఇది చాలా సాధారణం, ముఖ్యంగా మహిళలు మరియు కౌమార బాలికల్లో, మరియు దీన్ని కనుగొనడం, చికిత్స చేయడం చాలా సులువైన విషయాల్లో ఒకటి.',
    hi: 'एनीमिया का मतलब है शरीर में ऑक्सीजन पहुँचाने के लिए स्वस्थ लाल रक्त कोशिकाओं की कमी। भारत में यह बहुत आम है, ख़ासकर महिलाओं और किशोर लड़कियों में, और यह पहचानने और इलाज करने में सबसे आसान समस्याओं में से एक है।',
  },
  'sart.4.body.1': {
    en: 'It shows up as tiredness that rest does not fix, breathlessness on stairs that used to be easy, giddiness, palpitations, pale skin, brittle nails, or difficulty concentrating. Because it comes on gradually, people adjust to it and stop noticing — which is why it is so often picked up on a test done for another reason.',
    te: 'ఇది విశ్రాంతితో తగ్గని అలసటగా, ఒకప్పుడు సులువుగా ఎక్కిన మెట్లపై ఆయాసంగా, తల తిరగడం, గుండె దడ, పాలిపోయిన చర్మం, పెళుసైన గోళ్లు, లేదా ఏకాగ్రత కుదరకపోవడంగా కనిపిస్తుంది. ఇది క్రమంగా వస్తుంది కాబట్టి, ప్రజలు దానికి అలవాటుపడి గమనించడం మానేస్తారు — అందుకే ఇది తరచూ వేరే కారణంతో చేసిన పరీక్షలో బయటపడుతుంది.',
    hi: 'यह ऐसी थकान के रूप में दिखता है जो आराम से ठीक नहीं होती, उन सीढ़ियों पर साँस फूलना जो पहले आसान थीं, चक्कर, धड़कन तेज़ होना, पीली त्वचा, कमज़ोर नाख़ून, या ध्यान लगाने में मुश्किल। क्योंकि यह धीरे-धीरे आता है, लोग इसके आदी हो जाते हैं और ध्यान देना छोड़ देते हैं — इसीलिए यह अक्सर किसी और वजह से हुई जाँच में पकड़ में आता है।',
  },
  'sart.4.body.2': {
    en: 'The cause matters as much as the count. Diet is one cause; heavy periods, pregnancy, ulcers, worm infestation and some long-term conditions are others, and treating the anaemia without finding the reason means it returns.',
    te: 'కౌంట్ ఎంత ముఖ్యమో కారణం కూడా అంతే ముఖ్యం. ఆహారం ఒక కారణం; అధిక రుతుస్రావం, గర్భధారణ, అల్సర్లు, నులిపురుగులు మరియు కొన్ని దీర్ఘకాలిక వ్యాధులు ఇతర కారణాలు, కారణం కనుక్కోకుండా రక్తహీనతకు మాత్రమే చికిత్స చేస్తే అది మళ్లీ వస్తుంది.',
    hi: 'गिनती जितना ही ज़रूरी कारण भी है। खान-पान एक कारण है; ज़्यादा माहवारी, गर्भावस्था, अल्सर, पेट के कीड़े और कुछ लंबी बीमारियाँ दूसरे कारण हैं, और कारण ढूँढे बिना एनीमिया का इलाज करने से यह फिर लौट आता है।',
  },
  'sart.4.body.3': {
    en: 'Iron supplements should come from a doctor rather than a shop shelf. Too much iron is harmful, and iron will not fix anaemia that has a different cause.',
    te: 'ఐరన్ సప్లిమెంట్లు దుకాణం షెల్ఫ్ నుండి కాకుండా డాక్టర్ సూచనతోనే తీసుకోవాలి. ఐరన్ ఎక్కువైతే హానికరం, మరియు వేరే కారణం వల్ల వచ్చిన రక్తహీనతను ఐరన్ తగ్గించదు.',
    hi: 'आयरन सप्लीमेंट दुकान से ख़ुद लेने के बजाय डॉक्टर की सलाह से लें। ज़्यादा आयरन नुक़सानदेह है, और जिस एनीमिया का कारण कुछ और हो, उसे आयरन ठीक नहीं करेगा।',
  },
  'sart.4.see': {
    en: 'Ask for a simple blood test if tiredness has been going on for weeks. Chest pain, fainting, or breathlessness at rest need urgent care.',
    te: 'అలసట వారాల తరబడి కొనసాగుతుంటే సాధారణ రక్త పరీక్ష అడగండి. ఛాతీ నొప్పి, స్పృహ తప్పడం, లేదా విశ్రాంతిలో ఉన్నప్పుడూ ఆయాసం ఉంటే అత్యవసర చికిత్స అవసరం.',
    hi: 'अगर थकान हफ़्तों से बनी है तो एक साधारण ख़ून की जाँच के लिए कहें। सीने में दर्द, बेहोशी, या आराम करते हुए भी साँस फूलना हो तो तुरंत इलाज ज़रूरी है।',
  },

  // 5 — Mosquito-borne fevers
  'sart.5.title': { en: 'Mosquito-Borne Fevers: The Week That Matters', te: 'దోమల ద్వారా వచ్చే జ్వరాలు: కీలకమైన ఆ వారం', hi: 'मच्छर से फैलने वाले बुख़ार: वह हफ़्ता जो सबसे अहम है' },
  'sart.5.blurb': {
    en: 'Dengue, malaria and chikungunya share a season, a mosquito, and a warning sign people miss.',
    te: 'డెంగ్యూ, మలేరియా, చికున్‌గున్యా — ఇవన్నీ ఒకే సీజన్‌లో, దోమల ద్వారానే వస్తాయి, మరియు ప్రజలు గమనించని ఒక హెచ్చరిక సంకేతం వీటికి ఉంది.',
    hi: 'डेंगू, मलेरिया और चिकनगुनिया — एक ही मौसम, एक ही ज़रिया यानी मच्छर, और एक ऐसा चेतावनी संकेत जिसे लोग चूक जाते हैं।',
  },
  'sart.5.body.0': {
    en: 'These illnesses arrive with the rains, and most cases recover with rest and fluids. The reason they are taken seriously is that a small number turn severe — and dengue does so at a point that feels like recovery.',
    te: 'ఈ వ్యాధులు వర్షాలతో పాటు వస్తాయి, చాలా కేసులు విశ్రాంతి, ద్రవాలతో కోలుకుంటాయి. వీటిని సీరియస్‌గా తీసుకోవడానికి కారణం, కొన్ని కేసులు తీవ్రంగా మారతాయి — మరియు డెంగ్యూ కోలుకుంటున్నట్లు అనిపించే సమయంలోనే అలా మారుతుంది.',
    hi: 'ये बीमारियाँ बारिश के साथ आती हैं, और ज़्यादातर मरीज़ आराम और तरल से ठीक हो जाते हैं। इन्हें गंभीरता से लेने की वजह यह है कि कुछ मामले गंभीर हो जाते हैं — और डेंगू ऐसा उस समय करता है जब लगता है कि मरीज़ ठीक हो रहा है।',
  },
  'sart.5.body.1': {
    en: 'In dengue, the dangerous phase often begins as the fever falls, around the third to seventh day. Someone who seemed to be improving becomes worse: severe stomach pain, repeated vomiting, bleeding from the gums or nose, black stools, restlessness, cold clammy skin. That combination needs hospital care immediately, not observation at home.',
    te: 'డెంగ్యూలో ప్రమాదకరమైన దశ తరచూ జ్వరం తగ్గుతున్నప్పుడు, దాదాపు మూడో రోజు నుండి ఏడో రోజు మధ్య మొదలవుతుంది. కోలుకుంటున్నట్లు కనిపించిన వ్యక్తి పరిస్థితి విషమిస్తుంది: తీవ్రమైన కడుపు నొప్పి, పదే పదే వాంతులు, చిగుళ్ల నుండి లేదా ముక్కు నుండి రక్తస్రావం, నల్లటి మలం, చంచలత, చల్లగా జిగటగా ఉండే చర్మం. ఈ లక్షణాలు కనిపిస్తే ఇంట్లో గమనిస్తూ ఉండటం కాదు, వెంటనే ఆసుపత్రిలో చికిత్స అవసరం.',
    hi: 'डेंगू में ख़तरनाक दौर अक्सर तब शुरू होता है जब बुख़ार उतर रहा होता है, लगभग तीसरे से सातवें दिन के बीच। जो व्यक्ति ठीक होता दिख रहा था, उसकी हालत बिगड़ने लगती है: पेट में तेज़ दर्द, बार-बार उल्टी, मसूड़ों या नाक से ख़ून, काला मल, बेचैनी, ठंडी और चिपचिपी त्वचा। ऐसे लक्षणों में घर पर नज़र रखना नहीं, तुरंत अस्पताल में इलाज ज़रूरी है।',
  },
  'sart.5.body.2': {
    en: 'Prevention is the mosquito, not the medicine. The species that spreads dengue breeds in clean standing water and bites during the day — so it is coolers, flower pots, tyres, water drums and terrace containers that matter, emptied and scrubbed weekly rather than merely covered.',
    te: 'నివారణ అంటే మందు కాదు, దోమను అరికట్టడం. డెంగ్యూని వ్యాప్తి చేసే దోమ శుభ్రమైన నిల్వ నీటిలో పెరుగుతుంది, పగటిపూట కుడుతుంది — కాబట్టి కూలర్లు, పూలకుండీలు, టైర్లు, నీటి డ్రమ్ములు, డాబాపై ఉండే పాత్రలు ముఖ్యం; వాటిని కేవలం మూత పెట్టడం కాకుండా, ప్రతి వారం ఖాళీ చేసి రుద్ది కడగాలి.',
    hi: 'बचाव दवा से नहीं, मच्छर से है। डेंगू फैलाने वाला मच्छर साफ़ ठहरे पानी में पनपता है और दिन में काटता है — इसलिए कूलर, गमले, टायर, पानी के ड्रम और छत पर रखे बर्तन अहम हैं, जिन्हें सिर्फ़ ढकने के बजाय हर हफ़्ते ख़ाली करके रगड़कर साफ़ करना चाहिए।',
  },
  'sart.5.body.3': {
    en: 'One caution on treatment: for any fever that could be dengue, avoid painkillers such as aspirin or ibuprofen unless a doctor has said otherwise, because they can worsen bleeding. Ask your doctor what is safe to take.',
    te: 'చికిత్స విషయంలో ఒక జాగ్రత్త: డెంగ్యూ అయ్యే అవకాశం ఉన్న ఏ జ్వరంలోనైనా, డాక్టర్ వేరేగా చెప్పకపోతే ఆస్పిరిన్ లేదా ఐబుప్రొఫెన్ వంటి నొప్పి నివారణ మందులు వాడకండి, ఎందుకంటే అవి రక్తస్రావాన్ని పెంచవచ్చు. ఏది వేసుకోవడం సురక్షితమో మీ డాక్టర్‌ను అడగండి.',
    hi: 'इलाज को लेकर एक सावधानी: जिस बुख़ार के डेंगू होने की आशंका हो, उसमें एस्पिरिन या आइबुप्रोफ़ेन जैसी दर्द की दवाएँ न लें, जब तक डॉक्टर ने अलग से न कहा हो, क्योंकि इनसे ख़ून बहना बढ़ सकता है। क्या लेना सुरक्षित है, यह अपने डॉक्टर से पूछें।',
  },
  'sart.5.see': {
    en: 'Any fever lasting more than two days in a dengue or malaria season deserves a test. Bleeding, severe abdominal pain, persistent vomiting or drowsiness is an emergency.',
    te: 'డెంగ్యూ లేదా మలేరియా సీజన్‌లో రెండు రోజుల కంటే ఎక్కువ ఉండే ఏ జ్వరానికైనా పరీక్ష చేయించుకోవాలి. రక్తస్రావం, తీవ్రమైన కడుపు నొప్పి, ఆగని వాంతులు లేదా మగత అత్యవసర పరిస్థితి.',
    hi: 'डेंगू या मलेरिया के मौसम में दो दिन से ज़्यादा चलने वाले किसी भी बुख़ार की जाँच होनी चाहिए। ख़ून बहना, पेट में तेज़ दर्द, लगातार उल्टी या बहुत सुस्ती आपात स्थिति है।',
  },

  // 6 — Tuberculosis
  'sart.6.title': { en: 'Tuberculosis: A Cough That Outstays Two Weeks', te: 'క్షయ (TB): రెండు వారాలు దాటిన దగ్గు', hi: 'टीबी: दो हफ़्ते से ज़्यादा चलने वाली खाँसी' },
  'sart.6.blurb': {
    en: 'Still one of India’s biggest infectious killers, and still curable when it is found.',
    te: 'భారతదేశంలో ప్రాణాలు తీసే అతిపెద్ద అంటువ్యాధుల్లో ఇది ఇప్పటికీ ఒకటి — అయినా గుర్తిస్తే పూర్తిగా నయం చేయవచ్చు.',
    hi: 'आज भी भारत में जान लेने वाली सबसे बड़ी संक्रामक बीमारियों में से एक, और पता चल जाए तो आज भी पूरी तरह ठीक होने वाली।',
  },
  'sart.6.body.0': {
    en: 'TB is a bacterial infection that most often settles in the lungs, spreading through the air when someone with untreated lung TB coughs or sneezes. It is curable, and treatment is free at government facilities — but only once someone comes forward to be tested.',
    te: 'TB అనేది బ్యాక్టీరియా వల్ల వచ్చే ఇన్ఫెక్షన్, ఇది ఎక్కువగా ఊపిరితిత్తుల్లో చేరుతుంది; చికిత్స తీసుకోని ఊపిరితిత్తుల TB ఉన్న వ్యక్తి దగ్గినప్పుడు లేదా తుమ్మినప్పుడు గాలి ద్వారా వ్యాపిస్తుంది. ఇది నయమవుతుంది, ప్రభుత్వ ఆసుపత్రుల్లో చికిత్స ఉచితం — కానీ ఎవరైనా ముందుకొచ్చి పరీక్ష చేయించుకున్నప్పుడే.',
    hi: 'टीबी एक बैक्टीरियल संक्रमण है जो ज़्यादातर फेफड़ों में होता है, और तब हवा से फैलता है जब फेफड़ों की अनुपचारित टीबी वाला व्यक्ति खाँसता या छींकता है। यह ठीक हो सकता है, और सरकारी अस्पतालों में इलाज मुफ़्त है — पर तभी जब कोई जाँच के लिए आगे आए।',
  },
  'sart.6.body.1': {
    en: 'The sign that matters most is duration. A cough lasting more than two weeks deserves a test, particularly alongside fever in the evenings, night sweats, losing weight without trying, or coughing blood.',
    te: 'అత్యంత ముఖ్యమైన సంకేతం — ఎంత కాలం ఉందన్నది. రెండు వారాలకు మించి ఉన్న దగ్గుకు పరీక్ష చేయించుకోవాలి, ముఖ్యంగా దానితో పాటు సాయంత్రం జ్వరం, రాత్రి చెమటలు, ప్రయత్నించకుండానే బరువు తగ్గడం, లేదా దగ్గులో రక్తం పడటం ఉంటే.',
    hi: 'सबसे अहम संकेत है अवधि। दो हफ़्ते से ज़्यादा चलने वाली खाँसी की जाँच होनी चाहिए, ख़ासकर अगर साथ में शाम को बुख़ार, रात में पसीना, बिना कोशिश वज़न घटना, या खाँसी में ख़ून आना हो।',
  },
  'sart.6.body.2': {
    en: 'Treatment runs for months, and the trap is the same one antibiotics have: people feel well long before the bacteria are gone. Stopping early is how ordinary TB becomes drug-resistant TB, which is far harder and far longer to treat.',
    te: 'చికిత్స నెలల పాటు సాగుతుంది, యాంటీబయాటిక్స్‌లో ఉన్న ఉచ్చే ఇక్కడా ఉంది: బ్యాక్టీరియా పోకముందే చాలా ముందుగానే ప్రజలకు బాగున్నట్లు అనిపిస్తుంది. మధ్యలో ఆపేయడం వల్లే మామూలు TB మందులకు లొంగని (డ్రగ్-రెసిస్టెంట్) TBగా మారుతుంది, దానికి చికిత్స చాలా కష్టం, చాలా ఎక్కువ కాలం పడుతుంది.',
    hi: 'इलाज महीनों चलता है, और इसमें भी वही जाल है जो एंटीबायोटिक में है: बैक्टीरिया ख़त्म होने से बहुत पहले ही लोग ठीक महसूस करने लगते हैं। बीच में इलाज छोड़ देने से ही सामान्य टीबी दवा-प्रतिरोधी (ड्रग-रेज़िस्टेंट) टीबी बन जाती है, जिसका इलाज कहीं ज़्यादा मुश्किल और लंबा होता है।',
  },
  'sart.6.body.3': {
    en: 'If someone at home has TB, the household usually needs screening too — including children, who can carry it without the classic cough.',
    te: 'ఇంట్లో ఎవరికైనా TB ఉంటే, సాధారణంగా ఇంట్లోని అందరికీ పరీక్ష అవసరం — పిల్లలతో సహా, ఎందుకంటే వారిలో సాధారణ దగ్గు లేకుండానే ఇది ఉండవచ్చు.',
    hi: 'अगर घर में किसी को टीबी है, तो आमतौर पर पूरे परिवार की भी जाँच ज़रूरी होती है — बच्चों की भी, जिनमें यह आम खाँसी के बिना भी हो सकती है।',
  },
  'sart.6.see': {
    en: 'A cough lasting more than two weeks, or any coughing of blood, should be tested — do not wait for it to settle on its own.',
    te: 'రెండు వారాలకు మించిన దగ్గు, లేదా దగ్గులో ఏ మాత్రం రక్తం పడినా పరీక్ష చేయించుకోవాలి — దానంతట అదే తగ్గుతుందని ఎదురుచూడకండి.',
    hi: 'दो हफ़्ते से ज़्यादा की खाँसी, या खाँसी में ज़रा भी ख़ून आए, तो जाँच करवाएँ — इसके अपने आप ठीक होने का इंतज़ार न करें।',
  },

  // 7 — Sleep, stress and low mood
  'sart.7.title': { en: 'Sleep, Stress and Low Mood: When It Is More Than a Rough Patch', te: 'నిద్ర, ఒత్తిడి, దిగులు: ఇది కేవలం కష్టకాలం కంటే ఎక్కువైనప్పుడు', hi: 'नींद, तनाव और उदासी: जब यह सिर्फ़ बुरा दौर नहीं रह जाता' },
  'sart.7.blurb': {
    en: 'Feeling low sometimes is human. Feeling low for weeks is worth talking to someone about.',
    te: 'అప్పుడప్పుడు దిగులుగా ఉండటం సహజం. వారాల తరబడి దిగులుగా ఉంటే ఎవరితోనైనా మాట్లాడటం మంచిది.',
    hi: 'कभी-कभी उदास होना इंसानी है। हफ़्तों तक उदास रहें, तो किसी से बात करना ठीक है।',
  },
  'sart.7.body.0': {
    en: 'Low mood, poor sleep and constant worry get treated as ordinary life almost everywhere, and often they are. What separates a rough patch from something needing help is how long it lasts and how much it takes from you.',
    te: 'దిగులు, సరిగా నిద్ర పట్టకపోవడం, ఎప్పుడూ ఆందోళన — వీటిని దాదాపు అన్నిచోట్లా మామూలు జీవితంలో భాగంగానే చూస్తారు, తరచూ అవి అలాగే ఉంటాయి కూడా. ఒక కష్టకాలానికి, సహాయం అవసరమైన దానికి తేడా — అది ఎంత కాలం ఉంటుంది, మీ నుండి ఎంత తీసుకుంటుంది అన్నదే.',
    hi: 'उदासी, ख़राब नींद और लगातार चिंता को लगभग हर जगह आम ज़िंदगी का हिस्सा माना जाता है, और अक्सर ऐसा होता भी है। बुरे दौर और मदद की ज़रूरत वाली स्थिति में फ़र्क़ इस बात से होता है कि यह कितने समय तक रहता है और आपसे कितना कुछ छीन लेता है।',
  },
  'sart.7.body.1': {
    en: 'Two weeks is a rough guide. If most days for two weeks or more you have felt low or lost interest in things you normally enjoy — and it is affecting sleep, appetite, work, or the people around you — that is worth raising with a doctor.',
    te: 'రెండు వారాలు ఒక స్థూల సూచిక. రెండు వారాలు లేదా అంతకంటే ఎక్కువ కాలం చాలా రోజుల్లో మీరు దిగులుగా ఉన్నా, లేదా మామూలుగా ఆనందించే విషయాలపై ఆసక్తి కోల్పోయినా — మరియు అది నిద్ర, ఆకలి, పని, లేదా మీ చుట్టూ ఉన్నవారిపై ప్రభావం చూపుతుంటే — దాని గురించి డాక్టర్‌తో మాట్లాడటం మంచిది.',
    hi: 'दो हफ़्ते एक मोटा पैमाना है। अगर दो हफ़्ते या उससे ज़्यादा समय तक ज़्यादातर दिन आप उदास रहे हैं या उन चीज़ों में दिलचस्पी खो दी है जिनका आप आमतौर पर आनंद लेते हैं — और इसका असर नींद, भूख, काम या आसपास के लोगों पर पड़ रहा है — तो डॉक्टर से इसके बारे में बात करना ठीक है।',
  },
  'sart.7.body.2': {
    en: 'It often shows up physically first: headaches, stomach trouble, exhaustion, aches with no clear cause. People frequently arrive at a hospital for those symptoms without connecting them to how they have been feeling.',
    te: 'ఇది తరచూ మొదట శారీరకంగా బయటపడుతుంది: తలనొప్పులు, కడుపు సమస్యలు, తీవ్రమైన అలసట, స్పష్టమైన కారణం లేని నొప్పులు. చాలా మంది ఈ లక్షణాలతో ఆసుపత్రికి వస్తారు, కానీ వాటిని తమ మానసిక స్థితితో ముడిపెట్టరు.',
    hi: 'यह अक्सर पहले शरीर में दिखता है: सिरदर्द, पेट की परेशानी, थकावट, बिना साफ़ वजह के दर्द। लोग अक्सर इन्हीं लक्षणों के साथ अस्पताल पहुँचते हैं, बिना यह जोड़े कि वे कैसा महसूस कर रहे हैं।',
  },
  'sart.7.body.3': {
    en: 'This is a medical condition, not a weakness or a character failing, and it responds to treatment. A family doctor is a perfectly good place to start.',
    te: 'ఇది ఒక వైద్య పరిస్థితి, బలహీనత గానీ వ్యక్తిత్వ లోపం గానీ కాదు, మరియు చికిత్సకు స్పందిస్తుంది. మొదలుపెట్టడానికి మీ ఫ్యామిలీ డాక్టర్ సరైన చోటు.',
    hi: 'यह एक चिकित्सीय स्थिति है, कोई कमज़ोरी या चरित्र की कमी नहीं, और इलाज से इसमें सुधार होता है। शुरुआत के लिए फ़ैमिली डॉक्टर बिल्कुल सही जगह है।',
  },
  'sart.7.see': {
    en: 'Two weeks or more of low mood, or sleep that will not settle, is worth a consultation. If you are thinking of harming yourself, treat it as an emergency and tell someone today.',
    te: 'రెండు వారాలు లేదా అంతకంటే ఎక్కువ దిగులు, లేదా కుదుటపడని నిద్ర ఉంటే డాక్టర్‌ను సంప్రదించడం మంచిది. మీకు మిమ్మల్ని మీరు హాని చేసుకోవాలనే ఆలోచనలు వస్తుంటే, దాన్ని అత్యవసర పరిస్థితిగా భావించి ఈరోజే ఎవరికైనా చెప్పండి.',
    hi: 'दो हफ़्ते या उससे ज़्यादा की उदासी, या नींद जो ठीक न हो रही हो, तो डॉक्टर से मिलना ठीक है। अगर आपके मन में ख़ुद को नुक़सान पहुँचाने के विचार आ रहे हैं, तो इसे आपात स्थिति मानें और आज ही किसी को बताएँ।',
  },

  // 8 — Vaccines
  'sart.8.title': { en: 'Vaccines: Keeping Track of What Is Due', te: 'టీకాలు: ఏది ఎప్పుడు వేయించాలో గుర్తుంచుకోవడం', hi: 'टीके: कौन-सा कब लगना है, इसका ध्यान रखना' },
  'sart.8.blurb': {
    en: 'Childhood schedules are only half of it — adults need some too.',
    te: 'పిల్లల టీకా షెడ్యూల్ సగం మాత్రమే — పెద్దవాళ్లకూ కొన్ని టీకాలు అవసరం.',
    hi: 'बच्चों का टीकाकरण शेड्यूल आधी बात है — बड़ों को भी कुछ टीकों की ज़रूरत होती है।',
  },
  'sart.8.body.0': {
    en: 'Vaccines work by teaching the body to recognise an infection before it meets it for real. Childhood schedules are designed to arrive ahead of the ages at which each illness is most dangerous, which is why timing matters as much as the vaccine itself.',
    te: 'టీకాలు ఇన్ఫెక్షన్ నిజంగా సోకకముందే దాన్ని గుర్తించడం శరీరానికి నేర్పిస్తాయి. ప్రతి వ్యాధి అత్యంత ప్రమాదకరంగా ఉండే వయసుకు ముందే అందేలా పిల్లల షెడ్యూల్‌లను రూపొందించారు, అందుకే టీకా ఎంత ముఖ్యమో సమయం కూడా అంతే ముఖ్యం.',
    hi: 'टीके शरीर को किसी संक्रमण से असल में सामना होने से पहले ही उसे पहचानना सिखाते हैं। बच्चों के शेड्यूल इस तरह बनाए गए हैं कि टीका उस उम्र से पहले लग जाए जब कोई बीमारी सबसे ख़तरनाक होती है, इसीलिए समय उतना ही ज़रूरी है जितना ख़ुद टीका।',
  },
  'sart.8.body.1': {
    en: 'A missed dose is not a lost cause. Schedules can almost always be caught up, and a doctor can plan that without starting over — so a delayed vaccination is worth asking about rather than abandoning.',
    te: 'ఒక డోసు తప్పిపోతే అంతా పోయినట్లు కాదు. షెడ్యూల్‌ను దాదాపు ఎప్పుడూ పూర్తి చేయవచ్చు, మళ్లీ మొదటి నుండి మొదలుపెట్టకుండానే డాక్టర్ దాన్ని ప్లాన్ చేయగలరు — కాబట్టి ఆలస్యమైన టీకాను వదిలేయకుండా దాని గురించి అడగండి.',
    hi: 'छूटी हुई ख़ुराक का मतलब सब ख़त्म नहीं है। शेड्यूल लगभग हमेशा पूरा किया जा सकता है, और डॉक्टर बिना शुरू से शुरू किए इसकी योजना बना सकते हैं — इसलिए देर हो चुके टीके को छोड़ने के बजाय उसके बारे में पूछें।',
  },
  'sart.8.body.2': {
    en: 'Adults get forgotten. Tetanus cover after a dirty wound, the vaccines advised during pregnancy, and those recommended for older adults or people with long-term conditions all have their place.',
    te: 'పెద్దవాళ్లను మర్చిపోతుంటారు. మురికి గాయం తర్వాత టెటనస్ రక్షణ, గర్భధారణ సమయంలో సూచించే టీకాలు, వృద్ధులకు లేదా దీర్ఘకాలిక వ్యాధులు ఉన్నవారికి సిఫార్సు చేసే టీకాలు — అన్నింటికీ వాటి ప్రాముఖ్యత ఉంది.',
    hi: 'बड़ों को भुला दिया जाता है। गंदे घाव के बाद टिटनेस से बचाव, गर्भावस्था में सुझाए जाने वाले टीके, और बुज़ुर्गों या लंबी बीमारी वाले लोगों के लिए सुझाए गए टीके — सबकी अपनी अहमियत है।',
  },
  'sart.8.body.3': {
    en: 'Keep the card. A written record — or a photo of it on your phone — saves guesswork at every future visit, and is often asked for at school admission.',
    te: 'టీకా కార్డును జాగ్రత్తగా ఉంచుకోండి. రాతపూర్వక రికార్డు — లేదా మీ ఫోన్‌లో దాని ఫోటో — భవిష్యత్తులో ప్రతి విజిట్‌లో ఊహాగానాలను తప్పిస్తుంది, తరచూ స్కూల్ అడ్మిషన్ సమయంలో కూడా అడుగుతారు.',
    hi: 'कार्ड सँभालकर रखें। लिखा हुआ रिकॉर्ड — या फ़ोन में उसकी फ़ोटो — आगे हर विज़िट पर अंदाज़े से बचाता है, और अक्सर स्कूल में दाख़िले के समय माँगा जाता है।',
  },
  'sart.8.see': {
    en: 'Ask your doctor to check the schedule if a dose was missed, before travel, during pregnancy, or after a wound from something rusty or dirty.',
    te: 'డోసు తప్పిపోయినా, ప్రయాణానికి ముందు, గర్భధారణ సమయంలో, లేదా తుప్పు పట్టిన లేదా మురికి వస్తువు వల్ల గాయమైన తర్వాత షెడ్యూల్ చెక్ చేయమని మీ డాక్టర్‌ను అడగండి.',
    hi: 'अगर कोई ख़ुराक छूट गई हो, यात्रा से पहले, गर्भावस्था में, या किसी ज़ंग लगी या गंदी चीज़ से घाव होने के बाद, अपने डॉक्टर से शेड्यूल जाँचने को कहें।',
  },

  // 9 — Chest pain
  'sart.9.title': { en: 'Chest Pain: The One Symptom Not to Wait Out', te: 'ఛాతీ నొప్పి: తగ్గుతుందని ఎదురుచూడకూడని ఒకే ఒక్క లక్షణం', hi: 'सीने में दर्द: वह एक लक्षण जिसके ठीक होने का इंतज़ार नहीं करना चाहिए' },
  'sart.9.blurb': {
    en: 'Most chest pain is not a heart attack. The cost of guessing wrong is what makes it different.',
    te: 'చాలా ఛాతీ నొప్పులు గుండెపోటు కాదు. కానీ తప్పుగా అంచనా వేస్తే జరిగే నష్టమే దీన్ని ప్రత్యేకం చేస్తుంది.',
    hi: 'सीने का ज़्यादातर दर्द हार्ट अटैक नहीं होता। पर ग़लत अंदाज़े की क़ीमत ही इसे अलग बनाती है।',
  },
  'sart.9.body.0': {
    en: 'Chest pain has many causes — acidity, muscle strain, anxiety, infection. Most are not dangerous. But treatment for a heart attack works best in the first hour or two, so this is one symptom where waiting to see is the wrong instinct.',
    te: 'ఛాతీ నొప్పికి చాలా కారణాలు ఉంటాయి — ఎసిడిటీ, కండరాల నొప్పి, ఆందోళన, ఇన్ఫెక్షన్. చాలావరకు ప్రమాదకరం కాదు. కానీ గుండెపోటుకు చికిత్స మొదటి ఒకటి రెండు గంటల్లోనే ఉత్తమంగా పనిచేస్తుంది, కాబట్టి చూద్దాంలే అని ఎదురుచూడటం తప్పు అయ్యే లక్షణం ఇదే.',
    hi: 'सीने में दर्द के कई कारण होते हैं — एसिडिटी, मांसपेशियों में खिंचाव, घबराहट, संक्रमण। ज़्यादातर ख़तरनाक नहीं होते। पर हार्ट अटैक का इलाज पहले एक-दो घंटे में सबसे अच्छा काम करता है, इसलिए यह वह लक्षण है जिसमें "देखते हैं" सोचकर रुकना ग़लत है।',
  },
  'sart.9.body.1': {
    en: 'Worrying features: heaviness, pressure or squeezing in the centre of the chest, pain spreading to the arm, jaw, neck or back, sweating, nausea, breathlessness, or pain that comes on with exertion and eases with rest.',
    te: 'ఆందోళన కలిగించే లక్షణాలు: ఛాతీ మధ్యలో బరువుగా, ఒత్తిడిగా లేదా పిండేస్తున్నట్లు ఉండటం, నొప్పి చేయి, దవడ, మెడ లేదా వీపుకు పాకడం, చెమటలు పట్టడం, వికారం, ఊపిరి ఆడకపోవడం, లేదా శ్రమ చేసినప్పుడు వచ్చి విశ్రాంతితో తగ్గే నొప్పి.',
    hi: 'चिंता वाले लक्षण: सीने के बीच में भारीपन, दबाव या जकड़न, बाँह, जबड़े, गर्दन या पीठ तक फैलता दर्द, पसीना, जी मिचलाना, साँस फूलना, या ऐसा दर्द जो मेहनत करने पर उठे और आराम करने पर कम हो।',
  },
  'sart.9.body.2': {
    en: 'It does not always look dramatic. In women, in older people and in those with diabetes, a heart attack can present as unusual tiredness, indigestion-like discomfort or breathlessness, with no crushing pain at all.',
    te: 'ఇది ఎప్పుడూ తీవ్రంగా కనిపించదు. మహిళల్లో, వృద్ధుల్లో, మధుమేహం ఉన్నవారిలో గుండెపోటు అసాధారణ అలసటగా, అజీర్ణం లాంటి అసౌకర్యంగా లేదా ఆయాసంగా కనిపించవచ్చు — తీవ్రమైన నొప్పి అసలు లేకుండానే.',
    hi: 'यह हमेशा नाटकीय नहीं दिखता। महिलाओं, बुज़ुर्गों और डायबिटीज़ वाले लोगों में हार्ट अटैक असामान्य थकान, अपच जैसी बेचैनी या साँस फूलने के रूप में आ सकता है, बिना किसी तेज़ दबाने वाले दर्द के।',
  },
  'sart.9.body.3': {
    en: 'If you suspect one: call for emergency help, go to the nearest hospital that can treat it, and do not drive yourself.',
    te: 'గుండెపోటు అని అనుమానం వస్తే: అత్యవసర సహాయం కోసం కాల్ చేయండి, దానికి చికిత్స చేయగల దగ్గరలోని ఆసుపత్రికి వెళ్లండి, మీరే డ్రైవ్ చేసుకుని వెళ్లకండి.',
    hi: 'अगर हार्ट अटैक का शक हो: आपातकालीन मदद बुलाएँ, इसका इलाज कर सकने वाले नज़दीकी अस्पताल जाएँ, और ख़ुद गाड़ी चलाकर न जाएँ।',
  },
  'sart.9.see': {
    en: 'Chest pain with sweating, breathlessness, vomiting, or pain spreading to the arm or jaw is an emergency. Go immediately — do not wait for it to pass.',
    te: 'చెమటలు, ఆయాసం, వాంతులతో కూడిన ఛాతీ నొప్పి, లేదా చేయి లేదా దవడకు పాకే నొప్పి అత్యవసర పరిస్థితి. వెంటనే వెళ్లండి — తగ్గిపోతుందని ఎదురుచూడకండి.',
    hi: 'पसीने, साँस फूलने, उल्टी के साथ सीने में दर्द, या बाँह या जबड़े तक फैलता दर्द आपात स्थिति है। तुरंत जाएँ — इसके ठीक होने का इंतज़ार न करें।',
  },

  // 10 — Heat
  'sart.10.title': { en: 'Water, Heat and the Summer Nobody Plans For', te: 'నీరు, వేడి మరియు ఎవరూ సిద్ధపడని వేసవి', hi: 'पानी, गर्मी और वह गर्मी जिसकी कोई तैयारी नहीं करता' },
  'sart.10.blurb': {
    en: 'Heat illness builds quietly across a day, and it is almost entirely preventable.',
    te: 'వేడి వల్ల వచ్చే అనారోగ్యం రోజంతా నిశ్శబ్దంగా పెరుగుతుంది, దాన్ని దాదాపు పూర్తిగా నివారించవచ్చు.',
    hi: 'गर्मी से होने वाली बीमारी दिन भर में चुपचाप बढ़ती है, और इसे लगभग पूरी तरह रोका जा सकता है।',
  },
  'sart.10.body.0': {
    en: 'Working or travelling through the hottest part of an Indian summer day puts real strain on the body. Heat exhaustion arrives first — heavy sweating, weakness, headache, nausea, cramps, dizziness — and it is the warning, not the illness.',
    te: 'భారతదేశ వేసవిలో రోజులోని అత్యంత వేడి సమయంలో పని చేయడం లేదా ప్రయాణం చేయడం శరీరంపై నిజమైన భారం. మొదట వేడి అలసట (హీట్ ఎగ్జాస్షన్) వస్తుంది — విపరీతమైన చెమట, బలహీనత, తలనొప్పి, వికారం, కండరాలు పట్టేయడం, తల తిరగడం — ఇది హెచ్చరిక మాత్రమే, అసలు వ్యాధి కాదు.',
    hi: 'भारतीय गर्मी में दिन के सबसे गर्म समय में काम करना या सफ़र करना शरीर पर असली ज़ोर डालता है। पहले हीट एग्ज़ॉशन (गर्मी से थकावट) आता है — बहुत पसीना, कमज़ोरी, सिरदर्द, जी मिचलाना, ऐंठन, चक्कर — और यह चेतावनी है, बीमारी नहीं।',
  },
  'sart.10.body.1': {
    en: 'Heat stroke is the emergency it becomes: very high body temperature, confusion or strange behaviour, and sometimes skin that has stopped sweating. It damages organs and needs hospital care immediately, while the person is cooled on the way.',
    te: 'అది ముదిరితే వచ్చే అత్యవసర పరిస్థితి వడదెబ్బ (హీట్ స్ట్రోక్): శరీర ఉష్ణోగ్రత చాలా ఎక్కువగా ఉండటం, అయోమయం లేదా వింత ప్రవర్తన, కొన్నిసార్లు చెమట పట్టడం ఆగిపోయిన చర్మం. ఇది అవయవాలను దెబ్బతీస్తుంది, వెంటనే ఆసుపత్రి చికిత్స అవసరం — దారిలోనే వ్యక్తిని చల్లబరుస్తూ తీసుకెళ్లాలి.',
    hi: 'यही आगे चलकर आपात स्थिति यानी लू (हीट स्ट्रोक) बन जाती है: शरीर का तापमान बहुत ज़्यादा, भ्रम या अजीब बर्ताव, और कभी-कभी ऐसी त्वचा जिसमें पसीना आना बंद हो गया हो। यह अंगों को नुक़सान पहुँचाता है और तुरंत अस्पताल में इलाज चाहिए, रास्ते में व्यक्ति को ठंडा करते हुए।',
  },
  'sart.10.body.2': {
    en: 'Prevention is dull and effective: drink through the day rather than only when thirsty, keep the hardest work away from the afternoon peak, rest in shade, and wear light loose clothing. Plain water and ORS do more than sweet drinks.',
    te: 'నివారణ సాదాసీదాగా ఉంటుంది కానీ ప్రభావవంతం: దాహం వేసినప్పుడు మాత్రమే కాకుండా రోజంతా నీళ్లు తాగండి, కష్టమైన పనిని మధ్యాహ్నపు తీవ్ర ఎండ సమయంలో చేయకండి, నీడలో విశ్రాంతి తీసుకోండి, తేలికైన వదులు దుస్తులు ధరించండి. తీపి పానీయాల కంటే మంచినీళ్లు, ORS ఎక్కువ మేలు చేస్తాయి.',
    hi: 'बचाव सीधा-सादा पर असरदार है: सिर्फ़ प्यास लगने पर नहीं, दिन भर पानी पीते रहें, सबसे भारी काम दोपहर की तेज़ धूप से दूर रखें, छाँव में आराम करें, और हल्के ढीले कपड़े पहनें। मीठे पेय से ज़्यादा फ़ायदा सादे पानी और ORS से होता है।',
  },
  'sart.10.body.3': {
    en: 'The people at most risk are the ones least likely to complain — infants, older adults, pregnant women, outdoor workers, and anyone on regular medication for heart or kidney conditions.',
    te: 'ఎక్కువ ప్రమాదంలో ఉండేది, ఫిర్యాదు చేసే అవకాశం అతి తక్కువ ఉన్నవారే — శిశువులు, వృద్ధులు, గర్భిణీ స్త్రీలు, బయట పనిచేసే కార్మికులు, మరియు గుండె లేదా కిడ్నీ సమస్యలకు క్రమం తప్పకుండా మందులు వాడేవారు.',
    hi: 'सबसे ज़्यादा ख़तरे में वही होते हैं जो शिकायत सबसे कम करते हैं — शिशु, बुज़ुर्ग, गर्भवती महिलाएँ, बाहर काम करने वाले मज़दूर, और दिल या किडनी की बीमारी के लिए नियमित दवा लेने वाले लोग।',
  },
  'sart.10.see': {
    en: 'Confusion, fainting, a very high temperature, or someone who stops sweating in the heat is an emergency. Move them to shade, start cooling, and get help immediately.',
    te: 'అయోమయం, స్పృహ తప్పడం, శరీర ఉష్ణోగ్రత చాలా ఎక్కువగా ఉండటం, లేదా ఎండలో చెమట పట్టడం ఆగిపోయిన వ్యక్తి — ఇది అత్యవసర పరిస్థితి. వారిని నీడలోకి తీసుకెళ్లి, చల్లబరచడం మొదలుపెట్టి, వెంటనే సహాయం పొందండి.',
    hi: 'भ्रम, बेहोशी, शरीर का बहुत ज़्यादा तापमान, या गर्मी में किसी का पसीना आना बंद हो जाना आपात स्थिति है। उन्हें छाँव में ले जाएँ, ठंडा करना शुरू करें, और तुरंत मदद लें।',
  },

  // 11 — Antenatal check-ups
  'sart.11.title': { en: 'Antenatal Check-ups: What They Are Actually Looking For', te: 'గర్భిణీ చెకప్‌లు: అవి నిజంగా ఏమి గమనిస్తాయి', hi: 'प्रसव-पूर्व जाँचें: ये असल में क्या देखती हैं' },
  'sart.11.blurb': {
    en: 'The visits when you feel completely well are the ones that catch the most.',
    te: 'మీరు పూర్తిగా బాగున్నట్లు అనిపించే విజిట్‌లలోనే ఎక్కువ విషయాలు బయటపడతాయి.',
    hi: 'जिन विज़िट में आप बिल्कुल ठीक महसूस करती हैं, वही सबसे ज़्यादा बातें पकड़ती हैं।',
  },
  'sart.11.body.0': {
    en: 'Antenatal care is routine surveillance, not treatment. Most of what it looks for causes no symptoms at the stage when it is easiest to manage — which is precisely why the schedule exists.',
    te: 'గర్భిణీ సంరక్షణ అంటే క్రమం తప్పని పర్యవేక్షణ, చికిత్స కాదు. ఇది గమనించే చాలా సమస్యలు, వాటిని నియంత్రించడం అత్యంత సులువుగా ఉండే దశలో ఎలాంటి లక్షణాలూ చూపవు — అందుకే ఈ షెడ్యూల్ ఉంది.',
    hi: 'प्रसव-पूर्व देखभाल नियमित निगरानी है, इलाज नहीं। यह जिन समस्याओं को खोजती है, उनमें से ज़्यादातर उस दौर में कोई लक्षण नहीं देतीं जब उन्हें संभालना सबसे आसान होता है — इसी वजह से यह शेड्यूल बना है।',
  },
  'sart.11.body.1': {
    en: 'Blood pressure and urine are checked for pre-eclampsia, which can develop with no warning signs at all. Blood tests look for anaemia, blood group, sugar levels and infections that affect a baby. Growth and heartbeat are followed to see how the pregnancy is progressing.',
    te: 'ఎలాంటి హెచ్చరిక సంకేతాలు లేకుండానే వచ్చే ప్రీ-ఎక్లాంప్సియా కోసం రక్తపోటు, మూత్రం పరీక్షిస్తారు. రక్తహీనత, బ్లడ్ గ్రూప్, షుగర్ స్థాయిలు మరియు బిడ్డపై ప్రభావం చూపే ఇన్ఫెక్షన్ల కోసం రక్త పరీక్షలు చేస్తారు. గర్భం ఎలా సాగుతోందో చూడటానికి బిడ్డ పెరుగుదల, గుండె చప్పుడును గమనిస్తారు.',
    hi: 'प्री-एक्लेम्पसिया के लिए ब्लड प्रेशर और पेशाब की जाँच होती है, जो बिना किसी चेतावनी के हो सकता है। ख़ून की जाँच से एनीमिया, ब्लड ग्रुप, शुगर का स्तर और बच्चे पर असर डालने वाले संक्रमण देखे जाते हैं। गर्भावस्था कैसे आगे बढ़ रही है, यह देखने के लिए बच्चे की बढ़त और धड़कन पर नज़र रखी जाती है।',
  },
  'sart.11.body.2': {
    en: 'Iron, folic acid and calcium are usually advised, and vaccination is planned. None of this depends on feeling unwell, and skipping a visit because the pregnancy feels fine is skipping exactly the check designed for that.',
    te: 'సాధారణంగా ఐరన్, ఫోలిక్ యాసిడ్ మరియు క్యాల్షియం సూచిస్తారు, టీకాలు ప్లాన్ చేస్తారు. వీటిలో ఏదీ ఒంట్లో బాగోలేకపోవడంపై ఆధారపడదు, గర్భం బాగానే ఉంది కదా అని ఒక విజిట్ మానేయడం అంటే — సరిగ్గా అలాంటి సమయం కోసమే రూపొందించిన పరీక్షను మానేయడమే.',
    hi: 'आमतौर पर आयरन, फ़ोलिक एसिड और कैल्शियम की सलाह दी जाती है, और टीकाकरण की योजना बनती है। इनमें से कुछ भी तबीयत ख़राब होने पर निर्भर नहीं है, और गर्भावस्था ठीक लग रही है सोचकर विज़िट छोड़ना ठीक वही जाँच छोड़ना है जो इसी स्थिति के लिए बनी है।',
  },
  'sart.11.body.3': {
    en: 'Between visits, some symptoms should never wait for the next appointment.',
    te: 'విజిట్‌ల మధ్యలో, కొన్ని లక్షణాలు కనిపిస్తే తర్వాతి అపాయింట్‌మెంట్ వరకు ఎప్పుడూ ఎదురుచూడకూడదు.',
    hi: 'दो विज़िट के बीच, कुछ लक्षणों में अगले अपॉइंटमेंट का इंतज़ार कभी नहीं करना चाहिए।',
  },
  'sart.11.see': {
    en: 'Bleeding, severe or constant headache, blurred vision, severe abdominal pain, high fever, sudden swelling of the face or hands, or reduced baby movements — get seen the same day.',
    te: 'రక్తస్రావం, తీవ్రమైన లేదా తగ్గని తలనొప్పి, చూపు మసకబారడం, తీవ్రమైన కడుపు నొప్పి, అధిక జ్వరం, ముఖం లేదా చేతులు హఠాత్తుగా వాచడం, లేదా బిడ్డ కదలికలు తగ్గడం — అదే రోజు డాక్టర్‌కు చూపించుకోండి.',
    hi: 'ख़ून आना, तेज़ या लगातार सिरदर्द, धुंधला दिखना, पेट में तेज़ दर्द, तेज़ बुख़ार, चेहरे या हाथों पर अचानक सूजन, या बच्चे की हलचल कम होना — उसी दिन डॉक्टर को दिखाएँ।',
  },

  // ─────────────────────────── Resources page ───────────────────────────
  'sres.eyebrow': { en: '{brand} Resources', te: '{brand} వనరులు', hi: '{brand} संसाधन' },
  'sres.title': { en: 'Resources', te: 'వనరులు', hi: 'संसाधन' },
  'sres.subtitle': {
    en: 'Helpful guides for patients, hospitals, and healthcare teams. Explore practical articles on appointment booking, digital OP queues, patient communication, medicine reminders, and hospital operations.',
    te: 'రోగులు, ఆసుపత్రులు మరియు ఆరోగ్య సేవా బృందాల కోసం ఉపయోగకరమైన గైడ్‌లు. అపాయింట్‌మెంట్ బుకింగ్, డిజిటల్ OP క్యూలు, రోగులతో కమ్యూనికేషన్, మందుల రిమైండర్లు మరియు ఆసుపత్రి నిర్వహణపై ఆచరణాత్మక వ్యాసాలు చూడండి.',
    hi: 'मरीज़ों, अस्पतालों और स्वास्थ्य टीमों के लिए काम की गाइड। अपॉइंटमेंट बुकिंग, डिजिटल OP कतार, मरीज़ों से संवाद, दवा रिमाइंडर और अस्पताल संचालन पर व्यावहारिक लेख पढ़ें।',
  },
  'sres.browse': { en: 'Browse by Topic', te: 'అంశం వారీగా చూడండి', hi: 'विषय के अनुसार देखें' },
  'sres.featuredCats': { en: 'Featured Categories', te: 'ముఖ్య విభాగాలు', hi: 'प्रमुख श्रेणियाँ' },
  'sres.latest': { en: 'Latest Reads', te: 'తాజా వ్యాసాలు', hi: 'ताज़ा लेख' },
  'sres.featuredArts': { en: 'Featured Articles', te: 'ముఖ్య వ్యాసాలు', hi: 'प्रमुख लेख' },
  'sres.newsletter': {
    en: 'Get healthcare technology updates, patient tips, and hospital management insights.',
    te: 'హెల్త్‌కేర్ టెక్నాలజీ అప్‌డేట్‌లు, రోగులకు చిట్కాలు మరియు ఆసుపత్రి నిర్వహణపై సూచనలు పొందండి.',
    hi: 'हेल्थकेयर टेक्नोलॉजी अपडेट, मरीज़ों के लिए टिप्स और अस्पताल प्रबंधन की जानकारी पाएँ।',
  },
  'sres.subscribe': { en: 'Subscribe Now', te: 'ఇప్పుడే సబ్‌స్క్రైబ్ చేయండి', hi: 'अभी सब्सक्राइब करें' },
  'sres.subscribed': {
    en: 'Subscribed! Thanks for joining {brand}.',
    te: 'సబ్‌స్క్రైబ్ అయ్యారు! {brand}లో చేరినందుకు ధన్యవాదాలు.',
    hi: 'सब्सक्राइब हो गया! {brand} से जुड़ने के लिए धन्यवाद।',
  },

  // Topic names — used both as category titles and article tags
  'sres.topic.Patient Guides': { en: 'Patient Guides', te: 'రోగుల గైడ్‌లు', hi: 'मरीज़ों के लिए गाइड' },
  'sres.topic.Hospital Operations': { en: 'Hospital Operations', te: 'ఆసుపత్రి నిర్వహణ', hi: 'अस्पताल संचालन' },
  'sres.topic.Digital Healthcare': { en: 'Digital Healthcare', te: 'డిజిటల్ హెల్త్‌కేర్', hi: 'डिजिटल हेल्थकेयर' },
  'sres.topic.Health Awareness': { en: 'Health Awareness', te: 'ఆరోగ్య అవగాహన', hi: 'स्वास्थ्य जागरूकता' },
  'sres.catDesc.Patient Guides': {
    en: 'Simple guides to help patients book appointments, understand digital tokens, and reduce waiting time.',
    te: 'అపాయింట్‌మెంట్లు బుక్ చేయడం, డిజిటల్ టోకెన్లను అర్థం చేసుకోవడం, వేచి ఉండే సమయం తగ్గించుకోవడంలో రోగులకు సహాయపడే సులభమైన గైడ్‌లు.',
    hi: 'मरीज़ों को अपॉइंटमेंट बुक करने, डिजिटल टोकन समझने और इंतज़ार का समय घटाने में मदद करने वाली आसान गाइड।',
  },
  'sres.catDesc.Hospital Operations': {
    en: 'Resources for hospitals to manage doctor availability, walk-ins, queues, and patient communication.',
    te: 'డాక్టర్ల అందుబాటు, వాక్-ఇన్‌లు, క్యూలు మరియు రోగులతో కమ్యూనికేషన్‌ను నిర్వహించడానికి ఆసుపత్రుల కోసం వనరులు.',
    hi: 'डॉक्टरों की उपलब्धता, वॉक-इन, कतार और मरीज़ों से संवाद संभालने के लिए अस्पतालों के संसाधन।',
  },
  'sres.catDesc.Digital Healthcare': {
    en: 'Insights on digital health tools, patient reminders, telehealth readiness, and healthcare technology.',
    te: 'డిజిటల్ హెల్త్ టూల్స్, రోగుల రిమైండర్లు, టెలిహెల్త్ సంసిద్ధత మరియు హెల్త్‌కేర్ టెక్నాలజీపై అవగాహన.',
    hi: 'डिजिटल हेल्थ टूल, मरीज़ रिमाइंडर, टेलीहेल्थ की तैयारी और हेल्थकेयर टेक्नोलॉजी पर जानकारी।',
  },
  'sres.catDesc.Health Awareness': {
    en: 'General awareness articles about wellness, preventive care, and health calculators.',
    te: 'ఆరోగ్య సంరక్షణ, నివారణ చర్యలు మరియు హెల్త్ కాలిక్యులేటర్లపై సాధారణ అవగాహన వ్యాసాలు.',
    hi: 'सेहत, बचाव से जुड़ी देखभाल और हेल्थ कैलकुलेटर पर सामान्य जागरूकता लेख।',
  },

  // Resource articles — keyed by position in ARTICLES (sres.<index>.*)
  'sres.0.title': { en: 'How Digital OP Tokens Reduce Waiting Time', te: 'డిజిటల్ OP టోకెన్లు వేచి ఉండే సమయాన్ని ఎలా తగ్గిస్తాయి', hi: 'डिजिटल OP टोकन इंतज़ार का समय कैसे घटाते हैं' },
  'sres.0.blurb': {
    en: 'Learn how digital tokens help patients avoid long queues and reach hospitals at the right time.',
    te: 'డిజిటల్ టోకెన్లు రోగులు పొడవైన క్యూలను తప్పించుకుని సరైన సమయానికి ఆసుపత్రికి చేరుకోవడానికి ఎలా సహాయపడతాయో తెలుసుకోండి.',
    hi: 'जानें कि डिजिटल टोकन मरीज़ों को लंबी कतारों से बचने और सही समय पर अस्पताल पहुँचने में कैसे मदद करते हैं।',
  },
  'sres.0.body.0': {
    en: 'A paper token tells you your place in the queue and nothing else. You still have to sit in the waiting room to find out when your turn is near.',
    te: 'కాగితపు టోకెన్ క్యూలో మీ స్థానాన్ని మాత్రమే చెబుతుంది, ఇంకేమీ చెప్పదు. మీ వంతు ఎప్పుడు దగ్గరపడుతుందో తెలుసుకోవడానికి మీరు వెయిటింగ్ రూమ్‌లోనే కూర్చోవాలి.',
    hi: 'काग़ज़ का टोकन सिर्फ़ कतार में आपकी जगह बताता है, और कुछ नहीं। आपकी बारी कब क़रीब है, यह जानने के लिए आपको फिर भी वेटिंग रूम में बैठना पड़ता है।',
  },
  'sres.0.body.1': {
    en: 'A digital token keeps counting for you. As each consultation finishes, your position and estimated time update on your phone, so the waiting room is somewhere you arrive at — not somewhere you spend the morning.',
    te: 'డిజిటల్ టోకెన్ మీ కోసం లెక్క పెడుతూనే ఉంటుంది. ప్రతి కన్సల్టేషన్ పూర్తయ్యే కొద్దీ, మీ స్థానం మరియు అంచనా సమయం మీ ఫోన్‌లో అప్‌డేట్ అవుతాయి — దీంతో వెయిటింగ్ రూమ్ మీరు ఉదయమంతా గడిపే చోటు కాదు, సమయానికి చేరుకునే చోటు అవుతుంది.',
    hi: 'डिजिटल टोकन आपके लिए गिनती करता रहता है। हर परामर्श पूरा होने पर आपकी जगह और अनुमानित समय आपके फ़ोन पर अपडेट होता है, ताकि वेटिंग रूम वह जगह बने जहाँ आप पहुँचते हैं — वह नहीं जहाँ आपकी पूरी सुबह बीत जाए।',
  },
  'sres.0.body.2': {
    en: 'For the hospital the gain is the same in reverse: the front desk can see who is waiting, who has been called, and who has not turned up, without anyone having to ask.',
    te: 'ఆసుపత్రికి కూడా అదే లాభం, మరో వైపు నుండి: ఎవరూ అడగాల్సిన అవసరం లేకుండానే, ఎవరు వేచి ఉన్నారు, ఎవరిని పిలిచారు, ఎవరు రాలేదు అన్నది ఫ్రంట్ డెస్క్ చూడగలదు.',
    hi: 'अस्पताल के लिए भी यही फ़ायदा है, दूसरी तरफ़ से: फ़्रंट डेस्क बिना किसी से पूछे देख सकता है कि कौन इंतज़ार कर रहा है, किसे बुलाया जा चुका है और कौन नहीं आया।',
  },
  'sres.1.title': { en: 'Why Smart Travel Timing Matters for Rural Patients', te: 'గ్రామీణ రోగులకు స్మార్ట్ ట్రావెల్ టైమింగ్ ఎందుకు ముఖ్యం', hi: 'ग्रामीण मरीज़ों के लिए स्मार्ट ट्रैवल टाइमिंग क्यों ज़रूरी है' },
  'sres.1.blurb': {
    en: 'Understand how patients travelling from villages can save time, money, and effort.',
    te: 'గ్రామాల నుండి ప్రయాణించే రోగులు సమయం, డబ్బు మరియు శ్రమను ఎలా ఆదా చేసుకోవచ్చో తెలుసుకోండి.',
    hi: 'समझें कि गाँवों से आने वाले मरीज़ समय, पैसा और मेहनत कैसे बचा सकते हैं।',
  },
  'sres.1.body.0': {
    en: 'If you are travelling an hour to reach a hospital, knowing your token number is not enough. What you need to know is when to leave home.',
    te: 'ఆసుపత్రికి చేరుకోవడానికి మీరు గంటసేపు ప్రయాణిస్తుంటే, మీ టోకెన్ నంబర్ తెలిస్తే సరిపోదు. మీకు తెలియాల్సింది ఇంటి నుండి ఎప్పుడు బయలుదేరాలో.',
    hi: 'अगर अस्पताल पहुँचने में आपको एक घंटा लगता है, तो सिर्फ़ टोकन नंबर जानना काफ़ी नहीं है। आपको यह जानना है कि घर से कब निकलें।',
  },
  'sres.1.body.1': {
    en: 'Booking records where you are starting from, and the app works backwards from your estimated turn — travel time, plus a buffer to arrive before you are called. You get a "time to leave" alert instead of a number to guess with.',
    te: 'బుకింగ్ సమయంలో మీరు ఎక్కడి నుండి బయలుదేరుతున్నారో నమోదవుతుంది, యాప్ మీ అంచనా వంతు నుండి వెనక్కి లెక్కిస్తుంది — ప్రయాణ సమయం, దానికి తోడు మిమ్మల్ని పిలవకముందే చేరుకోవడానికి కొంత అదనపు సమయం. ఊహించుకోవడానికి ఒక నంబర్ బదులు మీకు "బయలుదేరే సమయం" హెచ్చరిక వస్తుంది.',
    hi: 'बुकिंग के समय दर्ज होता है कि आप कहाँ से निकल रहे हैं, और ऐप आपकी अनुमानित बारी से पीछे की ओर गिनता है — सफ़र का समय, और बुलाए जाने से पहले पहुँचने के लिए थोड़ा अतिरिक्त समय। अंदाज़ा लगाने के लिए एक नंबर की जगह आपको "निकलने का समय" अलर्ट मिलता है।',
  },
  'sres.1.body.2': {
    en: 'That matters most where a wasted trip costs a day of work and a bus fare, not just an afternoon.',
    te: 'ఒక వృథా ప్రయాణం అంటే కేవలం ఒక మధ్యాహ్నం కాకుండా ఒక రోజు పని, బస్సు ఛార్జీ నష్టమయ్యే చోట ఇది అత్యంత ముఖ్యం.',
    hi: 'यह सबसे ज़्यादा वहाँ मायने रखता है जहाँ एक बेकार चक्कर की क़ीमत सिर्फ़ एक दोपहर नहीं, बल्कि एक दिन की मज़दूरी और बस का किराया होती है।',
  },
  'sres.2.title': { en: 'How Hospitals Can Manage Walk-in and Online Patients Together', te: 'ఆసుపత్రులు వాక్-ఇన్ మరియు ఆన్‌లైన్ రోగులను కలిపి ఎలా నిర్వహించవచ్చు', hi: 'अस्पताल वॉक-इन और ऑनलाइन मरीज़ों को एक साथ कैसे संभालें' },
  'sres.2.blurb': {
    en: 'A practical guide for reception teams and hospital administrators.',
    te: 'రిసెప్షన్ బృందాలు మరియు ఆసుపత్రి నిర్వాహకుల కోసం ఒక ఆచరణాత్మక గైడ్.',
    hi: 'रिसेप्शन टीमों और अस्पताल प्रशासकों के लिए एक व्यावहारिक गाइड।',
  },
  'sres.2.body.0': {
    en: 'Most hospitals run two queues without meaning to: people who booked, and people who walked in. Kept separate, one of them always feels cheated.',
    te: 'చాలా ఆసుపత్రులు తెలియకుండానే రెండు క్యూలు నడుపుతాయి: బుక్ చేసుకున్నవారు, నేరుగా వచ్చినవారు. వేర్వేరుగా ఉంచితే, వారిలో ఒక వర్గం ఎప్పుడూ అన్యాయం జరిగిందని భావిస్తుంది.',
    hi: 'ज़्यादातर अस्पताल अनजाने में दो कतारें चलाते हैं: जिन्होंने बुक किया, और जो सीधे आ गए। अलग रखने पर इनमें से एक पक्ष हमेशा ठगा हुआ महसूस करता है।',
  },
  'sres.2.body.1': {
    en: 'One queue solves it. A walk-in registered at the desk joins the same live list as an online booking, in the order they arrive, and the doctor calls from a single screen.',
    te: 'ఒకే క్యూ దీనికి పరిష్కారం. డెస్క్ వద్ద నమోదైన వాక్-ఇన్ రోగి, ఆన్‌లైన్ బుకింగ్‌లు ఉన్న అదే లైవ్ జాబితాలో వచ్చిన వరుసలో చేరతారు, డాక్టర్ ఒకే స్క్రీన్ నుండి పిలుస్తారు.',
    hi: 'एक कतार इसका हल है। डेस्क पर रजिस्टर हुआ वॉक-इन मरीज़ ऑनलाइन बुकिंग वाली उसी लाइव सूची में आने के क्रम से जुड़ता है, और डॉक्टर एक ही स्क्रीन से बुलाते हैं।',
  },
  'sres.2.body.2': {
    en: 'The desk keeps the exceptions it actually needs — priority for an emergency, a recall for someone who stepped out — instead of holding the whole order in their head.',
    te: 'మొత్తం వరుసను గుర్తుపెట్టుకునే బదులు, డెస్క్ నిజంగా అవసరమైన మినహాయింపులను మాత్రమే చూసుకుంటుంది — అత్యవసర కేసుకు ప్రాధాన్యం, బయటకు వెళ్లినవారిని మళ్లీ పిలవడం.',
    hi: 'पूरा क्रम दिमाग़ में रखने के बजाय, डेस्क सिर्फ़ वही अपवाद संभालता है जिनकी सच में ज़रूरत है — इमरजेंसी को प्राथमिकता, बाहर गए किसी व्यक्ति को दोबारा बुलाना।',
  },
  'sres.3.title': { en: 'Getting the Most Out of a Short Consultation', te: 'తక్కువ సమయం ఉండే కన్సల్టేషన్‌ను పూర్తిగా ఉపయోగించుకోవడం', hi: 'छोटे परामर्श का पूरा फ़ायदा कैसे उठाएँ' },
  'sres.3.blurb': {
    en: 'A few minutes of preparation makes a ten-minute appointment go further.',
    te: 'కొన్ని నిమిషాల సన్నద్ధత పది నిమిషాల అపాయింట్‌మెంట్‌ను మరింత ఫలవంతం చేస్తుంది.',
    hi: 'कुछ मिनट की तैयारी दस मिनट के अपॉइंटमेंट को ज़्यादा कारगर बनाती है।',
  },
  'sres.3.body.0': {
    en: 'Consultations are short. What you bring into the room decides how much of that time goes on catching up rather than on you.',
    te: 'కన్సల్టేషన్లు తక్కువ సమయం ఉంటాయి. ఆ సమయంలో ఎంత భాగం పాత విషయాలు తెలుసుకోవడానికి పోతుంది, ఎంత మీ సమస్యపై వెచ్చిస్తారు అన్నది మీరు గదిలోకి ఏమి తీసుకెళ్తారో దానిపై ఆధారపడి ఉంటుంది.',
    hi: 'परामर्श छोटे होते हैं। आप कमरे में क्या लेकर जाते हैं, इसी से तय होता है कि उस समय का कितना हिस्सा पुरानी बातें समझने में जाएगा और कितना आप पर।',
  },
  'sres.3.body.1': {
    en: 'Three things help: the medicines you are already taking, when the problem started, and anything that has changed since the last visit. Written down beats remembered.',
    te: 'మూడు విషయాలు సహాయపడతాయి: మీరు ఇప్పటికే వాడుతున్న మందులు, సమస్య ఎప్పుడు మొదలైంది, మరియు గత విజిట్ తర్వాత ఏమైనా మారిందా. గుర్తుపెట్టుకోవడం కంటే రాసుకోవడం మేలు.',
    hi: 'तीन चीज़ें मदद करती हैं: जो दवाएँ आप पहले से ले रहे हैं, समस्या कब शुरू हुई, और पिछली विज़िट के बाद क्या बदला। याद रखने से बेहतर है लिखकर रखना।',
  },
  'sres.3.body.2': {
    en: 'Your record already carries some of this — past prescriptions, vitals taken at check-in, conditions and allergies the hospital has noted. Keeping it current means the doctor starts from what is true rather than from what you can recall on the day.',
    te: 'మీ రికార్డులో ఇందులో కొంత ఇప్పటికే ఉంటుంది — పాత ప్రిస్క్రిప్షన్లు, చెక్-ఇన్ సమయంలో తీసిన వైటల్స్, ఆసుపత్రి నమోదు చేసిన వ్యాధులు మరియు అలర్జీలు. దాన్ని అప్‌డేట్‌గా ఉంచితే, ఆ రోజు మీకు గుర్తున్నదాని నుండి కాకుండా, నిజమైన సమాచారం నుండి డాక్టర్ మొదలుపెడతారు.',
    hi: 'आपके रिकॉर्ड में इसका कुछ हिस्सा पहले से होता है — पुराने प्रिस्क्रिप्शन, चेक-इन पर लिए गए वाइटल्स, अस्पताल की दर्ज की हुई बीमारियाँ और एलर्जी। इसे अपडेट रखने से डॉक्टर उस दिन आपको जो याद है उससे नहीं, बल्कि सही जानकारी से शुरुआत करते हैं।',
  },

  // ─────────────────────────── Calculators page ───────────────────────────
  'scalc.eyebrow': { en: '{brand} Health Tools', te: '{brand} ఆరోగ్య సాధనాలు', hi: '{brand} हेल्थ टूल्स' },
  'scalc.title': { en: 'Health Calculators', te: 'ఆరోగ్య కాలిక్యులేటర్లు', hi: 'हेल्थ कैलकुलेटर' },
  'scalc.subtitle': {
    en: 'Your BMI, body fat, daily calories, ideal weight and more — each with a food plan you can act on today. Everything is worked out on your own device; nothing you type is saved or sent anywhere.',
    te: 'మీ BMI, శరీర కొవ్వు, రోజువారీ కేలరీలు, ఆదర్శ బరువు ఇంకా మరెన్నో — ప్రతిదానితో పాటు ఈరోజే పాటించగల ఆహార ప్రణాళిక. అన్ని లెక్కలూ మీ పరికరంలోనే జరుగుతాయి; మీరు టైప్ చేసేది ఎక్కడా సేవ్ అవ్వదు, ఎక్కడికీ పంపబడదు.',
    hi: 'आपका BMI, बॉडी फ़ैट, रोज़ की कैलोरी, आदर्श वज़न और भी बहुत कुछ — हर एक के साथ ऐसा डाइट प्लान जिस पर आप आज से अमल कर सकें। सारी गणना आपके अपने डिवाइस पर होती है; आप जो भी टाइप करते हैं वह न कहीं सेव होता है, न कहीं भेजा जाता है।',
  },
  'scalc.chip.free': { en: 'Free', te: 'ఉచితం', hi: 'मुफ़्त' },
  'scalc.chip.noSignup': { en: 'No sign-up', te: 'సైన్-అప్ అవసరం లేదు', hi: 'साइन-अप की ज़रूरत नहीं' },
  'scalc.chip.nothingStored': { en: 'Nothing stored', te: 'ఏదీ సేవ్ కాదు', hi: 'कुछ भी सेव नहीं' },
  'scalc.step.pick.title': { en: 'Pick a tool', te: 'ఒక సాధనం ఎంచుకోండి', hi: 'एक टूल चुनें' },
  'scalc.step.pick.body': {
    en: 'Eight of them. Each asks only what it actually needs.',
    te: 'మొత్తం ఎనిమిది. ప్రతిదీ నిజంగా అవసరమైనది మాత్రమే అడుగుతుంది.',
    hi: 'कुल आठ हैं। हर टूल सिर्फ़ वही पूछता है जिसकी उसे सच में ज़रूरत है।',
  },
  'scalc.step.type.title': { en: 'Type your numbers', te: 'మీ వివరాలు టైప్ చేయండి', hi: 'अपने आँकड़े भरें' },
  'scalc.step.type.body': {
    en: 'The answer updates as you type. Nothing is saved or sent.',
    te: 'మీరు టైప్ చేస్తున్న కొద్దీ ఫలితం మారుతుంది. ఏదీ సేవ్ అవ్వదు, పంపబడదు.',
    hi: 'टाइप करते ही जवाब बदलता जाता है। कुछ भी सेव या भेजा नहीं जाता।',
  },
  'scalc.step.plan.title': { en: 'Get a food plan', te: 'ఆహార ప్రణాళిక పొందండి', hi: 'डाइट प्लान पाएँ' },
  'scalc.step.plan.body': {
    en: 'What to eat, how much, when — and what to cut back on.',
    te: 'ఏం తినాలి, ఎంత, ఎప్పుడు — ఇంకా వేటిని తగ్గించాలి.',
    hi: 'क्या खाएँ, कितना, कब — और किसे कम करें।',
  },
  'scalc.pick': { en: 'Pick a calculator', te: 'ఒక కాలిక్యులేటర్ ఎంచుకోండి', hi: 'कैलकुलेटर चुनें' },
  'scalc.count': { en: '{n} tools, one question at a time', te: '{n} సాధనాలు, ఒకసారికి ఒకే ప్రశ్న', hi: '{n} टूल, एक बार में एक सवाल' },
  'scalc.open': { en: 'Open', te: 'తెరవండి', hi: 'खोलें' },
  'scalc.disclaimer': {
    en: 'These calculators are for general awareness only. They use the healthy ranges set for Indian and Asian bodies, which are lower than the European ones, and they are estimates to help you talk to a doctor — never a diagnosis or a prescription. If you are pregnant, diabetic, living with kidney disease or an eating disorder, follow your doctor’s or dietitian’s plan instead.',
    te: 'ఈ కాలిక్యులేటర్లు సాధారణ అవగాహన కోసం మాత్రమే. ఇవి భారతీయ మరియు ఆసియా శరీరాల కోసం నిర్ణయించిన ఆరోగ్యకరమైన పరిమితులను ఉపయోగిస్తాయి, ఇవి యూరోపియన్ పరిమితుల కంటే తక్కువ. ఇవి డాక్టర్‌తో మాట్లాడటానికి సహాయపడే అంచనాలు మాత్రమే — ఎప్పుడూ వ్యాధి నిర్ధారణ లేదా ప్రిస్క్రిప్షన్ కాదు. మీరు గర్భవతి అయితే, మధుమేహం ఉంటే, కిడ్నీ వ్యాధి లేదా ఆహార రుగ్మత (eating disorder)తో ఉంటే, దీనికి బదులు మీ డాక్టర్ లేదా డైటీషియన్ ఇచ్చిన ప్రణాళికనే పాటించండి.',
    hi: 'ये कैलकुलेटर सिर्फ़ सामान्य जागरूकता के लिए हैं। ये भारतीय और एशियाई शरीर के लिए तय की गई स्वस्थ सीमाओं का उपयोग करते हैं, जो यूरोपीय सीमाओं से कम होती हैं, और ये डॉक्टर से बात करने में मदद के लिए अनुमान हैं — कभी भी निदान या प्रिस्क्रिप्शन नहीं। अगर आप गर्भवती हैं, डायबिटीज़ है, किडनी की बीमारी या ईटिंग डिसऑर्डर है, तो इसके बजाय अपने डॉक्टर या डाइटीशियन की योजना का पालन करें।',
  },
}
