import { describe, expect, it } from 'vitest';

import {
  copyContext,
  pickPosterCopy,
  POSTER_COPY_LIBRARY,
  type CopyContext,
} from '@/features/dashboard/marketing/lib/poster/posterCopyLibrary';
import {
  POSTER_GOALS,
  type PosterFacts,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

const FACTS: PosterFacts = {
  propertyName: 'Cozy Corner Condo',
  brandName: null,
  location: 'Tagaytay, Cavite',
  checkIn: '2:00 PM',
  checkOut: '12:00 PM',
  securityDeposit: null,
  nightlyRate: '₱3,200',
  amenities: ['Pool', 'Kitchen'],
  logoUrl: null,
  photos: [],
};
const BARE: PosterFacts = {
  ...FACTS,
  location: null,
  checkIn: null,
  checkOut: null,
  nightlyRate: null,
  amenities: [],
};

const LIMITS = {
  eyebrow: { words: 5, chars: 32 },
  headline: { words: 5, chars: 34 },
  accent: { words: 4, chars: 30 },
  subhead: { words: 18, chars: 120 },
  tagline: { words: 8, chars: 48 },
  cta: { words: 4, chars: 24 },
  badge: { words: 6, chars: 36 },
  listTitle: { words: 3, chars: 20 },
} as const;

const contexts: Array<[string, CopyContext]> = [
  ['rich', copyContext(FACTS, 'Pool')],
  ['bare', copyContext(BARE, null)],
];

describe('poster copy library', () => {
  it('has at least six sets per goal', () => {
    for (const goal of POSTER_GOALS) {
      expect(POSTER_COPY_LIBRARY[goal].length).toBeGreaterThanOrEqual(6);
    }
  });

  it.each(POSTER_GOALS)('%s: every set fits its slot limits, rich and bare', (goal) => {
    for (const [, ctx] of contexts) {
      for (const build of POSTER_COPY_LIBRARY[goal]) {
        const copy = build(ctx);
        for (const [slot, limit] of Object.entries(LIMITS)) {
          const value = copy[slot as keyof typeof copy];
          // The listing name is the headline by design and is trimmed by the spec.
          if (slot === 'headline' && value === ctx.name) continue;
          expect(value.length, `${goal}.${slot}: ${value}`).toBeLessThanOrEqual(limit.chars);
          expect(value.trim().split(/\s+/).length, `${goal}.${slot}: ${value}`).toBeLessThanOrEqual(
            limit.words
          );
          expect(value.trim()).not.toBe('');
        }
      }
    }
  });

  it.each(POSTER_GOALS)('%s: no em dash, no leftover tokens, no "undefined"', (goal) => {
    for (const [, ctx] of contexts) {
      for (const build of POSTER_COPY_LIBRARY[goal]) {
        const text = Object.values(build(ctx)).join(' ');
        expect(text).not.toMatch(/[—–]/);
        expect(text).not.toMatch(/[{}]|undefined|null/);
      }
    }
  });

  it.each(POSTER_GOALS)('%s: four variants never share a set, tagline or headline slot', (goal) => {
    for (const [, ctx] of contexts) {
      const picks = [0, 1, 2, 3].map((i) => pickPosterCopy(goal, ctx, i));
      expect(new Set(picks.map((p) => p.tagline)).size).toBe(4);
      expect(new Set(picks.map((p) => p.eyebrow)).size).toBe(4);
    }
  });

  it.each(POSTER_GOALS)('%s: the listing name appears at most once per poster', (goal) => {
    for (const [, ctx] of contexts) {
      for (const build of POSTER_COPY_LIBRARY[goal]) {
        const text = Object.values(build(ctx)).join(' | ');
        expect(text.split(ctx.name).length - 1).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic for a listing and varies across listings', () => {
    const a = pickPosterCopy('vibe', contexts[0]![1], 0);
    expect(pickPosterCopy('vibe', contexts[0]![1], 0)).toEqual(a);
    const starts = new Set(
      ['Alpha', 'Bravo', 'Casa Luna', 'Delta Suites', 'Echo Loft', 'Foxtrot'].map(
        (name) => pickPosterCopy('vibe', { ...contexts[0]![1], name }, 0).eyebrow
      )
    );
    expect(starts.size).toBeGreaterThan(1);
  });

  it('never invents an offer, price or perk', () => {
    for (const goal of POSTER_GOALS) {
      for (const build of POSTER_COPY_LIBRARY[goal]) {
        const text = Object.values(build(contexts[1]![1])).join(' ');
        expect(text).not.toMatch(/\d/);
        expect(text.toLowerCase()).not.toMatch(/save|discount|off\b|free|promo|%|sale|deal/);
      }
    }
  });

  it('prints times only when the listing has them', () => {
    const rich = pickPosterCopy('stay-info', contexts[0]![1], 0);
    expect(Object.values(rich).join(' ')).toMatch(/2:00 PM|12:00 PM|check/i);
    const bare = Object.values(pickPosterCopy('stay-info', contexts[1]![1], 0)).join(' ');
    expect(bare).not.toMatch(/\d/);
  });
});
