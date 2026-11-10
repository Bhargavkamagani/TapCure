import { Navigate } from 'react-router-dom'

/**
 * /policies — the four policies now share one reader with the list of all four
 * on its left (2026-11-07), so this hub simply opens it at the Privacy Policy.
 */
export default function Policies() {
  return <Navigate to="/privacy" replace />
}
