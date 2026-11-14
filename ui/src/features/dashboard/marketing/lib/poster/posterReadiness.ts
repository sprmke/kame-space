import type { PosterFacts } from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * What the listing is missing that makes a post weaker. Shown as quiet hints on the
 * create form with a link to Settings; never blocks Generate.
 */
export type ReadinessHint = { id: 'photos' | 'amenities' | 'times'; text: string };

export function posterReadinessHints(
  facts: Pick<PosterFacts, 'photos' | 'amenities' | 'checkIn' | 'checkOut'>
): ReadinessHint[] {
  const hints: ReadinessHint[] = [];
  if (facts.photos.length === 0) {
    hints.push({ id: 'photos', text: 'Add listing photos so posts can use them.' });
  } else if (facts.photos.length < 3) {
    hints.push({ id: 'photos', text: 'Add a few more photos for more variety.' });
  }
  if (facts.amenities.length === 0) {
    hints.push({ id: 'amenities', text: 'Add amenities to spotlight them.' });
  }
  if (!facts.checkIn && !facts.checkOut) {
    hints.push({ id: 'times', text: 'Add check-in and check-out times for stay info posts.' });
  }
  return hints;
}
