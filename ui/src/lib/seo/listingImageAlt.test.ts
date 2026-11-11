import { describe, expect, it } from 'vitest';

import { buildListingImageAlt } from '@/lib/seo/listingImageAlt';

const base = {
  listingName: 'Monaco 2604',
  unitType: 'Studio',
  city: 'San Fernando',
};

describe('buildListingImageAlt', () => {
  it('prefers the host alt text', () => {
    expect(buildListingImageAlt({ ...base, alt: 'Bright corner studio with a balcony' })).toBe(
      'Bright corner studio with a balcony'
    );
  });

  it('falls back to the caption', () => {
    expect(buildListingImageAlt({ ...base, alt: '  ', caption: 'Kitchen and dining area' })).toBe(
      'Kitchen and dining area'
    );
  });

  it('generates a descriptive sentence from the listing facts', () => {
    expect(buildListingImageAlt({ ...base, index: 0 })).toBe(
      'Monaco 2604, Studio in San Fernando (view 1)'
    );
    expect(buildListingImageAlt(base)).toBe('Monaco 2604, Studio in San Fernando');
  });

  it('uses the room tag and the gallery index', () => {
    expect(buildListingImageAlt({ ...base, roomTag: 'Living area' })).toBe(
      'Living area, Monaco 2604, Studio in San Fernando'
    );
    expect(buildListingImageAlt({ ...base, index: 2 })).toBe(
      'Monaco 2604, Studio in San Fernando (view 3)'
    );
  });

  it('drops missing parts instead of leaving gaps', () => {
    expect(buildListingImageAlt({ listingName: 'Slot A1' })).toBe('Slot A1');
    expect(buildListingImageAlt({ listingName: 'Slot A1', city: 'Makati' })).toBe(
      'Slot A1, in Makati'
    );
  });

  it('never uses redundant words that screen readers already announce', () => {
    const alt = buildListingImageAlt({ ...base, index: 0 });
    expect(alt.toLowerCase()).not.toContain('image');
    expect(alt.toLowerCase()).not.toContain('photo');
    expect(alt.toLowerCase()).not.toContain('picture');
  });

  it('never returns an empty string and caps the length', () => {
    expect(buildListingImageAlt({ listingName: '   ' })).toBe('Listing');
    const long = buildListingImageAlt({
      listingName: 'x'.repeat(300),
      alt: 'y'.repeat(300),
    });
    expect(long).toHaveLength(200);
  });

  it('collapses whitespace in host copy', () => {
    expect(buildListingImageAlt({ ...base, alt: '  Two   beds,\n one  bath ' })).toBe(
      'Two beds, one bath'
    );
  });
});
