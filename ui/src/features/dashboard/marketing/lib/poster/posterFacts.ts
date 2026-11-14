import type { PosterFacts } from '@/features/dashboard/marketing/lib/poster/posterSpec';

/**
 * Builds the poster fact pack from data the Design tab already loads
 * (`usePublicPropertyDetail`). Anything a poster prints about the stay (times,
 * deposit, amenities, location) comes from here, never from the model.
 */

export type PosterFactsPropertyInput = {
  residenceName?: string | null;
  city?: string | null;
  state?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  amenities?: string[];
  pricing?: {
    baseRate?: number | null;
    currency?: string | null;
    securityDeposit?: number | null;
  } | null;
};

/** "14:00" / "14:00:00" / "2:00 PM" → "2:00 PM". Unknown shapes pass through trimmed. */
export function formatPosterTime(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/\b(am|pm|nn)\b/i.test(raw)) return raw.replace(/\s+/g, ' ').toUpperCase();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return raw;
  const hours = Number(match[1]);
  const minutes = match[2]!;
  if (hours > 23) return raw;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

export function formatPosterMoney(
  amount: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency?.trim() || 'PHP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₱${Math.round(amount).toLocaleString('en-PH')}`;
  }
}

export function formatPosterLocation(
  input: PosterFactsPropertyInput | null | undefined
): string | null {
  if (!input) return null;
  const parts = [input.residenceName, input.state || input.city]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const fallback = [input.city, input.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const chosen = parts.length > 0 ? parts : fallback;
  const unique = chosen.filter(
    (part, index) =>
      chosen.findIndex((other) => other.toLowerCase() === part.toLowerCase()) === index
  );
  return unique.length > 0 ? unique.join(', ') : null;
}

/** Everyday amenities every listing has; they never lead a poster. */
const BASELINE_AMENITY =
  /\b(wi-?fi|internet|air ?con(?:ditioning|ditioner)?|a\/c|aircon|heating|heater|hair ?dryer|tv|television|towels?|linens?|toiletries|essentials|hot water|fan)\b/i;

/** Amenities worth leading with, most distinctive first. */
const DISTINCTIVE_ORDER: RegExp[] = [
  /pool/i,
  /jacuzzi|hot ?tub|bath ?tub/i,
  /view|balcon|terrace|rooftop|sea|beach|mountain/i,
  /netflix|console|playstation|xbox|karaoke|projector|movie/i,
  /kitchen|grill|bbq/i,
  /parking/i,
  /pet/i,
];

export function isDistinctiveAmenity(label: string): boolean {
  return label.trim().length > 0 && !BASELINE_AMENITY.test(label);
}

function amenityRank(label: string): number {
  if (BASELINE_AMENITY.test(label)) return DISTINCTIVE_ORDER.length + 1;
  const index = DISTINCTIVE_ORDER.findIndex((pattern) => pattern.test(label));
  return index === -1 ? DISTINCTIVE_ORDER.length : index;
}

/** Distinctive first, baseline last, host order kept inside a tier. De-duplicated. */
export function rankAmenities(labels: string[]): string[] {
  const seen = new Set<string>();
  const unique = labels
    .map((label) => label.trim())
    .filter((label) => {
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return unique
    .map((label, order) => ({ label, order, rank: amenityRank(label) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((item) => item.label);
}

export function buildPosterFacts(input: {
  propertyName: string;
  brandName?: string | null;
  property?: PosterFactsPropertyInput | null;
  photos: string[];
  logoUrl?: string | null;
}): PosterFacts {
  const property = input.property ?? null;
  const photos = [...new Set(input.photos.map((url) => url.trim()).filter(Boolean))];
  return {
    propertyName: input.propertyName.trim(),
    brandName: input.brandName?.trim() || null,
    location: formatPosterLocation(property),
    checkIn: formatPosterTime(property?.checkInTime),
    checkOut: formatPosterTime(property?.checkOutTime),
    securityDeposit: formatPosterMoney(
      property?.pricing?.securityDeposit,
      property?.pricing?.currency
    ),
    nightlyRate: formatPosterMoney(property?.pricing?.baseRate, property?.pricing?.currency),
    amenities: rankAmenities(property?.amenities ?? []),
    logoUrl: input.logoUrl?.trim() || null,
    photos,
  };
}
