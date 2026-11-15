---
title: 'QA packet 12: cross-cutting audits, redirects, orphan sweep'
status: planned
stage: planned
kind: reference
tags: [qa, audit, cross-cutting, email, cron, pwa, seo, security]
updated: 2026-11-13
---

# 12 Cross-cutting audits

**Rows:** XC-01 to XC-15, RED-01 to RED-06. Each is one record under `docs/workflow/qa/full-app/cross-cutting/`. These cover what no single page owns and everything a user cannot see. Page audits feed them (each page's "hidden surfaces" table); these audits then check each inventory completely, from its own source of truth.

Readiness checklists `production-readiness/checklist/00` to `38` already define criteria for many of these topics. Use the matching checklist as the reference in Stage 1 and tick it with evidence.

## XC-01 Emails

- Inventory: every file in `supabase/functions/_shared/email-templates/**`, every per-property template type, auth emails, and every call site of `emailService`.
- For each: trigger it from the real UI action, then check recipient, From and reply-to, subject, branding, every placeholder resolved, links (correct host, correct route shape, token valid), attachments, plain-text part, rendering at phone width, dark mode.
- Negative: no email on a failed transition, no duplicate on retry, no email to a guest for a host-only event.
- `static_files` entry in `supabase/config.toml` for every email-sending function (production `ENOENT` risk).
- Dead `{{urgentBlock}}` placeholder; unused legacy templates.
- Deliverability (SPF, DKIM, DMARC) is operator-run: `blocked` with the checklist link.

## XC-02 PDFs and documents

- Both template copies (Storage `templates` and `ui/public/templates`) are identical; file a finding for any diff and for the lack of a drift check.
- Each generated document against a booking with long names, special characters, several guests, pets, vehicles.
- Residence-specific forms (multi-residence config) for more than one development.
- Access control on document URLs.

## XC-03 Crons

- Inventory: every `*-cron` function, `jobsRegistry.ts`, and hosted `pg_cron` entries per `docs/archive/operations/scheduled-jobs-and-testing.md`.
- For each: invoke it on L with the cron auth, verify the effect on the page that shows it, run it twice (idempotent), run it with nothing to do, run it with a failing item in the batch (the rest continue), check the time window logic at Manila day boundaries, confirm it reports to `/admin/health`.
- Cron secrets pairing (`audit-cron-secrets.sh`).

## XC-04 Webhooks

- `paymongo-webhook`, `meta-inbox-webhook` (+ healthcheck), `approval-email-webhook`: valid signature, invalid signature, replay, out-of-order events, unknown event type, payload for an unknown tenant, slow processing. Effects traced to the pages (C05, C16, C25, C28).

## XC-05 PWA, offline, push

- On **B**: install, update flow with a dirty form, offline for each shell, route registry vs router (every route present or deliberately excluded), precache size budget, `/app` launch, shortcuts, push subscribe and click-through. Real devices per `pwa-device-qa.md` or `blocked`.

## XC-06 SEO and AI search

- `bun run check:seo-routes`, `scripts/seo/crawl-audit.ts` against L and P. Sitemap vs live routes vs lifecycle states, robots, canonical, structured data validity, meta per template, `noindex` on private routes, `indexnow`, social previews. No test-tenant or dev route indexed.

## XC-07 Accessibility sweep

- Axe on every route in every shell at phone and desktop; keyboard-only run of the spine journeys; screen-reader pass on the guest form and booking detail. Shared component defects are filed once as systemic.

## XC-08 Performance and bundle

- `bun run check:budgets`, chunk graph, Lighthouse median of three on the production build for landing, search, listing, form, dashboard, bookings. Cold dashboard open on P with the test tenant. Request counts and waterfalls per page from `edge-trace`. Slow queries from Supabase advisors. Largest lists with `seed:mock-listings`.

## XC-09 Security, tenancy, RLS, storage

- `check:auth-matrix`, `check:edge-conformance`, `check:authenticated-rate-limit`, Supabase security advisors.
- IDOR sweep: every function that takes an ID or slug, called as `stranger`, `guest` and `anon`.
- Direct PostgREST access with the anon key and a `stranger` JWT to every table (RLS is not the access layer, so list what is exposed).
- Storage: every bucket probed as anon, stranger, member; signed URL lifetimes.
- CORS allowlist, CSP mode, security headers on P, captcha enforcement, secrets scan (`gitleaks`), dependency audit, PII in logs and analytics.
- Use the `security-auditor` agent for this record.

## XC-10 Dates, time zones, money

- Set the machine to UTC, to Manila and to a US zone and re-run the calendar, form, pricing grid, finance ranges and dashboard ranges. Midnight boundaries, month end, year end, 29 February.
- `MM-DD-YYYY` vs `YYYY-MM-DD` conversions at every boundary (`audit-booking-dates.mjs`).
- Currency formatting and rounding consistent across listing, form, booking detail, finance, emails, PDFs.

## XC-11 AI surfaces

- Inventory every AI entry point: dashboard assistant, AI mode, inbox suggest and auto-reply, voice receptionist, marketing generation (caption, image, poster, video), receipt and document validation, smart pricing, analytics review, smart search, knowledge-base answers.
- For each: plan gate, credit metering and exhaustion, limits from the super-admin resolver only, provider outage and fallback, prompt injection through guest-supplied text, cross-tenant data leakage, refusal handling, disclosure to guests, feedback capture, cost ceiling. `check:ai-gateway`, `test:assistant-parity`, the existing `ai-conversations` QA corpus.
- Assistant tool catalog: every tool obeys the same leaf and plan checks as the UI path.

## XC-12 Observability and analytics

- Sentry: force one error per shell and confirm it arrives with route and tenant context and no PII; source maps; noise level. `check:sentry-imports`.
- PostHog: event inventory vs what fires; consent respected; `check:posthog-analytics-only`.
- Edge logs readable and free of tokens and PII.

## XC-13 Data integrity and derived data

- After the spine journeys, run integrity queries: orphan rows, bookings without required children, counters vs counts, `public_listing_search` vs `properties`, finance lines vs payments, overlapping confirmed bookings, activity events for every write, storage objects without rows and rows without objects.
- `bun run seed:verify` and `check:migration-drift`.

## XC-14 Design system consistency

- Inventory shared components (`ui/src/components`, layouts): button variants, inputs, selects, date pickers, tables, cards, modals and sheets (`modal-chrome.md`), toasts, skeletons, empty states, badges, tabs, InfoHint.
- For each, compare its use across ten pages: same pattern, same spacing, same phone behavior. Divergent one-off copies are findings. `check:brand`, `DESIGN.md`.

## Redirects (RED-01 to RED-06)

- One table: source URL, persona, expected target, query preserved, actual. Include deep links with IDs, trailing slashes and unknown sub-paths.
- RED-06: collect every URL shape the product has ever emitted (email templates in git history, PDFs, QR codes, push payloads, sitemap, shared social posts) and confirm each still resolves.

## XC-15 Orphan sweep (Phase 5)

Run after page audits. For each inventory, list items claimed by no record:

| Inventory                                       | Source                                                                                            | Unclaimed means                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Edge functions                                  | `ls supabase/functions` vs union of page records' hidden-surface tables and `edge-callers` output | Dead function, or a surface nobody audited     |
| UI routes                                       | `route-inventory` vs ledger                                                                       | Unlisted page                                  |
| Components and pages                            | `bun run audit:deps` (knip) unused files and exports                                              | Dead UI                                        |
| DB tables, triggers, RPCs                       | Migrations vs tables touched in records                                                           | Unused or unaudited data path                  |
| Storage buckets                                 | Migrations vs records                                                                             | Unaudited access policy                        |
| Email and PDF templates                         | Template dirs vs XC-01, XC-02                                                                     | Dead or untested template                      |
| Plan keys, permission leaves, availability keys | Catalogs vs K10, K11, K12                                                                         | Gate with no surface, or surface never checked |
| Env vars                                        | `docs/PROJECT.md` and `env-audit.mjs` vs code                                                     | Unused or undocumented config                  |
| Guide sections, FAQ entries                     | Docs vs records                                                                                   | Stale documentation                            |
| Specs and tests                                 | Tests whose target no longer exists                                                               | Dead test                                      |

Each unclaimed item becomes a late audit row or a `retire` finding. The sweep is done when every list is empty or every remaining item has a decision.
