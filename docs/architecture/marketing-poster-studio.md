---
title: 'Marketing Poster Studio (AI Post)'
status: active
tags: [architecture, marketing, ai, polotno]
updated: 2026-09-28
---

# Marketing Poster Studio (AI Post)

Finished, editable social posts made from a property's **real photos**. AI Studio (the first Marketing tab) opens on **Post** (plan: [`docs/workflow/in-progress/marketing-ai-poster-studio.md`](../workflow/in-progress/marketing-ai-poster-studio.md)).

## Why this shape

Benchmark posts from real PH staycation pages are designed posters: a real photo of the unit plus layered type, badges, amenity icons, an info bar and brand marks. An image model asked to "make a poster" invents rooms that do not exist and misspells text. So the AI never draws the poster:

- **AI = art director.** It sees the photos, reads the facts, and returns short JSON specs (layout, type system, palette, copy, photo order, amenities).
- **Code = layout engine.** A deterministic compiler turns each spec into an ordinary editable Polotno document. Text, icons and shapes are vectors.
- **Facts are printed, never generated.** Times, deposit, location and amenities come from property settings.

## Flow

```
AiStudioCreate (angle · size · optional message) → AiStudioConversation.create
  → buildPosterFacts(publicProperty)              lib/poster/posterFacts.ts
  → useGeneratePosters                            hooks/useGeneratePosters.ts
      POST generate-marketing-template {contentType:'poster', goal, prompt, facts, photoUrls}
        → allow-list photos against settings.media / settings.images (no arbitrary fetch)
        → Gemini (feature marketing_template) sees photos + facts → N specs
        → groundPosterFeatures (no invented amenities) · stripBannedCopy
      fallback on non-quota errors: buildRuleBasedPosterSpecs (lib/poster/posterDefaults.ts)
  → normalizePosterSpec                           lib/poster/posterSpec.ts
  → compilePosterDocument(spec, facts, format)    lib/poster/posterCompiler.ts
  → auditPosterDocument (sort worst last)         lib/poster/posterAudit.ts
  → renderPosterDocument (offscreen Workspace)    lib/poster/posterRender.ts (dynamic import: Konva + OpenPolotno load on first render, not with AI Studio)
       + fitPosterTextSlots (real Konva metrics)  lib/polotno/fitPosterTextSlots.ts
  → useAiPosterEngine.render: compactPosterPhotos (keep only the photos this post places, ≤ 6)
  → POST marketing-ai-sessions {action:"post-versions"} — one version per layout, preview uploaded
  → refine: POST generate-marketing-template {revise:{spec, instruction}} → 1 variant → a new version
     shuffle / resize make a version with no AI call
  → Edit in Posts: saveMarketingTemplate (kind design) → openItem(id, { tab: "design" })
```

**From an example.** `AiStudioSampleDetail`'s **Use this example** fills step 2 with the sample's prompt, goal and format plus `preferredArchetype` (the archetype that example is defined against). On the first Generate of a new batch only, `preferredArchetypeLine` asks the director to lead with that layout and `preferArchetypeFirst` reorders the returned specs so it renders first if the model complies; a refine never resends it. This is a nudge, not a constraint — `groundPosterFeatures` and the normal audit still run, so a result still reflects the host's own photos and facts rather than reproducing the example.

## Examples gallery (AI Studio home)

**Update (static cards).** Gallery **cards** now show shipped images, `ui/public/marketing/ai-studio/samples/posts/<id>.jpg`, rendered with the stand-in showcase listing by `bun run marketing:contact-sheet -- --samples` (English copy, Clean and Lifestyle layouts). The landing tab draws nothing live and never loads Konva. The **detail view** still draws live with the host's own photos (`usePostSampleImage(..., live)`), cached as described below. Re-run the command after changing a sample's layout, goal or the showcase photos, and look at all six images before committing them. The rest of this section describes the live path, which now serves the detail view and the Create pane preview.

`AiStudioSampleGallery` / `AiStudioSampleCard` show **post** examples as live renders, not static mockups or screenshots: `useAiStudioPostSampleRenderer` (`hooks/useAiStudioPostSamples.ts`) runs the same `buildRuleBasedPosterSpecs` → `compilePosterDocument` → `renderPosterDocument` pipeline described above, in-memory and cached (`marketingPresetThumbnailStore`, IndexedDB) so a card renders once per sample/theme/version and is reused across sessions. It never calls the director (no AI, no credits, no network) — the sample's own fixed copy and a showcase property's facts (`postSampleFacts`, falling back to `showcaseFacts` when the signed-in property has no photos yet) go straight into the deterministic compiler. A render that throws falls back to the showcase listing instead of a broken card. Photo and clip examples are pre-generated once (`scripts/marketing/ai-studio-samples/`) rather than rendered live, since they go through the real image/video models.

**Scheduling.** A card's visibility gate (`useVisibleThumbnailRequest`, `rootMargin: 240px`) fires for most of the gallery almost immediately on a fresh, short home page, which would otherwise kick off the one-time dynamic `import()` of the Konva/Polotno chunk and several canvas renders synchronously during first paint. `usePostSampleImage` awaits `waitForMarketingIdle()` (`lib/marketingIdle.ts`) before calling `renderer.render()`, so that cost lands after paint and a short idle window instead of blocking it — measured via an authenticated local Lighthouse run to add ~1.4s of Total Blocking Time (23x) and drop the Marketing route's mobile performance score from 60 to 34 before this was added; after it, both are statistically identical to the gallery being absent.

## Design system (`ui/src/features/dashboard/marketing/lib/poster/`)

| File                                  | Role                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `posterArchetypes.ts`                 | Six hand-designed Flyer layouts (frozen), plus four Clean layouts in `cleanLayouts.ts`. Flyer: `wave-duo`, `sky-headline`, `night-glass`, `minimal-title`, `magazine-cover`, `feature-sticker`. Each adapts to Portrait (4:5, the AI Post default), Square (1:1), Story (9:16) and Facebook (1.91:1). |
| `posterFonts.ts`                      | Eight curated type systems (display · script · tracked eyebrow · body · chip). Weights 400/700 only.                                                                                                                                                                                                  |
| `posterModules.ts`                    | Building blocks: fitted text slots, pills, icon rows, info bar, glass panel, sticker badge, organic photo masks, burst ornament, logo.                                                                                                                                                                |
| `posterIcons.ts`                      | One line-icon family (Lucide paths) + amenity keyword → icon + curated short labels ("Coffee Maker" → "Coffee").                                                                                                                                                                                      |
| `posterColor.ts`                      | Palette derived from 1–3 hexes with WCAG guarantees (field ink ≥ 7:1, accent ≥ 3:1 on field).                                                                                                                                                                                                         |
| `posterText.ts`                       | Fit-to-box with balanced line breaks. Uses a real canvas measurer once `posterFontLoader.ts` has loaded the fonts; width estimates otherwise (tests).                                                                                                                                                 |
| `posterLayout.ts` · `cleanLayouts.ts` | Spacing and type scale, safe content box, priority flow stack, and the four Clean layouts.                                                                                                                                                                                                            |
| `posterOffer.ts`                      | Promo offer validation (text, Manila date, code) and wording.                                                                                                                                                                                                                                         |
| `posterAudit.ts`                      | Layout QA: out of bounds, text overlap, text below the legibility floor, overflow, empty text.                                                                                                                                                                                                        |

**Layout rules the compiler enforces:**

- A legibility floor of about 21px on a 1080 canvas.
- Optional slots drop instead of overflowing.
- Copy slightly over budget is kept whole (the fitter sizes it down); far over budget is dropped, never cut mid-phrase.
- Scrims are sized to the real text stack, so they hold behind the text and then fade.
- Story keeps the bottom 10% clear for the reply bar.
- Fact modules (icons, info bar) outrank supporting sentences when space runs out.

### Design system v2 (additive)

Layouts are short compositions of primitives in `posterLayout.ts`: a spacing scale (4 to 64 at 1080), a type scale by role, `contentBox` (padding, Story safe zones and the 3:4 grid crop in one box) and `flowStack`, which places modules top to bottom and drops the lowest priority item when they do not fit. `cleanLayouts.ts` builds the **Clean** family on top of them: `photo-first` (one bottom scrim, so scrims can never meet), `framed-editorial`, `big-type` and `info-card` (text on paper, no scrim). The text is measured first and the photo takes the room that is left, so no layout leaves a dead band. Clean layouts use two families, no script, no outline and no shadow, and the logo sits on a paper disc (`logoChip`) in a fixed corner. `split-panel` (photo bleeds off the top or left, paper panel for type) and `quote-card` (centered pull-quote, accent rule, photo band) round out Clean. The **Lifestyle** family (`arch-frame`, `duo-collage`, `trio-grid`) puts one to three photos on paper with type beneath; with fewer photos a layout uses what it has. `photoIndexesFor` gives collage layouts two or three ranked photos. `POSTER_ARCHETYPE_FAMILY` maps each id to `clean`, `lifestyle` or `flyer` for the style choice. Director prompt `2026-11-13.3` lists all 13 layouts; the edge enum and clamps mirror them.

**Freeze:** v2 ids were appended, and the six v1 builders are unchanged. `posterGolden.test.ts` hashes their compiled output for 4 sizes, so a stored post exports exactly as it previewed. Change a v1 builder and that test fails; ship the change as a new archetype id instead. (A full move to a `legacy/` folder with a `version: 2` spec stays open in the plan; this guard covers the risk it addresses.)

### Create form: style, photos, draft

`AiCreateRequest` (post) carries `photoUrls` (picked, hero first) and `family` (`auto|clean|flyer`). `generateBatch` puts the picks first (`orderPhotosWithPicks`) and, for a family, `applyStyleFamily` moves off-family layouts to unused layouts of that family. `useLivePostDraft` renders a debounced (700 ms) rule-based post from the form through `renderSample`, with picks leading the ranking; it never calls the director. `posterReadiness.ts` produces the Settings tips.

### Quick edit, grid and pixel audit

Free edits live in `posterQuickEdit.ts` (pure): `setPosterText` (director limits, headline never empty, over-long text rejected), `setHeroPhoto`, `setPosterLayout`, `setPosterToggle` (a module turns on only with a fact behind it), `moreLikeThisLayouts` and `describePostChange`, which labels each version from the real diff (Text edit, New photo, New layout, Resized, Options, Style). `AiStudioQuickEdit` is a `ResponsiveModal` guarded with `useGuardedClose`; Apply saves one new version with no AI call.
A new batch (and **More like this**, three unused layouts of the same family) opens as a 2x2 `AiStudioPostGrid` with thumbs; opening a card shows the stage. **Compare versions** returns to the grid. **Download all sizes** exports Portrait, Story and Facebook. When the first batch is quick layouts, a notice with **Retry with AI** sits above the stage (session only).
`posterPixelAudit.ts` (pure) finds the red load-error block, text whose box median background fails 3:1 contrast, and text near the edge. `posterPixelCheck.ts` decodes the render; `useAiPosterEngine.render` throws on a placeholder so it is never saved. Contrast and edge results are not yet enforced.

### Promo offer

A promo prints an offer the host typed (`posterOffer.ts`): text up to 5 words, an optional valid-until date (Manila calendar, a past date is dropped) and an optional voucher code. It rides on `facts.offer` for the request only and is never stored on the listing. With an offer, the copy library builds four sets around it, printed verbatim. Without one, `stripInventedOffers` (edge) blanks any percentage, discount, "save", "deal" or "limited time" wording and the prompt says so; a revision keeps the offer the post already carries. The edge mirrors the sanitizer as `readPosterOffer`.

## Server (`supabase/functions/_shared/marketingPosterDirector.ts`)

- Reuses feature `marketing_template` (quota, kill switch, credits, plan gate `aiMarketingGeneration`, permission `marketing.generate:add`, rate limit 15/h). Prompt id `marketing_template_poster`.
- `directPosterSpecs(input, billing)` is the model call; `generatePosterSpecs` adds the quota check.
- Photo fetch: https only, must be one of the property's stored media URLs, ≤ 4 MB, jpeg/png/webp, 6s timeout, ≤ 6 photos.

## Formats

`instagram-portrait` (1080×1350) is a real `DesignTemplateFormat`, so AI posts open and save in the Posts editor. The preset library also offers 4:5 (`DESIGN_PRESET_FORMATS`): the layouts are ratio-based and the 45 renders on the preset contact sheet (`run.ts --presets --format instagram-portrait`) matched the other sizes (plan 9.2).

## Themes

Inside Marketing Studio, AI Post follows the active [theme](./marketing-themes.md): `compilePosterDocument(..., { theme })` takes the theme palette (`posterPaletteInputFromTheme`) and swaps the theme's display, body and label faces into the archetype's pairing (`themedPosterFontPairing`), keeping its script accent and effects. Shuffle changes only the layout. **Edit** saves the post into the active theme.

## Reel preview

`AiStudioReelPreview` (More actions, **Preview reel**) builds the free reel through `engine.buildReelFor` and plays it in a Remotion `Player` before anything is saved. The Tour/Highlights switch rebuilds it; **Edit in Videos** calls `saveReel` with the shown recipe. No new output type or session constraint (plan 8.1 partial).

**Direct with AI** (billed, one `marketing_template` call, same quota and plan gate as a post): `engine.directReel` sends up to six ranked photos to `generate-marketing-template` `contentType: 'reel'` → `_shared/marketingReelDirector.ts`. The model returns `{ recipe, photoIndexes, copy { headline, subheadline, ctaLine } }`; the server drops bad or repeated indexes, strips banned phrases and clamps words. `lib/video/reelDirection.ts` maps indexes to URLs, and `buildReel` takes the lines as `copy` (empty lines keep the defaults, beats stay at 7 words). The director never places or times anything. A failure leaves the free reel in place; quota errors surface the upgrade prompt. Edit in Videos saves the directed photo order and lines. Music mood is not directed yet.

**Reel output.** AI Studio has a fourth output, `reel` (`AI_STUDIO_OUTPUTS`, plan 8.1). Create (`AiStudioCreate`, reduced form: words and optional photos, button **Make reel**) calls `directAndSaveReel` in `AiStudioConversation`: one billed `engine.directReel`, then `marketing-ai-sessions` `post-versions` with `output: 'reel'`. A non-quota AI failure saves the free reel (tour, ranked photos, default lines) instead. Versions live in `marketing_ai_post_versions` (`spec` = `{ recipe, copy }`, `photo_urls` = directed order, format `instagram-story`); migration `20261340000400_marketing_ai_sessions_reel_output.sql` only widens `marketing_ai_sessions_output_check`. `AiStudioReelSession` plays the picked version in the Remotion player, **Direct again** adds a version (parent = the picked one), **Edit in Videos** calls `saveReel`. Plan feature `aiMarketingGeneration`, permission `marketing.generate:add` (same as a post). Download and Publish are deliberately not duplicated on the reel stage: **Edit in Videos** opens the Videos editor, whose export and publish already enforce the Marketing Studio entitlement, publish limits and music caching.

Story reels raise all text to at least 88 px (headline 104 px), 4.5% of the 1920 px frame height, in `applyStoryTextSizes` (`reelBuilder.ts`); the layer `typography` override carries only `fontSize`.

## Rollback switch

Super-admin key `marketing.ai_studio.poster_v2` (on by default, fail-open). Off: `useAiPosterEngine` runs `effectiveStyleChoice`, so new batches and carousels use the Flyer family only. Saved posts and Edit in Design are unaffected (plan 10.1).

## Plan default

AI Studio opens on **Post** when `aiMarketingGeneration` is on (Business+), and on **Photo** otherwise. Post stays visible with its tier badge.

## Robustness

- **Run tokens:** Generate, a format switch and Shuffle each start a new run, and renders from an older run are dropped. A slow render never overwrites newer posters.
- **Format read at compile time:** results compile for the format selected when they arrive, not when the request left.
- **Remount per property:** the panel remounts when the property changes, so posters (and their Edit target) never cross properties.
- **Response shape:** the director response is shape-checked; malformed, empty, failed or network-error responses fall back to rule-based posters. Quota errors (`AiQuotaExceededClientError`) are rethrown to the upgrade/quota UI instead of being papered over with free layouts.
- **Photo budget:** photos sent to Gemini share a 12 MB raw budget (base64 inflates by 4/3 against the ~20 MB inline limit).
- **Fonts:** the canvas measurer uses real fonts once loaded and falls back to width estimates while they load (or if Google Fonts is unreachable). `fitPosterTextSlots` is the last-resort correction after render.
- **Render guard:** `lib/polotno/polotnoLoadGuard.ts` records OpenPolotno image-load failures. `posterRender.ts` retries once, then throws `PosterRenderError`; a frame with the red error placeholder is never exported, cached or saved. Template thumbnails return null on a failed photo. `POST_SAMPLE_RENDER_VERSION` is bumped when previews must be redrawn.
- **Photo preflight:** `lib/poster/posterPhotoPreflight.ts` fetches each photo once with CORS, downscales to a 1600px long edge and renders from the blob. Saved documents keep the real URL (`restorePhotoUrls`); a `blob:` URL never reaches a save. Photos that fail are dropped before photo indexes resolve.
- **Safe zones:** `createPosterCanvas` exposes `safeTop` (14%) and `safeBottom` (18%) for 9:16 and a `gridInset` for 4:5. `auditPosterDocument` reports `unsafe-zone` for text outside them; Story layouts start copy below `safeTop`.
- **Edge photo URLs:** the director also accepts photos on the project's own Storage origin (`posterPhotoFetchTarget`), so local and preview stacks send photos. Other http hosts stay refused.
- **Photo analysis and ranking:** preflight also reads a 64px copy of each photo (`posterPhotoAnalysis.ts`: luminance, contrast, sharpness, clipping, 3x3 zone busyness, focal point, difference hash). `posterPhotoRank.ts` orders photos best first (resolution, crop fit, exposure, sharpness, calm top, gallery order as a prior) and drops near-duplicates. The engine ranks before the director and rule-based specs see the photos; rule-based hero picks rotate through the top three only (`heroPhotoIndexes`). Analysis never fails a render: any error means no analysis.
- **Scrim tuning:** layouts author scrims for the worst photo. `posterScrimTuning.ts` lowers a scrim to the weakest alpha that still reads at 6:1 against an adversarial version of the zone behind the text, never above the authored alpha, and keeps the authored scrim on busy zones.
- **Palette guards:** ink is near neutral (a trace of hue), and a requested secondary within 35 degrees of the accent is replaced by the derived partner.
- **Audit v2:** `auditPosterDocument` also reports `too-many-fonts` (more than two families plus one script; the `Brand` wordmark is exempt), `text-budget` (18 text elements), `grid-unsafe` (4:5 text outside the centered 3:4 crop) and `logo-overlap`. The info bar keeps its cells inside the grid crop (`contentInset`).
- **Batch repair:** `posterRepair.ts`. A variant that fails the audit is lightened (fewer features and chips, no info bar or location), then switched to the Clean layout (`minimal-title`), then dropped and backfilled with a Clean layout, so the requested count always arrives. `ensureBatchDiversity` guarantees one Clean layout per batch.
- **Copy library:** `posterCopyLibrary.ts` holds six hand-written sets per goal (English and Taglish) inside the slot limits. Variants walk it with a seeded stride, so four variants never share a tagline. Facts only: promo prints the nightly rate when there is one and never invents an offer. Chips add the place, rate and extra amenities, not the icon-row amenities. `rankAmenities` puts distinctive amenities first and baseline ones (Wi-Fi, A/C, TV) last.
- **Director prompt v3:** version `2026-11-13.3`, temperature 0.7, photos described as ranked best first, per-layout character budgets, good and bad copy examples, one Clean layout per batch. `sanitizeVariant` clamps copy per layout (`LAYOUT_COPY_LIMITS`) and tidies chips.
- **Few-assets listings:** a text-only post (no photos) is centered in the safe area; a layout that would print the listing name twice (headline equals name) prints it once.
- **Telemetry:** `ai_post_generated` (goal, format, `ai_directed`, layout ids, repaired, dropped, with_issues, photo count; no prompt or copy text).
- **Throttled tabs:** frame waits race a short timeout, because background tabs pause `requestAnimationFrame`.

## Telemetry

PostHog events (counts and layout ids only, never prompt text, copy or listing data): `ai_post_generated` (goal, size, layouts, repaired, dropped, photos), `ai_studio_downloaded`, `ai_studio_publish_started`, `ai_post_edited` (Edit in Posts), `ai_post_caption_copied`. Quick edit, thumbs and variant-opened events wait on those surfaces.

## Contact sheet (dev)

`/dev/poster-sheet` (DEV only, never in the production bundle) renders every goal layout x size x fixture through the production compiler and renderer. `bun run marketing:contact-sheet` (against `./dev.sh --ui-only`) saves PNG/JPG cells and an `index.html` to `tmp/poster-sheets/<run>/`; options `--format`, `--fixture`, `--base`, `--layouts a,b`, `--samples` (AI Studio example cards), `--presets` (every built-in post preset x size x starter theme) and `--videos` (video recipe stills, the beats of a showcase reel, and motion frames for the text entrance and the focal push-in). Fixtures use the shipped showcase stock photos.

## Activity log

`activity-log: N/A for generation`. Specs are returned, nothing is persisted. **Edit** saves through `marketing-templates`, which records the write with `logAssetActivity`.

## Tests

| Suite                                                             | Covers                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/poster/posterCompiler.test.ts`                               | Every archetype × 4 formats × rich/sparse facts passes the audit; fact strings print verbatim; fonts come from the pairing; copy/label/palette/fitting rules                                           |
| `lib/poster/posterEdgeCases.test.ts`                              | The audit catches each issue kind; every goal with no photos, amenities or times; hostile model output; odd times/locations; unbreakable words                                                         |
| `lib/poster/posterLayout.test.ts` · `cleanLayouts.test.ts`        | Flow, drop order and anchors; every Clean layout × 4 sizes × rich, bare and empty copy passes the audit; one bottom scrim; paper layouts have none; info card prints real times                        |
| `lib/poster/posterGolden.test.ts`                                 | Frozen hashes of the six v1 layouts × 4 sizes                                                                                                                                                          |
| `lib/poster/posterOffer.test.ts`                                  | Offer sanitizing, Manila date, expiry, wording, no discount copy without an offer, longest offer compiles clean                                                                                        |
| `lib/poster/posterEdgeParity.test.ts`                             | Archetype, font pairing and goal enums match between UI and edge                                                                                                                                       |
| `hooks/useGeneratePosters.test.ts`                                | Request payload, photo remapping, fallback on 503 / empty / malformed / network errors, quota rethrow                                                                                                  |
| `_shared/marketingPosterDirector_test.ts` (Deno)                  | Amenity grounding, photo allow-list (SSRF), byte budget, bad responses, banned copy, variant sanitizing, `readPreferredArchetype`, `preferredArchetypeLine` (new batches only), `preferArchetypeFirst` |
| `e2e/features/marketing/marketingAiPost.spec.ts` (Playwright)     | Default mode, 4 rendered posts, request body, fallback, quota path, Edit → Design with a 4:5 save, plan default                                                                                        |
| `lib/aiStudioSamples.test.ts`                                     | Sample catalog shape, file paths, readiness gating, `buildAiCreateRequest` (`sampleId`), `postSampleFacts` showcase fallback                                                                           |
| `e2e/features/marketing/marketingAiExamples.spec.ts` (Playwright) | Examples gallery on home, detail view, Use this example / Clear, Undo over typed words, a post example's `preferredArchetype` on Generate, unknown `sample` dropped quietly                            |

## Not in this slice

These are separate features from the plan, not gaps in AI Post:

- brand kit fields (mascot, handles, tone); colors and fonts are now covered by [themes](./marketing-themes.md)
- cached photo analysis
- structure-locked photo enhancement
- a vision critic
- carousel sets
- "Save as my style"
- server-side render

The ship gate is still the blind eval against the benchmark posts.

## Photo enhance (AI Studio)

The Photo output defaults to **Enhance a photo**: one listing photo plus a preset from `ENHANCE_PRESETS` (`lib/marketingGenerationOptions.ts`). The request carries `intent: 'enhance'`, one `referenceIds` entry and the preset instruction with `enhancePrompt: false`. `generate-marketing-media` treats exactly one reference plus `intent: 'enhance'` like a refinement (`buildImageEditPrompt`) with `lockStructure: true`, which adds the real-listing-photo rule: no added, removed, moved or restyled objects or architecture. Not built: Extend to 4:5 or 9:16, Upscale, the before and after slider, and the post-edit vision comparison that would refuse and not charge when the room changed (7.3).

## Carousel

`posterCarousel.ts` (`buildCarouselSpecs`) builds up to five slides in one family: cover (vibe), amenities, feature (only with a distinctive amenity), stay info (only with times) and closing. Each role has a preferred layout per family (`FAMILY_LAYOUTS`), distinct across the set where the family allows, and a rotating hero photo. Auto means Clean. `useAiPosterEngine.carouselSlides` ranks photos and returns the slides; AI Studio renders them at 4:5, saves them as one turn (labelled **Carousel** when three or more goals share a parent) and opens the grid. **Download this set in order** saves numbered files. Publishing a carousel waits on the Meta gaps plan.

### Enhance honesty guard

`generate-marketing-media` with `intent: 'enhance'` runs `_shared/marketingEnhanceHonestyCheck.ts` after the edit: a vision call (platform cost, 8 s cap, fail-open) compares the original and edited photo and answers SAME or DIFFERENT. DIFFERENT throws `GenerationOutputError` before upload and billing, so the job fails uncharged. Passing jobs store `generation_options.aiEdited = true` (read by `toMarketingGenerationJobDto`). The stage shows `AiStudioBeforeAfter` for any image version with exactly one reference photo.

### Posts editor AI rail

`PolotnoDesignStudio.handleAiGenerate` sends every rail category to the poster engine (`POSTER_GOAL_FOR_RAIL_CATEGORY`: promo, slots and giveaway to `promo`; fully booked, reviews and custom to `vibe`; `RAIL_CATEGORY_HINT` prefixes the prompt so the director writes for the category) and saves the first ranked post with `saveToPosts`. The old token path (`generate-marketing-template` design tokens compiled by `polotnoAiCampaignDocuments.ts`) is no longer used for posts; the calendar and video wizards still use those modules.
