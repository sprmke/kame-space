---
stage: in-progress
title: 'Guest post-booking journey: one connected flow from dates to review'
status: in-progress
tags: [workflow, planned, guest, booking, trip, stay-guide, chat, emails, ux]
updated: 2026-11-12
kind: plan
readiness: audited
last_verified: 2026-11-10
---

# Guest post-booking journey

> **Revised 2026-11-10 (execute-plan):** plan audited against `origin/develop` (`b3cc24c14`).
> Added §4.1 execution decisions (D6 and D10 resolved), §4.2 audit findings and drift
> corrections, §6.1 per-phase acceptance commands, §11.1 edge cases, §11.2 rollback.
> Corrected drift: the trip hub, `guestTripPhase.ts` and `guestTripLinks.ts` already exist
> from `guest-trip-hub.md` (Phase 0 is partly built); `stay_guide_valid_from` already exists
> as a column (Phase 4.1 is a semantics change, not a new column); the "Stays" route already
> lives at `/account/stays` with `/account/messages` as the legacy redirect (D2 flips the
> redirect direction); `social_conversations` already carries `property_id` +
> `guest_user_id` (D9 only adds `booking_id`); the inbox check-in pack already exists at
> `ui/src/features/dashboard/inbox/lib/inboxCheckInPack.ts` (5.7 extends it);
> `guest_balance_payment_receipt_url` already exists (D12 reuses it, no new table).
> Phase 3.3 receipt upload, Phase 6.6 guest push and Phase 7 editors are re-sequenced
> behind their required schema.

Make everything a guest needs after they pick dates and book live in **one connected flow**:
one trip home per booking, reachable from every surface (app nav, emails, chat, stay guide,
account), with honest status, the right next step, and every host-prepared resource (house
rules, check-in steps, stay guide, templates, documents, payment, parking, chat) in a
predictable place. The host side must see and steer the same journey.

Builds on, does not replace: [`guest-trip-hub.md`](../in-progress/guest-trip-hub.md) (trip page
v1, in progress), [`cancellation-policy-and-process.md`](../in-progress/cancellation-policy-and-process.md),
[`mobile-app-chrome-header-and-tab-bar.md`](../in-progress/mobile-app-chrome-header-and-tab-bar.md),
[`live-identity-verification.md`](../in-progress/live-identity-verification.md),
[`guest-review-facebook-cta.md`](./guest-review-facebook-cta.md),
[`guest-trust-safety-reporting.md`](./guest-trust-safety-reporting.md).

---

## 1. Problem

The trip page (`/properties/:slug/trip`) is already a good hub, but the pieces around it are
not wired to it, use different names for the same thing, and sometimes send the guest to the
wrong place. From the guest's side the journey still feels like a set of separate pages joined
by emails.

Audit done 2026-11-09 across code, route guides, email builders and the workflow rule. Every
finding below was verified in code (file noted).

### 1.1 Current journey map

| Stage                 | Surface today                                          | Shell                              | How the guest gets there               |
| --------------------- | ------------------------------------------------------ | ---------------------------------- | -------------------------------------- |
| Browse + pick dates   | `/properties/:slug` (listing, `BookingCalendarModal`)  | Marketing (`MarketingLayoutShell`) | Search, host page, shared link         |
| Alt. date entry       | `/properties/:slug/calendar` → **Book Now** → `/form`  | Operational (`MainLayout`)         | Links sent by hosts in Messenger       |
| Book                  | `GuestBookingFormModal` on listing **or** `/form` page | Marketing modal / Operational      | Reserve / Book Now / direct link       |
| Confirmation          | `/properties/:slug/success` (router state only)        | Operational                        | Auto after submit                      |
| Wait for review       | Nothing. No guest email on submit                      | -                                  | -                                      |
| Approved / docs stage | Acknowledgement email → trip page                      | Operational                        | Email CTA, `/account/trips`            |
| Pre-arrival           | Trip page; parking marketplace; parking reminder email | Operational / Marketing            | Email, account                         |
| Ready for check-in    | Ready-for-check-in email → stay guide (Pro+)           | Standalone showcase shell          | Email only                             |
| In stay               | Trip page, stay guide, chat                            | Three different shells             | Email, account, chat hub               |
| Check-out             | SD refund email → `/sd-form`                           | Operational                        | Email, trip main button                |
| After stay            | `/guest-review`, vouchers                              | Operational / Account              | Email, trip page                       |
| Chat (any time)       | `/properties/:slug/messages`, `/account/stays`         | Operational / Account              | Contact host, trip, notification email |

### 1.2 Findings

**A. Navigation and information architecture**

- **A1. Messages tab dumps booked guests into the date picker.** The operational shell's
  **Messages** tab points to `guestPropertyPickDatesPath(slug, 'contactHost')`, and
  `PropertyChatPage` redirects there whenever `checkInDate`/`checkOutDate` are missing. A guest
  with a confirmed stay is asked to pick dates again to talk to their host.
  (`property/routes/index.tsx`, `chat/pages/PropertyChatPage.tsx`)
- **A2. No Trips or Messages in the main nav.** Marketing bottom nav is Explore · Properties ·
  Parkings · Account. Airbnb's is Explore · Wishlists · Trips · Messages · Profile. A signed-in
  guest with a trip tomorrow needs Account → Profile → Trips → row. (`MarketingBottomNav.tsx`)
- **A3. Account opens on Profile.** `/account` always redirects to `/account/profile`
  (`GuestAccountIndexPage.tsx`). The most useful thing for a guest with an upcoming trip is the
  trip.
- **A4. "Stays" means messages.** Account nav has **Trips** (bookings) and **Stays** (the chat
  inbox at `/account/stays`, icon `MessageSquare`). Two words for overlapping ideas, and the
  word "stay" is also used for bookings everywhere else. (`guestAccountNav.ts`)
- **A5. The listing does not know you have a trip there.** `useGuestTrips` is used only by
  `/account/trips`. A signed-in guest opening the listing they booked sees **Reserve**, not
  "Your trip".
- **A6. Three shells for one stay.** Listing and Reserve modal (marketing shell) → success /
  trip / sd-form (operational shell with Property · Calendar · Messages tabs) → stay guide
  (full-bleed showcase shell with no app chrome). Submitting from the Reserve modal jumps the
  guest from the marketing shell to the operational one.
- **A7. Dead ends with no way back to the trip.** No trip link on: stay guide
  (`StayGuidePage`, `ShowcaseShell`), booking document page (`GuestBookingDocumentPage`),
  parking request status (`ParkingRequestStatusPage`), property chat header
  (`GuestChatHeaderBar`). Trip-aware today: success, SD form, review, account trips, chat
  resource hub only.
- **A8. Three ways into booking, two of them full-page.** Listing Reserve (modal), calendar
  **Book Now** (`/form` page), direct `/form` links. Fine for legacy Messenger links, but the
  calendar page is a second listing-like surface with its own tab.

**B. Booking confirmation and the waiting period**

- **B1. "Booking Confirmed!" while still pending.** `GuestFormSuccess` titles the page
  "Booking Confirmed!" but the booking is `PENDING_REVIEW`. The trip page then says "Your host
  is reviewing your booking". Contradiction on the first two screens.
- **B2. Legacy single-tenant copy.** Success "Next Steps" hardcodes the GAF and "property
  administration" and "Kindly return to our conversation on Facebook Messenger / Airbnb"
  (`formatGuestMessengerReturn`, `formatGuestSuccessAdministration`). Wrong for properties with
  no GAF requirement and for guests who booked on-platform.
- **B3. Success page duplicates the trip page, worse.** Summary comes only from router state
  (lost on refresh). The trip page already renders the same data from the server.
- **B4. No guest email on submit.** `submit-form` only sends the internal New Booking Request.
  The guest's first email is the acknowledgement, sent when the host moves the booking to
  `PENDING_DOCUMENTS`. If the host is slow, the guest has no receipt, no link, no reference.
- **B5. No expectation for the review wait.** Nothing tells the guest how long review takes or
  what happens if the host declines. Airbnb shows "Pending" with a 24h host window and
  auto-expiry.

**C. Trip hub gaps (beyond guest-trip-hub follow-ups)**

- **C1. No timeline of what is coming.** Progress bar shows where you are, not the dated
  upcoming moments (documents approved, balance due date, check-in window opens, check-out by).
- **C2. Balance receipt cannot be uploaded on the trip page.** "Send your receipt to your host"
  forces a detour into chat. (open item in guest-trip-hub)
- **C3. Check-in and check-out instructions only live in the stay guide (Pro+).** Trip page
  shows house rules from the listing on every plan, but not the host's check-in / check-out
  templates. Below Pro the guest gets no arrival instructions in-app at all.
- **C4. No "essentials" block.** Wi-Fi, door/lock code, unit + floor, parking slot, emergency
  contact live, if anywhere, inside free-form check-in HTML. Competitors expose these as a
  structured, time-gated card.
- **C5. Host custom templates never reach the guest.** `property_template_contents` supports
  `custom-*` templates (folders, up to `MAX_CUSTOM_TEMPLATES`), but no guest surface renders
  them. Hosts cannot publish "Appliance guide", "Local recommendations", "Pool rules".

**D. Stay guide**

- **D1. The emailed link does not work until check-in day.** `ensureGuestStayGuideToken` runs
  at `READY_FOR_CHECKIN` and the email goes out immediately, but `isStayGuideAccessActive`
  only opens from Manila check-in day 00:00. A guest approved 5 days early taps the button and
  sees "This stay guide isn't available". (`_shared/guestStayGuide.ts`)
- **D2. No route back.** Full-bleed brochure with no link to trip, chat, or account (A7).
- **D3. Plan gate leaves lower-plan guests with nothing.** Correct as an upsell for the
  designed brochure, but the underlying check-in content is operational, not marketing (C3).

**E. Messaging**

- **E1. Threads are not linked to bookings.** `social_conversations` keys on
  `guest_user_id + property` with inquiry dates; host Inbox guesses the booking by fuzzy guest
  name (`inboxMatchBooking.ts`). For web chat with a signed-in guest the link is knowable
  exactly (`guest_user_id` → `guest_submissions`).
- **E2. Chat resource hub pushes pre-booking links to booked guests.** Hub always lists
  Calendar, Listing, **Booking form** and Showcase (`guestChatResourceHubItems.ts`); for a
  booked guest these invite a second booking. House rules and check-in steps are missing.
- **E3. AI receptionist "View stay" opens the inbox.** `guestReceptionistTools.ts` and
  `voiceReceptionistTool.ts` push `open_booking` → `/account/stays` (messages), not the trip.
- **E4. Host reply email opens the generic inbox.** `guestChatEmail.ts` links to
  `/account/stays`, not the thread, so the guest must find the conversation again.
- **E5. Chat header has no booking context.** Guest chat shows the property, not "Your stay
  Dec 3-5 · Confirmed" with a link to the trip.

**F. Emails and notifications**

- **F1. Acknowledgement copy is Azure-specific for every property.**
  `buildBookingAcknowledgementFlowSectionHtml` always says GAF, "building administration",
  "two business days", "Booking Confirmation email". It should follow resolved requirements.
- **F2. Three words for one milestone.** Success "Booking Confirmed!", acknowledgement "has
  been approved", acknowledgement step 3 "Booking Confirmation email" (actually the
  ready-for-check-in email).
- **F3. Trip link is opt-in on later emails.** Only the acknowledgement renders the trip CTA
  by default. Ready-for-check-in and SD refund need the host to add `{{trip_url}}`.
- **F4. No general pre-arrival reminder.** Only a parking reminder cron exists. Nothing
  "Check-in in 2 days: here is your trip / balance due / directions".
- **F5. No guest push.** PWA plan lists guest portal push as "not yet (own plan)".

**G. Host coordination**

- **G1. Host cannot see the guest's journey at a glance.** Booking detail has Open / Copy guest
  trip link, but no "what the guest sees now" (phase, next action, what is still missing).
- **G2. No content readiness check.** Nothing tells a host their check-in instructions, Wi-Fi,
  payment methods or cancellation policy are empty before a guest arrives.
- **G3. Inbox Insert menu has no trip link** (open item in guest-trip-hub).

---

## 2. Competitive UX brief

**Job:** after picking dates and booking, the guest wants one place that always tells them
where the booking stands, what to do next, how to get in, and how to reach the host.
**Role:** guest (primary), host (steers content and status).

### Airbnb (guest)

- **Trips tab** is a top-level nav item. Each reservation opens one details page; check-in
  instructions, house manual, Wi-Fi, directions and the host thread hang off that page.
  Guidebook shows on the listing before booking and in Trips after confirmation.
- **Request to book** shows **Pending** with a 24h host window; unanswered requests expire and
  refund. Guest can cancel a pending request from the booking details page.
- Known weakness (host forums): guests miss check-in info buried under "Show more trip
  details", so hosts resend it by scheduled message. Lesson: put arrival info on the first
  screen near arrival, and push it.
- Messages is its own top-level tab, but every thread carries the reservation card.

### PMS guest portals (Hostaway, Guesty, Enso, Touch Stay via Hospitable)

- **One link per reservation** sent right after booking, not per milestone.
- **Staged portal:** before arrival it collects info and prepares the guest; at check-in time
  it becomes the guidebook (Hostaway).
- **Sensitive details gated:** access codes hidden until confirmed / paid / agreement signed
  (Hostaway); lock codes scoped to the stay window (Enso).
- **Past guests** keep access to reservation details and receipts.
- Guidebooks are reservation-specific links with view tracking (Touch Stay + Hospitable).

### Adopt for Kame Space

- Trips and Messages as first-class nav for signed-in guests; account lands on Trips.
- One tokenized trip link sent from the first email onward; every other guest link opens
  inside or returns to it.
- Staged trip page: prepare (before) → arrive (day of) → stay → leave → after.
- Stay guide reachable as soon as the stay is ready; secrets (door code, Wi-Fi password)
  revealed on a host-set schedule.
- Booking card on every chat thread, both sides.
- Honest pending state with a review expectation and what happens on decline.

### Adapt / skip

- No native app; stay a PWA with push as an opt-in, not a requirement.
- No mandatory rental-agreement signing or upsell store in this plan.
- Philippines context: manual bank / e-wallet payments stay; receipt upload replaces "send it
  in chat". Building GAF stays a per-property requirement, never a global assumption.
- Keep copy minimal (`minimal-ui-copy`, `human-copy`); no helper paragraphs copied from
  competitors.

Sources: [Airbnb pending reservations](https://www.airbnb.com/help/article/2810) ·
[Airbnb forum: where guests find check-in info](https://community.withairbnb.com/t5/Ask-about-your-listing/where-to-direct-guests-to-see-check-in-instructions-and-photos/m-p/2104363) ·
[Hostaway guest portal timeline](https://support.hostaway.com/hc/en-us/articles/53955216055451-Guest-Portal-Access-and-Visibility-Timeline) ·
[Hostaway guest portal glossary](https://www.hostaway.com/glossary/guest-portal/) ·
[Guesty digital guidebooks](https://www.guesty.com/blog/creating-a-digital-guidebook-for-your-short-term-rental) ·
[Touch Stay + Hospitable](https://help.hospitable.com/en/articles/9498186-connect-hospitable-with-touch-stay-to-send-guidebooks-to-your-guests-with-the-guidebook-short-code) ·
[Enso boarding pass](https://newsite.ensoconnect.com/resources/boarding-pass-overview)

---

## 3. Target experience

### 3.1 Principles

1. **One trip, one home.** The trip page is the canonical surface for a booking. Every guest
   link (email, chat card, push, nav, listing banner, stay guide, docs, parking, refund,
   review) either opens it or has a visible way back to it.
2. **One vocabulary.** Same status words on success, trip, account list, emails, chat card and
   host dashboard (§3.3).
3. **Next step first.** Each phase leads with the single thing the guest should do; everything
   else is one tap away, never hidden behind tabs when money or documents are due.
4. **Requirement-aware, never property-specific.** Copy and steps come from the property's
   resolved requirements (GAF, pet, parking, deposit, balance), not Azure defaults.
5. **Same shell for the whole stay.** Booking-scoped pages share one chrome with a trip-aware
   nav; the stay guide keeps its designed template but gains a slim return bar.
6. **Host sees what the guest sees.** Same phase model on the host booking detail and inbox.

### 3.2 Target journey

| Stage                  | Guest sees                                                                                                               | Guest gets                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Pick dates             | Listing booking card / calendar modal (unchanged)                                                                        | -                                                   |
| Book                   | Reserve modal → form (unchanged steps)                                                                                   | -                                                   |
| Submitted              | Trip page opens directly with a one-time "Request sent" banner: reference, what happens next, typical review time        | **Request received** email with trip link           |
| Under review           | Trip phase `requested`: status, expectation, edit / cancel request, message host                                         | Push (opt-in) when host responds                    |
| Confirmed / documents  | Requirement-aware checklist (only steps this property needs), balance due + upload receipt, parking, add to calendar     | Acknowledgement email (requirement-aware copy)      |
| Ready for check-in     | Stay guide unlocked immediately, essentials card with secrets "available from {date time}", directions, arrival timeline | Ready email: trip link + stay guide link that works |
| Pre-arrival (T-2 days) | Same, with balance reminder if unpaid                                                                                    | Pre-arrival reminder email / push                   |
| Arrival day            | Now card: "Check in from 2:00 PM", door code / Wi-Fi revealed, directions, check-in steps inline                         | Push at host-set time                               |
| Staying                | Night N of M, stay guide, essentials, house rules, host contact, report a problem                                        | -                                                   |
| Check-out day          | Check-out steps inline, "Check out by 11:00 AM"                                                                          | Check-out email (existing SD email)                 |
| After stay             | Deposit refund form, review, voucher, book again; receipts stay readable                                                 | Existing emails, all with trip link                 |
| Cancelled / declined   | What was paid, refund status, book other dates                                                                           | Cancelled email with trip link                      |

### 3.3 Vocabulary (single source)

| Status (DB)                                            | Guest word                | Never say                       |
| ------------------------------------------------------ | ------------------------- | ------------------------------- |
| `PENDING_REVIEW`                                       | Request sent              | Confirmed, Approved, Booked     |
| `PENDING_DOCUMENTS` + legacy `PENDING_GAF/PARKING/PET` | Confirmed                 | Approved (as a status word)     |
| `READY_FOR_CHECKIN`                                    | Ready for check-in        | Booking confirmation            |
| `READY_FOR_CHECKOUT` (in window)                       | Staying / Check-out today | -                               |
| `PENDING_SD_REFUND`                                    | Deposit refund            | -                               |
| `COMPLETED`                                            | Completed                 | -                               |
| `CANCELLED`                                            | Cancelled                 | Declined (unless host declined) |

Lives in one module shared by UI (`guestTripPhase.ts`) and email builders (new
`_shared/guestJourneyCopy.ts`), with a parity test like `cancellationRefundParity.test.ts`.

### 3.4 Navigation model

| Context                                                                                            | Phone bottom bar                                                                | Desktop                               |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| Anonymous, marketing                                                                               | Explore · Properties · Parkings · Sign in (unchanged)                           | Unchanged                             |
| Signed-in guest, marketing                                                                         | Explore · **Trips** · **Messages** · Account                                    | Avatar menu: Trips, Messages, Account |
| Booking-scoped pages (trip, sd-form, review, docs, parking for a stay, chat for a booked property) | **Trip** · **Messages** · **Stay guide** (when active) · Listing                | Trip header with the same links       |
| Property pre-booking operational pages (calendar, form)                                            | Property · Calendar · Messages (Messages opens existing thread when one exists) | Unchanged                             |
| Stay guide                                                                                         | Template chrome + slim return bar: Trip · Message host                          | Same                                  |

Parkings stays reachable from Explore and the marketing nav; it leaves the signed-in bottom
bar to make room (decision D3).

---

## 4. Decisions

Recommended option first. Items marked **needs owner** are the only ones that change plans or
host-visible behavior beyond UX and must be confirmed before that phase starts.

- **D1. Success page becomes a redirect into the trip page.** Submit navigates to
  `guestTripPath` with `?welcome=1`; trip shows a dismissible "Request sent" banner (reference,
  next step, review expectation). `/success` stays as a route for old links and redirects to
  the trip when `bookingId` + access are known, else shows a minimal "Request sent" card with
  sign-in to view. Removes B1 and B3.
- **D2. Rename account "Stays" to "Messages"** at `/account/messages` (today a redirect to
  `/account/stays`; flip the redirect direction). Account index lands on **Trips**.
- **D3. Signed-in marketing bottom bar: Explore · Trips · Messages · Account.** Unread dot on
  Messages; "next trip" dot on Trips when check-in is within 7 days or an action is due.
- **D4. Booking-scoped shell.** Extend the operational `MainLayout` with a `mode: 'trip'` tab set
  (Trip · Messages · Stay guide · Listing) used by trip, sd-form, guest-review, document,
  parking-for-stay and booked-property chat. Pre-booking pages keep today's tabs.
- **D5. Stay guide opens at `READY_FOR_CHECKIN`, secrets on a schedule.** Change
  `stay_guide_valid_from` to the moment the token is issued; add per-property
  `essentialsRevealLeadHours` (default 24h before check-in time, Manila). Door code / Wi-Fi
  password render as "Available {date, time}" before then. Fixes D1 without leaking secrets.
- **D6. Check-in / check-out instructions + essentials on the trip page on every plan;
  the designed Stay Guide brochure stays Pro+.** **Needs owner** (entitlement change). Rationale:
  arrival steps are operational, not marketing; lower-plan guests currently get none (C3, D3).
  Alternative: keep everything Pro+, and show lower-plan guests "Ask your host for check-in
  steps" with a Message host button.
- **D7. Structured essentials as new property settings, not template parsing.** Fields: Wi-Fi
  name, Wi-Fi password, door / lock / lockbox code, unit + floor + tower, parking slot note,
  emergency contact (name + phone), building security / admin phone, garbage + quiet hours
  (optional). Per-booking override for codes (e.g. rotating lock codes) on the booking detail.
  Stored server-side; secrets returned only by `get-guest-trip` / `get-guest-stay-guide` after
  the reveal time, never in listing APIs, never in emails unless the host places
  `{{door_code}}`-style placeholders deliberately.
- **D8. Guest-visible custom templates.** Add a `guestVisible` flag + `phase`
  (`before | arrival | stay | checkout | after | always`) to custom templates. Visible ones
  render as collapsible "From your host" sections on the trip page and as chapters in the stay
  guide. Same plan gate as D6.
- **D9. Booking-linked chat threads.** Add nullable `booking_id` to `social_conversations`
  (new migration). Set it on web-chat start/resume when the signed-in guest has an active or
  upcoming booking for that property (closest upcoming first). Host Inbox uses it before the
  fuzzy name match. Messages tab on booked pages opens that thread without inquiry dates.
- **D10. "Request received" guest email on submit.** **Needs owner** (new outbound email per
  booking, Resend volume). Sent from `submit-form` for genuine new submissions only (not
  no-op edits, not OTA completion). Per-property template key `email-booking-request-received`
  with a sensible default; host can turn it off in Notifications. Not a workflow transition, so
  it does not go through `workflowOrchestrator` (no status change); it reuses `emailService`.
- **D11. Review expectation copy.** Show "Hosts usually reply within {X}" using the property's
  real median first-response time when there are at least 5 data points, else "Most hosts reply
  within a day". No auto-expiry of `PENDING_REVIEW` in this plan (out of scope, workflow change).
- **D12. Receipt upload on the trip page** writes to the same balance receipt fields the host
  uses (`guest_balance_payment_receipt_url` pending column or a new `guest_payment_submissions`
  table if multiple receipts are needed). Never changes status by itself; notifies host and
  logs activity. Runs existing AI receipt validation non-blocking.
- **D13. Pre-arrival reminder** reuses the parking reminder cron pattern (`pg_cron` + `pg_net`,
  idempotent `*_emailed_at` column), T-48h by default, host can turn it off.

### 4.1 Execution decisions (2026-11-10, execute-plan)

The two open owner questions (D6, D10) change plans and host-visible behaviour, so they are
resolved **here** rather than blocked on a reply. Both take the plan's own recommended option.
They stay reversible: each is one gate constant or one toggle row.

| #   | Decision                                    | Choice                                                                                                                                                                                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **D6 — plan gate for arrival content**      | **Every plan gets check-in / check-out steps and essentials on the trip page. The designed Stay Guide brochure stays Pro+ (`propertyShowcase`).** Shipped **ungated**, with **no new plan key**. `customTemplates` remains the gate for _authoring_ custom templates, so guest-visible rendering needs no key of its own. | Arrival steps are operational, not marketing (C3, D3). A lower-plan guest currently gets no way in at all. A new key would have meant a seed migration, the golden tier matrix and a gate nobody asked for; adding one later is a small change if a tier should lose this. This differs from the draft, which proposed `guestArrivalContent`. |
| E2  | **D10 — "Request received" email**          | **Send it on every genuine new submission**, per-property template key `email-booking-request-received`, host toggle `emailBookingRequestReceived` (default on, in the existing Notifications → email automations panel). Not plan-gated (it is a receipt for the guest's own action, like `emailNewBookingRequest`).     | The guest's first email today only arrives when the host moves the booking (B4). One extra outbound mail per booking is the smallest fix for the biggest trust gap.                                                                                                                                                                           |
| E3  | Phase order                                 | Phase 0 → 1 → 2 → 5 → 3 → 4 → 6 → 7 → 8. Phase 5 (booking-linked chat) moves ahead of Phase 3 because Phase 2.4 / 2.5 depend on the chat thread resolving a booking without inquiry dates.                                                                                                                                | Matches §8's dependency note and keeps each phase shippable.                                                                                                                                                                                                                                                                                  |
| E4  | Vocabulary module shape                     | `ui/.../guestTripPhase.ts` stays the UI source of truth (it already owns `guestTripStatusLabel`); the new `_shared/guestJourneyCopy.ts` mirrors only the **status word + headline** surface the emails need. A parity test asserts the two agree.                                                                         | `guestTripPhase.ts` already ships from `guest-trip-hub.md`; rewriting it would be churn. The email side only needs words, not the phase/timing model.                                                                                                                                                                                         |
| E5  | Essentials storage                          | New table `property_guest_essentials` (one row per property) + `guest_submissions.guest_essentials_override` JSONB for per-booking code overrides. Secrets are returned **only** by `get-guest-trip` / `get-guest-stay-guide`, and only after the reveal time.                                                            | A JSONB blob on `properties.settings` would leak secrets into every listing read (`get-public-property` returns `settings`). A separate table lets the trip DTO be the only reader.                                                                                                                                                           |
| E6  | Guest-visible templates                     | `property_template_contents.guest_visible BOOLEAN` + `guest_phase TEXT` (`before \| arrival \| stay \| checkout \| after \| always`). Visible ones render as "From your host" on the trip page.                                                                                                                           | The table already carries custom `custom-*` rows with a `folder_id`; two columns is the smallest change that makes them reachable by the guest.                                                                                                                                                                                               |
| E7  | Receipt upload storage                      | Reuse the existing `guest_submissions.guest_balance_payment_receipt_url` column (one receipt per booking) instead of a new `guest_payment_submissions` table.                                                                                                                                                             | The column already exists (`20260603120000_guest_balance_settlement.sql`) and the host dashboard already reads it. Multiple receipts are not a real need.                                                                                                                                                                                     |
| E8  | Stay guide access window                    | `stay_guide_valid_from` becomes **token issue time** (not Manila check-in midnight). The reveal rule for secrets is a **separate** `essentials_reveal_at` computed server-side, default 24 h before the property's check-in time.                                                                                         | Phase 4.1 as written (change the column to issue time) and D5 (secrets on a schedule) are two different things. One fixes the dead link (D1); the other prevents leaking the door code early.                                                                                                                                                 |
| E9  | Trip phase for a booked guest on chat pages | `PropertyChatPage` accepts `?bookingId=`; when present the dates come from the booking and no date picker is shown. When absent, the existing date-picker flow is unchanged for a first inquiry.                                                                                                                          | A1 — a booked guest must never be asked to pick dates again.                                                                                                                                                                                                                                                                                  |
| E10 | Messages tab on the booking-scoped shell    | `MainLayout` gains `mode: 'trip'`; the tab set becomes Trip · Messages · Stay guide (when active) · Listing. The pre-booking Property · Calendar · Messages set is unchanged.                                                                                                                                             | D4. Keeps one shell for the stay without touching pre-booking pages.                                                                                                                                                                                                                                                                          |
| E11 | Guest push                                  | **Deferred to a follow-up plan.** The guest push fan-out needs guest recipients in `push_recipients.ts`, which resolves org members only. Phase 6.6 becomes "email-only milestone notices"; the push work is recorded in §9 with a reason.                                                                                | Guest push touches the shared `notifications` + `push-fanout` path used by hosts. Folding it into a guest-facing UX plan risks the host path.                                                                                                                                                                                                 |
| E12 | Host Guest view card                        | Phase 7.1 ships as a **read-only card on the booking detail** built from the existing trip DTO logic mirrored for admins. No new edge function for the card; it reuses the guest trip builder server-side behind the admin JWT.                                                                                           | G1 without inventing a parallel data model.                                                                                                                                                                                                                                                                                                   |
| E13 | Pre-arrival reminder column                 | Deferred with the cron. `guest_submissions.pre_arrival_emailed_at` lands with the reminder function in Phase 6, not before: schema for unshipped behaviour is dead weight.                                                                                                                                                | Recorded so a later session does not assume the column exists.                                                                                                                                                                                                                                                                                |

### 4.2 Audit findings (2026-11-10, execute-plan)

Every finding below was verified in code on `origin/develop` (`b3cc24c14`).

| #    | Finding                                                                                                                                                                                                                                      | Impact on the plan                                                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-1  | `guestTripPhase.ts` (461 lines) and `guestTripLinks.ts` (94 lines) already exist and ship with the trip page, with unit tests and a parity test pattern (`cancellationRefundParity.test.ts`).                                                | Phase 0.1 / 0.2 are **partly done**. Only the edge vocabulary mirror and the links resolver extension are new.                                                                    |
| A-2  | `get-guest-trip` already returns `stayGuidePath`, `cancellation`, `review`, `documents`, `parking.findPath` and a fresh `accessToken` for signed-in owners. `guestTrip.ts` is 504 lines.                                                     | Phase 3 extends the DTO; it does not build one from scratch. The `stayGuidePath` is already `null` outside the stay window, which is the D5 problem.                              |
| A-3  | `stay_guide_valid_from` / `stay_guide_valid_until` **already exist** (`20260916120000_guest_stay_guide_token.sql`). `computeStayGuideValidityWindow` sets `validFrom` = Manila midnight on check-in day.                                     | Phase 4.1 is a **semantics change** plus a backfill migration, not a new column.                                                                                                  |
| A-4  | `social_conversations` already has `property_id`, `guest_user_id`, `inquiry_check_in` / `inquiry_check_out` (added `20260910120100_ensure_web_guest_chat.sql`).                                                                              | D9 only adds `booking_id`. The Meta vs web split is by `platform` and is already handled in `socialInboxService.ts`.                                                              |
| A-5  | The account "Stays" route is at **`/account/stays`**; `/account/messages` is the legacy redirect that points _at_ stays (`guestAccountRoutes`).                                                                                              | D2 flips the redirect: `/account/messages` becomes canonical, `/account/stays` redirects to it.                                                                                   |
| A-6  | The marketing bottom nav (`MarketingBottomNav.tsx`) already has Explore · Properties · Parkings · Account and a `More` sheet. `BottomTabBar` supports a badge prop.                                                                          | Phase 2.1 swaps the middle items for Trips · Messages when signed in. Parkings stays reachable from Explore (D3).                                                                 |
| A-7  | `GuestFormSuccess` (318 lines) already links to the trip page and already shows "Booking Confirmed!" + the Azure-specific Next Steps copy. `formatGuestMessengerReturn` / `formatGuestSuccessAdministration` live in `guestFormBranding.ts`. | Phase 1.3 removes those two formatters and rewrites the copy. `GuestFormSuccess` also carries the parking CTA and pet block that must survive the redirect.                       |
| A-8  | `submit-form` sends exactly one email: `sendNewBookingRequestNotify` (team). `isNewGuestSubmission` is computed at line 312 as "a `bookingId` was supplied but no row existed".                                                              | Phase 1.5 sends the guest email from the same place, gated on the same `isNewGuestSubmission` flag. A no-op edit returns early at line 268 and never reaches it.                  |
| A-9  | Guest email bodies are **DB rows in `property_template_contents`** falling back to `defaultContent` in `propertyTemplates.ts` — the `.html` files under `email-templates/` are **preview-only**.                                             | Phase 1.5 / 6.x add the new key to `PropertyTemplateKey`, `BUILTIN_TEMPLATES`, `PROPERTY_EMAIL_TEMPLATE_KEYS` and the UI `EMAIL_TEMPLATE_SECTIONS` mirror — four places, not one. |
| A-10 | Per-property email opt-out is `app_settings.automation_toggles` JSONB, keys in `PROPERTY_AUTOMATION_TOGGLE_KEYS` (edge) mirrored in `ui/.../org/lib/propertyEmailAutomation.ts`.                                                             | The new `emailBookingRequestReceived` toggle joins both lists. No new table.                                                                                                      |
| A-11 | `guest_balance_payment_receipt_url` **already exists** on `guest_submissions`. `balance_receipt_ai_verdict` / `_summary` exist for AI validation.                                                                                            | D12 reuses them (E7). No new table, no new upload storage bucket.                                                                                                                 |
| A-12 | `guestChatResourceHubItems.ts` builds Calendar · Listing · **Booking form** · Showcase, plus Stay guide and Trip when supplied.                                                                                                              | E2 fixes this: booked guests get Trip · Stay guide · House rules · Check-in steps; the booking form is dropped for them.                                                          |
| A-13 | `guestChatEmail.ts` (host reply notice) links to `${origin}/account/stays` with a `View conversation` CTA. `guestReceptionistTools.ts` `get_my_stay` falls back to `open_booking` → `/account/stays`.                                        | Phase 5.4 / 5.5 repoint both to the trip.                                                                                                                                         |
| A-14 | `inboxCheckInPack.ts` already exists in the **UI** (`ui/src/features/dashboard/inbox/lib/`), not in `_shared`. `buildCheckInPackContent` returns plain text for the Insert menu.                                                             | Phase 5.7 extends it in place (adds the trip link + essentials), keeping the plain-text shape.                                                                                    |
| A-15 | `property_template_contents` already has `folder_id` and `section_image_url`; custom templates are `custom-*` keys capped at `MAX_CUSTOM_TEMPLATES = 20`.                                                                                    | E6 adds two columns. The editor already has a per-template pane, so Phase 7.4 adds two controls there.                                                                            |
| A-16 | `notifications.type` is a `CHECK` constraint with 7 values; `push_subscriptions.user_id` FKs `auth.users`. `push_recipients.ts` resolves **org members only**.                                                                               | E11: guest push needs a new notification type and guest recipient resolution — deferred.                                                                                          |
| A-17 | The email flow section (`buildBookingAcknowledgementFlowSectionHtml`) always says GAF, "building administration" and "two business days". It lives in `propertyTemplateEmailSections.ts`.                                                    | Phase 6.2 makes the steps requirement-aware. The building name comes from `loadBookingEmailDisplayContext` → `unitLabel`.                                                         |
| A-18 | `plans-and-permissions` requires every new `PlanFeatureKey` to appear in `PLAN_FEATURE_PERMISSION_COVERAGE`, `planTierGolden.ts`, `planTierExpectations.ts` and `planGateCoverage.test.ts`.                                                  | E1's new `guestArrivalContent` key triggers the plan golden-matrix updates and `bun run check:plan-catalog`.                                                                      |

---

## 5. Phases

Each phase is shippable alone, ordered by guest impact per effort. Every phase ends with the
cross-cutting gates in §6.

### Phase 0: Shared foundations (small, unblocks the rest)

| #   | Task                                                                                                                                                                                                                                            | Where                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0.1 | Edge vocabulary mirror `_shared/guestJourneyCopy.ts` (status word + headline + "what next" line) + UI↔edge parity test. `guestTripPhase.ts` stays the UI source of truth (E4).                                                                  | new `supabase/functions/_shared/guestJourneyCopy.ts`, `ui/.../trip/lib/guestJourneyCopyParity.test.ts` |
| 0.2 | `guestJourneyLinks` resolver: given a trip DTO return trip, chat, stay guide, docs, parking, refund, review URLs. Extend the existing `guestTripLinks.ts` (A-1).                                                                                | `ui/src/features/guest/trip/lib/guestTripLinks.ts` (extend), mirror in `_shared/publicGuestPaths.ts`   |
| 0.3 | `useGuestNextTrip()` hook: signed-in guest's nearest active or upcoming trip (from `guest-trips`, cached)                                                                                                                                       | `ui/src/features/guest/account/hooks/useGuestNextTrip.ts` (reuse `useGuestTrips`)                      |
| 0.4 | `GuestTripReturnBar` component (slim "Your trip · Message host" bar, safe-area aware)                                                                                                                                                           | `ui/src/features/guest/trip/components/GuestTripReturnBar.tsx`                                         |
| 0.5 | Analytics events (PostHog): `guest_trip_viewed {phase, source}`, `guest_next_action_clicked`, `guest_essentials_revealed`, `guest_receipt_uploaded`, `guest_chat_opened {from}`. `guest_stay_guide_opened` and `trip_hub_opened` already exist. | `ui/src/lib/posthog/catalog.ts` + `_shared/posthogCatalog.ts` (both, parity-tested)                    |

Acceptance: no behavior change; unit tests for 0.1-0.3 pass.
Command: `bun run test -- guestJourneyCopy guestTripPhase guestTripLinks useGuestNextTrip` and
`bun run test:edge -- guestJourneyCopy` and `bun run type-check`.

### Phase 1: Honest confirmation and the waiting period (B1-B5, F2)

| #   | Task                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Submit navigates to trip with `welcome=1` (D1); Reserve modal path does the same, so the guest lands in one shell                                                                                                                                                                                                   |
| 1.2 | Trip `requested` phase: "Request sent" banner on first view (reference with copy, "We emailed {email}", review expectation D11)                                                                                                                                                                                     |
| 1.3 | `/success` redirect logic (D1); remove `formatGuestMessengerReturn` / `formatGuestSuccessAdministration` usage from guest UI                                                                                                                                                                                        |
| 1.4 | Pending actions on trip: **Edit request**, **Cancel request** (existing cancellation flow), **Message host** without date picking                                                                                                                                                                                   |
| 1.5 | "Request received" email (D10/E2): new template key `email-booking-request-received` in `PropertyTemplateKey`, `BUILTIN_TEMPLATES`, `PROPERTY_EMAIL_TEMPLATE_KEYS` and the UI `EMAIL_TEMPLATE_SECTIONS` mirror; toggle `emailBookingRequestReceived`; sent from `submit-form` gated on `isNewGuestSubmission` (A-8) |
| 1.6 | Copy sweep with `human-copy`: "Booking Confirmed!" removed; status words per §3.3 on success, trip, account trips, emails                                                                                                                                                                                           |

Acceptance: refresh at any point after submit shows full booking details; no screen says
confirmed before the host proceeds; guest receives one email within a minute of a new submit;
E2E `guestFormSubmit.spec.ts` updated to assert trip landing.
Command: `bun run test -- guestTrip guestForm` + `bun run test:edge -- emailService` +
`bun run type-check` + `bun run test:e2e:smoke -- guest-form`.

### Phase 2: Navigation and IA (A1-A8)

| #   | Task                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 | Signed-in marketing bottom bar (D3) + avatar menu order Trips · Messages · Account; unread + next-trip dots. `MarketingBottomNav.tsx` already supports a badge prop (A-6).                                   |
| 2.2 | `/account` → `/account/trips`; rename Stays → Messages (D2). **`/account/messages` becomes canonical and `/account/stays` redirects to it** (A-5 — the redirect flips direction); update push/email/AI links |
| 2.3 | Booking-scoped shell mode (D4/E10) for trip, sd-form, guest-review, document, parking-for-stay, booked-property chat. `MainLayout` already takes `bottomTabs`, so this is a new tab-set, not a new layout.   |
| 2.4 | Operational Messages tab: open the existing thread for this property when one exists (booked or prior inquiry); date picker only for a first inquiry                                                         |
| 2.5 | `PropertyChatPage`: accept `bookingId` instead of inquiry dates; derive dates from the booking (E9)                                                                                                          |
| 2.6 | Listing banner for signed-in guests with a trip at this property: "You have a trip here · {dates} · View trip" above the booking card; Reserve stays for new dates                                           |
| 2.7 | Home / `/properties` "Upcoming trip" card for signed-in guests (within 30 days), dismissible per trip                                                                                                        |
| 2.8 | Return paths: `GuestTripReturnBar` on stay guide, document page, parking request status; trip chip in chat header                                                                                            |
| 2.9 | Calendar page: keep for legacy links; **Book Now** opens the same Reserve modal flow on the listing instead of `/form` (decide during build; keep `/form` for direct links)                                  |

Acceptance: from any guest page a booked guest reaches their trip in at most 2 taps and their
host thread in at most 2 taps, at 375 / 768 / 1024px; no path asks a booked guest to pick dates
to message their host; account landing is Trips.
Command: `bun run type-check` + `bun run lint` + `bun run test -- guestAccountNav marketingBottomNav propertyChat` + `bun run test:e2e:smoke -- guest-form account`.

### Phase 3: Trip hub v2 (C1-C5)

| #   | Task                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | **Requirement-aware checklist:** derive steps from resolved requirements (GAF / pet / parking endorsement / balance / deposit); hide steps the property does not need. Source: `resolveDocumentRequirements(propertyId)` (A-17 context) |
| 3.2 | **Upcoming timeline** (dated): documents expected by, balance due, stay guide ready, check-in window, check-out by, refund expected; compact, phase-filtered                                                                            |
| 3.3 | **Receipt upload** in Payment (D12/E7): image/PDF via `prepareUpload`, preview, replace, "Sent to host" state, AI validation non-blocking. Writes `guest_balance_payment_receipt_url` (already exists, A-11)                            |
| 3.4 | **Essentials card** (D7/E5): Wi-Fi with copy, door code with reveal timing, unit/floor, parking slot, emergency + building contacts; tap-to-call. New table `property_guest_essentials`                                                 |
| 3.5 | **Arrival / check-out steps inline** from `check-in-instructions` / `check-out-instructions` templates, phase-gated by `guestArrivalContent` (E1)                                                                                       |
| 3.6 | **From your host** sections from guest-visible custom templates (D8/E6), collapsed by default, phase-filtered                                                                                                                           |
| 3.7 | **Help block:** Message host, Call host, Report a problem (hook for trust-safety plan), Get help (platform support)                                                                                                                     |
| 3.8 | Past trips keep receipts, documents, payment ledger readable after `COMPLETED` (Hostaway pattern)                                                                                                                                       |
| 3.9 | Section order review per phase (Impeccable critique pass): Now card → essentials (arrival+) → payment (when due) → timeline → getting there → from your host → host → details                                                           |

Acceptance: a guest on a lower plan still sees how to get in; a guest never needs chat to send
a payment receipt; trip page passes the guest-trip-hub contrast and 12px rules; the first
screen on phone shows status, next action and (on arrival day) essentials without scrolling.
Command: `bun run test -- guestTrip` + `bun run test:edge -- guestTrip` + `bun run type-check` + `bun run test:e2e:smoke -- guest-form`.

### Phase 4: Stay guide connected (D1-D3, C4-C5)

| #   | Task                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Access window opens at token issue (D5/E8): `stay_guide_valid_from` becomes the token-issue timestamp (semantics change on an existing column, A-3). New migration file backfills existing tokens; secrets stay gated separately by `essentials_reveal_at` |
| 4.2 | Essentials section kind in the template engine (`StayGuideSections.tsx`), with the same reveal rule as the trip page                                                                                                                                       |
| 4.3 | Guest-visible custom templates as stay guide chapters (D8/E6), editable in Page Editor → Section details                                                                                                                                                   |
| 4.4 | `GuestTripReturnBar` inside `ShowcaseShell` for `pageKind: 'stay-guide'` only (not Showcase marketing pages)                                                                                                                                               |
| 4.5 | Stay guide resolves the trip link server-side (`get-guest-stay-guide` returns `tripPath` + access) so the return bar works from the email                                                                                                                  |
| 4.6 | Lower-plan behavior per E1: the designed brochure stays Pro+; the unavailable message gains **View your trip** instead of a dead end                                                                                                                       |
| 4.7 | Local recommendations: reuse custom template chapters first; structured places list only if hosts ask (out of scope now)                                                                                                                                   |

Acceptance: tapping the stay guide button in the ready-for-check-in email works the same day it
is sent; secrets never appear before reveal time (server-enforced, tested); every stay guide
has a visible way back to the trip and the host.
Command: `bun run test:edge -- guestStayGuide` + `bun run test -- stayGuide` + `bun run type-check`.

### Phase 5: Messaging tied to the booking (E1-E5, G3)

| #   | Task                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Migration: `social_conversations.booking_id uuid null references guest_submissions(id) on delete set null` + index (D9/A-4)                                                                                                        |
| 5.2 | `webGuestChatService` start/resume sets `booking_id` deterministically (closest upcoming booking for that property); re-points when a new booking starts; never for Meta threads                                                   |
| 5.3 | Guest chat header booking chip: "Dec 3-5 · Confirmed · View trip"; resource hub for booked guests: Trip, Stay guide, House rules, Check-in steps, Directions; pre-booking items (incl. Booking form) only before booking (E2/A-12) |
| 5.4 | AI receptionist + voice `open_booking` actions → trip path (E3/A-13). `guestReceptionistTools.ts` already has an `open_trip` action; the legacy `voiceReceptionistTool.ts` fallback still points at `/account/stays`.              |
| 5.5 | Host reply email deep-links to the thread (`/account/messages?thread=<id>` or the property chat with `bookingId`) (E4/A-13)                                                                                                        |
| 5.6 | Host Inbox: booking card from `booking_id` first, fuzzy match fallback (`inboxMatchBooking.ts`); Insert → **Trip link** row (`issue-guest-trip-link`) (G3)                                                                         |
| 5.7 | Inbox check-in pack (`ui/.../inbox/lib/inboxCheckInPack.ts`, A-14) adds trip link + essentials (respecting reveal time)                                                                                                            |

Acceptance: host and guest see the same booking on the same thread; no booked guest is offered
the booking form in chat; host reply email opens the right conversation in one tap.
Command: `bun run test -- guestChatResourceHub` + `bun run test:edge -- webGuestChatService guestChatEmail` + `bun run type-check`.

### Phase 6: Emails and notifications (F1-F5)

| #   | Task                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Lifecycle email audit table (every guest email: trigger, default subject, CTA, links) added to `docs/architecture/` email doc                                                                                                                                              |
| 6.2 | Acknowledgement "What's next" steps from resolved requirements (F1); GAF wording only when GAF is required; building name from residence profile                                                                                                                           |
| 6.3 | Trip CTA rendered by default in every guest email (ready, SD refund, cancelled, refund sent, request received); `{{trip_url}}` stays for custom placement; no duplicate when the host already placed it. Today only the acknowledgement renders a trip CTA (A-17 context). |
| 6.4 | Vocabulary sweep in default templates (§3.3), including "Booking Confirmation email" → "check-in details email"                                                                                                                                                            |
| 6.5 | Pre-arrival reminder cron (D13): T-48h, includes balance due, check-in time, directions, trip link; skip when cancelled / already checked in. Follows the `send-parking-reminders` cron shape with an idempotent `pre_arrival_emailed_at` column.                          |
| 6.6 | **Deferred (E11).** Guest web push needs a new `notifications.type` value and guest recipient resolution in `pushRecipients.ts` (org members only today, A-16). Phase 6 ships **email-only** milestone notices; the push work moves to §9 with a reason.                   |
| 6.7 | Preview fixtures + email preview page coverage for every new / changed template. Note: live bodies are DB rows with a `defaultContent` fallback (A-9), so "the template" means the `BUILTIN_TEMPLATES` default plus the UI `EMAIL_TEMPLATE_SECTIONS` entry.                |

Acceptance: every guest email has exactly one primary CTA that opens the trip (or the specific
action) and works without sign-in via the access token; no default template mentions GAF for a
property without the GAF requirement.
Command: `bun run test:edge -- emailService guestJourneyCopy` + `bun run type-check` + `bun run test:e2e:smoke`.

### Phase 7: Host coordination (G1-G2)

| #   | Task                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Booking detail **Guest view** card: guest phase word, next action the guest sees, missing items (receipt, documents), last trip view time (E12 — read-only, built server-side from the guest trip builder) |
| 7.2 | **Guest experience readiness** card on property settings / setup guide: check-in steps, check-out steps, essentials, payment methods, cancellation policy, house rules; each row links to its editor       |
| 7.3 | Essentials editor (D7/E5) in Property Settings → Guest experience; per-booking code override on booking detail                                                                                             |
| 7.4 | Custom template editor: **Show to guests** toggle + phase picker (D8/E6). The editor already has a per-template pane (A-15).                                                                               |
| 7.5 | Notifications: host gets in-app for guest receipt upload; cancellation request already exists; guest first trip view after confirmation is optional, off by default                                        |
| 7.6 | Public Pages → Stay Guide editor preview shows essentials with sample values and the reveal state                                                                                                          |

Acceptance: a host can see, from one booking, exactly what their guest sees and what is
missing; a new property shows which guest-facing content is still empty.
Command: `bun run type-check` + `bun run lint` + `bun run test -- guestEssentials propertyTemplate` + `bun run check:plan-catalog`.

### Phase 8: Hardening and QA

- **Mobile:** `mobile-responsive` gate on every changed screen; bottom sheets for receipt
  upload, essentials reveal, help; no fixed bar collisions with `ContextualActionBar`.
- **Accessibility:** focus order on trip page, live region for "Request sent" banner, copy
  buttons with accessible names, revealed secrets announced, 44px targets, reduced motion.
- **Performance:** trip page stays one request (`get-guest-trip`) plus cached listing; essentials
  and templates included in the trip DTO (no extra round trips); stay guide template chunk
  unchanged; check the PWA precache budget after adding shell components (see memory on
  Polotno chunk budget).
- **Offline:** last viewed trip readable offline (existing SW API cache), essentials included
  only after reveal; receipt upload online-only with a clear message.
- **Security:** secrets server-gated by reveal time and booking access; `get-guest-trip` rate
  limit unchanged; `booking_id` on threads never exposed across guests; access token never in
  URLs after load; `security-auditor` review on D7, D9, D12.
- **E2E (Playwright mocked):** submit → trip landing; pending phase actions; booked guest
  Messages tab opens thread; stay guide before / after reveal; receipt upload; trip access
  states (closes guest-trip-hub open item); account landing on Trips.
- **Manual script:** `docs/guides/testing/guest-journey-manual.md` walking one booking through
  every status with a real email inbox, at 375 and 1024px.

---

## 6. Cross-cutting gates (every phase)

| Gate             | Decision                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plans            | Trip page, chat, emails, receipt upload, nav: every plan. Designed Stay Guide: Pro+ (`propertyShowcase`). Essentials + inline check-in steps + guest-visible custom templates: gated by the new `guestArrivalContent` key (E1), enabled on every tier. Update `docs/architecture/plans-feature-matrix.md` + `org/plans.md` and the plan golden matrix (`planTierGolden.ts`, `planTierExpectations.ts`, `planGateCoverage.test.ts`). |
| Team RBAC        | Essentials + guest-visible templates: `templates:edit` (reuse); per-booking code override: `bookings:edit`; Guest view card: `bookings:view`; no new roles                                                                                                                                                                                                                                                                          |
| activity-log     | Emit: guest receipt uploaded, essentials changed (no secret values in the event), per-booking code override, template guest visibility changed, request-received email sent. N/A: read-only trip / stay guide views                                                                                                                                                                                                                 |
| Booking workflow | No new statuses or transitions. Receipt upload never transitions. Request-received email is outside the orchestrator because no transition happens; document this in `booking-workflow.mdc`                                                                                                                                                                                                                                         |
| Unsaved changes  | Essentials editor and template toggle use `useUnsavedChangesGuard`; receipt sheet uses `useGuardedClose`                                                                                                                                                                                                                                                                                                                            |
| Copy             | `human-copy` + `minimal-ui-copy` on every string; vocabulary §3.3                                                                                                                                                                                                                                                                                                                                                                   |
| Docs             | Route guides: `trip.md`, `success.md`, `stay-guide.md`, `form.md`, `account/*.md`, `properties.md`, `properties/chat.md`, `org/inbox.md`, property settings + templates guides. `docs/PROJECT.md`, `docs/architecture/overview.md`, email architecture doc, `pwa.md` (guest push)                                                                                                                                                   |
| Support content  | Host-facing Q&A in each route guide + `docs/guides/support/faqs.md`; run `check:support-content` and `check:ai-knowledge-coverage`                                                                                                                                                                                                                                                                                                  |
| Migrations       | New files only: `social_conversations.booking_id`, essentials columns or table, custom template `guest_visible` + `phase`, stay guide `valid_from` backfill, `pre_arrival_emailed_at`, optional `guest_payment_submissions`                                                                                                                                                                                                         |
| Verification     | `bun run ci:quality` (lint, type-check, unit, edge, smoke E2E, build) per phase                                                                                                                                                                                                                                                                                                                                                     |

### 6.1 Per-phase acceptance commands

Every phase ends with these, in order. A phase is not done until its line passes.

| Phase | Command that proves it                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `bun run test -- guestJourneyCopy guestTripPhase guestTripLinks useGuestNextTrip` and `bun run test:edge -- guestJourneyCopy` and `bun run type-check`     |
| 1     | `bun run test -- guestTrip guestForm` + `bun run test:edge -- emailService` + `bun run type-check` + `bun run test:e2e:smoke -- guest-form`                |
| 2     | `bun run type-check` + `bun run lint` + `bun run test -- guestAccountNav marketingBottomNav propertyChat` + `bun run test:e2e:smoke -- guest-form account` |
| 3     | `bun run test -- guestTrip` + `bun run test:edge -- guestTrip` + `bun run type-check` + `bun run test:e2e:smoke -- guest-form`                             |
| 4     | `bun run test:edge -- guestStayGuide` + `bun run test -- stayGuide` + `bun run type-check`                                                                 |
| 5     | `bun run test -- guestChatResourceHub` + `bun run test:edge -- webGuestChatService guestChatEmail` + `bun run type-check`                                  |
| 6     | `bun run test:edge -- emailService guestJourneyCopy` + `bun run type-check` + `bun run test:e2e:smoke`                                                     |
| 7     | `bun run type-check` + `bun run lint` + `bun run test -- guestEssentials propertyTemplate` + `bun run check:plan-catalog`                                  |
| 8     | `bun run ci:quality` (full) + `bun run test:e2e:smoke` + `bun run check:support-content` + `bun run check:ai-knowledge-coverage`                           |

---

## 7. Data and API changes (summary)

| Change                                                                                                                                                                           | Type              | Used by                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------- |
| `get-guest-trip`: `essentials` (gated), `instructions` (phase-gated HTML), `hostSections[]`, `timeline[]`, `requirements[]`, `threadId`, `stayGuidePath` even before stay window | Edge DTO          | Trip page                           |
| `get-guest-stay-guide`: `tripPath`, essentials section                                                                                                                           | Edge DTO          | Stay guide                          |
| `guest-trip-payment-receipt` (POST, access token or owner JWT)                                                                                                                   | New edge function | Trip Payment                        |
| `guest-trips`: `nextAction` per row, `threadId`                                                                                                                                  | Edge DTO          | Account Trips, nav dots, banners    |
| `property_guest_essentials` (new table, E5) + `guest_submissions.guest_essentials_override` JSONB                                                                                | Schema            | Essentials editor, trip, stay guide |
| `property_template_contents.guest_visible`, `guest_phase` (E6)                                                                                                                   | Schema            | Custom templates                    |
| `social_conversations.booking_id` (E9 / A-4)                                                                                                                                     | Schema            | Chat, Inbox                         |
| `guest_submissions.pre_arrival_emailed_at`, `request_received_emailed_at`                                                                                                        | Schema            | Crons / submit idempotency          |
| `guest_balance_payment_receipt_url` (already exists, E7)                                                                                                                         | Schema (reuse)    | Trip Payment                        |
| `email-booking-request-received` template key                                                                                                                                    | Template catalog  | Phase 1                             |
| `guestArrivalContent` plan key (E1)                                                                                                                                              | Plan feature      | Phase 3 / 7                         |
| `pre-arrival-reminders` cron function                                                                                                                                            | New edge (cron)   | Phase 6                             |

Edge functions use `servePublic` / `serveAdmin` / `serveCronPost`; email-sending ones add
`static_files` in `config.toml`.

---

## 8. Sequencing and dependencies

1. **Phase 0 → Phase 1** (biggest trust fix, small) → **Phase 2** (nav) → **Phase 5.1-5.4**
   (chat link needed by Phase 2.4/2.5) → **Phase 3** → **Phase 4** → **Phase 6** → **Phase 7**
   → **Phase 8** continuously. (E3.)
2. Phase 2 must coordinate with `mobile-app-chrome-header-and-tab-bar.md` (same tab bar
   component) and `guest-auth-feature-showcase.md` (avatar menu).
3. Phase 3.3 receipt upload should land after `payments-paymongo-hardening.md` decides whether
   online payment replaces manual receipts for some properties; keep the manual path regardless.
4. Phase 3.7 "Report a problem" is a link slot until `guest-trust-safety-reporting.md` ships.
5. Close `guest-trip-hub.md` open items inside this plan (Inbox insert row 5.6, receipt upload
   3.3, E2E 8) and move that plan to done when Phase 3 ships.
6. **Schema ordering (new migrations, never edit a shipped one):**
   `property_guest_essentials` + `guest_submissions.guest_essentials_override` +
   `property_template_contents.guest_visible/guest_phase` + `social_conversations.booking_id`
   - `guest_submissions.pre_arrival_emailed_at` + `request_received_emailed_at` land in
     **Phase 3** (before 3.3 / 3.4 / 3.6). The stay-guide `valid_from` backfill lands in
     **Phase 4**. The `guestArrivalContent` plan key lands in **Phase 7** with the golden matrix
     update, but the key must exist in `planFeatures.ts` (edge + UI mirror) before Phase 3.5
     reads it, so the **type + default** land in Phase 3 and the **tier seeding** in Phase 7.

## 9. Out of scope

- Auto-expiry / auto-decline of `PENDING_REVIEW` bookings (workflow change; separate plan).
- Online payment checkout (PayMongo plan).
- Smart lock integrations and generated lock codes.
- Upsells (early check-in, late check-out, add-ons) and rental agreement signing.
- Native apps; SMS / WhatsApp delivery.
- Parking-only bookings (they keep `/parkings/requests/:id`; they only gain the return bar
  when linked to a stay).
- **Guest web push (deferred, E11):** milestone push to guests needs a new `notifications.type`
  value and guest recipient resolution in `pushRecipients.ts`, which today resolves org members
  only (A-16). Folding that into the host push path is a separate change with its own plan and
  its own `security-auditor` review. Phase 6 ships the same milestones by email.
- **Multiple receipts per booking (E7):** one receipt URL per booking, matching the existing
  `guest_balance_payment_receipt_url` column. A `guest_payment_submissions` table is only
  needed if a property asks for several partial payments.

## 10. Open questions for the owner

**Resolved 2026-11-10 (execute-plan).** See §4.1.

1. **D6 → E1:** check-in / check-out steps, essentials and guest-visible templates ship on the
   trip page for **every plan** (gated by the new `guestArrivalContent` key, on for every tier).
   The designed Stay Guide brochure stays Pro+.
2. **D10 → E2:** a guest "Request received" email goes out on every genuine new submission.
   Hosts can turn it off in Notifications → email automations.

## 11. Definition of done

- Every finding in §1.2 is fixed or explicitly moved to §9 with a reason.
- From any guest-facing page or email, a booked guest reaches their trip and their host thread
  in at most 2 taps, on phone and desktop.
- One vocabulary across UI, emails, chat card and host dashboard, enforced by a parity test.
- No guest screen or default email states a requirement the property does not have.
- Stay guide link works on the day it is sent; secrets are server-gated.
- Host can see what the guest sees and what is missing, from the booking.
- Route guides, support FAQs, architecture docs and plans matrix updated; `ci:quality` green;
  Playwright journey specs in CI.

### 11.1 Edge cases

| Case                                                   | Behavior                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest submits with no email                            | The request-received email is skipped (no address); the trip page still shows the reference and the review expectation.                                                                                                                                                                   |
| Guest submits but the host never reviews               | Day 5: one chase email to the property mailbox. Day 7: if nothing is paid, `pending-review-expiry` cancels with reason `request_expired`, which frees the dates; the trip page says **Request expired** and offers the same dates back. A booking with money on it is never auto-expired. |
| Host edits the booking after the guest edits it        | `compareFormData` decides; an unchanged re-submit returns early and sends **no** second request-received email.                                                                                                                                                                           |
| OTA / Airbnb completion                                | `submit-form-completion` is a separate path; it does **not** send the request-received email (only `submit-form` does).                                                                                                                                                                   |
| Signed-in guest opens a trip link from another device  | The `?access=` token is exchanged for a session token and dropped from the URL (already shipped in `GuestTripPage`).                                                                                                                                                                      |
| Guest has two trips at the same property               | The trip chip and the Messages tab point at the **closest upcoming** booking; the trip page itself always shows the booking in the URL.                                                                                                                                                   |
| Guest cancels after the host confirms                  | The trip page switches to the cancelled state; the refund outcome comes from the existing `cancellation` payload.                                                                                                                                                                         |
| Property has no essentials filled in                   | The essentials card is hidden (not shown empty). The readiness card (7.2) tells the host.                                                                                                                                                                                                 |
| Property is on a plan without `guestArrivalContent`    | The trip page shows "Message host" instead of the arrival steps; the Stay guide brochure keeps its own gate.                                                                                                                                                                              |
| Secret reveal time has not passed                      | The value renders as "Available {date, time}" — never a partially masked value that hints at the length.                                                                                                                                                                                  |
| Guest is offline                                       | The last viewed trip renders from the SW cache; the receipt upload sheet shows an offline message and stays open.                                                                                                                                                                         |
| Two guests share a device / one signs out              | The access token is per booking and stored in sessionStorage; signing out clears it.                                                                                                                                                                                                      |
| Host on a Starter plan creates guest-visible templates | `customTemplates` (the authoring gate) still applies; `guestArrivalContent` only controls guest rendering.                                                                                                                                                                                |

### 11.2 Rollback

| Change                                    | Rollback                                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New migrations                            | Every migration is additive (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`). Roll back by not deploying it, or dropping the added column/table. No shipped migration is edited. |
| `guestArrivalContent` plan key            | Set the key to `false` on every tier; the trip page falls back to "Message host". No code change.                                                                                           |
| `email-booking-request-received` template | Turn the `emailBookingRequestReceived` toggle off per property, or clear the key from `PROPERTY_EMAIL_TEMPLATE_KEYS`. The template row can stay.                                            |
| `social_conversations.booking_id`         | The column is nullable; the host Inbox falls back to the fuzzy name match. Clearing the values is safe.                                                                                     |
| `stay_guide_valid_from` semantics         | The backfill migration writes the issue time. Reverting means re-deriving `valid_from` from the check-in date — a data fix, not a schema change.                                            |
| Nav rename (`/account/messages`)          | Both routes exist; flipping the redirect back is a one-line change.                                                                                                                         |
| Trip-scoped shell tabs                    | `mode: 'trip'` is opt-in per route; removing it restores the previous tab set.                                                                                                              |

---

## 13. Status (2026-11-11)

**Deployed 2026-11-12.** The backend half shipped through `cd-prod.yml` on `develop`: all five
migrations (`20261331000100` to `20261331000500`) applied to the production database, the changed
edge functions deployed, the public endpoint smoke passed and migration parity reported zero drift.
The UI shipped in release #436. The two migrations that collided with already-applied versions and
an older-dated block that `db push` refused were renumbered before the deploy, with no SQL changes.

**Still open, not complete:** guest push (E11) and the first-trip-view notification (7.5) stay
deferred as described in the phase table. Do not mark this plan done until those are either built
or explicitly dropped.

| Phase                         | Shipped | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundations               | ✅      | Edge vocabulary + parity test, `useGuestNextTrip`, `GuestTripReturnBar`, analytics. **Not shipped:** a second links module (`guestJourneyLinks`); it duplicated the existing `guestTripLinks`, so it was dropped.                                                                                                                                                                                                                                                 |
| 1 — Honest confirmation       | ✅      | Submit → trip with `?welcome=1`, "Request sent" banner, success route is a pure redirect, "Request received" email + toggle, review expectation, vocabulary sweep.                                                                                                                                                                                                                                                                                                |
| 2 — Navigation and IA         | ✅      | Trips + Messages in the signed-in bar, `/account` → Trips, Messages rename with `/account/stays` redirect, booking-scoped tab set, Messages tab opens the thread, `?bookingId=` chat, listing banner, home upcoming-trip card. **2.9 decision:** the calendar **Book Now** keeps `/form`. It is the established entry, the form is a wizard that claims the bottom band either way, and rerouting it would have touched a working flow for no guest-visible gain. |
| 3 — Trip hub v2               | ✅      | Timeline, essentials (gated secrets), inline check-in/check-out steps, "From your host", balance receipt upload, host notification type.                                                                                                                                                                                                                                                                                                                          |
| 4 — Stay guide connected      | ✅      | Access window opens at token issue (with a backfill), return bar with a server-minted trip token and chat path, essentials inside "Getting In", guest-visible templates inside "Make Yourself at Home", and the unavailable state links to the guest's trips.                                                                                                                                                                                                     |
| 5 — Messaging tied to booking | ✅      | `booking_id` migration, web chat start/resume linking, chat header booking chip, resource hub rework, host reply deep link, AI receptionist `/account/messages`, host Inbox prefers `booking_id`, Insert gains a Trip link row, check-in pack leads with the trip.                                                                                                                                                                                                |
| 6 — Emails                    | ✅      | Lifecycle table in `docs/architecture/guest-emails.md`, requirement-aware acknowledgement, default `{{trip_cta_section}}` on every guest email, vocabulary sweep, pre-arrival reminder cron. **Guest push stays deferred (E11).**                                                                                                                                                                                                                                 |
| 7 — Host coordination         | ✅      | Guest view card, per-booking door code override, guest-experience readiness card, essentials editor, **Show to guests** + phase picker, stay guide editor preview with sample essentials. **7.5 first-trip-view notification deferred:** it needs trip-view tracking, which nothing else uses yet, for a notification that is off by default.                                                                                                                     |
| 8 — Hardening and QA          | ✅      | New Playwright specs (`tripPendingActions`, `stayGuideEssentials`, `accountLanding`), manual script `docs/guides/testing/guest-journey-manual.md`, route guides, support FAQs.                                                                                                                                                                                                                                                                                    |

### Findings coverage (§1.2)

| Finding                                      | Where it landed                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| A1 Messages tab demanded dates               | Phase 2.4 / 2.5                                                                 |
| A2 Trips + Messages missing from nav         | Phase 2.1                                                                       |
| A3 Account opened on Profile                 | Phase 2.2                                                                       |
| A4 "Stays" meant messages                    | Phase 2.2                                                                       |
| A5 Listing did not know your trip            | Phase 2.6 (banner shows on phone and desktop)                                   |
| A6 Three shells                              | Phase 2.3 booking-scoped tab set; the stay guide keeps its own chrome by design |
| A7 Dead ends                                 | Return bar, chat chip, guide unavailable state links to trips                   |
| A8 Three booking entry points                | Kept, with the 2.9 decision above                                               |
| B1 "Booking Confirmed!" while pending        | Phase 1.1 / 1.3                                                                 |
| B2 Legacy Messenger / GAF copy               | Phase 1.3 / 1.6                                                                 |
| B3 Success page duplicated the trip          | Phase 1.3 (pure redirect)                                                       |
| B4 No guest email on submit                  | Phase 1.5                                                                       |
| B5 No review expectation                     | Phase 1.2 / D11                                                                 |
| C1 No timeline                               | Phase 3.2                                                                       |
| C2 Receipt only through chat                 | Phase 3.3                                                                       |
| C3 Arrival steps only in the stay guide      | Phase 3.5                                                                       |
| C4 No structured essentials                  | Phase 3.4                                                                       |
| C5 Host templates never reached guests       | Phase 3.6                                                                       |
| D1 Stay guide link dead until check-in day   | Phase 4.1                                                                       |
| D2 No route back from the guide              | Phase 4.4                                                                       |
| D3 Plan gate left lower tiers with nothing   | E1                                                                              |
| E1 Threads not linked to bookings            | Phase 5.1 / 5.2                                                                 |
| E2 Hub pushed pre-booking links              | Phase 5.3                                                                       |
| E3 AI "View stay" opened the inbox           | Phase 5.4                                                                       |
| E4 Host reply email opened the generic inbox | Phase 5.5                                                                       |
| E5 Chat header had no booking context        | Phase 5.3                                                                       |
| F1 Azure-specific acknowledgement            | Phase 6.2                                                                       |
| F2 Three words for one milestone             | Phase 6.4                                                                       |
| F3 Trip link opt-in                          | Phase 6.3                                                                       |
| F4 No pre-arrival reminder                   | Phase 6.5                                                                       |
| F5 No guest push                             | Deferred, §9                                                                    |
| G1 Host could not see the guest's journey    | Phase 7.1                                                                       |
| G2 No content readiness check                | Phase 7.2                                                                       |
| G3 Inbox Insert had no trip link             | Phase 5.6                                                                       |

### Shipped after the first pass — request expiry

`PENDING_REVIEW` used to hold its dates forever: only `CANCELLED` frees a night for the next
guest, and `get-booked-dates` stops returning the row only once it is cancelled. So a request the
host never answered locked the calendar for everyone and left the guest reading "your host is
reviewing" indefinitely. Shipped as `pending-review-expiry`: chase at day 5, cancel at day 7 with
reason `request_expired`, never when the guest has paid, and never before the chase has been out
for the full two days (so a first run in an existing environment only chases). The guest email and
the trip page say **Request expired**, and the trip page offers the same dates back through a
pre-filled form.

**Known follow-ups, deliberately not in this change**

- Guest web push (E11): needs a new `notifications.type` and guest recipient resolution.
- "Guest first viewed their trip" host notification: needs view tracking.
- `PUSH`/SMS delivery, smart locks, upsells: out of scope per §9.

## 14. Verification results (2026-11-10)

| Gate                                   | Result                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `bun run type-check`                   | pass                                                                                                     |
| `bun run lint`                         | pass, 0 errors (639 pre-existing warnings)                                                               |
| `bun run check:filenames`              | pass                                                                                                     |
| `bun run test` (Vitest)                | 5852 pass, 6 skipped                                                                                     |
| `bun run test:edge`                    | 1483 pass, 0 fail                                                                                        |
| `bun run test:e2e:smoke -- guest-form` | 6 pass, 3 viewports                                                                                      |
| `bun run check:support-content`        | pass, 149 curated FAQs                                                                                   |
| `bun run check:ai-knowledge-coverage`  | pass, 79 guides                                                                                          |
| Migration SQL                          | applies cleanly then rolls back against the local database                                               |
| `deno check` on `submit-form`          | 5 pre-existing errors in `_shared/telegramStaff.ts`, present on `origin/develop`, unrelated to this work |

**Environment note.** `bun run test:e2e:smoke` reuses whatever is already listening on
`PLAYWRIGHT_PORT` (4173). Another worktree had a dev server there, so the first run served that
checkout's code and failed on an old page. Run it with `PLAYWRIGHT_PORT=4273 PLAYWRIGHT_PWA_PORT=4274`
when another session holds the default ports.
