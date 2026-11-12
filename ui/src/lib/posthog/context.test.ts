import { describe, expect, it } from 'vitest';

import {
  setAnalyticsScope,
  clearAnalyticsScope,
  setAnalyticsSignedIn,
  buildSharedAnalyticsProperties,
  surfaceForPath,
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

describe('surfaceForPath', () => {
  it('maps each audience to one surface', () => {
    expect(surfaceForPath('/admin/ops-reports')).toBe('super_admin');
    expect(surfaceForPath('/account/trips')).toBe('guest_account');
    expect(surfaceForPath('/org/acme/parking/lot-1')).toBe('parking_dashboard');
    expect(surfaceForPath('/org/acme/property/villa/bookings')).toBe('host_dashboard');
    expect(surfaceForPath('/properties/villa/form')).toBe('guest_ops');
    expect(surfaceForPath('/for-hosts/pricing')).toBe('marketing');
  });
});
