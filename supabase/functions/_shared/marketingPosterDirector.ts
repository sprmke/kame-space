/**
 * AI art director for Marketing Studio posters
 * (docs/workflow/in-progress/marketing-ai-poster-studio.md, Phases 3–4).
 *
 * One multimodal call: the model *sees* the property's real photos, reads the fact
 * pack and the host's request, and returns N PosterSpecs (archetype, type system,
 * palette, short copy, which photos, which amenities). It never places elements and
 * never renders text into pixels: the UI compiles each spec into an editable Polotno
 * design with ui/src/features/dashboard/marketing/lib/poster/posterCompiler.ts.
 *
 * Enums below mirror ui/.../lib/poster/posterSpec.ts + posterFonts.ts. The UI's
 * normalizePosterSpec is the final authority; this module only enforces the rules
 * that need server context (photo allow-list, no invented amenities).
 */

import { z } from 'zod';

import { generateStructured, type LlmBilling, type LlmPart } from './ai/llmClient.ts';
import { definePrompt } from './ai/prompt.ts';
import { withUntrustedDataRule, wrapUntrusted } from './ai/untrusted.ts';
import { assertOrgAndPropertyAiQuota, type AiActorType } from './aiUsageService.ts';
import { findBrandGuardViolation } from './marketingTrends/brandGuard.ts';
import { buildTrendPromptBlock, type TrendContext } from './marketingTrends/trendContext.ts';

const FEATURE = 'marketing_template' as const;

export const POSTER_DIRECTOR_PROMPT = definePrompt({
  id: 'marketing_template_poster',
  version: '2026-11-13.3',
});

export const POSTER_ARCHETYPES = [
  'wave-duo',
  'sky-headline',
  'night-glass',
  'minimal-title',
  'magazine-cover',
  'feature-sticker',
  'photo-first',
  'framed-editorial',
  'big-type',
  'info-card',
  'split-panel',
  'quote-card',
  'arch-frame',
  'duo-collage',
  'trio-grid',
] as const;

export const POSTER_FONT_PAIRINGS = [
  'cozy-cafe',
  'tropical-script',
  'night-brush',
  'editorial-calm',
  'magazine-cover',
  'playful-pop',
  'modern-minimal',
  'sunny-weekend',
] as const;

export const POSTER_GOALS = [
  'vibe',
  'promo',
  'amenity-spotlight',
  'feature-spotlight',
  'stay-info',
] as const;

export type PosterGoal = (typeof POSTER_GOALS)[number];

/** Director-facing catalog: what each archetype is for and how much copy it holds. */
const ARCHETYPE_GUIDE = `
- wave-duo: cream brand field, two photos in organic wave frames, chunky name + script subtitle, 3 chips, 3 amenity icons, location pill. Best for cozy condos / everyday vibe. headline ≤ 3 words and ≤ 22 chars.
- sky-headline: full-bleed photo with calm sky or wall at the top; tracked eyebrow, one huge script word, bold caps line, banner, 5 icons and a check-in / check-out / deposit bar. Best for resorts, pools, stay info. accent = ONE word ≤ 14 chars (e.g. "Bali"); headline ≤ 30 chars.
- night-glass: dusk/night or moody photo darkened; script hero word in warm gold, frosted card with one descriptive sentence, icon grid, check-in card, location. Best for evening pool / lights shots. headline ≤ 3 words and ≤ 20 chars, accent ≤ 2 words, subhead ≤ 14 words.
- minimal-title: photo with only a refined serif title and a tracked subtitle. Best for beautiful rooms that should speak for themselves. headline ≤ 4 words.
- magazine-cover: big serif word + oversized script word ("Slow" / "mornings"), "at BRAND" wordmark, glass strip of 3–4 amenities. Best for bedroom / morning light shots. headline 1 word (≤ 14 chars), accent 1–2 words (≤ 20 chars).
- feature-sticker: two-tone chunky headline split in two halves ("Game on," / "stay in!"), circular sticker badge, "Perfect for" card with 4 use cases, script sign-off. Best for one standout amenity (PS5, jacuzzi, projector). headline 3–5 words with a natural break.
- photo-first: the photo fills the post; one headline, one short sentence and a facts line on a soft bottom shade. The clean default for strong photos. headline ≤ 5 words, no accent word.
- framed-editorial: photo in a frame on a paper field with the headline beneath. Safe on any photo. headline ≤ 5 words.
- big-type: very large headline on paper above a rounded photo. Best for short, punchy headlines. headline ≤ 3 words.
- info-card: photo above, a paper card with the headline and check-in, check-out and deposit. Best for stay info and promo. headline ≤ 5 words.
- split-panel: the photo bleeds off the top edge and a paper panel below holds the headline, one sentence and a facts line. Clean on any photo. headline ≤ 5 words.
- quote-card: a centered headline set like a pull quote on paper with a small accent rule and a photo band beneath. Best for one warm line about the stay. headline ≤ 4 words.
- arch-frame: one photo in a tall arch on paper, centered headline beneath. Lifestyle look for a single strong portrait or interior. headline ≤ 4 words.
- duo-collage: two photos side by side (the second a little lower) on paper, headline beneath. Needs two good photos. headline ≤ 5 words.
- trio-grid: one large photo and two small on paper, headline beneath. Needs three good photos. headline ≤ 5 words.`;

const FONT_GUIDE = `
- cozy-cafe: Fredoka chunky caps + Allura script (warm, cute, homey)
- tropical-script: Montserrat caps + Great Vibes script (resort, elegant)
- night-brush: Montserrat + Kaushan brush script (evening, bold)
- editorial-calm: Cormorant serif caps + Jost tracked caps (calm, premium, minimal)
- magazine-cover: Playfair + Sacramento script (soft editorial)
- playful-pop: Lilita One outlined caps + Kaushan (fun, games, families)
- modern-minimal: DM Serif Display + Montserrat (clean modern)
- sunny-weekend: Baloo chunky + Great Vibes (bright, friendly)`;

const SYSTEM_PROMPT = withUntrustedDataRule(
  [
    'You are the art director for a vacation-rental marketing tool. You design Instagram and',
    'Facebook posts for one real property, choosing from fixed, hand-designed layouts. A',
    'separate engine renders your choices; you never describe coordinates.',
    '',
    'Look at the attached photos (numbered in order) before deciding anything:',
    '- Pick photoIndexes, hero first. Prefer sharp, bright, well-composed shots that match the goal.',
    '  sky-headline, minimal-title and photo-first need calm space (sky, wall, ceiling) at the top of the hero.',
    '  night-glass suits evening or moody shots. wave-duo uses two different photos.',
    '- Palette: pick accent/secondary/field hexes that harmonize with the hero photo and the',
    '  brand color. Field is a light paper tone (cream, sand, blush). Accent carries pills and',
    '  icons, so it must be mid-dark. Secondary is a second real hue sampled from the photo',
    '  (leaf green, pool teal, terracotta, dusk navy), never gray or black. Avoid neon.',
    '- Use different hero photos across variants when more than one photo suits the goal.',
    '',
    '- Photos arrive ranked by technical quality, best first (0 is the strongest). Keep the',
    '  hero at 0 or 1 unless a layout needs a calm top that another photo has.',
    '',
    'Layouts (each lists its hard character budget; the engine trims anything longer):',
    ARCHETYPE_GUIDE,
    '',
    'Type systems:',
    FONT_GUIDE,
    '',
    'Copy rules (strict):',
    '- Short, warm, specific, human. Sound like a boutique host, not an ad bot. Anchor copy in',
    '  what is visible in the photos (the view, the light, the coffee, the pool) and the host',
    '  request, so the post could only be about this place.',
    '- Banned generic phrases: "sweet escape", "home away from home", "your home away",',
    '  "experience comfort", "ultimate comfort", "perfect getaway", "luxury awaits",',
    '  "unwind in luxury", "look no further", "book now" (prefer "Book your stay").',
    '- eyebrow ≤ 5 words, headline ≤ 5 words (respect each layout limit), accent ≤ 4 words,',
    '  subhead one sentence ≤ 18 words, chips exactly 3 items of 1–2 words, tagline ≤ 8 words',
    '  (rhythmic, e.g. "Sip slow. Breathe deep."), cta ≤ 4 words, badge ≤ 6 words, listTitle ≤ 3 words.',
    '- Never use em dashes or en dashes. No emojis. No hashtags. No exclamation spam (max one).',
    '- Never invent facts: no prices, discounts, dates, times, amenities or places that are not in',
    '  the property facts or the host request. Check-in times, deposit and location are printed by',
    '  the engine from facts, so do not repeat them in copy.',
    '- features: amenity labels copied from the facts list, or a use case for feature-sticker',
    '  ("Family bonding", "Game nights"). Keep each 1–3 words.',
    '- Match the host language. Taglish is fine when the host writes that way.',
    '',
    'Copy examples. Good: "Slow mornings" / "Coffee on the balcony" / "Sip slow. Breathe deep."',
    '(specific, visible in the photo, rhythmic). Bad: "Experience the ultimate stay" / "Your perfect',
    'getaway awaits" / "Book now and save" (generic, hype, invented offer).',
    'Chips are small facts or moods ("Sea view", "Pet friendly"), never the same words as the',
    'features list.',
    '',
    'Return exactly the requested number of variants. Each variant must use a different',
    'archetype and a different hero photo when more than one fits, and vary the type system, so',
    'the host gets real choices. At least one variant must be a Clean layout (photo-first, framed-editorial, big-type, info-card, split-panel, quote-card or minimal-title; arch-frame, duo-collage and trio-grid are the Lifestyle family).',
  ].join('\n')
);

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    variants: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          archetype: { type: 'STRING', enum: [...POSTER_ARCHETYPES] },
          fontPairing: { type: 'STRING', enum: [...POSTER_FONT_PAIRINGS] },
          palette: {
            type: 'OBJECT',
            properties: {
              accent: { type: 'STRING' },
              secondary: { type: 'STRING' },
              field: { type: 'STRING' },
            },
            required: ['accent', 'secondary', 'field'],
          },
          copy: {
            type: 'OBJECT',
            properties: {
              eyebrow: { type: 'STRING' },
              headline: { type: 'STRING' },
              accent: { type: 'STRING' },
              subhead: { type: 'STRING' },
              chips: { type: 'ARRAY', items: { type: 'STRING' } },
              tagline: { type: 'STRING' },
              cta: { type: 'STRING' },
              badge: { type: 'STRING' },
              listTitle: { type: 'STRING' },
            },
            required: ['eyebrow', 'headline', 'accent', 'subhead', 'chips', 'tagline', 'cta'],
          },
          features: { type: 'ARRAY', items: { type: 'STRING' } },
          photoIndexes: { type: 'ARRAY', items: { type: 'INTEGER' } },
          label: { type: 'STRING' },
        },
        required: ['archetype', 'fontPairing', 'palette', 'copy', 'features', 'photoIndexes'],
      },
    },
  },
  required: ['variants'],
} as const;

const responseContract = z
  .object({ variants: z.array(z.record(z.unknown())).min(1) })
  .passthrough();

export type PosterFactsInput = {
  propertyName: string;
  brandName: string | null;
  location: string | null;
  checkIn: string | null;
  checkOut: string | null;
  securityDeposit: string | null;
  nightlyRate: string | null;
  amenities: string[];
  /** Promo only: what the host typed. The one source of any discount wording. */
  offer?: PosterOfferInput | null;
};

export type PosterOfferInput = { text: string; validUntil: string | null; code: string | null };

/** Today on the Manila calendar, `YYYY-MM-DD`. */
export function manilaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Mirror of the UI's `sanitizePosterOffer` (posterOffer.ts): text up to 7 words and 51
 * characters, a real date that is not past, a plain voucher code. Anything else is
 * dropped, so a hand-made request cannot print an expired or malformed offer.
 */
export function readPosterOffer(
  raw: unknown,
  today: string = manilaToday()
): PosterOfferInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  if (typeof source.text !== 'string') return null;
  const text = source.text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,;:\s]+$/, '');
  if (!text || text.split(' ').length > 7 || text.length > 51) return null;
  let validUntil: string | null = null;
  if (typeof source.validUntil === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source.validUntil.trim());
    if (match) {
      const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const date = new Date(Date.UTC(y, m - 1, d));
      if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) {
        validUntil = `${match[1]}-${match[2]}-${match[3]}`;
      }
    }
  }
  if (validUntil && validUntil < today) return null;
  const code = typeof source.code === 'string' ? source.code.trim().toUpperCase() : '';
  return { text, validUntil, code: /^[A-Z0-9][A-Z0-9-]{2,15}$/.test(code) ? code : null };
}

const INVENTED_OFFER =
  /\d+\s?%|%\s?off|\bdiscount|\bsale\b|promo code|\bsave\b|\bsavings\b|\bdeal\b|\bfree (night|stay|breakfast)|limited time|bogo/i;

/** With no host offer, copy that talks about a deal is blanked, never printed. */
export function stripInventedOffers(copy: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(copy)) {
    if (typeof value === 'string') out[key] = INVENTED_OFFER.test(value) ? '' : value;
    else if (Array.isArray(value)) {
      out[key] = value.filter((item) => typeof item !== 'string' || !INVENTED_OFFER.test(item));
    } else out[key] = value;
  }
  return out;
}

function offerLines(input: GeneratePosterSpecsInput): string[] {
  if (input.goal !== 'promo' || input.revise) return [];
  const offer = input.facts.offer;
  if (!offer) {
    return [
      'No offer was given. Do not mention discounts, percentages, savings, deals, free extras or limited time anywhere. Lead with the place, the rate and booking direct.',
    ];
  }
  return [
    `The host's offer (print it word for word as the headline or subhead on every variant; do not change it or add any other terms):\n${wrapUntrusted('host_offer', offer.text, 120)}`,
    offer.validUntil ? `Offer valid until: ${offer.validUntil}` : null,
    offer.code ? `Voucher code: ${offer.code}` : null,
  ].filter((line): line is string => Boolean(line));
}

export type PosterPhotoInput = { url: string; mimeType: string; data: string };

export type GeneratePosterSpecsInput = {
  organizationId: string;
  propertyId: string;
  actorUserId?: string | null;
  actorType?: AiActorType;
  goal: PosterGoal;
  prompt: string;
  facts: PosterFactsInput;
  brandColor: string | null;
  /** Already allow-listed and fetched (see loadPosterPhotos). Index = photoIndexes. */
  photos: PosterPhotoInput[];
  count: number;
  /**
   * AI Studio refinement: the post the host is looking at plus what to change. The
   * model returns one variant that applies the change and keeps the rest.
   */
  revise?: { spec: Record<string, unknown>; instruction: string } | null;
  /** AI Studio example: the layout the host picked; one variant uses it and comes first. */
  preferredArchetype?: PosterArchetype | null;
  /** Marketing Trends topic the host picked (loaded by the caller, never by the client). */
  trendContext?: TrendContext | null;
};

export type PosterArchetype = (typeof POSTER_ARCHETYPES)[number];

/** A known archetype id, or null. Unknown values are dropped, never a 400. */
export function readPreferredArchetype(value: unknown): PosterArchetype | null {
  return typeof value === 'string' && (POSTER_ARCHETYPES as readonly string[]).includes(value)
    ? (value as PosterArchetype)
    : null;
}

/** Director instruction for the picked layout (new batches only, not refinements). */
export function preferredArchetypeLine(input: GeneratePosterSpecsInput): string | null {
  if (input.revise || !input.preferredArchetype) return null;
  return `Variant 1 must use the "${input.preferredArchetype}" archetype (the host picked this layout). The others use different archetypes.`;
}

/** Moves the first variant in the picked archetype to the front; order otherwise unchanged. */
export function preferArchetypeFirst<T extends Record<string, unknown>>(
  variants: T[],
  archetype: PosterArchetype | null | undefined
): T[] {
  if (!archetype) return variants;
  const index = variants.findIndex((variant) => variant.archetype === archetype);
  if (index <= 0) return variants;
  return [variants[index]!, ...variants.slice(0, index), ...variants.slice(index + 1)];
}

/** Fields of the current post the model needs to revise it (no coordinates exist). */
export function revisableSpec(spec: Record<string, unknown>): Record<string, unknown> {
  const pick = ['archetype', 'fontPairing', 'palette', 'copy', 'features', 'photoIndexes', 'label'];
  return Object.fromEntries(pick.filter((key) => key in spec).map((key) => [key, spec[key]]));
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9+]+/i)
    .filter((word) => word.length > 2);
}

/**
 * Server-side grounding: an amenity-like feature survives only when it matches a stored
 * amenity or something the host typed. Use-case labels on feature-sticker ("Game nights")
 * are allowed because they describe who the stay is for, not a claim about the unit.
 */
export function groundPosterFeatures(
  features: unknown,
  archetype: unknown,
  facts: PosterFactsInput,
  hostPrompt: string
): string[] {
  if (!Array.isArray(features)) return [];
  const known = new Set([...facts.amenities.flatMap(words), ...words(hostPrompt)]);
  return features
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 40))
    .filter((label) => {
      if (archetype === 'feature-sticker') return true;
      return words(label).some((word) => known.has(word));
    })
    .slice(0, 7);
}

/** Enforced, not just requested: the model drifts back to stock hospitality phrases. */
/** Per-layout copy budgets (words, characters). A slot the layout cannot hold is trimmed, never rendered tiny. */
export type CopyBudget = { words: number; chars: number };
export const LAYOUT_COPY_LIMITS: Record<
  PosterArchetype,
  Partial<
    Record<
      'eyebrow' | 'headline' | 'accent' | 'subhead' | 'tagline' | 'cta' | 'badge' | 'listTitle',
      CopyBudget
    >
  >
> = {
  'wave-duo': { headline: { words: 3, chars: 22 }, accent: { words: 3, chars: 24 } },
  'sky-headline': { headline: { words: 5, chars: 30 }, accent: { words: 1, chars: 14 } },
  'night-glass': {
    headline: { words: 3, chars: 20 },
    accent: { words: 2, chars: 18 },
    subhead: { words: 14, chars: 90 },
  },
  'minimal-title': { headline: { words: 4, chars: 28 }, accent: { words: 4, chars: 30 } },
  'magazine-cover': { headline: { words: 1, chars: 14 }, accent: { words: 2, chars: 20 } },
  'feature-sticker': { headline: { words: 5, chars: 34 }, accent: { words: 3, chars: 24 } },
  'photo-first': { headline: { words: 5, chars: 32 }, subhead: { words: 14, chars: 90 } },
  'framed-editorial': { headline: { words: 5, chars: 32 }, subhead: { words: 14, chars: 90 } },
  'big-type': { headline: { words: 3, chars: 22 }, subhead: { words: 12, chars: 80 } },
  'info-card': { headline: { words: 5, chars: 32 }, subhead: { words: 12, chars: 80 } },
  'split-panel': { headline: { words: 5, chars: 32 }, subhead: { words: 14, chars: 90 } },
  'quote-card': { headline: { words: 4, chars: 28 }, subhead: { words: 12, chars: 80 } },
  'arch-frame': { headline: { words: 4, chars: 28 }, subhead: { words: 12, chars: 80 } },
  'duo-collage': { headline: { words: 5, chars: 32 }, subhead: { words: 14, chars: 90 } },
  'trio-grid': { headline: { words: 5, chars: 32 }, subhead: { words: 14, chars: 90 } },
};

/** Trims to the word and character budget without cutting a word in half. */
export function clampCopyText(value: string, budget: CopyBudget): string {
  const words = value.trim().split(/\s+/).filter(Boolean).slice(0, budget.words);
  let out = '';
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > budget.chars) break;
    out = next;
  }
  // A single over-long word is kept whole: the layout's own fitter will size it down.
  return (out || words[0] || '').replace(/[,;:\-\s]+$/, '');
}

export function clampCopyForLayout(
  copy: Record<string, unknown>,
  archetype: unknown
): Record<string, unknown> {
  const limits = POSTER_ARCHETYPES.includes(archetype as PosterArchetype)
    ? LAYOUT_COPY_LIMITS[archetype as PosterArchetype]
    : undefined;
  const out: Record<string, unknown> = { ...copy };
  for (const [key, budget] of Object.entries(limits ?? {})) {
    const value = out[key];
    if (typeof value === 'string' && budget) out[key] = clampCopyText(value, budget);
  }
  // Chips: at most three, one or two words each, no duplicates.
  if (Array.isArray(out.chips)) {
    const seen = new Set<string>();
    out.chips = out.chips
      .filter((chip): chip is string => typeof chip === 'string')
      .map((chip) => clampCopyText(chip, { words: 2, chars: 16 }))
      .filter((chip) => {
        const key = chip.toLowerCase();
        if (!chip || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }
  return out;
}

const BANNED_COPY =
  /sweet escape|home away|experience (true |ultimate )?comfort|ultimate comfort|perfect getaway|luxury awaits|unwind in luxury|look no further/i;

export function stripBannedCopy(copy: unknown): Record<string, unknown> {
  if (!copy || typeof copy !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(copy as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = BANNED_COPY.test(value) ? '' : value;
    else if (Array.isArray(value)) {
      out[key] = value.filter((item) => typeof item === 'string' && !BANNED_COPY.test(item));
    } else out[key] = value;
  }
  return out;
}

/** Exported for tests. */
export function sanitizeVariant(
  raw: Record<string, unknown>,
  input: GeneratePosterSpecsInput
): Record<string, unknown> {
  const photoIndexes = Array.isArray(raw.photoIndexes)
    ? raw.photoIndexes.filter(
        (value): value is number =>
          Number.isInteger(value) &&
          (value as number) >= 0 &&
          (value as number) < input.photos.length
      )
    : [];
  return {
    ...raw,
    goal: input.goal,
    copy: clampCopyForLayout(
      // A revision keeps whatever offer the post already carries.
      input.revise || input.facts.offer
        ? stripBannedCopy(raw.copy)
        : stripInventedOffers(stripBannedCopy(raw.copy)),
      raw.archetype
    ),
    features: groundPosterFeatures(raw.features, raw.archetype, input.facts, input.prompt).map(
      (label) => ({ label })
    ),
    photoIndexes,
  };
}

function buildUserParts(input: GeneratePosterSpecsInput): LlmPart[] {
  const facts = input.facts;
  const factLines = [
    `Property: ${facts.propertyName}`,
    facts.brandName ? `Brand: ${facts.brandName}` : null,
    facts.location ? `Location: ${facts.location}` : null,
    facts.amenities.length ? `Amenities: ${facts.amenities.slice(0, 20).join(', ')}` : null,
    facts.nightlyRate ? `Nightly rate from: ${facts.nightlyRate}` : null,
    input.brandColor ? `Brand color: ${input.brandColor}` : null,
  ].filter(Boolean);
  const parts: LlmPart[] = [
    {
      text: [
        `Goal: ${input.goal}`,
        `Variants to return: ${input.revise ? 1 : input.count}`,
        preferredArchetypeLine(input),
        wrapUntrusted('property_facts', factLines.join('\n'), 1_500),
        ...offerLines(input),
        input.prompt
          ? `Host request:\n${wrapUntrusted('host_prompt', input.prompt, 500)}`
          : 'Host request: none, choose the strongest angle for the goal.',
        input.trendContext
          ? `Marketing trend:\n${wrapUntrusted('trend_context', buildTrendPromptBlock(input.trendContext), 1_200)}`
          : null,
        ...(input.revise
          ? [
              `Current post (revise this one):\n${wrapUntrusted(
                'current_post',
                JSON.stringify(revisableSpec(input.revise.spec)),
                6_000
              )}`,
              `Change request:\n${wrapUntrusted('change_request', input.revise.instruction, 300)}`,
              'Return exactly 1 variant: the current post with the change applied. Keep the archetype, font pairing, palette, photos and every copy line the change does not touch. Same grounding rules: no invented amenities, prices or times.',
            ]
          : []),
        `Photos attached: ${input.photos.length} (photo 0 is the first image below).`,
      ]
        .filter(Boolean)
        .join('\n\n'),
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
/** Every copy line of a variant, joined, for the brand guard to read. */
function variantCopyText(variant: Record<string, unknown>): string {
  const copy = variant.copy;
  if (!copy || typeof copy !== 'object') return '';
  const parts: string[] = [];
  for (const value of Object.values(copy as Record<string, unknown>)) {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') parts.push(item);
    }
  }
  return parts.join(' ');
}

/**
 * Drops a variant whose copy breaks the brand guard (endorsement wording, a
 * person's name, a logo). A poster that suggests an endorsement is worse than
 * one fewer variant.
 */
export function dropBrandGuardViolations(
  variants: Array<Record<string, unknown>>,
  trendContext: TrendContext | null | undefined
): Array<Record<string, unknown>> {
  if (!trendContext) return variants;
  return variants.filter(
    (variant) => findBrandGuardViolation(variantCopyText(variant), trendContext.category) === null
  );
}

export async function directPosterSpecs(
  input: GeneratePosterSpecsInput,
  billing: LlmBilling
): Promise<Array<Record<string, unknown>>> {
  const result = await generateStructured({
    feature: FEATURE,
    prompt: POSTER_DIRECTOR_PROMPT,
    system: SYSTEM_PROMPT,
    user: buildUserParts(input),
    temperature: 0.7,
    // Four full specs run ~2.5k tokens; the feature default (1024) would truncate them.
    maxOutputTokens: 6_000,
    schema: responseContract,
    jsonSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    // Images make every request unique, so there is no response cache.
    billing,
  });
  return preferArchetypeFirst(
    dropBrandGuardViolations(
      result.data.variants
        .slice(0, input.revise ? 1 : input.count)
        .map((variant) => sanitizeVariant(variant, input)),
      input.trendContext
    ),
    input.revise ? null : input.preferredArchetype
  );
}

export async function generatePosterSpecs(
  input: GeneratePosterSpecsInput
): Promise<Array<Record<string, unknown>>> {
  await assertOrgAndPropertyAiQuota(input.organizationId, input.propertyId, FEATURE);
  return directPosterSpecs(input, {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? 'staff',
    quotaChecked: true,
  });
}

// ---------------------------------------------------------------------------
// Photo loading (allow-listed)
// ---------------------------------------------------------------------------

const PHOTO_FETCH_TIMEOUT_MS = 6_000;
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;
/**
 * Gemini rejects inline requests over ~20 MB, and base64 inflates bytes by 4/3, so the
 * photos in one call share a 12 MB raw budget. Photos past it are skipped in order.
 */
const PHOTO_TOTAL_BYTES = 12 * 1024 * 1024;
export const POSTER_MAX_PHOTOS = 6;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Every image URL stored on the property (gallery media + legacy images list). */
export function allowedPropertyPhotoUrls(settings: Record<string, unknown>): Set<string> {
  const urls = new Set<string>();
  if (Array.isArray(settings.media)) {
    for (const item of settings.media) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (row.type === 'video' || typeof row.url !== 'string') continue;
      if (row.url.trim()) urls.add(row.url.trim());
    }
  }
  if (Array.isArray(settings.images)) {
    for (const url of settings.images) {
      if (typeof url === 'string' && url.trim()) urls.add(url.trim());
    }
  }
  return urls;
}

/**
 * Where the server fetches a photo from, or null when it must not. Public https URLs
 * are fetched as is. On a local or preview stack, photos live on the project's own
 * Storage over plain http (`http://127.0.0.1:54321/storage/v1/...`, which the edge
 * container cannot reach); those are fetched through the project's own API origin.
 * Anything else over http is refused.
 */
export function posterPhotoFetchTarget(url: string, projectUrl: string | null): string | null {
  if (/^https:\/\//i.test(url)) return url;
  if (!projectUrl) return null;
  try {
    const photo = new URL(url);
    const project = new URL(projectUrl);
    if (photo.protocol !== 'http:') return null;
    if (!photo.pathname.startsWith('/storage/v1/')) return null;
    const sameHost = photo.host === project.host;
    const loopback = ['127.0.0.1', 'localhost'].includes(photo.hostname);
    if (!sameHost && !loopback) return null;
    return `${project.origin}${photo.pathname}${photo.search}`;
  } catch {
    return null;
  }
}

/**
 * Fetches the requested photos, but only URLs already stored on this property (so the
 * endpoint cannot be used to make the server fetch arbitrary URLs). Failed or oversized
 * photos are skipped; the returned `urls` keeps photoIndexes aligned with what the
 * model actually saw.
 */
export async function loadPosterPhotos(
  requested: string[],
  allowed: Set<string>,
  projectUrl: string | null = Deno.env.get('SUPABASE_URL') ?? null
): Promise<{ urls: string[]; photos: PosterPhotoInput[] }> {
  const candidates = [...new Set(requested.map((url) => url.trim()))]
    .filter((url) => allowed.has(url) && posterPhotoFetchTarget(url, projectUrl) !== null)
    .slice(0, POSTER_MAX_PHOTOS);
  const loaded = await Promise.all(
    candidates.map(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(posterPhotoFetchTarget(url, projectUrl) ?? url, {
          signal: controller.signal,
          redirect: 'follow',
        });
        const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim();
        if (!response.ok || !/^image\/(jpeg|png|webp)$/.test(mimeType)) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES) return null;
        return { url, mimeType, data: bytesToBase64(bytes) };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    })
  );
  const ok: PosterPhotoInput[] = [];
  let total = 0;
  for (const item of loaded) {
    if (!item) continue;
    const bytes = Math.floor((item.data.length * 3) / 4);
    if (total + bytes > PHOTO_TOTAL_BYTES) continue;
    total += bytes;
    ok.push(item);
  }
  return { urls: ok.map((item) => item.url), photos: ok };
}
