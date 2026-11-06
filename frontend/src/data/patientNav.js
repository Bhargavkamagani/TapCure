/**
 * Sidebar navigation for the patient console.
 * `icon` is a lucide icon name resolved in PatientSidebar.
 * `to` is relative to /patient-dashboard; `end` marks the index route.
 *
 * Mirrors the doctor console's nav shape so both consoles stay consistent.
 */
export const PATIENT_NAV = [
  { label: 'Dashboard', tKey: 'pnav.dashboard', to: '', icon: 'Home', end: true },
  { label: 'My Appointments', tKey: 'pnav.appointments', to: 'appointments', icon: 'CalendarDays' },
  { label: 'Family Members', tKey: 'pnav.family', to: 'family', icon: 'Users' },
  { label: 'Doctors', tKey: 'pnav.doctors', to: 'doctors', icon: 'UserRound' },
  { label: 'Hospitals', tKey: 'pnav.hospitals', to: 'hospitals', icon: 'Building2' },
  { label: 'Prescriptions', tKey: 'pnav.prescriptions', to: 'prescriptions', icon: 'FileText' },
  { label: 'Health Records', tKey: 'pnav.healthRecords', to: 'health-records', icon: 'FolderHeart' },
  { label: 'Payments', tKey: 'pnav.payments', to: 'payments', icon: 'CreditCard' },
  { label: 'Profile Settings', tKey: 'pnav.profile', to: 'profile', icon: 'Settings' },
]

// Notifications and Help & Support were removed from the sidebar per product:
// Help/FAQ live on the public homepage now. Their routes still exist (reachable
// by URL and the sidebar "Need help?" card), just not as primary nav items.
