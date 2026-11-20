import { describe, expect, it } from 'vitest';

import {
  resolveQuickAccessPaths,
  resolveQuickAccessScope,
} from '@/features/dashboard/bookings/lib/adminQuickAccess';

describe('resolveQuickAccessScope', () => {
  it('detects parking, property, and org scopes', () => {
    expect(resolveQuickAccessScope('/org/acme/parking/slot-1/pricing')).toBe('parking');
    expect(resolveQuickAccessScope('/org/acme/property/home/bookings')).toBe('property');
    expect(resolveQuickAccessScope('/org/acme/dashboard')).toBe('org');
  });
});

describe('resolveQuickAccessPaths', () => {
  it('resolves property inbox and help paths', () => {
    expect(
      resolveQuickAccessPaths({
        scope: 'property',
        orgSlug: 'acme',
        propertySlug: 'home',
      })
    ).toEqual({
      messagesHref: '/org/acme/property/home/messages',
      helpHref: '/org/acme/property/home/help-support',
    });
  });

  it('resolves parking inbox and help paths', () => {
    expect(
      resolveQuickAccessPaths({
        scope: 'parking',
        orgSlug: 'acme',
        parkingSlug: 'slot-1',
      })
    ).toEqual({
      messagesHref: '/org/acme/parking/slot-1/messages',
      helpHref: '/org/acme/parking/slot-1/help-support',
    });
  });

  it('resolves org help without messages', () => {
    expect(
      resolveQuickAccessPaths({
        scope: 'org',
        orgSlug: 'acme',
      })
    ).toEqual({
      messagesHref: null,
      helpHref: '/org/acme/help-support',
    });
  });

  it('returns nulls without an org slug', () => {
    expect(resolveQuickAccessPaths({ scope: 'org', orgSlug: null })).toEqual({
      messagesHref: null,
      helpHref: null,
    });
  });
});
