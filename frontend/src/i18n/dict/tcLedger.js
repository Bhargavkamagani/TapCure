/**
 * The "sixty-second check" health calculator on the landing page
 * (`components/landing/TcLedger.jsx`) — BMI, body fat, ideal weight, daily
 * calories, time-cost and due date.
 *
 * UNLIKE the rest of the landing page, this is health guidance rather than
 * marketing copy. Two rules when editing:
 *
 *  1. Numbers and thresholds are NEVER translated or localised — 22.9, 0.5,
 *     280 days, the Indian/Asian BMI ceiling. They come from the code and are
 *     interpolated at render.
 *  2. Keep the hedging. Where the English says "worth mentioning at your next
 *     visit" rather than "you are ill", the Telugu and Hindi must hedge the same
 *     way. Do not make a claim firmer in one language than another.
 *
 * Flagged for native-speaker review before public launch: the band words
 * (Under / Healthy / Raised / High) and the waist and body-fat advice are the
 * lines a patient could act on.
 */
export const tcLedgerT = {
  /* section shell */
  'tc.lg.eyebrow': { en: 'Sixty-second check', te: 'అరవై సెకన్ల పరీక్ష', hi: 'साठ सेकंड की जाँच' },
  'tc.lg.h2a': { en: 'Free health check,', te: 'ఉచిత ఆరోగ్య పరీక్ష,', hi: 'मुफ़्त हेल्थ चेक,' },
  'tc.lg.h2b': { en: 'in 60 seconds.', te: '60 సెకన్లలో.', hi: '60 सेकंड में।' },
  'tc.lg.heroTitle': { en: 'Sixty seconds', te: 'అరవై సెకన్లు', hi: 'साठ सेकंड' },
  'tc.lg.heroSub': { en: '% body fat · example result', te: '% శరీర కొవ్వు · ఉదాహరణ ఫలితం', hi: '% शरीर की चर्बी · उदाहरण नतीजा' },
  'tc.lg.privacy': {
    en: 'Nothing you type here is saved or sent anywhere.',
    te: 'మీరు ఇక్కడ టైప్ చేసేది ఎక్కడా భద్రపరచబడదు, పంపబడదు.',
    hi: 'यहाँ आप जो लिखते हैं वह कहीं सहेजा या भेजा नहीं जाता।',
  },
  'tc.lg.privacyMore': {
    en: 'It is all worked out on your own phone or computer. We use the healthy ranges set',
    te: 'అంతా మీ ఫోన్ లేదా కంప్యూటర్‌లోనే లెక్కించబడుతుంది. మేము వాడే ఆరోగ్యకర పరిధులు',
    hi: 'सब कुछ आपके अपने फ़ोन या कंप्यूटर पर ही निकाला जाता है। हम जो स्वस्थ सीमाएँ इस्तेमाल करते हैं वे',
  },
  'tc.lg.forIndian': {
    en: 'for Indian and Asian adults, lower than the European figure of 24.9',
    te: 'భారతీయ, ఆసియా వయోజనుల కోసం నిర్ణయించినవి — యూరోపియన్ 24.9 కంటే తక్కువ',
    hi: 'भारतीय और एशियाई वयस्कों के लिए तय की गई हैं, जो यूरोपीय 24.9 से कम हैं',
  },

  /* the flow */
  'tc.lg.fourQs': { en: 'Four quick questions.', te: 'నాలుగు చిన్న ప్రశ్నలు.', hi: 'चार छोटे सवाल।' },
  'tc.lg.thenGuess': { en: 'Then have a guess.', te: 'తర్వాత ఒక అంచనా వేయండి.', hi: 'फिर एक अंदाज़ा लगाइए।' },
  'tc.lg.beforeShow': { en: 'Before we show you.', te: 'మేము చూపించే ముందు.', hi: 'हमारे बताने से पहले।' },
  'tc.lg.nowFun': { en: 'Now the fun part.', te: 'ఇప్పుడు ఆసక్తికరమైన భాగం.', hi: 'अब मज़ेदार हिस्सा।' },
  'tc.lg.hereIsNumber': { en: 'Here is your number.', te: 'ఇదిగో మీ సంఖ్య.', hi: 'यह रहा आपका नंबर।' },
  'tc.lg.youAre': { en: 'You are', te: 'మీరు', hi: 'आप' },
  'tc.lg.howMuchMove': { en: 'How much do you move?', te: 'మీరు ఎంత కదులుతారు?', hi: 'आप कितना चलते-फिरते हैं?' },
  'tc.lg.lmp': { en: 'First day of your last period', te: 'మీ చివరి రుతుక్రమం మొదటి రోజు', hi: 'आपके पिछले मासिक धर्म का पहला दिन' },
  'tc.lg.askFat': { en: 'What do you think your body fat is?', te: 'మీ శరీర కొవ్వు ఎంత ఉంటుందని అనుకుంటున్నారు?', hi: 'आपको क्या लगता है आपकी शरीर वसा कितनी है?' },
  'tc.lg.mostFurther': {
    en: 'Most people are further off than they think.',
    te: 'చాలామంది అనుకున్నదానికంటే ఎక్కువ తేడాతో ఉంటారు.',
    hi: 'ज़्यादातर लोग जितना सोचते हैं, उससे ज़्यादा दूर होते हैं।',
  },
  'tc.lg.showReal': { en: 'Show me the real number', te: 'నిజమైన సంఖ్యను చూపించండి', hi: 'असली नंबर दिखाइए' },
  'tc.lg.noPeeking': {
    en: 'No peeking — a guess makes the answer stick.',
    te: 'ముందే చూడొద్దు — అంచనా వేస్తే సమాధానం బాగా గుర్తుంటుంది.',
    hi: 'पहले मत देखिए — अंदाज़ा लगाने से जवाब याद रह जाता है।',
  },
  'tc.lg.yourGuess': { en: 'your guess', te: 'మీ అంచనా', hi: 'आपका अंदाज़ा' },
  'tc.lg.youGuessed': { en: 'You guessed', te: 'మీరు అంచనా వేసింది', hi: 'आपने अंदाज़ा लगाया' },
  'tc.lg.veryClose': { en: '. Very close.', te: '. చాలా దగ్గరగా ఉంది.', hi: '। बहुत क़रीब।' },
  'tc.lg.bullseye': { en: 'Bullseye', te: 'కచ్చితంగా సరి', hi: 'बिल्कुल सही' },
  'tc.lg.calledIt': { en: '. You called it.', te: '. మీరు సరిగ్గా చెప్పారు.', hi: '। आपने सही पहचाना।' },
  'tc.lg.thatIs': { en: 'That is', te: 'అంటే', hi: 'यानी' },
  'tc.lg.youAreOff': { en: '— you are', te: '— మీరు అనుకున్నదానికంటే', hi: '— आप जितना सोचते थे उससे' },
  'tc.lg.thanThought': { en: 'than you thought.', te: 'తేడాగా ఉన్నారు.', hi: 'अलग हैं।' },
  'tc.lg.tryAnother': { en: 'Try another one', te: 'మరొకటి ప్రయత్నించండి', hi: 'एक और आज़माएँ' },
  'tc.lg.checkElse': {
    en: 'Want to check something else? Tap one — it only asks what it needs.',
    te: 'ఇంకేదైనా చూడాలా? ఒకదాన్ని ట్యాప్ చేయండి — అవసరమైనది మాత్రమే అడుగుతుంది.',
    hi: 'कुछ और जाँचना है? किसी एक पर टैप कीजिए — वह सिर्फ़ ज़रूरी बात पूछता है।',
  },

  /* activity levels */
  'tc.lg.act.sed': { en: 'Barely', te: 'చాలా తక్కువ', hi: 'बहुत कम' },
  'tc.lg.act.sedWhy': { en: 'Sitting most of the day', te: 'రోజంతా ఎక్కువగా కూర్చొని', hi: 'दिनभर ज़्यादातर बैठे रहना' },
  'tc.lg.act.light': { en: 'A little', te: 'కొంచెం', hi: 'थोड़ा' },
  'tc.lg.act.lightWhy': { en: 'Walking now and then', te: 'అప్పుడప్పుడు నడక', hi: 'कभी-कभी टहलना' },
  'tc.lg.act.mod': { en: 'Often', te: 'తరచుగా', hi: 'अक्सर' },
  'tc.lg.act.modWhy': { en: 'Moving three or four days a week', te: 'వారానికి మూడు నాలుగు రోజులు కదలిక', hi: 'हफ़्ते में तीन-चार दिन सक्रिय' },
  'tc.lg.act.high': { en: 'Daily', te: 'ప్రతిరోజూ', hi: 'रोज़' },

  /* band words — shared by the BMI, waist and body-fat rulers */
  'tc.lg.band.under': { en: 'Under', te: 'తక్కువ', hi: 'कम' },
  'tc.lg.band.low': { en: 'Low', te: 'తక్కువ', hi: 'कम' },
  'tc.lg.band.ok': { en: 'Healthy', te: 'ఆరోగ్యకరం', hi: 'स्वस्थ' },
  'tc.lg.band.warn': { en: 'Raised', te: 'కొంచెం ఎక్కువ', hi: 'थोड़ा ज़्यादा' },
  'tc.lg.band.high': { en: 'High', te: 'ఎక్కువ', hi: 'ज़्यादा' },

  /* result chips + labels */
  'tc.lg.chip.bmi': { en: 'Your BMI', te: 'మీ BMI', hi: 'आपका BMI' },
  'tc.lg.chip.cal': { en: 'Your calories', te: 'మీ కేలరీలు', hi: 'आपकी कैलोरी' },
  'tc.lg.chip.ideal': { en: 'Your ideal weight', te: 'మీ ఆదర్శ బరువు', hi: 'आपका आदर्श वज़न' },
  'tc.lg.chip.mins': { en: 'Time you can win back', te: 'మీరు తిరిగి పొందగల సమయం', hi: 'जो समय आप वापस पा सकते हैं' },
  'tc.lg.chip.whtr': { en: 'Your waist vs height', te: 'మీ నడుము vs ఎత్తు', hi: 'आपकी कमर बनाम लंबाई' },
  'tc.lg.chip.goal': { en: 'Reaching a weight', te: 'లక్ష్య బరువు చేరడం', hi: 'लक्ष्य वज़न तक पहुँचना' },
  'tc.lg.chip.due': { en: 'A due date', te: 'ప్రసవ తేదీ', hi: 'प्रसव की तारीख़' },
  'tc.lg.q.bmi': { en: 'What is your BMI?', te: 'మీ BMI ఎంత?', hi: 'आपका BMI कितना है?' },
  'tc.lg.q.cal': { en: 'How much can you eat in a day?', te: 'రోజుకు మీరు ఎంత తినవచ్చు?', hi: 'आप दिन में कितना खा सकते हैं?' },
  'tc.lg.q.ideal': { en: 'What should you weigh?', te: 'మీ బరువు ఎంత ఉండాలి?', hi: 'आपका वज़न कितना होना चाहिए?' },
  'tc.lg.q.mins': { en: 'How much time is this costing you?', te: 'ఇది మీకు ఎంత సమయం ఖర్చు చేస్తోంది?', hi: 'इससे आपका कितना समय जा रहा है?' },
  'tc.lg.q.whtr': { en: 'How does your waist compare to your height?', te: 'మీ నడుము మీ ఎత్తుతో పోలిస్తే ఎలా ఉంది?', hi: 'आपकी कमर आपकी लंबाई के मुक़ाबले कैसी है?' },
  'tc.lg.q.goal': { en: 'What would it take to reach your goal?', te: 'మీ లక్ష్య బరువుకు చేరాలంటే ఏం కావాలి?', hi: 'अपने लक्ष्य वज़न तक पहुँचने के लिए क्या करना होगा?' },
  'tc.lg.q.due': { en: 'When is the baby due?', te: 'బిడ్డ ఎప్పుడు పుడుతుంది?', hi: 'बच्चा कब होने वाला है?' },
  'tc.lg.ask.bmi': { en: 'What do you think your BMI is?', te: 'మీ BMI ఎంత ఉంటుందని అనుకుంటున్నారు?', hi: 'आपको क्या लगता है आपका BMI कितना है?' },
  'tc.lg.ask.cal': { en: 'How many calories do you think you can eat a day?', te: 'రోజుకు ఎన్ని కేలరీలు తినవచ్చని అనుకుంటున్నారు?', hi: 'आपको क्या लगता है दिन में कितनी कैलोरी खा सकते हैं?' },
  'tc.lg.ask.ideal': { en: 'What do you think you should weigh?', te: 'మీ బరువు ఎంత ఉండాలని అనుకుంటున్నారు?', hi: 'आपको क्या लगता है आपका वज़न कितना होना चाहिए?' },
  'tc.lg.ask.mins': { en: 'How many minutes a day do you think you are losing?', te: 'రోజుకు ఎన్ని నిమిషాలు కోల్పోతున్నారని అనుకుంటున్నారు?', hi: 'आपको क्या लगता है दिन में कितने मिनट गँवा रहे हैं?' },
  'tc.lg.ask.whtr': { en: 'What fraction of your height do you think your waist is?', te: 'మీ నడుము మీ ఎత్తులో ఎంత భాగం ఉంటుందని అనుకుంటున్నారు?', hi: 'आपको क्या लगता है आपकी कमर आपकी लंबाई का कितना हिस्सा है?' },

  /* the doctor nudge — shown on any tool whose answer falls outside the healthy band */
  'tc.lg.bookGp': { en: 'Book a General Physician', te: 'జనరల్ ఫిజీషియన్‌ను బుక్ చేయండి', hi: 'जनरल फ़िज़िशियन बुक करें' },
  'tc.lg.nudge.bmiHigh': {
    en: 'Your BMI is above the healthy range for Indian adults. That is worth a doctor visit — not a diet plan off the internet. A simple blood test will show what is actually going on.',
    te: 'మీ BMI భారతీయ పెద్దలకు ఉండాల్సిన ఆరోగ్యకర పరిధి కంటే ఎక్కువ. ఇది వైద్యుడిని కలవాల్సిన విషయం — ఇంటర్నెట్‌లో దొరికే డైట్ ప్లాన్ కాదు. ఒక సాధారణ రక్త పరీక్షతో అసలు సంగతి తెలుస్తుంది.',
    hi: 'आपका BMI भारतीय वयस्कों के स्वस्थ दायरे से ऊपर है। यह डॉक्टर से मिलने की बात है — इंटरनेट से लिया डाइट प्लान नहीं। एक साधारण ख़ून की जाँच बता देगी कि असल में क्या हो रहा है।',
  },
  'tc.lg.nudge.bmiLow': {
    en: 'Your BMI is below the healthy range. A doctor will want to find out why, rather than simply tell you to eat more.',
    te: 'మీ BMI ఆరోగ్యకర పరిధి కంటే తక్కువ. ఎక్కువ తినమని చెప్పడం కాదు, ఎందుకు తక్కువగా ఉందో వైద్యుడు కనుగొనాలనుకుంటారు.',
    hi: 'आपका BMI स्वस्थ दायरे से कम है। डॉक्टर सिर्फ़ ज़्यादा खाने को नहीं कहेंगे, बल्कि वजह पता करना चाहेंगे।',
  },
  'tc.lg.nudge.whtrHigh': {
    en: 'Your waist is more than half your height. That is the strongest warning sign on this page — it usually means fat sitting around the organs. A doctor will start with a simple blood test for sugar and cholesterol.',
    te: 'మీ నడుము మీ ఎత్తులో సగం కంటే ఎక్కువ. ఈ పేజీలో ఇదే అతి పెద్ద హెచ్చరిక — సాధారణంగా అవయవాల చుట్టూ కొవ్వు పేరుకుందని అర్థం. వైద్యుడు ముందుగా షుగర్, కొలెస్ట్రాల్ కోసం సాధారణ రక్త పరీక్ష చేయిస్తారు.',
    hi: 'आपकी कमर आपकी लंबाई के आधे से ज़्यादा है। यह इस पेज की सबसे बड़ी चेतावनी है — आमतौर पर इसका मतलब अंगों के आसपास जमा चर्बी है। डॉक्टर शुरुआत शुगर और कोलेस्ट्रॉल की साधारण जाँच से करेंगे।',
  },
  'tc.lg.nudge.whtrLow': {
    en: 'Your waist is unusually small for your height. Worth mentioning to a doctor, especially if you have been losing weight without trying.',
    te: 'మీ ఎత్తుకు మీ నడుము అసాధారణంగా తక్కువ. ప్రయత్నించకుండానే బరువు తగ్గుతుంటే మరీ ముఖ్యంగా, ఇది వైద్యుడికి చెప్పదగ్గ విషయం.',
    hi: 'आपकी लंबाई के हिसाब से कमर असामान्य रूप से कम है। डॉक्टर को बताना ठीक रहेगा, ख़ासकर अगर बिना कोशिश के वज़न घट रहा हो।',
  },
  'tc.lg.nudge.idealOver': {
    en: 'You are above your healthy range. A doctor can tell you how much of it is worth acting on, and how.',
    te: 'మీరు మీ ఆరోగ్యకర పరిధి కంటే ఎక్కువ బరువులో ఉన్నారు. దీనిలో ఎంత మేరకు చర్య తీసుకోవాలో, ఎలా తీసుకోవాలో వైద్యుడు చెప్పగలరు.',
    hi: 'आप अपने स्वस्थ दायरे से ऊपर हैं। इसमें कितने पर और कैसे काम करना चाहिए, यह डॉक्टर बता सकते हैं।',
  },
  'tc.lg.nudge.idealUnder': {
    en: 'You are below your healthy range. A doctor will want to find out why before anyone talks about gaining weight.',
    te: 'మీరు మీ ఆరోగ్యకర పరిధి కంటే తక్కువ బరువులో ఉన్నారు. బరువు పెరగడం గురించి మాట్లాడే ముందు కారణం ఏమిటో వైద్యుడు తెలుసుకోవాలనుకుంటారు.',
    hi: 'आप अपने स्वस्थ दायरे से नीचे हैं। वज़न बढ़ाने की बात से पहले डॉक्टर वजह जानना चाहेंगे।',
  },
  'tc.lg.nudge.mins': {
    en: 'That is a lot of time to be losing every day. Most of the reasons listed above are treatable — a doctor can tell you which ones.',
    te: 'రోజూ కోల్పోతున్న సమయం ఇది చాలా ఎక్కువ. పైన ఉన్న కారణాల్లో చాలావాటికి చికిత్స ఉంది — ఏవో వైద్యుడు చెప్పగలరు.',
    hi: 'हर दिन इतना समय गँवाना काफ़ी ज़्यादा है। ऊपर दिए ज़्यादातर कारणों का इलाज हो सकता है — कौन-से, यह डॉक्टर बता सकते हैं।',
  },
  'tc.lg.nudge.goal': {
    en: 'This goal needs a doctor or dietitian, not a calculator. Please talk to one before cutting your food any further.',
    te: 'ఈ లక్ష్యానికి కాలిక్యులేటర్ కాదు, వైద్యుడు లేదా డైటీషియన్ అవసరం. ఆహారాన్ని ఇంకా తగ్గించే ముందు దయచేసి వారిని సంప్రదించండి.',
    hi: 'इस लक्ष्य के लिए कैलकुलेटर नहीं, डॉक्टर या आहार विशेषज्ञ चाहिए। खाना और कम करने से पहले उनसे बात करें।',
  },
  'tc.lg.nudge.due': {
    en: 'Whatever the date says, regular antenatal check-ups matter more than the number. Book one if you have not already.',
    te: 'తేదీ ఏది చెప్పినా, ఆ సంఖ్య కంటే క్రమం తప్పని గర్భధారణ పరీక్షలే ముఖ్యం. ఇంకా బుక్ చేయకపోతే ఇప్పుడే చేయండి.',
    hi: 'तारीख़ चाहे जो कहे, संख्या से ज़्यादा ज़रूरी हैं नियमित प्रसवपूर्व जाँचें। अगर अभी तक नहीं करवाई, तो बुक कर लें।',
  },

  /* waist ÷ height + weight goal */
  'tc.lg.targetWeight': { en: 'The weight you want to reach', te: 'మీరు చేరాలనుకుంటున్న బరువు', hi: 'वह वज़न जो आप पाना चाहते हैं' },
  'tc.lg.whtrScale': { en: 'Waist ÷ height', te: 'నడుము ÷ ఎత్తు', hi: 'कमर ÷ लंबाई' },
  'tc.lg.goalAt': { en: 'a day', te: 'రోజుకు', hi: 'रोज़' },
  'tc.lg.goalSame': {
    en: 'That is the weight you are already at. Eat around {kcal} kcal a day to stay here.',
    te: 'మీరు ఇప్పటికే ఆ బరువులోనే ఉన్నారు. ఇక్కడే ఉండాలంటే రోజుకు సుమారు {kcal} కేలరీలు తీసుకోండి.',
    hi: 'आप पहले से ही उसी वज़न पर हैं। यहीं बने रहने के लिए रोज़ लगभग {kcal} कैलोरी लें।',
  },
  'tc.lg.goalFloor': {
    en: 'There is no safe room to cut your calories further. Losing weight from here should be done with a doctor or dietitian, not by eating less on your own.',
    te: 'కేలరీలను ఇంకా తగ్గించడానికి సురక్షితమైన అవకాశం లేదు. ఇక్కడ నుంచి బరువు తగ్గడం వైద్యుడు లేదా డైటీషియన్ సలహాతో చేయాలి, సొంతంగా తక్కువ తినడం ద్వారా కాదు.',
    hi: 'कैलोरी और घटाने की सुरक्षित गुंजाइश नहीं है। यहाँ से वज़न घटाना डॉक्टर या आहार विशेषज्ञ की देख-रेख में करें, ख़ुद कम खाकर नहीं।',
  },
  'tc.lg.goalLose': {
    en: 'Eat about {kcal} kcal a day and you would reach {target} kg around {when} — roughly half a kilo a week, which is the pace that stays off.',
    te: 'రోజుకు సుమారు {kcal} కేలరీలు తీసుకుంటే {when} నాటికి {target} కిలోలకు చేరతారు — వారానికి సుమారు అర కిలో, అదే నిలిచే వేగం.',
    hi: 'रोज़ लगभग {kcal} कैलोरी लें तो आप {when} तक {target} किलो पर पहुँचेंगे — हफ़्ते में क़रीब आधा किलो, यही रफ़्तार टिकती है।',
  },
  'tc.lg.goalGain': {
    en: 'Eat about {kcal} kcal a day and you would reach {target} kg around {when} — roughly half a kilo a week.',
    te: 'రోజుకు సుమారు {kcal} కేలరీలు తీసుకుంటే {when} నాటికి {target} కిలోలకు చేరతారు — వారానికి సుమారు అర కిలో.',
    hi: 'रोज़ लगभग {kcal} कैलोरी लें तो आप {when} तक {target} किलो पर पहुँचेंगे — हफ़्ते में क़रीब आधा किलो।',
  },
  'tc.lg.goalUnder': {
    en: 'That target is below the healthy range for your height ({lo}–{hi} kg). Please pick a goal inside it, or talk to a doctor first.',
    te: 'ఆ లక్ష్యం మీ ఎత్తుకు ఉండాల్సిన ఆరోగ్యకర పరిధి ({lo}–{hi} కిలోలు) కంటే తక్కువ. దయచేసి ఆ పరిధిలోని లక్ష్యాన్ని ఎంచుకోండి, లేదా ముందుగా వైద్యుడిని సంప్రదించండి.',
    hi: 'यह लक्ष्य आपकी लंबाई के स्वस्थ दायरे ({lo}–{hi} किलो) से कम है। कृपया उसी दायरे में लक्ष्य चुनें, या पहले डॉक्टर से बात करें।',
  },
  'tc.lg.whtrNote': {
    en: 'Keep your waist under half your height. This one number predicts sugar and heart trouble better than BMI does, because it knows where the weight sits.',
    te: 'మీ నడుము మీ ఎత్తులో సగం కంటే తక్కువ ఉంచండి. బరువు ఎక్కడ పేరుకుందో ఈ సంఖ్యకు తెలుసు కాబట్టి, షుగర్ మరియు గుండె సమస్యలను BMI కంటే బాగా సూచిస్తుంది.',
    hi: 'अपनी कमर को लंबाई के आधे से कम रखें। यह एक आँकड़ा शुगर और दिल की परेशानी का अंदाज़ा BMI से बेहतर देता है, क्योंकि यह जानता है कि वज़न कहाँ जमा है।',
  },

  /* readouts */
  'tc.lg.yourBmi': { en: 'Your BMI', te: 'మీ BMI', hi: 'आपका BMI' },
  'tc.lg.bodyFat': { en: 'Body Fat', te: 'శరీర కొవ్వు', hi: 'शरीर वसा' },
  'tc.lg.idealWeight': { en: 'Ideal Weight', te: 'ఆదర్శ బరువు', hi: 'आदर्श वज़न' },
  'tc.lg.weight': { en: 'Weight', te: 'బరువు', hi: 'वज़न' },
  'tc.lg.dailyCalories': { en: 'Daily Calories', te: 'రోజువారీ కేలరీలు', hi: 'दैनिक कैलोरी' },
  'tc.lg.whatYouTold': { en: 'What you told us', te: 'మీరు చెప్పినవి', hi: 'आपने जो बताया' },
  'tc.lg.toStay': { en: 'To stay where you are', te: 'ఇప్పుడున్న బరువు నిలుపుకోవడానికి', hi: 'मौजूदा वज़न बनाए रखने के लिए' },
  'tc.lg.minsADay': { en: 'min a day', te: 'నిమిషాలు రోజుకు', hi: 'मिनट रोज़' },
  'tc.lg.live': { en: 'Live', te: 'ప్రత్యక్షం', hi: 'लाइव' },
  'tc.lg.takingTime': { en: 'What is taking your time', te: 'మీ సమయాన్ని తీసుకుంటున్నవి', hi: 'आपका समय क्या ले रहा है' },
  'tc.lg.winBack': { en: 'You could win back', te: 'మీరు తిరిగి పొందగలిగేది', hi: 'आप वापस पा सकते हैं' },
  'tc.lg.nothingToAdd': {
    en: 'Nothing to add up here. Your activity, sleep, BMI and waist are all in the healthy range.',
    te: 'ఇక్కడ కలపడానికి ఏమీ లేదు. మీ కదలిక, నిద్ర, BMI, నడుము కొలత అన్నీ ఆరోగ్యకర పరిధిలో ఉన్నాయి.',
    hi: 'यहाँ जोड़ने को कुछ नहीं। आपकी सक्रियता, नींद, BMI और कमर — सब स्वस्थ सीमा में हैं।',
  },
  'tc.lg.dueNote': {
    en: 'That is 280 days from the date you gave. Most babies arrive within two weeks either side of it.',
    te: 'మీరు ఇచ్చిన తేదీ నుండి 280 రోజులు. చాలా బిడ్డలు దానికి రెండు వారాల ముందూ వెనుకా పుడతారు.',
    hi: 'यह आपकी दी हुई तारीख़ से 280 दिन है। ज़्यादातर बच्चे इसके दो हफ़्ते आगे-पीछे जन्म लेते हैं।',
  },
  'tc.lg.duePick': { en: 'Pick the date and we will work it out.', te: 'తేదీ ఎంచుకోండి, మేము లెక్కిస్తాం.', hi: 'तारीख़ चुनिए, हम हिसाब लगा देंगे।' },
  'tc.lg.rightWhere': {
    en: ', which is right where it should be.',
    te: ', ఇది ఉండాల్సిన చోటే ఉంది.',
    hi: ', जो बिल्कुल वहीं है जहाँ होना चाहिए।',
  },
  'tc.lg.restFromMoving': {
    en: '— the rest comes from moving around. Eat less than this and you lose weight.',
    te: '— మిగతాది కదలిక ద్వారా ఖర్చవుతుంది. దీనికంటే తక్కువ తింటే బరువు తగ్గుతారు.',
    hi: '— बाक़ी चलने-फिरने से खर्च होता है। इससे कम खाएँगे तो वज़न घटेगा।',
  },
  'tc.lg.waistAdvice': {
    en: 'Your waist is the number to watch. It tells a doctor more than BMI does. Worth mentioning at your next visit.',
    te: 'మీ నడుము కొలతే గమనించాల్సిన సంఖ్య. BMI కంటే ఇది వైద్యుడికి ఎక్కువ చెబుతుంది. మీ తదుపరి సందర్శనలో దీని గురించి చెప్పడం మంచిది.',
    hi: 'आपकी कमर का माप ही देखने वाला नंबर है। यह डॉक्टर को BMI से ज़्यादा बताता है। अगली विज़िट में इसका ज़िक्र करना ठीक रहेगा।',
  },
  'tc.lg.higher': { en: 'higher', te: 'ఎక్కువ', hi: 'ज़्यादा' },
  'tc.lg.lower': { en: 'lower', te: 'తక్కువ', hi: 'कम' },
  'tc.lg.almostNobody': {
    en: 'Almost nobody gets this close. You know your body well.',
    te: 'ఇంత దగ్గరగా చెప్పేవాళ్లు చాలా అరుదు. మీ శరీరం మీకు బాగా తెలుసు.',
    hi: 'इतना क़रीब बहुत कम लोग पहुँचते हैं। आप अपने शरीर को अच्छी तरह जानते हैं।',
  },
  'tc.lg.thatIsFor': { en: 'for a', te: 'వయసు', hi: 'की उम्र के लिए' },
  'tc.lg.yearOld': { en: 'year-old', te: 'ఏళ్ల', hi: 'साल' },
  'tc.lg.whereThatSits': { en: 'Where that sits', te: 'అది ఎక్కడ ఉంది', hi: 'यह कहाँ बैठता है' },

  /* The diet offer. The basis line quotes the reading it came from, so the
     plan reads as this person's rather than as general advice. */
  'tc.lg.diet.title': { en: 'Your diet plan', te: 'మీ ఆహార ప్రణాళిక', hi: 'आपकी खानपान योजना' },
  'tc.lg.diet.basisFat': {
    en: 'Based on your body fat of {v}%',
    te: 'మీ శరీర కొవ్వు {v}% ఆధారంగా',
    hi: 'आपके {v}% शरीर वसा के आधार पर',
  },
  'tc.lg.diet.basisBmi': {
    en: 'Based on your BMI of {v}',
    te: 'మీ BMI {v} ఆధారంగా',
    hi: 'आपके {v} BMI के आधार पर',
  },
  'tc.lg.diet.basisCal': {
    en: 'Based on your {v} kcal a day',
    te: 'రోజుకు మీ {v} కేలరీల ఆధారంగా',
    hi: 'आपकी रोज़ की {v} कैलोरी के आधार पर',
  },
  'tc.lg.diet.basisIdeal': {
    en: 'Based on your healthy range of {lo}–{hi} kg',
    te: 'మీ ఆరోగ్యకర పరిధి {lo}–{hi} కిలోల ఆధారంగా',
    hi: 'आपके स्वस्थ दायरे {lo}–{hi} किलो के आधार पर',
  },
  'tc.lg.diet.basisWhtr': {
    en: 'Based on your waist ratio of {v}',
    te: 'మీ నడుము నిష్పత్తి {v} ఆధారంగా',
    hi: 'आपके {v} कमर अनुपात के आधार पर',
  },
  'tc.lg.diet.basisGoal': {
    en: 'Based on your goal of {v} kg',
    te: 'మీ లక్ష్యం {v} కిలోల ఆధారంగా',
    hi: 'आपके {v} किलो के लक्ष्य के आधार पर',
  },
  'tc.lg.estimateNote': {
    en: 'Worked out from your height, weight, age and sex — no measuring tape needed, so treat it as a close estimate rather than an exact number.',
    te: 'మీ ఎత్తు, బరువు, వయసు, లింగం ఆధారంగా లెక్కించబడింది — టేప్ అవసరం లేదు, కాబట్టి దీన్ని కచ్చితమైన సంఖ్యగా కాక దగ్గరి అంచనాగా తీసుకోండి.',
    hi: 'आपकी लंबाई, वज़न, उम्र और लिंग से निकाला गया है — टेप की ज़रूरत नहीं, इसलिए इसे सटीक आँकड़ा नहीं, एक क़रीबी अनुमान मानिए।',
  },
  'tc.lg.range': { en: 'range', te: 'పరిధి', hi: 'सीमा' },
  'tc.lg.teaserLede': {
    en: 'Answer four quick questions to see your BMI, a body-fat estimate, your daily calories and a healthy weight for you.',
    te: 'నాలుగు చిన్న ప్రశ్నలకు జవాబు ఇవ్వండి: మీ BMI, శరీర కొవ్వు అంచనా, రోజువారీ కేలరీలు, మీకు సరైన బరువు తెలుస్తాయి.',
    hi: 'चार छोटे सवालों के जवाब दें और अपना BMI, शरीर की चर्बी का अनुमान, रोज़ की कैलोरी और आपके लिए सही वज़न देखें।',
  },
  'tc.lg.takeCheck': { en: 'Take the 60-second check', te: '60 సెకన్ల పరీక్ష చేయండి', hi: '60 सेकंड की जाँच करें' },
  'tc.lg.trust1.t': { en: 'Free', te: 'ఉచితం', hi: 'मुफ़्त' },
  'tc.lg.trust1.d': { en: 'No sign-up.', te: 'సైన్ అప్ అవసరం లేదు.', hi: 'साइन-अप की ज़रूरत नहीं।' },
  'tc.lg.trust2.t': { en: '60 Seconds', te: '60 సెకన్లు', hi: '60 सेकंड' },
  'tc.lg.trust2.d': { en: '4 simple questions.', te: '4 సులభమైన ప్రశ్నలు.', hi: '4 आसान सवाल।' },
  'tc.lg.trust3.t': { en: 'Food Tips', te: 'ఆహార సూచనలు', hi: 'खाने की सलाह' },
  'tc.lg.trust3.d': { en: 'Check with your doctor first.', te: 'ముందుగా మీ డాక్టర్‌ను అడగండి.', hi: 'पहले अपने डॉक्टर से पूछें।' },
  'tc.lg.trust4.t': { en: 'Private', te: 'గోప్యం', hi: 'निजी' },
  'tc.lg.trust4.d': { en: 'Nothing is saved.', te: 'ఏదీ సేవ్ చేయబడదు.', hi: 'कुछ भी सेव नहीं होता।' },
}
