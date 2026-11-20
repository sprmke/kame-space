---
name: native-mobile-redesign
description: >-
  MANDATORY for any phone (max-lg) UI work in ui/src while the v3 native-app redesign is in
  progress. Page recipe, pattern families, tab sets, app bar, named actions, Kame AI and mascot
  budget, parity tables, definition of done. Invoke with mobile-responsive on every UI task.
---

# Native mobile redesign (v3)

Goal: below `lg`, every screen looks and behaves like an installed native app. Desktop is unchanged. No capability is dropped on phone (it may move one level deeper).

**Read first (in this order):**

1. `docs/workflow/for-testing/mobile-native-app-redesign.md` (plan, decisions D1 to D15, phases, definition of done)
2. `docs/workflow/for-testing/mobile-native-app-redesign-design-system.md` (tokens, anatomy, components, families, motion, AI, mascot)
3. `docs/workflow/for-testing/mobile-native-app-redesign-pages.md` (the row for your route)
4. `docs/architecture/mobile-native.md` (shell architecture)
5. `.cursor/rules/mobile-native-v3.mdc` and `.cursor/rules/kame-mascot.mdc`
6. Mockups: `docs/screenshots/mobile-redesign-study/` (README maps concepts A to X). **Mockups are direction, not spec.** The plan §2 lists what to change or drop.

Precedence: phone shell and pages follow v3 (`AdminMobilePage` + `AppBar`). Do not reintroduce `MobileBrandHero` or More sheets.

## Page recipe

1. **Read the route guide** (`docs/guides/routes/**`) and the pages-doc row. List every desktop capability: the **parity table** (desktop capability, phone location, gesture shortcut).
2. **Pick the family** from the row: F1 Today, F2 List, F3 Detail, F4 Data, F5 Settings, F6 Create / review sheet, F7 Conversation, F8 Focused flow, F9 Discovery, F10 Status / milestone, F11 Tool chrome, F12 Hub.
3. **Choose the rendering strategy:** shared tree with phone variants, or split view (`XPageMobile`) fed by the same hooks. No data, permission or plan logic inside `*Mobile`.
4. **Compose with primitives** from `ui/src/components/mobile/native/` (`AppBar`, `ScopeChip`, `SummaryStrip`, `MetricStrip`, `ListRow`, `ActionRowCard`, `DrillRow`, `ToggleRow`, `NextActionCard`, `DisclosureSection`, `SelectionBar`, `KameInsightCard`, `AiDraftCard`, `ReviewChangeSheet`, `EmptyState`, `KameMascot`, ...). If a primitive is missing, add it to the kit and the dev gallery first; do not hand-roll.
5. **One primary named action**, secondary actions in one `···` action sheet. Rows carry a named next action when one exists.
6. **Wire states:** skeleton shaped like the final layout (chrome stays mounted), empty, error, offline, plan-locked, no-permission, AI-off.
7. **Wire gestures as shortcuts:** swipe row actions, check circle, pull to refresh (installed PWA only), long-press. Each has a visible equivalent.
8. **Forms and editors:** `useUnsavedChangesGuard` or `useGuardedClose`; `ContextualActionBar` for Save / Continue; native input attributes.
9. **Check the mascot budget** and Kame AI rules (below).
10. **Verify** at 375, 390, 430, 768px, light and dark, 200% text, reduced motion; desktop 1280px unchanged; `ci:quality`.
11. **Docs:** route guide "Mobile (`max-lg`)" section with the parity table (`route-guides`), `support-content` if what a host or guest sees changed, check off the pages-doc row, `activity-log: N/A — UI only` unless a new inline action needs one.

## Navigation cheat sheet

| Audience                   | Tabs                                            |
| -------------------------- | ----------------------------------------------- |
| Host, property and parking | Today · Bookings · Inbox · Work · You           |
| Host, org                  | Today · Bookings · Alerts · Work · You          |
| Super-admin                | Overview · Approvals · Orgs · Support · Console |
| Public signed out          | Explore · Stays · Parking · Account             |
| Public signed-in guest     | Explore · Trips · Messages · Saved · Account    |
| Active stay                | Trip · Guide · Messages                         |
| Focused flows              | No tabs; `ContextualActionBar` with back        |

Modules (Finance, Pricing, Team, Settings, ...) live in **Work**; account, plan, preferences, help in **You**; notifications are **Inbox → Alerts**. Use `tabForRoute`; never hard-code active tabs.

## Decision tree

- Shows a list of things to act on → **F2** (rows with named actions).
- One entity with workflow → **F3** (fact strip, next action, disclosure sections, two-action bottom bar).
- Numbers, charts, calendars → **F4**.
- Many fields or toggles → **F5** (grouped drill and toggle rows, section screens).
- Add or edit a few fields → **F6** sheet. Many steps → **F8** flow.
- Chat → **F7**. Public browsing → **F9**. Outcome screen → **F10**.

## Kame AI checklist

- [ ] Label only LLM output; plain counts have no AI marker
- [ ] Source chips on every summary, draft, insight
- [ ] Draft editable, sent explicitly; writes via assistant propose → Confirm or review-change sheet; no one-tap AI writes
- [ ] One insight per screen: one primary action + dismiss
- [ ] AI-off hides the entry; plan-locked and limit states handled
- [ ] Backed by an existing capability (plan §5f); otherwise it goes to the plan §11 backlog, not onto the screen

## Mascot checklist

- [ ] At most one mascot on the screen; role and size from `kame-mascot.mdc`
- [ ] Not on a dense operational screen except empty state or AI avatar
- [ ] Not in a header, row, form, metric, calendar, or serious (money, legal, security) state
- [ ] Rendered through `KameMascot` only

## Anti-patterns (reject in review)

More drawer · overlay tabs · icon-only action rows · four-card KPI grid above work · tables on phone · stacked sheets · two bottom bars · AI label on plain counts · fake fields for missing features · filler banners · scroll-linked layout animation · desktop page reflowed into one column.

## Related skills

`mobile-responsive` (legacy spec, still valid for breakpoints and touch targets), `impeccable` (critique and polish), `vercel-react-view-transitions` (push / pop / tab transitions), `competitive-ux-research` (before a new flow), `skeleton-loaders`, `accessibility`, `unsaved-changes-guard`, `human-copy`, `minimal-ui-copy`, `route-guides`, `support-content`, `property-dashboard-qa`, `playwright-cli`, `performance`.
