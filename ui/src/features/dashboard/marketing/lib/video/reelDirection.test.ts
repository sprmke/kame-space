import { describe, expect, it } from 'vitest';

import { normalizeReelDirection } from '@/features/dashboard/marketing/lib/video/reelDirection';

const RECIPES = ['tour', 'highlights'] as const;
const PHOTOS = ['a.jpg', 'b.jpg', 'c.jpg'];

describe('normalizeReelDirection', () => {
  it('maps indexes to urls in order and drops repeats and strays', () => {
    const out = normalizeReelDirection(
      { recipe: 'highlights', photoIndexes: [2, 2, 7, 0], copy: { headline: ' Hi ' } },
      PHOTOS,
      RECIPES
    );
    expect(out?.photoUrls).toEqual(['c.jpg', 'a.jpg']);
    expect(out?.recipe).toBe('highlights');
    expect(out?.copy.headline).toBe('Hi');
  });

  it('returns null when no photo survives', () => {
    expect(normalizeReelDirection({ photoIndexes: [9] }, PHOTOS, RECIPES)).toBeNull();
    expect(normalizeReelDirection(null, PHOTOS, RECIPES)).toBeNull();
  });

  it('falls back to the first recipe when unknown', () => {
    expect(normalizeReelDirection({ recipe: 'x', photoIndexes: [0] }, PHOTOS, RECIPES)?.recipe).toBe(
      'tour'
    );
  });
});
