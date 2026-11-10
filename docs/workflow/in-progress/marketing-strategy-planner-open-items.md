---
stage: in-progress
title: 'Marketing Planner — open items I need from the owner'
status: open
tags: [workflow, in-progress, marketing, planner, decisions]
updated: 2026-11-10
kind: checklist
---

# Marketing Planner — open items I need from the owner

Companion to [marketing-strategy-planner.md](./marketing-strategy-planner.md). Everything here is
something I cannot finish alone: a decision only you can make, an account or credential I do not
have, or a product input that must come from you.

**I keep building around these.** Each entry names what I do in the meantime so a missing answer
never stalls the branch.

Tick a box when it is addressed. If an answer changes a shipped default, the plan file's
`## 10.1 Decisions made while executing` table is where the change lands.

---

## 1. Access and credentials

- [ ] **Meta Developer app for the Phase 0.2 spike.** A dev app with a test Facebook Page and an
      Instagram business account, plus the ability to add me as a tester or hand over a Page token.
      Needed to confirm: FB Reels upload session, FB photo and video stories, IG carousel with
      `location_id`, `content_publishing_limit`, and the Instagram media / Facebook post insight
      metric names on Graph v25.
      **Meanwhile:** the publish path is written against the documented endpoints and feature-flagged
      behind the existing Meta connection, so nothing ships half-verified. Phase 3's Meta-specific
      calls stay marked `unverified` in the route guide until the spike runs.

- [ ] **`instagram_manage_insights` and `read_insights` App Review submission.** Only you can submit
      the screencast and privacy-policy answers for the Meta app.
      **Meanwhile:** the Results area shows tracked visits only, and the reconnect prompt is in place
      for connections that lack the scopes.

- [ ] **TikTok developer app (Phase 6, optional).** Content Posting API "upload to inbox" needs its
      own app and audit. Until then TikTok stays a Share it yourself channel.
      **Meanwhile:** nothing depends on it. Manual share is the default and is already planned.

- [ ] **Local Supabase admin session for the browser pass.** I can run the app and click through
      routes, but signing in needs a Google account on the admin allow list for the local stack.
      **Meanwhile:** every gate I can prove without a session is proven (type-check, unit, edge,
      build), and the UI is verified structurally, not visually.

## 2. Decisions only you can make

- [ ] **AI credit price for `marketing_plan_brief`.** I can measure the token cost on fixture
      properties. The credits-per-generation number and the monthly allowance impact are a pricing
      decision.
      **Meanwhile:** the router entry and the client price mirror are wired with a placeholder that
      is clearly marked `PENDING-PRICING`, and the feature works on the rules path with AI off.

- [ ] **Phase 3 sequencing.** Does `marketing-meta-publishing-gaps.md` ship on its own first, or do
      I fold its scope (scheduler cron, retry, permalink, carousel, Reels in UI) into Phase 3 as the
      plan permits?
      **Meanwhile:** I build the planner side behind the existing publish contract and do not
      duplicate the gaps plan's work.

- [ ] **Autopilot scope (Phase 6.3).** `approval_mode = auto_publish_connected` publishes without a
      tap. Do you want that in v1 at all, and if so for which tier?
      **Meanwhile:** the column exists, the default is `ask`, and no code path publishes without an
      explicit host action.

- [ ] **Multi-property hosts.** Per-property plans only for v1, or the org portfolio ranking from
      Phase 6.5 in the same release?
      **Meanwhile:** per-property, as the plan says.

- [ ] **Languages.** English, Filipino and Taglish are all wired. Confirm that is still the intent
      for launch copy, since every rules-mode string ships in three languages.

## 3. Product inputs

- [ ] **2027 Philippine holidays.** Proclamation 1006 covers 2026 only. The 2027 list does not exist
      yet, so it cannot be seeded.
      **Meanwhile:** 2026 is seeded, long weekends are derived in code, and the super-admin calendar
      surface is ready for the 2027 rows when the proclamation lands.

- [ ] **Which listing photos may be used in planner suggestions.** The planner suggests photos from
      the listing gallery. Confirm that is acceptable, or name the ones to exclude.
      **Meanwhile:** only the property's own gallery photos are candidates; nothing is scraped and no
      guest upload is used.

- [ ] **Review quotable scope.** Planner items can reuse guest review text when
      `socialSeedAllowed` is true (Kame and approved Facebook; Airbnb stays excluded by its terms).
      Confirm that reading is still correct for the planner.

## 4. Approval checkpoints

- [ ] **Merge PR #350** into `develop` when you have reviewed it. Later phases are easier on top of
      a merged base, but I can keep stacking commits on the branch.
- [ ] **Deploy gate.** Nothing is deployed. Migrations were applied to the local stack only and the
      backend deploy remains blocked until you say `kamewave` in the same message.

---

## 5. Remaining deep work (no decision needed, just time)

- [ ] **Prepare handoffs into the four editors.** Create on an item should open a filled design,
      video, calendar or AI Studio draft and attach the result back. This is the one deep item left.
      **Meanwhile:** the item sheet edits the draft in place, and Share it yourself works today.

- [ ] **Nav badge.** The Marketing nav item has no badge slot in its shape yet; adding one touches
      the sidebar and bottom-nav chrome on every page, so it waits for a nav pass.

- [ ] **Analytics marketing section (P5.7).** Tracked visits and attributed requests by item and
      channel, inside Analytics. The data exists; this is a read endpoint plus a section.

- [ ] **Carousel and Reels in the publish dialog.** Needs the P0.2 spike to confirm the endpoints.

- [ ] **Insight snapshots cron.** The mapper (`_shared/marketingInsights.ts`) is done and tested;
      the cron that calls Meta waits on the insight scopes.

- [ ] **Learned posting windows.** Needs 12 published posts with insights per property, so it is
      gated on real data, not code.

## 6. Known repo state, not caused by this branch

- [ ] **Two pre-existing `@ci` failures.** `orgPlanCheckout.spec.ts` ("successful return confirms
      payment", "celebration modal compare plans") fail on `origin/develop` too; verified by running
      them in a clean worktree at `origin/develop`. Not fixed here.

- [ ] **Develop CI is red** for `build-and-budgets`, `lint-and-types`, `static-guards` and others as
      of run 42567363673. Unrelated to the planner.

**Running E2E locally:** `playwright.config.ts` sets `reuseExistingServer: !CI`, so a Vite server
from another worktree (for example `.worktrees/deploy-skip` on 4199/4200) will be reused and the
tests run against the wrong code. Use `CI=1 PLAYWRIGHT_PORT=4273 PLAYWRIGHT_PWA_PORT=4274` when
other worktrees are open.

## What is NOT on this list

Things I can and will finish without you, so they are not listed as blockers:

- Phase 1 gaps: setup wizard, item sheet with reschedule and format change, Why panel, Coming up
  strip, host-authored items, claim revalidation on read, skeletons, feature-availability keys.
- Phase 2 Prepare: handoff payloads, `attach_asset`, photo ranking, Prepare my week batch.
- Phase 4 AI: prompt module, deterministic guard, fail-open to rules copy, eval fixtures.
- Phase 3 planner-side publishing: scheduler claiming, pre-publish claim check and hold, Share it
  yourself, reminders.
- Phase 5: tracked links on items, attribution wiring, insights mapper, results rollup.
- Phase 6: assistant read and write tools, org portfolio view.
- Docs, route guide, FAQs, tests, and every local gate.
