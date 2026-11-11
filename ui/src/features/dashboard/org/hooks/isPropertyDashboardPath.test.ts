import { describe, expect, it } from 'vitest';

import { isPropertyDashboardPath } from './useSessionBootstrap';

/**
 * The boot prefetch of `dashboard-stats` only belongs on the property dashboard. Matching with a
 * prefix would quietly add a request to every property route, which is the class of waste this
 * whole pass exists to remove.
 */
describe('isPropertyDashboardPath', () => {
  it('matches the dashboard itself', () => {
    expect(isPropertyDashboardPath('/org/acme/property/villa', 'acme', 'villa')).toBe(true);
  });

  it('ignores a trailing slash', () => {
    expect(isPropertyDashboardPath('/org/acme/property/villa/', 'acme', 'villa')).toBe(true);
  });

  it('does not match a child route', () => {
    expect(isPropertyDashboardPath('/org/acme/property/villa/bookings', 'acme', 'villa')).toBe(
      false
    );
    expect(isPropertyDashboardPath('/org/acme/property/villa/settings', 'acme', 'villa')).toBe(
      false
    );
  });

  it('does not match an org or parking route', () => {
    expect(isPropertyDashboardPath('/org/acme', 'acme', undefined)).toBe(false);
    expect(isPropertyDashboardPath('/org/acme/parking/lot-1', 'acme', undefined)).toBe(false);
  });

  it('does not match a different property', () => {
    expect(isPropertyDashboardPath('/org/acme/property/other', 'acme', 'villa')).toBe(false);
  });
});
