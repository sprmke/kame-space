---
title: 'Bookings UX review — before / after'
status: active
tags: [ux, ui, bookings, review, qa, before-after]
updated: 2026-11-24
---

# Before / after

Both sets were captured from **the same worktree, the same Vite server and the same fixture
harness**, one commit apart, so a difference in a still is a difference this pass made:

| Set            | Commit      | State                                 |
| -------------- | ----------- | ------------------------------------- |
| `before/`      | `dbf287449` | Review only, no UI changes            |
| `screenshots/` | this branch | All P1s + the closable P2/P3s applied |

Every surface the review covers was re-shot at the same five widths (390 / 768 / 1024 / 1440 /
dark 1440). `compare/` holds labelled side-by-side pairs for the surfaces that changed.

## How to read it

- Left panel = **BEFORE**, right panel = **AFTER**, in every `compare/*.png`.
- SSIM is measured on the full-resolution pair. `> 0.999` means "visually identical"; anything
  lower changed on purpose and is listed with the reason.

## Changed surfaces

| Pair                         | SSIM   | Item              | What to look at                                                                                                        |
| ---------------------------- | ------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `32-tablet-detail`           | 0.702  | P1-1, P1-2        | Was a 320px rail squeezed beside a 400px booking; now summary, then Progress, then details, all full width             |
| `51-phone-detail-workflow`   | 0.651  | P1-1, P2-8, P2-10 | "Mark GAF as complet" → full label on its own row; "2 of 2 sent" / "0 of 1 received"; no quick-access pill over Cancel |
| `52-phone-detail-lower`      | 0.651  | P1-1              | CTA pair no longer overlapping Cancel booking                                                                          |
| `21-laptop-detail`           | 0.769  | P1-3              | Progress was 1,234px below the fold at 1024; it now leads, under the guest summary                                     |
| `50-phone-detail`            | 0.782  | P2-2, P3-1        | No constant "DIRECT" chip; 44px back-link hit area                                                                     |
| `10-desktop-detail-overview` | 0.810  | P2-2, P2-7, P1-1  | No "DIRECT"; "Guest still needs: …"; the pair stacks instead of clipping at the 384px rail                             |
| `16-desktop-detail-dark`     | 0.827  | as above          | Dark mode holds contrast and spacing                                                                                   |
| `62-free-plan-detail`        | 0.857  | P1-1, P2-2        | Free-plan manual-send rail keeps its labels intact                                                                     |
| `61-read-only-detail`        | 0.871  | P1-4, P1-5        | Door code is text, not an input + Save; the review gate is a "View only" note                                          |
| `02-desktop-status-filter`   | 0.989  | P2-6              | Scroll shadow marks the clipped row as "more below"                                                                    |
| `06-desktop-card`            | 0.9972 | P2-1              | "No flags" removed from the card footer                                                                                |
| `30-tablet-list`             | 0.9979 | P2-1, P3-4        | Card view on tablet: no "No flags"; email reveals its full value on hover                                              |
| `04-desktop-kanban`          | 0.9983 | P2-1              | Same on kanban cards                                                                                                   |

## Unchanged (verified, not assumed)

| Pair                               | SSIM    | Surface                            |
| ---------------------------------- | ------- | ---------------------------------- |
| `01-desktop-list-table`            | 0.99999 | Table chrome, stage cards, toolbar |
| `07-desktop-table-dark`            | 0.99999 | Table in dark mode                 |
| `03-desktop-more-filters`          | 0.99999 | More-filters popover               |
| `02b-desktop-status-filter-bottom` | 0.99900 | Status popover, scrolled           |
| `05-desktop-calendar`              | 0.99999 | Calendar view                      |
| `20-laptop-list`                   | 1.00000 | List at 1024                       |
| `31-tablet-refine-sheet`           | 0.99911 | Refine sheet at 768                |
| `40-phone-list`                    | 1.00000 | Phone list                         |
| `41-phone-list-scrolled`           | 1.00000 | Phone list scrolled                |
| `42-phone-refine-sheet`            | 1.00000 | Phone refine sheet                 |
| `43-phone-date-sheet`              | 1.00000 | Phone date sheet                   |

### One capture artefact

`60-read-only-list` measures 0.990 and is **not** a UI change: the before frame was taken while the
sidebar was still painting its loading skeleton, so one row differs by timing. The list and every
nav item are identical, so the pair is kept out of `compare/`.

## Regression proof

| Layer       | Where                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (UI)   | `workflowActionButtonStyles.test.ts` (pair layout, no `whitespace-nowrap`), `pendingDocStatusGroups.test.ts` (sent/received counters) |
| Unit (edge) | `supabase/functions/_shared/bookingPayload_test.ts` — 5 tests on the payload projection                                               |
| E2E `@ci`   | 22 tests, including axe on a **populated** list and on detail with zero exclusions                                                    |
| Manual      | The 25 pairs above                                                                                                                    |

## Regenerate

```bash
bun run test:e2e:bookings:screens     # writes docs/.../screenshots/ (the current state)
```

The `before/` set is frozen at `dbf287449`; `compare/` is generated from `before/` +
`screenshots/` with a labelled hstack. Re-running the capture rewrites `screenshots/`, so keep
`before/` and `compare/` as the record of this pass.
