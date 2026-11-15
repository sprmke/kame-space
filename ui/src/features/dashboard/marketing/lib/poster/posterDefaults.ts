import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  copyContext,
  pickPosterCopy,
} from '@/features/dashboard/marketing/lib/poster/posterCopyLibrary';
import { isDistinctiveAmenity } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import {
  normalizePosterSpec,
  type PosterArchetypeId,
  type PosterFacts,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Rule-based poster specs. Used when the AI director is unavailable, fails, or
 * returns fewer variants than asked, so "Generate" always yields finished posters.
 * Copy here is deliberately plain and fact-based; the director writes the voice.
 */

export const POSTER_GOAL_ARCHETYPES: Record<PosterGoal, PosterArchetypeId[]> = {
  // The first four are the default batch; later ids are the other families' fits.
  vibe: ['photo-first', 'sky-headline', 'magazine-cover', 'framed-editorial', 'arch-frame', 'split-panel'],
  promo: ['info-card', 'sky-headline', 'night-glass', 'feature-sticker', 'quote-card', 'split-panel', 'photo-first'],
  'amenity-spotlight': ['feature-sticker', 'framed-editorial', 'wave-duo', 'photo-first', 'trio-grid', 'duo-collage'],
  'feature-spotlight': ['photo-first', 'feature-sticker', 'magazine-cover', 'big-type', 'arch-frame'],
  'stay-info': ['info-card', 'sky-headline', 'night-glass', 'framed-editorial', 'split-panel'],
};

function shortAmenity(label: string): string {
  return label
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .split(/[/&]/)[0]!
    .trim();
}

function baseCopy(facts: PosterFacts, goal: PosterGoal, index: number) {
  const iconRow = facts.amenities.slice(0, 4);
  const place = facts.location?.split(',')[0]?.trim() || null;
  const distinctive = facts.amenities.find(isDistinctiveAmenity);
  const copy = pickPosterCopy(
    goal,
    copyContext(facts, distinctive ? shortAmenity(distinctive) : null),
    index
  );
  // Chips add what the icon row does not say: the place, the rate, then extra amenities.
  const chips = [
    place,
    facts.nightlyRate ? `${facts.nightlyRate} / night` : null,
    ...facts.amenities.slice(iconRow.length).map(shortAmenity),
  ]
    .filter((chip): chip is string => Boolean(chip))
    .slice(0, 3);
  return { ...copy, chips };
}

const HERO_POOL = 3;

/** Hero and second photo for variant `index`, rotating through the top few ranked photos. */
export function heroPhotoIndexes(photoCount: number, index: number): number[] {
  if (photoCount <= 0) return [];
  const pool = Math.min(photoCount, HERO_POOL);
  const hero = index % pool;
  const second = (index + 1) % pool;
  return second === hero ? [hero] : [hero, second];
}

/** Multi-photo layouts want two or three distinct photos, best first. */
const PHOTOS_WANTED: Partial<Record<PosterArchetypeId, number>> = {
  'duo-collage': 2,
  'trio-grid': 3,
};

export function photoIndexesFor(
  archetype: PosterArchetypeId,
  photoCount: number,
  index: number
): number[] {
  const wanted = PHOTOS_WANTED[archetype];
  if (!wanted || photoCount <= 1) return heroPhotoIndexes(photoCount, index);
  return Array.from({ length: Math.min(wanted, photoCount) }, (_, i) => i);
}

export function buildRuleBasedPosterSpecs(
  facts: PosterFacts,
  goal: PosterGoal,
  options?: { accent?: string | null; count?: number }
): PosterSpec[] {
  const archetypes = POSTER_GOAL_ARCHETYPES[goal].slice(0, options?.count ?? 4);
  return archetypes.map((archetype, index) =>
    normalizePosterSpec(
      {
        archetype,
        fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
        goal,
        palette: { accent: options?.accent ?? null },
        copy: baseCopy(facts, goal, index),
        // Photos arrive ranked best-first: rotate heroes through the top few only, so a
        // weak shot never leads a variant just to avoid repeating a strong one.
        photoIndexes: photoIndexesFor(archetype, facts.photos.length, index),
        label: `${facts.propertyName} poster`,
      },
      facts
    )
  );
}
