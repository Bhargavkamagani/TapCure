"""
Application settings, loaded from environment / a local .env file.

The single most important knob is DATABASE_URL: it defaults to a local SQLite
file so the API runs with zero setup, and switches to PostgreSQL by pointing it
at a postgres:// URL — no code changes anywhere else.
"""
from functools import lru_cache
from typing import List, Literal, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- App ---
    app_name: str = "TapCure API"
    app_version: str = "2.0.0"
    debug: bool = True

    # Current legal-policy version recorded against each user's consent at signup.
    # Bump (e.g. "2026-09-01") when the Terms/Privacy/Refund policies materially change.
    terms_version: str = "2026-09-01"

    # --- Database ---
    # Examples:
    #   sqlite:///./tapcure.db                (default, local dev)
    #   postgresql+psycopg2://user:pass@host/dbname  (production)
    database_url: str = "sqlite:///./tapcure.db"

    # --- Database connection pool ---
    # How many database connections ONE worker process may hold. Left unset,
    # SQLAlchemy uses 5 + 10 with a 30-second wait, and a load test on
    # 2026-09-22 found the consequence: fine at 50 simultaneous users, 84 of 300
    # requests failing at 75, and every one of 600 failing at 150. Requests were
    # not working slowly — they were queuing for a connection, waiting the full
    # 30 seconds, and dying, while still holding their place. PostgreSQL allowed
    # 100 connections throughout; the app was using 15 of them.
    #
    # Budget: db_pool_size + db_max_overflow is the ceiling PER WORKER, so the
    # total is that times the number of uvicorn workers. Keep it under the
    # server's max_connections (100 here) with room for psql, alembic and
    # backups: 20 x 4 workers = 80 leaves 20 spare.
    db_pool_size: int = 10
    db_max_overflow: int = 10
    # Seconds to wait for a free connection before giving up. Short ON PURPOSE:
    # a caller who waits 30s has already been abandoned by the patient, but is
    # still occupying the server. Failing fast returns the worker to the pool
    # and keeps the hospital usable for everyone else instead of the whole app
    # going dark.
    db_pool_timeout: int = 5
    # Recycle connections before a managed database (RDS) or a firewall drops
    # them underneath us, which otherwise surfaces as a random query error.
    db_pool_recycle_seconds: int = 1800

    # --- Auth / JWT ---
    # CHANGE THIS in production via the SECRET_KEY env var.
    secret_key: str = "dev-insecure-change-me-please-0123456789abcdef"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30           # short-lived access token
    refresh_token_expire_days: int = 30             # long-lived refresh token

    # --- Refresh-token cookie (browser sessions) ---
    # The web app keeps its refresh token in an HttpOnly cookie, out of reach of
    # page JavaScript, so a script injected into the page cannot carry off a
    # thirty-day credential. A client opts in by sending `X-Auth-Transport:
    # cookie`; API clients and scripts that don't keep getting the token in the
    # JSON body, exactly as before.
    refresh_cookie_name: str = "tapcure_rt"
    # "lax" works whenever the app and the API share a site (tapcure.in and
    # tapcure.in/api, or app./api. subdomains, or localhost:5173 -> :8000).
    # Only a deployment with the API on an unrelated domain needs "none".
    refresh_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    # None = Secure everywhere except plain-http localhost, so local dev works in
    # every browser while any real deployment gets a Secure cookie.
    refresh_cookie_secure: Optional[bool] = None
    refresh_cookie_path: str = "/"
    refresh_cookie_domain: Optional[str] = None

    # --- CORS (Vite dev server by default) ---
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
    ]

    # --- Seeding ---
    seed_on_startup: bool = True
    # When true (dev/demo), seeding also creates the City Care demo hospital with a
    # demo user per role, a sample doctor/patient/appointment. Set SEED_DEMO=false
    # in production so only the RBAC catalog, the SUPER_ADMIN, and the plan catalog
    # are created — no demo credentials in the database.
    seed_demo: bool = True
    # SUPER_ADMIN created by the seeder. Override these in production (esp. the
    # password) so the platform owner login is not a known default.
    superadmin_name: str = "Platform Owner"
    superadmin_email: str = "superadmin@tapcure.com"
    superadmin_phone: str = "9000000001"
    superadmin_password: str = "Super@123"

    # --- Razorpay (booking-fee payments) ---
    # Use TEST keys (rzp_test_…) for dev. key_secret stays server-side ONLY; only
    # key_id is ever sent to the browser. Leave blank to disable payments — the
    # booking flow then proceeds without a payment step.
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    # Optional: set this to the webhook secret from the Razorpay dashboard to
    # enable the server-to-server safety net (completes a booking if the browser
    # confirm never arrives). Leave blank to skip webhooks.
    razorpay_webhook_secret: str = ""
    # Hospital subscriptions (UPI Autopay). The one-time amount the hospital pays
    # to approve the mandate, in paise. Check the current minimum with Razorpay.
    razorpay_autopay_auth_paise: int = 100
    # Month-end billing in-process ticker (invoices on the 1st, autopay,
    # overdue marks, unpaid reminders). OFF by default like the other tickers;
    # turn it on on exactly ONE instance, or drive app.jobs.monthly_invoices
    # from cron. Every tick is safe to repeat.
    billing_ticker_enabled: bool = False
    billing_tick_seconds: int = 3600
    # Days after an invoice's due date before the hospital's online bookings stop
    # (walk-ins keep working). Paying reopens them at once.
    billing_grace_days: int = 15
    # Flat online booking fee (₹) charged at booking to reserve the token. The
    # actual consultation fee is collected at the hospital, NOT online. Set to 0 to
    # disable the online fee entirely.
    booking_fee: float = 0.0
    # How many times a PATIENT may reschedule one appointment without paying
    # again ("one free reschedule" in the Cancellation & Refund Policy). A hospital
    # can override this via hospital_settings.free_reschedules. Hospital/doctor-side
    # moves are never counted against the patient.
    free_reschedules: int = 1

    # Path prefix this API is mounted under by the reverse proxy. Behind
    # `location /api/ { proxy_pass http://127.0.0.1:8000/; }` the app itself
    # still sees "/docs", but the BROWSER is at "/api/docs" — so Swagger's page
    # asked for "/openapi.json", nginx handed that to the SPA, and the docs
    # rendered blank. Setting this makes FastAPI emit "/api/openapi.json".
    # Leave blank for local dev (uvicorn on :8000 with no prefix).
    api_root_path: str = ""

    # --- Medicine reminders ---
    # Do-not-disturb window in hospital-local hours: a dose falling inside it is
    # moved to `quiet_end`, never sent at 3 AM and never silently dropped.
    reminder_quiet_start: int = 22
    reminder_quiet_end: int = 7
    # Run the dose ticker inside the API process. Fine for the always-on server;
    # turn it OFF and drive `python -m app.jobs.medicine_tick` from cron or a
    # Lambda if the API is ever scaled to more than one instance.
    reminder_ticker_enabled: bool = False
    reminder_tick_seconds: int = 60
    # How late a dose may be and still be worth sending. A "time for your
    # tablet" that arrives three hours late is confusing, and after any outage
    # the whole backlog would otherwise land in one burst — ten messages at once
    # for doses from last month. Anything older is retired unsent.
    reminder_max_late_minutes: int = 120
    reminder_batch_limit: int = 200

    # --- "Time to leave" alert sweep ---
    # The leave alert used to be reachable ONLY from `recompute_positions`, i.e.
    # only when hospital staff pressed something. It therefore arrived whenever the
    # desk next touched the queue rather than when the patient had to set off —
    # and for a booking on a FUTURE date (whose departure window can open today)
    # it never fired at all, because nobody works tomorrow's queue today.
    # This sweep is the clock the feature always needed. OFF by default, exactly
    # like the dose ticker: on a scaled deploy drive
    # `python -m app.jobs.leave_alert_tick` from cron instead.
    leave_alert_ticker_enabled: bool = False
    leave_alert_tick_seconds: int = 300
    leave_alert_batch_limit: int = 300
    # How long after `leave_by` an alert is still worth sending. A failed send is
    # retried on the next tick (the one-shot flag is only set on success), so
    # without a bound a token whose sends keep failing would nudge the patient
    # hours late — "leave now" for a turn that has already passed is worse than
    # silence. Same reasoning as `reminder_max_late_minutes` for doses.
    leave_alert_max_late_minutes: int = 60

    # --- Voice assistant (OpenAI-compatible) ---
    # Powers the patient "Book by Voice" guide: Whisper for speech-to-text and a
    # small chat model for understanding messy speech in en/te/hi. Leave the key
    # blank to disable cloud voice — the frontend then falls back to the free
    # on-device browser Web Speech API automatically.
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_stt_model: str = "whisper-1"
    openai_nlu_model: str = "gpt-4o-mini"

    # --- Email (SMTP) ---
    # Powers real transactional email (hospital approval/rejection, test sends).
    # Leave MAIL_ENABLED=false to keep the no-network mock (DB-logged only).
    # For Gmail, SMTP_PASSWORD must be a 16-char App Password (not the account
    # password) with 2-Step Verification enabled.
    mail_enabled: bool = False
    mail_provider: str = "smtp"
    mail_from_email: str = ""
    mail_from_name: str = "TapCure"
    # Where Contact-page enquiries are emailed. Falls back to mail_from_email.
    support_email: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_timeout_seconds: int = 10

    # --- WhatsApp (Dovesoft WABA templates) ---
    # Leave WHATSAPP_ENABLED=false to keep mock DB logging.
    #
    # Every template name below has to exist, under exactly that name, in the
    # Dovesoft account the WABA number belongs to. A name that doesn't is not an
    # error you can see: Dovesoft still answers HTTP 200, just without a message
    # id, and the patient is never told. 61 booking confirmations were lost that
    # way to a made-up default before anyone noticed, so treat these as
    # provider-owned strings — read them off the portal, don't invent them.
    whatsapp_enabled: bool = False
    whatsapp_api_url: str = ""
    whatsapp_api_key: str = ""
    whatsapp_waba_number: str = ""
    whatsapp_default_lang: str = "en"
    whatsapp_country_code: str = "91"
    whatsapp_timeout_seconds: int = 30
    # `authhh` is the name approved in the Dovesoft account, NOT the `otp_04` this
    # defaulted to for months. That default is why OTPs silently stopped on any
    # environment whose .env didn't override it — the send is accepted with HTTP
    # 200 and dropped. The default now matches reality so a missing env var
    # degrades to "works" instead of "fails invisibly".
    whatsapp_otp_template: str = "authhh"
    whatsapp_appointment_confirmed_template: str = "appointment_confirmed"
    # Doctor/session cancellation — name, token/reference, doctor, date, reason.
    whatsapp_appointment_cancelled_template: str = "appointment_cancelled"
    # "Time to leave" travel alert — 5 body params
    # (name, doctor, expected time, token, destination).
    whatsapp_leave_now_template: str = "03_leave_now_"
    # "Almost your turn" — 6 body params
    # (name, wait, patients ahead, token, doctor, hospital/room).
    whatsapp_almost_turn_template: str = "almost_your_turn_a"
    # Post-consultation wrap-up — 6 body params
    # (name, visit date, consultation time, doctor, hospital, token).
    whatsapp_consultation_complete_template: str = "consultation_complete"
    # Doctor self-registration acknowledgement — 5 body params
    # (doctor, registration no, practice, location, submitted on).
    whatsapp_doctor_registration_template: str = "doctor_registration_received"
    # Doctor's morning schedule — 7 body params
    # (doctor, count, date, first appt, last appt, hospital, location).
    whatsapp_doctor_daily_template: str = "doctor_daily_bookings"
    # Doctor's end-of-day wrap-up — 6 body params
    # (doctor, date, scheduled, completed, cancelled/no-show, hospital).
    whatsapp_doctor_day_complete_template: str = "doctor_day_complete"

    # --- Doctor morning digest ---
    # The only clock-driven message. OFF by default for the same reason the
    # medicine ticker is: every API instance would tick. `doctor_digest_hour` is
    # the HOSPITAL-LOCAL hour it may start sending — a hospital's doctors are
    # messaged once their own morning arrives, whatever the server's timezone.
    doctor_digest_ticker_enabled: bool = False
    doctor_digest_hour: int = 8
    doctor_digest_tick_seconds: int = 900

    # --- Stale-visit sweep ---
    # Ends queues that nobody ended. A token not reached before its day finished
    # stayed `waiting` for ever and its appointment stayed `confirmed`; the queue
    # screen only loads one date, so it vanished from sight while both records
    # still claimed the visit was coming. Hourly is ample — the work is "is this
    # date in the past", so an extra run finds nothing and a missed one is caught
    # by the next. OFF by default like every other ticker: on a scaled deploy
    # drive `python -m app.jobs.close_stale_visits` from cron instead, or every
    # instance will sweep.
    stale_visit_sweep_enabled: bool = False
    stale_visit_tick_seconds: int = 3600
    stale_visit_batch_limit: int = 500
    # Medicine-dose nudge — 3 body params (name, medicine, instruction).
    # See services/whatsapp_templates.py and docs/whatsapp-templates.md.
    whatsapp_medicine_reminder_template: str = "tapcure_medicine_reminder"
    # Prescription ready — 5 body params (name, whose, doctor, medicines, date).
    # Sent once per visit by services/visit_wrapup.py. No `tapcure_` prefix: that
    # spelling is what the provider refused for four sends, and every template
    # that actually delivers in this account is named bare. The default matters
    # even though .env sets it — a deployment missing that line would otherwise
    # inherit the broken name and fail silently, which is how this started.
    whatsapp_prescription_ready_template: str = "prescription_ready"
    # direct = backend calls Dovesoft; sqs = backend queues event for Lambda sender.
    whatsapp_transport: str = "direct"
    whatsapp_sqs_queue_url: str = ""
    aws_region: str = "ap-south-1"
    # Durable upload storage. Local remains the safe developer default; QA sets
    # UPLOAD_STORAGE=s3 and uses the private bucket below.
    upload_storage: str = "local"
    s3_upload_bucket: str = "tapcure-media-qa"
    s3_upload_prefix: str = "qa"
    # Separate bucket for prescription material: hospital letterheads and doctor
    # signatures. Blank = use s3_upload_bucket, so nothing breaks before it exists.
    s3_rx_bucket: str = ""
    s3_url_expiry_seconds: int = 300
    whatsapp_workflow_id: str = ""
    whatsapp_campaign_id: str = ""
    whatsapp_debug: bool = False
    # Keep current dev/demo behaviour unless explicitly disabled in production.
    whatsapp_return_dev_otp: bool = True

    # --- Store-review login (Google Play / Apple App Review) ---
    # ONE phone number that accepts a fixed OTP, because a reviewer cannot
    # receive our WhatsApp code: they type a number, the OTP goes to a handset
    # in another country, and the submission is rejected as "we could not access
    # your app". `dev_otp` cannot serve this — it needs DEBUG, and the server
    # runs DEBUG=false.
    #
    # BOTH must be set for the exception to exist; either one blank switches it
    # off entirely, so it cannot be left half-enabled by a partial .env. Nothing
    # is hard-coded: the number and code are changed or revoked by editing the
    # server environment and restarting, with no release.
    #
    # Scope is deliberately one number. Every other caller — login and register
    # alike — still gets a fresh random OTP over WhatsApp, rate-limited and
    # expiring as before.
    review_phone: str = ""
    review_otp: str = ""

    # --- Health news (public /health-articles page) ---
    # Comma-separated "Label|feed-url" pairs. BLANK = the news strip is simply
    # hidden, which is the safe default: whatever a feed returns is published
    # under TapCure's name with nobody reviewing it, so only official public
    # health newsrooms belong here. Verified live on 14 Aug 2026:
    #   CDC  https://tools.cdc.gov/api/v2/resources/media/132608.rss  (current)
    #   WHO  https://www.who.int/rss-feeds/news-english.xml           (stale — newest item was 6 months old)
    # PIB (pib.gov.in) returns 403 to automated fetches; most Indian news sites
    # block them too, so an India-specific source needs a paid API key.
    health_news_feeds: str = ""
    health_news_cache_hours: int = 6
    health_news_timeout_seconds: int = 8

    # --- Routing / road travel time ---
    # The leave-by ETA uses a provider chain that always fails open:
    #   Google Distance Matrix  →  OpenRouteService  →  haversine estimate.
    # Each provider is tried only if the one above is unconfigured/unreachable, so
    # the feature keeps working (just less precise) no matter which keys are set.
    #
    # Google Distance Matrix (most accurate, live traffic). Needs a Google Maps
    # Platform key with billing enabled; restrict it to the Distance Matrix +
    # Geocoding APIs and lock it to your server IP. Leave blank to skip Google and
    # fall through to OSRM / OpenRouteService. This is the SERVER key (kept secret); the
    # browser Places autocomplete uses a separate VITE_GOOGLE_MAPS_API_KEY.
    google_maps_api_key: str = ""
    google_maps_base_url: str = "https://maps.googleapis.com/maps/api"
    # Mapbox Directions, driving-traffic profile: real live-traffic times, so
    # its minutes are NOT scaled by the traffic factors below. Tried before
    # OSRM; blank token skips it. SERVER token only — never ship it to the
    # browser. Free tier ~100k requests/month, so answers are cached this many
    # minutes (queue screens poll every 15s and would burn it otherwise).
    mapbox_token: str = ""
    mapbox_base_url: str = "https://api.mapbox.com"
    mapbox_cache_minutes: int = 10
    # OSRM (free, NO key). Public demo server by default — no uptime promise, so
    # it gets a short timeout and OpenRouteService below is its fallback. Point
    # it at a self-hosted OSRM later if traffic grows; blank skips OSRM.
    osrm_base_url: str = "https://router.project-osrm.org"
    # OSRM / ORS know only empty-road speeds; these scale their time up for city
    # traffic by IST hour (Google and Mapbox already include traffic, so they
    # aren't scaled).
    # Tuned against Google (Hyderabad, 2026-09-28): KPHB -> Omega 17 min empty
    # vs cab 30 / bike 28 at 5 pm (x1.6-1.7); a 9:37 pm trip 10.7 min empty vs
    # bike 18 (x1.68) — evening rush runs past 9 pm.
    traffic_factor_peak: float = 1.7      # 8-11 am, 5-10 pm
    traffic_factor_normal: float = 1.5    # other daytime hours
    traffic_factor_night: float = 1.2     # 11 pm - 6 am
    # The map label shows a range, "28-33 min": the traffic-adjusted time up to
    # this many minutes more, for a jam the factor doesn't know about.
    route_extra_minutes: int = 5
    # OpenRouteService (free, no credit card — sign up at openrouteservice.org/dev).
    # The fallback when OSRM is slow/down. Blank -> fall through to haversine.
    openrouteservice_api_key: str = ""
    openrouteservice_base_url: str = "https://api.openrouteservice.org"

    # --- Speech-to-text provider ---
    # "openai" uses Whisper via OPENAI_API_KEY. "deepgram" uses Deepgram Nova.
    stt_provider: str = "openai"
    deepgram_api_key: str = ""
    deepgram_base_url: str = "https://api.deepgram.com"
    deepgram_model: str = "nova-3"

    # --- Text-to-speech (Cartesia Sonic) ---
    # Speaks the assistant prompts in natural Indian-language voices — crucially
    # real Telugu, which most browsers can't synthesise. Leave the key (or the
    # voice id) blank to disable: the frontend then falls back to the browser's
    # on-device speech. One Sonic voice can speak every supported language; set a
    # per-language id only if you want a different voice for Telugu/Hindi.
    cartesia_api_key: str = ""
    cartesia_base_url: str = "https://api.cartesia.ai"
    cartesia_version: str = "2026-03-01"
    cartesia_model: str = "sonic-3.5"
    cartesia_voice_id: str = ""       # default voice (all languages)
    cartesia_voice_te: str = ""       # optional override for Telugu
    cartesia_voice_hi: str = ""       # optional override for Hindi
    cartesia_voice_en: str = ""       # optional override for English

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        """Allow CORS_ORIGINS to be given as a comma-separated string in env."""
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
