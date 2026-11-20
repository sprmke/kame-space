---
title: 'PR-145 — data-subject export and deletion requests'
status: active
tags: [workflow, production-readiness, evidence, privacy, compliance]
updated: 2026-11-20
stage: in-progress
kind: evidence
readiness: partial
launch_gate: F
---

# PR-145 — RA 10173 export and deletion requests

## Decision

- **Export is self-service and synchronous.** The signed-in user downloads their own data as
  JSON. No operator step, no stored copy to retain or leak.
- **Deletion is a reviewed request, not an automated eraser.** Bookings are financial records
  with a lawful retention basis and a wrong delete cannot be undone. A request gets a 15-day due
  date; a daily cron raises a P1 ops alert when it is due; an operator runs the documented
  anonymise/delete runbook. Dates, amounts and status stay for accounting; personal fields go.

## What shipped

| Piece                                            | Path                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| Request/audit table + retention + cron scheduler | `supabase/migrations/20261348000000_data_subject_requests.sql`            |
| Export assembly, deletion request, due list      | `_shared/dataSubjectService.ts`                                           |
| `data-subject-request` (authenticated POST)      | `supabase/functions/data-subject-request/index.ts`                        |
| Daily due-date alert cron                        | `supabase/functions/data-subject-requests-cron/index.ts`                  |
| Job registry entry                               | `_shared/systemHealth/jobsRegistry.ts`                                    |
| Guest UI                                         | `ui/src/features/guest/account/components/GuestPrivacyCard.tsx` (Profile) |
| Client calls                                     | `ui/src/features/guest/account/lib/guestAccountApi.ts`                    |

**Export scope:** `guest_profiles`, own `guest_submissions` (guest link), own `guest_reviews`,
`guest_saved_properties`, `identity_verifications` summary fields (no capture paths or hashes),
`guest_requests`, own `support_tickets` + messages, `guest_chat_ai_feedback`, and host data:
owned organizations, org/property memberships, and the property names on those memberships.
Collections are capped at 500 rows and say so.

**Deletion request:** one open request per user (`kind = delete`), repeated calls reuse it,
`confirm: 'DELETE'` required. The cron only alerts; it never destroys.

## Verification (2026-11-20, local stack)

| Check                       | Result                                                               |
| --------------------------- | -------------------------------------------------------------------- |
| `bun run test:edge:privacy` | 2 passed, 0 failed                                                   |
| Export shape for a new user | subject id/email, empty arrays, profile null, retention note present |
| Deletion request            | pending, due ~15 days, idempotent (same id)                          |
| Due list                    | excludes future requests, includes one moved into the past           |
| Migration                   | applied locally                                                      |
| UI                          | `bun run type-check` passes; card is a bottom sheet at phone widths  |

## Remaining (not code-only)

- **Host-account UI entry.** The endpoint already returns host data for any authenticated user;
  the card currently lives on the guest profile. Add the same action to the host account
  settings surface.
- **Operator runbook execution.** Documented in `docs/guides/routes/account/profile.md` and the
  checklist; the first real request needs a named reviewer.
- **Legal sign-off** on the retention wording.
- Set the Vault secret `data_subject_requests_secret` and call
  `select public.sync_data_subject_requests_cron();` in production.

`activity-log: N/A` — guest accounts are not org/property/parking scoped; the
`data_subject_requests` row is the audit record. Plans/RBAC: N/A (guest personal data, not a
paid feature).
