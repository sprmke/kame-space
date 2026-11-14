/**
 * Freeze for stored v1 posters. A saved post keeps its spec, not its compiled
 * document, so any change to a v1 builder silently changes what an old version
 * exports. This hashes the compiled output of the six original archetypes; a failure
 * means a stored post would now render differently. Fix the builder, or ship the
 * change as a new archetype id instead.
 */
import { describe, expect, it } from 'vitest';

import { POSTER_ARCHETYPE_DEFAULT_FONTS } from '@/features/dashboard/marketing/lib/poster/posterArchetypes';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import { buildPosterFacts } from '@/features/dashboard/marketing/lib/poster/posterFacts';
import { normalizePosterSpec } from '@/features/dashboard/marketing/lib/poster/posterSpec';
import type { DesignTemplateFormat } from '@/features/dashboard/marketing/lib/templateRegistry';

const V1 = [
  'wave-duo',
  'sky-headline',
  'night-glass',
  'minimal-title',
  'magazine-cover',
  'feature-sticker',
] as const;
const FORMATS: DesignTemplateFormat[] = [
  'instagram-post',
  'instagram-portrait',
  'instagram-story',
  'facebook-post',
];

const FACTS = buildPosterFacts({
  propertyName: 'Palm Cove Villa',
  brandName: 'Palm Cove',
  property: {
    city: 'Batangas',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    amenities: ['Swimming Pool', 'Heated Jacuzzi', 'PS5 + games', 'Netflix', 'Coffee Maker'],
    pricing: { baseRate: 8500, currency: 'PHP', securityDeposit: 2000 },
  },
  photos: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  logoUrl: 'https://example.com/logo.png',
});

const COPY = {
  eyebrow: 'Weekend escape',
  headline: 'Slow mornings',
  accent: 'Stay awhile',
  subhead: 'Wake up to the pool and take it slow.',
  chips: ['Batangas', 'Pool', 'Jacuzzi'],
  tagline: 'Unwind. Recharge.',
  cta: 'Book direct',
  badge: 'PS5 included',
  listTitle: 'Perfect for',
};

/** FNV-1a over the compiled page, stable across runs (ids are reset per compile). */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function golden(archetype: (typeof V1)[number], format: DesignTemplateFormat): string {
  const spec = normalizePosterSpec(
    {
      archetype,
      fontPairing: POSTER_ARCHETYPE_DEFAULT_FONTS[archetype],
      copy: COPY,
      photoIndexes: [0, 1],
      features: COPY.chips.map((label) => ({ label })),
    },
    FACTS
  );
  const doc = compilePosterDocument(spec, FACTS, format, {
    photoSizes: { 'https://example.com/a.jpg': { width: 1600, height: 1200 } },
  });
  const page = doc.pages[0]!;
  return hash(JSON.stringify({ background: page.background, children: page.children }));
}

const GOLDEN: Record<string, string> = {
  'wave-duo/instagram-post': 'aefa91dd',
  'wave-duo/instagram-portrait': 'ebcdd197',
  'wave-duo/instagram-story': 'dbd9c228',
  'wave-duo/facebook-post': '906e45aa',
  'sky-headline/instagram-post': '8ce3fedc',
  'sky-headline/instagram-portrait': '4581da67',
  'sky-headline/instagram-story': 'e5e47a90',
  'sky-headline/facebook-post': '4a748aba',
  'night-glass/instagram-post': '36b68435',
  'night-glass/instagram-portrait': '2033e8b2',
  'night-glass/instagram-story': 'e82a3fa8',
  'night-glass/facebook-post': '951f413e',
  'minimal-title/instagram-post': '5601b6a8',
  'minimal-title/instagram-portrait': 'c9d1204b',
  'minimal-title/instagram-story': '9bca963e',
  'minimal-title/facebook-post': 'c2bda870',
  'magazine-cover/instagram-post': 'f116d3ab',
  'magazine-cover/instagram-portrait': '0db34524',
  'magazine-cover/instagram-story': '48b59e08',
  'magazine-cover/facebook-post': 'bee0cb93',
  'feature-sticker/instagram-post': '9f0cafb7',
  'feature-sticker/instagram-portrait': '0b702577',
  'feature-sticker/instagram-story': '2bdcd169',
  'feature-sticker/facebook-post': '5ca3852f',
};

describe('v1 poster golden documents', () => {
  it.each(V1.flatMap((a) => FORMATS.map((f) => [a, f] as const)))(
    '%s / %s is unchanged',
    (a, f) => {
      expect(golden(a, f)).toBe(GOLDEN[`${a}/${f}`] ?? 'unrecorded');
    }
  );
});
