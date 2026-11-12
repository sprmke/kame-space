import { describe, expect, it } from 'vitest';

import { patternIsSanitized, routePatternFor } from './routePattern';

const CASES: ReadonlyArray<readonly [string, string]> = [
  ['/', '/'],
  ['/org/acme', '/org/:param'],
  ['/org/acme/property/villa', '/org/:param/property/:param'],
  ['/org/acme/property/villa/bookings', '/org/:param/property/:param/bookings'],
  ['/org/acme/property/villa/settings', '/org/:param/property/:param/settings'],
  ['/org/acme/property/villa/team', '/org/:param/property/:param/team'],
  ['/org/acme/parking/lot-1', '/org/:param/parking/:param'],
  ['/properties/kame-home-2604', '/properties/:param'],
  ['/calendar', '/calendar'],
  ['/for-hosts/pricing', '/for-hosts/pricing'],
  ['/bookings/2f1c9e40-0d2a-4a11-9c6b-1f5e0d7c9a11', '/bookings/:param'],
  ['/trips/2f1c9e40-0d2a-4a11-9c6b-1f5e0d7c9a11', '/trips/:param'],
];

describe('routePatternFor', () => {
  for (const [pathname, expected] of CASES) {
    it(`maps ${pathname} to ${expected}`, () => {
      expect(routePatternFor(pathname)).toBe(expected);
    });
  }

  it('collapses a tenant slug so pages are not split per property', () => {
    expect(routePatternFor('/org/acme/property/villa/bookings')).toBe(
      routePatternFor('/org/other/property/second-house/bookings')
    );
  });

  it('never leaves a slug, id or email in the pattern', () => {
    const pathnames = [
      ...CASES.map(([pathname]) => pathname),
      '/org/acme/property/villa/pages/juan.delacruz@example.com',
      '/admin/organizations/9f8e7d6c5b4a39281706f5e4d3c2b1a0',
      '/form/2f1c9e40-0d2a-4a11-9c6b-1f5e0d7c9a11',
    ];
    for (const pathname of pathnames) {
      const pattern = routePatternFor(pathname);
      expect(patternIsSanitized(pattern, pathname)).toBe(true);
      expect(pattern).not.toContain('acme');
      expect(pattern).not.toContain('example.com');
    }
  });

  it('is idempotent', () => {
    for (const [pathname] of CASES) {
      const once = routePatternFor(pathname);
      expect(routePatternFor(once)).toBe(once);
    }
  });
});
