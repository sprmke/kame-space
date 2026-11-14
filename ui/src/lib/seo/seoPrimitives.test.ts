import { describe, expect, it } from 'vitest';

import { descriptionFromOverride, titleFromOverride } from '@/lib/seo/seoPrimitives';

describe('titleFromOverride', () => {
  it('returns null for a blank override so the caller can fall back', () => {
    expect(titleFromOverride('', 'Kame Space')).toBeNull();
    expect(titleFromOverride('   ', 'Kame Space')).toBeNull();
    expect(titleFromOverride(null, 'Kame Space')).toBeNull();
  });

  it('appends the brand when the host omitted it', () => {
    expect(titleFromOverride('Studio in San Fernando', 'Kame Space')).toBe(
      'Studio in San Fernando | Kame Space'
    );
  });

  it('does not double the brand when the host already wrote it', () => {
    expect(titleFromOverride('Condo in Makati | Kame Space', 'Kame Space')).toBe(
      'Condo in Makati | Kame Space'
    );
    expect(titleFromOverride('Kame Space studio', 'Kame Space')).toBe('Kame Space studio');
  });

  it('strips pasted markup instead of showing it literally', () => {
    expect(titleFromOverride('<b>Studio</b> in Makati', 'Kame Space')).toBe(
      'Studio in Makati | Kame Space'
    );
    expect(descriptionFromOverride('A <i>quiet</i> studio.')).toBe('A quiet studio.');
  });

  it('collapses whitespace and caps a runaway title', () => {
    expect(titleFromOverride('  Studio   in  Makati ', 'Kame Space')).toBe(
      'Studio in Makati | Kame Space'
    );
    expect(titleFromOverride('word '.repeat(40), 'Kame Space')?.length ?? 0).toBeLessThanOrEqual(
      70
    );
  });
});

describe('descriptionFromOverride', () => {
  it('returns null for blank and trims a real one', () => {
    expect(descriptionFromOverride('  ')).toBeNull();
    expect(descriptionFromOverride('  A quiet studio.  ')).toBe('A quiet studio.');
  });

  it('caps at the meta length', () => {
    expect(descriptionFromOverride('word '.repeat(60))?.length ?? 0).toBeLessThanOrEqual(160);
  });
});
