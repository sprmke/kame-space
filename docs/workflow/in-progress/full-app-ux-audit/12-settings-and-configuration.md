---
title: 'Audit 12: settings and configuration'
status: active
tags: [audit, settings, configuration, validation]
updated: 2026-11-19
---

# 12: Settings and configuration

Every settings card at org, property and parking level, plus platform configuration and the
Notifications/Telegram modules. Each setting was changed, saved, reloaded, and checked on the surface
it is supposed to affect.

Screenshots: `/tmp/audit/settings-screens/` (27 files).

---

## P0

### S1. The seeded property cannot save any setting

Reproduced independently: open `/org/:org/property/kame-home/settings`, change only the description,
press **Save Changes** → toast **"Max adults must be between 1 and 6"**, request rejected, nothing
persisted.

Cause: `PropertyProfileSettingsSections.tsx:218` runs a load-time `useEffect` that force-syncs
`bedrooms / bathrooms / maxAdults / maxChildren` to the selected unit-type template with
`{ markEdited: false }`. The `2br` template is 8 adults / 3 children / 1 bathroom; Azure North caps
adults at 6. So the draft is silently rewritten on mount and every save (which sends the whole
profile) violates the server validator. The rewrite also means a host who saves an unrelated field
would persist capacity values they never chose.

The seed itself already violates the cap (`bathrooms: 2` vs `max 1`), so the canonical dataset cannot
round-trip its own validators.

Fix:

1. Apply unit-type defaults only on an explicit unit-type change, never on load, and clamp them to the
   residence caps.
2. Make the caps come from residence config (one source), not a hardcoded map that disagrees with the
   templates.
3. Run the existing client validator (`validatePropertyDetailsForResidence` is currently imported only
   by its own test) so errors attach to the field instead of a toast.
4. Fix the seed to satisfy the same validator.

### S2. The platform "Self-serve signups" switch does nothing

With `signups_enabled = false`, `/for-hosts/login` behaves normally and a brand-new address creates an
`auth.users` row and reaches onboarding. `signupsEnabled` is stored, shown in admin, and read by the
maintenance hook, but **nothing gates signup**.

Given the guest form now requires an account, a closed-signups platform still accepts unlimited guest
account creation. Enforce it server-side (Supabase Auth `before user created` hook or a gate in the
OTP path) and disable the login form with a reason.

---

## P1

### S3. Search preview cannot be saved on its own

Property SEO title/description are not in `PROFILE_SETTINGS_KEYS`, so an SEO-only save returns
`400 No valid fields to update`. Add any other field and all three persist. Parking accepts an
SEO-only save, so the behaviour differs between the two.

### S4. Paused listings still look bookable

The API returns `acceptingBookings: false` and the form shows the closed notice, but the public property
page keeps an enabled check-in/check-out/guests widget and a live **Reserve** button until the guest
opens the form. The detail page also stays indexed. Show the closed state on the button itself.

### S5. Duplicate "Guest experience" sections

`PropertySettingsCard.tsx` renders `<AdminSection id="guest-experience">` twice (lines 1188 and 1210),
one with the org/property props and one without. Duplicate DOM id, duplicate network calls, and the
nav anchor jumps to the first while the second renders a degraded copy.

### S6. Required markers that do not validate

- Property **Team email**: shows "Enter team email" and `aria-invalid` while Save is enabled and
  returns "Settings saved" with the field empty.
- Parking: "Select at least 1 amenity" and **Address** are marked required but unenforced, and the
  address cannot be filled at all because the map picker needs `VITE_GOOGLE_MAPS_API_KEY`.
- Description over 1000 characters and Telegram tokens report only via toast.

### S7. Org rename silently breaks URLs

The slug is derived from the name on save, with no confirmation and no redirect. `/hosts/<old>` and
`/org/<old>/settings` break immediately; the org-side slug has no `listing_slug_redirects` equivalent.
A host renaming "Kame Space" to something else loses every shared dashboard and host-profile link.

### S8. Maintenance status fails open when throttled

The public status endpoint is called 10 times per page in the settings probe (rate-limited to 30/min
per IP), and the hook falls back to `{ maintenanceMode: false }` on error. During a real maintenance
window with heavy traffic, the banner can silently disappear exactly when it matters. Dedupe the call
(cache 60s) and fail closed or retry instead of defaulting to "no maintenance".

---

## P2

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9  | **Org settings has no mobile section nav**: the rail disappears below `lg` and the page becomes a 3,248px scroll (parking 4,268px). Same for property settings.                                                                                                                                                                                                                                                                                               |
| S10 | **AI section entries are disabled with no explanation** when the platform AI switch is off (see 02-H23).                                                                                                                                                                                                                                                                                                                                                      |
| S11 | **Parking settings "check-out 2:00 PM → 12:00 PM"** has no date context, reading like leaving before arriving.                                                                                                                                                                                                                                                                                                                                                |
| S12 | **Developer copy on host settings**: "Add VITE_GOOGLE_MAPS_API_KEY to enable the map picker" and "No API keys configured" in red.                                                                                                                                                                                                                                                                                                                             |
| S13 | **Notifications/Telegram**: five modules with independent Save/Reset in one page; a dummy token save succeeds with no validation feedback, and "Test" does nothing useful without a bot.                                                                                                                                                                                                                                                                      |
| S14 | **Feature availability**: children inherit the parent correctly and the revert is clean (good), but the "Off only" filter produces a blank page with no empty state.                                                                                                                                                                                                                                                                                          |
| S15 | **Custom roles editor** lets you save a role with leaves the editor does not hold, and does not warn.                                                                                                                                                                                                                                                                                                                                                         |
| S16 | **`/org/:org/custom-pages` redirects to `/public-pages`** although `customPages` is sold on Free/Starter as a separate capability.                                                                                                                                                                                                                                                                                                                            |
| S17 | **Search preview canonical**: unknown property/host slugs return HTTP 200 with the generic list and `canonical:/properties` instead of a 404 (soft 404).                                                                                                                                                                                                                                                                                                      |
| S18 | **Booking import falls back to 100% manual mapping.** Without a Gemini key the wizard reports "Matching ran in basic mode", matches **0 of 8** columns for obvious headers ("Guest Name", "Email", "Check In") and labels each "AI mapping unavailable - map manually". The deterministic header resolver only knows one alias (`guest_facebook_name`) and is case/space sensitive, so the fallback never helps. It also calls `import-ai-map-columns` twice. |

---

## Settings effectiveness (verified)

### Property

| Setting                   | Saved                       | Guest effect                                |
| ------------------------- | --------------------------- | ------------------------------------------- |
| Check-in / check-out time | ✅                          | Guest page "Before 10:00 AM", form defaults |
| Self check-in             | ✅                          | Badge and house rules                       |
| Amenities                 | ✅                          | "What this place offers" updates            |
| House rules               | ✅                          | Guest rules block updates                   |
| Photos                    | ✅                          | Gallery + OG image                          |
| Cancellation policy       | ✅                          | Guest refund block                          |
| Search preview            | ⚠️ only with another field  | Title/meta/OG                               |
| Capacity (2br)            | ❌ blocked                  | n/a                                         |
| Description/name/type     | ❌ on the seed (same PATCH) | n/a                                         |

### Org

| Setting               | Saved                              | Public effect         |
| --------------------- | ---------------------------------- | --------------------- |
| Logo                  | ✅                                 | Host profile, sidebar |
| Name                  | ✅ (slug follows, breaks old URLs) | `/hosts/:slug`        |
| Tagline / description | ✅                                 | Host profile          |
| Socials               | ✅                                 | Host profile links    |
| Brand color           | ✅                                 | Guest shell theme     |

### Parking

| Setting                          | Saved                                  | Guest effect               |
| -------------------------------- | -------------------------------------- | -------------------------- |
| Cover photo, slot details, rates | ✅                                     | Public parking page + form |
| Amenities (none selected)        | ⚠️ required mark ignored               | —                          |
| Address                          | ❌ cannot be edited without a Maps key | Public location            |

### Platform

| Setting                     | Effective                                    |
| --------------------------- | -------------------------------------------- |
| Maintenance mode            | ✅ banner + blocks (but fails open on 429)   |
| Self-serve signups          | ❌ not enforced (S2)                         |
| Feature availability        | ✅ parent/child, reason dialog, auto-restore |
| Rate limits                 | ✅ per-identity limits and block list        |
| Default plan                | ✅                                           |
| Support email / legal links | ✅                                           |
