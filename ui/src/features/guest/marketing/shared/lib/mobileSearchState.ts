import { format, isSameMonth, isSameYear } from 'date-fns';

import type { ListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import type { SearchListingsType } from '@/features/guest/search/types/search';

/**
 * Pure state for the phone search flow (`MobileSearchPill` + `MobileSearchOverlay`).
 * Desktop keeps the segmented bar in `HeroSearch`; nothing here touches its layout.
 */

export type MobileSearchCategory = 'all' | ListingSearchPreferType;
export type MobileSearchStep = 'where' | 'when' | 'who';

export function categoryFromPreferType(
  preferType: ListingSearchPreferType | null
): MobileSearchCategory {
  return preferType ?? 'all';
}

export function preferTypeFromCategory(
  category: MobileSearchCategory
): ListingSearchPreferType | null {
  return category === 'all' ? null : category;
}

/**
 * Category tabs show everywhere except services, whose first field searches services
 * rather than places.
 */
export function showsCategoryTabs(pathname: string): boolean {
  return !(pathname === '/services' || pathname.startsWith('/services/'));
}

/** Parking is booked per slot, so it has no guest step. */
export function stepsForCategory(category: MobileSearchCategory): MobileSearchStep[] {
  return category === 'parkings' ? ['where', 'when'] : ['where', 'when', 'who'];
}

const WHERE_PLACEHOLDERS: Record<MobileSearchCategory, string> = {
  all: 'Search destinations',
  properties: 'Search properties',
  developments: 'Search developments',
  parkings: 'Search parkings',
};

export function wherePlaceholderForCategory(category: MobileSearchCategory): string {
  return WHERE_PLACEHOLDERS[category];
}

export function whenStepTitle(category: MobileSearchCategory): string {
  return category === 'parkings' ? 'When do you need it?' : "When's your trip?";
}

/** `Nov 20 – 22`, `Nov 30 – Dec 2`, `Dec 30, 2026 – Jan 2, 2027`. */
export function formatStayRangeShort(from: Date | undefined, to: Date | undefined): string {
  if (!from) return '';
  if (!to || to.getTime() === from.getTime()) return format(from, 'MMM d');
  if (!isSameYear(from, to)) return `${format(from, 'MMM d, yyyy')} – ${format(to, 'MMM d, yyyy')}`;
  if (isSameMonth(from, to)) return `${format(from, 'MMM d')} – ${format(to, 'd')}`;
  return `${format(from, 'MMM d')} – ${format(to, 'MMM d')}`;
}

export type MobilePillSummary = { primary: string; secondary: string } | null;

/**
 * Entry pill copy. `null` means the empty state (`Start your search`).
 * Guests only count as "set" when the URL carries them; the 2-adult default alone
 * should not turn the pill into a summary.
 */
export function mobilePillSummary(input: {
  where: string;
  dateSummary: string;
  guestSummary: string;
  showWho: boolean;
  hasGuestParams: boolean;
}): MobilePillSummary {
  const where = input.where.trim();
  const hasDates = input.dateSummary.length > 0;
  const hasGuests = input.showWho && input.hasGuestParams && input.guestSummary.length > 0;
  if (!where && !hasDates && !hasGuests) return null;

  const secondary = [input.dateSummary || 'Any week'];
  if (input.showWho) secondary.push(hasGuests ? input.guestSummary : 'Add guests');
  return { primary: where || 'Anywhere', secondary: secondary.join(' · ') };
}

/* ---------------------------------------------------------------------------------------------
 * Recent searches: a per-viewer convenience in localStorage. Every read and write is guarded;
 * private windows and blocked storage simply show no recents.
 * ------------------------------------------------------------------------------------------- */

export const RECENT_SEARCHES_KEY = 'kame.recentSearches.v1';
export const RECENT_SEARCHES_MAX = 5;

export type RecentSearch = {
  where: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  pets: number;
  type: SearchListingsType;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const SEARCH_TYPES = new Set<SearchListingsType>(['all', 'properties', 'developments', 'parkings']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Same ceilings as the Who steppers; storage is user-editable, so never trust it. */
const RECENT_MAX_PER_ROW = 16;
const RECENT_MAX_PETS = 5;

function toCount(value: unknown, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : min;
}

function sanitizeRecent(raw: unknown): RecentSearch | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const where = typeof row.where === 'string' ? row.where.trim().slice(0, 120) : '';
  const checkIn = typeof row.checkIn === 'string' && ISO_DATE.test(row.checkIn) ? row.checkIn : '';
  const checkOut =
    typeof row.checkOut === 'string' && ISO_DATE.test(row.checkOut) ? row.checkOut : '';
  const type = SEARCH_TYPES.has(row.type as SearchListingsType)
    ? (row.type as SearchListingsType)
    : 'all';
  if (!where && !checkIn) return null;
  return {
    where,
    checkIn,
    checkOut: checkIn ? checkOut : '',
    adults: toCount(row.adults, 1, RECENT_MAX_PER_ROW),
    children: toCount(row.children, 0, RECENT_MAX_PER_ROW),
    pets: toCount(row.pets, 0, RECENT_MAX_PETS),
    type,
  };
}

function recentKey(entry: RecentSearch): string {
  return [entry.where.toLowerCase(), entry.checkIn, entry.checkOut, entry.type].join('|');
}

/** Drops entries whose stay already started: re-running them would search past dates. */
export function readRecentSearches(
  storage: StorageLike | null = defaultStorage(),
  today: string = format(new Date(), 'yyyy-MM-dd')
): RecentSearch[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(RECENT_SEARCHES_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeRecent)
      .filter((entry): entry is RecentSearch => entry !== null)
      .filter((entry) => !entry.checkIn || entry.checkIn >= today)
      .slice(0, RECENT_SEARCHES_MAX);
  } catch {
    return [];
  }
}

export function saveRecentSearch(
  entry: RecentSearch,
  storage: StorageLike | null = defaultStorage()
): RecentSearch[] {
  const clean = sanitizeRecent(entry);
  if (!storage || !clean) return storage ? readRecentSearches(storage) : [];
  const key = recentKey(clean);
  const next = [
    clean,
    ...readRecentSearches(storage).filter((row) => recentKey(row) !== key),
  ].slice(0, RECENT_SEARCHES_MAX);
  try {
    storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // Quota or blocked storage: recents are optional.
  }
  return next;
}
