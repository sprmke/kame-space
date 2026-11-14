/**
 * Marketing Trends — scoring.
 *
 * Pure. The code ranks; the AI only writes. A topic's score is
 *
 *   sum over sources of (weight / sqrt(rank)) + traffic bonus
 *   × cross-source bonus
 *   × momentum multiplier
 *   × stay-fit multiplier
 *
 * Weights are tuned during the 7-day dev review (plan P4.5).
 */

import type { TrendMomentum, TrendSourceEvidence, TrendSourceId } from './types.ts';

/** How much each source counts. Tuned during the dev review. */
export const SOURCE_WEIGHTS: Record<TrendSourceId, number> = {
  google_trends: 1.0,
  wikimedia_ph: 0.8,
  wikimedia_tl: 0.5,
  netflix: 0.6,
  apple_music: 0.5,
  editor: 1.0,
};

/** Each extra source that agrees on the same topic is the main de-noise signal. */
export const CROSS_SOURCE_STEP = 1.3;

export const MOMENTUM_MULTIPLIER: Record<TrendMomentum, number> = {
  new: 1.15,
  rising: 1.1,
  steady: 1.0,
};

/** How naturally a topic ties to a stay. 0 never ships. */
export const STAY_FIT_MULTIPLIER: Record<0 | 1 | 2 | 3, number> = {
  0: 0,
  1: 0.6,
  2: 1.0,
  3: 1.3,
};

/** Traffic bucket ("100+", "1K+", "10K+", "1M+") → a small additive boost. */
export function trafficBoost(traffic: string | null | undefined): number {
  if (!traffic) return 0;
  const match = /([0-9]+(?:\.[0-9]+)?)\s*([kmb])?/i.exec(traffic);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;
  return Math.log10(value * multiplier) / 10;
}

/** One source's contribution: weight / sqrt(rank). */
export function sourceRankScore(weight: number, rank: number): number {
  const safeRank = Math.max(1, Math.floor(rank) || 1);
  return weight / Math.sqrt(safeRank);
}

/** Cross-source bonus for a topic seen in `sourceCount` distinct sources. */
export function crossSourceMultiplier(sourceCount: number): number {
  const distinct = Math.max(1, Math.floor(sourceCount));
  return Math.pow(CROSS_SOURCE_STEP, distinct - 1);
}

/** The rank-and-traffic part of a score, before momentum and stay fit. */
export function baseScore(sources: readonly TrendSourceEvidence[]): number {
  let total = 0;
  const seen = new Set<TrendSourceId>();
  for (const evidence of sources) {
    if (seen.has(evidence.source)) continue;
    seen.add(evidence.source);
    total += sourceRankScore(SOURCE_WEIGHTS[evidence.source] ?? 0.5, evidence.rank);
    total += trafficBoost(evidence.traffic);
  }
  return total * crossSourceMultiplier(seen.size);
}

/** The full score for one topic on one day. */
export function finalScore(input: {
  sources: readonly TrendSourceEvidence[];
  momentum: TrendMomentum;
  stayFit: 0 | 1 | 2 | 3;
}): number {
  const base = baseScore(input.sources);
  const momentum = MOMENTUM_MULTIPLIER[input.momentum] ?? 1;
  const stayFit = STAY_FIT_MULTIPLIER[input.stayFit] ?? 0;
  return round4(base * momentum * stayFit);
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Distinct source count from a set of evidence rows. */
export function distinctSourceCount(sources: readonly TrendSourceEvidence[]): number {
  return new Set(sources.map((entry) => entry.source)).size;
}
