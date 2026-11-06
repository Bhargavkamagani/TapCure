/**
 * Landing-page navigation, role picker and hero strings.
 *
 * Hindi was added to every key on 2026-09-01. Before that only one key carried
 * `hi`, so a visitor who chose हिंदी got the English fallback for the entire
 * navbar and role menu — the switcher looked broken because, visibly, nothing
 * changed. Telugu had been complete all along, which is why te "worked" and hi
 * did not.
 *
 * The `land.hero.*` and `land.popular.*` keys below belong to the PRE-REDESIGN
 * landing page and are not rendered by the current one (see TcSections.jsx,
 * which is still hardcoded English). They are kept translated so they are ready
 * if that copy is reused, but adding Hindi here does not by itself translate
 * the new landing page.
 */
export const editorialLandingT = {
  'land.nav.doctors': { en: 'Find doctors', te: 'వైద్యులను కనుగొనండి', hi: 'डॉक्टर खोजें' },
  'land.nav.hospitals': { en: 'Find hospitals', te: 'ఆసుపత్రులను కనుగొనండి', hi: 'अस्पताल खोजें' },
  'land.nav.articles': { en: 'Health Articles', te: 'ఆరోగ్య వ్యాసాలు', hi: 'स्वास्थ्य लेख' },
  'land.nav.login': { en: 'Log in / Sign up', te: 'లాగిన్ / నమోదు', hi: 'लॉग इन / साइन अप' },
  'land.nav.menu': { en: 'Menu', te: 'మెనూ', hi: 'मेन्यू' },
  // Nav shortcut to the sixty-second health calculators (#health).
  'land.nav.magic': { en: 'See the magic', te: 'మ్యాజిక్ చూడండి', hi: 'जादू देखिए' },
  // Heading over the language chips in the mobile menu.
  'land.nav.language': { en: 'Language', te: 'భాష', hi: 'भाषा' },
  'land.nav.roleAction': { en: 'log in / sign up', te: 'లాగిన్ / నమోదు', hi: 'लॉग इन / साइन अप' },
  'land.role.patient': { en: 'Patient', te: 'రోగి', hi: 'मरीज़' },
  'land.role.patientDesc': { en: 'Book & track your visits', te: 'మీ అపాయింట్‌మెంట్‌లను బుక్ చేసి ట్రాక్ చేయండి', hi: 'अपनी विज़िट बुक करें और ट्रैक करें' },
  'land.role.doctor': { en: 'Doctor', te: 'వైద్యుడు', hi: 'डॉक्टर' },
  'land.role.doctorDesc': { en: 'Manage your queue', te: 'మీ క్యూను నిర్వహించండి', hi: 'अपनी क्यू प्रबंधित करें' },
  'land.role.hospital': { en: 'Hospital', te: 'ఆసుపత్రి', hi: 'अस्पताल' },
  'land.role.hospitalDesc': { en: 'Log in or register your hospital', te: 'మీ ఆసుపత్రికి లాగిన్ అవ్వండి లేదా నమోదు చేయండి', hi: 'अपने अस्पताल में लॉग इन करें या पंजीकरण करें' },
  'land.hero.trust': { en: 'Trusted by 40,000+ families across South India', te: 'దక్షిణ భారతదేశంలోని 40,000+ కుటుంబాల విశ్వాసం', hi: 'दक्षिण भारत के 40,000+ परिवारों का भरोसा' },
  'land.hero.headingA': { en: 'Care your family', te: 'మీ కుటుంబానికి కావాల్సిన సంరక్షణ', hi: 'वह देखभाल जिस पर आपका परिवार' },
  'land.hero.headingB': { en: 'can actually count on.', te: 'నిజంగా నమ్మదగినది.', hi: 'सचमुच भरोसा कर सके।' },
  'land.hero.body': { en: 'Find the right doctor, book an appointment, and skip the waiting room — all in one calm place built for real families.', te: 'సరైన వైద్యుడిని కనుగొని, అపాయింట్‌మెంట్ బుక్ చేసి, వేచి ఉండే సమయాన్ని తగ్గించుకోండి — కుటుంబాల కోసం రూపొందించిన ఒకే సులభమైన వేదికలో.', hi: 'सही डॉक्टर खोजें, अपॉइंटमेंट बुक करें और वेटिंग रूम से बचें — परिवारों के लिए बनी एक ही सरल जगह पर।' },
  'land.hero.placeholder': { en: 'Doctor, specialty or symptom', te: 'వైద్యుడు, స్పెషాలిటీ లేదా లక్షణం', hi: 'डॉक्टर, विशेषज्ञता या लक्षण' },
  'land.hero.allCities': { en: 'All cities', te: 'అన్ని నగరాలు', hi: 'सभी शहर' },
  'land.hero.chooseCity': { en: 'Choose city', te: 'నగరాన్ని ఎంచుకోండి', hi: 'शहर चुनें' },
  'land.hero.search': { en: 'Search', te: 'వెతకండి', hi: 'खोजें' },
  'land.hero.popular': { en: 'Popular:', te: 'ప్రముఖమైనవి:', hi: 'लोकप्रिय:' },
  'land.hero.bookTitle': { en: 'Book appointment', te: 'అపాయింట్‌మెంట్ బుక్ చేయండి', hi: 'अपॉइंटमेंट बुक करें' },
  'land.hero.bookSub': { en: 'Choose a slot in seconds', te: 'క్షణాల్లో సమయాన్ని ఎంచుకోండి', hi: 'कुछ ही क्षणों में समय चुनें' },
  'land.hero.tokenTitle': { en: 'Get a live token', te: 'లైవ్ టోకెన్ పొందండి', hi: 'लाइव टोकन पाएं' },
  'land.hero.tokenSub': { en: 'Track your turn in real time', te: 'మీ వంతును ప్రత్యక్షంగా ట్రాక్ చేయండి', hi: 'अपनी बारी लाइव ट्रैक करें' },
  'land.hero.imageAlt': { en: 'A family checking their doctor appointment together', te: 'కుటుంబం కలిసి వైద్యుడి అపాయింట్‌మెంట్‌ను చూస్తోంది', hi: 'परिवार साथ मिलकर डॉक्टर का अपॉइंटमेंट देख रहा है' },
  'land.hero.specialtyTime': { en: 'General Physician · Today 4:30 PM', te: 'సాధారణ వైద్యుడు · ఈరోజు సాయంత్రం 4:30', hi: 'सामान्य चिकित्सक · आज शाम 4:30' },
  'land.hero.token12': { en: 'Token #12', te: 'టోకెన్ #12', hi: 'टोकन #12' },
  'land.hero.reviews': { en: '4.9 · 12k reviews', te: '4.9 · 12 వేల సమీక్షలు', hi: '4.9 · 12 हज़ार समीक्षाएं' },
  'land.hero.loved': { en: 'Loved by families', te: 'కుటుంబాలు మెచ్చినది', hi: 'परिवारों का पसंदीदा' },
  'land.popular.generalPhysician': { en: 'General Physician', te: 'సాధారణ వైద్యుడు', hi: 'सामान्य चिकित्सक' },
  'land.popular.pediatrician': { en: 'Pediatrician', te: 'పిల్లల వైద్యుడు', hi: 'बाल रोग विशेषज्ञ' },
  'land.popular.dermatologist': { en: 'Dermatologist', te: 'చర్మ వైద్యుడు', hi: 'त्वचा रोग विशेषज्ञ' },
  'land.popular.cardiologist': { en: 'Cardiologist', te: 'హృదయ వైద్యుడు', hi: 'हृदय रोग विशेषज्ञ' },
  'land.popular.dentist': { en: 'Dentist', te: 'దంత వైద్యుడు', hi: 'दंत चिकित्सक' },
}
