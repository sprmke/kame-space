import { describe, expect, it } from 'vitest';

import {
  CLEAN_ARCHETYPE,
  cleanSpec,
  ensureBatchDiversity,
  lightenSpec,
  repairBatch,
} from '@/features/dashboard/marketing/lib/poster/posterRepair';
import {
  normalizePosterSpec,
  type PosterArchetypeId,
  type PosterFacts,
  type PosterSpec,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

const FACTS: PosterFacts = {
  propertyName: 'Test Stay',
  brandName: null,
  location: 'Tagaytay',
  checkIn: '2:00 PM',
  checkOut: '12:00 PM',
  securityDeposit: null,
  nightlyRate: null,
  amenities: ['Pool', 'Kitchen', 'Wi-Fi', 'Netflix'],
  logoUrl: null,
  photos: ['a', 'b', 'c'],
};

const spec = (archetype: PosterArchetypeId, photoIndexes = [0, 1]): PosterSpec =>
  normalizePosterSpec(
    { archetype, photoIndexes, copy: { headline: 'Stay here', chips: ['a', 'b', 'c'] } },
    FACTS
  );

describe('lightenSpec / cleanSpec', () => {
  it('removes optional content without touching the headline', () => {
    const base = spec('night-glass');
    const light = lightenSpec(base);
    expect(light.include.infoBar).toBe(false);
    expect(light.include.location).toBe(false);
    expect(light.features.length).toBeLessThanOrEqual(3);
    expect(light.copy.chips.length).toBeLessThanOrEqual(2);
    expect(light.copy.headline).toBe(base.copy.headline);
    expect(light.archetype).toBe('night-glass');
  });

  it('switches to the Clean layout with its own type system', () => {
    const clean = cleanSpec(spec('night-glass'));
    expect(clean.archetype).toBe(CLEAN_ARCHETYPE);
    expect(clean.fontPairing).not.toBe(spec('night-glass').fontPairing);
  });
});

describe('repairBatch', () => {
  const archetypes: PosterArchetypeId[] = [
    'sky-headline',
    'wave-duo',
    'magazine-cover',
    'night-glass',
  ];

  it('leaves a clean batch alone', async () => {
    const specs = archetypes.map((a) => spec(a));
    const result = await repairBatch(specs, async () => 0);
    expect(result.specs).toEqual(specs);
    expect(result.repaired).toBe(0);
    expect(result.dropped).toBe(0);
  });

  it('fixes a failing variant with the lighter version first', async () => {
    const specs = archetypes.map((a) => spec(a));
    const audit = async (s: PosterSpec) =>
      s.archetype === 'wave-duo' && s.include.infoBar ? 2 : 0;
    const result = await repairBatch(specs, audit);
    expect(result.repaired).toBe(1);
    expect(result.dropped).toBe(0);
    const fixed = result.specs[1]!;
    expect(fixed.archetype).toBe('wave-duo');
    expect(fixed.include.infoBar).toBe(false);
  });

  it('falls back to Clean when lightening is not enough', async () => {
    const specs = archetypes.map((a) => spec(a));
    const audit = async (s: PosterSpec) => (s.archetype === 'night-glass' ? 3 : 0);
    const result = await repairBatch(specs, audit);
    expect(result.specs[3]!.archetype).toBe(CLEAN_ARCHETYPE);
    expect(result.dropped).toBe(0);
  });

  it('drops an unfixable variant and backfills so the count holds', async () => {
    const specs = archetypes.map((a) => spec(a));
    // Everything fails except the Clean layout.
    const audit = async (s: PosterSpec) =>
      s.archetype === 'magazine-cover' && s.include.infoBar
        ? 1
        : s.archetype === 'magazine-cover'
          ? 1
          : 0;
    const result = await repairBatch(specs, audit);
    expect(result.specs).toHaveLength(4);
    expect(result.specs.some((s) => s.archetype === 'magazine-cover')).toBe(false);
  });

  it('always returns the requested count, even when every layout fails', async () => {
    const specs = archetypes.map((a) => spec(a));
    const result = await repairBatch(specs, async () => 5, { count: 4 });
    expect(result.specs).toHaveLength(4);
  });

  it('returns nothing for an empty batch instead of looping', async () => {
    expect((await repairBatch([], async () => 0)).specs).toEqual([]);
  });
});

describe('ensureBatchDiversity', () => {
  it('adds a Clean layout when none is present, replacing the last variant', () => {
    const specs = (['sky-headline', 'wave-duo', 'night-glass'] as const).map((a) => spec(a));
    const out = ensureBatchDiversity(specs);
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.archetype)).toEqual(['sky-headline', 'wave-duo', CLEAN_ARCHETYPE]);
  });

  it('leaves a batch that already has one, and single-variant batches', () => {
    const specs = [spec('sky-headline'), spec(CLEAN_ARCHETYPE)];
    expect(ensureBatchDiversity(specs)).toEqual(specs);
    expect(ensureBatchDiversity([spec('wave-duo')])).toHaveLength(1);
  });
});
