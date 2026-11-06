# TapCure — Healthcare Appointment & Token Platform — Backend API

Multi-tenant SaaS backend for hospital OP (outpatient) **digital token & queue
management**, built from the full-architecture deck. FastAPI + SQLAlchemy, real
RBAC, bcrypt + JWT auth, Alembic migrations.

- **Framework:** FastAPI + SQLAlchemy 2.0 (ORM) + Pydantic v2
- **Database:** **PostgreSQL** in production; **SQLite** locally (zero setup). One `DATABASE_URL` switches between them — and MySQL — with no code changes.
- **Auth:** bcrypt passwords, JWT **access + rotating refresh** tokens, 5-role RBAC, multi-tenant scoping by `hospital_id`.
- **No Redis.** JWT is stateless; queue/ETA is computed from Postgres; the live display board uses short-polling; rate limiting is Nginx's job. Redis can be added later behind existing interfaces if scale ever demands it.

---

## Build status (phased)

| Phase | Modules | Status |
|---|---|---|
| **1** | Security/RBAC · Hospital & Department | ✅ Done |
| **2** | Doctor · Reception | ✅ Done |
| **3** | Patient · Appointment | ✅ Done |
| **4** | **Token Engine** (core queue) | ✅ Done |
| **5** | Notification (mock provider) | ✅ Done |
| — | Payment (Razorpay) | ⏸️ Deferred (later task) |
| **6** | Subscription · Reports · Audit | ✅ Done |
| 7 | IVR voice booking | ⏳ Next |

Each phase ends green: migration applies to a fresh DB + the `tests/` suite passes.

---

## Quick start

```bash
cd backend
.\.venv\Scripts\Activate.ps1          # Windows PowerShell (or create: python -m venv .venv)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

First boot creates tables and seeds the RBAC catalog + a demo tenant.

- Docs (Swagger): http://localhost:8000/docs
- Health: http://localhost:8000/health

### Demo logins (one per role)

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@tapcure.com` | `Super@123` |
| Hospital Admin | `admin@citycare.com` | `Admin@123` |
| Receptionist | `reception@citycare.com` | `Recep@123` |
| Doctor | `doctor@citycare.com` | `Doctor@123` |
| Patient | `patient@tapcure.com` | `Patient@123` |

Login returns `{access_token, refresh_token, user}`. Send `Authorization: Bearer <access_token>`; rotate via `POST /auth/refresh`.

**Browser sessions (the web app):** the app sends `X-Auth-Transport: cookie` on login, refresh and logout. The refresh token then goes into an `HttpOnly` cookie (`tapcure_rt`, `SameSite=Lax`, `Secure` except on plain-http localhost) instead of the JSON body, and `/auth/refresh` / `/auth/logout` read it from there with no body. The access token is kept in memory only. Clients that don't send the header (scripts, tests) are unchanged. Cookie settings: `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_PATH`, `REFRESH_COOKIE_DOMAIN`. If the API is ever served from a different site than the app, set `REFRESH_COOKIE_SAMESITE=none`.

---

## Production database (PostgreSQL)

No code changes — set the URL and migrate:

```bash
# .env
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/tapcure

alembic upgrade head
uvicorn app.main:app
```

(`mysql+pymysql://…` also works — both drivers are in `requirements.txt`.)

### ⚠️ Run ONE worker

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Do not raise the worker count, and **do not wrap this in gunicorn with `-w 4`** —
that is what most AWS deployment guides show, and it is the way this breaks
without anyone meaning to.

Two pieces of state live in the process's own memory, not in a shared store:

* `services/otp_store.py` — the login codes (`_STORE`, a plain dict)
* `services/attempts.py` — the rate-limit counters (`_HITS`, a plain dict)

With more than one worker, "send OTP" is remembered by one worker and "verify
OTP" is load-balanced to another that has never seen it, so **roughly 3 in 4
patient logins fail at random** with *"Invalid or expired OTP"*. Nothing in the
logs points at the cause. Rate limits also become ~N× looser than intended.

The in-process reminder tickers (`REMINDER_TICKER_ENABLED`,
`LEAVE_ALERT_TICKER_ENABLED`) have the same problem from the other direction:
each worker runs its own timer, and `reminder_engine.dispatch_due` selects due
doses, sends them, and only then commits — with no row locking. N workers means
**N duplicate WhatsApp messages per dose**.

One worker is not a stopgap: a load test on 2026-09-22 handled **200 simultaneous
users with zero failures** on a single worker (`perf/ramp.py`). Login is the only
real ceiling, at ~6/sec, and that is CPU-bound password hashing.

**When one worker genuinely is not enough**, the order is: move the OTP store and
rate limiter to Redis, move the reminder and leave-alert tickers to cron
(`python -m app.jobs.medicine_tick`, `python -m app.jobs.leave_alert_tick`), and
then raise the worker count — recalculating `DB_POOL_SIZE` so
`(pool_size + max_overflow) × workers` stays under the database's
`max_connections`. Not before.

The stale-visit sweep (`STALE_VISIT_SWEEP_ENABLED`) is the exception: it sends
nothing and only closes abandoned tokens, so extra copies are wasteful rather
than harmful.

---

## Architecture

```
app/
  config.py            settings (DATABASE_URL, SECRET_KEY, CORS, token TTLs)
  database.py          engine, SessionLocal, Base, get_db, portable BigInt PK
  security.py          bcrypt + JWT access/refresh + OTP helpers
  rbac.py              permission catalog + role→permission matrix
  deps.py              get_current_user, require_permission, require_role, tenant scoping
  models/              ORM tables, grouped by module (security, hospital, doctor, reception, …)
  schemas/             Pydantic request/response, by module
  routers/             API endpoints, by module
  services/            audit log helpers, OTP store (swappable for Redis), scheduling
  seed.py              idempotent RBAC + demo-tenant seeding
  main.py              app factory, CORS, router wiring, startup
alembic/               migrations
tests/                 end-to-end test suite (needs a Postgres test DB, see docs/TESTING.md)
```

**Multi-tenancy:** every tenant-scoped row carries `hospital_id`. Non-super-admin
users are confined to their own hospital by `ensure_same_tenant`; `SUPER_ADMIN`
sees everything. **RBAC:** each user has one role; routes are guarded by
`require_permission("module", "action")` against the seeded permission matrix.

---

## Endpoint map (Phases 1–2)

| Area | Methods |
|---|---|
| **Auth** | `POST /auth/{login,register,refresh,logout,change-password,forgot-password,reset-password,verify-email}`, `GET /auth/me` |
| **Users/Roles** | `GET/POST /users`, `GET/PUT/DELETE /users/{id}`, `GET /roles`, `GET /login-history`, `GET /activity-logs` |
| **Hospitals** | `GET/POST /hospitals`, `GET/PUT/DELETE /hospitals/{id}`, `GET/PUT /hospitals/{id}/settings` |
| **Departments** | `GET/POST /departments`, `PUT/DELETE /departments/{id}` |
| **Doctors** | `GET/POST /doctors`, `GET/PUT/DELETE /doctors/{id}`, `GET/POST/PUT/DELETE /doctor-schedule`, `POST/DELETE /doctor-breaks`, `GET/POST/DELETE /doctor-holidays`, `GET/POST /doctor-delay`, `GET/POST/PUT /doctor-leave`, `GET /doctor-status` |
| **Reception** | `GET/POST /receptionists`, `PUT/DELETE /receptionists/{id}`, `GET/POST/PUT/DELETE /receptionist-shifts` |
| **Patients** | `GET/POST /patients`, `GET/PUT/DELETE /patients/{id}`, `GET /patients/search`, `GET/POST/PUT/DELETE` for `/family-members`, `/medical-history`, `/allergies`, `/documents` (multipart upload), `GET /patients/{id}/appointments` |
| **Appointments** | `GET/POST /appointments`, `GET/PUT/DELETE /appointments/{id}`, `GET /appointments/available-slots`, `/today`, `/upcoming`, `/cancellations`, `POST /appointments/{reschedule,cancel,walk-in,feedback}`, `GET /appointments/{id}/{status,reschedule}-history` |
| **Token Engine** | `POST /tokens/generate`, `GET /tokens/{current,waiting,queue,estimate,stats,live-display,history,no-show}`, `POST /tokens/{next,complete,recall,cancel,missed,skip,reorder,bulk-cancel,notify}`, `GET/PUT /tokens/{id}` + `/priority` + `/{status-history,movement-logs}`, `POST/GET /emergency`, `POST /emergency/{id}/complete` |
| **Notifications** | `POST /{sms,whatsapp,email,push}/send`, `POST /{sms,push}/bulk`, `GET /notification-history`, `GET /notifications/{id}`, `GET /{sms,whatsapp,email}-logs`, `GET /notification-stats`, `GET /notification-templates`, `POST /notification-{settings,test}` — mock provider; token recall/notify dispatch real notification records |
| **Subscriptions** | `GET/POST /plans`, `PUT /plans/{id}`, `GET/POST /subscriptions`, `PUT/DELETE /subscriptions/{id}`, `GET /subscriptions/usage`, `GET /invoices`, `GET /invoices/{id}` |
| **Reports** | `GET /reports/{daily,monthly,doctor,department,revenue,peak-hours,no-show,cancellations,wait-time,patient-flow,token-forecast,receptionist,dashboard,super-admin,export}` — live aggregation; revenue is the completed-visit fee proxy (Payment deferred) |
| **Audit** | `GET /audit-logs`, `GET /audit-logs/user/{id}`, `GET /audit-logs/{entity_type}/{id}` — auto-written by middleware for every mutating request (X-Request-ID header) |

---

## Tests / migrations

```bash
alembic revision --autogenerate -m "describe change"   # after editing app/models
alembic upgrade head
```
