---
title: 'Audit 11: listing lifecycle (property, parking, development)'
status: active
tags: [audit, listings, properties, parkings, developments]
updated: 2026-11-19
---

# 11: Listing lifecycle

Create → configure → submit for verification → approve/reject → publish → pause → archive → restore
→ delete, at org, property, parking and platform-admin level, with the guest-facing propagation
checked for each transition. Test listings were deleted afterwards; `kame-home` is `ACTIVE`.

Screenshots: `/tmp/audit/listing-screens/` (59 files).

---

## P0

### L1. Every listing-authorization action returns 500 **after** committing

`submit-listing-authorization`, `approve-listing-authorization` and `reject-listing-authorization`
all call `capturePostHogEvent({ distinctId: context.user.id })`, but `loadListingContext()` returns
`{ listingKind, listing, org, authorization }` with **no `user`**. The call throws a TypeError:

- the state has already been saved (`saveListingAuthorization`) and, for approve, the property/parking
  is already activated,
- the wrapper turns the TypeError into a 500,
- the admin or host sees "Something went wrong",
- retrying answers "This listing is not pending review".

So verification submits, approvals and rejections all _work_ while reporting failure. This is the
single worst reliability bug found in phase 2: it destroys trust in the verification flow and makes
every success look like a retryable error.

Fix: pass the authenticated user into `loadListingContext` (or use the request actor already verified
by `verifySuperAdminJwt`), and add a handler test asserting 200 + state change for all three actions.

### L2. Old listing links break after a rename

`get-public-property` (and parking/development equivalents) answer a historical slug with:

```
301 Location: /properties/<new-slug>
```

The `Location` is **relative**, and the caller is a browser `fetch` from the app origin. The browser
resolves it against the Supabase functions origin, the request fails CORS, and the guest is dumped on
the generic listings grid. Crawlers are redirected to the API domain instead of the page. The
documented promise ("Renaming the property changes this link. Old links keep working.") is false.

Fix: return an absolute app-origin URL (`PUBLIC_GUEST_APP_ORIGIN` is already an env var), or handle the
redirect in the SPA route by looking up `listing_slug_redirects` before rendering 404.

---

## P1

### L3. A newly created listing cannot be published from the UI

A new property lands in `pending_verification` with `allowedActions: []`. The sidebar **Verification**
CTA that starts Tier 1 is gated on `org.accessKind === 'owner'`
(`ListingVerificationSidebarCta.tsx:70`), and a platform admin / scoped org admin is not `owner`. The
canonical local owner is `platform_admin` because of `ADMIN_ALLOWED_EMAILS`, so the CTA never renders,
nothing is submitted, and `/admin/approvals` stays empty.

Fix: show the CTA for `owner`, `platform_admin` and any org admin holding the listing authorization
leaf; keep the server check as the boundary.

### L4. Creating a property beyond the paid count creates an unbilled listing and hijacks the flow

Adding a third property to a plan that covers two:

- the property is created (`pending_verification`),
- it gets **0 rows** in `org_subscription_properties`,
- it counts in "Total properties" and in the guest-facing org page,
- the UI immediately routes the host to "Update billing" and blocks configuring or deleting the
  listing until they pay.

So there is a window where a real, visible listing is not billed, and the host is trapped in a billing
flow to escape it. Combine with B1 (checkout counts archived rows) and the property count becomes a
source of both over- and under-billing.

Fix: create the listing in a `draft` state that is hidden from guests and does not count until it is
enrolled, or require plan headroom before creation and show the price before the create button.

### L5. The 2-bedroom preset makes property settings unsaveable

`PropertyProfileSettingsSections.tsx:218` force-syncs the draft to the unit-type template on mount
(`markEdited: false`), so a 2br Azure North property becomes 8 adults / 3 children / 1 bathroom. Azure
North caps adults at 6, so **every save fails** with "Max adults must be between 1 and 6", even a
description-only edit (reproduced: toast text captured, PATCH rejected). The form also silently
rewrites the host's saved 4/2/6/2 values without marking the draft dirty.

Fix: only apply unit-type defaults when the host actively changes the unit type (not on load), and
clamp defaults to the residence cap.

### L6. Duplicate tower + unit can be created, and approving it archives the incumbent

Creating a second `Monaco 2604` while the first is `ACTIVE` succeeds. Approving the duplicate runs
`activatePropertyAfterListingApproval`, which archives the incumbent as `succession`. Nothing warns at
create time that the unit is taken.

Fix: unique constraint (org, tower, unit) for non-archived listings, or a hard confirmation that names
the incumbent.

### L7. Restore from archive returns the listing to Live, not Paused

The lifecycle spec and the UI copy say a restored listing comes back paused. In practice it returns
`ACTIVE` and bookable immediately. A host who archives, then restores, can receive bookings before
they re-check rates and availability.

### L8. Parking archive is a one-way door in the UI

Parking Danger Zone offers **Archive** and **Delete** only. `PATCH update-parking {status:"ACTIVE"}`
supports restore, but no surface exposes it, so an archived parking can never be brought back from the
dashboard.

---

## P2

| #   | Finding                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L9  | **Capacity desync between host and guest.** A unit-type change updates `settings.maxGuests` but not the `properties.max_guests` column (only sent when the Basic section is dirty). Observed `max_guests=4` vs `settings.maxGuests=8`; the public payload reads the stale column.                                         |
| L10 | **Development announcements render nowhere.** Azure North has an Active announcement; no public development page, listing page or host surface renders it.                                                                                                                                                                |
| L11 | **Listings with zero verification documents can be approved.** The review sheet shows "DOCUMENTS: Not provided" and still enables Approve; the only precondition is `baseStatus === 'pending'`.                                                                                                                           |
| L12 | **Copy settings writes states the editor forbids.** Copying `Monaco 2604` into another listing produced `unitTypeId=2br` with 4 adults, a combination manual editing rejects. The default group list also includes Team and Custom roles, and Telegram credentials, with no pre-copy diff.                                |
| L13 | **Approvals UI cannot show submission time** (listing rows "-", org rows "Invalid Date"), so queue age is invisible.                                                                                                                                                                                                      |
| L14 | **Org listing cards have no lifecycle actions.** The ⋯ menu is Open dashboard / Settings / Guest calendar / Copy guest link / Copy settings; pause, archive and delete live only in Settings → Listing status. "Copy guest link" copies `/calendar/<slug>`, not the public listing URL, and no "Copy public link" exists. |
| L15 | **Developments and parkings have no draft state.** A name-only development is ACTIVE, sitemapped and search-indexed instantly with an empty hero; parkings publish on create.                                                                                                                                             |
| L16 | **Public listing galleries have no alt text** (checked on the property gallery and parking photos).                                                                                                                                                                                                                       |
| L17 | **`/org/:slug/property/:slug/dashboard` 404s** (dashboard is the index route) and renders the guest 404 inside the admin shell.                                                                                                                                                                                           |
| L18 | **Rename-back does not restore the original slug** (the redirect table accumulates a chain), and `listing_slug_redirects` rows survive deletion of the listing.                                                                                                                                                           |

---

## What works

- **Archive guards**: archiving is blocked while open bookings exist, and the dialog names them.
- **Archive/delete side effects**: public detail, list, search, sitemap and billing enrollment all
  update correctly; activity events are written.
- **Public propagation**: text, photos, prices, amenities and SEO meta reach the guest page on save.
- **Paused listings refuse new form submissions** (`acceptingBookings:false` shows the closed notice
  and the detail page a warning), even though the Reserve button stays visually enabled.
- **Media validation**: MIME/size rules and storage cleanup work; replacement and deletion are clean.
- **Parking slot defaults** and the parking public page are consistent after edits.

## Coverage

| Object              | Create | Configure | Submit | Approve | Publish | Pause | Archive | Restore | Delete           |
| ------------------- | ------ | --------- | ------ | ------- | ------- | ----- | ------- | ------- | ---------------- |
| Property            | ✅     | ⚠ L5      | ❌ L1  | ❌ L1   | ⚠ L3    | ✅    | ✅      | ⚠ L7    | ✅               |
| Parking             | ✅     | ✅        | ❌ L1  | ❌ L1   | ⚠ L15   | ✅    | ✅      | ❌ L8   | ✅               |
| Development (admin) | ✅     | ✅        | n/a    | n/a     | ⚠ L15   | —     | —       | —       | ✅               |
| Listing beyond plan | ⚠ L4   | blocked   | —      | —       | —       | —     | —       | —       | ✅ after billing |
