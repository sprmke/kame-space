import { describe, expect, it } from 'vitest';

import {
  detectAnalyticsEnvironment,
  detectAppTrack,
  isLoopbackHost,
  resolvePostHogApiHost,
} from '@/lib/posthog/env';

describe('detectAnalyticsEnvironment', () => {
  it('detectAnalyticsEnvironment is exported', () => {
    expect(typeof detectAnalyticsEnvironment).toBe('function');
  });
});

describe('isLoopbackHost', () => {
  it('recognises developer machines, including a production build served locally', () => {
    for (const host of [
      'localhost',
      'LocalHost',
      '127.0.0.1',
      '[::1]',
      '::1',
      'app.local',
      'x.localhost',
    ]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
  });

  it('does not flag real hosts', () => {
    for (const host of ['kamespace.com', 'kame-homes.vercel.app', 'preview.kamespace.com']) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });
});

describe('detectAppTrack', () => {
  it('detectAppTrack is exported', () => {
    expect(typeof detectAppTrack).toBe('function');
  });
});

describe('resolvePostHogApiHost', () => {
  it('resolvePostHogApiHost is exported', () => {
    expect(typeof resolvePostHogApiHost).toBe('function');
  });
});
