/**
 * Telugu/Hindi strings added in the 2026-09-19 translation sweep (shell):
 * the shared chrome of the public + legal pages (StaticPageShell).
 */
export const shellT = {
  'shell.backHome': { en: 'Back to home', te: 'హోమ్‌కు తిరిగి వెళ్ళండి', hi: 'होम पर वापस जाएँ' },
  'shell.backDashboard': { en: 'Back to dashboard', te: 'డాష్‌బోర్డ్‌కు తిరిగి వెళ్ళండి', hi: 'डैशबोर्ड पर वापस जाएँ' },
  'shell.about': { en: 'About Us', te: 'మా గురించి', hi: 'हमारे बारे में' },
  'shell.features': { en: 'Features', te: 'ఫీచర్లు', hi: 'सुविधाएँ' },
  'shell.pricing': { en: 'Pricing', te: 'ధరలు', hi: 'कीमतें' },
  'shell.faq': { en: 'FAQ', te: 'తరచూ అడిగే ప్రశ్నలు', hi: 'अक्सर पूछे जाने वाले सवाल' },
  'shell.resources': { en: 'Resources', te: 'వనరులు', hi: 'संसाधन' },
  'shell.calculators': { en: 'Health Calculators', te: 'ఆరోగ్య కాలిక్యులేటర్లు', hi: 'स्वास्थ्य कैलकुलेटर' },
  'shell.contact': { en: 'Contact Us', te: 'మమ్మల్ని సంప్రదించండి', hi: 'संपर्क करें' },
  'shell.policies': { en: 'Policies', te: 'విధానాలు', hi: 'नीतियाँ' },
  'shell.privacy': { en: 'Privacy Policy', te: 'గోప్యతా విధానం', hi: 'गोपनीयता नीति' },
  'shell.terms': { en: 'Terms & Conditions', te: 'నిబంధనలు & షరతులు', hi: 'नियम और शर्तें' },
  'shell.refund': { en: 'Cancellation & Refund', te: 'రద్దు & రీఫండ్', hi: 'रद्दीकरण और रिफ़ंड' },
  'shell.disclaimer': { en: 'Medical Disclaimer', te: 'వైద్య నిరాకరణ', hi: 'चिकित्सा अस्वीकरण' },
  'shell.madeWithCare': { en: 'Made with care in Hyderabad.', te: 'హైదరాబాద్‌లో శ్రద్ధతో తయారు చేయబడింది.', hi: 'हैदराबाद में प्यार से बनाया गया।' },
  // Legal pages only, shown when the UI is not English.
  'shell.legalNote': {
    en: 'This is a translation for your convenience. The English version of this page is the legally binding one.',
    te: 'ఇది మీ సౌలభ్యం కోసం చేసిన అనువాదం. ఈ పేజీ యొక్క ఆంగ్ల వెర్షన్ మాత్రమే చట్టబద్ధంగా అమలులో ఉంటుంది.',
    hi: 'यह आपकी सुविधा के लिए किया गया अनुवाद है। इस पेज का अंग्रेज़ी संस्करण ही कानूनी रूप से मान्य है।',
  },

  // StatusBadge display labels (components/hospital/ui.jsx). Key = lower-cased
  // status with spaces as _, so 'On Leave' and 'on_leave' both match.
  'status.waiting': { en: 'Waiting', te: 'వేచి ఉన్నారు', hi: 'प्रतीक्षा में' },
  'status.completed': { en: 'Completed', te: 'పూర్తయింది', hi: 'पूरा हुआ' },
  'status.in_consultation': { en: 'In Consultation', te: 'సంప్రదింపులో', hi: 'परामर्श में' },
  'status.confirmed': { en: 'Confirmed', te: 'ధృవీకరించబడింది', hi: 'पुष्टि हुई' },
  'status.pending': { en: 'Pending', te: 'పెండింగ్‌లో ఉంది', hi: 'लंबित' },
  'status.cancelled': { en: 'Cancelled', te: 'రద్దు చేయబడింది', hi: 'रद्द' },
  'status.available': { en: 'Available', te: 'అందుబాటులో ఉన్నారు', hi: 'उपलब्ध' },
  'status.busy': { en: 'Busy', te: 'బిజీగా ఉన్నారు', hi: 'व्यस्त' },
  'status.on_leave': { en: 'On Leave', te: 'సెలవులో ఉన్నారు', hi: 'छुट्टी पर' },
  'status.in_queue': { en: 'In Queue', te: 'క్యూలో ఉన్నారు', hi: 'कतार में' },
  'status.no_show': { en: 'No Show', te: 'రాలేదు', hi: 'नहीं आए' },
  'status.on_hold': { en: 'On Hold', te: 'నిలిపివేయబడింది', hi: 'रोका गया' },
  'status.active': { en: 'Active', te: 'యాక్టివ్', hi: 'सक्रिय' },
  'status.inactive': { en: 'Inactive', te: 'నిష్క్రియం', hi: 'निष्क्रिय' },
  'status.refunded': { en: 'Refunded', te: 'రీఫండ్ చేయబడింది', hi: 'रिफ़ंड हो गया' },
  'status.paid_online': { en: 'Paid Online', te: 'ఆన్‌లైన్‌లో చెల్లించారు', hi: 'ऑनलाइन भुगतान किया' },
  'status.paid_at_hospital': { en: 'Paid at Hospital', te: 'ఆసుపత్రిలో చెల్లించారు', hi: 'अस्पताल में भुगतान किया' },
  'status.hospital_closed': { en: 'Hospital Closed', te: 'ఆసుపత్రి మూసి ఉంది', hi: 'अस्पताल बंद है' },
  'status.unavailable': { en: 'Unavailable', te: 'అందుబాటులో లేరు', hi: 'उपलब्ध नहीं' },
  'status.regular': { en: 'Regular', te: 'రెగ్యులర్', hi: 'नियमित' },
  'status.new': { en: 'New', te: 'కొత్త', hi: 'नया' },
  'status.scheduled': { en: 'Scheduled', te: 'షెడ్యూల్ చేయబడింది', hi: 'निर्धारित' },
  'status.checked_in': { en: 'Checked In', te: 'చెక్-ఇన్ అయ్యారు', hi: 'चेक-इन हो गया' },
  'status.in_progress': { en: 'In Progress', te: 'జరుగుతోంది', hi: 'चल रहा है' },
  'status.paid': { en: 'Paid', te: 'చెల్లించారు', hi: 'भुगतान हो गया' },
  'status.success': { en: 'Success', te: 'విజయవంతం', hi: 'सफल' },
  'status.failed': { en: 'Failed', te: 'విఫలమైంది', hi: 'असफल' },
  'status.booked': { en: 'Booked', te: 'బుక్ అయింది', hi: 'बुक हुआ' },
}
