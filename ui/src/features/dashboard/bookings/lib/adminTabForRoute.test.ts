import { describe, expect, it } from 'vitest';

import {
  adminTabForRoute,
  adminTabScope,
  type AdminTabKey,
} from '@/features/dashboard/bookings/lib/adminTabForRoute';

const P = '/org/acme/property/solea';
const K = '/org/acme/parking/monaco';
const O = '/org/acme';

describe('adminTabForRoute: property and parking scope', () => {
  const cases: [string, AdminTabKey][] = [
    [P, 'today'],
    [`${P}/`, 'today'],
    [`${P}/bookings`, 'bookings'],
    [`${P}/bookings/abc-123`, 'bookings'],
    [`${P}/inbox`, 'inbox'],
    [`${P}/notifications`, 'inbox'],
    [`${P}/notifications?module=staff`, 'inbox'],
    [`${P}/finance`, 'work'],
    [`${P}/maintenance`, 'work'],
    [`${P}/pricing`, 'work'],
    [`${P}/pricing/calendar`, 'work'],
    [`${P}/calendar`, 'work'],
    [`${P}/analytics`, 'work'],
    [`${P}/marketing`, 'work'],
    [`${P}/reviews`, 'work'],
    [`${P}/templates`, 'work'],
    [`${P}/public-pages`, 'work'],
    [`${P}/public-pages/p1/edit`, 'work'],
    [`${P}/team`, 'work'],
    [`${P}/activity`, 'work'],
    [`${P}/announcements`, 'work'],
    [`${P}/announcements/a1`, 'work'],
    [`${P}/settings`, 'work'],
    [`${P}/work`, 'work'],
    [`${P}/you`, 'you'],
    [`${P}/plans`, 'you'],
    [`${P}/help-support`, 'you'],
    [`${P}/help-support/tickets/t1`, 'you'],
    [`${P}/something-new`, 'work'],
    [K, 'today'],
    [`${K}/bookings`, 'bookings'],
    [`${K}/bookings/b1`, 'bookings'],
    [`${K}/inbox`, 'inbox'],
    [`${K}/notifications`, 'inbox'],
    [`${K}/finance`, 'work'],
    [`${K}/pricing`, 'work'],
    [`${K}/settings`, 'work'],
    [`${K}/team`, 'work'],
    [`${K}/help-support`, 'you'],
  ];
  it.each(cases)('%s -> %s', (path, tab) => {
    expect(adminTabForRoute(path)).toBe(tab);
  });
});

describe('adminTabForRoute: org scope', () => {
  const cases: [string, AdminTabKey][] = [
    [O, 'today'],
    [`${O}/dashboard`, 'today'],
    [`${O}/bookings`, 'bookings'],
    [`${O}/inbox`, 'alerts'],
    [`${O}/alerts`, 'alerts'],
    [`${O}/notifications`, 'alerts'],
    [`${O}/reviews`, 'work'],
    [`${O}/analytics`, 'work'],
    [`${O}/properties`, 'work'],
    [`${O}/parkings`, 'work'],
    [`${O}/team`, 'work'],
    [`${O}/settings`, 'work'],
    [`${O}/activity`, 'work'],
    [`${O}/announcements`, 'work'],
    [`${O}/work`, 'work'],
    [`${O}/you`, 'you'],
    [`${O}/plans`, 'you'],
    [`${O}/help-support`, 'you'],
    [`${O}/help-support/docs`, 'you'],
  ];
  it.each(cases)('%s -> %s', (path, tab) => {
    expect(adminTabForRoute(path)).toBe(tab);
  });

  it('does not mistake a property or parking path for the org', () => {
    expect(adminTabScope(`${O}/property/solea/bookings`)).toBe('property');
    expect(adminTabScope(`${O}/parking/monaco/bookings`)).toBe('parking');
    expect(adminTabScope(`${O}/bookings`)).toBe('org');
  });
});

describe('adminTabForRoute: super-admin', () => {
  const cases: [string, AdminTabKey][] = [
    ['/admin', 'overview'],
    ['/admin/', 'overview'],
    ['/admin/approvals', 'approvals'],
    ['/admin/orgs', 'orgs'],
    ['/admin/orgs/acme', 'orgs'],
    ['/admin/orgs/acme/anything', 'orgs'],
    ['/admin/hosts', 'orgs'],
    ['/admin/hosts/h1', 'orgs'],
    ['/admin/support', 'support'],
    ['/admin/support/faqs', 'support'],
    ['/admin/health', 'console'],
    ['/admin/ai', 'console'],
    ['/admin/audit', 'console'],
    ['/admin/pricing/plans', 'console'],
    ['/admin/parking/payouts', 'console'],
    ['/admin/never-seen-before', 'console'],
  ];
  it.each(cases)('%s -> %s', (path, tab) => {
    expect(adminTabForRoute(path)).toBe(tab);
  });
});

describe('adminTabForRoute: outside the admin shell', () => {
  it.each(['/', '/properties', '/parkings/solea', '/account/trips', '/sign-in', '/dashboard', ''])(
    '%s -> null',
    (path) => {
      expect(adminTabForRoute(path)).toBeNull();
      expect(adminTabScope(path)).toBeNull();
    }
  );

  it('does not treat a guest property page as the admin property scope', () => {
    expect(adminTabForRoute('/properties/solea/trip')).toBeNull();
  });
});
