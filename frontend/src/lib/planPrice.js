/**
 * What the screens SHOW for plan prices while they are ₹0 (2026-10-27): X's,
 * one per digit of the old price (₹499 → ₹0xx, ₹1,999 → ₹0,xxx). Billing still
 * uses the real numbers from the API — this is display only. Mirrors
 * PRICE_SHOWN in backend services/booking_quota.py.
 * To show real prices again: empty this table.
 */
export const PRICE_SHOWN = {
  starter: { price: '₹0xx', fee: '₹0', limit: '₹0xx' },
  smart_hospital: { price: '₹0xx', fee: '₹0', limit: '₹0,xxx' },
  pro: { price: '₹0,xxx', fee: '₹0', limit: '₹0,xxx', extraDoctor: '₹0xx' },
  hospital: { price: '₹0,xxx' },
}

/** The label for `code`'s `field`, or `fallback` (the real formatted amount). */
export const shownPrice = (code, field, fallback) => PRICE_SHOWN[code]?.[field] ?? fallback
