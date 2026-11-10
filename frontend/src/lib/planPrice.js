/**
 * What the screens SHOW for plan prices while billing is ₹0: the real list
 * prices (2026-11-02; were ₹0xx placeholders from 2026-10-27). Billing still
 * uses the numbers from the API (₹0) — this is display only. Mirrors
 * PRICE_SHOWN in backend services/booking_quota.py.
 * To show real prices again: empty this table.
 */
export const PRICE_SHOWN = {
  starter: { price: '₹499', fee: '₹4', limit: '₹999' },
  smart_hospital: { price: '₹999', fee: '₹3', limit: '₹1,999' },
  pro: { price: '₹1,999', fee: '₹2', limit: '₹4,999', extraDoctor: '₹599' },
  hospital: { price: '₹4,999' },
}

/** The label for `code`'s `field`, or `fallback` (the real formatted amount). */
export const shownPrice = (code, field, fallback) => PRICE_SHOWN[code]?.[field] ?? fallback
