/**
 * AI director for Marketing Studio reels
 * (docs/workflow/planned/marketing-ai-studio-quality-and-flow-overhaul.md, item 8.1).
 *
 * One multimodal call: the model sees the property's real photos and returns a
 * direction: which recipe, which photos in which order, and the short text lines. It
 * never builds the video. The UI applies the direction to the deterministic reel
 * builder (ui/.../lib/video/reelBuilder.ts), which owns timing, motion and safe zones.
 */

import { z } from 'zod';

import { generateStructured, type LlmBilling, type LlmPart } from './ai/llmClient.ts';
import { definePrompt } from './ai/prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from './ai/untrusted.ts';
import { assertOrgAndPropertyAiQuota, type AiActorType } from './aiUsageService.ts';
import {
  clampCopyText,
  stripBannedCopy,
  type PosterFactsInput,
  type PosterPhotoInput,
} from './marketingPosterDirector.ts';

const FEATURE = 'marketing_template' as const;

export const REEL_DIRECTOR_PROMPT = definePrompt({
  id: 'marketing_template_reel',
  version: '2026-11-13.2',
});

/** Mirrors REEL_RECIPE_IDS in ui/.../lib/video/reelBuilder.ts. */
export const REEL_RECIPES = ['tour', 'highlights'] as const;
export type ReelRecipe = (typeof REEL_RECIPES)[number];

/** Mirrors REEL_BEAT_WORDS in reelBuilder.ts. */
const BEAT_WORDS = 7;
export const REEL_MAX_PHOTOS = 6;

export type ReelDirection = {
  recipe: ReelRecipe;
  /** Indexes into the photos sent, best opening shot first. */
  photoIndexes: number[];
  copy: { headline: string; subheadline: string; ctaLine: string };
};

export type DirectReelInput = {
  organizationId: string;
  propertyId: string;
  actorUserId?: string | null;
  actorType?: AiActorType;
  prompt: string;
  facts: PosterFactsInput;
  /** Already allow-listed and fetched. Index = photoIndexes. */
  photos: PosterPhotoInput[];
};

const SYSTEM_PROMPT = withUntrustedDataRule(
  [
    'You direct a 12 to 20 second Instagram Reel for one real vacation rental. A separate',
    'engine builds and times the video from your choices; you never describe motion.',
    '',
    'Look at the attached photos (numbered in order) before deciding:',
    '- recipe: "tour" walks through four photos (best with four or more good photos);',
    '  "highlights" is a faster three-photo cut. Pick the one the photos support.',
    '- photoIndexes: the photos to use, in playing order. The input order is only a quality',
    '  ranking, not the story: reorder it. Open with the most inviting wide shot (the view,',
    '  the main living space), move through the rooms, and close on a calm, bright frame.',
    '  No two near-identical shots next to each other. Skip dark, blurry or cluttered photos.',
    '  Never repeat an index.',
    '',
    'Copy rules (strict):',
    `- headline: the property name or a short hook, at most ${BEAT_WORDS} words.`,
    `- subheadline: one concrete thing you can see in the photos (the light, the view, the`,
    `  materials, a feature), at most ${BEAT_WORDS} words. Never generic ("comfortable retreat",`,
    '  "relax and unwind"). Do not repeat the location.',
    '- ctaLine: at most 4 words, for example "Book your stay".',
    '- Specific, warm, human. No em dashes, no emojis, no hashtags.',
    '- Banned: "sweet escape", "home away from home", "perfect getaway", "luxury awaits".',
    '- Never invent prices, discounts, dates, times, amenities or places that are not in the',
    '  property facts or the host request.',
    '- Match the host language. Taglish is fine when the host writes that way.',
  ].join('\n')
);

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    recipe: { type: 'STRING', enum: [...REEL_RECIPES] },
    photoIndexes: { type: 'ARRAY', items: { type: 'INTEGER' } },
    copy: {
      type: 'OBJECT',
      properties: {
        headline: { type: 'STRING' },
        subheadline: { type: 'STRING' },
        ctaLine: { type: 'STRING' },
      },
      required: ['headline', 'subheadline', 'ctaLine'],
    },
  },
  required: ['recipe', 'photoIndexes', 'copy'],
} as const;

const responseContract = z.object({}).passthrough();

/** Exported for tests. Turns raw model output into a safe direction. */
export function sanitizeReelDirection(
  raw: Record<string, unknown>,
  photoCount: number
): ReelDirection {
  const seen = new Set<number>();
  const photoIndexes = (Array.isArray(raw.photoIndexes) ? raw.photoIndexes : []).filter(
    (value): value is number => {
      if (!Number.isInteger(value) || value < 0 || value >= photoCount || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    }
  );
  const copy = stripBannedCopy(raw.copy);
  const line = (key: string, words: number) =>
    typeof copy[key] === 'string' ? clampCopyText(copy[key] as string, { words, chars: 60 }) : '';
  return {
    recipe: REEL_RECIPES.includes(raw.recipe as ReelRecipe) ? (raw.recipe as ReelRecipe) : 'tour',
    photoIndexes,
    copy: {
      headline: line('headline', BEAT_WORDS),
      subheadline: line('subheadline', BEAT_WORDS),
      ctaLine: line('ctaLine', 4),
    },
  };
}

function buildUserParts(input: DirectReelInput): LlmPart[] {
  const facts = input.facts;
  const factLines = [
    `Property: ${facts.propertyName}`,
    facts.location ? `Location: ${facts.location}` : null,
    facts.amenities.length ? `Amenities: ${facts.amenities.slice(0, 20).join(', ')}` : null,
    facts.nightlyRate ? `Nightly rate from: ${facts.nightlyRate}` : null,
  ].filter(Boolean);
  const parts: LlmPart[] = [
    {
      text: [
        wrapUntrusted('property_facts', factLines.join('\n'), 1_500),
        input.prompt
          ? `Host request:\n${wrapUntrusted('host_prompt', input.prompt, 500)}`
          : 'Host request: none, show the place at its best.',
        `Photos attached: ${input.photos.length} (photo 0 is the first image below).`,
      ].join('\n\n'),
    },
  ];
  input.photos.forEach((photo, index) => {
    parts.push(
      { text: `Photo ${index}:` },
      { inlineData: { mimeType: photo.mimeType, data: photo.data } }
    );
  });
  return parts;
}

/** The model call itself, with explicit billing (callers own quota checks). */
export async function directReel(
  input: DirectReelInput,
  billing: LlmBilling
): Promise<ReelDirection> {
  const result = await generateStructured({
    feature: FEATURE,
    prompt: REEL_DIRECTOR_PROMPT,
    system: SYSTEM_PROMPT,
    user: buildUserParts(input),
    temperature: 0.6,
    maxOutputTokens: 1_000,
    schema: responseContract,
    jsonSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    billing,
  });
  return sanitizeReelDirection(result.data as Record<string, unknown>, input.photos.length);
}

export async function generateReelDirection(input: DirectReelInput): Promise<ReelDirection> {
  await assertOrgAndPropertyAiQuota(input.organizationId, input.propertyId, FEATURE);
  return directReel(input, {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? 'staff',
    quotaChecked: true,
  });
}
