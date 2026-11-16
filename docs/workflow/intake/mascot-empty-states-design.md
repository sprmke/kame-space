---
stage: intake
title: 'Mascot empty states — 404 and feature unavailable'
status: active
tags: [workflow, intake, ui, design, brand]
updated: 2026-11-16
kind: design
worksheet: ui-improvements-worksheet.md
item: UI-05
---

# Mascot empty states design

**Claim.** UI-05 on [`ui-improvements-worksheet.md`](./ui-improvements-worksheet.md).

**Goal.** One calm, on-brand empty composition for “nothing here” and “not available yet,” using the **platform mark** (not the heavy 3D social `Kame` Three.js scene).

## Problem

- `NotFoundPage` uses a one-off inline SVG turtle that does not match `kame-space-mark.svg`.
- Feature unavailable / “coming soon” panels use a generic lucide circle. They feel like a different product.
- 3D `marketing/social` Kame is wrong for SPA empty states (bundle, WebGL, motion cost).

## Direction

Tone: **calm hospitality**, teal atmosphere, generous whitespace (guest/marketing density from `DESIGN.md`). One visual idea: soft brand wash + large mark + short title + one CTA group.

| Do                                                  | Don’t                                         |
| --------------------------------------------------- | --------------------------------------------- |
| `KameSpaceBrandIcon` / `/brand/kame-space-mark.svg` | New purple orbs, glassmorphism, emoji         |
| Soft `primary` radial wash behind the mark          | Blur-to-sharp photo tricks (banned elsewhere) |
| Shared `BrandEmptyState` primitive                  | Copy-paste layouts per page                   |
| Keep existing short copy where it already works     | Essay empty states or tutor voice             |
| `motion-safe:animate-float` only on the mark        | Continuous distracting animation              |

## Composition (phone 375 → desktop)

1. Full-width section, min height ~70vh on 404; panel height for feature gate.
2. Soft radial wash (`bg-primary/10` ellipse), no second competing blob.
3. Mark at 64–80px (404) or 40–48px (compact / panel).
4. Optional eyebrow (`Error 404` / reason label), then title, then one muted line.
5. Actions: outline Back (if history) + primary Home (404). Feature gate: no fake CTA unless the parent passes children.

## Shared API

```tsx
<BrandEmptyState
  markSize="lg" | "md" | "sm"
  eyebrow?: string
  title: string
  description?: string
  children?: ReactNode // actions / expected-back line
/>
```

Used by:

- `NotFoundPage`
- `FeatureUnavailablePanel` (non-compact; compact keeps icon circle for density)

## Copy rules

- No new fluff. Prefer existing strings.
- No em dash. Host/guest facing names only.
- 404 stays: eyebrow `Error 404`, title `This page wandered off`, body `We couldn't find the page you're looking for.`

## Out of scope

- Plan upgrade modal mascot (UI-06): can reuse `BrandEmptyState` later; not this claim.
- 3D Kame poses, social carousel, ReceptionistAvatar.
- Marketing footer / landing hero (other worksheet rows).

## Acceptance

- [x] 404 uses brand mark + shared shell; no local turtle SVG
- [x] Feature unavailable (non-compact) uses the same mark language
- [x] `/services` coming soon uses the same shell
- [ ] Visual check at 375 / 768 (CTAs ≥ 44px hit)
- [ ] Worksheet UI-05 → `done` after PR merge
- [x] Plans/RBAC/activity-log: N/A (presentation only)
