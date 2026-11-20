---
title: 'Business-logic integrity'
status: active
tags: [workflow, in-progress, production-readiness]
updated: 2026-11-20
stage: in-progress
kind: plan
origin_stage: untracked
readiness: unverified
launch_gate: C
launch_blocker: tbd
last_verified: none
---

# 35 — Business-logic integrity

**🆕** Ledger PR-104. Overlaps docs 19, 21, parking, vouchers.

## Remaining work

| #   | Work                                                    | Owner | State                                                                                       |
| --- | ------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------- |
| 1   | Double-booking race (app today; DB exclusion is PR-032) | agent | ✅ Done 2026-11-20 — DB trigger `trg_guest_submissions_no_overlap`, `test:edge:overlap` 6/6 |
| 2   | Voucher double-claim                                    | agent | open                                                                                        |
| 3   | AI credit wallet race                                   | agent | open                                                                                        |
| 4   | Payment amount tampering (client vs server price)       | agent | open                                                                                        |
| 5   | Workflow transitions out of order                       | agent | open                                                                                        |
| 6   | Asia/Manila midnight + `MM-DD-YYYY` vs `YYYY-MM-DD`     | agent | open                                                                                        |

## Exit gate

- [ ] Concurrent tests or documented residual for each row
