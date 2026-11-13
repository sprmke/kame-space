---
title: 'Guest journey — manual script'
status: active
tags: [testing, manual, guest, booking]
updated: 2026-11-11
---

# Guest journey — manual script

One booking walked through every status, at **375px and 1024px**, with a real inbox. Mocked
E2E covers the shapes; this script covers the things only a real inbox and a real clock show:
the email actually arriving, the stay guide opening the day it is sent, and the door code
appearing at the reveal time.

Plan: `docs/workflow/done/guest-post-booking-journey.md` (shipped).

## Setup

```bash
./dev.sh                     # local Supabase + UI
bun run seed:local           # kame-homes / kame-home / monaco-level-2-slot-27
```

- **Inbox:** Mailpit at http://127.0.0.1:54324. Every guest email lands there.
- **Host:** `/org/kame-homes/property/kame-home`.
- **Guest:** use a real address you can read in Mailpit, e.g. `guest-manual@example.com`.

Before starting, fill in **Property Settings → Guest experience** (Wi-Fi name, password, door
code, unit, a contact, reveal lead 24h) and mark one custom template **Show to guests → always**.

## 1. Submit

1. Open `/properties/kame-home`. Reserve two nights about **5 days out** (so the reveal time is
   in the future).
2. Submit the form.
3. **Expect:** you land on `/properties/kame-home/trip` with a **Request sent** banner naming
   your email and a review expectation. No "Booking Confirmed!" anywhere.
4. **Expect in Mailpit:** "Booking Request Received" within a minute, with a **View your booking**
   button.
5. Tap **Edit request** → the form reopens with the booking loaded. Change nothing and submit:
   no second receipt email.

## 2. Host confirms

1. As the host, open the booking and the **Guest view** card. **Expect:** status "Request sent",
   "Waiting for your review".
2. Move the booking to Pending Documents.
3. **Expect in Mailpit:** a Booking Acknowledgement whose "What's next" steps name **only** the
   documents this property requires. With no document requirements configured, it must not
   mention the GAF or a building administration.
4. **Expect on the trip:** the status word is **Confirmed** (never "Approved").

## 3. Essentials and reveal

1. Reload the trip page. **Expect:** an **Essentials** card with the Wi-Fi **name**, unit,
   parking, and the contacts.
2. **Expect:** the door code shows **"Available {date, time}"**, not the code.
3. Repeat in the stay guide (open it from the ready email): the door code is hidden there too.
4. Move the booking to Ready for Check-in.
5. **Expect in Mailpit:** the check-in details email. **Tap its trip button and its stay guide
   button the same day** — both must open. The stay guide must not say "not available".
6. Set the reveal lead to 0 in Guest experience, reload the trip page: the door code appears.

## 4. Balance and receipt

1. As the host, set a booking rate with a balance due.
2. **Expect on the trip:** the Payment section shows the amount and a **Send receipt** button.
3. From the phone, attach a photo of a receipt and send.
4. **Expect:** a success toast, and the host's bell shows **Balance receipt received**.
5. **Expect:** the booking status did **not** change.
6. Open the host dashboard's booking: the receipt image is there.

## 5. Messaging

1. From the trip page tap **Message host**.
2. **Expect:** the chat opens with the stay in the header ("{dates} · {status} · View trip") and
   **no date picker**.
3. **Expect:** the resource strip offers Trip · Stay guide · House rules · Check-in steps, and
   **not** the booking form.
4. Reply as the host. **Expect in Mailpit:** a "New message" email whose button opens the same
   thread.

## 6. Stay and check-out

1. Move the booking to Ready for Checkout.
2. **Expect in Mailpit:** the check-out and deposit refund email, with a trip button.
3. **Expect on the trip:** check-out steps inline, and a **Deposit refund** status word once the
   host moves it on.

## 7. Pre-arrival reminder

1. Create a booking with `check_in_date` exactly **two Manila days out** (SQL or the seed
   helper), in `READY_FOR_CHECKIN`, with no `pre_arrival_emailed_at`.
2. Trigger the cron locally:
   `curl -X POST $SUPABASE_URL/functions/v1/pre-arrival-reminders -H "x-pre-arrival-reminder-cron-secret: $PRE_ARRIVAL_REMINDER_CRON_SECRET" -d '{}'`
3. **Expect:** one email, with the trip button. Run it again: **no second email**.
4. Turn off **Ready for check-in** in Notifications and repeat: no email.

## 8. Host readiness

1. Clear the essentials and remove every payment method.
2. **Expect:** Property Settings → Guest experience shows **2 things missing** with a Fix action
   for each.
3. Fill them in. **Expect:** the headline says everything is filled in.

## 9. Viewports

Repeat steps 1, 3 and 5 at **375px**. No horizontal scroll, sheets open as bottom sheets, and
the first screen shows status, the next action, and (on arrival day) the essentials.
