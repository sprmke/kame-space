# Mobile redesign visual study

Research-only design exploration. No application code or product behavior changed.

## Representative captures

- `current/dashboard-mobile.webp`
- `current/bookings-mobile.webp`
- `current/finance-mobile.webp`
- `current/pricing-mobile.webp`
- `current/inbox-mobile.webp`
- `current/maintenance-mobile.webp`
- `current/workspace-switcher-sheet.webp`
- `current/more-navigation-sheet.webp`
- `current/add-reminder-sheet.webp`

The authenticated screens use the repository's Playwright host session and route mocks at a
390 x 844 viewport. The live local Auth service returned `503 name resolution failed`, so no
Supabase restart was attempted.

## Main findings

1. The tenant header, page title, date control, page actions, profile, and bottom navigation
   compete for attention instead of behaving as one predictable app shell.
2. Six bottom destinations plus a large active capsule make the dock crowded. Profile access is
   hidden in More, while Assistant and Notifications consume permanent tab space.
3. Four equal KPI cards use most of the first viewport even when the values are secondary to the
   day's operational work.
4. Several pages repeat the same large teal hero even when the job needs a denser contextual
   toolbar, such as pricing, inbox, and finance.
5. The workspace sheet is a sound native pattern, but it needs search, property and parking
   filtering, clearer hierarchy, and a direct management route.
6. The More sheet is doing three jobs at once: overflow navigation, app mode switching, and
   account management. Its pinned footer leaves little space for the destination list.
7. The multi-step reminder sheet is already close to native behavior. It mainly needs a calmer
   action hierarchy and consistent step chrome.
8. AI should prioritize, summarize, explain, and prepare reversible actions in context. A sparkles
   icon or a generic chat destination alone does not make the product AI-native.

## Concept directions

### A. Native Command Center

`concepts/concept-a-native-command-center.webp`

Balanced default. A stable five-tab dock, compact tenant and profile header, swipeable KPIs,
operational brief, and a stronger workspace switcher.

### B. Contextual Copilot

`concepts/concept-b-contextual-copilot.webp`

Most AI-native. AI appears beside the work it explains, includes source context, and offers
reviewable actions. The assistant accessory changes with the active page.

### C. Operator Focus

`concepts/concept-c-operator-focus.webp`

Fastest for experienced hosts. Replaces large stat cards with a metric strip, prioritizes the
daily operations timeline, adds a contextual pricing action bar, and simplifies navigation.

### D. Work Hub Navigation

`concepts/concept-d-work-hub-navigation.webp`

Replaces More with two real destinations: Work for product modules and You for profile, workspace,
plan, preferences, security, and support.

### E. Reservation Flow

`concepts/concept-e-reservation-flow.webp`

Applies the system to bookings, reservation details, and an AI-assisted reply. It uses named
actions, progressive disclosure, visible AI sources, and a mandatory review before sending.

### F. Smart Finance & Pricing

`concepts/concept-f-smart-finance-pricing.webp`

Shows simplified financial detail, a touch-first pricing calendar, and a review sheet that
explains evidence, alternatives, impact, and undo before a suggested rate change is applied.

### G. Inbox & Operations

`concepts/concept-g-inbox-operations.webp`

Combines a prioritized inbox, reservation-aware conversation, and daily task flow. AI summarizes
context and proposes drafts or schedule changes without acting autonomously.

### H. Navigation Lab

`concepts/concept-h-navigation-lab.webp`

Compares three navigation models: a Work hub, a global command bar, and role-based tabs. This is
the decision board for replacing More and unlabeled overflow controls.

### I. Kame Companion: Welcome & Today

`concepts/concept-i-kame-welcome-today.webp`

Adds the approved Kame mascot to workspace entry, the daily brief, and the Work hub. Kame welcomes,
orients, and guides without replacing operational data, navigation labels, or page actions.

### J. Kame Companion: AI & Inbox

`concepts/concept-j-kame-ai-inbox.webp`

Uses Kame as the visible identity of AI-assisted work. Kame appears in the assistant, priority
brief, and reviewed draft, while sources, edit controls, and human approval remain explicit.

### K. Kame Companion: Guest Journey

`concepts/concept-k-kame-guest-journey.webp`

Uses Kame at three high-value moments: discovery, optional hospitality help, and booking
confirmation. The property-detail screen remains photography-led and operational.

### L. Dashboard Expansion: Listings

`concepts/concept-l-kame-listings.webp`

Covers organization Properties, Parkings, and property Public Pages. Search and refinement stay
compact, rows use named Manage/Edit actions, and Kame appears only in actionable setup guidance.

### M. Dashboard Expansion: Maintenance

`concepts/concept-m-kame-maintenance.webp`

Turns maintenance into a field-operations flow: prioritized work list, focused work order with a
contextual action bar, and a completion record. Kame supports triage, checklist context, and the
completion milestone.

### N. Dashboard Expansion: Growth & Team

`concepts/concept-n-kame-growth-team.webp`

Covers Marketing, Reviews, and Team. Creation and invitations use focused sheets, AI review drafts
remain editable, and Kame represents opportunity, insight, and access-review guidance.

### O. Dashboard Expansion: Organization

`concepts/concept-o-kame-organization.webp`

Covers Settings, Plans & Billing, and Help & Support. Dense administration becomes grouped native
rows, compact usage details, and clear support routes without turning Kame into a sales character.

### P. Dashboard Expansion: Insights & Updates

`concepts/concept-p-kame-insights-updates.webp`

Covers Analytics, Activity Log, and Announcements. Metrics use a compact strip, activity becomes a
grouped timeline, and critical announcements remain visually separate from mascot guidance.

### Q. Dashboard Expansion: Guest Experience

`concepts/concept-q-kame-guest-experience.webp`

Covers Templates, Email Automations, and Notifications. Configuration is progressively disclosed
through sheets and named actions, while Kame highlights organization, a fixable automation issue,
and attention summaries.

### R. Scope Expansion: Organization Portfolio

`concepts/concept-r-kame-org-portfolio.webp`

Covers the organization Today view, portfolio-wide bookings, and cross-listing performance. The
header names the organization scope explicitly while the stable admin navigation remains intact.

### S. Scope Expansion: Parking Operations

`concepts/concept-s-kame-parking-operations.webp`

Covers parking Today, parking bookings, and parking booking detail. Parking is treated as its own
operational vertical with slots, vehicles, access, arrival, and payment context.

### T. Scope Expansion: Parking Business

`concepts/concept-t-kame-parking-business.webp`

Covers parking pricing, finance, and settings. It reuses the property-level interaction patterns
while keeping parking-specific rates, payouts, access instructions, and vehicle requirements.

### U. Scope Expansion: Public Discovery

`concepts/concept-u-kame-public-discovery.webp`

Covers public parking search, development detail, and parking detail. Photography and inventory
stay primary; Kame provides orientation or optional access help rather than becoming the hero.

### V. Scope Expansion: Guest Account

`concepts/concept-v-kame-guest-account.webp`

Covers guest Trips, Vouchers, and Favorites. A compact account strip coexists with the public
navigation without creating a second bottom bar.

### W. Scope Expansion: Active Trip

`concepts/concept-w-kame-active-trip.webp`

Covers the trip hub, guest messages, and arrival guide. It uses the focused property guest dock
and replaces that dock with a contextual action bar when arrival actions become primary.

### X. Scope Expansion: Guest Requests

`concepts/concept-x-kame-guest-requests.webp`

Covers parking request, security-deposit refund, and guest review flows. Each screen presents one
decision, visible progress, native form controls, and persistent contextual actions.

## Dashboard coverage map

| Dashboard area                            | Concept | Mascot role                          |
| ----------------------------------------- | ------- | ------------------------------------ |
| Dashboard, Work hub, profile              | D, I    | Welcome and daily guidance           |
| Bookings and reservation detail           | E       | AI summary and reviewed reply        |
| Finance and pricing                       | F       | Sourced insight only                 |
| Inbox and tasks                           | G, J    | AI identity and priority brief       |
| Properties, parkings, public pages        | L       | Setup and listing guidance           |
| Maintenance                               | M       | Triage, work context, completion     |
| Marketing, reviews, team                  | N       | Opportunity, insight, access review  |
| Settings, plans, support                  | O       | Setup health and assistance          |
| Analytics, activity, announcements        | P       | Sourced insight and update summary   |
| Templates, automations, notifications     | Q       | Organization and attention summary   |
| Organization Today, bookings, performance | R       | Portfolio brief and sourced insight  |
| Parking dashboard, bookings, detail       | S       | Arrival guidance and booking state   |
| Parking pricing, finance, settings        | T       | Recommendation, payout, setup health |
| Public parking and developments           | U       | Discovery and access guidance        |
| Guest trips, vouchers, favorites          | V       | Timely account guidance              |
| Active trip, messages, arrival            | W       | Next step and hospitality assistance |
| Guest parking, refund, review forms       | X       | Focused help and review context      |

Super-admin routes are intentionally excluded from this study.

## Mascot placement system

Kame should have a job whenever the character appears:

| Role                    | Recommended placement                                  | Typical visual size |
| ----------------------- | ------------------------------------------------------ | ------------------: |
| Welcome and orientation | First entry, workspace switch, onboarding              |            80–120px |
| Daily guidance          | Morning brief, next-best action, Work hub prompt       |             48–64px |
| AI identity             | Kame response avatar, draft label, sourced explanation |             24–32px |
| Empty or recovery state | No results, offline, gentle failure, help              |             72–96px |
| Positive milestone      | Booking confirmed, task completed, import finished     |            80–120px |

Do not place Kame in every page header, bottom tab, KPI card, finance row, calendar cell, or
destructive confirmation. The mascot must never replace a label, status icon, source, warning, or
review control. Dense screens should generally use one pose at most. Serious financial, legal, and
security states should use the normal product chrome unless a calm recovery illustration adds
specific value.

## Competitive UX brief

**Job:** Help a host notice, navigate, and complete daily property operations on a phone.
**Role:** Host or property operator.
**Surface:** Property and organization admin.
**Commit points:** Guest messages, booking transitions, rate changes, payments, and task updates.

- Airbnb uses five host tabs and makes Today the operational starting point.
- Guesty and Hostaway focus mobile scope on reservations, calendar, inbox, and tasks.
- Hospitable consolidates secondary reservation context behind one named Reservation control on
  mobile instead of reproducing every desktop panel.
- Adopt a stable five-destination bar, named page actions, a full Work hub, and progressive detail.
- Adapt AI as contextual summaries, drafts, explanations, and reversible recommendations.
- Skip a catch-all More drawer, unlabeled dots, autonomous high-impact changes, and desktop-style
  dashboards compressed into cards.

## Recommendation

Use Concept D as the navigation foundation: `Today · Bookings · Inbox · Work · You`. Combine it
with Concept C's dashboard density, Concept E's reservation flow, Concept F's review pattern, and
Concept G's inbox/task structure. Keep Concept B's contextual, sourced, reversible AI model.

Concept H option A is the recommended default. Option B is a credible future experiment after
global search and assistant quality are strong enough to justify a persistent command bar.

For mascot integration, combine Concept I's compact daily brief, Concept J's Kame-authored AI
states, and Concept K's milestone treatment. Concept K is the strongest public-facing direction;
Concept J is the strongest product-facing direction. Keep the existing five-tab admin shell and
use the mascot as a contextual layer, not as a new navigation system.

For the remaining dashboard, use L as the default list pattern, M as the task/detail/completion
pattern, N as the creation and review pattern, O as the grouped settings pattern, P as the
data-heavy pattern, and Q as the configuration pattern. These six patterns cover the route
families without requiring a unique mobile shell for every page.

For scope-specific shells, use R for organization portfolio pages, S and T for parking operations,
U for public discovery, V for guest account pages, W for the active stay, and X for transactional
guest forms. Keep scope switching in the admin header; keep the public, account, and active-trip
navigation models separate rather than forcing them into the admin five-tab dock.

## Research basis

- [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- [Apple sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- [Apple generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai)
- [Google People + AI Guidebook](https://pair.withgoogle.com/guidebook-v2/chapters)
- [Airbnb hosting tools](https://www.airbnb.com/resources/hosting-homes/a/exploring-your-hosting-tools-738)
- [Airbnb redesigned reservations](https://www.airbnb.com/resources/hosting-homes/a/reservations-redesigned-765)
- [Guesty mobile app overview](https://help.guesty.com/hc/en-gb/articles/9360094137629-Overview-of-the-Guesty-mobile-app)
- [Guesty mobile tasks](https://help.guesty.com/hc/en-gb/articles/20877272088093-Managing-tasks-in-the-Guesty-mobile-app)
- [Hostaway mobile app](https://support.hostaway.com/hc/en-us/articles/360048640073-Mobile-App-Overview-and-Supported-Devices)
- [Lodgify mobile app](https://www.lodgify.com/mobile-app/)
- [Hospitable inbox structure](https://help.hospitable.com/en/articles/9651923-inbox-overview-guest-conversation-thread-video-tour)

## Originals

The lossless PNG originals (42 MB) are kept locally in `_original-png/` and are git-ignored. The committed set is WebP (3.8 MB).
