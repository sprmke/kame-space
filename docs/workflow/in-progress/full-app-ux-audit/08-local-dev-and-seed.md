---
title: 'Audit 08: local dev and seed fidelity'
status: active
tags: [audit, dev-experience, seed]
updated: 2026-11-19
---

# 08: Local dev and seed fidelity

These are not user-facing product bugs, but they decided how much of the app a fresh checkout can
actually test, and they hid several real issues until I fixed them by hand. Everything below is
local-only; no hosted project was touched.

---

## D1 (P0). Two required edge secrets have no fallback and are missing from the sample env

`schema`/error observed:

```
POST /functions/v1/submit-form → 400
{"error":"Failed to process form data: IDENTITY_HASH_PEPPER is required"}
```

and

```
POST /functions/v1/issue-guest-trip-link → 400
{"error":"GUEST_BOOKING_ACCESS_SECRET is required"}
```

`supabase/.env.example` says:

> `GUEST_BOOKING_ACCESS_SECRET=   # optional; falls back to SUPABASE_SERVICE_ROLE_KEY`

but `_shared/guestBookingAccessToken.ts` explicitly refuses that fallback ("Do not fall back to the
service-role key"). So the comment is wrong and the secret is mandatory. Same class of problem for
`IDENTITY_HASH_PEPPER`.

Effect on a fresh clone: **the guest form cannot be submitted at all**, trip links cannot be issued,
the stay guide preview fails, and the Templates / Public Pages previews render blank.

Add both to `supabase/.env.example` with a local example value and fix the comment. Consider failing
fast at `functions serve` startup with a clear message listing required secrets.

## D2 (P0). The PDF template bucket is not seeded

`templates/guest-form-template.pdf` and `templates/pet-form-template.pdf` exist in
`ui/public/templates` but the local `templates` Storage bucket is empty:

```
POST /storage/v1/object/list/templates → []
```

Every GAF/pet transition therefore fails:

```
Error downloading template: StorageApiError: Object not found
[orchestrator] GAF PDF generation failed → HTTP 400
```

Uploading the two files by hand fixed it. Seed them (or have `db:reset` copy `ui/public/templates`
into the bucket). This is the known "two PDF copies" sharp edge, now with a runtime failure mode.

## D3 (P1). Seeded marketing media rows have no storage objects

`marketing_media_assets.storage_path` = `seed/remote/asset-0 … asset-11`, but:

```
POST /storage/v1/object/list/marketing-media {"prefix":"seed/remote"} → []
GET  /storage/v1/object/public/marketing-media/seed/remote/asset-0 → 400
```

So the Marketing studio shows blank gray creations and every seeded image is a broken thumbnail.
Either upload small placeholder files or insert remote URLs (the column set supports `source`).

## D4 (P1). Seeded parking photo URL is dead

`images.unsplash.com/photo-1590674899484-f5649e4292cf` returns 404, so the parking hero, the parking
request page, the parking listing card and the admin org page all show an empty image. Use a verified
URL or ship a local placeholder.

## D5 (P1). `seed:plan` leaves team seats inconsistent

`bun run seed:plan -- --plan=free` deactivates members over the Free seat limit (correct product
behaviour), but `--plan=pro` does not restore them because the script writes the plan directly and
the reconciliation lives inside the org team service. Result: a "Business" org where every teammate
sees "Access paused · contact your owner to upgrade".

Worse, the first reconciliation (triggered by opening Team as owner) **deactivated the org owner's
own property membership** and left one org admin `inactive` with `plan_limited=false` so it will
never be auto-restored. Repro and evidence in
[README finding 5](./README.md#p1).

Either make `seed:plan` call the reconciliation or reset seats to the seeded state after switching.
The underlying reconciliation bug (owner included in the trim; org vs property seat flags diverging)
should be fixed regardless.

## D6 (P2). Staff roles in the seed do not match the labels the UI shows

`viewer.demo@example.com` is seeded with `role_id = ADMIN` in `property_members` and full `*:view`
permissions, while the Team screen reports 5 "Operations" and 0 "Read Only". The demo data cannot
demonstrate the RBAC story it is supposed to demonstrate. Seed one member per role and assert it in
`seed:verify`.

## D7 (P2). Seed months are identical

`guest_submissions` for the property sums to ₱42,000 / 6 bookings in September, October and November,
so every dashboard trend reads `0.0%` and the demo looks synthetic. Vary monthly volume.

## D8 (P2). Onboarding cannot be re-tested without a new account

`/onboarding` redirects immediately for any user that already owns an org, which is correct, but
there is no seed user in the "new host" state, so the first-run flow (the single most important
screen for conversion) is not covered by any local test. Add a `seed:onboarding-user` fixture.

## D9 (P3). Non-production builds expose developer controls to anyone with the URL

The guest form's "Developer controls" panel (and its ability to disable DB writes, storage, or email)
renders in every non-production build. A Vercel preview deployment is a non-production build, so any
stakeholder previewing the form can toggle real side effects off, and more importantly sees a
non-customer-facing panel. Gate on an explicit `VITE_DEV_CONTROLS=true` rather than `PROD`.

---

## What I configured to complete the audit (revert if needed)

| File                       | Change                                                                                                                                                                                                     | Why                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `ui/.env.development`      | created, points at local Supabase, `VITE_SUPER_ADMIN_EMAILS=seed-owner@example.com`, local Turnstile test key                                                                                              | No env file existed, so the UI had no backend |
| `supabase/.env.local`      | created with `ADMIN_ALLOWED_EMAILS`, `SUPER_ADMIN_EMAILS`, `GUEST_BOOKING_ACCESS_SECRET`, `IDENTITY_HASH_PEPPER`, `SETTINGS_VERIFICATION_SECRET`, `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`, local Turnstile keys | Unblock submit, trip links, settings saves    |
| `templates` Storage bucket | uploaded `guest-form-template.pdf`, `pet-form-template.pdf` from `ui/public/templates`                                                                                                                     | Unblock GAF/pet transitions                   |
| Local DB                   | `seed:plan --plan=pro` (Business), later `free` then `pro` for gating tests; created booking `a0858608-…`, user `newhost.audit@example.com`                                                                | Plan gating and onboarding testing            |

No application code, migration, or hosted resource was modified.
