import { createContext, useContext, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Landing-wide auth modal. Provides `openAuth(role)` to any component so hero
 * CTAs, navbar links, specialty chips etc. can all launch the login/signup
 * flow, while the modal itself is rendered once here.
 */
const Ctx = createContext(null)

export function AuthModalProvider({ children }) {
  const navigate = useNavigate()
  const openAuth = useCallback((role = 'patient') => {
    navigate(role === 'doctor' ? '/doctor-login' : '/patient-login')
  }, [navigate])
  const closeAuth = useCallback(() => navigate('/'), [navigate])

  // Preserve the old deep links by forwarding them to the full login pages.
  useEffect(() => {
    const role = new URLSearchParams(window.location.search).get('auth')
    if (role === 'patient' || role === 'doctor') openAuth(role)
  }, [openAuth])

  return (
    <Ctx.Provider value={{ openAuth, closeAuth }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuthModal() {
  return useContext(Ctx) || { openAuth: () => {}, closeAuth: () => {} }
}
