"""
TapCure — Healthcare Appointment & Token Platform — backend API.

Multi-tenant SaaS (FastAPI + SQLAlchemy). Built phase-by-phase against the
full-architecture deck. SQLite by default; MySQL/Postgres via DATABASE_URL.

  Phase 1 (current): Security/RBAC + Hospital/Department
  Run:  uvicorn app.main:app --reload --port 8000
  Docs: http://localhost:8000/docs
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse

from . import models  # noqa: F401  (register all tables on Base.metadata)
from .config import settings
from .database import Base, SessionLocal, engine
from .middleware import AuditMiddleware
from .routers import (
    support,
    appointments, audit, auth, departments, doctors, follow_ups, hospitals,
    medicine_reminders, notifications, patients, payments, pharmacy, prescriptions, reception, reports,
    public_discovery, revisit_passes, subscriptions, tokens, users, voice, geo, display,
)
from .seed import seed
from .services import storage


async def _reminder_ticker() -> None:
    """Poll for due doses forever. One bad tick must never kill the loop."""
    from .services.reminder_engine import dispatch_due

    while True:
        try:
            await asyncio.sleep(settings.reminder_tick_seconds)
            db = SessionLocal()
            try:
                await asyncio.to_thread(dispatch_due, db, None, settings.reminder_batch_limit)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger("reminders").exception("medicine reminder tick failed")


async def _doctor_digest_ticker() -> None:
    """Poll for the two clock-driven doctor messages: the morning schedule and
    the end-of-day summary. One bad tick must never kill the loop.

    Ticks on a coarse interval because the work is once-per-doctor-per-day: the
    service itself enforces both the hospital-local hour and the once-a-day guard,
    so a missed tick is caught by the next one and an extra tick does nothing.
    """
    from .services.doctor_digest import send_daily_schedules, send_day_complete

    while True:
        try:
            await asyncio.sleep(settings.doctor_digest_tick_seconds)
            db = SessionLocal()
            try:
                # Morning and evening ride the same tick: both are once per
                # doctor per day, both decide for themselves whether their own
                # clock has come round, so one loop is enough.
                await asyncio.to_thread(send_daily_schedules, db)
                await asyncio.to_thread(send_day_complete, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger("reminders").exception("doctor digest tick failed")


async def _leave_alert_ticker() -> None:
    """Poll for patients who must set off now. One bad tick must never kill the loop.

    The alert has always been calculated correctly and delivered on the wrong
    trigger: `maybe_send_leave_alert` is only reachable from
    `recompute_positions`, which runs inside staff actions only. Without this
    loop the message waits for the desk to press something — late on a quiet
    morning, never on a day nobody works the queue, and never at all for a
    booking on a future date whose departure window opens today.
    """
    from .services.token_engine import dispatch_leave_alerts

    while True:
        try:
            await asyncio.sleep(settings.leave_alert_tick_seconds)
            db = SessionLocal()
            try:
                await asyncio.to_thread(dispatch_leave_alerts, db, settings.leave_alert_batch_limit)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger("reminders").exception("leave alert tick failed")


async def _billing_ticker() -> None:
    """Month-end billing, hourly. One bad tick must never kill the loop.

    Every tick runs the whole month-end job for last month: the invoice is
    written once (on the first tick of the 1st), autopay debits each invoice at
    most once, and the overdue marks / unpaid reminders / 15-day booking pause
    are each applied once. So an extra tick does nothing and a missed one is
    caught by the next; a Postgres advisory lock keeps two instances apart.
    """
    from .services.billing import run_month_end

    while True:
        try:
            await asyncio.sleep(settings.billing_tick_seconds)
            db = SessionLocal()
            try:
                await asyncio.to_thread(run_month_end, db)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger("billing").exception("billing tick failed")


async def _stale_visit_ticker() -> None:
    """End queues that nobody ended. One bad tick must never kill the loop.

    Nothing has ever closed a visit that was not reached: the token stayed
    `waiting` for ever and its appointment stayed `confirmed`, while the queue
    screen — which loads a single date — quietly stopped showing it. 138 had
    built up by 22 Sep 2026, the oldest from 12 June, every one still claiming
    the patient was expected.

    Coarse interval on purpose: the test is only "is this date in the past", so
    an extra tick finds nothing and a missed one is caught by the next.
    """
    from .services.token_engine import close_stale_visits

    while True:
        try:
            await asyncio.sleep(settings.stale_visit_tick_seconds)
            db = SessionLocal()
            try:
                await asyncio.to_thread(close_stale_visits, db, settings.stale_visit_batch_limit)
            finally:
                db.close()
        except asyncio.CancelledError:
            raise
        except Exception:
            logging.getLogger("reminders").exception("stale visit sweep failed")


_DEFAULT_SECRET = "dev-insecure-change-me-please-0123456789abcdef"


def _refuse_insecure_start() -> None:
    """Stop a real deployment from running on the signing key that ships in the
    source — every token the app issues is stamped with it, so anyone holding
    the repository could mint a valid SUPER_ADMIN pass and nothing in the logs
    would say so.

    Failing to start is the point: the old behaviour was to come up happily and
    stay quietly wide open, which is exactly how a missing .env survives. DEBUG
    stays exempt so local development needs no setup at all.
    """
    if settings.debug:
        return
    if settings.secret_key.strip() in ("", _DEFAULT_SECRET):
        raise RuntimeError(
            "SECRET_KEY is still the example value from the source. Set a long "
            "random SECRET_KEY in this server's .env (or set DEBUG=true if this "
            "really is a development machine). Refusing to start: with the "
            "shipped key, anyone with the code can forge a login for any account."
        )


# `queued` counts as proven here even though it is not a delivery. On the SQS
# transport the template name travels in the payload and is resolved by the
# Lambda, so this process never learns the outcome — treating queued as unproven
# would warn forever on that deployment and the warning would stop being read.
_WHATSAPP_OK_STATUSES = ("sent", "delivered", "read", "queued")


def _warn_unproven_whatsapp_templates() -> None:
    """Name every configured template that has never once got through.

    A template name the provider does not recognise does not fail loudly: the
    API answers 200 OK with no message id, a row is written, and nothing is
    delivered. That has now happened three times in this deployment —
    `appointment_confirmation` (56 messages), `appointment_cancelled` (7) and
    `tapcure_prescription_ready` (4, still failing) — and each went unnoticed
    for weeks, because the only evidence sits in `whatsapp_logs` and nothing
    reads it. One line at boot is the cheapest place to be told.

    Warns rather than refuses. A template waiting on provider approval is a
    normal state mid-rollout, and taking the whole API down over one unsent
    message type would be a worse outage than the one it reports.

    Reads the names off `settings` rather than a hand-written list, so a
    template added later is covered without anyone remembering to add it here.
    """
    from sqlalchemy import func, select

    from .models import WhatsappLog
    from .services import whatsapp_client

    # Nothing to conclude when sending is mocked: every mock write is recorded
    # `delivered`, so every name would look proven and the check would lie.
    if not whatsapp_client.is_enabled():
        return

    db = SessionLocal()
    try:
        # A database that has never sent anything (a fresh deploy, a restored
        # dump) would report every template as unproven, which is true and
        # useless. Say nothing until there is a history to judge against.
        if not db.scalar(select(func.count()).select_from(WhatsappLog)):
            return

        configured = {
            getattr(settings, field)
            for field in dir(settings)
            if field.startswith("whatsapp_") and field.endswith("_template")
            and isinstance(getattr(settings, field, None), str)
            and getattr(settings, field).strip()
        }
        proven = set(db.scalars(
            select(WhatsappLog.template_name)
            .where(WhatsappLog.status.in_(_WHATSAPP_OK_STATUSES))
            .distinct()
        ).all())
        unproven = sorted(configured - proven)
        if not unproven:
            return

        # Attempted-and-always-failed is urgent; never-attempted may just be a
        # message type this hospital doesn't use yet. Reporting them identically
        # is what turns a warning into noise people learn to scroll past.
        stats = {
            name: (count, err)
            for name, count, err in db.execute(
                select(WhatsappLog.template_name, func.count(),
                       func.max(WhatsappLog.error_code))
                .where(WhatsappLog.template_name.in_(unproven))
                .group_by(WhatsappLog.template_name)
            ).all()
        }
        print(f"[whatsapp] WARNING: {len(unproven)} configured template(s) have "
              f"never been delivered:")
        for name in unproven:
            tried, err = stats.get(name, (0, None))
            if tried:
                print(f"[whatsapp]   {name} - {tried} attempt(s), all failed "
                      f"(last error: {err or 'unknown'})")
            else:
                print(f"[whatsapp]   {name} - never attempted")
        print("[whatsapp]   Check each name matches an APPROVED template in the "
              "provider console; a wrong name returns 200 and delivers nothing.")
    except Exception as exc:  # noqa: BLE001 - a warning must never stop the app
        print(f"[whatsapp] template check skipped: {type(exc).__name__}: {exc}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _refuse_insecure_start()
    # Zero-setup local dev (SQLite) builds the schema from the models directly.
    # On any real DB (Postgres/MySQL) the schema is owned by Alembic ONLY — never
    # create_all, or it races the migrations and teammates get "already exists"
    # errors on `alembic upgrade head`. Single source of truth = Alembic there.
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            if seed(db):
                print("[seed] RBAC + demo tenant seeded")
        finally:
            db.close()

    # Say, once, which message types are configured but have never landed. See
    # the function for why this is a print and not a refusal to start.
    _warn_unproven_whatsapp_templates()

    # Medicine-reminder ticker. OFF by default: with more than one API instance
    # every instance would tick. It's safe (a dose is claimed inside the sending
    # transaction) but wasteful — on a scaled deploy drive
    # `python -m app.jobs.medicine_tick` from cron or an EventBridge Lambda.
    ticker = None
    if settings.reminder_ticker_enabled:
        ticker = asyncio.create_task(_reminder_ticker())
        print(f"[reminders] in-process ticker every {settings.reminder_tick_seconds}s")
    digest = None
    if settings.doctor_digest_ticker_enabled:
        digest = asyncio.create_task(_doctor_digest_ticker())
        print(f"[digest] doctor morning digest at {settings.doctor_digest_hour}:00 hospital-local, "
              f"checked every {settings.doctor_digest_tick_seconds}s")
    leave_alerts = None
    if settings.leave_alert_ticker_enabled:
        leave_alerts = asyncio.create_task(_leave_alert_ticker())
        print(f"[leave-alert] in-process sweep every {settings.leave_alert_tick_seconds}s")
    stale_visits = None
    if settings.stale_visit_sweep_enabled:
        stale_visits = asyncio.create_task(_stale_visit_ticker())
        print(f"[stale-visits] closing unfinished queues every {settings.stale_visit_tick_seconds}s")
    billing_tick = None
    if settings.billing_ticker_enabled:
        billing_tick = asyncio.create_task(_billing_ticker())
        print(f"[billing] month-end billing + unpaid reminders every {settings.billing_tick_seconds}s")
    yield
    for task in (ticker, digest, leave_alerts, stale_visits, billing_tick):
        if task:
            task.cancel()


# The interactive documentation is a complete map of the API — every one of the
# 264 operations with its parameters, field names and example values — and it was
# served to anyone who asked, without a login. Nothing secret leaks from it, but
# it saves someone probing the site the whole job of finding out what exists.
# The apps themselves never read it: they are written against the API, not the
# page. So it stays on locally, where it is genuinely useful, and disappears
# wherever DEBUG is false. /docs, /redoc and /openapi.json then simply 404.
DOCS_ENABLED = settings.debug

app = FastAPI(
    title="TapCure — Healthcare Appointment & Token Platform",
    version=settings.app_version,
    description="Multi-tenant hospital OP queue SaaS — Security/RBAC + Hospital modules (Phase 1).",
    lifespan=lifespan,
    docs_url="/docs" if DOCS_ENABLED else None,
    redoc_url="/redoc" if DOCS_ENABLED else None,
    openapi_url="/openapi.json" if DOCS_ENABLED else None,
    # Set API_ROOT_PATH=/api in the deployed env. Without it Swagger's page asks
    # for "/openapi.json" at the site root, which the SPA answers with index.html
    # and the docs come up blank. Empty locally, so nothing changes in dev.
    root_path=settings.api_root_path.rstrip("/"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# A NUL byte (0x00) anywhere in a request is refused up front.
#
# PostgreSQL cannot store one in a text value, so psycopg2 raises ValueError the
# moment such a string reaches it — after routing, after auth, deep inside the
# query. That surfaced as a 500: three endpoints (patient search by name, the
# front-desk lookup, the gender filter) could be crashed by anyone who could
# type a NUL character into a search box. No data leaked, but a one-character request
# that reliably produces a server error is a free way to fill the logs and hide
# real incidents among them.
#
# Refusing here, before anything is parsed, covers every endpoint at once —
# including any added later — and answers with a message that says what to fix.
@app.middleware("http")
async def reject_null_bytes(request: Request, call_next):
    if "%00" in request.url.query or chr(0) in request.url.query:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Request contains an invalid character"},
        )
    return await call_next(request)


# Immutable audit trail for every mutating request (Module 12).
app.add_middleware(AuditMiddleware)

for r in (auth, users, hospitals, departments, doctors, reception, patients,
          appointments, prescriptions, medicine_reminders, follow_ups, tokens, payments, notifications,
          subscriptions, reports, audit, voice, public_discovery, support, revisit_passes, pharmacy,
          geo, display):
    app.include_router(r.router)


# --- Swagger: show a single "paste your Bearer token" box in Authorize --------
# Auth uses OAuth2PasswordBearer, whose Swagger Authorize dialog only offers
# username/password (and /auth/login takes JSON, so that flow can't run inside
# Swagger). This override re-presents the same security requirement as an HTTP
# Bearer scheme, so Authorize shows a plain token field. Auth logic is unchanged
# — a pasted token is still sent as `Authorization: Bearer <token>`.
from fastapi.openapi.utils import get_openapi  # noqa: E402


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        # Without this, "Try it out" posts to the site root — so behind the /api
        # prefix every call in the docs would hit the SPA and 404. FastAPI adds
        # this itself from root_path; building the schema by hand loses it.
        servers=[{"url": app.root_path}] if app.root_path else None,
    )
    for name, scheme in schema.get("components", {}).get("securitySchemes", {}).items():
        schema["components"]["securitySchemes"][name] = {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi

# Serve uploaded files (patient/doctor photos, hospital logos, documents). Dev uses
# local disk under backend/uploads; swap for S3/CDN in production.
_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)


@app.get("/uploads/{subdir}/{rest:path}", tags=["meta"], include_in_schema=False)
def serve_upload(subdir: str, rest: str, exp: str | None = None, sig: str | None = None):
    """Serve an uploaded file — private folders only against a signed link.

    This whole tree used to be a bare StaticFiles mount, so
    `/uploads/patients/2/report.pdf` was a public URL: lab reports, scans and
    doctors' ID proofs downloadable by anyone who typed the path, with no login
    and from any tenant. Photos and hospital logos are genuinely public and still
    served straight, because every visitor's browser loads them.

    The content type comes from our extension allow-list rather than from
    whatever was uploaded, so nothing stored here can ever be served as a web
    page on this origin. Anything else downloads instead of rendering.
    """
    not_found = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    # No link the app makes contains "..". The private check below used to read
    # the folder NAME in the URL, so /uploads/doctors/%2E%2E/patients/… passed as
    # "doctors" (public) and then resolved into patients/ — a report with no
    # signed link. Refuse such paths outright.
    if ".." in f"{subdir}/{rest}".replace("\\", "/").split("/"):
        raise not_found

    # Resolve inside the uploads root, then confirm it stayed there: a path like
    # `../../.env` must not escape, whatever the URL says.
    root = os.path.realpath(_UPLOADS_DIR)
    full = os.path.realpath(os.path.join(root, subdir, rest))
    if not full.startswith(root + os.sep):
        raise not_found

    # Decide private/public from where the file REALLY is, not from what the URL
    # says, and case-blind: on Windows /uploads/Patients/… opens patients/.
    # The signature is checked against that same real path, so a link signed
    # for one file can't be bent to reach another.
    rel = os.path.relpath(full, root).replace(os.sep, "/")
    if rel.split("/", 1)[0].lower() in storage.PRIVATE_SUBDIRS:
        if not storage.verify_signed_path(f"/uploads/{rel}", exp, sig):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This link has expired. Open the document from the app again.",
            )
    if not os.path.isfile(full):
        raise not_found

    ext = os.path.splitext(full)[1].lower()
    media_type = storage.DOC_CONTENT_TYPES.get(ext, "application/octet-stream")
    disposition = "inline" if ext in storage.DOC_CONTENT_TYPES else "attachment"
    return FileResponse(
        full,
        media_type=media_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{os.path.basename(full)}"',
            # Belt and braces for the same reason: never let a browser sniff a
            # stored file into something executable.
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=300",
        },
    )


@app.get("/", tags=["meta"])
def root():
    return {"service": "TapCure Platform API", "version": settings.app_version,
            "phase": "1 — Security/RBAC + Hospital", "status": "ok", "docs": "/docs"}


@app.get("/health", tags=["meta"])
def health():
    return {"status": "healthy"}
