/** Static dummy data for the Hospital OP Queue dashboard. */
import { CalendarDays, PlayCircle, Users, CheckCircle2, UserX } from 'lucide-react'

export const HOSPITAL = {
  name: 'City Care Hospital',
  admin: 'Dr. Rahul Sharma',
  role: 'Admin',
  date: '23 May 2025',
  notifications: 6,
}

export const STATS = [
  { value: 68, label: "Today's Appointments", icon: CalendarDays, tone: 'blue' },
  { value: 12, label: 'Arrived Patients', icon: PlayCircle, tone: 'green' },
  { value: 18, label: 'Waiting Patients', icon: Users, tone: 'purple' },
  { value: 26, label: 'Completed Patients', icon: CheckCircle2, tone: 'teal' },
  { value: 2, label: 'No-Shows', icon: UserX, tone: 'orange' },
]

export const CURRENT_TOKEN = {
  token: 'OPD-012',
  name: 'Mr. Ramesh Kumar',
  age: '34 Years, Male',
  type: 'Consultation',
  doctor: 'Dr. Rahul Sharma',
  specialty: 'General Physician',
  since: '10:20 AM',
  elapsed: '18 mins',
}

export const NEXT_TOKENS = [
  { token: 'OPD-013', name: 'Mrs. Sunita Patel', age: '45 / Female', status: 'Waiting' },
  { token: 'OPD-014', name: 'Mr. Arvind Singh', age: '52 / Male', status: 'Waiting' },
  { token: 'OPD-015', name: 'Miss. Pooja Verma', age: '28 / Female', status: 'Waiting' },
  { token: 'OPD-016', name: 'Mr. Imran Khan', age: '41 / Male', status: 'Waiting' },
  { token: 'OPD-017', name: 'Mrs. Neha Gupta', age: '36 / Female', status: 'Waiting' },
]

export const WAITING = [
  { token: 'OPD-013', name: 'Mrs. Sunita Patel', age: '45 / Female', appt: '10:30 AM', since: '10:28 AM (22 mins)', status: 'Waiting' },
  { token: 'OPD-014', name: 'Mr. Arvind Singh', age: '52 / Male', appt: '10:45 AM', since: '10:42 AM (8 mins)', status: 'Waiting' },
  { token: 'OPD-015', name: 'Miss. Pooja Verma', age: '28 / Female', appt: '11:00 AM', since: '10:58 AM (12 mins)', status: 'Waiting' },
  { token: 'OPD-016', name: 'Mr. Imran Khan', age: '41 / Male', appt: '11:15 AM', since: '11:12 AM (8 mins)', status: 'Waiting' },
  { token: 'OPD-017', name: 'Mrs. Neha Gupta', age: '36 / Female', appt: '11:30 AM', since: '11:28 AM (2 mins)', status: 'Waiting' },
]

export const ARRIVED = [
  { token: 'OPD-008', name: 'Mr. Mahesh Joshi', age: '60 / Male', arrival: '09:35 AM', status: 'Completed' },
  { token: 'OPD-009', name: 'Mrs. Kavita Sharma', age: '33 / Female', arrival: '09:50 AM', status: 'Completed' },
  { token: 'OPD-010', name: 'Mr. Sandeep Yadav', age: '47 / Male', arrival: '10:05 AM', status: 'Completed' },
  { token: 'OPD-011', name: 'Miss. Anjali Mehta', age: '29 / Female', arrival: '10:15 AM', status: 'In Consultation' },
  { token: 'OPD-012', name: 'Mr. Ramesh Kumar', age: '34 / Male', arrival: '10:20 AM', status: 'In Consultation' },
]

export const ANALYTICS = {
  avgWait: 18,
  maxWait: 52,
  tokensGenerated: 70,
  completed: 26,
  queueLoad: 64,
  queueLoadLabel: 'Moderate',
}

export const GENDERS = ['Male', 'Female', 'Other']
export const VISIT_REASONS = [
  'General Consultation',
  'Follow-up',
  'Fever / Cold',
  'Injury',
  'Vaccination',
  'Other',
]
