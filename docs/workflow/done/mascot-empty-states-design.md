---
stage: done
title: 'Mascot empty states — 404 and feature unavailable'
status: done
tags: [workflow, done, ui, design, brand]
updated: 2026-11-20
kind: design
worksheet: ui-improvements-worksheet.md
item: UI-05
---

# Mascot empty states design

**Claim.** UI-05 on [`ui-improvements-worksheet.md`](../intake/ui-improvements-worksheet.md).

**Goal.** One calm, on-brand empty composition for “nothing here” and “not available yet.” Full-page marketing empties use the **approved character library** under `ui/public/assets/mascot/` (pose per page). Dense panels keep the **platform mark**. Never the voice receptionist `/avatars/` stills, booth MP4s, or the live Three.js Kame rig on these pages.

## Problem

- `NotFoundPage` used a one-off inline SVG turtle that did not match brand.
- Feature unavailable / “coming soon” panels used a generic lucide circle. They felt like a different product.
- Live 3D `marketing/social` Kame and receptionist avatar media are wrong for SPA empty states (bundle, WebGL, decode cost).

## Direction

Tone: **calm hospitality**, teal atmosphere, generous whitespace (guest/marketing density from `DESIGN.md`). Soft brand wash + visual + short title + one CTA group.

| Do                                                              | Don’t                                       |
| --------------------------------------------------------------- | ------------------------------------------- |
| `mascotPose` → PNG from `/assets/mascot/` via `KameMascotImage` | `/avatars/receptionist-turtle-*` on empties |
| Pose matches the page (`page-not-found`, `coming-soon`, …)      | One generic idle still for every empty      |
| Default (no pose) → `KameSpaceBrandIcon` on dense panels        | Live Three.js Kame / booth MP4              |
| Soft `primary` radial wash behind the visual                    | Blur-to-sharp photo tricks                  |
| Shared `BrandEmptyState` primitive                              | Copy-paste layouts per page                 |
| Keep existing short copy where it already works                 | Essay empty states or tutor voice           |
| `motion-safe:animate-float` only on the visual                  | Continuous distracting animation            |

## Pose map (this claim)

| Surface                                      | Pose                            | File                  |
| -------------------------------------------- | ------------------------------- | --------------------- |
| Marketing 404 (`NotFoundPage`)               | `page-not-found`                | `page-not-found.png`  |
| `/services` Coming Soon (nav after Parkings) | `coming-soon` (`markSize="xl"`) | `coming-soon.png`     |
| Feature unavailable (non-compact)            | (none, SVG mark)                | `kame-space-mark.svg` |

## Pose map (guest account empties)

Shared shell: `GuestAccountEmptyState` (or `BrandEmptyState` / `HelpEmptyState` where noted). Assets from `ui/public/assets/mascot/`.

| Surface                                          | Pose                        | Copy (title)                                        |
| ------------------------------------------------ | --------------------------- | --------------------------------------------------- |
| `/account/trips` empty                           | `arrival`                   | Suitcase travel pose (replaces calendar)            |
| `/account/trips` error                           | `gentle-failure`            | Couldn't load trips                                 |
| `/account/favorites`                             | `favorites`                 | No favorites yet                                    |
| `/account/vouchers`                              | `voucher`                   | No vouchers yet                                     |
| `/account/messages` empty                        | `guest-inbox`               | No messages yet                                     |
| `/account/messages` error                        | `gentle-failure`            | Couldn't load messages                              |
| `/account/reviews` (all empty tabs)              | `guest-review`              | Per-tab title                                       |
| `/account/help`                                  | `help-support` (above grid) | Home title/description; hidden on search/topic      |
| `/account/tickets` empty                         | `phone`                     | Reach-support pose; distinct from Help lifebuoy     |
| `/account/tickets` error                         | `gentle-failure`            | (HelpEmptyState)                                    |
| Search no matches (`/search`, listing search)    | `gentle-failure`            | Soft apologetic pose for empty results              |
| Guest home `HostBand` + for-hosts v4 closing CTA | `public-pages`              | Listing-frame pose; light feet crop into panel edge |

**Art gap:** no dedicated support-ticket pose; Tickets reuse `help-support` (lifebuoy). A ticket-clipboard pose would fit better later.

**Account empty rhythm:** mascot `w-36` / `sm:w-40`, title+description stack `mt-5` / `gap-1.5`, primary CTA `mt-6` rounded-full with leading icon (no text-only links). Shared by `GuestAccountEmptyState` and guest `HelpEmptyState` when `mascotPose` is set.

Library catalog: `ui/public/assets/mascot/README.md` + `manifest.json`.

## Composition (phone 375 → desktop)

1. Full-width section, min height ~70vh on 404; panel height for feature gate.
2. Soft radial wash (`bg-primary/10` ellipse), no second competing blob.
3. Mascot display width ~144–176px (404 / Services) or mark at 40–80px (compact / panel). Intrinsic canvas 448×468.
4. Optional eyebrow (`Error 404` / reason label), then title, then one muted line.
5. Actions: outline Back (if history) + primary Home (404). Feature gate: no fake CTA unless the parent passes children.

## Shared API

```tsx
<BrandEmptyState
  mascotPose?: KameMascotPose // from kameMascotAssets.ts
  mascotPriority?: boolean // LCP for full-page empties
  markSize="lg" | "md" | "sm"
  eyebrow?: string
  title: string
  description?: string
  children?: ReactNode // actions / expected-back line
/>
```

Used by:

- `NotFoundPage` (`mascotPose="page-not-found"`)
- `/services` Coming Soon (`mascotPose="coming-soon"`)
- `FeatureUnavailablePanel` (non-compact; default mark; compact keeps icon circle for density)

## Copy rules

- No new fluff. Prefer existing strings.
- No em dash. Host/guest facing names only.
- 404 stays: eyebrow `Error 404`, title `This page wandered off`, body `We couldn't find the page you're looking for.`

## Out of scope

- Plan upgrade modal mascot (UI-06): can reuse `BrandEmptyState` later; not this claim.
- Live 3D Kame poses, social carousel, ReceptionistAvatar.
- Marketing footer / landing hero (other worksheet rows).
- Deleting `/avatars/receptionist-turtle-*` (voice booth still owns those).

## Acceptance

- [x] 404 uses `page-not-found` library PNG + shared shell
- [x] `/services` uses `coming-soon` library PNG + shared shell
- [x] No receptionist idle WebP / MP4 / Three.js on these pages
- [x] Feature unavailable (non-compact) uses the platform mark language
- [ ] Visual check at 375 / 768 (CTAs ≥ 44px hit)
- [ ] Worksheet UI-05 → `done` after PR merge
- [x] Plans/RBAC/activity-log: N/A (presentation only)
