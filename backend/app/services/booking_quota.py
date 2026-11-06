"""Online-booking quota for the subscription plans (agreed 2026-10-22).

Each plan includes a number of free online bookings a month. What counts:

* a booking the patient made themselves (app / WhatsApp / CSC);
* a walk-in the front desk opted in to WhatsApp queue alerts (Almost Your
  Turn / Time to Leave), or one that was sent one — otherwise a remote patient
  could be entered as a walk-in to dodge the quota. Walk-ins are opted out by
  default (Appointment.queue_alerts);
* patient cancellations and no-shows still count; a visit the HOSPITAL called
  off (doctor on leave, session removed) does not;
* the same patient with the same doctor on the same day counts once.

When the free bookings run out, nothing upgrades on its own. The hospital admin
is asked to choose: upgrade, buy a booking pack, or pay per booking. Whatever
they choose (or if they never choose), the month's overage stops at the bill
limit — the next plan's price — so there is never a surprise bill.

Months are IST calendar months. The pilot is free for 30 days from the
hospital's first live OPD day (its first token), with no quota; after that, a
hospital that hasn't moved to a paid plan stops taking online bookings. Walk-ins
keep working.
"""
from uuid import UUID
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..database import lock_key, utcnow
from ..models import (
    Appointment, ApptCancellationLog, BookingMonth, Notification, Patient, Plan,
    Role, Subscription, Token, User,
)
from ..rbac import ROLE_HOSPITAL_ADMIN
from . import notifications as notify

_IST = timezone(timedelta(hours=5, minutes=30), "IST")

# The plan catalog. Prices are monthly in ₹; annual = 10 months' price.
# included: free online bookings a month (-1 = no quota).
# limit: the most a month's base + overage can come to (None = no overage).
# All prices set to ₹0 for now (2026-10-27) — the real ones are set later.
# Previous: starter 499 (fee 4, limit 999), smart_hospital 999 (fee 3, limit 1999),
# pro 1999 (fee 2, limit 4999, extra_doctor_fee 599), hospital 4999, PACK_PRICE 250.
CATALOG = {
    "pilot": dict(name="Pilot", price=0, doctors=-1, included=-1, fee=0, limit=None,
                  upgrade_to="smart_hospital", pilot_days=30),
    "starter": dict(name="Starter", price=0, doctors=1, included=50, fee=0, limit=0,
                    upgrade_to="smart_hospital"),
    "smart_hospital": dict(name="Smart Hospital", price=0, doctors=1, included=200, fee=0, limit=0,
                         upgrade_to="pro"),
    "pro": dict(name="Pro", price=0, doctors=3, included=600, fee=0, limit=0,
                upgrade_to=None, extra_doctor_fee=0, extra_doctor_bookings=200, max_extra_doctors=3),
    "hospital": dict(name="Hospital", price=0, doctors=-1, included=-1, fee=0, limit=None,
                     upgrade_to=None),
}
PLAN_ORDER = ("pilot", "starter", "smart_hospital", "pro", "hospital")

# What the screens SHOW while the prices are ₹0: X's, one per digit of the old
# price (2026-10-27). Billing uses the numbers above; this is display only.
PRICE_SHOWN = {
    "starter": dict(price="₹0xx", fee="₹0", limit="₹0xx"),
    "smart_hospital": dict(price="₹0xx", fee="₹0", limit="₹0,xxx"),
    "pro": dict(price="₹0,xxx", fee="₹0", limit="₹0,xxx"),
    "hospital": dict(price="₹0,xxx"),
}
PACK_SHOWN = "₹0xx"


def _shown(code: str, field: str, value) -> str:
    return PRICE_SHOWN.get(code, {}).get(field) or f"₹{value:,}"

# Booking pack: placeholder price until the owner confirms it.
PACK_SIZE = 100
PACK_PRICE = 0

# Plans a hospital can put itself on. Hospital is priced per hospital, so the
# TapCure team sets that one up.
SELF_SERVE_PLANS = ("starter", "smart_hospital", "pro")

NEAR_SHARE = 0.8
REMOTE_SOURCES = ("app", "whatsapp", "csc")
ALERT_TYPES = ("almost_turn", "travel_alert")
LIVE_STATUSES = ("trial", "active")


# ---------------------------------------------------------------- months ----
def month_key(on: date | None = None) -> str:
    d = on or datetime.now(_IST).date()
    return f"{d.year:04d}-{d.month:02d}"


def _month_bounds_utc(key: str) -> tuple[datetime, datetime]:
    """Naive-UTC [start, end) of an IST month, matching how created_at is stored."""
    y, m = (int(p) for p in key.split("-"))
    start = datetime(y, m, 1, tzinfo=_IST)
    end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=_IST)
    return (start.astimezone(timezone.utc).replace(tzinfo=None),
            end.astimezone(timezone.utc).replace(tzinfo=None))


def _month_row(db: Session, hospital_id: UUID, key: str) -> BookingMonth:
    row = db.scalar(select(BookingMonth).where(BookingMonth.hospital_id == hospital_id, BookingMonth.month == key))
    if row is None:
        row = BookingMonth(hospital_id=hospital_id, month=key, pack_bookings=0, pack_amount=0)
        db.add(row)
        db.flush()
    return row


# ----------------------------------------------------------------- plans ----
def ensure_catalog_plans(db: Session) -> dict[str, Plan]:
    """Make sure a plans row exists for each catalog plan, with current prices."""
    rows = {p.code: p for p in db.scalars(select(Plan).where(Plan.code.in_(PLAN_ORDER))).all()}
    for code in PLAN_ORDER:
        spec = CATALOG[code]
        p = rows.get(code)
        if p is None:
            p = Plan(code=code)
            db.add(p)
            rows[code] = p
        p.name = spec["name"]
        p.price_monthly = spec["price"]
        p.price_annually = spec["price"] * 10
        p.max_doctors = spec["doctors"]
        p.whatsapp_enabled = code != "starter"
        p.is_active = True
    db.flush()
    return rows


def lock_hospital_plan(db: Session, hospital_id: UUID) -> None:
    """Plan changes for one hospital happen one after another.

    Without it two "Upgrade" clicks in the same instant both read the same old
    plan, both cancel it and both add a new one — two live plans, both billed
    every month. Postgres transaction-level advisory lock (released on commit,
    re-entrant within the transaction). No-op on SQLite.
    """
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(:ns, :hid)"), {"ns": 7311, "hid": lock_key(hospital_id)})


def end_live_subscriptions(db: Session, hospital_id: UUID, reason: str) -> None:
    """Cancel EVERY live subscription of a hospital, not just the newest, so a
    stray second one left by an older bug can't keep being billed."""
    for old in db.scalars(select(Subscription).where(Subscription.hospital_id == hospital_id,
                                                     Subscription.status.in_(LIVE_STATUSES))).all():
        old.status = "cancelled"
        old.cancelled_at = utcnow()
        old.cancel_reason = reason
        old.auto_renew = False


def current_subscription(db: Session, hospital_id: UUID) -> Subscription | None:
    return db.scalar(
        select(Subscription).where(Subscription.hospital_id == hospital_id)
        .order_by(Subscription.subscription_id.desc())
    )


def _spec(sub: Subscription | None) -> dict | None:
    code = sub.plan.code if sub and sub.plan else None
    return CATALOG.get(code) if code else None


def _start_pilot_clock(db: Session, sub: Subscription) -> None:
    """The pilot's 30 days run from the first live OPD day, not from sign-up."""
    if sub.plan.code != "pilot" or sub.trial_end_date is not None:
        return
    first = db.scalar(
        select(func.min(Token.token_date)).where(
            Token.hospital_id == sub.hospital_id,
            Token.token_date >= (sub.start_date or date.min),
        )
    )
    if first is not None:
        sub.trial_end_date = first + timedelta(days=CATALOG["pilot"]["pilot_days"])
        db.flush()


def remote_booking_open(db: Session, hospital_id: UUID) -> tuple[bool, str]:
    """Whether patients may book this hospital online right now.

    Hospitals with no subscription, or on the old demo plans, are left alone —
    except that any hospital with a bill unpaid billing_grace_days past its due
    date stops taking online bookings until it pays. Walk-ins keep working.
    """
    from . import billing  # billing builds on this module

    if billing.unpaid_invoice(db, hospital_id) is not None:
        return False, "This hospital isn't taking online bookings right now. Please visit the hospital directly."
    sub = current_subscription(db, hospital_id)
    if _spec(sub) is None:
        return True, ""
    if sub.status not in LIVE_STATUSES:
        return False, "This hospital isn't taking online bookings right now. Please visit the hospital directly."
    if sub.plan.code == "pilot":
        _start_pilot_clock(db, sub)
        if sub.trial_end_date and datetime.now(_IST).date() > sub.trial_end_date:
            return False, "This hospital isn't taking online bookings right now. Please visit the hospital directly."
    return True, ""


# -------------------------------------------------------------- counting ----
def count_bookings(db: Session, hospital_id: UUID, key: str | None = None) -> dict:
    key = key or month_key()
    start, end = _month_bounds_utc(key)
    appts = db.scalars(
        select(Appointment).where(
            Appointment.hospital_id == hospital_id,
            Appointment.created_at >= start, Appointment.created_at < end,
        )
    ).all()
    if not appts:
        return {"counted": 0, "online": 0, "walkin_with_alerts": 0, "not_counted_hospital_cancelled": 0}

    ids = [a.appointment_id for a in appts]
    alerted = set(db.scalars(
        select(Notification.appointment_id).where(
            Notification.appointment_id.in_(ids), Notification.channel == "whatsapp",
            Notification.type.in_(ALERT_TYPES),
        )
    ).all())
    # Queue alerts are filed against the token, not always the appointment.
    alerted |= set(db.scalars(
        select(Token.appointment_id).join(Notification, Notification.token_id == Token.token_id).where(
            Token.appointment_id.in_(ids), Notification.channel == "whatsapp",
            Notification.type.in_(ALERT_TYPES),
        )
    ).all())

    cancelled = [a.appointment_id for a in appts if a.status == "cancelled"]
    cancelled_by: dict[int, int | None] = {}
    if cancelled:
        for log in db.scalars(
            select(ApptCancellationLog).where(ApptCancellationLog.appointment_id.in_(cancelled))
            .order_by(ApptCancellationLog.log_id)
        ).all():
            cancelled_by[log.appointment_id] = log.cancelled_by
    patient_user = dict(db.execute(
        select(Patient.patient_id, Patient.user_id).where(Patient.patient_id.in_({a.patient_id for a in appts}))
    ).all())

    seen: set[tuple] = set()
    online = walkin = hospital_cancelled = 0
    for a in appts:
        remote = a.source in REMOTE_SOURCES and a.appointment_type != "walkin"
        if not remote and not a.queue_alerts and a.appointment_id not in alerted:
            continue
        if a.status == "cancelled":
            by = cancelled_by.get(a.appointment_id)
            if by is None or by != patient_user.get(a.patient_id):
                hospital_cancelled += 1
                continue
        visit = (a.patient_id, a.family_member_id, a.doctor_id, a.appointment_date)
        if visit in seen:
            continue
        seen.add(visit)
        if remote:
            online += 1
        else:
            walkin += 1
    return {"counted": online + walkin, "online": online, "walkin_with_alerts": walkin,
            "not_counted_hospital_cancelled": hospital_cancelled}


# --------------------------------------------------------------- summary ----
def _options(spec: dict, code: str, allowance: int, used: int) -> list[dict]:
    opts = []
    nxt = spec.get("upgrade_to")
    if nxt:
        n = CATALOG[nxt]
        opts.append({"choice": "upgrade", "plan": nxt,
                     "title": f"Upgrade to {n['name']} ({_shown(nxt, 'price', n['price'])}/month)",
                     "detail": f"{n['included']} free bookings a month" +
                               (f", up to {n['doctors']} doctors" if n["doctors"] > 1 else "")})
    elif code == "pro":
        opts.append({"choice": "upgrade", "plan": "hospital",
                     "title": f"Move to Hospital (from {_shown('hospital', 'price', CATALOG['hospital']['price'])}/month)",
                     "detail": "Custom booking volume. Our team will contact you."})
    opts.append({"choice": "pack", "title": f"Buy a booking pack ({PACK_SIZE} bookings for {PACK_SHOWN or PACK_PRICE})",
                 "detail": "Added to this month only"})
    opts.append({"choice": "pay_per_booking", "title": f"Pay per booking ({_shown(code, 'fee', spec['fee'])} each)",
                 "detail": f"This month's bill never goes above {_shown(code, 'limit', spec['limit'])}"})
    return opts


def summary(db: Session, hospital_id: UUID) -> dict:
    sub = current_subscription(db, hospital_id)
    spec = _spec(sub)
    key = month_key()
    counts = count_bookings(db, hospital_id, key)
    used = counts["counted"]
    if spec is None:
        return {"hospital_id": hospital_id, "month": key, "plan": None, "used": used, "counts": counts,
                "unlimited": True, "state": "no_plan", "options": [], "plan_choices": plan_choices()}

    from . import billing  # billing builds on this module

    code = sub.plan.code
    open_, closed_reason = remote_booking_open(db, hospital_id)
    row = _month_row(db, hospital_id, key)
    extra = int(sub.extra_doctors or 0) if code == "pro" else 0

    out = {
        "hospital_id": hospital_id, "month": key,
        "plan": {"code": code, "name": spec["name"], "price": spec["price"], "discount_pct": float(sub.discount_pct or 0),
                 "billing_cycle": sub.billing_cycle, "status": sub.status, "extra_doctors": extra},
        "used": used, "counts": counts, "online_booking_open": open_, "closed_reason": closed_reason,
        "choice": row.choice, "packs_bought": (row.pack_bookings or 0) // PACK_SIZE,
        "pack": {"size": PACK_SIZE, "price": PACK_PRICE},
    }
    out["autopay"] = billing.autopay_status(db, hospital_id)
    if sub.status == "suspended":
        # Stopped by TapCure on purpose: only TapCure can restart it.
        out.update(unlimited=True, state="suspended", options=[], plan_choices=[])
        return out
    if sub.status not in LIVE_STATUSES:
        # Expired / cancelled: the hospital picks a plan itself to start again.
        out.update(unlimited=True, state="ended", options=[], plan_choices=plan_choices())
        return out
    if sub.billing_cycle == "annually":
        out["yearly"] = {"until": sub.end_date, "renews": bool(sub.auto_renew)}
    else:
        out["yearly_offer"] = billing.yearly_offer(sub)
    if code == "pilot":
        out["plan_choices"] = plan_choices()
        days_left = (sub.trial_end_date - datetime.now(_IST).date()).days if sub.trial_end_date else None
        out.update(unlimited=True, state="pilot", trial_end_date=sub.trial_end_date,
                   pilot_started=sub.trial_end_date is not None, pilot_days_left=days_left,
                   # Ask for autopay from day 20 of the 30, so the switch to paid needs no new decision.
                   ask_autopay=days_left is not None and days_left <= 10 and not out["autopay"]["active"],
                   options=[])
        return out
    out["bill"] = billing.month_bill(db, hospital_id, key)
    if spec["included"] < 0:
        out.update(unlimited=True, state="ok", options=[])
        return out

    u = month_usage(db, hospital_id, key, sub, used=used)
    allowance, over = u["allowance"], u["over"]
    share = used / allowance if allowance else 1
    if used >= allowance and not row.choice:
        state = "full"
    elif used >= allowance:
        state = "over_chosen"
    elif share >= NEAR_SHARE:
        state = "near"
    else:
        state = "ok"
    out.update(
        unlimited=False, included=spec["included"], allowance=allowance, remaining=max(0, allowance - used),
        over=over, fee=spec["fee"], limit=spec["limit"], state=state,
        options=_options(spec, code, allowance, used) if state in ("near", "full", "over_chosen") else [],
    )
    return out


def month_usage(db: Session, hospital_id: UUID, key: str, sub: Subscription, used: int | None = None) -> dict:
    """A month's quota maths under `sub`'s plan: allowance, overage, packs.

    Overage stops at the plan's limit: plan price + packs + overage never goes
    above it, whatever the hospital chose.
    """
    spec = _spec(sub)
    if used is None:
        used = count_bookings(db, hospital_id, key)["counted"]
    row = db.scalar(select(BookingMonth).where(BookingMonth.hospital_id == hospital_id, BookingMonth.month == key))
    pack_bookings = int(row.pack_bookings or 0) if row else 0
    packs = float(row.pack_amount or 0) if row else 0.0
    if spec is None or spec["included"] < 0:
        return {"used": used, "allowance": None, "over": 0, "fee": 0, "overage": 0.0, "overage_capped": False,
                "packs": packs, "pack_bookings": pack_bookings}
    extra = int(sub.extra_doctors or 0) if sub.plan.code == "pro" else 0
    allowance = spec["included"] + extra * spec.get("extra_doctor_bookings", 0) + pack_bookings
    over = max(0, used - allowance)
    overage = float(min(over * spec["fee"], max(0, spec["limit"] - spec["price"] - packs)))
    return {"used": used, "allowance": allowance, "over": over, "fee": spec["fee"], "overage": overage,
            "overage_capped": over * spec["fee"] > overage, "packs": packs, "pack_bookings": pack_bookings}


# ---------------------------------------------------------------- choice ----
def assign_plan(db: Session, hospital_id: UUID, code: str, *, billing_cycle: str = "monthly",
                extra_doctors: int = 0, discount_pct: float = 0, yearly_invoice: bool = True) -> Subscription:
    """Put a hospital on a catalog plan (ends the previous subscription)."""
    lock_hospital_plan(db, hospital_id)
    plans = ensure_catalog_plans(db)
    spec = CATALOG[code]
    extra_doctors = max(0, min(int(extra_doctors or 0), spec.get("max_extra_doctors", 0)))
    end_live_subscriptions(db, hospital_id, f"Moved to {spec['name']}")
    today = datetime.now(_IST).date()
    span = 365 if billing_cycle == "annually" else 30
    sub = Subscription(
        hospital_id=hospital_id, plan_id=plans[code].plan_id,
        status="trial" if code == "pilot" else "active",
        billing_cycle=billing_cycle, start_date=today, end_date=today + timedelta(days=span),
        discount_pct=discount_pct, extra_doctors=extra_doctors,
    )
    db.add(sub)
    db.flush()
    db.refresh(sub)
    if billing_cycle == "annually" and code != "pilot" and yearly_invoice:
        from . import billing
        billing.yearly_invoice(db, sub)
    return sub


def activate_yearly(db: Session, inv) -> Subscription | None:
    """The hospital paid its "switch to yearly" invoice: move it to the yearly plan
    from today. This month's days so far stay on the monthly bill (the monthly
    plan ends today and is billed for the days it ran), so nothing is skipped.
    The paid invoice becomes the new plan's yearly invoice — none is added."""
    lock_hospital_plan(db, inv.hospital_id)
    cur = current_subscription(db, inv.hospital_id)
    if cur is not None and cur.status == "suspended":
        return None  # TapCure paused it; the caller alerts TapCure to sort it out
    plan = db.get(Plan, inv.plan_id)
    old = db.get(Subscription, inv.subscription_id)
    sub = assign_plan(db, inv.hospital_id, plan.code, billing_cycle="annually",
                      extra_doctors=int(old.extra_doctors or 0) if old else 0,
                      discount_pct=float(old.discount_pct or 0) if old else 0, yearly_invoice=False)
    inv.subscription_id = sub.subscription_id
    return sub


def set_yearly_renewal(db: Session, hospital_id: UUID, renew: bool) -> Subscription:
    """renew=False: move to monthly when the paid year ends (no refund, the year
    stays). renew=True: keep renewing yearly."""
    sub = current_subscription(db, hospital_id)
    if sub is None or sub.billing_cycle != "annually" or sub.status not in LIVE_STATUSES:
        raise ValueError("You're not on a yearly plan.")
    sub.auto_renew = bool(renew)
    return sub


def plan_choices() -> list[dict]:
    """The paid plans a hospital can pick for itself, for the Plan page."""
    return [{"code": c, "name": CATALOG[c]["name"], "price": CATALOG[c]["price"],
             "included": CATALOG[c]["included"], "doctors": CATALOG[c]["doctors"]} for c in SELF_SERVE_PLANS]


def choose_plan(db: Session, me: User, hospital_id: UUID, code: str) -> dict:
    """A hospital puts itself on a paid plan: after (or during) the pilot, when its
    plan expired or was cancelled, or when it has none. It starts at once and is
    billed at month end like any plan. Not allowed when TapCure suspended it,
    and not a way round Upgrade when it already has a paid plan running."""
    if code not in SELF_SERVE_PLANS:
        raise ValueError("Please contact TapCure to set up this plan.")
    lock_hospital_plan(db, hospital_id)
    sub = current_subscription(db, hospital_id)
    spec = _spec(sub)
    if sub is not None and sub.status == "suspended":
        raise ValueError("Your plan was paused by TapCure. Please contact TapCure support.")
    if spec is not None and sub.plan.code == code and sub.status in LIVE_STATUSES:
        return {"message": f"You're on {spec['name']} now."}  # a repeat / double-click
    if spec is not None and sub.plan.code != "pilot" and sub.status in LIVE_STATUSES:
        raise ValueError("You already have a plan. Use the options on this page to change it.")
    sub = assign_plan(db, hospital_id, code, billing_cycle="monthly")
    _month_row(db, hospital_id, month_key())  # so this month's quota row exists
    name = CATALOG[code]["name"]
    return {"message": f"You're on {name} now. Online bookings are open, and the bill comes at the end of the month."}


def start_pilot(db: Session, hospital_id: UUID) -> Subscription | None:
    """Every new hospital starts on the free Pilot. Its 30 days only begin on the
    first live OPD day, so a hospital still waiting for approval loses nothing.
    Does nothing if the hospital already has a subscription."""
    if current_subscription(db, hospital_id) is not None:
        return None
    return assign_plan(db, hospital_id, "pilot")


REPEAT_WINDOW = timedelta(minutes=2)


def _changed_just_now(sub: Subscription) -> bool:
    at = sub.created_at
    if at is None:
        return False
    at = at if at.tzinfo else at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - at < REPEAT_WINDOW


def record_choice(db: Session, me: User, hospital_id: UUID, choice: str, packs: int = 1) -> dict:
    """The hospital admin's answer to "your free bookings are used up"."""
    # Under the plan lock, so a double-click's second request sees the plan the
    # first one already moved to (below) instead of upgrading a second time.
    lock_hospital_plan(db, hospital_id)
    sub = current_subscription(db, hospital_id)
    spec = _spec(sub)
    if spec is None or spec["included"] < 0:
        raise ValueError("This plan has no booking limit.")
    if sub.status == "suspended":
        # Stopped by TapCure on purpose: an "upgrade" here would create a fresh
        # active plan and quietly undo that. Only TapCure can restart it.
        raise ValueError("Your plan was paused by TapCure. Please contact TapCure support.")
    if sub.status not in LIVE_STATUSES:
        raise ValueError("Your plan has ended. Choose a plan on this page to start again.")
    row = _month_row(db, hospital_id, month_key())
    if choice == "upgrade":
        if _changed_just_now(sub):
            # The plan moved seconds ago: this is a double-click / repeat of
            # that same upgrade, not a request to jump one more plan up.
            return {"message": f"You're on {spec['name']} now."}
        target = spec.get("upgrade_to")
        if not target or sub.billing_cycle == "annually":
            # Pro → Hospital is priced per hospital, and a yearly plan needs its
            # unused months credited — both go to the TapCure team.
            row.choice = "upgrade"
            row.choice_by, row.choice_at = me.user_id, utcnow()
            name = CATALOG[target]["name"] if target else "Hospital"
            return {"message": f"Thanks — our team will contact you to move you to {name}."}
        assign_plan(db, hospital_id, target, billing_cycle="monthly")
        row.choice = "upgrade"
        row.choice_by, row.choice_at = me.user_id, utcnow()
        return {"message": f"Moved to {CATALOG[target]['name']}."}
    if choice == "pack":
        packs = max(1, min(int(packs or 1), 20))
        row.pack_bookings = (row.pack_bookings or 0) + packs * PACK_SIZE
        row.pack_amount = float(row.pack_amount or 0) + packs * PACK_PRICE
        row.choice = "pack"
        row.choice_by, row.choice_at = me.user_id, utcnow()
        row.warned_full_at = None  # warn again if the pack runs out too
        return {"message": f"Added {packs * PACK_SIZE} bookings for this month."}
    if choice == "pay_per_booking":
        row.choice = "pay_per_booking"
        row.choice_by, row.choice_at = me.user_id, utcnow()
        code = sub.plan.code if sub and sub.plan else ""
        return {"message": f"Extra bookings this month are {_shown(code, 'fee', spec['fee'])} each, "
                           f"up to {_shown(code, 'limit', spec['limit'])} in total."}
    raise ValueError("Unknown choice")


# -------------------------------------------------------------- warnings ----
def _hospital_admins(db: Session, hospital_id: UUID) -> list[User]:
    return db.scalars(
        select(User).join(Role, Role.role_id == User.role_id).where(
            Role.name == ROLE_HOSPITAL_ADMIN, User.hospital_id == hospital_id, User.status == "active",
        )
    ).all()


def after_booking(db: Session, hospital_id: UUID) -> None:
    """Send the 80% / used-up notice to the hospital admins, once each a month."""
    s = summary(db, hospital_id)
    if s.get("unlimited") or s["state"] not in ("near", "full"):
        return
    row = _month_row(db, hospital_id, s["month"])
    if s["state"] == "near" and row.warned_near_at is None:
        title = "Online bookings almost used up"
        msg = f"You've used {s['used']} of your {s['allowance']} online bookings this month."
        row.warned_near_at = utcnow()
    elif s["state"] == "full" and row.warned_full_at is None:
        title = "Free online bookings used up"
        msg = (f"Your {s['allowance']} online bookings for this month are used up. "
               "Open Plan & Bookings to choose what to do next.")
        row.warned_full_at = utcnow()
    else:
        return
    for u in _hospital_admins(db, hospital_id):
        notify.send_staff_in_app(db, u.user_id, msg, ntype="booking_quota", title=title, hospital_id=hospital_id)
