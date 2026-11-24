---
title: 'QA — Property Notifications'
status: active
updated: 2026-11-24
---

# 10 — Notifications

**Scope:** this file covers the Notifications module only: the in-app activity feed, the
bell sheet, Telegram delivery settings and the parking variant. It is not the Finance
module. Where it says "Finance" it means the Finance _notification group_, one of the six
Telegram modules on this page.

Routes:

- `/org/:orgSlug/property/:propertySlug/notifications`
- `/org/:orgSlug/parking/:parkingSlug/notifications`
- `/org/:orgSlug/notifications` (redirects to the last property's hub)

## Earlier pass (2026-08-30)

## Looks good

- Activity + six Telegram modules in one hub.
- Enable toggle plan-gated `telegramNotifications` (Starter+); edit/preview free.
- Deep links `?module=` work per guide.
- **Phase 3 (Chat module):** Enable without token allowed; **Save and test** after token; fake token → **Invalid bot token…** toast (server validation).
- **Phase 4:** Chat **Connected**; **Send preview** → **Preview sent**; shared **Save and test** → **Saved — @kamehome_maintenance_bot**.

## Issues (2026-08-30)

| Sev | Issue                                                                                       | Evidence  |
| --- | ------------------------------------------------------------------------------------------- | --------- |
| P2  | Six bots / modules is a lot of setup for a solo host — high time-to-value                   | Host lens |
| P2  | Shared bot token empty while modules already connected — Save and test disabled until paste | Phase 4   |
| P3  | Shared bot token guidance is good but still easy to misconfigure Chat IDs                   | Guide     |

## Improvements (2026-08-30)

- “Quick start”: one bot + one ops chat preset that enables Operations + Chat together.
- Prefill / “Use module token” for shared bot when modules already connected.
- Dashboard attention should deep-link into Activity with filter.

---

# Deep audit — 2026-11-24

Multi-resolution UI/UX review of the whole module (property, parking and the shared
Notification Center), run with the `impeccable` critique lens plus axe against mocked
data, then rebased onto `origin/main` (`5ec6bc7c3` + release commits) before any fix.

## Method

| Step        | What ran                                                                                                                                                                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Walk        | `ui/e2e/features/dashboard/notificationsAudit.spec.ts` (`@demo`, never CI). 11 journeys at 375 / 768 / 1440, plus parking, legacy redirect, empty, error, paused, deep-link and read-only states.                                            |
| Pair        | `NOTIFICATIONS_SHOTS=notifications-audit/before` on main, then `.../after` with the fixes. 33 states per side in `test-results/notifications-audit/{before,after}/`.                                                                         |
| Recording   | `PLAYWRIGHT_RECORD_VIDEO=1` run, clips in `test-results/notifications-audit/video/`.                                                                                                                                                         |
| A11y        | `@axe-core/playwright` over Activity, Activity/Manage and Telegram/Manage at 375 and 1440, WCAG 2.2 AA + best practice.                                                                                                                      |
| Code read   | `ui/src/features/dashboard/notifications/**`, both Notifications pages, `notifications-list`, `notifications-mark-read`, `notification-preferences`, `telegram-message-log`, `telegram-delivery-settings`, `_shared/notificationsAccess.ts`. |
| Tests added | Deno `_shared/notificationsPaging_test.ts` (9 cases), Vitest destination cases, 5 Playwright `@ci` journeys in `notificationsHub.spec.ts`.                                                                                                   |

## Result

`0` axe violations on all five audited surfaces after the pass. The
`KNOWN_A11Y_EXCEPTIONS['/notifications']` contrast entry (#334) is gone: it no longer
reproduced, and the one remaining failure it was hiding was real (see P2-4).

## Findings and status

Status legend: **Fixed** (in this change) · **Already fixed on main** (present in the
rebased base) · **Deferred** (with the reason).

### P1

| #   | Finding                                                                                                                                           | Status                    | What changed                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Desktop had no bell entry point and no unread indicator outside the page (`showFab` was `isBelowLg` only).                                        | **Already fixed on main** | Main passes `showFab={!aiMode}`, so the Quick access pill renders at `lg+` too. Re-verified in the before/after pair and covered by a new `@ci` test.                                                                               |
| 2   | Permission lock was `pointer-events-none opacity-60`: keyboard users could type into a locked bot-token field, and nothing explained the dimming. | **Fixed**                 | New `TelegramModuleEditLock` composes the existing settings-editable context with the module leaf. Fields, toggles, Connect and Manage buttons are now natively disabled and readable; one line says "Some modules are view only…". |
| 3   | The Telegram delivery master switch was offered to members who cannot use it (server PATCH needs one module edit leaf).                           | **Fixed**                 | `NotificationsManageDialog` takes `deliveryEditable`; the switch is disabled when the caller has no module edit. Reading the state still works.                                                                                     |

### P2

| #   | Finding                                                                                                                                                | Status        | What changed                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4   | Unread state was invisible to screen readers (colour + `aria-hidden` dot only).                                                                        | **Fixed**     | Each unread row carries an `sr-only` "Unread". Verified with axe and the row snapshot.                                                                                                                                                                                   |
| 5   | Push preferences and Quiet hours disappeared when the device was not subscribed, so account-level mutes could not be changed from a desktop.           | **Fixed**     | The Manage Activity tab always renders the preference switches and Quiet hours. The device opt-in and its explanation stay above them.                                                                                                                                   |
| 6   | Tapping review / pricing / billing / maintenance rows marked them read and did nothing (`resolveNotificationPath` returned null after the read fired). | **Fixed**     | Rows without a destination render as static text (no hover, no click, no read). Rows that do have one now resolve to reviews, pricing, maintenance, analytics, plans, settings or finance.                                                                               |
| 7   | Keyset pagination on `created_at` alone skipped rows that share a timestamp (bulk inserts).                                                            | **Fixed**     | Cursor is now `<created_at>\|<id>` with a tie-break filter, the same shape `list-activity-log` uses. Legacy cursors still work. Deno tests cover it.                                                                                                                     |
| 8   | Inbox rows collapsed after the fetch, so a chatty thread could shrink a 20-row page to one row; the same conversation could repeat on the next page.   | **Fixed**     | `fillNotificationPage` reads up to four batches to fill the page and always returns a cursor that cannot skip rows. Repeats are deduped on the client, which already collapsed the flattened pages.                                                                      |
| 9   | Two Telegram KPI numbers cost six edge requests per visit (`useTelegramHubStats`).                                                                     | **Mitigated** | The module settings queries now cache for 60s, so re-entering the hub or refocusing the tab no longer refetches all six. A single summary endpoint is the next step; deferred because it duplicates credential resolution and would need its own tests and config entry. |
| 10  | The error state showed `0` unread while the feed said "Could not load", and the retry line sat at the top of a full-height card.                       | **Fixed**     | KPIs show `n/a` on a failed list, and the retry state is centred like the empty state.                                                                                                                                                                                   |
| 11  | Touch targets under 44px: **Mark all as read** (`h-8`) and **Show more** (`min-h-[32px]`).                                                             | **Fixed**     | Both are 44px tall on phones and keep the compact height at `sm+`.                                                                                                                                                                                                       |
| 12  | The Quick access pill covered the last feed rows on phone and tablet.                                                                                  | **Fixed**     | The Activity and Telegram scrollports reserve bottom padding, so the last row can scroll clear of the pill.                                                                                                                                                              |

### Routing

| #   | Finding                                                                                                                                | Status    | What changed                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| 23  | `/org/:orgSlug/notifications` rendered the public 404 ("This page wandered off"), dropping an authenticated host out of the dashboard. | **Fixed** | New `OrgNotificationsRedirect` inside the org shell resolves the org from the URL and lands on the last property's hub. |

### P3

| #   | Finding                                                                                   | Status                     | What changed                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | KPI values read `0/6`, which scans like a fraction or a date.                             | **Fixed**                  | Values read `0 of 6`.                                                                                                                                                       |
| 14  | "Telegram on" and "Connected" look identical until the hint is opened.                    | **Partly fixed**           | The Messages card gained a hint. No warning tone was added: amber/red text fails contrast on the card surface.                                                              |
| 15  | Manage → Telegram was card-in-card-in-card (modal, outer block, module card, toggle row). | **Fixed**                  | The outer bordered block is gone. Delivery sits on the modal surface with a divider, module cards are the only borders.                                                     |
| 16  | "Last 15 days" floated under a short history list.                                        | **Fixed**                  | Moved into the Telegram card header, right of the title.                                                                                                                    |
| 17  | History rows do not say which chat or group received a message.                           | **Deferred**               | `telegram_message_log` stores the message, module, status and error, not the chat label. Showing a raw chat id would be worse; this needs a column and a backfill decision. |
| 18  | `?module=` stayed in the URL after the sheet closed, so a refresh reopened it.            | **Fixed**                  | Closing the sheet removes the param with `replace`.                                                                                                                         |
| 19  | Quiet hours sent a PUT on every `type="time"` change.                                     | **Fixed**                  | Local draft, 500ms debounce, flush on blur and unmount (the last edit survives closing the sheet).                                                                          |
| 20  | `NotificationBell`'s `fab` variant was dead code (no call site).                          | **Fixed**                  | Removed with its badge styles.                                                                                                                                              |
| 21  | Tablet KPIs were ~132px tall with the value pinned to the bottom.                         | **Not reproduced on main** | Main's `StatCard` renders a compact card; the tall version came from uncommitted work in the old worktree.                                                                  |
| 22  | "Messages" and "Unread" both count inbox threads, which reads as a double count.          | **Fixed**                  | The Messages card explains it: threads waiting for a reply, also counted in Unread.                                                                                         |

## Accessibility

| Finding                                                               | Status      | Where                                                                     |
| --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- |
| `aria-allowed-role`: `role="listitem"` on the bottom tab bar's links. | **Fixed**   | `BottomTabBar` drops the invalid list roles; native nav semantics remain. |
| `region`: the Quick access pill sat outside every landmark.           | **Fixed**   | The pill is an `<aside aria-label="Quick actions">`.                      |
| `color-contrast` 3.78:1 on the destructive push message.              | **Fixed**   | Informational limitation copy uses foreground ink, not destructive red.   |
| Unread not announced (P2-4).                                          | **Fixed**   | `sr-only` label.                                                          |
| #334 `/notifications` exception in the axe sweep.                     | **Removed** | The route now passes the sweep with no exception.                         |

## Security and permissions

| Finding                                                                                                                                                                                                 | Status            | Note                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| The feed is org-wide for property and parking members: `notifications-list` filters only `organization_id`, so `bookings:view` on one property exposes every property's guest names, dates and amounts. | **Open decision** | Documented behaviour, not changed here. Confirm with product whether property-scoped members should see the org feed. |
| UI gating now matches the server for Telegram edits (module leaves, delivery switch). Parking uses its single `notifications:edit` leaf for all three modules, which matches `telegramAssetScope`.      | **Fixed**         | Covered by an `@ci` read-only test.                                                                                   |
| Mark-read by id stays org-checked; prefs validate groups, times and IANA zone; history and settings are asset-scoped; history text is escaped.                                                          | **Verified**      | No change needed.                                                                                                     |

## Copy

- "0 of 6", "Last 15 days" and the view-only line are short, plain, and free of AI tells.
- Quiet hours uses a straight apostrophe now (`can't`), matching the rest of the app.
- No em dashes were added to UI strings.

## Evidence

- Spec: `ui/e2e/features/dashboard/notificationsAudit.spec.ts`
- Before/after: `test-results/notifications-audit/before/*.png`, `test-results/notifications-audit/after/*.png`
- Recordings: `test-results/notifications-audit/video/*.webm`
- CI coverage: `ui/e2e/features/dashboard/notificationsHub.spec.ts` (`@ci`), axe sweep, Deno paging tests, Vitest destination tests.
