/**
 * Telugu/Hindi strings added in the 2026-09-19 translation sweep (landingExtra).
 *
 * Covers the leftovers on the public landing page: LandingPage.jsx (nav theme
 * toggle, hero booking bar, specialty marquee), TcSections.jsx (stats, phone
 * mock, doctor languages), TcLeaveNow.jsx, TcLedger.jsx (the 60-second check)
 * and the result text of CalculatorModal.jsx.
 *
 * Numbers and thresholds are never translated — they arrive as {placeholders}.
 */
export const landingExtraT = {
  // ---- Units / shared ----
  'lx.min': { en: '{n} min', te: '{n} నిమి', hi: '{n} मिनट' },
  'lx.unit.kcal': { en: 'kcal', te: 'కేలరీలు', hi: 'कैलोरी' },
  'lx.unit.kcalADay': { en: 'kcal a day', te: 'కేలరీలు రోజుకు', hi: 'कैलोरी रोज़' },
  'lx.unit.kcalPerDay': { en: 'kcal/day', te: 'కేలరీలు/రోజు', hi: 'कैलोरी/दिन' },
  'lx.unit.yrs': { en: 'yrs', te: 'సం.', hi: 'वर्ष' },
  'lx.unit.nYrs': { en: '{n} yrs', te: '{n} సం.', hi: '{n} वर्ष' },
  'lx.unit.nHrs': { en: '{n} hrs', te: '{n} గం.', hi: '{n} घंटे' },

  // ---- LandingPage: nav ----
  'lx.nav.toLight': { en: 'Switch to light theme', te: 'లైట్ థీమ్‌కు మారండి', hi: 'लाइट थीम पर जाएँ' },
  'lx.nav.toDark': { en: 'Switch to dark theme', te: 'డార్క్ థీమ్‌కు మారండి', hi: 'डार्क थीम पर जाएँ' },
  'lx.nav.lightMode': { en: 'Light mode', te: 'లైట్ మోడ్', hi: 'लाइट मोड' },
  'lx.nav.darkMode': { en: 'Dark mode', te: 'డార్క్ మోడ్', hi: 'डार्क मोड' },

  // ---- LandingPage: hero ----
  'lx.hero.thisWeek': { en: 'This week', te: 'ఈ వారం', hi: 'इस हफ़्ते' },
  'lx.hero.minShort': { en: '{n}m', te: '{n}ని', hi: '{n} मि' },

  // Specialty names shown in the hero select and the marquee. The option
  // VALUE stays English (it is the search query); only the label is translated.
  'lx.spec.generalphysician': { en: 'General Physician', te: 'సాధారణ వైద్యుడు', hi: 'सामान्य चिकित्सक' },
  'lx.spec.cardiology': { en: 'Cardiology', te: 'కార్డియాలజీ', hi: 'हृदय रोग' },
  'lx.spec.pediatrics': { en: 'Pediatrics', te: 'పిల్లల వైద్యం', hi: 'बाल रोग' },
  'lx.spec.paediatrics': { en: 'Paediatrics', te: 'పిల్లల వైద్యం', hi: 'बाल रोग' },
  'lx.spec.dermatology': { en: 'Dermatology', te: 'చర్మ వైద్యం', hi: 'त्वचा रोग' },
  'lx.spec.orthopedics': { en: 'Orthopedics', te: 'ఆర్థోపెడిక్స్', hi: 'हड्डी रोग' },
  'lx.spec.orthopaedics': { en: 'Orthopaedics', te: 'ఆర్థోపెడిక్స్', hi: 'हड्डी रोग' },
  'lx.spec.gynecology': { en: 'Gynecology', te: 'స్త్రీ వైద్యం', hi: 'स्त्री रोग' },
  'lx.spec.gynaecology': { en: 'Gynaecology', te: 'స్త్రీ వైద్యం', hi: 'स्त्री रोग' },
  'lx.spec.ent': { en: 'ENT', te: 'చెవి, ముక్కు, గొంతు', hi: 'नाक, कान, गला' },
  'lx.spec.dental': { en: 'Dental', te: 'దంత వైద్యం', hi: 'दंत चिकित्सा' },
  'lx.spec.dentistry': { en: 'Dentistry', te: 'దంత వైద్యం', hi: 'दंत चिकित्सा' },
  'lx.spec.ophthalmology': { en: 'Ophthalmology', te: 'నేత్ర వైద్యం', hi: 'नेत्र रोग' },
  'lx.spec.neurology': { en: 'Neurology', te: 'న్యూరాలజీ', hi: 'तंत्रिका रोग' },
  'lx.spec.psychiatry': { en: 'Psychiatry', te: 'మానసిక వైద్యం', hi: 'मनोचिकित्सा' },
  'lx.spec.nutrition': { en: 'Nutrition', te: 'పోషకాహారం', hi: 'पोषण' },

  // ---- HeroVisual ----
  'lx.heroVisual.alt': {
    en: 'Family booking a doctor appointment near a hospital',
    te: 'ఆసుపత్రి దగ్గర డాక్టర్ అపాయింట్‌మెంట్ బుక్ చేస్తున్న కుటుంబం',
    hi: 'अस्पताल के पास डॉक्टर का अपॉइंटमेंट बुक करता परिवार',
  },

  // ---- TcSections: stats ----
  'lx.stat.kept': { en: 'Appointments kept on time', te: 'సమయానికి జరిగిన అపాయింట్‌మెంట్‌లు', hi: 'समय पर हुए अपॉइंटमेंट' },
  'lx.stat.rating': { en: 'Average rating', te: 'సగటు రేటింగ్', hi: 'औसत रेटिंग' },
  'lx.stat.family': { en: 'Family members on one account', te: 'ఒకే ఖాతాలో కుటుంబ సభ్యులు', hi: 'एक ही खाते में परिवार के सदस्य' },
  'lx.stat.reviews': { en: 'Patient reviews', te: 'రోగుల సమీక్షలు', hi: 'मरीज़ों की समीक्षाएँ' },

  // ---- TcSections: doctor card languages ----
  'lx.doc.langs.teHiEn': { en: 'Telugu, Hindi, English', te: 'తెలుగు, హిందీ, ఇంగ్లీష్', hi: 'तेलुगु, हिंदी, अंग्रेज़ी' },
  'lx.doc.langs.hiEnMl': { en: 'Hindi, English, Malayalam', te: 'హిందీ, ఇంగ్లీష్, మలయాళం', hi: 'हिंदी, अंग्रेज़ी, मलयालम' },
  'lx.doc.langs.urHiEn': { en: 'Urdu, Hindi, English', te: 'ఉర్దూ, హిందీ, ఇంగ్లీష్', hi: 'उर्दू, हिंदी, अंग्रेज़ी' },

  // ---- TcSections: phone mock ----
  'lx.phone.traffic': { en: 'Traffic on your road', te: 'మీ దారిలో ట్రాఫిక్', hi: 'आपके रास्ते पर ट्रैफ़िक' },
  'lx.phone.trafficSub': { en: '+4 min vs. usual · route updated', te: 'సాధారణం కంటే +4 నిమి · మార్గం మార్చబడింది', hi: 'सामान्य से +4 मिनट · रास्ता अपडेट हुआ' },
  'lx.phone.onSchedule': { en: 'Hospital on schedule', te: 'ఆసుపత్రి సమయానికి నడుస్తోంది', hi: 'अस्पताल समय पर चल रहा है' },
  'lx.phone.onScheduleSub': { en: '3 patients before you · 12 min wait', te: 'మీ ముందు 3 మంది · 12 నిమి వేచి ఉండాలి', hi: 'आपसे पहले 3 मरीज़ · 12 मिनट इंतज़ार' },
  'lx.phone.saved': { en: 'Your details are saved', te: 'మీ వివరాలు సేవ్ అయ్యాయి', hi: 'आपकी जानकारी सेव है' },
  'lx.phone.savedSub': { en: 'No forms to fill at the desk', te: 'డెస్క్ వద్ద ఫారాలు నింపాల్సిన పని లేదు', hi: 'डेस्क पर कोई फ़ॉर्म नहीं भरना' },

  // ---- TcLeaveNow ----
  'lx.ln.nowSlot': {
    en: 'Now {now} {nowAp} · Your turn at {slot} {slotAp}',
    te: 'ఇప్పుడు {now} {nowAp} · మీ వంతు {slot} {slotAp}కి',
    hi: 'अभी {now} {nowAp} · आपकी बारी {slot} {slotAp} पर',
  },

  // ---- TcLedger: questions ----
  'lx.lg.waist': { en: 'Waist, measured at the belly button', te: 'నడుము, బొడ్డు వద్ద కొలిచినది', hi: 'कमर, नाभि के पास नापी गई' },
  'lx.lg.sleep': { en: 'Hours you sleep on a normal night', te: 'సాధారణ రాత్రి మీరు నిద్రపోయే గంటలు', hi: 'आम रात में आप कितने घंटे सोते हैं' },
  'lx.lg.howTall': { en: 'How tall are you?', te: 'మీ ఎత్తు ఎంత?', hi: 'आपकी लंबाई कितनी है?' },
  'lx.lg.howHeavy': { en: 'And how much do you weigh?', te: 'మీ బరువు ఎంత?', hi: 'और आपका वज़न कितना है?' },
  'lx.lg.howOld': { en: 'How old are you?', te: 'మీ వయస్సు ఎంత?', hi: 'आपकी उम्र कितनी है?' },
  'lx.lg.guessFat': { en: 'Your guess at your body fat', te: 'మీ శరీర కొవ్వుపై మీ అంచనా', hi: 'आपके शरीर की वसा का आपका अंदाज़ा' },

  // ---- TcLedger: the "minutes back" ledger rows ----
  'lx.lg.rowSleep': {
    en: 'Sleeping only {h} hours instead of 7',
    te: '7 గంటలకు బదులు కేవలం {h} గంటలే నిద్ర',
    hi: '7 की जगह सिर्फ़ {h} घंटे की नींद',
  },
  'lx.lg.rowBmi': {
    en: 'Your BMI is {v}, healthy is under 22.9',
    te: 'మీ BMI {v}, ఆరోగ్యకరమైనది 22.9 కంటే తక్కువ',
    hi: 'आपका BMI {v} है, स्वस्थ 22.9 से कम होता है',
  },
  'lx.lg.rowWaist': {
    en: 'Your waist is {v}% of your height',
    te: 'మీ నడుము మీ ఎత్తులో {v}%',
    hi: 'आपकी कमर आपकी लंबाई का {v}% है',
  },

  // ---- TcLedger: advice ladder ----
  'lx.lg.advice.waist60': {
    en: 'Your waist is more than 60% of your height. That is the biggest warning sign on this page. A doctor will usually start with a simple blood test for sugar and cholesterol.',
    te: 'మీ నడుము మీ ఎత్తులో 60% కంటే ఎక్కువగా ఉంది. ఈ పేజీలో ఇదే అతి పెద్ద హెచ్చరిక సంకేతం. డాక్టర్ సాధారణంగా షుగర్, కొలెస్ట్రాల్ కోసం ఒక సాధారణ రక్త పరీక్షతో మొదలుపెడతారు.',
    hi: 'आपकी कमर आपकी लंबाई के 60% से ज़्यादा है। इस पेज पर यही सबसे बड़ा चेतावनी संकेत है। डॉक्टर आमतौर पर शुगर और कोलेस्ट्रॉल के लिए एक आसान ब्लड टेस्ट से शुरुआत करते हैं।',
  },
  'lx.lg.advice.bmi': {
    en: 'Your BMI is in the high range for Indian adults. This is worth a doctor visit — not a diet plan off the internet. A simple blood test will show what is actually going on.',
    te: 'భారతీయ వయోజనులకు మీ BMI ఎక్కువ పరిధిలో ఉంది. దీనికి ఇంటర్నెట్‌లోని డైట్ ప్లాన్ కాదు — డాక్టర్‌ను కలవడం మంచిది. ఒక సాధారణ రక్త పరీక్షతో అసలు ఏం జరుగుతోందో తెలుస్తుంది.',
    hi: 'भारतीय वयस्कों के हिसाब से आपका BMI ऊँची सीमा में है। इसके लिए इंटरनेट का डाइट प्लान नहीं — डॉक्टर से मिलना सही रहेगा। एक आसान ब्लड टेस्ट से पता चलेगा कि असल में क्या हो रहा है।',
  },
  'lx.lg.advice.waist50': {
    en: 'Your waist is the number to watch. It tells a doctor more than BMI does. Worth getting a basic check-up done.',
    te: 'మీ నడుము కొలతే గమనించాల్సిన సంఖ్య. ఇది BMI కంటే డాక్టర్‌కు ఎక్కువ చెబుతుంది. ఒక ప్రాథమిక చెకప్ చేయించుకోవడం మంచిది.',
    hi: 'आपकी कमर ही वह संख्या है जिस पर नज़र रखनी है। यह डॉक्टर को BMI से ज़्यादा बताती है। एक बेसिक चेक-अप करवा लेना अच्छा रहेगा।',
  },
  'lx.lg.advice.sleep': {
    en: 'You are sleeping under six hours. That pushes your blood pressure up quietly, long before you feel anything. Mention it to a doctor.',
    te: 'మీరు ఆరు గంటల కంటే తక్కువ నిద్రపోతున్నారు. మీకు ఏమీ తెలియక ముందే ఇది మీ రక్తపోటును నిశ్శబ్దంగా పెంచుతుంది. డాక్టర్‌కు చెప్పండి.',
    hi: 'आप छह घंटे से कम सो रहे हैं। इससे कुछ महसूस होने से बहुत पहले ही आपका ब्लड प्रेशर चुपचाप बढ़ने लगता है। डॉक्टर को ज़रूर बताएँ।',
  },
  'lx.lg.advice.under': {
    en: 'You are below the healthy weight range. A doctor will want to find out why, rather than just tell you to eat more.',
    te: 'మీరు ఆరోగ్యకరమైన బరువు పరిధి కంటే తక్కువగా ఉన్నారు. ఎక్కువ తినమని చెప్పడం కంటే, దానికి కారణం ఏమిటో డాక్టర్ తెలుసుకోవాలనుకుంటారు.',
    hi: 'आपका वज़न स्वस्थ सीमा से कम है। डॉक्टर सिर्फ़ ज़्यादा खाने को कहने के बजाय इसकी वजह जानना चाहेंगे।',
  },
  'lx.lg.advice.fine': {
    en: 'Nothing here looks worrying. Still worth one check-up a year — it takes twenty minutes and catches things early.',
    te: 'ఇక్కడ ఆందోళన కలిగించేది ఏమీ లేదు. అయినా సంవత్సరానికి ఒక చెకప్ చేయించుకోవడం మంచిది — ఇరవై నిమిషాలే పడుతుంది, సమస్యలను ముందుగానే పట్టుకుంటుంది.',
    hi: 'यहाँ चिंता की कोई बात नहीं दिखती। फिर भी साल में एक चेक-अप करवाना अच्छा है — बस बीस मिनट लगते हैं और समस्याएँ जल्दी पकड़ में आ जाती हैं।',
  },

  // ---- TcLedger: hero card ----
  'lx.lg.card.winBack': { en: 'Minutes you can win back', te: 'మీరు తిరిగి పొందగల నిమిషాలు', hi: 'मिनट जो आप वापस पा सकते हैं' },
  'lx.lg.card.deskJob': { en: 'What a desk job costs', te: 'డెస్క్ ఉద్యోగం ఖరీదు', hi: 'डेस्क जॉब की क़ीमत' },
  'lx.lg.card.cta': { en: 'Check yours in 60 seconds', te: '60 సెకన్లలో మీది చెక్ చేసుకోండి', hi: '60 सेकंड में अपना चेक करें' },

  // ---- TcLedger: sheet ----
  'lx.lg.yourBodyFat': { en: 'Your body fat', te: 'మీ శరీర కొవ్వు', hi: 'आपके शरीर की वसा' },
  'lx.lg.privacyBody': {
    en: 'It is all worked out on your own phone or computer. We use the healthy ranges set for Indian and Asian bodies, which are lower than the European ones. These numbers are estimates to help you talk to a doctor — they are not a diagnosis.',
    te: 'అంతా మీ ఫోన్ లేదా కంప్యూటర్‌లోనే లెక్కించబడుతుంది. భారతీయ, ఆసియా శరీరాల కోసం నిర్ణయించిన ఆరోగ్యకర పరిధులను మేము వాడతాము — ఇవి యూరోపియన్ పరిధుల కంటే తక్కువ. ఈ సంఖ్యలు డాక్టర్‌తో మాట్లాడటానికి సహాయపడే అంచనాలు మాత్రమే — ఇవి రోగ నిర్ధారణ కాదు.',
    hi: 'सब कुछ आपके अपने फ़ोन या कंप्यूटर पर ही निकाला जाता है। हम भारतीय और एशियाई शरीर के लिए तय स्वस्थ सीमाएँ इस्तेमाल करते हैं, जो यूरोपीय सीमाओं से कम हैं। ये संख्याएँ डॉक्टर से बात करने में मदद के लिए अनुमान हैं — यह कोई निदान नहीं है।',
  },
  'lx.lg.backToBmi': { en: 'Back to your BMI · {v}', te: 'మీ BMI కి తిరిగి వెళ్ళండి · {v}', hi: 'अपने BMI पर वापस जाएँ · {v}' },

  'lx.lg.bmiNoteA': {
    en: 'BMI is just your weight against your height — it does not know muscle from fat, which is why your body fat above tells you more. Healthy is under',
    te: 'BMI అంటే మీ ఎత్తుతో పోల్చిన మీ బరువు మాత్రమే — కండరానికి, కొవ్వుకు తేడా దానికి తెలియదు; అందుకే పైన ఉన్న మీ శరీర కొవ్వు ఎక్కువ చెబుతుంది. ఆరోగ్యకరమైనది',
    hi: 'BMI बस आपकी लंबाई के मुक़ाबले आपका वज़न है — यह मांसपेशी और चर्बी में फ़र्क़ नहीं जानता, इसीलिए ऊपर दिखी आपकी शरीर की वसा ज़्यादा बताती है। स्वस्थ BMI',
  },
  'lx.lg.bmiNoteB': {
    en: 'for Indian and Asian adults, lower than the European figure of 24.9.',
    te: 'కంటే తక్కువ — ఇది భారతీయ, ఆసియా వయోజనుల కోసం; యూరోపియన్ సంఖ్య 24.9 కంటే తక్కువ.',
    hi: 'से कम है — यह भारतीय और एशियाई वयस्कों के लिए है, जो यूरोपीय आँकड़े 24.9 से कम है।',
  },

  'lx.lg.calA': {
    en: 'This is what you can eat to stay at {w} kg. Even lying in bed all day your body uses',
    te: '{w} kg వద్ద ఉండటానికి మీరు ఇంత తినవచ్చు. రోజంతా మంచం మీద పడుకున్నా మీ శరీరం ఉపయోగించేది',
    hi: '{w} kg पर बने रहने के लिए आप इतना खा सकते हैं। दिन भर बिस्तर पर लेटे रहें तब भी आपका शरीर खर्च करता है',
  },
  'lx.lg.calB': {
    en: '— the rest comes from moving around. Eat less than this and you lose weight. Eat more and you gain.',
    te: '— మిగతాది కదలిక ద్వారా ఖర్చవుతుంది. దీనికంటే తక్కువ తింటే బరువు తగ్గుతారు. ఎక్కువ తింటే పెరుగుతారు.',
    hi: '— बाक़ी चलने-फिरने से खर्च होता है। इससे कम खाएँगे तो वज़न घटेगा। ज़्यादा खाएँगे तो बढ़ेगा।',
  },

  'lx.lg.idealA': { en: 'That is the middle of your healthy range —', te: 'ఇది మీ ఆరోగ్యకర పరిధికి మధ్యలో ఉంది —', hi: 'यह आपकी स्वस्थ सीमा का बीच का हिस्सा है —' },
  'lx.lg.idealB': { en: 'for someone {h} cm tall. You are', te: '({h} cm ఎత్తు ఉన్నవారికి). మీరు ప్రస్తుతం', hi: '({h} cm लंबे व्यक्ति के लिए)। आप अभी' },
  'lx.lg.idealOver': { en: ' — that is {n} kg over.', te: ' — అంటే {n} kg ఎక్కువ.', hi: ' — यानी {n} kg ज़्यादा।' },
  'lx.lg.idealUnder': { en: ' — that is {n} kg under.', te: ' — అంటే {n} kg తక్కువ.', hi: ' — यानी {n} kg कम।' },

  'lx.lg.minsNone': {
    en: 'Nothing here is costing you time. That is rarer than you would think.',
    te: 'ఇక్కడ ఏదీ మీ సమయాన్ని తీసుకోవడం లేదు. ఇది మీరు అనుకునే దానికంటే అరుదు.',
    hi: 'यहाँ कुछ भी आपका समय नहीं ले रहा। ऐसा आपकी सोच से कहीं कम होता है।',
  },
  'lx.lg.minsSome': {
    en: 'That is about {h} hours a day you could get back. Every single line below can be changed.',
    te: 'అంటే రోజుకు సుమారు {h} గంటలు మీరు తిరిగి పొందవచ్చు. కింద ఉన్న ప్రతి అంశాన్నీ మార్చుకోవచ్చు.',
    hi: 'यानी रोज़ लगभग {h} घंटे आप वापस पा सकते हैं। नीचे दी गई हर एक बात बदली जा सकती है।',
  },
  'lx.lg.plusMin': { en: '+{n} min', te: '+{n} నిమి', hi: '+{n} मिनट' },
  'lx.lg.minADay': { en: '{n} min a day', te: 'రోజుకు {n} నిమి', hi: 'रोज़ {n} मिनट' },

  'lx.lg.halfHeight': { en: 'Half of your height is', te: 'మీ ఎత్తులో సగం', hi: 'आपकी लंबाई का आधा है' },
  'lx.lg.waistIs': { en: '— your waist is', te: '— మీ నడుము', hi: '— आपकी कमर है' },

  'lx.lg.healthyRange': { en: 'Healthy range {lo} – {hi} kg', te: 'ఆరోగ్యకర పరిధి {lo} – {hi} kg', hi: 'स्वस्थ सीमा {lo} – {hi} kg' },

  // ---- CalculatorModal: result labels (from lib/calculators.js compute()) ----
  'lx.calc.underweight': { en: 'Underweight', te: 'తక్కువ బరువు', hi: 'कम वज़न' },
  'lx.calc.normal': { en: 'Normal weight', te: 'సాధారణ బరువు', hi: 'सामान्य वज़न' },
  'lx.calc.overweight': { en: 'Overweight', te: 'అధిక బరువు', hi: 'ज़्यादा वज़न' },
  'lx.calc.obese': { en: 'Obese', te: 'ఊబకాయం', hi: 'मोटापा' },
  'lx.calc.maintenance': { en: 'Maintenance calories', te: 'బరువు నిలబెట్టే కేలరీలు', hi: 'वज़न बनाए रखने वाली कैलोरी' },
  'lx.calc.withinHealthy': { en: 'Within healthy range', te: 'ఆరోగ్యకర పరిధిలో ఉంది', hi: 'स्वस्थ सीमा के अंदर' },
  'lx.calc.aboveHealthy': { en: 'Above healthy range', te: 'ఆరోగ్యకర పరిధి కంటే ఎక్కువ', hi: 'स्वस्थ सीमा से ऊपर' },
  'lx.calc.bmr': { en: 'Basal metabolic rate', te: 'బేసల్ మెటబాలిక్ రేట్', hi: 'बेसल मेटाबॉलिक रेट' },
  'lx.calc.youBelow': { en: 'You are below this range', te: 'మీరు ఈ పరిధి కంటే తక్కువగా ఉన్నారు', hi: 'आप इस सीमा से नीचे हैं' },
  'lx.calc.youWithin': { en: 'You are within this range', te: 'మీరు ఈ పరిధిలోనే ఉన్నారు', hi: 'आप इस सीमा के अंदर हैं' },
  'lx.calc.youAbove': { en: 'You are above this range', te: 'మీరు ఈ పరిధి కంటే ఎక్కువగా ఉన్నారు', hi: 'आप इस सीमा से ऊपर हैं' },
  'lx.calc.belowHealthy': { en: 'Below healthy range', te: 'ఆరోగ్యకర పరిధి కంటే తక్కువ', hi: 'स्वस्थ सीमा से नीचे' },
  'lx.calc.healthy': { en: 'Healthy', te: 'ఆరోగ్యకరం', hi: 'स्वस्थ' },
  'lx.calc.increasedRisk': { en: 'Increased risk', te: 'ప్రమాదం పెరిగింది', hi: 'बढ़ा हुआ जोखिम' },
  'lx.calc.highRisk': { en: 'High risk', te: 'అధిక ప్రమాదం', hi: 'ज़्यादा जोखिम' },
  'lx.calc.maintainCurrent': { en: 'Maintain your current weight', te: 'మీ ప్రస్తుత బరువును నిలబెట్టుకోండి', hi: 'अपना मौजूदा वज़न बनाए रखें' },
  'lx.calc.noSafeCut': { en: 'No safe room to cut calories', te: 'కేలరీలు తగ్గించడానికి సురక్షితమైన అవకాశం లేదు', hi: 'कैलोरी घटाने की सुरक्षित गुंजाइश नहीं है' },
  'lx.calc.dueDate': { en: 'Estimated due date', te: 'అంచనా ప్రసవ తేదీ', hi: 'अनुमानित प्रसव तिथि' },
  'lx.calc.reachTarget': { en: 'Daily calories to reach {target} kg', te: '{target} kg చేరడానికి రోజువారీ కేలరీలు', hi: '{target} kg तक पहुँचने के लिए रोज़ की कैलोरी' },

  // ---- CalculatorModal: result notes ----
  'lx.calc.note.loseGain': {
    en: 'Lose weight: ~{lose} · Gain: ~{gain} kcal/day',
    te: 'బరువు తగ్గడానికి: ~{lose} · పెరగడానికి: ~{gain} కేలరీలు/రోజు',
    hi: 'वज़न घटाने के लिए: ~{lose} · बढ़ाने के लिए: ~{gain} कैलोरी/दिन',
  },
  'lx.calc.note.devine': {
    en: 'Ideal (Devine formula): ~{v} kg',
    te: 'ఆదర్శ బరువు (Devine సూత్రం): ~{v} kg',
    hi: 'आदर्श वज़न (Devine फ़ॉर्मूला): ~{v} kg',
  },
  'lx.calc.note.waistAim': {
    en: 'Aim to keep your waist under {v} cm — half your height.',
    te: 'మీ నడుమును {v} cm లోపు ఉంచుకోండి — అంటే మీ ఎత్తులో సగం.',
    hi: 'अपनी कमर {v} cm से कम रखने की कोशिश करें — यानी आपकी लंबाई का आधा।',
  },
  'lx.calc.note.atGoal': {
    en: 'You are already at your goal. Healthy range for your height: {range} kg.',
    te: 'మీరు ఇప్పటికే మీ లక్ష్యంలో ఉన్నారు. మీ ఎత్తుకు ఆరోగ్యకర పరిధి: {range} kg.',
    hi: 'आप पहले से अपने लक्ष्य पर हैं। आपकी लंबाई के लिए स्वस्थ सीमा: {range} kg।',
  },
  'lx.calc.note.atFloor': {
    en: 'Maintenance is already about {tdee} kcal/day, at the {floor} kcal/day floor. Add activity rather than eating less, and check with a doctor first.',
    te: 'బరువు నిలబెట్టే కేలరీలు ఇప్పటికే సుమారు {tdee} కేలరీలు/రోజు — ఇది {floor} కేలరీలు/రోజు కనీస పరిమితి వద్దే ఉంది. తక్కువ తినడం కంటే శారీరక శ్రమ పెంచండి, ముందుగా డాక్టర్‌ను సంప్రదించండి.',
    hi: 'वज़न बनाए रखने की कैलोरी पहले से लगभग {tdee} कैलोरी/दिन है, जो {floor} कैलोरी/दिन की न्यूनतम सीमा पर है। कम खाने के बजाय गतिविधि बढ़ाएँ, और पहले डॉक्टर से सलाह लें।',
  },
  'lx.calc.note.loseOne': {
    en: 'Lose {kg} kg at ~{rate} kg/week — about {weeks} week, around {when}.',
    te: '~{rate} kg/వారం చొప్పున {kg} kg తగ్గండి — సుమారు {weeks} వారం, దాదాపు {when} నాటికి.',
    hi: '~{rate} kg/हफ़्ता की दर से {kg} kg घटाएँ — लगभग {weeks} हफ़्ता, क़रीब {when} तक।',
  },
  'lx.calc.note.loseMany': {
    en: 'Lose {kg} kg at ~{rate} kg/week — about {weeks} weeks, around {when}.',
    te: '~{rate} kg/వారం చొప్పున {kg} kg తగ్గండి — సుమారు {weeks} వారాలు, దాదాపు {when} నాటికి.',
    hi: '~{rate} kg/हफ़्ता की दर से {kg} kg घटाएँ — लगभग {weeks} हफ़्ते, क़रीब {when} तक।',
  },
  'lx.calc.note.gainOne': {
    en: 'Gain {kg} kg at ~{rate} kg/week — about {weeks} week, around {when}.',
    te: '~{rate} kg/వారం చొప్పున {kg} kg పెరగండి — సుమారు {weeks} వారం, దాదాపు {when} నాటికి.',
    hi: '~{rate} kg/हफ़्ता की दर से {kg} kg बढ़ाएँ — लगभग {weeks} हफ़्ता, क़रीब {when} तक।',
  },
  'lx.calc.note.gainMany': {
    en: 'Gain {kg} kg at ~{rate} kg/week — about {weeks} weeks, around {when}.',
    te: '~{rate} kg/వారం చొప్పున {kg} kg పెరగండి — సుమారు {weeks} వారాలు, దాదాపు {when} నాటికి.',
    hi: '~{rate} kg/हफ़्ता की दर से {kg} kg बढ़ाएँ — लगभग {weeks} हफ़्ते, क़रीब {when} तक।',
  },
  'lx.calc.note.goalBelow': {
    en: 'Careful: that goal is below the healthy range for your height ({range} kg).',
    te: 'జాగ్రత్త: ఆ లక్ష్యం మీ ఎత్తుకు ఉన్న ఆరోగ్యకర పరిధి ({range} kg) కంటే తక్కువ.',
    hi: 'सावधान: यह लक्ष्य आपकी लंबाई के लिए स्वस्थ सीमा ({range} kg) से नीचे है।',
  },
  'lx.calc.note.goalAbove': {
    en: 'That goal is still above the healthy range ({range} kg).',
    te: 'ఆ లక్ష్యం ఇంకా ఆరోగ్యకర పరిధి ({range} kg) కంటే ఎక్కువే.',
    hi: 'यह लक्ष्य अब भी स्वस्थ सीमा ({range} kg) से ऊपर है।',
  },
  'lx.calc.note.heldFloor': {
    en: 'Held at a {floor} kcal/day floor — go slower rather than lower.',
    te: '{floor} కేలరీలు/రోజు కనీస పరిమితి వద్ద ఉంచాము — ఇంకా తగ్గించడం కంటే నెమ్మదిగా వెళ్ళండి.',
    hi: '{floor} कैलोरी/दिन की न्यूनतम सीमा पर रोका गया — और कम करने के बजाय धीरे चलें।',
  },
  'lx.calc.note.pregOne': { en: 'You are about {weeks} week along.', te: 'మీరు సుమారు {weeks} వారం గర్భంతో ఉన్నారు.', hi: 'आप लगभग {weeks} हफ़्ते की गर्भवती हैं।' },
  'lx.calc.note.pregMany': { en: 'You are about {weeks} weeks along.', te: 'మీరు సుమారు {weeks} వారాల గర్భంతో ఉన్నారు.', hi: 'आप लगभग {weeks} हफ़्ते की गर्भवती हैं।' },
  'lx.calc.note.badDate': {
    en: 'Check the date — it looks out of range.',
    te: 'తేదీని మళ్ళీ చూడండి — ఇది పరిధికి బయట ఉన్నట్లుంది.',
    hi: 'तारीख़ जाँच लें — यह सीमा से बाहर लगती है।',
  },

  // Demo people, places and hospitals on the landing page. Keyed by the
  // exact English shown, so a render site is just t('lx.demo.' + name).
  'lx.demo.Dr. Anaya Rao': { en: 'Dr. Ananya Rao', te: 'డా. అనన్య రావు', hi: 'डॉ. अनन्या राव' },
  'lx.demo.Dr. Ananya Rao': { en: 'Dr. Ananya Rao', te: 'డా. అనన్య రావు', hi: 'डॉ. अनन्या राव' },
  'lx.demo.Dr. Vikram Nair': { en: 'Dr. Vikram Nair', te: 'డా. విక్రమ్ నాయర్', hi: 'डॉ. विक्रम नायर' },
  'lx.demo.Dr. Meher Iqbal': { en: 'Dr. Meher Iqbal', te: 'డా. మెహర్ ఇక్బాల్', hi: 'डॉ. मेहर इक़बाल' },
  'lx.demo.Dr. Divya Verma': { en: 'Dr. Divya Verma', te: 'డా. దివ్య వర్మ', hi: 'डॉ. दिव्या वर्मा' },
  'lx.demo.Sneha Mehra': { en: 'Sneha Mehra', te: 'స్నేహ మెహ్రా', hi: 'स्नेहा मेहरा' },
  'lx.demo.Karthik Pillai': { en: 'Karthik Pillai', te: 'కార్తీక్ పిళ్లై', hi: 'कार्तिक पिल्लई' },
  'lx.demo.Rahul': { en: 'Rahul', te: 'రాహుల్', hi: 'राहुल' },
  'lx.demo.Kondapur': { en: 'Kondapur', te: 'కొండాపూర్', hi: 'कोंडापुर' },
  'lx.demo.Sunrise Hospital, Jubilee Hills': { en: 'Sunrise Hospital, Jubilee Hills', te: 'సన్‌రైజ్ ఆసుపత్రి, జూబ్లీ హిల్స్', hi: 'सनराइज़ अस्पताल, जुबली हिल्स' },
  'lx.demo.City Care Hospital, Kondapur': { en: 'City Care Hospital, Kondapur', te: 'సిటీ కేర్ ఆసుపత్రి, కొండాపూర్', hi: 'सिटी केयर अस्पताल, कोंडापुर' },
  'lx.demo.Lakeview Skin Hospital, Banjara Hills': { en: 'Lakeview Skin Hospital, Banjara Hills', te: 'లేక్‌వ్యూ స్కిన్ ఆసుపత్రి, బంజారా హిల్స్', hi: 'लेकव्यू स्किन अस्पताल, बंजारा हिल्स' },
  'lx.demo.MD, DM': { en: 'MD, DM', te: 'ఎండీ, డీఎం', hi: 'एमडी, डीएम' },
  'lx.demo.MS': { en: 'MS', te: 'ఎంఎస్', hi: 'एमएस' },
  'lx.demo.MD': { en: 'MD', te: 'ఎండీ', hi: 'एमडी' },
}
