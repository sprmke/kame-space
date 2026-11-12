---
title: 'Guest trip page (one booking) — operator guide'
status: active
tags: [guides, routes, guest, booking]
updated: 2026-11-10
---

# Guest trip page — operator guide

Route: `/properties/:propertySlug/trip?bookingId=<uuid>` (email links add `&access=<token>`; a
submission redirects here with `&welcome=1`)

> **Status:** Documented. Plan: [`guest-post-booking-journey.md`](../../workflow/done/guest-post-booking-journey.md)

## Progress overview

| Section             | E2E save | Validation | Docs       | Notes                                           |
| ------------------- | -------- | ---------- | ---------- | ----------------------------------------------- |
| Access gate         | —        | —          | Documented | Token or signed-in owner; never bare booking id |
| Request sent banner | ✅       | —          | Documented | First view after a submission (`?welcome=1`)    |
| Hero + progress     | —        | —          | Documented | Status, timing, 5-step progress, next action    |
| Timeline            | —        | —          | Documented | Dated upcoming moments, phase-filtered          |
| Essentials          | —        | —          | Documented | Wi-Fi, door code, unit, contacts; secrets gated |
| Getting in          | —        | —          | Documented | Inline check-in / check-out steps, every plan   |
| From your host      | —        | —          | Documented | Guest-visible custom templates, collapsed       |
| Stay / docs / pay   | ✅       | —          | Documented | Receipt upload lives in Payment                 |
| Host / cancellation | —        | —          | Documented | Contact + listing cancellation policy           |
| Entry points        | —        | —          | Documented | Submission, Trips tab, emails, SD form, review  |

---

## Overview

One page per **property** booking that pulls together everything a guest needs after they book:
status and progress, the next thing to do, stay details, check-in documents, parking, payment and
deposit refund, the host's contact details, the stay guide, the cancellation policy, review and
voucher, and help. It replaces hunting through separate emails for each link.

A new submission lands **here**, not on a separate confirmation page. The trip page shows a
dismissible **Request sent** banner with the reference, what happens next and how long a wait to
expect (plan §3.2, decision D1).

It renders inside the property operational shell (`MainLayout`, Property / Calendar / Messages
bottom tabs on phone) like `/success`, `/sd-form` and `/guest-review`.

---

> **Legal notice:** Cancellation refund details show the same refund privacy line above Save, unless cash pickup is chosen. Pattern and full list: [legal.md](legal.md#in-app-notices).

## Guest status words

One vocabulary across the trip page, the account list, the emails, the chat card and the host
dashboard. The words come from `ui/src/features/guest/trip/lib/guestJourneyCopy.ts`, mirrored in
`supabase/functions/_shared/guestJourneyCopy.ts`, and asserted equal by
`guestJourneyCopyParity.test.ts`.

| Booking status                                             | Guest word         |
| ---------------------------------------------------------- | ------------------ |
| `PENDING_REVIEW`                                           | Request sent       |
| `PENDING_DOCUMENTS` (and legacy `PENDING_GAF/PARKING/PET`) | Confirmed          |
| `READY_FOR_CHECKIN`                                        | Ready for check-in |
| `READY_FOR_CHECKOUT`                                       | Checked out        |
| `PENDING_SD_REFUND`                                        | Deposit refund     |
| `COMPLETED`                                                | Completed          |
| `CANCELLED`                                                | Cancelled          |
| `CANCELLED` with reason `request_expired`                  | Request expired    |

A pending review is never "confirmed", "approved" or "booked". A confirmed booking is never
"approved" as a status word. A request the expiry cron cancelled is never "Cancelled": the guest
did not choose it, so `guestJourneyStatusWord(status, cancellationReasonCode)` returns **Request
expired**, mirrored on the edge and UI sides and parity tested.

---

## Host-facing knowledge

After booking, your guest gets one page for their trip. It shows where the booking is (request
sent, confirmed, ready for check-in, checked out, completed), the next step for them, their stay
details, approved documents, what they've paid and still owe, your contact details and the
cancellation policy from your listing. When the booking is ready for check-in, the stay guide
button appears there too.

**Common host questions**

- Q: How does the guest get to it?
  A: Every submission lands there directly. After that, the **Trips** tab in their account, the
  "Request received" email, and back links on the deposit refund and review pages. You can also
  add `{{trip_url}}` to any of your guest email templates.
- Q: Can anyone with the link see the booking?
  A: No. Email links carry a private access key. Without it, the guest has to sign in with the
  email they booked with.
- Q: What does the guest see while you review the request?
  A: A **Request sent** banner with the review expectation, plus **Edit request**, **Cancel
  booking** (or **Request to cancel**) and **Message host**. They never see "confirmed" until you
  move the booking on.
- Q: Can a guest cancel from this page?
  A: Yes, when your policy allows it. While only the down payment is paid, the guest sees **Cancel
  booking**. Once the balance is paid, or when the policy is unset or migrated free text, they see
  **Request to cancel**. The guest sees the exact refund before confirming, calculated from what
  they have actually paid (down payment plus any settled balance), not the full stay value. You
  still approve or decline requests, and send the refund, from the booking in your dashboard.
- Q: Why doesn't my guest see the stay guide button?
  A: It only shows from ready-for-check-in during the stay window, and only on Pro or above (same
  rule as the stay guide link itself).

---

## Request sent banner

Shown on the first view after a submission (`?welcome=1`) while the booking is still
`PENDING_REVIEW`.

| Field              | Source                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Body               | "A receipt is on its way to {email}. {review expectation}."                                                                   |
| Email              | `stay.email` from the trip payload                                                                                            |
| Review expectation | The property's median first-response time when it has at least 5 answered requests, otherwise "Most hosts reply within a day" |

The banner carries only what the Now card below cannot. It used to repeat "Request sent" as a
second headline directly above the Now card that already says it, which read as a stutter; the
status word now appears once.

The banner is dismissible. It is a live region, so a screen reader announces it.

---

## Arrival content

Everything a guest needs on the day, on every plan (plan D6). The designed Stay Guide brochure
stays Pro+; the operational content does not.

### Section order

Phone, top to bottom:

1. **First-view banner** (only after a submission) - where the receipt went and how long a
   reply usually takes. It is above the grid so it is the first thing on a phone.
2. Stay header, **Now card** (status, progress, next action), shortcuts.
3. **What happens next** (dated timeline).
4. **Essentials**, then **Check-in steps**, then **From your host**.
5. **Payment**, then **Cancellation**.
6. **Getting there**, **Host**, **Details**.

Arrival content sits above money on purpose: a guest arriving today must reach the door code
without scrolling past payment.

**Arrival content waits for acceptance.** Essentials and the check-in steps render only once
the host has accepted (`PENDING_DOCUMENTS` onward). Hosts write door codes into the instruction
text, and a pending request is not yet a stay, so both follow the same gate. `PENDING_REVIEW`
shows the timeline, the next step and cancellation only.

### Essentials

Structured fields the host fills in Property Settings -> Guest experience, stored in
`property_guest_essentials` and never in `properties.settings` (a public listing read returns
`settings`, so a Wi-Fi password there would leak).

| Field                   | Reveal               |
| ----------------------- | -------------------- |
| Wi-Fi name              | Always               |
| Wi-Fi password          | From `revealAt`      |
| Door code               | From `revealAt`      |
| Unit / floor            | Always               |
| Parking slot note       | Always               |
| Emergency contact       | Always (tap to call) |
| Building security phone | Always (tap to call) |
| Garbage / quiet hours   | Always               |

`revealAt` is the property's check-in moment minus `reveal_lead_hours` (default 24, clamped
0-720). Before then the server sends `null` for the secrets and only the timestamp, and the page
renders "Available {date, time}". A per-booking override
(`guest_submissions.guest_essentials_override`) wins over the property default, for a rotating
lock code.

### Getting in

`check-in-instructions` and `check-out-instructions` rendered inline, with the same placeholder
pipeline as email. Check-out only appears from the stay onwards. A property with no template
content shows nothing.

### From your host

Custom templates marked **Show to guests** in the Templates workbench, filtered by
`guest_phase` (`before / arrival / stay / checkout / after / always`). Collapsed by default.
The plan gate for authoring is `customTemplates`; guest rendering follows `guestArrivalContent`.

### Balance receipt

**Send receipt** in Payment is offered whenever the guest owes money, whether or not the host has
configured payment methods: a guest may have paid by a transfer the host described in chat, and
sending proof should never require the chat. Without methods the section also shows **Ask your
host how to pay**.

The button opens a bottom sheet, accepts a photo or PDF up to 10 MB and posts to
`guest-trip-payment-receipt`. It writes `guest_balance_payment_receipt_url` (the column the
host dashboard already reads), runs the existing AI receipt check non-blocking, notifies the
host, and **never changes the booking status**.

---

## Cancellation

The trip page shows a **Cancellation** card below Payment.

**With nothing paid** (always true while the host reviews) the card is a plain "Need to cancel? /
Nothing has been charged yet, so cancelling costs nothing" with one **Cancel request** button.
Refund percentages and amounts are noise when there is no money to return, so they appear only
once the guest has paid something. It reads the booking's
`cancellation_policy_snapshot` (never the property's live policy), so changing your policy later
does not change what an existing guest sees.

| Booking state                         | What the guest sees                                                                                                                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before check-in, down payment only    | Policy timeline, next deadline, refund now, **Cancel booking**                                                                                                                                        |
| Before check-in, policy unset/custom  | Same, with **Request to cancel**                                                                                                                                                                      |
| Balance already paid                  | Same, with **Request to cancel**                                                                                                                                                                      |
| Open request                          | "Cancellation requested", requested time, host message, **Withdraw**                                                                                                                                  |
| `CANCELLED` with a refund             | Refund amount + status; payout details form when still needed                                                                                                                                         |
| `CANCELLED` with no refund due        | "This booking was cancelled"                                                                                                                                                                          |
| `CANCELLED`, reason `request_expired` | No cancellation section (there is nothing to cancel and nothing paid). The Now card carries it: primary **Request these dates again** (same dates, pre-filled in `/form`), secondary **Message host** |
| After check-in                        | No cancel action; policy summary only                                                                                                                                                                 |

Flow: `GuestTripCancellationSection` → `guest-cancel-booking` (instant) or
`guest-cancellation-request` (create/withdraw). The server recomputes the refund from the snapshot
and the recorded payments; the client never sends an amount. **The percentage applies to what the
guest has actually paid**, not the full stay value. Once the balance is settled, the guest must
request instead of self-cancelling. Refund payout details go through
`submit-guest-refund-details` and are stored on `booking_refunds` (not the SD refund columns).

Edge cases: `409 policy_changed` refreshes the trip; a direct API call after check-in is rejected;
OTA/calendar-synced bookings show "handled on the channel" and cannot self-cancel; an open request
expires at check-in.

---

## Access

| Caller                                        | Result                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------- |
| `?access=` HMAC token for this booking        | Allowed (no session needed)                                             |
| Signed-in guest, `guest_user_id` matches      | Allowed; response includes a fresh `accessToken` for SD / review / edit |
| Signed-in guest, booking unlinked, same email | Allowed; booking is linked to the guest (`guest_user_id`)               |
| Signed-in guest, someone else's booking       | 404 (same body as missing)                                              |
| No token, no session                          | 401 `sign_in_required` → page shows **Sign in** (resumes back here)     |
| Parking-only booking / no property            | 404                                                                     |

Unlike legacy readers (`get-form`, `get-sd-form`), a bare booking id is **never** enough here,
even while `GUEST_BOOKING_ACCESS_ENFORCE` is off.

`?access=` is moved into `sessionStorage` (`guest-booking-access:<bookingId>`, shared with the
form / SD form / review pages) and removed from the URL on load.

---

## Page behavior

One scroll, ordered by what the guest needs today (2026-10-05 redesign after an Impeccable
critique). Phone: everything stacks. Desktop (`lg+`, route widens the shell to `max-w-5xl`):
left column is sticky (header, Now card, shortcuts), right column holds the sections. No tabs:
money or documents due must never sit behind one. The bottom tab bar highlights nothing on
this route (it isn't one of the tabs).

All state comes from one model in `guestTripPhase.ts`, so the pill, progress bar, headline,
checklist and main button never disagree.

### Phase

- **Listing state:** the trip portal, documents, cancellation, refunds, and chat keep working when the
  listing is paused, suspended, or archived. The public listing link and stay guide depend on the
  listing, so a closed listing may show a "not taking new bookings" page or hide the listing action.

`guestTripPhase(status, Manila timing)`: `requested` (pending review) · `confirmed` (documents
stage) · `arriving` · `arrival_day` (check-in day, including night 1) · `staying` ·
`checkout_day` · `checked_out` · `refund_pending` · `completed` · `cancelled`.

### Header

Thumbnail, property name (`h1`, not a link), date range and nights, city.

### Now card (the one filled block)

| Part        | Content                                                                                                                                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pill        | Phase word with a colored dot (label stays in the foreground color so light host brand colors keep contrast)                                                                                                                                                                                                |
| Headline    | Phase sentence: "Your host is reviewing your booking", "Check-in in 6 days", "Check in from 2:00 PM", "Night 2 of 3", "Check out by 11:00 AM", "Get your deposit back", "Thanks for staying", "Cancelled on Sep 10", or "Your host did not reply in time" for an expired request                            |
| Progress    | 5 segments (Request sent · Confirmed · Check-in · Stay · Check-out) + "Step N of 5" caption; fills once on load, static under reduced motion; hidden when cancelled                                                                                                                                         |
| Checklist   | Active phases only, max 3: payment (left to pay / paid in full), check-in documents (hidden once in the unit), parking; each row jumps to its section                                                                                                                                                       |
| Main button | Blockers first: refund form → **Pay ₱X** (scrolls to Payment) → review → Book again (completed); arrival day → stay guide or directions; in stay → stay guide; before arrival → find parking; else **Message host** (always for pending review and cancelled)                                               |
| Review card | After check-out: open → Leave a review + days left; submitted → Review submitted + Edit; published → your snippet and the host's review when published. Closed windows show nothing. While the SD refund form is the call to action, the open state is hidden (that form starts with the same review step). |
| Voucher     | After the stay: next-stay voucher with copy                                                                                                                                                                                                                                                                 |

### Shortcuts (max 4, phase-picked, never repeat the main button)

Pending: Edit request, Call host, **Find parking** when the request asked for parking, View
listing. Confirmed / arriving: Add to calendar (`.ics`), Directions, Message host, Call host.
Arrival day / staying / check-out day: Stay guide, Directions, Message host, Call host. After the
stay and cancelled: none (host row and main button cover it).

**Find parking** restores a path the retired `/success` page used to own: it carried a "Need
parking?" link for a request that asked for parking, and a submission lands here now. It reads
`parking.findPath` from the trip payload, which is `/parkings?linkStay=<bookingId>` or the org's
own default form when one fits. The tile is omitted when the guest did not ask for parking.

Withdrawing a request is **not** a tile. The cancellation card below already carries the action
and explains that nothing has been charged, and two "Cancel request" controls on one screen read
as a mistake rather than a shortcut.

### Sections (flat, hairline separated; no nested cards)

| Section                                     | Shown when                               | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment (`#trip-payment`)                   | rates confirmed and any amount or refund | Before / during the stay: big "₱X left to pay" or "Paid in full". Ledger: Stay (or "Paid through Airbnb"), pet fee, extra fees, security deposit with status (Refundable after check-out / Send your refund details / Deposit refund / Refunded ₱X / Settled), Paid so far. **How to pay** (methods, copy number, QR) + "send your receipt to your host", or "Ask your host how to pay" with no methods. Cancelled: only what was paid |
| Getting there / Your stay (`#trip-arrival`) | pending review and active phases         | Address + Directions; check-in / check-out tiles; stay guide row; documents ("Guest access form (GAF)", "Pet approval", "Parking endorsement"; hidden while pending review; after check-out only approved); parking row; house rules (from the listing, check-in/out time rules removed, first 4 + All rules; hidden while pending review)                                                                                             |
| Your host                                   | always                                   | Avatar, name, icon buttons: message, call, email                                                                                                                                                                                                                                                                                                                                                                                       |
| Booking details                             | always, collapsed                        | Reference with copy (label includes the reference), guests, names, pet, email, phone, requests, Edit booking (pending review), cancellation policy + "message your host" (pending / confirmed / arriving), View listing                                                                                                                                                                                                                |
| Footer                                      | always                                   | All trips, Get help                                                                                                                                                                                                                                                                                                                                                                                                                    |

### States

- Missing `bookingId` → "Booking not found" + Your trips.
- 401 → "Sign in to see your trip" → `requireGuestAuth` with resume to this URL.
- 404 → "Booking not found".
- Other errors → "Something went wrong" + Try again.

---

## Entry points

| From                          | How                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `/properties/:slug/success`   | **View your booking** button (token stored at submit)                                    |
| `/account/trips`              | Each row                                                                                 |
| Booking acknowledgement email | **View your booking** button inside `{{booking_acknowledgement_flow_section}}`           |
| Any guest email template      | `{{trip_url}}` (tokenized) on acknowledgement, ready-for-check-in, SD refund             |
| `/sd-form`, `/guest-review`   | **Your trip** back link; SD form done screen **View your booking**                       |
| Guest chat (property + Stays) | **Your trip** card first in the Helpful links strip (`tripPath` from chat start/resume)  |
| Host booking detail `⋯` menu  | **Open guest trip page** / **Copy guest trip link** (`issue-guest-trip-link`, tokenized) |
| Pasted trip link in any chat  | Renders as a **Your trip** link card (`urlLinkCardMeta` kind `trip`)                     |

---

## API reference

| Action          | Endpoint                                                              |
| --------------- | --------------------------------------------------------------------- |
| Trip payload    | `GET get-guest-trip?bookingId=&access=&property=` (anon or guest JWT) |
| Host share link | `POST issue-guest-trip-link { bookingId }` (`bookings:view`)          |
| Payment methods | `GET get-guest-payment-info?property=<slug>`                          |
| Listing details | `GET get-public-property?property=<slug>`                             |

`get-guest-trip` is rate limited (30/min) and never cached by the service worker. The page sets
`noindex`; robots.txt disallows `/*/trip?`. activity-log: N/A, read-only (only writes are the
idempotent document share token / stay guide token self-heal and owner linking).

---

## Implementation map

| Concern       | Path                                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page          | `ui/src/features/guest/trip/pages/GuestTripPage.tsx`                                                                                                                                                                                                                 |
| Components    | `ui/src/features/guest/trip/components/*` (`GuestTripStayHeader`, `GuestTripNowCard`, `GuestTripShortcuts`, `GuestTripPaymentSection`, `GuestTripArrivalSection`, `GuestTripHostRow`, `GuestTripDetailsSection`, `GuestTripRequestSentBanner`, `GuestTripReturnBar`) |
| Status logic  | `ui/src/features/guest/trip/lib/guestTripPhase.ts` (+ `.test.ts`), `ui/src/features/guest/trip/lib/guestJourneyCopy.ts` (+ `guestJourneyCopyParity.test.ts`)                                                                                                         |
| Link resolver | `ui/src/features/guest/trip/lib/guestJourneyLinks.ts`                                                                                                                                                                                                                |
| API client    | `ui/src/features/guest/trip/lib/guestTripApi.ts`                                                                                                                                                                                                                     |
| Route         | `ui/src/features/guest/property/routes/index.tsx`                                                                                                                                                                                                                    |
| Path helper   | `guestTripPath` in `ui/src/features/guest/lib/guestPublicPaths.ts`                                                                                                                                                                                                   |
| Edge          | `supabase/functions/get-guest-trip/index.ts`                                                                                                                                                                                                                         |
| Payload       | `supabase/functions/_shared/guestTrip.ts`                                                                                                                                                                                                                            |
| Access rules  | `supabase/functions/_shared/guestTripAccess.ts` (+ `_test.ts`)                                                                                                                                                                                                       |
| Email link    | `guestTripPath` in `_shared/publicGuestPaths.ts`, `guestBookingEmailLinks.ts`, `buildGuestTripCtaHtml`                                                                                                                                                               |
| Essentials    | `_shared/guestEssentials.ts` (+ `_test.ts`) — reveal gating and per-booking override                                                                                                                                                                                 |
| Host content  | `_shared/guestTripContent.ts` (+ `_test.ts`) — instructions and guest-visible templates, stage filter                                                                                                                                                                |
| Receipt       | `supabase/functions/guest-trip-payment-receipt/index.ts`; `ui/src/features/guest/trip/components/GuestTripReceiptSheet.tsx`                                                                                                                                          |
| Timeline      | `guestTripTimeline` in `guestTripPhase.ts` (+ `.test.ts`); `ui/src/features/guest/trip/components/GuestTripTimeline.tsx`                                                                                                                                             |

---

## Testing

| Layer | Path / spec                                                                                                                                                                                                                             | Manual                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Unit  | `guestTripPhase.test.ts` (phase, progress, headline, next action, checklist, timeline), `guestTripCalendar.test.ts`, `guestTripLinks.test.ts`, `guestTripAccess_test.ts`, `bookingDetailActions.test.ts`, `parseChatRichBlocks.test.ts` | —                                                    |
| E2E   | `guestFormSubmit.spec.ts` (submit lands here), `tripPendingActions.spec.ts` (`@smoke @critical`: pending, cancelled, expired), `stayGuideEssentials.spec.ts`, `accountLanding.spec.ts`                                                  | Open from the email link, Trips tab, or a submission |

---

## Related docs

- [Route index](./README.md)
- [Booking success](./success.md)
- [Guest Trips tab](./account/trips.md)
- [SD form / guest review](./sd-form.md)
- [Stay guide](./stay-guide.md)
- [Guest booking document](./guest-booking-document.md)

---

## Pending / follow-ups

- [x] Host booking detail: Open / Copy guest trip link.
- [x] Chat resource hub: Your trip card.
- [ ] Host Inbox share menu (Insert → booking links): add the trip link.
- [ ] Guest balance receipt upload on the trip page (today: send it in chat).
- [ ] Playwright mocked E2E for the access states.
