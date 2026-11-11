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

| Section            | E2E save | Validation | Docs       | Notes                                                   |
| ------------------ | -------- | ---------- | ---------- | ------------------------------------------------------- |
| Redirect           | ✅       | —          | Documented | Forwards to the trip page whenever the booking resolves |
| Loading skeleton   | ✅       | —          | Documented | Only while a legacy link's property slug is resolved    |
| Slug resolution    | ✅       | —          | Documented | `resolveBookingPropertySlug` for links with no property |
| Not-found fallback | ✅       | —          | Documented | "We couldn't open this booking" + Your trips, Browse    |

The page renders **no booking content of its own**. It exists to forward old links, so there is
nothing to save, validate or lay out beyond the states above.

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
- Q: A guest opened an old confirmation link and ended up on their trip page.
  A: That is intended. Old confirmation links forward to the trip page, which is the single place
  for a booking.

---

## Page behavior

The component has four states and no other markup.

| State                    | When                                                       | Renders                                                                |
| ------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Redirect, property known | `?bookingId=` and the route already carries a property     | `navigate(tripPath, { replace: true })`, nothing painted               |
| Resolving slug           | `?bookingId=` from a legacy global link, no property scope | `PublicFullBleedPageSkeleton` labelled "Opening your booking"          |
| Redirect to calendar     | no `?bookingId=`                                           | `navigate(calendarPath, { replace: true })`, or `/properties`          |
| Not found                | slug resolution failed for the booking id                  | "We couldn't open this booking", **Your trips**, **Browse properties** |

### Load path

1. **New submissions never come here.** `GuestForm.onSubmit` navigates to
   `guestTripWelcomePath(propertySlug, bookingId)` → `/properties/:slug/trip?bookingId=…&welcome=1`.
2. **Legacy links with a property:** redirect straight to the trip page for that booking.
3. **Legacy global links** (`/success?bookingId=`): resolve the property from the booking, then
   redirect, or fall back to the not-found state.
4. **No booking id:** the guest is sent to the calendar for the property, or the listings index.

### Behavior / edge cases

- Every redirect uses `replace: true`, so Back does not bounce the guest between `/success` and
  the trip page.
- The not-found state offers **Your trips** (`/account/trips`) and **Browse properties**, so a
  guest with a dead link is never stuck.
- The old summary card, brand header, "Next Steps" copy and the parking CTA are gone. Parking now
  lives on the trip page as a **Find parking** shortcut while the host reviews (see
  [trip.md](./trip.md)).
- The guest still receives one email on submit: **Request received**. Hosts can turn it off in
  Notifications → email automations, and edit its body in the Templates workbench.

---

## API reference

| Action                | Endpoint                                             |
| --------------------- | ---------------------------------------------------- |
| Resolve property slug | `resolveBookingPropertySlug` (`get-public-property`) |

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
