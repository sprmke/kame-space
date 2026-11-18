---
title: 'Audit 14: codebase architecture and implementation quality'
status: active
tags: [audit, architecture, code-quality]
updated: 2026-11-19
---

# 14: Codebase architecture and implementation quality

Static analysis of the repo plus targeted runtime measurements. This is not a style review; each
finding is something that will cost time, money or correctness.

## Scale

| Metric             | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| UI source          | 517k lines across `ui/src`                                |
| Edge functions     | **368** with an `index.ts` (365 entries in `config.toml`) |
| Edge source        | 256k lines under `supabase/functions`                     |
| Migrations         | 482 files                                                 |
| Public tables      | 169                                                       |
| UI unit tests      | 914 files                                                 |
| Edge unit tests    | 273 files                                                 |
| Edge handler tests | 400 files                                                 |
| Playwright specs   | 121 files                                                 |
| UI runtime deps    | 93 (plus 31 dev)                                          |

---

## P1

### C1. There is no generated database type surface

`supabase gen types` is not used and no `database.types.ts` exists. Every table shape is a
hand-written interface (`BookingRow`, `Property`, …) across 368 functions and the UI. With 169 tables
and 482 migrations, column drift is inevitable and TypeScript cannot catch it. The Phase 1 audit
already found one symptom: `guest_submissions.special_requests` does not exist while
`guest_special_requests` does (a probe failed on the wrong name).

Direction: generate types in CI, commit them, and use `Database['public']['Tables'][...]` (or at
least a generated `Row` map) in both `ui/src` and `_shared`. Add `bun run db:types`.

### C2. Seven tables exist in the local database that no migration creates

Diffing `pg_tables` against every `CREATE TABLE` in `supabase/migrations`:

```
calendar_export_reads
calendar_sync_runs
development_settings_history
org_billing_details
org_billing_ledger
org_billing_notifications
plan_price_migrations
```

None of these names appears anywhere in migrations, scripts, edge functions or the UI. They are
orphans from manual SQL or a deleted migration. Consequences:

- `bun run db:reset` cannot reproduce the local database, so a fresh environment differs from the
  one every agent and developer tests against.
- If any of them is referenced by a SQL function or a future feature, it will be missing in a fresh
  environment and present in production (or vice versa).
- Three are billing tables, which is exactly where an orphan is most dangerous.

Direction: decide per table (drop, or add a migration that creates it), and add a CI check that the
schema built from migrations matches a dump of the canonical database.

### C3. 368 edge functions, 151 of them under 80 lines

151 functions are thin CRUD wrappers (61 are under 40 lines). Each one is:

- a separate cold start (100-300ms) on first hit,
- a separate entry in `config.toml` (and 3 are missing from it, see S4),
- a separate deploy unit and log stream,
- a separate place to forget the auth wrapper.

Direction: group by resource into a small number of routers (`bookings-api`, `org-api`,
`marketing-api`, …) with an internal action switch, keeping the auth wrapper and rate limit at the
router level. Target under 100 functions. Cold starts collapse and the config surface shrinks.

### C4. God files that will keep producing merge conflicts

| File                                                         | Lines | Problem                                             |
| ------------------------------------------------------------ | ----- | --------------------------------------------------- |
| `_shared/dashboardAssistantTools.ts`                         | 5,588 | entire assistant tool catalog in one file           |
| `ui/.../guest/form/components/GuestForm.tsx`                 | 2,925 | 5 steps, validation, uploads, dev controls, submit  |
| `ui/components/skeletons/AdminSkeletons.tsx`                 | 2,038 | every admin skeleton in one module                  |
| `ui/.../marketing/components/video-editor/VideoEditorV2.tsx` | 1,796 | editor + render + export                            |
| `_shared/databaseService.ts`                                 | 1,998 | god service across bookings, guests, parking, email |
| `_shared/activityLog.ts`                                     | 1,976 | catalog + writer + formatting                       |
| `_shared/emailService.ts`                                    | 1,812 | every transactional email                           |
| `ui/.../bookings/components/AdminLayout.tsx`                 | 1,436 | shell, nav, sheets, assistant, AI mode              |

These are the files most likely to conflict when two people work in parallel, and the hardest to
review. Direction: split by sub-domain with a barrel-free import path, e.g.
`guest-form/steps/{GuestStep,StayStep,…}.tsx` plus a `useGuestFormSubmit` hook; assistant tools into
`tools/{bookings,finance,team,marketing}.ts` behind a registry.

### C5. Two sources of truth for super admin

`platform_super_admins` has 3 rows in the seed, but authorization uses the `SUPER_ADMIN_EMAILS` env
var (`superAdminAuth.ts`). The table is only referenced by one SQL policy. So:

- adding a row does **not** grant super admin,
- removing a row does **not** revoke it,
- the seed implies three super admins who are not super admins in code.

Direction: pick one. Prefer the table (auditable, no redeploy) and read it from
`superAdminAuth`; keep the env var as a bootstrap only.

---

## P2

### C6. Client/server duplication is deliberate but fragile

`statusMachine` / `workflow.ts`, `planFeatures`, `planPresentation`, team permissions and pricing
tables all exist twice. Parity tests cover some pairs (plan catalog, status machine), but the
migration history shows how easily they drift. Direction: keep the duplication (edge and UI cannot
share a package today) but generate the client mirror from the server table at build time, or add a
CI diff for every mirrored file.

### C7. No optimistic concurrency on booking edits

`useUpdateBooking` PATCHes a booking without sending an `updated_at` it read, and the edge handler
does not compare versions. Two admins editing the same booking (or one admin plus a guest revert)
overwrite each other silently. Direction: `WHERE id = ? AND updated_at = ?` and return 409 with a
"reload and retry" message.

### C8. Idempotency only exists for offline replay

`withIdempotency` is applied to 5 handlers (`transition-booking`, guest chat send, notifications
mark-read, social send, one more) and only activates when the client sends `Idempotency-Key`. The
manual UI never sends it. `submit-form` and `create-org-subscription-checkout` have no idempotency at
all. A slow network retry on checkout can create two PayMongo sessions; on submit it can create two
booking attempts (usually stopped by the overlap check, not by design).

### C9. Duplicate API calls on mount

Measured on property pages: `list-properties` is called **twice** per load, and the org dashboard
calls `org-access` twice. Both are extra function invocations on every page view. Direction: find the
non-React-Query caller (likely the sidebar prefetch) and reuse the query cache.

### C10. 188 `console.log` calls in edge code

Every log line is ingested and billed by the platform, and it buries real errors. Several handlers log
per-file upload, per-transition and per-request payload shape. Direction: a small `log` helper with
levels, debug gated by `EDGE_LOG_DEBUG`, and structured fields.

### C11. Error envelopes are inconsistent

Most handlers use `jsonError`, but several build `new Response(JSON.stringify(...))` by hand, and the
guest UI then displays whatever `error` string came back (see 01-G1). Direction: one error envelope,
a `publicMessage` separate from `internalMessage`, and a UI rule that only `publicMessage` is shown.

### C12. No API versioning or deprecation path

369 functions are called directly by URL from the UI. A breaking change requires a coordinated UI and
edge deploy. Several functions already keep legacy shapes (`?tab=`, `LegacyAdminRedirect`). Direction:
accept that edge+UI ship together, but version the few public endpoints guests hold links to
(`get-form`, `get-sd-form`, `get-guest-trip`).

### C13. Coverage floor is low for the risk profile

`vitest.config.ts` enforces 41% statements / 35% branches. The suite is large (914 UI tests), but the
floor means new heavy modules can land under-tested without failing CI. Money and permission paths
(checkout, transitions, RBAC) deserve an explicit per-directory threshold.

### C14. Bundle composition

Production build (measured):

```
Initial: entry 258.8 KiB gzip + 10 chunks = 657.3 KiB gzip
  index (app)                 258.1 KiB
  react-vendor                 90.6
  observability-vendor         90.5   (Sentry + PostHog, eager)
  supabase-vendor              55.7
  radix-vendor                 47.1
  motion-vendor (framer)       46.9
  icons-vendor                 22.5
  ui-vendor                    20.5
  query-vendor                 12.7
PWA precache shell: 4,413.8 KiB / 4,608 KiB (96%)
PWA total:         20,864.5 KiB / 22,528 KiB (92%)
Largest lazy chunks: exportVideoMedia 731 KiB, PropertySettingsCard 617.9 KiB,
                     Kame 491 KiB, AreaChart 345 KiB, renderPdfPageImages 326 KiB
```

Two concrete problems:

- **Sentry + PostHog (90.5 KiB gzip) are in the initial bundle for every guest**, even though they only
  matter after consent or after first interaction. Lazy-load them behind the consent choice and an
  idle callback.
- **The PWA precache is at 96% of its budget.** The next feature that touches the shell will fail the
  build (`check-precache-budget.mjs`). Either raise the budget deliberately or move more of the shell
  off the precache list.

---

## P3

- 17 `any` casts in the UI and 0 `@ts-ignore` (good), but many `Record<string, unknown>` boundaries in
  edge code mean payload shapes are unchecked.
- 482 migrations with no squash strategy. Reading the chain to understand one column is slow; a
  periodic baseline dump (not applied to production) would help onboarding.
- `mockProperties.ts` (1,668 lines) and `calendarPresets.ts` (1,742) are data blobs living in source;
  they could be JSON assets or generated.
- Naming drift: `inbox` folder vs "Messages" UI, `growth`/`pro` internal codes vs Pro/Business display
  names (documented, but every new file must remember it).
- There is exactly 1 `TODO/FIXME` in the codebase, which almost certainly means deferred work is
  tracked elsewhere rather than in code. That is fine if the issue tracker is current; it is a risk if
  it is not.

## What is good

- `serveAdmin` / `serveAuthenticated` / `servePublic` / `serveCronPost` wrappers: one auth and rate-limit
  policy instead of 368 copies.
- Centralized response cache classes that fail closed to `private, no-store`.
- Sanitization: every `dangerouslySetInnerHTML` sink goes through DOMPurify configs.
- Webhook signature verification on Resend (Svix), PayMongo and Meta, with dedupe tables.
- Magic-byte validation on uploads and explicit bucket MIME/size limits.
- Plan feature catalog with a server mirror, a golden tier matrix and drift tests.
- An AI metering layer with per-feature model routing, credit conversion, in-flight reservations and a
  billing-repair sweeper.
- Route-level code splitting (142 dynamic imports) and skeletons that match final layout.
- Indexes on every hot booking column, including partial indexes for the workflow queries.
