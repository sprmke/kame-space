import { describe, expect, it } from 'vitest';

import {
  PULL_REFRESH_DISTANCE,
  pullRefreshArmed,
  pullRefreshClamped,
  swipeShouldSnapOpen,
} from '@/components/mobile/native/gestureThresholds';

describe('gestureThresholds', () => {
  it('snaps open past 30% width', () => {
    expect(swipeShouldSnapOpen(90, 300, 0)).toBe(true);
    expect(swipeShouldSnapOpen(60, 300, 0)).toBe(false);
  });

  it('commits on fast velocity', () => {
    expect(swipeShouldSnapOpen(20, 300, 0.6)).toBe(true);
    expect(swipeShouldSnapOpen(4, 300, 0.6)).toBe(false);
  });

  it('arms and clamps pull to refresh', () => {
    expect(pullRefreshArmed(47)).toBe(false);
    expect(pullRefreshArmed(48)).toBe(true);
    expect(pullRefreshClamped(100)).toBe(PULL_REFRESH_DISTANCE);
    expect(pullRefreshClamped(-10)).toBe(0);
  });
});
