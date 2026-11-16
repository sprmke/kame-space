---
title: 'Public landing redesign: home page below the hero'
status: in-progress
tags: [workflow, in-progress, marketing, guest-home, design]
updated: 2026-11-17
stage: in-progress
kind: plan
---

# Public landing redesign

**Status: paused on 2026-11-17.** The design is not approved, so the work is parked behind a
draft PR and stays in `in-progress/` until it is revisited. Nothing here is blocking production.

Branch: `feat/public-landing-redesign` · Draft PR: [#495](https://github.com/sprmke/kame-space/pull/495)

## What is done

- New home sections below the unchanged hero: swipeable listing rails, scroll-scrub booking story,
  rewritten why-book-here, host band, and catalog explore.
- Nine mascot images under `ui/public/marketing/home/mascot/`.
- Route guide [`docs/guides/routes/index-landing.md`](../../guides/routes/index-landing.md) updated.
- Public smoke and mobile overflow specs extended.

The last complete state is commit `f6022bdd1` (`feat(ui): redesign public landing below the hero`).

## Why it is paused

1. **Design quality is not signed off.** The owner is not satisfied with the overall design and
   finish of the section set.
2. **The working tree carries unfinished label work.** 18 to 21 modified files rename module
   labels (`Pricing` to `Pricing & availability`, `Inbox` to `Messages`) and import
   `@/features/dashboard/bookings/lib/adminModuleLabels`, a file that does not exist on any branch.
   `bun run type-check` fails on those imports, so those files are deliberately left uncommitted.
3. **The branch is stacked.** It contains the seven commits from
   [`feat/marketing-ai-studio-overhaul`](../marketing-ai-studio-overhaul.md) (#488), which currently
   conflicts with `develop`. The draft PR targets that branch so the diff shows only the landing
   change.

## To resume

1. Decide what happens to the module-label rename: create `adminModuleLabels.ts` and finish it, or
   discard the uncommitted files.
2. Land or drop #488, then rebase this branch on `develop`.
3. Run a design pass on the section set, then manual QA at 375, 768, and 1440 px.
4. Promote the approved direction to `/`, remove the superseded home components, and update SEO,
   the route guide, and screenshots.

## Verification

Not run since the pause. Type-check fails on the uncommitted label imports. The committed landing
slice type-checks and its smoke spec ran at PR time.

## Implementation map

| Area             | Path                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page composition | `ui/src/features/guest/marketing/pages/MarketingHomePage.tsx`                                                                                           |
| New sections     | `ui/src/features/guest/marketing/guest-home/components/{ListingRail,ScrubParts,BookingSteps,BookingStepScenes,WhyBookHere,HostBand,ExploreCatalog}.tsx` |
| Scroll scrub     | `ui/src/features/guest/marketing/guest-home/lib/scrub.ts`                                                                                               |
| Mascot assets    | `ui/public/marketing/home/mascot/*.webp`                                                                                                                |
| Route guide      | `docs/guides/routes/index-landing.md`                                                                                                                   |

Back to [in-progress index](./README.md)
