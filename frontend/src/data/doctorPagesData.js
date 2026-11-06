/**
 * Static mock data for every doctor-console sub-page.
 * Prototype only — replace with API calls when the backend lands.
 */

/* ---------------- Appointments ---------------- */
export const TODAY_APPTS = [
  { time: '09:00 AM', patient: 'Sunita Devi', age: '54 / F', type: 'Online', token: 14, status: 'Completed', payment: 'Paid Online' },
  { time: '09:20 AM', patient: 'Ramesh B.', age: '34 / M', type: 'Online', token: 16, status: 'In Consultation', payment: 'Paid at Hospital' },
  { time: '09:40 AM', patient: 'Suresh Kumar', age: '47 / M', type: 'Online', token: 17, status: 'Waiting', payment: 'Paid at Hospital' },
  { time: '10:00 AM', patient: 'Anitha P.', age: '29 / F', type: 'Online', token: 18, status: 'Waiting', payment: 'Pending' },
  { time: '10:20 AM', patient: 'Mohan L.', age: '52 / M', type: 'Walk-in', token: 19, status: 'Waiting', payment: 'Paid at Hospital' },
  { time: '10:40 AM', patient: 'Kavitha R.', age: '38 / F', type: 'Online', token: 20, status: 'Waiting', payment: 'Pending' },
  { time: '11:20 AM', patient: 'Rajesh Kumar', age: '45 / M', type: 'Online', token: 22, status: 'Confirmed', payment: 'Paid Online' },
  { time: '11:40 AM', patient: 'Fatima S.', age: '31 / F', type: 'Online', token: 23, status: 'Confirmed', payment: 'Pending' },
]

export const ALL_APPTS = [
  { date: '12 Jun 2025', time: '09:00 AM', patient: 'Sunita Devi', doctor: 'Dr. Ramesh Kumar', type: 'Online', status: 'Completed' },
  { date: '12 Jun 2025', time: '09:20 AM', patient: 'Ramesh B.', doctor: 'Dr. Ramesh Kumar', type: 'Online', status: 'In Consultation' },
  { date: '12 Jun 2025', time: '10:20 AM', patient: 'Mohan L.', doctor: 'Dr. Ramesh Kumar', type: 'Walk-in', status: 'Waiting' },
  { date: '11 Jun 2025', time: '04:30 PM', patient: 'Arjun Nair', doctor: 'Dr. Ramesh Kumar', type: 'Online', status: 'Completed' },
  { date: '11 Jun 2025', time: '05:00 PM', patient: 'Deepa Iyer', doctor: 'Dr. Ramesh Kumar', type: 'Online', status: 'Cancelled' },
  { date: '10 Jun 2025', time: '11:00 AM', patient: 'Vikram Patel', doctor: 'Dr. Ramesh Kumar', type: 'Walk-in', status: 'Completed' },
  { date: '10 Jun 2025', time: '11:30 AM', patient: 'Neha Gupta', doctor: 'Dr. Ramesh Kumar', type: 'Online', status: 'No Show' },
  { date: '09 Jun 2025', time: '09:45 AM', patient: 'Imran Khan', doctor: 'Dr. Ramesh Kumar', type: 'Online', status: 'Completed' },
]

export const CANCELLATIONS = [
  { date: '11 Jun 2025', patient: 'Deepa Iyer', token: 31, reason: 'Patient cancelled', type: 'Cancelled', refund: 'Refunded' },
  { date: '10 Jun 2025', patient: 'Neha Gupta', token: 28, reason: 'Did not arrive', type: 'No Show', refund: '—' },
  { date: '09 Jun 2025', patient: 'Sanjay Verma', token: 21, reason: 'Rescheduled', type: 'Cancelled', refund: 'Refunded' },
  { date: '08 Jun 2025', patient: 'Pooja Reddy', token: 17, reason: 'Did not arrive', type: 'No Show', refund: '—' },
  { date: '07 Jun 2025', patient: 'Aarav Sharma', token: 12, reason: 'Hospital closed early', type: 'Cancelled', refund: 'Refunded' },
]

export const RECENT_WALKINS = [
  { token: 19, name: 'Mohan L.', mobile: '98765 43210', reason: 'Fever / Cold', time: '10:20 AM', status: 'Waiting' },
  { token: 23, name: 'Mohan Singh', mobile: '99887 76655', reason: 'Follow-up', time: '10:48 AM', status: 'Waiting' },
  { token: 15, name: 'Lakshmi N.', mobile: '90123 45678', reason: 'Injury', time: '09:30 AM', status: 'Completed' },
]

/* ---------------- Queue ---------------- */
export const TOKEN_HISTORY = [
  { date: '12 Jun 2025', token: 14, patient: 'Sunita Devi', issued: '08:55 AM', seen: '09:02 AM', waited: '7 mins', status: 'Completed' },
  { date: '12 Jun 2025', token: 13, patient: 'Gopal Rao', issued: '08:40 AM', seen: '08:46 AM', waited: '6 mins', status: 'Completed' },
  { date: '11 Jun 2025', token: 41, patient: 'Arjun Nair', issued: '04:20 PM', seen: '04:33 PM', waited: '13 mins', status: 'Completed' },
  { date: '11 Jun 2025', token: 40, patient: 'Deepa Iyer', issued: '04:10 PM', seen: '—', waited: '—', status: 'No Show' },
  { date: '10 Jun 2025', token: 33, patient: 'Vikram Patel', issued: '10:50 AM', seen: '11:05 AM', waited: '15 mins', status: 'Completed' },
  { date: '10 Jun 2025', token: 32, patient: 'Neha Gupta', issued: '10:40 AM', seen: '—', waited: '—', status: 'No Show' },
]

export const DELAY_LOG = [
  { time: '15 mins ago', minutes: 20, count: 8, channel: 'SMS + App' },
  { time: 'Yesterday, 05:10 PM', minutes: 15, count: 5, channel: 'SMS' },
  { time: '10 Jun, 11:20 AM', minutes: 30, count: 12, channel: 'SMS + App' },
]

/* ---------------- Schedule ---------------- */
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const SLOTS = ['Morning', 'Afternoon', 'Evening']
export const SLOT_TIME = { Morning: '9 AM – 12 PM', Afternoon: '12 PM – 4 PM', Evening: '4 PM – 9 PM' }
export const MY_AVAILABILITY = {
  Mon: ['Morning', 'Evening'], Tue: ['Morning', 'Afternoon', 'Evening'], Wed: ['Morning', 'Evening'],
  Thu: ['Morning', 'Afternoon'], Fri: ['Morning', 'Afternoon', 'Evening'], Sat: ['Morning'], Sun: [],
}

export const HOLIDAYS = [
  { date: '15 Aug 2025', name: 'Independence Day', type: 'Public Holiday', status: 'Hospital Closed' },
  { date: '20 Jun 2025', name: 'Personal Leave', type: 'Doctor Leave', status: 'Unavailable' },
  { date: '02 Oct 2025', name: 'Gandhi Jayanti', type: 'Public Holiday', status: 'Hospital Closed' },
  { date: '25 Dec 2025', name: 'Christmas', type: 'Public Holiday', status: 'Hospital Closed' },
]

export const FEES = [
  { type: 'New Consultation', fee: 500, duration: '15 mins', follow: 'Standard first visit' },
  { type: 'Follow-up Visit', fee: 300, duration: '10 mins', follow: 'Within 14 days' },
  { type: 'Online Consultation', fee: 400, duration: '15 mins', follow: 'Video / audio call' },
  { type: 'Walk-in Consultation', fee: 450, duration: '15 mins', follow: 'No prior booking' },
]

/* ---------------- Patients ---------------- */
export const PATIENTS = [
  { name: 'Sunita Devi', age: '54 / F', mobile: '98765 11223', lastVisit: '12 Jun 2025', visits: 8, tag: 'Regular' },
  { name: 'Ramesh B.', age: '34 / M', mobile: '98765 43210', lastVisit: '12 Jun 2025', visits: 3, tag: 'Regular' },
  { name: 'Rajesh Kumar', age: '45 / M', mobile: '91234 56789', lastVisit: '12 Jun 2025', visits: 1, tag: 'New' },
  { name: 'Arjun Nair', age: '40 / M', mobile: '90909 80808', lastVisit: '11 Jun 2025', visits: 12, tag: 'Regular' },
  { name: 'Deepa Iyer', age: '36 / F', mobile: '93456 12345', lastVisit: '11 Jun 2025', visits: 2, tag: 'New' },
  { name: 'Vikram Patel', age: '50 / M', mobile: '99887 66554', lastVisit: '10 Jun 2025', visits: 6, tag: 'Regular' },
  { name: 'Fatima S.', age: '31 / F', mobile: '90011 22334', lastVisit: '—', visits: 0, tag: 'New' },
]

/* ---------------- Reports & Analytics ---------------- */
export const REPORT_KPIS = [
  { label: 'Total Patients', value: '1,248', delta: '+8.2%', tone: 'blue' },
  { label: 'Consultations', value: '982', delta: '+5.1%', tone: 'green' },
  { label: 'Revenue', value: '₹4.6L', delta: '+12.4%', tone: 'teal' },
  { label: 'Avg Wait Time', value: '14 min', delta: '-3.0%', tone: 'orange' },
]
export const VISITS_WEEK = [
  { day: 'Mon', value: 42 }, { day: 'Tue', value: 55 }, { day: 'Wed', value: 38 },
  { day: 'Thu', value: 61 }, { day: 'Fri', value: 49 }, { day: 'Sat', value: 72 }, { day: 'Sun', value: 20 },
]
export const APPT_TYPE_SPLIT = [
  { label: 'Online', value: 62, tone: 'bg-brand-blue' },
  { label: 'Walk-in', value: 28, tone: 'bg-brand-green' },
  { label: 'Follow-up', value: 10, tone: 'bg-purple-500' },
]
export const ANALYTICS_METRICS = [
  { label: 'Avg Consultation', value: '8 min' },
  { label: 'No-Show Rate', value: '4.2%' },
  { label: 'Repeat Patients', value: '68%' },
  { label: 'Peak Hour', value: '10–11 AM' },
  { label: 'Busiest Day', value: 'Saturday' },
  { label: 'On-time Rate', value: '91%' },
]

/* ---------------- Communication ---------------- */
export const ALL_NOTIFICATIONS = [
  { kind: 'appt', title: 'New appointment booked', desc: 'Rajesh Kumar at 11:20 AM', time: '2 mins ago', unread: true },
  { kind: 'arrived', title: 'Patient in queue arrived', desc: 'Anitha P. (Token 18) has arrived', time: '5 mins ago', unread: true },
  { kind: 'delay', title: 'Doctor delay alert sent', desc: 'Delay sent to 8 patients', time: '15 mins ago', unread: false },
  { kind: 'walkin', title: 'Walk-in patient added', desc: 'Mohan Singh added (Token 23)', time: '20 mins ago', unread: false },
  { kind: 'appt', title: 'Appointment cancelled', desc: 'Deepa Iyer cancelled 05:00 PM slot', time: '1 hr ago', unread: false },
  { kind: 'arrived', title: 'Payment received', desc: '₹500 from Sunita Devi (Online)', time: '2 hrs ago', unread: false },
]

export const MESSAGES = [
  { name: 'Sunita Devi', preview: 'Thank you doctor, feeling much better now.', time: '10:30 AM', unread: 0 },
  { name: 'Front Desk', preview: 'Token 22 patient is waiting at reception.', time: '10:18 AM', unread: 2 },
  { name: 'Rajesh Kumar', preview: 'Can I reschedule to the evening slot?', time: '09:50 AM', unread: 1 },
  { name: 'Pharmacy', preview: 'Prescription for Ramesh B. is ready.', time: '09:22 AM', unread: 0 },
  { name: 'Anitha P.', preview: 'I have arrived, waiting outside.', time: '09:05 AM', unread: 0 },
]

/* ---------------- Settings ---------------- */
export const HOSPITAL_PROFILE = {
  name: 'City Care Hospital',
  doctor: 'Dr. Ramesh Kumar',
  specialty: 'General Physician',
  reg: 'KA/2018/04521',
  email: 'citycare@tapcure.com',
  phone: '+91 98765 43210',
  address: '12, MG Road, Bengaluru, Karnataka 560001',
  established: '2018',
}

export const STAFF = [
  { name: 'Dr. Ramesh Kumar', role: 'Doctor', email: 'ramesh@citycare.in', status: 'Active' },
  { name: 'Priya Menon', role: 'Front Desk', email: 'priya@citycare.in', status: 'Active' },
  { name: 'Suresh Babu', role: 'Pharmacist', email: 'suresh@citycare.in', status: 'Active' },
  { name: 'Anjali Rao', role: 'Nurse', email: 'anjali@citycare.in', status: 'On Leave' },
  { name: 'Karthik V.', role: 'Receptionist', email: 'karthik@citycare.in', status: 'Inactive' },
]

export const SETTING_GROUPS = [
  {
    group: 'Notifications', items: [
      { label: 'SMS alerts to patients', desc: 'Send booking & delay updates via SMS', on: true },
      { label: 'App push notifications', desc: 'Notify patients in the mobile app', on: true },
      { label: 'Email summaries', desc: 'Daily appointment summary email', on: false },
    ],
  },
  {
    group: 'Queue', items: [
      { label: 'Auto-call next token', desc: 'Advance the queue automatically', on: false },
      { label: 'Wait-time SLA alerts', desc: 'Flag patients waiting over 20 mins', on: true },
    ],
  },
  {
    group: 'Account', items: [
      { label: 'Two-factor authentication', desc: 'Extra security at login', on: true },
      { label: 'Show profile to patients', desc: 'List hospital publicly on TapCure', on: true },
    ],
  },
]
