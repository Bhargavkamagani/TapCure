import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { landingT } from './dict/landing.js'
import { dashboardT } from './dict/dashboard.js'
import { symptomT } from './dict/symptom.js'
import { editorialLandingT } from './dict/editorialLanding.js'
import { tcLandingT } from './dict/tcLanding.js'
import { tcFaqT } from './dict/tcFaq.js'
import { tcLeaveNowT } from './dict/tcLeaveNow.js'
import { tcHeroT } from './dict/tcHero.js'
import { tcLedgerT } from './dict/tcLedger.js'
import { patientMiscT } from './dict/patientMisc.js'
import { nutritionT } from './dict/nutrition.js'
import { legalTermsT } from './dict/legalTerms.js'
import { legalPrivacyT } from './dict/legalPrivacy.js'
import { legalRefundT } from './dict/legalRefund.js'
import { staticPagesT } from './dict/staticPages.js'
import { staticFaqT } from './dict/staticFaq.js'
import { publicPagesT } from './dict/publicPages.js'
import { authExtraT } from './dict/authExtra.js'
import { patientExtraT } from './dict/patientExtra.js'
import { landingExtraT } from './dict/landingExtra.js'
import { shellT } from './dict/shell.js'
import { tcPricingT } from './dict/tcPricing.js'
import { accountDeleteT } from './dict/accountDelete.js'
import { insuranceT } from './dict/insurance.js'

/**
 * Lightweight i18n for the patient-facing surfaces. The selected language is
 * persisted and also exposes a BCP-47 `speech` code so the voice helpers read /
 * listen in the same language the UI is showing.
 */
export const LANGS = {
  en: { label: 'English', speech: 'en-IN' },
  te: { label: 'తెలుగు', speech: 'te-IN' },
  hi: { label: 'हिंदी', speech: 'hi-IN' },
}

const coreT = {
  // ---- Navbar ----
  'nav.findDoctors': { en: 'Find Doctors', te: 'డాక్టర్లను కనుగొనండి', hi: 'डॉक्टर खोजें' },
  'nav.findHospitals': { en: 'Find Hospitals', te: 'ఆసుపత్రులను కనుగొనండి', hi: 'अस्पताल खोजें' },
  'nav.healthArticles': { en: 'Health Articles', te: 'ఆరోగ్య వ్యాసాలు', hi: 'स्वास्थ्य लेख' },
  'nav.changeCity': { en: 'Change City', te: 'నగరం మార్చండి', hi: 'शहर बदलें' },
  'nav.loginSignup': { en: 'Login / Sign up', te: 'లాగిన్ / సైన్ అప్', hi: 'लॉगिन / साइन अप' },
  'nav.patient': { en: 'Patient', te: 'రోగి', hi: 'मरीज़' },
  'nav.doctor': { en: 'Doctor', te: 'డాక్టర్', hi: 'डॉक्टर' },
  'nav.patientDesc': { en: 'Book doctors & get tokens', te: 'డాక్టర్లను బుక్ చేసి టోకెన్ పొందండి', hi: 'डॉक्टर बुक करें और टोकन पाएं' },
  'nav.doctorDesc': { en: 'Manage patients & schedule', te: 'రోగులు & షెడ్యూల్ నిర్వహించండి', hi: 'मरीज़ और शेड्यूल प्रबंधित करें' },
  'nav.forHospitals': { en: 'For Hospitals', te: 'ఆసుపత్రుల కోసం', hi: 'अस्पताल के लिए' },

  // ---- Hero ----
  'hero.line1': { en: 'Book appointment.', te: 'అపాయింట్‌మెంట్ బుక్ చేయండి.', hi: 'अपॉइंटमेंट बुक करें।' },
  'hero.line2': { en: 'Get token.', te: 'టోకెన్ పొందండి.', hi: 'टोकन पाएं।' },
  'hero.line3': { en: 'Travel at the right time.', te: 'సరైన సమయంలో బయలుదేరండి.', hi: 'सही समय पर निकलें।' },
  'hero.subtitle': {
    en: 'Skip the long queues. Book with trusted doctors & hospitals and get your token before you visit.',
    te: 'పొడవైన క్యూలను తప్పించుకోండి. నమ్మకమైన డాక్టర్లు & ఆసుపత్రులతో బుక్ చేసి, రాకముందే మీ టోకెన్ పొందండి.',
    hi: 'लंबी कतारों से बचें। भरोसेमंद डॉक्टरों और अस्पताल के साथ बुक करें और आने से पहले अपना टोकन पाएं।',
  },
  'hero.searchPlaceholder': {
    en: 'Search doctors, specialties, hospitals...',
    te: 'డాక్టర్లు, స్పెషాలిటీలు, ఆసుపత్రులు వెతకండి...',
    hi: 'डॉक्टर, विशेषज्ञता, अस्पताल खोजें...',
  },
  'hero.search': { en: 'Search', te: 'వెతకండి', hi: 'खोजें' },
  'hero.popular': { en: 'Popular Searches:', te: 'ప్రముఖ శోధనలు:', hi: 'लोकप्रिय खोजें:' },
  'hero.bookTitle': { en: 'Book Appointment', te: 'అపాయింట్‌మెంట్ బుక్ చేయండి', hi: 'अपॉइंटमेंट बुक करें' },
  'hero.bookSub': { en: 'Book with ease', te: 'సులభంగా బుక్ చేయండి', hi: 'आसानी से बुक करें' },
  'hero.tokenTitle': { en: 'Get Token', te: 'టోకెన్ పొందండి', hi: 'टोकन पाएं' },
  'hero.tokenSub': { en: 'Save time at the hospital', te: 'ఆసుపత్రులో సమయం ఆదా చేయండి', hi: 'अस्पताल में समय बचाएं' },

  // ---- Lifeline ----
  'life.title': { en: 'Lifeline — 24/7 Emergency Support', te: 'లైఫ్‌లైన్ — 24/7 అత్యవసర సహాయం', hi: 'लाइफलाइन — 24/7 आपातकालीन सहायता' },
  'life.services': { en: 'Ambulance · Doctor on call · Emergency helpline', te: 'అంబులెన్స్ · డాక్టర్ ఆన్ కాల్ · అత్యవసర హెల్ప్‌లైన్', hi: 'एम्बुलेंस · डॉक्टर ऑन कॉल · आपातकालीन हेल्पलाइन' },
  'life.available': { en: 'Available now', te: 'ఇప్పుడు అందుబాటులో', hi: 'अभी उपलब्ध' },
  'life.avg': { en: 'Avg response', te: 'సగటు ప్రతిస్పందన', hi: 'औसत प्रतिक्रिया' },
  'life.call': { en: 'Call Lifeline', te: 'లైఫ్‌లైన్‌కు కాల్ చేయండి', hi: 'लाइफलाइन को कॉल करें' },
  'life.ambulance': { en: 'Request Ambulance', te: 'అంబులెన్స్ అభ్యర్థించండి', hi: 'एम्बुलेंस मंगाएं' },

  // ---- Patient voice / OTP auth ----
  'auth.title': { en: 'Patient Login', te: 'రోగి లాగిన్', hi: 'मरीज़ लॉगिन' },
  'auth.subtitle': { en: 'Use your mobile number — we will send an OTP.', te: 'మీ మొబైల్ నంబర్ వాడండి — మేము OTP పంపుతాము.', hi: 'अपना मोबाइल नंबर इस्तेमाल करें — हम OTP भेजेंगे।' },
  'auth.signedOutOtherDevice': { en: 'You were signed out because this account was used to sign in on another device. Please sign in again.', te: 'ఈ ఖాతాతో వేరే పరికరంలో లాగిన్ చేయడం వల్ల మీరు సైన్ అవుట్ అయ్యారు. దయచేసి మళ్లీ లాగిన్ చేయండి.', hi: 'इस खाते से किसी दूसरे डिवाइस पर लॉगिन होने के कारण आपको साइन आउट कर दिया गया। कृपया दोबारा लॉगिन करें।' },
  'auth.loginTab': { en: 'Login', te: 'లాగిన్', hi: 'लॉगिन' },
  'auth.signupTab': { en: 'Register', te: 'నమోదు', hi: 'रजिस्टर' },
  'auth.nameLabel': { en: 'Your full name', te: 'మీ పూర్తి పేరు', hi: 'आपका पूरा नाम' },
  'auth.namePrompt': { en: 'Please say or type your full name.', te: 'దయచేసి మీ పూర్తి పేరు చెప్పండి లేదా టైప్ చేయండి.', hi: 'कृपया अपना पूरा नाम बोलें या टाइप करें।' },
  'auth.mobileLabel': { en: 'Mobile number', te: 'మొబైల్ నంబర్', hi: 'मोबाइल नंबर' },
  'auth.mobilePrompt': { en: 'Please say or type your 10 digit mobile number.', te: 'దయచేసి మీ 10 అంకెల మొబైల్ నంబర్ చెప్పండి లేదా టైప్ చేయండి.', hi: 'कृपया अपना 10 अंकों का मोबाइल नंबर बोलें या टाइप करें।' },
  'auth.loginCta': { en: 'Login', te: 'లాగిన్', hi: 'लॉगिन' },
  'auth.registerCta': { en: 'Register', te: 'నమోదు చేయండి', hi: 'रजिस्टर करें' },
  'auth.otpOnWhatsapp': { en: 'We have sent an OTP to your WhatsApp on +91 {phone}. Please enter it below.', te: '+91 {phone} వాట్సాప్‌కు OTP పంపాం. దయచేసి దాన్ని క్రింద నమోదు చేయండి.', hi: 'हमने +91 {phone} पर आपके WhatsApp पर OTP भेजा है। कृपया उसे नीचे दर्ज करें।' },
  'auth.sendOtp': { en: 'Send OTP', te: 'OTP పంపండి', hi: 'OTP भेजें' },
  'auth.resendOtp': { en: 'Resend OTP', te: 'OTP మళ్ళీ పంపండి', hi: 'OTP दोबारा भेजें' },
  'auth.resendIn': { en: 'Resend OTP in {s}', te: 'OTP మళ్ళీ పంపడానికి {s}', hi: '{s} में OTP दोबारा भेजें' },
  'auth.otpLabel': { en: 'Enter OTP', te: 'OTP నమోదు చేయండి', hi: 'OTP दर्ज करें' },
  'auth.otpPrompt': { en: 'You will get an O T P. Please say or type the 6 digit code.', te: 'మీకు OTP వస్తుంది. దయచేసి 6 అంకెల కోడ్ చెప్పండి లేదా టైప్ చేయండి.', hi: 'आपको OTP मिलेगा। कृपया 6 अंकों का कोड बोलें या टाइप करें।' },
  'auth.otpSentDemo': { en: 'OTP sent to +91 {phone}. Demo OTP: {otp}', te: '+91 {phone} కు OTP పంపబడింది. డెమో OTP: {otp}', hi: '+91 {phone} पर OTP भेजा गया। डेमो OTP: {otp}' },
  // Production wording: the code goes out on WhatsApp and is never echoed back
  // to the browser, so there is nothing to show — and nothing "demo" about it.
  'auth.otpSentWhatsapp': { en: 'OTP sent to +91 {phone} on WhatsApp.', te: '+91 {phone} కు WhatsApp లో OTP పంపబడింది.', hi: '+91 {phone} पर WhatsApp पर OTP भेजा गया।' },
  'auth.verifyLogin': { en: 'Verify & Continue', te: 'ధృవీకరించి కొనసాగండి', hi: 'सत्यापित करें और जारी रखें' },
  'auth.createAccount': { en: 'Create account', te: 'ఖాతా సృష్టించండి', hi: 'खाता बनाएं' },
  'auth.cityLabel': { en: 'City', te: 'నగరం', hi: 'शहर' },
  'auth.cityRequired': { en: 'Please enter your city.', te: 'దయచేసి మీ నగరాన్ని నమోదు చేయండి.', hi: 'कृपया अपना शहर दर्ज करें।' },
  'auth.abhaLabel': { en: 'ABHA Number (optional)', te: 'ABHA నంబర్ (ఐచ్ఛికం)', hi: 'ABHA नंबर (वैकल्पिक)' },
  'auth.abhaPrompt': { en: 'If you have an ABHA health ID, say or type the 14 digit number. Otherwise skip.', te: 'మీకు ABHA ఆరోగ్య ID ఉంటే, 14 అంకెల నంబర్ చెప్పండి లేదా టైప్ చేయండి. లేకపోతే దాటవేయండి.', hi: 'यदि आपके पास ABHA हेल्थ ID है, तो 14 अंकों का नंबर बोलें या टाइप करें। अन्यथा छोड़ें।' },
  'auth.back': { en: 'Back', te: 'వెనుకకు', hi: 'वापस' },
  'auth.listening': { en: 'Listening…', te: 'వింటోంది…', hi: 'सुन रहा है…' },
  'auth.tapMic': { en: 'Tap the mic and speak', te: 'మైక్ నొక్కి మాట్లాడండి', hi: 'माइक दबाएं और बोलें' },
  'auth.voiceUnsupported': { en: 'Voice is not supported on this browser — please type.', te: 'ఈ బ్రౌజర్‌లో వాయిస్ మద్దతు లేదు — దయచేసి టైప్ చేయండి.', hi: 'इस ब्राउज़र में वॉइस समर्थित नहीं है — कृपया टाइप करें।' },
  'auth.invalidMobile': { en: 'Enter a valid 10-digit mobile number.', te: 'సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి.', hi: 'सही 10 अंकों का मोबाइल नंबर दर्ज करें।' },
  'auth.invalidAbha': { en: 'ABHA number must be exactly 14 digits — or leave it blank.', te: 'ABHA నంబర్ సరిగ్గా 14 అంకెలు ఉండాలి — లేదా ఖాళీగా వదిలేయండి.', hi: 'ABHA नंबर ठीक 14 अंकों का होना चाहिए — या इसे खाली छोड़ें।' },
  'auth.repeatFull': { en: 'Please say all {n} digits, slowly, one by one.', te: 'దయచేసి {n} అంకెలను నెమ్మదిగా, ఒక్కొక్కటిగా చెప్పండి.', hi: 'कृपया सभी {n} अंक धीरे-धीरे, एक-एक करके बोलें।' },
  'auth.incompleteDigits': { en: 'I heard only {got} of {need} digits — please say the full number.', te: '{need} అంకెలలో {got} మాత్రమే వినిపించాయి — దయచేసి పూర్తి నంబర్ చెప్పండి.', hi: '{need} में से केवल {got} अंक सुनाई दिए — कृपया पूरा नंबर बोलें।' },
  'auth.tickToAccept': { en: 'Please tick this box to accept and continue.', te: 'కొనసాగించడానికి దయచేసి ఈ పెట్టెను టిక్ చేయండి.', hi: 'जारी रखने के लिए कृपया इस बॉक्स को टिक करें।' },
  'auth.success': { en: 'Success! Taking you to your dashboard…', te: 'విజయం! మీ డ్యాష్‌బోర్డ్‌కు తీసుకెళ్తున్నాం…', hi: 'सफल! आपको डैशबोर्ड पर ले जा रहे हैं…' },
  'auth.notRegistered': { en: 'This number is not registered. Please register.', te: 'ఈ నంబర్ నమోదు కాలేదు. దయచేసి నమోదు చేయండి.', hi: 'यह नंबर पंजीकृत नहीं है। कृपया रजिस्टर करें।' },
  'auth.alreadyRegistered': { en: 'This number is already registered. Please log in instead.', te: 'ఈ నంబర్ ఇప్పటికే నమోదైంది. దయచేసి లాగిన్ చేయండి.', hi: 'यह नंबर पहले से पंजीकृत है। कृपया लॉगिन करें।' },
  'auth.doctorEmail': { en: 'Doctors log in with email & password.', te: 'డాక్టర్లు ఇమెయిల్ & పాస్‌వర్డ్‌తో లాగిన్ అవుతారు.', hi: 'डॉक्टर ईमेल और पासवर्ड से लॉगिन करते हैं।' },
  'auth.staffNumber': { en: 'Unable to continue with this login method. Please use the appropriate sign-in option.', te: 'ఈ లాగిన్ విధానంతో కొనసాగడం సాధ్యం కాలేదు. దయచేసి సరైన సైన్-ఇన్ ఎంపికను ఉపయోగించండి లేదా సహాయ బృందాన్ని సంప్రదించండి.', hi: 'इस लॉगिन विधि से आगे बढ़ना संभव नहीं है। कृपया सही साइन-इन विकल्प का उपयोग करें या सहायता टीम से संपर्क करें।' },

  // ---- Guided voice walkthrough (auto-fills the registration form by voice) ----
  'guide.start': { en: 'Voice guide', te: 'వాయిస్ గైడ్', hi: 'वॉइस गाइड' },
  'guide.stop': { en: 'Stop guide', te: 'గైడ్ ఆపండి', hi: 'गाइड रोकें' },
  'guide.running': { en: 'Voice guide is on — just speak when you see the arrow.', te: 'వాయిస్ గైడ్ ఆన్‌లో ఉంది — బాణం కనిపించినప్పుడు మాట్లాడండి.', hi: 'वॉइस गाइड चालू है — तीर दिखने पर बोलें।' },
  'guide.welcome': { en: "Hello! I'll help you register. Just speak when you see the arrow, and I'll fill it for you.", te: 'నమస్కారం! నేను మిమ్మల్ని నమోదు చేయడంలో సహాయం చేస్తాను. బాణం కనిపించినప్పుడు మాట్లాడండి, నేను మీ కోసం నింపుతాను.', hi: 'नमस्ते! मैं आपको रजिस्टर करने में मदद करूँगा। तीर दिखने पर बोलें, मैं आपके लिए भर दूँगा।' },
  'guide.signupHere': { en: 'Sign up here', te: 'ఇక్కడ నమోదు చేసుకోండి', hi: 'यहाँ साइन अप करें' },
  'guide.nameBubble': { en: 'Tell me your name', te: 'మీ పేరు చెప్పండి', hi: 'अपना नाम बताएं' },
  'guide.namePrompt': { en: 'Tell me your full name, and I will fill it for you.', te: 'మీ పూర్తి పేరు చెప్పండి, నేను మీ కోసం నింపుతాను.', hi: 'अपना पूरा नाम बताएं, मैं आपके लिए भर दूँगा।' },
  'guide.mobileBubble': { en: 'Say your mobile number', te: 'మీ మొబైల్ నంబర్ చెప్పండి', hi: 'अपना मोबाइल नंबर बोलें' },
  'guide.mobilePrompt': { en: 'Now say your ten digit mobile number.', te: 'ఇప్పుడు మీ పది అంకెల మొబైల్ నంబర్ చెప్పండి.', hi: 'अब अपना दस अंकों का मोबाइल नंबर बोलें।' },
  'guide.cityBubble': { en: 'Say your city', te: 'మీ నగరం చెప్పండి', hi: 'अपना शहर बोलें' },
  'guide.cityPrompt': { en: 'Which city are you in? Say it, or stay quiet to skip.', te: 'మీరు ఏ నగరంలో ఉన్నారు? చెప్పండి, లేదా దాటవేయడానికి నిశ్శబ్దంగా ఉండండి.', hi: 'आप किस शहर में हैं? बोलें, या छोड़ने के लिए चुप रहें।' },
  'guide.gotIt': { en: 'Got it, thank you.', te: 'దొరికింది, ధన్యవాదాలు.', hi: 'मिल गया, धन्यवाद।' },
  'guide.retry': { en: "Sorry, I didn't catch that. Please say it once more.", te: 'క్షమించండి, వినిపించలేదు. దయచేసి మరోసారి చెప్పండి.', hi: 'माफ़ कीजिए, समझ नहीं आया। कृपया एक बार और बोलें।' },
  'guide.sendingOtp': { en: 'Great! Sending your O T P now.', te: 'బాగుంది! ఇప్పుడు మీ OTPని పంపుతున్నాను.', hi: 'बढ़िया! अब आपका OTP भेज रहा हूँ।' },
  'guide.speaking': { en: 'Speaking…', te: 'మాట్లాడుతోంది…', hi: 'बोल रहा है…' },

  'guide.listenUnavailable': { en: 'Listening is not configured. Add OPENAI_API_KEY in backend .env, restart the backend, then try again.', te: 'వాయిస్ వినడం ప్రస్తుతం అందుబాటులో లేదు. దయచేసి టైప్ చేయండి.', hi: 'आवाज़ सुनने की सुविधा अभी उपलब्ध नहीं है। कृपया टाइप करें।' },
  'guide.didntHear': { en: 'I could not hear that. Please allow microphone access and try again.', te: 'నాకు వినిపించలేదు. దయచేసి మైక్రోఫోన్ అనుమతి ఇచ్చి మళ్లీ ప్రయత్నించండి.', hi: 'मुझे सुनाई नहीं दिया। कृपया माइक्रोफ़ोन की अनुमति दें और फिर से कोशिश करें।' },
  'guide.consentBubble': { en: 'Say "yes" to accept', te: 'అంగీకరించడానికి "అవును" అనండి', hi: 'स्वीकार करने के लिए "हाँ" कहें' },
  'guide.consentPrompt': { en: 'Last step. Do you agree to the Terms, Privacy and Refund policies? Please say yes to accept.', te: 'చివరి అడుగు. మీరు నిబంధనలు, గోప్యత మరియు రీఫండ్ విధానాలకు అంగీకరిస్తున్నారా? అంగీకరించడానికి అవును అనండి.', hi: 'आखिरी चरण। क्या आप नियम, गोपनीयता और रिफंड नीतियों से सहमत हैं? स्वीकार करने के लिए हाँ कहें।' },
  'guide.consentRetry': { en: 'To create your account, please say yes to accept the Terms, Privacy and Refund policies.', te: 'మీ ఖాతా సృష్టించడానికి, నిబంధనలు, గోప్యత మరియు రీఫండ్ విధానాలకు అంగీకరించడానికి అవును అనండి.', hi: 'अपना खाता बनाने के लिए, नियम, गोपनीयता और रिफंड नीतियों को स्वीकार करने के लिए हाँ कहें।' },
  'guide.consentThanks': { en: 'Thank you for accepting.', te: 'అంగీకరించినందుకు ధన్యవాదాలు.', hi: 'स्वीकार करने के लिए धन्यवाद।' },
  'guide.consentDeclined': { en: 'No problem. When you are ready to accept the policies, say yes.', te: 'ఫర్వాలేదు. విధానాలను అంగీకరించడానికి సిద్ధంగా ఉన్నప్పుడు అవును అనండి.', hi: 'कोई बात नहीं। जब आप नीतियों को स्वीकार करने के लिए तैयार हों, तो हाँ कहें।' },
  'guide.consentNeeded': { en: 'We cannot create your account without accepting the policies. Please tick the box or say yes.', te: 'విధానాలను అంగీకరించకుండా మేము మీ ఖాతాను సృష్టించలేము. దయచేసి పెట్టెను టిక్ చేయండి లేదా అవును అనండి.', hi: 'नीतियों को स्वीकार किए बिना हम आपका खाता नहीं बना सकते। कृपया बॉक्स को टिक करें या हाँ कहें।' },
  // ---- Landing-page coach-mark (points at the login/sign-up entry) ----
  'land.guide.bubble': { en: 'Tap here to sign up or log in as a patient', te: 'రోగిగా నమోదు లేదా లాగిన్ కావడానికి ఇక్కడ నొక్కండి', hi: 'मरीज़ के रूप में साइन अप या लॉगिन के लिए यहाँ टैप करें' },
  'land.guide.speak': { en: 'Welcome! To book a doctor, sign up here as a patient. Tap the highlighted button and I will guide you step by step.', te: 'స్వాగతం! డాక్టర్‌ను బుక్ చేయడానికి, ఇక్కడ రోగిగా నమోదు అవ్వండి. హైలైట్ చేసిన బటన్‌ను నొక్కండి, నేను అడుగడుగునా మీకు దారి చూపుతాను.', hi: 'स्वागत है! डॉक्टर बुक करने के लिए यहाँ मरीज़ के रूप में साइन अप करें। हाइलाइट किए बटन पर टैप करें, मैं कदम-कदम पर मार्गदर्शन करूँगा।' },
  'land.guide.cta': { en: 'Start sign up', te: 'నమోదు ప్రారంభించండి', hi: 'साइन अप शुरू करें' },
  'land.guide.dismiss': { en: 'Dismiss', te: 'మూసివేయండి', hi: 'बंद करें' },
}

// Core (navbar/hero/lifeline/auth) merged with the Phase-2 landing + dashboard dicts.
const T = { ...coreT, ...landingT, ...editorialLandingT, ...tcLandingT, ...tcFaqT, ...tcLeaveNowT, ...tcHeroT, ...tcLedgerT, ...dashboardT, ...symptomT, ...patientMiscT, ...nutritionT, ...legalTermsT, ...legalPrivacyT, ...legalRefundT, ...staticPagesT, ...staticFaqT, ...publicPagesT, ...authExtraT, ...patientExtraT, ...landingExtraT, ...shellT, ...tcPricingT, ...accountDeleteT, ...insuranceT }

const Ctx = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem('dm.lang')
    return saved && LANGS[saved] ? saved : 'en'
  })
  const setLang = useCallback((l) => {
    if (LANGS[l]) {
      setLangState(l)
      try { localStorage.setItem('dm.lang', l) } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key, vars) => {
      const entry = T[key]
      let str = (entry && (entry[lang] ?? entry.en)) ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v)
      return str
    },
    [lang],
  )

  return <Ctx.Provider value={{ lang, setLang, t, speech: LANGS[lang].speech }}>{children}</Ctx.Provider>
}

export function useI18n() {
  return useContext(Ctx) || { lang: 'en', setLang: () => {}, t: (k) => k, speech: 'en-IN' }
}
