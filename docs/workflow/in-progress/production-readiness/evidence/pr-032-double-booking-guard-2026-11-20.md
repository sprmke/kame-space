---
title: 'PR-032 — DB double-booking guard'
status: active
tags: [workflow, production-readiness, evidence, money, data-integrity]
updated: 2026-11-20
stage: in-progress
kind: evidence
readiness: verified
launch_gate: C
---

# PR-032 — DB double-booking guard

**Decision:** enforce stay overlap in the database with a `BEFORE INSERT OR UPDATE` trigger, not an
`EXCLUDE` constraint.

Why not `EXCLUDE USING gist`:

- An exclusion constraint validates every existing row when it is added, and PostgreSQL has no
  `NOT VALID` form for exclusion constraints. One legacy overlap would abort a deploy.
- OTA feed imports are recorded on purpose even when they overlap a direct booking. That overlap is
  the conflict the host resolves through the calendar conflict flow; rejecting the insert would
  lose the reservation.

## What shipped

- `supabase/migrations/20261345000000_booking_stay_no_overlap_guard.sql`
  - `public.booking_text_to_date(text)` — immutable parser matching the `check_in_date_sql` /
    `check_out_date_sql` generated columns (a BEFORE trigger cannot read NEW generated values).
  - `public.enforce_booking_stay_no_overlap()` — skips `CANCELLED`, `IMPORTED`, OTA rows
    (`external_feed_id`), parking rows and malformed dates. Takes
    `pg_advisory_xact_lock(hashtext('booking_stay_no_overlap:<property>'))` so the check and the
    insert are serialized per property. Rejects with SQLSTATE `23P01`.
- `_shared/databaseService.ts` — `23P01` on guest save/update becomes the existing
  `BOOKING_OVERLAP:` message, so the guest toast is unchanged.
- `_shared/bookingDetailsPatch.ts` + `update-booking-details` — `23P01` becomes a 409
  `BOOKING_DATE_CONFLICT`, so an admin reschedule race gets a clear error instead of a 500.
- `tests/bookingStayOverlapGuard.integration_test.ts` + `bun run test:edge:overlap`.

## Verification (2026-11-20, local stack)

| Check                                        | Result                                                     |
| -------------------------------------------- | ---------------------------------------------------------- |
| `bun run db:migrate`                         | migration applied                                          |
| `bun run test:edge:overlap`                  | 6 passed, 0 failed                                         |
| Overlap rejected                             | `23P01` `BOOKING_DATE_CONFLICT`                            |
| Back-to-back (`check-out` = next `check-in`) | accepted                                                   |
| Same-day stay occupies one night             | overlap rejected                                           |
| `CANCELLED` / `IMPORTED`                     | accepted (do not block)                                    |
| OTA feed row (`external_feed_id` set)        | accepted (conflict surfaced by calendar sync)              |
| Two concurrent overlapping inserts           | exactly one accepted, one `23P01`                          |
| Manual two-session race (psql, one commits)  | second session blocked on the advisory lock, then rejected |

Residual: rows written while the trigger did not exist are not revalidated. A data audit can be run
read-only with `docs/workflow/in-progress/production-readiness/edge-cases/03-availability-double-booking.md`
(`AVL-02`).
