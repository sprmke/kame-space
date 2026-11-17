---
title: 'Audit 01: guest experience'
status: active
tags: [audit, guest, ux]
updated: 2026-11-18
---

# 01: Guest experience (operational flows)

Scope: the property-scoped guest flows and their states. Marketing/public listing pages are in
[07-marketing-and-account.md](./07-marketing-and-account.md).

Routes exercised: `/properties/kame-home/calendar`, `/properties/kame-home/form` (all 5 steps and a
real submit), `/properties/kame-home/trip?bookingId=…` (with and without `?access=`),
`/properties/kame-home/stay-guide`, `/properties/kame-home/showcase`,
`/properties/kame-home/sd-form?bookingId=…`, `/properties/kame-home/guest-review`,
`/parkings/monaco-level-2-slot-27/form`, `/properties/kame-home/document`, plus the legacy
`/?bookingId=` redirect. All at 1440 and 390.

---

## P1

### G1. Guest submit surfaces raw server internals

With a missing edge secret the guest sees:

> Could not submit form
> Failed to process form data: IDENTITY_HASH_PEPPER is required
> Copy your form below and share with your host so we can help. Sorry!

[screenshots/18-guest-form-submit-internal-error.png](./screenshots/18-guest-form-submit-internal-error.png)

The recovery affordance ("Copy Booking Information") is good. The error body must be generic
("We could not save your request. Try again, or send your details to the host"), with the real
message going to Sentry and the edge log. Any `*_required` / env var string reaching a guest is both
a leak and confusing.

### G2. SD refund form has no way forward when the token is missing

`/properties/kame-home/sd-form?bookingId=<PENDING_SD_REFUND booking>` answers 404 and renders
"Form not available. Please use the link from your email or contact us on Facebook." The only action
is **Back to home**. A guest who lost the email has no in-product path: no "resend my link", no
"message my host", no link to their trip. 404 for enumeration reasons is fine; the dead end is not.
[screenshots/29-sd-form-unavailable.png](./screenshots/29-sd-form-unavailable.png)

### G3. Stay guide "missing access" state is unbranded and off-pattern

The no-access state is a gray card floating on plain white with no header, logo, nav or footer, while
every other guest state uses the teal property shell. It reads as a broken page rather than an
intentional guard.
[screenshots/28-stay-guide-no-access.png](./screenshots/28-stay-guide-no-access.png)

### G4. Parking request page renders empty avatars

Two places on `/parkings/:slug/form` show an empty white circle where the parking photo belongs: the
header chip and the floating card avatar. There is no initial, icon or brand fallback when the image
is missing or 404s. Same empty hero on `/parkings` and `/parkings/:slug`.
[screenshots/27-parking-form-broken-avatar.png](./screenshots/27-parking-form-broken-avatar.png)

---

## P2

### G5. Desktop calendar and form are a narrow phone card

At 1440 the check-availability card is ~575px wide, centered on a mostly empty page, with a 250px
teal band above and a floating circular photo half-overlapping the card. The same layout scaled up
would be fine with a two-column composition (property summary, price, reviews next to the picker).
There is no price per night anywhere in the calendar step, so a guest cannot see cost before
committing to the form.
[screenshots/16-guest-calendar-desktop.png](./screenshots/16-guest-calendar-desktop.png)

### G6. Booked vs selected vs blocked dates are hard to tell apart

Booked nights render as pale gray rounded blobs; the selected date is a teal outline; today is a dot.
There is no legend on the guest calendar. First-time guests will tap a booked night and get no
explanation.
[screenshots/21-guest-calendar-mobile.png](./screenshots/21-guest-calendar-mobile.png)

### G7. No way back to the listing from calendar/form

The header shows the property photo and name but not as a link, and there is no breadcrumb. On mobile
the bottom nav has "Property", but on desktop the only exits are the browser back button or the logo
(which returns to marketing home). Date pickers in the form also have no "change dates" affordance
back to the calendar.

### G8. Desktop form drops the "n / 5" progress text

Mobile shows "Guest 1/5" plus a progress bar; desktop shows only five step circles with no
"step x of y" label and no completion count. Desktop users get less orientation than phone users.

### G9. Developer controls sit inside the guest payment step

The payment step renders a full "Developer controls" panel (Save data, Storage, Send email, Paste
Booking Info, Generate New Data). It is gated to non-production builds, which means **any Vercel
preview deployment shows it to real testers and stakeholders**. It also dominates the visual
hierarchy of the final step, where the guest should be looking at the downpayment amount and the
receipt upload.

### G10. "A receipt is on its way" is asserted even when email cannot send

After submit, the trip page banner says "A receipt is on its way to <email>. Most hosts reply within
a day." Locally no provider is configured, so nothing was sent. In production a Resend failure (or a
suppressed address) would still show this. Prefer a neutral "We'll email you the details" or make the
banner conditional on a successful send acknowledgement.

### G11. Trip page: "What happens next" has no completion state

Both steps render an identical hollow circle, including the step already done ("Your host reviews the
request" is in progress). A done/current/upcoming treatment would make the 5-step progress meaningful.

### G12. Guest review and document routes have no in-page fallback

`/properties/kame-home/document` and `/properties/kame-home/guest-review` both demand a token in the
URL. Opening them without one produces either a redirect to marketing or an empty state with no
explanation of what the link is for. Consider a single shared "this link needs to come from your
email" screen with "Resend link" and "Message host".

### G13. There are two different booking funnels, and the modal one hides the stay

The documented path is property calendar to `/properties/:slug/form` (full page). The actual path from
a listing is: **Reserve** on `/properties/kame-home` opens a "Select check-in date" dialog, then
**Continue** opens the GAF as a **modal on the same page** (URL never changes to `/form`). The modal:

- never shows the selected dates or the number of nights (the date dialog closes and the summary is
  gone),
- has no "Guest 1/5" progress indicator, unlike the full-page form,
- is a centered dialog on desktop and needs the mobile bottom-sheet treatment.

Two funnels with different chrome for the same job means two places to fix validation, drafts and
analytics. Pick one (the modal is the better discovery path; it needs the stay summary and the step
rail).
[screenshots/58-reserve-date-dialog.png](./screenshots/58-reserve-date-dialog.png),
[screenshots/59-guest-form-modal-no-summary.png](./screenshots/59-guest-form-modal-no-summary.png)

---

## P3

- The form's step name "Guest Advise Form" (GAF) is jargon for a first-time guest; the step rail says
  "Guest" so the mismatch is mild.
- The payment step shows two bank/GCash blocks with account name and number but no copy-to-clipboard
  control (the SD refund form has copy buttons, so the pattern exists).
- "Nationality" and "Address" are free-text with no autocomplete; address especially will be typed
  inconsistently.
- The mobile form's inputs are ~40px tall and 14px text, which triggers iOS zoom-on-focus for inputs
  unless the `16px on iOS` rule actually applies (see cross-cutting A11).
- After submit the guest lands on `/properties/:slug/trip?bookingId=…&welcome=1`, not `/success`.
  `/success` still exists and is still linked from docs; confirm which one is canonical and retire or
  redirect the other.

---

## What works

- Submit, redirect and trip rendering work end to end once the secrets are present. The trip page is
  clear, has the right primary action ("Message host") and answers "what next" without a support
  link.
- Step gating is sensible: parking and pets steps explain that they are optional and why.
- The cancellation policy block states the exact deadline date, not just "3 days".
- Receipt upload, replacement and validation are obvious, and the dev-only random data generator
  saved a lot of clicking during this audit.
- Mobile bottom nav (Property / Calendar / Messages, Trip / Messages / Listing) is consistent and
  thumb-reachable.

---

## Coverage

| Route                                  | Desktop | Mobile | Notes                         |
| -------------------------------------- | ------- | ------ | ----------------------------- |
| `/properties/kame-home/calendar`       | yes     | yes    | no price preview, no legend   |
| `/properties/kame-home/form` (5 steps) | yes     | yes    | submitted a real booking      |
| `/properties/kame-home/trip`           | yes     | yes    | with and without access token |
| `/properties/kame-home/stay-guide`     | yes     | yes    | no-access state only          |
| `/properties/kame-home/showcase`       | yes     | yes    | template render               |
| `/properties/kame-home/sd-form`        | yes     | yes    | 404 state                     |
| `/properties/kame-home/guest-review`   | yes     | yes    | token-gated                   |
| `/properties/kame-home/document`       | yes     | yes    | token-gated                   |
| `/parkings/:slug/form`                 | yes     | yes    | empty avatar                  |
| `/?bookingId=` legacy redirect         | yes     | yes    | redirects correctly           |
