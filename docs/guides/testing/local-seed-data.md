---
title: 'Local seed data'
status: active
tags: [guides, testing, local, seed]
updated: 2026-11-08
---

# Local seed data

One canonical dataset for local development: **one organization, one property, one parking**, with realistic rows for every module we support.

Files live in [`scripts/dev/seed/`](../../../scripts/dev/seed/) and load automatically on `bun run db:reset` via `supabase/config.toml` `[db.seed]`.

## Marketing Trends

`22-marketing-trends.sql` publishes one run for today with six `today` topics and the same six in
the `week` window, plus a source-health map that shows Netflix as stale. The rail, the sheet and
`/admin/marketing-trends` all render without waiting for the cron. `99-verify.sql` asserts the
published run exists for today, has at least five topics, and has a non-empty week window.

## Canonical identity

| Entity       | Value                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Organization | `kame-homes` — Kame Space                                                                                |
| Property     | `kame-home` — Monaco 2604                                                                                |
| Parking      | `monaco-level-2-slot-27`                                                                                 |
| Development  | `azure-north-residences`                                                                                 |
| Plan         | Business (`pro`), active                                                                                 |
| Seed owner   | `seed-owner@example.com` / `seed-password`                                                               |
| Demo guest   | `guest.demo@example.com` / `seed-password`                                                               |
| Team         | `manager.demo@`, `operations.demo@`, `viewer.demo@`, `parking.demo@` (all `@example.com`, same password) |

Dashboard paths:

```
/org/kame-homes
/org/kame-homes/property/kame-home
/org/kame-homes/parking/monaco-level-2-slot-27
```

## Commands

| Command                                       | Does                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `bun run db:reset`                            | Full local reset, migrations, then the canonical seed, then verification.            |
| `bun run seed:local`                          | Applies the seed to a running local DB. Idempotent.                                  |
| `bun run seed:refresh`                        | Purges seed rows and the retired Azure fixtures, then reapplies.                     |
| `bun run seed:verify`                         | Runs the SQL invariant checker only.                                                 |
| `bun run seed:verify-ui`                      | Walks every org / property / parking / admin / guest / public route at 375 and 1280. |
| `bun run seed:attach-admin`                   | Creates or attaches your local super-admin account to the demo org.                  |
| `bun run seed:search-fixtures`                | Optional Azure listings so the typeahead **See all** state has 4+ results.           |
| `bun run seed:plan -- --plan=free`            | Switches the org plan and records an `org_subscription_events` row.                  |
| `bun run seed:feature-flags apply` / `remove` | Demo feature-availability overrides.                                                 |
| `bun run seed:integrations`                   | Reports which external integrations can run and enables the safe switches.           |
| `bun run check:seed-identity`                 | Fails on retired `monaco-2612` / `org/kame-home` references.                         |
| `bun run seed:mock-listings`                  | Optional 320-listing performance dataset. Never runs on reset.                       |

Every command is local-only. None of them touch a hosted Supabase project.

## Signing in

The seed creates email/password logins, so Google OAuth is not required:

- Owner: `seed-owner@example.com` / `seed-password`
- Guest portal: `guest.demo@example.com` / `seed-password`

For the real super-admin account (`/admin/*`):

```bash
bun run seed:attach-admin
```

This reads `ADMIN_ALLOWED_EMAILS` / `VITE_SUPER_ADMIN_EMAILS` from the local env, creates the auth user if it does not exist yet (password `seed-password`), and grants org admin + property Full Access + parking MANAGER + super admin. No personal email is committed. Re-run it after `db reset`, because a reset drops the auth user.

## What is seeded

| Area          | Rows                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Bookings      | 60 property bookings over ~12 months, every workflow status, every channel, pets, parking, SD refunds, imported row |
| Parking       | 14 parking bookings, every parking status, broadcasts and payment rows                                              |
| Finance       | 45 line items across property and parking, cancellation request, 2 refunds, paid subscription                       |
| Maintenance   | 20 items: overdue, due soon, upcoming, completed                                                                    |
| Pricing       | 12 date overrides, 6 blocked dates, smart-pricing run + 3 recommendations, calendar feed + sync events              |
| Marketing     | 3 themes, 6 templates, 12 media assets, 9 publications, 2 AI sessions                                               |
| Inbox         | Facebook, Instagram and web-chat threads, 30 messages, unread counts, one AI handoff                                |
| Reviews       | 10 guest reviews (2 with photos), 3 host reviews, 1 report, automation rule                                         |
| Public pages  | Stay guide and showcase pages with page configs                                                                     |
| Support       | 5 tickets across every status with message threads                                                                  |
| Notifications | 12 across the main types, half read, preferences                                                                    |
| Activity      | 40 rows across org, property and parking, all actor types and severities                                            |
| Analytics     | 180 page views over 90 days plus an AI review                                                                       |
| AI            | Org/property settings, wallet, 30 days usage, 2 assistant conversations                                             |
| Super admin   | Pending recommended listing, 3 ops reports, 20 audit events, 3 platform announcements                               |
| Guest portal  | Profile, saved listing, 2 requests, 3 vouchers, 4 trips linked by email                                             |

Dates are relative to `CURRENT_DATE`, so the calendar and dashboards always look current.

## What is intentionally not live

External integrations need real credentials. The seed configures the DB side and leaves them inactive:

| Integration       | Local state                           | To activate                        |
| ----------------- | ------------------------------------- | ---------------------------------- |
| Telegram          | Settings rows, `enabled = false`      | Add a bot token, then enable in UI |
| Meta inbox        | Channels exist, status `disconnected` | Add `META_*` env vars, reconnect   |
| Marketing publish | Publications seeded as drafts         | Add `META_*` env vars              |
| Gemini / AI       | Settings + credits granted            | Add `GEMINI_API_KEY`               |
| PayMongo          | Payment settings configured           | Add `PAYMONGO_*` test keys         |

This is expected. A missing integration should not look like a seed bug.

## Plan and feature testing

The org starts on **Business (`pro`)**, so every module is available. Change the plan from:

```
/admin/pricing/subscriptions
```

or from the terminal:

```bash
bun run seed:plan -- --plan=free
bun run seed:plan -- --plan=pro
```

Feature availability is fully enabled (no overrides). To test a disabled module:

```bash
bun run seed:feature-flags apply    # disables marketing.ai_studio + analytics regeneration with banners
bun run seed:feature-flags remove   # back to everything enabled
```

## Known local limitations

| Symptom                                                         | Why                                                                                                       | Fix                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps shows "This page didn't load Google Maps correctly" | The local `VITE_GOOGLE_MAPS_API_KEY` is referrer-restricted and does not allow `localhost` / `127.0.0.1`. | Add both origins to the key's HTTP referrer list in Google Cloud, or clear the key to fall back to the keyless legacy embed. The page data is unaffected. |
| A page occasionally returns 502 / 503 during automated walks    | `functions serve` uses one-shot workers; a burst of route loads can exhaust them.                         | Retry the page. Manual browsing does not hit this.                                                                                                        |
| Telegram / Meta / AI calls fail                                 | No bot token, Meta app secret, or Gemini key in `supabase/.env.local`.                                    | Run `bun run seed:integrations` to see exactly which keys are missing.                                                                                    |

## Preserving data

- Reference/catalog data (plans, FAQs, playbook, AI knowledge base, limit profiles, reply templates, platform settings) is migration-owned and never deleted by the seed.
- Seed rows use fixed `5eed…` UUIDs and `local_seed` tags. `seed:refresh` deletes only those.
- `db reset` destroys the whole local database. Take a dump first if you need to keep manual data:

```bash
docker exec supabase_db_guest-form-management pg_dump -U postgres -d postgres > backups/local/manual.sql
```

## Playwright identities

The mocked E2E suite is separate and unchanged:

| Purpose                 | Org                        | Property       | Source                 |
| ----------------------- | -------------------------- | -------------- | ---------------------- |
| Local Supabase seed     | `kame-homes`               | `kame-home`    | `scripts/dev/seed/`    |
| Playwright mocked E2E   | `sample-stays-ph`          | `solea-mactan` | `ui/e2e/shared/ids.ts` |
| Marketing showcase mock | static `mockProperties.ts` | 81 slugs       | frontend static data   |

Live local harnesses (`assistantLiveLocalHarness.ts`, `parkingLiveLocalHarness.ts`) use the canonical local identity.

## Troubleshooting

| Symptom                                 | Fix                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `99-verify` fails with extra properties | An old database still has fixtures. Run `bun run seed:refresh` or `bun run db:reset`. |
| `seed:local` fails on `db query -f`     | Each seed file must stay a single statement (one `DO $$ … $$`).                       |
| 502 on `/functions/v1/*` after reset    | Kong holds a stale runtime IP. `bun run stop:supabase` then `./dev.sh`.               |
| Sign-in works but the org is missing    | Run `bun run seed:attach-admin` after the first Google sign-in.                       |
| Typeahead has no **See all**            | Expected with one property. Run `bun run seed:search-fixtures`.                       |
