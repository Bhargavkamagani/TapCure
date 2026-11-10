import { useNavigate, Navigate } from 'react-router-dom'
import AuthModal from '../components/auth/AuthModal.jsx'
import PatientAuthPage from './PatientAuthPage.jsx'
import DoctorAuthPage from './DoctorAuthPage.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function AuthPage({ role }) {
  const navigate = useNavigate()
  const { user, loading, homeFor } = useAuth()

  // Someone who is already signed in has no business seeing a login form —
  // this route is reachable by typing the URL or by pressing Back into stale
  // history. Send them to their own console, replacing the entry so Back
  // doesn't ping-pong between the two.
  if (!loading && user) return <Navigate to={homeFor(user.role_name)} replace />

  // /patient-login has its own page look (2026-11-08); same form and logic
  // (PatientVoiceAuth). /doctor-login likewise (DoctorAuthPage, same sign-in
  // logic as the doctor form in AuthModal).
  if (role === 'patient') return <PatientAuthPage />
  if (role === 'doctor') return <DoctorAuthPage />

  return (
    <AuthModal
      open
      page
      role={role}
      onClose={() => navigate('/')}
    />
  )
}

export default AuthPage
