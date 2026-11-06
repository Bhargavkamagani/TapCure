/**
 * Landing-page FAQ — 32 questions across patients / hospitals / doctors.
 *
 * Split out of tcLanding.js purely for size: this is the longest single block
 * of copy on the site.
 *
 * The English answers were written against the code (the family cap is the `>= 5` guard in routers/patients.py,
 * the travel buffers are ARRIVAL_BUFFER_MIN/REMIND_BEFORE_MIN). The Telugu and
 * Hindi say the same thing — where a claim is deliberately cautious in English
 * ("Not yet", "reviewed and approved"), the translation keeps it cautious. Do
 * not "improve" a claim in one language only.
 *
 * Keys: p = patients, c = hospitals, d = doctors; `.q` question, `.a` answer.
 */
export const tcFaqT = {
  /* ── patients ── */
  'tc.faq.p1.q': { en: 'What is TapCure?', te: 'TapCure అంటే ఏమిటి?', hi: 'TapCure क्या है?' },
  'tc.faq.p1.a': {
    en: 'TapCure is an online doctor appointment and digital OP queue platform for patients, doctors and hospitals. You book a token from your phone, watch the queue move in real time, and get told when to leave home.',
    te: 'TapCure అనేది రోగులు, డాక్టర్లు, ఆసుపత్రుల కోసం ఆన్‌లైన్ డాక్టర్ అపాయింట్‌మెంట్ మరియు డిజిటల్ OP క్యూ వేదిక. మీ ఫోన్ నుండి టోకెన్ బుక్ చేసి, క్యూ ప్రత్యక్షంగా కదలడాన్ని చూసి, ఇంటి నుండి ఎప్పుడు బయలుదేరాలో తెలుసుకోండి.',
    hi: 'TapCure मरीज़ों, अस्पतालों और अस्पतालों के लिए ऑनलाइन डॉक्टर अपॉइंटमेंट और डिजिटल OP क्यू प्लेटफ़ॉर्म है। अपने फ़ोन से टोकन बुक करें, क्यू को लाइव बढ़ते देखें, और जानें कि घर से कब निकलना है।',
  },
  'tc.faq.p2.q': { en: 'Is TapCure a hospital?', te: 'TapCure ఒక ఆసుపత్రి లేదా క్లినికా?', hi: 'क्या TapCure अस्पताल है?' },
  'tc.faq.p2.a': {
    en: 'No. TapCure is the software hospitals and doctors use to run their appointments and their OP queue. The consultation, the diagnosis and the treatment are entirely the hospital’s — we handle the booking and the waiting.',
    te: 'కాదు. ఆసుపత్రులు, వైద్యులు తమ అపాయింట్‌మెంట్లు, OP క్యూను నిర్వహించడానికి వాడే సాఫ్ట్‌వేర్ TapCure. కన్సల్టేషన్, రోగ నిర్ధారణ, చికిత్స పూర్తిగా ఆసుపత్రివే — మేము బుకింగ్, వేచి ఉండటాన్ని చూసుకుంటాం.',
    hi: 'नहीं। TapCure वह सॉफ़्टवेयर है जिससे अस्पताल और डॉक्टर अपने अपॉइंटमेंट और OP क्यू चलाते हैं। परामर्श, निदान और इलाज पूरी तरह अस्पताल का है — हम बुकिंग और इंतज़ार संभालते हैं।',
  },
  'tc.faq.p3.q': { en: 'How does online token booking work?', te: 'ఆన్‌లైన్ టోకెన్ బుకింగ్ ఎలా పనిచేస్తుంది?', hi: 'ऑनलाइन टोकन बुकिंग कैसे काम करती है?' },
  'tc.faq.p3.a': {
    en: 'Search for a doctor or a specialty, pick a date and a time, and confirm. You get a numbered OP token for that session rather than a vague slot, so on the day you can see exactly how many people are ahead of you.',
    te: 'వైద్యుడిని లేదా స్పెషాలిటీని వెతికి, తేదీ, సమయం ఎంచుకుని ధృవీకరించండి. అస్పష్టమైన స్లాట్ కాకుండా ఆ సెషన్‌కు నంబర్‌తో కూడిన OP టోకెన్ వస్తుంది, కాబట్టి మీ ముందు ఎంతమంది ఉన్నారో ఆ రోజు కచ్చితంగా చూడవచ్చు.',
    hi: 'डॉक्टर या विशेषज्ञता खोजें, तारीख़ और समय चुनें, और कन्फ़र्म करें। आपको उस सेशन का नंबर वाला OP टोकन मिलता है, कोई अस्पष्ट स्लॉट नहीं — इसलिए उस दिन ठीक-ठीक दिखता है कि आपसे आगे कितने लोग हैं।',
  },
  'tc.faq.p4.q': { en: 'How much does TapCure charge?', te: 'TapCure ఎంత వసూలు చేస్తుంది?', hi: 'TapCure कितना शुल्क लेता है?' },
  'tc.faq.p4.a': {
    // Previous fee copy:
    // en: 'A ₹10 booking fee per appointment, and that is all we charge you. No subscription, no membership, and no markup on the doctor’s fee.',
    // te: 'ప్రతి అపాయింట్‌మెంట్‌కు ₹10 బుకింగ్ ఫీజు, అంతే. సబ్‌స్క్రిప్షన్ లేదు, మెంబర్‌షిప్ లేదు, వైద్యుడి ఫీజుపై అదనపు మొత్తం లేదు.',
    // hi: 'हर अपॉइंटमेंट पर ₹10 बुकिंग फ़ीस, बस इतना ही। कोई सब्सक्रिप्शन नहीं, कोई मेंबरशिप नहीं, और डॉक्टर की फ़ीस पर कोई अतिरिक्त शुल्क नहीं।',
    en: 'There is no platform fee to book an appointment. The doctor’s consultation fee is paid separately at the hospital.',
    te: 'అపాయింట్‌మెంట్ బుక్ చేయడానికి ప్లాట్‌ఫారమ్ ఫీజు లేదు. డాక్టర్ కన్సల్టేషన్ ఫీజును ఆసుపత్రిలో విడిగా చెల్లించాలి.',
    hi: 'अपॉइंटमेंट बुक करने के लिए कोई प्लेटफ़ॉर्म शुल्क नहीं है। डॉक्टर की परामर्श फ़ीस अस्पताल में अलग से देनी होती है।',
  },
  'tc.faq.p5.q': { en: 'Do I pay the doctor consultation fee online?', te: 'వైద్యుడి కన్సల్టేషన్ ఫీజు ఆన్‌లైన్‌లో చెల్లించాలా?', hi: 'क्या डॉक्टर की परामर्श फ़ीस ऑनलाइन देनी होती है?' },
  'tc.faq.p5.a': {
    // Previous fee copy:
    // en: 'No. Only the ₹10 booking fee is paid online. The consultation fee is the doctor’s own — it is shown to you before you confirm, and you pay it at the hospital by cash, UPI or card.',
    // te: 'లేదు. ఆన్‌లైన్‌లో ₹10 బుకింగ్ ఫీజు మాత్రమే. కన్సల్టేషన్ ఫీజు వైద్యుడిది — ధృవీకరించే ముందే మీకు కనిపిస్తుంది, ఆసుపత్రులో నగదు, UPI లేదా కార్డుతో చెల్లించండి.',
    // hi: 'नहीं। ऑनलाइन सिर्फ़ ₹10 बुकिंग फ़ीस लगती है। परामर्श फ़ीस डॉक्टर की अपनी है — कन्फ़र्म करने से पहले दिखा दी जाती है, और आप उसे अस्पताल पर नकद, UPI या कार्ड से देते हैं।',
    en: 'No. The doctor’s consultation fee is paid directly at the hospital by cash, UPI or card.',
    te: 'లేదు. డాక్టర్ కన్సల్టేషన్ ఫీజును ఆసుపత్రిలో నగదు, UPI లేదా కార్డుతో నేరుగా చెల్లించాలి.',
    hi: 'नहीं। डॉक्टर की परामर्श फ़ीस अस्पताल में नकद, UPI या कार्ड से सीधे दी जाती है।',
  },
  'tc.faq.p6.q': { en: 'What is a digital OP token?', te: 'డిజిటల్ OP టోకెన్ అంటే ఏమిటి?', hi: 'डिजिटल OP टोकन क्या है?' },
  'tc.faq.p6.a': {
    en: 'It is your place in the day’s queue, held on your phone instead of a paper slip. It carries your number, the doctor’s current position and your expected time, and it updates itself as the session runs.',
    te: 'కాగితం స్లిప్‌కు బదులుగా మీ ఫోన్‌లో ఉండే ఆ రోజు క్యూలో మీ స్థానం. అందులో మీ నంబర్, వైద్యుడు ప్రస్తుతం ఉన్న స్థానం, మీ అంచనా సమయం ఉంటాయి, సెషన్ నడుస్తున్నకొద్దీ అదే అప్‌డేట్ అవుతుంది.',
    hi: 'यह उस दिन की क्यू में आपकी जगह है, काग़ज़ की पर्ची की जगह आपके फ़ोन में। इसमें आपका नंबर, डॉक्टर की मौजूदा स्थिति और आपका अनुमानित समय होता है, और सेशन चलने के साथ यह ख़ुद अपडेट होता रहता है।',
  },
  'tc.faq.p7.q': { en: 'Can I track the current token?', te: 'ప్రస్తుత టోకెన్‌ను ట్రాక్ చేయవచ్చా?', hi: 'क्या मैं मौजूदा टोकन ट्रैक कर सकता हूँ?' },
  'tc.faq.p7.a': {
    en: 'Yes. Your dashboard shows the number the doctor is seeing right now and how many patients sit between that and you, refreshed live while the hospital is open.',
    te: 'అవును. వైద్యుడు ప్రస్తుతం చూస్తున్న నంబర్, దానికీ మీకూ మధ్య ఎంతమంది రోగులు ఉన్నారో మీ డాష్‌బోర్డ్ చూపిస్తుంది, ఆసుపత్రి తెరిచి ఉన్నంతసేపూ ప్రత్యక్షంగా అప్‌డేట్ అవుతుంది.',
    hi: 'हाँ। आपका डैशबोर्ड दिखाता है कि डॉक्टर अभी कौन-सा नंबर देख रहे हैं और उसके तथा आपके बीच कितने मरीज़ हैं — अस्पताल खुले रहने तक लाइव अपडेट होता रहता है।',
  },
  'tc.faq.p8.q': { en: 'What is smart travel timing?', te: 'స్మార్ట్ ట్రావెల్ టైమింగ్ అంటే ఏమిటి?', hi: 'स्मार्ट ट्रैवल टाइमिंग क्या है?' },
  'tc.faq.p8.a': {
    en: 'TapCure works out when you should leave. It takes the live driving time for your route, counts back from where your token actually sits in the queue, adds a half-hour cushion, and sends one alert fifteen minutes before you need to go.',
    te: 'మీరు ఎప్పుడు బయలుదేరాలో TapCure లెక్కిస్తుంది. మీ మార్గానికి ప్రత్యక్ష ప్రయాణ సమయాన్ని తీసుకుని, క్యూలో మీ టోకెన్ నిజంగా ఉన్న స్థానం నుండి వెనక్కి లెక్కించి, అరగంట అదనపు సమయం కలిపి, బయలుదేరడానికి పదిహేను నిమిషాల ముందు ఒక అలర్ట్ పంపుతుంది.',
    hi: 'TapCure हिसाब लगाता है कि आपको कब निकलना चाहिए। यह आपके रास्ते का लाइव ड्राइविंग समय लेता है, क्यू में आपके टोकन की असल स्थिति से पीछे गिनता है, आधे घंटे का अतिरिक्त समय जोड़ता है, और निकलने से पंद्रह मिनट पहले एक अलर्ट भेजता है।',
  },
  'tc.faq.p9.q': { en: 'Can I book for my family member?', te: 'కుటుంబ సభ్యుల కోసం బుక్ చేయవచ్చా?', hi: 'क्या मैं परिवार के सदस्य के लिए बुक कर सकता हूँ?' },
  'tc.faq.p9.a': {
    en: 'Yes — up to five people on one account. Each keeps their own records, prescriptions and reminders, and the leave-by alert can go to whoever is actually driving.',
    te: 'అవును — ఒకే ఖాతాలో ఐదుగురి వరకు. ప్రతి ఒక్కరికీ సొంత రికార్డులు, ప్రిస్క్రిప్షన్లు, రిమైండర్లు ఉంటాయి, బయలుదేరే అలర్ట్ నిజంగా వాహనం నడిపేవారికి వెళ్లేలా పెట్టుకోవచ్చు.',
    hi: 'हाँ — एक खाते में पाँच लोगों तक। हर किसी के अपने रिकॉर्ड, पर्चे और रिमाइंडर रहते हैं, और निकलने का अलर्ट उसी को भेजा जा सकता है जो असल में गाड़ी चला रहा हो।',
  },
  'tc.faq.p10.q': { en: 'What happens if the doctor is delayed?', te: 'వైద్యుడు ఆలస్యమైతే ఏమవుతుంది?', hi: 'अगर डॉक्टर को देर हो जाए तो?' },
  'tc.faq.p10.a': {
    en: 'The hospital logs the delay and every waiting patient’s expected time is recalculated at once. You are notified, and your leave-by time moves with it — so a late doctor means a later departure, not a longer wait in the lobby.',
    te: 'ఆసుపత్రి ఆలస్యాన్ని నమోదు చేస్తుంది, వేచి ఉన్న ప్రతి రోగి అంచనా సమయం వెంటనే మళ్లీ లెక్కించబడుతుంది. మీకు సమాచారం వస్తుంది, మీ బయలుదేరే సమయం కూడా మారుతుంది — అంటే వైద్యుడు ఆలస్యమైతే మీరు ఆలస్యంగా బయలుదేరతారు, లాబీలో ఎక్కువసేపు వేచి ఉండరు.',
    hi: 'अस्पताल देरी दर्ज करता है और हर प्रतीक्षारत मरीज़ का अनुमानित समय तुरंत दोबारा गिना जाता है। आपको सूचना मिलती है और आपका निकलने का समय भी उसी हिसाब से खिसक जाता है — यानी डॉक्टर की देरी का मतलब देर से निकलना है, लॉबी में लंबा इंतज़ार नहीं।',
  },
  'tc.faq.p11.q': { en: 'Can I upload prescriptions?', te: 'ప్రిస్క్రిప్షన్లు అప్‌లోడ్ చేయవచ్చా?', hi: 'क्या मैं पर्चे अपलोड कर सकता हूँ?' },
  'tc.faq.p11.a': {
    en: 'Yes. You can add your own prescriptions, lab reports and scans to your records, and share them with the hospital you are visiting.',
    te: 'అవును. మీ సొంత ప్రిస్క్రిప్షన్లు, ల్యాబ్ రిపోర్టులు, స్కాన్‌లను మీ రికార్డులకు జోడించి, మీరు వెళ్తున్న ఆసుపత్రితో పంచుకోవచ్చు.',
    hi: 'हाँ। आप अपने पर्चे, लैब रिपोर्ट और स्कैन अपने रिकॉर्ड में जोड़ सकते हैं और जिस अस्पताल जा रहे हैं उससे साझा कर सकते हैं।',
  },
  'tc.faq.p12.q': { en: 'Can AI explain my prescription?', te: 'నా ప్రిస్క్రిప్షన్‌ను AI వివరించగలదా?', hi: 'क्या AI मेरा पर्चा समझा सकता है?' },
  'tc.faq.p12.a': {
    en: 'Not yet — we would rather not have software paraphrase your medication. Where we do use AI is booking by voice, in English, Telugu or Hindi. Your prescriptions are written by the doctor on the platform and reach you unchanged.',
    te: 'ఇంకా లేదు — మీ మందుల గురించి సాఫ్ట్‌వేర్ సొంతంగా వివరించడం మాకు ఇష్టం లేదు. మేము AIని వాడేది వాయిస్ ద్వారా బుకింగ్ కోసం — ఇంగ్లీష్, తెలుగు లేదా హిందీలో. మీ ప్రిస్క్రిప్షన్లను వైద్యుడే వేదికపై రాస్తారు, అవి మారకుండా మీకు చేరతాయి.',
    hi: 'अभी नहीं — हम नहीं चाहते कि सॉफ़्टवेयर आपकी दवा को अपने शब्दों में बताए। हम AI का उपयोग आवाज़ से बुकिंग के लिए करते हैं — अंग्रेज़ी, तेलुगु या हिंदी में। आपके पर्चे डॉक्टर ही प्लेटफ़ॉर्म पर लिखते हैं और वे बिना बदले आप तक पहुँचते हैं।',
  },
  'tc.faq.p13.q': { en: 'Which languages are supported?', te: 'ఏ భాషలకు మద్దతు ఉంది?', hi: 'कौन-सी भाषाएँ उपलब्ध हैं?' },
  'tc.faq.p13.a': {
    en: 'Three: English, తెలుగు and हिन्दी — across the whole patient app, voice booking included.',
    te: 'మూడు: English, తెలుగు, हिन्दी — రోగి యాప్ మొత్తంలో, వాయిస్ బుకింగ్‌తో సహా.',
    hi: 'तीन: English, తెలుగు और हिन्दी — पूरे मरीज़ ऐप में, आवाज़ से बुकिंग सहित।',
  },
  'tc.faq.p14.q': { en: 'Is my data safe?', te: 'నా డేటా సురక్షితమేనా?', hi: 'क्या मेरा डेटा सुरक्षित है?' },
  'tc.faq.p14.a': {
    en: 'Your records are shared only with the hospital you are visiting, and a doctor sees the visits made to their own practice rather than your whole history. Location is used only while an appointment is active.',
    te: 'మీ రికార్డులు మీరు వెళ్తున్న ఆసుపత్రితో మాత్రమే పంచుకోబడతాయి, వైద్యుడికి మీ మొత్తం చరిత్ర కాకుండా తమ ప్రాక్టీస్‌కు వచ్చిన సందర్శనలు మాత్రమే కనిపిస్తాయి. అపాయింట్‌మెంట్ యాక్టివ్‌గా ఉన్నప్పుడు మాత్రమే లొకేషన్ వాడతాం.',
    hi: 'आपके रिकॉर्ड सिर्फ़ उसी अस्पताल से साझा होते हैं जहाँ आप जा रहे हैं, और डॉक्टर को आपका पूरा इतिहास नहीं, सिर्फ़ अपनी प्रैक्टिस में हुई विज़िट दिखती हैं। लोकेशन का उपयोग सिर्फ़ तब होता है जब अपॉइंटमेंट सक्रिय हो।',
  },

  /* ── hospitals ── */
  'tc.faq.c1.q': { en: 'How can our hospital join TapCure?', te: 'మా ఆసుపత్రి TapCureలో ఎలా చేరాలి?', hi: 'हमारा अस्पताल TapCure से कैसे जुड़े?' },
  'tc.faq.c1.a': {
    en: 'Use “Register Your Hospital” to submit your hospital details. Your registration is reviewed and approved before it goes live, and you are emailed either way.',
    te: '“మీ ఆసుపత్రిని నమోదు చేయండి” ద్వారా మీ ఆసుపత్రి వివరాలు సమర్పించండి. ప్రత్యక్షం కాకముందే మీ నమోదు సమీక్షించి ఆమోదించబడుతుంది, ఏ నిర్ణయమైనా మీకు ఇమెయిల్ ద్వారా తెలుస్తుంది.',
    hi: '“अपना अस्पताल पंजीकृत करें” से अपने अस्पताल का विवरण भेजें। लाइव होने से पहले आपका पंजीकरण जाँचा और स्वीकृत किया जाता है, और दोनों ही स्थिति में आपको ईमेल मिलता है।',
  },
  'tc.faq.c2.q': { en: 'What does it cost for hospitals?', te: 'ఆసుపత్రులకు ఖర్చు ఎంత?', hi: 'अस्पताल के लिए क्या शुल्क है?' },
  'tc.faq.c2.a': {
    en: 'Hospitals run on a subscription plan rather than a cut of your consultations — we never take a share of what your patients pay you. Get in touch and we will match a plan to the number of doctors you run.',
    te: 'మీ కన్సల్టేషన్లలో వాటా కాకుండా ఆసుపత్రులు సబ్‌స్క్రిప్షన్ ప్లాన్‌పై నడుస్తాయి — మీ రోగులు మీకు చెల్లించే దాంట్లో మేము ఎప్పుడూ వాటా తీసుకోము. మమ్మల్ని సంప్రదించండి, మీ వైద్యుల సంఖ్యకు తగిన ప్లాన్ ఇస్తాం.',
    hi: 'अस्पताल सब्सक्रिप्शन प्लान पर चलते हैं, आपके परामर्श में हिस्सेदारी पर नहीं — आपके मरीज़ जो आपको देते हैं, उसमें से हम कभी हिस्सा नहीं लेते। संपर्क कीजिए, हम आपके डॉक्टरों की संख्या के अनुसार प्लान तय कर देंगे।',
  },
  'tc.faq.c3.q': { en: 'How do we manage the OP queue?', te: 'OP క్యూను ఎలా నిర్వహించాలి?', hi: 'OP क्यू कैसे संभालें?' },
  'tc.faq.c3.a': {
    en: 'Your front desk gets a live queue console: call the next token, recall a patient who missed their turn, mark a no-show, reorder the line — with every waiting patient’s expected time updating as you go.',
    te: 'మీ ఫ్రంట్ డెస్క్‌కు ప్రత్యక్ష క్యూ కన్సోల్ వస్తుంది: తదుపరి టోకెన్ పిలవడం, వంతు తప్పిన రోగిని మళ్లీ పిలవడం, నో-షో గుర్తించడం, వరుసను మార్చడం — మీరు చేస్తున్నకొద్దీ వేచి ఉన్న ప్రతి రోగి అంచనా సమయం అప్‌డేట్ అవుతుంది.',
    hi: 'आपके फ़्रंट डेस्क को लाइव क्यू कंसोल मिलता है: अगला टोकन बुलाना, बारी चूके मरीज़ को दोबारा बुलाना, नो-शो दर्ज करना, क्रम बदलना — और साथ-साथ हर प्रतीक्षारत मरीज़ का अनुमानित समय अपडेट होता रहता है।',
  },
  'tc.faq.c4.q': { en: 'Can we add walk-in patients?', te: 'వాక్-ఇన్ రోగులను చేర్చవచ్చా?', hi: 'क्या वॉक-इन मरीज़ जोड़ सकते हैं?' },
  'tc.faq.c4.a': {
    en: 'Yes. Reception can register a walk-in and drop them into the running queue in one step. They need no account and no smartphone.',
    te: 'అవును. రిసెప్షన్ ఒకే అడుగులో వాక్-ఇన్ రోగిని నమోదు చేసి నడుస్తున్న క్యూలో చేర్చగలదు. వారికి ఖాతా గానీ, స్మార్ట్‌ఫోన్ గానీ అవసరం లేదు.',
    hi: 'हाँ। रिसेप्शन एक ही चरण में वॉक-इन मरीज़ को दर्ज कर चालू क्यू में जोड़ सकता है। उन्हें न खाते की ज़रूरत है, न स्मार्टफ़ोन की।',
  },
  'tc.faq.c5.q': { en: 'Can we manage multiple doctors?', te: 'ఎక్కువ మంది వైద్యులను నిర్వహించవచ్చా?', hi: 'क्या कई डॉक्टर संभाल सकते हैं?' },
  'tc.faq.c5.a': {
    en: 'Yes — as many as you run, across departments, each with their own schedule, availability, leave and fees.',
    te: 'అవును — మీరు నడిపేంత మందిని, విభాగాల వారీగా, ప్రతి ఒక్కరికీ సొంత షెడ్యూల్, అందుబాటు, సెలవులు, ఫీజులతో.',
    hi: 'हाँ — जितने आप चलाते हैं, विभागों में बँटे हुए, हर एक का अपना शेड्यूल, उपलब्धता, अवकाश और फ़ीस।',
  },
  'tc.faq.c6.q': { en: 'How do we notify patients about delays?', te: 'ఆలస్యాల గురించి రోగులకు ఎలా తెలియజేయాలి?', hi: 'देरी की सूचना मरीज़ों को कैसे दें?' },
  'tc.faq.c6.a': {
    en: 'Log the delay once. Every waiting patient’s time is recalculated and they are told automatically — so people arrive when you are ready for them instead of filling your waiting room.',
    te: 'ఆలస్యాన్ని ఒక్కసారి నమోదు చేయండి. వేచి ఉన్న ప్రతి రోగి సమయం మళ్లీ లెక్కించబడి, వారికి ఆటోమేటిక్‌గా తెలుస్తుంది — దాంతో వెయిటింగ్ రూమ్ నిండిపోకుండా, మీరు సిద్ధమైనప్పుడే వారు వస్తారు.',
    hi: 'देरी एक बार दर्ज कर दीजिए। हर प्रतीक्षारत मरीज़ का समय दोबारा गिना जाता है और उन्हें अपने-आप बता दिया जाता है — इसलिए लोग तब आते हैं जब आप तैयार हों, वेटिंग रूम भरता नहीं।',
  },
  'tc.faq.c7.q': { en: 'What reports do we get?', te: 'ఏ నివేదికలు వస్తాయి?', hi: 'हमें कौन-सी रिपोर्ट मिलती हैं?' },
  'tc.faq.c7.a': {
    en: 'Daily and monthly summaries, per-doctor and per-department load, revenue actually collected, peak hours, no-shows, cancellations, average wait time and patient flow.',
    te: 'రోజువారీ, నెలవారీ సారాంశాలు, వైద్యుడు మరియు విభాగం వారీ లోడ్, నిజంగా వసూలైన ఆదాయం, రద్దీ సమయాలు, నో-షోలు, రద్దులు, సగటు నిరీక్షణ సమయం, రోగుల రాక.',
    hi: 'दैनिक और मासिक सारांश, डॉक्टर व विभाग के अनुसार भार, वास्तव में वसूला गया राजस्व, व्यस्त घंटे, नो-शो, रद्दीकरण, औसत प्रतीक्षा समय और मरीज़ों का प्रवाह।',
  },
  'tc.faq.c8.q': { en: 'Who verifies our hospital?', te: 'మా ఆసుపత్రిని ఎవరు ధృవీకరిస్తారు?', hi: 'हमारे अस्पताल की जाँच कौन करता है?' },
  'tc.faq.c8.a': {
    en: 'Our team reviews every registration before approving it. Doctors who register their own independent practice are verified against their medical council registration number and their uploaded credentials.',
    te: 'ప్రతి నమోదును ఆమోదించే ముందు మా బృందం సమీక్షిస్తుంది. సొంతంగా స్వతంత్ర ప్రాక్టీస్ నమోదు చేసుకునే వైద్యులను వారి మెడికల్ కౌన్సిల్ రిజిస్ట్రేషన్ నంబర్, అప్‌లోడ్ చేసిన ధ్రువపత్రాల ఆధారంగా ధృవీకరిస్తాం.',
    hi: 'हमारी टीम हर पंजीकरण को स्वीकृत करने से पहले जाँचती है। जो डॉक्टर अपनी स्वतंत्र प्रैक्टिस ख़ुद पंजीकृत करते हैं, उनकी जाँच उनके मेडिकल काउंसिल रजिस्ट्रेशन नंबर और अपलोड किए गए प्रमाणपत्रों से की जाती है।',
  },

  /* ── doctors ── */
  'tc.faq.d1.q': { en: 'How do I join TapCure as a doctor?', te: 'వైద్యుడిగా TapCureలో ఎలా చేరాలి?', hi: 'डॉक्टर के रूप में TapCure से कैसे जुड़ें?' },
  'tc.faq.d1.a': {
    en: 'Use the doctor sign-up to register your independent practice. You enter your professional details and upload your credentials for verification, and you go live once that is done.',
    te: 'డాక్టర్ సైన్-అప్ ద్వారా మీ స్వతంత్ర ప్రాక్టీస్‌ను నమోదు చేసుకోండి. మీ వృత్తిపరమైన వివరాలు ఇచ్చి, ధృవీకరణ కోసం ధ్రువపత్రాలు అప్‌లోడ్ చేయండి, అది పూర్తయ్యాక మీరు ప్రత్యక్షం అవుతారు.',
    hi: 'डॉक्टर साइन-अप से अपनी स्वतंत्र प्रैक्टिस पंजीकृत करें। अपना पेशेवर विवरण भरें और जाँच के लिए प्रमाणपत्र अपलोड करें — पूरा होते ही आप लाइव हो जाते हैं।',
  },
  'tc.faq.d2.q': { en: 'What documents do I need to upload?', te: 'ఏ పత్రాలు అప్‌లోడ్ చేయాలి?', hi: 'कौन-से दस्तावेज़ अपलोड करने होंगे?' },
  'tc.faq.d2.a': {
    en: 'Your medical council registration certificate and your degree certificate are required. A council proof and a photo ID are optional, and speed up verification. Your council registration number is validated at sign-up.',
    te: 'మీ మెడికల్ కౌన్సిల్ రిజిస్ట్రేషన్ సర్టిఫికెట్, డిగ్రీ సర్టిఫికెట్ తప్పనిసరి. కౌన్సిల్ రుజువు, ఫోటో ID ఐచ్ఛికం, అవి ధృవీకరణను వేగవంతం చేస్తాయి. సైన్-అప్ సమయంలో మీ కౌన్సిల్ రిజిస్ట్రేషన్ నంబర్ పరిశీలించబడుతుంది.',
    hi: 'आपका मेडिकल काउंसिल रजिस्ट्रेशन प्रमाणपत्र और डिग्री प्रमाणपत्र अनिवार्य हैं। काउंसिल प्रमाण और फ़ोटो पहचान-पत्र वैकल्पिक हैं और जाँच तेज़ कर देते हैं। साइन-अप के समय आपका काउंसिल रजिस्ट्रेशन नंबर जाँचा जाता है।',
  },
  'tc.faq.d3.q': { en: 'How does verification work?', te: 'ధృవీకరణ ఎలా జరుగుతుంది?', hi: 'सत्यापन कैसे होता है?' },
  'tc.faq.d3.a': {
    en: 'Your account starts as pending while our team reviews your documents. You are notified when you are verified, or told what is missing if you are not — patients only ever see verified doctors.',
    te: 'మా బృందం మీ పత్రాలను సమీక్షించే వరకు మీ ఖాతా పెండింగ్‌లో ఉంటుంది. ధృవీకరణ పూర్తయితే మీకు తెలియజేస్తాం, కాకపోతే ఏమి తక్కువగా ఉందో చెబుతాం — రోగులకు ధృవీకరించిన వైద్యులు మాత్రమే కనిపిస్తారు.',
    hi: 'जब तक हमारी टीम आपके दस्तावेज़ जाँचती है, आपका खाता लंबित रहता है। सत्यापन होने पर आपको सूचित किया जाता है, न होने पर बताया जाता है कि क्या कमी है — मरीज़ों को सिर्फ़ सत्यापित डॉक्टर ही दिखते हैं।',
  },
  'tc.faq.d4.q': { en: 'Can I manage my own availability and fees?', te: 'నా అందుబాటు, ఫీజులు నేనే నిర్వహించవచ్చా?', hi: 'क्या मैं अपनी उपलब्धता और फ़ीस ख़ुद तय कर सकता हूँ?' },
  'tc.faq.d4.a': {
    en: 'Yes, both are yours. Set your consulting days and hours, your slot length, your leave and your consultation fee, and change them whenever you like.',
    te: 'అవును, రెండూ మీవే. మీ కన్సల్టింగ్ రోజులు, గంటలు, స్లాట్ నిడివి, సెలవులు, కన్సల్టేషన్ ఫీజు మీరే పెట్టుకోండి, ఎప్పుడైనా మార్చుకోండి.',
    hi: 'हाँ, दोनों आपके हैं। अपने परामर्श के दिन और घंटे, स्लॉट की अवधि, अवकाश और परामर्श फ़ीस ख़ुद तय करें, और जब चाहें बदलें।',
  },
  'tc.faq.d5.q': { en: 'How do I see my live queue?', te: 'నా ప్రత్యక్ష క్యూ ఎలా చూడాలి?', hi: 'अपनी लाइव क्यू कैसे देखूँ?' },
  'tc.faq.d5.a': {
    en: 'Your dashboard is the queue: who is waiting, who is next, their vitals if reception recorded them, and one tap to call the next token.',
    te: 'మీ డాష్‌బోర్డే క్యూ: ఎవరు వేచి ఉన్నారు, తర్వాత ఎవరు, రిసెప్షన్ నమోదు చేసి ఉంటే వారి వైటల్స్, తదుపరి టోకెన్ పిలవడానికి ఒక్క ట్యాప్.',
    hi: 'आपका डैशबोर्ड ही क्यू है: कौन इंतज़ार में है, अगला कौन है, रिसेप्शन ने दर्ज किए हों तो उनके वाइटल्स, और अगला टोकन बुलाने के लिए एक टैप।',
  },
  'tc.faq.d6.q': { en: 'Can I write prescriptions on the platform?', te: 'వేదికపై ప్రిస్క్రిప్షన్లు రాయవచ్చా?', hi: 'क्या मैं प्लेटफ़ॉर्म पर पर्चा लिख सकता हूँ?' },
  'tc.faq.d6.a': {
    en: 'Yes. Prescriptions are written on the platform and reach the patient’s account straight away, and a follow-up date on a prescription books itself into your list.',
    te: 'అవును. ప్రిస్క్రిప్షన్లు వేదికపైనే రాయబడి వెంటనే రోగి ఖాతాకు చేరతాయి, ప్రిస్క్రిప్షన్‌లో ఫాలో-అప్ తేదీ ఉంటే అది మీ జాబితాలో దానంతట అదే చేరుతుంది.',
    hi: 'हाँ। पर्चे प्लेटफ़ॉर्म पर लिखे जाते हैं और तुरंत मरीज़ के खाते में पहुँच जाते हैं, और पर्चे पर दी गई फ़ॉलो-अप तारीख़ अपने-आप आपकी सूची में जुड़ जाती है।',
  },
  'tc.faq.d7.q': { en: 'Can I send a delay alert to waiting patients?', te: 'వేచి ఉన్న రోగులకు ఆలస్య సమాచారం పంపవచ్చా?', hi: 'क्या प्रतीक्षारत मरीज़ों को देरी की सूचना भेज सकता हूँ?' },
  'tc.faq.d7.a': {
    en: 'Yes. Log the delay once and everyone waiting is told, with their expected times and their leave-by alerts moved for them.',
    te: 'అవును. ఆలస్యాన్ని ఒక్కసారి నమోదు చేస్తే వేచి ఉన్న అందరికీ తెలుస్తుంది, వారి అంచనా సమయాలు, బయలుదేరే అలర్ట్‌లు వారి కోసం మారతాయి.',
    hi: 'हाँ। देरी एक बार दर्ज कीजिए और सभी प्रतीक्षारत लोगों को बता दिया जाता है, उनके अनुमानित समय और निकलने के अलर्ट भी उनके लिए खिसका दिए जाते हैं।',
  },
  'tc.faq.d8.q': { en: 'Do I get reports of my consultations?', te: 'నా కన్సల్టేషన్ల నివేదికలు వస్తాయా?', hi: 'क्या मुझे अपने परामर्श की रिपोर्ट मिलती है?' },
  'tc.faq.d8.a': {
    en: 'Yes — how many patients you saw, over what hours, what was actually collected, and your no-shows and cancellations.',
    te: 'అవును — ఎంతమంది రోగులను చూశారు, ఏ గంటల్లో, నిజంగా ఎంత వసూలైంది, మీ నో-షోలు, రద్దులు.',
    hi: 'हाँ — आपने कितने मरीज़ देखे, किन घंटों में, वास्तव में कितना वसूला गया, और आपके नो-शो व रद्दीकरण।',
  },
  'tc.faq.d9.q': { en: 'Can I work at more than one hospital?', te: 'ఒకటి కంటే ఎక్కువ ఆసుపత్రులలో పనిచేయవచ్చా?', hi: 'क्या मैं एक से अधिक अस्पताल में काम कर सकता हूँ?' },
  'tc.faq.d9.a': {
    en: 'Yes. One account can be attached to several hospitals as well as your own practice, and each keeps its schedule, fees and patient records separate from the others.',
    te: 'అవును. ఒకే ఖాతాను మీ సొంత ప్రాక్టీస్‌తో పాటు అనేక ఆసుపత్రులకు జోడించవచ్చు, ప్రతి దానికీ షెడ్యూల్, ఫీజులు, రోగుల రికార్డులు వేరుగా ఉంటాయి.',
    hi: 'हाँ। एक ही खाता आपकी अपनी प्रैक्टिस के साथ-साथ कई अस्पतालों से जुड़ सकता है, और हर एक का शेड्यूल, फ़ीस और मरीज़ रिकॉर्ड दूसरों से अलग रहता है।',
  },
  'tc.faq.d10.q': { en: 'Is there a cost for doctors?', te: 'వైద్యులకు ఖర్చు ఉందా?', hi: 'क्या डॉक्टरों के लिए कोई शुल्क है?' },
  'tc.faq.d10.a': {
    en: 'Registering your independent practice is free. A subscription only comes in if you also run a hospital, with staff and several doctors on it.',
    te: 'మీ స్వతంత్ర ప్రాక్టీస్‌ను నమోదు చేసుకోవడం ఉచితం. సిబ్బంది, పలువురు వైద్యులతో ఆసుపత్రి కూడా నడిపితేనే సబ్‌స్క్రిప్షన్ వర్తిస్తుంది.',
    hi: 'अपनी स्वतंत्र प्रैक्टिस पंजीकृत करना मुफ़्त है। सब्सक्रिप्शन तभी लागू होता है जब आप स्टाफ़ और कई डॉक्टरों वाला अस्पताल भी चलाते हों।',
  },
}
