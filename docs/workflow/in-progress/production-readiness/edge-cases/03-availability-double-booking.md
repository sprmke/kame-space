---
title: 'Edge cases: availability and double booking'
status: active
tags: [workflow, in-progress, production-readiness, edge-cases, availability]
updated: 2026-11-21
stage: in-progress
kind: plan
readiness: untracked
launch_gate: A
launch_blocker: tbd
last_verified: none
---

# Availability and double booking (`AVL`)

**Owned elsewhere:** DB exclusion constraint (ledger PR-032), concurrency tests (checklist 35 row 1), iCal conflicts and the host resolution sheet ([`calendar-sync-conflict-resolution.md`](../../../planned/calendar-sync-conflict-resolution.md)), parking slot claim race ([`parking-module-hardening.md`](../../parking-module-hardening.md) P0-3).

## How it works today

- `submit-form` and `submit-form-completion` call `DatabaseService.checkOverlappingBookings` (non-cancelled rows, owner-blocked dates) and the cleaning-buffer adjacency check before insert. It is a read-then-write in the app; there is no database constraint.
- Same-day stays occupy one night (PR-156).
- A pending request holds the dates until `pending-review-expiry` releases them.

## Gaps

| ID     | Scenario                                                                              | Today                                                                                                                                      | Target                                                                                                                                                                                                          | Sev | Tag |
| ------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| AVL-01 | Host reschedules a booking onto dates that are already taken                          | **Confirmed.** `bookingDetailsPatch.ts` `reschedule` only checks date order, then writes. No overlap, owner-block or cleaning-buffer check | Run the same overlap + buffer check as `submit-form`, excluding the booking itself. Return `409 dates_unavailable` with the clashing booking. Covered by the DB constraint once PR-032 lands                    | P0  | 🆕  |
| AVL-02 | Two guests submit the same dates at the same moment                                   | App-level check only                                                                                                                       | Listed for priority. Owned by PR-032                                                                                                                                                                            | P0  | 🧭  |
| AVL-03 | Rescheduled booking keeps the old rate                                                | Reschedule recomputes nights, not the rate or balance                                                                                      | Reschedule shows the new quote (pricing calendar for the new nights) and asks the host to keep or apply it; the guest is told (STAY-02)                                                                         | P1  | 🆕  |
| AVL-04 | Guest books a night already sold on Airbnb / Agoda inside the iCal sync gap           | Conflict plan §8.4 proposes an optional just-in-time check                                                                                 | Promote §8.4 to required for properties with any import feed: re-pull feeds (or check the last pull age) before confirming, and hold the request in `PENDING_REVIEW` with a conflict badge if the feed is stale | P1  | 🧭  |
| AVL-05 | Booking submitted for tonight after the check-in time, or for a past date via the API | Past dates are disabled in `GuestForm.tsx`; no server-side check found                                                                     | Server rejects check-in before today (Manila). Property setting "Same-day booking cutoff" (default: check-in time minus 2h)                                                                                     | P1  | 🟡  |
| AVL-06 | No minimum stay, maximum stay or advance window                                       | No property setting found                                                                                                                  | Pricing settings: min nights (per date range), max nights, booking window (e.g. 365 days). Enforced in `submit-form` and the reschedule path                                                                    | P2  | 🆕  |
| AVL-07 | Host blocks dates that already have a confirmed booking                               | Not verified                                                                                                                               | Blocking over a booking warns and lists the bookings; it never cancels them silently                                                                                                                            | P1  | 🟡  |
| AVL-08 | Pending requests used to hold dates (competitor or spam)                              | Anti-spam gate + request expiry                                                                                                            | Cap open pending requests per guest identity / IP per property; show the host "3 open requests for overlapping dates" so they pick one                                                                          | P2  | 🆕  |
| AVL-09 | Two pending requests overlap; host approves both                                      | Not verified whether approve re-checks overlap                                                                                             | Approve (`PENDING_REVIEW` to next status) re-runs the overlap check against confirmed bookings and fails with the clashing booking                                                                              | P0  | 🟡  |
| AVL-10 | Property in a multi-unit development; guest picks unit A, host moves them to unit B   | Not verified                                                                                                                               | Moving a booking between properties runs the target's overlap check, re-snapshots nothing (policy stays), and notifies the guest of the new unit and address                                                    | P1  | 🟡  |
| AVL-11 | Property archived or paused between booking and stay                                  | Owned by the archive plan                                                                                                                  | Listed for priority only                                                                                                                                                                                        | P1  | ⏸️  |
| AVL-12 | Imported bookings (CSV / Excel) overlap existing bookings                             | **Confirmed.** No overlap check in `import-commit` or `_shared/importPreviewService.ts`                                                    | Preview flags each overlapping row with the clashing booking; commit skips them unless the host explicitly imports with a conflict badge                                                                        | P1  | 🆕  |

## Tests to add

- Deno: reschedule onto an occupied range returns `409` and leaves the row unchanged.
- Deno: approving the second of two overlapping requests fails.
- Deno: `submit-form` with a past check-in returns `400`.
