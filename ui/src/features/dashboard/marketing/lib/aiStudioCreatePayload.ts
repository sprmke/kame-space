/**
 * Turns the AI Studio create form into the request it sends. Pure, so the examples
 * (`aiStudioSamples.ts`) can be checked against the exact mapping Generate uses.
 */
import type { GenerateMarketingMediaPayload } from '@/features/dashboard/marketing/hooks/useGenerateMarketingMedia';
import {
  composeGenerationPrompt,
  enhanceInstruction,
  enhancePresetById,
  imageSizeOptions,
  type VideoCameraMoveId,
  type VideoSoundMode,
} from '@/features/dashboard/marketing/lib/marketingGenerationOptions';
import {
  DEFAULT_VIDEO_DURATION,
  DRAFT_VIDEO_RESOLUTION,
  type ImageSize,
  type VideoResolution,
} from '@/features/dashboard/marketing/lib/marketingGenerationPricing';
import type { MarketingGenerationTier } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';
import {
  sanitizePosterOffer,
  type PosterOffer,
} from '@/features/dashboard/marketing/lib/poster/posterOffer';
import type { PosterStyleChoice } from '@/features/dashboard/marketing/lib/poster/posterQuickEdit';
import type {
  PosterArchetypeId,
  PosterGoal,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

export type AiCreateRequest =
  | {
      output: 'post';
      goal: PosterGoal;
      format: DesignTemplateFormat;
      prompt: string;
      /** From an example: this layout leads the batch when it passes layout QA. */
      preferredArchetype: PosterArchetypeId | null;
      /** Promo only: the offer the host typed, validated. Null prints no offer. */
      offer: PosterOffer | null;
      /** Photos the host picked, hero first. Empty: the engine ranks the listing. */
      photoUrls: string[];
      /** Style steer: Auto mixes families. */
      family: PosterStyleChoice;
      /** Also render the best post as a Story (free, one extra version). */
      alsoStory: boolean;
      sampleId: string | null;
      /** Marketing Trends topic this creation came from. */
      trendTopicKey: string | null;
    }
  | {
      output: 'reel';
      prompt: string;
      /** Photos the host picked, best first. Empty: the engine ranks the listing. */
      photoUrls: string[];
      sampleId: string | null;
      /** Marketing Trends topic this creation came from (server loads it). */
      trendTopicKey: string | null;
    }
  | {
      output: 'image' | 'video';
      prompt: string;
      aspect: string;
      payload: GenerateMarketingMediaPayload;
      sampleId: string | null;
      /** Marketing Trends topic this creation came from (server loads it). */
      trendTopicKey: string | null;
    };

export type AiCreateFormState = {
  output: 'post' | 'image' | 'video' | 'reel';
  text: string;
  goal: PosterGoal;
  format: DesignTemplateFormat;
  aspect: string;
  lookId: string | null;
  tier: MarketingGenerationTier;
  imageSize: ImageSize;
  resolution: VideoResolution;
  allowHighResolution: boolean;
  cameraMove: VideoCameraMoveId;
  sound: VideoSoundMode;
  enhance: boolean;
  referenceIds: string[];
  /** Example applied to the form, if any. */
  sampleId: string | null;
  preferredArchetype: PosterArchetypeId | null;
  /** Promo offer fields as typed; read only when the goal is promo. */
  offerText?: string;
  offerUntil?: string;
  offerCode?: string;
  photoUrls?: string[];
  family?: PosterStyleChoice;
  alsoStory?: boolean;
  /** Photo output: edit one listing photo (`enhance`) or make a new scene. */
  imageMode?: 'enhance' | 'scene';
  enhancePreset?: string | null;
  /** Marketing Trends topic applied to the form, if any. */
  trendTopicKey?: string | null;
};

/** 720p unless 1080p is allowed and quality is above Draft. */
export function effectiveVideoResolution(
  state: Pick<AiCreateFormState, 'tier' | 'resolution' | 'allowHighResolution'>
): VideoResolution {
  return state.tier === 'draft' || !state.allowHighResolution
    ? DRAFT_VIDEO_RESOLUTION
    : state.resolution;
}

export function buildAiCreateRequest(state: AiCreateFormState): AiCreateRequest {
  const description = state.text.trim();
  const trendTopicKey = state.trendTopicKey ?? null;
  if (state.output === 'post') {
    return {
      output: 'post',
      goal: state.goal,
      format: state.format,
      prompt: description,
      preferredArchetype: state.preferredArchetype,
      offer:
        state.goal === 'promo'
          ? sanitizePosterOffer({
              text: state.offerText,
              validUntil: state.offerUntil,
              code: state.offerCode,
            })
          : null,
      photoUrls: state.photoUrls ?? [],
      family: state.family ?? 'auto',
      alsoStory: Boolean(state.alsoStory) && state.format !== 'instagram-story',
      sampleId: state.sampleId,
      trendTopicKey,
    };
  }
  if (state.output === 'reel') {
    return {
      output: 'reel',
      prompt: description,
      photoUrls: state.photoUrls ?? [],
      sampleId: state.sampleId,
      trendTopicKey,
    };
  }
  const hasStartFrame = state.output === 'video' && state.referenceIds.length > 0;
  // A clip's start photo sets the light, so the look is not sent with one.
  const prompt = composeGenerationPrompt(description, hasStartFrame ? null : state.lookId);
  const attribution = state.sampleId ? { sampleId: state.sampleId } : {};
  if (state.output === 'video') {
    return {
      output: 'video',
      prompt: description,
      aspect: state.aspect,
      sampleId: state.sampleId,
      trendTopicKey,
      payload: {
        mediaType: 'video',
        prompt,
        qualityTier: state.tier,
        aspectRatio: state.aspect,
        resolution: effectiveVideoResolution(state),
        durationSeconds: DEFAULT_VIDEO_DURATION,
        referenceIds: state.referenceIds,
        cameraMove: state.cameraMove,
        sound: state.sound,
        enhancePrompt: state.enhance,
        ...attribution,
      },
    };
  }
  if (state.imageMode === 'enhance') {
    const instruction = enhanceInstruction(state.enhancePreset ?? null, description);
    const preset = enhancePresetById(state.enhancePreset);
    const aspect = preset?.aspect ?? state.aspect;
    const sizes = imageSizeOptions(state.tier);
    const imageSize = preset?.upscale
      ? sizes[sizes.length - 1]
      : state.tier === 'draft'
        ? '1K'
        : state.imageSize;
    return {
      output: 'image',
      prompt: instruction,
      aspect,
      sampleId: state.sampleId,
      trendTopicKey,
      payload: {
        mediaType: 'image',
        prompt: instruction,
        qualityTier: state.tier,
        aspectRatio: aspect,
        imageSize,
        referenceIds: state.referenceIds.slice(0, 1),
        intent: 'enhance',
        enhancePrompt: false,
        ...attribution,
      },
    };
  }
  return {
    output: 'image',
    prompt: description,
    aspect: state.aspect,
    sampleId: state.sampleId,
    trendTopicKey,
    payload: {
      mediaType: 'image',
      prompt,
      qualityTier: state.tier,
      aspectRatio: state.aspect,
      imageSize: state.tier === 'draft' ? '1K' : state.imageSize,
      referenceIds: state.referenceIds,
      enhancePrompt: state.enhance,
      ...attribution,
    },
  };
}
