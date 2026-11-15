import {
  formatStayRangeShort,
  type MobileSearchCategory,
  type RecentSearch,
} from '@/features/guest/marketing/shared/lib/mobileSearchState';

/**
 * Display helpers used only inside the phone search sheet. Kept apart from
 * `mobileSearchState.ts` (which the eager hero needs) so they ship in the lazy sheet chunk.
 */

export const MOBILE_SEARCH_CATEGORIES: ReadonlyArray<{
  id: MobileSearchCategory;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'properties', label: 'Properties' },
  { id: 'developments', label: 'Developments' },
  { id: 'parkings', label: 'Parkings' },
];

export function formatGuestCountShort(guests: number, pets: number): string {
  const parts: string[] = [];
  if (guests > 0) parts.push(`${guests} guest${guests === 1 ? '' : 's'}`);
  if (pets > 0) parts.push(`${pets} pet${pets === 1 ? '' : 's'}`);
  return parts.join(', ');
}

function parseIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Second line under a recent search: `Nov 20 – 22 · 2 guests`. */
export function formatRecentSearchMeta(entry: RecentSearch): string {
  const dates = formatStayRangeShort(parseIsoDate(entry.checkIn), parseIsoDate(entry.checkOut));
  const guests =
    entry.type === 'parkings'
      ? ''
      : formatGuestCountShort(entry.adults + entry.children, entry.pets);
  return [dates || 'Any week', guests].filter(Boolean).join(' · ');
}
