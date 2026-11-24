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

| Pair                         | SSIM  | Item                     | What to look at                                                                                                        |
| ---------------------------- | ----- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `32-tablet-detail`           | 0.70  | P1-1, P1-2               | Was a 320px rail squeezed beside a 400px booking; now one column, Progress first, header/tabs/CTA all readable         |
| `51-phone-detail-workflow`   | 0.65  | P1-1, P2-8, P2-10        | "Mark GAF as complet" → full label on its own row; "2 of 2 sent" / "0 of 1 received"; no quick-access pill over Cancel |
| `52-phone-detail-lower`      | 0.65  | P1-1                     | Same scroll position, CTA pair no longer overlapping Cancel booking                                                    |
| `50-phone-detail`            | 0.78  | P2-2, P3-1               | No constant "DIRECT" chip; 44px back-link hit area                                                                     |
| `21-laptop-detail`           | 0.80  | P1-3                     | Progress was 1,234px below the fold at 1024; it is now the first panel                                                 |
| `10-desktop-detail-overview` | 0.81  | P2-2, P2-7, P1-1         | No "DIRECT"; "Guest still needs: …"; pair stacks rather than clipping at the 384px rail                                |
| `16-desktop-detail-dark`     | 0.83  | same as above, dark mode | Contrast and spacing hold in dark                                                                                      |
| `62-free-plan-detail`        | 0.86  | P1-1, P2-2               | Free-plan manual-send rail keeps its labels intact                                                                     |
| `61-read-only-detail`        | 0.87  | P1-4, P1-5               | Door code is text, not an input + Save; the review gate is a "View only" note                                          |
| `06-desktop-card`            | 0.997 | P2-1                     | "No flags" removed from the card footer                                                                                |
| `04-desktop-kanban`          | 0.998 | P2-1                     | Same on kanban cards                                                                                                   |
| `30-tablet-list`             | 0.998 | P2-1, P3-4               | Card view on tablet: no "No flags"; email reveals its full value on hover                                              |
| `02-desktop-status-filter`   | 0.999 | P2-6                     | Scroll shadow at the clipped edge of the status list                                                                   |

## Unchanged (verified, not assumed)

| Pair                               | SSIM    | Surface                                      |
| ---------------------------------- | ------- | -------------------------------------------- |
| `01-desktop-list-table`            | 0.99999 | Table chrome, stage cards, toolbar           |
| `07-desktop-table-dark`            | 0.99999 | Table in dark mode                           |
| `03-desktop-more-filters`          | 0.99999 | More-filters popover                         |
| `02b-desktop-status-filter-bottom` | 0.99900 | Status popover, scrolled                     |
| `05-desktop-calendar`              | 0.99999 | Calendar view                                |
| `20-laptop-list`                   | 0.99999 | List at 1024                                 |
| `31-tablet-refine-sheet`           | 0.99996 | Refine sheet at 768                          |
| `40-phone-list`                    | 1.00000 | Phone list                                   |
| `41-phone-list-scrolled`           | 0.99999 | Phone list scrolled                          |
| `42-phone-refine-sheet`            | 0.99996 | Phone refine sheet                           |
| `43-phone-date-sheet`              | 1.00000 | Phone date sheet                             |
| `60-read-only-list`                | 0.99999 | Read-only list (Import / New already hidden) |

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
