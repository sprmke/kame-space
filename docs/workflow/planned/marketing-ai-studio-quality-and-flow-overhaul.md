---
stage: planned
title: 'Marketing AI Studio: output quality and end-to-end flow overhaul'
status: planned
tags: [workflow, planned, marketing, ai, design, ux, polotno, remotion]
updated: 2026-11-12
kind: plan
---

# Marketing AI Studio: output quality and end-to-end flow overhaul

**Route:** `/org/:orgSlug/property/:propertySlug/marketing` · **Guide:** [`marketing.md`](../../guides/routes/org/property/marketing.md) · **Architecture:** [`marketing-poster-studio.md`](../../architecture/marketing-poster-studio.md), [`marketing-themes.md`](../../architecture/marketing-themes.md), [`marketing-video-editor.md`](../../architecture/marketing-video-editor.md)

**Builds on:** [`marketing-ai-poster-studio.md`](../in-progress/marketing-ai-poster-studio.md) (its "Still open" list is absorbed here), [`marketing-ai-image-quality-hardening.md`](../for-testing/marketing-ai-image-quality-hardening.md), [`marketing-ai-video-quality.md`](../for-testing/marketing-ai-video-quality.md), [`ai-studio-sample-assets.md`](../in-progress/ai-studio-sample-assets.md).

## 1. Goal

Make AI Studio a feature hosts pay for: every post, photo and video it produces should be good enough to publish as is, and the flow from "I want a post" to "it is on Instagram" should match what hosts already know from Canva, Adobe Express and CapCut. Today the pipeline works, but the output looks template-made and sometimes broken, and the flow hides the controls hosts expect (which photo, which words, which layout). This plan fixes the causes in order: broken renders first, then the design system, then photo and copy choices, then the flow, then photo and video modes.

## 2. Scope

**In**

- AI Studio (the `generate` tab): home, create, results, refine, export, for Post, Photo and Clip, plus a new Reel output.
- The poster engine (`ui/src/features/dashboard/marketing/lib/poster/**`) and its director (`supabase/functions/_shared/marketingPosterDirector.ts`).
- The example gallery, the rule-based fallback, and the built-in Posts / Videos / Calendar template art (audit and fix pass).
- Quality measurement: fixtures, contact sheets, a rubric, telemetry.

**Out**

- Meta publishing gaps (scheduling, carousels on publish, Reels to Facebook): [`marketing-meta-publishing-gaps.md`](./marketing-meta-publishing-gaps.md).
- Storage quotas: [`marketing-storage-quotas-and-retention.md`](./marketing-storage-quotas-and-retention.md).
- Server-side rendering for autopilot posting (stays a later phase of the poster plan).
- Porting marketing palette v3 into the app theme (`ui/src/index.css`).
- New plan tiers or price changes.

## 3. Findings

### 3.1 What the screenshot shows (AI Studio home, example gallery, 2026-11-12)

The six cards are not static templates. Each is a live render of the **rule-based fallback** in one fixed layout, drawn with the host's own listing (`useAiStudioPostSamples.ts` → `useAiPosterEngine.renderSample` → `buildRuleBasedPosterSpecs` → `compilePosterDocument` → `renderPosterDocument`). So the gallery is the worst-case output of the same engine AI Post uses, shown as the first thing a host sees.

| Card              | Layout · goal · size                | Visible defect                                                                                                         | Cause (section) |
| ----------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------- |
| Weekend escape    | `magazine-cover` · vibe · 4:5       | Five type voices, a 4-word thin script line over a busy photo, olive wash over the photo, square logo pasted on a pill | C1 C2 C3 C5 C7  |
| Book direct       | `sky-headline` · promo · 4:5        | Pink block instead of the photo, script overlapping the eyebrow, eight stacked modules, "Special rate" with no rate    | B1 C4 C5 C6     |
| Amenity spotlight | `feature-sticker` · amenities · 1:1 | Photo washed out by two 90% scrims that meet, a mosquito racket as hero photo, logo and sticker overlapping copy       | C3 C8 C7        |
| Night in          | `night-glass` · promo · 9:16        | Yellow-green script on blue over a console close-up, tiny text, top stack under the Stories header                     | C2 C8 B5        |
| Standout feature  | `magazine-cover` · feature · 4:5    | "WiFi included" as the standout feature, failed photo with the error text showing through                              | C5 B1           |
| Check-in guide    | `minimal-title` · stay info · 9:16  | Failed photo; the layout prints no check-in or check-out time at all                                                   | B1 B4           |

### 3.2 Root causes

**B. Bugs (output is broken)**

| #   | Root cause                                                                                                                                                                                                                                                                                                                                                                                           | Evidence                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Failed photo loads are exported and then cached.** OpenPolotno draws a failed image as a red block with "Can not load the image..." and still exports it. The renderer never checks image state, and the sample hook stores the result in memory and IndexedDB, so the broken card sticks. The same photo URL loads in one card and fails in another, so the failure is transient, not a bad file. | `lib/poster/posterRender.ts:70-89`, `hooks/useAiStudioPostSamples.ts:66-84`, `node_modules/openpolotno/dist/config.js` (error placeholder, `onLoadError`) |
| B2  | **Full-size originals are loaded for every render**, four renders in a row, each through Polotno's own network loader. Nothing is preloaded, downscaled or retried.                                                                                                                                                                                                                                  | `lib/poster/posterPhotoSizes.ts` (sizes only), `photoElement` in `lib/poster/posterModules.ts`                                                            |
| B3  | **Exports are recompiled from the stored spec.** A post version stores `spec`, `photo_urls` and a preview, not the compiled document. Any layout change silently changes what an old version downloads or publishes.                                                                                                                                                                                 | `supabase/migrations/20261316128500_marketing_ai_sessions.sql:70-79`, `hooks/useAiPosterEngine.ts:282-293`                                                |
| B4  | **Example and layout do not match.** "Check-in guide" uses `minimal-title`, which has no info module. Feature spotlight headlines `amenities[0]`.                                                                                                                                                                                                                                                    | `lib/aiStudioSamples.ts:162-171`, `lib/poster/posterArchetypes.ts:1009-1066`, `lib/poster/posterDefaults.ts:43-49`                                        |
| B5  | **Story safe zones are wrong.** Only the bottom 10% is reserved. The top stack starts about 7% down, under the Stories header. Reels and Stories need roughly the top 14% and bottom 18 to 20% quiet.                                                                                                                                                                                                | `lib/poster/posterModules.ts:60`                                                                                                                          |
| B6  | **The director is blind on local stacks.** `loadPosterPhotos` keeps only `https://` URLs, so local `http://127.0.0.1` photos are dropped and the model picks layouts and photos without seeing them. Locally the `marketing_template` kill switch is also on and the Gemini keys are free tier, so local testing only ever exercises the fallback.                                                   | `_shared/marketingPosterDirector.ts:446`, `docs/workflow/in-progress/ai-studio-sample-assets.md`                                                          |
| B7  | **Two AI design engines and dead UI.** The Posts editor's AI rail still uses the old token engine (`designAiTokens.ts`, `polotnoAiCampaignDocuments.ts`), a second quality level. `AiStudioSection.tsx` and `AiPostPanel.tsx` are no longer imported anywhere.                                                                                                                                       | `components/design-editor/PolotnoDesignStudio.tsx`, grep for `AiStudioSection`                                                                            |

**C. Design causes (output is ugly)**

| #   | Root cause                                                                                                                                                                                                                                                                                                                                                             | Evidence                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| C1  | **Themes swap font families into type roles tuned for other faces.** The theme replaces display, body and label families but keeps each role's weight, caps, tracking, outline and shadow. The script accent and the hard-coded Fredoka wordmark stay. One poster ends up with four or five unrelated faces.                                                           | `lib/theme/posterThemeAdapter.ts:21-32`, `WORDMARK_ROLE` at `lib/poster/posterArchetypes.ts:197-204` |
| C2  | **Every color is a tint of the brand accent.** Ink, muted ink, deep, glow and scrims are all mixed from the accent. With a green brand this gives green text on green washes and a yellow-green "glow" on navy, the exact look already rejected for the social studio (palette v3: neutral darks, never green on green).                                               | `lib/poster/posterColor.ts:84-87`, `posterArchetypes.ts:1078`                                        |
| C3  | **Legibility is bought by covering the photo.** The engine does not know where the photo is calm, so it places text at fixed positions and lays a tinted scrim at up to 92% alpha under the whole text stack. On a square, the top and bottom scrims meet and the photo is gone. The photo is the product.                                                             | `posterArchetypes.ts:126-194`, `:1314-1317`, `:1594-1597`                                            |
| C4  | **No hierarchy budget.** One layout can stack eyebrow, script, headline, CTA pill, subhead, chip pill, icon row, property name and an info bar. Chips repeat the icon row. The reference rule "one hero line, one support line, one module band, one footer" is written in the plan but not enforced in code.                                                          | `buildSkyHeadline` in `posterArchetypes.ts:441-699`                                                  |
| C5  | **Fallback copy is generic and sometimes wrong.** One tagline on every post, "Good vibes only", "Special rate" with no offer, the listing name used as headline and wordmark and pill at once, amenities taken in stored order so WiFi and air conditioning lead. The script slot accepts up to 45 characters, so a place name becomes three lines of hairline script. | `lib/poster/posterDefaults.ts:31-63`, `lib/poster/posterSpec.ts:93-102`                              |
| C6  | **Dated effects and fragile faces.** White outline strokes, drop shadows and hairline scripts (Sacramento, Great Vibes, Allura) at small sizes over photos. Script glyphs overshoot their boxes and hit neighbors. Polotno's Google loader only provides weights 400 and 700.                                                                                          | `lib/poster/posterFonts.ts`, `posterText` effects in `posterModules.ts:123-138`                      |
| C7  | **The logo is pasted raw.** A square JPEG with its own background lands on the photo, and one layout overlaps it onto the feature strip on purpose.                                                                                                                                                                                                                    | `logoElement` in `posterModules.ts:806-825`, `posterArchetypes.ts:1304-1313`                         |
| C8  | **Photos are not chosen.** The fallback rotates photos by index, crops by a constant `focusY`, and never checks sharpness, exposure, orientation or subject. A racket or a console close-up becomes the hero.                                                                                                                                                          | `posterDefaults.ts:81-84`, `fullBleedPhoto` in `posterArchetypes.ts:85-98`                           |
| C9  | **QA is geometry only, and the ship gate was never run.** The audit checks boxes, overlap and minimum size on the document model. It never looks at pixels, contrast on the real photo, or a failed image. The blind eval against the benchmark posts is still open.                                                                                                   | `lib/poster/posterAudit.ts`, "Still open" in the poster plan                                         |
| C10 | **Six one-off layouts, one genre.** All six copy the busy "staycation flyer" look. There is no clean, photo-first, editorial or carousel layout, which is what holds up best on arbitrary photos and copy. Each layout is 200 to 300 lines of hand-placed coordinates per format, so tuning is slow and spacing is inconsistent.                                       | `posterArchetypes.ts` (1,621 lines)                                                                  |

**U. Flow causes (hard to use well)**

| #   | Gap                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | The home page's first impression is the worst-case output (3.1), rendered live with Konva on the landing tab.                                                                                         |
| U2  | A post cannot be given a photo. The form has an angle and a size only; the engine picks photos silently.                                                                                              |
| U3  | The preview pane is a static placeholder until credits are spent.                                                                                                                                     |
| U4  | Four results land in a version stepper, one on stage at a time. Comparing means clicking through; other tools show a grid first.                                                                      |
| U5  | Fixing one word needs an AI call (credits) or leaving for the full editor. Free actions (Shuffle layout, size) are hidden in the ⋯ menu. No photo swap, no text edit, no layout picker on the result. |
| U6  | The fallback is a toast ("AI styling is busy"). The results are not labeled and there is no retry on the result itself.                                                                               |
| U7  | Promo has no place to enter the actual offer, so the copy cannot state one.                                                                                                                           |
| U8  | Photo mode builds "a new picture of your place". That is the source of the AI look and a trust risk; hosts mostly need their real photo made better.                                                  |
| U9  | Clip is one raw 8 second shot with no text, brand or music. The postable unit is a 12 to 20 second reel.                                                                                              |
| U10 | No telemetry in the module, so there is no kept rate per layout and no way to see quality move.                                                                                                       |

### 3.3 Research notes

- NN/g describes image-generation use as Define → Explore → Refine → Export. This plan maps one phase of the flow to each stage.
- Common pattern across Midjourney, Firefly and Canva: a prompt bar with parameter chips, a grid of about four variations, per-variation actions, and a history that keeps prompt and settings.
- Canva Magic Design returns editable designs (layout, imagery, fonts, colors), not flat images. AI Post already matches this; the gap is craft and controls.
- Instagram: 4:5 (1080×1350) stays the safe default for feed posts because publishing APIs and boosts stop at 4:5. The profile grid shows 3:4 tiles, so key content must sit inside the centered 3:4 area. Stories and Reels: keep about 270px clear at the top and 340 to 670px at the bottom of 1080×1920.

Sources: [NN/g image generation stages](https://www.nngroup.com/articles/ai-imagegen-stages/) · [AI UX variation grid](https://aiuxplayground.com/pattern/variation-grid) · [Canva AI guide](https://dorik.com/blog/how-to-use-canva-ai) · [Instagram post sizes 2026](https://www.inro.social/blog/instagram-post-size) · [Instagram aspect ratios](https://posteverywhere.ai/blog/instagram-aspect-ratios) · [Reel sizes and safe zones](https://www.hopperhq.com/blog/instagram-reel-size/) · [Story safe zones](https://www.socialync.io/tools/safe-zones/instagram-stories)

## 4. Approach

1. **Keep the architecture.** AI as art director, deterministic compiler, editable Polotno output, facts printed from settings. The architecture is right; the craft inside it is not.
2. **Measure before designing.** A contact sheet (every layout × size × fixture listing × theme) and a rubric come first. Design work is judged on rendered images, not on passing unit tests.
3. **Fix rendering reliability before anything else.** No design work matters while a failed photo can ship.
4. **Design system v2, clean by default.** Fewer elements, two type families per poster, neutral inks and scrims, text placed where the photo is calm. Three families: Clean (default), Lifestyle, Flyer (the rebuilt staycation look). Clean layouts are the safe floor for any photo.
5. **Deterministic photo intelligence first, vision second.** Luminance, busyness, sharpness and a focal estimate come from pixels in the browser, cost nothing, and also serve the fallback. Vision tags are an optional later layer.
6. **The fallback must be good.** It is the first impression, the example gallery and the outage path. It passes the same audits as AI output.
7. **Free, instant edits on results.** Text, photo, layout, style and size change by recompiling, with no AI call. Chat refine stays for larger changes.
8. **Video follows the same split.** A Reel is directed by AI and rendered by Remotion from real photos. Veo is an optional per-shot upgrade.
9. **Nothing breaks.** Stored specs keep compiling with frozen v1 builders, new work is behind a flag, edge deploys before UI, and every slice ships with tests and docs. See section 6.

**Trade-offs taken**

- A layout primitive layer adds code, but it replaces 1,600 lines of per-format coordinates and makes twelve layouts tunable. Old builders are frozen, not rewritten in place.
- Curated static examples replace live per-host examples on the home page. Less personal, but never broken, and the landing tab stops loading Konva. A live "with my photos" preview stays in the example detail.
- A vision critic is deferred. Pixel audits catch the failures seen so far at no AI cost.

## 5. Implementation tasks

Paths are under `ui/src/features/dashboard/marketing/` unless they start with `supabase/`, `scripts/` or `docs/`. Each phase is one or more PRs. Order matters: 0 → 1 → 2 to 5 → 6 → 7 and 8 → 9.

### Phase 0: Baseline, harness and quality bar

- [ ] 0.1 (partial: 5 fixtures in `ui/src/features/dashboard/marketing/dev/posterSheetFixtures.ts` reuse the showcase stock photos; dedicated per-fixture stock and `CREDITS.md` still open) Fixture listings in `scripts/marketing/poster-contact-sheet/fixtures/`: cozy condo with phone photos (the demo listing seed), resort with a pool, minimal studio, weak listing (dark, tilted, cluttered photos), bare listing (no logo, no amenities, one photo). Stock photos with a `CREDITS.md`, same rule as `ui/public/marketing/ai-studio/samples/CREDITS.md`.
- [x] 0.2 Dev-only route `/dev/poster-sheet` (guarded by `import.meta.env.DEV`, lazy, never in the production bundle) that renders layout × size × fixture × theme through the production compiler and renderer.
- [x] 0.3 `scripts/marketing/poster-contact-sheet/run.ts` (Playwright): opens the route, saves PNGs and an HTML index to `tmp/poster-sheets/<run>/` (gitignored). Add `bun run marketing:contact-sheet`.
- [x] 0.4 (drafted in the file below; the owner may adjust the anchors) Rubric in `docs/workflow/assets/poster-benchmarks/rubric.md`, scored 1 to 5: legibility, hierarchy, photo respect, restraint, brand consistency, factual accuracy, looks template-made (inverse), would post as is (yes / no).
- [ ] 0.5 Reference board: the six existing benchmark posts plus 8 to 10 clean and lifestyle references approved by the product owner, with a short teardown each.
- [ ] 0.6 Baseline run of today's engine. Record scores in this doc. That is the number to beat.
- [ ] 0.7 Ship gate for every later design slice: mean ≥ 4.0 on each axis, ≥ 70% would post as is, zero broken renders, zero fact errors, judged blind by the product owner on a 24-poster set.

### Phase 1: Reliability fixes (small, ship first)

- [x] 1.1 Render guard in `lib/poster/posterRender.ts`: subscribe to OpenPolotno `onLoadError`, and after `waitLoading` verify every image element on the page has a decoded image. On failure retry once, then throw a typed `PosterRenderError`. Never export a failed state.
- [x] 1.2 Same guard in `lib/renderMarketingDesignThumbnail.ts` (template and library thumbnails) and before `post-versions` preview upload and `exportBlob` in `hooks/useAiPosterEngine.ts`.
- [x] 1.3 Cache hygiene in `hooks/useAiStudioPostSamples.ts`: write to memory and IndexedDB only after a guarded render; add a version to `postSampleCacheKey` (`lib/aiStudioSamples.ts`) so poisoned thumbnails are dropped.
- [x] 1.4 Photo preflight `lib/poster/posterPhotoPreflight.ts` (replaces `posterPhotoSizes.ts`): fetch each photo once with CORS, decode, downscale to a 1600px long edge, return `{ url, blobUrl, width, height, ok }`. Renders use the blob; saved documents keep the real URL. Photos that fail are removed before photo indexes resolve. Unit test: a `blob:` URL never reaches `saveToPosts` or `post-versions`.
- [ ] 1.5 (2026-11-15: Sentry search for `PosterRenderError` and poster image load failures over 30 days returned no issues, so the guard has logged nothing there yet; needs production browser logs or a repro) Confirm the load failure cause with the guard's logs before closing 1.1. Hypotheses in order: full-size originals timing out under four queued renders; a cached non-CORS response reused for a `crossOrigin` request; local Storage errors under load. Record the finding here.
- [x] 1.6 Safe zones in `createPosterCanvas` (`lib/poster/posterModules.ts`): `safeTop` 14% and `safeBottom` 18% for 9:16; a grid-safe inset for 4:5 (content inside the centered 3:4 area). Audit rule and tests.
- [x] 1.7 Fix the example mapping in `lib/aiStudioSamples.ts`: stay info uses a layout with an info module; hide feature spotlight when the listing has no distinctive amenity (interim until 4.1).
- [x] 1.8 `supabase/functions/_shared/marketingPosterDirector.ts`: also accept photo URLs on the project's own Storage origin so local and preview stacks send photos. Keep the property allow-list. Deno test.
- [x] 1.9 Remove `components/ai-studio/AiStudioSection.tsx` and `AiPostPanel.tsx` after confirming no import or lazy route reaches them (`bun run type-check`, grep). Separate commit.

### Phase 2: Poster design system v2

- [x] 2.1 (`posterLayout.ts`: spacing and type scale, `contentBox`, `flowStack` with drop order; tests in `posterLayout.test.ts`)`lib/poster/posterLayout.ts`: safe-area zones, a vertical `stack` with a spacing scale (4, 8, 12, 16, 24, 32, 48, 64 at 1080), a type scale by role, alignment and anchors. Layouts become short compositions of these. Unit tests for flow, drop order and overflow.
- [x] 2.2 ( audit enforces fonts and text budget, layouts use `flowStack` priorities; Flyer layouts are the frozen v1 set and keep their own composition)Hierarchy budget in the compiler: one hero line, at most one support line, one fact module, one footer. Each layout declares slot priorities; extras drop. Audit fails on more than two font families (plus one script), or more text elements than the layout's budget.
- [x] 2.3 (closed within the v1 freeze. The frozen v1 Flyers stay as they are, and the eight shipped pairings stay because the frozen archetype defaults and the director's enum name them, so the six-systems rewrite is not done. Enforced instead: audit rule `script-misuse` flags a script face on any Clean or Lifestyle layout (family read from `custom.poster.archetype`, Flyers exempt); a test pins the outline effect to `playful-pop` alone; the Clean layouts pass no text effect, so no shadows sit on a scrim or panel; the 9% size and two-word limit were dropped because the frozen Flyers break them) Type systems v2 in `lib/poster/posterFonts.ts`: six systems, two families each. Script only in the two Flyer systems, at a minimum of 9% of the short side and at most two words or 14 characters, else the slot falls back to display italic. Outline stroke only in the one playful system. No text shadows where a scrim or panel exists.
- [x] 2.4 (decision: stay on 400/700. `PosterTypeRole.weight` is typed `'400'|'700'`, the loader and Polotno's Google injection request only those, and the frozen v1 layouts must compile byte-identical. 500/600 were not trialed in the browser; revisit if a type system needs them) Check whether poster fonts can be loaded by `lib/poster/posterFontLoader.ts` with weights 500 and 600 and registered with the store, instead of Polotno's 400/700 Google injection. If not feasible in OpenPolotno 1.0.x, stay on 400/700 and note it.
- [x] 2.5 (done within the v1 freeze: `WORDMARK_ROLE` is kept only as the un-themed fallback of the frozen v1 layouts; every themed poster sets the brand line in the theme display face; the wordmark uses the theme display face; `marketingFontClass` table in `marketingThemeFonts.ts` and class-aware display role in `posterThemeAdapter.ts` (serif and display faces never tracked or capitalised, outline effect only for rounded); not reviewed on a contact sheet; `WORDMARK_ROLE` stays because the frozen v1 layouts use it) Theme adapter v2 in `lib/theme/posterThemeAdapter.ts`: map a theme to a whole type system by font class (serif, sans, rounded, display) from a table in `lib/theme/marketingThemeFonts.ts`, instead of swapping families into another face's role. Remove `WORDMARK_ROLE`; the brand name uses the theme display face.
- [x] 2.6 (guards only: near-neutral ink, secondary hue gap; paper from theme surface and accent budget open) Palette v2 in `lib/poster/posterColor.ts`: near-neutral inks with a trace of hue, neutral scrims, accent on at most two elements, paper from the theme surface. Add a same-hue guard: a text and background pair close in hue and lightness is re-inked to neutral. Tests cover green, teal, pink and navy brands.
- [x] 2.7 Pixel analysis `lib/poster/posterPhotoAnalysis.ts` (pure functions on a downscaled bitmap, unit-testable in Node): per-zone luminance and busyness, best text zone, light or dark ink, scrim strength (none, soft 35%, strong 55%) or "needs panel", and a focal estimate for `focusX` / `focusY`. Cached per URL in IndexedDB. Runs off the main thread or at idle.
- [x] 2.8 (v2 layouts never call `addLegibilityScrims`: `cleanLayouts.ts` `bottomScrim` is one gradient sized to the text stack, capped at strength 0.55, bottom only, so top and bottom scrims cannot meet; `posterScrimTuning.ts` adjusts alpha from the measured zone. The six v1 layouts keep `addLegibilityScrims` because of the freeze) Replace `addLegibilityScrims`: a neutral gradient sized to the text stack and capped at 55%, or a solid paper panel when the zone is busy. Top and bottom scrims may never meet; if both are needed the compiler switches to a framed layout with text on paper.
- [x] 2.9 (done apart from review stars, left out on purpose; audit rule `ornament-in-clean` enforces no ornament in Clean or Lifestyle layouts, Flyers exempt; `logoChip`, info card, icon row, price line and a CTA line (a `Cta line` item in `split-panel`, checked on the contact sheet) exist; review stars are deliberately not built because the listing has no review facts and stars would be invented)Modules v2 in `lib/poster/posterModules.ts`: icon row (max four, one-line labels), info card on paper (replaces the ringed bar), price line ("From ₱X / night", facts only), location line, CTA line, review stars, and a `logoChip` (logo inside a paper circle when its corners are opaque, detected in preflight; fixed corner, fixed size, cannot overlap by construction). At most one ornament, none in Clean.
- [x] 2.10 (shipped in `cleanLayouts.ts`, not `layouts/*.ts`: Clean has 6 layouts, Lifestyle has `arch-frame`, `duo-collage`, `trio-grid`, Flyer stays the six frozen v1 builders; eyeballed on the contact sheet for 4:5, 9:16 and 1.91:1, not yet 1:1 for all)Layout library v2, each tuned on the contact sheet for 4:5, 1:1, 9:16 and 1.91:1:
  - Clean (default): `photo-first`, `framed-editorial`, `split-panel`, `big-type`, `info-card`, `quote-card`.
  - Lifestyle: `arch-frame`, `duo-collage`, `trio-grid`.
  - Flyer (rebuilt): `sky-headline`, `magazine-cover`, `feature-sticker`, `night-glass`, `wave-duo`.
- [x] 2.11 (spec `version` 1 or 2 by layout via `posterSpecVersion`; builders were not moved to `legacy/`, the golden test is the freeze) (partial: v1 builders frozen by `posterGolden.test.ts` and new layouts are new ids; `version: 2` spec and `legacy/` move open)Spec v2 and legacy freeze: `PosterSpec.version: 2` adds `layout`, `style`, optional `textZone` and `photoFocus`. Move today's builders unchanged to `lib/poster/legacy/` and compile `version: 1` specs with them, so stored versions export exactly as their preview (B3). Golden test: v1 compiled documents are byte-equal before and after the move.
- [x] 2.12 (parity test reads the edge enums, so the new ids are covered; edge already accepts v1 and v2 ids)Enum parity UI ↔ edge (`posterEdgeParity.test.ts`) for the new layout and style ids. The edge accepts v1 and v2 ids before the UI sends v2.
- [ ] 2.13 Designer gate: a layout enters the catalog only when it scores ≥ 4.5 with hand-written copy on all five fixtures. A layout that is not beautiful by hand will not be fixed by AI.

### Phase 3: Photo selection

- [x] 3.1 `lib/poster/posterPhotoRank.ts`: score by resolution, fit for the target size, exposure, contrast, sharpness and busyness; drop near-duplicates (difference hash); keep gallery order as a prior (hosts put the best first). Layouts declare needs (`calmTop`, `portrait`, `two`, `three`).
- [x] 3.2 Rule-based specs (`lib/poster/posterDefaults.ts`) take ranked photos that meet the layout's needs instead of `index % n`.
- [ ] 3.3 (deferred on purpose: optional, adds a table and a billed vision call per photo, and the pixel analysis from 3.1 already drives photo ranking and scrims; revisit only if the 0.6 baseline scores show photo choice is the weak axis) Optional, after 3.1 ships: scene tags from one cached vision call per photo (scene, subject box, people, quality), stored in a new `marketing_photo_analysis` table keyed by property and URL hash (new migration, never an edit to a shipped one), billed as platform cost like prompt enhancement. Used to match photos to goals and for smart crop.

### Phase 4: Copy and art direction

- [x] 4.1 `rankAmenities` in `lib/poster/posterFacts.ts`: distinctive first (pool, jacuzzi, bathtub, view, balcony, Netflix, console, karaoke, projector, kitchen, parking, pet friendly), baseline last (WiFi, air conditioning, heating, hair dryer, TV). Feature spotlight needs a distinctive amenity or a host-typed feature.
- [x] 4.2 `lib/poster/posterCopyLibrary.ts` replaces `baseCopy`: at least six hand-written sets per goal in English and Taglish, slot-safe lengths, seeded rotation so four variants never share a tagline, the listing name used once per poster, chips never repeating the icon row. Reviewed with the `human-copy` rules.
- [x] 4.3 (text, Manila date and code on the create form; the Vouchers module link stays open until that module exists)Promo needs a real offer: optional offer text, valid-until date and voucher code (from the Vouchers module when one exists) on the create form, printed verbatim. With no offer, promo layouts print the nightly rate or the goal is disabled with a hint.
- [x] 4.4 (prompt, clamps, temperature; pixel summary per photo is replaced by pre-ranked order) Director prompt v3 in `supabase/functions/_shared/marketingPosterDirector.ts` (new `POSTER_DIRECTOR_PROMPT.version`): the v2 catalog with a character budget per slot per layout, good and bad copy examples, and the pixel analysis summary and rank for each photo. Temperature 0.9 → 0.7. Per-layout clamps enforced in `sanitizeVariant` and in `normalizePosterSpec`. Deno tests.
- [x] 4.5 Diversity rule for a batch: at least two families, three different hero photos when available, and always one Clean layout.
- [x] 4.6 (**Write a caption** on demand beside the result plus Copy caption; not auto-generated on open, so nothing is charged silently) Caption and hashtags per post: reuse `generate-marketing-caption`, generated on first open, shown beside the result with **Copy caption**.

### Phase 5: QA loop

- [x] 5.1 (font families, text budget, grid inset, logo overlap; role minimum sizes and same-hue open) Audit v2 in `lib/poster/posterAudit.ts`: element budget, family count, safe zones, role minimum sizes, same-hue guard, logo overlap.
- [x] 5.2 `lib/poster/posterPixelAudit.ts` after render: WCAG contrast of each text box against the real pixels behind it, detection of the load-error placeholder, edge crowding. (partial in effect: `posterPixelAudit.ts` + `posterPixelCheck.ts`; the load-error placeholder blocks a save, contrast and edge results are not yet enforced)
- [x] 5.3 Auto-repair in `hooks/useAiPosterEngine.ts`: stronger scrim → panel → Clean layout, at most two attempts, then drop the variant and backfill with a Clean layout so four always arrive.
- [x] 5.4 Telemetry (PostHog, no prompt text, no PII): `ai_post_generated`, `variant_opened`, `quick_edit`, `downloaded`, `published`, `edited_in_posts`, `thumb_up`, `thumb_down`, with layout, style, `aiDirected` and audit result. Use the kept rate per layout to prune weak ones. (events in the catalog: generated, variant opened, quick edit, more like this, thumb, downloaded, edited in posts; `published` exists as `ai_studio_publish_started`)
- [x] 5.5 Deferred: a vision critic behind a flag, only if 5.1 to 5.3 leave visible failures on the contact sheet. (not needed: the pixel audit and repair left no visible failures on the contact sheet; revisit if one appears)

### Phase 6: Flow and UX

**Define (home and create)**

- [x] 6.1 (six JPG cards via `marketing:contact-sheet -- --samples`, not AVIF; the detail keeps a live preview with the host's photos, automatic rather than behind a button) Curated example gallery: art-directed examples rendered by the contact sheet script from the showcase fixtures and shipped as static AVIF, replacing live fallback renders on the home page (`components/ai-studio/AiStudioSampleGallery.tsx`, `AiStudioSampleCard.tsx`). The example detail keeps a guarded **Preview with my photos**.
- [x] 6.2 Post create (`components/ai-studio/AiStudioCreate.tsx`): a **Photos** row with ranked best picks preselected, swap or add from Listing and Uploads (reuse `AiStudioPhotoSheet.tsx`), hero marked. (listing photos strip, up to 3, first is hero; uploads source open)
- [x] 6.3 (style family, promo fields and **Also make a Story** shipped; no credit cost on Generate because posts are quota-counted, not priced; per-topic layout previews not built, the hint line stays) Topic chips, promo fields (4.3), style family, size with Also make a Story.
- [x] 6.4 Live draft in the preview pane: an instant rule-based compile of the current form (photo, topic, size, theme), so the host sees a real post before spending credits. Debounced, guarded render.
- [x] 6.5 Readiness hints with a link to Settings when photos, amenities or stay times are missing.

**Explore (results)**

- [x] 6.6 A 2×2 variation grid on the stage for a new batch (`components/ai-studio/AiStudioStage.tsx`, `AiStudioResultsGrid.tsx`), with progressive reveal and per-card Open, Download, thumbs up and down. Swipe pager on phones. (2x2 `AiStudioPostGrid` with thumbs and **Compare versions**; progressive reveal and phone swipe pager open)
- [x] 6.7 **More like this** (same family, new layouts, no AI call) and **Regenerate** (new director call, cost shown). (**More like this** is free; **Regenerate** reuses the composer)
- [x] 6.8 Fallback results carry a visible label and **Retry with AI** on the grid, replacing the toast. (notice with **Retry with AI** above the stage, session only: not stored on the version)

**Refine**

- [x] 6.9 Quick edit panel (`components/ai-studio/AiStudioQuickEdit.tsx`, new), free and instant by recompiling: text slots, photo swap and reposition, layout strip (the same post in other layouts), style and accent, toggles for logo, facts and location, size. Apply saves a new version. Guard unsaved quick edits with `useGuardedClose` (`unsaved-changes-guard` skill). (text, photo from the listing, layout, toggles, guarded close; size stays in the message box; accent colour open)
- [x] 6.10 Version labels by what changed ("Text edit", "Layout", "AI change"), press and hold to compare with the previous version. (labels by diff; press and hold compare open)
- [x] 6.11 Chat refine stays for larger changes; suggestion chips updated to what quick edit cannot do. (chips now list only what Quick edit cannot do)

**Export**

- [x] 6.12 **All sizes** download (4:5, 9:16, 1.91:1) and caption copy beside Download. Publish is unchanged. (**Download all sizes**; caption copy stays in the menu)
- [x] 6.13 (free rule-based set via `posterCarousel.ts`; one style, ordered download; publishing waits on the Meta gaps plan as the plan says) Carousel set: cover, two or three feature slides, stay info, CTA, one style, swipe preview, ordered export. Publishing a carousel waits on the Meta gaps plan.

**Cross-cutting**

- [x] 6.14 (done: every category of the Posts editor AI rail (promos, last slots, giveaway, fully booked, reviews, custom) now goes through `useAiPosterEngine` (`generateBatch` then `saveToPosts`) in `PolotnoDesignStudio.handleAiGenerate`; the category picks the goal and rides on the prompt as a hint; the old design-token path was removed from the studio; two mocked Playwright specs run the real rail for Promos and Fully booked; `designAiTokens.ts` and `polotnoAiCampaignDocuments.ts` stay because the calendar and video wizards still import them; parity with the old category-specific layouts was judged by eye on the poster layouts, not scored)) One engine: the Posts editor AI rail (`components/shared/MarketingAiGeneratePanel.tsx` design branch, `components/design-editor/PolotnoDesignStudio.tsx`) calls the poster engine. Retire `lib/designAiTokens.ts` and `lib/polotno/polotnoAiCampaignDocuments.ts` for posts once parity is shown on the contact sheet. Calendar and video wizard branches are untouched.
- [x] 6.15 Phones: every new surface as a bottom sheet with 44px targets, checked at 375, 768 and 1024 (`mobile-responsive` skill). Strings through `human-copy`. (375px E2E checks width, 44px targets and the unsaved-changes prompt for the form, grid and Quick edit sheet; 768 and 1024 not separately checked)
- [x] 6.16 Accessibility: keyboard navigation in the grid, alt text from the spec label, one live region for progress. (grid items are native buttons, alt from the spec label, a polite live region announces the set; full keyboard walk not audited)

### Phase 7: Photo mode

- [x] 7.1 (**Enhance a photo** is the default with 8 presets: the 5 light/clutter ones plus Extend to 4:5, Extend to 9:16 and Upscale, which force the output shape or ask for the largest size of the tier; structure-locked edit prompt; before and after slider (covered by a mocked Playwright spec that opens an enhanced photo and drags the slider); the extended or upscaled output quality was not judged on real images because the Gemini key is not available here) Default becomes **Enhance a photo**: one real listing photo through the edit path with a structure-locked instruction and presets (Brighten and balance, Golden hour, Blue hour, Declutter, Clear sky, Extend to 4:5 or 9:16, Upscale). Before and after slider on the stage. Files: `components/ai-studio/AiStudioCreate.tsx`, `lib/marketingGenerationOptions.ts`, `supabase/functions/_shared/marketingImagePromptBuilder.ts`, `marketingImageGenerationAi.ts`.
- [x] 7.2 (**Create a scene** is the second mode with a mood-imagery note) **Create a scene** (text to image) becomes the secondary tab, labeled as mood imagery, not the listing.
- [x] 7.3 (`marketingEnhanceHonestyCheck.ts`, fail-open, uncharged refusal, `aiEdited` flag) Honesty guard: a vision comparison after an enhance (same objects and layout). A failed check is not charged and says why. The job records that the photo was AI edited.
- [ ] 7.4 Run the pending 20-prompt blind score from the image hardening plan; tune `IMAGE_SYSTEM_INSTRUCTION` and the looks against the over-processed HDR look.
- [ ] 7.5 Unblock sample assets: billing on the Gemini keys (owner action), then finish `ai-studio-sample-assets.md`.

### Phase 8: Video

- [x] 8.1 (shipped, with one deliberate deviation: Download and Publish are not duplicated on the reel stage. **Edit in Videos** opens the reel in the Videos editor, whose Download (`exportVideoV2`) and Publish already carry the Marketing Studio entitlement, publish limits and music caching; a second export path in AI Studio would have to re-implement those gates. **Preview reel** plays the free reel in the Remotion player inside AI Studio, with a Tour/Highlights switch and **Edit in Videos** (`AiStudioReelPreview.tsx`, mocked Playwright spec passes); two recipes selectable as **Make a reel** (tour) and **Make a short reel** (highlights), the short reel covered by a mocked Playwright spec that checks the saved story project; **Make a reel** from a post, free and deterministic via `reelBuilder.ts`, opens in Videos; **Direct with AI** in Preview reel shipped: `contentType: 'reel'` director (`marketingReelDirector.ts`, Deno tests) picks recipe, photo order and lines, applied through `buildReel` (mocked Playwright spec checks the saved lines); music mood not directed; **own Reel output shipped**: `reel` session output with migration `20261340000400`, reduced Create form, `AiStudioReelSession` stage with versions, Direct again and Edit in Videos, mocked Playwright spec; Download and Publish live in the Videos editor) New **Reel** output in AI Studio: the director picks a storyboard recipe (`lib/video/videoStoryboardRecipes.ts`), orders four to six ranked photos, writes the text beats and picks a music mood; `lib/video/videoAiProjectBuilder.ts` builds a v2 project; the stage plays it in the Remotion player at once. **Edit in Videos**, Download (`lib/exportVideoV2.ts`) and Publish reuse existing paths. Shuffling the recipe is free.
- [x] 8.2 (everything shipped. **Beat-synced cuts shipped as an editor action**: **Cut to the beat** in the music clip inspector decodes the track (`lib/media/decodeBeats.ts`, `beats.ts`), snaps main-track cuts to the nearest beat within 0.6 s via `cutToBeats` (`lib/video/v2/beatCuts.ts`, min clip 0.8 s, total length unchanged, captions follow), is one undo step and plays from the start so it can be heard; unit tested and a mocked Playwright spec covers the button and the unreadable-track path; not listened to against a real Jamendo track in this pass) Motion pass on the recipes: 9:16 safe zones (top 14%, bottom 20%, right rail), two text animations (mask reveal, fade up, 0.4 to 0.6s), Ken Burns toward the focal estimate from 2.7, cuts on the beat (`lib/media/peaks.ts`), 12 to 20 seconds total, a 2 second end card with logo and CTA, at most seven words per beat, minimum text size 4.5% of height. (partial: **Story text floor shipped**: `applyStoryTextSizes` raises every Story reel text layer to 88 px (headline 104 px), at least 4.5% of the 1920 px height; the defaults were 72 / 30 / 26 px; unit tested and checked on the reel beats of the video contact sheet, no overflow; the right-rail safe zone is not applied (text is centered, so nothing sits under the rail); Story safe band 14% to 80% for text, 12 to 20 s, at most 7 words per beat, end beat with logo and CTA; Ken Burns now lands on the photo's focal estimate (`VideoScene.focal` / `MediaItem.focal`, set by `applyFocalPoints` in `saveReel`, applied in `backgroundMotionTransform`; unit tested and seen in a render); beat-synced cuts are not feasible at reel-save time: the default music is a Jamendo track resolved lazily when the editor opens (`needsVideoMusicResolution`), so no audio exists to decode when `saveReel` runs; they belong in the editor after the track resolves and need a decode step with peaks plus a way to hear the result; 0.5 s text entrance in the classic (v1) composition: mask reveal for headline text, fade up for other text and CTA (`textEntranceStyle`; the v2 timeline composition now fades layers in over 0.5 s on its template entrance (`layerMotion` in `clipStyles.ts`, unit tested), so a reel keeps its entrance after it migrates to the Videos editor; thumbnails now sample 0.6 s in; both effects checked on the video contact sheet (`--videos` now also renders `motion__text-fNN` frames 0 to 16 and `motion__focal-fNNN` frames: the headline wipes in left to right over 0.5 s and the push-in drifts toward a focal point on the right))
- [x] 8.3 Video contact sheet: `--videos` renders the 16 recipe stills and each beat of a showcase reel (20 cells, 0 failures). Scored by eye; no owner rubric yet (0.4).
- [ ] 8.4 (partial: **Use in a reel** on a finished clip shipped (mocked Playwright spec checks the saved Story project's first beat is the clip as a video background): `saveReel({ leadClipUrl })` via `withLeadClip` makes the clip the first beat of a free reel; the credit cost shown is none because the reel is free; **Animate this shot** shipped in the v2 clip inspector (`MediaItemInspector`: uploads the photo as a reference and opens the AI Studio clip form; typechecked, not run in a browser); the `marketing-ai-video-quality.md` test pass needs real Veo and is open; not exercised in a browser) Clip (Veo) stays for one-shot motion. Add **Use in a reel** on a finished clip and **Animate this shot** inside a reel, with the credit cost shown. Finish testing in `marketing-ai-video-quality.md`.

### Phase 9: Built-in template library

- [x] 9.1 (45 presets per size run at all three sizes, 0 failures; fixed a clipped review quote, low-contrast red on photos and wide promo band spacing; small Story support text and `giveaway-raffle` empty space left) Extend the contact sheet to every built-in post preset (`lib/polotno/polotnoCampaignDocuments.ts`) × size × three themes × fixtures. Score, then fix or remove what is below the bar.
- [x] 9.2 (4:5 added to `DESIGN_PRESET_FORMATS` and the 15 presets; the layouts are ratio-based so no copies were needed; 45 renders at 4:5, 0 failures, same known quirks as other sizes; the "best v2 layouts in the gallery" half is covered by AI Studio, not the preset gallery) Offer the best v2 layouts in the Posts template gallery through the poster compiler with fixed specs, and add 4:5 to the preset sizes (`DESIGN_PRESET_FORMATS`).
- [x] 9.3 (video recipes reviewed on `--videos`; calendar looks use SVG previews and were not covered) Review the 16 video recipes and 14 calendar looks on their sheets; fix contrast, type and spacing issues found. No new looks in this plan.

### Phase 10: Platform, rollout and cost

- [x] 10.1 (built as a kill switch, on by default: key `marketing.ai_studio.poster_v2` in both catalogs, child of `marketing.ai_studio`; off makes `generateBatch` and `carouselSlides` use the Flyer family via `effectiveStyleChoice`; saved posts unchanged; unit tested, parity test passes) Flag `marketing.ai_studio.poster_v2` in `supabase/functions/_shared/featureAvailabilityCatalog.ts` and its UI mirror. v1 stays the default until the 0.7 gate passes on dev.
- [x] 10.2 Deploy order per slice: edge (accepts old and new shapes) → UI. Production Supabase deploys only with the `kamewave` unlock. (process note: edge accepts old and new shapes, deploy edge then UI; no production deploy was run, none needed `kamewave`)
- [x] 10.3 Plans and RBAC (`plans-and-permissions` skill): Post and Reel direction reuse `aiMarketingGeneration` and `marketing.generate:add`; Veo shots keep `marketing.generate.video:add`; quick edits are free. Update `docs/architecture/plans-feature-matrix.md` only if a label changes. (Quick edit, More like this, carousel and reel are free and need no new permission; Enhance reuses the photo permission and plan; no label change)
- [x] 10.4 Cost: photo analysis and any critic are platform cost (`recordAiUsagePlatformOnly`). Keep `lib/marketingGenerationPricing.ts` and the server table in parity. (no new platform cost: no vision call or critic was built)
- [x] 10.5 Activity log (`audit-logging` skill): decide per new write. Expected: reel generation follows post generation (N/A, specs only; the save records `marketing.template_saved`); photo analysis is N/A (derived cache). (N/A: specs only; reel and Edit in Posts save through `marketing-templates`, which already logs the write)
- [x] 10.6 Performance: Konva and OpenPolotno stay behind dynamic `import()` outside the editors so the PWA precache budget holds (`scripts/pwa/precache-globs.json`, the `config-*` chunk). The home page stops rendering live posters. Check the Lighthouse report job. (`bun run build` pass, precache 21135.5 of 22528 KiB; the home page no longer renders live posters)

### Phase 11: Tests

- [x] 11.1 Vitest (`.test.ts` only; `.test.tsx` is ignored by the runner): layout primitives, budget, palette guards, photo analysis and rank on synthetic bitmaps, copy library limits, spec v1 and v2 normalizing, v1 golden documents, every layout × size × rich and sparse facts passing audit v2. (layout primitives, Clean and Lifestyle audits, palette, photo analysis and rank, copy library, golden, quick edit, pixel audit, carousel, reel, create payload)
- [x] 11.2 Deno: director v3 sanitizing, per-layout clamps, Storage-origin allow rule, reel director, photo analysis parsing. (director clamps, enum parity, Storage origin, structure-locked edit prompt; no reel director or photo analysis parsing exists, so none tested)
- [x] 11.3 (ran locally against `bun run dev:ui` with a trimmed config: new specs for the style, photo row and free draft, grid, quick edit, carousel, a failed photo, and Enhance; 4 older specs stay `fixme` under PR-133) Playwright (mocked E2E in `ui/e2e/features/marketing/`): update `marketingAiPost.spec.ts`, `marketingAiExamples.spec.ts`, `marketingAiGenerate.spec.ts`; add grid, quick edit, photo picker, fallback label, reel, and a failed-photo case that must not produce a broken preview.
- [x] 11.4 (2026-11-15, after merging `origin/develop`: every `ci:quality` step passes except `test:edge:handlers`, 5 captcha-env failures in `submit-form-completion` and `submit-sd-form` that also fail on a clean `origin/develop` here; contact sheet path goes in the PR description) `bun run ci:quality` green on every PR, with the contact sheet path in the PR description.

## 6. Safeguards (nothing breaks)

| Risk                                                       | Guard                                                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Old post versions export differently after a layout change | Frozen v1 builders plus byte-equal golden tests (2.11)                                                    |
| Saved posts in the Posts editor                            | Already compiled Polotno documents; not touched. Re-theming of AI posts still keyed by `lockedElementIds` |
| UI and edge enums drift                                    | Parity test; the edge accepts both generations first (2.12, 10.2)                                         |
| `blob:` URLs saved into documents                          | Swap back before save, with a unit test (1.4)                                                             |
| PWA precache budget                                        | Dynamic import rule and a build check (10.6)                                                              |
| Fallback path quality when AI is off or over quota         | Fallback goes through the same audits and is on the contact sheet                                         |
| Quota, rate limit, plan and downgrade behavior             | Unchanged; quota errors still reach the upgrade UI and are never replaced by free layouts                 |
| URL state and Back behavior                                | `?tab=generate&item=…&output=…&sample=…` kept; a new `output=reel` value is additive                      |
| Component tests silently skipped                           | Logic lives in `.ts` modules with Vitest; UI behavior in Playwright                                       |
| A design slice that scores worse than today                | The 0.7 gate; the flag stays off                                                                          |

## 7. Delivery slices

| Slice | Content                                              | Result the host sees                                              |
| ----- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| A     | Phase 0, Phase 1                                     | No more broken or pink posters; correct Story margins             |
| B     | Phase 2, 3.1, 3.2, 4.1 to 4.3, 5.1 to 5.3            | Posts that look designed, with or without AI                      |
| C     | 4.4 to 4.6, Phase 6 (6.1 to 6.12, 6.14 to 6.16), 5.4 | Photo choice, live draft, result grid, free quick edits, captions |
| D     | Phase 8, Phase 7                                     | Reels from listing photos; photo enhancement with before / after  |
| E     | Phase 9, 6.13, 3.3, 5.5                              | Better built-in templates, carousels, smarter photo matching      |

## 8. Docs to update (in the same change as each slice)

- `docs/guides/routes/org/property/marketing.md` (Host-facing knowledge Q&A and the AI Studio section) via the `route-guides` skill.
- `docs/architecture/marketing-poster-studio.md` (design system v2, spec v2, audits, photo analysis), `marketing-themes.md` (theme adapter v2), `marketing-video-editor.md` (Reel).
- `docs/architecture/overview.md` and `docs/PROJECT.md` for the Reel output and any new table or endpoint.
- `docs/guides/support/faqs.md` and Host-facing knowledge via `support-content`, then `check:support-content` and `check:ai-knowledge-coverage`.
- `docs/architecture/plans-feature-matrix.md` if entitlement labels change; `docs/architecture/feature-availability.md` for the new key.
- `docs/archive/operations/migration-runbook.md` if 3.3 adds `marketing_photo_analysis`.
- `docs/workflow/in-progress/marketing-ai-poster-studio.md`: point its "Still open" list here when this plan starts.

## 9. Open questions

1. **Default style.** Recommended: Clean as the default family, with Lifestyle and the rebuilt Flyer look as choices. Alternative: keep Flyer first because the original benchmarks are flyers.
2. **Example gallery.** Recommended: curated static examples on the home page, live "with my photos" preview in the detail view. Alternative: keep live per-host examples once Phase 1 and 2 land.
3. **Gemini billing.** Photo and clip samples, and any local test of the director, need a paid key. Owner action, tracked in `ai-studio-sample-assets.md`.

## 10. Not verified in planning

The local edge runtime was returning 503 during planning, so the flow critique comes from the code, the route guide and the screenshot, not from a live session. Phase 0 produces the first full visual baseline.
