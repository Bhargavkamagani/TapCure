import PolicyReader from '../../components/landing/PolicyReader.jsx'

/**
 * Public Terms & Conditions page (route: /terms).
 * Layout and section list: components/landing/PolicyReader.jsx and
 * pages/legal/policyData.js (2026-11-07). Wording: the legal* dictionaries.
 */
export default function Terms() {
  return <PolicyReader policy="terms" />
}
