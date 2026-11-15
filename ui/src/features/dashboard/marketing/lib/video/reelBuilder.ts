import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  getSceneLayers,
  persistSceneLayers,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { resolveAiGeneratedVideoProject } from '@/features/dashboard/marketing/lib/video/videoAiProjectBuilder';
import type {
  VideoFormat,
  VideoProject,
  VideoSceneLayer,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { PosterFacts } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import { posterShortName } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import {
  VIDEO_AI_SCENE_COUNT_MAX,
  VIDEO_AI_SCENE_COUNT_MIN,
  type VideoSceneToken,
  type VideoTemplateTokens,
} from '@/features/dashboard/marketing/lib/videoAiTokens';

/**
 * Reel: a 12 to 20 second story built deterministically from the listing's own
 * photos and facts (no AI, no credits). Photos arrive ranked best first; each beat
 * holds one photo with one short line, and the last beat is the booking line. The
 * result is an ordinary editable video project, so it opens in the Videos editor.
 */

export const REEL_MIN_SECONDS = 12;
export const REEL_MAX_SECONDS = 20;
/**
 * Story and Reels cover the top and bottom with app chrome. Text stays between these
 * heights (percent of the frame): about 14% clear at the top, 20% at the bottom.
 */
export const REEL_SAFE_TOP_PCT = 14;
export const REEL_SAFE_BOTTOM_PCT = 80;

/** Text-bearing layers; images and logos keep their own placement. */
const TEXT_LAYER_KINDS = new Set(['headline', 'subheadline', 'text', 'promo', 'cta', 'slots', 'rules']);

function isTextLayer(layer: VideoSceneLayer): boolean {
  if (layer.kind === 'image' || layer.kind === 'logo') return false;
  return TEXT_LAYER_KINDS.has(layer.kind) || layer.text !== undefined || Boolean(layer.lines);
}

/** Pulls every text layer of a Story project into the safe band. Other formats pass through. */
export function applyStorySafeZones(project: VideoProject): VideoProject {
  if (project.format !== 'instagram-story') return project;
  return {
    ...project,
    scenes: project.scenes.map((scene) => {
      let changed = false;
      const layers = getSceneLayers(scene).map((layer) => {
        const y = layer.position.y;
        if (!isTextLayer(layer)) return layer;
        const clamped = Math.min(REEL_SAFE_BOTTOM_PCT, Math.max(REEL_SAFE_TOP_PCT, y));
        if (clamped === y) return layer;
        changed = true;
        return { ...layer, position: { ...layer.position, y: clamped } };
      });
      return changed ? persistSceneLayers(scene, layers) : scene;
    }),
  };
}

/**
 * Text on a Story must read on a phone: at least 4.5% of the 1920 px frame height
 * (about 86 px). The classic presets are 72 / 30 / 26 px, so Story reels raise them.
 */
export const REEL_MIN_TEXT_PX = 88;
export const REEL_HEADLINE_PX = 104;

/** Raises every text layer of a Story project to the minimum readable size. */
export function applyStoryTextSizes(project: VideoProject): VideoProject {
  if (project.format !== 'instagram-story') return project;
  return {
    ...project,
    scenes: project.scenes.map((scene) => {
      let changed = false;
      const layers = getSceneLayers(scene).map((layer) => {
        if (!isTextLayer(layer)) return layer;
        changed = true;
        const isHeadline = layer.kind === 'text' && (layer.textStyle ?? 'headline') === 'headline';
        const px = isHeadline ? REEL_HEADLINE_PX : REEL_MIN_TEXT_PX;
        // The renderer merges this over the role's typography, so only the size is set.
        return {
          ...layer,
          typography: { ...layer.typography, fontSize: px } as VideoSceneLayer['typography'],
        };
      });
      return changed ? persistSceneLayers(scene, layers) : scene;
    }),
  };
}

/** At most this many words per beat. */
export const REEL_BEAT_WORDS = 7;

type ReelRecipe = {
  id: 'tour' | 'highlights';
  label: string;
  scenes: VideoSceneToken[];
};

const RECIPES: ReelRecipe[] = [
  {
    id: 'tour',
    label: 'Tour',
    scenes: [
      { kind: 'photo', durationSec: 3.5, transition: 'fade', motion: 'slow-zoom-in' },
      { kind: 'photo', durationSec: 3.5, transition: 'push-cut', motion: 'pan-left' },
      { kind: 'photo', durationSec: 3.5, transition: 'fade', motion: 'drift-up' },
      { kind: 'photo', durationSec: 3.5, transition: 'dissolve', motion: 'pan-right' },
      { kind: 'cta', durationSec: 2.5, transition: 'fade', motion: 'hold' },
    ],
  },
  {
    id: 'highlights',
    label: 'Highlights',
    scenes: [
      { kind: 'photo', durationSec: 3, transition: 'zoom-in-out', motion: 'punch-in' },
      { kind: 'photo', durationSec: 3, transition: 'slide-left', motion: 'diagonal-drift' },
      { kind: 'photo', durationSec: 3, transition: 'wipe', motion: 'zoom-out' },
      { kind: 'cta', durationSec: 3, transition: 'fade', motion: 'hold' },
    ],
  },
];

export const REEL_RECIPE_IDS = RECIPES.map((recipe) => recipe.id);
export type ReelRecipeId = ReelRecipe['id'];

function limitWords(value: string, words: number): string {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, words).join(' ');
}

/** The recipe to use for this many photos: the longer one needs four, the shorter one three. */
export function pickReelRecipe(photoCount: number, preferred?: ReelRecipeId): ReelRecipe {
  const wanted = preferred ? RECIPES.find((recipe) => recipe.id === preferred) : null;
  const need = (recipe: ReelRecipe) => recipe.scenes.filter((s) => s.kind === 'photo').length;
  if (wanted && photoCount >= Math.min(need(wanted), 2)) return wanted;
  return photoCount >= 4 ? RECIPES[0]! : RECIPES[1]!;
}

export function reelDurationSeconds(scenes: VideoSceneToken[]): number {
  return Math.round(scenes.reduce((sum, scene) => sum + scene.durationSec, 0) * 10) / 10;
}

export type ReelCopyOverride = { headline?: string; subheadline?: string; ctaLine?: string };

/** An AI-directed line replaces the default only when it has words, trimmed to the beat limit. */
function directedLine(value: string | undefined, fallback: string, upper = false): string {
  const line = value ? limitWords(value, REEL_BEAT_WORDS) : '';
  if (!line) return fallback;
  return upper ? line.toUpperCase() : line;
}

export function buildReelTokens(
  facts: Pick<PosterFacts, 'propertyName' | 'location' | 'amenities' | 'nightlyRate'>,
  photoCount: number,
  preferred?: ReelRecipeId,
  copyOverride?: ReelCopyOverride
): VideoTemplateTokens {
  const recipe = pickReelRecipe(photoCount, preferred);
  const photoScenes = recipe.scenes.filter((scene) => scene.kind === 'photo');
  // With few photos the photo beats are trimmed so none repeats; the booking beat stays.
  const keep = Math.max(1, Math.min(photoScenes.length, photoCount));
  const scenes = [
    ...photoScenes.slice(0, keep),
    ...recipe.scenes.filter((scene) => scene.kind !== 'photo'),
  ].slice(0, VIDEO_AI_SCENE_COUNT_MAX);
  const name = posterShortName(facts.propertyName);
  const place = facts.location ? limitWords(facts.location, REEL_BEAT_WORDS) : '';
  return {
    category: 'soft-stay',
    scenes,
    fontPairing: 'editorial-serif',
    copy: {
      headline: directedLine(copyOverride?.headline, limitWords(name, REEL_BEAT_WORDS).toUpperCase(), true),
      subheadline: directedLine(copyOverride?.subheadline, place),
      promoLine: facts.nightlyRate ? `From ${facts.nightlyRate} / night` : '',
      slotLabels: [],
      ctaLine: directedLine(copyOverride?.ctaLine, 'Book direct'),
      rulesLine: facts.propertyName,
    },
    label: `${name} reel`,
  };
}

export function reelBindingFromFacts(facts: PosterFacts): DesignBinding {
  return {
    propertyName: facts.propertyName,
    propertyPhoto: facts.photos[0] ?? null,
    propertyMedia: facts.photos.map((url) => ({ url, type: 'image' as const })),
    nightlyRate: facts.nightlyRate ?? '',
    availabilityText: '',
    monthLabel: '',
    monthShort: '',
    openSlots: [],
  };
}

/**
 * Opens the reel with a finished clip: the first beat's background becomes the clip
 * and the photo beats follow. The clip keeps its own motion (no Ken Burns).
 */
export function withLeadClip(project: VideoProject, clipUrl: string): VideoProject {
  const [first, ...rest] = project.scenes;
  if (!first) return project;
  const layers = getSceneLayers(first).map((layer) =>
    layer.kind === 'background' ? { ...layer, imageUrl: clipUrl, mediaType: 'video' as const } : layer
  );
  const lead = persistSceneLayers(
    { ...first, imageUrl: clipUrl, backgroundMediaType: 'video', focal: undefined },
    layers
  );
  return { ...project, scenes: [lead, ...rest] };
}

/** Points each photo scene's push-in at the subject (the pixel analysis focal estimate). */
export function applyFocalPoints(
  project: VideoProject,
  focals: Record<string, { x: number; y: number } | null | undefined>
): VideoProject {
  return {
    ...project,
    scenes: project.scenes.map((scene) => {
      const focal = scene.imageUrl ? focals[scene.imageUrl] : null;
      return focal ? { ...scene, focal: { x: focal.x, y: focal.y } } : scene;
    }),
  };
}

export type ReelBuild = {
  tokens: VideoTemplateTokens;
  project: VideoProject;
  binding: DesignBinding;
  seconds: number;
  recipe: ReelRecipeId;
};

/** A reel project for one format, from ranked photos and listing facts. */
export function buildReel(
  facts: PosterFacts,
  options: {
    format?: VideoFormat;
    recipe?: ReelRecipeId;
    copy?: ReelCopyOverride;
    logoUrl?: string | null;
    focals?: Record<string, { x: number; y: number } | null | undefined>;
  } = {}
): ReelBuild | null {
  if (facts.photos.length === 0) return null;
  const tokens = buildReelTokens(facts, facts.photos.length, options.recipe, options.copy);
  const binding = reelBindingFromFacts(facts);
  const safe = applyStorySafeZones(
    applyStoryTextSizes(
      resolveAiGeneratedVideoProject(tokens, binding, options.format ?? 'instagram-story', {
        orgLogoUrl: options.logoUrl ?? facts.logoUrl,
        includeOrgLogo: Boolean(options.logoUrl ?? facts.logoUrl),
      })
    )
  );
  const project = options.focals ? applyFocalPoints(safe, options.focals) : safe;
  return {
    tokens,
    project,
    binding,
    seconds: reelDurationSeconds(tokens.scenes),
    recipe: pickReelRecipe(facts.photos.length, options.recipe).id,
  };
}

export { VIDEO_AI_SCENE_COUNT_MIN };
