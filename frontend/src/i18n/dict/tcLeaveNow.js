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
  'tc.ln.eyebrow': { en: 'Your leave time', te: 'మీరు బయలుదేరాల్సిన సమయం', hi: 'आपके निकलने का समय' },
  'tc.ln.h2a': { en: 'Other apps tell you', te: 'ఇతర యాప్‌లు చెప్పేది', hi: 'दूसरे ऐप बताते हैं' },
  'tc.ln.h2b': { en: 'when to arrive.', te: 'ఎప్పుడు చేరుకోవాలో.', hi: 'कब पहुँचना है।' },
  'tc.ln.ledeA': { en: 'We tell you when to', te: 'మేము చెప్పేది ఎప్పుడు', hi: 'हम बताते हैं कब' },
  'tc.ln.leaveWord': { en: 'leave', te: 'బయలుదేరాలో', hi: 'निकलना है' },
  'tc.ln.ledeB': {
    en: '. TapCure checks the traffic on your road and your place in the doctor’s queue, adds a little waiting time, and gives you one time and one reminder.',
    te: '. TapCure మీ దారిలోని ట్రాఫిక్‌ను, డాక్టర్ క్యూలో మీ స్థానాన్ని చూసి, కొంచెం వేచి ఉండే సమయం కలిపి, మీకు ఒకే సమయం, ఒకే రిమైండర్ ఇస్తుంది.',
    hi: '। TapCure आपके रास्ते का ट्रैफ़िक और डॉक्टर की कतार में आपकी जगह देखता है, थोड़ा इंतज़ार का समय जोड़ता है, और आपको एक समय और एक रिमाइंडर देता है।',
  },
  'tc.ln.leaveHomeAt': { en: 'Leave home at', te: 'ఇంటి నుండి బయలుదేరాల్సిన సమయం', hi: 'घर से निकलें' },
  'tc.ln.shouldHaveLeft': { en: 'You should have left', te: 'మీరు బయలుదేరి ఉండాల్సింది', hi: 'आपको निकल जाना चाहिए था' },
  'tc.ln.ago': { en: 'ago', te: 'క్రితం', hi: 'पहले' },
  'tc.ln.thatIs': { en: 'Leave in', te: 'బయలుదేరడానికి ఇంకా', hi: 'निकलने में' },
  'tc.ln.fromNow': { en: '', te: '', hi: '' },
  'tc.ln.rolled': {
    en: 'That slot has gone today — showing tomorrow',
    te: 'ఆ సమయం ఈరోజు దాటిపోయింది — రేపటిది చూపుతున్నాం',
    hi: 'वह स्लॉट आज निकल गया — कल का दिखा रहे हैं',
  },
  'tc.ln.doorToChair': { en: 'min door to chair', te: 'నిమి. ఇంటి నుండి కుర్చీ వరకు', hi: 'मिनट घर से कुर्सी तक' },

  'tc.ln.drive': { en: 'Travel', te: 'ప్రయాణం', hi: 'सफ़र' },
  'tc.ln.driveH': { en: 'Travel time from live traffic', te: 'లైవ్ ట్రాఫిక్ నుండి ప్రయాణ సమయం', hi: 'लाइव ट्रैफ़िक से सफ़र का समय' },
  'tc.ln.driveP': {
    en: 'We check the traffic on your road every few minutes using Google Maps, so your leave time stays right, by car, auto or bus.',
    te: 'మీ దారిలోని ట్రాఫిక్‌ను Google Maps ద్వారా కొన్ని నిమిషాలకోసారి చూస్తాం, కాబట్టి కారు, ఆటో లేదా బస్సు ఏదైనా మీ బయలుదేరే సమయం సరిగ్గా ఉంటుంది.',
    hi: 'हम Google Maps से हर कुछ मिनट में आपके रास्ते का ट्रैफ़िक देखते हैं, ताकि कार, ऑटो या बस, किसी से भी जाएँ, निकलने का समय सही रहे।',
  },
  'tc.ln.onRoad': { en: 'on the road', te: 'దారిలో', hi: 'रास्ते में' },
  'tc.ln.jam': {
    en: 'More traffic than usual',
    te: 'సాధారణం కంటే ఎక్కువ ట్రాఫిక్',
    hi: 'सामान्य से ज़्यादा ट्रैफ़िक',
  },

  'tc.ln.arrive': { en: 'Reach the hospital', te: 'ఆసుపత్రికి చేరుకోవడం', hi: 'अस्पताल पहुँचना' },
  'tc.ln.arriveH': { en: 'How we find your leave time', te: 'మీ బయలుదేరే సమయాన్ని ఎలా లెక్కిస్తాం', hi: 'हम आपके निकलने का समय कैसे निकालते हैं' },
  'tc.ln.arriveP': {
    en: 'We start from your turn with the doctor and count back: first the waiting time, then the travel time.',
    te: 'డాక్టర్ దగ్గర మీ వంతు నుండి వెనక్కి లెక్కిస్తాం: ముందు వేచి ఉండే సమయం, తర్వాత ప్రయాణ సమయం.',
    hi: 'हम डॉक्टर के पास आपकी बारी से पीछे गिनते हैं: पहले इंतज़ार का समय, फिर सफ़र का समय।',
  },
  'tc.ln.noteA': { en: 'Why', te: 'ఎందుకు', hi: 'क्यों' },
  'tc.ln.noteB': {
    en: 'of waiting? It is the same for every hospital. Waiting a little is better than missing your turn.',
    te: 'వేచి ఉండాలి? ఇది ప్రతి ఆసుపత్రికీ ఒకటే. వంతు కోల్పోవడం కంటే కొంచెం వేచి ఉండటం మేలు.',
    hi: 'का इंतज़ार? यह हर अस्पताल के लिए एक जैसा है। बारी चूकने से थोड़ा इंतज़ार बेहतर है।',
  },

  'tc.ln.seen': { en: 'See the doctor', te: 'డాక్టర్‌ను కలవడం', hi: 'डॉक्टर से मिलना' },
  'tc.ln.seenH': { en: 'Wait about 30 minutes, not 3 hours.', te: '3 గంటలు కాదు, దాదాపు 30 నిమిషాలు వేచి ఉండండి.', hi: '3 घंटे नहीं, लगभग 30 मिनट इंतज़ार करें।' },
  'tc.ln.seenP': {
    en: 'No standing in a line from early morning. Come at your time, sit for a short while, and see the doctor.',
    te: 'తెల్లవారుజాము నుండి లైన్‌లో నిలబడాల్సిన పని లేదు. మీ సమయానికి రండి, కొంచెంసేపు కూర్చోండి, డాక్టర్‌ను కలవండి.',
    hi: 'सुबह-सुबह से लाइन में खड़े होने की ज़रूरत नहीं। अपने समय पर आइए, थोड़ी देर बैठिए, और डॉक्टर से मिलिए।',
  },

  /* travel-mode chips */
  'tc.ln.mode.car': { en: 'Own car', te: 'సొంత కారు', hi: 'अपनी कार' },
  'tc.ln.mode.cab': { en: 'Cab', te: 'క్యాబ్', hi: 'कैब' },
  'tc.ln.mode.metro': { en: 'Metro', te: 'మెట్రో', hi: 'मेट्रो' },
  'tc.ln.mode.bike': { en: 'Two-wheeler', te: 'ద్విచక్ర వాహనం', hi: 'दोपहिया' },

  /* the minute-by-minute timeline */
  'tc.ln.step.leaveHome': { en: 'Leave home', te: 'ఇంటి నుండి బయలుదేరండి', hi: 'घर से निकलें' },
  'tc.ln.step.leaveHomeSub': { en: 'We remind you 15 minutes before this.', te: 'దీనికి 15 నిమిషాల ముందు మీకు గుర్తు చేస్తాం.', hi: 'इससे 15 मिनट पहले हम आपको याद दिलाएँगे।' },
  'tc.ln.step.onRoad': { en: 'Travel', te: 'ప్రయాణం', hi: 'सफ़र' },
  'tc.ln.step.heavy': { en: 'More traffic than usual on this road today.', te: 'ఈరోజు ఈ దారిలో సాధారణం కంటే ఎక్కువ ట్రాఫిక్ ఉంది.', hi: 'आज इस रास्ते पर सामान्य से ज़्यादा ट्रैफ़िक है।' },
  'tc.ln.step.clear': { en: 'The road looks clear today.', te: 'ఈరోజు దారి సాఫీగా ఉంది.', hi: 'आज रास्ता साफ़ है।' },
  'tc.ln.step.atHospital': { en: 'Wait at the hospital', te: 'ఆసుపత్రిలో వేచి ఉండటం', hi: 'अस्पताल में इंतज़ार' },
  'tc.ln.step.waiting': { en: 'A little extra time, so you never miss your turn.', te: 'మీ వంతు తప్పిపోకుండా కొంచెం అదనపు సమయం.', hi: 'थोड़ा अतिरिक्त समय, ताकि आपकी बारी न छूटे।' },
  'tc.ln.step.cushion': { en: 'min', te: 'నిమి', hi: 'मिनट' },
  'tc.ln.step.called': { en: 'Your turn with the doctor', te: 'డాక్టర్ దగ్గర మీ వంతు', hi: 'डॉक्टर के पास आपकी बारी' },
  'tc.ln.step.calledSub': { en: 'Your token number is called.', te: 'మీ టోకెన్ నంబర్ పిలుస్తారు.', hi: 'आपका टोकन नंबर बुलाया जाता है।' },

  /* the four feature cards below the line */
  'tc.ln.feat1.t': { en: 'Live traffic', te: 'లైవ్ ట్రాఫిక్', hi: 'लाइव ट्रैफ़िक' },
  'tc.ln.feat1.d': {
    en: 'Checked until you leave.',
    te: 'మీరు బయలుదేరే వరకు చూస్తూనే ఉంటాం.',
    hi: 'आपके निकलने तक देखते रहते हैं।',
  },
  'tc.ln.feat2.t': { en: 'Your place in line', te: 'లైన్‌లో మీ స్థానం', hi: 'लाइन में आपकी जगह' },
  'tc.ln.feat2.d': {
    en: 'Moves if the doctor is late.',
    te: 'డాక్టర్ ఆలస్యమైతే అది కూడా మారుతుంది.',
    hi: 'डॉक्टर को देर हो तो यह भी बदल जाता है।',
  },
  'tc.ln.feat3.t': { en: 'One reminder', te: 'ఒకే రిమైండర్', hi: 'एक रिमाइंडर' },
  'tc.ln.feat3.d': {
    en: '15 min before you go.',
    te: 'మీరు బయలుదేరడానికి 15 నిమిషాల ముందు.',
    hi: 'निकलने से 15 मिनट पहले।',
  },
  'tc.ln.feat4.t': { en: 'Family gets it too', te: 'కుటుంబానికీ తెలుస్తుంది', hi: 'परिवार को भी पता चलता है' },
  'tc.ln.feat4.d': {
    en: 'The person bringing them is told.',
    te: 'వారిని తీసుకెళ్లే వ్యక్తికి కూడా చెబుతాం.',
    hi: 'उन्हें ले जाने वाले व्यक्ति को भी बताया जाता है।',
  },
  'tc.ln.map.home': { en: 'Home', te: 'ఇల్లు', hi: 'घर' },

  /* 2026-11-08: plainer clock line, the appointment card and the timeline spans */
  'tc.ln.hrMin': { en: '{h} hr {m} min', te: '{h} గం {m} నిమి', hi: '{h} घं {m} मिनट' },
  'tc.ln.travelChip': { en: '{n} min travel', te: '{n} నిమి ప్రయాణం', hi: '{n} मिनट सफ़र' },
  'tc.ln.waitChip': { en: '{n} min wait', te: '{n} నిమి వేచి ఉండటం', hi: '{n} मिनट इंतज़ार' },
  'tc.ln.yourAppt': { en: 'Your appointment', te: 'మీ అపాయింట్‌మెంట్', hi: 'आपका अपॉइंटमेंट' },
  'tc.ln.token': { en: 'Token', te: 'టోకెన్', hi: 'टोकन' },
  'tc.ln.yourTurn': { en: 'Your turn', te: 'మీ వంతు', hi: 'आपकी बारी' },
  'tc.ln.before': { en: 'Before you', te: 'మీ ముందు', hi: 'आपसे पहले' },
  'tc.ln.people': { en: '{n} people', te: '{n} మంది', hi: '{n} लोग' },
  'tc.ln.to': { en: 'to {time}', te: '{time} వరకు', hi: '{time} तक' },
  /* cards beside the leave-time stops */
  'tc.ln.sumK': { en: 'From home to the doctor', te: 'ఇంటి నుండి డాక్టర్ వరకు', hi: 'घर से डॉक्टर तक' },
  'tc.ln.cmpK': { en: 'Waiting at the hospital', te: 'ఆసుపత్రిలో వేచి ఉండటం', hi: 'अस्पताल में इंतज़ार' },
  'tc.ln.cmpWithout': { en: 'Without TapCure', te: 'TapCure లేకుండా', hi: 'TapCure के बिना' },
  'tc.ln.cmpWith': { en: 'With TapCure', te: 'TapCure తో', hi: 'TapCure के साथ' },
  'tc.ln.cmpHours': { en: 'about {n} hours', te: 'దాదాపు {n} గంటలు', hi: 'लगभग {n} घंटे' },
}
