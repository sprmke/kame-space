---
title: 'Super Admin payment settings — operator guide'
status: active
tags: [guides, routes, admin]
updated: 2026-11-18
---

# Super Admin payment settings — operator guide

Route: `/admin/pricing/payment-settings`

> **Status:** Documented · rebuilt on the shared console scaffold (`SuperAdminPage` +
> `SuperAdminSettingsCard`/`SuperAdminSettingsRow`) — enabled rails are now `Switch` rows in a
> `Card`, not raw checkboxes; behavior and the `platform-payment-settings` PUT payload are unchanged.

## Progress overview

| Section          | E2E save | Validation | Docs | Notes                            |
| ---------------- | -------- | ---------- | ---- | -------------------------------- |
| Payment settings | Done     | Server     | Done | Dunning config + rails reference |

---

## Overview

Singleton platform config for org subscription billing dunning (**`platform_payment_settings`**). Super-admin sets the renewal-link lead time, grace period, suspension window and checkout expiry; enabled PayMongo rails are stored for ops reference (PayMongo Payment Links expose all rails enabled on the merchant account — not filtered per link via API).

**Access:** `RequireSuperAdmin`.

**Step-up OTP:** saving here needs a fresh email verification code (~15-min sudo window) — see [`overview.md`](overview.md#step-up-verification-all-admin-pages) / `.cursor/rules/admin-auth.mdc` §8.

**Browser tab title:** `Kame Space - Payment settings`

---

## Behavior

- **Enabled rails** — checkboxes for `qrph`, `paymaya`, `dob`. Saved to **`enabled_payment_methods`**. Activate/disable the corresponding rails in the PayMongo dashboard for checkout to match.
- **Renewal link lead (days)** — how many days before **`current_period_end`** the hourly billing cron creates a renewal checkout and sends the "renewal ready" notice (default 5). Each notice is sent once per period.
- **Grace period (days)** — days **counted from the period end** (not from when the cron ran) that a lapsed subscription keeps every paid feature as **`past_due`** before it becomes **`suspended`** (default 5).
- **Suspension window (days)** — how long a **`suspended`** subscription waits for payment before it ends on its own and the org moves to Free (`ended_reason = nonpayment`, default 30, 1 to 365). Suspended orgs behave like Free, not like a lockout.
- **Checkout expiry (hours)** — an unpaid PayMongo checkout expires after this long (at PayMongo and locally) and the host gets a fresh one on demand (default 24, 1 to 168). There is only ever one open checkout per org.
- **Save** — PUT **`platform-payment-settings`**.

---

## API

| Method | Edge function               | Notes                                      |
| ------ | --------------------------- | ------------------------------------------ |
| GET    | `platform-payment-settings` | Returns singleton row                      |
| PUT    | `platform-payment-settings` | Partial update of rails + dunning integers |

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../architecture/unsaved-changes.md).

## Implementation map

| Layer | Path                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| Page  | `ui/src/features/dashboard/super-admin/pages/SuperAdminPaymentSettingsPage.tsx`                                                   |
| Hook  | `ui/src/features/dashboard/super-admin/hooks/usePlatformPaymentSettings.ts`                                                       |
| Edge  | `supabase/functions/platform-payment-settings/index.ts`                                                                           |
| Cron  | `platform-billing-cron` (hourly) reads settings via **`subscriptionOrchestrator`** and the pure **`orgSubscriptionStateMachine`** |

---

## Host-facing knowledge

Hosts do not see this page. These numbers decide when renewal notices arrive, how long paid features stay on after a missed payment, and when an unpaid plan ends. Suspension turns paid features off but never locks the dashboard, and guest booking flows are never blocked by billing status.
---

## Testing

| Layer  | Path / spec                                             | Manual                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| Unit   | `superAdminVerification_test.ts` when auth rules change | —                                                           |
| E2E    | N/A — use `adminShellSmoke` for `/admin` shell only     | —                                                           |
| Manual | —                                                       | [`super-admin-manual.md`](../testing/super-admin-manual.md) |
