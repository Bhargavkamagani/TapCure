import PolicyReader from '../../components/landing/PolicyReader.jsx'

/**
 * Public Privacy Policy page (route: /privacy).
 * Layout and section list: components/landing/PolicyReader.jsx and
 * pages/legal/policyData.js (2026-11-07). Wording: the legal* dictionaries.
 */
export default function PrivacyPolicy() {
  return <PolicyReader policy="privacy" />
}
