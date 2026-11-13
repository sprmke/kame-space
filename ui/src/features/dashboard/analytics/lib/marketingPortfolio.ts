import type { OrgPortfolioRow } from '@/features/dashboard/analytics/lib/types';

/**
 * Which listings need promotion most this week.
 *
 * Pure ranking over the org portfolio rows: open nights in the forward window times ADR, so a
 * cheap listing with one gap night never outranks an expensive listing with a whole empty week.
 * Only unlocked property rows compete; parkings are not marketed from the planner.
 */

export type PromotionCandidate = {
  id: string;
  name: string;
  slug: string;
  /** Nights still open in the forward window. */
  openNights: number;
  adr: number;
  /** Open nights times ADR, the ranking key. */
  score: number;
};

export type RankOptions = {
  limit?: number;
  horizonDays?: number;
};

export function rankListingsForPromotion(
  rows: readonly OrgPortfolioRow[],
  options: RankOptions = {}
): PromotionCandidate[] {
  const limit = options.limit ?? 3;
  const horizonDays = options.horizonDays ?? 30;

  const candidates: PromotionCandidate[] = [];
  for (const row of rows) {
    if (row.locked) continue;
    if (row.kind !== 'property') continue;
    const rate = Number(row.forwardOccupancyRate30d);
    if (!Number.isFinite(rate)) continue;
    const bounded = Math.min(100, Math.max(0, rate));
    const openNights = Math.round((horizonDays * (100 - bounded)) / 100);
    if (openNights <= 0) continue;
    const adr = Number.isFinite(row.adr) && row.adr > 0 ? row.adr : 0;
    candidates.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      openNights,
      adr,
      score: openNights * adr,
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Path into a listing's plan, with today's window selected. */
export function orgPropertyPlanHref(orgSlug: string, slug: string): string {
  return `/org/${orgSlug}/property/${slug}/marketing?tab=plan&range=today`;
}
