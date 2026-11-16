---
title: 'Pricing — operator guide'
status: active
tags: [guides, routes, org, property]
updated: 2026-09-03
---

# Pricing — operator guide

Route: `/org/:orgSlug/property/:propertySlug/pricing`

> **Status:** Documented — unified pricing calendar with booked-stay pills, date blocking, and Channel Sync (iCal).

Legacy `/calendar` redirects here.

## Progress overview

| Section                  | E2E save | Validation | Docs | Notes                                                                    |
| ------------------------ | -------- | ---------- | ---- | ------------------------------------------------------------------------ |
| Pricing rates and fees   | Done     | Done       | Done | Weekday/weekend defaults + fee sidebar                                   |
| Per-date rates           | Done     | Done       | Done | Future, available nights only                                            |
| Booked stays on calendar | Done     | Done       | Done | Spanning pills; click for guest modal                                    |
| Block / unblock dates    | Done     | Done       | Done | Checkout-exclusive ranges                                                |
| Channel sync (iCal)      | Done     | Done       | Done | Airbnb connectable; hub relay + echo rules shipped — Pro+ `calendarSync` |
| Smart Pricing            | Done     | Done       | Done | Pro+ `smartPricing` — Autopilot or Review/Apply, engine + AI             |
| Guest availability       | Done     | Done       | Done | Blocks are returned as unavailable ranges                                |
| Permissions              | N/A      | Done       | Done | `pricing:view` / rates + blocks + `pricing.channels:*` leaves            |

---

## Overview

Property **Pricing** is the single place to manage nightly rates, see booked stays, and
block dates. Nightly list prices appear on unbooked nights (including past). Booked nights
show the stay pill, not a cell price; click a stay to open guest details and jump to the
booking record.

Parking listings use the same grid at `/org/:orgSlug/parking/:parkingSlug/pricing` (base
rates only — no fee sidebar). See [Parking Pricing](../parking/pricing.md).

Rates, fees, holiday rules, and Smart Pricing settings are bulk-copyable via org **Properties → Copy settings** (date overrides and blocked dates are not).

---

## Host-facing knowledge

Pricing is where a host updates future rates, sees which nights are occupied, and closes
dates that should not be available to guests.

**Common host questions**

- Q: How do I see who is staying on a night?
  A: Booked stays appear as colored pills spanning check-in through the night before
  check-out. Hover a pill for the guest, dates, and total. Click the pill to open details.
- Q: Can I change the rate on a booked night?
  A: No. Booked nights show the guest stay, not a list price. Open the stay to see the
  booking amount; change pricing on the booking itself if needed.
- Q: Why do some days have no price?
  A: Booked nights hide the list price and show the guest stay instead. Open nights -
  including past ones - still show the nightly amount.
- Q: Can I close dates without creating a booking?
  A: Yes. Select future available nights and choose Block. Guests cannot select or submit
  those nights.
- Q: Can I block a date that already has a booking?
  A: No. Existing booked nights must be handled through the booking itself.
- Q: Can I reopen only part of a blocked range?
  A: Yes. Select the blocked nights you want to reopen and choose Unblock. The other nights
  remain blocked.
- Q: Will changing rates update existing bookings?
  A: No. Bookings with saved pricing keep their amounts. Updated defaults apply to future
  pricing reviews that do not already have saved amounts.
- Q: Do the default down payment and security deposit apply to Airbnb bookings?
  A: No. Those defaults are for direct and Facebook bookings. Airbnb collects the stay payment
  and any deposit on their platform, so Airbnb bookings hide both fields and keep them at zero.
- Q: Where do I connect Airbnb or other OTA calendars?
  A: Pricing → **Channel sync** (Airbnb today; Agoda and Booking.com to selected hosts first). Tap a
  channel, paste its export link in step 1, and copy your Kame link back in step 2.

---

## Permissions

| Capability                               | Required permission             |
| ---------------------------------------- | ------------------------------- |
| Open Pricing route                       | `pricing:view`                  |
| Edit rates / fees / overrides            | `pricing.rates:edit`            |
| Block dates                              | `pricing.blocks:add`            |
| Unblock dates                            | `pricing.blocks:delete`         |
| View Channel Sync                        | `pricing.channels:view`         |
| Connect / edit / sync feeds              | `pricing.channels:edit`         |
| Copy guest form link (imported stay)     | `bookings.detail.workflow:edit` |
| Smart Pricing (settings, preview, apply) | `pricing.smartPricing:edit`     |

- Without rate/block leaves, the calendar and fee sidebar stay read-only for that action.
- Server: GET → `pricing.channels:view` + `calendarSync` plan; PATCH → `pricing.channels:edit` + `calendarSync`. Legacy stored `pricing:edit` still expands to all three rate/block leaves.
- Channel Sync also requires plan feature **`calendarSync`** (Pro / `growth` and above) — see below.
- The **Channel sync** header button is hidden without `pricing.channels:view`. View-only members see feeds and can copy the export link; connect/remove/sync require `pricing.channels:edit`.
- Below Pro, the button shows a **Pro** plan pill (`TierBadge` / `TierBadgeAnchor` on `calendarSync`) — same pattern as Import on Bookings.

---

## Channel Sync (Airbnb, Agoda, Booking.com iCal)

**Channel sync** button in the Pricing page header (desktop outline button aligned with the title; mobile hero icon). Below Pro, a corner **Pro** pill signals the plan gate. Opens a **`ResponsiveModal`** (`ChannelSyncDialog`) with two views:

- **Channel list** (default): one row per channel with a status chip (**Not connected**, **Syncing**, **Needs attention**, **Paused**), "Imported 12 min ago" and, once Share is on, "Agoda read your link 2 h ago". A short info box explains the flow. Once **two or more channels** are connected it becomes the **hub checklist** (connect each channel only to Kame Space; remove links between channels; block dates in Kame Space). **Recent activity** sits below and names the channel on every line.
- **Channel setup** (tap a row, **All channels** to go back): warnings for that channel, an eligibility hint, then **1. Bring {channel} in** (connected feeds, paste-link form) and **2. Send Kame Space to {channel}** (Share switch, copy link, where to paste it, last read time).

While settings load, the body is a skeleton. A pasted link that has not been connected is an unsaved draft: closing the dialog with one typed asks to keep editing or discard (`useGuardedClose`); the back button drops it.

**Which channels appear:** the server returns `connectableProviders` for the org. **Airbnb** is always connectable. **Agoda** and **Booking.com** appear only when the rollout gate allows them (see below), or when the property already has a feed for them. They are built, tested and dark in production until Phase 0 confirms their real link formats. Kame Space supports only these three channels: there is no Vrbo and no "other calendar" link, and every link must be on that channel's own host. A property may have **at most 6 active feeds**, and connecting a URL that is already connected on the same property is refused. Plan feature **`calendarSync`** (Pro / `growth` and above) is shared by every channel; the modal is **preview-open** below Pro (full UI browsable); **Connect** (Pro pill on the button) and turning on **Share** (Pro pill beside the label) open the upgrade modal. Server enforces the feature on writes (`calendar-sync-settings` PATCH, `calendar-sync-cron`).

**Rollout gate (ops):** `calendar-sync-settings` `addFeed` allows a provider when the registry baseline says so (Airbnb) **or** the edge secret `CALENDAR_CHANNELS_ENABLED` lists it (`agoda,booking_com`), optionally limited to organizations in `CALENDAR_CHANNELS_BETA_ORG_IDS` (comma list of org ids; empty means everyone). Unknown values enable nothing. The gate only affects **adding** a connection: existing feeds, cron, Sync now and the export link are untouched. Order: test tenant, named beta orgs, everyone.

**Feature availability (super-admin):** Keys `pricing.channel_sync` (modal panel), `pricing.channel_sync.import` (feeds, Sync now, cron) and per-channel `pricing.channel_sync.airbnb` / `.agoda` / `.booking_com`. A paused channel is skipped by the cron without counting a failure, `addFeed` refuses it, the row shows **Paused**, and its export link keeps serving (blocking dates stays safe). **`ical-export` is never gated** so every channel keeps receiving booking blocks. Header button stays enabled and opens the dialog with the reason panel when the parent is off (maintenance panel wins over a settings load error).

**Per-channel warnings (setup view):** link failing (`health = error`); the channel never read our link after 24 h while Share is on ("Agoda hasn't read your link yet. Check it's pasted in Calendar connections."); Booking.com closed-dates echo ("Booking.com is sending back closed dates. Export reserved dates only."). **Eligibility hints:** Agoda needs a room type with exactly 1 room; Booking.com turns calendar links off when a channel manager is connected.

### Bring a channel in (import)

Progressive disclosure: empty and connected states do not show the same stack of cards.

- **Empty (editable):** one empty state (icon, "Pull {channel} dates into this calendar", a short pitch) and the connect form. The URL is **required** and validates on change against that channel's host rules (Airbnb also needs the `/calendar/ical/` path). Invalid → inline error; **Connect** stays disabled until valid. Below Pro, a valid URL + Connect opens the upgrade modal. **?** help on the label shows that channel's steps.
- **Empty (view-only):** icon + "No {channel} calendar is connected for this property."
- **Optional label removed** — a connected feed displays as its channel name (server still accepts an optional label if sent).
- **Connected card:** name + health badge on one row; status line under it (`Synced …` / `Waiting for first sync`); Sync now + Remove icons top-right. **Create bookings** sits on its own bottom row with a helper line and the switch. There is one card per connected calendar and no second Connect button while one is connected (remove, then reconnect).
- **Polling:** `calendar-sync-cron` runs every 10 min and syncs a feed at most once per 30 min (2 min claim slack so a feed is not skipped an extra interval). Busy nights land as **synced blocks** (`source='ical_import'`). Each run writes a `calendar_sync_runs` row, which is what makes the real cadence measurable.
- **Read health:** GET `calendar-sync-settings` returns `export.reads` (last time each channel read the Kame link, from `calendar_export_reads`, recorded on 200 **and** 304), `lastRun` per feed, and `echoWarning` per feed. The Channel sync list and setup view render them as the "read your link" line and the warnings above.
- **Hub relay:** a stay imported from channel A is published on the export links for channels B and C, never back to A. A stay that also has a live booking is published once. Imported host blocks are never relayed, so channel-side blocks stay channel-side.
- **Echo protection:** if a channel sends back nights Kame already published to it (within 72 hours), those nights are kept as blocks but never become bookings, and the sync logs `skipped` with `export_echo`.
- **Booking.com closed-dates warning:** when two or more events in one pull exactly match nights Kame served Booking.com, the feed records `echoWarning`. The setup fix is to export **reserved dates only** in Booking.com's Sync calendars.
- **Create bookings:** every connected feed has a **Create bookings** switch. It is **on by default for new Airbnb feeds** and **off by default for Agoda and Booking.com**, because their calendars do not yet tell a stay from a closed date (a closed date would become a placeholder booking). The switch shows a note saying so. When on, each `Reserved` event also becomes a real **Pending review** booking in Kame, with no guest email or guest-facing side effect until details exist. Turning it on runs a sync immediately. Existing feeds keep their stored value until the host flips it.
- **No duplicates:** if the host already entered the same Airbnb stay by hand (same property, dates, and `Airbnb` source), the sync links the existing row instead of creating a second one. Reconnecting a removed feed also re-links the existing row by reservation UID.
- **Past stays:** reservations whose checkout is already past are skipped, so enabling ingestion does not fill Bookings with old stays.
- **Guest form link:** open an imported stay on the Pricing calendar, then **Copy guest form link**. The link opens the guest form with the stay dates locked. Requires `bookings.detail.workflow:edit`. **Open in {channel}** is shown when the feed supplied a reservation URL. The guest form shows the channel's name (`?source=airbnb|agoda|booking`, or the stored channel for a completion link): "Agoda Name", "Message host via Agoda", no payment step.
- **Info box:** the channel list explains the flow (dates block, bookings appear, dates booked here close elsewhere).
- **Health:** Connected (never synced yet) / Synced / Retrying / Needs fix (4+ failures → `calendar_sync_failing` notification). The badge never says Synced when `lastSuccessAt` is null.
- **Remove:** confirm dialog; optional **Also delete dates this calendar added**.
- **Recent activity:** on the channel list, only when a feed is connected and host-facing events exist (last ~5). Each row names the channel, uses plain labels (busy dates, bookings, conflicts), readable stay ranges and tone icons. Rate-limit and no-op skips (`min_interval_or_locked`, `no change`) are hidden.

### Send Kame Space to a channel (export)

- Modal width ~**36rem** for room for help + long URLs.
- **Share this property's dates** switch (+ **?** help) — one switch for the whole property, **off by default** (opt-in). Enables the token-guarded iCal URL (`…/ical-export/calendar.ics?property=…&token=…&as=airbnb`, always `https://` on hosted) so Kame bookings + manual blocks appear on Airbnb without echoing Airbnb’s own imports. The path ends in `.ics` because Airbnb rejects import URLs that do not. Turning **on** below Pro opens the upgrade modal; turning **off** is always allowed.
- **Paste into {channel}** (+ **?** help with that channel's steps; Airbnb: Calendar → Availability → Connect calendars → Import calendar) — one URL + **Copy**. Paste the full link into Airbnb’s “Other website link” field.

### When dates do not block on a channel

Work through these in order; each one is visible on the page or in Recent activity.

1. **Feed failing?** Health badge shows Retrying or Needs fix, and `lastError` names the cause. Re-paste the channel's export link.
2. **Never read our link?** The channel row reports `exportNeverRead` after 24 hours. Re-paste the Kame link on the channel side and press **Sync now**.
3. **Echo warning?** The channel is exporting closed dates as well as reservations. Export **reserved dates only**.
4. **Channel-specific eligibility?** Agoda needs a room type with exactly one room; Booking.com removes pasted calendar links once a channel manager is connected.
5. **Direct link left in place?** The host pasted one channel's link into another. Remove it; connect each channel only to Kame.
6. **Still blocked after the channel's own refresh window?** Check the stay's source: a cancelled or past stay no longer blocks.

### Conflicts

If Airbnb reports a night that already has a live Kame booking or manual block, the sync still imports the Airbnb busy night, records one `conflict_detected` audit event per overlap, and raises **one** `calendar_conflict` notification for that sync’s conflict set (not one toast per overlap). Connect / Sync now shows a single warning toast with the conflict count; the matching realtime toast is suppressed briefly so it does not double up. Background cron still surfaces one in-app toast when a new conflict set appears. Detail lives under **Recent activity** and the Notifications bell. Kame never overwrites the existing booking or manual block.

**Host Q&A**

- Q: Where do I connect my Airbnb calendar?
  A: Pricing → **Channel sync** → **Airbnb** → step 1 → paste Airbnb’s Export calendar URL. Hover **?** for steps. You need Pro or higher.
- Q: How do I block Airbnb when someone books here?
  A: Channel sync → **Airbnb** → step 2 → turn on Share → copy the link into Airbnb’s import calendar field. The link must end with `.ics` before the `?` (Kame’s copy button already does that). Use HTTPS; do not shorten the URL.
- Q: Airbnb says something went wrong when I paste our link.
  A: Re-copy from Channel sync after Share is on. Confirm the address looks like `…/ical-export/calendar.ics?property=…&token=…&as=airbnb`. Older links without `.ics` or that start with `http://` fail Airbnb’s check.
- Q: Does changing a nightly rate here change Airbnb’s price?
  A: No. Channel Sync shares **availability** only. List prices on this page are for Kame guest booking / admin pricing review.
- Q: Can I edit or unblock a date that came from Airbnb?
  A: No. Synced nights are read-only on the calendar. They clear when Airbnb drops the date or you remove the feed.
- Q: Can I sync Booking.com or Agoda?
  A: Not yet for most hosts. Airbnb is the only channel you can connect by default. Agoda and Booking.com are being tested with real listings first. Kame Space supports only Airbnb, Agoda and Booking.com, so other platforms such as Vrbo cannot be connected.
- Q: How often does Kame check my Airbnb calendar?
  A: About every 30 minutes. Each check is recorded, so support can confirm the real interval when a date looks late.
- Q: Will a booking from one channel block my other channels?
  A: Yes, once more than one channel is connected. Kame is the hub: an imported stay is published to the other channels' calendars, never back to the channel it came from. Imported host blocks are not relayed, so block dates in Kame if they should stop every channel.
- Q: Why does an imported booking have no guest name?
  A: The channel sends dates only, so Kame creates the stay with a placeholder name such as "Airbnb guest". Use Copy guest form link to collect the guest's details against that same booking.
- Q: Should I link Airbnb and Agoda directly to each other?
  A: No. Connect each channel only to Kame. Direct links between channels repeat the same nights back and forth, which makes duplicate blocks and false conflict warnings.
- Q: Booking.com shows Kame nights as its own bookings. Why?
  A: Booking.com is probably set to export closed dates as well as reservations. In Booking.com, open Sync calendars and export **reserved dates only**. Kame ignores those echoes, but your calendar stays cleaner once the setting is fixed.
- Q: I got a conflict warning after connecting Airbnb. What do I do?
  A: Both calendars kept their nights. Open Notifications or Channel sync → Recent activity for the dates, then remove the booking or block on the side that should not have it.
- Q: What does Recent activity show?
  A: The latest useful sync changes under From Airbnb: busy dates imported or cleared, bookings added or linked, and conflicts. Quiet “already synced” checks are hidden.
- Q: Does connecting Airbnb create bookings in Kame?
  A: Yes, by default for a new feed. Each reservation appears as a Pending review booking. You can turn **Create bookings** off for a feed at any time. Dates still block either way.
- Q: I already entered an Airbnb booking by hand. Will the sync duplicate it?
  A: No. If the dates and Airbnb source match, Kame links your existing booking instead of creating a second one. Reconnecting a feed also re-links the existing booking.
- Q: Where do I get the guest form link for an Airbnb guest?
  A: Open the imported stay on the Pricing calendar, then tap **Copy guest form link** and paste it into the Airbnb message thread. The guest sees the stay dates locked.
- Q: Why is an old Airbnb stay missing after I turned Create bookings on?
  A: Stays whose checkout is already past are skipped on purpose. Only current and upcoming reservations are imported.

---

## Smart Pricing (AI dynamic nightly rates)

**Plan feature `smartPricing` — Pro (`growth`) and above**, same gate as Channel Sync.
**Smart Pricing** button in the Pricing header (desktop outline button; mobile hero icon,
`Wand2`) with a **Pro** `TierBadge` below the tier. Opens `SmartPricingDialog`
(`AdminDialogShell`) — **preview-open** below Pro. Strength, limits, and update mode stay
editable in the dialog. **Turn on**, the enable switch, **Preview**, and **Apply** show a Pro
pill and open the upgrade modal. Settings are not saved until the plan includes Smart Pricing.

### What it does

Recommends a nightly rate for every future night (rolling window, default 365 days) from
**your own** calendar: which weekdays and months book best (learned from ~24 months of
bookings), your season/holiday ranges, last-minute softness, and 1–2 night orphan gaps
between two bookings. Every rate is `base × capped demand multipliers × your holiday rules`,
clamped to your **minimum / maximum price** and rounded. The learned demand signals can never
move a night more than **±6 % (Gentle) / ±12 % (Balanced) / ±22 % (Bold)** off your base —
your own holiday rates are applied on top and are not capped. An optional AI pass adds a
plain-language rationale and flags where the curve looks off; it never sets the number.

### The panel

`AdminDialogShell` (`42rem` wide): fixed title + footer, scrollable body. **No subtitle, no
stepper, no marketing intro.** While settings load, the body and footer are skeletons of this panel: the toggle row, plus the
three controls when that form will be on screen. Same grids at every width.

**Off** — toggle + short status line + footer **Turn on**.

**On** — three controls (save on change, no Save button). Short help only where needed:

1. **Strength** — Gentle (±6%) · Balanced (±12%) · Bold (±22%), plus one line: how far each
   night can move before holiday rates. Balanced default.
2. **Price limits** — Never below / Never above (auto-fill ≈ 90% / 125% of weekday base).
3. **When prices update** — When I approve (default) or Automatically, plus one line for the
   active choice (approve vs nightly auto).

Footer: **Preview** (or **Preview again** once rates are live). Preview runs with
`explain: false` — the UI builds its own month/day facts from engine factors.

**Turning it off asks first.** Confirm resets nights to saved rates and clears applied
recommendations. That confirm is the only undo surface.

### Preview

- Compact headline: **₱X → ₱Y** + chip (`No change` / `+₱N` / `−₱N` — always the peso delta
  when totals move) + “Next N open nights”.
- Month heatmap (old + new price on changed cells). Opens on first month with changes.
  **Tap a night** for that date’s factor lines (`Day of week +5%`, named holiday rule, etc.).
- **This month** — counts + drivers scoped to the visible month
  (`Weekends lower` / `avg −₱100 · 4 nights`, named rules, gap / last-minute / floor). Hint:
  “Tap a night for its breakdown.” No AI-written bullets.
- Footer: **Back** + **Apply** / **Apply now**. Applying closes the modal and toasts.

### On the calendar

Nights priced by Smart Pricing show the recommended rate with a small **`Wand2`** marker
(emerald), distinct from a manual **Custom** rate (`PenLine`, amber). Hover for the price and a
**Smart Pricing** tag; a legend entry appears under the grid. The **Pricing summary** row adds
a **Smart Pricing** card counting the applied nights in view.

### Guardrails

- **Booked, blocked, manually-priced ("locked"), and past nights are never touched.** A host
  date override always wins; the engine skips it entirely.
- Every rate is clamped to your min/max (or a conservative `0.6×–2.5×` base when unset), and
  the learned demand signals can never move a night more than your chosen ±% on their own —
  only your own holiday rules can exceed it.
- A move under 2% is treated as noise and left at your base rate — no rec, no marker.
- Low forward occupancy is **never** read as "cut the price" — that nudge only ever fires
  upward, and only once a stretch is genuinely nearly full (> 85%).
- **Cold start (new listing / thin history).** With fewer than 20 elapsed booked nights, an
  empty forward calendar means "no signal", not "weak demand". Last-minute discounts and the
  booking-pace nudge are suppressed entirely, and the only demand-curve effect is a small
  fixed weekend premium (Fri/Sat/Sun) — weekdays are untouched. A new listing only moves off
  **your own** weekend split and season/holiday rules; it sharpens automatically as bookings
  land.
- Smart Pricing sets the rate for **Kame guest bookings + the admin pricing review** only — it
  does **not** change Airbnb's price (Channel Sync shares availability, not rates).
- **Downgrade below Pro:** smart rates stop applying to guest quotes and the calendar
  immediately (recommendations are ignored, **not deleted**); your manual rates and date
  overrides take over. Re-upgrading resumes from the saved settings.

**Host Q&A**

- Q: Will Smart Pricing change a night I already priced by hand?
  A: No. Any night you set a custom price on is locked — Smart Pricing never overwrites it.
  Set the night back to default to release it, or turn Smart Pricing off (with confirmation) to
  clear every applied recommendation at once.
- Q: Does it change what Airbnb charges?
  A: No. It only affects Kame guest bookings and the pricing review on a booking. Channel Sync
  shares availability, not prices.
- Q: What if I have almost no booking history?
  A: It shows a **New listing** note and makes only small, safe moves off your weekend and
  season/holiday rules — no blanket discount (see _Cold start_ under Guardrails). Set a
  sensible minimum price; that is the most important control until bookings build up.
- Q: "Suggest changes" vs "Update automatically"?
  A: "Suggest" shows you the changes to approve first. "Update automatically" applies them
  overnight and notifies
  you when the change is meaningful.

### Permissions

Managing Smart Pricing uses its own leaf, **`pricing.smartPricing:edit`**, because autopilot can
rewrite every rate and calls the AI. Editing rates by hand stays on `pricing.rates:edit`.
Members without the Smart Pricing leaf do not see the button; the server checks it on settings
PATCH, preview, and apply. Existing roles that had `pricing.rates:edit` were backfilled.

### API and data

| Concern                           | Path                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings load/save + read context | `smart-pricing-settings` (GET `pricing:view` preview-open, returns `{ settings, appliedCount, resolvedBase, history }`; PATCH `pricing.rates:edit` + `smartPricing`) |
| Build a preview (no apply)        | `smart-pricing-preview` (POST) — freezes the run on `property_smart_pricing_runs.payload`                                                                            |
| Apply / clear                     | `smart-pricing-apply` (POST `{ runId, ranges? }` or `{ clear: true }`)                                                                                               |
| Autopilot sweep                   | `smart-pricing-cron` (hosted `pg_cron`, nightly 01:30 Asia/Manila)                                                                                                   |
| Config                            | `property_smart_pricing_settings` (1 row/property)                                                                                                                   |
| Applied per-date rates            | `property_smart_pricing_recommendations` (`applied=true` merged into the effective rate)                                                                             |
| Run audit                         | `property_smart_pricing_runs`                                                                                                                                        |
| Engine (pure)                     | `_shared/smartPricingEngine.ts` · orchestrator `_shared/smartPricingRun.ts` · AI `_shared/smartPricingAi.ts`                                                         |

`property-pricing` GET now also returns `smartRecommendations` (YYYY-MM-DD → nightly) and
`smartPricingEnabled`. Full design: [`../../../../architecture/smart-pricing.md`](../../../../architecture/smart-pricing.md).

---

## Pricing grid

Month grid titled **Rates & availability** (_Manage pricing and availability_ on desktop), with the legend under the grid on **`lg+` only** (hidden on phone/tablet to save vertical space). Close the date
modal with the X or Escape (no Cancel button).

**Selecting a range:** desktop uses **click-drag** across day cells. On phone/tablet (`max-lg`) there is no pointer drag, so the grid switches to a **two-tap** model — tap the first date (cell shows a thick primary border; no tip banner — it caused layout shift), then tap the end date to commit and open the date modal. Tap a booked/locked cell to clear an armed start without committing. Tapping the same date twice sets a single-day selection. Selected / armed / today cells use a **border-only** highlight below `sm` (no outer ring) so the box does not clip against neighbors or stay pills; desktop keeps the soft ring. Day cells are shorter (`min-h-[3.5rem]`) below `sm`. Mobile chrome: card title shortens to **Pricing**, month nav uses **MMM yyyy** (e.g. Sep 2026), and booked-stay pills use a denser ~20px lane (avatar + label) so they fit the small cells. Same handlers as desktop (`onDateMouseDown` → `onDateMouseEnter` → `onSelectionEnd`); shared `PricingCalendarGrid` so parking + property behave identically.

### Available nights

- Unbooked nights show the nightly list price at the bottom of the cell, including past
  dates. Weekday and weekend list rates apply by default; holiday rules and custom
  overrides adjust the amount.
- Select one or more **future, unbooked** nights to open the date modal: set a custom rate,
  reset to default, or block. **Block** sits on the left of the footer; **Reset** / **Apply**
  on the right. **Apply** only stores an override when the amount differs from that night's
  base rate (weekday/weekend/holiday); applying the default clears any override so the cell
  is not marked custom.

### Booked nights

- Occupied nights `[check-in, check-out)` **do not show a list price** in the day cell.
  **Booked** is the spanning stay pill (guest first name + avatar). Future booked cells stay
  a white card; past booked cells use a slightly muted surface and a faded pill.
- Pills anchor to the **bottom** of the cell (same band as the nightly price chip). Extra
  overlapping stays stack upward from there — a single stay does not float in the middle when
  another night in that week has two stays.
- Cancelled stays are included on the grid (muted pill) and render **above** active stays
  when they overlap the same night. They do not lock the night or hide the list price unless
  another non-cancelled stay also occupies it.
- A teal pill spans the stay across the week grid, inset to match the rate-chip width.
  Multiple stays stack in separate lanes when they overlap in the same week.
- The calendar shows up to **three** visible stay lanes per day. If a day has more than three
  overlapping stays, the cell shows a `+N` badge in the top-right. Hovering that badge lists
  the hidden bookings for that day.
- Click a stay pill to open the booking modal. Hover on the pill shows guest name, stay dates,
  and total. Booked day cells themselves do not show a stay tooltip; hover the pill instead.
  When two stays overlap, hover or click each pill — the cell does not pick a stay.

### Past nights

- Past **unbooked** cells are faded and not selectable. They still show the nightly list
  price (Airbnb-style), so you can see what that night was set to.
- Past **booked** cells remain clickable so the host can open the stay, but they hide the
  list price.

### Blocked nights

- Blocked nights use a muted cell with a ban icon. They cannot be selected for custom
  pricing until unblocked.
- Blocked nights still show the list price (with a ban icon), including past blocked
  nights.
- Blocking rejects past dates and any night that is already booked.

### Synced (Airbnb / OTA) nights

- Nights imported from a connected OTA calendar (Channel Sync) render with a **dashed muted
  cell and a sync icon** ("Synced from a connected channel" in the tooltip and legend).
- They are **fully read-only on the grid** — not selectable, not part of a drag range, and
  cannot be unblocked here. They still show the list price.
- They clear only when the OTA feed no longer lists the date (next 30-min sync) or the feed
  is removed. To turn one into an editable manual block, remove the feed with "keep the
  dates".

---

## Rates and fees sidebar

Weekday/weekend base rates, fee defaults (down payment, security deposit, pet, parking,
extra guest), and save flows for base-rate scope and fee-only updates.

---

## API and data

| Concern                               | Path                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Load/save pricing + calendar bookings | `property-pricing` edge function                                              |
| Blocked dates table                   | `property_blocked_dates` (`source` = `manual` \| `ical_import`)               |
| Date overrides                        | `property_pricing_date_overrides`                                             |
| Defaults                              | `app_settings` per property                                                   |
| Channel Sync feeds / export / events  | `property_calendar_feeds`, `property_calendar_export`, `calendar_sync_events` |
| Channel Sync API                      | `calendar-sync-settings` (GET/PATCH), `calendar-sync-cron`, `ical-export`     |

**GET** `property-pricing?month=YYYY-MM` returns defaults, overrides, `bookedDateKeys`,
`blockedDateKeys` (all sources), `importedBlockedDateKeys` (the `ical_import` subset — read-only
on the grid), and `calendarBookings` (stays overlapping that month, including cancelled).
Calendar bookings also carry `external_source`, `booking_source`, and a host-only
`reservation_url` parsed from the feed's reservation link (never sent to guests).

**PATCH** accepts rate/fee fields, `dateOverrides`, `blockRange`, and `unblockDateKeys`
(`unblockDateKeys` only frees `source='manual'` rows — synced nights are untouched).

Guest availability (`get-booked-dates`, `submit-form`) treats blocked nights as
unavailable alongside existing bookings, **regardless of source** — so an OTA-held date is
double-booking-safe the moment it syncs in.

---

**Unsaved changes.** Leaving with unsaved edits (another menu item, browser back, closing the tab) asks to **Save & leave**, **Discard**, or **Keep editing**. Save & leave runs the same validation as Save and stays on the page if it fails. Shared guard: [`unsaved-changes.md`](../../../../architecture/unsaved-changes.md).

## Implementation map

| UI                                                                             | Server                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/src/features/dashboard/pricing/pages/PropertyPricingPage.tsx`              | `supabase/functions/property-pricing/index.ts`                                                                                                                                      |
| `ui/src/features/dashboard/pricing/components/PricingCalendarGrid.tsx`         | `supabase/functions/_shared/propertyPricing.ts`                                                                                                                                     |
| `ui/src/features/dashboard/pricing/components/PricingCalendarBookingModal.tsx` | `supabase/functions/_shared/propertyBlockedDates.ts`                                                                                                                                |
| `ui/src/features/dashboard/pricing/routes/index.tsx`                           | —                                                                                                                                                                                   |
| Loading skeleton (`PricingPageBodySkeleton`)                                   | `ui/src/components/skeletons/PricingSkeleton.tsx` — 4 stat cards, the live month's week rows (day + price cells, outside days blank), rates card with 5 fee rows (stacked on phone) |
| `ui/src/features/dashboard/pricing/components/ChannelSyncDialog.tsx`           | `supabase/functions/calendar-sync-settings/index.ts`                                                                                                                                |
| `ui/src/features/dashboard/pricing/hooks/useCalendarSync.ts`                   | `supabase/functions/calendar-sync-cron/index.ts`                                                                                                                                    |
| `ui/src/features/dashboard/pricing/lib/calendarSyncApi.ts`                     | `supabase/functions/ical-export/index.ts`                                                                                                                                           |
| `ui/src/features/dashboard/pricing/lib/importedBooking.ts`                     | `supabase/functions/_shared/externalBookingIngest.ts`                                                                                                                               |
| —                                                                              | `supabase/functions/_shared/calendarSyncService.ts` / `calendarSyncRun.ts`                                                                                                          |

Spanning pill layout reuses `calendarDateUtils` and `CalendarOccupancySpanTrack` from the
bookings calendar module.

---

## Edge cases

- **Past nights:** not selectable for pricing or blocking edits. Unbooked past nights still
  show the list price; booked past nights do not.
- **Checkout morning:** not counted as an occupied calendar night.
- **Cancelled bookings:** shown as muted pills (above active stays when they overlap) but
  excluded from booked-night locks.
- **Month navigation:** refetches pricing + bookings for the visible month via
  `?month=YYYY-MM`.
- **Synced (OTA) nights:** read-only on the grid — the block/unblock selection skips them
  entirely. Removing a feed with "keep the dates" converts them to editable manual blocks;
  otherwise they disappear on the next sync once the OTA feed drops the date.
- **Imported stays:** with **Create bookings** on, each reservation is a booking pill on the
  grid. Opening it shows **Copy guest form link** (pending review + permission) and **Open in
  Airbnb** (when the feed supplied a URL).
- **Turning ingestion off:** stops new bookings. Existing imported bookings stay, and Airbnb
  cancellations and date changes still reconcile.
- **Feed failures:** after 4 consecutive failed pulls the dialog shows `Error` and a
  `calendar_sync_failing` notification fires once; syncing resumes automatically when the
  next pull succeeds.

---

## Testing

| Layer       | Path / spec                                                                                                                                                                                                                                                                                                                                                                                                   | Manual                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Unit        | `smartPricingEngine_test.ts`, `calendarSyncService_test.ts` (incl. the PII-free export), `externalBookingIngest_test.ts`, `calendarChannels_test.ts`, `bookingChannel_test.ts`, `calendarEchoRules_test.ts`, `calendarSyncPool_test.ts`, `calendarRelay_test.ts`, `calendarSyncCadence_test.ts`, `ui/.../pricing/lib/importedBooking.test.ts`, `calendarChannelUrl.test.ts`, `calendarChannelsParity.test.ts` | —                              |
| Integration | `supabase/functions/_shared/calendarSyncRun_integration_test.ts` (local Postgres: create, adoption, relink, past skip, relay own-vs-other channel, relay dedupe, echo creates no booking)                                                                                                                                                                                                                     | Local stack required           |
| E2E         | `ui/e2e/features/dashboard/dashboardModulesSmoke.spec.ts` pricing shell (`@ci`)                                                                                                                                                                                                                                                                                                                               | AI preview, channel sync OAuth |
| N/A         | Polotno/canvas internals                                                                                                                                                                                                                                                                                                                                                                                      | Manual calendar sync guide     |
