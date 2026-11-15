import { describe, expect, it } from 'vitest';

import { auditPosterDocument } from '@/features/dashboard/marketing/lib/poster/posterAudit';
import {
  CAROUSEL_MAX_SLIDES,
  buildCarouselSpecs,
  carouselFamily,
} from '@/features/dashboard/marketing/lib/poster/posterCarousel';
import { compilePosterDocument } from '@/features/dashboard/marketing/lib/poster/posterCompiler';
import {
  POSTER_ARCHETYPE_FAMILY,
  type PosterFacts,
} from '@/features/dashboard/marketing/lib/poster/posterSpec';

const facts = (patch: Partial<PosterFacts> = {}): PosterFacts => ({
  propertyName: 'The Upper Room',
  brandName: 'Kame',
  location: 'Tagaytay, Cavite',
  checkIn: '2:00 PM',
  checkOut: '11:00 AM',
  securityDeposit: '₱2,000',
  nightlyRate: '₱3,200',
  amenities: ['Jacuzzi', 'WiFi', 'Netflix', 'Kitchen'],
  logoUrl: null,
  photos: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
  ...patch,
});

describe('buildCarouselSpecs', () => {
  it('makes a five slide set in one family with the cover first', () => {
    const slides = buildCarouselSpecs(facts(), 'clean');
    expect(slides.map((slide) => slide.role)).toEqual([
      'cover',
      'amenities',
      'feature',
      'stay-info',
      'closing',
    ]);
    expect(slides.length).toBeLessThanOrEqual(CAROUSEL_MAX_SLIDES);
    expect(slides.every((s) => POSTER_ARCHETYPE_FAMILY[s.spec.archetype] === 'clean')).toBe(true);
  });

  it('uses a different hero photo on neighbouring slides', () => {
    const heroes = buildCarouselSpecs(facts(), 'clean').map((s) => s.spec.photoIndexes[0]);
    expect(heroes[0]).not.toBe(heroes[1]);
  });

  it('drops the feature slide without a distinctive amenity and stay info without times', () => {
    const slides = buildCarouselSpecs(
      facts({ amenities: ['WiFi', 'Air conditioning'], checkIn: null, checkOut: null }),
      'clean'
    );
    expect(slides.map((s) => s.role)).toEqual(['cover', 'amenities', 'closing']);
  });

  it('treats Auto as Clean', () => {
    expect(carouselFamily('auto')).toBe('clean');
  });

  it.each(['clean', 'lifestyle', 'flyer'] as const)(
    'every %s slide compiles cleanly at 4:5',
    (family) => {
      for (const { spec } of buildCarouselSpecs(facts(), family)) {
        const document = compilePosterDocument(spec, facts(), 'instagram-portrait', {});
        expect(auditPosterDocument(document)).toEqual([]);
      }
    }
  );
});
