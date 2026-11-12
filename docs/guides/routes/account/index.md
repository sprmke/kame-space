---
title: 'Guest Account (index) — operator guide'
status: active
tags: [guides, routes, account]
updated: 2026-08-17
---

# Guest Account (index) — operator guide

Route: `/account`

> **Status:** Documented — redirect only.

## Progress overview

| Section  | E2E save | Validation | Docs       | Notes                     |
| -------- | -------- | ---------- | ---------- | ------------------------- |
| Redirect | —        | —          | Documented | Always → `/account/trips` |

---

## Overview

`GuestAccountIndexPage` renders no UI — it immediately `<Navigate replace>`s to **`/account/trips`** (guest journey plan, decision D2: a guest with an upcoming stay wants the trip first). There is no account landing/dashboard page; the sidebar nav (Profile · Trips · Reviews · Messages · Vouchers · Favorites · Tickets · Help) is the entry point instead.

`/account/settings` also redirects to `/account/profile` (see [profile.md](./profile.md) § Settings).

---

## Host-facing knowledge

Guests who tap their account avatar and land on the account area always see their **Profile** tab first. There's no separate "account home" screen to design around.

**Common host questions**

- Q: A guest says they can't find an "Account" overview page. Where does it go?
  A: There isn't a separate overview page. Signing in and opening the account menu takes them straight to their Trips, with Profile, Messages, Vouchers, and Favorites as other tabs in the same area.
- Q: How does a guest open their account?
  A: After signing in, they open the avatar in the top navigation. On a phone, the same links live in the account tab at the bottom.
- Q: What can a guest do from the account area?
  A: They can review trips, edit their profile, read messages, manage vouchers and favorites, and check tickets they filed with us.

---

## Implementation map

| Concern | Path                                                            |
| ------- | --------------------------------------------------------------- |
| Page    | `ui/src/features/guest/account/pages/GuestAccountIndexPage.tsx` |
| Routes  | `ui/src/features/guest/account/routes/index.tsx`                |
| Paths   | `ui/src/features/guest/account/lib/guestAccountPaths.ts`        |

---

## Testing

| Layer | Path / spec              | Manual |
| ----- | ------------------------ | ------ |
| E2E   | N/A — redirects to trips | —      |

---

## Related docs

- [Route index](../README.md)
- [Profile](./profile.md)
- [Messages](./messages.md)
- [Favorites](./favorites.md)
- [`docs/PROJECT.md`](../../PROJECT.md)

---

## Pending / follow-ups

Verified during the 2026-07-30 route-guides refresh — these are confirmed dead/unrouted, not gaps to document:

- [x] `GuestAccountSettingsPage` exists in the repo (`ui/src/features/guest/account/pages/GuestAccountSettingsPage.tsx`) but is **not routed** — `/account/settings` redirects to `/account/profile` instead of rendering it.
- [x] Guest marketing **`PropertyCalendarPage`** removed — public calendar is **`CalendarPage`** + shared **`PublicPropertyCalendar`**
- [x] The exported `orgInboxRoute` helper in `ui/src/features/dashboard/inbox/routes/index.tsx` is **unused** — the org inbox route is wired inline in the parent router instead of calling this helper.
