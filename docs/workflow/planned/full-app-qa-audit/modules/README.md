---
title: 'Full-app QA audit: module work packets'
status: planned
stage: planned
kind: reference
tags: [qa, audit, modules]
updated: 2026-11-13
---

# Module work packets

Each file is the briefing for one area. It does **not** replace the element inventory, which is built from the running page and the source in Stage 2 of [`../method.md`](../method.md). It tells the auditor what is special about the area: who uses it, what must be probed beyond the generic lenses, which hidden surfaces sit behind it, and which journeys cross it.

Every probe list here is a floor, not a ceiling. Items marked _(confirm)_ come from docs and were not checked against code while writing this plan.

| File                                                                     | Ledger rows                      | Wave           |
| ------------------------------------------------------------------------ | -------------------------------- | -------------- |
| [`01-public-marketing.md`](./01-public-marketing.md)                     | PUB-01 to PUB-23                 | 2.4            |
| [`02-guest-booking-flows.md`](./02-guest-booking-flows.md)               | GST-01 to GST-13                 | 2.1            |
| [`03-guest-account.md`](./03-guest-account.md)                           | ACC-01 to ACC-09                 | 2.10           |
| [`04-auth-onboarding.md`](./04-auth-onboarding.md)                       | AUTH-01 to AUTH-09               | 2.5            |
| [`05-org-hub.md`](./05-org-hub.md)                                       | ORG-01 to ORG-16                 | 2.8            |
| [`06-property-bookings-workflow.md`](./06-property-bookings-workflow.md) | PROP-01 to PROP-03               | 2.2            |
| [`07-property-money.md`](./07-property-money.md)                         | PROP-04 to PROP-06, ORG-06       | 2.3            |
| [`08-property-comms.md`](./08-property-comms.md)                         | PROP-07 to PROP-09               | 2.6            |
| [`09-property-growth-and-config.md`](./09-property-growth-and-config.md) | PROP-10 to PROP-20               | 2.7            |
| [`10-parking.md`](./10-parking.md)                                       | PARK-01 to PARK-12               | 2.9            |
| [`11-super-admin.md`](./11-super-admin.md)                               | ADM-01 to ADM-24                 | 2.11           |
| [`12-cross-cutting.md`](./12-cross-cutting.md)                           | XC-01 to XC-15, RED-01 to RED-06 | Phases 4 and 5 |

## Shared module rule

Finance, activity, announcements, help-support, inbox, notifications, team and pricing exist at more than one level (org, property, parking). Audit the property instance in full, then audit each other level as a **delta**: same inventory, re-verified at that level, plus everything that differs (scope, permissions catalog, rollup math, nav, empty states). Never mark a second level `pass` by reference to the first without running it; parking in particular has had the least test attention.
