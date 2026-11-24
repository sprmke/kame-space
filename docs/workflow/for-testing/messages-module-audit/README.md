# Messages module UX audit (host + guest)

Date: 2026-11-24
Scope: dashboard Messages (`/org/:orgSlug/property/:propertySlug/messages`, `/org/:orgSlug/parking/:parkingSlug/messages`) and guest Messages (`/account/messages`, `/properties/:propertySlug/messages`).
Method: live local stack (seeded org `kame-homes` / property `kame-home` / parking `monaco-level-2-slot-27`), real API calls, then a mocked Playwright tour for replayable evidence.

## Artifacts

| Artifact             | Path                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| Findings report      | this file                                                                               |
| One-clip walkthrough | [`video/00-full-walkthrough.mp4`](./video/00-full-walkthrough.mp4) (75s, six scenarios) |
| Visual walkthrough   | [`video/`](./video) (6 slow-motion clips + the combined file)                           |
| Screenshots          | [`shots/`](./shots) (viewport captures + measured geometry)                             |
| Visual report        | [`index.html`](./index.html) (videos + key evidence in one page)                        |
| Replayable tour      | `ui/e2e/features/inbox/messagesTour.slowmo.spec.ts`                                     |
| UX contract tests    | `ui/e2e/features/inbox/messagesUx.spec.ts`                                              |

```bash
bun run test:e2e:messages                 # mocked UX contracts (CI lane)
bun run test:e2e:messages:tour            # headed, slow motion
bun run test:e2e:messages:tour:video      # headed, slow motion + video
```

Videos are written to `test-results/playwright/<scenario>/video.webm`. The clips under
`video/` in this folder are a curated, renamed copy of those runs.

Media under `shots/` and `video/` is local evidence and gitignored by repo policy
(`never commit QA screenshots`). The report keeps the evidence file names so a future run can
be compared shot by shot.

## Resolution status (fix branch `fix/messages-module-ux`)

All items are addressed in code unless marked deferred. Before/after captures:
`ui/e2e/artifacts/messages-ux/{before,after}/<width>/` (local, gitignored), produced by
`ui/e2e/features/inbox/messagesVisualCapture.spec.ts`.

| ID   | Status   | What changed                                                                                                                                                                                 |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-01 | Fixed    | `upsertConversation` adopts an existing website chat for the guest (property or parking scope) when the insert trips the unique index, and rewrites the thread id. Pure lookup + Deno tests. |
| M-02 | Fixed    | Guest property chat error is a short retry card ("We couldn't open this chat"); transport detail goes to Sentry.                                                                             |
| M-03 | Fixed    | Search-empty wins over the Chat-tab empty branch, and mock preview no longer masks it.                                                                                                       |
| M-04 | Fixed    | Quick reply delete asks first and names the reply and the org-wide effect.                                                                                                                   |
| M-05 | Fixed    | Realtime deltas are filtered per cached list (platform / status / search) with unit tests.                                                                                                   |
| M-06 | Fixed    | Import state comes from `deriveMetaImportState`: a missing state row with conversations, or an import older than 24h, is no longer "importing".                                              |
| M-07 | Fixed    | Guest Messages title is **Messages**.                                                                                                                                                        |
| M-08 | Fixed    | Unread guest threads are semibold and expose "N unread" to screen readers.                                                                                                                   |
| M-09 | Fixed    | Empty preview reads "No messages yet".                                                                                                                                                       |
| M-10 | Fixed    | Phone tabs fit the row (measured at 375) and the sync pill moves to its own row below `sm`.                                                                                                  |
| M-11 | Fixed    | Quick Access is suppressed on phone/tablet whenever a thread is open; phone list gets bottom padding so the FAB never covers the last row.                                                   |
| M-12 | Fixed    | Guest hub height is measured from the real top edge, tab bar and consent bar (with a MutationObserver for the consent variable).                                                             |
| M-13 | Fixed    | Insert opens a bottom sheet on phone, popover on desktop.                                                                                                                                    |
| M-14 | Fixed    | Message actions are a bottom sheet on phone; the desktop menu keeps its scroll-dismiss behavior.                                                                                             |
| M-15 | Fixed    | An open phone thread hides the channel tabs; back restores them.                                                                                                                             |
| M-16 | Fixed    | Resource hub is snap-scrollable with a right-edge fade instead of looking clipped.                                                                                                           |
| M-17 | Fixed    | Inbox fill-main padding adds `--cookie-consent-h`; the guest hub subtracts it from its height.                                                                                               |
| M-18 | Fixed    | Quick reply picker shows a one-line body preview (tokens stripped) on desktop and phone.                                                                                                     |
| M-19 | Partly   | Sparse tablet canvas accepted (one thread is one row). A guest "new chat" entry point is a product feature, not shipped here.                                                                |
| M-20 | Fixed    | Parking switcher/title uses the readable name; the compact code is only a fallback.                                                                                                          |
| M-21 | Fixed    | Host composer has `aria-label="Message"`.                                                                                                                                                    |
| M-22 | Fixed    | Status chips are 44px on phone.                                                                                                                                                              |
| M-23 | Fixed    | Host Send is 44px on phone, compact on desktop.                                                                                                                                              |
| M-24 | Fixed    | Live regions announce new inbound messages on host and guest threads; unread counts are real text for assistive tech.                                                                        |
| M-25 | Fixed    | Message ⋮ gets an invisible 44px hit pad on touch.                                                                                                                                           |
| M-26 | Fixed    | Preview data only on local / `*.vercel.app` / `*.local` hosts (or explicit env), never on the production host.                                                                               |
| M-27 | Fixed    | 15s **Taking longer than usual. Retry** under the host list/messages skeletons and the guest hub skeleton.                                                                                   |
| M-28 | Fixed    | Typed reply + attachments are kept per thread for the session; sending clears the entry.                                                                                                     |
| M-29 | Deferred | Optimistic send needs server idempotency to avoid duplicate bubbles; left for a follow-up.                                                                                                   |
| M-30 | Verified | Thread search matches were already memoized.                                                                                                                                                 |
| M-31 | Fixed    | Guest Messages exposes an `h1` (visually hidden) in every state.                                                                                                                             |

## What the module does today

Host (property)

- Channel tabs `All / Chat / Facebook / Instagram`, a Meta sync status pill, and auto-select of the newest thread in the split layout.
- Thread list: search, `All / Unread / Pending / Replied`, virtualized above 30 rows, infinite load, "Load older from Meta".
- Conversation: bubbles, date separators, reply preview, edit, unsend (web only), delivery state, per-thread search, typing indicator, "Reply window closed" + support follow-up toggle, guest request cards, cross-property "Looks like …" link.
- Composer: quick replies, AI suggest, insert menu (links, pages, check-in pack, booking documents), attachments (web only), 4,000-char cap.
- Manage: Channels (Meta connect/disconnect/fix), Quick replies (org-scoped CRUD + pin), Automation (AI tone + auto-send).

Host (parking)

- Same shell without Channels/templates: Chat-only list, quick replies + automation.

Guest

- `/account/messages`: list + conversation, unread dot, awaiting-reply badge, resource hub (trip, stay guide, house rules, check-in), attachments, edit/unsend, search behind a `⋮` sheet.
- `/properties/:slug/messages`: NEW inquiry chat (requires dates or a booking) and the embed preview used by the dashboard.

## Findings

Severity: **P0** blocks a flow, **P1** visibly broken or confusing on a real device class, **P2** craft/polish, **P3** nice to have.

Totals: 2 P0, 11 P1, 13 P2, 5 P3.

### Functional

| ID   | Sev | Finding                                                                                                                                                                                                                                                                                                                                                                | Evidence                                                                                        | Where                                                                                     |
| ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| M-01 | P0  | A signed-in guest starting a chat from a listing dies with `400 Failed to upsert conversation`. `upsertConversation` looks the thread up by `external_thread_id`, but the table also has a unique index on `(property_id, guest_user_id)`. Any existing web conversation with a different thread id makes every retry hit 23505 and fall through to the generic error. | `shots/60-public-chat-1440.png`, `shots/61-public-chat-390.png`                                 | `supabase/functions/_shared/socialInboxService.ts:381-410`, `webGuestChatIds.ts:4`        |
| M-02 | P1  | The guest error state for M-01 prints the raw server string (`Failed to upsert conversation`) and offers only Back / Try again. No friendly copy, no support path. Same pattern in `PropertyChatPage.tsx:167`.                                                                                                                                                         | `shots/60-public-chat-1440.png`                                                                 | `ui/src/features/guest/chat/pages/PropertyChatPage.tsx:157-172`                           |
| M-03 | P1  | A zero-result search on the **Chat** tab says "No messages yet." The empty-variant resolver returns `empty` for `platformFilter === 'web'` before it ever checks `search`. The dedicated `search-empty` copy is unreachable on the default tab.                                                                                                                        | `shots/19-desktop-search-empty.png`                                                             | `ui/src/features/dashboard/inbox/pages/InboxPage.tsx:336`, `InboxThreadListEmpty.tsx:139` |
| M-04 | P1  | Quick reply **Delete** is immediate. Quick replies are organization-wide, so one mis-tap removes a reply for every property, with no confirm and no undo.                                                                                                                                                                                                              | `shots/21-desktop-manage-quickreplies.png`                                                      | `InboxQuickRepliesTab.tsx:90-98`                                                          |
| M-05 | P1  | Realtime deltas are merged into **every** cached inbox list regardless of the active `platform` / `status` / `search` filter, so a web thread can appear under the Facebook tab until the next invalidate.                                                                                                                                                             | `shots/75-desktop-facebook-loaded.png` (Demo Guest row with a Chat pill under the Facebook tab) | `useInbox.ts:764-770`, `inboxCachePatch.ts:33-56`                                         |
| M-06 | P1  | "Importing chats" never clears for a connection whose `last_sync_at` is null: `metaSyncInProgress = facebook && !facebook.last_sync_at`. The pill then sits in the tab row indefinitely, including long after the import finished.                                                                                                                                     | `shots/01-messages-1440.png`, `shots/30-mobile-list.png`                                        | `supabase/functions/meta-inbox-status/index.ts:43`                                        |
| M-07 | P2  | The guest Messages page sets the browser title to **Stays**.                                                                                                                                                                                                                                                                                                           | —                                                                                               | `GuestMessagesPage.tsx:68`                                                                |
| M-08 | P2  | Guest thread row has a dead conditional (`unread ? 'text-foreground' : 'text-foreground'`), so unread threads are not visually distinguished from read ones; only an 8px dot marks them.                                                                                                                                                                               | `shots/49-guest-messages-softnav.png`                                                           | `GuestMessageThreadRow.tsx:44-49`                                                         |
| M-09 | P2  | A thread with no message body renders a literal `-` as its preview.                                                                                                                                                                                                                                                                                                    | `shots/80-messages-320.png` (Michael Manlulu row)                                               | `InboxThreadRow.tsx:56`                                                                   |

### Layout, responsive, and craft

| ID   | Sev | Finding                                                                                                                                                                                                                                                                                                  | Evidence                                                                               | Where                                             |
| ---- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| M-10 | P0  | On a phone the platform tab strip is crushed to ~197px by the 132px sync pill. Instagram sits entirely off-screen (`x 279..397` at 375px) and nothing signals that the strip scrolls. Facebook and Instagram are effectively unreachable.                                                                | `shots/30-mobile-list.png`, `shots/80-messages-320.png`, `shots/metrics-390.json`      | `InboxPlatformTabs.tsx:42-79`                     |
| M-11 | P1  | The Quick Access FAB sits on top of the composer's Send button in the thread view (FAB `322..374 x 727..779`; Send sits in the same box). It also covers the last thread row's badges in the list.                                                                                                       | `shots/32-mobile-thread.png`, `shots/34-mobile-insert.png`, `shots/30-mobile-list.png` | `AdminQuickAccessHub` + `InboxPage.tsx:458-463`   |
| M-12 | P1  | Guest Messages hub at 390x844 is 686px tall starting at y=191, so the composer ends at y=866, below the 844px viewport. The guest must scroll the whole page to reach it, and the thread header (with Back) scrolls away. `h-[calc(100dvh-12rem)]` ignores the account nav strip and the bottom tab bar. | shots `52`, `55`                                                                       | `GuestMessagesHub.tsx:25-26`                      |
| M-13 | P1  | Insert (`+`) opens a floating popover on phone, taller than the space above the composer, clipped at the bottom and covering the thread. Repo rule requires a bottom sheet for option lists below `lg`.                                                                                                  | `shots/34-mobile-insert.png`                                                           | `InboxInsertMenu.tsx` (Popover)                   |
| M-14 | P2  | Message `⋮` actions also open as a floating dropdown on phone rather than `MobileChoiceSheet` / `ResponsiveOverflowMenu`. Compact and chat-native, but it is a rule deviation to decide deliberately.                                                                                                    | `shots/35-mobile-message-actions.png`                                                  | `components/chat/ChatMessageActionsMenu.tsx`      |
| M-15 | P2  | Host thread header keeps the platform tab row + sync pill above the conversation on phone, eating ~55px of an already short thread and repeating chrome the user just left.                                                                                                                              | `shots/32-mobile-thread.png`                                                           | `InboxPage.tsx:486-514`                           |
| M-16 | P2  | Guest resource hub cards (Your trip / Stay Guide / House rules / Check-in steps) are clipped at the pane edge with no scroll affordance on desktop or phone.                                                                                                                                             | `shots/49-guest-messages-softnav.png`, `shots/52-guest-thread-390.png`                 | `GuestChatResourceHub`                            |
| M-17 | P2  | The first-run cookie banner covers the composer and Send until dismissed, on a page whose primary action is the composer.                                                                                                                                                                                | `shots/01-messages-1440.png`, `shots/74-parking-messages-1440.png`                     | global consent banner                             |
| M-18 | P2  | Quick reply sheet/menu shows titles only. Ten replies, no preview, no search, no group headers even though groups exist in Manage. Hosts must remember what each one inserts.                                                                                                                            | `shots/14-desktop-quick-reply-menu.png`, `shots/33-mobile-quick-reply-sheet.png`       | `InboxConversationView.tsx:1271-1344`             |
| M-19 | P3  | Guest list at 768 is one 44px row inside a 720px card; the empty canvas reads as unfinished. No compose/new-chat entry point anywhere in the guest hub.                                                                                                                                                  | `shots/51-guest-messages-768.png`                                                      | `GuestMessagesHub.tsx`                            |     | M-20 | P3  | Parking tenant label renders as the generated code `ML2S27` (tower + level + slot) in the switcher and hero; the readable name "Azure Monaco - Level 2 - Slot 27" never appears. | `shots/74-parking-messages-1440.png` | parking tenant label |
| M-31 | P3  | `/account/messages` has no visible page heading and no `h1`; the only name for the page is the browser tab (which says "Stays", see M-07). Account pages share this pattern, so decide once for the section.                                                                                             | `shots/49-guest-messages-softnav.png`                                                  | `GuestMessagesPage.tsx`, `GuestAccountLayout.tsx` |

### Accessibility

| ID   | Sev | Finding                                                                                                                                               | Where                                                                  |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| M-21 | P1  | Host composer textarea has **no accessible name** (placeholder only). The guest composer does (`aria-label="Message"`), so the two surfaces disagree. | `InboxConversationView.tsx:1197-1225` vs `GuestChatThread.tsx:812-815` |
| M-22 | P1  | Status chips are 36px tall on mobile (32px desktop) and platform tabs 36px, under the 44px touch target the rest of the app follows.                  | `InboxFilterBar.tsx:28-38`, `InboxPlatformTabs.tsx:55`                 |
| M-23 | P1  | Host Send button is 36px tall with no hit pad; guest Send is 44px.                                                                                    | `InboxConversationView.tsx:1391-1406`                                  |
| M-24 | P2  | New inbound messages are not announced: `ChatMessageList` has no `aria-live`, and the unread dot is a bare `<span aria-label>` with no role.          | `components/chat/ChatMessageList.tsx`, `InboxThreadRow.tsx:86-91`      |
| M-25 | P2  | Icon-only `⋮` for message actions is 28px on hover-capable devices (36px on touch). Acceptable visually, below the 44px guidance.                     | `ChatMessageActionsMenu.tsx:73-92`                                     |

### Robustness, security, and optimization

| ID   | Sev | Finding                                                                                                                                                                                                                                              | Where                                    |
| ---- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| M-26 | P2  | `?mock=true` is honored in any build, not just local dev: anyone can append it and see a "Preview data" inbox that looks close to real. No data leak, but a support-confusion footgun. Gate it to `import.meta.env.DEV` (or an explicit staff flag). | `inboxMockMode.ts:1-10`                  |
| M-27 | P2  | No timeout / error affordance while the shell or thread query stalls. Cold loads that take longer than a few seconds show skeletons indefinitely (observed repeatedly on local while auth was still settling).                                       | `InboxPage.tsx`, `GuestMessagesPage.tsx` |
| M-28 | P2  | Switching threads discards a typed draft and resets scroll, with no per-thread draft retention. Chat composers are exempt from the unsaved-changes guard, but hosts still lose long replies.                                                         | `InboxConversationView.tsx:361-375`      |
| M-29 | P3  | Sending has no optimistic bubble: the message appears only after the server round trip, so a slow send looks unresponsive beyond the spinner.                                                                                                        | `InboxPage.tsx:598-610`                  |
| M-30 | P3  | Thread search re-filters on every render over the loaded page of messages; fine at current sizes, worth memoizing before 500-message threads.                                                                                                        | `useChatThreadSearch`                    |

### Checked and healthy

- No `dangerouslySetInnerHTML` in chat bubbles or the insert/quick-reply renderers; message text, links, and template cards are React nodes, so body HTML cannot inject.
- Message bodies are capped at 4,000 characters on the client (`maxLength`) and re-checked server side.
- Send, edit, unsend, AI suggest all go through scoped edge functions (`social-inbox-send`, `social-inbox-ai-suggest`); Meta edit/unsend are correctly withheld because Meta has no such API.
- Thread list virtualizes above 30 rows and debounces search 300ms.
- Quick reply form + AI response dialog are wired to `useGuardedClose` with an unsaved-changes dialog.
- Loading, empty, error, not-connected, syncing, and feature-unavailable list states all exist and are distinct.
- Meta OAuth return params (`meta_inbox`, `meta_inbox_error`, `meta_picker`) are stripped from the URL after handling.

## Resolution coverage

| Width                     | Host Messages                           | Guest Messages                   |
| ------------------------- | --------------------------------------- | -------------------------------- |
| 320                       | Renders; tabs clipped (M-10)            | n/a                              |
| 360                       | Renders; tabs clipped (M-10)            | n/a                              |
| 375                       | Renders; tabs clipped (M-10)            | not captured (same shell as 390) |
| 390                       | FAB over Send (M-11)                    | Composer below fold (M-12)       |
| 414                       | Clean                                   | Clean                            |
| 768                       | Split layout fine; FAB over Send        | One-row card, sparse (M-19)      |
| 900                       | Split at container width; FAB over Send | n/a                              |
| 1024                      | Clean                                   | Clean                            |
| 1280 / 1440 / 1920 / 2560 | Clean, no horizontal overflow           | Clean                            |

No page-level horizontal scroll at any width tested.

## Suggested fix order

1. **M-01 / M-02**: make `upsertConversation` resolve by `(property_id, guest_user_id)` when the insert hits `23505`, and replace the raw error with guest-safe copy plus a support link.
2. **M-10**: give the tab strip the full row on phone. Move the sync pill under the hero title, or collapse channels into a filter sheet; always keep Instagram reachable.
3. **M-11**: raise the inbox composer above the FAB on `max-lg` (or hide the FAB on fill-main composer routes), same treatment as the bottom tab dock.
4. **M-12**: size the guest hub from the real chrome (nav + account strip + dock) instead of `12rem`, and make the thread header sticky.
5. **M-03 / M-04 / M-06 / M-07**: copy + safety fixes, small diffs.
6. **M-21 / M-22 / M-23**: finish the touch-target and labelling pass so host and guest chat match.
7. **M-13 / M-14 / M-16 / M-18 / M-19 / M-20**: craft pass on the phone sheets, the resource hub, and the quick reply list.
8. **M-05 / M-26 / M-27 / M-28**: filter-aware cache patches, dev-only mock mode, query timeout state, per-thread drafts.

## Tests added

`ui/e2e/features/inbox/messagesUx.spec.ts` — 20 passing contracts covering phone tabs, thread chrome, bottom sheets, search-empty copy, draft retention, delete confirm, composer labels, guest unread/h1/title, guest composer clearance, and both guest property chat start outcomes. No `test.fixme` remains from this audit.

`ui/e2e/features/inbox/messagesVisualCapture.spec.ts` (`@demo`) — before/after capture at 320, 375, 390, 414, 768, 1024, 1440 and 1920. Output: `ui/e2e/artifacts/messages-ux/<label>/<width>/`.

```bash
PLAYWRIGHT_CAPTURE_SCREENS=1 MESSAGES_CAPTURE_LABEL=after \
  bun run playwright test ui/e2e/features/inbox/messagesVisualCapture.spec.ts --project=chromium
```

The side-by-side review page is `ui/e2e/artifacts/messages-ux/review.html` (local, built from the two label folders).

`ui/e2e/features/inbox/messagesTour.slowmo.spec.ts` — 6 slow-motion scenarios (host desktop, host phone, guest desktop, guest phone, manage panels, conversation) tagged `@demo`, never CI.
