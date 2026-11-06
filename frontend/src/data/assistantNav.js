/** Grouped left-nav for the Assistant (receptionist / nurse-compounder) console.
 *  Each group has an optional section label + items. `soon: true` marks pages
 *  whose UI is built but backend data is pending. `hidden: true` keeps an entry
 *  documented here but off the sidebar — its route still resolves, so a direct
 *  link works, but the desk isn't shown a dead end in a console they use all
 *  day. Delete the flag to bring it back. */
export const ASSISTANT_NAV = [
  {
    section: null,
    items: [{ label: 'Dashboard', to: '/assistant-dashboard', icon: 'LayoutDashboard', end: true }],
  },
  {
    section: 'Appointments & Queue',
    items: [
      { label: "Today's Queue", to: '/assistant-dashboard/queue', icon: 'ListChecks' },
      { label: 'Upcoming Appointments', to: '/assistant-dashboard/appointments', icon: 'CalendarDays' },
      { label: 'Walk-in', to: '/assistant-dashboard/walk-in', icon: 'UserPlus' },
    ],
  },
  {
    section: 'Patient Management',
    items: [
      // One page: it already has search, filters and the full list. Two nav
      // entries pointing at the same component just made the desk hunt for a
      // difference that was never there.
      { label: 'Patients', to: '/assistant-dashboard/patients', icon: 'Users' },
    ],
  },
  {
    section: 'Clinical',
    items: [
      { label: 'Vitals & Measurements', to: '/assistant-dashboard/vitals', icon: 'Activity' },
      // Hidden until it's built: there is no lab data model, and the doctor has
      // no way to order a test yet, so the page can't do anything useful.
      { label: 'Lab Test Orders', to: '/assistant-dashboard/lab-tests', icon: 'FlaskConical', soon: true, hidden: true },
      // Hidden until built. Scoped as Tier 1 (issue log on top of existing
      // prescription_items) but deprioritised: most patients buy at an outside
      // pharmacy, so a counter log only fits hospitals that actually dispense.
      { label: 'Medicine Dispensed', to: '/assistant-dashboard/medicines', icon: 'Pill', soon: true, hidden: true },
    ],
  },
  {
    section: 'Communication',
    items: [
      // Hidden until built: no messaging backend exists, so the page can only
      // ever show a placeholder.
      { label: 'Messages', to: '/assistant-dashboard/messages', icon: 'MessageSquare', soon: true, hidden: true },
      // Hidden from the rail, NOT removed: the topbar bell already goes here and
      // carries the unread count, so a second entry point was the same door
      // without the badge. The route still resolves.
      { label: 'Notifications', to: '/assistant-dashboard/notifications', icon: 'Bell', hidden: true },
    ],
  },
]
