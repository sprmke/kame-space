import { AI_STUDIO_SAMPLES_BASE, showcaseFacts } from '@/features/dashboard/marketing/lib/aiStudioSamples';
import type { PosterFacts } from '@/features/dashboard/marketing/lib/poster/posterSpec';

export type PosterSheetFixture = { id: string; label: string; facts: PosterFacts };

/**
 * Dev-only listings for the poster contact sheet. Photos are the shipped showcase
 * stock (credits in `ui/public/marketing/ai-studio/samples/CREDITS.md`); a fixture
 * differs by what the listing provides, which is what stresses the layouts.
 */
export function posterSheetFixtures(origin: string): PosterSheetFixture[] {
  const base = showcaseFacts(origin);
  const photos = base.photos;
  // Dark, tilted derivatives of the same credited stock (see `fixtures/makeWeakPhotos.ts`).
  const weakPhotos = ['261102', '3209045'].map(
    (id) => `${origin}${AI_STUDIO_SAMPLES_BASE}/fixtures/weak-${id}-960.webp`
  );
  return [
    {
      id: 'cozy-condo',
      label: 'Cozy condo, full details',
      facts: {
        ...base,
        propertyName: 'Cozy Corner Condo',
        location: 'Tagaytay, Cavite',
        nightlyRate: '₱3,200',
        securityDeposit: '₱1,000',
        amenities: ['Balcony', 'Netflix', 'Kitchen', 'Wi-Fi', 'Free parking'],
        photos,
      },
    },
    {
      id: 'resort-pool',
      label: 'Resort with a pool',
      facts: {
        ...base,
        propertyName: 'Palm Cove Villa',
        location: 'Batangas',
        nightlyRate: '₱8,500',
        amenities: ['Pool', 'Jacuzzi', 'Karaoke', 'Kitchen', 'Pet friendly', 'Wi-Fi'],
        photos: [photos[2], photos[0], photos[1]],
      },
    },
    {
      id: 'minimal-studio',
      label: 'Minimal studio',
      facts: {
        ...base,
        propertyName: 'Studio 12',
        location: null,
        nightlyRate: '₱1,800',
        amenities: ['Wi-Fi', 'Air conditioning'],
        photos: [photos[1]],
      },
    },
    {
      id: 'weak-listing',
      label: 'Weak listing, dark tilted photos, no rate',
      facts: {
        ...base,
        propertyName: 'A Very Long Listing Name For The Garden View Loft Residences',
        location: null,
        nightlyRate: null,
        amenities: [],
        photos: weakPhotos,
      },
    },
    {
      id: 'bare-listing',
      label: 'Bare listing, no photos',
      facts: {
        ...base,
        propertyName: 'Bare Stay',
        checkIn: null,
        checkOut: null,
        amenities: [],
        photos: [],
      },
    },
  ];
}
