---
title: 'Multi-channel calendar sync: live verification after release'
stage: for-testing
status: for-testing
tags: [calendar, channel-sync, agoda, booking-com, airbnb, verification, release]
updated: 2026-11-19
kind: plan
---

# Multi-channel calendar sync: live verification after release

Implementation is **complete and released dark**. What is left is verification against real Agoda and
Booking.com listings and a staged rollout. Plan and design: [`../in-progress/multi-channel-calendar-sync.md`](../in-progress/multi-channel-calendar-sync.md)
(§20 launch checklist, §21 two-way UX).

## What is live after release

- **Airbnb** behaves as before, with the redesigned dialog: each channel is a two-way connection with
  **Get dates from** and **Send dates to** steps, a status of **Two-way**, **Finish setup**, **Needs
  attention** or **Paused**, and Recent activity for both directions.
- **Connecting a channel turns sending on** (`addFeed`), so a new connection is two-way from the start.
- **Agoda and Booking.com are dark.** They are hidden until the edge secret `CALENDAR_CHANNELS_ENABLED`
  lists them (optionally limited by `CALENDAR_CHANNELS_BETA_ORG_IDS`). Clearing the first secret turns
  them off again.
- Migrations `20261343000000` to `20261343001000` (renumbered from `20261342…` after `develop` took those
  versions for billing).

## Open verification

| #   | Item                                      | How to verify                                                                                                                                                                                 | Blocked on                                       | State |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----- |
| V1  | **Sending turns on at connect (hosted)**  | On `kame-test-tenant`, connect Airbnb. Expect **Send dates to channels** on, step 2 showing the link, and one `integrations.config_changed` row with `auto: channel_connected` in the log.    | Nothing                                          | open  |
| V2  | **Rollout secrets on the hosted project** | Set `CALENDAR_CHANNELS_ENABLED=agoda,booking_com` and `CALENDAR_CHANNELS_BETA_ORG_IDS=<kame-test-tenant org id>` (runbook in plan §20). Agoda and Booking.com appear only for that org.       | Supabase access token, or the dashboard          | open  |
| V3  | **Booking.com real feed**                 | Close one date and make one reservation on Booking.com. Capture the sanitized fixture. Fill the Phase 0 sheet S3 to S7, S9 to S11. Decide whether **Create bookings** can default on.         | Host action on Booking.com                       | open  |
| V4  | **Agoda real feed**                       | Once Agoda approves the listing: connect, capture the fixture, set `hostSuffixes` and URL shape, `classifyEventKind('agoda')`, and check S12 (does Agoda mask links in chat, QR fallback).    | Agoda approval (created 2026-11-17, 1 to 3 days) | open  |
| V5  | **Two-way proof per channel**             | For each channel, the row reaches **Two-way**: the channel reads our link (read time shows) and our import is `Synced`. A date blocked in Kame shows on the channel after its refresh window. | V3, V4                                           | open  |
| V6  | **Live QA matrix**                        | Run plan §13 for Airbnb, Agoda, Booking.com and Direct, including relay between channels, echo handling and a cancellation.                                                                   | V3, V4                                           | open  |
| V7  | **Phone check of the dialog**             | On a real phone: list, a connected channel, a not-connected channel, sending off, Recent activity (empty and filled), paste and connect.                                                      | Nothing                                          | open  |
| V8  | **Beta soak**                             | Zero phantom bookings over 7 days on beta orgs, then clear `CALENDAR_CHANNELS_BETA_ORG_IDS`.                                                                                                  | V2 to V6                                         | open  |
| V9  | **Launch copy**                           | Publish the copy list in plan §20 (plan labels, pricing page, FAQs, Host-facing knowledge), then `check:support-content`, `check:ai-knowledge-coverage`, `check:plan-catalog`.                | V8                                               | open  |
| V10 | **Parser-drift probe on `/admin/health`** | Add before general availability. Needs a change to the system-health RPC and a second live channel.                                                                                           | V5                                               | open  |

## Known, not caused by this release

- `hostVerificationStates.spec.ts` ("changes requested forces the modal and allows a resubmit") fails the
  same way on a clean `develop` checkout.
- Locally, a `supabase/.env.local` that enables captcha makes 5 Deno handler tests fail
  (`submit-sd-form`, `submit-form-completion`). Run them with `CAPTCHA_MODE=disabled`. CI is unaffected.
- A local database that already applied the old `20261342…` calendar versions needs a re-migrate or reset
  before it can apply the renumbered files. Hosted is unaffected.

## Roll back

- **Turn the new channels off:** clear `CALENDAR_CHANNELS_ENABLED`. Takes effect on the next invocation.
- **Pause a channel or imports for everyone:** super-admin feature availability keys
  `pricing.channel_sync`, `.import`, `.airbnb`, `.agoda`, `.booking_com`.
- **Stop sending to channels for one property:** the **Send dates to channels** switch.
- **Functions or migrations:** `cd-rollback.yml` (needs `kamewave`).

## Release record

Filled in when released (see the section below).
