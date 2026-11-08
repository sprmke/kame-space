import { describe, expect, it } from 'vitest';

import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  POSTER_GOAL_ARCHETYPES,
  buildRuleBasedPosterSpecs,
} from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import { POSTER_ARCHETYPE_IDS, POSTER_GOALS } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { PosterFacts } from '@/features/dashboard/marketing/lib/poster/posterSpec';

const FACTS: PosterFacts = {
  propertyName: 'Monaco 2604',
  brandName: 'Kame Space',
  location: 'Azure North, Pampanga',
  checkIn: '2:00 PM',
  checkOut: '12:00 PM',
  securityDeposit: '₱2,000',
  nightlyRate: '₱4,500',
  amenities: ['Pool (Shared)', 'Free WiFi', 'Coffee / Espresso Maker', 'Netflix'],
  logoUrl: null,
  photos: ['https://img.test/a.jpg', 'https://img.test/b.jpg', 'https://img.test/c.jpg'],
};

describe('POSTER_GOAL_ARCHETYPES', () => {
  it('covers every goal with valid, distinct archetypes', () => {
    expect(Object.keys(POSTER_GOAL_ARCHETYPES).sort()).toEqual([...POSTER_GOALS].sort());

    for (const goal of POSTER_GOALS) {
      const archetypes = POSTER_GOAL_ARCHETYPES[goal];
      expect(archetypes.length).toBeGreaterThan(0);
      expect(new Set(archetypes).size).toBe(archetypes.length);
      for (const archetype of archetypes) {
        expect(POSTER_ARCHETYPE_IDS).toContain(archetype);
      }
    }
  });

  it('has a default font pairing for every archetype', () => {
    for (const archetype of POSTER_ARCHETYPE_IDS) {
      expect(POSTER_ARCHETYPE_DEFAULT_FONTS[archetype]).toBeTruthy();
    }
  });
});

describe('buildRuleBasedPosterSpecs', () => {
  it('returns four finished variants by default', () => {
    const specs = buildRuleBasedPosterSpecs(FACTS, 'vibe');

    expect(specs).toHaveLength(4);
    for (const spec of specs) {
      expect(spec.version).toBe(1);
      expect(spec.goal).toBe('vibe');
      expect(spec.label).toBe('Monaco 2604 poster');
      expect(spec.fontPairing).toBe(POSTER_ARCHETYPE_DEFAULT_FONTS[spec.archetype]);
    }
  });

  it('honours a smaller count', () => {
    expect(buildRuleBasedPosterSpecs(FACTS, 'promo', { count: 2 })).toHaveLength(2);
  });

  it('rotates the hero photo across variants', () => {
    const specs = buildRuleBasedPosterSpecs(FACTS, 'vibe');

    expect(specs.map((spec) => spec.photoIndexes)).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
      [0, 1],
    ]);
  });

  it('leaves photo indexes empty when there are no photos', () => {
    const specs = buildRuleBasedPosterSpecs({ ...FACTS, photos: [] }, 'stay-info');

    expect(specs.every((spec) => spec.photoIndexes.length === 0)).toBe(true);
  });

  it('writes fact-based copy: place, amenity chips and a badge', () => {
    const [spec] = buildRuleBasedPosterSpecs(FACTS, 'vibe');

    expect(spec!.copy.headline).toBe('Monaco 2604');
    expect(spec!.copy.accent).toBe('Azure North Staycation');
    expect(spec!.copy.subhead).toContain('Azure North');
    expect(spec!.copy.chips).toEqual(['Pool', 'Free WiFi', 'Coffee']);
    expect(spec!.copy.badge).toBe('Pool for your stay');
    expect(spec!.copy.cta).toBe('Book your stay');
  });

  it('falls back to generic copy without a location or amenities', () => {
    const [spec] = buildRuleBasedPosterSpecs(
      { ...FACTS, location: null, amenities: [], photos: [] },
      'vibe'
    );

    expect(spec!.copy.accent).toBe('Your Staycation');
    expect(spec!.copy.subhead).toBe('A cozy stay, ready when you are.');
    expect(spec!.copy.chips).toEqual([]);
    expect(spec!.copy.badge).toBe('Book direct');
  });

  it('names the featured amenity in a feature spotlight', () => {
    const [spec] = buildRuleBasedPosterSpecs(FACTS, 'feature-spotlight');

    expect(spec!.copy.headline).toBe('Pool included');
    expect(spec!.copy.eyebrow).toBe('Level up your stay');
  });

  it('passes an accent through, and drops a malformed one', () => {
    expect(buildRuleBasedPosterSpecs(FACTS, 'vibe', { accent: '#b86a2c' })[0]!.palette.accent).toBe(
      '#b86a2c'
    );
    expect(buildRuleBasedPosterSpecs(FACTS, 'vibe', { accent: 'orange' })[0]!.palette.accent).toBeNull();
  });
});
