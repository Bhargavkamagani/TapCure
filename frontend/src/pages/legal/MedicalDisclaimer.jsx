import PolicyReader from '../../components/landing/PolicyReader.jsx'

/**
 * Public Medical Disclaimer page (route: /medical-disclaimer).
 * Layout and section list: components/landing/PolicyReader.jsx and
 * pages/legal/policyData.js (2026-11-07). Wording: the legal* dictionaries.
 */
export default function MedicalDisclaimer() {
  return <PolicyReader policy="disclaimer" />
}
