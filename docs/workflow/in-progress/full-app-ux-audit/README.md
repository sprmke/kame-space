### P1

7. **Opening a booking detail page writes a fake "copied a guest trip link" audit event.** Merely
   loading `/bookings/:id` produced `booking.trip_link_issued` with summary
   "…copied a guest trip link for Yuri Ibarra". The activity log can no longer be trusted for that
   action. Where: `useBookingTripLink` auto-issues on mount.

8. **Downgrade then upgrade leaves team seats inconsistent, and can deactivate the owner's own
   membership.** After `seed:plan --plan=free` → `--plan=pro`, all property members stayed
   `status=inactive, plan_limited=true` (viewers saw "Access paused, contact your owner to upgrade
   the plan" while the org was on Business). Opening Team as owner reconciled most members but
   flipped **`seed-owner@example.com` (the org owner) to `inactive, plan_limited=true`**, and left
   `manager.demo@example.com` inactive with `plan_limited=false`, so it will never be auto-restored.
   Where: `planEntitlements.ts#reconcileTeamSeatsForOrganization` (owner not excluded from the
   property-member trim; org and property seats reconciled differently).

9. **The property dashboard "Total Bookings" card shows nights, not bookings.**
   `DashboardStatCards.tsx` renders `${nightsBooked} / ${periodDays}` under the title "Total
   Bookings", and the trend arrow uses the _bookings_ change. A host with 6 bookings reads
   "12 / 30".
   [screenshots/01-property-dashboard-desktop.png](./screenshots/01-property-dashboard-desktop.png)

10. **"Low occupancy next 30 days: 42" is a percentage rendered as a count.** The badge sits in the
    same list as "Pending review 5" and "Check-outs today 1", so `42` reads as 42 items. The API
    returns `count: occupancyPct`
    (`_shared/dashboardService.ts:1031`).
    [screenshots/02-org-dashboard-desktop.png](./screenshots/02-org-dashboard-desktop.png)

11. **Read-only teammates are shown actions they cannot perform.** A viewer with only `*:view`
    permissions sees an editable "Door code" input with **Save** and an interactive "I manually
    reviewed…" checkbox on booking detail. The server correctly returns 403 ("Access restricted"),
    so the guard is server-side only; the affordance is wrong.
    [screenshots/35-viewer-booking-readonly.png](./screenshots/35-viewer-booking-readonly.png)

12. **Super-admin approvals show the literal string "Invalid Date".** `/admin/approvals` and the
    Approvals section of `/admin/orgs/:slug` render `Invalid Date` in the SUBMITTED column while the
    dialog shows the raw value. Root cause is the seed writing `…T07:48:17+00` (which `new Date()`
    rejects) plus a formatter that prints "Invalid Date" instead of falling back; production writes
    `toISOString()`, but any imported or legacy value hits the same branch.
    [screenshots/04-admin-approvals-invalid-date.png](./screenshots/04-admin-approvals-invalid-date.png),
    [screenshots/05-admin-org-invalid-date.png](./screenshots/05-admin-org-invalid-date.png)

13. **Marketing "Your creations" render as blank gray boxes.** Seeded `marketing_media_assets` rows
    point at `marketing-media/seed/remote/asset-*`, which do not exist in Storage (bucket listing is
    empty, direct fetch returns 400). Cards show an empty placeholder with no label or fallback.
    [screenshots/14-marketing-studio-blank-creations.png](./screenshots/14-marketing-studio-blank-creations.png)

14. **Parking imagery is missing with no fallback.** The seeded parking photo URL
    (`images.unsplash.com/photo-1590674899484-…`) returns 404, so the parking detail page, the
    parking request form and the org Parkings list show an empty circle/blank hero.
    [screenshots/27-parking-form-broken-avatar.png](./screenshots/27-parking-form-broken-avatar.png)

15. **Free plan shows the full property Analytics dashboard.** On Free, Analytics renders every KPI
    and chart with a single "PRO" pill on Export PDF, while the plans matrix and route guide describe
    Analytics as a Pro feature with a teaser for lower tiers. Either the data should be masked or the
    badge should say what is actually gated.
    [screenshots/33-free-plan-analytics.png](./screenshots/33-free-plan-analytics.png)

16. **Super-admin org hub cards are crushed to 190px** (`/admin/orgs/:slug` Listings / Support /
    Approvals). Stat labels collide ("BookingsRevenue Occupancy"), revenue is clipped, ticket
    subjects reduce to "Cale…", "A…", "H…". Measured card width: 190px in a 1,060px column.
    [screenshots/41-org-hub-crushed-cards.png](./screenshots/41-org-hub-crushed-cards.png)

17. **AI usage numbers contradict each other across four admin surfaces.** Overview shows "AI spend
    $1.13" directly above "No AI usage in this range"; AI → Usage says "Orgs using AI 0 / Credits 0"
    and "Calls 0 · Errors 2 (100%)" while AI → Limits shows 96 calls and 1,300 credits for the same
    month. One aggregate is wrong; an operator cannot decide on credits from this.
    [screenshots/42-admin-ai-contradictions.png](./screenshots/42-admin-ai-contradictions.png)

18. **Parking payout ledger reports ₱0.00 processor fee and ₱0.00 platform net** while the same page
    configures 3.13% + ₱15 and shows a ₱280 commission gap between guest charges (₱2,800) and host
    payouts (₱2,520).
    [screenshots/44-admin-payouts-zero-fees.png](./screenshots/44-admin-payouts-zero-fees.png)

19. **Platform-wide settings cannot be saved when email is unavailable.** Save opens step-up OTP,
    "Send OTP" returns `400 Email is not configured`, and the dialog shows that raw string with no
    retry or alternate path. Every platform setting is frozen in that state.
    Where: `super-admin-verification` + `SuperAdminPlatformSettingsPage`.

20. **System health reports "OK" for a job that returned HTTP 502 and had 3 failed runs**, with every
    job 9 days stale and a grey "Unknown" dot in the same row.
    [screenshots/43-admin-health-jobs-ok.png](./screenshots/43-admin-health-jobs-ok.png)

21. **The parking dashboard and parking pricing calendar show no reservations** while the same slot
    has eight November reservations listed on the bookings page and counted in the KPIs. Cash flow and
    breakdown also render "no data" despite ₱1,890 of revenue.
    [screenshots/53-parking-dashboard-empty-calendar.png](./screenshots/53-parking-dashboard-empty-calendar.png)

22. **The plan price shown is not the price charged.** Marketing and in-app pricing say Business is
    ₱1,799 struck through, 20% off, ₱1,439/month; the billing history shows ₱1,799 paid, with no
    explanation of the difference.
    [screenshots/55-org-plans-billing.png](./screenshots/55-org-plans-billing.png)

23. **The AI assistant is invisible on the plan that sells it.** Business includes "AI dashboard
    assistant", the org setting is enabled, but the platform AI switch is off so no launcher or
    "AI mode" toggle renders and nothing explains why. Same for the greyed-out "AI" / "AI features"
    entries in org Settings.

24. **Reviews → "About guests" says there are no reviews while three exist.** `host_guest_reviews`
    holds 3 rows for the org, but the tab renders "No guest reviews written yet", so hosts cannot see
    or edit their own guest reviews.
    [screenshots/62-reviews-about-guests-empty.png](./screenshots/62-reviews-about-guests-empty.png)

25. **A paid host cannot manage their subscription.** "Manage subscription" only switches to the Plans
    tab; there is no billing portal, payment-method update, invoice download or cancellation anywhere
    in the plans feature.

26. **Parking notifications attribute the wrong guest and leak import IDs.** A row titled
    "Rafa Mercado" reads "June Vale requested 3 nights at Monaco 2604", and one row prints
    `itest-f4a390de`.
    [screenshots/65-parking-notifications-wrong-guest.png](./screenshots/65-parking-notifications-wrong-guest.png)

27. **The mobile "More" sheet gives navigation a 268px window**, so Properties and Parkings are hidden
    until the user scrolls past the plan card and account footer.
    [screenshots/64-mobile-more-sheet-cramped.png](./screenshots/64-mobile-more-sheet-cramped.png)

28. **The ticket composer discards drafts with no warning**, and its mobile sheet has no close control
    at all.

### P2 (highlights, full list per module)

29. Donut charts on Analytics and both dashboards have no legend or labels. "Where bookings come
    from" is a ring with no categories at all. Finance does show a legend, so the pattern exists.
    [screenshots/10-property-analytics-no-legends.png](./screenshots/10-property-analytics-no-legends.png)
30. Occupancy percentage is printed twice per listing row in the org dashboard "Listings
    Performance" card (inline meta and under the progress bar).
31. The fixed cookie banner covers the sidebar account menu at 1440x900 until dismissed.
32. Long admin pages (property Settings, Notifications) are entirely desktop-oriented: below `lg`
    the section rail disappears and the page becomes one very long scroll with no jump list.
    [screenshots/25-settings-mobile-long-page.png](./screenshots/25-settings-mobile-long-page.png)
33. The org sidebar nav clips the last item ("Settings") behind the Verification card at 900px
    height; the account block overlaps the cookie banner.
34. `get-public-platform-status` allows 30 requests/minute per IP and is called on every page load.
    Normal admin browsing plus one extra tab hits 429 and logs console errors. Same for
    `marketing-themes` (429 while switching modules).
35. The stay guide "no access" state is an unbranded gray card on white, unlike every other guest
    state.
    [screenshots/28-stay-guide-no-access.png](./screenshots/28-stay-guide-no-access.png)
36. The developer controls panel is rendered inside the guest payment step in any non-production
    build, so preview deployments expose "Save data / Send email / Generate New Data" to real testers.
37. **Seeded audit rows pair the wrong title with the action key**, so every super-admin demo shows
    "Replied to a support ticket" on a row recording a host verification approval. Seed bug, with no
    UI guard against a mismatched summary.
    [screenshots/40-admin-audit-wrong-labels.png](./screenshots/40-admin-audit-wrong-labels.png)
38. **Admin mobile filter strips clip at the right edge** on seven list pages, and the org hub section
    rail is hidden entirely at 390px (6,317px single scroll).
    [screenshots/45-admin-mobile-filter-clip.png](./screenshots/45-admin-mobile-filter-clip.png)

### P3 (highlights)

39. Finance mobile cash-flow chart: top axis tick renders `10k` while the rest render `₱8k`, `₱5k`.
40. Money inputs show `4500` while read-only values show `₱4,500.00` (no grouping in inputs).
41. Booking detail mobile stacks three levels of chrome ("Monaco 2604" switcher, "Booking" title,
    "Back to Bookings").
42. Guest calendar/form are a narrow centered card at 1440 with large empty margins and no price
    preview.
43. `get-sd-form` returns 404 for a booking in `PENDING_SD_REFUND` when opened without the emailed
    token, and the empty state offers only "Back to home".
44. Property dashboard "Bookings" count and org dashboard "Total Bookings" disagree by design
    (nights vs rows) but use the same words.

---

## What is genuinely good

- The booking workflow UI (stepper, nested sub-steps, confirm modal copy that lists exact side
  effects, past-date email checkboxes) is best-in-class for this kind of app.
- The trip page is a strong guest artifact: request state, next steps, host card, directions,
  parking hand-off, all on one screen.
- Unsaved-changes guards work on Templates and Property Settings (Save appears when dirty, guard
  offers Keep editing / Discard / Save & leave).
- Dark mode is consistent and readable across list, dashboard and forms (one dark-mode pass).
- Mobile bottom navigation and the card/list split are well executed; no horizontal scroll was found
  on any tested route at 390px.
- Role gating is enforced server-side even where the UI leaks affordances (viewer writes 403).
- Activity logging exists and is populated for guest submit, booking edits, trip links and
  transitions, which made this audit possible.

## Coverage

See each module report for the per-route table. Untested or partially tested:

- Onboarding step 3 (verification) and post-onboarding setup guide: stopped before creating real
  verification documents.
- Meta OAuth, Resend inbound, PayMongo checkout, Telegram delivery, Gemini calls: no real
  credentials locally; only their unconfigured states were reviewed.
- Native PWA install flow and Web Push: service worker is disabled under Vite dev by design.
- Email rendering: no provider, so only the send-attempt code paths were observed.

Aggregate numbers from this pass: 136 route variants, 272 page loads (1440x900 + 390x844), 0 empty
renders, 0 unhandled JS exceptions, 54 curated screenshots kept in
[`screenshots/`](./screenshots), axe-core run on 12 routes at both viewports.

## Screenshot gallery (reference)

Strongest surfaces and the clearest visual defects. Every image is a 1440x900 desktop capture unless
the filename says mobile.

| Image                                                                                    | What it shows                                                                      |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [06-booking-detail-review.png](./screenshots/06-booking-detail-review.png)               | Booking detail, Pending Review gate, step deck, guest view                         |
| [07-property-finance-desktop.png](./screenshots/07-property-finance-desktop.png)         | Property finance: KPIs, cash flow, donut with legend (the pattern the others lack) |
| [08-property-pricing-desktop.png](./screenshots/08-property-pricing-desktop.png)         | Pricing calendar with rate pills and the fees rail                                 |
| [09-property-maintenance-desktop.png](./screenshots/09-property-maintenance-desktop.png) | Maintenance list: mixed status pills and dashes                                    |
| [11-property-templates.png](./screenshots/11-property-templates.png)                     | Templates editor before dirty state (no Save visible)                              |
| [13-inbox-thread.png](./screenshots/13-inbox-thread.png)                                 | Inbox thread, composer, "7h 17m left" reply window                                 |
| [17-guest-form-desktop.png](./screenshots/17-guest-form-desktop.png)                     | Guest form step 1 at 1440 (narrow card, empty margins)                             |
| [19-guest-trip-after-submit.png](./screenshots/19-guest-trip-after-submit.png)           | Trip page immediately after a real submit                                          |
| [20-guest-home-mobile.png](./screenshots/20-guest-home-mobile.png)                       | Marketing home at 390                                                              |
| [22-guest-form-mobile.png](./screenshots/22-guest-form-mobile.png)                       | Guest form at 390 with "Guest 1/5" progress                                        |
| [23-bookings-mobile.png](./screenshots/23-bookings-mobile.png)                           | Bookings list at 390: 2x2 stage cards, card view                                   |
| [24-booking-detail-mobile.png](./screenshots/24-booking-detail-mobile.png)               | Booking detail at 390: stacked chrome                                              |
| [30-404.png](./screenshots/30-404.png)                                                   | Branded 404                                                                        |
| [31-dark-mode-bookings.png](./screenshots/31-dark-mode-bookings.png)                     | Dark theme on a dense table                                                        |
| [32-page-editor-showcase.png](./screenshots/32-page-editor-showcase.png)                 | Page editor: templates, live preview, device toggle                                |
| [34-onboarding.png](./screenshots/34-onboarding.png)                                     | New host onboarding, step 1 of 3                                                   |
| [46-admin-org-hub-mobile.png](./screenshots/46-admin-org-hub-mobile.png)                 | Org hub at 390 with no section rail                                                |
| [47-admin-edit-pro-dialog.png](./screenshots/47-admin-edit-pro-dialog.png)               | "Edit pro" dialog for the Business plan                                            |
| [49-parking-detail-blank-hero.png](./screenshots/49-parking-detail-blank-hero.png)       | Public parking detail with the 404 hero                                            |
| [50-host-profile-seed-copy.png](./screenshots/50-host-profile-seed-copy.png)             | Public host profile showing "Hosted by seed-owner"                                 |
| [51-guest-help-empty.png](./screenshots/51-guest-help-empty.png)                         | Guest help empty state                                                             |
| [52-account-trips.png](./screenshots/52-account-trips.png)                               | Account trips list                                                                 |
| [54-parking-bookings.png](./screenshots/54-parking-bookings.png)                         | Parking bookings with marketplace statuses                                         |
| [56-org-settings.png](./screenshots/56-org-settings.png)                                 | Org settings with disabled AI entries                                              |
| [57-notifications-panel.png](./screenshots/57-notifications-panel.png)                   | Notification panel                                                                 |
| [66-team-counts.png](./screenshots/66-team-counts.png)                                   | Team KPIs that do not reconcile                                                    |
| [67-org-plans-discount.png](./screenshots/67-org-plans-discount.png)                     | Plans page with the unapplied 20% promo                                            |
| [68-org-bookings-no-kanban.png](./screenshots/68-org-bookings-no-kanban.png)             | Org bookings view switcher without a board                                         |

## How to reproduce

Everything below was local only. Nothing was deployed.

```bash
# 1. Stack
bun install
./dev.sh                     # or: SKIP_NGROK=1 ./dev.sh

# 2. Seed + plan
bun run db:reset
bun run seed:plan -- --plan=pro
bun run seed:attach-admin

# 3. Sign in without OAuth (any seeded account, password `seed-password`)
curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: <local anon key>" -H "Content-Type: application/json" \
  -d '{"email":"seed-owner@example.com","password":"seed-password"}'
# then in the browser console:
# localStorage.setItem('sb-127-auth-token', JSON.stringify(<that response>))

# 4. Full crawl (screenshots + console + network + overflow)
node /tmp/audit/crawl.mjs        # routes in /tmp/audit/routes.json
node /tmp/audit/analyze.cjs      # summary of flagged routes

# 5. Accessibility
node /tmp/audit/axe.mjs          # writes /tmp/audit/axe.json
```

The audit scripts lived in `/tmp/audit` and are intentionally not committed. They are small enough to
recreate from the method described above if the team wants them in `scripts/`.
