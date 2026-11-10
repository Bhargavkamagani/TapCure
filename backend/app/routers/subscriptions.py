"""Module 10 — Subscription endpoints (10 APIs): plans, subscriptions, invoices, usage."""
from uuid import UUID
import hashlib
import json
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db, utcnow
from ..deps import ensure_same_tenant, require_permission, require_role
from ..models import (
    BillingEvent, Department, Doctor, Hospital, Invoice, Plan, Subscription, Token, User,
)
from ..rbac import ROLE_SUPER_ADMIN
from ..schemas.subscription import (
    AssignPlanRequest, BookingChoiceRequest, ChoosePlanRequest, InvoiceOut, PaymentConfirm, PlanCreate,
    PlanOut, PlanUpdate, SubscriptionCreate, SubscriptionOut, SubscriptionUpdate, YearlyRenewalRequest,
)
from ..services import billing
from ..services import booking_quota as quota
from ..services import razorpay_client as rzp

router = APIRouter(tags=["subscriptions"])
log = logging.getLogger("billing")


def _is_super(me: User) -> bool:
    return bool(me.role and me.role.name == ROLE_SUPER_ADMIN)


# ===================================================== Plans ================
@router.get("/plans", response_model=list[PlanOut])
def list_plans(me: User = Depends(require_permission("subscription", "read")), db: Session = Depends(get_db)):
    return db.scalars(select(Plan).order_by(Plan.plan_id)).all()


@router.post("/plans", response_model=PlanOut, status_code=201, dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def create_plan(body: PlanCreate, db: Session = Depends(get_db)):
    p = Plan(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/plans/{plan_id}", response_model=PlanOut, dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def update_plan(plan_id: UUID, body: PlanUpdate, db: Session = Depends(get_db)):
    p = db.get(Plan, plan_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


# ===================================================== Subscriptions =======
@router.get("/subscriptions", response_model=list[SubscriptionOut])
def list_subscriptions(hospital_id: UUID | None = Query(None), me: User = Depends(require_permission("subscription", "read")), db: Session = Depends(get_db)):
    stmt = select(Subscription)
    if not _is_super(me):
        stmt = stmt.where(Subscription.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(Subscription.hospital_id == hospital_id)
    return db.scalars(stmt.order_by(Subscription.subscription_id.desc())).all()


@router.get("/subscriptions/usage")
def subscription_usage(hospital_id: UUID | None = Query(None), me: User = Depends(require_permission("subscription", "read")), db: Session = Depends(get_db)):
    hid = hospital_id if (_is_super(me) and hospital_id) else me.hospital_id
    if hid is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "hospital_id required")
    ensure_same_tenant(me, hid)
    sub = db.scalar(select(Subscription).where(Subscription.hospital_id == hid).order_by(Subscription.subscription_id.desc()))
    plan = sub.plan if sub else None
    doctors = db.scalar(select(func.count(Doctor.doctor_id)).where(Doctor.hospital_id == hid)) or 0
    departments = db.scalar(select(func.count(Department.department_id)).where(Department.hospital_id == hid)) or 0
    tokens_today = db.scalar(select(func.count(Token.token_id)).where(Token.hospital_id == hid, Token.token_date == date.today())) or 0

    def _limit(v):
        return "unlimited" if v == -1 else v

    return {
        "hospital_id": hid,
        "plan": plan.name if plan else None,
        "status": sub.status if sub else None,
        "usage": {"doctors": doctors, "departments": departments, "tokens_today": tokens_today},
        "limits": {
            "max_doctors": _limit(plan.max_doctors) if plan else None,
            "max_departments": _limit(plan.max_departments) if plan else None,
            "max_tokens_per_day": _limit(plan.max_tokens_per_day) if plan else None,
        } if plan else None,
    }


def _hospital_for(me: User, hospital_id: UUID | None) -> int:
    hid = hospital_id if (_is_super(me) and hospital_id) else me.hospital_id
    if hid is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "hospital_id required")
    ensure_same_tenant(me, hid)
    return hid


@router.get("/plans/catalog")
def plan_catalog(me: User = Depends(require_permission("subscription", "read"))):
    """The current plans with their booking rules, for the plan pickers."""
    return {
        "plans": [{"code": c, **{k: v for k, v in quota.CATALOG[c].items()}} for c in quota.PLAN_ORDER],
        "pack": {"size": quota.PACK_SIZE, "price": quota.PACK_PRICE},
    }


@router.get("/subscriptions/bookings")
def booking_usage(hospital_id: UUID | None = Query(None), me: User = Depends(require_permission("subscription", "read")), db: Session = Depends(get_db)):
    """This month's online bookings: "used 140 of 200", the bill so far, and the
    choices to offer once the free bookings run low."""
    hid = _hospital_for(me, hospital_id)
    out = quota.summary(db, hid)
    quota.pilot_reminders(db, hid)
    db.commit()  # first look of the month creates its row / starts the pilot clock
    return out


@router.post("/subscriptions/bookings/choice")
def booking_choice(body: BookingChoiceRequest, me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    """Hospital admin picks what happens once free bookings run out. Never automatic."""
    hid = _hospital_for(me, body.hospital_id)
    try:
        res = quota.record_choice(db, me, hid, body.choice, body.packs)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    return {**res, "usage": quota.summary(db, hid)}


@router.post("/subscriptions/trial/start")
def start_trial(me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    """New hospital admin clicked "Start free trial" on the Plan page."""
    hid = _hospital_for(me, None)
    try:
        res = quota.start_trial(db, me, hid)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    return {**res, "usage": quota.summary(db, hid)}


@router.post("/subscriptions/plan/choose")
def choose_plan(body: ChoosePlanRequest, me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    """Hospital admin picks its own paid plan (after the pilot / once a plan ended)."""
    hid = _hospital_for(me, None)
    try:
        res = quota.choose_plan(db, me, hid, body.plan_code)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    return {**res, "usage": quota.summary(db, hid)}


@router.post("/subscriptions/yearly/start")
def yearly_start(me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    """Monthly → yearly: Checkout for a year of the current plan. The plan only
    changes once this is paid (/invoices/{id}/pay/confirm or the webhook)."""
    hid = _hospital_for(me, None)
    try:
        return billing.start_yearly(db, me, hid)
    except billing.PaymentsNotSetUp:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_SET_UP)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.post("/subscriptions/yearly/renewal")
def yearly_renewal(body: YearlyRenewalRequest, me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    """Yearly → monthly when the paid year ends (renew=false), or keep yearly."""
    hid = _hospital_for(me, None)
    try:
        sub = quota.set_yearly_renewal(db, hid, body.renew)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    db.commit()
    msg = (f"Your yearly plan will renew on {sub.end_date:%d %b %Y}." if body.renew else
           f"You'll move to monthly billing when your paid year ends on {sub.end_date:%d %b %Y}.")
    return {"message": msg, "usage": quota.summary(db, hid)}


@router.post("/subscriptions/assign", response_model=SubscriptionOut, status_code=201,
             dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def assign_plan(body: AssignPlanRequest, db: Session = Depends(get_db)):
    """Super admin puts a hospital on one of the catalog plans."""
    if not db.get(Hospital, body.hospital_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid hospital_id")
    sub = quota.assign_plan(db, body.hospital_id, body.plan_code, billing_cycle=body.billing_cycle,
                            extra_doctors=body.extra_doctors, discount_pct=float(body.discount_pct))
    db.commit()
    db.refresh(sub)
    return sub


@router.post("/subscriptions", response_model=SubscriptionOut, status_code=201)
def create_subscription(body: SubscriptionCreate, me: User = Depends(require_permission("subscription", "create")), db: Session = Depends(get_db)):
    if not db.get(Hospital, body.hospital_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid hospital_id")
    plan = db.get(Plan, body.plan_id)
    if not plan:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid plan_id")
    today = date.today()
    span = 365 if body.billing_cycle == "annually" else 30
    # One live plan per hospital: end the current one(s) first.
    quota.lock_hospital_plan(db, body.hospital_id)
    quota.end_live_subscriptions(db, body.hospital_id, f"Replaced by {plan.name}")
    sub = Subscription(
        hospital_id=body.hospital_id, plan_id=body.plan_id, status=body.status,
        billing_cycle=body.billing_cycle, start_date=today,
        end_date=today + timedelta(days=span), discount_pct=body.discount_pct,
        trial_end_date=(today + timedelta(days=body.trial_days)) if body.status == "trial" else None,
    )
    db.add(sub)
    db.flush()
    # Issue an invoice for paid (non-trial) subscriptions.
    if body.status == "active":
        price = plan.price_annually if body.billing_cycle == "annually" else plan.price_monthly
        amount = float(price) * (1 - float(body.discount_pct) / 100)
        tax = round(amount * 0.18, 2)  # 18% GST
        seq = (db.scalar(select(func.count(Invoice.invoice_id))) or 0) + 1
        db.add(Invoice(
            subscription_id=sub.subscription_id, hospital_id=body.hospital_id, plan_id=plan.plan_id,
            invoice_number=f"INV-{today.year}-{seq:04d}", amount=amount, tax_amount=tax,
            total_amount=round(amount + tax, 2), due_date=today + timedelta(days=7), status="sent",
        ))
    db.commit()
    db.refresh(sub)
    return sub


@router.put("/subscriptions/{subscription_id}", response_model=SubscriptionOut)
def update_subscription(subscription_id: UUID, body: SubscriptionUpdate, me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    ensure_same_tenant(me, sub.hospital_id)
    # A hospital admin could otherwise move itself to any plan, or mark a trial
    # paid. Plan changes go through /subscriptions/bookings/choice instead.
    # billing_cycle too: flipping to "annually" here skipped the monthly plan
    # charge without ever writing the yearly invoice. Hospitals go yearly through
    # /subscriptions/yearly/start (pay first), and back via /yearly/renewal.
    if not _is_super(me) and (body.plan_id is not None or body.status is not None or body.discount_pct is not None
                              or body.billing_cycle is not None):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only TapCure can change the plan, status, discount or billing cycle")
    if body.plan_id is not None and not db.get(Plan, body.plan_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid plan_id")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(sub, k, v)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/subscriptions/{subscription_id}")
def cancel_subscription(subscription_id: UUID, reason: str = Query(""), me: User = Depends(require_permission("subscription", "delete")), db: Session = Depends(get_db)):
    sub = db.get(Subscription, subscription_id)
    if not sub:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subscription not found")
    sub.status = "cancelled"
    sub.cancelled_at = utcnow()
    sub.cancel_reason = reason
    sub.auto_renew = False
    db.commit()
    return {"message": "Subscription cancelled"}


# ===================================================== Invoices ============
@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(hospital_id: UUID | None = Query(None),
                  status_: str | None = Query(None, alias="status", pattern="^(draft|sent|paid|overdue|void|unpaid)$"),
                  me: User = Depends(require_permission("subscription", "read")), db: Session = Depends(get_db)):
    """status=unpaid gives sent + overdue — the super admin's list of hospitals to chase."""
    stmt = select(Invoice)
    if not _is_super(me):
        stmt = stmt.where(Invoice.hospital_id == me.hospital_id)
    elif hospital_id:
        stmt = stmt.where(Invoice.hospital_id == hospital_id)
    if not _is_super(me):
        # Draft = an unpaid "switch to yearly" offer — not a bill the hospital owes.
        stmt = stmt.where(Invoice.status != "draft")
    if status_ == "unpaid":
        stmt = stmt.where(Invoice.status.in_(("sent", "overdue")))
    elif status_:
        stmt = stmt.where(Invoice.status == status_)
    return db.scalars(stmt.order_by(Invoice.invoice_id.desc())).all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: UUID, me: User = Depends(require_permission("subscription", "read")), db: Session = Depends(get_db)):
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    ensure_same_tenant(me, inv.hospital_id)
    return inv


_NOT_SET_UP = "Online payment isn't set up yet. Please contact TapCure support."


def _own_invoice(db: Session, me: User, invoice_id: UUID) -> Invoice:
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    ensure_same_tenant(me, inv.hospital_id)
    return inv


@router.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: UUID, me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    """Razorpay Checkout order to pay one invoice by hand."""
    inv = _own_invoice(db, me, invoice_id)
    if inv.status == "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Already paid")
    try:
        return billing.pay_order(db, inv)
    except billing.PaymentsNotSetUp:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_SET_UP)
    except billing.AutopayPending:
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "UPI Autopay is collecting this bill. If it fails, you'll be able to pay it here.")


@router.post("/invoices/{invoice_id}/pay/confirm", response_model=InvoiceOut)
def confirm_invoice(invoice_id: UUID, body: PaymentConfirm, me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    inv = _own_invoice(db, me, invoice_id)
    try:
        return billing.confirm_invoice_payment(db, inv, body.order_id, body.payment_id, body.signature)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.post("/invoices/generate", dependencies=[Depends(require_role(ROLE_SUPER_ADMIN))])
def generate_invoices(month: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"), db: Session = Depends(get_db)):
    """Month-end run by hand (normally the 1st-of-month job): last month's
    invoices, autopay charges, yearly renewals, overdue marks."""
    return billing.run_month_end(db, month)


# ===================================================== UPI Autopay =========
@router.get("/subscriptions/autopay")
def autopay_status(hospital_id: UUID | None = Query(None), me: User = Depends(require_permission("subscription", "read")), db: Session = Depends(get_db)):
    return billing.autopay_status(db, _hospital_for(me, hospital_id))


@router.post("/subscriptions/autopay/start")
def autopay_start(me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    """Mandate order the hospital approves once in their UPI app."""
    hid = _hospital_for(me, None)
    try:
        return billing.start_autopay(db, me, hid)
    except billing.PaymentsNotSetUp:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, _NOT_SET_UP)


@router.post("/subscriptions/autopay/confirm")
def autopay_confirm(body: PaymentConfirm, me: User = Depends(require_permission("subscription", "update")), db: Session = Depends(get_db)):
    hid = _hospital_for(me, None)
    try:
        m = billing.confirm_autopay(db, hid, body.order_id, body.payment_id, body.signature)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return {"status": m.status, "message": "Autopay is on." if m.status == "active"
            else "Approved — waiting for your bank to confirm. This can take a few minutes."}


@router.post("/billing/razorpay-webhook", include_in_schema=False)
async def billing_webhook(request: Request, db: Session = Depends(get_db)):
    """Razorpay → us for subscription billing (payment.* and token.* events).
    Point a webhook at this URL in the Razorpay dashboard with the same secret
    as RAZORPAY_WEBHOOK_SECRET.

    Each event is logged in billing_events by Razorpay's event id: a repeat is
    answered 200 and skipped; if processing fails we answer 500 so Razorpay
    retries it, instead of the payment being silently dropped."""
    raw = await request.body()
    if not rzp.verify_webhook(raw, request.headers.get("X-Razorpay-Signature", "")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")
    event_id = request.headers.get("X-Razorpay-Event-Id") or "sha256:" + hashlib.sha256(raw).hexdigest()
    return await run_in_threadpool(_process_webhook, db, raw, event_id)


def _process_webhook(db: Session, raw: bytes, event_id: str) -> dict:
    try:
        event = json.loads(raw)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid JSON")
    kind = str(event.get("event", ""))[:60]
    row = db.scalar(select(BillingEvent).where(BillingEvent.event_id == event_id))
    if row is not None and row.status == "processed":
        return {"ok": True, "event": kind, "duplicate": True}
    try:
        billing.handle_webhook(db, event)
        if row is None:
            row = BillingEvent(event_id=event_id, event_type=kind, payload=event)
            db.add(row)
        row.status, row.error = "processed", None
        db.commit()
    except IntegrityError:
        # The same event arrived twice at once and the other copy won.
        db.rollback()
        return {"ok": True, "event": kind, "duplicate": True}
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        log.exception("billing webhook %s (%s) failed", event_id, kind)
        try:
            failed = db.scalar(select(BillingEvent).where(BillingEvent.event_id == event_id))                 or BillingEvent(event_id=event_id, event_type=kind, payload=event)
            failed.status, failed.error = "failed", repr(exc)[:2000]
            db.add(failed)
            db.commit()
        except Exception:  # noqa: BLE001 — never mask the 500 below
            db.rollback()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Webhook failed; Razorpay will retry")
    return {"ok": True, "event": kind}
