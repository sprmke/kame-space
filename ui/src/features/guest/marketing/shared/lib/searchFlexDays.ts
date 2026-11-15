/**
 * Flexible dates for guest search: also show listings free for the same-length stay
 * shifted up to N days either way (Airbnb's "± days" chips). Mirrors the edge
 * `parseFlexDays` allowlist in `supabase/functions/_shared/publicListingSearch.ts`.
 */
export const SEARCH_FLEX_DAYS = [1, 2, 3, 7] as const;

export type SearchFlexDays = 0 | (typeof SEARCH_FLEX_DAYS)[number];

export function parseFlexDaysParam(raw: string | null | undefined): SearchFlexDays {
  const n = Number.parseInt(raw ?? '', 10);
  return (SEARCH_FLEX_DAYS as readonly number[]).includes(n) ? (n as SearchFlexDays) : 0;
}

/** Flexibility only applies to a full date range; anything else is exact (0). */
export function flexForRange(
  flex: number,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined
): SearchFlexDays {
  if (!checkIn || !checkOut) return 0;
  return parseFlexDaysParam(String(flex));
}

/** Chip label: "Exact dates", "± 1 day", "± 3 days". */
export function flexOptionLabel(flex: SearchFlexDays): string {
  if (flex === 0) return 'Exact dates';
  return `± ${flex} ${flex === 1 ? 'day' : 'days'}`;
}

/** Suffix for compact date summaries: "Nov 20 – 22 (±2)". Empty when exact. */
export function flexSummarySuffix(flex: number): string {
  const days = parseFlexDaysParam(String(flex));
  return days === 0 ? '' : ` (±${days})`;
}
