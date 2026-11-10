# WhatsApp templates — submission copy

Every WhatsApp business message TapCure sends is a **pre-approved template**.
Outside the 24-hour customer-service window Meta delivers nothing else, so a
template that isn't approved at the provider means the message simply never
arrives — the send is rejected, not queued.

Two artefacts have to stay in step:

| Artefact | Where it lives |
| --- | --- |
| The approved copy | Dovesoft portal → Meta (this document is what you paste) |
| The code that fills `{{n}}` | `app/services/whatsapp_templates.py` |

If you edit the body at the provider, change the builder in the same commit.
A parameter count that doesn't match the approved body fails **at send time**,
in production, not at approval.

---

## 1. `tapcure_medicine_reminder` — NEW, needs approval

| Field | Value |
| --- | --- |
| Template name | `tapcure_medicine_reminder` |
| Category | **Utility** |
| Language | English (`en`) — must match `WHATSAPP_DEFAULT_LANG` |
| Header | *(none)* |
| Footer | `TapCure` |
| Buttons | *(none)* |

**Body**

```
Hello {{1}}, 💙
Here's a gentle reminder from TapCure — it's time for {{2}} medicine. ⏰

💊 Medicine: {{3}}
🔹 {{4}}

Your health deserves a little care every day. 🌿
Stay well, take care, and remember — we're here when you need us. 💙
— Team TapCure
```

Matches the house style of the already-approved TapCure templates
(`appointment_confirmed`, `almost_turn`, `consultation_complete`): a
`Hello {name},` opener, emoji-labelled detail lines, a `🔹` instruction, and a
`💙` closing line.

**Do not put "your" in front of `{{2}}`.** The parameter already carries the
possessive — it arrives as `your` or as `Raju's`. A template reading
"time for your {{2}} medicine" renders "time for your your medicine", and
"time for your Raju's medicine" for a dependent. This was caught before
submission; it is the easiest mistake to make when editing this copy.

**`{{4}}` is the instruction, not the dose.** Labelling that line "Dose:"
prints "Dose: Please take it after food." The dose is already inside `{{3}}`,
in brackets, because a prescription line often has no dosage at all and Meta
rejects a send whose parameter is blank — one such line would otherwise cost
that patient every reminder in the course.

**Parameters**

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | First name of whoever's **phone** this goes to | `reminder_recipient()` decides; account holder unless the dependent opted into their own number | `Satya` |
| `{{2}}` | Whose medicine it is — `your`, or the patient's name in possessive | `greeting_for()` | `Raju's` |
| `{{3}}` | Medicine, with the dose in brackets when the Rx line has one | `course.drug_name` + `course.dosage` | `Dolo 650 (1 tablet)` |
| `{{4}}` | Instruction sentence, carrying the food note when there is one | `course.food_note` | `Please take it after food.` |

`{{1}}` and `{{2}}` are deliberately separate. The reminder used to greet the
dependent by name while arriving on the account holder's phone — a parent
minding a child's course read "Hi Raju" on their own handset. Now the greeting
follows the handset and the possessive names the patient, so both cases read
naturally from one approved template.

**Sample values for the approval form** (providers ask for one example per
parameter). Taking your own medicine renders as:

> Hello Satya, 💙
> Here's a gentle reminder from TapCure — it's time for your medicine. ⏰
>
> 💊 Medicine: Dolo 650 (1 tablet)
> 🔹 Please take it after food.
>
> Your health deserves a little care every day. 🌿
> Stay well, take care, and remember — we're here when you need us. 💙
> — Team TapCure

…and minding a dependent's renders as:

> Hello Satya, 💙
> Here's a gentle reminder from TapCure — it's time for **Raju's** medicine. ⏰
>
> 💊 Medicine: Dolo 650 (1 tablet)
> 🔹 Please take it after food.
>
> Your health deserves a little care every day. 🌿
> Stay well, take care, and remember — we're here when you need us. 💙
> — Team TapCure

```
{{1}} = Satya
{{2}} = Raju's
{{3}} = Dolo 650 (1 tablet)
{{4}} = Please take it after food.
```

**Why it's shaped this way**

- **The medicine sits on its own line.** A reminder is glanced at, not read.
  Name and dose alone on a line are far easier to take in on a phone than the
  same words buried mid-sentence.
- **"Take care", never "get well soon".** A large share of these go to people on
  lifelong medication — blood pressure, diabetes, thyroid. Wishing a swift
  recovery twice a day, for years, reads as tone-deaf to someone whose condition
  isn't going away. "Take care" fits both the week-long course and the lifelong
  one.
- **Warm, but not promotional.** The template is submitted as Utility and Meta
  checks the wording matches. Friendly is fine; anything that reads like
  marketing risks reclassification — which costs both an approval and a higher
  per-message rate.
- Emoji are allowed and generally approved. They render inconsistently on very
  old Android builds; drop them if reliability ever matters more than warmth.
- Dose and food note are both optional on a prescription line. They're folded
  into two always-present parameters instead of becoming their own `{{n}}`,
  because Meta rejects a send whose parameter is blank — one Rx line with no
  dosage would otherwise cost that patient every reminder in the course.
- The body opens and closes with static text. A body that ends on a variable is
  a common rejection reason at review.
- Category is **Utility**, not Marketing: it's a transactional follow-up to
  treatment the patient is already receiving. Getting this wrong is the usual
  cause of a rejection *and* of higher per-message pricing.

---

## 2. `appointment_confirmed` — approved at Dovesoft under **this** name

> **This name was wrong here until 14 Aug 2026**, and the cost was real. The code
> default and this document both said `tapcure_appointment_confirmed`, which does
> not exist in the Dovesoft account. Dovesoft answered every send with HTTP 200
> and no message id, `whatsapp_logs` recorded all 61 of them as `sent`, and not
> one patient was told their appointment was confirmed. OTPs kept working the
> whole time because someone had already discovered the same trap there and
> pinned `WHATSAPP_OTP_TEMPLATE=authhh` in `.env`.
>
> The lesson worth keeping: **template names belong to the provider, not to us.**
> Read them off the Dovesoft portal. A name we invent looks perfectly healthy in
> the logs right up until a patient asks why they never heard from us.

Set via `WHATSAPP_APPOINTMENT_CONFIRMED_TEMPLATE` (in `.env`, `.env.qa` and
`.env.example`); `config.py` carries the same value as its default.

**Body** (7 parameters, in this order — updated 14 Aug 2026 to the approved copy;
the previous 5-parameter version in this file was never the real template)

```
Appointment Confirmed!
Your appointment has been confirmed under the name *{{1}}*.

📅 Date: {{2}}
🕥 Appointment Time: {{3}}
👨‍⚕️ Doctor: Dr. {{4}}
🎟 Token No: {{5}}

📍 Location: {{6}}
🚗 Get Directions: {{7}}
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Name the visit is booked under — **full name**, not the first name the reminders use | `family_member.name` or `patient.name` | `Ramesh Kumar` |
| `{{2}}` | Date | `appointment.appointment_date` | `12 Aug 2026` |
| `{{3}}` | Slot time, or `As per token queue` when there is no slot | `appointment.slot_time` | `10:30 AM` |
| `{{4}}` | Doctor's name, **no honorific** — the copy already says "Dr." | `doctor.name` | `Rahul Sharma` |
| `{{5}}` | Token code | `token.display_code` | `A-014` |
| `{{6}}` | Clinic name + address | `_location_text()` | `CityCare Clinic, MG Road, Vizag` |
| `{{7}}` | Directions link | `google_maps.directions_url()` | `https://www.google.com/maps/dir/?api=1&destination=17.494869,78.398150` |

Sent by `services/token_engine.send_booking_confirmation`.

**Three things this body needs that the old one didn't:**

- **`{{3}}` can't be blank.** Token-mode and walk-in bookings carry no
  `slot_time`, and a blank parameter kills the whole message — so those send the
  literal text `As per token queue` rather than inventing a clock time.
- **`{{6}}` is assembled, not concatenated.** Stored addresses here already end
  in the city ("… Kukatpally, Hyderabad, Telangana, India"), so appending `city`
  repeated it, and a flat character cut left patients reading "Hydera".
  `_location_text` drops whole comma-separated chunks from the general end
  instead.
- **`{{7}}` prefers coordinates.** `dir/?api=1&destination=lat,lng` opens the
  Maps app directly; a clinic *name* routes to the wrong place surprisingly
  often in small towns. Falls back to the url-encoded address, then to plain
  `maps.google.com` — never blank.

**The same trap was then walked into twice.** The 14 Aug fix above changed the
name to `appointment_confirmation` — still not the approved one. The real name
is `appointment_confirmed`, corrected 20 Aug 2026. `whatsapp_logs` tells the
whole story:

| Name used | Period | Outcome |
| --- | --- | --- |
| `tapcure_appointment_confirmed` | 21 Jul – 13 Aug | 61 rows `sent`, **none delivered** |
| `appointment_confirmation` | 14 Aug 07:35 – 08:10 | 2 rows `sent`, **none delivered** |
| `appointment_confirmation` | 14 Aug 10:36 – 20 Aug | 56 rows `failed`, `no_message_id` |

Those first 63 rows read as `sent` only because the `no_message_id` guard in
`whatsapp_client` did not exist yet; it shipped in the 14 Aug 10:34 deploy and
started reporting the truth. **No booking confirmation has ever reached a
patient.** The body (7 parameters, `{{7}}` directions link included) was correct
throughout — only the name was ever wrong.

**Still to confirm against the portal:** the language code. The sender uses
`WHATSAPP_DEFAULT_LANG` (`en`). If this template is approved as `en_US`, the send
fails in the same silent way the wrong name did — right name, right parameters,
still no message.

---

## 3. `03_leave_now_` — approved, wired 14 Aug 2026

| Field | Value |
| --- | --- |
| Template name | `03_leave_now_` (env `WHATSAPP_LEAVE_NOW_TEMPLATE`) |
| Type | TEXT |
| Header | `Time to Leave` |

**Body** (5 parameters, in this order)

```
Hi {{1}}, your turn for Dr. {{2}} is expected around {{3}}.

🎟 Token: {{4}}

Please start for {{5}} now so you arrive in time. Track your live position in the app.
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Patient's first name (the dependent's, when the token is for one) | `family_member.name` or `patient.name` | `Ramesh` |
| `{{2}}` | Doctor's name, **no honorific** — the copy already says "Dr." | `doctor.name` | `Rahul Sharma` |
| `{{3}}` | Expected call time, in **clinic-local** wall clock | `estimate()["estimated_time"]` | `11:45 AM` |
| `{{4}}` | Token code | `token.display_code` | `A-014` |
| `{{5}}` | Where to go | affiliation name, else hospital name | `CityCare Clinic` |

**When it fires:** `token_engine.maybe_send_leave_alert`, called from
`recompute_positions` every time the queue shifts. It sends once the clock passes
`remind_at` (= `leave_by` − `REMIND_BEFORE_MIN`, where `leave_by` = ETA − travel
time − `ARRIVAL_BUFFER_MIN`), and only for a `waiting` token with a known travel
time. `token.notified_leave` makes it one-shot, so a patient whose position moves
five times still gets exactly one alert.

**Two traps this path already fell into once, worth not repeating:**

- `{{3}}` must be converted out of UTC. Everything is stored naive UTC, so the
  raw value would have told a patient 6:15 AM for an 11:45 AM turn.
- `{{2}}` gets its honorific stripped (`_bare_doctor_name`), or a row stored as
  "Dr. Rahul Sharma" reaches the patient as "Dr. Dr. Rahul Sharma".

Until 14 Aug 2026 this alert went out as an **SMS through the mock provider** —
logged as delivered, sent to nobody. The whole leave-by calculation was being
computed correctly and then discarded at the last step.

---

## 4. `almost_your_turn_a` — approved, wired 14 Aug 2026

| Field | Value |
| --- | --- |
| Template name | `almost_your_turn_a` (env `WHATSAPP_ALMOST_TURN_TEMPLATE`) |
| Type | TEXT |
| Header | `Almost Your Turn!` |

**Body** (6 parameters, in this order)

```
Hello *{{1}}*, your consultation turn is approaching.⏳
⏱ Estimated Wait: {{2}}
👥 Patients Ahead: {{3}}
🎟 Token No: {{4}}
👨‍⚕️ Doctor: Dr. {{5}}
🏥 Hospital / Room: {{6}}
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Patient's first name (the dependent's, when the token is for one) | `family_member.name` or `patient.name` | `Ramesh` |
| `{{2}}` | Estimated wait | `estimate()["wait_min"]`, or "a few minutes" at zero | `10 min` |
| `{{3}}` | Patients ahead | `queue_position − 1` | `3` |
| `{{4}}` | Token code | `token.display_code` | `A-014` |
| `{{5}}` | Doctor's name, **no honorific** — the copy already says "Dr." | `doctor.name` | `Rahul Sharma` |
| `{{6}}` | Hospital / room | affiliation name, else hospital name | `CityCare Clinic` |

**When it fires:** `token_engine.maybe_send_almost_turn`, called from
`recompute_positions` — once the token reaches `queue_position <= ALMOST_TURN_POSITION`
(= 2), i.e. **with one patient still ahead**. `<=` rather than `==` because a
token can jump from 5th to 1st when the people ahead cancel, and skipping the
alert entirely is worse than sending it one place late.

**One-shot without a migration.** Unlike the leave-by alert (which has its own
`tokens.notified_leave` column), this one asks the notification log: "is there
already an `almost_turn` row for this token?" The row is written in the same
transaction as the send, so a repeated `recompute_positions` — and there are ten
call sites — sees it and stays quiet. No schema change, so nothing to run on the
QA database.

Note `{{3}}` is legitimately `0` at the front of the queue, and `"0"` is a value
that has to survive: `str(value or "")` would collapse it to blank and Meta
rejects a blank parameter, so the count is stringified before it reaches
`clean_param`.

---

## 5. `consultation_complete` — approved, wired 14 Aug 2026

| Field | Value |
| --- | --- |
| Template name | `consultation_complete` (env `WHATSAPP_CONSULTATION_COMPLETE_TEMPLATE`) |
| Type | TEXT |
| Header | `Consultation Completed!` |

**Body** (6 parameters, in this order)

```
Hello *{{1}}*, your consultation has been completed successfully.

📅 Visit Date: {{2}}
🕥 Consultation Time: {{3}}
👨‍⚕️ Doctor: Dr. {{4}}
🏥 Hospital: {{5}}
🎟 Token No: {{6}}
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Patient's first name (the dependent's, when the token was for one) | `family_member.name` or `patient.name` | `Ramesh` |
| `{{2}}` | Visit date | `token.token_date` | `14 Aug 2026` |
| `{{3}}` | Time they were seen, **clinic-local** | `token.actual_start`, else `actual_end` | `3:23 PM` |
| `{{4}}` | Doctor's name, **no honorific** | `doctor.name` | `Rahul Sharma` |
| `{{5}}` | Hospital / practice | affiliation name, else hospital name | `CityCare Clinic` |
| `{{6}}` | Token code | `token.display_code` | `A-014` |

**When it fires:** `token_engine.maybe_send_consultation_complete`, called from
**`finish_serving`** — which is the single funnel every completion passes
through, both the front desk's explicit "complete" and the implicit completion
inside call-next. Hooking the funnel rather than the two endpoints is what keeps
call-next from silently skipping the message.

`{{3}}` uses `actual_start` — when the patient was actually seen — and falls back
to `actual_end` because a token completed without ever being started has no start
time. One-shot via the same notification-log lookup as the almost-turn alert
(`type='consult_done'`), so a repeated completion can't double-send.

**Worth knowing:** the copy promises "your prescription and visit summary are now
available". The doctor can write the prescription *after* marking the
consultation done — the Rx composer is reachable from the "just finished" prompt
on the doctor dashboard — so a patient who opens the app the second this arrives
may find no prescription yet. If that gap matters, the send should move to
prescription-save instead of completion.

---

## 6. `doctor_registration_received` — approved, wired 14 Aug 2026

| Field | Value |
| --- | --- |
| Template name | `doctor_registration_received` (env `WHATSAPP_DOCTOR_REGISTRATION_TEMPLATE`) |
| Type | TEXT |
| Header | `Registration Received!` |

**Body** (5 parameters, in this order)

```
Hello Dr. *{{1}}*, we have successfully received your TapCure registration.

🔢 Registration No: {{2}}
🏥 Hospital: {{3}}
📍 Location: {{4}}
📅 Submitted On: {{5}}
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Doctor's **full** name, no honorific — the copy says "Dr." | `doctor.name` | `Rahul Sharma` |
| `{{2}}` | Medical council registration number, echoed back | `doctor.registration_number` | `TSMC/45821` |
| `{{3}}` | Practice name from the signup form | affiliation `name` (`clinic_name`) | `Sharma Clinic` |
| `{{4}}` | Practice address | `location_text(address, city)` | `MG Road, Vizag` |
| `{{5}}` | Submission date | `utcnow()` at registration | `14 Aug 2026` |

**When it fires:** `routers/auth.py::_send_doctor_registration_ack`, at the end of
`POST /register-doctor` (public solo-doctor onboarding) — **before the commit**,
so the message and the application are one transaction. A message promising to
review an application that failed to save would be worse than silence.

**The only doctor-facing template.** It carries `recipient_user_id`, which files
it under the `staff` audience — without that, `_default_audience` would file a
doctor's paperwork as `clinic` and put it in front of the front desk.

**Two judgement calls worth revisiting:**

- **`{{2}}` is the medical council number, not a TapCure reference.** There is no
  application reference for doctors — `ClinicSignup.jsx` shows one for clinics
  (`TC-CL-00042`), but `DoctorSignup.jsx` shows nothing. Echoing the number the
  doctor typed lets them catch a typo, which is a common cause of rejection at
  verification. If you'd rather send a TapCure reference, it has to be shown on
  the signup success screen too, or the doctor can't cross-check it.
- **`{{3}}` is the practice, not the anchor hospital.** A self-registered doctor
  is attached to the default tenant for technical reasons (`_default_hospital_id`);
  sending *that* name would show them a hospital they've never heard of. The
  personal-practice affiliation is the real answer.

---

## 7. `doctor_daily_bookings` — approved, wired 14 Aug 2026

| Field | Value |
| --- | --- |
| Template name | `doctor_daily_bookings` (env `WHATSAPP_DOCTOR_DAILY_TEMPLATE`) |
| Type | TEXT |
| Header | `Today's Appointment Schedule` |

**Body** (7 parameters, in this order)

```
Good morning Dr. *{{1}}*.

You have *{{2}} appointment(s)* scheduled for today.

📅 Date: {{3}}
🕥 First Appointment: {{4}}
🕥 Last Appointment: {{5}}
🏥 Hospital: {{6}}
📍 Location: {{7}}
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Doctor's name, no honorific | `doctor.name` | `Rahul Sharma` |
| `{{2}}` | Live appointments today at this venue | count of the group | `12` |
| `{{3}}` | Date | the run date | `29 Jul 2026` |
| `{{4}}` | Earliest slot, else session start | `min(slot_time)` | `9:00 AM` |
| `{{5}}` | Latest slot, else session end | `max(slot_time)` | `1:30 PM` |
| `{{6}}` | Hospital / practice | affiliation name, else hospital | `CityCare Hospital` |
| `{{7}}` | Address | `location_text(address, city)` | `MG Road, Vizag` |

### This is the only message with no human trigger

Every other template rides on something someone just did — a booking, a queue
advance, a completed consultation. "Good morning, here is your day" has to come
from a clock, and TapCure had nothing running on one. `services/doctor_digest.py`
is that piece, and it's built so the caller can be dumb:

- **It decides whether it's time.** Clinics carry their own timezone, so 8 AM is
  8 AM *there* (`DOCTOR_DIGEST_HOUR`, clinic-local). Run the job hourly and each
  clinic's doctors are messaged as their own morning arrives.
- **It is idempotent per doctor per day**, guarded on the notification log
  (`type='doctor_daily'`), not a flag column. Overlapping runs, a restarted
  ticker and a manual re-run all converge on exactly one message. A doctor who
  gets their schedule twice stops trusting the schedule.

Because of those two properties, running it too often is harmless and running it
late still works. Three ways in, all the same function:

```bash
python -m app.jobs.doctor_digest            # cron / systemd timer — hourly is fine
python -m app.jobs.doctor_digest --force    # the 8 AM run was missed; send now
```

`app/jobs/doctor_digest.py` also exposes `handler()` for an EventBridge Lambda,
and `DOCTOR_DIGEST_TICKER_ENABLED=true` runs it in-process from the FastAPI
lifespan. **Off by default**, exactly like the medicine ticker: on more than one
API instance every instance would tick. Safe, but wasteful — prefer the job.

`--force` skips only the clock check, never the once-per-day guard, so it cannot
double-send.

### Grouping and edge cases

One message **per doctor per venue**: a doctor consulting at two clinics today
gets two messages, because the template names a single hospital and merging them
would report the wrong first/last time for both.

- Cancelled / no-show / rejected appointments are excluded from `{{2}}`.
- A doctor with **no login account has no phone anywhere** (it lives on
  `users.phone` via `doctors.user_id`) — counted as `skipped_no_phone` and
  silently unreachable. Clinic-created doctors are the usual case.
- Token-mode days have no `slot_time` at all, so `{{4}}`/`{{5}}` fall back to the
  doctor's published session start and end. A doctor whose session is stored as
  00:00–23:58 will read "First Appointment: 12:00 AM" — truthful, but a sign the
  schedule needs fixing rather than the message.
- `{{2}}` is a count that must survive as the string `"0"`; blank kills the send.

---

## 8. `doctor_day_complete` — approved, wired 14 Aug 2026

| Field | Value |
| --- | --- |
| Template name | `doctor_day_complete` (env `WHATSAPP_DOCTOR_DAY_COMPLETE_TEMPLATE`) |
| Type | TEXT |
| Header | `All Appointments Completed!` |

**Body** (6 parameters, in this order)

```
Well done, Dr. *{{1}}*! You have completed all scheduled consultations for today.

📅 Date: {{2}}
👥 Appointments Scheduled: {{3}}
✅ Consultations Completed: {{4}}
🚫 Cancelled/No-show: {{5}}
🏥 Hospital: {{6}}
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Doctor's name, no honorific | `doctor.name` | `Rahul Sharma` |
| `{{2}}` | Date | `token.token_date` | `29 Jul 2026` |
| `{{3}}` | Appointments booked for the day | all appointments, doctor + date + venue | `12` |
| `{{4}}` | Completed | `status == 'completed'` | `10` |
| `{{5}}` | Cancelled / no-show | `status in (cancelled, no_show, rejected)` | `2` |
| `{{6}}` | Hospital / practice | affiliation name, else hospital | `CityCare Hospital` |

**When it fires:** `token_engine.maybe_send_day_complete`, from `finish_serving` —
the completion that **empties the queue**. "Empty" means no token still `waiting`
or `current` for that doctor, date and venue; tokens that ended `missed` or
`cancelled` are finished with, so a day whose tail was no-shows still closes.

This one is **event-driven, not clock-driven** — the doctor completing their last
patient *is* the event, so it needs none of the digest's scheduling machinery.
The trade-off: if a doctor's final patient never shows and no consultation is
completed after that, no event ever fires and the wrap-up doesn't send. Catching
that would mean polling, which is what the morning digest exists for; adding a
second clock here would buy little.

**All three counts come from `appointments`, not a mix.** Appointment status
mirrors the token's terminal state via `_TOKEN_TO_APPT_STATUS`, so one source
keeps `{{3}}`, `{{4}}` and `{{5}}` consistent with each other — counting
completions from tokens and cancellations from appointments would eventually
produce a message whose numbers don't add up.

Guarded once-per-doctor-per-day by `notifications.sent_today(..., 'doctor_day')`,
the same helper the morning digest uses. Requires `{{4}} > 0`: a day with nothing
completed is not a day to congratulate anyone for.

---

## 9. `otp_04` — already approved, provider-supplied

One body parameter (the code) plus the same code on a URL button. Sent by
`routers/auth.py` via `whatsapp_client.send_otp`. Language `en_US`, not `en` —
that's the provider's own template, so its language code differs from ours.

---

## 10. `prescription_ready` — approved, live from 22 Sep 2026

**The name has no `tapcure_` prefix.** This section said `tapcure_prescription_ready`
until 22 Sep 2026, and four sends were refused under that spelling — HTTP 200,
no message id, nothing delivered, no error anyone saw. The approved template is
named bare, like every other template that works in this account. If a send here
ever fails with `no_message_id` again, check the name against the provider
portal before changing anything in the code.

| Field | Value |
| --- | --- |
| Template name | `prescription_ready` (env `WHATSAPP_PRESCRIPTION_READY_TEMPLATE`) |
| Category | **Utility** |
| Language | English (`en`) — must match `WHATSAPP_DEFAULT_LANG` |
| Header | `Prescription Ready!` |
| Footer | `TapCure` |
| Buttons | *(none)* |

**Body** (5 parameters, in this order)

```
Hello {{1}}, 💙
{{2}} prescription from Dr. {{3}} is ready.

💊 Medicines: {{4}}
📅 Visit Date: {{5}}

Full details, timings and reminders are in the TapCure app. 🌿
Take care, and we're here when you need us. 💙
— Team TapCure
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | First name of whoever's **phone** this goes to | `reminder_recipient()` | `Satya` |
| `{{2}}` | Whose prescription — `Your`, or the patient's name in possessive | `greeting_for()`, capitalised | `Raju's` |
| `{{3}}` | Doctor's name, **no honorific** — the copy says "Dr." | `doctor.name` | `Rahul Sharma` |
| `{{4}}` | Medicines, comma-joined, dose in brackets | `medicine_summary(rx.items)` | `Dolo 650 (1 tablet), Pan-D` |
| `{{5}}` | Visit date | `token.token_date`, else `rx.created_at` | `19 Sep 2026` |

```
{{1}} = Satya
{{2}} = Raju's
{{3}} = Rahul Sharma
{{4}} = Dolo 650 (1 tablet), Amoxicillin 500mg, Pan-D
{{5}} = 19 Sep 2026
```

**`{{2}}` is capitalised, unlike the same possessive in the reminder template.**
It opens a sentence here and sits mid-sentence there, so the builder upper-cases
the first letter. Sending the reminder's lower-case form would start a line with
"your prescription".

**`{{4}}` drops whole medicines rather than cutting characters.** A parameter may
not contain a newline, so the list cannot break across lines the way it does on
screen, and the length is capped. Past ~200 characters the remainder becomes a
count — `Dolo 650, Amoxicillin 500mg, Pan-D, +4 more` — because a silent
truncation would leave the patient believing they had seen the whole list.

### When it fires: once the doctor has moved on

Two facts must both be true before the patient is told: the prescription is
written, and the consultation is marked complete. They arrive in either order —
some doctors write the Rx then press complete, others press complete and write
the Rx afterwards from the "just finished" prompt.

But "both are true" is not enough to send, because it is not yet final.
`POST /prescriptions/{id}/items` deliberately lets a doctor append to the same
prescription for 12 hours (§`APPEND_WINDOW_HOURS`). Sending the moment both
facts held would fire a medicine list that a later append silently invalidates,
and the patient would never hear about the added tablet.

So the message waits for the doctor to be **demonstrably finished** with that
patient. `services/visit_wrapup.py` holds the rule:

| Event | Sends |
| --- | --- |
| `on_prescription_saved` (Rx written or appended) | only if the visit is `completed` **and** the doctor's queue is empty |
| `on_consultation_complete` (visit finished) | only if an Rx exists **and** the doctor's queue is empty |
| `flush_previous` (doctor calls next patient) | whatever is still unwrapped — the normal path |

The queue check (`_doctor_still_busy`) is scoped to doctor + date + venue and
counts only `waiting`/`current`, matching the test documented on
`token_engine._legacy_send_day_complete_unused`. It is written out rather than
reused because `maybe_send_day_complete` is **retired** and returns `False`
without looking at anything.

**This needs no cron and no ticker**, which is the point: nothing is scheduled in
this deployment (`reminder_ticker_enabled` and `doctor_digest_ticker_enabled`
both default to `False`), and a design resting on a job nobody runs would deliver
silence — the failure mode in §2.

A consultation that never gets a prescription would otherwise wait forever, so
the doctor calling their **next patient** is taken as the signal to stop waiting;
that visit gets the plain `consultation_complete` message (§5) instead. This
changed §5's trigger: it no longer fires unconditionally at completion.

### Falls back to `consultation_complete` when the send fails

A template that is not approved yet — or has been renamed, rejected, or approved
under a different language code — fails at the provider with nobody told. Since
`finish_serving` no longer sends `consultation_complete` unconditionally, that
would leave every patient **with** a prescription hearing nothing at all, which
is strictly worse than the behaviour it replaced.

So `_send_rx_ready` checks `n.status` (the same check `reminder_engine._send`
makes) and, on failure, sends the approved `consultation_complete` instead. The
provider's error code is logged at WARNING with the prescription id. Once this
template is approved the branch stops being reached; until then the patient gets
the plainer message rather than silence.

A prescription with no booked visit has no `consultation_complete` to fall back
to, so it returns without sending.

**One-shot per visit**, guarded on the notification log by `token_id` **or**
`appointment_id` — matched on either because the two senders file their rows
differently (§5 records a token and no appointment; this one records both), and
checking a single key would let one sender's row hide from the other and send
the patient two messages. A prescription with neither — written outside a booked
visit, so `appointment_id` is NULL — falls back to patient-and-day.

**Two gaps, accepted deliberately**, both confined to the LAST patient in a
queue, where no "next patient" signal is ever coming:

- With **no prescription**, the plain acknowledgement never fires. Nothing was
  prescribed, so it is the mildest thing to lose.
- With **a prescription**, the message goes at completion — there is nobody left
  to wait for — so a tablet appended after that is not in it. This is the
  staleness the design prevents everywhere else, reduced from every patient to
  one per queue.

Closing either needs a cron or a sweep on a polled endpoint.

---

## 11. `appointment_cancelled` — NEEDS APPROVAL (7 sends, 7 failures)

| Field | Value |
| --- | --- |
| Template name | `tapcure_appointment_cancelled` (env `WHATSAPP_APPOINTMENT_CANCELLED_TEMPLATE`) |
| Category | **Utility** |
| Language | English (`en`) |
| Header | `Appointment Cancelled` |
| Footer | `TapCure` |
| Buttons | *(none)* |

**Body** (5 parameters, in this order)

```
Hello *{{1}}*, 💙
We're so sorry — your appointment has been cancelled.

🎟 Token / Ref: {{2}}
👨‍⚕️ Doctor: Dr. {{3}}
📅 Visit Date: {{4}}

⚠️ {{5}}

Please don't set out for this visit — we'd hate for you to make the journey
for nothing. 🌿
Booking another day, or another doctor, takes just a moment in the TapCure app.
We're here whenever you need us. 💙
— Team TapCure
```

**On the tone.** Warm, but deliberately not cheerful: this is bad news, and some
of these reach patients who planned an overnight journey around the visit. The
softness sits in the apology and the closing line, never in the fact itself —
"Please don't set out" stays plain, because that is the sentence the message
exists to deliver. Matches the house style of §1 (`Hello {name}, 💙` … `🌿` …
`💙 — Team TapCure`) without borrowing its optimism.

Category stays **Utility**. Meta checks that the wording matches the category;
friendly is fine, anything reading like marketing risks reclassification — which
costs both the approval and a higher per-message rate.

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Name the visit was booked under — **full name** | `family_member.name` or `patient.name` | `Ramesh Kumar` |
| `{{2}}` | Token code, or the appointment id when no token was issued | `token.display_code` | `OH-014` |
| `{{3}}` | Doctor, **no honorific** — the copy says "Dr." | `doctor.name` | `Rahul Sharma` |
| `{{4}}` | Visit date | `appointment.appointment_date` | `22 Sep 2026` |
| `{{5}}` | Why, in one sentence | fixed copy at the call site | `Doctor unexpectedly unavailable. Please do not travel; book another day or doctor.` |

**Sample values for the approval form**

```
{{1}} = Ramesh Kumar
{{2}} = OH-014
{{3}} = Rahul Sharma
{{4}} = 22 Sep 2026
{{5}} = Doctor unexpectedly unavailable. Please do not travel; book another day or doctor.
```

**When it fires:** `services/session_cancellation.py::_notify`, from
`cancel_and_notify` when a doctor's session is cancelled and the day's
appointments are dropped. One message per affected appointment. The in-app
notification is sent first and unconditionally — it always lands, even for a
walk-in with no phone on file.

### Why this one never worked

`whatsapp_logs` shows **7 attempts, 7 failures, all `no_message_id`** — Meta
refusing the send, which is the signature of a template name that does not exist
in the account (§2 has the full history of this trap costing 61 booking
confirmations). It was also the ONLY template whose parameters were assembled by
hand at the call site instead of through a `*_params` builder, so it had none of
the `clean_param` guards: no blank check, no whitespace collapsing, no length
caps. Both are fixed — the builder is `appointment_cancelled_params` — but the
**name must still be confirmed or newly approved at the provider**.

Of every message here this is the worst one to lose: its entire purpose is to
stop a patient travelling to a clinic where no doctor will be present.

---

## 12. `tapcure_pilot_reminder` — NEW 10 Nov 2026, NEEDS APPROVAL

| Field | Value |
| --- | --- |
| Template name | `tapcure_pilot_reminder` (env `WHATSAPP_PILOT_REMINDER_TEMPLATE`, **empty by default = not sent**) |
| Category | UTILITY |
| Type | TEXT |
| Header | `Free trial reminder` |

**Body** (3 parameters, in this order)

```
Hello {{1}}, your TapCure free trial for *{{2}}* {{3}}.

Open Plan & Bookings in your TapCure console to choose a plan so patients can keep booking online. Your data stays safe either way.
```

| # | Meaning | Built from | Example |
| --- | --- | --- | --- |
| `{{1}}` | Hospital admin's name | `users.name` (fallback `there`) | `Satya Sai` |
| `{{2}}` | Hospital name | `hospitals.name` | `satya sai` |
| `{{3}}` | Status | days left / end date | `ends in 7 days (10 December)` · `ends tomorrow (10 December)` · `ends today (10 December)` · `ended on 10 December. Online bookings are paused, walk-ins still work` |

**When it fires:** `booking_quota.pilot_reminders` — together with the in-app
pop-up/bell notice, once per notice (7, 3, 1, 0 days left, ended). To every
active hospital admin with a phone; if none has one, the hospital's phone.
Not affected by the plan's WhatsApp switch (it's about the plan itself).

**To switch on:** submit the copy above at Dovesoft, wait for approval, then set
`WHATSAPP_PILOT_REMINDER_TEMPLATE=tapcure_pilot_reminder` in the backend `.env`
and restart. Until then only the in-app notice goes.

---

## Sending: what has to be true

1. `WHATSAPP_ENABLED=true` with the Dovesoft URL, key and WABA number set —
   otherwise everything is logged to the DB in mock mode and nothing leaves.
2. The template is **approved** at the provider under exactly the name in
   `WHATSAPP_MEDICINE_REMINDER_TEMPLATE`.
3. Per clinic, `hospital_settings.whatsapp_enabled` is on — that's the switch
   the reminder engine reads to choose WhatsApp over SMS.
4. On the SQS transport (`WHATSAPP_TRANSPORT=sqs`) the **Lambda sender must
   handle `event_type: "medicine_reminder"`**. Its payload is:

   ```json
   {
     "event_id": "medicine_reminder-1234",
     "event_type": "medicine_reminder",
     "channel": "whatsapp",
     "recipient_phone": "91XXXXXXXXXX",
     "payload": {
       "recipient_name": "Ramesh",
       "medicine": "Dolo 650 (1 tablet)",
       "instruction": "Please take it after food.",
       "template_name": "tapcure_medicine_reminder"
     }
   }
   ```

   `template_name` is included so the worker doesn't need a release per template.
   Until the Lambda handles this event type, run the reminder path on
   `WHATSAPP_TRANSPORT=direct`.

## Opt-out

Not built. Meta requires an opt-out path for Utility templates in practice, and
a patient who replies STOP today is not recorded anywhere — the courses keep
sending. Worth closing before this goes to real patients at volume.
