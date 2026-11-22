import { describe, expect, it } from 'vitest';

import {
  GUEST_ACCOUNT_NAV_GROUPS,
  GUEST_ACCOUNT_NAV_ITEMS,
  resolveGuestAccountNavItem,
} from '@/features/guest/account/lib/guestAccountNav';

describe('GUEST_ACCOUNT_NAV_GROUPS', () => {
  it('splits guest destinations into Account, Trips, and Help', () => {
    expect(GUEST_ACCOUNT_NAV_GROUPS.map((group) => group.label)).toEqual([
      'Account',
      'Trips',
      'Help',
    ]);
    expect(GUEST_ACCOUNT_NAV_GROUPS.map((group) => group.items.map((item) => item.label))).toEqual([
      ['Profile', 'Favorites', 'Vouchers'],
      ['Trips', 'Messages', 'Reviews'],
      ['Tickets', 'Help'],
    ]);
  });

  it('keeps the flat list in the same order for sidebar and mobile nav', () => {
    expect(GUEST_ACCOUNT_NAV_ITEMS.map((item) => item.label)).toEqual([
      'Profile',
      'Favorites',
      'Vouchers',
      'Trips',
      'Messages',
      'Reviews',
      'Tickets',
      'Help',
    ]);
  });
});

describe('resolveGuestAccountNavItem', () => {
  it('resolveGuestAccountNavItem is exported', () => {
    expect(typeof resolveGuestAccountNavItem).toBe('function');
  });

  it('matches nested ticket routes to Tickets', () => {
    expect(resolveGuestAccountNavItem('/account/tickets/abc').label).toBe('Tickets');
  });
});
