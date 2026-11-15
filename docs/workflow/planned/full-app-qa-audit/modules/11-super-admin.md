---
title: 'QA packet 11: super-admin console'
status: planned
stage: planned
kind: reference
tags: [qa, audit, super-admin, platform]
updated: 2026-11-13
---

# 11 Super-admin

**Rows:** ADM-01 to ADM-24 · **Personas:** `super-admin`; `owner`, `org-admin`, `guest`, `anon` (all must be refused); an affected host in a second context to observe the effect · **Environments:** **L for every action.** On P the console is viewed only: no approvals, suspensions, plan or payment edits, availability switches, payouts or announcements.

Each switch here changes other people's pages. A super-admin element passes only when the effect is verified on the host, guest or public page it targets.

## References

Guides under `docs/guides/routes/admin/`. Architecture: `feature-availability.md`, `ai-platform.md`, `ops-reports.md`, `observability.md`, `supabase-capacity.md`. Manual guides: `super-admin-manual.md`, `admin-playwright.md`, `observability-manual.md`, `cost-abuse-verification.md`. Rules: `admin-auth.mdc`. Specs: `ui/e2e/features/admin` (4), `feature-availability` (2), `host-verification` (4). In progress: `super-admin-system-health`, `production-error-escalation` (planned). `for-testing`: `super-admin-step-up-otp`, `feature-availability-controls`, `superhost-program`. Planned: `super-admin-console-followups`, `super-admin-service-cost-monitoring`.

## Probe beyond the generic lenses

- **Gate (ADM-24):** `SUPER_ADMIN_EMAILS` is the only way in. Every `super-*`, `platform-*` and admin function refuses a normal owner called directly. Step-up OTP: prompt, wrong code, expiry, session length, cannot be bypassed.
- **Overview (ADM-01):** every KPI recomputed from the DB; links.
- **Hosts and orgs (ADM-02 to 06):** lists with filters, search, pagination; host detail and org hub tabs; every action (verify, suspend, restore, impersonate or view-as if present, change plan, grant override, delete). For each: confirmation, reason capture, audit entry, email to the host, and the effect on the host's session and public pages (C19, C12). Legacy sub-route redirects.
- **Approvals (ADM-07):** queue ordering, document viewer (PDF and images, large files), approve, reject with reasons, request changes; identity captures; the host sees the outcome (C19, C31). Access to ID images is logged.
- **Developments (ADM-08, 09):** 20-section detail (basic info, media, email automations, document requirements, unit types, pool, guest information, announcements, amenities, location, towers and parking, danger zone). Each traced to public development pages and to residence-specific documents and emails in the booking flow (C30).
- **Support (ADM-10):** ticket queue, reply, status, assignment; FAQ editor and its sync to Help Center and `faqs.md` (C33).
- **Announcements (ADM-11):** create, target (all, tier, org), schedule, publish, unpublish; host side unread state (C20).
- **AI console (ADM-12):** controls and usage tabs, profiles and limits (the single source for limits), per-org overrides, kill switches, usage numbers equal metering rows; redirects from `settings` and `ai-usage` (C21).
- **Playbook (ADM-13):** AI review playbook content and actions.
- **Health (ADM-14):** every section; each registered cron and probe shows true state; break one on L (stop a cron, remove an env var) and confirm it is flagged; no secret values displayed.
- **Ops reports (ADM-15):** list, detail, generation cron, content accuracy.
- **Rate limits, audit, platform settings (ADM-16 to 18):** view and edit paths, maintenance mode switch and its effect on every shell, audit log completeness for super-admin actions.
- **Feature availability (ADM-19):** build the key list (coverage inventory K12). For every key, switch off and verify nav, page, public surface and server enforcement at every level; switch on again (C18).
- **Pricing (ADM-20 to 22):** plan catalog edit reflected on `/for-hosts/pricing`, org Plans, checkout amounts and entitlements (C17); `check:plan-catalog` stays green; payment settings; subscriptions list, manual changes, events history.
- **Parking payouts (ADM-23):** amounts recomputed from parking payments; mark paid; export.

## Hidden surfaces

`super-*`, `platform-*`, `approve-*`, `reject-*`, `decide-*`, `feature-*`, `ops-*`, `reassess-*`, `superhost-*` functions; `ops-report-cron`, `platform-billing-cron`, `superhost-assessment-cron`; `systemHealth/jobsRegistry.ts` and `probes.ts`; Vault and env matrix.

## Connections and journeys

Source of C17 to C21, C30, C33 (reply). J05, J24, J25, J27.

## Known risks

- Destructive actions are irreversible on P; that is why P is view-only here.
- The system health work is in progress and had uncommitted changes at plan time.
