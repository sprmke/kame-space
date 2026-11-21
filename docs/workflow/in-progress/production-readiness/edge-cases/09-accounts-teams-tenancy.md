---
title: 'Edge cases: accounts, teams and tenancy'
status: active
tags: [workflow, in-progress, production-readiness, edge-cases, multi-tenancy, accounts]
updated: 2026-11-21
stage: in-progress
kind: plan
readiness: untracked
launch_gate: B
launch_blocker: tbd
last_verified: none
---

# Accounts, teams and tenancy (`ACC`)

**Owned elsewhere:** data-subject export and delete (ledger PR-145, checklist 31); property archive and delete ([`property-archive-and-delete-lifecycle.md`](../../property-archive-and-delete-lifecycle.md)); RBAC matrix and invite abuse (PR-014, PR-064).

## How it works today

- One owner per org (`organizations.owner_id`). `delete-organization` is owner-only and blocked when any booking exists.
- No ownership transfer path was found in the edge functions or UI.
- No self-service account deletion endpoint was found (only test helpers call `auth.admin.deleteUser`).

## Gaps

| ID     | Scenario                                                                                              | Today                                                                                                                                                                                     | Target                                                                                                                                                                                                  | Sev | Tag |
| ------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| ACC-01 | Guest asks to delete their account with an upcoming stay or a refund still pending                    | No delete path (PR-145)                                                                                                                                                                   | When PR-145 lands: delete is blocked until upcoming stays end and refunds are `sent` / `not_due`, or the guest confirms cancelling them. Financial rows keep a pseudonymous guest reference             | P1  | 🧭  |
| ACC-02 | Org owner wants to hand the business to someone else, or leaves                                       | **Confirmed.** No transfer                                                                                                                                                                | Owner transfers to an existing org admin with email confirmation from both; billing contact, payout destination and Telegram routing are re-confirmed by the new owner                                  | P1  | 🆕  |
| ACC-03 | Owner is locked out (lost email access, passed away, unreachable) with guests arriving                | Support only                                                                                                                                                                              | Super-admin recovery runbook with identity checks; org admins can keep running bookings while the owner is unreachable (verify which actions are owner-only)                                            | P1  | 🟡  |
| ACC-04 | Team member removed while assigned to maintenance tasks, open chats or a pending cancellation request | Not verified                                                                                                                                                                              | Removal lists their open items and reassigns them to the owner by default; notification routing is cleaned up in the same write (MSG-06)                                                                | P2  | 🟡  |
| ACC-05 | Property moves to another org (sold, new manager) with upcoming bookings                              | No transfer path found                                                                                                                                                                    | Super-admin assisted transfer: bookings, policy snapshots, refunds and chat history move with the property; guests get an email naming the new host; old org keeps read-only finance history            | P1  | 🧭  |
| ACC-06 | Host edits the property address, unit or check-in time after guests booked                            | Live settings feed the stay guide and emails                                                                                                                                              | Address, unit or check-in time changes with upcoming stays show "N guests will be told" and email them; check-in time change re-checks cancellation deadlines (snapshot keeps the policy, not the time) | P1  | 🆕  |
| ACC-07 | Guest typed the wrong email at booking                                                                | Host can edit `guest_email`                                                                                                                                                               | Changing the guest email offers "Resend booking emails" (acknowledgement, trip link) and records the change in the activity log                                                                         | P2  | 🟡  |
| ACC-08 | Org verification or listing authorization is revoked while bookings are upcoming                      | Not verified                                                                                                                                                                              | Revocation lists upcoming stays and asks super-admin to choose: honour, or cancel as host with full refund (same flow as CAN-13)                                                                        | P1  | 🟡  |
| ACC-09 | Support or developers fix these cases by running SQL on production                                    | No admin tools for most of the rows above                                                                                                                                                 | Every manual fix in this register gets a super-admin action with a reason and an audit row, so nobody edits production data by hand                                                                     | P2  | 🆕  |
| ACC-10 | Same person is a host in one org and a guest in another                                               | Separate guest and admin identities by design                                                                                                                                             | Verify a host booking a stay elsewhere cannot see that org's data through the guest portal, and that their guest reviews are not tied to their host profile                                             | P2  | 🟡  |
| ACC-11 | Host's sublease or authorization contract ends before a booked stay                                   | **Confirmed.** `contractExpiryCron.ts` sets the listing `INACTIVE` with `contract_lapsed`; nothing checks booked nights against the contract end date (`submit-form`, availability, cron) | Block nights after the contract end date. At lapse, list upcoming stays past the end for the host and super-admin to decide: honour through the unit owner, or cancel as host with a full refund        | P0  | 🆕  |

## Decisions needed (Phase 0)

1. Ownership transfer: self-service or super-admin assisted only.
2. Property transfer between orgs: supported for launch, or support-only runbook.
