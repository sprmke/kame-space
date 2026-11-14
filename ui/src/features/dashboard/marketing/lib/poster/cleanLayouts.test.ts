import { describe, expect, it } from 'vitest';

import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { buildPosterFacts } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import {
  normalizePosterSpec,
  type PosterArchetypeId,
  type PosterFacts,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

const CLEAN = [
  'photo-first',
  'framed-editorial',
  'big-type',
  'info-card',
  'split-panel',
  'quote-card',
  'arch-frame',
  'duo-collage',
  'trio-grid',
] as const;
const FORMATS: DesignTemplateFormat[] = [
  'instagram-post',
  'instagram-portrait',
  'instagram-story',
  'facebook-post',
];
const PHOTOS = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];

const RICH: PosterFacts = buildPosterFacts({
  propertyName: 'Palm Cove Villa',
  brandName: 'Palm Cove',
  property: {
    city: 'Batangas',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    amenities: ['Swimming Pool', 'Heated Jacuzzi', 'PS5 + games', 'Netflix', 'Coffee Maker'],
    pricing: { baseRate: 8500, currency: 'PHP', securityDeposit: 2000 },
  },
  photos: PHOTOS,
  logoUrl: 'https://example.com/logo.png',
});
const BARE: PosterFacts = buildPosterFacts({
  propertyName: 'The Upper Room at Azure North Staycation Suites',
  photos: [PHOTOS[0]!],
});
const LONG = {
  eyebrow: 'Discover a slice of paradise without leaving town',
  headline: 'Without booking a flight this summer',
  subhead:
    'Escape the city and enjoy a relaxing staycation with family, friends or your special someone.',
  chips: ['Relax', 'Unwind', 'Reconnect'],
};

function compile(
  archetype: PosterArchetypeId,
  facts: PosterFacts,
  format: DesignTemplateFormat,
  copy: Record<string, unknown> = LONG
) {
  const spec = normalizePosterSpec(
    {
      archetype,
      fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
      copy,
      photoIndexes: [0, 1],
    },
    facts
  );
  return compilePosterDocument(spec, facts, format, {
    photoSizes: { [PHOTOS[0]!]: { width: 1600, height: 1200 } },
  });
}

const names = (doc: ReturnType<typeof compile>) =>
  doc.pages[0]!.children.map((child) => String(child.name));

describe('Clean layouts', () => {
  const cases = CLEAN.flatMap((archetype) =>
    FORMATS.flatMap((format) =>
      (
        [
          ['rich', RICH, LONG],
          ['bare', BARE, { headline: BARE.propertyName }],
          ['empty copy', RICH, {}],
        ] as const
      ).map(([profile, facts, copy]) => ({ archetype, format, profile, facts, copy }))
    )
  );

  it.each(cases)(
    '$archetype / $format / $profile passes audit',
    ({ archetype, format, facts, copy }) => {
      expect(auditPosterDocument(compile(archetype, facts, format, copy))).toEqual([]);
    }
  );

  it.each(CLEAN.map((id) => [id]))('%s uses at most two font families', (archetype) => {
    const doc = compile(archetype, RICH, 'instagram-portrait');
    const families = new Set(
      doc.pages[0]!.children.filter((c) => c.type === 'text').map((c) => String(c.fontFamily))
    );
    expect(families.size).toBeLessThanOrEqual(2);
  });

  it('never uses script, outline strokes or text shadows', () => {
    for (const archetype of CLEAN) {
      const doc = compile(archetype, RICH, 'instagram-post');
      for (const child of doc.pages[0]!.children.filter((c) => c.type === 'text')) {
        expect(child.stroke).toBeUndefined();
        expect(child.shadowEnabled).toBeUndefined();
      }
    }
  });

  it('photo-first uses a single bottom scrim, so scrims can never meet', () => {
    for (const format of FORMATS) {
      const scrims = names(compile('photo-first', RICH, format)).filter((n) => /scrim/i.test(n));
      expect(scrims).toEqual(['Scrim bottom']);
    }
  });

  it('paper layouts put every text on paper: no scrims at all', () => {
    for (const archetype of ['framed-editorial', 'big-type', 'info-card', 'split-panel', 'quote-card', 'arch-frame', 'duo-collage', 'trio-grid'] as const) {
      expect(
        names(compile(archetype, RICH, 'instagram-portrait')).some((n) => /scrim/i.test(n))
      ).toBe(false);
    }
  });

  it('info-card prints the real check-in, check-out and deposit', () => {
    const doc = compile('info-card', RICH, 'instagram-portrait');
    const texts = doc.pages[0]!.children.filter((c) => c.type === 'text').map((c) =>
      String(c.text)
    );
    expect(texts).toEqual(expect.arrayContaining(['Check-in', 'Check-out', 'Deposit']));
    expect(texts.join(' ')).toMatch(/2:00 PM/);
    expect(texts.join(' ')).toMatch(/12:00 PM/);
  });

  it('info-card falls back to the rate when there are no stay times', () => {
    const facts = buildPosterFacts({
      propertyName: 'Rate Only',
      property: { pricing: { baseRate: 3000, currency: 'PHP' } },
      photos: PHOTOS,
    });
    const doc = compile('info-card', facts, 'instagram-portrait', { headline: 'Rate Only' });
    const joined = doc.pages[0]!.children.filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join(' ');
    expect(joined).toMatch(/3,000/);
    expect(auditPosterDocument(doc)).toEqual([]);
  });

  it('puts the logo on a paper chip and omits it when there is no logo', () => {
    expect(names(compile('framed-editorial', RICH, 'instagram-post'))).toContain('Logo chip');
    expect(names(compile('framed-editorial', BARE, 'instagram-post'))).not.toContain('Logo chip');
  });

  it('is deterministic', () => {
    const a = JSON.stringify(compile('big-type', RICH, 'instagram-portrait').pages[0]!.children);
    const b = JSON.stringify(compile('big-type', RICH, 'instagram-portrait').pages[0]!.children);
    expect(a).toBe(b);
  });

  it('keeps the photo at a usable size when the headline is long', () => {
    for (const format of FORMATS) {
      const doc = compile('big-type', RICH, format, {
        ...LONG,
        headline: 'Three line long headline copy here',
      });
      const photo = doc.pages[0]!.children.find((c) => c.name === 'Hero photo');
      expect(photo).toBeDefined();
      expect(Number(photo!.height)).toBeGreaterThan(doc.height * 0.25);
    }
  });
});
