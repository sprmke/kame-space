---
title: 'Audit 04: platform admin'
status: active
tags: [audit, admin, super-admin]
updated: 2026-11-18
---

# 04: Platform admin (`/admin/*`)

Scope: 24 routes under `/admin`, every tab of `/admin/ai` and `/admin/health`, the org hub
(`/admin/orgs/kame-homes`) with all eight sections, and a host detail page. Desktop 1440 and mobile 390. Primary controls, dialogs, filters, saves and toggles were exercised; destructive saves were
cancelled.

Screenshots from this module live in `/tmp/audit/admin-screens/` (133 files) and are referenced by
filename below. Capture method and raw measurements: `/tmp/audit/scan-desktop.json`,
`/tmp/audit/scan-mobile.json`.

---

## P1

### A1. Seeded audit rows pair a title with the wrong action key (demo credibility, no guard)

`/admin/audit` and the Activity section of the org hub pair `summary` and `action` from two arrays of
different lengths in the seed (`scripts/dev/seed/19-super-admin.sql`, actions `% 10`, summaries
`% 6`), so rows read:

| Row title                         | Recorded key                   | Object type    |
| --------------------------------- | ------------------------------ | -------------- |
| Approved host verification        | `org_subscription_changed`     | property       |
| Updated platform support settings | `feature_availability_updated` | pricing_plan   |
| Replied to a support ticket       | `host_verification_approved`   | support_ticket |
| Marked a parking payout as sent   | `support_ticket_replied`       | organization   |
| Approved host verification        | `ai_limit_profile_assigned`    | pricing_plan   |

The first row (`Generated operations report` → `ops_report.generate`) is correct because it is a real
event. So the product writes both fields together and the live trail is likely fine; this is seed
data that makes the platform look broken in every demo and screenshot.

Two follow-ups beyond the seed fix:

- The UI prints `event.summary` verbatim, so nothing catches a caller that writes a mismatched
  summary. Consider deriving the label from the action key in the UI (with the stored summary as an
  override only when intentional), plus a test that every catalog key has a label.
- The seed should generate matching pairs; a seed audit trail is exactly what a reviewer reads first.

### A2. A non-ISO timestamp renders the literal string `Invalid Date`

`/admin/approvals` SUBMITTED column and the three org-hub approval cards render `Invalid Date`, while
the detail dialog prints the raw value. The seed writes `…T07:48:17+00` (Postgres `OF`, no `:00`
minutes), which `new Date()` rejects; the product path writes `toISOString()` so production values
parse. Two real defects remain:

- The list formatter renders the string "Invalid Date" instead of falling back to the raw value (the
  dialog formatter already falls back, which is why the same row shows two different things).
- The seed should use `toISOString()` so local data is realistic.

Any imported or hand-edited value with a non-ISO offset (or a bare `MM-DD-YYYY` guest date) will hit
the same branch, so the fallback matters beyond the seed.
[screenshots/04-admin-approvals-invalid-date.png](./screenshots/04-admin-approvals-invalid-date.png),
[screenshots/05-admin-org-invalid-date.png](./screenshots/05-admin-org-invalid-date.png)

### A3. Org hub listing/support/approval cards are crushed to 190px

Measured: each listing card is **190px wide** inside a ~1,060px column, so stat labels collide
("BookingsRevenue Occupancy"), revenue is clipped ("₱42,…"), ticket subjects reduce to "Cale…", "A…",
"H…", and approval names to "Mona…", "Azur…". The section is the reason the hub exists and is
currently unreadable. Root cause is a fixed narrow grid track; `minmax(0,1fr)` with 2-3 columns fixes
it.

### A4. AI numbers contradict each other on four surfaces

- Overview: KPI "AI spend $1.13" while the card directly below says **"No AI usage in this range"**.
  (Confirmed in this audit's own desktop capture.)
- AI → Usage: "Spend $1.13", **"Orgs using AI 0"**, **"Credits 0"**, feature row
  **"Calls 0 · Credits 0 · Errors 2 (100%)"**.
- AI → Limits: the only org shows **3/200 today, 96/5,000 month calls, $0.62, 1,300/25,000 credits**.
- Health → Usage: "Month to date $0.62", "Dashboard assistant $0.00 · 0 calls · 100% errors".
- AI → Controls: "Platform AI Enabled OFF" while spend and calls are still recorded.

Every one of these is a number a super admin uses to decide on credits, quotas or abuse. They cannot
all be right. The "0 calls with 2 errors" combination is internally impossible.

### A5. Parking payout ledger reports zero processor fee and zero platform net

The page configures "Processor fee 3.13% + ₱15" and previews `-₱27.52` / `₱102.48` for a sample
night. Every ledger row then shows `Guest ₱700.00 · Processor ₱0.00`, and the summary tiles read
`Processor (est.) ₱0.00 / Platform net ₱0.00` while guest charges total ₱2,800 and host payouts
₱2,520 (a ₱280 gap). Either the fee is not stored at payment time or the ledger query does not derive
it. A disbursement record that says the platform earned ₱0.00 is not reconcilable.

### A6. Platform-wide settings cannot be changed, and the OTP dialog dead-ends

Saving on `/admin/platform-settings` opens "Confirm it's you" and **Send OTP** fails with
`400 {"error":"Email is not configured"}`. The raw string replaces the field hint, there is no retry,
no alternate path, and no link to System health, which already flags `RESEND_API_KEY Missing`. In
this environment every platform setting (signups, maintenance mode, support email, rate limits,
reward campaign) is frozen. In production the same dead-end occurs whenever email delivery is down.

### A7. AI Limits row contradicts the org's plan and exposes a raw key

`/admin/ai?tab=limits` shows Kame Space as Plan **"Starter"** and Profile **"business_plus"**, while
`/admin/orgs`, `/admin/orgs/kame-homes` and `/admin/pricing/subscriptions` all show Business. The row
is what determines the org's quota, so the operator cannot reason about it. Join the plan by
subscription id and render display names.

### A8. System health "Jobs" says OK for a job with a 502 and 3 failed runs

All nine jobs show a grey "Unknown" dot and a header pill "Unknown", yet each right-hand label reads
"OK 9d ago". Calendar sync reads "OK 9d ago" directly above "Airbnb feed returned HTTP 502" and
"240 runs · 3 failed". The most important signal on the page is inverted.

## P2

| #   | Finding                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A9  | **"Edit pro" dialog title** for the Business plan (`/admin/pricing/plans`). Use `plan.name`; keep the slug as secondary text.                                                                                                                                                |
| A10 | **Every list page's pagination is a bare "31"** with options 31/50/100 and no visible label. Use 25/50/100 and label it "Rows".                                                                                                                                              |
| A11 | **Mobile filter strips clip at the right edge** on Developments, Properties, Support, Approvals, Announcements, Plans, Subscriptions (measured right edges 432/592/776 at a 390 viewport) with no fade or sheet. AI → Limits already wraps correctly, so the pattern exists. |
| A12 | **Org hub section rail is hidden on mobile**, leaving a 6,317px single scroll to reach Settings.                                                                                                                                                                             |
| A13 | **AI credit wallets** requires typing an org UUID or slug; no list, no balances, no recent top-ups.                                                                                                                                                                          |
| A14 | **Plan price semantics differ**: Plans shows "₱1,439 · 20% off" without the list price; Orgs shows "MRR ₱1,799". Show `₱1,799 list → ₱1,439 promo` and one MRR definition.                                                                                                   |
| A15 | **Hosts list rows do not look clickable** (no chevron/hover, unlike Organizations). Host detail has two unlabeled glyphs ("building 1", "steering wheel 1") and no joined date, last active, plan or status.                                                                 |
| A16 | **Audit log has only relative times** ("14h ago"), no actor/action/date filters, no pagination. Add absolute Asia/Manila timestamps and filters.                                                                                                                             |
| A17 | **Ops reports**: two reports both labelled "Current week" with different ranges, one WARN with all-zero severity chips, timestamps without a timezone.                                                                                                                       |
| A18 | **Support KPIs merge Closed into Resolved** ("Resolved 3" for 2 resolved + 1 closed) while the filter lists them separately.                                                                                                                                                 |
| A19 | **Pricing plans status column blank** for four of six plans; "Active plans 5" cannot be verified.                                                                                                                                                                            |
| A20 | **Feature availability "Off only"** leaves a completely blank page with no empty state, while "All features on" stays visible.                                                                                                                                               |
| A21 | **Internal identifiers leak into settings copy**: endpoint names (`meta-inbox-oauth-*`), assistant action names (`propose_send_inbox_reply`), cron names, playbook slugs, raw plan keys. Move behind a technical-details disclosure.                                         |
| A22 | **Payout filter chips reset scroll** to the top, losing the ledger you were filtering.                                                                                                                                                                                       |
| A23 | **Rate limits copy**: "u:<userId>or ip:<address>" missing space; disabled "Block" button is painted as an enabled destructive action.                                                                                                                                        |
| A24 | **Subscription page** exposes "Run Superhost cron" and "Run billing cron" with no scope, confirmation or result feedback; "Reassess" does not read as a button.                                                                                                              |
| A25 | **Announcement scheduling is date-only** with `MM/DD/YYYY` placeholders and no time or timezone, so a maintenance window (which the seeded copy describes in Asia/Manila) cannot be scheduled.                                                                               |
| A26 | **AI Cost by feature** renders an empty plot with a rotated label and no empty state; the Spend axis uses uneven steps (`$0.06, $0.04, $0.03, $0.01`).                                                                                                                       |
| A27 | **Payout per-property preview drops thousands separators**: "₱1,439 (₱1439/property)".                                                                                                                                                                                       |

## P3 and visual

| #   | Finding                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A28 | Cookie banner covers the sidebar account menu on every admin route (shared with X1).                                                                  |
| A29 | Development detail rail truncates "Document Requirem…" although the section is the only navigation.                                                   |
| A30 | A full-screen `z-[100]` splash layer containing "Kame / Space" stays mounted after render on several admin routes.                                    |
| A31 | "Report generated" toast overlaps the page H1.                                                                                                        |
| A32 | Mobile tab strips cut the last tab (AI → Controls, Health → Usage) with no fade or chevron; measured `scrollWidth 432 vs clientWidth 358`.            |
| A33 | Desktop sidebar is 1,119px tall in a 679px scroller; Feature availability and part of Platform settings sit below the fold with no visible scrollbar. |
| A34 | Long values truncate with no tooltip (`San Fernando · San Fernando, Pam…`, ticket titles on mobile).                                                  |
| A35 | Development/property location repeats the city ("San Fernando · San Fernando, Pampanga").                                                             |
| A36 | Mobile "31" pagination control occupies a full row with no label.                                                                                     |

## Accessibility

| #   | Finding                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A37 | **All five AI tabs carry `aria-current="page"`**, so a screen reader announces every tab as current.                                                                                              |
| A38 | Org hub section rail has no `aria-current`/`aria-selected`; selection is colour only.                                                                                                             |
| A39 | **15 amenity checkboxes on the development editor have no accessible name** (`role="checkbox"` with the label as an unassociated sibling). The whole Amenities section is unusable without sight. |
| A40 | Development photo tiles put five ~24px icon buttons over the image, including "Remove photo" next to "Edit alt text" with no confirmation or undo.                                                |
| A41 | `#fa-off-only` switch has no accessible name (see X/A6 in cross-cutting).                                                                                                                         |

## Confirmed working

- Mobile shell: bottom tabs (Overview / Organizations / Hosts / More) plus a complete More sheet;
  every dialog becomes a bottom sheet at 390px.
- Unsaved-changes guard on Payment settings, Platform settings and the development editor.
- Destructive confirmations name the amount ("Confirms ₱630.00…") and ask for a reference.
- Approval "Request changes" flow: reason checklist, per-document selection, "HOST WILL SEE" preview.
- Support ticket thread, send-disabled-until-text, status and priority selects.
- Feature kill-switch dialog: reason, message counter, expected back date and banner preview.
- Empty states where implemented ("No hosts match your search", "No parking payments in this view").
- No page errors or failing API calls beyond the OTP failure (A6) and the status-endpoint 429 (X5).
  All routes rendered meaningful content in ~2.0-2.6s.

## Coverage

| Route                                   | Desktop | Mobile  | Main issues                     |
| --------------------------------------- | ------- | ------- | ------------------------------- |
| `/admin`                                | yes     | yes     | A4                              |
| `/admin/developments`                   | yes     | yes     | A11, A34, A35                   |
| `/admin/developments/:slug`             | yes     | yes     | A29, A30, A39, A40              |
| `/admin/approvals`                      | yes     | yes     | A2, A11                         |
| `/admin/hosts`                          | yes     | yes     | A15                             |
| `/admin/hosts/:id`                      | yes     | yes     | A15                             |
| `/admin/properties`                     | yes     | yes     | A11, A34, A35                   |
| `/admin/orgs`                           | yes     | yes     | A3, A14                         |
| `/admin/orgs/kame-homes` (8 sections)   | yes     | yes     | A1 (seed), A2, A3, A7, A12, A38 |
| `/admin/support`, `/admin/support/faqs` | yes     | yes     | A18, A11                        |
| `/admin/health` (4 tabs)                | yes     | yes     | A4, A8, A32, A33                |
| `/admin/rate-limits`                    | yes     | yes     | A23                             |
| `/admin/playbook`                       | yes     | yes     | A21                             |
| `/admin/announcements`                  | yes     | yes     | A11, A25                        |
| `/admin/ai` (5 tabs)                    | yes     | yes     | A4, A7, A13, A26, A37, A41      |
| `/admin/audit`                          | yes     | yes     | A1 (seed), A16                  |
| `/admin/ops-reports`                    | yes     | yes     | A17, A31                        |
| `/admin/platform-settings`              | yes     | yes     | A6, A28                         |
| `/admin/feature-availability`           | yes     | yes     | A20, A21, A41                   |
| `/admin/pricing/plans`                  | yes     | yes     | A9, A10, A14, A27               |
| `/admin/pricing/subscriptions`          | yes     | yes     | A10, A24                        |
| `/admin/pricing/payment-settings`       | yes     | not run | A28                             |
| `/admin/parking/payouts`                | yes     | yes     | A5, A22                         |
