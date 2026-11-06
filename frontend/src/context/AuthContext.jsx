import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api'
import { clearTokens, restoreSession } from '../api/client.js'

/**
 * Real auth context backed by the API.
 *  - On mount: if this browser has a session, trade the HttpOnly refresh
 *    cookie for an access token, then rehydrate the user via /auth/me.
 *  - login(identifier, password) -> stores JWT + user.
 *  - register(payload) -> patient self-signup.
 *  - homeFor(role) -> the console route for a backend role.
 */
const AuthContext = createContext(null)

const ROLE_HOME = {
  PATIENT: '/patient-dashboard',
  DOCTOR: '/doctor-dashboard',
  HOSPITAL_ADMIN: '/hospital-dashboard',
  RECEPTIONIST: '/assistant-dashboard',
  PHARMACIST: '/pharmacy-dashboard',
  SUPER_ADMIN: '/admin',
}

export function homeFor(role) {
  return ROLE_HOME[role] || '/'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (await restoreSession()) {
        try {
          const me = await authApi.me()
          if (active) setUser(me)
        } catch {
          clearTokens()
        }
      }
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const login = async (identifier, password, portal) => {
    const data = await authApi.login(identifier, password, portal)
    setUser(data.user)
    return data.user
  }

  const register = async (payload) => {
    const data = await authApi.register(payload)
    setUser(data.user)
    return data.user
  }

  // Mobile-OTP patient auth.
  // `mode` ('login' | 'register') lets the server validate before spending an OTP.
  const requestOtp = (phone, mode) => authApi.otpRequest(phone, mode)
  const loginOtp = async (phone, otp) => {
    const data = await authApi.otpLogin(phone, otp)
    setUser(data.user)
    return data.user
  }
  const registerOtp = async (payload) => {
    const data = await authApi.otpRegister(payload)
    setUser(data.user)
    return data.user
  }

  /**
   * Log out and land on the public site — back-button-proof.
   *
   * The old version cleared state and left the caller to `navigate('/')`, which
   * PUSHES: the console URL stayed one Back press away, so the address bar
   * bounced back into /hospital-dashboard and only then redirected to the login
   * page. Replacing the history entry with a full document load kills that
   * bounce and drops every page's in-memory patient data with it — these
   * consoles run on a shared front-desk machine.
   */
  const logout = () => {
    // Waits for the server to drop the refresh cookie before leaving the page;
    // otherwise the next page load would sign straight back in from it.
    authApi.logout().finally(() => {
      setUser(null)
      window.location.replace('/')
    })
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, requestOtp, loginOtp, registerOtp, logout, homeFor }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
