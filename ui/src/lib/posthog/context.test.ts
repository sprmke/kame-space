import { describe, expect, it } from 'vitest';

import {
  setAnalyticsScope,
  clearAnalyticsScope,
  setAnalyticsSignedIn,
  buildSharedAnalyticsProperties,
} from '@/lib/posthog/context';

describe('setAnalyticsScope', () => {
  it('setAnalyticsScope is exported', () => {
    expect(typeof setAnalyticsScope).toBe('function');
  });
});

describe('clearAnalyticsScope', () => {
  it('clearAnalyticsScope is exported', () => {
    expect(typeof clearAnalyticsScope).toBe('function');
  });
});

describe('setAnalyticsSignedIn', () => {
  it('setAnalyticsSignedIn is exported', () => {
    expect(typeof setAnalyticsSignedIn).toBe('function');
  });
});

describe('buildSharedAnalyticsProperties', () => {
  it('buildSharedAnalyticsProperties is exported', () => {
    expect(typeof buildSharedAnalyticsProperties).toBe('function');
  });

  /**
   * Pages used to be split per tenant in PostHog because only the raw pathname was available.
   * The pattern must carry the route, never the slug.
   */
  it('carries a route pattern and never the tenant slug', () => {
    const original = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      location: { pathname: '/org/acme-realty/property/beach-villa/bookings' },
    };
    try {
      const properties = buildSharedAnalyticsProperties();
      expect(properties.route_pattern).toBe('/org/:param/property/:param/bookings');
      expect(JSON.stringify(properties)).not.toContain('acme-realty');
    } finally {
      (globalThis as { window?: unknown }).window = original;
    }
  });
});
