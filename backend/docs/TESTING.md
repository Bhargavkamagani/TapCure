# Testing TapCure

Everything here runs against a **separate** database (`tapcure_qa`, configured in
`tests/test.env`) with WhatsApp, SMTP and the background tickers switched off.
`harness.assert_safe_environment()` refuses to run otherwise — that guard exists
because patching the send functions was tried first and still leaked live
WhatsApp messages to a real phone number twice.

**Never point these at the working `med` database or at a server.**

## The suite

```
cd tapcure_backend/backend-deploy-20260917

venv\Scripts\python -m tests.test_block1_access    # auth, roles, IDOR, tenant isolation
venv\Scripts\python -m tests.test_block2_data      # data exposure, injection, XSS, uploads, JWT, logout
venv\Scripts\python -m tests.test_block3_logic     # payments, appointment rules, token engine, concurrency
venv\Scripts\python -m tests.test_block4_ops       # prescriptions, notifications, reports, audit, errors, DB
venv\Scripts\python -m tests.test_block5_sweep     # every endpoint: nothing public by accident, nothing crashes
```

Expected: **218 passed, 0 failed** (52 / 72 / 25 / 62 / 7).

Blocks 1-4 go deep on the ~28 endpoints where damage lives. Block 5 goes shallow
across all 266 operations and catches the two failures that hide in the endpoints
nobody looks at: a missing guard, and a crash.

Run them in any order, and re-run freely — block 3 clears bookings first, and
block 2 uses a time-based phone number, so a second run does not trip over the
first.

## Dependency vulnerabilities

```
venv\Scripts\python -m pip_audit
```

Expected: `No known vulnerabilities found`. Run it before adding any package.

## Load / capacity

```
venv\Scripts\python -m perf.ramp        # concurrency ladder, finds the cliff
venv\Scripts\python -m perf.loadtest    # login / queue poll / dashboard / public
```

Measured 2026-09-22 on one worker: zero failures to 200 concurrent; latency
climbs 1.2s -> 3.3s. Login is the separate ceiling at ~6/sec (bcrypt CPU) — size
uvicorn workers from that, not from the read throughput.

If a phase reports every request failing, mint a **fresh token at the start of
that phase**: one-device-per-account rotates the session on each login, so a
token taken earlier is already dead. A RECEPTIONIST login is exempt.

## Backup / restore

```
venv\Scripts\python -m scripts.backup_drill
```

Dumps the live database (read only — `pg_dump` cannot write to its source),
restores into a scratch database, compares every table row for row, then drops
the scratch. Verified 2026-09-22: 62 tables, 14,539 rows, exact.

## Writing new tests — four rules learned the hard way

1. **422 is not "refused."** A schema complaint proves nothing about a security
   check. A payment-forgery test passed green for days because it sent an
   incomplete body and counted the 422 as a pass.
2. **Assert on the side effect, not just the status code.** For anything that
   creates data, check the row count afterwards.
3. **Never call `/auth/otp/request`, `/support/contact` or any reminder
   dispatch** outside this harness. Those send for real.
4. **Enumerate endpoints from `app.openapi()`, not `app.routes`.** FastAPI 0.141
   stopped flattening included routers into `app.routes`, so walking it finds 7
   routes instead of 266 and a sweep silently tests nothing.
