---
title: 'Multi-channel calendar sync: Agoda and Booking.com for Philippine hosts'
status: in-progress
tags:
  [workflow, in-progress, calendar, integrations, airbnb, agoda, booking-com, ical, channel-sync]
updated: 2026-11-19
stage: in-progress
kind: plan
---

# Multi-channel calendar sync: Agoda and Booking.com

> **Released dark 2026-11-19** (backend PR #493, UI PR #524). Implementation is complete. What remains is live verification and the staged
> rollout, tracked in [`../for-testing/multi-channel-calendar-sync-live-verification.md`](../for-testing/multi-channel-calendar-sync-live-verification.md).

> **Revised 2026-11-16 (execute-plan):** audited against `develop` before building.
>
> - **Ordering:** the hard prerequisite (conflict plan Phase 1) is **not shipped** —
>   `classifyCalendarOverlap`, `ota_block` and the `duplicate_feed` guard do not exist in the
>   codebase. Phase 1 is split into **1a** (channel-agnostic, no conflict dependency) and **1b**
>   (conflict-integrated: relay activation, echo detection, classifier channel input), which
>   starts only after conflict plan Phase 1 lands.
> - **Phase 0 is externally blocked:** an agent cannot create or connect Agoda or Booking.com
>   listings. It needs host-supplied listings on the test tenant.
> - **Drift:** per-channel kill switches are **new** children under the existing
>   `pricing.channel_sync` key (the existing child is `pricing.channel_sync.import`, there is no
>   `pricing.channel_sync.airbnb`). `validateAirbnbCalendarUrl` is the real client symbol.
>   `classifyEventKind` already takes a provider argument, so the registry refactor is smaller
>   than §4.2 implies.
> - **Sequencing:** bounded concurrency (G9) and relay rule 3 move to 1b. With one channel live,
>   concurrency buys nothing and relay would change Airbnb export behaviour before echo detection
>   exists.
> - Added [§18 Execution decisions](#18-execution-decisions-execute-plan) and per-phase
>   acceptance commands.

> **Scope decision 2026-11-17 (owner):** Kame Space supports **only Airbnb, Agoda and Booking.com**.
> Vrbo, Tiket.com and "Other calendar link" are removed, not deferred: they are the only platforms
> that matter to Philippine hosts, and an allowlist-only fetch surface is safer. Every mention of
> Vrbo or Other below is historical; the code, registry, UI, `?as=` links and CHECK constraints
> (migration `20261343001000`) no longer accept them. See X15.

> **Revised 2026-11-17 (production-readiness pass):** the other session's uncommitted
> `ChannelSyncDialog.tsx` and `GuestForm.tsx` work is no longer pending, so the blocked Phase 2
> items shipped dark: the multi-channel Channel sync UI, per-channel guest-form labels, the
> remaining Airbnb-only money and label sites, and a runtime rollout gate (X11). What is left is
> in [§20](#20-launch-checklist-what-is-left). Nothing else blocks a **dark** deploy.

Follow-up to the shipped [`../done/airbnb-calendar-sync.md`](../done/airbnb-calendar-sync.md).
Hard dependency: Phase 1 of [`calendar-sync-conflict-resolution.md`](./calendar-sync-conflict-resolution.md)
(see [§11](#11-phases-and-sequencing)). That dependency gates **Phase 1b**, not 1a.

## Goal

A Philippine host lists one unit on Airbnb, Agoda and Booking.com and takes direct bookings in
Kame Space. A booking or cancellation on any one of them should block or free those nights on all
the others automatically, and show up in Kame Space as a booking. Kame Space becomes the hub: each
channel talks only to Kame Space, never to each other. Airbnb already works this way. This plan
adds **Agoda** and **Booking.com** on the same engine, fixes the gaps that only show up once there
is more than one channel, and leaves a costed, decision-gated path for the channels that have no
calendar link (Traveloka, Trip.com).

---

## 1. Verdict: is it doable?

**Yes for Agoda and Booking.com, with no partnership or approval.** Both offer the same iCal
calendar links Airbnb does, which is what the shipped engine already speaks. **Not doable for
Traveloka or Trip.com** without paying for a certified channel-manager API (Tier 3, [§15](#15-tier-3-track-channel-manager-api-decision-gated)).
Real-time sync, guest names, prices and messages are Tier 3 only on every channel.

| Platform                            | PH host relevance                       | Calendar link (iCal)                                                                                                                                                                                       | Official API for us                                                                                        | Verdict                                       |
| ----------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Airbnb                              | Largest STR channel                     | Yes, shipped                                                                                                                                                                                               | Closed: "not accepting new access requests for our API" (secondhand, 2026)                                 | Shipped. Generalize                           |
| **Agoda** (Agoda Homes and Partner) | Major in PH and SEA                     | **Yes.** Calendar → Calendar connections: copy Agoda's link, import other links. Only for room types with **exactly 1 room**. "Automatically refresh several times a day", plus a manual Refresh           | YCS API for certified connectivity partners (self-certification, then a pilot). Built for channel managers | **Build (Phase 2)**                           |
| **Booking.com**                     | Major                                   | **Yes, for eligible accounts.** Rates & Availability → Sync calendars. Export option: **only reserved dates** or **reserved and closed dates**. Imported links are removed when a channel manager connects | Connectivity Partner onboarding reported paused                                                            | **Build (Phase 3)**                           |
| Vrbo                                | Small in PH                             | Yes                                                                                                                                                                                                        | Expedia partner program                                                                                    | **Not supported** (owner decision 2026-11-17) |
| Traveloka                           | Big for hotels in SEA, smaller for STRs | **No confirmed native link.** Vendors call it "limited and inconsistent, so don't use it"                                                                                                                  | Channel manager only (Channex lists Traveloka)                                                             | **Tier 3 only**                               |
| Trip.com                            | Growing                                 | **None found.** Connects through a channel-manager API, and connecting resets its calendar                                                                                                                 | Channel manager only                                                                                       | **Tier 3 only**                               |
| Tiket.com                           | Indonesia first                         | Yes, for entire-place villas and apartments                                                                                                                                                                | No                                                                                                         | **Not supported** (owner decision 2026-11-17) |
| Direct (Facebook, Messenger, site)  | Core                                    | Kame Space is the hub                                                                                                                                                                                      | N/A                                                                                                        | Already the source of truth                   |

Limits that apply to every iCal channel, already true for Airbnb and surfaced in the UI:

1. **Dates only.** No guest name, email, phone, price or messages. Imported bookings get a
   placeholder name and the host forwards the guest-form link.
2. **Polling delay.** Each side reads the other on its own schedule (Kame every 30 min after G8 is
   fixed; Agoda "several times a day"; Airbnb roughly every few hours). A double booking is
   possible inside that window. We detect and flag it, never silently resolve it.
3. **No cancellation event.** A cancelled stay just disappears from the next pull. Snapshot diff
   plus the existing empty-feed guards handle it.

Facts still unconfirmed that Phase 0 must settle with real links (no public docs exist): Agoda's
link host and event format, whether Booking.com UIDs stay stable, whether Agoda's export echoes
imported nights, and whether Agoda masks our guest-form link in its chat. See [§12.1](#121-phase-0-spike-checklist-real-links).

---

## 2. What exists and what blocks multi-channel

The engine was built channel-agnostic: `provider` allowed `airbnb | booking_com | vrbo | other` when written (now narrowed to `airbnb | agoda | booking_com`),
there is a per-provider export URL (`?as=<provider>`) with loop prevention, and a host allowlist for
Booking.com and VRBO. The gaps are in what was only ever exercised with Airbnb.

| #   | Gap                                                                                                                                                                                                                                                                                                             | Where                                                                                                                                                                 | Impact if we just "turn on" Agoda                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G1  | `addFeed` rejects every provider except Airbnb                                                                                                                                                                                                                                                                  | `supabase/functions/calendar-sync-settings/index.ts:233-238`                                                                                                          | Cannot connect                                          |
| G2  | No `agoda` provider. CHECKs on `property_calendar_feeds.provider` and `guest_submissions.external_source`, `CalendarFeedProvider`, `ical-export` `PROVIDERS`, `CalendarExportUrlMap`                                                                                                                            | `20261213120000_…feeds.sql`, `20261214120000_…external_bookings.sql`, `_shared/calendarSyncService.ts:13`, `ical-export/index.ts:34`, `_shared/calendarExportUrls.ts` | Cannot store                                            |
| G3  | Every ingested booking is written as `booking_source='Airbnb'`, `find_us='Airbnb'`, name `Airbnb guest`, toast "Airbnb calendar sync updated bookings", whatever the provider                                                                                                                                   | `_shared/calendarSyncRun.ts:984`, `:1087`, `:1120-1148`                                                                                                               | Agoda stays labelled Airbnb everywhere                  |
| G4  | Booking-source vocabulary is `Direct / Facebook / Airbnb`. `normalizeBookingSource` turns anything else into `Direct`, so an Agoda booking **becomes Direct on the first admin save**. CSV import has the same list                                                                                             | `ui/.../guest/form/lib/bookingSourceFromSearchParams.ts:6-33`, `BookingEditForm.tsx:144,207,452`, `GuestIdentityTab.tsx:362`, `_shared/importNormalization.ts:25`     | Silent data loss, wrong money rules after edit          |
| G5  | "Paid through the channel" money rules (no DP/SD, balance excludes the rate, "Stay paid through Airbnb", receipt AI skipped) key on `isAirbnbBookingSource`, which exists in **3 copies**                                                                                                                       | `_shared/totalGuestBalance.ts:22`, `_shared/externalBookingIngest.ts:26`, `ui/.../bookings/lib/totalGuestBalance.ts:13`, ~12 callers                                  | Agoda guests asked for a down payment they already paid |
| G6  | **Imported blocks are never exported.** With **Create bookings** off, an Airbnb reservation exists only as an `ical_import` block and never reaches Agoda or Booking.com. The hub does not relay                                                                                                                | `_shared/calendarSyncRun.ts` `loadExportRanges` (~`:66-119`)                                                                                                          | **Double bookings across channels**                     |
| G7  | Booking.com's feed labels everything `CLOSED - Not available`. With **Create bookings** on, every event is treated as a reservation. If the host exports "reserved and closed", our own exported nights come back as **phantom placeholder bookings**                                                           | `_shared/calendarSyncService.ts:150-152`                                                                                                                              | Fake bookings, fake conflicts                           |
| G8  | Cron runs `*/30` with a 30 min minimum interval and a strict `last_attempted_at < now − 30m` claim. A feed claimed a few seconds into a sweep fails the claim at the next sweep, so **most feeds likely sync every 60 min**, while the UI says 30. Unchanged runs write nothing, so it cannot be measured today | `_shared/calendarSyncRun.ts:203-216`, `20261213120500_calendar_sync_cron.sql`, `ChannelSyncDialog.tsx:446`                                                            | Double-booking window twice what we tell hosts          |
| G9  | Sweep is **sequential**: up to 100 feeds, 55 s budget, one at a time                                                                                                                                                                                                                                            | `calendar-sync-cron/index.ts:40`, `:~180`                                                                                                                             | Three channels per property cuts capacity by 3x         |
| G10 | One `last_served_at` per property, stamped only on 200 (most channel reads are 304s). We cannot tell which channel reads its link, or whether Agoda reads it at all (conflict plan F13)                                                                                                                         | `ical-export/index.ts:153`                                                                                                                                            | Host cannot confirm Agoda is blocking direct bookings   |
| G11 | No feed cap per property. `calendar_sync_events` retention was planned and never scheduled                                                                                                                                                                                                                      | `calendar-sync-settings/index.ts`, `20261213120200_calendar_sync_events.sql`                                                                                          | Unbounded rows, abuse surface                           |
| G12 | One Airbnb-labelled kill switch. Super admin cannot pause a single channel if its feed format changes                                                                                                                                                                                                           | `_shared/featureAvailabilityCatalog.ts:54,118-134` + UI mirror                                                                                                        | One bad channel forces pausing all                      |
| G13 | Host UI, client URL check and copy are Airbnb-only                                                                                                                                                                                                                                                              | `ui/.../pricing/components/ChannelSyncDialog.tsx`, `pricing/lib/calendarSyncApi.ts:159-207`                                                                           | No UI                                                   |
| G14 | Guest-form completion labels are Airbnb-only ("Airbnb Name", "Message host via Airbnb")                                                                                                                                                                                                                         | `GuestForm.tsx:178-205`, `get-form-completion/index.ts:54`, `submit-form-completion/index.ts:117`                                                                     | Wrong copy for Agoda guests                             |
| G15 | No Channel sync E2E spec. No captured real Agoda or Booking.com fixtures                                                                                                                                                                                                                                        | `ui/e2e/features/` (no `pricing/`), no `_shared/__fixtures__/calendar/`                                                                                               | Untested                                                |

---

## 3. Scope

### In scope

- Agoda and Booking.com import (their link into Kame Space) and export (Kame Space link into them).
- Hub relay: a reservation from any channel blocks every other channel ([§4.3](#43-relay-rules-what-each-channel-link-publishes)).
- Provider-aware ingestion: correct `booking_source`, placeholder names, codes, labels.
- One booking-channel vocabulary and one "paid through the channel" rule across edge and UI.
- Echo detection so a channel repeating our own nights back never creates bookings or alarms.
- Per-channel export read health ("Agoda last read your link 40 min ago").
- Sync cadence fix, bounded concurrency, feed cap, retention, run log.
- Per-channel kill switches and staged rollout.
- Host UI for several channels, guest-form copy per channel, help content, tests, docs.

### Out of scope

- Pushing rates, minimum stay or restrictions (impossible over iCal).
- Guest PII, messages, payouts (Tier 3).
- Traveloka and Trip.com (Tier 3, [§15](#15-tier-3-track-channel-manager-api-decision-gated)).
- "Guest pays at the property" money mode for Booking.com and Agoda (decision D3; deferred).
- Parking calendar sync (property-only, same as today).
- Auto-resolving double bookings (human decides, conflict plan principle 1).
- Multi-room room types on Agoda or multi-unit Booking.com listings (iCal is single-unit by design).

---

## 4. Design

### 4.1 Hub and spoke

```text
            Airbnb ──export──▶ ┌──────────────┐ ──as=airbnb──────▶ Airbnb
             Agoda ──export──▶ │  Kame Space  │ ──as=agoda───────▶ Agoda
       Booking.com ──export──▶ │  (the hub)   │ ──as=booking_com─▶ Booking.com
                               └──────────────┘
                 Direct bookings, manual blocks live here
```

- Each channel imports **only its own** Kame Space link. Kame Space imports each channel's link.
- **No direct links between channels.** An Airbnb link pasted into Agoda and Agoda's into Airbnb
  creates echo loops and duplicate imports. The setup checklist tells the host to remove them.
- **Block dates in Kame Space, not in a channel.** Channel-side blocks look identical to echoes,
  so they are never relayed ([§4.3](#43-relay-rules-what-each-channel-link-publishes)).

### 4.2 Channel registry (one place for channel facts)

New pure module `supabase/functions/_shared/calendarChannels.ts`, hand-mirrored at
`ui/src/features/dashboard/pricing/lib/calendarChannels.ts` with a parity test (same pattern as
`featureAvailabilityParity.test.ts`). Everything channel-specific reads from it, so adding Vrbo
later is one entry plus fixtures.

| Field                     | Airbnb                                  | Agoda                            | Booking.com                                   |
| ------------------------- | --------------------------------------- | -------------------------------- | --------------------------------------------- |
| `key`                     | `airbnb`                                | `agoda`                          | `booking_com`                                 |
| `label`                   | Airbnb                                  | Agoda                            | Booking.com                                   |
| `bookingSource` (stored)  | `Airbnb`                                | `Agoda`                          | `Booking.com`                                 |
| `hostSuffixes`            | existing list                           | from Phase 0 (start `agoda.com`) | `booking.com` (covers `admin.`, `ical.`)      |
| `urlShape`                | `/calendar/ical/<id>.ics`               | from Phase 0                     | `…/ical.html?t=` or `/v1/export?t=`           |
| `classify(summary, desc)` | `Reserved` = reservation                | from Phase 0 fixtures            | all events reservation-like (needs echo rule) |
| `uidStrategy`             | `provider`                              | from Phase 0                     | from Phase 0 (`provider` or `dateRange`)      |
| `parseReservationCode`    | `HM…` from URL                          | from Phase 0 (Agoda booking id?) | none expected                                 |
| `reservationUrl`          | yes                                     | from Phase 0                     | none expected                                 |
| `placeholderName`         | `Airbnb <code>` / `Airbnb guest ··1234` | `Agoda <code>` / `Agoda guest`   | `Booking.com guest`                           |
| `otaCollectsPayment`      | true                                    | true (D3)                        | true (D3)                                     |
| `createBookingsDefault`   | true                                    | true                             | true, with echo rule + setup check            |
| `importRefreshCopy`       | "every few hours"                       | "several times a day"            | from Phase 0 measurement                      |
| `setupSteps` (help copy)  | existing                                | Calendar → Calendar connections  | Rates & Availability → Sync calendars         |
| `availabilityKey`         | `pricing.channel_sync.airbnb`           | `pricing.channel_sync.agoda`     | `pricing.channel_sync.booking_com`            |

`availabilityKey` values are **new** children under the existing `pricing.channel_sync` parent
(`pricing.channel_sync.import` stays as the sweep/connect gate). Adding them means both
`featureAvailabilityCatalog.ts` copies, the `FEATURE_AVAILABILITY_KEYS` list and the parity test.
`pricing.channel_sync` keeps its current meaning (whole-module pause).

`classifyEventKind` already takes a provider argument, so the registry refactor is a
data move, not a signature change. Airbnb behaviour stays byte-identical (regression suite in
[§12](#12-test-plan)).

### 4.3 Relay rules (what each channel link publishes)

`loadExportRanges(property, as=P)` publishes, all as opaque `Booked` / `Blocked` with zero PII:

1. Kame Space bookings not `CANCELLED` / `IMPORTED` whose `external_source ≠ P` (today's rule).
2. Manual blocks (today's rule).
3. **New:** imported blocks with `external_kind = 'reservation'` from feeds whose provider `≠ P`,
   skipped when a live booking already carries the same `(feed_id, external_uid)` (avoids
   publishing one stay twice). Closes G6.

Never published: imported `block`-kind events from any channel (host blocks, prep time and echoes
are indistinguishable), and anything that came from `P` itself.

The `all` link (no `as`) keeps today's meaning for calendar apps, plus rule 3.

### 4.4 Echo detection

An echo is a channel repeating nights we told it about. Without a rule, Booking.com echoes become
fake bookings (G7), and every channel's echoes become fake conflicts (conflict plan F4).

- `ical-export` records what it served, per property and channel, in `calendar_export_reads`
  (only when the content hash changes; otherwise it bumps `last_read_at`). See [§5](#5-data-model-migrations).
- Pure rule `isExportEcho(event, servedRanges)` in `_shared/calendarEchoRules.ts`: an imported
  event is an echo when its occupied range is **fully covered** by the union of ranges served to
  **that** channel in the last **72 h**, and the channel cannot prove it is a reservation (Airbnb
  `Reserved` with an `HM` code is proof; Booking.com has no proof).
- The 72 h window handles the "ghost" case: a Kame booking is cancelled, the channel has not
  re-read our link yet, and still exports those nights for a while.
- Echoes still block availability (as `ical_import` blocks, `external_kind='block'`). They never
  create bookings, never raise conflicts, never relay. Logged as `skipped` with
  `detail.reason='export_echo'`.
- **Booking.com setup check:** if two or more events in one pull exactly match ranges we served,
  the host almost certainly picked "reserved and closed dates". Show a health warning on that
  channel: "Booking.com is sending back closed dates. In Sync calendars, export reserved dates
  only." Dismissed automatically once a pull has no exact matches.
- A real Booking.com reservation fully inside nights we already published as busy is a race the
  channel lost. Those nights are already held in Kame Space, so nothing is double sold here. The
  conflict engine still sees the Kame side and the channel side; the rule only stops it from also
  creating a placeholder booking. Accepted trade-off, documented in support content.

### 4.5 Event identity

The diff engine depends on UIDs staying the same between pulls. Airbnb's do. Booking.com's and
Agoda's are unverified. Phase 0 records UIDs over 3+ pulls in 24 h and across a date change.

- `uidStrategy: 'provider'`: use the VEVENT `UID` (today).
- `uidStrategy: 'dateRange'`: if UIDs change every pull, use `sha256(provider|start|end)`. A date
  change then looks like cancel + new. The reconcile pass treats "one removed, one added, overlap
  ≥ 1 night, same pull" as a reschedule so the booking row moves instead of being cancelled.
  Only built if Phase 0 shows it is needed.

### 4.6 One booking-channel vocabulary

New `_shared/bookingChannel.ts` + UI mirror `ui/src/lib/bookingChannel.ts` (parity test):

- `BOOKING_SOURCES = ['Direct', 'Facebook', 'Airbnb', 'Agoda', 'Booking.com', 'Vrbo']`.
- `canonicalBookingSource(raw)`: trims, case-folds, maps aliases (`booking`, `booking_com`,
  `bookingcom`), and **keeps unknown values as-is** instead of collapsing to `Direct`. Replaces
  `normalizeBookingSource` (G4).
- `isOtaPrepaidSource(source)`: true for Airbnb, Agoda, Booking.com, Vrbo. Replaces all three
  `isAirbnbBookingSource` copies, which are **deleted** so `type-check` finds every caller.
- `channelLabel(source)`: display label, reused by analytics (`analyticsChannel.ts` already maps
  `agoda` and `booking.com`).

Call-site sweep (from `grep "'Airbnb'\|isAirbnbBookingSource"`, 52 files):

| Class                                       | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Change** (channel-generic money or label) | edge: `calendarSyncRun.ts`, `externalBookingIngest.ts`, `totalGuestBalance.ts`, `propertyTemplateEmailSections.ts`, `bookingDetailsPatch.ts`, `guestFormCompletion.ts`, `importNormalization.ts`, `databaseService.ts`, `guestContactInfo.ts`, `guestTrip.ts`, `guestReviewEligibility.ts`, `telegramAdmin.ts`, `telegramChat.ts`, `propertyTemplatePlaceholders.ts`, `submit-form`, `get-form-completion`, `submit-form-completion`, `issue-guest-form-completion-token`, `dashboardAssistantOpsTools.ts`. UI: `GuestForm.tsx`, `bookingSourceFromSearchParams.ts`, `findUsOptions.ts`, `bookingFormatter.ts`, `ReviewPricingForm.tsx`, `BookingPricingSummary.tsx`, `BookingEditForm.tsx`, `StayDetailsTab.tsx`, `GuestIdentityTab.tsx`, `bookingPricingRows.ts`, `bookingFinance.ts`, `totalGuestBalance.ts`, `BookingDetailHeader.tsx`, `BookingDetailMobileSummary.tsx`, `calendarSyncApi.ts`, `ChannelSyncDialog.tsx`, `importCsvTemplate.ts`, `telegramPreviewSamples.ts`, `telegramPlaceholderGroups.ts`, `propertyTemplatePlaceholders.ts`, pricing calendar imported tooltip |
| **Leave** (genuinely Airbnb the brand)      | social links and profile (`socialPlatform.ts`, `socialPlatformTypes.ts`, `propertySocialLinks.ts`, `OrgProfileSettingsSections.tsx`, `HostPublicSocialLinks.tsx`), external reviews (`propertyExternalReviews.ts`, `PropertyReviews.tsx`, `marketingGuestReview.ts`), `orgVerification.ts`, `SuperAdminApprovalDialogLayout.tsx`, `inboxFormat.ts`, `SceneMoney.tsx`, `mockData.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Each "change" file is re-read during Phase 1 to confirm the class; the list is a starting point.

The guest form gains `?source=agoda` and `?source=booking` (labels only, same 4-step flow as
Airbnb). `booking-workflow.mdc` "Airbnb source behavior" becomes "OTA-prepaid source behavior"
with the same six rules.

### 4.7 Guest-form completion per channel

Same token flow as Airbnb (`issue-guest-form-completion-token` → `get-form-completion` →
`submit-form-completion`). Changes:

- Labels from the registry: "Name on your Agoda booking", "Message your host in Agoda".
- `get-form-completion` returns `channel` so the form never falls back to `'Airbnb'`.
- **Delivery risk:** a channel-manager vendor reports that Agoda masks URLs in messages sent through
  its virtual email. If Phase 0 confirms our link is masked in Agoda chat, the copy-link action
  for Agoda bookings shows: "Agoda hides links in chat. Share this QR at check-in or send it on
  WhatsApp." plus a QR (reuse the existing QR component used for the stay guide, verify in
  Phase 2). An "Email the link" action to a relay address the host pastes is decision D6.

### 4.8 Cadence and scale

- **Claim slack (G8):** claim when `last_attempted_at < now − (minInterval − 2 min)`, so a feed
  synced at `:00:07` is claimable at `:30:00`.
- **Cron every 10 min** (`*/10`), minimum interval stays 30 min. Each tick only takes due feeds,
  so load spreads instead of spiking at `:00` and `:30`.
- **Bounded concurrency (G9):** a pool of 4 workers across properties; feeds of the **same
  property run one after another** (two feeds of one property race on adoption, relink and conflict
  evaluation otherwise). `loadDueCalendarFeeds` filters `last_attempted_at < cutoff` in SQL
  instead of loading 100 and failing claims.
- **Capacity check:** at ~1.5 s per feed, 4 workers and 50 s budget is ~130 feeds per tick,
  ~780 per hour. With a 30 min interval that covers ~390 feeds (≈130 properties with 3 channels)
  per worker pool. Most runs are 304 or unchanged and much faster than 1.5 s, so real capacity is
  higher. Phase 1 measures real p95 per feed from `calendar_sync_runs` and sets the pool size and
  `TIME_BUDGET_MS` from data, with a load test ([§12.7](#127-performance-and-load)). If one
  invocation per tick is not enough, shard: the cron job fires N invocations with
  `{ shard, of }` and each takes feeds where `hashtext(property_id::text) % of = shard` (keeps one
  property in one shard).
- **Feed cap (G11):** max **6 active feeds per property** (3 channels with headroom for a second
  listing). `addFeed` returns 400 "This listing already has 6 calendars connected."
- **Duplicate link guard:** refuse a URL already connected on the same property (conflict plan F12).

### 4.9 Kill switches and rollout

- Feature availability gains per-channel children: `pricing.channel_sync.airbnb`,
  `pricing.channel_sync.agoda`, `pricing.channel_sync.booking_com` under
  `pricing.channel_sync` (pausing a channel stops both its imports and new connections; catalog +
  UI mirror + parity test). `FeatureAvailabilityProvider`
  gains `'Agoda' | 'Booking.com'`.
- A paused channel: cron skips its feeds (no failure counted), `addFeed` refuses it, the UI shows
  the existing paused banner on that channel only. Its export link keeps serving (blocking dates is
  always safe).
- New channels launch **off** in production and on for the test tenant
  ([`../../architecture/test-tenant.md`](../../architecture/test-tenant.md)), then for named beta
  orgs, then for every Pro+ property ([§11](#11-phases-and-sequencing)).

---

## 5. Data model (migrations)

Additive only. No shipped migration edited (hook enforced).

**M1 `<ts>_calendar_sync_agoda_provider.sql`:** widen the two CHECKs.

```sql
ALTER TABLE public.property_calendar_feeds
  DROP CONSTRAINT property_calendar_feeds_provider_check,
  ADD CONSTRAINT property_calendar_feeds_provider_check
    CHECK (provider IN ('airbnb','agoda','booking_com','vrbo','other'));

ALTER TABLE public.guest_submissions
  DROP CONSTRAINT guest_submissions_external_source_check,
  ADD CONSTRAINT guest_submissions_external_source_check
    CHECK (external_source IN ('airbnb','agoda','booking_com','vrbo','other'));
```

Verify the generated constraint names against local Postgres before writing (`\d+`).

**M2 `<ts>_blocked_dates_external_kind.sql`:** relay needs to know which imported blocks are
reservations.

```sql
ALTER TABLE public.property_blocked_dates
  ADD COLUMN IF NOT EXISTS external_kind text
    CHECK (external_kind IN ('reservation','block'));
-- Backfill: Airbnb 'Reserved' rows are reservations; everything else imported is a block.
UPDATE public.property_blocked_dates b
SET external_kind = CASE WHEN lower(trim(b.external_summary)) = 'reserved' THEN 'reservation' ELSE 'block' END
FROM public.property_calendar_feeds f
WHERE b.feed_id = f.id AND b.source = 'ical_import' AND b.external_kind IS NULL;
```

Non-Airbnb imported rows do not exist yet in production (UI was Airbnb-only), so the backfill is
exact. The engine writes `external_kind` on every create and reschedule from then on.

**M3 `<ts>_calendar_export_reads.sql`:** per-channel read health and echo memory (G10, §4.4).

```sql
CREATE TABLE public.calendar_export_reads (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id    uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel        text NOT NULL CHECK (channel IN ('all','airbnb','agoda','booking_com','vrbo','other')),
  ranges_hash    text NOT NULL,
  ranges         jsonb NOT NULL,        -- [{start,end}] served, no ids, no PII
  first_read_at  timestamptz NOT NULL DEFAULT now(),
  last_read_at   timestamptz NOT NULL DEFAULT now(),
  read_count     integer NOT NULL DEFAULT 1,
  UNIQUE (property_id, channel, ranges_hash)
);
CREATE INDEX calendar_export_reads_recent_idx
  ON public.calendar_export_reads (property_id, channel, last_read_at DESC);
ALTER TABLE public.calendar_export_reads ENABLE ROW LEVEL SECURITY;  -- service role only
GRANT ALL ON public.calendar_export_reads TO service_role;
```

One upsert per served request (`ON CONFLICT … DO UPDATE SET last_read_at, read_count+1`), on 200
**and** 304. The 304 path already builds the body to compute the weak ETag, so the ranges are at
hand. Today `last_served_at` is only stamped on 200 (`ical-export/index.ts:137-159`), so most
channel reads, which are 304s, go unrecorded.

**M4 `<ts>_calendar_sync_runs.sql`:** one small row per feed run, so cadence, duration and
per-channel failure rates are measurable (G8, ops probe).

```sql
CREATE TABLE public.calendar_sync_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feed_id     uuid NOT NULL REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  provider    text NOT NULL,
  status      text NOT NULL,          -- synced | not_modified | unchanged | skipped | error
  error_code  text,
  duration_ms integer NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX calendar_sync_runs_feed_idx ON public.calendar_sync_runs (feed_id, started_at DESC);
CREATE INDEX calendar_sync_runs_provider_idx ON public.calendar_sync_runs (provider, started_at DESC);
ALTER TABLE public.calendar_sync_runs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.calendar_sync_runs TO service_role;
```

**M5 `<ts>_calendar_sync_retention_cron.sql`:** daily `pg_cron` job deletes `calendar_sync_events`
older than 90 days, `calendar_sync_runs` older than 14 days, `calendar_export_reads` with
`last_read_at` older than 14 days. Same self-invoking pattern as
`20261213120500_calendar_sync_cron.sql`.

**M6 `<ts>_calendar_sync_cron_every_10m.sql`:** reschedule `calendar-sync-every-30m` to `*/10`
under a new job name `calendar-sync-every-10m`, unschedule the old one.

**M7 `<ts>_calendar_sync_events_echo.sql`:** only if a new `calendar_sync_events.action` is needed.
Prefer `skipped` + `detail.reason` (no CHECK change), as the conflict plan does.

Every migration gets a row in `docs/archive/operations/migration-runbook.md` §11b.

---

## 6. Edge function changes

| File                                             | Change                                                                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_shared/calendarChannels.ts` (new)              | Registry ([§4.2](#42-channel-registry-one-place-for-channel-facts))                                                                                                                                       |
| `_shared/bookingChannel.ts` (new)                | Vocabulary + `isOtaPrepaidSource` ([§4.6](#46-one-booking-channel-vocabulary))                                                                                                                            |
| `_shared/calendarEchoRules.ts` (new)             | Pure echo rule + Booking.com setup check                                                                                                                                                                  |
| `_shared/calendarSyncService.ts`                 | Classifier, allowlist, code/URL parsers delegate to the registry; `CalendarFeedProvider` gains `agoda`; `uidStrategy`                                                                                     |
| `_shared/calendarSyncRun.ts`                     | Provider-aware names/source/find_us/messages; write `external_kind`; echo check before booking creation; relay rule 3 in `loadExportRanges`; write `calendar_sync_runs`; claim slack; SQL-side due filter |
| `_shared/externalBookingIngest.ts`               | Adoption matches the **feed's** channel (`Agoda` row adopted only by an Agoda feed), via `canonicalBookingSource`                                                                                         |
| `_shared/calendarExportUrls.ts`                  | `CalendarExportUrlMap` gains `agoda`                                                                                                                                                                      |
| `ical-export/index.ts`                           | `PROVIDERS` from registry; upsert `calendar_export_reads` on 200 and 304; keep identical 404s                                                                                                             |
| `calendar-sync-cron/index.ts`                    | Worker pool (4) with per-property serialization; skip paused channels; time budget from config                                                                                                            |
| `calendar-sync-settings/index.ts`                | `addFeed` accepts enabled channels; per-channel availability check; feed cap; duplicate guard; GET returns per-channel export read health, echo warning, last run stats                                   |
| `get-form-completion`, `submit-form-completion`  | Return/keep `channel`; no `'Airbnb'` fallback                                                                                                                                                             |
| `_shared/totalGuestBalance.ts` and money callers | `isOtaPrepaidSource`                                                                                                                                                                                      |
| `_shared/featureAvailabilityCatalog.ts`          | Per-channel keys, provider union                                                                                                                                                                          |
| `_shared/dashboardAssistantOpsTools.ts`          | "Imports from Airbnb are temporarily unavailable" becomes channel-aware                                                                                                                                   |
| `supabase/config.toml`                           | No new functions, no JWT policy change                                                                                                                                                                    |

No new edge function is needed. `workflowOrchestrator.ts` already suppresses guest side effects
while `guest_email` is blank, which covers every channel.

---

## 7. UI and UX

Run the **`competitive-ux-research`** skill first (Hospitable, Hostaway, Lodgify, OwnerRez channel
screens), then **`mobile-responsive`**, **`human-copy`**, **`unsaved-changes-guard`** and
**`accessibility`** on the result.

### 7.1 Channel sync (Pricing → Channel sync)

When this plan was written (2026-11-16), `ChannelSyncDialog.tsx`, `GuestForm.tsx` and a new
`pricing/lib/calendarSyncActivity.ts` had uncommitted rework from another session. Line numbers in
[§2](#2-what-exists-and-what-blocks-multi-channel) refer to `HEAD` (`ac5986249`). Phase 2 builds on
whatever version of that rework lands, it does not restart the dialog.

- **Channel list** replaces the single Airbnb panel. One row per channel (Airbnb, Agoda,
  Booking.com): channel name (no third-party logos unless their brand guidelines allow it), status chip (`Not connected` / `Syncing` / `Needs attention` / `Paused`),
  "Imported 12 min ago", "Agoda read your link 2 h ago". Tap opens the channel's setup sheet.
- **Channel setup sheet** (bottom sheet on phone, side sheet on desktop), two numbered steps from
  the registry: **1. Bring Agoda in** (paste link, live URL check), **2. Send Kame Space to Agoda**
  (share switch, copy link, where to paste it). Per-channel **Create bookings** switch.
- **Hub checklist** at the top of the list once two or more channels are connected: "Connect each
  channel only to Kame Space", "Remove links between Airbnb, Agoda and Booking.com", "Block dates in
  Kame Space".
- **Health warnings** per channel: link failing (existing), channel never read our link after 24 h
  ("Agoda hasn't read your link yet. Check it's pasted in Calendar connections."), Booking.com
  closed-dates echo (§4.4).
- **Eligibility hints** in the sheet: Agoda needs a room type with exactly 1 room; Booking.com
  turns calendar links off when a channel manager is connected.
- **Locked and paused states:** plan lock (`useFeatureGate('calendarSync')`, unchanged), team
  view-only (`pricing.channels:view`), per-channel paused banner.
- **Unsaved guard:** the paste-link field uses `useGuardedClose` on the sheet.
- Client URL validation becomes `validateChannelCalendarUrl(channel, url)` from the registry,
  mirroring the edge rules (parity test).
- Recent activity names the channel on every line.

### 7.2 Elsewhere

- **Booking detail / mobile summary / header:** channel badge, "Paid through Agoda", **Open in
  Agoda** only when the registry yields a reservation URL, **Copy guest form link** (and QR when
  the channel masks links, §4.7).
- **Pricing calendar:** imported tooltip "Synced from Agoda" (channel from the block's feed).
- **Booking edit form:** source picker shows all `BOOKING_SOURCES`; switching between prepaid
  channels keeps DP/SD at ₱0, switching to Direct/Facebook restores the direct rules (today's
  Airbnb behaviour, generalized).
- **Guest form:** labels per channel for `?source=` and completion mode.
- **Notifications / Telegram / email templates:** "New booking imported from Agoda".
- **Analytics:** channel mix already labels Agoda and Booking.com; verify the filter lists them.

### 7.3 Copy drafts (finalize with `human-copy`, no em dashes)

| Where              | Copy                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Agoda step 1       | In Agoda, open Calendar, then Calendar connections. Copy your calendar link and paste it here.                |
| Agoda step 2       | In Agoda Calendar connections, paste this link under Other website link and tap Import.                       |
| Booking.com step 1 | In Booking.com, open Rates & Availability, then Sync calendars. Export reserved dates only and copy the link. |
| Booking.com step 2 | In Sync calendars, tap Add calendar connection and paste this link.                                           |
| Never read warning | Agoda hasn't read your link yet. Check it's pasted in Calendar connections.                                   |
| Echo warning       | Booking.com is sending back closed dates. Export reserved dates only.                                         |
| Hub checklist      | Connect each channel only to Kame Space.                                                                      |
| Cap error          | This listing already has 6 calendars connected.                                                               |

---

## 8. Security

- **SSRF:** every new host suffix goes through the existing `fetchExternalIcs` guard (https only,
  private IP literal and DNS rejection, per-hop redirect re-validation, 2 MB cap, timeout). Agoda's
  real host comes from Phase 0, not a guess. There is no `other` channel at all: every link is host-allowlisted.
- **Secrets:** imported URLs stay AES-256-GCM encrypted (`ics_url_encrypted`), masked in GET.
- **Export token:** unchanged (≥32 bytes, constant-time compare, identical 404s, rotatable). Rotating
  breaks every channel's import at once; the rotate dialog lists the connected channels.
- **PII:** relay publishes only opaque `Booked`/`Blocked` with `gfm-*` UIDs. `calendar_export_reads`
  stores date ranges only. A test asserts no guest name, code or phone appears in any export.
- **Tenant isolation:** `feed.property_id` is checked on every scoped call (today); relay queries
  filter by `property_id`; tests cover cross-property attempts.
- **RBAC:** unchanged leaves `pricing.channels:view` / `:edit`.
- **Abuse:** feed cap, duplicate guard, existing `rateLimitGate` on settings writes and Sync now.
- Run **`security-auditor`** on Phase 1 and Phase 3 diffs.

---

## 9. Observability and operations

- `calendar_sync_runs` gives per-channel success rate, p95 duration and real cadence.
- **Parser drift alarm:** if a channel changes its feed format, many feeds of that channel fail or
  go empty at once. A System Health probe flags a channel when, over 6 h, ≥ 30% of its active feeds
  end in `error` or `skipped(empty)` (minimum 5 feeds). Wire to `ops_alerts` once
  [`production-error-escalation.md`](./production-error-escalation.md) lands; until then, the
  `/admin/health` probe card. Response: pause the channel (§4.9), fix the adapter, unpause.
- PostHog: `calendar_sync_connected` carries `provider`; `calendar_sync_echo_detected` (provider,
  count) and `calendar_sync_export_never_read` (provider) are shipped and in both catalogs.
- Notifications keep their dedupe keys, with the channel label in the text.
- Support runbook in the route guide: "Agoda dates not blocking" decision tree (link failing, never
  read, room type has more than 1 room, channel manager connected, direct channel link left in place).

---

## 10. Plans, permissions, activity log, support

- **Plans:** same `calendarSync` key (Pro+) covers every iCal channel. iCal costs us only polling,
  and splitting channels by tier adds no clear value (D2). Update the `calendarSync` row in
  `plans-feature-matrix.md`, `PLAN_FEATURE_LABELS` ("Airbnb, Agoda & Booking.com calendar sync"),
  `featureGateCopy.ts`, the Pro card bullet in `planPresentation.ts`, and `/for-hosts/pricing` copy.
  Plan tier tests (`plan-tier-test-suite`) follow.
- **Team RBAC:** no new leaves. `pricing.channels:view` / `:edit` already cover every channel.
  `PLAN_FEATURE_PERMISSION_COVERAGE` unchanged.
- **Activity log:** feed add/update/remove and export enable/disable already log; add `provider`
  to metadata where missing. Imported bookings keep their existing event. Super-admin channel pause
  goes through the existing feature availability audit. New: `activity-log: N/A` for echo skips
  (sync internals, visible in Recent activity, not org audit material).
- **Support content:** Host-facing knowledge Q&A and `docs/guides/support/faqs.md` (the entry at
  ~line 1077 says Airbnb is the only provider): how to connect Agoda, Booking.com; why imported
  bookings have no guest name; why direct links between channels cause problems; "reserved dates
  only" on Booking.com; Agoda 1-room rule. Run `check:support-content` and
  `check:ai-knowledge-coverage`.
- **Parking:** `N/A`, calendar sync is property-only.

---

## 11. Phases and sequencing

**Prerequisite:** conflict plan **Phase 1** (pure classifier, conflict evaluation after reconcile,
`ota_block` skip, F5 and F12 fixes) ships first. Its `classifyCalendarOverlap` takes the channel
from the registry instead of assuming Airbnb. Each new channel multiplies the echo noise that plan
removes, so adding channels first would flood hosts with false conflicts.

**Audited 2026-11-16:** that prerequisite is **not shipped**. Phase 1 is therefore split:
**1a** is conflict-free and can ship now; **1b** carries the conflict-integrated work and starts
only after conflict plan Phase 1 lands.

| Phase | Scope                                                                                                                                                                                                                                                                                                                                                                     | Exit gate                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 0     | **Spike with real links** (no product code): one Agoda and one Booking.com listing connected to the test tenant; capture sanitized fixtures; answer [§12.1](#121-phase-0-spike-checklist-real-links); measure G8 cadence from edge logs. **Blocked on host-supplied listings**                                                                                            | Go / no-go per channel recorded in this file; fixtures under `_shared/__fixtures__/calendar/`    |
| 1a ✅ | **Channel-agnostic foundation, no conflict dependency, Airbnb only visible** (shipped 2026-11-16): registry + UI mirror, `bookingChannel` + `isOtaPrepaidSource`, call-site sweep, M1 to M6, `external_kind`, export reads, runs table, claim slack + SQL-side due filter, feed cap, duplicate guard, retention, per-channel kill switches, `booking-workflow.mdc` rename | Airbnb behaviour unchanged (edge 1884 + UI 6400 tests green); cadence now measurable per run     |
| 1b ✅ | **Conflict-integrated (shipped 2026-11-16 in #493):** relay rule 3 (G6), echo detection (§4.4), bounded concurrency (G9), Booking.com setup warning. Requires conflict plan Phase 1                                                                                                                                                                                       | Relay and echo integration tests green; zero false conflicts on Airbnb-only data                 |
| 2 ◐   | **Agoda (UI, labels, money rules, rollout gate shipped dark 2026-11-17; adapter facts and fixtures still need Phase 0):** adapter from fixtures, multi-channel Channel sync UI (§7.1), guest-form channel labels, QR/delivery fallback if links are masked, booking detail and calendar copy, support content. Launch to test tenant, then beta orgs                      | Live QA matrix ([§13](#13-live-qa-matrix)) passes for Airbnb + Agoda + Direct                    |
| 3     | **Booking.com:** adapter, echo rule + setup warning, `uidStrategy` fallback if Phase 0 needs it. Launch to test tenant, then beta                                                                                                                                                                                                                                         | Live QA matrix passes for all three channels + Direct; zero phantom bookings over 7 days on beta |
| 4     | ~~Optional: Vrbo and Other calendar link~~ **Removed 2026-11-17.** Only Airbnb, Agoda and Booking.com are supported                                                                                                                                                                                                                                                       | n/a                                                                                              |
| 5     | **General availability + close-out:** enable for all Pro+ properties, parser drift probe live, docs/support final pass, move plan to `done/`                                                                                                                                                                                                                              | 14 days on GA with drift probe quiet; support FAQ published                                      |
| 6     | **Decision-gated Tier 3 evaluation** ([§15](#15-tier-3-track-channel-manager-api-decision-gated)). Not started without an explicit go                                                                                                                                                                                                                                     | Written decision                                                                                 |

Each phase updates docs in the same change ([§16](#16-docs-and-support-to-update)).

---

## 12. Test plan

Everything below is **required** unless marked optional. Commands: `bun run test` (Vitest node),
Vitest DOM project for `.test.tsx`, `bun run test:edge` / `test:edge:handlers` (Deno, use the
functions config), `bun run test:e2e:smoke` / `test:e2e:ci`, `bun run ci:quality` before every PR.

### 12.1 Phase 0 spike checklist (real links)

Use a listing that is unlisted or snoozed, and dates 6+ months out, so tests never block real
guests. Record every answer in this file before Phase 2/3 code.

| #   | Question                                                                                         | Agoda     | Booking.com |
| --- | ------------------------------------------------------------------------------------------------ | --------- | ----------- |
| S1  | Export link host and path shape (allowlist + client check)                                       |           |             |
| S2  | Fetchable from Supabase edge: 200, `text/calendar`, no bot wall or geo block, ETag / 304 support |           |             |
| S3  | VEVENT for a reservation: SUMMARY, DESCRIPTION, any booking id or URL, DTSTART date vs datetime  |           |             |
| S4  | VEVENT for a host-closed date; can it be told apart from a reservation?                          |           |             |
| S5  | Does the export echo nights imported from our link? With which SUMMARY?                          |           |             |
| S6  | UID stable across 3+ pulls in 24 h? Across a date change? (`uidStrategy`)                        |           |             |
| S7  | Cancellation: event gone on next refresh? Any `STATUS:CANCELLED` instead?                        |           |             |
| S8  | Does the channel accept our `…/calendar.ics?property=…&token=…&as=…` link? Any length limit?     |           |             |
| S9  | How often does the channel read our link? (from `ical-export` logs with `as=`)                   |           |             |
| S10 | Time from a Kame direct booking to nights closed on the channel                                  |           |             |
| S11 | Booking horizon in the export (how far ahead)                                                    |           |             |
| S12 | Is our guest-form link masked in the channel's guest chat?                                       |           |             |
| S13 | Same-day and 30+ night stays exported correctly                                                  |           |             |
| S14 | Booking.com only: "reserved only" vs "reserved and closed" output difference                     | N/A       |             |
| S15 | Agoda only: behaviour when the room type count is changed to 2 (connection deactivates?)         |           | N/A         |
| S16 | Cadence today (G8): attempt interval per feed from `calendar-sync-cron` logs over 24 h           | all feeds | all feeds   |

**No-go triggers:** the link cannot be fetched from edge (S2), UIDs are unstable **and** the date
range fallback cannot express reschedules safely (S6), or the channel rejects our link (S8). A
no-go channel moves to Tier 3 only.

### 12.2 Pure unit tests (Deno, `_shared/*_test.ts`)

- `calendarChannels_test.ts`: every channel has every field; keys match the CHECK lists; host
  suffix matching (`ical.booking.com` ok, `booking.com.evil.io` rejected); URL shape per channel.
- `calendarSyncService_test.ts` (extend): table-driven classifier per channel from real fixtures
  (reservation, closed date, echo, cancelled, malformed); confirmation code and reservation URL
  parsers per channel; datetime vs date parsing for Agoda's format; `dateRange` UID strategy.
- `calendarEchoRules_test.ts` (new): exact echo; echo covered by a union of two served ranges;
  partial overlap is **not** an echo; ghost inside 72 h is an echo, at 73 h is not; Airbnb
  `Reserved` with code is never an echo; Booking.com setup check fires at 2 exact matches, not 1.
- `bookingChannel_test.ts` (new): `canonicalBookingSource` aliases, unknown kept as-is (G4
  regression), `isOtaPrepaidSource` per source, labels.
- Relay rule unit (pure part of `loadExportRanges`): rule 3 included for other channels, excluded
  for same channel, deduped against a live booking with the same `(feed_id, external_uid)`,
  imported `block` kind never published.
- `buildExportCalendar` per channel stays PII-free (assert no names, codes, phones in output).
- `externalBookingIngest_test.ts` (extend): adoption only within the same channel; relink after
  reconnect per channel; past-stay skip per channel.
- `totalGuestBalance_test.ts` (extend): Agoda and Booking.com behave like Airbnb.
- Claim cutoff with slack: a feed at `:00:07` is claimable at `:30:00`.

### 12.3 Integration tests (Deno, real local Postgres, stubbed fetch)

Extend `calendarSyncRun_integration_test.ts` (12 Airbnb cases must stay green):

1. Agoda reservation → `guest_submissions` row: `booking_source='Agoda'`, `external_source='agoda'`,
   `find_us='Agoda'`, placeholder name, `PENDING_REVIEW`, `external_kind='reservation'` block.
2. Booking.com event that is not an echo → booking row `Booking.com`.
3. **Relay:** Airbnb reservation (Create bookings off) appears in `as=agoda` and `as=booking_com`
   exports, not in `as=airbnb`. With Create bookings on, appears once, not twice.
4. Relay removal: the Airbnb event disappears → gone from the Agoda export on the next read.
5. Relay reschedule: dates move → Agoda export moves.
6. **Echo:** Kame direct booking served to Booking.com, Booking.com echoes it → no booking row,
   `skipped(export_echo)`, block kept, no conflict.
7. Ghost echo after a Kame cancellation within 72 h → still no booking.
8. Booking.com setup warning set after two exact matches, cleared after a clean pull.
9. Two feeds of one property in one sweep run serially (no duplicate adoption, no double conflict).
10. Feed cap: 7th `addFeed` refused. Duplicate URL refused.
11. Paused channel: cron skips its feed, `consecutive_failures` unchanged; other channels sync.
12. Plan downgrade: cron skips every feed of a property without `calendarSync` (existing, per channel).
13. Retention: rows past their windows deleted; recent rows kept.
14. `calendar_sync_runs` row written for every status including `not_modified`.
15. Same-day Agoda stay occupies the check-in night in imports and in relay.
16. Removing an Agoda feed keeps Airbnb feeds and their relay intact.
17. Agoda booking cancelled after check-in → not cancelled (`past_checkin_feed_drop`), per channel.

### 12.4 Handler tests (`supabase/functions/tests/handlers/`)

- `calendar-sync-settings.test.ts`: `addFeed` for `agoda` and `booking_com` (valid, wrong host,
  wrong shape, private host, paused channel, plan locked, `:view`-only member 403, cap, duplicate);
  GET returns per-channel health and echo warning; no URL ever unmasked.
- `ical-export.test.ts`: `as=agoda` excludes Agoda-sourced bookings and includes relayed
  reservations; read row upserted on 200 and on 304; wrong token still identical 404.
- `calendar-sync-cron.test.ts`: worker pool honours the time budget; per-property serialization;
  paused channel skipped; scoped Sync now still requires `pricing.channels:edit`.
- `get-form-completion.test.ts` / `submit-form-completion.test.ts`: Agoda and Booking.com rows
  return the right `channel`, stored dates still win, status stays `PENDING_REVIEW`.
- `entrypoint-seam.test.ts`: still passes with the new imports.

### 12.5 UI unit tests (Vitest; DOM project for `.test.tsx`)

- `calendarChannels.test.ts`: UI mirror parity with the edge registry.
- `bookingChannel.test.ts`: parity + "Agoda survives an edit-form save" (G4 regression).
- `validateChannelCalendarUrl` per channel.
- `totalGuestBalance.test.ts`, `bookingFinance.test.ts`, `bookingPricingRows.test.ts`: Agoda and
  Booking.com match Airbnb outputs.
- `importedBooking.test.ts`: eligibility per channel.
- `featureAvailabilityParity.test.ts`: new per-channel keys.
- `planFeaturePermissions.test.ts` and plan tier tests: still pass with new labels.
- `ChannelSyncDialog.test.tsx` (DOM): list states (not connected, syncing, needs attention, paused,
  locked), setup sheet steps per channel, echo and never-read warnings, guarded close with a typed URL.
- `GuestForm` completion labels per channel.

### 12.6 Playwright mocked E2E (new `ui/e2e/features/pricing/`)

- `channelSync.spec.ts`: connect Agoda (happy path, bad URL error, cap error), copy the Agoda export
  link, health chips, paused channel banner, plan-locked upgrade modal, view-only member, hub
  checklist appears at two channels. Run at 375, 768, 1024 (bottom sheet on phone).
- `bookings/importedChannelBooking.spec.ts`: Agoda-imported booking detail shows the badge, "Paid
  through Agoda", no DP/SD fields, Copy guest form link (and QR when masked).
- `guest-form/completionChannel.spec.ts`: completion mode for an Agoda booking, locked dates, Agoda
  labels, no payment step.
- Add the new specs to `test:e2e:ci`; one smoke case to `test:e2e:smoke`.
- Coverage manifest rows if [`full-app-test-architecture.md`](./full-app-test-architecture.md) has
  landed by then.

### 12.7 Performance and load

- Synthetic run: 1,000 properties × 3 feeds with a stubbed fetcher (latency 200 ms to 3 s, 2%
  errors). Measure feeds per tick, p95 per feed, budget overruns. Pick pool size and budget from it.
- `EXPLAIN ANALYZE` on `loadExportRanges` with relay rule 3 and on the echo lookup against seeded
  data; add indexes only if a plan shows a sequential scan on a hot path.
- k6 against `ical-export` (mostly 304s) at 10x expected channel read rate; confirm the read upsert
  does not regress p95.

### 12.8 Security tests

- SSRF per channel: redirect to an off-allowlist host, to a private IP, DNS rebinding to
  `127.0.0.1`, oversize body, slow body.
- No PII in any channel export (fixture with real-looking names and phones).
- Cross-property: feed id of property A used with property B's scope → 404.
- Token: wrong, rotated, disabled → identical 404; timing check unchanged.

### 12.9 Regression gates

- Full existing Airbnb suites: `calendarSyncService_test.ts`, `calendarSyncRun_integration_test.ts`,
  `externalBookingIngest_test.ts`, `guestFormCompletion_test.ts`, handler tests, `importedBooking`.
- `bun run ci:quality` green on every phase PR.

---

## 13. Live QA matrix

Run on staging against real listings (test tenant), dates 6+ months out. Record time to propagate
for each cell; a cell passes when the target blocks within the channel's documented refresh plus one
Kame interval.

| Action on →                 | Kame shows                           | Airbnb blocked | Agoda blocked | Booking.com blocked     |
| --------------------------- | ------------------------------------ | -------------- | ------------- | ----------------------- |
| New Airbnb booking          | Booking `Airbnb`, `PENDING_REVIEW`   | (source)       | ✓             | ✓                       |
| New Agoda booking           | Booking `Agoda`                      | ✓              | (source)      | ✓                       |
| New Booking.com booking     | Booking `Booking.com`, no echo dupes | ✓              | ✓             | (source)                |
| Direct Kame booking         | (source)                             | ✓              | ✓             | ✓                       |
| Manual block in Kame        | Block                                | ✓              | ✓             | ✓                       |
| Cancel on each channel      | Cancelled (pre check-in)             | freed          | freed         | freed                   |
| Date change on each channel | Booking moves, back to review        | moves          | moves         | moves                   |
| Cancel direct booking       | Cancelled                            | freed          | freed         | freed, no ghost booking |
| Block on Airbnb itself      | Block only, not relayed (documented) | (source)       | not blocked   | not blocked             |

Plus: disconnect and reconnect each channel (no duplicates, relink by UID); rotate the export token
(every channel shows a sync error, new links restore); pause a channel as super admin; guest-form
link sent through each channel's chat (S12); Booking.com with "reserved and closed" (warning shows,
no phantom bookings); same-day stay; 30+ night stay; check-in at a month boundary; phone at 375 px
for the whole setup.

---

## 14. Edge cases

| Case                                                                  | Behaviour                                                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Host keeps a direct Airbnb ↔ Agoda link as well                       | Echoes become `ota_block` / `export_echo`, no bookings; hub checklist warns                                |
| Same Agoda link connected twice                                       | Refused at add (duplicate guard); old duplicates flagged `duplicate_feed` (conflict plan)                  |
| Agoda room type changed to 2 rooms                                    | Agoda deactivates the link; our pull fails → existing failing-feed notification; help text names the cause |
| Booking.com host connects a channel manager                           | Booking.com removes calendar links; our export stops being read → never-read warning after 24 h            |
| Channel returns an empty calendar once                                | Existing empty-feed guard keeps blocks (`empty_pull_streak`)                                               |
| Channel changes feed format overnight                                 | Parser drift probe flags; super admin pauses the channel; export keeps serving                             |
| Host switches an Agoda booking's source to Direct                     | Allowed; `external_*` keeps sync identity; money rules switch to direct                                    |
| CSV import with `Agoda` / `Booking.com` sources                       | Kept as-is (no Direct collapse)                                                                            |
| Manual `Agoda` booking with the same dates as an Agoda event          | Adopted by the Agoda feed only, never by Airbnb's                                                          |
| Two channels report overlapping reservations                          | Real double booking → conflict plan `double_booking` (critical)                                            |
| Kame booking cancelled, channel still shows closed for hours          | Ghost echo inside 72 h ignored; after 72 h it is treated as a real channel block (block only, no booking)  |
| Booking.com real reservation entirely inside nights we published busy | No placeholder booking (echo rule); nights already held; conflict surface shows the Kame side (documented) |
| Export token rotated                                                  | All channels break together; rotate dialog lists connected channels first                                  |
| Plan downgrade                                                        | Cron stops importing; export link keeps serving (blocking is safe); UI shows the lock                      |
| Property archived or deleted                                          | `ON DELETE CASCADE` on feeds, reads, runs                                                                  |
| Agoda link masked in chat                                             | QR and WhatsApp path on the booking (§4.7)                                                                 |
| Feed with thousands of events                                         | 2 MB cap and parse limits (existing)                                                                       |
| Timezone: channel exports datetimes                                   | Floored to Manila date (existing parser); fixture-tested per channel                                       |

---

## 15. Tier 3 track: channel-manager API (decision-gated)

The only route to Traveloka and Trip.com, and to real-time sync, guest names, prices and rate push
on every channel. Direct OTA APIs are not open to us (Airbnb closed, Booking.com onboarding
reported paused, Agoda requires connectivity certification aimed at channel managers). The
realistic option is a white-label channel-manager API.

**Channex** (white-label channel API for PMS vendors) is the strongest fit found:

- Lists Airbnb, Booking.com, Agoda, Expedia, Vrbo, **Traveloka**, **Trip.com**, Tiket and Klook.
- REST + webhooks, booking revisions feed (pull + push), ARI push (availability, rates,
  restrictions), mapping API, optional chat and reviews add-on.
- **Pricing (WhiteLabel):** $130/month platform fee plus **$0.50 per vacation-rental unit per
  month** (hotels $7 per property). Only units with an active channel are billed. 30-day notice.
- Free staging sandbox. Go-live needs Channex certification (efficiency check, live review) and each
  OTA account's authorization.
- Unconfirmed: whether Airbnb via Channex needs extra Airbnb approval for us. Ask Channex first.

What it would take (estimate, not a commitment): a new `channel_manager_connections` model, OAuth or
mapping flow per OTA, webhook receiver + revisions poller, ARI push from Pricing and Smart Pricing,
iCal feeds disabled per channel once connected (OTAs require it), a new paid plan key with real
per-unit cost, finance reconciliation of OTA payouts, and a migration path from iCal feeds.
Roughly the size of the original Airbnb sync plus Smart Pricing integration.

**Recommendation:** do not start until iCal multi-channel (Phases 1 to 3) is live and either
(a) at least 10 paying hosts ask for Traveloka or Trip.com, or (b) double bookings from polling
delay show up as a top support issue. Then run a 2-week Channex sandbox spike and write a separate plan.

---

## 16. Docs and support to update

In the same change as each phase (`documentation-maintenance`, `route-guides`, `support-content`):

- `docs/architecture/overview.md` + `docs/PROJECT.md`: multi-channel hub, new tables, env (none new
  expected).
- `docs/architecture/data-model.md`: M1 to M6, `external_kind`, new source values.
- `docs/architecture/edge-functions.md`: changed behaviour of `calendar-sync-settings`,
  `ical-export`, `calendar-sync-cron`.
- `docs/architecture/integrations.md`: Agoda and Booking.com sections, limits, eligibility.
- `docs/architecture/plans-feature-matrix.md`: `calendarSync` row (channels, no longer Airbnb-only).
- `docs/architecture/feature-availability.md`: per-channel keys.
- `.cursor/rules/booking-workflow.mdc`: "OTA-prepaid source behavior", channel provenance, echo rule.
- `docs/archive/operations/scheduled-jobs-and-testing.md`: `calendar-sync-every-10m`, retention job.
- `docs/archive/operations/migration-runbook.md` §11b: M1 to M6 order.
- `docs/guides/routes/org/property/pricing.md`: Channel sync list, setup sheet, warnings, runbook.
- Booking detail and guest form route guides: channel labels, QR fallback, `?source=agoda|booking`.
- `docs/guides/support/faqs.md` + Host-facing knowledge Q&A (§10).
- `docs/workflow/planned/calendar-sync-conflict-resolution.md`: classifier takes the channel.

---

## 17. Decisions (defaults locked unless overridden)

| #   | Decision                                               | Default (recommended)                                                                                             |
| --- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| D1  | Channels in this plan                                  | **Airbnb, Agoda and Booking.com only.** Vrbo and Other were removed (owner decision 2026-11-17)                   |
| D2  | Plan gating                                            | Same `calendarSync` key (Pro+) for all iCal channels; no per-channel tier                                         |
| D3  | Guest pays at the property (Booking.com, Agoda option) | Deferred. v1 treats every OTA as prepaid; host can switch a booking's source to Direct. Revisit if beta hosts ask |
| D4  | Relay imported reservations to other channels          | Yes (required for correctness)                                                                                    |
| D5  | Relay channel-side blocks                              | No. Block in Kame Space                                                                                           |
| D6  | "Email the link" to an OTA relay address               | Only if Phase 0 shows links are masked in chat **and** QR is not enough for beta hosts                            |
| D7  | Feed cap                                               | 6 active feeds per property                                                                                       |
| D8  | Tier 3 (Channex)                                       | Not now; trigger conditions in §15                                                                                |

**Open input needed before Phase 0:** one Agoda listing and one Booking.com listing the test
tenant can connect to (owner's own, unlisted or with far-future dates). **Status 2026-11-16:
not provided.** An agent cannot create or connect OTA listings; this is a human step. Phase 1a
does not need it and shipped first.

---

## 18. Execution decisions (execute-plan)

| #   | Decision                                   | Choice                                                                                                             | Why                                                                                                                                                                                                                               |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X1  | Conflict prerequisite missing              | Split Phase 1 into 1a (now) and 1b (after conflict Phase 1)                                                        | 1a touches no conflict code, so it cannot regress the classifier that does not exist yet                                                                                                                                          |
| X2  | Phase 0 external listings                  | Not attempted; reported as blocked                                                                                 | Creating or linking Agoda / Booking.com listings needs host credentials the agent does not have                                                                                                                                   |
| X3  | Bounded concurrency (G9)                   | Deferred to 1b                                                                                                     | One live channel cannot exhaust a sequential sweep; concurrency only pays once Agoda or Booking.com imports                                                                                                                       |
| X4  | Relay rule 3 (G6)                          | Deferred to 1b                                                                                                     | Publishing imported reservations before echo detection exists would change Airbnb export output                                                                                                                                   |
| X5  | Provider CHECK constraint names            | Verified against local Postgres with `\d+` before writing M1                                                       | The migrations declare inline column CHECKs, so names are Postgres-generated                                                                                                                                                      |
| X6  | `isOtaPrepaidSource` scope                 | True for `Airbnb`, `Agoda`, `Booking.com`                                                                          | Matches the plan; no stored row can carry an unsupported OTA source because ingestion writes `Airbnb` today                                                                                                                       |
| X7  | Unknown booking source handling            | `canonicalBookingSource` preserves unknown values; only the picker is constrained                                  | G4 data loss is worse than an unknown label; `Direct` collapse is what turns an Agoda row into a direct booking                                                                                                                   |
| X8  | Per-channel availability default           | New channel keys ship **enabled** in code (same as `pricing.channel_sync`), gated by `addFeed` provider allow-list | Phase 2 controls launch by allowing the provider, not by shipping a dark switch                                                                                                                                                   |
| X9  | Feed cap value                             | 6 active feeds per property (D7)                                                                                   | Unchanged from the plan                                                                                                                                                                                                           |
| X10 | Echo inside relayed nights (review #2, M3) | Accepted, not special-cased                                                                                        | §4.4 already accepts a reservation fully inside nights we published: the nights are held in Kame and the conflict pass still notifies. Tagging relay-origin ranges adds a third state to every read row for no revenue protection |

| X11 | How Agoda and Booking.com reach hosts | Runtime gate `_shared/calendarChannelRollout.ts`: secrets `CALENDAR_CHANNELS_ENABLED` (provider list) and optional `CALENDAR_CHANNELS_BETA_ORG_IDS`; GET returns `connectableProviders` | The availability switches are fail-open (no row = on) so they cannot hold a channel back. A code flag needs a deploy per stage. Secrets give test tenant, then beta orgs, then everyone with no deploy, and fail closed on typos |
| X12 | Host-facing plan, pricing and FAQ copy | Still says Airbnb only; changes at launch, not now | Copy that promises Agoda while the gate is closed is false. The launch checklist (§20) lists every string |
| X13 | `isAirbnb` rename on guest surfaces | Renamed to `isOta` / `isOtaPrepaid` (guest form flags, trip payment) and `otaLabel` for copy | The flag meant "prepaid by an OTA" all along. Keeping the old name would have made Agoda read as a special case of Airbnb |
| X14 | Completion link channel | `get-form-completion` already returns the stored `bookingSource`; the form reads it and falls back to Airbnb copy | One link flow for every channel, no new endpoint |
| X15 | Vrbo and Other removed | Registry, UI, export `?as=`, booking sources, import normalization, CHECKs (M11, guarded), cron query and `runFeedSync` all drop them; a stray row is skipped as `unsupported_provider` | Owner decision. It also removes the only "any public host" fetch path, so every import URL is now host-allowlisted |
| X16 | Create bookings default | `createBookingsDefault`: Airbnb on, Agoda and Booking.com **off**, with a note under the switch | Neither can tell a stay from a closed date yet. Auto-creating would turn host blocks into placeholder bookings |
| X17 | UID reuse across channels | `findRelinkableBooking` now requires the row's `external_source` to equal the feed's provider | Found by an integration test: two channels using the same UID string made one channel adopt the other's booking |
| X18 | Channel sync UI model (2026-11-17, owner feedback: cluttered) | Flat channel list (name, meta, status), one compact channel view with **From** and **To** sections, every instruction moved into the **?** help, activity collapsed inside the channel, stop-sharing confirmation, one tip line instead of an info box | Cut visible text by roughly two thirds and removed nested cards. Instructions stay one tap away. Sharing off now confirms because it silently stops every channel |

### Acceptance commands per phase

| Phase | Command that proves it                                                                          |
| ----- | ----------------------------------------------------------------------------------------------- |
| 1a    | `bun run test:edge && bun run test && bun run db:migrate && bun run type-check && bun run lint` |
| 1b    | `bun run test:edge && bun run test && bun run test:edge:handlers && bun run type-check`         |
| 2     | `bun run test:e2e:ci -- --grep "channel sync"` plus the live QA matrix rows                     |
| 3     | Same as 2 with the Booking.com column, plus a 7-day phantom-booking check on beta               |
| 5     | `bun run ci:quality` and 14 days of quiet parser-drift probe output                             |

---

## Sources

- Agoda Partner Hub, calendar connections: <https://partnerhub.agoda.com/how-do-i-connect-my-agoda-calendar-with-other-websites/>
- Agoda Homes help, sync your calendar: <https://agodahomeshelp.zendesk.com/hc/en-us/articles/115006604248-Set-which-days-can-be-booked-and-sync-your-calendar-with-other-platforms>
- Agoda supply developer hub (YCS API): <https://developer.agoda.com/supply/docs/introduction>
- AirHost, Agoda channel specifications (Agoda URL masking, iCal vs channel manager): <https://support.airhost.co/en/articles/9000653-channel-agoda-channel-creation-synchronization-specifications>
- PriceLabs, Booking.com export options: <https://help.pricelabs.co/portal/en/kb/articles/how-to-sync-your-airbnb-and-booking-com-calendars>
- Guesty, syncing Booking.com and Airbnb: <https://www.guesty.com/blog/booking-airbnb-sync/>
- Hospitable, Booking.com removes iCal imports with a channel manager: <https://help.hospitable.com/en/articles/8709568-check-for-and-disconnect-an-imported-ical-from-booking-com>
- Booking.com Connectivity Partner Programme: <https://partner.booking.com/en-gb/help/channel-manager/partner-programme/what-connectivity-partner-programme>
- Hospitable, Booking.com connectivity partners: <https://hospitable.com/booking-com-connectivity-partners>
- Airbnb API access status (secondhand): <https://www.bnbcalc.com/help/articles/does-airbnb-have-an-api>
- Zitlin, iCal support per OTA (Traveloka): <https://zitlin.com/pms/ical-calendar-sync/>
- Channex Traveloka mapping: <https://docs.channex.io/channel-mapping-guides/traveloka>
- Hostex, Trip.com integration: <https://hostex.io/help/trip-com-integration/>
- tiket.com calendar sync: <https://tix.tiket.com/en/help-center/rates-availability/calendar-sync>
- Channex overview, pricing and integrations: <https://channex.io/llms.txt>, <https://channex.io/pricing>, <https://channex.io/integrations.md>

## 19. Verification results

| Gate                                                                 | Result                                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run type-check`                                                 | pass                                                                                                                                                                                                                   |
| `bun run lint`                                                       | 0 errors (warnings pre-existing)                                                                                                                                                                                       |
| `bun run test` (Vitest)                                              | 6378 passed + 29 DOM, 0 failed                                                                                                                                                                                         |
| Deno `_shared` suite (functions config)                              | 1918 passed, 0 failed                                                                                                                                                                                                  |
| Deno integration (`calendarSyncRun_integration_test.ts`)             | 16 passed: relay own-vs-other channel, relay dedupe, echo creates no booking and sets the warning                                                                                                                      |
| Deno handler tests (`calendar-sync-settings`, `cron`, `ical-export`) | 11 passed                                                                                                                                                                                                              |
| `bun run build`                                                      | pass                                                                                                                                                                                                                   |
| `bun run test:e2e:smoke`                                             | 259 passed, 1 skipped; 1 tablet guest-form case flaked under parallel load and passes standalone on rerun                                                                                                              |
| `bun run check:filenames` / support-content / ai-knowledge-coverage  | pass / pass / pass                                                                                                                                                                                                     |
| Migrations M1 to M10                                                 | applied cleanly via `psql`; `bun run db:migrate` is blocked by local history drift from another branch (versions `20261331000600`, `20261332000100` are not on `develop`)                                              |
| Security review #1 (Phase 1a diff)                                   | 0 Critical/High/Medium; 5 Low fixed                                                                                                                                                                                    |
| Security review #2 (relay, echo, pool, never-read)                   | 0 Critical/High; 2 Medium fixed (opaque relay UID; relay stops for inactive, failing or 48 h-stale feeds), 1 Medium accepted (X10), 4 Low fixed, 1 Low documented (cross-invocation per-property races are DB-guarded) |
| `EXPLAIN (ANALYZE)` on the relay query (local DB)                    | seq scan chosen at 6 rows, optimal at that size; `property_blocked_dates_property_range_idx` already covers `property_id`, no index added                                                                              |
| Analytics channel mix                                                | verified: both label mirrors already map `agoda` / `booking.com`; the filter is data-driven                                                                                                                            |
| `bun run check:plan-catalog`                                         | not run, no plan feature key changed                                                                                                                                                                                   |
| Phase 0                                                              | **blocked** on host-supplied Agoda + Booking.com listings                                                                                                                                                              |

**Still open:** see [§20](#20-launch-checklist-what-is-left). The multi-channel UI and guest-form labels shipped dark on 2026-11-17; Phase 0 and the adapter facts that follow it are the only blockers to enabling a channel. Wiring `classifyCalendarOverlap` to the channel registry belongs to the conflict plan. Airbnb behaviour for its own nights is unchanged: its reservations are never treated as echoes, and relay never publishes a channel's own nights back to it.

### Phase 2 shipped dark (2026-11-17)

| Area             | Result                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rollout gate     | `calendarChannelRollout.ts` + 6 Deno tests; `addFeed` uses it; GET returns `connectableProviders`                                                                                                            |
| Channel sync UI  | List of channels with status, hub checklist, setup view with the two steps, per-channel warnings, paused state, guarded close; `channelSyncView.ts` (9 tests) and `ChannelSyncDialog.test.tsx` (7 DOM tests) |
| E2E              | `ui/e2e/features/pricing/channelSync.spec.ts`: 3 cases at 375, 768, 1024 px, 9 passed                                                                                                                        |
| Guest form       | `?source=agoda\|booking`, completion link takes the stored channel, labels, no payment step, find-us options                                                                                                 |
| Money and access | Booking patch, guest trip payment, guest review path, CSV import now use the shared OTA rule (an Agoda stay no longer keeps a down payment after an edit, or shows a balance on the trip page)               |
| Copy             | Booking detail badge, trip "Paid through {channel}", calendar tooltip "Synced from a connected channel"                                                                                                      |

### Phase 0 findings so far (2026-11-17)

| #             | Booking.com (real feed, test property)                                                                                                                                                                                    | Agoda                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| S1            | Host `ical.booking.com`, path `/v1/export?t=<uuid>`. Allowlist `booking.com` covers it (the redundant `admin.` and `ical.` entries were dropped)                                                                          | Waiting: listing created 2026-11-17, Agoda approval takes 1 to 3 days |
| S2            | `200 text/calendar` from a normal client. **No ETag or Last-Modified**, `cache-control: no-store`, so every pull is a full fetch (304 handling is unused for this channel). Not yet verified from the hosted edge runtime | Waiting                                                               |
| S3 to S7, S13 | **Open.** The feed is empty (no closed dates, no reservations), so the event format, UID stability and cancellation behaviour are unknown. Needs one closed date and, if possible, one reservation                        | Waiting                                                               |
| Engine        | Local live run against the real feed: `empty_feed_pull_1` guard fired, second pull `unchanged`, no failures. Fixture: `_shared/__fixtures__/calendar/booking_com_empty.ics`                                               | n/a                                                                   |

## 20. Launch checklist (what is left)

**Safe to merge and deploy dark now.** Airbnb behaviour is unchanged and the new channels cannot be
connected until `CALENDAR_CHANNELS_ENABLED` is set.

### Needs the host (blocked on real listings)

| #   | Item                                                                                                                                                                                                                                         | Why it cannot be done without a listing                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Agoda:** listing created 2026-11-17, waiting on Agoda approval (1 to 3 days). **Booking.com:** link provided and connected on the local seeded property (Monaco 2604); still needs a closed date and a reservation on the Booking.com side | An agent cannot create or link OTA listings                                                                                         |
| H2  | Run the Phase 0 sheet ([§12.1](#121-phase-0-spike-checklist-real-links)) and paste the answers                                                                                                                                               | Public docs do not give the link host, event format or UID stability (re-checked 2026-11-17: partner help describes the steps only) |

### Follows H1 and H2 (small, mechanical)

1. Set Agoda `hostSuffixes` and URL shape from S1, and `classifyEventKind('agoda')` from S3 and S4 (both registry copies, parity test).
2. Capture sanitized fixtures under `_shared/__fixtures__/calendar/` and add the table-driven tests in §12.2.
3. Build `uidStrategy: 'dateRange'` only if S6 shows unstable UIDs.
4. QR / WhatsApp fallback only if S12 shows Agoda masks links.
5. Set `CALENDAR_CHANNELS_ENABLED=agoda,booking_com` and `CALENDAR_CHANNELS_BETA_ORG_IDS=<test tenant>` on the dev project, run the live QA matrix ([§13](#13-live-qa-matrix)), then widen to beta orgs, then clear the beta list.
6. Zero phantom bookings over 7 days on beta before GA.

### Copy that changes at launch (X12)

`PLAN_FEATURE_LABELS` ("Airbnb, Agoda & Booking.com calendar sync"), `featureGateCopy.ts`, the Pro card bullet in `planPresentation.ts`, `/for-hosts/pricing`, `plans-feature-matrix.md`, `docs/guides/support/faqs.md` ("Does Kame replace Airbnb or Agoda?", "How do I connect Airbnb or another OTA calendar?", the Agoda "not yet" answer), the Host-facing knowledge Q&A, then `check:support-content`, `check:ai-knowledge-coverage` and `check:plan-catalog`.

### Deliberately not built before launch

| Item                                             | Reason                                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parser-drift probe on `/admin/health`            | Needs a change to the shipped system-health RPC and a second live channel to mean anything. Required before GA (Phase 5), not before a dark deploy                             |
| Synthetic load test (§12.7)                      | The pool, ordering and cap are unit-tested. Real p95 per feed comes from `calendar_sync_runs` once a second channel is live                                                    |
| `addFeed` handler test per channel               | The handler harness only covers the auth contract. The gate logic is a pure function with its own tests; the add path is covered by the DOM and E2E specs against a mocked API |
| Conflict-plan wiring (`classifyCalendarOverlap`) | Belongs to that plan; relay and echo do not depend on it                                                                                                                       |
| Vrbo and "Other calendar"                        | Removed, not deferred (owner decision 2026-11-17)                                                                                                                              |

### Decisions the host should confirm (defaults chosen)

1. The booking edit source picker lists Agoda and Booking.com after merge. Default: yes, because an unlisted source would turn into Direct on save.
2. Deploy dark now and light up per environment. Default: yes.

### Hosted rollout runbook (test tenant first)

There is one hosted Supabase project (`fworvijbrwpyngycotbz`, dev and production). Deploys go through
`.github/workflows/cd-prod.yml` and need the `kamewave` unlock. The code ships dark, so the order is:

1. Merge #493 and let the pipeline deploy it. Nothing changes for hosts: only Airbnb is connectable.
2. Set the rollout secrets for the test tenant only (Supabase dashboard, Edge Functions, Secrets, or
   `supabase secrets set ... --project-ref fworvijbrwpyngycotbz`):
   `CALENDAR_CHANNELS_ENABLED=agoda,booking_com` and
   `CALENDAR_CHANNELS_BETA_ORG_IDS=<organization id of kame-test-tenant>`.
   Edge secrets apply to new invocations, no redeploy. Rolling back is clearing the first secret.
   The test tenant id is `f50a7039-365c-4ef9-a80e-867d51ed5372`. Both secrets were set on 2026-11-19.
   Live verification status, the verified cron and database state, and the hosted pass that proved V1
   and V2: [`../for-testing/multi-channel-calendar-sync-live-verification.md`](../for-testing/multi-channel-calendar-sync-live-verification.md).
3. In `kame-test-tenant` / `kame-test-property`, Pricing, Channel sync: connect Booking.com (paste the
   export link; sending dates turns on by itself), copy the Booking.com link into Booking.com
   Sync calendars. Leave **Create bookings** off.
   Connecting needs the Pro `calendarSync` feature. The test tenant was put on Pro on 2026-11-19
   (`source` `admin`, one-year period) so the connect path can be exercised. Its property is `INACTIVE`
   on purpose, so the export link answers `410` and the channel cannot reach **Two-way** there. Use it to
   prove the connect path only; prove the send side on a live property.
4. Close one date and make one test reservation on Booking.com, then read the fixture from the feed
   and fill S3 to S7 and S9 to S11. Repeat for Agoda once approved.
5. Widen: clear `CALENDAR_CHANNELS_BETA_ORG_IDS` only after the live QA matrix passes and the host copy
   in "Copy that changes at launch" is published.

## 21. Two-way sync UX (2026-11-19)

**Problem.** The dialog split each channel into "From {channel}" and "To {channel}". Hosts could not tell
that these are the two halves of one two-way sync. Connecting a channel only turned on the **get** half:
sending our dates stayed off until the host found a separate, property-wide switch, so a new connection
was one-way by default.

**Decisions.**

1. Each channel is one two-way connection with two numbered steps: **Get dates from {channel}** and
   **Send dates to {channel}**. A step gets a check only when that direction is proven.
2. `addFeed` turns date sharing on when it is off (unless `pricing.channel_sync` is paused). Failure is
   logged and never fails the connect. Activity: `integrations.config_changed`, `auto: channel_connected`.
3. Channel status is two-way aware: **Two-way** needs a healthy import **and** a read of our link in the last
   48 h; **Finish setup** covers connected-but-not-proven; a channel that stops reading for 48 h raises a
   `read_stale` warning (**Needs attention**). Pure logic in `channelSyncView.ts` (`receiveHealth`,
   `sendHealth`), 7 unit tests.
4. The property-wide switch moves to the channel list as **Send dates to channels** with a **?**. A
   per-channel send switch is not built: the export token is per property and sharing a calendar with one
   channel and not another has no safe meaning in the hub model.
5. Recent activity covers both directions per channel: import events plus the latest read of our link
   (`buildChannelReadActivityRow`). The GET returns up to 20 events per feed instead of 30 across all
   feeds, so a busy channel cannot crowd out a quiet one. A connected channel with no events shows
   "No activity yet". Read history is not stored, only the latest read.
6. Existing connections with sharing off show **Finish setup** and a **Turn on** button. No migration.

**Two-way coverage by channel.**

| Direction or rule                                | Airbnb    | Agoda                         | Booking.com                    |
| ------------------------------------------------ | --------- | ----------------------------- | ------------------------------ |
| Get dates (import feed)                          | live      | built, dark, adapter facts H1 | built, dark, event format H2   |
| Send dates (`ical-export?as=`)                   | live      | built, dark                   | built, dark                    |
| Sending turns on at connect                      | yes (new) | yes (new)                     | yes (new)                      |
| Proof the channel reads our link                 | yes       | yes                           | yes                            |
| Hub relay to the other channels, echo protection | yes       | yes                           | yes                            |
| Imported reservations become bookings            | on        | off until Phase 0 (opt-in)    | off until Phase 0 (opt-in)     |
| Verified with a real listing                     | yes       | waiting on Agoda approval     | feed empty, needs closed dates |

Dates block both ways for all three channels. The only gap before launch is real-listing proof for
Agoda and Booking.com (H1, H2), which also decides whether Create bookings can default on for them.

**Tests for this change.** Vitest: `channelSyncView` (two-way status), `calendarSyncActivity` (send row,
merge), `ChannelSyncDialog` DOM (27: list, statuses, steps, validation, guard, loading, error, paused,
empty activity, both-direction activity, view-only). Deno: `calendarExportEnable_test.ts` (4). Playwright
`channelSync.spec.ts` at 375, 768 and 1024 px (12). Not covered by an automated test: the handler's
auto-enable against a real database, and live Agoda or Booking.com runs (H1, H2).

**Docs touched:** route guide `org/property/pricing.md`, support FAQ "How do I connect Airbnb or another
OTA calendar?". Plans/RBAC: N/A (no new gate; existing `calendarSync` and `pricing.channels:edit`).
