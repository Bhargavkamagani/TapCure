"""Monthly bills for the subscription plans, and UPI Autopay through Razorpay.

A month's bill (IST calendar month) is:

* each plan the hospital was on that month, for the days it was on it — so a
  hospital that upgrades on the 18th pays 17 days of the old plan and 14 of the
  new one (monthly billing only; a yearly plan is paid up front);
* Pro extra doctors, the same way;
* booking packs bought that month;
* extra bookings, under the plan the month ENDED on, capped at its limit
  (services/booking_quota.month_usage);
* 18% GST on top.

`run_month_end` (python -m app.jobs.monthly_invoices, on the 1st) writes last
month's invoices, charges the ones whose hospital has an active autopay
mandate, renews yearly plans and marks unpaid invoices overdue. Hospitals
without autopay pay from the Plan & Bookings page (Razorpay Checkout).
"""
from uuid import UUID
import logging
import math
import time
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from ..config import settings
from ..database import utcnow
from ..models import BillingMandate, Hospital, Invoice, Role, Subscription, User
from ..rbac import ROLE_SUPER_ADMIN
from . import booking_quota as quota
from . import notifications as notify
from . import razorpay_client as rzp

log = logging.getLogger("billing")

GST = 0.18
DUE_DAYS = 7
# How long an autopay debit is given to land (UPI sends a pre-debit notice and
# debits a day or so later) before the hospital may pay the same bill by hand.
AUTOPAY_SETTLE_DAYS = 3
# Session-level advisory lock key for the month-end run (Postgres only).
_RUN_LOCK_KEY = 0x7A9C11


def _today() -> date:
    return datetime.now(quota._IST).date()


def _month_dates(key: str) -> tuple[date, date, int]:
    y, m = (int(p) for p in key.split("-"))
    first = date(y, m, 1)
    nxt = date(y + (m == 12), m % 12 + 1, 1)
    return first, nxt, (nxt - first).days


def _prev_month(on: date | None = None) -> str:
    d = (on or _today()).replace(day=1) - timedelta(days=1)
    return quota.month_key(d)


def _sub_days(sub: Subscription, first: date, nxt: date) -> int:
    """Days of [first, nxt) this subscription was the hospital's plan."""
    if sub.status not in quota.LIVE_STATUSES and sub.cancelled_at is None:
        return 0  # expired / suspended: not billed
    start = max(sub.start_date or first, first)
    end = nxt
    if sub.cancelled_at is not None:
        at = sub.cancelled_at if sub.cancelled_at.tzinfo else sub.cancelled_at.replace(tzinfo=timezone.utc)
        end = min(end, at.astimezone(quota._IST).date())
    return max(0, (end - start).days)


def _subs(db: Session, hospital_id: UUID) -> list[Subscription]:
    return db.scalars(select(Subscription).where(Subscription.hospital_id == hospital_id)
                      .order_by(Subscription.subscription_id)).all()


def _money(x: float) -> float:
    return round(float(x) + 1e-9, 2)


def month_bill(db: Session, hospital_id: UUID, key: str) -> dict:
    """The bill for one month as lines. For the current month it's 'so far',
    with the live plan counted to the end of the month."""
    first, nxt, dim = _month_dates(key)
    lines: list[dict] = []
    final: Subscription | None = None
    for sub in _subs(db, hospital_id):
        spec = quota._spec(sub)
        if spec is None:
            continue
        days = _sub_days(sub, first, nxt)
        if days <= 0:
            continue
        final = sub
        if sub.plan.code == "pilot" or sub.billing_cycle == "annually":
            continue
        share = days / dim
        disc = 1 - float(sub.discount_pct or 0) / 100
        part = "" if days >= dim else f" ({days} of {dim} days)"
        lines.append({"label": f"{spec['name']} plan{part}", "amount": _money(spec["price"] * disc * share)})
        extra = int(sub.extra_doctors or 0) if sub.plan.code == "pro" else 0
        if extra:
            lines.append({"label": f"{extra} extra doctor{'s' if extra > 1 else ''}{part}",
                          "amount": _money(extra * spec["extra_doctor_fee"] * share)})

    capped = False
    if final is not None and final.plan.code != "pilot":
        u = quota.month_usage(db, hospital_id, key, final)
        if u["packs"]:
            lines.append({"label": f"Booking packs ({u['pack_bookings']} bookings)", "amount": _money(u["packs"])})
        if u["overage"]:
            lines.append({"label": f"Extra bookings ({u['over']} × ₹{u['fee']})" + (" — capped at limit" if u["overage_capped"] else ""),
                          "amount": _money(u["overage"])})
        capped = u["overage_capped"]
    subtotal = _money(sum(line["amount"] for line in lines))
    gst = _money(subtotal * GST)
    spec = quota._spec(final) if final else None
    return {"month": key, "lines": lines, "subtotal": subtotal, "gst": gst, "total": _money(subtotal + gst),
            "overage_capped": capped, "limit": spec.get("limit") if spec else None}


def _hospital_code(db: Session, hospital_id) -> str:
    """The hospital's part of an invoice number: its short code (unique, readable)
    — ids are UUIDs now, too long for a bill. Falls back to 8 id characters."""
    h = db.get(Hospital, hospital_id)
    code = (h.short_code or "").strip().upper() if h else ""
    return code or str(hospital_id).replace("-", "")[-8:].upper()


def _new_invoice(db: Session, sub: Subscription, number: str, lines: list[dict], month: str | None) -> Invoice:
    subtotal = _money(sum(line["amount"] for line in lines))
    gst = _money(subtotal * GST)
    inv = Invoice(
        subscription_id=sub.subscription_id, hospital_id=sub.hospital_id, plan_id=sub.plan_id,
        invoice_number=number, amount=subtotal, tax_amount=gst, total_amount=_money(subtotal + gst),
        due_date=_today() + timedelta(days=DUE_DAYS), status="sent", billing_month=month, lines_json=lines,
    )
    db.add(inv)
    db.flush()
    return inv


def generate_month_invoice(db: Session, hospital_id: UUID, key: str) -> Invoice | None:
    """Write the month's invoice once. Returns None when nothing is owed."""
    existing = db.scalar(select(Invoice).where(Invoice.hospital_id == hospital_id, Invoice.billing_month == key))
    if existing:
        return existing
    bill = month_bill(db, hospital_id, key)
    if bill["subtotal"] <= 0:
        return None
    first, nxt, _ = _month_dates(key)
    subs = [s for s in _subs(db, hospital_id) if _sub_days(s, first, nxt) > 0]
    return _new_invoice(db, subs[-1], f"TC-{key.replace('-', '')}-{_hospital_code(db, hospital_id)}", bill["lines"], key)


def _yearly_lines(sub: Subscription) -> list[dict] | None:
    """10 months' price (+ Pro extra doctors) for a year of `sub`'s plan."""
    spec = quota._spec(sub)
    if spec is None or sub.plan.code == "pilot" or not spec["price"]:
        return None
    disc = 1 - float(sub.discount_pct or 0) / 100
    lines = [{"label": f"{spec['name']} plan — 1 year (pay 10 months)", "amount": _money(spec["price"] * 10 * disc)}]
    extra = int(sub.extra_doctors or 0) if sub.plan.code == "pro" else 0
    if extra:
        lines.append({"label": f"{extra} extra doctor{'s' if extra > 1 else ''} — 1 year",
                      "amount": _money(extra * spec["extra_doctor_fee"] * 10)})
    return lines


def yearly_invoice(db: Session, sub: Subscription) -> Invoice | None:
    """Yearly prepay: 10 months' price (+ Pro extra doctors), billed up front."""
    lines = _yearly_lines(sub)
    if lines is None or sub.billing_cycle != "annually":
        return None
    stamp = (sub.start_date or _today()).strftime("%Y%m%d")
    n = 1 + len(db.scalars(select(Invoice.invoice_id).where(
        Invoice.hospital_id == sub.hospital_id, Invoice.invoice_number.like(f"TC-Y{stamp}-%"))).all())
    return _new_invoice(db, sub, f"TC-Y{stamp}-{_hospital_code(db, sub.hospital_id)}-{n}", lines, None)


# ------------------------------------------------------ monthly → yearly ----
# The hospital pays the year FIRST: start_yearly writes a "draft" invoice (not
# owed — no reminders, no booking pause) and opens Checkout; only when that is
# paid does activate_yearly move the hospital to the yearly plan. Not paid →
# nothing changes and monthly billing carries on. No bill is ever skipped.
YEARLY_SWITCH_PREFIX = "TC-YS"


def yearly_offer(sub: Subscription | None) -> dict | None:
    """What a year would cost a hospital on a live monthly paid plan, or None."""
    if sub is None or sub.status not in quota.LIVE_STATUSES or sub.billing_cycle != "monthly":
        return None
    lines = _yearly_lines(sub)
    if lines is None:
        return None
    subtotal = _money(sum(line["amount"] for line in lines))
    gst = _money(subtotal * GST)
    spec = quota._spec(sub)
    return {"lines": lines, "subtotal": subtotal, "gst": gst, "total": _money(subtotal + gst),
            "twelve_months_price": _money(spec["price"] * 12)}


def start_yearly(db: Session, me: User, hospital_id: UUID) -> dict:
    if not rzp.is_configured():
        raise PaymentsNotSetUp()
    quota.lock_hospital_plan(db, hospital_id)
    sub = quota.current_subscription(db, hospital_id)
    offer = yearly_offer(sub)
    if offer is None:
        raise ValueError("Paying yearly isn't available for your plan right now.")
    drafts = db.scalars(select(Invoice).where(
        Invoice.hospital_id == hospital_id, Invoice.status == "draft",
        Invoice.invoice_number.like(f"{YEARLY_SWITCH_PREFIX}%"),
    )).all()
    # Reuse an open offer for the same plan and price (its Checkout order may
    # already have a payment on it); anything else is out of date.
    inv = next((d for d in drafts if d.subscription_id == sub.subscription_id
                and abs(float(d.total_amount) - offer["total"]) < 0.005), None)
    for d in drafts:
        if d is not inv:
            d.status = "void"
    if inv is None:
        n = 1 + len(db.scalars(select(Invoice.invoice_id).where(
            Invoice.hospital_id == hospital_id, Invoice.invoice_number.like(f"{YEARLY_SWITCH_PREFIX}%"))).all())
        inv = _new_invoice(db, sub, f"{YEARLY_SWITCH_PREFIX}{_today():%Y%m%d}-{_hospital_code(db, hospital_id)}-{n}",
                           offer["lines"], None)
        inv.status = "draft"
    db.commit()
    return {**pay_order(db, inv), "invoice_id": inv.invoice_id, "invoice_number": inv.invoice_number,
            "total": float(inv.total_amount)}


# ------------------------------------------------------------ month end ----
def _run_lock(db: Session):
    """One month-end run at a time across every API instance and cron.

    A dedicated connection holds a Postgres session advisory lock for the whole
    run (the Session commits many times and would hand its connection back).
    Returns that connection, False when another run holds the lock, or None on
    SQLite (zero-setup dev: no lock needed).
    """
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return None
    conn = bind.connect()
    if conn.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": _RUN_LOCK_KEY}):
        return conn
    conn.close()
    return False


def _run_unlock(conn) -> None:
    if conn:
        try:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _RUN_LOCK_KEY})
            conn.commit()
        finally:
            conn.close()


def run_month_end(db: Session, key: str | None = None) -> dict:
    """Last month's invoices + autopay charges + yearly renewals + overdue marks
    + unpaid reminders. Safe to run any number of times: an invoice per hospital
    per month is written once, an invoice is debited at most once, and each
    reminder is sent once."""
    key = key or _prev_month()
    lock = _run_lock(db)
    if lock is False:
        return {"month": key, "skipped": "another billing run is in progress"}
    try:
        return _month_end(db, key)
    finally:
        _run_unlock(lock)


def _month_end(db: Session, key: str) -> dict:
    today = _today()
    hospital_ids = {s.hospital_id for s in db.scalars(select(Subscription)).all() if quota._spec(s)}
    made, fresh, charged, failed, renewed = [], [], [], [], []
    for hid in sorted(hospital_ids):
        had = db.scalar(select(Invoice.invoice_id).where(Invoice.hospital_id == hid, Invoice.billing_month == key))
        inv = generate_month_invoice(db, hid, key)
        if inv is not None:
            made.append(inv.invoice_number)
            if not had:
                fresh.append(inv)
        # Yearly plans whose year is up: renew for another year and bill it —
        # or, if the hospital chose "switch to monthly when this year ends", move
        # it to the same plan billed monthly from today.
        sub = quota.current_subscription(db, hid)
        if sub and sub.status == "active" and sub.billing_cycle == "annually" and sub.end_date and sub.end_date < today:
            if sub.auto_renew:
                sub.start_date, sub.end_date = sub.end_date, sub.end_date + timedelta(days=365)
                y = yearly_invoice(db, sub)
                if y:
                    renewed.append(y.invoice_number)
                    fresh.append(y)
            else:
                quota.assign_plan(db, hid, sub.plan.code, billing_cycle="monthly",
                                  extra_doctors=int(sub.extra_doctors or 0), discount_pct=float(sub.discount_pct or 0))
                _tell_hospital(db, hid, "You're on monthly billing now",
                             f"Your yearly {sub.plan.name} plan has ended, as you chose. It continues month by month, "
                             "billed at the end of each month.")
    db.commit()
    for inv in fresh:
        _tell_new_bill(db, inv)
    db.commit()
    # Autopay debits only THIS month's bill (and yearly renewals made in this
    # run). Older unpaid invoices are never debited automatically: they may
    # have been settled offline, and the hospital never agreed to a catch-up.
    due = db.scalars(select(Invoice).where(
        Invoice.status == "sent", Invoice.autopay_attempted_at.is_(None), Invoice.razorpay_payment_id.is_(None),
        or_(Invoice.billing_month == key, Invoice.invoice_number.in_(renewed or [""])),
    )).all()
    for inv in due:
        if active_mandate(db, inv.hospital_id):
            (charged if charge_invoice(db, inv) else failed).append(inv.invoice_number)
    reminded = remind_unpaid(db, today)
    db.commit()
    for hid in sorted(hospital_ids):
        quota.pilot_reminders(db, hid)
    db.commit()
    return {"month": key, "invoices": made, "yearly_renewals": renewed, "autopay_charged": charged,
            "autopay_failed": failed, "reminders_sent": reminded}


# ------------------------------------------------------------- messages ----
def _super_admins(db: Session) -> list[User]:
    return db.scalars(
        select(User).join(Role, Role.role_id == User.role_id).where(
            Role.name == ROLE_SUPER_ADMIN, User.status == "active",
        )
    ).all()


def _tell_hospital(db: Session, hospital_id: UUID, title: str, msg: str) -> None:
    for u in quota._hospital_admins(db, hospital_id):
        notify.send_staff_in_app(db, u.user_id, msg, ntype="billing", title=title, hospital_id=hospital_id)


def _tell_tapcure(db: Session, hospital_id: UUID, title: str, msg: str) -> None:
    for u in _super_admins(db):
        notify.send_staff_in_app(db, u.user_id, msg, ntype="billing", title=title, hospital_id=hospital_id)


def _hospital_name(db: Session, hospital_id: UUID) -> str:
    h = db.get(Hospital, hospital_id)
    return h.name if h else f"Hospital #{str(hospital_id)[-8:].upper()}"


def _rs(x) -> str:
    return f"₹{float(x):,.2f}"


def _tell_new_bill(db: Session, inv: Invoice) -> None:
    what = f"Bill {inv.invoice_number} for {_rs(inv.total_amount)}"
    if active_mandate(db, inv.hospital_id):
        msg = f"{what} is ready. It will be collected by UPI Autopay."
    else:
        msg = f"{what} is ready, due {inv.due_date:%d %b %Y}. Pay it from Plan & Bookings."
    _tell_hospital(db, inv.hospital_id, "New TapCure bill", msg)


# --------------------------------------------------------- unpaid bills ----
def _is_new_billing(inv: Invoice) -> bool:
    # The old /subscriptions invoices (INV-YYYY-nnnn) predate this billing and
    # may have been settled offline, so they never pause bookings or nag.
    return (inv.invoice_number or "").startswith("TC-")


def unpaid_invoice(db: Session, hospital_id: UUID) -> Invoice | None:
    """An invoice unpaid for billing_grace_days past its due date, which pauses
    the hospital's ONLINE bookings (walk-ins keep working). None when fine."""
    cutoff = _today() - timedelta(days=settings.billing_grace_days)
    return db.scalar(select(Invoice).where(
        Invoice.hospital_id == hospital_id, Invoice.status.in_(("sent", "overdue")),
        Invoice.invoice_number.like("TC-%"), Invoice.due_date <= cutoff,
    ).order_by(Invoice.due_date).limit(1))


def remind_unpaid(db: Session, today: date | None = None) -> list[str]:
    """Mark past-due invoices overdue and send each unpaid-bill reminder once:
    due today, 3 days late, 7 days late, and when online bookings pause."""
    today = today or _today()
    grace = settings.billing_grace_days
    sent: list[str] = []
    for inv in db.scalars(select(Invoice).where(Invoice.status.in_(("sent", "overdue")),
                                                Invoice.due_date.is_not(None))).all():
        if inv.status == "sent" and inv.due_date < today:
            inv.status = "overdue"
        if not _is_new_billing(inv) or autopay_pending(inv):
            continue
        late = (today - inv.due_date).days
        stage = 4 if late >= grace else 3 if late >= 7 else 2 if late >= 3 else 1 if late >= 0 else 0
        if stage <= (inv.reminder_stage or 0):
            continue
        inv.reminder_stage = stage
        bill = f"Bill {inv.invoice_number} ({_rs(inv.total_amount)})"
        if stage == 4:
            _tell_hospital(db, inv.hospital_id, "Online bookings paused",
                         f"{bill} is unpaid, so patients can't book you online for now. Walk-ins still work. "
                         "Pay it from Plan & Bookings and online bookings reopen at once.")
            _tell_tapcure(db, inv.hospital_id, "Hospital bookings paused for an unpaid bill",
                          f"{_hospital_name(db, inv.hospital_id)}: {bill} is {late} days past due. "
                          "Online bookings are paused until it is paid.")
        elif stage == 1:
            _tell_hospital(db, inv.hospital_id, "TapCure bill due today",
                         f"{bill} is due today. Pay it from Plan & Bookings.")
        else:
            pause_on = inv.due_date + timedelta(days=grace)
            _tell_hospital(db, inv.hospital_id, "TapCure bill overdue",
                         f"{bill} is {late} days overdue. Please pay it from Plan & Bookings — "
                         f"online bookings pause on {pause_on:%d %b} if it is still unpaid.")
        sent.append(f"{inv.invoice_number}:{stage}")
    return sent


# --------------------------------------------------------------- autopay ----
class PaymentsNotSetUp(Exception):
    pass


def active_mandate(db: Session, hospital_id: UUID) -> BillingMandate | None:
    return db.scalar(select(BillingMandate).where(BillingMandate.hospital_id == hospital_id, BillingMandate.status == "active")
                     .order_by(BillingMandate.mandate_id.desc()))


def mandate_max(sub: Subscription | None) -> float:
    """Most a month can cost on this plan, incl. GST — the mandate's ceiling.
    A pilot sets it up for Smart Hospital, the plan most pilots move to."""
    spec = quota._spec(sub)
    if spec is None or sub.plan.code == "pilot":
        spec = quota.CATALOG["smart_hospital"]
    ceiling = spec.get("limit") or spec["price"] * 2
    ceiling += int(sub.extra_doctors or 0) * spec.get("extra_doctor_fee", 0) if sub and sub.plan.code == "pro" else 0
    return float(math.ceil(ceiling * (1 + GST)))


def autopay_status(db: Session, hospital_id: UUID) -> dict:
    sub = quota.current_subscription(db, hospital_id)
    m = active_mandate(db, hospital_id)
    need = mandate_max(sub)
    return {
        "configured": rzp.is_configured(),
        "active": m is not None,
        "max_amount": float(m.max_amount) if m else None,
        "needs_update": bool(m and float(m.max_amount) < need),
        "suggested_max": need,
    }


def _contact(db: Session, hospital_id: UUID, me: User | None) -> tuple[str, str, str]:
    h = db.get(Hospital, hospital_id)
    email = (h.email if h and h.email else None) or (me.email if me else "") or ""
    phone = (h.phone if h and h.phone else None) or (me.phone if me else "") or ""
    return (h.name if h else "Hospital"), email, "".join(ch for ch in phone if ch.isdigit())[-10:]


def start_autopay(db: Session, me: User, hospital_id: UUID) -> dict:
    """Create the mandate order the hospital approves once in Checkout."""
    if not rzp.is_configured():
        raise PaymentsNotSetUp()
    sub = quota.current_subscription(db, hospital_id)
    name, email, contact = _contact(db, hospital_id, me)
    cust = rzp.create_customer(name, email, contact)
    max_amount = mandate_max(sub)
    order = rzp.create_mandate_order(
        settings_auth_paise(), cust["id"], int(max_amount * 100),
        expire_at=int(time.time()) + 5 * 365 * 86400,
        receipt=f"mandate-{hospital_id}-{int(time.time())}", notes={"hospital_id": str(hospital_id), "purpose": "autopay"},
    )
    db.add(BillingMandate(hospital_id=hospital_id, razorpay_customer_id=cust["id"], razorpay_order_id=order["id"],
                          max_amount=max_amount, status="created", created_by=me.user_id))
    db.commit()
    return {"key_id": settings.razorpay_key_id, "order_id": order["id"], "customer_id": cust["id"],
            "amount": order["amount"], "max_amount": max_amount,
            "prefill": {"name": name, "email": email, "contact": contact}}


def settings_auth_paise() -> int:
    return int(settings.razorpay_autopay_auth_paise)


def _activate(db: Session, m: BillingMandate, token_id: str | None) -> None:
    if token_id:
        m.razorpay_token_id = token_id
    if m.razorpay_token_id:
        # One live mandate per hospital: the new one replaces any older one.
        for old in db.scalars(select(BillingMandate).where(BillingMandate.hospital_id == m.hospital_id,
                                                           BillingMandate.status == "active",
                                                           BillingMandate.mandate_id != m.mandate_id)).all():
            old.status = "cancelled"
        m.status = "active"
        m.confirmed_at = utcnow()


def confirm_autopay(db: Session, hospital_id: UUID, order_id: str, payment_id: str, signature: str) -> BillingMandate:
    if not rzp.verify_signature(order_id, payment_id, signature):
        raise ValueError("Payment could not be verified")
    m = db.scalar(select(BillingMandate).where(BillingMandate.razorpay_order_id == order_id,
                                               BillingMandate.hospital_id == hospital_id))
    if m is None:
        raise ValueError("Unknown autopay request")
    pay = rzp.fetch_payment(payment_id)
    _activate(db, m, pay.get("token_id"))
    db.commit()
    return m


def autopay_pending(inv: Invoice) -> bool:
    """An autopay debit was started and has neither failed nor had time to fail.
    While it is, the bill can't also be paid by hand (that would pay it twice)."""
    if inv.autopay_attempted_at is None or inv.autopay_failed_at is not None or inv.status == "paid":
        return False
    at = inv.autopay_attempted_at
    at = at if at.tzinfo else at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - at < timedelta(days=AUTOPAY_SETTLE_DAYS)


def _autopay_failed(db: Session, inv: Invoice, why: str) -> None:
    inv.autopay_failed_at = utcnow()
    _tell_hospital(db, inv.hospital_id, "Autopay couldn't collect your bill",
                 f"Bill {inv.invoice_number} ({_rs(inv.total_amount)}): {why} Please pay it from Plan & Bookings.")


def charge_invoice(db: Session, inv: Invoice) -> bool:
    """Debit an invoice from the hospital's mandate, at most once. The webhook marks it paid."""
    m = active_mandate(db, inv.hospital_id)
    if m is None or not rzp.is_configured():
        return False
    # Claim the invoice under a row lock and commit the claim BEFORE calling
    # Razorpay: a second run (cron + the super-admin button, two instances, a
    # retry after a timeout) then sees it taken and never debits it again.
    inv = db.scalar(select(Invoice).where(Invoice.invoice_id == inv.invoice_id).with_for_update())
    if inv.status != "sent" or inv.autopay_attempted_at is not None or inv.razorpay_payment_id:
        db.commit()
        return False
    inv.autopay_attempted_at = utcnow()
    db.commit()

    if float(inv.total_amount) > float(m.max_amount):
        log.warning("invoice %s (₹%s) is above the mandate limit (₹%s); hospital must pay manually",
                    inv.invoice_number, inv.total_amount, m.max_amount)
        _autopay_failed(db, inv, f"it is above your Autopay limit of {_rs(m.max_amount)}.")
        db.commit()
        return False
    amount = int(round(float(inv.total_amount) * 100))
    _, email, contact = _contact(db, inv.hospital_id, None)
    notes = {"invoice_id": str(inv.invoice_id), "purpose": "autopay"}
    try:
        order = rzp.create_order(amount, f"{inv.invoice_number}-ap", notes)
    except Exception as exc:  # noqa: BLE001 - nothing was debited; one hospital must not stop the run
        log.warning("autopay order failed for %s: %s", inv.invoice_number, exc)
        _autopay_failed(db, inv, "Autopay could not start.")
        db.commit()
        return False
    inv.autopay_order_id = order["id"]
    db.commit()
    try:
        rzp.create_recurring_payment(
            order_id=order["id"], amount_paise=amount, customer_id=m.razorpay_customer_id,
            token_id=m.razorpay_token_id, email=email, contact=contact,
            description=f"TapCure {inv.invoice_number}", notes=notes,
        )
    except httpx.HTTPStatusError as exc:
        # Razorpay answered and refused: nothing was debited.
        log.warning("autopay refused for %s: %s", inv.invoice_number, exc.response.text[:300])
        _autopay_failed(db, inv, "your bank or UPI app declined the Autopay debit.")
        db.commit()
        return False
    except Exception as exc:  # noqa: BLE001
        # No answer (timeout, network): Razorpay may still have taken it. Leave
        # it pending — the webhook settles or fails it by autopay_order_id, and
        # manual pay reopens after AUTOPAY_SETTLE_DAYS if nothing arrives.
        log.warning("autopay result unknown for %s: %s", inv.invoice_number, exc)
        return False
    return True


class AutopayPending(Exception):
    pass


def pay_order(db: Session, inv: Invoice) -> dict:
    """A one-time Checkout order for paying an invoice by hand. Reuses the
    invoice's order, so a payment made on an earlier attempt still matches."""
    if not rzp.is_configured():
        raise PaymentsNotSetUp()
    if autopay_pending(inv):
        raise AutopayPending()
    amount = int(round(float(inv.total_amount) * 100))
    if not inv.razorpay_order_id:
        order = rzp.create_order(amount, inv.invoice_number, {"invoice_id": str(inv.invoice_id)})
        inv.razorpay_order_id = order["id"]
        db.commit()
    name, email, contact = _contact(db, inv.hospital_id, None)
    return {"key_id": settings.razorpay_key_id, "order_id": inv.razorpay_order_id, "amount": amount,
            "prefill": {"name": name, "email": email, "contact": contact}}


def _mark_paid(db: Session, inv: Invoice, payment_id: str | None) -> None:
    was_paused = (inv.reminder_stage or 0) >= 4
    yearly_switch = inv.status == "draft" and (inv.invoice_number or "").startswith(YEARLY_SWITCH_PREFIX)
    inv.status = "paid"
    inv.paid_date = _today()
    if payment_id:
        inv.razorpay_payment_id = payment_id
    db.flush()
    msg = f"Thank you — bill {inv.invoice_number} ({_rs(inv.total_amount)}) is paid."
    if yearly_switch:
        sub = quota.activate_yearly(db, inv)
        if sub is None:
            _tell_tapcure(db, inv.hospital_id, "Yearly payment from a paused hospital",
                          f"{_hospital_name(db, inv.hospital_id)} paid {inv.invoice_number} ({_rs(inv.total_amount)}) "
                          "for a yearly plan while its plan is paused. Restore it or refund the payment.")
        else:
            msg = (f"Thank you — {inv.invoice_number} ({_rs(inv.total_amount)}) is paid. "
                   f"You're on the yearly plan until {sub.end_date:%d %b %Y}.")
    if was_paused and unpaid_invoice(db, inv.hospital_id) is None:
        msg += " Online bookings are open again."
    _tell_hospital(db, inv.hospital_id, "Payment received", msg)


def confirm_invoice_payment(db: Session, inv: Invoice, order_id: str, payment_id: str, signature: str) -> Invoice:
    if order_id != inv.razorpay_order_id or not rzp.verify_signature(order_id, payment_id, signature):
        raise ValueError("Payment could not be verified")
    if inv.status != "paid":
        _mark_paid(db, inv, payment_id)
    db.commit()
    return inv


def _invoice_for_order(db: Session, order_id: str | None) -> tuple[Invoice | None, str | None]:
    """The invoice a payment belongs to, found ONLY by the order we created for
    it — never by the payment's notes, which the payer can set in Checkout (a
    ₹1 autopay-approval payment could otherwise claim any invoice)."""
    if not order_id:
        return None, None
    inv = db.scalar(select(Invoice).where(Invoice.razorpay_order_id == order_id))
    if inv is not None:
        return inv, "manual"
    inv = db.scalar(select(Invoice).where(Invoice.autopay_order_id == order_id))
    return (inv, "autopay") if inv is not None else (None, None)


def handle_webhook(db: Session, event: dict) -> str:
    """Razorpay → us. Payments settle invoices; token events settle mandates.
    Does not commit: the webhook endpoint commits it together with its event log."""
    kind = event.get("event", "")
    payload = event.get("payload", {})
    if kind in ("payment.captured", "payment.failed"):
        p = payload.get("payment", {}).get("entity", {})
        inv, via = _invoice_for_order(db, p.get("order_id"))
        if inv is not None and kind == "payment.captured":
            expected = int(round(float(inv.total_amount) * 100))
            if int(p.get("amount") or 0) != expected or (p.get("currency") or "INR") != "INR":
                log.error("payment %s on invoice %s: %s %s, expected %s INR — NOT marked paid",
                          p.get("id"), inv.invoice_number, p.get("amount"), p.get("currency"), expected)
                _tell_tapcure(db, inv.hospital_id, "Billing payment amount mismatch",
                              f"Payment {p.get('id')} on bill {inv.invoice_number} was {p.get('amount')} paise, "
                              f"expected {expected}. The bill was NOT marked paid. Check it in Razorpay.")
            elif inv.status == "paid":
                if p.get("id") and p.get("id") != inv.razorpay_payment_id:
                    log.error("invoice %s paid twice: %s and %s", inv.invoice_number, inv.razorpay_payment_id, p.get("id"))
                    _tell_tapcure(db, inv.hospital_id, "Bill paid twice: refund needed",
                                  f"{_hospital_name(db, inv.hospital_id)} paid bill {inv.invoice_number} twice "
                                  f"({inv.razorpay_payment_id} and {p.get('id')}). Refund one in Razorpay.")
            else:
                _mark_paid(db, inv, p.get("id"))
        elif inv is not None and via == "autopay" and inv.status != "paid" and inv.autopay_failed_at is None:
            # A failed MANUAL attempt changes nothing: the payer sees it in Checkout and can retry.
            _autopay_failed(db, inv, "the Autopay debit failed.")
        # The mandate's own authorisation payment.
        m = db.scalar(select(BillingMandate).where(BillingMandate.razorpay_order_id == p.get("order_id"))) if p.get("order_id") else None
        if m is not None and kind == "payment.captured" and m.status == "created":
            _activate(db, m, p.get("token_id"))
    elif kind.startswith("token."):
        t = payload.get("token", {}).get("entity", {})
        m = db.scalar(select(BillingMandate).where(BillingMandate.razorpay_token_id == t.get("id"))) if t.get("id") else None
        if m is not None:
            if kind == "token.confirmed":
                _activate(db, m, None)
            elif kind in ("token.cancelled", "token.rejected", "token.paused"):
                was_active = m.status == "active"
                m.status = "cancelled" if kind != "token.rejected" else "failed"
                if was_active:
                    _tell_hospital(db, m.hospital_id, "UPI Autopay is off",
                                 "UPI Autopay for your TapCure bills was turned off. You can pay each bill "
                                 "from Plan & Bookings, or turn Autopay on again there.")
                    _tell_tapcure(db, m.hospital_id, "Hospital turned off Autopay",
                                  f"{_hospital_name(db, m.hospital_id)} turned off UPI Autopay ({kind}).")
    return kind
