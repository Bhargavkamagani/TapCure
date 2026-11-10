/**
 * Landing page — hospital plans (the pricing cards in the closing section).
 *
 * Prices and limits mirror the backend plan catalog
 * (tapcure_backend app/services/booking_quota.py CATALOG). Change them there
 * first, then here — the page must never promise what billing doesn't charge.
 * Prices and numbers stay in Latin script, as on the rest of the landing page.
 */
export const tcPricingT = {
  'tc.price.h3a': { en: 'Simple plans.', te: 'సరళమైన ప్లాన్‌లు.', hi: 'आसान प्लान।' },
  'tc.price.h3b': { en: 'Start free for 30 days.', te: '30 రోజులు ఉచితంగా ప్రారంభించండి.', hi: '30 दिन मुफ़्त शुरू कीजिए।' },
  'tc.price.lede': {
    en: 'Walk-ins are always free and unlimited. You only pay for the online bookings your plan covers — and the bill never goes above its limit.',
    te: 'వాక్-ఇన్‌లు ఎప్పుడూ ఉచితం, అపరిమితం. మీ ప్లాన్‌లోని ఆన్‌లైన్ బుకింగ్‌లకే మీరు చెల్లిస్తారు — బిల్లు దాని పరిమితిని ఎప్పుడూ దాటదు.',
    hi: 'वॉक-इन हमेशा मुफ़्त और असीमित हैं। आप सिर्फ़ अपने प्लान की ऑनलाइन बुकिंग के लिए भुगतान करते हैं — और बिल उसकी सीमा से ऊपर कभी नहीं जाता।',
  },
  'tc.price.monthly': { en: 'Monthly', te: 'నెలవారీ', hi: 'मासिक' },
  'tc.price.yearly': { en: 'Yearly', te: 'సంవత్సరానికి', hi: 'सालाना' },
  'tc.price.twoFree': { en: '2 months free', te: '2 నెలలు ఉచితం', hi: '2 महीने मुफ़्त' },
  'tc.price.perMonth': { en: '/ month', te: '/ నెల', hi: '/ महीना' },
  'tc.price.perYear': { en: '/ year', te: '/ సంవత్సరం', hi: '/ साल' },
  'tc.price.plusGst': { en: '+ GST', te: '+ GST', hi: '+ GST' },
  'tc.price.popular': { en: 'Most popular', te: 'ఎక్కువ మంది ఎంచుకునేది', hi: 'सबसे लोकप्रिय' },
  'tc.price.choose': { en: 'Get Started', te: 'ప్రారంభించండి', hi: 'शुरू करें' },
  'tc.price.more': { en: 'See details', te: 'వివరాలు చూడండి', hi: 'विवरण देखें' },
  'tc.price.less': { en: 'Hide details', te: 'వివరాలు దాచండి', hi: 'विवरण छिपाएँ' },

  'tc.price.pilot.name': { en: 'Free Trial', te: 'ఉచిత ట్రయల్', hi: 'फ़्री ट्रायल' },
  'tc.price.pilot.price': { en: 'Free', te: 'ఉచితం', hi: 'मुफ़्त' },
  'tc.price.pilot.term': { en: 'for 30 days', te: '30 రోజుల పాటు', hi: '30 दिन के लिए' },
  'tc.price.pilot.tag': {
    en: 'Starts on your first OPD day.',
    te: 'మీ మొదటి OPD రోజున ప్రారంభం.',
    hi: 'आपके पहले OPD दिन से शुरू।',
  },
  'tc.price.pilot.cta': { en: 'Start Free Trial', te: 'ఉచిత ట్రయల్ ప్రారంభించండి', hi: 'फ़्री ट्रायल शुरू करें' },
  'tc.price.starter.name': { en: 'Starter', te: 'స్టార్టర్', hi: 'स्टार्टर' },
  'tc.price.starter.tag': { en: 'For a small clinic with 1 doctor.', te: '1 డాక్టర్ ఉన్న చిన్న క్లినిక్ కోసం.', hi: '1 डॉक्टर वाले छोटे क्लिनिक के लिए।' },
  'tc.price.smart.name': { en: 'Smart Hospital', te: 'స్మార్ట్ ఆసుపత్రి', hi: 'स्मार्ट अस्पताल' },
  // Previous: 'For a busy single-doctor hospital.' (Smart was 1 doctor until 2026-11-03)
  'tc.price.smart.tag': { en: 'For a small hospital with 2 doctors.', te: 'ఇద్దరు డాక్టర్లు ఉన్న చిన్న ఆసుపత్రి కోసం.', hi: '2 डॉक्टरों वाले छोटे अस्पताल के लिए।' },
  'tc.price.pro.name': { en: 'Pro', te: 'ప్రో', hi: 'प्रो' },
  'tc.price.pro.tag': { en: 'For hospitals with a team of doctors.', te: 'డాక్టర్ల బృందం ఉన్న ఆసుపత్రుల కోసం.', hi: 'डॉक्टरों की टीम वाले अस्पताल के लिए।' },

  /* the four number tiles on each card */
  'tc.price.t.doctors': { en: 'Doctors', te: 'డాక్టర్లు', hi: 'डॉक्टर' },
  'tc.price.t.bookings': { en: 'Bookings / month', te: 'బుకింగ్‌లు / నెల', hi: 'बुकिंग / महीना' },
  'tc.price.t.extra': { en: 'Per extra booking', te: 'ప్రతి అదనపు బుకింగ్', hi: 'हर अतिरिक्त बुकिंग' },
  'tc.price.t.cap': { en: 'Max bill / month', te: 'గరిష్ఠ బిల్లు / నెల', hi: 'अधिकतम बिल / महीना' },

  /* the short highlights under the tiles — only what sets a plan apart */
  'tc.price.h.every': { en: 'Every feature unlocked', te: 'అన్ని ఫీచర్లు అందుబాటులో', hi: 'हर सुविधा उपलब्ध' },
  'tc.price.h.noPay': { en: 'No payment to start', te: 'ప్రారంభించడానికి చెల్లింపు అవసరం లేదు', hi: 'शुरू करने के लिए कोई भुगतान नहीं' },
  'tc.price.h.core': { en: 'All core features', te: 'అన్ని ముఖ్య ఫీచర్లు', hi: 'सभी मुख्य सुविधाएँ' },
  'tc.price.h.freeRevisit': { en: "Free revisits don't use your bookings", te: 'ఉచిత రీవిజిట్‌లు మీ బుకింగ్‌లలో లెక్కించబడవు', hi: 'मुफ़्त दोबारा विज़िट आपकी बुकिंग में नहीं गिनी जातीं' },
  'tc.price.h.upgrade': { en: 'Upgrade anytime', te: 'ఎప్పుడైనా అప్‌గ్రేడ్ చేయండి', hi: 'कभी भी अपग्रेड करें' },
  'tc.price.h.whatsapp': { en: 'WhatsApp queue alerts', te: 'WhatsApp క్యూ అలర్ట్‌లు', hi: 'WhatsApp कतार अलर्ट' },
  'tc.price.h.noWhatsapp': { en: 'WhatsApp alerts from Smart Hospital', te: 'WhatsApp అలర్ట్‌లు స్మార్ట్ ఆసుపత్రి నుండి', hi: 'WhatsApp अलर्ट स्मार्ट अस्पताल से' },
  // Shown as X's for now (2026-10-27). Previous: ₹599/mo each.
  'tc.price.h.addDoc': { en: 'Add doctors at ₹599/mo each', te: 'ఒక్కో డాక్టర్‌కు ₹599/నెల', hi: 'हर डॉक्टर ₹599/माह पर जोड़ें' },

  /* the small "Also included" list at the bottom of each card */
  'tc.price.allTitle': { en: 'Also included', te: 'ఇవి కూడా ఉన్నాయి', hi: 'यह भी शामिल' },
  'tc.price.r.walkins': { en: 'Free, unlimited walk-ins', te: 'ఉచిత, అపరిమిత వాక్-ఇన్‌లు', hi: 'मुफ़्त, असीमित वॉक-इन' },
  'tc.price.r.queue': { en: 'Live token queue', te: 'లైవ్ టోకెన్ క్యూ', hi: 'लाइव टोकन कतार' },
  'tc.price.r.leave': { en: 'Leave-Now timing for patients', te: 'రోగులకు Leave-Now సమయం', hi: 'मरीज़ों के लिए Leave-Now टाइमिंग' },
  'tc.price.r.rx': { en: 'Digital prescriptions', te: 'డిజిటల్ ప్రిస్క్రిప్షన్‌లు', hi: 'डिजिटल प्रिस्क्रिप्शन' },
  'tc.price.r.pharmacy': { en: 'Pharmacy counter', te: 'ఫార్మసీ కౌంటర్', hi: 'फ़ार्मेसी काउंटर' },
  'tc.price.r.reports': { en: 'Reports & revenue', te: 'రిపోర్ట్‌లు & ఆదాయం', hi: 'रिपोर्ट और आमदनी' },
  'tc.price.r.billing': { en: 'UPI Autopay & GST invoices', te: 'UPI ఆటోపే & GST ఇన్‌వాయిస్‌లు', hi: 'UPI ऑटोपे और GST इनवॉइस' },
  'tc.price.v.unlimited': { en: 'Unlimited', te: 'అపరిమితం', hi: 'असीमित' },
  'tc.price.v.upTo3': { en: 'Up to 3', te: '3 వరకు', hi: '3 तक' },
  'tc.price.v.mo': { en: '/mo', te: '/నెల', hi: '/माह' },
  'tc.price.v.included': { en: 'Included', te: 'ఉంది', hi: 'शामिल' },
  'tc.price.v.notIncluded': { en: 'Not included', te: 'లేదు', hi: 'शामिल नहीं' },

  'tc.price.hosp.name': { en: 'Hospital', te: 'హాస్పిటల్', hi: 'हॉस्पिटल' },
  // Previous: 'tc.price.hosp.price': { en: 'from ₹4,999 / month', te: '₹4,999 / నెల నుండి', hi: '₹4,999 / महीना से' },
  'tc.price.hosp.price': { en: 'from ₹4,999 / month', te: '₹4,999 / నెల నుండి', hi: '₹4,999 / महीना से' },
  'tc.price.hosp.body': {
    en: 'Unlimited doctors and bookings, every department, set up with you by our team.',
    te: 'అపరిమిత డాక్టర్లు, బుకింగ్‌లు, అన్ని విభాగాలు — మా బృందం మీతో కలిసి సెటప్ చేస్తుంది.',
    hi: 'असीमित डॉक्टर और बुकिंग, हर विभाग — हमारी टीम आपके साथ सेटअप करती है।',
  },
  'tc.price.hosp.cta': { en: 'Talk to Us', te: 'మాతో మాట్లాడండి', hi: 'हमसे बात करें' },

  'tc.price.fine': {
    en: 'Prices exclude 18% GST. Pick or change your plan anytime from your hospital dashboard. We protect your data: see our Privacy Policy.',
    te: 'ధరలకు 18% GST అదనం. మీ హాస్పిటల్ డాష్‌బోర్డ్ నుండి ఎప్పుడైనా ప్లాన్ ఎంచుకోండి లేదా మార్చండి. మేము మీ డేటాను కాపాడతాం: మా గోప్యతా విధానం చూడండి.',
    hi: 'कीमतों में 18% GST अलग से। अपने हॉस्पिटल डैशबोर्ड से कभी भी प्लान चुनें या बदलें। हम आपके डेटा की सुरक्षा करते हैं: हमारी प्राइवेसी पॉलिसी देखें।',
  },
  /* 2026-11-08: who the plans are for, and that patients never pay to book */
  'tc.price.forHosp': { en: 'For hospitals and clinics', te: 'ఆసుపత్రులు మరియు క్లినిక్‌ల కోసం', hi: 'अस्पतालों और क्लिनिकों के लिए' },
  'tc.price.patientsFree': { en: 'For patients, booking is always free.', te: 'రోగులకు బుకింగ్ ఎప్పుడూ ఉచితం.', hi: 'मरीज़ों के लिए बुकिंग हमेशा मुफ़्त है।' },
}
