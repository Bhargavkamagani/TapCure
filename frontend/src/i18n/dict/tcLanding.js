/**
 * Redesigned landing page (`pages/LandingPage.jsx` + `components/landing/Tc*`).
 *
 * The redesign shipped with every string hardcoded in English — only the navbar
 * went through t(), so switching to తెలుగు or हिंदी visibly changed almost
 * nothing. This file carries the page's own copy in all three languages.
 *
 * Key prefix `tc.` = the TapCure redesign, to keep it apart from `land.*`,
 * which belongs to the PREVIOUS landing page and is kept only for reuse.
 *
 * Translation notes:
 *  - Brand names (TapCure, Leave-Now), doctor names, hospital names and prices
 *    stay in Latin script — they are proper nouns, and a transliterated fee is
 *    harder to read, not easier.
 *  - Telugu and Hindi are written to be spoken plainly, matching the English
 *    voice of the page rather than translating word for word.
 */
export const tcLandingT = {
  /* ── specialties ── */
  'tc.spec.eyebrow': { en: 'Every specialty', te: 'ప్రతి స్పెషాలిటీ', hi: 'हर विशेषज्ञता' },
  'tc.spec.h2a': { en: 'Whatever it is,', te: 'సమస్య ఏదైనా,', hi: 'तकलीफ़ जो भी हो,' },
  'tc.spec.h2b': { en: 'someone good is', te: 'మంచి వైద్యుడు', hi: 'कोई अच्छा डॉक्टर' },
  'tc.spec.h2c': { en: 'free today', te: 'ఈరోజు అందుబాటులో', hi: 'आज उपलब्ध है' },
  'tc.spec.cardiology': { en: 'Cardiology', te: 'కార్డియాలజీ', hi: 'हृदय रोग' },
  'tc.spec.neurology': { en: 'Neurology', te: 'న్యూరాలజీ', hi: 'तंत्रिका रोग' },
  'tc.spec.orthopedics': { en: 'Orthopedics', te: 'ఆర్థోపెడిక్స్', hi: 'हड्डी रोग' },
  'tc.spec.general': { en: 'General Physician', te: 'సాధారణ వైద్యుడు', hi: 'सामान्य चिकित्सक' },
  'tc.spec.pediatrics': { en: 'Pediatrics', te: 'పిల్లల వైద్యం', hi: 'बाल रोग' },
  'tc.spec.dental': { en: 'Dental', te: 'దంత వైద్యం', hi: 'दंत चिकित्सा' },
  'tc.spec.ophthalmology': { en: 'Ophthalmology', te: 'నేత్ర వైద్యం', hi: 'नेत्र रोग' },
  'tc.spec.dermatology': { en: 'Dermatology', te: 'చర్మ వైద్యం', hi: 'त्वचा रोग' },

  /* ── stats ── */
  'tc.stat.specialties': { en: 'Specialties you can book', te: 'మీరు బుక్ చేయగల స్పెషాలిటీలు', hi: 'विशेषज्ञताएँ जो आप बुक कर सकते हैं' },
  'tc.stat.languages': { en: 'Languages — English, తెలుగు, हिंदी', te: 'భాషలు — English, తెలుగు, हिंदी', hi: 'भाषाएँ — English, తెలుగు, हिंदी' },
  'tc.stat.family': { en: 'Family members on one account', te: 'ఒకే ఖాతాలో కుటుంబ సభ్యులు', hi: 'एक ही खाते में परिवार के सदस्य' },
  'tc.stat.fee': { en: 'Rupees to book. That is the whole fee.', te: 'బుకింగ్‌కు రూపాయలు. ఫీజు అంతే.', hi: 'बुकिंग के रुपये। पूरी फ़ीस बस इतनी।' },

  /* ── doctors ── */
  'tc.doc.eyebrow': { en: 'Book today', te: 'ఈరోజే బుక్ చేయండి', hi: 'आज ही बुक करें' },
  'tc.doc.h2a': { en: 'Doctors near you,', te: 'మీ దగ్గరి వైద్యులు,', hi: 'आपके पास के डॉक्टर,' },
  'tc.doc.h2b': { en: 'seen sooner', te: 'త్వరగా కలవండి', hi: 'जल्दी दिखाइए' },
  'tc.doc.note': {
    en: 'A sample of what a listing looks like. Search to see who is free near you.',
    te: 'జాబితా ఎలా ఉంటుందో ఒక నమూనా. మీ దగ్గర ఎవరు అందుబాటులో ఉన్నారో వెతకండి.',
    hi: 'लिस्टिंग कैसी दिखती है, उसका एक नमूना। अपने पास उपलब्ध डॉक्टर खोजें।',
  },
  'tc.doc.availableToday': { en: 'Available today', te: 'ఈరోజు అందుబాటులో', hi: 'आज उपलब्ध' },
  'tc.doc.experience': { en: 'Experience', te: 'అనుభవం', hi: 'अनुभव' },
  'tc.doc.today': { en: 'Today', te: 'ఈరోజు', hi: 'आज' },
  'tc.doc.available': { en: 'Available', te: 'అందుబాటులో', hi: 'उपलब्ध' },
  'tc.doc.consultation': { en: 'Consultation', te: 'కన్సల్టేషన్', hi: 'परामर्श' },
  'tc.doc.years': { en: 'yrs', te: 'సం.', hi: 'वर्ष' },
  'tc.doc.reviews': { en: 'reviews', te: 'సమీక్షలు', hi: 'समीक्षाएँ' },
  'tc.doc.findOne': { en: 'Find one', te: 'ఒకరిని కనుగొనండి', hi: 'डॉक्टर खोजें' },
  'tc.spec.bookToday': { en: 'Book today', te: 'ఈరోజే బుక్ చేయండి', hi: 'आज बुक करें' },

  /* ── testimonials ── */
  'tc.quote.eyebrow': { en: 'Patient voices', te: 'రోగుల మాటలు', hi: 'मरीज़ों की बातें' },
  'tc.quote.h2a': { en: 'The waiting room,', te: 'వెయిటింగ్ రూమ్,', hi: 'वेटिंग रूम,' },
  'tc.quote.h2b': { en: 'emptied', te: 'ఖాళీ అయ్యింది', hi: 'खाली हो गया' },
  'tc.quote1': {
    en: 'I used to leave an hour early and still sit for forty minutes. TapCure buzzed at 4:12, I walked in at 4:56, and the nurse called my name at 5:01.',
    te: 'ముందు గంట ముందే బయలుదేరినా నలభై నిమిషాలు కూర్చోవాల్సి వచ్చేది. TapCure 4:12కి గుర్తు చేసింది, నేను 4:56కి చేరుకున్నాను, 5:01కి నర్సు నా పేరు పిలిచారు.',
    hi: 'पहले एक घंटा जल्दी निकलकर भी चालीस मिनट बैठना पड़ता था। TapCure ने 4:12 पर बताया, मैं 4:56 पर पहुँचा, और 5:01 पर नर्स ने मेरा नाम पुकारा।',
  },
  'tc.quote1.role': { en: 'Product designer · Hyderabad', te: 'ప్రొడక్ట్ డిజైనర్ · హైదరాబాద్', hi: 'प्रोडक्ट डिज़ाइनर · हैदराबाद' },
  'tc.quote2': {
    en: 'My father is 78. Getting him out of the house at the right time used to be the whole battle. Now the phone just tells us, and we go.',
    te: 'మా నాన్నగారికి 78 ఏళ్లు. సరైన సమయానికి ఇంటి నుండి బయలుదేరడమే పెద్ద పని. ఇప్పుడు ఫోన్ చెబుతుంది, మేము బయలుదేరతాం.',
    hi: 'मेरे पिता 78 के हैं। सही समय पर उन्हें घर से निकालना ही सबसे बड़ी चुनौती थी। अब फ़ोन बता देता है, और हम निकल पड़ते हैं।',
  },
  'tc.quote2.role': { en: 'Bengaluru', te: 'బెంగళూరు', hi: 'बेंगलुरु' },
  'tc.quote3': {
    en: 'As a hospital, our no-show rate dropped from 14% to under 4% in one quarter. Patients arrive spread out instead of all at once.',
    te: 'ఆసుపత్రిగా, మా నో-షో రేటు ఒక త్రైమాసికంలో 14% నుండి 4% కంటే తక్కువకు తగ్గింది. రోగులు ఒకేసారి కాకుండా విడివిడిగా వస్తున్నారు.',
    hi: 'अस्पताल के तौर पर हमारी नो-शो दर एक तिमाही में 14% से घटकर 4% से नीचे आ गई। मरीज़ एक साथ नहीं, अलग-अलग समय पर आते हैं।',
  },
  'tc.quote3.role': { en: 'Sunrise Multispeciality · Pune', te: 'సన్‌రైజ్ మల్టీస్పెషాలిటీ · పుణె', hi: 'सनराइज़ मल्टीस्पेशलिटी · पुणे' },

  /* ── checks / app ── */
  'tc.checks.eyebrow': { en: 'Works on every phone', te: 'ప్రతి ఫోన్‌లో పనిచేస్తుంది', hi: 'हर फ़ोन पर चलता है' },
  'tc.checks.h2a': { en: 'Your whole visit,', te: 'మీ మొత్తం సందర్శన,', hi: 'आपकी पूरी विज़िट,' },
  'tc.checks.h2b': { en: 'one screen.', te: 'ఒకే స్క్రీన్‌లో.', hi: 'एक ही स्क्रीन पर।' },
  'tc.check1.t': { en: 'Book in seconds, from anywhere', te: 'ఎక్కడి నుండైనా, క్షణాల్లో బుక్ చేయండి', hi: 'कहीं से भी, कुछ ही पलों में बुक करें' },
  'tc.check1.d': {
    en: 'Open TapCure in your browser on any phone or laptop and you are straight in. Our iOS and Android apps are on the way.',
    te: 'ఏ ఫోన్‌లోనైనా, ల్యాప్‌టాప్‌లోనైనా బ్రౌజర్‌లో TapCure తెరిస్తే చాలు. మా iOS, Android యాప్‌లు త్వరలో రానున్నాయి.',
    hi: 'किसी भी फ़ोन या लैपटॉप के ब्राउज़र में TapCure खोलिए, बस हो गया। हमारे iOS और Android ऐप जल्द आ रहे हैं।',
  },
  'tc.check2.t': { en: 'A live token, not a guess', te: 'అంచనా కాదు, ప్రత్యక్ష టోకెన్', hi: 'अंदाज़ा नहीं, लाइव टोकन' },
  'tc.check2.d': {
    en: 'Watch your queue position move in real time, and get told when to set off.',
    te: 'మీ క్యూ స్థానం ప్రత్యక్షంగా కదలడాన్ని చూడండి, ఎప్పుడు బయలుదేరాలో తెలుసుకోండి.',
    hi: 'अपनी क्यू पोज़िशन को लाइव बदलते देखें, और जानें कि कब निकलना है।',
  },
  'tc.check3.t': { en: 'Up to five family members', te: 'ఐదుగురు కుటుంబ సభ్యుల వరకు', hi: 'पाँच परिवार के सदस्यों तक' },
  'tc.check3.d': {
    en: 'Book for parents and children from one account — each keeps their own records and reminders.',
    te: 'ఒకే ఖాతా నుండి తల్లిదండ్రులు, పిల్లల కోసం బుక్ చేయండి — ప్రతి ఒక్కరికీ సొంత రికార్డులు, రిమైండర్లు ఉంటాయి.',
    hi: 'एक ही खाते से माता-पिता और बच्चों के लिए बुक करें — हर किसी के अपने रिकॉर्ड और रिमाइंडर रहते हैं।',
  },
  'tc.check4.t': { en: 'Prescriptions & follow-ups', te: 'ప్రిస్క్రిప్షన్లు & ఫాలో-అప్‌లు', hi: 'पर्चे और फ़ॉलो-अप' },
  'tc.check4.d': {
    en: 'Digital prescriptions land in your account, and the follow-up is booked before you leave.',
    te: 'డిజిటల్ ప్రిస్క్రిప్షన్లు మీ ఖాతాలోకి వస్తాయి, మీరు బయలుదేరే లోపే ఫాలో-అప్ బుక్ అవుతుంది.',
    hi: 'डिजिटल पर्चे आपके खाते में आ जाते हैं, और निकलने से पहले ही फ़ॉलो-अप बुक हो जाता है।',
  },
  'tc.cta.createAccount': { en: 'Create an account', te: 'ఖాతా సృష్టించండి', hi: 'खाता बनाएँ' },
  'tc.cta.seeTiming': { en: 'See how the timing works', te: 'సమయం ఎలా పనిచేస్తుందో చూడండి', hi: 'देखें टाइमिंग कैसे काम करती है' },

  /* ── FAQ shell ── */
  'tc.faq.eyebrow': { en: 'Questions', te: 'ప్రశ్నలు', hi: 'सवाल' },
  'tc.faq.h2a': { en: 'Straight', te: 'సూటిగా', hi: 'सीधे' },
  'tc.faq.h2b': { en: 'answers', te: 'సమాధానాలు', hi: 'जवाब' },
  'tc.faq.lede': {
    en: 'Whether you are booking a visit, running a hospital, or practising on your own.',
    te: 'మీరు సందర్శన బుక్ చేస్తున్నా, ఆసుపత్రి నడుపుతున్నా, లేదా సొంతంగా ప్రాక్టీస్ చేస్తున్నా.',
    hi: 'चाहे आप विज़िट बुक कर रहे हों, अस्पताल चला रहे हों, या अपनी प्रैक्टिस कर रहे हों।',
  },
  'tc.faq.group.patients': { en: 'For patients', te: 'రోగుల కోసం', hi: 'मरीज़ों के लिए' },
  'tc.faq.group.hospitals': { en: 'For hospitals', te: 'ఆసుపత్రుల కోసం', hi: 'अस्पताल के लिए' },
  'tc.faq.group.doctors': { en: 'For doctors', te: 'వైద్యుల కోసం', hi: 'डॉक्टरों के लिए' },
  'tc.faq.stillTitle': { en: 'Still not answered?', te: 'ఇంకా సమాధానం దొరకలేదా?', hi: 'अब भी जवाब नहीं मिला?' },
  'tc.faq.stillBody': {
    en: 'Write to us and a person replies — usually the same day.',
    te: 'మాకు రాయండి, ఒక వ్యక్తి స్పందిస్తారు — సాధారణంగా అదే రోజు.',
    hi: 'हमें लिखिए, कोई व्यक्ति जवाब देगा — आम तौर पर उसी दिन।',
  },
  'tc.faq.contact': { en: 'Contact us', te: 'మమ్మల్ని సంప్రదించండి', hi: 'संपर्क करें' },

  /* ── closing CTA ── */
  // Previous fee copy: { en: '₹10 to book', te: 'బుకింగ్‌కు ₹10', hi: 'बुकింగ్ ₹10' },
  'tc.close.eyebrow': { en: 'Free to book', te: 'ఉచితంగా బుక్ చేయండి', hi: 'मुफ़्त बुकिंग' },
  'tc.close.h2a': { en: 'Stop leaving early', te: 'ముందుగా బయలుదేరడం', hi: 'जल्दी निकलना' },
  'tc.close.h2b': { en: 'just in case.', te: 'ఇక ఆపేయండి.', hi: 'अब बंद कीजिए।' },
  'tc.close.lede': {
    en: 'Book your next appointment in three taps and let TapCure handle the timing.',
    te: 'మీ తదుపరి అపాయింట్‌మెంట్‌ను మూడు ట్యాప్‌లలో బుక్ చేయండి, సమయాన్ని TapCure చూసుకుంటుంది.',
    hi: 'अपना अगला अपॉइंटमेंट तीन टैप में बुक कीजिए, टाइमिंग TapCure संभाल लेगा।',
  },
  'tc.close.book': { en: 'Book an appointment', te: 'అపాయింట్‌మెంట్ బుక్ చేయండి', hi: 'अपॉइंटमेंट बुक करें' },
  'tc.close.seeLeaveNow': { en: 'See Leave-Now again', te: 'Leave-Now మళ్లీ చూడండి', hi: 'Leave-Now फिर देखें' },
  'tc.close.fineprint': {
    // Previous fee copy:
    // en: '₹10 to book · Cancel free up to 2 hours before',
    // te: 'బుకింగ్‌కు ₹10 · 2 గంటల ముందు వరకు ఉచితంగా రద్దు',
    // hi: 'बुकింగ్ ₹10 · 2 घंटे पहले तक मुफ़्त रद्द',
    en: 'No booking fee · Cancel free up to 2 hours before',
    te: 'బుకింగ్ ఫీజు లేదు · 2 గంటల ముందు వరకు ఉచితంగా రద్దు',
    hi: 'कोई बुकिंग शुल्क नहीं · 2 घंटे पहले तक मुफ़्त रद्द',
  },

  /* ── phone mock (the illustrated screen in the app section) ── */
  'tc.phone.hello': { en: 'Good afternoon,', te: 'శుభ మధ్యాహ్నం,', hi: 'नमस्कार,' },
  'tc.phone.leaveIn': { en: 'Leave home in', te: 'ఇంటి నుండి బయలుదేరాల్సిన సమయం', hi: 'घर से निकलने में' },
  'tc.phone.appt': {
    en: 'Dr. Anaya Rao · 5:00 PM · Sunrise Hospital',
    te: 'డా. అనయా రావు · సాయంత్రం 5:00 · సన్‌రైజ్ ఆసుపత్రి',
    hi: 'डॉ. अनया राव · शाम 5:00 · सनराइज़ अस्पताल',
  },

  /* ── footer ── */
  'tc.foot.tagline': { en: 'One tap to cure', te: 'ఒక్క ట్యాప్‌తో చికిత్స', hi: 'एक टैप, इलाज़ शुरू' },
  'tc.foot.blurb': {
    en: 'Book appointment. Get token. Travel at the right time — healthcare made calm for Tier-2 and rural India.',
    te: 'అపాయింట్‌మెంట్ బుక్ చేయండి. టోకెన్ పొందండి. సరైన సమయానికి బయలుదేరండి — టైర్-2, గ్రామీణ భారతదేశం కోసం ప్రశాంతమైన ఆరోగ్య సేవ.',
    hi: 'अपॉइंटमेंट बुक करें। टोकन पाएँ। सही समय पर निकलें — टियर-2 और ग्रामीण भारत के लिए सुकून भरी स्वास्थ्य सेवा।',
  },
  'tc.foot.getInTouch': { en: 'Get in touch', te: 'సంప్రదించండి', hi: 'संपर्क करें' },
  'tc.foot.becomePartner': { en: 'Become a Partner', te: 'భాగస్వామి కండి', hi: 'पार्टनर बनें' },
  'tc.foot.explore': { en: 'Explore', te: 'అన్వేషించండి', hi: 'एक्सप्लोर' },
  'tc.foot.partners': { en: 'Partners', te: 'భాగస్వాములు', hi: 'पार्टनर' },
  'tc.foot.legal': { en: 'Legal', te: 'చట్టపరమైనవి', hi: 'कानूनी' },
  'tc.foot.reachUs': { en: 'Reach us', te: 'మమ్మల్ని చేరుకోండి', hi: 'हमसे संपर्क' },
  'tc.foot.about': { en: 'About Us', te: 'మా గురించి', hi: 'हमारे बारे में' },
  'tc.foot.features': { en: 'Features', te: 'ఫీచర్లు', hi: 'विशेषताएँ' },
  'tc.foot.pricing': { en: 'Pricing', te: 'ధరలు', hi: 'मूल्य' },
  'tc.foot.faq': { en: 'FAQ', te: 'తరచు ప్రశ్నలు', hi: 'सामान्य प्रश्न' },
  'tc.foot.help': { en: 'Help & Support', te: 'సహాయం & మద్దతు', hi: 'सहायता और सपोर्ट' },
  'tc.foot.resources': { en: 'Resources', te: 'వనరులు', hi: 'संसाधन' },
  'tc.foot.calculators': { en: 'Health Calculators', te: 'ఆరోగ్య కాలిక్యులేటర్లు', hi: 'स्वास्थ्य कैलकुलेटर' },
  'tc.foot.articles': { en: 'Health Articles', te: 'ఆరోగ్య వ్యాసాలు', hi: 'स्वास्थ्य लेख' },
  'tc.foot.contact': { en: 'Contact Us', te: 'మమ్మల్ని సంప్రదించండి', hi: 'संपर्क करें' },
  'tc.foot.joinDoctor': { en: 'Join as a Doctor', te: 'వైద్యుడిగా చేరండి', hi: 'डॉक्टर के रूप में जुड़ें' },
  'tc.foot.hospitalLogin': { en: 'Hospital Login', te: 'ఆసుపత్రి లాగిన్', hi: 'अस्पताल लॉगिन' },
  'tc.foot.policies': { en: 'Policies', te: 'విధానాలు', hi: 'नीतियाँ' },
  'tc.foot.privacy': { en: 'Privacy Policy', te: 'గోప్యతా విధానం', hi: 'गोपनीयता नीति' },
  'tc.foot.terms': { en: 'Terms & Conditions', te: 'నిబంధనలు & షరతులు', hi: 'नियम एवं शर्तें' },
  'tc.foot.refund': { en: 'Cancellation & Refund', te: 'రద్దు & రీఫండ్', hi: 'रद्दीकरण और रिफ़ंड' },
  'tc.foot.disclaimer': { en: 'Medical Disclaimer', te: 'వైద్య నిరాకరణ', hi: 'चिकित्सा अस्वीकरण' },
  'tc.foot.hyderabad': { en: 'Hyderabad, India', te: 'హైదరాబాద్, భారతదేశం', hi: 'हैदराबाद, भारत' },
  'tc.foot.hours': { en: 'Mon–Sat · 9 AM – 7 PM IST', te: 'సోమ–శని · ఉదయం 9 – సాయంత్రం 7 IST', hi: 'सोम–शनि · सुबह 9 – शाम 7 IST' },
  'tc.foot.privacyShort': { en: 'Privacy', te: 'గోప్యత', hi: 'गोपनीयता' },
  'tc.foot.termsShort': { en: 'Terms', te: 'నిబంధనలు', hi: 'शर्तें' },
  'tc.foot.refundsShort': { en: 'Refunds', te: 'రీఫండ్‌లు', hi: 'रिफ़ंड' },
  'tc.foot.disclaimerShort': { en: 'Disclaimer', te: 'నిరాకరణ', hi: 'अस्वीकरण' },
  'tc.foot.madeWith': { en: 'Made with care in Hyderabad', te: 'హైదరాబాద్‌లో శ్రద్ధతో రూపొందించబడింది', hi: 'हैदराबाद में जतन से बनाया गया' },
}
