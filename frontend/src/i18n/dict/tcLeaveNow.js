/**
 * The Leave-Now section on the landing page (`components/landing/TcLeaveNow.jsx`).
 *
 * Kept separate from tcLanding.js because this section is a self-contained
 * explainer with its own vocabulary (depart / drive / arrive / seen) and is the
 * part of the page most likely to be reworded.
 *
 * "Leave-Now" is a product name and stays in Latin script in all three
 * languages. Times, distances and minute counts are interpolated at render, so
 * only the words around them live here.
 */
export const tcLeaveNowT = {
  'tc.ln.eyebrow': { en: 'The Leave-Now engine', te: 'Leave-Now ఇంజిన్', hi: 'Leave-Now इंजन' },
  'tc.ln.h2a': { en: 'Every other app tells you', te: 'మిగతా యాప్‌లన్నీ చెప్పేది', hi: 'बाक़ी सारे ऐप बताते हैं' },
  'tc.ln.h2b': { en: 'when to arrive.', te: 'ఎప్పుడు చేరుకోవాలో.', hi: 'कब पहुँचना है।' },
  'tc.ln.ledeA': { en: 'We tell you when to', te: 'మేము చెప్పేది ఎప్పుడు', hi: 'हम बताते हैं कब' },
  'tc.ln.leaveWord': { en: 'leave', te: 'బయలుదేరాలో', hi: 'निकलना है' },
  'tc.ln.ledeB': {
    en: '. TapCure takes the live driving time for your route, works back from where your token actually sits in the queue, and adds a half-hour cushion — then gives you one time and one alert.',
    te: '. TapCure మీ మార్గానికి ప్రత్యక్ష ప్రయాణ సమయాన్ని తీసుకుని, క్యూలో మీ టోకెన్ నిజంగా ఉన్న స్థానం నుండి వెనక్కి లెక్కించి, అరగంట అదనపు సమయం కలిపి — ఒకే సమయం, ఒకే అలర్ట్ ఇస్తుంది.',
    hi: '। TapCure आपके रास्ते का लाइव ड्राइविंग समय लेता है, क्यू में आपके टोकन की असल स्थिति से पीछे गिनता है, और आधे घंटे का अतिरिक्त समय जोड़ता है — फिर आपको एक समय और एक अलर्ट देता है।',
  },
  'tc.ln.leaveHomeAt': { en: 'Leave home at', te: 'ఇంటి నుండి బయలుదేరాల్సిన సమయం', hi: 'घर से निकलें' },
  'tc.ln.shouldHaveLeft': { en: 'You should have left', te: 'మీరు బయలుదేరి ఉండాల్సింది', hi: 'आपको निकल जाना चाहिए था' },
  'tc.ln.ago': { en: 'ago', te: 'క్రితం', hi: 'पहले' },
  'tc.ln.thatIs': { en: 'That is', te: 'అంటే', hi: 'यानी' },
  'tc.ln.fromNow': { en: 'from now', te: 'ఇప్పటి నుండి', hi: 'अब से' },
  'tc.ln.rolled': {
    en: 'That slot has gone today — showing tomorrow',
    te: 'ఆ సమయం ఈరోజు దాటిపోయింది — రేపటిది చూపుతున్నాం',
    hi: 'वह स्लॉट आज निकल गया — कल का दिखा रहे हैं',
  },
  'tc.ln.doorToChair': { en: 'min door to chair', te: 'నిమి. ఇంటి నుండి కుర్చీ వరకు', hi: 'मिनट घर से कुर्सी तक' },

  'tc.ln.drive': { en: 'Drive', te: 'ప్రయాణం', hi: 'सफ़र' },
  'tc.ln.driveH': { en: 'Live traffic. Not a flat average.', te: 'ప్రత్యక్ష ట్రాఫిక్. సగటు కాదు.', hi: 'लाइव ट्रैफ़िक। कोई औसत नहीं।' },
  'tc.ln.driveP': {
    en: 'Driving time comes from Google’s live traffic for your actual route, refreshed every few minutes while your appointment is open — not a flat average.',
    te: 'మీ నిజమైన మార్గానికి Google ప్రత్యక్ష ట్రాఫిక్ నుండి ప్రయాణ సమయం వస్తుంది, మీ అపాయింట్‌మెంట్ ఉన్నంతసేపూ కొన్ని నిమిషాలకోసారి తాజాగా అవుతుంది — సగటు కాదు.',
    hi: 'ड्राइविंग समय आपके असली रास्ते के लिए Google के लाइव ट्रैफ़िक से आता है, और अपॉइंटमेंट खुले रहने तक हर कुछ मिनट में ताज़ा होता है — कोई सपाट औसत नहीं।',
  },
  'tc.ln.onRoad': { en: 'on the road', te: 'దారిలో', hi: 'रास्ते में' },
  'tc.ln.jam': {
    en: 'Heavier traffic than usual on this route',
    te: 'ఈ మార్గంలో సాధారణం కంటే ఎక్కువ ట్రాఫిక్',
    hi: 'इस रास्ते पर सामान्य से ज़्यादा ट्रैफ़िक',
  },

  'tc.ln.arrive': { en: 'Arrive', te: 'చేరుకోవడం', hi: 'पहुँचना' },
  'tc.ln.arriveH': { en: 'Every minute, out in the open.', te: 'ప్రతి నిమిషం, స్పష్టంగా.', hi: 'हर मिनट, खुलकर।' },
  'tc.ln.arriveP': {
    en: 'No black box. Here is each minute we subtract, and why.',
    te: 'రహస్యం ఏమీ లేదు. మేము తీసివేసే ప్రతి నిమిషం, ఎందుకో ఇక్కడ ఉంది.',
    hi: 'कोई ब्लैक बॉक्स नहीं। हम जो हर मिनट घटाते हैं, वह और उसकी वजह यहाँ है।',
  },
  'tc.ln.noteA': { en: 'One cushion, not a formula:', te: 'ఫార్ములా కాదు, ఒకే అదనపు సమయం:', hi: 'कोई फ़ॉर्मूला नहीं, बस एक अतिरिक्त समय:' },
  'tc.ln.noteB': {
    en: 'between arriving and your token being called. It is a fixed margin, the same for every hospital — we would rather have you waiting a few minutes than missing your turn.',
    te: 'చేరుకోవడానికీ, మీ టోకెన్ పిలవడానికీ మధ్య. ఇది స్థిరమైన మార్జిన్, ప్రతి ఆసుపత్రికీ ఒకటే — మీరు వంతు కోల్పోవడం కంటే కొన్ని నిమిషాలు వేచి ఉండటమే మేలు.',
    hi: 'पहुँचने और आपका टोकन बुलाए जाने के बीच। यह एक तय अंतर है, हर अस्पताल के लिए एक जैसा — हमें आपका बारी चूकने से बेहतर लगता है कि आप कुछ मिनट रुक जाएँ।',
  },

  'tc.ln.seen': { en: 'Seen', te: 'కలవడం', hi: 'दिखाना' },
  'tc.ln.seenH': { en: 'And you walk straight in.', te: 'మీరు నేరుగా లోపలికి వెళ్లిపోతారు.', hi: 'और आप सीधे अंदर चले जाते हैं।' },
  'tc.ln.seenP': {
    en: 'No chairs, no old magazines, no wondering whether you should have left ten minutes earlier.',
    te: 'కుర్చీలు లేవు, పాత పత్రికలు లేవు, పది నిమిషాల ముందు బయలుదేరి ఉండాల్సిందా అనే సందేహం లేదు.',
    hi: 'न कुर्सियाँ, न पुरानी पत्रिकाएँ, न यह सोचना कि दस मिनट पहले निकलना चाहिए था।',
  },

  /* travel-mode chips */
  'tc.ln.mode.car': { en: 'Own car', te: 'సొంత కారు', hi: 'अपनी कार' },
  'tc.ln.mode.cab': { en: 'Cab', te: 'క్యాబ్', hi: 'कैब' },
  'tc.ln.mode.metro': { en: 'Metro', te: 'మెట్రో', hi: 'मेट्रो' },
  'tc.ln.mode.bike': { en: 'Two-wheeler', te: 'ద్విచక్ర వాహనం', hi: 'दोपहिया' },

  /* the minute-by-minute timeline */
  'tc.ln.step.leaveHome': { en: 'Leave home', te: 'ఇంటి నుండి బయలుదేరండి', hi: 'घर से निकलें' },
  'tc.ln.step.leaveHomeSub': { en: 'One alert, 15 minutes before this', te: 'దీనికి 15 నిమిషాల ముందు ఒక అలర్ట్', hi: 'इससे 15 मिनट पहले एक अलर्ट' },
  'tc.ln.step.onRoad': { en: 'On the road', te: 'దారిలో', hi: 'रास्ते में' },
  'tc.ln.step.heavy': { en: 'Heavier traffic than usual', te: 'సాధారణం కంటే ఎక్కువ ట్రాఫిక్', hi: 'सामान्य से ज़्यादा ट्रैफ़िक' },
  'tc.ln.step.clear': { en: 'Clear run expected', te: 'ప్రయాణం సాఫీగా ఉంటుంది', hi: 'रास्ता साफ़ रहने की उम्मीद' },
  'tc.ln.step.atHospital': { en: 'At the hospital', te: 'ఆసుపత్రులో', hi: 'अस्पताल पर' },
  'tc.ln.step.waiting': { en: 'Waiting, not rushing', te: 'హడావిడి కాదు, ప్రశాంతంగా', hi: 'भागदौड़ नहीं, इत्मीनान' },
  'tc.ln.step.cushion': { en: 'min cushion', te: 'నిమి. అదనపు సమయం', hi: 'मिनट अतिरिक्त' },
  'tc.ln.step.called': { en: 'Your token is called', te: 'మీ టోకెన్ పిలుస్తారు', hi: 'आपका टोकन बुलाया जाता है' },
  'tc.ln.step.calledSub': { en: 'Where you actually sit in the queue', te: 'క్యూలో మీరు నిజంగా ఉన్న స్థానం', hi: 'क्यू में आपकी असल जगह' },

  /* the four feature cards below the line */
  'tc.ln.feat1.t': { en: 'Live traffic, not averages', te: 'సగటులు కాదు, ప్రత్యక్ష ట్రాఫిక్', hi: 'औसत नहीं, लाइव ट्रैफ़िक' },
  'tc.ln.feat1.d': {
    en: 'Driving time for your real route, refreshed while your appointment is open.',
    te: 'మీ నిజమైన మార్గానికి ప్రయాణ సమయం, అపాయింట్‌మెంట్ ఉన్నంతసేపూ తాజాగా.',
    hi: 'आपके असली रास्ते का ड्राइविंग समय, अपॉइंटमेंट खुले रहने तक ताज़ा होता हुआ।',
  },
  'tc.ln.feat2.t': { en: 'Your place in the real queue', te: 'నిజమైన క్యూలో మీ స్థానం', hi: 'असली क्यू में आपकी जगह' },
  'tc.ln.feat2.d': {
    en: 'The time counts back from where your token actually sits — and moves when the doctor runs late.',
    te: 'క్యూలో మీ టోకెన్ నిజంగా ఉన్న స్థానం నుండి సమయం లెక్కించబడుతుంది — వైద్యుడు ఆలస్యమైతే అదీ మారుతుంది.',
    hi: 'समय आपके टोकन की असल जगह से पीछे गिना जाता है — और डॉक्टर को देर हो तो वह भी खिसक जाता है।',
  },
  'tc.ln.feat3.t': { en: 'One alert, not a stream', te: 'వరుస నోటిఫికేషన్లు కాదు, ఒకే అలర్ట్', hi: 'नोटिफ़िकेशन की झड़ी नहीं, एक अलर्ट' },
  'tc.ln.feat3.d': {
    en: 'A single nudge fifteen minutes before you need to go. Nothing before that.',
    te: 'బయలుదేరడానికి పదిహేను నిమిషాల ముందు ఒకే గుర్తు. అంతకుముందు ఏమీ లేదు.',
    hi: 'निकलने से पंद्रह मिनट पहले सिर्फ़ एक याद-दिलावा। उससे पहले कुछ नहीं।',
  },
  'tc.ln.feat4.t': { en: 'Whoever is driving gets it', te: 'వాహనం నడిపేవారికే అలర్ట్', hi: 'अलर्ट उसी को जो गाड़ी चला रहा हो' },
  'tc.ln.feat4.d': {
    en: 'Taking your parents? The alert goes to the person behind the wheel, not just the patient.',
    te: 'తల్లిదండ్రులను తీసుకెళ్తున్నారా? అలర్ట్ రోగికే కాదు, వాహనం నడిపే వ్యక్తికి వెళ్తుంది.',
    hi: 'माता-पिता को ले जा रहे हैं? अलर्ट सिर्फ़ मरीज़ को नहीं, गाड़ी चलाने वाले को जाता है।',
  },
  'tc.ln.map.home': { en: 'Home', te: 'ఇల్లు', hi: 'घर' },
}
