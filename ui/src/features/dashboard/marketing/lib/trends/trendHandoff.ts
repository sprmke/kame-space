/**
 * Marketing Trends — one-shot handoff into a new AI Studio creation.
 *
 * The host taps an angle in the Trends sheet. The sheet fills this pending
 * slot and navigates to a new creation; the create form picks it up once and
 * shows a removable "Trend: ..." chip.
 *
 * Same pattern as the start-photo handoff (`aiStudioHandoff.ts`): no URL, no
 * global state, consumed exactly once.
 */

import type { TrendAngle, TrendOutput } from './trendTypes';

export type PendingAiTrend = {
  /** The topic key the server uses to load the topic. */
  topicKey: string;
  /** The topic title, shown on the chip. */
  title: string;
  /** The angle the host picked. */
  angle: TrendAngle;
  /** The output the angle asks for. */
  output: TrendOutput;
};

let pending: PendingAiTrend | null = null;

export function setPendingAiTrend(trend: PendingAiTrend): void {
  pending = trend;
}

export function takePendingAiTrend(): PendingAiTrend | null {
  const trend = pending;
  pending = null;
  return trend;
}

/** Peek without consuming. Used by the chip so it survives a re-render. */
export function peekPendingAiTrend(): PendingAiTrend | null {
  return pending;
}
