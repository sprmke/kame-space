---
title: 'QA — Property Plans & Billing'
status: active
updated: 2026-11-18
---

# 13 — Plans & Billing (property mirror)

Route: `/org/:orgSlug/property/:propertySlug/plans`

## Looks good

- Same UI as org Plans; payment continues at org scope — correct for org-level billing.
- Feature compare matrix groups follow property sidebar order.
- A suspended org keeps its whole dashboard and works like Free; a billing banner (`BillingStatusBanner`) carries the Pay now action for the owner and the "ask the owner" copy for members. The old redirect to Plans (`RequirePropertySubscriptionAccess`) is gone.

## Issues

| Sev | Issue                                                                                                                    | Evidence                               |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| P2  | Property nav “Plans & Billing” may imply per-property pricing — hosts with many units need clearer “this is org billing” | Host lens; org-level billing migration |
| P3  | Local seed all Free — hard to demo upgrade UX without SQL                                                                | QA env                                 |

## Improvements

- Property Plans header: “Organization plan · N properties enrolled”.
- Demo script: seed one org on each tier for QA.

## Doc gaps

- Points to `org/plans.md` — ensure property route README stays linked.

## Evidence

Live Plans title; `BillingStatusBanner`; matrix.
