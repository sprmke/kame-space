---
stage: for-testing
title: 'Host-set parking pricing — hosts set the nightly rate, platform adds a guest service fee'
status: for-testing
tags: [planning, parking, pricing, payments, super-admin]
updated: 2026-11-19
---

# Host-set parking pricing

> **Revised 2026-11-19 (execute-plan):**
>
> - **Economics changed.** The first draft had the guest pay the host rate and the platform live on the 10% / 5% host commission alone. That **loses money at low rates**: PayMongo costs `3.125% + ₱15` of the guest charge, so at ₱100/night the 10% commission (₱10) is below the processor cost (₱18.13). Direct link (5%) loses until about ₱800/night. The plan now adds a **guest service fee on top of the host rate** (Airbnb-style hybrid), so the platform never sells below cost.
> - Added `guest_fee_pct` / `guest_fee_fixed` super-admin settings, a no-loss guard on save, a `guest_fee_total` snapshot column, and a fee line wherever a guest sees a total.
> - Replaced the "stop reading guest rates" wording with a real migration plan: search index price, `pls_refresh_parking`, and the `platform_parking_settings` trigger.
> - Audit findings added: the dirty `main` checkout holds an unrelated half-finished soft-cap edit, the host-rate trigger on the search index already exists, refund math is already snapshot-based, and offline/complimentary rows bypass the amounts function.
> - Added Decisions, Edge cases, per-phase Acceptance, Rollback, and the guest-money pass.

## Goal

Hosts set their own parking nightly rates with **no maximum** (minimum ₱100, step ₱50). The guest pays **host rate + a small service fee**. The host receives **host rate − commission** (10% standard, 5% direct link). The platform keeps `service fee + commission − processor cost`, and the defaults are chosen so that figure is **positive at every legal rate**. Super admin keeps full control of the fee and commission levers.

## Money model

```
H  = Σ host nightly rate per night (date override > weekday/weekend)
F  = round2(H × guest_fee_pct + guest_fee_fixed)          # per booking, not per night
G  = H + F                                                 # guest charge  (PayMongo amount)
C  = round2(H × commission_pct)                            # 10% standard, 5% direct_link
Host net     = H − C
Processor    = G × payment_fee_pct + payment_fee_fixed     # estimate, kept by PayMongo
Platform net = G − Host net − Processor = F + C − Processor
```

| Setting                 | Default      | Why                                                                                 |
| ----------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `commission_pct`        | 10%          | unchanged (host side)                                                               |
| `direct_commission_pct` | 5%           | unchanged (host side, own-link bookings)                                            |
| `guest_fee_pct`         | 5%           | margin that scales with price                                                       |
| `guest_fee_fixed`       | ₱15          | passes the PayMongo fixed fee through, so a ₱100 night is not eaten by the ₱15 flat |
| `payment_fee_*`         | 3.125% + ₱15 | unchanged (estimate of processor cost)                                              |

Worked examples (defaults):

| Host rate (1 night) | Guest pays | Host gets | Processor | Platform net (std) | Platform net (direct) |
| ------------------- | ---------- | --------- | --------- | ------------------ | --------------------- |
| ₱100                | ₱120       | ₱90       | ₱18.75    | **+₱11.25**        | **+₱6.25**            |
| ₱300                | ₱330       | ₱270      | ₱25.31    | **+₱34.69**        | **+₱19.69**           |
| ₱1,000              | ₱1,065     | ₱900      | ₱48.28    | **+₱116.72**       | **+₱66.72**           |

Platform net as a function of `H`: `net(H) = slope × H + intercept` with `slope = c + f − p(1 + f)` and `intercept = guest_fee_fixed × (1 − p) − payment_fee_fixed` (with `c` commission, `f` = `guest_fee_pct`, `p` = `payment_fee_pct`; defaults give slope 0.1172, intercept −₱0.47). **No-loss rule: `slope ≥ 0` and `net(₱100) ≥ 0` for both channels.** The super-admin save is rejected if either fails, so no config can lose money at any rate ≥ ₱100.

## Scope

**In:** payment amounts, guest fee settings + snapshot, public `ratePerNight`, search index price, broadcast ranking, host rate validation (min ₱100), host Pricing UI, super-admin settings UI, docs, FAQ, tests.
**Out:** PayMongo Platforms / auto-disbursement, stay (property) pricing, backfilling historical payment rows, dropping `guest_rate_*` columns (left unread; drop in a later migration after one release).

## Audit findings (code vs first draft)

| Area                                                             | Finding                                                                                                                                     | Plan change                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parkingPaymentOrchestrator.ts#computeParkingPaymentAmounts`     | Guest charge = Σ platform `guestRateWeekday/Weekend`; host gross already per-night with overrides                                           | Guest charge = `H + F`; reuse the same per-night loop                                                                                                                                                                                       |
| `parkingSettlement.ts`                                           | Already takes `guestChargeTotal` and `hostGrossTotal` separately, so `platformNet = F + C − Processor` falls out with **no formula change** | Keep as is, add tests only                                                                                                                                                                                                                  |
| `parkingBroadcastRanking.ts`                                     | `isPriceCappedOut` drops candidates above the platform guest rate                                                                           | Delete the filter; rank cheapest-first by host gross, dedupe unchanged                                                                                                                                                                      |
| `parkingScope.ts` (L235-291), `publicListingCards.ts` (L321-491) | Public `ratePerNight` and `pricing.weekday/weekendNightlyRate` come from the platform guest rate                                            | Read the host `parking_settings` rate instead                                                                                                                                                                                               |
| `20261327000000_parking_guest_rate_index_fix.sql`                | `pls_refresh_parking` writes `price` from `platform_parking_settings.guest_rate_weekday`, with a trigger on that table                      | New migration: `pls_refresh_parking` reads `parking_settings.weekday_nightly_rate`; drop the platform trigger. The `pls_parking_settings_sync` trigger on host rate **already exists** (index migration L903), so host edits refresh search |
| `parkingPricing.ts`                                              | `validateMoneyField` accepts `>= 0`; `assertWithinGuestRateCap` rejects above cap; DTO carries `guestRate*`/`guestRateCap*`                 | Min ₱100 on base + overrides, cap removed, DTO drops `guestRate*`/`guestRateCap*`                                                                                                                                                           |
| `parking-pricing/index.ts` L50-55                                | Handler pre-validates `>= 0` before the shared validator, so it would accept ₱99                                                            | Align the handler to the shared validator (single source)                                                                                                                                                                                   |
| `platform-parking-settings/index.ts`                             | GET/PATCH carry `guestRateWeekday/Weekend`                                                                                                  | Remove them; add `guestFeePct`, `guestFeeFixed`, no-loss guard                                                                                                                                                                              |
| `parkingPayoutRules.ts`, `parking-payouts` refund                | Refund cap uses `guest_charge_total` from the row                                                                                           | Already snapshot-based, no change. Refund can include the fee (guest cap = what they paid), documented                                                                                                                                      |
| `parking_payment_transactions`                                   | No column for the fee                                                                                                                       | Add `guest_fee_total NUMERIC(12,2) NOT NULL DEFAULT 0` (historical rows 0)                                                                                                                                                                  |
| Offline / complimentary rows (`guest_charge_total: 0`)           | Created outside `computeParkingPaymentAmounts`                                                                                              | No fee on these; test asserts `guest_fee_total = 0` and `chargePaymentFee: false` stays                                                                                                                                                     |
| `ui/.../parkingPayout.ts`                                        | `computeParkingNightlyPayout({hostRate, guestRate, ...})`                                                                                   | New input `{ hostRate, commissionPct, guestFeePct, guestFeeFixed }`; `guestRate` removed                                                                                                                                                    |
| `SuperAdminParkingPayoutsPage.tsx`                               | Guest rate editors + preview assume fixed guest ₱                                                                                           | Replace with fee pct + fixed inputs and a live preview at ₱100 / ₱300 / ₱1,000 for both channels, plus the no-loss warning                                                                                                                  |
| Working tree on `main` (`geoduck`)                               | 154 uncommitted files, including a half-finished soft-cap edit of this same feature                                                         | **Not touched.** Work happens on `feat/host-set-parking-pricing` from `origin/develop`; those edits are superseded and can be discarded after merge                                                                                         |

## Phases

### Phase 1 — Money path (server) ✓

- Migration `<ts>_parking_guest_fee.sql`: add `guest_fee_pct NUMERIC(5,4) NOT NULL DEFAULT 0.05`, `guest_fee_fixed NUMERIC(12,2) NOT NULL DEFAULT 15` to `platform_parking_settings` (CHECK `0..1`, `>= 0`); add `parking_payment_transactions.guest_fee_total`.
- `parkingPlatformSettings.ts`: add `guestFeePct`, `guestFeeFixed`; delete `resolveParkingGuestNightlyRate` and the `guestRate*` fields.
- New pure `parkingGuestFee.ts`: `computeGuestFee(hostGross, pct, fixed)` and `checkParkingNoLoss(settings, minRate)`.
- `computeParkingPaymentAmounts`: guest charge `G = H + F`; return `guestFeeTotal`; insert it on the transaction.
- Dashboard ledger reads (`dashboardService`, `parking-payments`, `parking-payouts`) expose `guestFeeTotal`.
- **Acceptance:** `cd supabase/functions && deno test` on `parkingSettlement_test.ts`, `parkingGuestFee_test.ts`, `parkingPaymentOrchestrator_test.ts` pass; guest charge `= H + F`, host net `= H × (1 − c)`, platform net `> 0` at ₱100 for both channels.

### Phase 2 — Public price + ranking ✓

- `parkingBroadcastRanking.ts`: remove `isPriceCappedOut` and the platform-settings read; keep rank + dedupe.
- `parkingScope.ts`, `publicListingCards.ts`: `ratePerNight` and pricing DTO from host `weekday/weekendNightlyRate`.
- Migration `<ts>_parking_search_price_host_rate.sql`: `CREATE OR REPLACE pls_refresh_parking` using `parking_settings.weekday_nightly_rate` (fallback ₱300); drop `pls_platform_parking_settings_sync`; re-run the refresh for all parkings.
- Update `parkingHardeningGates.test.ts` (it asserts the old `pls_refresh_parking` shape).
- **Acceptance:** Deno ranking test keeps a ₱5,000 candidate and orders cheapest-first; public card test shows host weekday rate; `parkingHardeningGates.test.ts` passes.

### Phase 3 — Host rate validation ✓

- `parkingPricing.ts`: `validateMoneyField` gets a `{ min }` option; base rates and every override must be `>= 100` (`"Weekday rate must be at least ₱100"`); remove `assertWithinGuestRateCap`, `isWeekendRateDay`; keep the `999_999_999` ceiling. Also validate **step 50 is a UI hint only** (server accepts any ≥ ₱100 so existing ₱325 rates and API clients do not break).
- `parking-pricing/index.ts`: use the shared validator for base rates (drop the inline `>= 0` check).
- DTO: remove `guestRate*` and `guestRateCap*`; add `guestFeePct`, `guestFeeFixed`, `commissionPct`, `directCommissionPct` (host-readable, needed for the fee preview).
- **Existing host rates below ₱100:** do not mutate data. Reads return the stored value; the form shows it, flags "Minimum ₱100", and disables Save until fixed. Checkout still charges the stored rate, so no in-flight booking breaks.
- **Acceptance:** handler test: PATCH 99 → 400, 100 → 200, override 99 → 400, no max rejection at ₱50,000.

### Phase 4 — Host Pricing UI ✓

- `ParkingPricingRatesFormCard.tsx`: `min={100}`, `step={50}`, clearable draft, empty draft never saves, Save disabled if empty or `< 100`. Preview rows: **Guests pay** (`H + F`), **Platform fee** (commission on host rate), **You receive** (`H − C`). Remove the amber above-guest warning and `guestRate*` props.
- `ParkingDirectLinkCard.tsx`: 5% vs 10% comparison on the host weekday rate.
- `parkingPayout.ts` + `parkingPayout.test.ts`: new input shape; Vitest for fee math and the min-100 guard helper.
- `ParkingPricingPage.tsx`, `ParkingPricingStatsRow.tsx`, `pricingHelpCopy.ts`, `SetupGuidePricingEmbed.tsx`: drop "platform guest rate" / "not matched above" copy and the `guestRate*` props.
- Unsaved-changes guard stays on the form; verify at 375 / 768 / 1024px.
- **Acceptance:** `bun run test` (Vitest) for `parkingPayout.test.ts`; Playwright `@ci` host pricing spec sets ₱350, sees guests pay ₱15 + 5% on top, sees ₱99 blocked.

### Phase 5 — Super admin ✓

- `platform-parking-settings/index.ts`: remove guest-rate fields; add `guestFeePct` (0..1) and `guestFeeFixed` (≥ 0); run `checkParkingNoLoss` on the merged settings and return 400 with the shortfall if it fails.
- `SuperAdminParkingPayoutsPage.tsx`, `usePlatformParkingSettings.ts`: fee inputs, preview table, inline no-loss warning.
- Emit `activity_log` for the settings save if the handler already does; otherwise `activity-log: N/A — platform-level config, not an org/property/parking mutation` (verify during build).
- **Acceptance:** handler test: settings with `commission 0.01, fee 0` → 400; defaults → 200. Playwright `@ci`: payouts page has no guest-rate inputs and shows the fee inputs.

### Phase 6 — Guest-visible totals ✓

- Anywhere a guest sees a payable parking total (status page, pay page, form summary, receipt/email) shows **rent + service fee = total** from the snapshotted `guest_fee_total`, never re-derived.
- Public cards show the **host weekday rate** as `₱X / night` (no fee in the headline, no leading "from": the card carries one rate and "from" would be wrong when the weekend rate is lower). The detail page booking card adds the service fee line and the total.
- **Acceptance:** Playwright `@ci` (mocked edges): card shows the host rate; pay page shows the fee line and the total equals PayMongo `amountCentavos`.

### Phase 7 — Docs, FAQ, cleanup ✓

- `docs/guides/routes/org/parking/pricing.md`, `docs/guides/routes/admin/parking-payouts.md`, finance guide, FAQ parking price Qs + host-facing knowledge Q&A, `docs/PROJECT.md` (Phase 3/4 payment blurb), `docs/architecture/data-model.md`, `.cursor/rules/parking-workflow.mdc` (L164, 261, 281, 560 cap references), `docs/archive/operations/migration-runbook.md`.
- Run `check:support-content` and `check:ai-knowledge-coverage`.
- **Acceptance:** `git grep -nE "guestRate|guest_rate|assertWithinGuestRateCap|isPriceCappedOut|resolveParkingGuestNightlyRate"` returns only the two historical migrations, `done/` workflow docs, and the unread `guest_rate_*` DB columns.

## Decisions

| Decision                         | Choice                                                                                                                                                 | Why                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Where the platform earns         | Host commission **and** a guest service fee                                                                                                            | Commission alone loses money below about ₱218 (std) and ₱800 (direct); the fee fixes the floor without capping hosts |
| Fee shape                        | `% of host gross + fixed per booking`                                                                                                                  | The processor's fixed ₱15 is per transaction, so the fixed part must be per booking, not per night                   |
| Fee on direct-link bookings      | Same fee, lower host commission                                                                                                                        | Processor cost is identical; the host incentive stays in the 5%                                                      |
| No-loss enforcement              | Hard reject on super-admin save                                                                                                                        | The user wants a guarantee, not a warning. Reversible (one validation)                                               |
| Step 50                          | UI hint only, server accepts any value ≥ ₱100                                                                                                          | Existing rates and API clients are not broken                                                                        |
| Existing rates < ₱100            | Left as is, host blocked from saving until fixed                                                                                                       | No silent data change; in-flight bookings keep charging the stored rate                                              |
| `guest_rate_*` columns           | Left in place, unread                                                                                                                                  | Avoids prod DDL risk; drop after one release                                                                         |
| Refund cap                       | Whole guest charge including fee                                                                                                                       | Refunds already cap at `guest_charge_total`; fee-retention policy is a separate product call                         |
| Host preview wording             | "Guests see ₱X / night" + one line about the guest fee, not "Guests pay ₱X + fee"                                                                      | The fixed part is per booking, so a per-night "guests pay" figure would mislead on multi-night stays                 |
| Guest-visible total              | Public detail card adds a **Service fee** line; `loadPublicParkingBySlug` now returns `guestFeePct`/`guestFeeFixed` and the host's real date overrides | Otherwise the card total is lower than the PayMongo charge, and overrides priced differently from checkout           |
| Host revenue in analytics/ledger | `host_gross_total` (not `guest_charge_total`)                                                                                                          | The guest fee belongs to the platform; host dashboards must never count it as host income                            |
| Search index                     | New migration re-reads host weekday rate; platform trigger dropped                                                                                     | Host edits already refresh via `pls_parking_settings_sync`                                                           |
| Commit scope                     | `feat(supabase)` / `feat(ui)`                                                                                                                          | commitlint only allows a fixed scope list                                                                            |
| Plans / RBAC                     | `N/A — reuses existing parking pricing:edit and the super-admin gate`                                                                                  | No new capability                                                                                                    |

## Edge cases

| Case                                                     | Expected                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Host clears the field                                    | Draft empty, Save disabled, nothing sent                                         |
| Host enters 99 / 100 / 50,000                            | 99 blocked client + server; 100 and 50,000 accepted                              |
| Date override below ₱100                                 | Rejected with the date in the error                                              |
| Stay mixes weekday, weekend, override nights             | Per-night sum `H`, one fee `F`                                                   |
| 1 night at ₱100, direct link                             | Platform net ≥ 0 under defaults (+₱6.25)                                         |
| Pending transaction created at old rate, host edits rate | Existing pending link kept (idempotent reuse); a different parking id expires it |
| Host rate changes after checkout                         | Snapshot unchanged                                                               |
| Complimentary / offline booking                          | `guest_charge_total = 0`, `guest_fee_total = 0`, no processor fee                |
| Super admin lowers commission to 0                       | Rejected if no-loss rule fails                                                   |
| Missing `platform_parking_settings` row                  | Stub defaults (10%, 5%, 5%, ₱15)                                                 |
| Search index stale after host edit                       | Existing `pls_parking_settings_sync` trigger refreshes; test the trigger path    |
| Multi-spot host in broadcast                             | Cheapest spot kept, tie-break `created_at`; no price exclusion                   |
| Money rounding                                           | `round2` on `F`, `C`, and sums; PayMongo centavos = `G × 100` rounded            |

## Guest-money pass

| Risk             | Requirement                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Money            | Amounts computed once at checkout creation and snapshotted (`guest_charge_total`, `guest_fee_total`, `host_gross_total`, `commission_pct`) |
| Telemetry        | `amount_bucket` only; no names, emails, or tokens                                                                                          |
| Public endpoints | No new public handler; existing rate-limit gates untouched                                                                                 |
| Cross-tenant     | Host pricing handler stays scoped by `parking_id` + `resolveScopedParkingAccess`                                                           |
| Copy             | Short, plain, no em dash (`human-copy`)                                                                                                    |

## Verification

```bash
bun run type-check && bun run lint
bun run test                      # Vitest
bun run test:edge                 # Deno _shared + handlers
bun run test:e2e:ci               # parking host/guest/admin specs
bun run check:support-content && bun run check:ai-knowledge-coverage
```

## Rollback

| Phase               | Undo                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| 1                   | Revert the commit; new columns are additive and unread by old code                              |
| 2                   | Revert; a follow-up migration restores the old `pls_refresh_parking` (kept in `20261327000000`) |
| 3-6                 | Revert the commits; no data was mutated                                                         |
| Bad fee config live | Super admin sets `guest_fee_pct` / `guest_fee_fixed` back; applies to new checkouts only        |

## Risks

- **Prod deploy** needs the user's `kamewave`; everything is built and verified locally first. Deploy order: migrations, then functions, then UI.
- The platform estimates processor cost (`payment_fee_*`); if PayMongo changes its rate, super admin must update it or the no-loss guard checks stale numbers.
- Guests now see a service fee line; FAQ and copy must say so plainly.

## Verification results

Branch `feat/host-set-parking-pricing`, run on the worktree with `supabase/.env.local` moved aside (it injects `TURNSTILE_SECRET_KEY`, which makes five unrelated handler tests demand human verification; develop passes the same way).

| Gate                                                                                                                                                                                                                                                | Result                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| type-check, lint (0 errors)                                                                                                                                                                                                                         | pass                                                                                                 |
| Vitest (6460) and dom tests                                                                                                                                                                                                                         | pass                                                                                                 |
| Deno `_shared` (2065) and handlers (1448)                                                                                                                                                                                                           | pass                                                                                                 |
| support-content, ai-knowledge-coverage, migration security and version guards                                                                                                                                                                       | pass                                                                                                 |
| Playwright smoke                                                                                                                                                                                                                                    | 269 pass; `guestFormSubmit` is a known baseline flake (also fails 1 in 30 on clean `origin/develop`) |
| Playwright `@ci` (408 pass, 34 skipped), build, bundle budgets, preload, source-map and blocking-script guards                                                                                                                                      | pass                                                                                                 |
| Full `ci-quality-gate.sh`, one run on the final tree                                                                                                                                                                                                | pass (`GATE_EXIT 0`)                                                                                 |
| Phase 3: handler tests `parking-pricing-rates.test.ts` (99 and 0 rejected with no write, date override 99 names the date, 100 saved, 50,000 and 75,000 saved)                                                                                       | pass                                                                                                 |
| Phase 4: `@ci` `parkingPricingEdit.spec.ts` (₱350 shows Guests see ₱350, Platform fee -₱35, You receive ₱315 and the fee hint; ₱99 blocks Save; cleared field stays empty; ₱5,000 allowed; no sideways scroll and a 44px Save at 375, 768 and 1024) | pass                                                                                                 |
| Phase 5: handler tests `platform-parking-settings-no-loss.test.ts` (commission 1% with no fee returns 400 and writes nothing; defaults return 200; out-of-range fee 400) and `@ci` `parkingAdminPayouts.spec.ts` (fee inputs, no guest-rate inputs) | pass                                                                                                 |
| Phase 6: guest pay screen shows rent + service fee = total (`@ci` `parkingGuestPaymentBreakdown.spec.ts`); Deno `parkingGuestFee_test.ts` asserts the PayMongo amount equals host gross + fee (2,400 → 2,535)                                       | pass                                                                                                 |
| Phase 2: Deno `publicListingCards_parkingRate_test.ts` (card `ratePerNight` is the host weekday rate 1,250; no settings row falls back to 300)                                                                                                      | pass                                                                                                 |
| Phase 4: direct link card compares 5% with 10% on the draft weekday rate (`@ci` `parkingPricingEdit.spec.ts`: ₱350 shows you receive ₱332 instead of ₱315); math covered in `parkingPayout.test.ts`                                                 | pass                                                                                                 |
| Phase 6: public parking card shows the host rate (`@ci` `publicListingBrowse.spec.ts`: API rate ₱1,250 renders `₱1,250 / night`)                                                                                                                    | pass                                                                                                 |
| Phase 7 acceptance grep                                                                                                                                                                                                                             | pass (only tests, historical migrations and workflow docs remain)                                    |

Not done: no production deploy (needs `kamewave`); `geoduck` stale soft-cap edits untouched.
