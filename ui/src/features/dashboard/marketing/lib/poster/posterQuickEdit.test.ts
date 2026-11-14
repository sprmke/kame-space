import { describe, expect, it } from 'vitest';

import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import {
  applyStyleFamily,
  orderPhotosWithPicks,
  describePostChange,
  heroPhotoUrl,
  layoutChoices,
  moreLikeThisLayouts,
  overLimitSlots,
  quickEditCharLimit,
  setHeroPhoto,
  setPosterLayout,
  setPosterText,
  setPosterToggle,
} from '@/features/dashboard/marketing/lib/poster/posterQuickEdit';
import {
  POSTER_ARCHETYPE_FAMILY,
  POSTER_ARCHETYPE_IDS,
  normalizePosterSpec,
  type PosterFacts,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

const facts: PosterFacts = {
  propertyName: 'The Upper Room',
  brandName: 'Kame',
  location: 'Pampanga',
  checkIn: '2:00 PM',
  checkOut: '11:00 AM',
  securityDeposit: null,
  nightlyRate: null,
  amenities: ['Pool'],
  logoUrl: null,
  photos: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
};

const spec = normalizePosterSpec(
  {
    archetype: 'photo-first',
    copy: { headline: 'Weekend escape', subhead: 'Slow mornings.', eyebrow: 'Stay' },
    photoIndexes: [0, 1],
  },
  facts
);

describe('setPosterText', () => {
  it('sets and cleans a slot', () => {
    const next = setPosterText(spec, 'headline', '  Cozy   nights  ');
    expect(next.copy.headline).toBe('Cozy nights');
  });

  it('never empties the headline', () => {
    expect(setPosterText(spec, 'headline', '   ')).toBe(spec);
  });

  it('clears an optional slot', () => {
    expect(setPosterText(spec, 'subhead', '').copy.subhead).toBe('');
  });

  it('keeps the previous copy when the text is far over budget', () => {
    const long = 'word '.repeat(40);
    expect(setPosterText(spec, 'headline', long)).toBe(spec);
  });

  it('removes em dashes like every other model string', () => {
    expect(setPosterText(spec, 'subhead', 'Rest — repeat').copy.subhead).toBe('Rest, repeat');
  });
});

describe('overLimitSlots', () => {
  it('flags only the slots that would be rejected', () => {
    expect(overLimitSlots({ headline: 'word '.repeat(40), subhead: 'fine' })).toEqual(['headline']);
    expect(overLimitSlots({ headline: '' })).toEqual([]);
  });

  it('exposes the character cap for the field', () => {
    expect(quickEditCharLimit('headline')).toBe(34);
  });
});

describe('setPosterToggle', () => {
  const available = { logo: false, infoBar: true, location: true };
  it('turns a fact-backed module on and off', () => {
    const off = setPosterToggle(spec, 'location', false, available);
    expect(off.include.location).toBe(false);
    expect(setPosterToggle(off, 'location', true, available).include.location).toBe(true);
  });

  it('refuses to turn on a module with no fact behind it', () => {
    expect(setPosterToggle(spec, 'logo', true, available)).toBe(spec);
  });
});

describe('setHeroPhoto', () => {
  const urls = facts.photos;

  it('moves a photo already on the post to the front', () => {
    const result = setHeroPhoto(spec, urls, 'b.jpg');
    expect(result.photoUrls).toEqual(['b.jpg', 'a.jpg']);
    expect(result.spec.photoIndexes).toEqual([0, 1]);
    expect(heroPhotoUrl(result.spec, result.photoUrls)).toBe('b.jpg');
  });

  it('adds a new photo as the hero and keeps at most three', () => {
    const three = { ...spec, photoIndexes: [0, 1, 2] };
    const result = setHeroPhoto(three, urls, 'd.jpg');
    expect(result.photoUrls).toEqual(['d.jpg', 'a.jpg', 'b.jpg']);
  });

  it('is a no-op for the current hero', () => {
    const result = setHeroPhoto(spec, urls, 'a.jpg');
    expect(result.photoUrls).toEqual(['a.jpg', 'b.jpg']);
  });
});

describe('layouts', () => {
  it('switches the layout and its default type', () => {
    const next = setPosterLayout(spec, 'night-glass');
    expect(next.archetype).toBe('night-glass');
    expect(next.fontPairing).toBe(POSTER_ARCHETYPE_DEFAULT_FONTS['night-glass']);
  });

  it('keeps the theme type when asked', () => {
    expect(setPosterLayout(spec, 'sky-headline', { keepFonts: true }).fontPairing).toBe(
      spec.fontPairing
    );
  });

  it('lists every layout once, current first, Clean before Flyer', () => {
    const choices = layoutChoices('sky-headline');
    expect(choices[0]).toBe('sky-headline');
    expect([...choices].sort()).toEqual([...POSTER_ARCHETYPE_IDS].sort());
    const rest = choices.slice(1).map((id) => POSTER_ARCHETYPE_FAMILY[id]);
    expect(rest.indexOf('flyer')).toBeGreaterThanOrEqual(rest.lastIndexOf('clean'));
  });

  it('suggests unused layouts of the same family first', () => {
    const picks = moreLikeThisLayouts('photo-first', new Set(['framed-editorial']), 10);
    expect(picks).not.toContain('photo-first');
    expect(picks.every((id) => POSTER_ARCHETYPE_FAMILY[id] === 'clean')).toBe(true);
    expect(picks[picks.length - 1]).toBe('framed-editorial');
  });
});

describe('describePostChange', () => {
  const post = (patch: Record<string, unknown>, format = 'instagram-portrait') => ({
    spec: { ...(spec as unknown as Record<string, unknown>), ...patch },
    format,
    photoUrls: ['a.jpg', 'b.jpg'],
  });

  it('reads the most specific change first', () => {
    const parent = post({});
    expect(describePostChange(parent, post({}, 'instagram-story'))).toBe('size');
    expect(describePostChange(parent, post({ archetype: 'big-type' }))).toBe('layout');
    expect(describePostChange(parent, { ...post({ photoIndexes: [1, 0] }) })).toBe('photo');
    expect(describePostChange(parent, post({ copy: { ...spec.copy, headline: 'New' } }))).toBe(
      'text'
    );
    expect(
      describePostChange(parent, post({ include: { ...spec.include, location: false } }))
    ).toBe('options');
    expect(describePostChange(parent, post({}))).toBe('none');
  });
});

describe('applyStyleFamily', () => {
  const mk = (archetype: string) =>
    normalizePosterSpec({ archetype, copy: { headline: 'Hi' }, photoIndexes: [0] }, facts);
  const batch = [mk('sky-headline'), mk('night-glass'), mk('photo-first'), mk('wave-duo')];

  it('leaves Auto alone', () => {
    expect(applyStyleFamily(batch, 'auto')).toBe(batch);
  });

  it('moves every post into the Clean family without repeating a layout', () => {
    const out = applyStyleFamily(batch, 'clean');
    expect(out.every((spec) => POSTER_ARCHETYPE_FAMILY[spec.archetype] === 'clean')).toBe(true);
    expect(new Set(out.map((spec) => spec.archetype)).size).toBe(4);
    expect(out[2]!.archetype).toBe('photo-first');
  });

  it('moves every post into the Flyer family', () => {
    const out = applyStyleFamily(batch, 'flyer');
    expect(out.every((spec) => POSTER_ARCHETYPE_FAMILY[spec.archetype] === 'flyer')).toBe(true);
  });
});

describe('orderPhotosWithPicks', () => {
  it('puts picks first and ignores unknown urls', () => {
    expect(orderPhotosWithPicks(['a', 'b', 'c'], ['c', 'x'])).toEqual(['c', 'a', 'b']);
    expect(orderPhotosWithPicks(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});

describe('effectiveStyleChoice (plan 10.1)', () => {
  it('keeps the choice while the new layouts are on', async () => {
    const { effectiveStyleChoice } = await import('./posterQuickEdit');
    expect(effectiveStyleChoice(undefined, true)).toBe('auto');
    expect(effectiveStyleChoice('clean', true)).toBe('clean');
  });
  it('forces the original Flyer family when they are off', async () => {
    const { effectiveStyleChoice } = await import('./posterQuickEdit');
    expect(effectiveStyleChoice('clean', false)).toBe('flyer');
    expect(effectiveStyleChoice('auto', false)).toBe('flyer');
  });
});
