---
title: 'Mobile native app redesign (v3): design system and rules'
stage: for-testing
status: planned
tags: [mobile-native, design-system, rules, motion, ai, mascot]
updated: 2026-11-20
kind: plan
---

# Mobile native design system and rules (v3)

Companion to [`mobile-native-app-redesign.md`](./mobile-native-app-redesign.md) (plan) and [`mobile-native-app-redesign-pages.md`](./mobile-native-app-redesign-pages.md) (page inventory). Everything here applies **below `lg`** unless stated. Phase 0 promotes this file into `.cursor/rules/mobile-native-ui.mdc`, `mobile-responsive.mdc`, `kame-mascot.mdc`, the `native-mobile-redesign` skill and `DESIGN.md`. Until then, this file is the reference.

Values marked _start_ are starting points to verify in Phase 1 (contrast, real data, device tests).

---

## 1. Principles

1. **App, not page.** Every screen has an app bar, a body and one bottom layer. Nothing looks like a website section.
2. **Work first.** The first viewport shows what needs doing (rows with named actions), not decoration or secondary numbers.
3. **One primary action per screen**, named with a verb ("Add booking"). Secondary actions live in ··· as an action sheet.
4. **Progressive detail.** Lists → detail screen → section → sheet. Desktop panels become disclosure sections or drill-ins, never squeezed columns.
5. **Same capability, different composition.** Phone may move a capability one level deeper; it never drops it.
6. **AI is in context and accountable.** Kame summarizes, drafts, explains and proposes. It shows sources, it can be edited or dismissed, and a person confirms every write.
7. **The mascot has a job or it is not there.**
8. **Native motion, calm by default.** Push, pop, sheet and press feedback; no decorative loops.

## 2. Tokens

### Color (phone)

| Token                  | Role                                                                | Light _start_ | Dark _start_  |
| ---------------------- | ------------------------------------------------------------------- | ------------- | ------------- |
| `--appbar`             | App bar band, active stay header, flow header                       | `168 70% 22%` | `165 18% 12%` |
| `--appbar-foreground`  | Title and icons on the band                                         | `0 0% 100%`   | `160 20% 96%` |
| `--appbar-muted`       | Parent line in scope chip, compact sub text                         | `165 35% 84%` | `160 10% 70%` |
| `--appbar-control`     | Glass controls on the band (chip, Kame button, action pill outline) | white at 12%  | white at 10%  |
| `--canvas`             | Screen background under content                                     | `150 20% 97%` | `160 8% 7%`   |
| `--card`               | Cards, rows, sheets                                                 | `0 0% 100%`   | `160 6% 11%`  |
| `--hairline`           | Dividers, card borders                                              | `160 12% 90%` | `160 6% 18%`  |
| `--tint`               | Mint surfaces: summary card, selected segment, AI card, icon tiles  | `158 45% 94%` | `165 30% 16%` |
| `--tint-foreground`    | Text and icons on tint                                              | `168 70% 22%` | `158 45% 80%` |
| `--primary` (existing) | Primary buttons, links, active tab pill, focus ring                 | unchanged     | unchanged     |

**Pill tones (five only).** Each has a background and a foreground, AA on both themes.

| Tone        | Means                                | Examples                                             |
| ----------- | ------------------------------------ | ---------------------------------------------------- |
| `positive`  | Done, paid, live, confirmed, active  | Confirmed, Paid, Published, Live                     |
| `attention` | Time-bound, due, pending, draft      | Arriving today, Due soon, Pending docs, Draft        |
| `critical`  | Overdue, failed, cancelled, rejected | Overdue, Canceled, Needs review (only when blocking) |
| `info`      | Neutral state change, upcoming       | Upcoming, Updated, Scheduled                         |
| `neutral`   | Inactive, unlisted, past             | Unlisted, Past, Paused                               |

Map booking and parking statuses through `ui/src/lib/statusToneColors.ts` (one map, both workflows); calendar colors from `statusMachine` stay unchanged.

### Type scale (phone)

Replaces the "native density" rules in `mobile-responsive.mdc` §4.

| Role            | Size / line | Weight                | Notes                                          |
| --------------- | ----------- | --------------------- | ---------------------------------------------- |
| Large title     | 28 / 34     | 700, tracking −0.02em | One `h1` per screen                            |
| Compact title   | 17 / 22     | 600                   | `aria-hidden` (the large title stays the `h1`) |
| Section title   | 17 / 22     | 700                   | "Operations today", "Recent transactions"      |
| Row title       | 15 / 20     | 600                   | Truncate to 1 line                             |
| Body            | 15 / 22     | 400                   |                                                |
| Meta            | 13 / 18     | 400 muted             | Max 2 lines                                    |
| Label / caption | 12 / 16     | 500 muted             | Metric labels, field labels                    |
| Metric value    | 22 / 28     | 700 tabular           | Metric strip                                   |
| Hero number     | 32 / 38     | 700 tabular           | Finance net, refund amount                     |
| Tab label       | 11 / 13     | 500                   | Never below 10                                 |
| Pill            | 12 / 16     | 600                   |                                                |
| Button          | 15 / 20     | 600                   |                                                |

Inputs stay at 16px minimum (no iOS zoom). Font family unchanged.

### Shape, spacing, depth

| Token                                       | Value                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Gutter                                      | 16px                                                                    |
| Card padding                                | 16px                                                                    |
| Gap between cards                           | 12px                                                                    |
| Gap between sections                        | 24px                                                                    |
| Row height                                  | 56px one-line, 64 to 72px two-line                                      |
| Radius: content sheet top, bottom sheet top | 24px                                                                    |
| Radius: card                                | 20px                                                                    |
| Radius: row card, inner card                | 16px                                                                    |
| Radius: icon tile, input, button            | 12 to 14px                                                              |
| Radius: pill, chip, segmented track         | full                                                                    |
| Card depth                                  | 1px hairline + `0 1px 2px rgb(0 0 0 / 0.04)`; no large shadows on cards |
| Sheet depth                                 | `shadow-xl` + scrim at 40% (light) / 60% (dark)                         |
| Icons                                       | lucide, 20px in rows, 22px in tabs, stroke 1.75                         |
| Icon tile                                   | 36px, tint background, tint-foreground icon                             |
| Touch target                                | ≥ 44×44px (invisible hit pads allowed)                                  |
| Primary button                              | h-12, radius 14, full width in bars, paired 50/50                       |

## 3. Screen anatomy

```
Root screen (tab root or Work module)        Detail screen (pushed)
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ safe-area top (band color)   │            │ ‹  Maria Torres   [Arriving] │  app bar, detail
│ [▣ Solea Mactan ⌄]     (Kame)│ app bar    ├──────────────────────────────┤
│ Bookings        [+ Add booking]│ root      │ Nov 19-22 · 2 guests · A-201 │  fact strip
│╭────────────────────────────╮│            │ ┌ Next action ─────────────┐ │
││ 3 action required · 2 docs ││ summary    │ │ Guest is ready...  [Check in]│ next action
││ [Search…………………] [Refine]  ││ toolbar    │ └──────────────────────────┘ │
││ ( Cards | Calendar )        ││ (sticks)   │ Guest & contact      ⌄      │  disclosure
││ ┌ row card + named action ┐││ content    │ Payments  ₱12,000 paid ⌄    │  sections
││ └─────────────────────────┘││ sheet      │ Documents 2 of 2      ⌄      │
│╰────────────────────────────╯│            │ Activity              ⌄      │
│ Today Bookings Inbox Work You│ tab bar    │ [Message guest][Manage booking]│ bottom bar
└──────────────────────────────┘            └──────────────────────────────┘
```

Rules:

- The content sheet overlaps the app bar by 16 to 24px and has 24px top corners. Below it the canvas color continues.
- The page toolbar (summary strip, search, refine, segmented) is **one** row group. When it reaches the top it sticks under the compact bar (CSS `position: sticky`), so controls exist once in the DOM.
- Detail screens keep the tab bar unless the screen owns a bottom action bar (booking detail, work order, conversation composer), in which case the action bar replaces it.

## 4. App bar

| Variant                | Height (excl. safe area)                              | Left               | Center                   | Right                                    |
| ---------------------- | ----------------------------------------------------- | ------------------ | ------------------------ | ---------------------------------------- |
| Root                   | about 112px (chip row 48 + title row 48 + 16 overlap) | `ScopeChip`        | none                     | `KameButton`                             |
| Root title row         |                                                       | Large title        |                          | One `ActionPill` (named), optional `···` |
| Compact (after scroll) | 52px                                                  | Back (detail only) | Compact title (fades in) | `KameButton`, action icon                |
| Detail                 | 56px                                                  | Back `‹`           | Title (+ subtitle)       | Status pill **or** one named action      |
| Flow                   | 56px + stepper 28px                                   | Close or Back      | Title                    | none; stepper "1 of 3 · Vehicle" below   |
| Photo (public, trip)   | overlay                                               | Glass back         | none                     | Glass share, save                        |

Behavior:

- Large title visibility through IntersectionObserver; only opacity and transform transitions (no layout animation, no per-frame React state).
- `theme-color` meta follows the band color on admin and active stay, the canvas color on public screens.
- The scope chip shows: listing photo (or org logo, or P badge for parking) 32px, name (1 line), parent line (org name, or "Organization"), chevron. Tap opens the workspace switcher.
- Never more than: chip + Kame button on row one, title + one action pill (+ ···) on row two.
- Hidden on: none. Flow screens use the flow variant; editors use a tool variant with Done.

## 5. Tab bar

- Docked, edge to edge, opaque surface with hairline (shipped in chrome Phase 1). Height = 56px row + safe area via `--mobile-bottom-bar-h`.
- 4 or 5 items; icon 22px over label 11px; active item gets the brand pill behind icon + label; badges on the icon.
- Re-tap active tab: scroll to top; second re-tap: pop to the tab root.
- Each tab keeps its own last route and scroll (tab memory).
- Hidden when: keyboard open, `ContextualActionBar` mounted, full-screen editors.

## 6. Component catalogue

All in `ui/src/components/mobile/native/` (named exports, `PascalCase.tsx`), pure logic in sibling `.ts` files with Vitest. Existing primitives that stay: `ResponsiveModal`, `MobileChoiceSheet`, `ResponsiveOverflowMenu`, `BottomTabBar`, `ContextualActionBar`, `AdminListRefineSheet`, skeleton kit.

| Group   | Component                                                                | Purpose and rules                                                                                                        |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Shell   | `AppBar`                                                                 | Variants in §4; renders the only `h1`                                                                                    |
|         | `ScopeChip`                                                              | Workspace identity + switcher trigger                                                                                    |
|         | `KameButton`                                                             | 32px Kame avatar button, optional "Ask Kame" label; hidden when AI is off for the scope                                  |
|         | `ActionPill`                                                             | Named primary action on the band (outline glass or white fill)                                                           |
|         | `WorkspaceSwitcherSheet`                                                 | Search, segments, org groups, manage link                                                                                |
|         | `StepperHeader`                                                          | "2 of 3 · Payout" with dot track                                                                                         |
| Summary | `SummaryStrip`                                                           | One line of counts, each tappable to filter; wraps to 2 lines max                                                        |
|         | `MetricStrip`                                                            | 3 metrics visible, horizontally swipeable for more, one delta each; tap opens the owning module                          |
|         | `TodaySummaryCard`                                                       | Deterministic counts for the day (arrivals, checkouts, unread, payments due); optional 56px mascot (daily guidance role) |
|         | `AttentionList`                                                          | Numbered rows with a named action each ("Prepare", "Send", "Reply")                                                      |
| Lists   | `SearchField`                                                            | 44px, canvas-tint fill, clear button                                                                                     |
|         | `RefineButton`                                                           | Opens `AdminListRefineSheet`; shows active filter count                                                                  |
|         | `SegmentedTabs`                                                          | Pill track; 2 to 4 segments; counts allowed                                                                              |
|         | `FilterChips`                                                            | Horizontal scroll, single or multi select                                                                                |
|         | `ListSection`                                                            | Section title + optional "View all" + grouped content                                                                    |
|         | `ListRow`                                                                | Lead (avatar / icon tile / thumb) · title · meta · trailing (pill, amount, time, chevron)                                |
|         | `ActionRowCard`                                                          | Row card + inline named action button or a tinted "next step" footer (concept E)                                         |
|         | `DrillRow`                                                               | Title + sub-value + chevron; pushes a screen                                                                             |
|         | `ToggleRow`                                                              | Title + sub + `Switch`; whole row toggles; locked state for plan gates                                                   |
|         | `CheckRow`                                                               | Check circle completes (optimistic + undo toast)                                                                         |
|         | `SwipeableRow`                                                           | Leading primary, trailing secondary; mirrors ··· items; one open at a time                                               |
|         | `StatusPill`, `DatePill`, `ChannelBadge`, `Avatar`, `IconTile`           | Shared vocabulary                                                                                                        |
| Detail  | `FactStrip`                                                              | 3 to 4 facts with icons (dates, guests, unit, channel)                                                                   |
|         | `NextActionCard`                                                         | Title, one line of context, one primary button; wraps `WorkflowPanel` output on bookings                                 |
|         | `DisclosureSection`                                                      | Icon, title, value preview, chevron; expands in place or pushes                                                          |
|         | `KeyValueList`                                                           | Label / value rows for receipts and summaries                                                                            |
|         | `Timeline`                                                               | Day-grouped events with actor and time                                                                                   |
|         | `PhotoHeader`                                                            | Full-bleed photo with counter, glass controls                                                                            |
| Data    | `ChartCard`                                                              | Title, period chip, one chart, legend; no more than one chart per card                                                   |
|         | `CalendarGrid`                                                           | Month grid, touch range select, price per cell, tint for occupancy, today ring                                           |
|         | `WeekStrip`                                                              | Scroll-snap day chips                                                                                                    |
|         | `SelectionBar`                                                           | Contextual bar for multi-select ("3 nights selected · Edit price · Block dates")                                         |
|         | `ProgressMeter`                                                          | Usage and quota bars with value                                                                                          |
| AI      | `KameAvatar`                                                             | 24 to 32px AI identity                                                                                                   |
|         | `KameInsightCard`                                                        | Eyebrow "Kame insight", one sentence, source chips, one primary + dismiss icon                                           |
|         | `AiDraftCard`                                                            | Label "Kame draft", editable text, "Based on" chips, tone chips (Shorter, Warmer), Edit, Discard                         |
|         | `SourceChips`                                                            | Tappable chips that open the source (booking, house rules, transactions)                                                 |
|         | `ReviewChangeSheet`                                                      | Current → suggested, impact, reason, sources, options (radio), Apply, Not now, undo note only if undo exists             |
|         | `AskKameSheet`                                                           | Context chip, suggestion chips, messages with sources, follow-up composer                                                |
| Hubs    | `HubSearch`, `ContinueList`, `HubTile`, `ProfileHeader`, `WorkspaceCard` | Work, You, Account, Console                                                                                              |
| States  | `EmptyState`                                                             | Mascot (if budget allows) or icon tile, one line, one action; filtered-empty uses text + "Clear filters", no mascot      |
|         | `MilestoneScreen`                                                        | Mascot 96 to 128px, title, one line, summary card, primary + secondary                                                   |
|         | `ErrorState`, `LockedState`, `NoAccessState`, `OfflineRow`               | Consistent recovery and gate states                                                                                      |
| Mascot  | `KameMascot`                                                             | The only way to render a mascot pose (§12)                                                                               |

## 7. Pattern families

### F1 Today

App bar root (title "Today", Kame button labelled "Ask Kame"). Body order: `TodaySummaryCard` → `AttentionList` ("Needs attention", max 5, "View all") → `MetricStrip` (period chip) → "Next up" `Timeline` (arrivals, checkouts, maintenance due, payments due) → optional week strip or calendar teaser linking to Pricing. No four-card KPI grid. Org scope adds "Today by listing" rows; parking scope adds slot status rows and an hourly occupancy chart.

### F2 List

App bar root with named add action. Toolbar: `SummaryStrip` or `SegmentedTabs` (not both unless the strip filters and the segment switches view), `SearchField` + `RefineButton`. Rows: `ActionRowCard` when a next action exists, else `ListRow`. Grouping by date or status with section titles. Infinite scroll on phone. Swipe actions mirror ···. Export, import and bulk actions in ···.

### F3 Detail

App bar detail (back, title, status pill). `FactStrip` → `NextActionCard` → `DisclosureSection`s → optional Kame summary. Bottom bar with two named actions (for example "Message guest" + "Manage booking"); "Manage" opens an action sheet with every workflow and edit action from desktop. Edit opens a flow screen with `ContextualActionBar` (Save / Cancel) and the unsaved guard.

### F4 Data

App bar root with a period chip as the title-row action. `MetricStrip` or hero number → `KameInsightCard` (only when backed, max one) → `ChartCard`(s) → rows (transactions, sources, rankings). Calendars use `CalendarGrid` + `SelectionBar`. Forms that sat beside desktop charts (base rates) become drill-ins.

### F5 Settings

App bar root (or detail when pushed). Optional setup-health card when incomplete. `ListSection`s of `DrillRow` and `ToggleRow` grouped by intent (Organization, Guest experience, Integrations, Security). Each `DrillRow` pushes a section screen with grouped fields and `ContextualActionBar` Save. Danger zone last, critical tone, `AlertDialog` confirms.

### F6 Create / review sheet

Bottom sheet, large detent. Title + close; grouped fields (≤ one screen) or a 2 to 3 step stepper; sticky footer with Cancel + primary. Uses `useGuardedClose`. Longer creates (new booking, CSV import) become flow screens.

### F7 Conversation

App bar detail with avatar, name, context line, and a context button ("Reservation" opens a sheet). Context strip under the bar. Optional Kame summary card at top. Bubbles; composer pinned above the keyboard with attach, quick replies, and "Review draft" when AI is on. Drafts open `AiDraftCard` in a sheet; sending is always explicit.

### F8 Focused flow

App bar flow with stepper. One decision per screen. Native inputs (`inputMode`, `autoComplete`, `enterKeyHint`), pickers as `MobileChoiceSheet`. `ContextualActionBar` Back / Continue; last step "Review" sheet then Submit. Never relies on browser back; deep links land on step 1 or the saved step.

### F9 Discovery

Paper header (logo + avatar on roots; back + title on details). Search card with stacked fields, category chips, photo-led rows or cards with price. Detail: `PhotoHeader`, title + rating, amenity grid (6 max, "Show all"), optional Kame help row, sticky price + primary action bar. Map via existing `ListingMapToggle`.

### F10 Status and milestone

`MilestoneScreen` for real achievements; calm `ErrorState` for failures and rejections (no celebration mascot on a rejection: use `notice` or none). One primary next step.

### F11 Tool chrome

Editors keep their internals. Phone gets: flow app bar with Done, a bottom tool bar (existing `MarketingEditorMobileToolbar`, `VideoMobileActionBar`), sheets for panels, preview toggle. Tab bar hidden.

### F12 Hub

Search on top, then Continue, then grouped tiles or rows. You / Account: profile header, workspace card, grouped `DrillRow`s, sign out last.

## 8. Navigation rules

1. Tab sets per audience are fixed (plan §5a). No tab is an overlay or a mode switch.
2. Every non-root screen has a visible back. Back pops history when it exists, else navigates to the parent route (`useMobileBack(fallback)`), so deep links never dead-end.
3. One bottom layer at a time. `ContextualActionBar` requires a back contract (chrome C9).
4. Primary action is named and lives in the app bar title row or the bottom bar, never both.
5. Overflow `···` opens an action sheet (`ResponsiveOverflowMenu`), never a floating dropdown. Max one `···` per bar.
6. Filters live in the refine sheet; only the most used single filter may surface as segments or chips.
7. Switching workspace keeps the tab and module when the target scope has it.
8. Plan-locked modules stay visible with a lock pill; permission-hidden modules are not shown.

## 9. Sheets and overlays

| Use                                                         | Container                                              |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| Quick view, pickers, action sheets, filters, ≤ 5 fields     | Bottom sheet, medium detent (about 55%), drag to large |
| Longer create / edit, review change, AI draft, switcher     | Bottom sheet, large detent                             |
| Entity detail, long forms, settings sections, conversations | Pushed screen                                          |
| Multi-step wizards, editors, media                          | Full-screen flow                                       |
| Destructive confirm                                         | `AlertDialog` (allowed centered)                       |

- One sheet level. A second level replaces the sheet content with an in-sheet push (back chevron in the sheet header), never a stacked sheet.
- Sheets with edits use `useGuardedClose`; drag-to-dismiss triggers the same guard.
- Sheet footers are sticky and respect the keyboard.

## 10. Motion and interaction

| Interaction                  | Spec                                                                                                                                                             | Reduced motion      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Push (list → detail)         | New screen slides from 100% to 0, old moves 0 to −30% and dims to 0.9; 280ms, `cubic-bezier(0.32, 0.72, 0, 1)`; View Transitions API via router `viewTransition` | Cross-fade 120ms    |
| Pop (back)                   | Reverse of push; 240ms                                                                                                                                           | Cross-fade 120ms    |
| Tab change                   | Cross-fade 120ms, no slide                                                                                                                                       | None                |
| Sheet open / close           | Spring (stiffness about 400, damping about 40); scrim fades 200ms; drag follows finger, velocity decides detent                                                  | Fade 150ms          |
| Large → compact title        | Opacity + 4px translate, 150ms                                                                                                                                   | Instant             |
| Press                        | Scale 0.97 + tint, 100ms in / 160ms out; no tap highlight                                                                                                        | Tint only           |
| Row complete / mark paid     | Check fill 180ms, row collapses with layout animation 200ms, undo toast 5s                                                                                       | Instant + toast     |
| List insert / remove         | Height + opacity 200ms                                                                                                                                           | Instant             |
| Swipe row                    | Follows finger; snap at 30% width or velocity; full swipe commits primary                                                                                        | Buttons in ··· only |
| Pull to refresh (standalone) | Rubber band to 64px, spinner in the app bar area                                                                                                                 | Same, no bounce     |
| Toast                        | Slide up 12px + fade, 200ms; above the bottom layer                                                                                                              | Fade                |
| Skeleton                     | Shimmer 1.2s                                                                                                                                                     | Static              |
| Milestone mascot             | Scale 0.96 → 1 + fade, 240ms, once                                                                                                                               | Fade                |

Never: perpetual floating, parallax tied to scroll, animating `height` / `max-height` on scroll, entrance animations on every route.

## 11. Kame AI patterns

1. **Label honestly.** "Kame" or the Kame avatar marks LLM output only. Deterministic counts and rules show no AI marker.
2. **Show sources.** Every summary, draft and insight shows `SourceChips` (booking, house rules, transactions, reviews). Tapping a chip opens the source.
3. **Human in the loop.** Drafts are editable and sent with an explicit action. Any write goes through the assistant's propose → Confirm path or a `ReviewChangeSheet`. No autonomous high-impact changes; no one-tap AI writes from a list.
4. **One insight per screen**, dismissible (dismiss persists per item), never blocking the work.
5. **States:** thinking (Kame avatar `thinking` pose at 24px + text shimmer), streaming, error ("Kame couldn't answer. Try again."), AI off for scope (`AssistantAiOffCard` pattern, entry hidden on bar), plan-locked (lock pill → upgrade), limit reached (plain notice; limits are super-admin only, hosts just toggle).
6. **Context.** The Ask Kame sheet opens with the current page as a removable context chip (property, booking, month).
7. **Parity.** New AI actions follow `ai-assistant-parity.mdc`.

## 12. Kame mascot system

### Roles and sizes

| Role                    | Size                     | Allowed poses (from `manifest.json`)                                                                                                                                                                                                                                                                                                                          | Where                                                                                                                     |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Welcome and orientation | 96 to 128px              | `hello`, `happy-hop`, `install-app`, `sign-in`                                                                                                                                                                                                                                                                                                                | First-entry welcome (once per session), onboarding start, empty workspace, sign-in and install prompts                    |
| Daily guidance          | 48 to 64px               | `dashboard-overview`, `explaining`, `arrival`, `parking-guide`                                                                                                                                                                                                                                                                                                | `TodaySummaryCard` on Today (property, parking, org) only                                                                 |
| AI identity             | 24 to 32px (avatar crop) | `ai-assistant`, `listening`, `thinking`, `explaining`                                                                                                                                                                                                                                                                                                         | `KameButton`, Ask Kame sheet, AI draft label, insight cards, conversation summary, guest Ask Kame rows                    |
| Empty or recovery       | 72 to 96px               | `page-not-found`, `something-went-wrong`, `offline`, `coming-soon`, `rainy-day`, plus domain poses: `finance-ledger`, `maintenance`, `guest-inbox`, `properties`, `parking-listings`, `public-pages`, `page-templates`, `template-*`, `favorites`, `voucher`, `travel-dates`, `analytics`, `announcement`, `teammate`, `marketing-studio`, `pricing-calendar` | First-use empty states, 404, error boundary, offline screen                                                               |
| Milestone               | 96 to 128px              | `booking-confirmed`, `action-success`, `delighted`, `room-key`, `guest-review`                                                                                                                                                                                                                                                                                | Guest booking success, review submitted, SD refund submitted, onboarding complete, verification approved, import finished |
| Setup incomplete        | 48 to 64px               | `workspace-settings`, `properties`, `parking-listings`                                                                                                                                                                                                                                                                                                        | Settings setup-health card, top of a listings list when one listing needs setup                                           |

### Budget

- At most **one** mascot per screen (AI-identity avatars in a thread count as one).
- Dense operational screens (Bookings, Finance, Pricing, Inbox list, Activity, Team, Settings sections, super-admin): **only** empty states and AI avatars.
- Seasonal poses (`halloween`, `christmas-parol`, `valentine`, `new-year`, `easter`) only in the welcome role, behind a date-bounded flag.

### Never

Tab bar · app bar · scope chip · KPI or metric tiles · list rows · calendar cells · charts · form fields or form screens · destructive confirms · payment, payout, refund amounts · legal, security, verification-rejected · critical announcements · filtered-empty results · loading spinners for whole pages · replacing a label, status, source, warning or review control.

### Implementation

- `KameMascot` is the only renderer (`kame-mascot.mdc` forbids raw `<img src="/assets/mascot/...">`).
- WebP variants 96 / 160 / 320w with `srcset` + `sizes`, explicit `width` / `height`, `loading="lazy"` except milestone screens, `decoding="async"`.
- `alt=""` when nearby text says the same thing (default); descriptive alt otherwise.
- Not in shell precache; on-demand tier.

## 13. Copy

- Tabs: one word. Actions: verb + object ("Add booking", "Send reply", "Block dates"). No "Manage" without an object.
- No filler banners, taglines or explanations of what a page is. A card carries state or an action.
- Summary strips use counts with nouns ("2 pending docs"), never sentences.
- Currency `₱24,500`. Date ranges follow `human-copy` (no em or en dash in strings; the mockups' "Nov 19 – Nov 22" becomes "Nov 19 to 22"). Times in `Asia/Manila`.
- Every string through `human-copy` and `minimal-ui-copy`.

## 14. Accessibility

- One `h1` (large title); compact title `aria-hidden`.
- Tab bar `nav` with `aria-current="page"`; badges have text equivalents.
- Every swipe and long-press action exists as a visible control (··· or bottom bar).
- Focus moves to the sheet title on open and returns to the trigger on close.
- Band text and pills meet AA in light and dark; status never by color alone (pill text).
- 200% text: rows wrap meta to 2 lines, titles truncate with full text in detail.
- `prefers-reduced-motion` honored per §10.

## 15. Quick rules (the rule file summary)

**Do:** tab sets per audience · brand app bar with scope chip and one named action · summary strip or metric strip, not KPI grids · rows with named next actions · detail = fact strip + next action + disclosure sections · sheets for short tasks, push for entities, flows for wizards · Kame with sources and confirm · mascot only within budget · push / pop / sheet motion with reduced-motion fallbacks · parity table before building.

**Don't:** More drawer · overlay tabs · icon-only action rows · four-card KPI grids above work · tables on phone · stacked sheets · two bottom bars · AI labels on plain counts · one-tap AI writes · mascots in headers, rows, forms or serious states · filler banners · fake fields for features that do not exist · scroll-linked layout animation.
