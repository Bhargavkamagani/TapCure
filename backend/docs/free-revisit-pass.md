# Free Revisit Pass — design

## What it is

After a **paid** consultation, the patient holds one **free revisit** with the
same doctor for a clinic-configured number of days. They do not book — they walk
in, reception looks them up, sees the pass, issues a token and collects nothing.

Decided with the product owner (21 Aug 2026):

| Question | Decision |
| --- | --- |
| Scoped to doctor or clinic? | **Doctor** — "come and see *me* again" |
| Waive the online booking fee too? | **Yes** — same entitlement whether they walk in or book |
| Does a revisit earn a new pass? | **No** — only a paid consultation earns one |

## Why it is a pass, not an appointment

The requirement is "no need to book an appointment". Modelling it as an
`Appointment` would mean inventing a zero-fee appointment that exists before the
patient decides to come — and then cancelling it when they don't. Modelling it as
a `FollowUp` is wrong too: a `FollowUp` is a doctor's clinical instruction with a
due date, and it carries no fee meaning.

A pass is an **entitlement the patient holds**. It is issued by the system,
redeemed at the counter, and expires quietly if unused. Nothing needs cleaning up.

## Lifecycle

```
consultation completes  ──▶  ISSUED (active)      valid_until = completed_on + N days
   te.finish_serving()           │
                                 ├──▶ patient turns up ──▶ redeem ──▶ REDEEMED
                                 ├──▶ window passes ─────────────────▶ EXPIRED
                                 └──▶ affiliation ends / doctor gone ▶ VOID
```

One pass per completed consultation, per (patient, doctor). Issued automatically —
the doctor does not have to remember, and cannot forget.

## Where it hooks in

`services/token_engine.finish_serving()` is the single place a consultation
completes. It already fires `maybe_send_consultation_complete` and
`maybe_send_day_complete`; `maybe_issue_revisit_pass` joins them. One call site,
so no path can complete a consultation without considering a pass.

Issue is refused when any of these hold:
- the practice has not opted in (its window is NULL — see *Who owns the window*)
- the source appointment was itself a redeemed revisit (no chaining)
- the consultation was free (`consultation_fee <= 0`) — nothing was paid for
- an active pass already exists for that (patient, doctor)

## Who owns the window

Whoever sets the fee sets the waiver:

| Practice | Window read from | Who edits it |
|---|---|---|
| Clinic-run (`managed_by_hospital`) | `hospital_settings.free_revisit_days` | clinic admin, Clinic Profile |
| Doctor's own (`personal_clinic`, `home`, `online`) | `doctor_affiliations.free_revisit_days` | the doctor, Consultation Fee page |

`services.revisit_pass.window_days(db, hospital_id, affiliation_id)` is the single
resolver, and a personal practice NEVER falls through to the hospital. It must
not: a self-registered doctor's personal affiliation carries `hospital_id = NULL`,
but appointments fall back to `doctor.hospital_id` (`routers/appointments.py:410`),
which for a solo doctor is the default anchor tenant `_default_hospital_id` picked
— the lowest active hospital. Before this resolver existed, every solo doctor was
reading the free-revisit policy of a clinic they do not work for, never
configured, and cannot see — and would have spent that clinic's money doing it.

The same doctor can therefore hold different answers at different practices,
which is why the column is on the affiliation and not on `doctors`.

## Data

One new table. No existing table changes except one settings column.

```
revisit_passes
  pass_id                  PK
  hospital_id              FK hospitals            (index)
  doctor_id                FK doctors              (index)
  affiliation_id           FK doctor_affiliations  nullable — practice it was earned at
  patient_id               FK patients             (index)
  family_member_id         FK family_members       nullable — dependant the visit was for
  source_appointment_id    FK appointments         the paid visit that earned it
  issued_on                DATE
  valid_until              DATE                    (index)
  status                   active | redeemed | expired | void   (index)
  redeemed_appointment_id  FK appointments         nullable
  redeemed_at, redeemed_by
  created_at, updated_at

  partial unique (patient_id, doctor_id) WHERE status = 'active'
```

`hospital_settings.free_revisit_days` — `Optional[int]`, exactly like the existing
`free_reschedules`. NULL = clinic does not offer it, so **the feature is off by
default** and each clinic opts in. Platform default in `config.py` for parity.

**Status is stored, not derived.** A clinic changing the window from 15 days to 10
must not retroactively cancel passes already promised — the promise was made at
issue time, and `valid_until` freezes it.

The partial unique index is the real guard against double-issue under concurrency;
the service-level check is only a friendly error.

## Family accounts — the pass belongs to a PERSON

One account books for several people. A visit booked for a dependant earns the
pass for **that dependant**, not for the account holder:

> Raju books for his sister Raji. Raji's paid consultation completes → the pass
> is Raji's. Raju walking in himself gets nothing from it; he earns his own only
> by paying for his own consultation with the same doctor.

Issue, lookup and redeem all key on `(patient_id, doctor_id, family_member_id)`,
so one account can legitimately hold several live passes with the same doctor —
one per family member.

`uq_revisit_pass_active` originally did NOT include `family_member_id`, so the
second person on an account silently lost the pass they had earned:
`maybe_issue` catches `IntegrityError` and returns None by design, so nobody was
told. Fixed in `e7a3c9d51f84`, now keyed on
`(patient_id, doctor_id, COALESCE(family_member_id, 0))`.

The COALESCE is load-bearing: NULL != NULL in SQL, so a plain three-column index
would never collide `(patient, doctor, NULL)` with itself and the account holder
would lose the double-issue guard entirely.

Because of this, every surface names who the pass is for. `describe()` returns
`for_name` — the dependant's name, or the account holder's — and both the
patient card and the front-desk badge show it. An unlabelled "Free revisit
available" on a family account invites the desk to redeem the sister's visit for
the brother.

## The sharp edge

`routers/tokens.py:325` skips unpaid patients when calling the next token:

```python
def _is_paid(w) -> bool:
    return (not a) or a.consultation_paid or float(a.consultation_fee or 0) <= 0
```

A redeemed revisit MUST be created with `consultation_fee = 0` — **not** with the
normal fee left unpaid. Otherwise the patient is skipped forever, silently, and
nobody finds out until they complain. This is why redemption goes through one
service function rather than being assembled at the front desk.

## API

```
GET  /revisit-passes/mine                     patient — active passes, for the card
GET  /revisit-passes/lookup?patient_id&doctor_id
                                              reception/doctor — "does this patient
                                              have a pass with THIS doctor?"
POST /revisit-passes/{pass_id}/redeem         reception — issues a zero-fee token
GET  /revisit-passes/window                   doctor — the window at each of MY
                                              practices, + who may change it
```

The window is written back through the existing
`PUT /doctor-affiliations/{id}` (`free_revisit_days`), which already enforces
"your own practice only"; it additionally 409s on a hospital-managed practice
rather than writing a column `window_days` would then ignore.

`GET /revisit-passes/window` sits on this router, under `appointment.read`,
rather than on the hospital settings endpoint because ROLE_DOCTOR has no
`hospital.read` (`rbac.py:83`) — a doctor asking what waiver applies to their own
consultations would get a 403, and granting the permission to answer one number
would widen every other hospital endpoint and force a `sync_permissions` run.

Permissions reuse the existing matrix (`appointment.create` to redeem,
`patient.read` to look up) — no new permission strings, so no `sync_permissions`
run is needed on deploy.

Those permissions say what KIND of thing you may do, never WHOSE, and both are
held broadly: `patient.read` by every receptionist at every clinic AND by every
patient. So each endpoint also runs an ownership guard — `_assert_may_read`,
`_visible`, `_assert_may_redeem`:

| Caller | May read | May redeem |
|---|---|---|
| Patient | their own record only | never — it issues a token and marks money collected, a desk action |
| Doctor | passes naming them as the doctor | passes earned with them |
| Clinic staff | passes at their hospital, excluding personal practices | same |
| Super admin | all | all |

The personal-practice exclusion is the same trap as everywhere else in this
feature: a solo doctor's pass carries `hospital_id = doctor.hospital_id`, the
default anchor tenant, so a plain hospital match would hand that clinic every
solo doctor's passes.

`create_booking` also consults the pass, so a patient who books online instead of
walking in is not charged for a visit they already own. The fee is resolved
BEFORE the row is built — never written full and corrected after — because
`tokens.py` reads it to decide who may be called next.

The visit must fall inside the window, not merely be booked inside it: booking on
the 1st for the 20th when the pass dies on the 5th is a normal paid visit.

Cancelling hands the pass back (`revisit_pass.restore`, called from the single
shared `_do_cancel`). Cancelling a paid visit costs the patient nothing, so
cancelling a free one must not cost them the pass. A cancellation after the
window closed leaves the pass EXPIRED rather than active — returning a pass that
can never be used would show a live card the counter would then refuse.

## UI

**Patient dashboard** — a card beside the existing `FollowUpCard`:

> **Free revisit available**
> See Dr. Rahul Sharma again at no charge until **5 Sep** (12 days left).
> Just walk in — no booking needed.

Trilingual (en/te/hi) like the rest of the patient surface.

**Doctor → Consultation Fee** (`pages/doctor/Fees.jsx`) — one Free Revisit card
per practice, beneath the fee. Editable for a practice the doctor runs
themselves; for a clinic-run one it shows the clinic's number with the same lock
treatment the fee already uses. It lives on the fee page, not a page of its own,
because a free revisit IS a fee decision.

**Reception + doctor** — a badge with a **Use free revisit** button in
`components/patient/PatientHistoryDrawer.jsx`,
which all four consoles already open (`assistant/Patients`, `assistant/Vitals`,
`doctor/Dashboard`, `doctor/Patients`). It must answer *for this doctor at this
clinic* — a pass with Dr. A is not valid with Dr. B, and showing a bare "has a
pass" badge would cause exactly that mistake at the counter. The button posts to `/redeem` and shows the issued token number,
which is the thing the desk has to read out; the note outlives the badge, because
redeeming removes the last pass and the token must not vanish with it. It is
shown in the doctor consoles too, not just reception — a solo doctor running
their own practice has no front desk to do it for them.

## What this does NOT do

- No refunds. The pass waives a future charge; it never returns money.
- No auto-booking. The patient still has to turn up (or book, if they prefer).
- No reminder yet. A "your free revisit expires in 3 days" nudge is a natural
  Phase 2 on the existing reminder engine, deliberately out of scope here.

## Migration

Additive only, across two revisions:

- `c1d4e7f2a9b3` — one `CREATE TABLE`, one nullable column on `hospital_settings`
- `d2f5a8c93b17` — one nullable column on `doctor_affiliations`
- `e7a3c9d51f84` — widens the active-pass unique index to include the family member

Both self-heal, so a re-run cannot abort the chain. No backfill — passes start
being earned from the day it ships, and NULL everywhere means "not offered".
Safe to deploy before the UI, and no `sync_permissions` run is needed.
