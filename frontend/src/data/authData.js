/**
 * Static data + dummy credentials for the auth screens.
 *
 *  ⚠️  REMOVE these dummy credentials before connecting a real backend —
 *      they are visible in the browser and are for prototype/demo only.
 */
import {
  ShieldCheck,
  Ticket,
  Lock,
  CalendarDays,
  ListChecks,
  ClipboardList,
  Stethoscope,
  Baby,
  HeartPulse,
  HandHeart,
  Bone,
  Heart,
  Ear,
  Eye,
  Smile,
  PersonStanding,
  Brain,
  Apple,
} from 'lucide-react'

export const DUMMY = {
  patient: [{ email: 'patient@tapcure.com', password: 'Patient@123' }],
  doctor: [{ email: 'doctor@citycare.com', password: 'Doctor@123' }],
  hospital: [
    { email: 'admin@citycare.com', password: 'Admin@123' },
    { email: 'reception@citycare.com', password: 'Recep@123' },
  ],
  otp: '123456',
}

/** Per-role configuration that drives the shared AuthModal. */
export const AUTH_ROLES = {
  patient: {
    key: 'patient',
    redirect: '/patient-dashboard',
    brand: {
      title: 'Your health journey starts here',
      subtitle: 'Book doctors, get tokens, and avoid long waiting queues.',
      benefits: [
        { icon: ShieldCheck, title: 'Verified doctors', desc: 'Trusted & experienced doctors you can rely on.' },
        { icon: Ticket, title: 'Instant token booking', desc: 'Get tokens in seconds and skip the long lines.' },
        { icon: Lock, title: 'Secure health access', desc: 'Your data is safe, private and protected.' },
      ],
    },
    login: {
      title: 'Welcome back',
      subtitle: 'Login or create your account to book appointments and manage tokens.',
    },
    signup: {
      title: 'Create your account',
      subtitle: 'Join TapCure to book appointments and get tokens faster.',
    },
  },
  doctor: {
    key: 'doctor',
    redirect: '/doctor-dashboard',
    brand: {
      title: 'Care for more patients, effortlessly',
      subtitle: 'Manage appointments, tokens and patient history in one place.',
      benefits: [
        { icon: CalendarDays, title: 'Smart appointments', desc: 'Organise your day and reduce no-shows.' },
        { icon: ListChecks, title: 'Live token queue', desc: 'Call patients in order, skip the chaos.' },
        { icon: ClipboardList, title: 'Patient history', desc: 'Access visit history securely, anytime.' },
      ],
    },
    login: {
      title: 'Doctor Login',
      subtitle: 'Sign in to manage your appointments, tokens and patients.',
    },
    signup: {
      title: 'Create your doctor account',
      subtitle: 'Join TapCure to manage your practice digitally.',
    },
  },
}

export const CITIES = [
  'Vijayawada',
  'Hyderabad',
  'Guntur',
  'Visakhapatnam',
  'Bengaluru',
  'Chennai',
]

/* ⚠ The first twelve names are matched EXACTLY by data/symptomSpecialty.js,
   which maps a patient's symptoms to a specialty and then filters doctors by
   that string. Renaming one silently breaks the symptom helper for that
   specialty — free text had already produced "Dentist" and "Psychology" in the
   database, neither of which the helper can match against "Dental"/"Psychiatry".
   Add freely below; rename nothing above without updating symptomSpecialty.js. */
export const SPECIALIZATIONS = [
  // — known to the symptom helper —
  'General Physician',
  'Pediatrics',
  'Gynecology',
  'Dermatology',
  'Orthopedics',
  'Cardiology',
  'ENT',
  'Ophthalmology',
  'Dental',
  'Physiotherapy',
  'Psychiatry',
  'Nutrition',
  // — additional specialties —
  'General Surgery',
  'Neurology',
  'Neurosurgery',
  'Nephrology',
  'Urology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Diabetology',
  'Oncology',
  'Rheumatology',
  'Hematology',
  'Plastic Surgery',
  'Radiology',
  'Anesthesiology',
  'Pathology',
  'Emergency Medicine',
  'Geriatrics',
  'Speech Therapy',
  'Audiology',
  'Ayurveda',
  'Homeopathy',
  'Unani',
  'Siddha',
  'Naturopathy & Yoga',
]

/* Recognised medical qualifications, grouped by level.
   Qualification used to be a free-text box, so a registering doctor could type
   anything at all — "Mechanical Engineer" included. Grouped rather than one flat
   list because doctors typically hold one from each level (an MBBS plus an MD
   plus a super-specialty), and the picker is multi-select for that reason. */
export const QUALIFICATION_GROUPS = [
  {
    label: 'Undergraduate',
    items: [
      'MBBS', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'BSMS', 'BNYS', 'BPT', 'B.Sc Nursing',
    ],
  },
  {
    label: 'Postgraduate',
    items: [
      'MD', 'MS', 'MDS', 'DNB', 'MPT', 'M.Sc Nursing', 'MPH', 'M.Ch (Dental)',
    ],
  },
  {
    label: 'Super-specialty',
    items: ['DM', 'MCh', 'DrNB'],
  },
  {
    label: 'Diploma',
    items: [
      'DCH (Child Health)', 'DGO (Obs & Gynae)', 'DA (Anaesthesia)',
      'DO (Ophthalmology)', 'DLO (ENT)', 'DMRD (Radiodiagnosis)',
      'DPM (Psychiatry)', 'DDVL (Dermatology)', 'DCP (Pathology)',
      'DOrtho (Orthopaedics)', 'DTCD (TB & Chest)',
    ],
  },
  {
    label: 'Fellowship / Membership',
    items: [
      'DrNB (Super-specialty)', 'FNB', 'MRCP', 'MRCS', 'MRCOG', 'MRCPCH',
      'FRCS', 'FRCP', 'FCPS', 'FICS', 'FACS', 'FAGE',
    ],
  },
  {
    label: 'Academic',
    items: ['PhD', 'M.Phil'],
  },
]

/** Flat list — handy for validating a stored value against the catalogue. */
export const QUALIFICATIONS = QUALIFICATION_GROUPS.flatMap((g) => g.items)

/* Languages a doctor may consult in. English names (not native script) to match
   the patient profile's language list and to keep the stored value searchable.
   Free text here had produced "telugu", "Hindi , telugu", "Telugu ,Hindi" and
   "Engish" — eight distinct strings for three languages. */
export const DOCTOR_LANGUAGES = [
  'English',
  'Hindi',
  'Telugu',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Gujarati',
  'Punjabi',
  'Odia',
  'Urdu',
  'Assamese',
]

/* ---- Hospital registration options ---- */
export const HOSPITAL_TYPES = [
  'General Hospital',
  'Dental Hospital',
  'Eye Hospital',
  'Children Hospital',
  'Multi-speciality Hospital',
  'Diagnostic Hospital',
]

export const CONSULT_TIMES = [
  '5 minutes',
  '10 minutes',
  '15 minutes',
  '20 minutes',
  '30 minutes',
]

export const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Hospital service / specialty options — each with its own icon + colour. */
export const SERVICE_OPTIONS = [
  { label: 'General Physician', icon: Stethoscope, color: 'green' },
  { label: 'Pediatrics', icon: Baby, color: 'sky' },
  { label: 'Gynecology', icon: HeartPulse, color: 'pink' },
  { label: 'Dermatology', icon: HandHeart, color: 'blue' },
  { label: 'Orthopedics', icon: Bone, color: 'green' },
  { label: 'Cardiology', icon: Heart, color: 'red' },
  { label: 'ENT', icon: Ear, color: 'blue' },
  { label: 'Ophthalmology', icon: Eye, color: 'blue' },
  { label: 'Dental', icon: Smile, color: 'sky' },
  { label: 'Physiotherapy', icon: PersonStanding, color: 'blue' },
  { label: 'Psychiatry', icon: Brain, color: 'violet' },
  { label: 'Nutrition', icon: Apple, color: 'red' },
]
