---
title: 'Multi-channel calendar sync: live verification after release'
stage: for-testing
status: for-testing
tags: [calendar, channel-sync, agoda, booking-com, airbnb, verification, release]
updated: 2026-11-19
kind: plan
---

# Multi-channel calendar sync: live verification after release

Implementation is **complete and released dark**. What is left is verification against real Agoda and
Booking.com listings and a staged rollout. Plan and design: [`../in-progress/multi-channel-calendar-sync.md`](../in-progress/multi-channel-calendar-sync.md)
(§20 launch checklist, §21 two-way UX).

## What is live after release

- **Airbnb** behaves as before, with the redesigned dialog: each channel is a two-way connection with
  **Get dates from** and **Send dates to** steps, a status of **Two-way**, **Finish setup**, **Needs
  attention** or **Paused**, and Recent activity for both directions.
- **Connecting a channel turns sending on** (`addFeed`), so a new connection is two-way from the start.
- **Agoda and Booking.com are dark.** They are hidden until the edge secret `CALENDAR_CHANNELS_ENABLED`
  lists them (optionally limited by `CALENDAR_CHANNELS_BETA_ORG_IDS`). Clearing the first secret turns
  them off again.
- Migrations `20261343000000` to `20261343001000` (renumbered from `20261342…` after `develop` took those
  versions for billing).

## Open verification

| #   | Item                                      | How to verify                                                                                                                                                                                                                                     | Blocked on                                       | State            |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------- |
| V1  | **Sending turns on at connect (hosted)**  | On `kame-test-tenant`, connect Airbnb. Expect **Send dates to channels** on, step 2 showing the link, and one `integrations.config_changed` row with `auto: channel_connected` in the log.                                                        | Nothing                                          | done 2026-11-19  |
| V2  | **Rollout secrets on the hosted project** | Set `CALENDAR_CHANNELS_ENABLED=agoda,booking_com` and `CALENDAR_CHANNELS_BETA_ORG_IDS=<kame-test-tenant org id>` (runbook in plan §20). Agoda and Booking.com appear only for that org.                                                           | Hosted secret write (needs `kamewave`)           | done 2026-11-19  |
| V3  | **Booking.com real feed**                 | Close one date and make one reservation on Booking.com. Capture the sanitized fixture. Fill the Phase 0 sheet S3 to S7, S9 to S11. Decide whether **Create bookings** can default on.                                                             | Host action on Booking.com                       | open             |
| V4  | **Agoda real feed**                       | Once Agoda approves the listing: connect, capture the fixture, set `hostSuffixes` and URL shape, `classifyEventKind('agoda')`, and check S12 (does Agoda mask links in chat, QR fallback).                                                        | Agoda approval (created 2026-11-17, 1 to 3 days) | open             |
| V5  | **Two-way proof per channel**             | For each channel, the row reaches **Two-way**: the channel reads our link (read time shows) and our import is `Synced`. A date blocked in Kame shows on the channel after its refresh window. Use a live property (see V11), not the test tenant. | V3, V4                                           | partial (Airbnb) |
| V6  | **Live QA matrix**                        | Run plan §13 for Airbnb, Agoda, Booking.com and Direct, including relay between channels, echo handling and a cancellation.                                                                                                                       | V3, V4                                           | open             |
| V7  | **Phone check of the dialog**             | On a real phone: list, a connected channel, a not-connected channel, sending off, Recent activity (empty and filled), paste and connect.                                                                                                          | Nothing                                          | open             |
| V8  | **Beta soak**                             | Zero phantom bookings over 7 days on beta orgs, then clear `CALENDAR_CHANNELS_BETA_ORG_IDS`.                                                                                                                                                      | V2 to V6                                         | open             |
| V9  | **Launch copy**                           | Publish the copy list in plan §20 (plan labels, pricing page, FAQs, Host-facing knowledge), then `check:support-content`, `check:ai-knowledge-coverage`, `check:plan-catalog`.                                                                    | V8                                               | open             |
| V10 | **Parser-drift probe on `/admin/health`** | Add before general availability. Needs a change to the system-health RPC and a second live channel.                                                                                                                                               | V5                                               | open             |

## Found after release

| #   | Finding                                                                                                                                                                                                                                                                                            | What to do                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V11 | **The test tenant's export link answers `410 Gone`.** `ical-export` stops publishing for listings that are not live, and the test property is `INACTIVE` by design. A channel reading that link gets `410`, so the send side cannot reach **Two-way** there.                                       | Prove V1 (the switch and the log row) on the test tenant. Prove the send side (V5) on a live property of the owner's, in a beta org listed in `CALENDAR_CHANNELS_BETA_ORG_IDS`. The import side works on any property.                                                                           |
| V12 | **Cron job not confirmed.** ~~Migration `20261343000500` replaces the sweep with `calendar-sync-every-10m`.~~ **Confirmed 2026-11-19** from the project database.                                                                                                                                  | `calendar-sync-every-10m` runs `*/10 * * * *`, active, with a succeeded run every 10 minutes and no gaps. `calendar-sync-retention-daily` (`23 3 * * *`) is scheduled and has not fired yet. `calendar_sync_runs` fills: 7 runs in 24 hours, all `synced`, zero errors in 7 days. Details below. |
| V13 | **The test tenant cannot connect a channel.** ~~`kame-test-tenant` has no `org_subscriptions` row, so it sat on the default Free plan.~~ **Fixed 2026-11-19:** the tenant now has an active Pro (`growth`) subscription assigned manually, and `kame-test-property` is enrolled. Connecting works. | Keep the test tenant on Pro while V3 to V8 run. Before GA, decide whether the beta org should be a paying host instead, then clear `CALENDAR_CHANNELS_BETA_ORG_IDS`.                                                                                                                             |

## Database and cron checks (2026-11-19)

Read-only queries against the production project `fworvijbrwpyngycotbz` through the Supabase
Management API. No writes were made to the hosted project.

| Check                  | Result                                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations             | All 11 (`20261343000000` to `20261343001000`) present in `supabase_migrations.schema_migrations`                                                                                                                      |
| Cron sweep             | `calendar-sync-every-10m`, `*/10 * * * *`, active. Runs at :00, :10, :20 and so on, each `succeeded`                                                                                                                  |
| Cron retention         | `calendar-sync-retention-daily`, `23 3 * * *`, active, no run yet (added by the migration applied 2026-11-19, first fire 03:23 UTC)                                                                                   |
| Import health          | 7 `calendar_sync_runs` in 24 hours, all `synced`, 1.6 to 2.3 seconds each. Zero non-`synced` runs in 7 days                                                                                                           |
| Export read            | `calendar_export_reads` holds 2 Airbnb reads for `kame-homes` / `kame-home` at 2026-11-18 21:05 UTC, and `property_calendar_export.last_served_at` matches, so the channel did fetch our link                         |
| Export endpoint, live  | `kame-home` (status `ACTIVE`, sharing on) answers `200` with 461 `VEVENT`s. `&as=airbnb` answers `200` with 457: the 4 left out are Airbnb-origin bookings held back by the loop-prevention filter, which is expected |
| Export endpoint, dead  | `kame-test-property` (`INACTIVE`, no export row) answers `410`, an unknown property answers `404` (V11)                                                                                                               |
| Rollout secret         | `CALENDAR_CHANNELS_ENABLED` and `CALENDAR_CHANNELS_BETA_ORG_IDS` are absent from the hosted secrets, so `connectableProvidersFor` returns Airbnb only. V2 is still the switch                                         |
| New table grants       | `calendar_export_reads`, `calendar_sync_runs`, `property_calendar_feeds` and `property_calendar_export` have no `anon` or `authenticated` grants, RLS on                                                              |
| `calendar_sync_events` | RLS on with no policies, but `anon` and `authenticated` still hold full table grants, `TRUNCATE` included. Rows stay hidden and `TRUNCATE` is not reachable through PostgREST; the grant is the PR-096 hygiene item   |
| Local stack            | The local database was 17 migrations behind. `bun run db:migrate` applied all 17 (6 billing `20261342…` plus 11 calendar)                                                                                             |

### Hosted verification pass, 2026-11-19

Run with the owner's `kamewave` instruction. Hosted writes are limited to the two rows below.

| Change          | Detail                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rollout secrets | `CALENDAR_CHANNELS_ENABLED=agoda,booking_com` and `CALENDAR_CHANNELS_BETA_ORG_IDS=f50a7039-365c-4ef9-a80e-867d51ed5372` (test tenant only)                                                                                                                                                                                                                                   |
| Test tenant     | Pro (`growth`) assigned the way `createOrgSubscription` does it: `org_subscriptions` (`source` `admin`, price snapshot 799, 2026-11-18 to 2027-11-18), `org_subscription_properties` slot on `kame-test-property`, `assigned` and `property_added` events, `ai_platform_org_settings` at `growth` / 5000 credits, and one `billing.plan_overridden_by_platform` activity row |

**V2 result.** `calendar-sync-settings` reports `connectableProviders`:

| Org                | Plan     | In beta list | Connectable                      |
| ------------------ | -------- | ------------ | -------------------------------- |
| `kame-test-tenant` | Pro      | yes          | `airbnb`, `agoda`, `booking_com` |
| `kame-homes`       | Business | no           | `airbnb`                         |

So the list scopes the new channels to one org, and a paying org outside it still sees only Airbnb.

**V1 result.** Connected Airbnb on `kame-test-property` with a shape-valid Airbnb URL. Before the write:
no feeds, sharing off.

- The feed row was created with `create_bookings` true.
- `property_calendar_export.is_enabled` went from `false` to `true` with no second step.
- `activity_log` gained `integrations.connected` and `integrations.config_changed` with
  `{"auto":"channel_connected","setting":"export_enabled","enabled":true,"feed_provider":"airbnb"}`.
- `initialSync` came back as `error` with `http_404`, because the URL was synthetic. That path is
  non-fatal and does not affect the switch proof.

Cleaned up afterwards: sharing off again, feed removed, so the test tenant is back to no feeds and
sharing off. `kame-homes` was not touched (1 feed, sharing on).

### How to repeat the hosted checks

Hosted password sign-in answers captcha, so the scripted path is a magic link minted with the service
role:

1. `POST /auth/v1/admin/generate_link` with `{"type":"magiclink","email":"<host email>"}`.
2. Open the returned `action_link` without following redirects and read `access_token` from the
   `Location` fragment.
3. Call `calendar-sync-settings?property_id=<uuid>` with that bearer token. The body is wrapped in `data`.
4. `PATCH` `{"action":"addFeed","provider":"airbnb","icsUrl":"https://www.airbnb.com/..."}`.

Never print the session or the export token. `kame-test-property` is `INACTIVE`, so its export link still
answers `410` (V11). Use a live property to prove sending.

### Next up

V3 and V4 need the host's real Booking.com and Agoda listings. After those, V5 to V9 follow, and V10
lands before general availability.

## Known, not caused by this release

- `hostVerificationStates.spec.ts` ("changes requested forces the modal and allows a resubmit") fails the
  same way on a clean `develop` checkout.
- Locally, a `supabase/.env.local` that enables captcha makes 5 Deno handler tests fail
  (`submit-sd-form`, `submit-form-completion`). Run them with `CAPTCHA_MODE=disabled`. CI is unaffected.
- A local database that already applied the old `20261342…` calendar versions needs a re-migrate or reset
  before it can apply the renumbered files. Hosted is unaffected. The local database used for this
  verification was re-migrated on 2026-11-19 and is current.

## Roll back

- **Turn the new channels off:** clear `CALENDAR_CHANNELS_ENABLED`. Takes effect on the next invocation.
- **Pause a channel or imports for everyone:** super-admin feature availability keys
  `pricing.channel_sync`, `.import`, `.airbnb`, `.agoda`, `.booking_com`.
- **Stop sending to channels for one property:** the **Send dates to channels** switch.
- **Functions or migrations:** `cd-rollback.yml` (needs `kamewave`).

## Release record

### 2026-11-19

| Step                          | Result                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend, PR #493 to `develop` | Squash merge `fccd8b110`. Run `cd-prod.yml` 44377051654: quality, backup, `db push` (migrations `20261343000000` to `001000` applied), functions deployed, smoke OK, migration drift OK |
| UI, PR #524 to `main`         | Cherry-pick of the squash onto a branch from `main` (audit docs left out), merge commit `bc225674f`. Vercel Production deployment succeeded                                             |
| Merged with admin override    | Both PRs needed a code-owner review. Merged with `--admin` on the owner's explicit instruction (`kamewave`)                                                                             |

**Checked from outside after release** (no database access, public anon key only):

- Live bundle `PropertyPricingPage` contains the new strings (`Get dates from`, `Send dates to channels`, `Finish setup`, `read your dates`, `No activity yet`).
- `calendar_export_reads`, `calendar_sync_runs` and `property_calendar_feeds` exist and answer `42501` to anon (not `404`), so the migrations ran and the tables are closed. `sync_calendar_sync_cron_job` and `prune_calendar_sync_history` answer `401` to anon.
- `calendar-sync-settings` and `calendar-sync-cron` answer `401` without credentials. `ical-export` answers `404` for an unknown property.
- `calendar_sync_events` answers `200 []` to anon. It is an older table and RLS hides every row, so this is not new, but it is on the list of tables whose anon grant should be tightened (ledger PR-096).
