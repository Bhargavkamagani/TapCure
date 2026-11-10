import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LegacyRedirect from './components/common/LegacyRedirect.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { DialogProvider } from './components/common/DialogProvider.jsx'
import { I18nProvider } from './i18n/index.jsx'
import RequireAuth from './components/common/RequireAuth.jsx'
import DisplayScale from './components/common/DisplayScale.jsx'
import ComingSoon from './pages/assistant/ComingSoon.jsx'

/**
 * Root application + routing.
 *
 * Every route component is code-split via React.lazy so the initial bundle only
 * ships the router + providers. Each page (and the heavy patient/doctor/hospital
 * consoles) downloads on demand — a big first-paint win on slow networks. A
 * shared <Suspense> shows a lightweight loader while a chunk streams in.
 *
 * Patient & Doctor auth happens in a modal launched from the Navbar dropdown.
 * The hospital and doctor consoles are nested layouts (shared sidebar/topbar)
 * with pages swapped via <Outlet/>.
 */

// Public / marketing
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'))
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const HospitalLogin = lazy(() => import('./pages/HospitalLogin.jsx'))
const HospitalSignup = lazy(() => import('./pages/HospitalSignup.jsx'))
const DoctorSignup = lazy(() => import('./pages/DoctorSignup.jsx'))
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy.jsx'))
// Waiting-room TV — public, opened from the hospital's secret link.
const TvBoard = lazy(() => import('./pages/display/TvBoard.jsx'))
const DeleteAccount = lazy(() => import('./pages/public/DeleteAccount.jsx'))
const Terms = lazy(() => import('./pages/legal/Terms.jsx'))
const CancellationRefund = lazy(() => import('./pages/legal/CancellationRefund.jsx'))
const MedicalDisclaimer = lazy(() => import('./pages/legal/MedicalDisclaimer.jsx'))
const Policies = lazy(() => import('./pages/legal/Policies.jsx'))
const About = lazy(() => import('./pages/static/About.jsx'))
const Features = lazy(() => import('./pages/static/Features.jsx'))
const Pricing = lazy(() => import('./pages/static/Pricing.jsx'))
const FAQ = lazy(() => import('./pages/static/FAQ.jsx'))
const Contact = lazy(() => import('./pages/static/Contact.jsx'))
const Resources = lazy(() => import('./pages/static/Resources.jsx'))
const Calculators = lazy(() => import('./pages/static/Calculators.jsx'))
const HealthArticles = lazy(() => import('./pages/static/HealthArticles.jsx'))
const InsurancePage = lazy(() => import('./pages/public/Insurance.jsx'))
const PublicSearch = lazy(() => import('./pages/public/Search.jsx'))
const PublicDoctorProfile = lazy(() => import('./pages/public/DoctorProfile.jsx'))
const PublicHospitalProfile = lazy(() => import('./pages/public/HospitalProfile.jsx'))

// Patient console
const PatientLayout = lazy(() => import('./components/patient/PatientLayout.jsx'))
const PatientHome = lazy(() => import('./pages/patient/Dashboard.jsx'))
const PatientAppointments = lazy(() => import('./pages/patient/Appointments.jsx'))
const PatientBookAppointmentStart = lazy(() => import('./pages/patient/BookAppointmentStart.jsx'))
const PatientBookAppointment = lazy(() => import('./pages/patient/BookAppointment.jsx'))
const PatientBookByVoice = lazy(() => import('./pages/patient/BookByVoice.jsx'))
const PatientFamily = lazy(() => import('./pages/patient/Family.jsx'))
const PatientPrescriptions = lazy(() => import('./pages/patient/Prescriptions.jsx'))
const PatientDoctors = lazy(() => import('./pages/patient/Doctors.jsx'))
const PatientHospitals = lazy(() => import('./pages/patient/Hospitals.jsx'))
const PatientHealthRecords = lazy(() => import('./pages/patient/HealthRecords.jsx'))
const PatientPayments = lazy(() => import('./pages/patient/Payments.jsx'))
const PatientNotifications = lazy(() => import('./pages/patient/Notifications.jsx'))
const PatientProfile = lazy(() => import('./pages/patient/Profile.jsx'))
const PatientHelp = lazy(() => import('./pages/patient/Help.jsx'))

// Hospital console
const HospitalLayout = lazy(() => import('./components/hospital/HospitalLayout.jsx'))
const HospitalSetup = lazy(() => import('./pages/hospital/Setup.jsx'))
const HospitalHome = lazy(() => import('./pages/hospital/Dashboard.jsx'))
const OpQueue = lazy(() => import('./pages/hospital/OpQueue.jsx'))
const Appointments = lazy(() => import('./pages/hospital/Appointments.jsx'))
const WalkIns = lazy(() => import('./pages/hospital/WalkIns.jsx'))
const Doctors = lazy(() => import('./pages/hospital/Doctors.jsx'))
const Departments = lazy(() => import('./pages/hospital/Departments.jsx'))
const Staff = lazy(() => import('./pages/hospital/Staff.jsx'))
const Availability = lazy(() => import('./pages/hospital/Availability.jsx'))
const Reports = lazy(() => import('./pages/hospital/Reports.jsx'))
const HospitalProfile = lazy(() => import('./pages/hospital/Profile.jsx'))
const HospitalPlan = lazy(() => import('./pages/hospital/Plan.jsx'))

// Doctor console
const DoctorLayout = lazy(() => import('./components/doctor/DoctorLayout.jsx'))
const DoctorOnboardingLayout = lazy(() => import('./components/doctor/DoctorOnboardingLayout.jsx'))
const DoctorOnboardingAvailability = lazy(() => import('./pages/doctor/OnboardingAvailability.jsx'))
const DoctorOnboardingProfile = lazy(() => import('./pages/doctor/OnboardingProfile.jsx'))
const DoctorOnboardingDone = lazy(() => import('./pages/doctor/OnboardingDone.jsx'))
const DoctorHome = lazy(() => import('./pages/doctor/Dashboard.jsx'))
const DoctorToday = lazy(() => import('./pages/doctor/Today.jsx'))
const DoctorAllAppointments = lazy(() => import('./pages/doctor/AllAppointments.jsx'))
const DoctorCancellations = lazy(() => import('./pages/doctor/Cancellations.jsx'))
const DoctorDelayAlert = lazy(() => import('./pages/doctor/DelayAlert.jsx'))
const DoctorAvailability = lazy(() => import('./pages/doctor/Availability.jsx'))
const DoctorHolidays = lazy(() => import('./pages/doctor/Holidays.jsx'))
const DoctorFees = lazy(() => import('./pages/doctor/Fees.jsx'))
const DoctorPatients = lazy(() => import('./pages/doctor/Patients.jsx'))
const DoctorReports = lazy(() => import('./pages/doctor/Reports.jsx'))
const DoctorNotifications = lazy(() => import('./pages/doctor/Notifications.jsx'))
const DoctorMessages = lazy(() => import('./pages/doctor/Messages.jsx'))
const DoctorProfile = lazy(() => import('./pages/doctor/Profile.jsx'))
const DoctorStaff = lazy(() => import('./pages/doctor/Staff.jsx'))

// Admin + assistant
const AdminLayout = lazy(() => import('./components/admin/AdminLayout.jsx'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const AdminHospitals = lazy(() => import('./pages/admin/Hospitals.jsx'))
const AdminDoctors = lazy(() => import('./pages/admin/Doctors.jsx'))
const Approvals = lazy(() => import('./pages/admin/Approvals.jsx'))
const DoctorVerifications = lazy(() => import('./pages/admin/DoctorVerifications.jsx'))
const AdminSupportRequests = lazy(() => import('./pages/admin/SupportRequests.jsx'))
const AssistantLayout = lazy(() => import('./components/assistant/AssistantLayout.jsx'))
const AssistantHome = lazy(() => import('./pages/assistant/Dashboard.jsx'))
const AssistantQueue = lazy(() => import('./pages/assistant/Queue.jsx'))
const AssistantWalkIn = lazy(() => import('./pages/assistant/WalkIn.jsx'))
const AssistantAppointments = lazy(() => import('./pages/assistant/Appointments.jsx'))
const AssistantPatients = lazy(() => import('./pages/assistant/Patients.jsx'))
const AssistantVitals = lazy(() => import('./pages/assistant/Vitals.jsx'))
const AssistantNotifications = lazy(() => import('./pages/assistant/Notifications.jsx'))

// Hospital pharmacy console
const PharmacyLayout = lazy(() => import('./components/pharmacy/PharmacyLayout.jsx'))
const PharmacyStock = lazy(() => import('./pages/pharmacy/Stock.jsx'))
const PharmacyUpload = lazy(() => import('./pages/pharmacy/Upload.jsx'))
const PharmacyCounter = lazy(() => import('./pages/pharmacy/Counter.jsx'))

/** Lightweight full-screen loader shown while a route chunk streams in. */
function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-teal-600/25 border-t-teal-600" />
    </div>
  )
}

function App() {
  return (
    <I18nProvider>
    <DialogProvider>
    <AuthProvider>
      <BrowserRouter>
        <DisplayScale>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/patient-login" element={<AuthPage role="patient" />} />
          <Route path="/doctor-login" element={<AuthPage role="doctor" />} />
          <Route path="/hospital-login" element={<HospitalLogin />} />
          <Route path="/hospital-signup" element={<HospitalSignup />} />
          {/* old addresses (bookmarks, emails, WhatsApp template links) */}
          <Route path="/clinic-login" element={<LegacyRedirect from="/clinic-login" to="/hospital-login" />} />
          <Route path="/clinic-signup" element={<LegacyRedirect from="/clinic-signup" to="/hospital-signup" />} />
          <Route path="/clinic-dashboard/*" element={<LegacyRedirect from="/clinic-dashboard" to="/hospital-dashboard" />} />
          <Route path="/clinics/:clinicId" element={<LegacyRedirect from="/clinics" to="/hospitals" />} />
          <Route path="/doctor-signup" element={<DoctorSignup />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/tv/:key" element={<TvBoard />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cancellation-refund" element={<CancellationRefund />} />
          <Route path="/medical-disclaimer" element={<MedicalDisclaimer />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/calculators" element={<Calculators />} />
          <Route path="/health-articles" element={<HealthArticles />} />
          <Route path="/insurance" element={<InsurancePage />} />
          <Route path="/search" element={<PublicSearch />} />
          <Route path="/doctors/:doctorId" element={<PublicDoctorProfile />} />
          <Route path="/hospitals/:hospitalId" element={<PublicHospitalProfile />} />

          {/* Patient console */}
          <Route
            path="/patient-dashboard"
            element={
              <RequireAuth roles={['PATIENT']} loginPath="/patient-login">
                <PatientLayout />
              </RequireAuth>
            }
          >
            <Route index element={<PatientHome />} />
            <Route path="appointments/book" element={<PatientBookAppointmentStart />} />
            <Route path="appointments/voice" element={<PatientBookByVoice />} />
            <Route path="appointments/new" element={<PatientBookAppointment />} />
            <Route path="appointments" element={<PatientAppointments />} />
            <Route path="family" element={<PatientFamily />} />
            <Route path="prescriptions" element={<PatientPrescriptions />} />
            <Route path="doctors" element={<PatientDoctors />} />
            <Route path="hospitals" element={<PatientHospitals />} />
            <Route path="clinics" element={<Navigate to="/patient-dashboard/hospitals" replace />} />
            <Route path="health-records" element={<PatientHealthRecords />} />
            <Route path="payments" element={<PatientPayments />} />
            <Route path="notifications" element={<PatientNotifications />} />
            <Route path="profile" element={<PatientProfile />} />
            <Route path="help" element={<PatientHelp />} />
          </Route>

          {/* Complete your profile — a newly approved hospital's owner lands here */}
          <Route
            path="/hospital-setup"
            element={
              <RequireAuth roles={['HOSPITAL_ADMIN']} loginPath="/hospital-login">
                <HospitalSetup />
              </RequireAuth>
            }
          />

          {/* Hospital console — admin only */}
          <Route
            path="/hospital-dashboard"
            element={
              <RequireAuth roles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} loginPath="/hospital-login">
                <HospitalLayout />
              </RequireAuth>
            }
          >
            <Route index element={<HospitalHome />} />
            <Route path="op-queue" element={<OpQueue />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="walk-ins" element={<WalkIns />} />
            <Route path="doctors" element={<Doctors />} />
            <Route path="departments" element={<Departments />} />
            <Route path="staff" element={<Staff />} />
            <Route path="availability" element={<Availability />} />
            <Route path="reports" element={<Reports />} />
            <Route path="profile" element={<HospitalProfile />} />
            <Route path="plan" element={<HospitalPlan />} />
            {/* The hospital bell had nowhere to go, so its red dot could never be
                cleared. Reuses the front-desk feed — same data, same scope. */}
            <Route path="notifications" element={<AssistantNotifications />} />
          </Route>

          {/* Super-Admin console — shared shell with sidebar nav */}
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['SUPER_ADMIN']} loginPath="/hospital-login">
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="hospitals" element={<AdminHospitals />} />
            <Route path="clinics" element={<Navigate to="/admin/hospitals" replace />} />
            <Route path="doctors" element={<AdminDoctors />} />
            <Route path="approvals" element={<Approvals />} />
            <Route path="doctor-verifications" element={<DoctorVerifications />} />
            <Route path="support" element={<AdminSupportRequests />} />
          </Route>

          {/* Assistant (front-desk / receptionist) console */}
          <Route
            path="/assistant-dashboard"
            element={
              <RequireAuth roles={['RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']} loginPath="/hospital-login">
                <AssistantLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AssistantHome />} />
            <Route path="queue" element={<AssistantQueue />} />
            <Route path="walk-in" element={<AssistantWalkIn />} />
            <Route path="appointments" element={<AssistantAppointments />} />
            {/* Merged into the Patients page; kept so old links still land. */}
            <Route path="patient-search" element={<Navigate to="../patients" replace />} />
            <Route path="patients" element={<AssistantPatients />} />
            <Route path="vitals" element={<AssistantVitals />} />
            <Route path="lab-tests" element={<ComingSoon title="Lab Test Orders" subtitle="Order and track lab tests." />} />
            <Route path="medicines" element={<ComingSoon title="Medicine Dispensed" subtitle="Dispense and track medicines." />} />
            <Route path="messages" element={<ComingSoon title="Messages" subtitle="Patient and team messaging." />} />
            <Route path="notifications" element={<AssistantNotifications />} />
          </Route>

          {/* Hospital pharmacy console — the stock list doctors prescribe from */}
          <Route
            path="/pharmacy-dashboard"
            element={
              <RequireAuth roles={['PHARMACIST', 'HOSPITAL_ADMIN']} loginPath="/hospital-login">
                <PharmacyLayout />
              </RequireAuth>
            }
          >
            <Route index element={<PharmacyStock />} />
            <Route path="upload" element={<PharmacyUpload />} />
            <Route path="counter" element={<PharmacyCounter />} />
            {/* Prescriptions and walk-in sales were two pages; both now live on the counter. */}
            <Route path="prescriptions" element={<Navigate to="../counter" replace />} />
            <Route path="walkin-sales" element={<Navigate to="../counter?tab=walkin" replace />} />
          </Route>

          {/* Doctor first-login setup — intentionally outside the dashboard shell. */}
          <Route
            path="/doctor-onboarding"
            element={
              <RequireAuth roles={['DOCTOR']} loginPath="/doctor-login">
                <DoctorOnboardingLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="availability" replace />} />
            <Route path="availability" element={<DoctorOnboardingAvailability />} />
            <Route path="profile" element={<DoctorOnboardingProfile />} />
            <Route path="done" element={<DoctorOnboardingDone />} />
          </Route>
          {/* Doctor console */}
          <Route
            path="/doctor-dashboard"
            element={
              <RequireAuth roles={['DOCTOR']} loginPath="/doctor-login">
                <DoctorLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DoctorHome />} />
            <Route path="today" element={<DoctorToday />} />
            <Route path="appointments" element={<DoctorAllAppointments />} />
            <Route path="cancellations" element={<DoctorCancellations />} />
            {/* Live OP Queue folded into the dashboard — the queue, its table and
                every per-row action live there now. Redirect so old links, the
                browser's history and any bookmark still land somewhere useful. */}
            <Route path="queue" element={<Navigate to=".." replace />} />
            {/* Token History folded into Appointments — that page now shows the
                token, time seen and wait beside the booking. Redirect so old
                bookmarks don't 404. */}
            <Route path="token-history" element={<Navigate to="../appointments" replace />} />
            <Route path="delay-alert" element={<DoctorDelayAlert />} />
            <Route path="availability" element={<DoctorAvailability />} />
            <Route path="holidays" element={<DoctorHolidays />} />
            <Route path="fees" element={<DoctorFees />} />
            <Route path="patients" element={<DoctorPatients />} />
            <Route path="reports" element={<DoctorReports />} />
            <Route path="analytics" element={<Navigate to="/doctor-dashboard/reports" replace />} />
            <Route path="notifications" element={<DoctorNotifications />} />
            <Route path="messages" element={<DoctorMessages />} />
            <Route path="profile" element={<DoctorProfile />} />
            <Route path="staff" element={<DoctorStaff />} />
          </Route>
        </Routes>
        </Suspense>
        </DisplayScale>
      </BrowserRouter>
    </AuthProvider>
    </DialogProvider>
    </I18nProvider>
  )
}

export default App
