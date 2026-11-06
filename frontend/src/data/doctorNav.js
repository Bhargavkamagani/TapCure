/**
 * Sidebar navigation for the doctor console, grouped into sections.
 * `icon` is a lucide icon name resolved in DoctorSidebar.
 * `to` is relative to /doctor-dashboard; `end` marks the index route.
 */
export const DOCTOR_NAV = [
  {
    section: null,
    items: [{ label: 'Dashboard', to: '', icon: 'Home', end: true }],
  },
  {
    section: 'Appointments',
    items: [
      { label: 'All Appointments', to: 'appointments', icon: 'ClipboardList' },
      { label: 'Patients', to: 'patients', icon: 'UserRound' },
    ],
  },
  // The "Queue Management" section held one item, Live OP Queue. That page was
  // folded into the dashboard — the live queue, its table and every per-row
  // action (vitals, fee, recall, no-show) now sit on the screen the doctor
  // already works from, so a second destination for the same queue was only
  // splitting the job in two.
  {
    section: 'Doctor & Schedule',
    items: [
      { label: 'My Availability', to: 'availability', icon: 'Clock' },
    ],
  },
  {
    section: 'Reports & Analytics',
    items: [
      { label: 'Reports & Analytics', to: 'reports', icon: 'BarChart3' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { label: 'Hospital Profile', to: 'profile', icon: 'Building2' },
    ],
  },
]

/** Flat list of non-index routes → used to register "coming soon" stubs. */
export const DOCTOR_STUB_ROUTES = DOCTOR_NAV.flatMap((g) => g.items)
  .filter((i) => i.to !== '')
  .map((i) => ({ to: i.to, label: i.label }))
