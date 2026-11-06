/**
 * Super-Admin console navigation.
 *
 * Kept in the same shape as HOSPITAL_NAV so AdminSidebar can reuse the shared
 * glider styling. `icon` is a lucide export name resolved in the sidebar.
 */
export const ADMIN_NAV = [
  { label: 'Overview', to: '/admin', icon: 'LayoutDashboard', end: true },
  { label: 'Hospitals', to: '/admin/hospitals', icon: 'Building2' },
  { label: 'Doctors', to: '/admin/doctors', icon: 'Stethoscope' },
  { label: 'Hospital Approvals', to: '/admin/approvals', icon: 'ClipboardCheck' },
  { label: 'Doctor Verifications', to: '/admin/doctor-verifications', icon: 'BadgeCheck' },
  { label: 'Support Requests', to: '/admin/support', icon: 'LifeBuoy' },
]
