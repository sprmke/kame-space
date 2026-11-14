import { useCallback, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

import { usePublicPropertyDetail } from '@/features/guest/marketing/properties/hooks/usePublicPropertyDetail';

import { useAppSettings } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useOptionalMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import {
  generatePosters,
  requestPosterSpecs,
} from '@/features/dashboard/marketing/hooks/useGeneratePosters';
import {
  invalidateMarketingLibrary,
  saveMarketingTemplate,
} from '@/features/dashboard/marketing/hooks/useMarketingTemplates';
import { orderPosterBatch } from '@/features/dashboard/marketing/lib/aiStudioSamples';
import { collectDocumentImageUrls } from '@/features/dashboard/marketing/lib/polotno/documentImages';
import type { PolotnoDesignDocument } from '@/features/dashboard/marketing/lib/polotno/polotnoCampaignDocuments';
import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { buildRuleBasedPosterSpecs } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import { buildPosterFacts } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { preloadPosterFonts } from '@/features/dashboard/marketing/lib/poster/posterFontLoader';
import {
  sanitizePosterOffer,
  type PosterOffer,
} from '@/features/dashboard/marketing/lib/poster/posterOffer';
import {
  applyPhotoBlobs,
  photoAnalysisFromPreflight,
  photoSizesFromPreflight,
  preflightPosterPhotos,
  rankPreflightedPhotos,
  restorePhotoUrls,
  usablePhotoUrls,
} from '@/features/dashboard/marketing/lib/poster/posterPhotoPreflight';
import { checkRenderedPoster } from '@/features/dashboard/marketing/lib/poster/posterPixelCheck';
import {
  applyStyleFamily,
  effectiveStyleChoice,
  orderPhotosWithPicks,
  type PosterStyleChoice,
} from '@/features/dashboard/marketing/lib/poster/posterQuickEdit';
import {
  buildCarouselSpecs,
  type CarouselSlide,
} from '@/features/dashboard/marketing/lib/poster/posterCarousel';
import {
  buildReel,
  REEL_RECIPE_IDS,
  withLeadClip,
  type ReelCopyOverride,
  type ReelRecipeId,
} from '@/features/dashboard/marketing/lib/video/reelBuilder';
import {
  normalizeReelDirection,
  type ReelDirection,
} from '@/features/dashboard/marketing/lib/video/reelDirection';
import { requestReelDirection } from '@/features/dashboard/marketing/hooks/useGeneratePosters';
import type { renderPosterDocument as RenderPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterRender';
import {
  ensureBatchDiversity,
  repairBatch,
} from '@/features/dashboard/marketing/lib/poster/posterRepair';
import {
  compactPosterPhotos,
  normalizePosterSpec,
  type PosterArchetypeId,
  type PosterFacts,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';
import { loadMarketingFonts } from '@/features/dashboard/marketing/lib/theme/marketingFontLoader';
import type { MarketingThemeTokens } from '@/features/dashboard/marketing/lib/theme/marketingTheme';
import { marketingThemeFontList } from '@/features/dashboard/marketing/lib/theme/marketingThemeFonts';
import { themeStampForSave } from '@/features/dashboard/marketing/lib/theme/marketingThemeItems';
import { findMarketingThemeEntry } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';
import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOrgBrandColor } from '@/features/dashboard/org/hooks/useOrgBrandColor';
import { useOrgSettings } from '@/features/dashboard/org/hooks/useOrgSettings';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { captureAppEvent } from '@/lib/posthog/capture';

/**
 * The renderer pulls in Konva + OpenPolotno (~1.5 MB). AI Studio is the landing tab,
 * so it loads only when a post renders.
 */
const renderGuardedDocument: typeof RenderPosterDocument = (...args) =>
  import('@/features/dashboard/marketing/lib/poster/posterRender').then((m) =>
    m.renderPosterDocument(...args)
  );

/**
 * Draws with the downscaled photo copies, then puts the real URLs back so a saved or
 * stored document never holds a `blob:` URL. Throws `PosterRenderError` when a photo
 * still fails to load; callers never receive a broken frame.
 */
async function renderPosterDocument(
  ...[document, options]: Parameters<typeof RenderPosterDocument>
): ReturnType<typeof RenderPosterDocument> {
  const preflight = await preflightPosterPhotos(collectDocumentImageUrls(document));
  const rendered = await renderGuardedDocument(applyPhotoBlobs(document, preflight), options);
  return { ...rendered, document: restorePhotoUrls(rendered.document, preflight) };
}

/** Stored with each version: sharp enough for the stage, small enough for Storage. */
const PREVIEW_PIXEL_RATIO = 0.75;
/** Example cards are small; a lighter render keeps the gallery quick on phones. */
const SAMPLE_PIXEL_RATIO = 0.5;

export type RenderedPost = {
  spec: PosterSpec;
  photoUrls: string[];
  format: DesignTemplateFormat;
  document: PolotnoDesignDocument;
  previewDataUrl: string;
};

/**
 * AI Post engine for AI Studio: the AI art director picks layouts, type and copy for
 * the property's real photos; the poster compiler turns each spec into an editable
 * design. Facts (times, deposit, amenities) come from settings, never the model.
 */
export function useAiPosterEngine(themeKey?: string | null) {
  const { property, org } = useOrgContext();
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  const studio = useOptionalMarketingTheme();
  const posterV2Enabled = useFeatureAvailability('marketing.ai_studio.poster_v2').available;
  const { data: publicProperty, isLoading: propertyLoading } = usePublicPropertyDetail(
    property.slug
  );
  const { data: appSettings } = useAppSettings();
  const { data: orgSettings } = useOrgSettings();
  const orgBrandColor = useOrgBrandColor();

  // A conversation keeps the theme it started in; new posts use the open theme.
  const themeEntry =
    (studio && themeKey ? findMarketingThemeEntry(studio.library, themeKey) : null) ??
    studio?.active ??
    null;
  const themeTokens: MarketingThemeTokens | null = themeEntry?.tokens ?? null;
  const brandColor =
    themeTokens?.palette.primary ?? appSettings?.resolvedBrandColor ?? orgBrandColor ?? null;
  const logoUrl =
    orgSettings?.emailLogoUrl?.trim() ||
    org.logoUrl?.trim() ||
    (typeof org.settings?.emailLogoUrl === 'string' ? org.settings.emailLogoUrl.trim() : '') ||
    null;

  const baseFacts = useMemo(
    () =>
      buildPosterFacts({
        propertyName: property.name,
        brandName: org.name ?? null,
        property: publicProperty ?? null,
        photos: publicProperty?.images ?? [],
        logoUrl,
      }),
    [property.name, org.name, publicProperty, logoUrl]
  );

  const photoInfo = useCallback(async (urls: string[]) => {
    const preflight = await preflightPosterPhotos(urls);
    return {
      photoSizes: photoSizesFromPreflight(preflight),
      photoAnalysis: photoAnalysisFromPreflight(preflight),
    };
  }, []);

  /**
   * Drops photos that cannot be loaded before any photo index is resolved, so a spec
   * never points at a photo that will not draw. Looks at the first 12 (the director
   * reads at most 6).
   */
  const withUsablePhotos = useCallback(async (facts: PosterFacts): Promise<PosterFacts> => {
    const head = facts.photos.slice(0, 12);
    if (head.length === 0) return facts;
    const preflight = await preflightPosterPhotos(head);
    const usable = usablePhotoUrls(head, preflight);
    // Best photo first so the rule-based hero picks and the director's photo order agree.
    const ranked = rankPreflightedPhotos(usable, preflight);
    const photos = [...ranked, ...facts.photos.slice(12)];
    const unchanged =
      photos.length === facts.photos.length && photos.every((url, i) => url === facts.photos[i]);
    return unchanged ? facts : { ...facts, photos };
  }, []);

  const loadFonts = useCallback(
    () =>
      Promise.all([
        preloadPosterFonts(),
        themeTokens ? loadMarketingFonts(marketingThemeFontList(themeTokens.fonts)) : undefined,
      ]),
    [themeTokens]
  );

  const factsFor = useCallback(
    (photoUrls: string[]): PosterFacts =>
      photoUrls.length > 0 ? { ...baseFacts, photos: photoUrls } : baseFacts,
    [baseFacts]
  );

  const compile = useCallback(
    async (spec: PosterSpec, photoUrls: string[], format: DesignTemplateFormat) =>
      compilePosterDocument(spec, factsFor(photoUrls), format, {
        ...(await photoInfo(factsFor(photoUrls).photos)),
        brandColor,
        theme: themeTokens,
      }),
    [factsFor, photoInfo, brandColor, themeTokens]
  );

  const render = useCallback(
    async (
      spec: PosterSpec,
      photoUrls: string[],
      format: DesignTemplateFormat
    ): Promise<RenderedPost> => {
      await loadFonts();
      // A version stores its own photos, so keep only the ones this post places.
      const compact = compactPosterPhotos(spec, photoUrls);
      const document = await compile(compact.spec, compact.photoUrls, format);
      const rendered = await renderPosterDocument(document, {
        pixelRatio: PREVIEW_PIXEL_RATIO,
        mimeType: 'image/jpeg',
      });
      // Last line of defence: a load-error block must never reach a saved version.
      const pixelIssues = await checkRenderedPoster(rendered.dataUrl, rendered.document);
      if (pixelIssues.some((issue) => issue.kind === 'error-placeholder')) {
        throw new Error('A photo did not load. Try again.');
      }
      return {
        spec: compact.spec,
        photoUrls: compact.photoUrls,
        format,
        document: rendered.document,
        previewDataUrl: rendered.dataUrl,
      };
    },
    [compile, loadFonts]
  );

  /** First message: four posts, best-laid-out first. */
  const generateBatch = useCallback(
    async (input: {
      goal: PosterGoal;
      prompt: string;
      format: DesignTemplateFormat;
      preferredArchetype?: PosterArchetypeId | null;
      offer?: PosterOffer | null;
      photoUrls?: string[];
      family?: PosterStyleChoice;
      trendTopicKey?: string | null;
    }) => {
      // The offer rides on the facts for this request only; it is never stored on the listing.
      const ranked = await withUsablePhotos(baseFacts);
      const usableFacts: PosterFacts = {
        ...ranked,
        photos: orderPhotosWithPicks(ranked.photos, input.photoUrls ?? []),
        offer: input.goal === 'promo' ? sanitizePosterOffer(input.offer) : null,
      };
      const [result] = await Promise.all([
        generatePosters(propertyId, {
          goal: input.goal,
          prompt: input.prompt,
          facts: usableFacts,
          brandColor,
          preferredArchetype: input.preferredArchetype ?? null,
          trendTopicKey: input.trendTopicKey ?? null,
        }),
        loadFonts(),
      ]);
      const photos = result.facts.photos;
      const issuesFor = async (spec: PosterSpec) =>
        auditPosterDocument(await compile(spec, photos, input.format)).length;
      // Layout QA repair: a failing variant is lightened, then switched to the Clean
      // layout, then replaced, so four finished posts always arrive.
      const repaired = await repairBatch(result.specs, issuesFor, { count: result.specs.length });
      const scored = await Promise.all(
        repaired.specs.map(async (spec) => ({ spec, issues: await issuesFor(spec) }))
      );
      // Posts with leftover issues go last. A layout the host picked from an example
      // leads when it passes QA.
      const ordered = orderPosterBatch(scored, input.preferredArchetype ?? null);
      const specsInOrder = ordered.map((item) => item.spec);
      const family = effectiveStyleChoice(input.family, posterV2Enabled);
      const finalSpecs = family !== 'auto'
        ? applyStyleFamily(specsInOrder, family, { keepFonts: Boolean(themeTokens) })
        : ensureBatchDiversity(specsInOrder);
      // Counts and layout ids only: no prompt text, copy or property data.
      captureAppEvent('ai_post_generated', {
        goal: input.goal,
        format: input.format,
        ai_directed: result.aiDirected,
        variants: finalSpecs.length,
        layouts: finalSpecs.map((spec) => spec.archetype).join(','),
        repaired: repaired.repaired,
        dropped: repaired.dropped,
        with_issues: ordered.filter((item) => item.issues > 0).length,
        photos: photos.length,
        style: family,
        picked_photos: (input.photoUrls ?? []).length,
      });
      return {
        specs: finalSpecs,
        photoUrls: photos,
        aiDirected: result.aiDirected,
      };
    },
    [propertyId, baseFacts, brandColor, loadFonts, compile, withUsablePhotos, themeTokens, posterV2Enabled]
  );

  /** A refinement: the AI revises the current post; no rule-based fallback. */
  const revise = useCallback(
    async (input: {
      spec: PosterSpec;
      photoUrls: string[];
      goal: PosterGoal;
      originalPrompt: string;
      instruction: string;
    }) => {
      const facts = factsFor(input.photoUrls);
      const response = await requestPosterSpecs(propertyId, {
        goal: input.goal,
        prompt: input.originalPrompt,
        facts,
        brandColor,
        count: 1,
        revise: {
          spec: input.spec as unknown as Record<string, unknown>,
          instruction: input.instruction,
        },
      });
      const photoUrls = Array.isArray(response?.photoUrls)
        ? response.photoUrls.filter((url): url is string => typeof url === 'string' && url !== '')
        : [];
      const nextFacts = photoUrls.length > 0 ? { ...facts, photos: photoUrls } : facts;
      const raw = Array.isArray(response?.variants) ? response.variants[0] : null;
      if (!raw) throw new Error('Could not change this post. Try different words.');
      return { spec: normalizePosterSpec(raw, nextFacts), photoUrls: nextFacts.photos };
    },
    [propertyId, factsFor, brandColor]
  );

  /**
   * AI Studio example preview: one rule-based post in a fixed layout, drawn with the
   * given facts (the host's listing, or the stand-in showcase). No AI call.
   */
  const renderSample = useCallback(
    async (input: {
      goal: PosterGoal;
      archetype: PosterArchetypeId;
      format: DesignTemplateFormat;
      facts: PosterFacts;
      /** Photos the host picked: they lead whatever the ranking says. */
      picks?: string[];
    }): Promise<string> => {
      await loadFonts();
      const usable = await withUsablePhotos(input.facts);
      const sampleFacts = input.picks?.length
        ? { ...usable, photos: orderPhotosWithPicks(usable.photos, input.picks) }
        : usable;
      const specs = buildRuleBasedPosterSpecs(sampleFacts, input.goal, { accent: brandColor });
      const spec = specs.find((item) => item.archetype === input.archetype) ?? specs[0];
      if (!spec) throw new Error('No layout for this example');
      const pinned = normalizePosterSpec(
        {
          ...spec,
          archetype: input.archetype,
          fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[input.archetype],
        },
        sampleFacts
      );
      const document = await compilePosterDocument(pinned, sampleFacts, input.format, {
        ...(await photoInfo(sampleFacts.photos)),
        brandColor,
        theme: themeTokens,
      });
      const rendered = await renderPosterDocument(document, {
        pixelRatio: SAMPLE_PIXEL_RATIO,
        mimeType: 'image/jpeg',
      });
      return rendered.dataUrl;
    },
    [loadFonts, brandColor, photoInfo, themeTokens, withUsablePhotos]
  );

  /** Full-size PNG for Download / Publish. */
  const exportBlob = useCallback(
    async (spec: PosterSpec, photoUrls: string[], format: DesignTemplateFormat) => {
      await loadFonts();
      const document = await compile(spec, photoUrls, format);
      const rendered = await renderPosterDocument(document, {
        pixelRatio: 1,
        mimeType: 'image/png',
      });
      return (await fetch(rendered.dataUrl)).blob();
    },
    [compile, loadFonts]
  );

  /** Saves the post as an editable design and returns its id (Posts editor). */
  const saveToPosts = useCallback(
    async (input: {
      spec: PosterSpec;
      photoUrls: string[];
      format: DesignTemplateFormat;
      name: string;
      previewUrl: string | null;
    }) => {
      await loadFonts();
      const document = await compile(input.spec, input.photoUrls, input.format);
      const record = await saveMarketingTemplate(propertyId, {
        name: input.name,
        contentType: 'design',
        aspectPreset: input.format,
        platform: input.format.includes('facebook') ? 'facebook' : 'instagram',
        kind: 'design',
        ...(themeEntry ? { themeKey: themeEntry.key } : {}),
        designJson: {
          ...(themeTokens ? themeStampForSave(themeTokens) : {}),
          templateId: '',
          format: input.format,
          aiGenerated: true,
          posterSpec: input.spec,
          polotno: document,
        },
      });
      invalidateMarketingLibrary(queryClient, propertyId);
      return record.id;
    },
    [loadFonts, compile, propertyId, themeEntry, themeTokens, queryClient]
  );

  /** Free: a five slide carousel in one style from the ranked listing photos. */
  const carouselSlides = useCallback(
    async (family: PosterStyleChoice, picks: string[] = []) => {
      const ranked = await withUsablePhotos(baseFacts);
      const photos = orderPhotosWithPicks(ranked.photos, picks);
      const slides: CarouselSlide[] = buildCarouselSpecs({ ...ranked, photos }, effectiveStyleChoice(family, posterV2Enabled), {
        accent: brandColor,
      });
      return { slides, photoUrls: photos };
    },
    [baseFacts, withUsablePhotos, brandColor, posterV2Enabled]
  );

  /**
   * Free: builds a 12 to 20 second reel from the best listing photos (picked photos
   * first), saves it as an editable video and returns its id (Videos editor).
   */
  const buildReelFor = useCallback(
    async (input: { photoUrls?: string[]; recipe?: ReelRecipeId; copy?: ReelCopyOverride }) => {
      const ranked = await withUsablePhotos(baseFacts);
      const facts: PosterFacts = {
        ...ranked,
        photos: orderPhotosWithPicks(ranked.photos, input.photoUrls ?? []),
      };
      // The push-in of each beat lands on the subject the pixel analysis found.
      const { photoAnalysis } = await photoInfo(facts.photos);
      const focals = Object.fromEntries(
        Object.entries(photoAnalysis).map(([url, analysis]) => [url, analysis?.focal ?? null])
      );
      const built = buildReel(facts, {
        format: 'instagram-story',
        focals,
        recipe: input.recipe,
        copy: input.copy,
      });
      if (!built) throw new Error('Add listing photos to make a reel.');
      return built;
    },
    [baseFacts, withUsablePhotos, photoInfo]
  );

  /**
   * Billed (one director call, like a post): the model looks at the best photos and picks
   * the recipe, the photo order and the short lines. Null means keep the free reel.
   */
  const directReel = useCallback(
    async (input: { photoUrls?: string[]; prompt?: string }): Promise<ReelDirection | null> => {
      const ranked = await withUsablePhotos(baseFacts);
      const photos = orderPhotosWithPicks(ranked.photos, input.photoUrls ?? []).slice(0, 6);
      const response = await requestReelDirection(propertyId, {
        facts: { ...ranked, photos },
        prompt: input.prompt ?? '',
      });
      return normalizeReelDirection(
        response.direction,
        Array.isArray(response.photoUrls) ? response.photoUrls : [],
        REEL_RECIPE_IDS
      );
    },
    [baseFacts, withUsablePhotos, propertyId]
  );

  const saveReel = useCallback(
    async (input: {
      photoUrls?: string[];
      name?: string;
      leadClipUrl?: string;
      recipe?: ReelRecipeId;
      copy?: ReelCopyOverride;
    }) => {
      const built = await buildReelFor(input);
      const reel = input.leadClipUrl
        ? { ...built, project: withLeadClip(built.project, input.leadClipUrl) }
        : built;
      const record = await saveMarketingTemplate(propertyId, {
        name: input.name?.trim() || reel.tokens.label,
        contentType: 'video',
        aspectPreset: reel.project.format,
        platform: 'instagram',
        kind: 'design',
        ...(themeEntry ? { themeKey: themeEntry.key } : {}),
        designJson: {
          templateId: reel.project.templateId,
          format: reel.project.format,
          category: reel.tokens.category,
          categoryId: reel.tokens.category,
          binding: reel.binding,
          project: reel.project,
          aiGenerated: true,
          aiTokens: reel.tokens,
          ...(themeTokens ? themeStampForSave(themeTokens) : {}),
        },
      });
      invalidateMarketingLibrary(queryClient, propertyId);
      captureAppEvent('ai_reel_made', { recipe: reel.recipe, seconds: reel.seconds });
      return record.id;
    },
    [buildReelFor, propertyId, themeEntry, themeTokens, queryClient]
  );

  return {
    ready: !propertyLoading,
    buildReelFor,
    directReel,
    saveReel,
    carouselSlides,
    themeKey: themeEntry?.key ?? null,
    baseFacts,
    generateBatch,
    render,
    renderSample,
    revise,
    exportBlob,
    saveToPosts,
  };
}

export type AiPosterEngine = ReturnType<typeof useAiPosterEngine>;
