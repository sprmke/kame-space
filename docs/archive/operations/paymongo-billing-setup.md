# PayMongo org subscription billing — setup

Operational guide for host → platform recurring plan payments via PayMongo **Hosted Checkout Sessions** (QRPH, Maya, GCash). **Org-scoped** — one subscription per org (`org_subscriptions`), priced per enrolled property against `pricing_plans`; there is no per-property billing anymore.

Plan: [`docs/workflow/done/paymongo-subscription-billing.md`](../../workflow/done/paymongo-subscription-billing.md) (original per-property build, historical — checkout/webhook code has since been rewritten org-level, see [`docs/workflow/done/org-level-billing-migration.md`](../../workflow/done/org-level-billing-migration.md)).

## Sandbox (development)

1. Create a PayMongo account and enable **Test mode** in the dashboard.
2. **Developers → API Keys** — copy the **Secret test key** (`sk_test_…`).
3. Add to `supabase/.env.local`:
   - `PAYMONGO_SECRET_KEY=sk_test_…`
   - `PUBLIC_GUEST_APP_ORIGIN=http://localhost:5173` (or your Vite dev URL — used for Hosted Checkout `success_url` / `cancel_url`)
4. **Developers → Webhooks** — create a test endpoint:
   - URL (local via ngrok): `https://<your-ngrok-subdomain>.ngrok-free.dev/functions/v1/paymongo-webhook` — **must include** `/functions/v1/paymongo-webhook` (not the ngrok root alone). ngrok forwards to `http://127.0.0.1:54321` (local Supabase Kong).
   - URL (hosted dev): `https://<project-ref>.supabase.co/functions/v1/paymongo-webhook`
   - Events: `payment.paid`, `payment.failed`, **`payment.refunded`**, `link.payment.paid`, **`checkout_session.payment.paid`** (enable all payment/link/checkout-session events available). `payment.refunded` marks the transaction `refunded` and records `billing.refund_recorded`; the super-admin then decides whether the period stands.
   - Copy the endpoint **signing secret** → `PAYMONGO_WEBHOOK_SECRET` in `supabase/.env.local` and hosted dev secrets.
5. Paid checkout from **Org → Plans & Billing** creates a **Hosted Checkout Session** (`/v2/checkout_sessions`) via **`create-org-subscription-checkout`**. After payment, PayMongo redirects to `/org/:orgSlug/plans?tab=billing&checkout=success` and **`paymongo-webhook`** fulfills the subscription.

### Verify webhooks (local)

1. Open ngrok inspector: `http://127.0.0.1:4040` — you should see `POST /functions/v1/paymongo-webhook` with `200` after a test payment.
2. Edge logs should show `serving the request with supabase/functions/paymongo-webhook` (not only `org-plan`).
3. If payment succeeded on PayMongo but the plan did not change, the webhook never reached your backend. Fix the endpoint URL and signing secret. Meanwhile the hourly `platform-billing-cron` reconciles checkouts older than 10 minutes against PayMongo, and the Plans page reconciles only the one checkout this browser started (at most one PayMongo lookup per 15 seconds). A payment that arrives for a checkout that was already expired or replaced is **never ignored**: it is applied when it still fits the subscription, otherwise it becomes account credit and the host is told.

## Live (production)

1. Complete PayMongo KYB (business registration, ID, proof of address, settlement bank).
2. Request activation for **QRPH**, **Maya**, and **online banking (Dob)** if not enabled by default.
3. Create a **separate live webhook** on the production Supabase project URL (`https://fworvijbrwpyngycotbz.supabase.co/functions/v1/paymongo-webhook`) with its own signing secret and the five events above: `payment.paid`, `payment.failed`, `payment.refunded`, `link.payment.paid`, `checkout_session.payment.paid`.
4. Store **`PAYMONGO_SECRET_KEY`** (`sk_live_…`) and **`PAYMONGO_WEBHOOK_SECRET`** as **production** Edge secrets only — do not reuse dev keys on prod. Both are readable only as digests afterwards, so keep the source values safe.
5. Run one live checkout end to end: Subscribe on `/org/:orgSlug/plans`, pay the smallest plan, confirm the plan flips to active, the receipt email arrives with a working PDF link, the webhook appears in Supabase logs with `200`, and refunding it in PayMongo marks the payment `refunded`.
6. Confirm the hourly cron still answers 200 after the key swap (`platform-billing-cron`); it authenticates with `PLATFORM_BILLING_CRON_SECRET`, not PayMongo.

## Env vars

| Variable                       | Where                                | Purpose                                                                                                                    |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `PAYMONGO_SECRET_KEY`          | Edge secrets / `supabase/.env.local` | Basic auth for Checkout Sessions + Payment Links API                                                                       |
| `PAYMONGO_WEBHOOK_SECRET`      | Edge secrets / `supabase/.env.local` | HMAC verify `Paymongo-Signature` header                                                                                    |
| `PUBLIC_GUEST_APP_ORIGIN`      | Edge secrets / `supabase/.env.local` | Hosted Checkout `success_url` / `cancel_url` base (e.g. `http://localhost:5173` local, `https://kamespace.com` production) |
| `PLATFORM_BILLING_CRON_SECRET` | Edge secrets (optional)              | Auth header for hosted **`platform-billing-cron`**                                                                         |

See also [`docs/architecture/validation-and-env.md`](../../architecture/validation-and-env.md).

## Edge functions

| Function                                          | Role                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create-org-subscription-checkout`                | Org owner creates the PayMongo Hosted Checkout Session + pending `org_payment_transactions` row (first purchase, upgrade, renewal, retry, reactivation). Needs the reviewed `expectedChargePhp` (409 `price_changed` with the fresh amount if it moved) and an `idempotencyKey`. One open checkout per org: a new one expires the old session at PayMongo. Net due of zero is applied from account credit with no PayMongo call |
| `preview-org-plan-change`                         | Read-only server quote and impact for `pay`, `schedule`, `cancel` and `add_property`                                                                                                                                                                                                                                                                                                                                            |
| `org-subscription-change`                         | Owner schedules a downgrade or cancel at the period end, undoes it, or ends an overdue plan now                                                                                                                                                                                                                                                                                                                                 |
| `org-billing-details` / `get-org-payment-receipt` | Billing details form and numbered receipt PDF (`org.plans:view` to read)                                                                                                                                                                                                                                                                                                                                                        |
| `paymongo-webhook`                                | Signature verify, dedupe, fulfill subscription on `payment.paid` / `checkout_session.payment.paid` / `link.payment.paid`; `payment.refunded` marks the payment refunded                                                                                                                                                                                                                                                         |
| `platform-payment-settings`                       | Super-admin dunning config (singleton `platform_payment_settings`): renewal lead, grace, suspension window, checkout expiry                                                                                                                                                                                                                                                                                                     |
| `platform-billing-cron`                           | **Hourly**, idempotent: period-end transitions, renewal links and reminders (sent once), past due, suspension, auto-cancel, checkout expiry and webhook reconciliation (see scheduled-jobs doc)                                                                                                                                                                                                                                 |
| `org-plan`                                        | Host Plans & Billing page: subscription state and pending intent, upcoming payment, account credit, payment history with receipts (history and billing details need `org.plans:view`), pending checkout URL                                                                                                                                                                                                                     |

## PayMongo rails note

Org subscription checkout uses **Hosted Checkout Sessions** (`/v2/checkout_sessions`) with `payment_method_types` from `platform_payment_settings.enabled_payment_methods` (defaults: `qrph`, `paymaya`, `gcash`). **Parking** guest payments still use **Payment Links** (`/v1/payment_links`). Super-admin **Enabled rails** in **`/admin/pricing/payment-settings`** must match rails enabled on the PayMongo merchant account.

## Scope shipped vs original plan

- **Org-scoped** billing on **`org_subscriptions`** / **`pricing_plans`** — the original per-property design (`property_subscriptions`) shipped first, then was fully replaced by the org-level model; see [`docs/workflow/done/org-level-billing-migration.md`](../../workflow/done/org-level-billing-migration.md).
- Host billing UX lives on **Org → Plans & Billing** (`/org/:orgSlug/plans`) — there's no per-property Plans page anymore.
- Super-admin under **`/admin/pricing/*`** (not `/admin/billing/*`).
- **AI credit PayMongo top-up** remains a separate future plan.

## Dual-track deploy

- Multi-tenant dev (`fwor…`): configure test keys on dev Supabase before QA.
- Legacy prod: separate live keys when cutover ships — see [`docs/architecture/deployment.md`](../../architecture/deployment.md).

## API facts verified for the lifecycle plan

Verified against the real PayMongo **sandbox** on 2026-11-19 by `orgBillingSandbox.integration_test.ts` (real checkout sessions, real hosted-checkout payments, a real refund). Not yet observed on a live-mode account.

| Item                      | Finding                                                                                                                                                                                           | In the code                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Expire a checkout session | `POST /v1/checkout_sessions/{id}/expire` closes it. The session reads `expired` and the hosted page shows "invalid or has already expired", so a superseded link cannot take a payment            | `expirePaymongoCheckoutSession`; scheduling a change expires the open checkout                                     |
| A paid session            | Stays `status: "active"`. The payment exists only in `payments[]` (`id`, `attributes.status = "paid"`, `attributes.source.type`, `attributes.paid_at` in epoch seconds)                           | `getPaymongoProviderPaymentState` and `paidPaymentFromCheckoutSession` read `payments[]`, never the session status |
| Missed webhook            | Reconciliation recovers the payment with PayMongo's own paid time and method, and stores the `pay_...` id so a later refund finds it                                                              | `getPaymongoPaidPayment` in `orgPaymentReconcile.ts`                                                               |
| Refund                    | `POST /v1/refunds` with `payment_id` returns a `refund` resource whose `attributes.payment_id` names the payment, and a refund starts `pending`. The `payment.refunded` event wraps that resource | The refund handler matches `provider_payment_id`                                                                   |
| Minimum amount            | PHP 1.00 floor for payment intents in the docs. No per-method minimum was found                                                                                                                   | `MINIMUM_CHARGE_PHP = 20`, deliberately above the floor; the excess becomes account credit                         |
| Methods on our sessions   | QR Ph and the e-wallets enabled in `platform_payment_settings` (the sandbox showed Maya and Online Banking)                                                                                       | `mapPlatformMethodsToPaymongoCheckout`                                                                             |

**Webhook registration (sandbox account, re-checked 2026-11-19):** the production project's `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` now hold the **sandbox** account values, its `paymongo-webhook` hook is **enabled** with the events listed above, and one real purchase end to end (checkout, webhook, receipt PDF, refund) passed on production. The second sandbox hook, pointing at a local ngrok URL, stays disabled. Before go-live, swap in the live keys, enable the live hook with the same events, and run one live checkout (see **Live (production)** above).

**Run the sandbox matrix locally:**

```bash
PAYMONGO_SANDBOX=1 PAYMONGO_SECRET_KEY=sk_test_... TZ=Asia/Manila deno test \
  --config supabase/functions/deno.json --allow-net --allow-env --allow-read --allow-run \
  --allow-import supabase/functions/tests/orgBillingSandbox.integration_test.ts
```

It refuses any key that is not `sk_test_`, needs the local stack and Playwright, and takes about three minutes (seven real sandbox payments).
