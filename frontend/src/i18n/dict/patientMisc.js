/**
 * The last English strings on the patient-facing screens.
 *
 * These were written straight into JSX rather than through `t()`, so switching
 * the app to Telugu or Hindi left them in English — scattered through the very
 * screens a patient uses most: their token, their prescriptions, their vitals.
 *
 * Kept as their own file rather than folded into dashboard.js because this is a
 * clean-up sweep, not a feature: it should stay obvious what was retro-fitted.
 */
export const patientMiscT = {
  // ---- Appointments ----
  'pm.openInMaps': { en: 'Open in Google Maps', te: 'గూగుల్ మ్యాప్స్‌లో తెరవండి', hi: 'गूगल मैप्स में खोलें' },

  // ---- Booking confirmation / token ----
  'pm.allocatingToken': { en: 'Allocating your token', te: 'మీ టోకెన్ కేటాయిస్తున్నాం', hi: 'आपका टोकन आवंटित हो रहा है' },
  'pm.securingAppt': { en: 'Securing your appointment', te: 'మీ అపాయింట్‌మెంట్ ఖాయం చేస్తున్నాం', hi: 'आपकी अपॉइंटमेंट सुरक्षित की जा रही है' },
  'pm.bookingConfirmed': { en: 'Booking confirmed', te: 'బుకింగ్ ధృవీకరించబడింది', hi: 'बुकिंग की पुष्टि हुई' },
  'pm.tokenBooked': { en: 'Your token is booked!', te: 'మీ టోకెన్ బుక్ అయ్యింది!', hi: 'आपका टोकन बुक हो गया!' },
  'pm.yourToken': { en: 'Your Token', te: 'మీ టోకెన్', hi: 'आपका टोकन' },
  'pm.peopleAhead': { en: 'People ahead', te: 'మీ ముందు ఉన్నవారు', hi: 'आपसे आगे लोग' },
  'pm.estWaitShort': { en: 'Est. wait', te: 'అంచనా నిరీక్షణ', hi: 'अनुमानित प्रतीक्षा' },
  'pm.noApptTime': { en: 'No appointment time needed', te: 'అపాయింట్‌మెంట్ సమయం అవసరం లేదు', hi: 'अपॉइंटमेंट समय की ज़रूरत नहीं' },
  'pm.bookAnother': { en: 'Book another', te: 'మరొకటి బుక్ చేయండి', hi: 'एक और बुक करें' },
  'pm.viewMyAppts': { en: 'View my appointments', te: 'నా అపాయింట్‌మెంట్లు చూడండి', hi: 'मेरी अपॉइंटमेंट देखें' },
  'pm.availableOtherPractice': { en: 'Available at another practice on the same day:', te: 'అదే రోజు మరో ప్రాక్టీస్‌లో అందుబాటులో:', hi: 'उसी दिन दूसरे प्रैक्टिस में उपलब्ध:' },

  // ---- Distance filters (Doctors / Hospitals) ----
  'pm.within': { en: 'Within', te: 'లోపల', hi: 'के भीतर' },
  'pm.anyDistance': { en: 'Any distance', te: 'ఏ దూరమైనా', hi: 'कोई भी दूरी' },
  'pm.sortedByNearest': { en: 'Sorted by nearest', te: 'దగ్గరి వాటి ప్రకారం', hi: 'निकटतम के अनुसार' },
  'pm.clearLocation': { en: 'Clear location', te: 'స్థానాన్ని తొలగించండి', hi: 'स्थान हटाएँ' },
  'pm.clearSearch': { en: 'Clear search', te: 'శోధనను తొలగించండి', hi: 'खोज हटाएँ' },
  'pm.clearSpecialty': { en: 'Clear specialty', te: 'స్పెషాలిటీని తొలగించండి', hi: 'विशेषज्ञता हटाएँ' },
  'pm.clear': { en: 'Clear', te: 'తొలగించు', hi: 'हटाएँ' },
  'pm.close': { en: 'Close', te: 'మూసివేయి', hi: 'बंद करें' },
  'pm.liveTraffic': { en: 'Live traffic', te: 'ప్రత్యక్ష ట్రాఫిక్', hi: 'लाइव ट्रैफ़िक' },
  'pm.notifications': { en: 'Notifications', te: 'నోటిఫికేషన్లు', hi: 'सूचनाएँ' },
  'pm.toggleMenu': { en: 'Toggle menu', te: 'మెనూ మార్చండి', hi: 'मेन्यू टॉगल करें' },

  // ---- Common ----
  'pm.loading': { en: 'Loading…', te: 'లోడ్ అవుతోంది…', hi: 'लोड हो रहा है…' },
  'pm.view': { en: 'View', te: 'చూడండి', hi: 'देखें' },
  'pm.open': { en: 'Open', te: 'తెరవండి', hi: 'खोलें' },

  // ---- Records / prescriptions ----
  'pm.latestVitals': { en: 'Latest Vitals', te: 'తాజా వైటల్స్', hi: 'नवीनतम वाइटल्स' },
  'pm.noPayments': { en: 'No payments yet.', te: 'ఇంకా చెల్లింపులు లేవు.', hi: 'अभी तक कोई भुगतान नहीं।' },
  'pm.diagnosis': { en: 'Diagnosis', te: 'నిర్ధారణ', hi: 'निदान' },
  'pm.medicines': { en: 'Medicines', te: 'మందులు', hi: 'दवाइयाँ' },
  'pm.advice': { en: 'Advice', te: 'సలహా', hi: 'सलाह' },
  'pm.noMedicines': { en: 'No medicines listed.', te: 'మందులు ఏవీ ఇవ్వలేదు.', hi: 'कोई दवा सूचीबद्ध नहीं।' },

  // ---- Medicine reminders ----
  'pm.medicineReminders': { en: 'Medicine Reminders', te: 'మందుల రిమైండర్లు', hi: 'दवा रिमाइंडर' },
  'pm.gotMedicines': { en: 'Got your medicines?', te: 'మీ మందులు తీసుకున్నారా?', hi: 'क्या आपने दवाइयाँ ले लीं?' },
  'pm.nudgeEachDose': { en: "We'll nudge you at each dose time.", te: 'ప్రతి డోస్ సమయంలో మేము గుర్తు చేస్తాం.', hi: 'हर खुराक के समय हम याद दिलाएँगे।' },
  'pm.stop': { en: 'Stop', te: 'ఆపండి', hi: 'रोकें' },
  'pm.stopReminders': { en: 'Stop reminders for this medicine', te: 'ఈ మందుకు రిమైండర్లు ఆపండి', hi: 'इस दवा के रिमाइंडर बंद करें' },
  // Dose-time popup. Only fires while TapCure is open in a tab.
  'pm.doseDueTitle': { en: 'Time for your medicine', te: 'మీ మందు వేసుకునే సమయం', hi: 'आपकी दवा का समय' },
  'pm.taken': { en: 'Taken', te: 'తీసుకున్నాను', hi: 'ले ली' },
  'pm.snooze': { en: 'Snooze 10 min', te: '10 నిమిషాలు వాయిదా', hi: '10 मिनट बाद' },
  // Asked once, as a popup, when a doctor's prescription arrives.
  'pm.setRemindersQ': { en: 'Set reminders for this prescription?', te: 'ఈ ప్రిస్క్రిప్షన్‌కు రిమైండర్లు పెట్టాలా?', hi: 'क्या इस पर्चे के लिए रिमाइंडर लगाएँ?' },
  'pm.newRxSub': { en: 'Your doctor has prescribed:', te: 'మీ డాక్టర్ రాసినవి:', hi: 'आपके डॉक्टर ने लिखा है:' },
  'pm.yesRemindMe': { en: 'Yes, remind me', te: 'అవును, గుర్తు చేయండి', hi: 'हाँ, याद दिलाएँ' },
  'pm.notNow': { en: 'Not now', te: 'ఇప్పుడు వద్దు', hi: 'अभी नहीं' },
  'pm.forPerson': { en: 'For {name}', te: '{name} కోసం', hi: '{name} के लिए' },
  // Prescriptions tab — start reminders straight from a doctor's prescription.
  'pm.startNewReminders': { en: 'Start reminders ({n} new)', te: 'రిమైండర్లు ప్రారంభించండి ({n} కొత్తవి)', hi: 'रिमाइंडर शुरू करें ({n} नई)' },
  'pm.notStartedYet': { en: 'Not started yet', te: 'ఇంకా ప్రారంభించలేదు', hi: 'अभी शुरू नहीं हुई' },
  'pm.setReminders': { en: 'Set reminders', te: 'రిమైండర్లు పెట్టండి', hi: 'रिमाइंडर लगाएँ' },
  'pm.remindersOn': { en: 'Reminders on', te: 'రిమైండర్లు ఆన్', hi: 'रिमाइंडर चालू' },
  'pm.stopRxTitle': { en: 'Stop reminders for this prescription?', te: 'ఈ ప్రిస్క్రిప్షన్‌కు రిమైండర్లు ఆపాలా?', hi: 'क्या इस पर्चे के रिमाइंडर बंद करें?' },
  'pm.stopRxBody': {
    en: "You won't be nudged for the remaining doses. You can start again any time.",
    te: 'మిగిలిన డోస్‌లకు గుర్తు చేయబడదు. మీరు ఎప్పుడైనా మళ్లీ ప్రారంభించవచ్చు.',
    hi: 'बाकी खुराकों के लिए याद नहीं दिलाया जाएगा। आप कभी भी दोबारा शुरू कर सकते हैं।',
  },
  'pm.noRemindersYet': { en: 'No prescriptions with reminders yet.', te: 'ఇంకా రిమైండర్లతో ప్రిస్క్రిప్షన్లు లేవు.', hi: 'अभी रिमाइंडर वाले पर्चे नहीं हैं।' },
  // Patient-chosen dose times, instead of the fixed 9am / 2pm / 9pm defaults.
  'pm.changeTimes': { en: 'Change times', te: 'సమయాలు మార్చండి', hi: 'समय बदलें' },
  // Misspelt email domain (gmial.com). {d} is the corrected domain.
  'pm.emailTypo': {
    en: 'Did you mean {d}? Please check the spelling.',
    te: 'మీరు {d} అని అనుకున్నారా? స్పెల్లింగ్ సరిచూడండి.',
    hi: 'क्या आपका मतलब {d} था? वर्तनी जाँच लें।',
  },
  // ---- Today's Medicines card ----
  'pm.todayTitle': { en: "Today's Medicines", te: 'ఈ రోజు మందులు', hi: 'आज की दवाइयाँ' },
  'pm.todaySub': { en: "Here's your medicine plan for today.", te: 'ఈ రోజు మీ మందుల ప్లాన్ ఇది.', hi: 'आज के लिए आपकी दवा योजना।' },
  'pm.moreToday': { en: '+{n} more today', te: 'ఈ రోజు మరో {n}', hi: 'आज {n} और' },
  'pm.viewAll': { en: 'View all', te: 'అన్నీ చూడండి', hi: 'सभी देखें' },
  'pm.takenCount': { en: '{n} / {total} taken', te: '{total} లో {n} తీసుకున్నారు', hi: '{total} में से {n} ली' },
  'pm.takeNow': { en: 'Take Now', te: 'ఇప్పుడు తీసుకోండి', hi: 'अभी लें' },
  'pm.upcoming': { en: 'Upcoming', te: 'రాబోయేది', hi: 'आगामी' },
  'pm.takenAt': { en: 'at {time}', te: '{time} కు', hi: '{time} पर' },
  'pm.noDosesToday': { en: 'No medicines scheduled for today.', te: 'ఈ రోజు మందులేవీ లేవు.', hi: 'आज कोई दवा निर्धारित नहीं है।' },
  'pm.consistencyTitle': { en: 'Consistency today for a healthier you!', te: 'ఆరోగ్యంగా ఉండటానికి క్రమం తప్పకుండా!', hi: 'बेहतर सेहत के लिए नियमितता!' },
  'pm.consistencyBody': {
    en: 'Taking your medicines on time helps you stay your best.',
    te: 'సమయానికి మందులు వేసుకోవడం మీ ఆరోగ్యానికి మేలు చేస్తుంది.',
    hi: 'समय पर दवा लेना आपको बेहतर रखने में मदद करता है।',
  },
  'pm.timesHint': {
    en: 'Applies from your next dose — doses already sent stay as they were.',
    te: 'మీ తదుపరి డోస్ నుండి వర్తిస్తుంది — ఇప్పటికే పంపినవి అలాగే ఉంటాయి.',
    hi: 'आपकी अगली खुराक से लागू — जो पहले भेजी जा चुकी हैं वे वैसी ही रहेंगी।',
  },
  'pm.save': { en: 'Save', te: 'సేవ్ చేయండి', hi: 'सेव करें' },
  'pm.cancel': { en: 'Cancel', te: 'రద్దు చేయండి', hi: 'रद्द करें' },

  // ---- Free revisit pass ----
  'rvp.title': { en: 'Free revisit available', te: 'ఉచిత మళ్లీ సందర్శన అందుబాటులో', hi: 'मुफ़्त दोबारा विज़िट उपलब्ध' },
  'rvp.line': { en: 'See {doctor} again at no charge until {date}.', te: '{date} వరకు {doctor} ను ఉచితంగా మళ్లీ కలవవచ్చు.', hi: '{date} तक {doctor} से दोबारा मुफ़्त मिल सकते हैं।' },
  'rvp.walkIn': { en: 'Just walk in — no booking needed.', te: 'నేరుగా వెళ్లండి — బుకింగ్ అవసరం లేదు.', hi: 'सीधे जाएँ — बुकिंग की ज़रूरत नहीं।' },
  'rvp.daysLeft': { en: '{n} days left', te: 'ఇంకా {n} రోజులు', hi: '{n} दिन बाकी' },
  'rvp.lastDay': { en: 'Last day today', te: 'ఈరోజే చివరి రోజు', hi: 'आज आख़िरी दिन' },
  'rvp.badge': { en: 'Free revisit', te: 'ఉచిత మళ్లీ సందర్శన', hi: 'मुफ़्त दोबारा विज़िट' },
  'rvp.badgeUntil': { en: 'Free revisit with this doctor until {date}', te: 'ఈ డాక్టర్‌తో {date} వరకు ఉచిత మళ్లీ సందర్శన', hi: 'इस डॉक्टर के साथ {date} तक मुफ़्त दोबारा विज़िट' },
  'rvp.redeem': { en: 'Use free revisit', te: 'ఉచిత సందర్శన వాడండి', hi: 'मुफ़्त विज़िट इस्तेमाल करें' },
  'rvp.redeemed': { en: 'Free revisit used · token {token}', te: 'ఉచిత సందర్శన వాడారు · టోకెన్ {token}', hi: 'मुफ़्त विज़िट इस्तेमाल हुई · टोकन {token}' },
  'rvp.redeemFailed': { en: 'Could not use the free revisit', te: 'ఉచిత సందర్శన వాడలేకపోయాం', hi: 'मुफ़्त विज़िट इस्तेमाल नहीं हो सकी' },
  'rvp.redeeming': { en: 'Issuing token…', te: 'టోకెన్ ఇస్తున్నాం…', hi: 'टोकन जारी हो रहा है…' },
  'rvp.for': { en: 'For {name}', te: '{name} కోసం', hi: '{name} के लिए' },
  'rvp.summary': { en: '₹0 · Free revisit (until {date})', te: '₹0 · ఉచిత మళ్లీ సందర్శన ({date} వరకు)', hi: '₹0 · मुफ़्त दोबारा दिखाना ({date} तक)' },
  'rvp.applied': { en: 'Free revisit applied · no consultation fee', te: 'ఉచిత మళ్లీ సందర్శన వర్తించింది · కన్సల్టేషన్ ఫీజు లేదు', hi: 'मुफ़्त दोबारा दिखाना लागू · कोई परामर्श शुल्क नहीं' },
  'rvp.noCharge': { en: 'No consultation fee', te: 'కన్సల్టేషన్ ఫీజు లేదు', hi: 'कोई परामर्श शुल्क नहीं' },

  // ---- Patient history drawer ----
  'pm.patientRecord': { en: 'Patient Record', te: 'రోగి రికార్డు', hi: 'मरीज़ रिकॉर्ड' },
  'pm.tabOverview': { en: 'Overview', te: 'ముఖ్యాంశాలు', hi: 'अवलोकन' },
  'pm.tabClinical': { en: 'Clinical', te: 'వైద్య వివరాలు', hi: 'क्लिनिकल' },
  'pm.tabVisits': { en: 'Visits', te: 'సందర్శనలు', hi: 'विज़िट' },
  'pm.allergyAlert': { en: 'Allergy alert', te: 'అలెర్జీ హెచ్చరిక', hi: 'एलर्जी चेतावनी' },
  'pm.noAllergies': { en: 'No known allergies', te: 'తెలిసిన అలెర్జీలు లేవు', hi: 'कोई ज्ञात एलर्जी नहीं' },
  'pm.contactDetails': { en: 'Contact & Address', te: 'సంప్రదింపు & చిరునామా', hi: 'संपर्क और पता' },
  'pm.mobile': { en: 'Mobile', te: 'మొబైల్', hi: 'मोबाइल' },
  'pm.ageGender': { en: 'Age / Gender', te: 'వయసు / లింగం', hi: 'उम्र / लिंग' },
  'pm.bloodGroup': { en: 'Blood Group', te: 'రక్త వర్గం', hi: 'ब्लड ग्रुप' },
  'pm.city': { en: 'City', te: 'నగరం', hi: 'शहर' },
  'pm.address': { en: 'Address', te: 'చిరునామా', hi: 'पता' },
  'pm.visitsCount': { en: '{n} visits', te: '{n} సందర్శనలు', hi: '{n} विज़िट' },
  'pm.recScopeDoctor': { en: 'Only records from your own visits, plus anything the patient uploaded themselves.', te: 'మీ సొంత సందర్శనల రికార్డులు మాత్రమే, పాటు రోగి స్వయంగా అప్‌లోడ్ చేసినవి.', hi: 'केवल आपकी अपनी विज़िट के रिकॉर्ड, साथ में मरीज़ के खुद अपलोड किए हुए।' },
  'pm.recScopeHospital': { en: 'Only records from this hospital, plus anything the patient uploaded themselves.', te: 'ఈ ఆసుపత్రి రికార్డులు మాత్రమే, పాటు రోగి స్వయంగా అప్‌లోడ్ చేసినవి.', hi: 'केवल इस अस्पताल के रिकॉर्ड, साथ में मरीज़ के खुद अपलोड किए हुए।' },
  'pm.visitsScopeDoctor': { en: 'Showing only visits with you. Visits to other doctors or hospitals are not shown.', te: 'మీతో జరిగిన సందర్శనలు మాత్రమే. ఇతర డాక్టర్లు లేదా ఆసుపత్రుల సందర్శనలు కనిపించవు.', hi: 'केवल आपके साथ हुई विज़िट दिख रही हैं। अन्य डॉक्टर या अस्पताल की विज़िट नहीं दिखतीं।' },
  'pm.visitsScopeHospital': { en: 'Showing only visits at this hospital. Visits elsewhere are not shown.', te: 'ఈ ఆసుపత్రులో జరిగిన సందర్శనలు మాత్రమే. ఇతర చోట్ల సందర్శనలు కనిపించవు.', hi: 'केवल इस अस्पताल की विज़िट दिख रही हैं। अन्य जगह की विज़िट नहीं दिखतीं।' },
  'pm.patientHistory': { en: 'Patient History', te: 'రోగి చరిత్ర', hi: 'मरीज़ का इतिहास' },
  'pm.uniqueHealthId': { en: 'Unique Health ID', te: 'ప్రత్యేక ఆరోగ్య ఐడీ', hi: 'यूनिक हेल्थ आईडी' },
  'pm.copyUhid': { en: 'Copy UHID', te: 'UHID కాపీ చేయండి', hi: 'UHID कॉपी करें' },
  'pm.printCard': { en: 'Print card', te: 'కార్డు ప్రింట్ చేయండి', hi: 'कार्ड प्रिंट करें' },
  'pm.chronic': { en: 'Chronic', te: 'దీర్ఘకాలిక', hi: 'दीर्घकालिक' },
  'pm.allergies': { en: 'Allergies', te: 'అలెర్జీలు', hi: 'एलर्जी' },
  'pm.medicalHistory': { en: 'Medical History', te: 'వైద్య చరిత్ర', hi: 'चिकित्सा इतिहास' },
  'pm.documents': { en: 'Documents', te: 'పత్రాలు', hi: 'दस्तावेज़' },
  'pm.visitHistory': { en: 'Visit History', te: 'సందర్శన చరిత్ర', hi: 'विज़िट इतिहास' },
  'pm.vitalsMeasurements': { en: 'Vitals & Measurements', te: 'వైటల్స్ & కొలతలు', hi: 'वाइटल्स और माप' },
  'pm.allergenPh': { en: 'Allergen (e.g. Penicillin)', te: 'అలెర్జీ కారకం (ఉదా. పెన్సిలిన్)', hi: 'एलर्जन (जैसे पेनिसिलिन)' },
  'pm.reactionPh': { en: 'Reaction (optional)', te: 'ప్రతిస్పందన (ఐచ్ఛికం)', hi: 'प्रतिक्रिया (वैकल्पिक)' },
  'pm.conditionPh': { en: 'Condition (e.g. Type 2 Diabetes)', te: 'వ్యాధి (ఉదా. టైప్ 2 మధుమేహం)', hi: 'स्थिति (जैसे टाइप 2 मधुमेह)' },
  'pm.notesOptional': { en: 'Notes (optional)', te: 'గమనికలు (ఐచ్ఛికం)', hi: 'नोट्स (वैकल्पिक)' },

  // ---- Vitals ----
  'pm.recordVitals': { en: 'Record Vitals', te: 'వైటల్స్ నమోదు చేయండి', hi: 'वाइटल्स दर्ज करें' },
  'pm.currentPatientVitals': { en: 'Current Patient · Vitals', te: 'ప్రస్తుత రోగి · వైటల్స్', hi: 'वर्तमान मरीज़ · वाइटल्स' },
  'pm.noVitals': { en: 'No vitals recorded yet.', te: 'ఇంకా వైటల్స్ నమోదు కాలేదు.', hi: 'अभी तक कोई वाइटल्स दर्ज नहीं।' },
  'pm.needsAttention': { en: 'Needs attention', te: 'శ్రద్ధ అవసరం', hi: 'ध्यान देने की ज़रूरत' },
  'pm.bmi': { en: 'BMI:', te: 'బీఎంఐ:', hi: 'बीएमआई:' },
  'pm.bpTrend': { en: 'BP trend', te: 'బీపీ ధోరణి', hi: 'बीपी रुझान' },
  'pm.self': { en: 'Self', te: 'స్వయంగా', hi: 'स्वयं' },
  'pm.sugarType': { en: 'Sugar type…', te: 'చక్కెర రకం…', hi: 'शुगर प्रकार…' },
  'pm.fasting': { en: 'Fasting', te: 'ఖాళీ కడుపుతో', hi: 'खाली पेट' },
  'pm.postMeal': { en: 'Post-meal', te: 'భోజనం తర్వాత', hi: 'भोजन के बाद' },
  'pm.random': { en: 'Random', te: 'యాదృచ్ఛికం', hi: 'रैंडम' },
  'pm.bpSys': { en: 'BP sys', te: 'బీపీ సిస్', hi: 'बीपी सिस' },
  'pm.bpDia': { en: 'BP dia', te: 'బీపీ డయా', hi: 'बीपी डाया' },
  'pm.pulse': { en: 'Pulse (bpm)', te: 'నాడి (bpm)', hi: 'नाड़ी (bpm)' },
  'pm.spo2': { en: 'SpO₂ (%)', te: 'SpO₂ (%)', hi: 'SpO₂ (%)' },
  'pm.temp': { en: 'Temp (°F)', te: 'ఉష్ణోగ్రత (°F)', hi: 'तापमान (°F)' },
  'pm.weight': { en: 'Weight (kg)', te: 'బరువు (kg)', hi: 'वज़न (kg)' },
  'pm.height': { en: 'Height (cm)', te: 'ఎత్తు (cm)', hi: 'ऊँचाई (cm)' },
  'pm.bloodSugar': { en: 'Blood sugar', te: 'రక్తంలో చక్కెర', hi: 'रक्त शर्करा' },
}
