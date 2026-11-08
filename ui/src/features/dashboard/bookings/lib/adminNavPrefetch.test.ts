import { describe, expect, it } from 'vitest';

import { splitAdminBottomNav } from '@/features/dashboard/bookings/lib/adminBottomNav';
import {
  ORG_NAV_PREFETCH,
  PARKING_NAV_PREFETCH,
  PROPERTY_NAV_PREFETCH,
  resolveAdminNavPrefetch,
} from '@/features/dashboard/bookings/lib/adminNavPrefetch';
import {
  buildOrgNavSections,
  buildParkingNavSections,
  buildPropertyNavSections,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';

/**
 * The phone tab bar warms its target chunk on pointer-down (`AdminLayout`). That only
 * works while every primary tab href resolves to a loader here, and resolves to the
 * loader for the *right* scope. A single trailing-segment map used to hand the org
 * bookings tab the property bookings chunk, which fetched bytes that were never used.
 */

const noOverlays = { onMoreClick: () => {} };

const SCOPES = [
  {
    name: 'org',
    href: (section: string) => `/org/acme/${section}`,
    map: ORG_NAV_PREFETCH,
    sections: () => buildOrgNavSections('acme'),
  },
  {
    name: 'property',
    href: (section: string) => `/org/acme/property/one/${section}`,
    map: PROPERTY_NAV_PREFETCH,
    sections: () => buildPropertyNavSections('acme', 'one'),
  },
  {
    name: 'parking',
    href: (section: string) => `/org/acme/parking/one/${section}`,
    map: PARKING_NAV_PREFETCH,
    sections: () => buildParkingNavSections('acme', 'one'),
  },
] as const;

describe('resolveAdminNavPrefetch', () => {
  for (const scope of SCOPES) {
    it(`resolves every ${scope.name} segment to its own map entry`, () => {
      for (const segment of Object.keys(scope.map)) {
        expect(resolveAdminNavPrefetch(scope.href(segment)), segment).toBe(scope.map[segment]);
      }
    });
  }

  it('picks the map from the path shape, not from a substring', () => {
    // An org slug containing "parking" must not select the parking map.
    expect(resolveAdminNavPrefetch('/org/parking-team/bookings')).toBe(ORG_NAV_PREFETCH.bookings);
    expect(resolveAdminNavPrefetch('/org/acme/parking/one/bookings')).toBe(
      PARKING_NAV_PREFETCH.bookings
    );
  });

  it('treats a scoped base path as the dashboard', () => {
    expect(resolveAdminNavPrefetch('/org/acme/property/one')).toBe(PROPERTY_NAV_PREFETCH.dashboard);
    expect(resolveAdminNavPrefetch('/org/acme/parking/one')).toBe(PARKING_NAV_PREFETCH.dashboard);
  });

  it('returns null for a detail route, which is never a nav target', () => {
    expect(resolveAdminNavPrefetch('/org/acme/property/one/bookings/abc123')).toBeNull();
  });

  it('does not reuse a property chunk for an org section with the same name', () => {
    expect(resolveAdminNavPrefetch('/org/acme/bookings')).not.toBe(
      resolveAdminNavPrefetch('/org/acme/property/one/bookings')
    );
  });

  it('returns null for an unknown section instead of guessing', () => {
    expect(resolveAdminNavPrefetch('/org/acme/property/one/not-a-real-section')).toBeNull();
    expect(resolveAdminNavPrefetch('/org/acme/not-a-real-section')).toBeNull();
    expect(resolveAdminNavPrefetch('/')).toBeNull();
    expect(resolveAdminNavPrefetch('')).toBeNull();
  });
});

describe('primary phone tabs', () => {
  for (const scope of SCOPES) {
    it(`every ${scope.name} primary tab has a prefetch loader`, () => {
      const { primaryHrefs } = splitAdminBottomNav(scope.sections(), noOverlays);

      expect(primaryHrefs.length).toBeGreaterThan(0);
      for (const href of primaryHrefs) {
        expect(resolveAdminNavPrefetch(href), `no prefetch loader for ${href}`).not.toBeNull();
      }
    });
  }

  it('never attaches a prefetch handler to a tab that is not a route', () => {
    const { tabItems } = splitAdminBottomNav(buildOrgNavSections('acme'), {
      onMoreClick: () => {},
      notifications: { onClick: () => {} },
      assistant: { onClick: () => {} },
    });

    // More / Notifications / Assistant are buttons. `notifications` does exist as a
    // route segment, so the guard has to be "no href", which is what AdminLayout checks
    // before attaching `onIntent`.
    const nonRoute = tabItems.filter((item) => !item.href);
    expect(nonRoute.length).toBeGreaterThan(0);
    for (const item of nonRoute) {
      expect(item.onIntent).toBeUndefined();
    }
  });
});
