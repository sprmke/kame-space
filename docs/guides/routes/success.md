---
title: 'Booking Success — operator guide'
status: active
tags: [guides, routes]
updated: 2026-11-10
---

# Booking Success — operator guide

Route: `/properties/:propertySlug/success?bookingId=` (legacy `/success?property=<slug>&bookingId=` redirects here)

> **Status:** Documented.

## Progress overview

| Section          | E2E save | Validation | Docs       | Notes                                                           |
| ---------------- | -------- | ---------- | ---------- | --------------------------------------------------------------- |
| Redirect         | ✅       | —          | Documented | Redirects to the trip page when the booking is known            |
| Booking summary  | —        | —          | Documented | Read-only; from `navigate` state                                |
| Brand header     | ✅       | —          | Documented | `get-guest-payment-info` logo                                   |
| Guard / redirect | ✅       | —          | Documented | Requires `bookingId`                                            |
| Mobile shell     | —        | —          | Documented | `MainLayout` bottom tab bar reappears here (no dominant action) |

---

## Overview

**Legacy confirmation page.** A new submission no longer lands here: the guest goes straight to
their [trip page](./trip.md) with `?welcome=1`, which shows a "Request sent" banner. This route
stays for old links and redirects to the trip when the booking is known.

The booking is still `PENDING_REVIEW` when the guest sees this page. Nothing here says
"confirmed" (plan §3.3 vocabulary).

---

## Host-facing knowledge

After a guest submits their booking form, they land on their trip page, which recaps their stay
dates, guest count and names, contact info, and pet info (if any). It also says the request was
received, that the host is reviewing it, and how long a wait to expect.

**Common host questions**

- Q: A guest says the trip page didn't show their booking details after they refreshed it.
  A: The trip page loads from the server, so a refresh still shows the full booking. If it shows
  "Booking not found", the guest should sign in with the email they booked with.
- Q: Does the trip page mean the booking is approved?
  A: No. It says "Request sent" until the host moves the booking on. Approval happens later.
- Q: What should the guest do after submitting?
  A: Wait for the "Request received" email, then watch for the confirmation email. They can edit
  or cancel the request from the trip page, or message the host.
- Q: The old confirmation page says "Next Steps" and mentions Messenger or Airbnb.
  A: Older links still show that page. New submissions do not.

---

## Page behavior

### Fields (booking summary card, when `navigate` state is present)

| Field                          | Source                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| Nights                         | Computed from check-in/check-out                                 |
| Check-in / check-out date+time | `bookingData.checkInDate/checkOutDate/checkInTime/checkOutTime`  |
| Guests (adults/children)       | `bookingData.numberOfAdults/numberOfChildren`                    |
| Guest names                    | `bookingData.primaryGuestName` + `guest2-5Name`                  |
| Contact                        | `bookingData.guestEmail`, `guestPhoneNumber`                     |
| Pet                            | `bookingData.hasPets` + `petName` (shown only if bringing a pet) |

### Load path

1. **New submissions never come here.** `GuestForm.onSubmit` navigates to
   `guestTripWelcomePath(propertySlug, bookingId)` → `/properties/:slug/trip?bookingId=…&welcome=1`.
2. **Legacy links:** if `?bookingId=` and the property slug are known, this page redirects to
   the trip page for that booking.
3. **No booking id:** redirects to the property's calendar page (or `/properties` if no property
   scope).
4. The summary card reads `location.state.bookingData`, which only exists right after a submit.
   On a direct load the card is omitted; the page still renders the brand header and "Next Steps".

### Behavior / edge cases

- **View your booking** opens the [trip page](./trip.md). The access token stored at submit lets
  anonymous guests in.
- The "Next Steps" copy tells the guest the host is reviewing the request and points them at the
  right channel (Airbnb, Facebook, or the trip page's message action) for questions. It never
  mentions GAF or a building administration, because not every property requires one.
- The guest still receives one email on submit: **Request received**. Hosts can turn it off in
  Notifications → email automations, and edit its body in the Templates workbench.

---

## API reference

| Action          | Endpoint                     |
| --------------- | ---------------------------- |
| Branding / logo | `GET get-guest-payment-info` |

---

## Implementation map

| Concern        | Path                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Page           | `ui/src/features/guest/form/components/GuestFormSuccess.tsx`                                      |
| Routes (wired) | `ui/src/features/guest/property/routes/index.tsx` (`propertyGuestRoutes`, `legacyGuestRedirects`) |
| Paths          | `ui/src/features/guest/lib/guestPublicPaths.ts` (`guestTripWelcomePath`)                          |

---

## Testing

| Layer | Path / spec                                             | Manual |
| ----- | ------------------------------------------------------- | ------ |
| E2E   | `guestFormSubmit.spec.ts` trip landing (`@smoke` `@ci`) | —      |

---

## Related docs

- [Route index](./README.md)
- [Guest Form](./form.md)
- [Trip](./trip.md)
- [`docs/PROJECT.md`](../PROJECT.md)

---

## Pending / follow-ups

- [ ] `ui/src/features/guest/form/routes/index.tsx` (`guestSuccessRoutes`/`guestFormRoutes`) is an **orphaned** route module — not imported by the app router. The route actually served comes from `ui/src/features/guest/property/routes/index.tsx`.
