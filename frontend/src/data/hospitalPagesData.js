/** Static dummy data for the hospital sub-pages (appointments, doctors, etc.). */

/* ---------------- Appointments ---------------- */
export const APPT_STATS = [
  { value: 68, label: 'Total Today', tone: 'blue' },
  { value: 42, label: 'Confirmed', tone: 'green' },
  { value: 18, label: 'Pending', tone: 'orange' },
  { value: 8, label: 'Cancelled', tone: 'red' },
]

export const APPOINTMENTS = [
  { id: 'APT-1009', patient: 'Mrs. Sunita Patel', age: '45 / F', doctor: 'Dr. Rahul Sharma', specialty: 'General Physician', time: '10:30 AM', type: 'Consultation', status: 'Confirmed' },
  { id: 'APT-1010', patient: 'Mr. Arvind Singh', age: '52 / M', doctor: 'Dr. Neha Rao', specialty: 'Cardiology', time: '10:45 AM', type: 'Follow-up', status: 'Confirmed' },
  { id: 'APT-1011', patient: 'Miss. Pooja Verma', age: '28 / F', doctor: 'Dr. Imran Ali', specialty: 'Dermatology', time: '11:00 AM', type: 'Consultation', status: 'Pending' },
  { id: 'APT-1012', patient: 'Mr. Imran Khan', age: '41 / M', doctor: 'Dr. Rahul Sharma', specialty: 'General Physician', time: '11:15 AM', type: 'Consultation', status: 'Confirmed' },
  { id: 'APT-1013', patient: 'Mrs. Neha Gupta', age: '36 / F', doctor: 'Dr. Kavita Menon', specialty: 'Gynecology', time: '11:30 AM', type: 'Follow-up', status: 'Pending' },
  { id: 'APT-1014', patient: 'Mr. Mahesh Joshi', age: '60 / M', doctor: 'Dr. Neha Rao', specialty: 'Cardiology', time: '11:45 AM', type: 'Consultation', status: 'Completed' },
  { id: 'APT-1015', patient: 'Mrs. Kavita Sharma', age: '33 / F', doctor: 'Dr. Imran Ali', specialty: 'Dermatology', time: '12:00 PM', type: 'Consultation', status: 'Cancelled' },
  { id: 'APT-1016', patient: 'Mr. Sandeep Yadav', age: '47 / M', doctor: 'Dr. Rahul Sharma', specialty: 'General Physician', time: '12:15 PM', type: 'Follow-up', status: 'Confirmed' },
  { id: 'APT-1017', patient: 'Miss. Anjali Mehta', age: '29 / F', doctor: 'Dr. Kavita Menon', specialty: 'Gynecology', time: '12:30 PM', type: 'Consultation', status: 'Pending' },
]

/* ---------------- Walk-ins ---------------- */
export const WALKIN_STATS = [
  { value: 14, label: 'Walk-ins Today', tone: 'blue' },
  { value: 5, label: 'In Queue', tone: 'orange' },
  { value: 9, label: 'Completed', tone: 'green' },
]

export const WALKINS = [
  { token: 'WLK-21', name: 'Mr. Rohit Das', age: '38 / M', time: '10:05 AM', reason: 'Fever / Cold', status: 'Completed' },
  { token: 'WLK-22', name: 'Mrs. Lata Nair', age: '54 / F', time: '10:25 AM', reason: 'Follow-up', status: 'Completed' },
  { token: 'WLK-23', name: 'Mr. Karan Bhatt', age: '24 / M', time: '10:40 AM', reason: 'Injury', status: 'In Consultation' },
  { token: 'WLK-24', name: 'Miss. Divya Rao', age: '31 / F', time: '10:55 AM', reason: 'General Consultation', status: 'In Queue' },
  { token: 'WLK-25', name: 'Mr. Ashok Pillai', age: '49 / M', time: '11:10 AM', reason: 'Fever / Cold', status: 'In Queue' },
  { token: 'WLK-26', name: 'Mrs. Sneha Iyer', age: '27 / F', time: '11:20 AM', reason: 'Vaccination', status: 'In Queue' },
]

/* ---------------- Doctors ---------------- */
export const DOCTOR_STATS = [
  { value: 8, label: 'Total Doctors', tone: 'blue' },
  { value: 5, label: 'Available Now', tone: 'green' },
  { value: 2, label: 'On Leave', tone: 'orange' },
]

export const DOCTORS = [
  { name: 'Dr. Rahul Sharma', specialty: 'General Physician', status: 'Available', patients: 18, rating: 4.8, room: 'Room 2', exp: '12 yrs' },
  { name: 'Dr. Neha Rao', specialty: 'Cardiology', status: 'Busy', patients: 11, rating: 4.9, room: 'Room 5', exp: '15 yrs' },
  { name: 'Dr. Imran Ali', specialty: 'Dermatology', status: 'Available', patients: 9, rating: 4.7, room: 'Room 3', exp: '8 yrs' },
  { name: 'Dr. Kavita Menon', specialty: 'Gynecology', status: 'Available', patients: 14, rating: 4.9, room: 'Room 1', exp: '10 yrs' },
  { name: 'Dr. Sanjay Patel', specialty: 'Orthopedics', status: 'On Leave', patients: 0, rating: 4.6, room: '—', exp: '14 yrs' },
  { name: 'Dr. Priya Nair', specialty: 'Pediatrics', status: 'Available', patients: 16, rating: 4.8, room: 'Room 4', exp: '9 yrs' },
]

/* ---------------- Availability ---------------- */
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SLOTS = ['Morning', 'Afternoon', 'Evening']

// availability[doctorIndex][day][slot] = boolean
export const AVAILABILITY = {
  'Dr. Rahul Sharma': {
    Mon: ['Morning', 'Evening'], Tue: ['Morning', 'Afternoon'], Wed: ['Morning', 'Evening'],
    Thu: ['Morning', 'Afternoon', 'Evening'], Fri: ['Morning', 'Evening'], Sat: ['Morning'], Sun: [],
  },
  'Dr. Neha Rao': {
    Mon: ['Afternoon', 'Evening'], Tue: ['Morning', 'Evening'], Wed: ['Afternoon'],
    Thu: ['Morning', 'Afternoon'], Fri: ['Evening'], Sat: ['Morning', 'Afternoon'], Sun: [],
  },
  'Dr. Kavita Menon': {
    Mon: ['Morning'], Tue: ['Morning', 'Afternoon', 'Evening'], Wed: ['Morning', 'Evening'],
    Thu: ['Afternoon'], Fri: ['Morning', 'Afternoon'], Sat: ['Morning', 'Evening'], Sun: ['Morning'],
  },
}

/* ---------------- Reports ---------------- */
export const REPORT_KPIS = [
  { value: '1,284', label: 'Total Visits', tone: 'blue', delta: '+12%' },
  { value: '1,540', label: 'Tokens Generated', tone: 'teal', delta: '+8%' },
  { value: '16 min', label: 'Avg Wait Time', tone: 'orange', delta: '-5%' },
  { value: '₹2.4L', label: 'Revenue', tone: 'green', delta: '+18%' },
]

// visits per weekday
export const VISITS_WEEK = [
  { day: 'Mon', value: 180 },
  { day: 'Tue', value: 210 },
  { day: 'Wed', value: 165 },
  { day: 'Thu', value: 240 },
  { day: 'Fri', value: 220 },
  { day: 'Sat', value: 260 },
  { day: 'Sun', value: 120 },
]

export const DEPT_SPLIT = [
  { label: 'General', value: 38, color: '#2563eb' },
  { label: 'Cardiology', value: 22, color: '#16a34a' },
  { label: 'Dermatology', value: 18, color: '#f97316' },
  { label: 'Gynecology', value: 14, color: '#a855f7' },
  { label: 'Others', value: 8, color: '#14b8a6' },
]

export const TOP_DOCTORS = [
  { name: 'Dr. Rahul Sharma', specialty: 'General Physician', consults: 312, rating: 4.8 },
  { name: 'Dr. Priya Nair', specialty: 'Pediatrics', consults: 268, rating: 4.8 },
  { name: 'Dr. Kavita Menon', specialty: 'Gynecology', consults: 241, rating: 4.9 },
  { name: 'Dr. Neha Rao', specialty: 'Cardiology', consults: 198, rating: 4.9 },
]

/* ---------------- Sidebar nav ---------------- */
export const HOSPITAL_NAV = [
  { label: 'Dashboard', to: '/hospital-dashboard', icon: 'Home', end: true },
  { label: 'Appointments', to: '/hospital-dashboard/appointments', icon: 'CalendarDays' },
  { label: 'OP Queue', to: '/hospital-dashboard/op-queue', icon: 'Users' },
  { label: 'Doctors', to: '/hospital-dashboard/doctors', icon: 'Stethoscope' },
  { label: 'Departments', to: '/hospital-dashboard/departments', icon: 'Building2' },
  { label: 'Staff', to: '/hospital-dashboard/staff', icon: 'UserCog' },
  { label: 'Availability', to: '/hospital-dashboard/availability', icon: 'Clock' },
  { label: 'Reports', to: '/hospital-dashboard/reports', icon: 'BarChart3' },
  { label: 'Plan & Bookings', to: '/hospital-dashboard/plan', icon: 'CreditCard' },
  { label: 'Hospital Profile', to: '/hospital-dashboard/profile', icon: 'Settings' },
]
