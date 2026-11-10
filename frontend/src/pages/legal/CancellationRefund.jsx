import PolicyReader from '../../components/landing/PolicyReader.jsx'

/**
 * Public Cancellation & Refund Policy page (route: /cancellation-refund). Required as a separately-linkable URL by payment gateways.
 * Layout and section list: components/landing/PolicyReader.jsx and
 * pages/legal/policyData.js (2026-11-07). Wording: the legal* dictionaries.
 */
export default function CancellationRefund() {
  return <PolicyReader policy="refund" />
}
