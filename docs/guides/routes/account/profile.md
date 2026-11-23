---
title: 'Guest account — operator guide'
status: active
tags: [guides, routes, account]
updated: 2026-11-23
---

# Guest account — operator guide

Routes (authenticated explore mode):

- `/account` → redirects to `/account/profile`
- `/account/profile`
- `/account/stays` (legacy `/account/messages` and `/account/trips` redirect here)
- `/account/vouchers`
- `/account/favorites` (legacy `/account/wishlist` redirects here)
- `/account/tickets` (+ `/new`, `/:ticketId`)
- `/account/help`

> **Status:** Documented — nav avatar + account shell + profile/stays/vouchers/favorites/tickets.

## Progress overview

| Section    | E2E save | Validation      | Docs       | Notes                                                                        |
| ---------- | -------- | --------------- | ---------- | ---------------------------------------------------------------------------- |
| Nav avatar | —        | —               | Documented | Explore: guest menu always includes Host → Dashboard; host: Dashboard avatar |
| Profile    | ✅       | Client + server | Documented | `guest-profile` + avatar upload; PH mobile phone; Google Places location     |
| Stays      | ✅       | —               | Documented | Cross-property web chat hub (`guest-messages`)                               |
| Vouchers   | ✅       | —               | Documented | Next-stay wallet — [vouchers.md](./vouchers.md)                              |
| Favorites  | ✅       | —               | Documented | `guest_saved_properties`                                                     |
| Tickets    | ✅       | Server          | Documented | Explore Contact tickets — [tickets.md](./tickets.md)                         |

---

## Overview

Signed-in guests see a **rounded avatar** in the marketing nav (explore pages only). The dropdown opens with **Host → Dashboard**, then guest sections **Account** (Profile · Favorites · Vouchers), **Trips** (Trips · Messages · Reviews), and **Help** (Tickets · Help), then **Log out**. **Dashboard** from explore runs the global mode-switch curtain, then opens **`/org`** (the hub redirects to an org the caller can access, usually the last visited one at its listing level, or onboarding if none). From host marketing (`/for-hosts`) it navigates directly. On phone/tablet the same **Dashboard** row lives in the marketing **More** sheet (the header avatar is `lg+` only). Anonymous guests still use the **checkout auth modal** (no `/for-guests/login` pages).

**Host marketing (`/for-hosts`):** signed-in hosts see the same pill + avatar pattern — **Explore** switches to guest mode; avatar menu opens **Dashboard**. Signed-out hosts see **Explore** + **Sign In**.

Stays, Favorites, and Tickets each have their own dedicated guide — see [stays.md](./stays.md), [favorites.md](./favorites.md), [tickets.md](./tickets.md). This guide covers the account shell (nav + sidebar) and the Profile page in full detail.

---

> **Privacy and data (intentionally hidden, 2026-11-22):** `GuestPrivacyCard` (Download my data / Delete my account) is **not mounted** on Profile for now. Component + edge `data-subject-request` remain; re-enable from `GuestProfilePage` when product wants self-serve export/delete. Guests use Help / Tickets for data or deletion requests. Pattern: [legal.md](../legal.md#in-app-notices).

## Host-facing knowledge

Guests manage their own display name, bio, phone, location, and photo from their account. Hosts can't edit a guest's profile on their behalf. A guest's profile is separate from any individual booking; changing it doesn't change details already submitted on a booking form.

**Common host questions**

- Q: Can I update a guest's profile photo or bio for them?
  A: No, that's guest-managed. If a booking has the wrong contact info, edit the booking itself rather than the guest's account profile.
- Q: Does updating their profile change their existing bookings?
  A: No. Profile info (name, bio, phone, location, photo) is separate from booking details already submitted.
- Q: How do I open the host dashboard while browsing as a guest?
  A: Open the avatar menu and tap Dashboard. On a phone, open More and tap Dashboard.
- Q: Where do I clear cached app data or check the app version?
  A: Open Profile. Under App you can check for updates or clear the offline copy. Install the app from More.

---

## Account shell

Explore account routes use a **dashboard-style sidebar** (not horizontal tabs):

- Content column uses **`.public-shell`** (same max width + gutters as MarketingNav / footer), so the sidebar left edge lines up with the logo on large desktops. Do not wrap account pages in a second `container` / `max-w-*` with extra horizontal padding.
- Desktop: card sidebar with avatar, vertical nav + sliding active pill, log out. Sidebar and main column **stretch to the same height** (taller side wins) so empty/list cards align with the nav card. Nav uses the same **Account / Trips / Help** group labels as the marketing avatar dropdown (`GUEST_ACCOUNT_NAV_GROUPS`)
- Mobile: the site-wide `MarketingBottomNav` bottom tab bar (Explore/Properties/Parkings/Account/More) plus a **top** `GuestAccountMobileNav` strip (`sticky top-16`, `lg:hidden`) below the marketing header for the account sub-nav — deliberately kept as a top strip rather than a second bottom tab bar (two bottom bars stacked on one screen is an anti-pattern; see `mobile-responsive` skill §2b). The strip stays flat (no group labels) so the 4-column grid stays dense
- Content sits below the fixed marketing nav (`pt-16 lg:pt-20`) so page titles no longer clash with the site header

Sub-nav order (same groups as the avatar menu): **Account** Profile · Favorites · Vouchers · **Trips** Trips · Messages · Reviews · **Help** Tickets · Help (log out in sidebar footer). The mobile strip uses `grid-cols-4`, so eight items sit as two balanced rows.

---

## Profile (`/account/profile`)

- Edit display name, bio, phone, location, profile photo
- Same form opens from the **host dashboard** sidebar account menu → **Profile** (modal)
- Dashboard modal: ~32×42rem (desktop), centered larger photo, read-only **Email** field above display name. Below the form: **Theme** (segmented Light/Dark `ThemeToggle`, same control formerly on the sidebar) then **App**
- Page layout: identity column (avatar, name, email) stays **centered** in its column at every breakpoint; form fields stay start-aligned on the right. Profile form uses `p-4 md:p-8 lg:p-10`. Booking alerts and App cards keep the same horizontal inset with a slightly tighter vertical pad (`px-4 py-3 md:px-8 md:py-5 lg:px-10 lg:py-6`) and shared `rounded-2xl` chrome
- **Phone:** optional; when set, must be an 11-digit Philippine mobile (`09…`) — same rules as team invites (`validatePhilippineMobilePhone`)
- **Location:** `LocationSearchInput` — Philippines-biased Places autocomplete (legacy `AutocompleteService` + `getDetails`); loads **Places library only** on first focus; suggestions in a Radix **Popover** (works inside dashboard Profile modal); stores city/province/country label (max 120 chars); manual typing when Maps API key is unset
- API: **`guest-profile`** GET/PATCH, **`upload-guest-profile-asset`** POST
- DB: **`guest_profiles`** (RLS scoped to `auth.uid()`)
- Avatar resolution: profile row → OAuth metadata → initials
- **ID verification** (`GuestIdentityCard`): field under Location in the profile card (not a separate card). Status + **Verify** / **Verify again**; delete is a text action when verified. Outside the profile draft dirty state.
- **App** (`AppInfoCard`): product version from root `package.json` (e.g. `1.0`, `2.1.3`; local builds show `Development`) + **Check updates**; offline copy usage with **Keep offline copy** / **Clear offline copy**. Two columns from `sm` up. Same block in the host dashboard **Profile** modal. **Install app** stays on More / marketing, not here.
- **Booking alerts** (`GuestPushNotificationsCard`): one switch that turns OS push on for the signed-in guest. Reuses `usePushNotifications` / `push-subscribe`, so the subscription belongs to the user, not to a team. It shows **Checking this device…** until the browser state is read, **Add this app to your home screen first** on iOS install-required, and **This browser cannot show alerts.** when push is unsupported. Copy is guest-specific: guests have no Activity feed, so it never points at one.
- Guest push only carries two milestones, both sent from the workflow orchestrator: **Confirmed** and **Ready for check-in**. Deep link is an app-relative trip page. `notification_preferences` applies (a guest who mutes **Bookings**, or sets quiet hours, stops receiving them). An anonymous booking has no user to push to and keeps its email.

---

## Stays (`/account/stays`)

Cross-property web chat inbox hub (nav label **Stays**). See [stays.md](./stays.md).

---

## Favorites (`/account/favorites`)

Saved-properties grid (the guest's heart/favorites list). See [favorites.md](./favorites.md).

---

## Settings (hidden)

**`/account/settings`** is not linked in nav (redirects to **`/account/profile`**). **`GuestAccountSettingsPage`** remains in the repo for a future pass. Sign out lives in the account sidebar / avatar menu.

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Concern         | Path                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav menu        | `ui/src/features/guest/account/components/GuestAccountMenu.tsx`                                                                                                                                           |
| Layout + guard  | `ui/src/features/guest/account/components/GuestAccountLayout.tsx`, `ui/src/features/guest/account/components/GuestAccountSidebar.tsx`, `ui/src/features/guest/account/components/RequireGuestSession.tsx` |
| Pages           | `ui/src/features/guest/account/pages/*`, `GuestProfileModal.tsx`, `GuestProfileForm.tsx`, `GuestMessagesHub.tsx`, `GuestMessageThreadRow.tsx`                                                             |
| App             | `ui/src/components/pwa/AppInfoCard.tsx` (Profile page + host Profile modal)                                                                                                                               |
| ID verification | `ui/src/features/verification/components/GuestIdentityCard.tsx` (field inside `GuestProfileForm`)                                                                                                         |
| Validation      | `ui/src/features/guest/account/lib/guestProfileValidation.ts`, `ui/src/lib/google-maps/LocationSearchInput.tsx`                                                                                           |
| API client      | `ui/src/features/guest/account/lib/guestAccountApi.ts`                                                                                                                                                    |
| Edge services   | `supabase/functions/_shared/guestProfileService.ts`                                                                                                                                                       |
| Migration       | `supabase/migrations/20260920120000_guest_account_profiles.sql`                                                                                                                                           |

---

## Testing

| Layer | Path / spec                                                                                                                                                        | Manual        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Unit  | `ui/src/features/guest/account/lib/guestProfileValidation.ts`                                                                                                      | —             |
| E2E   | `ui/e2e/features/account/accountSmoke.spec.ts` profile form load (`@ci`), `sharedDeviceSignOut.spec.ts` (`@ci @critical`) auth + query cache + Cache Storage purge | Avatar upload |
| N/A   | Google OAuth sign-in                                                                                                                                               | Manual auth   |

---

## Related

- [index.md](./index.md) — `/account` redirect
- [stays.md](./stays.md) · [favorites.md](./favorites.md)
- [auth.md](../auth.md) — checkout modal auth
- [properties.md](../properties.md) — save heart / favorites gate

---

## ID verification field (2026-11-22)

`/account/profile` renders `GuestIdentityCard` as a field under Location inside the profile
card: status (Not verified / badge + masked name + expiry), **Verify** / **Verify again**,
and **Delete verification**.

- Data: `identity-verification-mine` (signed-in guest).
- Deleting calls `identity-verification-delete`: the verdict row and every capture for its
  session are removed; bookings keep their existing `valid_id_url`.
- Outside the profile draft dirty state on purpose.

**Guest Q&A**

- Q: Can I verify once and use it for later bookings?
  A: Yes, while signed in and while the verification has not expired.
- Q: Can I remove it?
  A: Yes, Delete verification removes the result and its photos.
