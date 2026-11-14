---
title: 'Full-app QA audit: environments, personas, production safety'
status: planned
stage: planned
kind: reference
tags: [qa, audit, environments, personas, production]
updated: 2026-11-13
---

# Environments and personas

## Environments

| ID    | Environment                                                                                                        | Use for                                                                                        | Writes allowed                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **L** | Local full stack: `./dev.sh` + canonical seed ([`local-seed-data.md`](../../../guides/testing/local-seed-data.md)) | **Primary.** Every stage of every page audit, all personas, all tiers, all destructive actions | Everything. `bun run db:reset` restores it                                     |
| **B** | Local production build: `bun run build && cd ui && bun run preview` against the local stack                        | PWA, service worker, offline, bundle and chunk behavior, Lighthouse                            | Same as L                                                                      |
| **V** | Vercel preview of the branch                                                                                       | Deployed-build behavior before merge, real CDN, headers, CSP                                   | Depends on which backend it points at. If it points at `fwor…`, treat as **P** |
| **P** | Production: `kamespace.com` + Supabase `fwor…`                                                                     | Deployed build, real latency and caches, real third-party wiring, SEO as crawlers see it       | Only inside the safety contract below                                          |

Hosted "dev" and production share one backend (`fwor…` has been production since 2026-10-27). There is no staging database. Anything pointed at `fwor…` is production.

### What each environment cannot prove

| Cannot prove on L                                     | Do instead                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real email delivery, SPF/DKIM, inbound approval email | Local sends still go through Resend, to an owner-controlled `EMAIL_TO`; check content in the Resend log. Mark deliverability and inbound `blocked` unless the owner runs the manual guide |
| PayMongo checkout and webhook with real signatures    | Sandbox keys if `seed:integrations` reports them; else mocked half + `blocked`                                                                                                            |
| Meta OAuth, webhook, publish                          | Mocked specs + manual guide with the owner present                                                                                                                                        |
| Google OAuth sign-in, Calendar, Sheets, Maps          | `docs/guides/testing/local-google-setup.md`; else `blocked`                                                                                                                               |
| Real-device push, install, standalone chrome          | `pwa-device-qa.md` on a phone                                                                                                                                                             |
| Production data shapes and volume                     | Read-only checks on P; `seed:mock-listings` for volume on L                                                                                                                               |

| Cannot do on P                                  | Reason                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Create a booking on the test tenant             | Test listings can never be `ACTIVE`, so they accept no bookings and have no public page |
| See the test property on public pages or search | Same constraint; that invisibility is the point                                         |
| Exercise guest flows end to end                 | They need a live listing; use L                                                         |

## Production safety contract

The owner has authorized production checks for this audit. That authorization is bounded by the repo's standing rules, which still apply.

**Allowed on P**

- Anonymous, read-only browsing of public pages, including search and listing detail of real hosts (as any visitor could).
- Signing in as the probe owner `ai-perf-probe@kamehomes.space` and using the dashboard **inside `kame-test-tenant` only** (`kame-test-property`, `kame-test-parking`).
- Writes inside the test tenant that are reversible from the UI (settings, pricing rules, templates, maintenance tasks, finance entries, team invites to `@example.com`-style addresses that the owner controls, announcements read state). Each write is listed in the page record under **Production writes** with what was changed and that it was restored.
- Read-only SQL through the Supabase MCP for verification, filtered to the test org.
- Reading logs, advisors, Sentry.

**Not allowed on P, with or without this plan**

- Any deploy, migration, `db push`, `functions deploy` or remote SQL write. Needs `kamewave` in the same message.
- Any write to a real tenant's rows, any use of the probe account outside the test org, any use of a real host's or guest's account.
- Creating a second test org, flagging rows `is_test` by hand, or making a test listing `ACTIVE`.
- Submitting the public booking form, parking form, contact or support forms, reviews, or sign-ups against real listings (they create real records and send real email to real hosts).
- Triggering email, SMS, Telegram, push or Meta messages to anyone other than addresses and chats the owner controls.
- Super-admin actions that affect other tenants (approvals, suspensions, plan changes, feature-availability switches, payouts, announcements). Super-admin pages are **viewed** on P and **exercised** on L.
- Real payments. No live card, no live PayMongo link.
- Load, fuzz or rate-limit testing.
- Storing production PII, tokens or screenshots containing real guest data in the repo or findings.

**Before any P session:** `bun run env:status` and `node scripts/dev/test-tenant.mjs` (read-only audit). **After:** confirm every listed write was restored and say so in the record.

If a case cannot be expressed on the test tenant, write it down as `blocked — needs test-tenant design decision`. Do not work around the guardrail.

## Personas

Each persona is a real point of view, not just a login. The "thinks like" column drives the User hat critique.

| ID            | Persona                                              | Local login (password `seed-password` unless noted)                           | Thinks like                                                                                                      |
| ------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `anon`        | First-time visitor, signed out                       | none                                                                          | Found a link on Facebook, on a phone, slow data. Will leave in 10 seconds if confused                            |
| `crawler`     | Search or AI crawler                                 | none, JS-limited fetch                                                        | Reads only the HTML, meta and links                                                                              |
| `guest-form`  | Guest with a booking link, no account                | token link                                                                    | Wants to finish the form fast, has ID photos on the phone, not technical                                         |
| `guest`       | Signed-in guest                                      | `guest.demo@example.com`                                                      | Repeat guest checking trips, vouchers, messages                                                                  |
| `owner`       | Org owner                                            | `seed-owner@example.com`                                                      | Runs several units, checks the dashboard on the phone between tasks, cares about money and not missing a booking |
| `org-admin`   | Invited org admin, Full Access                       | `manager.demo@example.com`                                                    | Trusted manager; should do almost everything except owner-only actions                                           |
| `operations`  | Property member, Operations template                 | `operations.demo@example.com`                                                 | Caretaker or VA: bookings, maintenance, inbox. Must not see finance                                              |
| `viewer`      | Property member, Read Only                           | `viewer.demo@example.com`                                                     | Accountant or partner: looks, never changes                                                                      |
| `parking`     | Parking member                                       | `parking.demo@example.com`                                                    | Manages slots only; must not see property data                                                                   |
| `custom`      | Member with a custom role (single leaf on, rest off) | to add in Phase 0                                                             | Proves leaf-level enforcement                                                                                    |
| `stranger`    | Valid host of a different org                        | to add in Phase 0 (second seeded org)                                         | Attacker with a real account trying other tenants' URLs                                                          |
| `new-host`    | Just signed up, no org yet                           | to add in Phase 0                                                             | Onboarding and empty states                                                                                      |
| `unverified`  | Owner of an org pending or rejected verification     | to add in Phase 0 or toggle on the second org                                 | Sees gated and rejected states                                                                                   |
| `super-admin` | Platform operator                                    | `bun run seed:attach-admin`                                                   | Needs to act on any tenant safely, with step-up                                                                  |
| `prod-probe`  | Production test-tenant owner                         | `ai-perf-probe@kamehomes.space`, password in `supabase/.env.management.local` | Only for P                                                                                                       |

Phase 0 task: extend `scripts/dev/seed/` with the four missing personas (`custom`, `stranger` + second org, `new-host`, `unverified`) so every audit session can use them without ad hoc SQL. Keep `check:seed-identity` green.

### Tiers and entity states

- Switch plan: `bun run seed:plan -- --plan=free|starter|growth|pro` (local only). Always restore to the seed default and note it.
- Feature availability: `bun run seed:feature-flags apply|remove`.
- Property lifecycle states (live, paused, suspended, archived, pending verification), booking statuses, contract expiry, and verification tiers: set through the UI as super-admin where possible so the transition itself is audited; SQL only when no UI path exists, and record that as a finding candidate ("state unreachable from UI").

### Two-actor sessions

Many chains need two people at once (guest submits, host sees it; host replies, guest sees it; super-admin flips a switch, host page changes). Use two browser contexts side by side, as the existing side-by-side parking and host-verification specs do. A chain that is only ever checked from one side is `blocked`, not `pass`.

## Viewports and browsers

| Viewport     | Size       | Required for                         |
| ------------ | ---------- | ------------------------------------ |
| Phone        | 375 × 812  | Every page, audited first            |
| Tablet       | 768 × 1024 | Every page                           |
| Small laptop | 1024 × 768 | Dashboard pages (sidebar breakpoint) |
| Desktop      | 1440 × 900 | Every page                           |

Chromium for all rows. WebKit for every guest and public page and for the dashboard shell (iPhone Safari is the main guest browser). Firefox for the journey spine only. Record browser gaps as `blocked — not run on <browser>`, not as pass.

## Test data rules

- Use obviously fake names, `@example.com` emails, and the placeholder media in `docs/guides/testing/fixtures/media/`.
- Never paste a real ID, selfie, card or phone number.
- Reset between destructive audits: `bun run db:reset` (full) or `bun run seed:refresh`.
- If a page needs data the seed lacks, add it to the seed files in the same change rather than leaving one-off rows; the next auditor needs it too.
