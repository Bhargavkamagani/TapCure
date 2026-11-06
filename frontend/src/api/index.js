/**
 * Endpoint helpers grouped by domain. Thin wrappers over `api` (client.js) so
 * components call e.g. `tokensApi.queue(doctorId)` instead of raw paths.
 */
import { api, endSession, setTokens } from './client.js'

const qs = (params = {}) => {
  const s = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') s.append(k, v)
  })
  const str = s.toString()
  return str ? `?${str}` : ''
}

export const authApi = {
  // `portal` names the sign-in page ('hospital' | 'doctor'). The server refuses an
  // account that doesn't belong to it, so a doctor can't sign in at the hospital
  // desk and vice versa. Omitted = no portal check (scripts, tests).
  login: async (identifier, password, portal) => {
    const d = await api.post('/auth/login', { identifier, password, portal }, { auth: false, cookie: true })
    setTokens({ access_token: d.access_token })
    return d
  },
  register: async (payload) => {
    const d = await api.post('/auth/register', payload, { auth: false, cookie: true })
    setTokens({ access_token: d.access_token })
    return d
  },
  me: () => api.get('/auth/me'),
  // Revokes the session server-side and clears the HttpOnly refresh cookie.
  logout: () => endSession(),
  // Public hospital onboarding (creates a pending hospital + owner admin).
  // Multipart since 2026-10-01: the form's fields as JSON in `payload`, plus
  // the hospital's required `logo` file (shown as its pin on every map).
  registerHospital: (payload, logo, photo) => {
    const fd = new FormData()
    fd.append('payload', JSON.stringify(payload))
    if (logo) fd.append('logo', logo)
    if (photo) fd.append('photo', photo)   // optional hospital photo (Find Hospitals card)
    return api.post('/auth/register-hospital', fd, { auth: false, isForm: true })
  },
  // Public solo-doctor onboarding — multipart FormData with credential files
  // (creates a pending, inactive doctor awaiting Super-Admin verification).
  registerDoctor: (formData) => api.post('/auth/register-doctor', formData, { auth: false, isForm: true }),
  // Mobile-OTP (patient, demo mode — request returns dev_otp).
  otpRequest: (phone, mode) => api.post('/auth/otp/request', { phone, mode }, { auth: false }),
  otpLogin: async (phone, otp) => {
    const d = await api.post('/auth/otp/login', { phone, otp }, { auth: false, cookie: true })
    setTokens({ access_token: d.access_token })
    return d
  },
  otpRegister: async (payload) => {
    const d = await api.post('/auth/otp/register', payload, { auth: false, cookie: true })
    setTokens({ access_token: d.access_token })
    return d
  },
  forgotPassword: (identifier, portal) => api.post('/auth/forgot-password', { identifier, portal }, { auth: false }),
  resetPassword: (identifier, otp, newPassword) => api.post('/auth/reset-password', { identifier, otp, new_password: newPassword }, { auth: false }),
  // Patient deletes their own account (Play Store / App Store). Logged in: no
  // phone, the OTP goes to the account's number. Public page: phone + OTP.
  deleteAccountOtp: (phone) => api.post('/auth/delete-account/otp', phone ? { phone } : {}, { auth: !phone }),
  deleteMyAccount: (otp) => api.del('/auth/me/account', { body: { otp } }),
  deleteAccountPublic: (phone, otp) => api.post('/auth/delete-account', { phone, otp }, { auth: false }),
}

export const hospitalsApi = {
  list: () => api.get('/hospitals'),
  get: (id) => api.get(`/hospitals/${id}`),
  update: (id, body) => api.put(`/hospitals/${id}`, body),
  uploadLogo: (id, formData) => api.post(`/hospitals/${id}/logo`, formData, { isForm: true }),
  // Hospital photo for the public Find Hospitals cards (2026-10-01).
  uploadPhoto: (id, formData) => api.post(`/hospitals/${id}/photo`, formData, { isForm: true }),
  removePhoto: (id) => api.del(`/hospitals/${id}/photo`),
  // Printed-prescription letterhead images; part = 'header' | 'footer' (2026-10-26).
  uploadLetterhead: (id, part, formData) => api.post(`/hospitals/${id}/letterhead/${part}`, formData, { isForm: true }),
  removeLetterhead: (id, part) => api.del(`/hospitals/${id}/letterhead/${part}`),
  doctors: (hospitalId) => api.get(`/hospitals/${hospitalId}/doctors`),
  pending: () => api.get('/hospitals/pending'),
  // Everything submitted at sign-up (Super Admin): owner, timings, services…
  registration: (id) => api.get(`/hospitals/${id}/registration`),
  approve: (id) => api.post(`/hospitals/${id}/approve`),
  reject: (id, reason = '') => api.post(`/hospitals/${id}/reject`, { reason }),
  suspendPreview: (id) => api.get(`/hospitals/${id}/suspend-preview`),
  suspend: (id, reason) => api.post(`/hospitals/${id}/suspend`, { reason }),
  reactivate: (id) => api.post(`/hospitals/${id}/reactivate`),
  // Working days + OP hours — doctor sessions must fit inside these.
  settings: (id) => api.get(`/hospitals/${id}/settings`),
  updateSettings: (id, body) => api.put(`/hospitals/${id}/settings`, body),
}

// Public, read-only discovery endpoints. These deliberately expose a smaller
// payload than the authenticated hospital/doctor administration endpoints.
export const discoveryApi = {
  search: (params) => api.get(`/public/discovery${qs(params)}`, { auth: false }),
  doctor: (id) => api.get(`/public/doctors/${id}`, { auth: false }),
  hospital: (id) => api.get(`/public/hospitals/${id}`, { auth: false }),
  // Cities TapCure actually serves — cheap, cached for the tab session.
  cities: () => api.get('/public/cities', { auth: false }),
  // Public-health headlines, proxied + cached server-side. Returns
  // { items: [] } when no feed is configured — never an error.
  healthNews: (limit) => api.get(`/public/health-news${qs({ limit })}`, { auth: false }),
}

export const doctorsApi = {
  list: (params) => api.get(`/doctors${qs(params)}`),
  get: (id) => api.get(`/doctors/${id}`),
  update: (id, body) => api.put(`/doctors/${id}`, body),
  uploadPhoto: (id, formData) => api.post(`/doctors/${id}/photo`, formData, { isForm: true }),
  // Signature printed on prescription PDFs — the doctor's own only (2026-10-26).
  signature: (id) => api.get(`/doctors/${id}/signature`),
  uploadSignature: (id, formData) => api.post(`/doctors/${id}/signature`, formData, { isForm: true }),
  removeSignature: (id) => api.del(`/doctors/${id}/signature`),
  availability: (id, date) => api.get(`/doctors/${id}/availability${qs({ date })}`),
  // Today's roster WITH the reason a doctor is off (leave / holiday / no
  // session on this weekday). `list({ bookable: true })` can't tell you that —
  // it only knows who is employed and verified.
  dutyToday: (date) => api.get(`/doctors/duty-today${qs({ date })}`),
  onboard: (payload) => api.post('/doctors/onboard', payload),
  // Super-Admin credential verification of self-registered (solo) doctors.
  pending: () => api.get('/doctors/pending'),
  // Everything a doctor submitted at sign-up (Super Admin): practice, docs…
  registration: (id) => api.get(`/doctors/${id}/registration`),
  // Credential records in ANY state (pending/verified/rejected/all) with
  // their uploaded documents — the super-admin audit view.
  verifications: (status) => api.get(`/doctors/verifications${status ? '?status=' + status : ''}`),
  adminDetail: (id) => api.get(`/doctors/${id}/admin-detail`),
  verify: (id) => api.post(`/doctors/${id}/verify`),
  reject: (id, reason = '') => api.post(`/doctors/${id}/reject`, { reason }),
  suspendPreview: (id) => api.get(`/doctors/${id}/suspend-preview`),
  suspend: (id, reason) => api.post(`/doctors/${id}/suspend`, { reason }),
  reactivate: (id) => api.post(`/doctors/${id}/reactivate`),
  // Weekly schedule (sessions).
  schedule: (id, affiliationId) => api.get(`/doctor-schedule${qs({ doctor_id: id, affiliation_id: affiliationId })}`),
  addSchedule: (body) => api.post('/doctor-schedule', body),
  editSchedule: (scheduleId, body) => api.put(`/doctor-schedule/${scheduleId}`, body),
  // Who would be affected by deleting this session — read-only, powers the
  // confirmation. `confirm` is required once patients are booked: the delete
  // cancels their appointments and notifies them, so it must never be a
  // one-click accident.
  scheduleImpact: (scheduleId) => api.get(`/doctor-schedule/${scheduleId}/impact`),
  removeSchedule: (scheduleId, { confirm = false } = {}) =>
    api.del(`/doctor-schedule/${scheduleId}${confirm ? '?confirm=true' : ''}`),
  // Holidays + leave.
  holidays: (id) => api.get(`/doctor-holidays${qs({ doctor_id: id })}`),
  // `confirm` mirrors removeSchedule: the server refuses with 409 when patients
  // are booked that day, so the doctor sees who is affected before anything is
  // cancelled. Without it a holiday silently stranded everyone booked.
  addHoliday: (body, { confirm = false } = {}) =>
    api.post(`/doctor-holidays${confirm ? '?confirm=true' : ''}`, body),
  removeHoliday: (holidayId) => api.del(`/doctor-holidays/${holidayId}`),
  leave: (id) => api.get(`/doctor-leave${qs({ doctor_id: id })}`),
  submitLeave: (body) => api.post('/doctor-leave', body),
  // Leave with dates, set by the hospital (approved at once). 409 code
  // leave_has_bookings until `confirm` — patients booked inside are cancelled.
  leaveList: (params) => api.get(`/doctor-leave${qs(params)}`),
  setLeave: (id, body, { confirm = false } = {}) =>
    api.post(`/doctors/${id}/leave${confirm ? '?confirm=true' : ''}`, body),
  endLeave: (id, leaveId) => api.post(`/doctors/${id}/leave/${leaveId}/end`),
  // Delay alerts + presence.
  delays: (id) => api.get(`/doctor-delay${qs({ doctor_id: id })}`),
  logDelay: (body) => api.post('/doctor-delay', body),
  affiliations: (params) => api.get(`/doctor-affiliations${qs(params)}`),
  addAffiliation: (body) => api.post('/doctor-affiliations', body),
  updateAffiliation: (id, body) => api.put(`/doctor-affiliations/${id}`, body),
  status: (id) => api.get(`/doctor-status${qs({ doctor_id: id })}`),
  setStatus: (id, body) => api.put(`/doctor-status${qs({ doctor_id: id })}`, body),
}

export const departmentsApi = {
  list: (params) => api.get(`/departments${qs(params)}`),
  create: (body) => api.post('/departments', body),
  update: (id, body) => api.put(`/departments/${id}`, body),
  remove: (id) => api.del(`/departments/${id}`),
}

export const receptionApi = {
  list: (params) => api.get(`/receptionists${qs(params)}`),
  onboard: (body) => api.post('/receptionists/onboard', body),
  update: (id, body) => api.put(`/receptionists/${id}`, body),
  updateAccount: (id, body) => api.put(`/receptionists/${id}/account`, body),
  remove: (id) => api.del(`/receptionists/${id}`),
}

const stockForm = (file, columnMap, mode) => {
  const fd = new FormData()
  fd.append('file', file)
  if (columnMap) fd.append('column_map', JSON.stringify(columnMap))
  // 'replace' (the sheet IS the list) or 'merge' (newly purchased stock, added on).
  if (mode) fd.append('mode', mode)
  return fd
}

// Hospital pharmacy. The stock sheet goes up in two steps: `preview` reads it and
// reports problems WITHOUT saving, then `confirm` sends the same file again to
// make it the live list. The doctor's medicine box calls `search`.
export const pharmacyApi = {
  preview: (file, columnMap, mode) => api.post('/pharmacy/stock/preview', stockForm(file, columnMap, mode), { isForm: true }),
  confirm: (file, columnMap, mode) => api.post('/pharmacy/stock/confirm', stockForm(file, columnMap, mode), { isForm: true }),
  stock: (params) => api.get(`/pharmacy/stock${qs(params)}`),
  // An empty `q` returns only { has_pharmacy, last_updated_at, … } for the header.
  search: (q, appointmentId) => api.get(`/pharmacy/search${qs({ q, appointment_id: appointmentId })}`),
  template: () => api.get('/pharmacy/template', { blob: true }),
  updateSettings: (body) => api.put('/pharmacy/settings', body),
  // Pharmacy counter: this hospital's prescriptions and what was handed over.
  prescriptions: (params) => api.get(`/pharmacy/prescriptions${qs(params)}`),
  prescription: (id) => api.get(`/pharmacy/prescriptions/${id}`),
  dispense: (id, items) => api.post(`/pharmacy/prescriptions/${id}/dispense`, { items }),
  undoDispense: (dispenseId) => api.post(`/pharmacy/dispenses/${dispenseId}/undo`, {}),
  // Walk-in sales to outside customers (no prices — stock only).
  walkinSales: (params) => api.get(`/pharmacy/walkin-sales${qs(params)}`),
  createWalkinSale: (body) => api.post('/pharmacy/walkin-sales', body),
  undoWalkinSale: (saleId) => api.post(`/pharmacy/walkin-sales/${saleId}/undo`, {}),
}

// Pharmacist logins at the admin's own hospital.
export const pharmacistsApi = {
  list: () => api.get('/pharmacists'),
  onboard: (body) => api.post('/pharmacists/onboard', body),
  update: (userId, body) => api.put(`/pharmacists/${userId}`, body),
  remove: (userId) => api.del(`/pharmacists/${userId}`),
}

export const patientsApi = {
  list: (params) => api.get(`/patients${qs(params)}`),
  get: (id) => api.get(`/patients/${id}`),
  search: (q) => api.get(`/patients/search${qs({ q })}`),
  // Exact resolution of a scanned QR / typed UHID card (check-digit validated server-side).
  byUhid: (code) => api.get(`/patients/by-uhid/${encodeURIComponent(code)}`),
  create: (body) => api.post('/patients', body),
  update: (id, body) => api.put(`/patients/${id}`, body),
  uploadPhoto: (id, formData) => api.post(`/patients/${id}/photo`, formData, { isForm: true }),
  appointments: (id, params) => api.get(`/patients/${id}/appointments${qs(params)}`),
  // For a logged-in PATIENT, GET /patients is auto-scoped to their own record(s)
  // server-side (user_id == me). The first row is "my" patient profile.
  me: async () => (await api.get('/patients'))[0] || null,
  // Health-record sub-resources.
  allergies: (id) => api.get(`/patients/${id}/allergies`),
  addAllergy: (body) => api.post('/allergies', body),
  removeAllergy: (allergyId) => api.del(`/allergies/${allergyId}`),
  medicalHistory: (id) => api.get(`/patients/${id}/medical-history`),
  addHistory: (body) => api.post('/medical-history', body),
  documents: (id) => api.get(`/patients/${id}/documents`),
  uploadDocument: (formData) => api.post('/documents', formData, { isForm: true }),
  deleteDocument: (documentId) => api.del(`/documents/${documentId}`),
  family: (id) => api.get(`/patients/${id}/family`),
  addFamily: (body) => api.post('/family-members', body),
  updateFamily: (memberId, body) => api.put(`/family-members/${memberId}`, body),
  removeFamily: (memberId) => api.del(`/family-members/${memberId}`),

  // Family account links. `linkInvitable` is the gate the UI keys off: it
  // returns only those dependents whose number already belongs to a registered
  // account, so an Invite button can never appear for someone who never
  // signed up.
  linkInvitable: () => api.get('/family-links/invitable'),
  linkInvite: (memberId) => api.post(`/family-links/${memberId}/invite`),
  linkRequests: () => api.get('/family-links/requests'),
  linkApprove: (memberId) => api.post(`/family-links/${memberId}/approve`),
  linkDecline: (memberId) => api.post(`/family-links/${memberId}/decline`),
  linkInvitations: () => api.get('/family-links/invitations'),
  linkAccept: (memberId) => api.post(`/family-links/${memberId}/accept`),
  linkReject: (memberId) => api.post(`/family-links/${memberId}/reject`),
  uploadFamilyPhoto: (memberId, formData) =>
    api.post(`/family-members/${memberId}/photo`, formData, { isForm: true }),
  // Vitals & measurements (nurse/reception capture at check-in).
  vitals: (id) => api.get(`/patients/${id}/vitals`),
  // Vitals recorded for this account under someone else's family record.
  // Separate from `vitals(id)` because those are read per patient id and a
  // linked dependent does not own the holder's patient record.
  sharedVitals: () => api.get('/family-links/shared-vitals'),
  recentVitals: (params) => api.get(`/vitals/recent${qs(params)}`),
  recordVitals: (body) => api.post('/vitals', body),
  removeVitals: (vitalId) => api.del(`/vitals/${vitalId}`),
}

export const followUpsApi = {
  // The logged-in patient's pending follow-ups (soonest first).
  mine: () => api.get('/follow-ups/mine'),
}

// Free revisit passes — one no-charge return visit with the same doctor, earned
// automatically after a paid consultation. The patient walks in; the front desk
// redeems the pass and issues a zero-fee token.
export const revisitPassesApi = {
  // Live passes for the signed-in patient (soonest expiry first).
  mine: () => api.get('/revisit-passes/mine'),
  // Does THIS patient hold a pass with THIS doctor? Doctor-scoped on purpose —
  // a pass earned with one doctor is not valid with another. Returns null when
  // there is none.
  lookup: (patientId, doctorId, familyMemberId) =>
    api.get(`/revisit-passes/lookup${qs({
      patient_id: patientId, doctor_id: doctorId, family_member_id: familyMemberId,
    })}`),
  // Every live pass a patient holds, each naming its doctor. The front desk has
  // no doctor in context when it opens a record, and a bare "has a pass" badge
  // would invite honouring Dr. A's pass while the patient is seeing Dr. B.
  forPatient: (patientId) => api.get(`/revisit-passes/for-patient${qs({ patient_id: patientId })}`),
  redeem: (passId, notes = '') => api.post(`/revisit-passes/${passId}/redeem`, { notes }),
  // The free-revisit window at each practice the signed-in DOCTOR works at,
  // with `editable` saying whether they may change it (their own practice) or
  // the hospital owns it. One call covers both because only the server knows
  // which applies — and ROLE_DOCTOR cannot read /hospitals/{id}/settings.
  // Write back through doctorsApi.updateAffiliation(id, { free_revisit_days }).
  windows: () => api.get('/revisit-passes/window'),
}

// Absolute URL for a server-stored file path (e.g. a document's file_url).
export const fileUrl = (path) =>
  path?.startsWith('http') ? path : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${path || ''}`

// Waiting-room TV link (2026-10-26). `board` is public — the key in the link is
// the only credential — and carries token codes only, never patient names.
export const displayApi = {
  board: (key, doctors) => api.get(`/display/${encodeURIComponent(key)}/board${qs({ doctors: doctors || undefined })}`, { auth: false }),
  link: (hospitalId) => api.get(`/hospitals/${hospitalId}/display-link`),
  renew: (hospitalId) => api.post(`/hospitals/${hospitalId}/display-link`),
}

export const appointmentsApi = {
  list: (params) => api.get(`/appointments${qs(params)}`),
  get: (id) => api.get(`/appointments/${id}`),
  book: (body) => api.post('/appointments', body),
  // `origin` (optional) makes the response travel-aware: each slot gains
  // `reachable`/`leave_by`, plus a `travel.day` verdict for token bookings.
  // Omitted → byte-identical response to before.
  availableSlots: (doctorId, date, affiliationId, origin) =>
    api.get(`/appointments/available-slots${qs({
      doctor_id: doctorId, date, affiliation_id: affiliationId,
      origin_lat: origin?.lat, origin_lng: origin?.lng,
    })}`),
  // The doctor's next open days after `fromDate` — offered when the day the
  // patient asked for is a leave / holiday / non-consulting day.
  nextAvailableDates: (doctorId, fromDate, { days, limit, affiliationId } = {}) =>
    api.get(`/appointments/next-available-dates${qs({ doctor_id: doctorId, from: fromDate, days, limit, affiliation_id: affiliationId })}`),
  // Which of several doctors consult on a given date, in one round trip.
  dayAvailability: (doctorIds, date) =>
    api.get(`/appointments/day-availability${qs({ doctor_ids: (doctorIds || []).join(','), date })}`),
  today: (doctorId) => api.get(`/appointments/today${qs({ doctor_id: doctorId })}`),
  upcoming: (patientId, days) =>
    api.get(`/appointments/upcoming${qs({ patient_id: patientId, days_ahead: days })}`),
  walkIn: (body) => api.post('/appointments/walk-in', body),
  reschedule: (body) => api.post('/appointments/reschedule', body),
  cancel: (body) => api.post('/appointments/cancel', body),
  cancellations: (params) => api.get(`/appointments/cancellations${qs(params)}`),
  // Record the in-person consultation fee as paid (unlocks the call-next gate).
  collectPayment: (appointmentId, method = 'cash') => api.post(`/appointments/${appointmentId}/collect-payment`, { method }),
}

// Razorpay booking-fee payments. order → checkout → confirm (server verifies).
export const paymentsApi = {
  config: () => api.get('/payments/config'),
  createOrder: (booking) => api.post('/payments/appointment/order', { booking }),
  confirm: (payload) => api.post('/payments/appointment/confirm', payload),
  // Logged-in patient's own payment history (booking fees + hospital consultations).
  my: () => api.get('/payments/my'),
}

export const prescriptionsApi = {
  // PATIENT → own (patient_id ignored); staff → pass patient_id.
  list: (patientId) => api.get(`/prescriptions${qs({ patient_id: patientId })}`),
  forPatient: (patientId) => api.get(`/patients/${patientId}/prescriptions`),
  get: (id) => api.get(`/prescriptions/${id}`),
  // The prescription as a PDF on the letterhead, built fresh each time (a Blob).
  pdf: (id) => api.get(`/prescriptions/${id}/pdf`, { blob: true }),
  // Letterhead + patient line + signature for the on-screen paper view.
  paper: (id) => api.get(`/prescriptions/${id}/paper`),
  create: (body) => api.post('/prescriptions', body),
  // More medicines for the prescription already written at this visit, so one
  // consultation stays one prescription. Append-only, within 12 hours.
  addItems: (id, body) => api.post(`/prescriptions/${id}/items`, body),
  // Correct or drop ONE line of today's prescription. Same doctor, same 12-hour
  // window as addItems, and refused once the pharmacy has acted on that line.
  updateItem: (id, itemId, body) => api.patch(`/prescriptions/${id}/items/${itemId}`, body),
  removeItem: (id, itemId) => api.del(`/prescriptions/${id}/items/${itemId}`),
  remove: (id) => api.del(`/prescriptions/${id}`),
}

// Medicine reminders. A course is planned when the doctor writes the Rx but
// stays silent until `start` — the patient may buy the medicine anywhere, so
// only they know when the course actually begins.
export const medicineApi = {
  courses: (params) => api.get(`/medicine-courses${qs(params)}`),
  get: (id) => api.get(`/medicine-courses/${id}`),
  start: (body) => api.post('/medicine-courses/start', body),
  stop: (id, reason = '') => api.post(`/medicine-courses/${id}/stop`, { reason }),
  // The patient's own clock instead of the fixed 9/2/9 defaults. One "HH:MM"
  // per slot, hospital-local. Future doses are re-planned; sent ones never move.
  setTimes: (id, times) => api.post(`/medicine-courses/${id}/times`, { times }),
  // Today's individual doses, in time order, with the drug details each row
  // needs — the course list can't answer this, it has no per-dose rows.
  today: () => api.get('/medicine-doses/today'),
  // "Take now" — records that the patient actually took it. Never blocks the
  // schedule: an un-marked dose is still reminded about at its time.
  markTaken: (reminderId) => api.post(`/medicine-doses/${reminderId}/taken`),
}

export const tokensApi = {
  generate: (appointmentId, priority = 'normal') =>
    api.post('/tokens/generate', { appointment_id: appointmentId, priority }),
  queue: (doctorId, date, affiliationId) => api.get(`/tokens/queue${qs({ doctor_id: doctorId, date, affiliation_id: affiliationId })}`),
  // Live ETA + leave-by hints. Look up by token_id or, for patients, appointment_id.
  estimate: (params) => api.get(`/tokens/estimate${qs(params)}`),
  current: (doctorId, date, affiliationId) => api.get(`/tokens/current${qs({ doctor_id: doctorId, date, affiliation_id: affiliationId })}`),
  liveDisplay: (doctorId, date, affiliationId) => api.get(`/tokens/live-display${qs({ doctor_id: doctorId, date, affiliation_id: affiliationId })}`),
  stats: (doctorId, date, affiliationId) => api.get(`/tokens/stats${qs({ doctor_id: doctorId, date, affiliation_id: affiliationId })}`),
  // `opts` carries { all_dates: true } for the appointments screen's "All dates"
  // view; omit it and the endpoint keeps its per-day meaning.
  history: (doctorId, date, opts = {}) =>
    api.get(`/tokens/history${qs({ doctor_id: doctorId, date, ...opts })}`),
  next: (doctorId, affiliationId) => api.post(`/tokens/next${qs({ doctor_id: doctorId, affiliation_id: affiliationId })}`),
  complete: (tokenId) => api.post('/tokens/complete', { token_id: tokenId }),
  recall: (tokenId, method = 'display') =>
    api.post('/tokens/recall', { token_id: tokenId, recall_method: method }),
  missed: (tokenId) => api.post('/tokens/missed', { token_id: tokenId }),
  skip: (tokenId, reason = '') => api.post('/tokens/skip', { token_id: tokenId, reason }),
  // For the patient who steps out mid-consultation: calls one waiting patient
  // in and puts this one back at the front of the queue. `skip` only accepts a
  // `waiting` token, so it cannot be used on the patient being served.
  postpone: (tokenId) => api.post('/tokens/postpone', { token_id: tokenId }),
}

export const reportsApi = {
  dashboard: (params) => api.get(`/reports/dashboard${qs(params)}`),
  daily: (params) => api.get(`/reports/daily${qs(params)}`),
  doctor: (params) => api.get(`/reports/doctor${qs(params)}`),
  revenue: (params) => api.get(`/reports/revenue${qs(params)}`),
  peakHours: (params) => api.get(`/reports/peak-hours${qs(params)}`),
  waitTime: (params) => api.get(`/reports/wait-time${qs(params)}`),
  noShow: (params) => api.get(`/reports/no-show${qs(params)}`),
  cancellations: (params) => api.get(`/reports/cancellations${qs(params)}`),
  patientFlow: (params) => api.get(`/reports/patient-flow${qs(params)}`),
  hospitalOverview: (params) => api.get(`/reports/hospital-overview${qs(params)}`),
  // Platform-wide roll-up across every hospital (SUPER_ADMIN only).
  superAdmin: (params) => api.get(`/reports/super-admin${qs(params)}`),
}

// Contact-page enquiries. `submit` is public (no auth) — anyone on /contact can
// write in; the rest is the Super-Admin inbox.
// Subscription plans + the monthly online-booking quota ("used 140 of 200").
export const subscriptionsApi = {
  catalog: () => api.get('/plans/catalog'),
  bookings: (params) => api.get(`/subscriptions/bookings${qs(params)}`),
  // choice: 'upgrade' | 'pack' | 'pay_per_booking'. Never automatic.
  choose: (choice, packs = 1) => api.post('/subscriptions/bookings/choice', { choice, packs }),
  // Hospital picks its own paid plan after the pilot / once a plan ended: 'starter' | 'smart_hospital' | 'pro'.
  choosePlan: (plan_code) => api.post('/subscriptions/plan/choose', { plan_code }),
  // Monthly → yearly: pay first (Checkout), the plan changes once paid.
  startYearly: () => api.post('/subscriptions/yearly/start'),
  // Yearly → monthly when the paid year ends (renew: false), or keep yearly (true).
  yearlyRenewal: (renew) => api.post('/subscriptions/yearly/renewal', { renew }),
  // SUPER_ADMIN: put a hospital on a plan.
  assign: (body) => api.post('/subscriptions/assign', body),
  invoices: (params) => api.get(`/invoices${qs(params)}`),
  payInvoice: (id) => api.post(`/invoices/${id}/pay`),
  confirmInvoice: (id, body) => api.post(`/invoices/${id}/pay/confirm`, body),
  // UPI Autopay: start → Razorpay Checkout (recurring) → confirm.
  autopay: () => api.get('/subscriptions/autopay'),
  startAutopay: () => api.post('/subscriptions/autopay/start'),
  confirmAutopay: (body) => api.post('/subscriptions/autopay/confirm', body),
  // SUPER_ADMIN: month-end billing run by hand.
  runMonthEnd: (month) => api.post(`/invoices/generate${qs({ month })}`),
}

export const supportApi = {
  submit: (body) => api.post('/support/contact', body, { auth: false }),
  list: (params) => api.get(`/support/requests${qs(params)}`),
  openCount: () => api.get('/support/requests/count'),
  update: (id, body) => api.patch(`/support/requests/${id}`, body),
}

export const notificationsApi = {
  history: (params) => api.get(`/notification-history${qs(params)}`),
  stats: (params) => api.get(`/notification-stats${qs(params)}`),
  // Read state is per user and lives on the server, so it survives a refresh
  // and follows the user to another device.
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post('/notifications/read-all', {}),
}

// Voice assistant proxy (keeps the OpenAI key server-side). `status` reports
// whether cloud voice is configured; transcribe/nlu throw ApiError(503) when
// it isn't, which the voice agent treats as "use the on-device fallback".
// Road route for the free OpenStreetMap map (patient -> hospital). 404 when no
// route is available; the map then keeps its straight line.
export const geoApi = {
  route: ([fromLat, fromLng], [toLat, toLng]) =>
    api.get(`/geo/route?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`),
}

export const voiceApi = {
  status: () => api.get('/voice/status'),
  transcribe: (audioBlob, language = 'en') => {
    const fd = new FormData()
    fd.append('audio', audioBlob, 'speech.webm')
    fd.append('language', language)
    return api.post('/voice/transcribe', fd, { isForm: true })
  },
  nlu: (body) => api.post('/voice/nlu', body),
  // Pre-login voice sign-up: pull the name / mobile / city / yes-no out of a
  // reply the local word rules couldn't read. Public, fixed questions only.
  extract: (transcript, language, field) =>
    api.post('/voice/extract', { transcript: String(transcript || '').slice(0, 300), language, field }, { auth: false }),
  // Cartesia TTS — returns an audio Blob (MP3). Throws ApiError(503) when cloud
  // TTS isn't configured, which the voice agent treats as "use browser speech".
  tts: (text, language = 'en') => api.post('/voice/tts', { text, language }, { blob: true }),
}
