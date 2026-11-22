---
title: 'Rate limits — operator guide'
status: active
tags: [guides, routes, admin, super-admin]
updated: 2026-11-21
---

# Rate limits — operator guide

Route: `/admin/rate-limits`

> **Status:** Documented.

## Progress overview

| Section                 | E2E save | Validation | Docs       | Notes                                                |
| ----------------------- | -------- | ---------- | ---------- | ---------------------------------------------------- |
| Enforcement status      | —        | —          | Documented | Read-only summary, links to Platform settings        |
| Active in the last hour | —        | —          | Documented | Identities near or over the limit                    |
| Manual block            | —        | Done       | Documented | User id or IP, optional reason, step-up verification |
| Blocked identities      | —        | —          | Documented | Unblock action per row                               |

---

## Overview

Super-admin view of the authenticated-request limiter. It answers two questions: who is close to or over the configured limit right now, and which identities are manually blocked. The limiter is enforced server-side on authenticated edge calls; this page does not change the numbers, it observes and blocks.

---

## Host-facing knowledge

N/A: `admin/**` pages are super-admin only and never appear on host or guest surfaces.

---

## Enforcement status

- Reads the current limit and enforcement mode from platform settings.
- Renders `OFF - log only`, `Log only`, or `Enforced` plus `N requests / 60s per user`.
- **Change in Platform settings** links to `/admin/platform-settings`, where the limit and enforcement switch live.
- `Enforced` requires an edge deploy to take effect; the page notes that when the mode changes.

### Behavior / edge cases

- The limiter counts per authenticated user, not per org.
- Log-only mode records counters without rejecting calls, so the list here can still show identities near the limit.

---

## Active in the last hour

Counters above the warning threshold for the current window. Empty state: "No identity is near the limit right now".

Each row shows the identity, its count, and the window. Counts reset as the window rolls.

---

## Manual block

Immediately rejects every call from one identity, regardless of its count.

### Fields

| Field         | Validation                                                    |
| ------------- | ------------------------------------------------------------- |
| User id or IP | Required. `u:` or `ip:` is added automatically from the value |
| Reason        | Optional, shown in the blocked list                           |

Accepted input:

- a bare user id (`abc123`) becomes `u:abc123`
- an IPv4 or IPv6 address (`203.0.113.5`, `2001:db8::1`) becomes `ip:…`
- an explicit `u:` or `ip:` prefix is kept as typed (prefix lowercased)

### Save path

1. **Block** → `super-admin-rate-limits` (POST)
2. Step-up OTP is required. The shared dialog pauses the request, then retries it once.
3. The row appears under Blocked identities; the action is audit-logged.

### Behavior / edge cases

- Blocking yourself is allowed technically but will lock the console; do not block the signed-in super admin.
- A block is indefinite until removed. There is no expiry field.
- The button stays disabled until the value normalises to a valid identity.

---

## Blocked identities

Lists active blocks with identity, reason, and when it was blocked. **Unblock** removes the row and is audit-logged.

---

## Implementation map

| Piece                | Path                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| Page                 | `ui/src/features/dashboard/super-admin/pages/SuperAdminRateLimitsPage.tsx` |
| Identity parsing     | `ui/src/features/dashboard/super-admin/lib/rateLimitIdentity.ts`           |
| Data hook            | `ui/src/features/dashboard/super-admin/hooks/useSuperAdminRateLimits.ts`   |
| Edge function        | `supabase/functions/super-admin-rate-limits/`                              |
| Limits + enforcement | `supabase/functions/platform-settings/`                                    |
