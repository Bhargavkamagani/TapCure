"""
Razorpay client — thin wrapper over the REST API (no SDK dependency).

Only two operations are needed for booking-fee payments:
  * create_order()      — server creates an order with the fee amount; the
                          returned order_id is what the browser checkout opens.
  * verify_signature()  — after the patient pays, the browser returns
                          (order_id, payment_id, signature); we recompute the
                          HMAC with our secret to prove the payment is genuine
                          and wasn't forged client-side.

The key_secret never leaves the server. `is_configured()` lets callers degrade
gracefully (skip the payment step) when no keys are set.
"""
import hashlib
import hmac

import httpx

from ..config import settings

_API = "https://api.razorpay.com/v1"


def is_configured() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


def create_order(amount_paise: int, receipt: str, notes: dict | None = None) -> dict:
    """Create a Razorpay order. amount_paise is the fee in the smallest unit
    (₹100 → 10000). Raises httpx.HTTPStatusError on a non-2xx from Razorpay."""
    resp = httpx.post(
        f"{_API}/orders",
        json={"amount": amount_paise, "currency": "INR", "receipt": receipt, "notes": notes or {}},
        auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
        timeout=20.0,
    )
    resp.raise_for_status()
    return resp.json()


def _post(path: str, body: dict) -> dict:
    resp = httpx.post(f"{_API}{path}", json=body,
                      auth=(settings.razorpay_key_id, settings.razorpay_key_secret), timeout=20.0)
    resp.raise_for_status()
    return resp.json()


def _get(path: str) -> dict:
    resp = httpx.get(f"{_API}{path}", auth=(settings.razorpay_key_id, settings.razorpay_key_secret), timeout=20.0)
    resp.raise_for_status()
    return resp.json()


# ---- UPI Autopay (recurring payments) for hospital subscriptions -------------
# Flow: customer → authorisation order carrying a `token` (the mandate, with
# its max amount) → hospital approves it once in their UPI app via Checkout
# (recurring=1) → each month: a plain order + /payments/create/recurring
# against the saved token. Razorpay sends the NPCI pre-debit notice.
def create_customer(name: str, email: str, contact: str) -> dict:
    # fail_existing=0 returns the existing customer instead of an error.
    return _post("/customers", {"name": name[:50], "email": email, "contact": contact, "fail_existing": "0"})


def create_mandate_order(amount_paise: int, customer_id: str, max_amount_paise: int,
                         expire_at: int, receipt: str, notes: dict | None = None) -> dict:
    return _post("/orders", {
        "amount": amount_paise, "currency": "INR", "customer_id": customer_id,
        "method": "upi", "receipt": receipt, "notes": notes or {},
        "token": {"max_amount": max_amount_paise, "expire_at": expire_at, "frequency": "monthly"},
    })


def fetch_payment(payment_id: str) -> dict:
    return _get(f"/payments/{payment_id}")


def create_recurring_payment(*, order_id: str, amount_paise: int, customer_id: str, token_id: str,
                             email: str, contact: str, description: str, notes: dict | None = None) -> dict:
    """Debit an order from an approved mandate. The order is created first
    (create_order) and stored by the caller, so the webhook can match the debit
    even if this call times out after Razorpay accepted it."""
    return _post("/payments/create/recurring", {
        "email": email, "contact": contact, "amount": amount_paise, "currency": "INR",
        "order_id": order_id, "customer_id": customer_id, "token": token_id,
        "recurring": "1", "description": description, "notes": notes or {},
    })


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """True if `signature` is the genuine HMAC-SHA256 of "order_id|payment_id"
    keyed by our secret — i.e. the payment really happened on our account.

    Returns False outright when no secret is configured. Without that line this
    function was worse than useless on a blank key: HMAC happily keys on b"",
    so ANY caller could compute a signature that verifies, and a forged confirm
    created a real appointment plus a payment row reading status='booked'. It
    was reproduced end to end on 2026-09-22 — 200 OK, one appointment, ₹10
    recorded as taken, no money anywhere.

    This is deliberately here rather than only at the endpoint: every present
    and future caller of this function inherits the refusal.
    """
    if not is_configured():
        return False
    if not (order_id and payment_id and signature):
        return False
    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def webhook_configured() -> bool:
    return bool(settings.razorpay_webhook_secret)


def verify_webhook(raw_body: bytes, signature: str) -> bool:
    """True if a webhook request genuinely came from Razorpay — its signature is
    the HMAC-SHA256 of the raw body keyed by the dashboard webhook secret."""
    if not (settings.razorpay_webhook_secret and signature):
        return False
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
