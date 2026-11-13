---
title: 'Guest journey follow-ups'
status: planned
tags: [workflow, planned, guest]
updated: 2026-11-13
stage: planned
kind: plan
---

# Guest journey follow-ups

The guest post-booking journey shipped and closed
([`done/guest-post-booking-journey.md`](../done/guest-post-booking-journey.md)). This file is the
parking lot for what it deliberately left out, so the decisions survive and nothing pretends to be
finished.

**None of these is a defect in what shipped.** Each one is scoped below with the reason it was not
built and the thing that would unblock it. Start any of them with `/workflow-start` and move it to
`in-progress/`.

---

## Outstanding production task (not a feature)

**The two guest-journey crons are scheduled but rejected.** Both jobs exist and are active, and
neither has ever written a heartbeat, while the other crons have. That is the fail-closed cron gate:
`_shared/cronSecretGate.ts#verifyCronSecret` rejects every call when the edge secret is unset, which
it is in production. Deploy scripts only set `APP_RELEASE`, so these are hand-provisioned.

| Job | Edge secret | Vault secret |
| --- | --- | --- |
| `pre-arrival-reminders` | `PRE_ARRIVAL_REMINDER_CRON_SECRET` | `pre_arrival_reminder_cron_secret` |
| `pending-review-expiry` | `PENDING_REVIEW_EXPIRY_CRON_SECRET` | `pending_review_expiry_cron_secret` |

Values are already generated and stored in the gitignored `supabase/.env.production` (and
`.env.local`, `.env.dev.local`). Both halves must hold the **same** value or the call fails on the
header check. `/admin/health` reports the pair under `db.vault.parity.<ENV_KEY>` and shows a
registered job with no heartbeat, so the page is the confirmation.

Until this is done: the T-48h reminder does not send, and no request expires, so the dates a stale
request holds stay held.

---

## J1 — Push for anonymous guests

**What.** A guest who books without an account has no `guest_user_id`, so
`_shared/guestPush.ts` cannot address them and they only get email.

**Why not built.** The only identifier an anonymous guest has is the booking access token. Binding a
device subscription to it means anyone who obtains the token can register a device for that booking,
so it needs a deliberate decision on token lifetime, revoke, and what a leaked token can receive.

**What it takes.** A `push_subscriptions`-adjacent table keyed by booking + device, subscription
issued only while a valid access token is presented, a revoke path when the booking closes, and a
`security-auditor` pass. Reuse the send path that already exists.

## J2 — More guest push milestones

**What.** Push currently covers **Confirmed** and **Ready for check-in**. Host chat replies, refund
sent, and review requests still arrive by email only.

**Why not built.** Each one needs a product call, not just code: a chat reply is high-volume and
would need coalescing per thread, and a refund is money news with an email the guest may need.

**What it takes.** Add a status to `GUEST_PUSH_STATUSES` and its copy; for chat, reuse the existing
`(type, dedupe_key)` coalescing idea so one thread is one notification.

## J3 — Per-property request-expiry window

**What.** Expiry is a fixed 7 days after submission (`PENDING_REVIEW_EXPIRY_DAYS`), with the chase at
day 5.

**Why not built.** A setting means a plans/RBAC decision and a settings surface; the fixed window
shipped first because it is booking hygiene, not a feature to sell.

**What it takes.** A property setting (2 to 30 days, default 7), the `settings:edit` leaf that
already exists, and `pendingReviewPolicy.ts` reading it instead of a constant. Decide whether the
chase lead stays a constant or moves with it.

## J4 — Stale requests in later statuses

**What.** Only `PENDING_REVIEW` auto-resolves. A booking sitting in `PENDING_DOCUMENTS` because the
guest never sent the GAF also holds its dates indefinitely.

**Why not built.** That one is the guest's move, not the host's, and cancelling it automatically is a
much stronger action than expiring an unanswered request.

**What it takes.** Decide the policy first (nudge the guest, then expire, or never), then reuse the
same sweep with a different clock and copy.

## J5 — SMS / WhatsApp delivery

**What.** A second delivery channel for guests who do not read email.

**Why not built.** Vendor, cost per message, consent capture, and template approval per country. It
is a procurement question before it is a code question.

## J6 — Smart locks and generated lock codes

**What.** Issue a per-booking code instead of the property-wide door code.

**Why not built.** Needs a lock vendor integration, an offline fallback for a dead hub, and a rule
for what happens to a code when a booking shifts or cancels.

## J7 — Upsells and rental agreement signing

**What.** Early check-in, late check-out, add-ons, and a signed agreement.

**Why not built.** Pricing rules plus e-signature and legal copy, all of which need owner decisions
before any code.

## J8 — Multiple receipts per booking

**What.** One balance receipt per booking today, matching
`guest_balance_payment_receipt_url`.

**Why not built.** A property that takes several partial payments would need a
`guest_payment_submissions` table.

**What it takes.** A new table plus a list UI on the trip page and the booking detail. Only worth it
once a real property asks.

---

## Related

- Shipped plan: [`../done/guest-post-booking-journey.md`](../done/guest-post-booking-journey.md)
- Emails: [`../../architecture/guest-emails.md`](../../architecture/guest-emails.md)
- Push: [`../../architecture/pwa.md`](../../architecture/pwa.md) §8
- Crons: [`../../archive/operations/scheduled-jobs-and-testing.md`](../../archive/operations/scheduled-jobs-and-testing.md)
