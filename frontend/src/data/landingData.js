/**
 * Static / dummy data for the TapCure landing page.
 * No API calls — everything here is placeholder content for the UI.
 */
import {
  Stethoscope,
  Clock,
  MapPin,
  ShieldCheck,
  IndianRupee,
  Headphones,
  Search,
  CalendarDays,
  Ticket,
  Building2,
  Activity,
  Flame,
  PersonStanding,
  HeartPulse,
  Scale,
  Baby,
  Ruler,
  Target,
} from 'lucide-react'

export const BRAND = {
  name: 'TapCure',
  tagline: 'One tap to cure',
  city: 'Vijayawada',
}

export const NAV_LINKS = ['Find Doctors', 'Find Hospitals', 'Health Articles']

export const LANGUAGES = ['English', 'हिंदी', 'తెలుగు']

export const POPULAR_SEARCHES = [
  'Dentist',
  'Gynecologist',
  'Pediatrician',
  'Orthopedic',
  'Cardiologist',
]

// Only the most important / commonly used calculators (kept uncluttered).
export const HEALTH_CALCULATORS = [
  { label: 'BMI Calculator', short: 'BMI', icon: Scale },
  { label: 'Calorie Calculator', icon: Flame },
  { label: 'Body Fat Calculator', icon: PersonStanding },
  { label: 'BMR Calculator', icon: Activity },
  { label: 'Ideal Weight Calculator', icon: HeartPulse },
  { label: 'Pregnancy Calculator', icon: Baby },
  { label: 'Waist-to-Height Ratio', short: 'WHtR', icon: Ruler },
  { label: 'Weight Goal Calculator', icon: Target },
]

export const FEATURES = [
  {
    key: 'trustedDoctors',
    title: 'Trusted Doctors',
    desc: 'Verified & experienced doctors you can trust.',
    icon: ShieldCheck,
  },
  {
    key: 'saveTime',
    title: 'Save Time',
    desc: 'Get token and visit the hospital on time.',
    icon: Clock,
  },
  {
    key: 'nearbyHospitals',
    title: 'Nearby Hospitals',
    desc: 'Find hospitals near you.',
    icon: MapPin,
  },
  {
    key: 'secureEasy',
    title: 'Secure & Easy',
    desc: 'Your data is safe and 100% secure.',
    icon: ShieldCheck,
  },
  {
    key: 'affordableCare',
    title: 'Affordable Care',
    desc: 'Quality healthcare that fits your budget.',
    icon: IndianRupee,
  },
  {
    key: 'support247',
    title: '24/7 Support',
    desc: "We're here to help you anytime.",
    icon: Headphones,
  },
]

export const HOW_IT_WORKS = [
  {
    step: 1,
    key: 'search',
    title: 'Search',
    desc: 'Search doctors or hospitals by name, specialty or symptoms.',
    icon: Search,
  },
  {
    step: 2,
    key: 'book',
    title: 'Book',
    desc: 'Choose your preferred date & time and book appointment.',
    icon: CalendarDays,
  },
  {
    step: 3,
    key: 'getToken',
    title: 'Get Token',
    desc: 'Receive your token instantly on SMS & app.',
    icon: Ticket,
  },
  {
    step: 4,
    key: 'visitOnTime',
    title: 'Visit on Time',
    desc: 'Reach the hospital at the right time and skip the queue.',
    icon: Building2,
  },
]

export const TESTIMONIALS = [
  {
    key: 'ramesh',
    quote:
      'TapCure helped me save so much time. I got my token before reaching the hospital and the experience was smooth.',
    name: 'Ramesh B.',
    city: 'Vijayawada',
    rating: 5,
  },
]

export const FEATURE_ICON = Stethoscope

/**
 * Dummy credentials (UI reference only — NO auth logic wired up yet).
 *  Home user   : user@tapcure.com   / User@123
 *  Hospital user : hospital@tapcure.com / Hospital@123
 *  Admin       : admin@tapcure.com  / Admin@123
 *  Static OTP  : 123456
 */
export const DUMMY_CREDENTIALS = {
  home: { email: 'user@tapcure.com', password: 'User@123' },
  hospital: { email: 'hospital@tapcure.com', password: 'Hospital@123' },
  admin: { email: 'admin@tapcure.com', password: 'Admin@123' },
  otp: '123456',
}
