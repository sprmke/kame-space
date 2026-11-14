import { describe, expect, it } from 'vitest';

import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  POSTER_GOAL_ARCHETYPES,
  buildRuleBasedPosterSpecs,
  heroPhotoIndexes,
} from '@/features/dashboard/marketing/lib/poster/posterDefaults';
import {
  POSTER_ARCHETYPE_IDS,
  POSTER_GOALS,
  posterSpecVersion,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
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
      expect(spec.version).toBe(posterSpecVersion(spec.archetype));
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

  it('writes fact-based copy: place and rate chips that do not repeat the icon row', () => {
    const specs = buildRuleBasedPosterSpecs(FACTS, 'vibe');

    for (const spec of specs) {
      expect(spec.copy.chips).toEqual(['Azure North', '₱4,500 / night']);
      const iconLabels = spec.features.map((feature) => feature.label.toLowerCase());
      for (const chip of spec.copy.chips) expect(iconLabels).not.toContain(chip.toLowerCase());
    }
    expect(specs.some((spec) => spec.copy.headline === 'Monaco 2604')).toBe(true);
  });

  it('gives four variants four different taglines', () => {
    const specs = buildRuleBasedPosterSpecs(FACTS, 'vibe');
    expect(new Set(specs.map((spec) => spec.copy.tagline)).size).toBe(4);
  });

  it('falls back to generic copy without a location or amenities', () => {
    const specs = buildRuleBasedPosterSpecs(
      { ...FACTS, location: null, nightlyRate: null, amenities: [], photos: [] },
      'vibe'
    );

    for (const spec of specs) {
      expect(spec.copy.chips).toEqual([]);
      expect(Object.values(spec.copy).join(' ')).not.toMatch(/undefined|null|\{|\}/);
    }
  });

  it('names the featured amenity in a feature spotlight', () => {
    const specs = buildRuleBasedPosterSpecs(FACTS, 'feature-spotlight');
    expect(specs.some((spec) => /pool/i.test(spec.copy.headline))).toBe(true);
  });

  it('does not invent an offer for a promo', () => {
    const noRate = buildRuleBasedPosterSpecs({ ...FACTS, nightlyRate: null }, 'promo');
    for (const spec of noRate) {
      const text = Object.values(spec.copy).join(' ').toLowerCase();
      expect(text).not.toMatch(/save|discount|\d|off\b|free/);
    }
  });

  it('passes an accent through, and drops a malformed one', () => {
    expect(buildRuleBasedPosterSpecs(FACTS, 'vibe', { accent: '#b86a2c' })[0]!.palette.accent).toBe(
      '#b86a2c'
    );
    expect(
      buildRuleBasedPosterSpecs(FACTS, 'vibe', { accent: 'orange' })[0]!.palette.accent
    ).toBeNull();
  });
});

describe('heroPhotoIndexes', () => {
  it('returns nothing without photos', () => {
    expect(heroPhotoIndexes(0, 0)).toEqual([]);
  });

  it('uses a single photo once, never twice', () => {
    expect(heroPhotoIndexes(1, 0)).toEqual([0]);
    expect(heroPhotoIndexes(1, 3)).toEqual([0]);
  });

  it('rotates heroes through the top three only', () => {
    const heroes = [0, 1, 2, 3, 4, 5].map((i) => heroPhotoIndexes(9, i)[0]);
    expect(heroes).toEqual([0, 1, 2, 0, 1, 2]);
    expect(Math.max(...heroes.map((h) => h!))).toBeLessThan(3);
  });

  it('gives four variants at least two different heroes when two photos exist', () => {
    const heroes = new Set([0, 1, 2, 3].map((i) => heroPhotoIndexes(2, i)[0]));
    expect(heroes.size).toBe(2);
  });
});
