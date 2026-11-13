---
title: 'Calendar sync conflicts: smart detection and host resolution'
status: planned
tags: [workflow, planned, calendar, integrations, airbnb, ical, bookings, notifications, ux]
updated: 2026-11-14
stage: planned
kind: plan
---

# Calendar sync conflicts: smart detection and host resolution

Follow-up to the shipped [`../done/airbnb-calendar-sync.md`](../done/airbnb-calendar-sync.md).
Intake item: "Airbnb conflict" in [`../intake/_to-dos.md`](../intake/_to-dos.md).

## Problem (host's view)

1. After an Airbnb sync, hosts get **Calendar conflict** toasts and notifications, and the Pricing
   calendar shows what looks like a double booking, often with the **same guest name** twice.
2. **Clicking the notification does nothing.** There is no way to see what conflicts, or to fix it.
3. Most flagged "conflicts" are **not real**. They are the same stay seen twice, or Airbnb echoing
   our own calendar back. Real double bookings are rare, and they get lost in the noise.

## Goal

- Only flag an overlap when it is a **real problem**, and say which kind it is.
- Recognise "same stay recorded twice" and offer a one-tap **Merge**.
- Give every conflict a home: notification, Needs attention, Pricing calendar and booking detail
  all open the same **Calendar conflicts** review sheet with clear actions.
- Conflicts **clear themselves** when the overlap goes away (cancelled on either side, dates moved).
- Fix the upstream causes so fewer duplicates are created in the first place.

Non-goals: changing Airbnb from our side (iCal is read-only), payouts reconciliation, Booking.com /
VRBO (still Airbnb-only in the UI), parking (calendar sync is property-only: `N/A`).

---

## 1. Root-cause audit (what is broken today)

Evidence from code as of 2026-11-14. Production frequency is **not yet measured** (see §2).

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                    | Where                                                                                                            | Impact                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| F1  | **Notification click is a dead end.** `resolveNotificationPath` only routes rows with `booking_id` or `conversation_id`. `calendar_conflict` (and `calendar_sync_failing`) set neither, so the click only marks the row read.                                                                                                                                                                              | `ui/.../notifications/lib/notificationsPaths.ts:30`, `InAppNotificationsPanel.tsx:101`, `calendarSyncRun.ts:355` | "Nothing happens"                    |
| F2  | **A rescheduled Airbnb stay conflicts with itself.** Block reschedule (step 5b) runs the conflict pass **before** `reconcileExternalBookings` (5e) moves the linked booking. `findConflicts` never excludes the booking that carries the same `external_uid`, and that booking still has the old dates.                                                                                                    | `calendarSyncRun.ts:641-678`, `:293-311`, `:731`                                                                 | False conflict                       |
| F3  | **Adopt / relink fire a conflict first.** Create (5a) runs the conflict pass before 5e adopts the host's own Airbnb row (exact dates) or relinks an orphaned row after a feed reconnect. The same stay is reported as a conflict, then linked seconds later. The notification is never withdrawn.                                                                                                          | `calendarSyncRun.ts:597-638`, `:1053-1105`                                                                       | False conflict                       |
| F4  | **Airbnb "Not available" blocks raise conflicts.** Anything that is not `Reserved` is classified `block`, yet the conflict pass runs for blocks too. Airbnb's export includes nights closed by **our own export** (echo), preparation-time nights and availability-window closures. Each one overlapping a Kame booking or manual block becomes a "conflict".                                              | `calendarSyncService.ts:140-149`, `calendarSyncRun.ts:637`                                                       | False conflict, probably the largest |
| F5  | **Removing a feed turns its imported nights into manual blocks.** `removeFeed` without `deleteData` rewrites `ical_import` rows to `source='manual'`. On reconnect, every reservation overlaps its own former block (conflict), and those "manual" blocks are now **exported back to Airbnb** as `Blocked`, which echoes again (F4). The Pricing calendar shows a block plus a booking on the same nights. | `calendar-sync-settings/index.ts:374-380`, `calendarSyncRun.ts:105-119`                                          | False conflicts in bulk              |
| F6  | **Duplicate detection is exact-match only.** `findAdoptableManualBooking` needs `booking_source='Airbnb'` **and** identical dates. A guest-form row one day off, a row whose source was left as Facebook, or a CSV-imported row creates a second `Airbnb HMxxxx` placeholder. If the host then sends **Copy guest form link** and the guest fills it, both rows carry the same guest name.                 | `_shared/externalBookingIngest.ts`                                                                               | Real duplicates, "same name twice"   |
| F7  | **The regular guest form rejects Airbnb guests after import.** `submit-form` throws `BOOKING_OVERLAP` because the imported placeholder already holds the nights. Hosts who put the regular `?source=airbnb` link in Airbnb scheduled messages get stuck guests and often re-key the stay by hand, which feeds F6.                                                                                          | `submit-form/index.ts:171-192`                                                                                   | Upstream cause of duplicates         |
| F8  | **Conflicts have no lifecycle.** Only an audit event plus one fingerprint-deduped notification. No open / resolved state, no auto-clear when either side is cancelled, no count for Needs attention, no "not a conflict" dismissal, so the same pair can come back.                                                                                                                                        | `calendarSyncRun.ts:343-394`                                                                                     | No way to manage                     |
| F9  | **Only checked when the import changes.** Overlaps are evaluated on import create/reschedule. The feed-hash short-circuit skips unchanged feeds, so a Kame-side change later (date edit, new manual block) is never checked against existing imports. Same-day stays (check-in = check-out) use a zero-length range and never overlap anything.                                                            | `calendarSyncRun.ts:284-333` (raw `dateRangesOverlap`)                                                           | Missed real conflicts                |
| F10 | **Every surface says "go look elsewhere".** Activity line: "Conflict: overlaps another booking" (no partner, no link). Notification body: raw `YYYY-MM-DD` and "Resolve on the platform that should not have it". Sync toast: "Check Notifications or Recent activity". The host loops between three places with no action anywhere.                                                                       | `ChannelSyncDialog.tsx:142`, `calendarSyncRun.ts:369-372`, `useCalendarSync.ts:49`                               | Confusing UX                         |
| F11 | **Pricing calendar has no conflict state.** Overlapping stays render as two lane pills with nothing saying they collide, or that they are the same stay.                                                                                                                                                                                                                                                   | `PricingCalendarSpanOverlay.tsx`, `PricingCalendarGrid.tsx`                                                      | Looks like a double booking          |
| F12 | **Same calendar connected twice.** Blocks from feed B overlap feed A's identical UIDs and report `other_feed` conflicts. Bookings are protected (`uid_on_other_feed`), blocks are not.                                                                                                                                                                                                                     | `calendarSyncRun.ts:313-330`                                                                                     | False conflict                       |
| F13 | **No proof Airbnb is reading our export.** `ical-export` does not record fetches, so the host cannot tell whether direct bookings reach Airbnb. That gap is where real double bookings come from. The original plan's "Airbnb last fetched" was never built.                                                                                                                                               | `ical-export/index.ts`                                                                                           | Real conflicts not prevented         |

---

## 2. Phase 0: measure before changing anything

The Supabase MCP was not authorized during planning, so these were not run. Run them read-only in
the SQL editor (or MCP with `SUPABASE_ACCESS_TOKEN`) against the multi-tenant project. They select
no guest PII.

**Q1. What are the logged conflicts really?**

```sql
with c as (
  select e.feed_id, e.external_uid, e.summary,
         e.detail->'partner'->>'kind' as partner_kind,
         e.detail->'partner'->>'id'   as partner_id
  from calendar_sync_events e where e.action = 'conflict_detected'
)
select c.partner_kind, coalesce(c.summary,'(null)') as airbnb_summary, count(*) as events,
  count(*) filter (where gs.external_uid = c.external_uid) as self_conflict,          -- F2/F3
  count(*) filter (where gs.id is not null and gs.external_uid is null
                   and lower(trim(gs.booking_source)) = 'airbnb') as manual_airbnb_row, -- F3/F6
  count(*) filter (where gs.status = 'CANCELLED') as partner_now_cancelled              -- F8
from c left join guest_submissions gs
  on c.partner_kind = 'booking' and gs.id::text = c.partner_id
group by 1, 2 order by 3 desc;
```

`airbnb_summary <> 'Reserved'` rows are F4. `partner_kind = 'manual_block'` rows need Q3.

**Q2. Live duplicate pairs (two live bookings, one imported, overlapping nights)**

```sql
with b as (
  select id, property_id, status, external_uid, guest_email is null as placeholder,
         lower(trim(booking_source)) as src,
         case when check_in_date  ~ '^\d{4}-' then check_in_date::date  else to_date(check_in_date,'MM-DD-YYYY')  end as ci,
         case when check_out_date ~ '^\d{4}-' then check_out_date::date else to_date(check_out_date,'MM-DD-YYYY') end as co
  from guest_submissions where status not in ('CANCELLED','IMPORTED')
)
select a.property_id, a.id as imported_id, o.id as other_id, a.placeholder,
       o.src as other_source, (a.ci = o.ci and a.co = o.co) as exact_dates,
       abs(a.ci - o.ci) as checkin_diff_days, abs(a.co - o.co) as checkout_diff_days
from b a join b o on o.property_id = a.property_id and o.id <> a.id
where a.external_uid is not null and a.ci < o.co and a.co > o.ci
order by a.property_id, a.ci;
```

**Q3. Ex-imported blocks now posing as manual (F5)**

```sql
select property_id, count(*) from property_blocked_dates
where source = 'manual' and (note ilike '% - Reserved' or note ilike '% - reservation'
                             or note ilike '% - block' or note ilike '% - Airbnb (Not available)')
group by 1;
```

**Q4. Imported block mix (F4 scale)**

```sql
select coalesce(external_summary,'(null)') as summary, count(*)
from property_blocked_dates where source = 'ical_import' group by 1 order by 2 desc;
```

**Exit:** a short table in this doc ranking F2 to F6 and F12 by count, plus one real example from the
host's property walked end to end. If Q2 shows a pattern not covered here, add it before Phase 1.

---

## 3. Design principles

1. **Airbnb is the truth for Airbnb stays.** Never auto-cancel anything. The OTA already sold it.
2. **Silent only when certain.** Auto-link only on proof (same UID, or same dates plus a matching
   signal). Anything fuzzy is a suggestion the host confirms.
3. **One conflict, one home.** Every entry point opens the same review sheet on the same record.
4. **Conflicts are state, not events.** They open, update, and close on their own.
5. **Explain the verdict.** Show why we think two rows are the same stay, in plain words.
6. **Stop creating duplicates** upstream (F5, F6, F7) rather than only cleaning them up.

---

## 4. Smart detection

### 4.1 Verdicts

Every overlap between an imported Airbnb event and something else gets exactly one verdict.

| Verdict              | Meaning                                                                 | Stored? | Severity | Notify        | Needs attention |
| -------------------- | ----------------------------------------------------------------------- | ------- | -------- | ------------- | --------------- |
| `same_stay`          | Same reservation (same UID, adopted, relinked, or auto-linked by proof) | no      | none     | no            | no              |
| `ota_block`          | Airbnb event is a block ("Not available"), not a reservation            | no      | none     | no            | no              |
| `possible_duplicate` | Looks like one stay saved twice; host confirms Merge                    | yes     | warning  | bell (see D3) | yes             |
| `double_booking`     | Two different stays on the same night                                   | yes     | critical | bell + push   | yes             |
| `blocked_night_sold` | Airbnb sold a night that is blocked in Kame Space                       | yes     | warning  | bell + push   | yes             |
| `duplicate_feed`     | The same Airbnb calendar is connected twice                             | yes     | info     | bell          | Channel sync    |

Ignored verdicts still write a `calendar_sync_events` row with `action='skipped'` and
`detail.reason = 'overlap_same_stay' | 'overlap_ota_block'` so support can see why nothing fired.
No CHECK widening needed for that.

### 4.2 Rules (pure function, evaluated in order)

New pure module `supabase/functions/_shared/calendarConflictRules.ts`:
`classifyCalendarOverlap(event, partner, ctx) → { verdict, confidence, signals[] }`.

Ranges use the **occupied** range (same-day stay = one night), the same helper `submit-form` uses,
so F9's zero-length gap closes.

1. Overlapping nights are all before Manila today → ignore (`expired`).
2. Event `kind = 'block'` → `ota_block`. It still blocks availability; it is never a conflict.
3. Partner booking is `CANCELLED` / `IMPORTED` → ignore.
4. Partner booking carries the same `external_uid` (any feed, or orphaned) → `same_stay`.
5. Partner is an imported block or booking from **another** feed with the **same** UID → `duplicate_feed`.
6. Partner is a reservation from another feed with a **different** UID → `double_booking`.
7. Partner is a booking without `external_uid` (direct, guest form, CSV, manual) → score signals:

   | Signal              | Test                                                                 | Weight |
   | ------------------- | -------------------------------------------------------------------- | ------ |
   | `confirmation_code` | Booking's Airbnb code (new optional field, §8.2) equals the feed's   | 5      |
   | `phone_last4`       | Feed DESCRIPTION last 4 equals last 4 digits of `guest_phone_number` | 4      |
   | `same_dates`        | Occupied ranges identical                                            | 3      |
   | `airbnb_source`     | `booking_source` is Airbnb (trimmed, case-insensitive)               | 2      |
   | `near_dates`        | Check-in and check-out each within 1 day                             | 1      |
   | `paid_direct`       | Down payment > 0 or a payment receipt exists (clearly a direct sale) | -3     |
   - `same_dates` + `airbnb_source` (today's adoption rule) **or** `same_dates` + `phone_last4` /
     `confirmation_code` → **auto-link** (`same_stay`, event `booking_linked`).
   - Score ≥ 5 → `possible_duplicate`, confidence `high`. Score 3 to 4 → `possible_duplicate`,
     `medium`.
   - Otherwise → `double_booking`.

8. Partner is a manual block → `blocked_night_sold`.

All rules get table-driven Deno tests in `calendarConflictRules_test.ts`, one case per F-row.

### 4.3 Engine changes (`calendarSyncRun.ts`)

- **Order:** remove `runConflictPass` from the block create/reschedule loops. Evaluate conflicts
  **after** `reconcileExternalBookings`, so adoption, relink and booking reschedules settle first
  (fixes F2, F3).
- **Full re-evaluation:** new `reevaluatePropertyConflicts(propertyId)` in
  `_shared/calendarConflictService.ts`. It loads every live imported reservation for the property
  (all feeds) plus live bookings and manual blocks, classifies every overlap, and reconciles the
  `calendar_conflicts` table (§5). It runs:
  - at the end of every feed run, **including** 304 / unchanged-hash runs (fixes F9);
  - on `GET calendar-conflicts` (so the sheet is always fresh);
  - after a resolve action;
  - from the two Kame-side paths that most often clear or create overlaps: booking cancel
    (`WorkflowOrchestrator.transition` to `CANCELLED`) and booking date edits. Fire-and-forget,
    non-fatal.
  - It **never** runs off a failed fetch, and never auto-clears on the first empty pull (respects
    the existing empty-feed guard).
- **Feed removal (F5):** keep imported blocks as `source='ical_import'` with `feed_id = NULL`
  instead of converting to `manual`. They keep blocking availability, are never exported, and a
  reconnect relinks them by `external_uid` (same idea as bookings). Channel sync shows
  "Old Airbnb dates: N nights. Clear" when orphans exist. Needs a migration only if the unique
  index or a CHECK blocks `feed_id IS NULL` on `ical_import` (verify).
- **Duplicate feed (F12):** at `addFeed`, compare the normalized URL against active feeds on the
  property and refuse a duplicate. At sync time, rule 5 catches older duplicates.
- **Notification (F8, F10):** replace `emitConflictSummaryNotification` with one notification per
  **newly opened** conflict set, verdicts `double_booking` / `blocked_night_sold` /
  `possible_duplicate` only, with `metadata.conflict_ids`, `metadata.verdict`, and human dates.
  Dedupe on the conflict ids, so an unchanged set never re-notifies.

---

## 5. Data model

New migration `<ts>_calendar_conflicts.sql`:

```sql
CREATE TABLE public.calendar_conflicts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id          uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  feed_id              uuid NOT NULL REFERENCES public.property_calendar_feeds(id) ON DELETE CASCADE,
  external_uid         text NOT NULL,
  external_booking_id  uuid REFERENCES public.guest_submissions(id) ON DELETE SET NULL,
  partner_kind         text NOT NULL CHECK (partner_kind IN ('booking','block','feed')),
  partner_booking_id   uuid REFERENCES public.guest_submissions(id) ON DELETE SET NULL,
  partner_block_id     uuid REFERENCES public.property_blocked_dates(id) ON DELETE SET NULL,
  partner_feed_id      uuid REFERENCES public.property_calendar_feeds(id) ON DELETE SET NULL,
  partner_key          text NOT NULL,              -- booking/block/feed id as text, for the unique key
  verdict              text NOT NULL CHECK (verdict IN
                         ('double_booking','blocked_night_sold','possible_duplicate','duplicate_feed')),
  confidence           text CHECK (confidence IN ('high','medium')),
  signals              text[] NOT NULL DEFAULT '{}',
  overlap_start        date NOT NULL,
  overlap_end          date NOT NULL,              -- exclusive
  ranges_fingerprint   text NOT NULL,              -- both sides' dates; a change reopens a dismissal
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution           text CHECK (resolution IN
                         ('merged','kept_both','not_a_conflict','cancelled_booking','removed_block',
                          'removed_feed','ota_cancelled','auto_cleared','expired')),
  resolved_by          uuid,
  resolved_at          timestamptz,
  first_detected_at    timestamptz NOT NULL DEFAULT now(),
  last_detected_at     timestamptz NOT NULL DEFAULT now(),
  notified_at          timestamptz,
  UNIQUE (feed_id, external_uid, partner_key)
);
CREATE INDEX calendar_conflicts_property_open_idx
  ON public.calendar_conflicts (property_id) WHERE status = 'open';
ALTER TABLE public.calendar_conflicts ENABLE ROW LEVEL SECURITY;  -- service role only
GRANT ALL ON public.calendar_conflicts TO service_role;
```

Reconcile rules:

- New pair → insert `open`.
- Existing `open` pair still overlapping → update verdict / signals / overlap / `last_detected_at`.
- `dismissed` pair with the **same** `ranges_fingerprint` → stays dismissed. Fingerprint changed →
  reopen (dates moved, decision may no longer hold).
- `open` pair no longer overlapping → `resolved` with the most specific reason:
  partner booking now `CANCELLED` → `cancelled_booking`; Airbnb event gone → `ota_cancelled`;
  block gone → `removed_block`; nights now in the past → `expired`; else `auto_cleared`.

Access control is the edge function (repo convention; RLS is not the boundary).

---

## 6. Server API

New edge function **`calendar-conflicts`** (`serveAdmin`, `verify_jwt = false` in `config.toml`,
scoped with `resolveScopedPropertyAccess`). Plan gate: `calendarSync` (same as Channel sync).

| Method / action                            | Permission leaf                              | Effect                                                                                      |
| ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET ?property=&status=open\|recent`       | `bookings:view`                              | Re-evaluates, then returns `{ conflicts[], counts }` with both sides enriched               |
| `PATCH merge { conflictId, keepId }`       | `bookings.detail.workflow:edit`              | Merge two rows into one (§6.1)                                                              |
| `PATCH markDifferent { conflictId }`       | `bookings.detail.workflow:edit`              | `possible_duplicate` → `double_booking`, stays open                                         |
| `PATCH keepBoth { conflictId }`            | `bookings.detail.workflow:edit`              | `dismissed` / `kept_both` (host will fix it on Airbnb). Reopens if dates change             |
| `PATCH notAConflict { conflictId }`        | `bookings.detail.workflow:edit`              | `dismissed` / `not_a_conflict`                                                              |
| `PATCH removeBlock { conflictId }`         | the leaf `property-pricing` uses for unblock | Unblocks the manual block via `unblock_property_blocked_dates` (`p_source_filter='manual'`) |
| `PATCH removeDuplicateFeed { conflictId }` | `pricing.channels:edit`                      | Removes the newer feed with `deleteData = true`                                             |

Cancelling or moving the Kame booking is **not** a new action. The sheet hands off to the existing
cancel flow (refund policy, reason picker) and date edit. Re-evaluation then closes the conflict
as `cancelled_booking` / `auto_cleared`.

Response DTO (UI type in `pricing/lib/calendarConflictsApi.ts`):

```ts
type CalendarConflictDto = {
  id: string;
  verdict: 'double_booking' | 'blocked_night_sold' | 'possible_duplicate' | 'duplicate_feed';
  confidence: 'high' | 'medium' | null;
  status: 'open' | 'resolved' | 'dismissed';
  resolution: string | null;
  overlap: { start: string; end: string; nights: number };
  airbnb: {
    feedLabel: string;
    start: string;
    end: string;
    confirmationCode: string | null;
    phoneLast4: string | null;
    reservationUrl: string | null;
    bookingId: string | null;
  };
  partner:
    | {
        kind: 'booking';
        bookingId: string;
        guestName: string;
        source: string | null;
        status: string;
        start: string;
        end: string;
        isPlaceholder: boolean;
      }
    | { kind: 'block'; blockId: string; note: string | null; start: string; end: string }
    | { kind: 'feed'; feedId: string; feedLabel: string };
  signals: Array<
    'confirmation_code' | 'phone_last4' | 'same_dates' | 'airbnb_source' | 'near_dates'
  >;
  canMerge: boolean;
  firstDetectedAt: string;
};
```

Phone last 4 is already shown to hosts by Airbnb; never return full numbers or raw DESCRIPTION.

### 6.1 Merge semantics

Postgres function `merge_ota_duplicate_booking(p_keep uuid, p_drop uuid)` (one transaction, takes
the feed advisory lock `calsync:<feed_id>` so a concurrent sync cannot interleave):

1. Lock both rows. Both live, same property, exactly one carries `external_uid`.
2. Move `external_source` / `external_uid` / `external_feed_id` / `external_raw` from the imported
   row to the keep row (clear first, the `(external_feed_id, external_uid)` index is unique).
3. Drop row is an **untouched placeholder** (`guest_email IS NULL`, `guest_form_completed_at IS NULL`,
   no finance rows, documents, messages or reviews) → hard delete (see D2).
4. Otherwise return `needs_cancel`. The edge function then calls
   `WorkflowOrchestrator.transition(drop, 'CANCELLED', { cancellation: { initiator: 'host',
reasonCode: 'duplicate', notifyGuest: false } })`. Verify `duplicate` exists in
   `CancellationReasonCode` and the DB CHECK; add it if not.
5. Keep row is pre-review and dates differ from the feed → move to feed dates (same guard as
   `relinkExternalBooking`). Past review → keep stored dates and show a warning in the sheet.
6. Activity log `booking.merged` (both ids, actor, feed). Conflict → `resolved` / `merged`.

`canMerge` is false when both rows already passed review; the sheet then explains that one must be
cancelled through the normal flow.

---

## 7. UI and UX

Run the **`competitive-ux-research`** skill on overbooking and duplicate-reservation flows
(Hostaway, Guesty, Hospitable, OwnerRez, Lodgify) before building the sheet, and record what we
borrow here. Invoke **`mobile-responsive`**, **`human-copy`**, **`accessibility`** on every UI slice.

### 7.1 One review surface: the Calendar conflicts sheet

`ResponsiveModal` (bottom sheet on phone, dialog `max-w-3xl` on desktop), owned by the Pricing
module: `ui/src/features/dashboard/pricing/components/conflicts/`. Opened by URL so every entry
point can deep link: `/org/:org/property/:slug/pricing?conflicts=open[&conflict=<id>]`. Closing
clears the params.

**List view** (grouped, most urgent first; empty groups hidden):

```
Calendar conflicts                                 [x]
--------------------------------------------------
Double booking (1)
  Jan 12 to 15 · 2 nights overlap
  Airbnb HM4K2P9Q  vs  Juan D. (Direct)          >
Possible duplicate (2)
  Feb 3 to 6 · same dates
  Airbnb HMX81 vs Ana R. (Airbnb)  [Merge]       >
Booked on blocked nights (1)
  Mar 1 to 2 · Owner block "Aircon repair"       >
--------------------------------------------------
Resolved recently (3)                       [show]
```

Possible duplicates with `high` confidence get an inline **Merge** button on the row, so the common
case is one tap plus confirm.

**Detail view** (pushes inside the sheet, with Back):

```
< Back                      Double booking
--------------------------------------------------
Two different guests have the same nights.
Kame Space can't change Airbnb. Pick which stay keeps them.

 Airbnb                      Kame Space
 Reserved                    Juan D. · Direct
 Jan 12 to 15 (3 nights)     Jan 13 to 16 (3 nights)
 HM4K2P9Q · phone ··1234     Pending review
 [Open in Airbnb]            [Open booking]

 Overlap: Jan 13, Jan 14
 [12][13][14][15][16]   (overlap nights highlighted)
--------------------------------------------------
[Cancel Kame booking]  [Change dates]
[Keep both, I'll fix it in Airbnb]
```

Phone: the two cards stack (Airbnb on top), the action bar is sticky at the bottom inside the safe
area, 44px targets. Desktop: cards side by side.

**Actions by verdict:**

| Verdict              | Primary                                                       | Secondary                                       | Tertiary                                  |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `possible_duplicate` | **Merge into one booking**                                    | These are different stays (`markDifferent`)     | Open both bookings                        |
| `double_booking`     | **Cancel Kame booking** (existing cancel flow, reason preset) | Change dates (existing edit)                    | Keep both, fix in Airbnb + Open in Airbnb |
| `blocked_night_sold` | **Remove my block**                                           | Keep block, cancel in Airbnb (+ Open in Airbnb) | Not a conflict                            |
| `duplicate_feed`     | **Remove duplicate calendar**                                 | Not a conflict                                  |                                           |

Merge confirm shows the outcome before it happens:
"Keep Ana R.'s details and link Airbnb HMX81. The empty Airbnb entry is removed." When the drop row
has guest data, the confirm asks which details to keep (two radio cards).

**"Why we flagged this"** (possible duplicate only): plain bullets from `signals`, e.g.
"Same dates", "Phone ends in 1234 on both", "Booking source is Airbnb".

**States:** skeleton rows while loading; empty state "No calendar conflicts" with last sync time;
opening a resolved conflict from an old notification shows "Already resolved: merged by Mike on
Nov 14" instead of an error; read-only members see the detail without action buttons and a note
that an admin can resolve it; errors use the shared inline error with Retry.

### 7.2 Entry points (all open the sheet)

| Surface                            | Change                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Notification row, toast, push      | Type-aware routing: `calendar_conflict` → sheet (`conflict=<id>` when one, list when many). Fixes F1                        |
| `calendar_sync_failing`            | Route to Pricing with Channel sync open on From Airbnb                                                                      |
| Property dashboard Needs attention | New items `calendar-conflicts` (critical: double bookings + blocked nights sold) and `possible-duplicates` (warning)        |
| Org dashboard pending actions      | Per-property count rolled up from the same query                                                                            |
| Pricing page                       | Banner above the calendar: "2 calendar conflicts need a decision" [Review]                                                  |
| Pricing calendar                   | Conflict nights get a red top edge + marker; colliding pills get a ring; booking modal shows "Overlaps Airbnb HM… [Review]" |
| Booking detail                     | Banner on a booking that is part of an open conflict, with Review                                                           |
| Bookings list                      | Small conflict badge on affected rows (no new filter in v1)                                                                 |
| Channel sync dialog                | Feed row chip "2 conflicts"; Recent activity lines name both sides and link to the sheet; sync toast action "Review"        |

### 7.3 Copy (draft; finalize with `human-copy`)

- Notification titles: "Double booking on Jan 12 to 15", "Possible duplicate booking",
  "Airbnb booked nights you blocked", "Airbnb calendar added twice".
- Notification body: "Airbnb HM4K2P9Q overlaps Juan D.'s direct stay for 2 nights. Tap to review."
- Toast after Sync now: "Synced. 1 double booking found." [Review]
- Echo tooltip on an imported closed night: "Closed on Airbnb. Clears after Airbnb rechecks your
  calendar."

---

## 8. Prevention (fewer conflicts to begin with)

### 8.1 Airbnb guests using the regular form link (F7)

When `submit-form` hits `BOOKING_OVERLAP` and **every** overlapping row is an untouched imported
Airbnb placeholder:

- Phone last 4 (or confirmation code) matches and dates match → treat as completion: update the
  placeholder exactly like `submit-form-completion` (dates locked to the feed, status untouched,
  `guest_form_completed_at` stamped). No duplicate is ever created.
- No proof → decision **D1**. Recommended: accept as a new row and open a `possible_duplicate`
  conflict so the host merges with one tap, instead of blocking the guest.

Any overlap with a non-placeholder booking still rejects as today.

### 8.2 Stronger matching signals

- Optional **Airbnb confirmation code** field on the `?source=airbnb` guest form and on admin
  booking edit (new nullable `ota_confirmation_code` column). It turns fuzzy matches into certain
  ones. Placeholder hint: "Starts with HM".
- CSV import (`import-commit`): run the same classifier against existing imported rows and show
  likely duplicates in the import preview before commit.

### 8.3 Export health (F13)

- `ical-export` records `last_fetched_at` and user agent per export token (cheap single-row update,
  throttled to once per 10 minutes).
- Channel sync To Airbnb tab: "Airbnb last checked 2 hours ago". Warn when export is off while
  From Airbnb is connected ("Direct bookings are not reaching Airbnb"), and when Airbnb has not
  fetched for 24 hours.

### 8.4 Optional: just-in-time check

Before accepting a direct booking on the public form, fetch the property's Airbnb feeds (conditional
GET, 2 s timeout, fail open) and reject nights that Airbnb sold since the last sweep. Closes the
30-minute window. Ship only if Phase 0 shows real double bookings from that window.

---

## 9. Plans, permissions, activity log

- **Plans:** reuses `calendarSync` (Pro and above). No new plan key. Below Pro: feeds do not sync,
  so no new conflicts; existing open ones stay visible and resolvable.
- **RBAC:** reuses existing leaves (table in §6). No new leaf. Read-only members see conflicts.
- **Activity log:** `calendar.conflict_resolved` (verdict, resolution, actor), `booking.merged`,
  and the existing `system.cron_run` metadata gains `conflicts_opened` / `conflicts_cleared`.
  Auto-clear by the engine logs once per run, not per row.
- **Feature availability:** reuse `pricing.channel_sync`; no new catalog key.
- Parking: `N/A` (calendar sync is property-only).

---

## 10. Cleanup of existing data

One-shot, documented in `docs/archive/operations/migration-runbook.md`, run per environment:

1. Re-run `reevaluatePropertyConflicts` for every property with an active feed. This builds the
   `calendar_conflicts` table from current data with the new rules.
2. Convert F5 rows (Q3 match **and** a matching UID still in the live feed) back to `ical_import`
   orphans so they relink. Leave anything ambiguous as manual.
3. Mark existing `calendar_conflict` notifications read (they predate the new routing and point
   nowhere). New ones replace them.
4. Report counts before and after in this doc.

---

## 11. Phases

| Phase | Scope                                                                                                                                                                                                                                                     | Ships value alone?          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 0     | Run Q1 to Q4, rank causes, walk one real example                                                                                                                                                                                                          | Evidence                    |
| 1     | **Stop false alarms.** Pure classifier + tests; conflict evaluation moved after reconcile; skip `ota_block` and `same_stay`; occupied ranges; F5 removeFeed fix; F12 add-feed guard; interim F1 routing (notification opens Channel sync Recent activity) | Yes: noise drops right away |
| 2     | **Conflicts as state.** Migration, `calendarConflictService`, full re-evaluation incl. unchanged feeds and Kame-side hooks, auto-clear, new notification payload, `calendar-conflicts` GET, Needs attention items                                         | Yes: counts and auto-clear  |
| 3     | **Resolution UI.** Competitive research; sheet (list + detail); PATCH actions incl. merge function; final F1 routing; Pricing banner + calendar markers; booking detail banner; Channel sync updates                                                      | Yes: hosts can fix things   |
| 4     | **Prevention.** §8.1 form path, §8.2 confirmation code + CSV preview, §8.3 export health; §8.4 only if Phase 0 justifies it                                                                                                                               | Yes                         |
| 5     | **Cleanup + docs.** §10 backfill, docs and support content (§13), move to done                                                                                                                                                                            | Close-out                   |

---

## 12. Test plan

Deno unit (`calendarConflictRules_test.ts`), Deno integration (extend
`calendarSyncRun_integration_test.ts`, local Postgres), Vitest (paths, DTO mapping, copy helpers),
Playwright mocked E2E (`ui/e2e/features/pricing/`), manual device QA at 375 / 768 / 1024.

| #   | Scenario                                                              | Expected                                                                  | Covers |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| T1  | Airbnb reschedules an imported stay (+1 night)                        | No conflict; booking moves if pre-review                                  | F2     |
| T2  | Host's manual Airbnb row, exact dates, then first sync                | Linked, no conflict, no notification                                      | F3     |
| T3  | Feed removed (keep data) then reconnected                             | Bookings and blocks relink; zero conflicts                                | F3, F5 |
| T4  | Direct booking exported, Airbnb echoes "Airbnb (Not available)"       | `ota_block`, no conflict, nights still blocked                            | F4     |
| T5  | Guest-form row 1 day off, Airbnb source, phone last 4 matches         | `possible_duplicate` high; Merge leaves one row                           | F6     |
| T6  | Placeholder completed by guest **and** a second form row (same name)  | `possible_duplicate`; merge asks which to keep; other cancelled, no email | F6     |
| T7  | Different guests, overlapping nights                                  | `double_booking`, push sent once                                          | core   |
| T8  | Airbnb sells a night with a manual Kame block                         | `blocked_night_sold`; Remove my block clears it                           | core   |
| T9  | Same calendar added twice                                             | Add refused; legacy duplicate → `duplicate_feed`                          | F12    |
| T10 | Direct booking cancelled while conflict open                          | Auto `resolved` / `cancelled_booking`; Needs attention drops              | F8     |
| T11 | Airbnb drops the reservation                                          | Auto `ota_cancelled`                                                      | F8     |
| T12 | Host dismisses, then Airbnb changes dates                             | Conflict reopens                                                          | F8     |
| T13 | Admin edits a direct booking onto imported nights; feed unchanged     | Conflict opens without a feed change                                      | F9     |
| T14 | Same-day stay overlapping an import                                   | Detected                                                                  | F9     |
| T15 | Fetch fails during an open conflict                                   | Nothing auto-clears                                                       | guard  |
| T16 | Click conflict notification (bell, feed, toast, push)                 | Sheet opens on that conflict                                              | F1     |
| T17 | Old notification for a resolved conflict                              | "Already resolved" state                                                  | F1     |
| T18 | Read-only member opens the sheet                                      | Sees detail, no actions                                                   | RBAC   |
| T19 | Merge during a concurrent sync run                                    | Serialized by advisory lock; one row, provenance intact                   | race   |
| T20 | Regular `?source=airbnb` form on imported dates, phone last 4 matches | Completes the placeholder, no `BOOKING_OVERLAP`                           | F7     |

Gates per phase: `bun run lint`, `type-check`, `test`, `test:edge`, integration tests against local
Postgres, `test:e2e:smoke`, `build`.

---

## 13. Docs and support to update (in the same change as each phase)

- `docs/guides/routes/org/property/pricing.md` (Conflicts section rewrite, sheet, banner, markers)
- `docs/guides/routes/org/property/notifications.md` (where conflict notifications go)
- `docs/guides/routes/org/property/dashboard.md` (new Needs attention items)
- `docs/guides/routes/org/property/bookings-detail.md` (conflict banner, merged bookings)
- `.cursor/rules/booking-workflow.mdc` (merge, `duplicate` cancel reason, completion via regular form)
- `docs/architecture/overview.md` + `docs/PROJECT.md` (`calendar_conflicts`, `calendar-conflicts` fn)
- `docs/architecture/edge-functions.md`, `supabase/config.toml` (JWT policy)
- `docs/archive/operations/migration-runbook.md` (migration + §10 backfill)
- Host-facing knowledge Q&A + `docs/guides/support/faqs.md` (replace "Resolve on the platform that
  should not have it"); run `check:support-content` and `check:ai-knowledge-coverage`

---

## 14. Edge cases

- Same-day turnover (checkout = next check-in) is not an overlap. Same-day stays occupy one night.
- One Airbnb stay overlapping two Kame bookings → two conflicts, grouped under one reservation.
- Past nights never open or notify; open ones expire.
- Echo nights stay blocked after a direct cancel until Airbnb rechecks; tooltip explains, Sync now
  helps. Not auto-unblocked (the host may also have closed them on Airbnb).
- Placeholder with finance rows, documents or messages is never hard-deleted.
- Keep row already past review keeps its dates; sheet warns if Airbnb dates differ.
- Feed failing or first empty pull: no auto-clear.
- Plan downgrade: no new conflicts, existing ones still resolvable.
- Org-wide notification feed: conflict routing must resolve the property slug from `property_id`
  even when the host is on another property's page.

---

## 15. Decisions needed

- **D1.** Regular form, no proof of match (§8.1): **accept and flag as possible duplicate
  (recommended)** / keep rejecting with a clearer message / always auto-attach.
- **D2.** Untouched placeholder on merge: **hard delete (recommended, it holds no guest data)** /
  cancel with reason `duplicate` so it stays in history.
- **D3.** Possible duplicates: **bell + Needs attention, no push (recommended)** / push as well.
- **D4.** Review surface: **sheet on Pricing, deep-linked from everywhere (recommended)** / a new
  "Calendar conflicts" page.
