import { describe, expect, it } from 'vitest';

import {
  peekPendingAiTrend,
  setPendingAiTrend,
  takePendingAiTrend,
  type PendingAiTrend,
} from '@/features/dashboard/marketing/lib/trends/trendHandoff';

const TREND: PendingAiTrend = {
  topicKey: 'pinoy-big-brother-collab-3-0',
  title: 'PBB Collab 3.0',
  output: 'post',
  angle: {
    title: 'Watch party staycation',
    hook: 'Big night on screen, better from a proper stay.',
    output: 'post',
    goal: 'vibe',
    format: 'instagram-portrait',
    prompt: 'A cozy living room with the TV on. No logos, no people.',
  },
};

describe('marketing trends handoff', () => {
  it('hands the trend over exactly once', () => {
    setPendingAiTrend(TREND);
    expect(peekPendingAiTrend()?.topicKey).toBe('pinoy-big-brother-collab-3-0');
    expect(takePendingAiTrend()).toEqual(TREND);
    expect(takePendingAiTrend()).toBeNull();
  });

  it('keeps the newest trend when one is set twice', () => {
    setPendingAiTrend(TREND);
    setPendingAiTrend({ ...TREND, topicKey: 'christmas' });
    expect(takePendingAiTrend()?.topicKey).toBe('christmas');
  });
});
