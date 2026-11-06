/**
 * Practice / scheduling model — the SINGLE SOURCE OF TRUTH for "where is a
 * doctor, on which day, and what does it cost / how long is the wait".
 *
 *  ⚠️  Prototype data only — wire to the real backend later. The shape here is
 *      intentionally backend-friendly so swapping in API responses is a
 *      drop-in change.
 *
 *  The idea (see src/lib/practice.js for the logic that reads this):
 *    A doctor is NOT "owned" by one hospital. A doctor has:
 *      • affiliations — the *places* they consult (hospitals they work under +
 *        their own private practice). Fee and avg consult time live here, so
 *        the same doctor can charge / move at a different pace per place.
 *      • sessions     — recurring weekly blocks, each pointing at ONE
 *        affiliation. This is what answers "hospital on these days, private on
 *        those days". Two sessions on the same weekday = split day
 *        (e.g. hospital morning, private evening).
 *      • exceptions   — one-off date overrides (leave / holiday).
 *      • queue        — a live snapshot per *hospital* affiliation, used to
 *        compute the estimated wait shown to patients.
 *
 *  Because sessions never overlap in time, any (doctor, date) resolves to
 *  exactly one place — so the SAME list drives three views:
 *    • Patient  → where the doctor is each day + the right fee + live wait.
 *    • Hospital admin → only THIS hospital's days (private days show as off-site).
 *    • Doctor   → everything (they own the schedule).
 */

/** The hospital whose admin console is currently logged in. */
export const THIS_HOSPITAL = { id: 'hospital_citycare', name: 'City Care Hospital' }

/** Display order for the week (Date.getDay() maps Sun=0 … Sat=6). */
export const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Roster keyed by doctor name (matches the names used in the patient directory
 * and the hospital console so the consoles line up).
 *
 * affiliation.type ∈ 'hospital' | 'private'
 * session.mode     ∈ 'token'  (queue / token hospital)  | 'slot' (booked slots)
 */
export const PRACTICE = {
  /* ---- Doctor shared between the HOSPITAL admin AND the patient directory ---- */
  'Dr. Rahul Sharma': {
    name: 'Dr. Rahul Sharma',
    specialty: 'General Physician',
    affiliations: [
      { id: 'aff_rahul_cc', type: 'hospital', hospitalId: 'hospital_citycare', name: 'City Care Hospital', location: 'Bengaluru', fee: 500, avgConsultMin: 8, room: 'Room 2' },
      { id: 'aff_rahul_priv', type: 'private', name: 'Sharma Family Chamber', location: 'Indiranagar, Bengaluru', fee: 800, avgConsultMin: 12 },
    ],
    sessions: [
      { affiliationId: 'aff_rahul_cc', day: 'Mon', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_rahul_cc', day: 'Wed', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_rahul_cc', day: 'Fri', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_rahul_priv', day: 'Tue', start: '18:00', end: '21:00', mode: 'slot' },
      { affiliationId: 'aff_rahul_priv', day: 'Thu', start: '18:00', end: '21:00', mode: 'slot' },
    ],
    exceptions: [{ date: '2025-06-20', reason: 'Personal Leave' }],
    queue: { aff_rahul_cc: { lastToken: 18, waiting: 6, delayMin: 15 } },
  },

  'Dr. Neha Rao': {
    name: 'Dr. Neha Rao',
    specialty: 'Cardiology',
    affiliations: [
      { id: 'aff_neha_cc', type: 'hospital', hospitalId: 'hospital_citycare', name: 'City Care Hospital', location: 'Bengaluru', fee: 700, avgConsultMin: 12, room: 'Room 5' },
      { id: 'aff_neha_priv', type: 'private', name: 'HeartLine Hospital', location: 'Koramangala, Bengaluru', fee: 1000, avgConsultMin: 15 },
    ],
    sessions: [
      { affiliationId: 'aff_neha_cc', day: 'Tue', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_neha_cc', day: 'Thu', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_neha_priv', day: 'Sat', start: '17:00', end: '20:00', mode: 'slot' },
    ],
    queue: { aff_neha_cc: { lastToken: 9, waiting: 3, delayMin: 0 } },
  },

  'Dr. Kavita Menon': {
    name: 'Dr. Kavita Menon',
    specialty: 'Gynecology',
    affiliations: [
      { id: 'aff_kavita_cc', type: 'hospital', hospitalId: 'hospital_citycare', name: 'City Care Hospital', location: 'Bengaluru', fee: 600, avgConsultMin: 10, room: 'Room 1' },
    ],
    sessions: [
      { affiliationId: 'aff_kavita_cc', day: 'Mon', start: '09:00', end: '12:00', mode: 'token' },
      { affiliationId: 'aff_kavita_cc', day: 'Tue', start: '09:00', end: '12:00', mode: 'token' },
      { affiliationId: 'aff_kavita_cc', day: 'Wed', start: '09:00', end: '12:00', mode: 'token' },
      { affiliationId: 'aff_kavita_cc', day: 'Thu', start: '09:00', end: '12:00', mode: 'token' },
      { affiliationId: 'aff_kavita_cc', day: 'Fri', start: '09:00', end: '12:00', mode: 'token' },
    ],
    queue: { aff_kavita_cc: { lastToken: 14, waiting: 4, delayMin: 5 } },
  },

  /* ---- Doctors that live in the PATIENT directory (other hospitals + private) ---- */
  'Dr. Ramesh Kumar': {
    name: 'Dr. Ramesh Kumar',
    specialty: 'General Physician',
    affiliations: [
      { id: 'aff_ramesh_ssr', type: 'hospital', hospitalId: 'hospital_ssr', name: 'Sri Sai Ram Hospital', location: 'Karimnagar', fee: 400, avgConsultMin: 8, room: 'Room 2' },
      { id: 'aff_ramesh_priv', type: 'private', name: "Dr. Ramesh's Chamber", location: 'Vidya Nagar, Karimnagar', fee: 600, avgConsultMin: 12 },
    ],
    sessions: [
      { affiliationId: 'aff_ramesh_ssr', day: 'Mon', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_ramesh_ssr', day: 'Wed', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_ramesh_ssr', day: 'Fri', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_ramesh_ssr', day: 'Sat', start: '09:00', end: '12:00', mode: 'token' },
      { affiliationId: 'aff_ramesh_priv', day: 'Tue', start: '18:00', end: '21:00', mode: 'slot' },
      { affiliationId: 'aff_ramesh_priv', day: 'Thu', start: '18:00', end: '21:00', mode: 'slot' },
    ],
    queue: { aff_ramesh_ssr: { lastToken: 17, waiting: 6, delayMin: 15 } },
  },

  'Dr. Anjali Sharma': {
    name: 'Dr. Anjali Sharma',
    specialty: 'Dermatologist',
    affiliations: [
      { id: 'aff_anjali_skin', type: 'hospital', hospitalId: 'hospital_skin', name: 'Skin Care Hospital', location: 'Warangal', fee: 600, avgConsultMin: 10 },
      { id: 'aff_anjali_priv', type: 'private', name: 'GlowDerm Studio', location: 'Hanamkonda, Warangal', fee: 900, avgConsultMin: 15 },
    ],
    sessions: [
      { affiliationId: 'aff_anjali_skin', day: 'Mon', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_anjali_skin', day: 'Tue', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_anjali_skin', day: 'Thu', start: '10:00', end: '13:00', mode: 'token' },
      { affiliationId: 'aff_anjali_priv', day: 'Sat', start: '16:00', end: '19:00', mode: 'slot' },
    ],
    queue: { aff_anjali_skin: { lastToken: 5, waiting: 2, delayMin: 0 } },
  },
}
