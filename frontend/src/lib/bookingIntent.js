const KEY = 'tapcure.booking-intent'

export function saveBookingIntent(path) {
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // Private browsing may block storage; normal dashboard routing still works.
  }
}

export function consumeBookingIntent(role) {
  if (role !== 'PATIENT') return null
  try {
    const path = sessionStorage.getItem(KEY)
    if (!path?.startsWith('/patient-dashboard/appointments/new')) return null
    sessionStorage.removeItem(KEY)
    return path
  } catch {
    return null
  }
}

export function beginBooking({ user, navigate, doctorId, affiliationId }) {
  const params = new URLSearchParams({ doctor: String(doctorId) })
  if (affiliationId) params.set('affiliation', String(affiliationId))
  const path = `/patient-dashboard/appointments/new?${params.toString()}`
  if (user?.role_name === 'PATIENT') {
    navigate(path)
    return
  }
  saveBookingIntent(path)
  navigate('/?auth=patient')
}
