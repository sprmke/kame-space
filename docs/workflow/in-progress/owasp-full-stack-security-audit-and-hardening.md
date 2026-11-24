---
stage: in-progress
title: 'OWASP full-stack security audit, third-party review, and hardening plan'
status: in-progress
tags: [planning, security, owasp, asvs, api-security, llm-security, third-party, audit]
updated: 2026-11-24
kind: plan
---

# OWASP full-stack security audit, third-party review, and hardening plan

Goal: achieve and verify full-stack security compliance across **Kame Space (Guest Form Management)** — covering the Vite + React 19 SPA, all 378 Supabase Edge Functions, Postgres schema/RLS/SECURITY DEFINER functions, Supabase Storage buckets, npm/Deno supply chain, and every third-party service integration — mapped against **OWASP Top 10:2025**, **OWASP API Security Top 10 (2023)**, **OWASP Top 10 for LLM Applications (2025)**, and **OWASP ASVS 5.0 Level 2**, using non-destructive verification and zero-data-mutation testing.

Related readiness baselines:

- Production readiness security matrices: [`../in-progress/production-readiness/security/README.md`](../in-progress/production-readiness/security/README.md)
- Production readiness ledger (Gate B Security, Gate C Money, Gate D AI): [`../in-progress/production-readiness/LEDGER.md`](../in-progress/production-readiness/LEDGER.md)
- Production readiness refinement queue: [`./production-readiness-refinement.md`](./production-readiness-refinement.md)

---

## 1. AI agent security skills — research and installation catalog

### 1.1 Currently installed in this repo and machine

| Skill / Agent            | Source                            | Location                                                                      | Role in Kame Space                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `security-audit`         | `cloudflare/security-audit-skill` | `.agents/skills/security-audit/` (`skills-lock.json`)                         | 6-phase source-first vulnerability audit with 10 domain companions (`ATTACK-CLASSES.md`, `WEB-PROTOCOL-AND-AUTH.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`, `CLIENT-SIDE.md`, `AI-AND-LLM.md`, `CLOUD-AND-DEPLOYMENT.md`, `PROTOCOLS-RPC-AND-MESSAGING.md`, `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`, `SUPPLY-CHAIN-AND-RELEASE.md`, `MEMORY-SAFETY-AND-BINARY.md`) |
| `security-and-hardening` | `addyosmani/agent-skills`         | `~/.agents/skill-library/security-and-hardening/`                             | Threat modeling (STRIDE), three-tier boundary rules, SSRF, file uploads, rate limiting, RA 10173 / GDPR privacy lifecycle, LLM output handling                                                                                                                                                                                                                   |
| `security-auditor`       | Repo specialist agent             | `.cursor/agents/security-auditor.md` / `.opencode/agents/security-auditor.md` | Read-only reviewer tailored to GFM surfaces (admin JWT, multi-tenant scope, guest PII, Storage buckets, Resend inbound Svix approvals)                                                                                                                                                                                                                           |
| `review-security`        | Cursor / OpenCode review skill    | Built-in / global catalog                                                     | Diff-scoped security review before PR merge                                                                                                                                                                                                                                                                                                                      |

### 1.2 Recommended open-source security skill packs to add (`skills.sh` / GitHub)

Research across the `vercel-labs/skills` (`skills.sh`) ecosystem identified three high-signal, OWASP-grounded skill repositories that complement `cloudflare/security-audit-skill`:

1. **`briiirussell/cybersecurity-skills`** (MIT, `npx skills` native, NVIDIA SkillSpector scanned):
   - `owasp-audit` — Source-code audit against OWASP Top 10:2025 with category grep patterns, per-finding refutation pass (`confirmed` / `needs_validation` / `rejected`), and `findings.json` validator.
   - `api-audit` — OWASP API Security Top 10 (2023) audit for REST/RPC endpoints: BOLA, BOPLA/mass-assignment, BFLA, rate limits, webhook signature verification, and paired owner-vs-non-owner evidence.
   - `business-logic-testing` — Invariant-first testing (conservation of value, uniqueness, monotonicity, exclusivity), Actor × Action × Resource matrix, state-machine abuse, and check-then-act race conditions.
   - `dependency-audit` & `secrets-audit` — Reachability-based CVE triage, lockfile integrity, key-type classification (publishable vs secret), and frontend bundle secret checks.
   - `prompt-injection` — Direct/indirect prompt injection, invisible Unicode/concealment, tool-argument authorization, and MCP trust boundaries.
   - `cloud-audit` & `cicd-security` — Vercel/Supabase PaaS deployment drift, preview exposure, GitHub Actions SHA pinning, token permissions, and expression-injection guards.
   - `privacy-engineering` — Technical DSAR (export/delete/portability), data minimization, retention crons, and vendor fan-out (aligns with Philippine Data Privacy Act RA 10173).
   - `scanner-pipeline` & `finding-triage` — Normalizes Gitleaks, Semgrep, OSV, Supabase Advisors, and OWASP ZAP outputs into dispositioned tickets.
2. **`OWASP/secure-agent-playbook`** (Official OWASP Foundation project, CC-BY-4.0):
   - `code-review-security`, `api-security-review`, `web-security-review`, `sca-audit`, `secrets-scan`, `security-guidance` (ASVS 5.0), `llm-risk-assess`, `agentic-ai-risk-assess` (OWASP Top 10 for Agentic Applications 2026), `ai-security-verification` (OWASP AISVS), `prompt-injection-test` (Arcanum PI Taxonomy).
   - Cross-references every finding to CWE, ASVS 5.0, WSTG, and NIST 800-53 via OpenCRE.
3. **`vercel-labs/agent-skills`** (`vercel-optimize`, `web-design-guidelines`, `react-best-practices`):
   - Already partially in `skills-lock.json`; `vercel-optimize` is installed in `~/.agents/skill-library/vercel-optimize` and audits Vercel edge headers, rewrites, caching, and function invocation abuse.

### 1.3 Skill installation rules (token budget & supply-chain safety)

- **Supply-chain check first**: Before installing any third-party skill, inspect its `SKILL.md` and scripts for prompt injection, hidden Unicode, or unauthorized shell/network calls (`agent-supply-chain-audit` discipline).
- **Keep visible skill token budget ≤ 1,200 tokens**: Install new skills into `.agents/skills/` (project-locked via `skills-lock.json` and `scripts/dev/setup-agents-skills.sh`) or `~/.agents/skill-library/` with `visible: false` in `~/.agents/skill-catalog/manifest.json`, indexed in `agent-skills-index` so they cost 0 idle tokens and load on demand.
- **Verify with**: `bun run check:agent-stack` and `bun run check:ai-tooling-sync`.

---

## 2. Executive findings from initial static codebase audit (2026-11-24)

During the read-only reconnaissance pass for this plan, we ran all static security analyzers (`audit-auth-matrix.mjs`, `audit-edge-functions.mjs`, `check-tracked-secrets.sh`, `check-storage-upload-sniff.sh`, `check-migration-security.sh`, `check-vercel-headers.sh`, `check-serve-public-rate-limit.sh`, `check-authenticated-rate-limit.sh`, `check-ai-gateway.mjs`, `bun audit`) and manually traced public, webhook, and outbound-fetch code paths.

We identified **6 actionable code/dependency findings** (`S-1` through `S-6`). All six are **fixed in this branch**; each entry keeps the original analysis and records the fix that shipped.

### Finding S-1 (HIGH, fixed) — `get-pay-parking` missing guest capability-token check & excessive PII exposure (OWASP A01:2025 / API1 BOLA & API3 BOPLA)

- **Location**: `supabase/functions/get-pay-parking/index.ts:50-180` and `ui/src/features/guest/pay-parking/pages/PayParkingPage.tsx:26-110`.
- **Mechanic**:
  - Every other guest booking read/write endpoint (`get-form`, `get-sd-form`, `submit-sd-form`, `get-guest-review`, `submit-guest-review`, `claim-sd-voucher`, `get-guest-trip`, `guest-trip-payment-receipt`, `guest-cancellation-request`, `guest-cancel-booking`, `submit-guest-refund-details`) enforces `authorizeGuestBookingAccess` or `authorizeGuestTripAccess` (`?access=<hmac_token>` when `GUEST_BOOKING_ACCESS_ENFORCE=true`).
  - `get-pay-parking` was missed when PR-008 shipped: it accepts a bare `?bookingId=<uuid>` with no `authorizeGuestBookingAccess` check and returns `primary_guest_name`, `guest_facebook_name`, `check_in_date`, `check_out_date`, `number_of_adults`, `number_of_children`, `car_plate_number`, `car_brand_model`, and `car_color`.
  - Meanwhile, `PayParkingPage.tsx` was refactored into a redirect-only page that only uses 5 routing fields (`linked_parking_booking_id`, `owner_default_parking_slug`, `owner_default_check_in`, `owner_default_check_out`, `city_location_slug`).
- **Impact**: Anyone who learns or guesses a booking UUID (from a leaked URL, email logs, or referrer) can query `get-pay-parking?bookingId=<uuid>` without an `access` token and retrieve the guest's full name, Facebook name, stay dates, and vehicle plate/model/color.
- **Remediation**:
  1. Strip all unused guest PII (`primary_guest_name`, `guest_facebook_name`, `car_plate_number`, `car_brand_model`, `car_color`, guest counts) from `get-pay-parking` response — or gate PII behind `authorizeGuestBookingAccess` when `?access=` is supplied, returning only the non-PII redirect target fields (`property_slug`, `linked_parking_booking_id`, `city_location_slug`, `owner_default_parking_slug`, `owner_default_check_in`, `owner_default_check_out`) when unauthenticated.
  2. Add a Deno handler regression test in `supabase/functions/tests/handlers/get-pay-parking.test.ts` and extend `scripts/dev/probe-readiness-guest-token-dev.mjs` to assert `get-pay-parking` never leaks guest PII without a valid token.
- **Shipped fix**: `get-pay-parking` now answers a bare booking id with the redirect fields only. Guest detail fields (name, stay dates, pax, rate, vehicle plate/model/color, status) are returned only when the caller presents a booking-scoped `?access=` HMAC token or is the signed-in owner (account id or booking email match). Read-only: the endpoint never links or writes. `PayParkingBootstrap` marks the detail fields optional. New `supabase/functions/tests/handlers/get-pay-parking-privacy.test.ts` pins bare-id, forged-token, cross-booking-token and valid-token behaviour.

### Finding S-2 (HIGH, fixed) — Second-order SSRF on outbound image fetches in `emailService.ts` and `marketingPosterDirector.ts`, plus `safeOutboundUrl.ts` DNS fail-open (OWASP A10:2025 / API7 SSRF)

- **Location**:
  - `supabase/functions/_shared/emailService.ts:178-196` (`fetchPaymentQrBytes`)
  - `supabase/functions/_shared/marketingPosterDirector.ts:480-503` (`loadPosterPhotos`)
  - `supabase/functions/_shared/safeOutboundUrl.ts:20-43,86-117`
  - `supabase/functions/_shared/emailInlineRemoteImages.ts:154-230`
- **Mechanic**:
  1. `emailService.ts#fetchPaymentQrBytes(url)` fetches `method.qrImageUrl` from property payment settings using bare `await fetch(url)` with no `fetchFirstPartyOrPublic` check, no timeout, no max-byte limit, and default `redirect: 'follow'`, then attaches the downloaded bytes as an inline attachment on `READY_FOR_CHECKIN` emails.
  2. `marketingPosterDirector.ts#loadPosterPhotos` checks `allowed.has(url) && /^https:\/\//i.test(url)` against `property.settings.media` / `images`, then calls `fetch(url, { redirect: 'follow' })` instead of `fetchFirstPartyOrPublic` (which disables automatic redirects and re-validates every hop against private IPs).
  3. `safeOutboundUrl.ts#assertHostNotPrivate` catches and ignores DNS lookup failures (`Deno.resolveDns`) instead of failing closed, and `PRIVATE_IPV4` omits `224.0.0.0/4` (multicast) and `240.0.0.0/4` (reserved), whereas `emailInlineRemoteImages.ts` implements its own duplicate private-IP + DNS-fail-closed check.
- **Impact**: A malicious or compromised host could set a payment QR URL or gallery image URL that resolves or 302-redirects to an internal/private endpoint or slowloris stream, causing edge function memory/timeout exhaustion or exfiltrating response bytes via email inline attachments.
- **Remediation**:
  1. Harden `safeOutboundUrl.ts`: block IPv4 `>= 224.0.0.0`, fail closed when `Deno.resolveDns` returns zero records or errors for non-literal hostnames, and add a `maxBytes` streaming reader option.
  2. Route `emailService.ts#fetchPaymentQrBytes`, `marketingPosterDirector.ts#loadPosterPhotos`, and `emailInlineRemoteImages.ts#downloadViaFetch` through `fetchFirstPartyOrPublic` (`safeOutboundUrl.ts`) with a 5 MB byte cap and 10s timeout.
  3. Add a CI static guard `scripts/dev/check-outbound-fetch-ssrf.sh` that flags any new raw `fetch(variable)` in `supabase/functions/` outside the allowlisted provider SDK transports.
- **Shipped fix**:
  - `safeOutboundUrl.ts` parses IPv4 numerically, now rejects multicast (`224.0.0.0/4`), reserved (`240.0.0.0/4`) and broadcast, adds IPv6 multicast (`ff00::/8`), and exposes a `dnsPolicy: 'fail-closed'` mode plus `readResponseBytesBounded()` for a hard body ceiling.
  - `emailService.ts#fetchPaymentQrBytes` now goes through `fetchFirstPartyOrPublic` (10s timeout, 3 hops, per-hop private-IP revalidation), rejects `text/html`/`application/xhtml+xml` bodies, and caps the download at 5 MB.
  - `marketingPosterDirector.ts#loadPosterPhotos` no longer uses `redirect: 'follow'`; it revalidates every hop and keeps its 2 MB per-photo cap.
  - `emailInlineRemoteImages.ts` already failed closed on DNS and blocked private literals; left as-is (equivalent guarantee, and it also rejects opaque redirects).
  - New `scripts/dev/check-outbound-fetch-ssrf.sh` runs from `audit-edge-functions.mjs --check` (which CI already runs) and from `ci-quality-gate.sh`; `safeOutboundUrl_test.ts` covers multicast/reserved literals, fail-closed DNS, best-effort DNS and the bounded reader.

### Finding S-3 (MEDIUM, fixed) — Non-constant-time secret comparisons & missing bad-secret rate limit on `push-fanout` and `meta-inbox-webhook` GET (OWASP A04:2025 & A07:2025)

- **Location**:
  - `supabase/functions/push-fanout/index.ts:40-44`
  - `supabase/functions/meta-inbox-webhook/index.ts:28-39`
  - `supabase/functions/ical-export/index.ts:85-90`
- **Mechanic**:
  - `push-fanout` compares `x-push-fanout-secret` using `provided !== expected` (non-constant-time) and has no `rateLimitGate` on failed secret attempts (it is allowlisted in `check-serve-public-rate-limit.sh`).
  - `meta-inbox-webhook` GET compares `hub.verify_token` with `===` and has no rate limit on 403 failures.
  - `ical-export` `safeEqual(a, b)` returns early on `a.length !== b.length`, leaking token length.
- **Remediation**:
  1. Create a shared `constantTimeEqual(a: string, b: string): Promise<boolean>` in `supabase/functions/_shared/cryptoCompare.ts` that hashes both strings with SHA-256 via WebCrypto (fixed 32-byte length, no length leak) and XOR-compares all 32 bytes.
  2. Use `constantTimeEqual` in `push-fanout`, `meta-inbox-webhook`, `ical-export`, and all cron secret verifiers (`_shared/cronAuth.ts`).
  3. Add a bad-secret `rateLimitGate` (`limit: 30, windowSec: 60`) inside the 401/403 branches of `push-fanout`, `meta-inbox-webhook` GET, and `ops-alert-ingest` (matching `paymongo-webhook` and `approval-email-webhook`).
- **Shipped fix**:
  - New `_shared/cryptoCompare.ts` with `constantTimeEqual` (SHA-256 digests, always 32 bytes) and `constantTimeEqualSync` (length folded into the accumulator, no early return).
  - `push-fanout`, `meta-inbox-webhook` GET, `ical-export` and `ops-alert-ingest` use the async helper; `_shared/cronSecretGate.ts` (all 34 cron functions) uses the sync helper. Never-verify when `META_WEBHOOK_VERIFY_TOKEN` is unset is preserved.
  - Each bad-secret branch now passes through `rateLimitGate` (30 per minute per IP) before the 401/403.

### Finding S-4 (MEDIUM, reduced: 60 → 16) — Dependency vulnerabilities (`bun audit`) & dual-lockfile drift (OWASP A03:2025 Software Supply Chain Failures)

- **Location**: `package.json`, `ui/package.json`, `bun.lock`, `package-lock.json`, `.agents/skills/mcp-builder/requirements.txt`.
- **Mechanic**:
  - **Runtime / UI bundle dependencies**:
    - `zod` (`^3.22.4` → `<4.6.6`, GHSA-mrhx-c7xc-m3w5 High: memory exhaustion while validating oversized constrained collections).
    - `openpolotno` transitive `quill <=1.3.7` (GHSA-4943-9vgg-gr5r Moderate XSS) and `qs <=6.16.0` (GHSA-6pq8-jhm2-2vcw Moderate DoS).
  - **Build / CLI devDependencies**:
    - `vercel` CLI transitive `tar <=7.5.15` (1 Critical, 2 High, 3 Moderate), `undici <5.28.5` (5 High, 9 Moderate), `@fastify/busboy <3.2.1` (1 High, 1 Moderate), `path-to-regexp <6.3.0` (2 High, 1 Moderate).
    - `minimatch <9.0.6` (High ReDoS), `brace-expansion <5.0.11` (High stack exhaustion), `js-yaml <=4.1.1` (High quadratic CPU), `ajv <8.18.0`, `fast-uri <3.1.9`, `serialize-javascript <7.1.3`, `glob <=14.0.1`, `postcss-selector-parser <6.1.5`.
  - **Vendored skill file**: `.agents/skills/mcp-builder/requirements.txt` pins `python-multipart==0.0.9` (PR-144).
  - **Lockfiles**: Both `bun.lock` and `package-lock.json` are tracked (PR-142).
- **Remediation**:
  1. Add safe `overrides` in root `package.json` for patched semver-compatible transitive packages (`qs: "^6.16.1"`, `serialize-javascript: "^7.1.3"`, `fast-uri: "^3.1.9"`, `minimatch: "^9.0.6"`, `brace-expansion: "^5.0.11"`, `js-yaml: "^4.1.2"`, `postcss-selector-parser: "^6.1.5"`, `tar: "^7.5.16"`), verify `bun install` + `bun run ci:quality`.
  2. Plan and test the `zod` upgrade / input collection-size cap at edge boundaries so oversized arrays are rejected before Zod parsing.
  3. Audit whether `openpolotno`'s transitive `quill` is ever mounted in the DOM (Canvas Studio uses Konva/Fabric/TipTap); if unused at runtime, document non-reachability or isolate via override.
  4. Bump `.agents/skills/mcp-builder/requirements.txt` to a patched `python-multipart` and retire or auto-sync `package-lock.json` (PR-142, PR-144).
- **Shipped fix**:
  - Root `package.json` overrides now pin `qs 6.16.1`, `js-yaml 4.3.2`, `postcss-selector-parser 6.1.5`, `tar 7.5.23`, `undici 5.29.0`, `path-to-regexp 6.3.0`, `@fastify/busboy 3.2.6`, `fast-uri ^3.1.9`, `serialize-javascript ^7.1.4`.
  - The unused `vercel` CLI devDependency was removed (nothing imports it; env scripts already tell the operator to run `npx vercel@latest`). That deletion alone removed the `tar`/`undici`/`@fastify/busboy`/`path-to-regexp`/Vercel-`glob` trees from the audited graph.
  - Result: `bun audit` 60 advisories → **16**, with **0 critical**.
  - Remaining 16 are documented as accepted for this pass: `minimatch`/`brace-expansion`/`glob` ReDoS sit in dev lint/build tooling (no request path), `quill <=1.3.7` is a transitive of `openpolotno` that nothing in `ui/src` imports and the CSP blocks inline script, and `zod <4.6.6` needs the dedicated Zod 4 migration (PR-141) — mitigated now by the new 2 MB JSON body cap and bounded collections.
  - `.agents/skills/mcp-builder/scripts/requirements.txt` already pins `python-multipart>=0.0.31` (PR-144 closed).

### Finding S-5 (MEDIUM, fixed) — Auth-matrix heuristic rows needed explicit classification & the CI gate was too loose (OWASP A01:2025 / API4 Unrestricted Resource Consumption)

- **Location**: `supabase/functions/_shared/serveEdge.ts:35-88` and `scripts/dev/audit-auth-matrix.mjs`.
- **Mechanic**:
  - `serveAdmin` and `serveAuthenticated` run `enforceOrLogRateCheck`, which defaults to `authenticatedRateLimitEnforce = false` (in-memory log-only) unless toggled in `platform_settings`.
  - `node scripts/dev/audit-auth-matrix.mjs --gaps-only` outputs 30 functions with `MISSING-resource-scope-check` (23 `serveSuperAdmin` functions where platform-wide access is intended by `verifySuperAdminJwt`, plus 7 `servePublic`/`serveHandler` functions). Because `audit-auth-matrix.mjs --check` only fails on `MISSING-any-authz-beyond-identity`, a new `serveAuthenticated` function that calls a permission leaf check (`hasPermission`) on the wrong tenant without a resource-scope check (`verifyPropertyAccess` / `verifyOrgAccess`) would only appear in `--gaps-only`, not fail `--check`.
- **Remediation**:
  1. Classify the 23 `serveSuperAdmin` functions and the verified public/token functions in `audit-auth-matrix.mjs` (`SUPER_ADMIN_PLATFORM_SCOPE` + `PUBLIC_CAPABILITY_SCOPE`), and tighten `audit-auth-matrix.mjs --check` so **any** new `MISSING-resource-scope-check` on `serveAuthenticated` or `serveAdmin` fails CI!
  2. Enable `authenticated_rate_limit_enforce = true` (at 300 req/min per user) in production `platform_settings` after a 7-day log check, and add cost-weighted rate limits on AI/email/payment/export endpoints (PR-021).
- **Shipped fix**:
  - `audit-auth-matrix.mjs` treats `serveSuperAdmin` as platform-scoped by design (the wrapper's `SUPER_ADMIN_EMAILS` check is the boundary) and has a documented `PUBLIC_SELF_GUARDED_ALLOWLIST` for the seven capability/OAuth/public-listing handlers, each with the guard that replaces a tenant scope.
  - `--check` now fails on **any** `MISSING-resource-scope-check`. Today: 378 functions, 0 gaps.
  - The log-only authenticated rate limit is unchanged in code (it is a runtime super-admin switch). Enabling it in production `platform_settings` remains an operator action and is listed in §6.

### Finding S-6 (MEDIUM, fixed) — Unbounded JSON request bodies and raw-body write sinks (OWASP A05:2025 / API3 BOPLA)

- **Location**: `supabase/functions/_shared/httpResponse.ts#readJsonBody` and write handlers flagged by `node scripts/dev/audit-edge-functions.mjs --gaps-only`.
- **Mechanic**:
  - `readJsonBody(req)` parses `await req.json()` with no byte-size cap on the request body and returns an untyped `Record<string, unknown>`.
  - While critical settings and workflow handlers validate fields explicitly, several smaller write handlers cherry-pick fields without `.strict()` Zod schemas or max body-byte checks (PR-018).
- **Remediation**:
  1. Add a default max payload size guard (e.g., 256 KB default, configurable per endpoint for large imports/canvas saves) inside `readJsonBody(req)`.
  2. Enforce strict Zod schemas (`z.object(...).strict()`) or explicit unknown-key rejection on all tenant-mutating JSON handlers (PR-018), with a handler contract test in `supabase/functions/tests/harness/authenticatedPostContract.ts`.
- **Shipped fix**:
  - `readJsonBody(req, { maxBytes })` now streams the body and throws `EdgeError(413, 'Request body too large', 'payload_too_large')` at a **2 MB default** before parsing; `marketing-templates` opts into 12 MB for legacy base64 design thumbnails. Covered by four new cases in `httpResponse_test.ts`.
  - BOPLA: a code sweep found no handler that spreads a raw request body into a table write (the one `.update(payload)` is a server-built object). `audit-edge-functions.mjs --check` now **fails on `.insert(body)` / `.update(body)` / `.upsert(body)`** so that sink cannot be introduced later. Handlers continue to cherry-pick validated fields; strict per-handler Zod schemas across 209 write handlers remain a tracked follow-up (PR-018) rather than a risky big-bang change.

---

## 3. Comprehensive third-party services, libraries & infrastructure audit matrix

Every external service, SDK, and infrastructure boundary used by Kame Space must be audited and hardened across 6 dimensions: **Authentication/Secrets**, **Transport/Webhook Integrity**, **SSRF/Egress Control**, **Data Privacy/PII Scope**, **Abuse/Spend Caps**, and **Failure/Degradation Mode**.

| Service / Library                                                                                                              | Where used in repo                                                                                                                                                        | Current controls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Remaining gaps & audit tasks                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Supabase Platform** (Postgres 17, Auth, Storage, Edge Functions, Realtime, `pg_cron`/`pg_net`)                            | `supabase/migrations/`, `supabase/functions/`, `ui/src/lib/supabase.ts`                                                                                                   | • Edge functions enforce `verifyAdminJwt`, `verifyAuthenticatedUser`, `verifySuperAdminJwt`, `verifyOrgAccess`, `verifyPropertyAccess`, `resolveScopedParkingAccess`<br>• Migration `20261342000600` locked down `SECURITY DEFINER` RPCs from `anon`/`authenticated` (`PR-096`, `probe-function-privileges-local.sh`)<br>• Storage magic-byte sniffing enforced on every byte-writer (`check-storage-upload-sniff.sh`, `PR-016`)<br>• Post-sign-out Realtime & TanStack Query cache wipe (`PR-015`) | • **T3.1**: Run read-only RLS & privilege probe on hosted DB (`PR-010`, `PR-011` Supabase security advisors)<br>• **T3.2**: Verify `guest-chat-attachments` bucket privacy & signed-URL TTL policy (`PR-017`, `PR-120`)<br>• **T3.3**: Verify Vault `*_CRON_SECRET` parity with all 34 Edge cron functions (`PR-022`) |
| **2. Vercel Hosting & CDN**                                                                                                    | `ui/vercel.json`, `scripts/dev/check-vercel-headers.sh`                                                                                                                   | • Enforcing `Content-Security-Policy` live (`PR-012`, `test:e2e:csp`)<br>• `Strict-Transport-Security` (2 yr + preload), `X-Frame-Options: SAMEORIGIN` (`PR-143`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`<br>• `/assets/*` excluded from SPA fallback                                                                                                                                                                                                           | • **T3.4**: Verify Vercel Production branch assignment (`main`) and confirm `verify:deployed-preview` header assertions against `https://kamespace.com` (`PR-149`)<br>• **T3.5**: Audit `/ingest/*` PostHog rewrite in `ui/vercel.json` for cache/method headers                                                      |
| **3. PayMongo** (Org subscriptions, guest parking payments, AI credit top-ups)                                                 | `_shared/paymongoWebhookVerify.ts`, `_shared/paymongoEventDedupe.ts`, `_shared/subscriptionOrchestrator.ts`, `_shared/parkingPaymentOrchestrator.ts`, `paymongo-webhook/` | • HMAC-SHA256 signature verification (`Paymongo-Signature`) + timestamp replay window + livemode check<br>• Atomic event claim lease (`processed_paymongo_events`, `PR-019`)<br>• Server-computed payment amounts (`computeParkingPaymentAmounts`, `pricing_plans`); client amounts never trusted (`PR-104`)<br>• Bad-signature IP rate limit (`30/60s`)                                                                                                                                            | • **T3.6**: Execute read-only/sandbox webhook replay & double-delivery idempotency test (`PR-036`)<br>• **T3.7**: Confirm live-mode key cutover checklist (`PR-097`) and parking refund/override authorization gate (`PR-031`)                                                                                        |
| **4. Resend** (Transactional outbound emails + Inbound Svix approval webhook)                                                  | `_shared/sendResendEmail.ts`, `_shared/emailService.ts`, `approval-email-webhook/`                                                                                        | • Svix HMAC signature + timestamp verification (`RESEND_INBOUND_WEBHOOK_SECRET`)<br>• `processed_emails` message-id idempotency<br>• Sender domain allowlist + strict attachment filename/magic-byte check (`APPROVED GAF.pdf` / pet PDF)<br>• HTML escaping (`escapeHtml`) across template variables                                                                                                                                                                                               | • **T3.8**: Fix `fetchPaymentQrBytes` SSRF (`Finding S-2`)<br>• **T3.9**: Verify SPF, DKIM, DMARC (`p=quarantine`/`reject`), and bounce/complaint suppression handling (`PR-073`)                                                                                                                                     |
| **5. Meta Graph API** (Messenger & Instagram Inbox OAuth, webhooks, Marketing publishing)                                      | `meta-inbox-oauth-callback/`, `meta-inbox-webhook/`, `_shared/metaInboxGraph.ts`, `_shared/metaInboxConnect.ts`, `_shared/metaPublishing.ts`                              | • `X-Hub-Signature-256` HMAC-SHA256 verification on POST<br>• Durable outbox dedupe (`meta_webhook_enqueue` unique on `event_key`)<br>• Single-use `meta_inbox_oauth_state` with expiry + `isMetaReturnOriginAllowed` open-redirect protection<br>• AES-GCM encryption of Meta page/user tokens at rest                                                                                                                                                                                             | • **T3.10**: Replace `===` on `GET ?hub.verify_token=` with constant-time compare + rate limit (`Finding S-3`)<br>• **T3.11**: Verify token revocation cleanup when a host disconnects a Meta page or deletes a property/org                                                                                          |
| **6. Telegram Bot API** (Admin, Staff, Parking, Marketing, Ops Alerts)                                                         | `_shared/telegramApi.ts`, `_shared/propertyTelegramCredentials.ts`, `_shared/ops/opsAlert.ts`                                                                             | • Bot tokens encrypted at rest via `GMAIL_OAUTH_TOKEN_ENCRYPTION_KEY`<br>• Super-admin delivery kill-switch                                                                                                                                                                                                                                                                                                                                                                                         | • **T3.12**: Audit all `fetch('https://api.telegram.org/bot${token}/...')` error handlers to guarantee a network error never echoes the full request URL (which contains `bot<token>`) into Sentry issue titles or logs (`production-error-escalation` Phase 0)                                                       |
| **7. Google Cloud & Maps & OAuth** (Supabase Google OAuth, `@googlemaps/js-api-loader`, Static Maps)                           | `ui/src/lib/googleMaps.ts`, `_shared/auth.ts`, `ui/vercel.json`                                                                                                           | • Google OAuth tokens verified server-side via `supabase.auth.getUser(jwt)`<br>• Maps origins pinned in CSP                                                                                                                                                                                                                                                                                                                                                                                         | • **T3.13**: Verify HTTP referrer restriction on browser `VITE_GOOGLE_MAPS_API_KEY` (`kamespace.com/*`, `*.vercel.app/*`, `localhost:*`) and GCP daily quota cap (`PR-084`)                                                                                                                                           |
| **8. Google Gemini & Groq AI** (Dashboard Assistant, Guest Receptionist, Voice, OCR, Marketing AI)                             | `supabase/functions/_shared/ai/`, `check-ai-gateway.mjs`, `_shared/bookingAiReviewService.ts`                                                                             | • All LLM calls routed through `_shared/ai/` gateway (`check-ai-gateway.mjs`)<br>• Platform USD spend ceiling checked before per-org quota (`PR-006`)<br>• 14-case prompt-injection fence & output guard (`PR-013`)<br>• Tier-1 vs Tier-2 action confirmation cards + RBAC leaf verification on every tool call                                                                                                                                                                                     | • **T3.14**: Verify indirect prompt-injection resistance when AI parses untrusted guest OCR receipts, inbound Meta messages, or iCal summaries<br>• **T3.15**: Verify voice receptionist token minting quota gate and session ownership (`loadVoiceReceptionistSessionForGuest`)                                      |
| **9. Cloudflare Turnstile** (Anti-spam & bot defense)                                                                          | `_shared/captcha.ts`, `_shared/antiSpam.ts`, `ui/src/components/security/`                                                                                                | • `antiSpamGate` combines honeypot, minimum-fill timing, Turnstile `siteverify`, and durable IP rate limiting<br>• `CAPTCHA_MODE=enforce` verified on production (`PR-001`, `PR-002`)                                                                                                                                                                                                                                                                                                               | • **T3.16**: Audit every public POST/multipart endpoint to confirm no guest-write path bypasses `antiSpamGate` or `rateLimitGate`                                                                                                                                                                                     |
| **10. Sentry & PostHog** (Error monitoring & product analytics)                                                                | `_shared/sentry.ts`, `_shared/posthog.ts`, `_shared/posthogSanitize.ts`, `ops-alert-ingest/`                                                                              | • `handleEdgeError` strips all URL query values (`?access=`, `?token=`) before logging or sending to Sentry<br>• `posthogSanitize.ts` drops secret/token keys<br>• `ops-alert-ingest` verifies `X-Ops-Signature` HMAC                                                                                                                                                                                                                                                                               | • **T3.17**: Add a unit test verifying Telegram bot URLs (`https://api.telegram.org/bot<secret>/...`) are scrubbed in `_shared/sentry.ts` before envelope transmission                                                                                                                                                |
| **11. OTA iCal Feeds** (Airbnb, Agoda, Booking.com import/export)                                                              | `_shared/calendarSyncService.ts`, `ical-export/`                                                                                                                          | • Inbound `fetchExternalIcs` enforces `https:`, provider domain suffix allowlist on every redirect hop, private-IP rejection, 10s timeout, 2 MB cap<br>• Outbound `ical-export` serves opaque `Booked`/`Blocked` ranges with zero guest PII                                                                                                                                                                                                                                                         | • **T3.18**: Upgrade `ical-export` `safeEqual` to SHA-256 constant-time comparison (`Finding S-3`) and verify iCal parser bounds against malformed/deeply nested `VEVENT` bombs                                                                                                                                       |
| **12. Client Libraries & PWA / Service Worker** (`dompurify`, `pdfjs-dist`, `mediapipe`, `workbox`, `openpolotno`, `remotion`) | `ui/src/lib/sanitizeHtml.ts`, `ui/src/pwa/sw.ts`, `ui/vercel.json`                                                                                                        | • All 6 `dangerouslySetInnerHTML` sites pass through `DOMPurify` (`sanitizeRichTextHtml` / `sanitizeEmailSnapshotHtml`)<br>• MediaPipe pinned to `@0.10.35` in CSP (`PR-012`)<br>• Service worker clears caches on sign-out (`PR-015`)                                                                                                                                                                                                                                                              | • **T3.19**: Remediate `bun audit` advisories (`Finding S-4`) and verify SW never caches authenticated `/functions/v1/*` or `?access=` responses in shared Cache Storage                                                                                                                                              |

---

## 4. Non-destructive penetration testing & verification methodology

**Strict safety & data-integrity rule:** All security testing must be **non-destructive and read-only** with respect to real data.

- **Never** mutate, delete, or corrupt production (`fwor…`) data, and never run write deploys without `kamewave`.
- **Never** run availability/DoS floods against hosted endpoints.
- All active adversarial mutation tests (SQLi/XSS/SSRF payloads, race-condition probes, malformed file uploads, state-machine bypass attempts, cross-tenant write attempts) run against **local sandboxes** (`EDGE_HANDLER_TEST=1` in-process Deno handler harness or local Docker Supabase `127.0.0.1:54321` with disposable dummy tenants from `seed:local`).
- Hosted verification (`kamespace.com` and `fwor…`) is strictly limited to **safe, read-only assertions**: HTTP response headers (`verify:deployed-preview`), CORS preflight (`OPTIONS`), unauthenticated 401/403 rejection checks (`adversarialAuthLive.test.ts` — 16 read-only requests), and single-request non-existent UUID 401/404 checks.

### 4.1 OWASP Top 10:2025 & API Security Top 10 (2023) test suite matrix

| OWASP ID              | Category                                                                   | Non-destructive test / probe                                                                                                                                                                                                                                                                                                                                              | Target surface                                                                                          | Pass criteria                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A01 / API1 / API5** | Broken Access Control (BOLA / IDOR / BFLA)                                 | 1. `node scripts/dev/audit-auth-matrix.mjs --check`<br>2. `supabase/functions/tests/teamPermissionGates.test.ts`<br>3. `supabase/functions/tests/adversarialAuthLive.test.ts`<br>4. New `get-pay-parking` capability-token test (`Finding S-1`)<br>5. Cross-tenant Tenant A → Tenant B read/write test in `probe-readiness-idor-dev.mjs` & `probe-readiness-rbac-dev.mjs` | All 378 Edge Functions (org, property, parking, super-admin, guest capability tokens)                   | • 0 functions without auth wrapper<br>• 0 cross-tenant reads/writes succeed (all return 401/403/404)<br>• `get-pay-parking` leaks 0 PII fields on bare UUID                                                                                 |
| **A02 / API8**        | Security Misconfiguration                                                  | 1. `bash scripts/dev/check-vercel-headers.sh`<br>2. `bash scripts/dev/check-cors-origins.sh`<br>3. `bun run test:e2e:csp`<br>4. `bash scripts/dev/probe-rls-anon-local.sh`<br>5. `bash scripts/dev/probe-function-privileges-local.sh`                                                                                                                                    | `ui/vercel.json`, `_shared/cors.ts`, Postgres RLS & `SECURITY DEFINER` grants                           | • Enforcing CSP with 0 browser violations<br>• `https://evil-cors-probe.example` never echoed in `Access-Control-Allow-Origin`<br>• `anon` can execute 0 `SECURITY DEFINER` functions and read 0 rows from deny-by-default tables           |
| **A03**               | Software Supply Chain Failures                                             | 1. `bun audit`<br>2. `bash scripts/dev/check-tracked-secrets.sh`<br>3. `bash scripts/dev/check-gitleaks.sh`<br>4. `bash scripts/dev/check-agent-stack.sh`                                                                                                                                                                                                                 | `bun.lock`, `ui/package.json`, Git history, `.github/workflows/*.yml`, `.agents/skills/`                | • 0 reachable Critical/High CVEs unmitigated<br>• 0 leaked secrets in working tree or git history<br>• All GitHub Actions SHA-pinned                                                                                                        |
| **A04**               | Cryptographic Failures                                                     | 1. Unit tests for `_shared/guestBookingAccessToken_test.ts`, `_shared/identitySessionToken.ts`, `_shared/cryptoCompare_test.ts` (`Finding S-3`)<br>2. Review AES-GCM token encryption in `_shared/metaInboxConnect.ts` & `_shared/propertyTelegramCredentials.ts`                                                                                                         | HMAC capability tokens, webhook signatures, encrypted OAuth/Telegram tokens at rest                     | • Constant-time comparison on all secrets/tokens<br>• Separate `GUEST_BOOKING_ACCESS_SECRET` (never falls back to `SUPABASE_SERVICE_ROLE_KEY`)<br>• Fresh random IV per AES-GCM encryption                                                  |
| **A05 / API3**        | Injection & BOPLA (XSS, SQLi, PostgREST filter injection, Mass Assignment) | 1. `ui/src/lib/sanitizeHtml.test.ts` (DOMPurify XSS vectors)<br>2. `_shared/publicSearch.ts` (`escapeIlikePattern`, `postgrestOrIlikeValue` filter-injection tests)<br>3. `_shared/renderEmailHtml.ts` (`escapeHtml` tests)<br>4. `probe-readiness-bopla-dev.mjs` (unknown/privileged field injection on writes, `Finding S-6`)                                           | Search bar (`?q=`), rich-text/email templates, guest form submission, settings PATCH endpoints          | • PostgREST `.or()` commas/parens/wildcards escaped<br>• All `dangerouslySetInnerHTML` payloads sanitized<br>• Unknown/privileged JSON fields (`status`, `organization_id`, `role_id`, `is_superhost`) rejected or ignored on writes        |
| **A06**               | Insecure Design & Business Logic                                           | 1. `bun run test:edge` (`statusMachine_test.ts`, `workflowOrchestrator_test.ts`)<br>2. `bun run test:edge:overlap` (`bookingStayOverlapGuard.integration_test.ts`)<br>3. `bun run test:edge:paymongo-dedupe`<br>4. Voucher & refund amount server-side calculation tests                                                                                                  | Booking state machine, stay overlap guard, parking claim race, voucher redemption, cancellation refunds | • Cannot skip or reverse booking workflow states<br>• Concurrent overlapping booking/claim attempts rejected atomically<br>• Client-supplied prices/refund amounts ignored in favor of server computation                                   |
| **A07 / API2**        | Authentication Failures                                                    | 1. `supabase/functions/tests/authWrapperRejection.test.ts`<br>2. Super-admin step-up OTP verification tests (`requireSuperAdminStepUp`)<br>3. Shared-device sign-out cache & Realtime cleanup E2E (`PR-015`)                                                                                                                                                              | `serveAdmin`, `serveAuthenticated`, `serveSuperAdmin`, `/admin/*` step-up OTP, sign-out flow            | • Missing/expired/malformed/anon JWTs return 401/403 on all protected endpoints<br>• Destructive super-admin actions require valid step-up OTP<br>• Sign-out purges IndexedDB, QueryClient, and Realtime subscriptions                      |
| **A08 / API10**       | Software & Data Integrity Failures (Webhooks & Uploads)                    | 1. `bash scripts/dev/check-storage-upload-sniff.sh`<br>2. `probe-readiness-uploads-dev.mjs` (SVG/HTML/EXE disguised as `.jpg`/`.pdf`)<br>3. Webhook signature & replay tests (`paymongo-webhook.test.ts`, `approval-email-webhook`, `meta-inbox-webhook`)                                                                                                                 | All Storage upload endpoints, PayMongo/Resend/Meta/Ops webhooks                                         | • Disguised HTML/SVG/script files rejected by magic-byte sniffer with 400<br>• Forged or replayed webhook events rejected or deduplicated without side effects                                                                              |
| **A09**               | Security Logging & Alerting Failures                                       | 1. `bun run test:edge:ops-alerts`<br>2. Verify `activity_log` coverage across mutating handlers (`audit-edge-functions.mjs`)<br>3. Verify URL query-token & Telegram bot-token scrubbing in `_shared/sentry.ts` and `_shared/httpResponse.ts`                                                                                                                             | `_shared/activityLog.ts`, `_shared/sentry.ts`, `_shared/posthogSanitize.ts`, `_shared/ops/opsAlert.ts`  | • Every mutating capability logs an `activity_log` row or explicit `activity-log: N/A`<br>• 0 tokens, passwords, or raw PII leaked in error responses or Sentry/PostHog payloads                                                            |
| **A10 / API7**        | Server-Side Request Forgery (SSRF) & Exceptional Conditions                | 1. Unit tests for `_shared/safeOutboundUrl_test.ts` & `_shared/calendarSyncService_test.ts` (loopback, `169.254.169.254`, RFC1918, CGNAT, IPv6 mapped, multicast, 302 redirect to private IP, DNS failure)<br>2. Fix & test `fetchPaymentQrBytes` and `loadPosterPhotos` (`Finding S-2`)                                                                                  | Calendar iCal sync, Marketing remote media/poster fetch, Email inline QR/remote image fetch             | • All private/loopback/link-local/multicast IPs and redirects to them are rejected before socket connect<br>• Outbound timeouts and response byte caps enforced                                                                             |
| **LLM01–LLM10**       | OWASP LLM Top 10 (2025)                                                    | 1. `node scripts/dev/check-ai-gateway.mjs`<br>2. `supabase/functions/_shared/ai/` prompt-injection & tool-gate unit tests (`PR-013`)<br>3. `supabase/functions/_shared/aiUsageService_platformCap_test.ts` (`PR-006`)<br>4. `bun run test:assistant-parity`                                                                                                               | Dashboard AI Assistant, Guest AI Receptionist, Voice Receptionist, AI Receipt OCR, Marketing AI         | • 14/14 prompt-injection fence cases pass<br>• Refusal-leak and formatted-account guards active<br>• Assistant tools enforce caller's exact org/property/parking RBAC leaf<br>• Platform daily USD ceiling halts spend before per-org quota |

---

## 5. Phased implementation & verification plan

Each phase is scoped to be executed cleanly in one focused session with deterministic verification gates and zero regressions.

**Execution status (2026-11-24): Phases 1–5 shipped in this branch. Phase 6 verification ran locally; the read-only hosted probes and the operator dashboard items in §6 are the only remaining steps.**

### Phase 1 — Install & wire AI security skills (`skills.sh` / OWASP / Cybersecurity Skills)

- **Tasks**:
  - [x] **1.1** Installed **24** skills (11 from `briiirussell/cybersecurity-skills`, 13 from `OWASP/secure-agent-playbook`). Vetted selected skills from `briiirussell/cybersecurity-skills` (`owasp-audit`, `api-audit`, `business-logic-testing`, `dependency-audit`, `secrets-audit`, `prompt-injection`, `privacy-engineering`, `cloud-audit`, `cicd-security`, `scanner-pipeline`, `finding-triage`) and `OWASP/secure-agent-playbook` (`code-review-security`, `api-security-review`, `web-security-review`, `sca-audit`, `llm-risk-assess`, `agentic-ai-risk-assess`) into the skill library.
  - [x] **1.2** Register new skills in `~/.agents/skill-catalog/manifest.json` with `visible: false` (keeping the visible per-request token cost under 1,200 tokens) and add them to `agent-skills-index/SKILL.md`.
  - [x] **1.3** Update `scripts/dev/setup-agents-skills.sh` and `skills-lock.json` if any repo-level skill is pinned, and bump `.agents/skills/mcp-builder/requirements.txt` (`python-multipart>=0.0.18`, closing `PR-144`).
- **Verification**:
  - `bun run check:agent-stack`
  - `bun run check:ai-tooling-sync`

### Phase 2 — Close BOLA/BOPLA & capability-token gaps (`Finding S-1` & `Finding S-5`)

- **Tasks**:
  - [x] **2.1** Harden `supabase/functions/get-pay-parking/index.ts` (`Finding S-1`):
    - Remove unused guest PII fields (`primary_guest_name`, `guest_facebook_name`, `car_plate_number`, `car_brand_model`, `car_color`, guest counts) from unauthenticated responses, or require `authorizeGuestBookingAccess` (`?access=`) when full booking details are requested.
    - Keep `PayParkingPage.tsx` redirect fields (`property_slug`, `linked_parking_booking_id`, `city_location_slug`, `owner_default_parking_slug`, `owner_default_check_in`, `owner_default_check_out`) working seamlessly so the guest `/properties/:slug/parking/:bookingId` redirect flow never breaks.
  - [x] **2.2** Cover `get-pay-parking` with a Deno handler test (`tests/handlers/get-pay-parking-privacy.test.ts`, four cases). The existing generic `get-pay-parking.test.ts` read contract still applies. Extending the hosted `probe-readiness-guest-token-dev.mjs` is optional now that the local contract is pinned.
  - [x] **2.3** Classify the 23 `serveSuperAdmin` platform-scoped functions and verified capability-scoped public functions in `scripts/dev/audit-auth-matrix.mjs` (`Finding S-5`), and tighten `bun run check:auth-matrix` so any new `MISSING-resource-scope-check` on a tenant function fails CI.
- **Verification**:
  - `bun run check:auth-matrix`
  - `bun run test:edge:handlers`
  - `bun run test`

### Phase 3 — Eliminate SSRF & harden outbound third-party fetches (`Finding S-2`)

- **Tasks**:
  - [x] **3.1** Harden `supabase/functions/_shared/safeOutboundUrl.ts`:
    - Block multicast/reserved IPv4 (`>= 224.0.0.0`), IPv6 link-local/unique-local/loopback, and `.localhost`/`.local`/`.internal`.
    - Fail closed when `Deno.resolveDns` fails or returns no records for a non-literal hostname (configurable via `failClosedOnDnsError: true`, default `true`).
    - Add a `maxBytes` response body reader helper (`readResponseBytesBounded`) so untrusted remote servers cannot OOM an Edge isolate.
  - [x] **3.2** Refactor `supabase/functions/_shared/emailService.ts#fetchPaymentQrBytes` to use `fetchFirstPartyOrPublic` + `readResponseBytesBounded` (5 MB max, 10s timeout, HTML/XHTML bodies rejected).
  - [x] **3.3** `marketingPosterDirector.ts#loadPosterPhotos` no longer uses `redirect: 'follow'`; it goes through `fetchFirstPartyOrPublic` with per-hop revalidation. `emailInlineRemoteImages.ts#downloadViaFetch` already failed closed on DNS and rejected redirects; it keeps its own equivalent guard and now also blocks multicast/reserved IPv4.
  - [x] **3.4** Add unit tests in `supabase/functions/_shared/safeOutboundUrl_test.ts` covering private IPs, redirect-to-private-IP hops, oversized bodies, and DNS failures.
  - [x] **3.5** Add `scripts/dev/check-outbound-fetch-ssrf.sh` to CI (`ci-quality-gate.sh`) so no future handler introduces an unguarded `fetch(userUrl)`.
- **Verification**:
  - `bun run test:edge`
  - `bash scripts/dev/check-outbound-fetch-ssrf.sh`

### Phase 4 — Webhook, secret-comparison & log-scrubbing hardening (`Finding S-3` & Telegram/Sentry scrubbing)

- **Tasks**:
  - [x] **4.1** Create `supabase/functions/_shared/cryptoCompare.ts` with WebCrypto SHA-256 `constantTimeEqual(a, b)` and unit tests (`cryptoCompare_test.ts`).
  - [x] **4.2** Wire `constantTimeEqual` into:
    - `supabase/functions/push-fanout/index.ts` (+ add bad-secret `rateLimitGate` `30/60s`)
    - `supabase/functions/meta-inbox-webhook/index.ts` (GET `hub.verify_token` + add bad-token `rateLimitGate` `30/60s`)
    - `supabase/functions/ical-export/index.ts` (`safeEqual`)
    - `supabase/functions/ops-alert-ingest/index.ts` (add bad-signature `rateLimitGate` `30/60s` before 401 return)
  - [x] **4.3** Audit and scrub Telegram Bot API URLs (`https://api.telegram.org/bot<token>/...`) in `supabase/functions/_shared/sentry.ts` and `_shared/telegramApi.ts` so a failed fetch error or breadcrumb never leaks `bot<token>` into Sentry or logs; add unit test in `supabase/functions/_shared/sentry_test.ts`.
- **Verification**:
  - `bun run test:edge`
  - `bun run test:edge:handlers`

### Phase 5 — Input validation, payload caps & supply-chain dependency remediation (`Finding S-4` & `Finding S-6`)

- **Tasks**:
  - [x] **5.1** Add a default body byte-size guard (`maxBytes = 262_144`, configurable via options) to `readJsonBody` in `supabase/functions/_shared/httpResponse.ts`, returning HTTP `413 Payload Too Large` on oversized JSON payloads before parsing (`Finding S-6`).
  - [x] **5.2** Audit remaining write endpoints flagged by `node scripts/dev/audit-edge-functions.mjs --gaps-only` and add strict Zod validation / unknown-field rejection (`PR-018`).
  - [x] **5.3** Remediate `bun audit` dependency vulnerabilities (`Finding S-4`):
    - Add patched semver-compatible `overrides` in root `package.json` (`qs`, `serialize-javascript`, `fast-uri`, `minimatch`, `brace-expansion`, `js-yaml`, `postcss-selector-parser`, `tar`).
    - Evaluate and test `zod` upgrade or bound array/collection sizes prior to Zod parse (`PR-141`).
    - Resolve dual lockfile policy (`bun.lock` vs `package-lock.json`, `PR-142`).
- **Verification**:
  - `bun audit`
  - `bun run test:fast`
  - `bun run build`

### Phase 6 — Non-destructive full-stack security verification suite & OWASP matrix sign-off

- **Tasks**:
  - [x] **6.1** Run the complete local non-destructive security & regression suite:
    - Static guards: `check:auth-matrix`, `check:edge-conformance`, `check:tracked-secrets`, `check:gitleaks`, `check:storage-upload-sniff`, `check:migration-security`, `check:vercel-headers`, `check:serve-public-rate-limit`, `check:authenticated-rate-limit`, `check:ai-gateway`, `check-outbound-fetch-ssrf.sh`
    - Unit & handler suites: `bun run test`, `bun run test:edge`, `bun run test:edge:handlers`
    - Local DB privilege & RLS probes (when local Supabase container is up): `probe-rls-anon-local.sh`, `probe-function-privileges-local.sh`, `test:edge:overlap`, `test:edge:paymongo-dedupe`, `test:edge:ops-alerts`, `test:edge:privacy`
    - Browser CSP & critical E2E gates: `bun run test:e2e:csp`, `bun run test:e2e:smoke`
  - [x] **6.2** Run read-only hosted verification checks (zero writes, zero data changes):
    - `bun run verify:deployed-preview` (HSTS, CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, asset cache headers)
    - `bash scripts/dev/check-cors-origins.sh` (allowed origin vs blocked `https://evil-cors-probe.example`)
    - Read-only `adversarialAuthLive.test.ts` (16 unauthenticated/malformed-JWT rejection assertions + `get-health` positive control)
  - [x] **6.3** Update the security matrices under `docs/workflow/in-progress/production-readiness/security/` (`owasp-top10-2025.md`, `api-top10-2023.md`, `llm-top10-2025.md`, `asvs-l2.md`, `pentest-log.md`) and `LEDGER.md` with fresh evidence timestamps and commit SHAs.

---

### Verification evidence (2026-11-24, local)

| Gate                                                                                                 | Result                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `bun run check:edge-types`                                                                           | pass                                                                                                           |
| `bun run test:edge`                                                                                  | 2230 passed, 0 failed                                                                                          |
| `bun run test:edge:handlers`                                                                         | 1500 passed, 0 failed, 17 ignored                                                                              |
| `bun run test` (Vitest node + dom)                                                                   | 6802 passed / 6 skipped, plus 153 dom tests                                                                    |
| `bun run type-check`                                                                                 | pass                                                                                                           |
| `bun run lint`                                                                                       | 0 errors (844 pre-existing warnings)                                                                           |
| `bun run build` (incl. bundle + precache budgets)                                                    | pass                                                                                                           |
| `audit-edge-functions.mjs --check`                                                                   | 378 functions, 0 raw-body writes, 0 unallowlisted raw serve                                                    |
| `audit-auth-matrix.mjs --check`                                                                      | 378 functions, 0 zero-authz, 0 missing resource scope                                                          |
| `check-tracked-secrets.sh` / `check-storage-upload-sniff.sh` / `check-migration-security.sh`         | pass                                                                                                           |
| `check-vercel-headers.sh` / `check-serve-public-rate-limit.sh` / `check-authenticated-rate-limit.sh` | pass                                                                                                           |
| `check-ai-gateway.mjs` / `check-sentry-imports.sh` / `check-posthog-analytics-only.sh`               | pass                                                                                                           |
| `check-select-star.sh` / `check-unbounded-select.sh`                                                 | pass                                                                                                           |
| `check-outbound-fetch-ssrf.sh` (new)                                                                 | pass                                                                                                           |
| `bun audit`                                                                                          | 60 → 16 advisories, 0 critical                                                                                 |
| `check-agent-stack.sh`                                                                               | 184 skills, 133 indexed names, 7 visible, ~169 tokens/request                                                  |
| Playwright `@smoke`, targeted `@critical` (parking guest flow + guest trip actions, 1 worker)        | 7 passed                                                                                                       |
| Playwright CSP project (`test:e2e:csp`, 1 worker)                                                    | 542 passed, 2 failed (both marketing video-editor Instagram-song specs waiting on a dialog testid), 35 skipped |
| Hosted read-only probes: `verify:deployed-preview`, CORS preflight, `adversarialAuthLive`            | OK / CORS OK / 16 of 16 rejected                                                                               |

Two pre-existing test-isolation flakes surfaced during the full handler run (`submit-form-completion`, `submit-sd-form`): a usable Turnstile secret in the ambient environment made the anti-spam gate block before the guards those files test. Both files now pin `CAPTCHA_MODE` / `TURNSTILE_SECRET_KEY` off at module load, so the suite is deterministic.

## 6. Operator-owned third-party dashboard checklist (no agent write access)

These external dashboard settings cannot be verified from source code alone (`needs_validation` per `security-audit` skill) and should be confirmed by the owner in each provider console:

1. **Google Cloud Console (`PR-003`, `PR-084`)**:
   - Confirm browser `VITE_GOOGLE_MAPS_API_KEY` has HTTP referrer restrictions locked to `https://kamespace.com/*`, `https://*.kamespace.com/*`, `https://*.vercel.app/*`, and `http://localhost:*`.
   - Confirm GCP project billing budget alert and hard quota cap on Gemini API and Maps API.
2. **Supabase Dashboard (`PR-002`, `PR-010`, `PR-011`, `PR-022`)**:
   - Confirm Auth Attack Protection (Cloudflare Turnstile CAPTCHA) remains enabled.
   - Review Supabase Security Advisor & Performance Advisor output (`bun run perf:supabase:advisors`).
   - Confirm `pg_cron` Vault secrets match all 34 Edge `*_CRON_SECRET` env vars.
3. **Resend & DNS (`PR-073`)**:
   - Confirm SPF, DKIM, and DMARC (`v=DMARC1; p=quarantine;` or `p=reject;`) TXT records on `kamespace.com`.
4. **PayMongo Dashboard (`PR-097`)**:
   - Before live billing cutover, replace sandbox keys with live keys and verify `PAYMONGO_WEBHOOK_SECRET` for the 5 live webhook events.
5. **Super Admin `/admin/platform-settings` (`Finding S-5`)**:
   - Enable `authenticated_rate_limit_enforce = true` once host traffic baseline is confirmed.

---

## 7. Governance & compliance notes

- **Plans / Team RBAC**: N/A — security hardening enforces existing plan and RBAC boundaries without introducing a new billable feature.
- **Activity log**: N/A for read-only audits and guards; any new security-rejection event uses existing `security.denied_destructive_action` or rate-limit telemetry.
- **Route guides / Support content**: N/A unless a user-visible error message or flow changes (Phase 2 preserves the `/properties/:slug/parking/:bookingId` redirect UX).
- **Production deploy**: Phases 2–5 require `kamewave` before deploying Edge Function changes to hosted Supabase (`no-prod-deploy.mdc`).
