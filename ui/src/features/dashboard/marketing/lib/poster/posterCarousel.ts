import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { buildRuleBasedPosterSpecs } from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import { isDistinctiveAmenity } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { type PosterStyleChoice } from '@/features/dashboard/marketing/lib/poster/posterQuickEdit';
import {
  normalizePosterSpec,
  type PosterArchetypeId,
  type PosterFacts,
  type PosterGoal,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Carousel: one set of slides in one style, swiped in order. Cover, the amenities,
 * the standout feature (only when the listing has one), stay info and a closing
 * offer or booking slide. Rule-based and free: facts and the copy library only.
 */

export const CAROUSEL_MAX_SLIDES = 5;

export type CarouselSlide = { role: 'cover' | 'amenities' | 'feature' | 'stay-info' | 'closing'; spec: PosterSpec };

const SLIDE_GOALS: Array<{ role: CarouselSlide['role']; goal: PosterGoal }> = [
  { role: 'cover', goal: 'vibe' },
  { role: 'amenities', goal: 'amenity-spotlight' },
  { role: 'feature', goal: 'feature-spotlight' },
  { role: 'stay-info', goal: 'stay-info' },
  { role: 'closing', goal: 'promo' },
];

/** Layouts that suit a slide of this role, per family, best first. */
const FAMILY_LAYOUTS: Record<'clean' | 'lifestyle' | 'flyer', Record<CarouselSlide['role'], PosterArchetypeId[]>> = {
  clean: {
    cover: ['photo-first', 'split-panel'],
    amenities: ['framed-editorial', 'split-panel'],
    feature: ['big-type', 'photo-first'],
    'stay-info': ['info-card'],
    closing: ['quote-card', 'info-card'],
  },
  lifestyle: {
    cover: ['arch-frame', 'duo-collage'],
    amenities: ['trio-grid', 'duo-collage'],
    feature: ['arch-frame'],
    'stay-info': ['duo-collage', 'info-card'],
    closing: ['arch-frame', 'quote-card'],
  },
  flyer: {
    cover: ['magazine-cover', 'sky-headline'],
    amenities: ['feature-sticker', 'wave-duo'],
    feature: ['feature-sticker'],
    'stay-info': ['sky-headline', 'night-glass'],
    closing: ['night-glass', 'sky-headline'],
  },
};

/** The family a carousel is made in: `auto` is Clean, the safest across any photos. */
export function carouselFamily(choice: PosterStyleChoice): 'clean' | 'lifestyle' | 'flyer' {
  return choice === 'auto' ? 'clean' : choice;
}

export function buildCarouselSpecs(
  facts: PosterFacts,
  choice: PosterStyleChoice = 'auto',
  options: { accent?: string | null } = {}
): CarouselSlide[] {
  const family = carouselFamily(choice);
  const hasFeature = facts.amenities.some(isDistinctiveAmenity);
  const hasStay = Boolean(facts.checkIn || facts.checkOut);
  const goals = SLIDE_GOALS.filter(({ role }) => {
    if (role === 'feature') return hasFeature;
    if (role === 'stay-info') return hasStay;
    return true;
  });
  const used = new Set<PosterArchetypeId>();
  return goals.slice(0, CAROUSEL_MAX_SLIDES).map(({ role, goal }, slide) => {
    const options_ = FAMILY_LAYOUTS[family][role];
    // Distinct layouts across the set where the family allows; a repeat is fine after that.
    const archetype = options_.find((id) => !used.has(id)) ?? options_[0]!;
    used.add(archetype);
    // A different hero photo per slide: the rule-based builder rotates by index.
    const [base] = buildRuleBasedPosterSpecs(facts, goal, { accent: options.accent ?? null, count: 1 });
    const spec = normalizePosterSpec(
      {
        ...base,
        archetype,
        fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
        goal,
        photoIndexes: heroRotation(facts.photos.length, slide, archetype),
        label: `${facts.propertyName} ${role}`,
      },
      facts
    );
    return { role, spec };
  });
}

function heroRotation(count: number, slide: number, archetype: PosterArchetypeId): number[] {
  if (count <= 0) return [];
  const wanted = archetype === 'trio-grid' ? 3 : archetype === 'duo-collage' ? 2 : 1;
  const hero = slide % count;
  return Array.from({ length: Math.min(wanted, count) }, (_, i) => (hero + i) % count);
}

