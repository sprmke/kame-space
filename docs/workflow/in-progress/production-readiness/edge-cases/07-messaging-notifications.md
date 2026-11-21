---
title: 'Edge cases: messaging and notifications'
status: active
tags: [workflow, in-progress, production-readiness, edge-cases, notifications, inbox]
updated: 2026-11-21
stage: in-progress
kind: plan
readiness: untracked
launch_gate: E
launch_blocker: tbd
last_verified: none
---

# Messaging and notifications (`MSG`)

**Owned elsewhere:** guest push milestones (J2), anonymous guest push (J1), SMS / WhatsApp (J5) in [`guest-journey-followups.md`](../../../planned/guest-journey-followups.md); email deliverability (PR-073, checklist 32); Meta token expiry (PR-072); real-device push QA (PR-074); inbox sync ([`guest-inbox-meta-sync-overhaul.md`](../../guest-inbox-meta-sync-overhaul.md)).

The theme here: **for every event that moves money or dates, the guest must be reached on at least one channel, and the host must know if they were not.**

## How it works today

- Guest push only fires for `PENDING_DOCUMENTS` and `READY_FOR_CHECKIN` (`_shared/guestPush.ts`).
- Cancellation sends an email to the guest (`booking_cancelled_guest`) and, for guest-initiated cancels, an in-app notice to the host. Nothing is posted in the booking chat.
- `emailService.ts` skips guests on the bounce / complaint suppression list (`emailSuppression.ts`). Failed workflow emails are surfaced on the booking (#157).

## Event coverage matrix (target)

Build this as a test table: each event lists the channels that must fire. Today's state is from code reading and needs one pass to confirm.

| Event                                 | Guest email | Guest push | Booking chat note | Host in-app | Today (gap)                                       |
| ------------------------------------- | ----------- | ---------- | ----------------- | ----------- | ------------------------------------------------- |
| Host cancelled                        | yes         | yes        | yes               | n/a         | Email only, and the host can turn it off (CAN-02) |
| Guest cancelled / requested           | yes         | yes        | yes               | yes         | Email + host in-app; no push, no chat note        |
| Request expired (host never answered) | yes         | yes        | yes               | yes         | Verify                                            |
| Request declined                      | yes         | yes        | yes               | n/a         | Verify                                            |
| Rescheduled by host                   | yes         | yes        | yes               | n/a         | None (STAY-02)                                    |
| Rate or fees changed                  | yes         | yes        | yes               | n/a         | None (STAY-02)                                    |
| Refund marked sent                    | yes         | yes        | no                | n/a         | Email (cancellation plan §4.9); no push           |
| Refund overdue                        | status page | no         | no                | yes         | Host reminder only (PAY-02)                       |
| Linked parking cancelled              | yes         | yes        | yes               | yes         | Partial (parking hardening M-1)                   |
| Payment destination changed           | yes         | no         | no                | yes         | None (PAY-09)                                     |

## Gaps

| ID     | Scenario                                                                                                                                               | Today                                                                                                                                                                                                              | Target                                                                                                                                                      | Sev | Tag |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| MSG-01 | Host cancels; guest does not check email                                                                                                               | **Confirmed.** No push for `CANCELLED`, no chat note                                                                                                                                                               | Add `CANCELLED` to guest push (extends J2) and post a system message in the booking chat with the reason and refund status                                  | P0  | 🆕  |
| MSG-02 | Guest's email is suppressed (bounced) when a cancellation or refund email should go                                                                    | Send is skipped silently                                                                                                                                                                                           | A skipped guest-critical email shows "Guest not reached by email" on the booking with the guest's phone and a chat shortcut; logged as a failed side effect | P1  | 🟡  |
| MSG-03 | OTA booking with no guest email yet (form completion pending)                                                                                          | Guest emails suppressed (cancellation plan E44)                                                                                                                                                                    | Host is told on cancel / reschedule that the guest must be informed on the OTA channel, with a copy-ready message                                           | P2  | 🆕  |
| MSG-04 | Booking chat stays open after cancellation                                                                                                             | Not verified                                                                                                                                                                                                       | Chat stays open for 30 days after cancel (refund questions), then read-only. Same after check-out                                                           | P2  | 🟡  |
| MSG-05 | Guest messages and the host never replies before arrival                                                                                               | No response-time tracking found for direct chat                                                                                                                                                                    | 12h unanswered message inside 48h of check-in alerts the owner and org admins; 24h alerts super-admin (feeds host reliability)                              | P1  | 🆕  |
| MSG-06 | Team member removed but still receives Telegram / email / push for the property                                                                        | Push recipients follow current membership (`pushRecipients.ts`). Telegram goes to group chats that are not tied to membership, so a removed member still in the group keeps seeing guest names and booking details | Removing a member shows which Telegram chats they can still read and prompts the host to remove them; email recipient lists are cleaned in the same write   | P1  | 🟡  |
| MSG-07 | Notification times shown in the reader's time zone, not Manila                                                                                         | Rule: all user-visible times are Asia/Manila                                                                                                                                                                       | Verify push and email bodies format in Manila (foreign guests' devices may show local time for timestamps)                                                  | P2  | 🟡  |
| MSG-08 | Guest uses two emails (booked with one, signed in with another)                                                                                        | `linkGuestBookingsByEmail` links by email only                                                                                                                                                                     | Trip page offers "Find my booking" by reference + phone, then sends a link to the booking email                                                             | P2  | 🆕  |
| MSG-09 | Critical guest emails depend on one provider (Resend)                                                                                                  | Resend failure surfaced (#157)                                                                                                                                                                                     | For cancellation and refund events, a second channel (push or SMS when J5 ships) is attempted when email fails                                              | P2  | 🆕  |
| MSG-10 | Host muted the bookings group or set quiet hours, and an urgent guest event arrives at night (arrival problem, same-day request, cancellation request) | **Confirmed.** `notificationPreferences.ts` filters OS push by muted group and quiet hours with no urgent bypass                                                                                                   | Urgent types (SAFE-01 issues, check-in within 24h, cancellation requests inside 48h) bypass mutes and quiet hours; settings say so                          | P1  | 🆕  |

## Tests to add

- Deno table test: for each event in the matrix, the orchestrator records the expected side effects.
- Deno: suppressed guest email on cancel records `email:booking_cancelled_guest` as skipped with a reason the UI can show.
