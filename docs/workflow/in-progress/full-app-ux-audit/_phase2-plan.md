# Phase 2 audit plan (working notes)

Goal: deep-dive beyond the first pass. Roles, tiers, payments, listings, settings, public pages,
responsive matrix, plus codebase architecture, security, caching, performance and AI cost.

Rules:

- No product code changes. Docs only.
- Do not stop/restart Supabase, Vite, Docker (local lifecycle unlock is `localstop`).
- Local data may be modified for testing; record what changed.

Workstreams:

1. Roles + permissions matrix (subagent)
2. Billing + payments E2E (subagent)
3. Listings lifecycle, org/property/parking/platform (subagent)
4. Settings + configuration + public pages + SEO (subagent)
5. Responsive/design matrix 375-1920 + zoom (subagent)
6. Codebase architecture + implementation quality (me)
7. Security review (me)
8. Caching, performance, AI cost (me)

Outputs: docs 09-17 + README phase-2 index + remediation backlog.
