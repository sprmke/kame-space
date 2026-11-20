import { describe, expect, it } from 'vitest';

import {
  buildAdminV3Tabs,
  flattenNavigableNavItems,
  resolveAdminV3TabActiveKey,
  resolveBottomTabActiveKey,
  splitAdminBottomNav,
  ASSISTANT_TAB_KEY,
  NOTIFICATIONS_TAB_KEY,
} from '@/features/dashboard/bookings/lib/adminBottomNav';
import { buildPropertyNavSections } from '@/features/dashboard/bookings/lib/adminSidebarNav';

describe('buildAdminV3Tabs', () => {
  it('property scope is Today · Bookings · Inbox · Work · You', () => {
    const tabs = buildAdminV3Tabs({
      scope: 'property',
      basePath: '/org/acme/property/solea',
    });
    expect(tabs.map((t) => t.label)).toEqual(['Today', 'Bookings', 'Inbox', 'Work', 'You']);
    expect(tabs.map((t) => t.href)).toEqual([
      '/org/acme/property/solea',
      '/org/acme/property/solea/bookings',
      '/org/acme/property/solea/inbox',
      '/org/acme/property/solea/work',
      '/org/acme/property/solea/you',
    ]);
  });

  it('org scope is Today · Bookings · Alerts · Work · You', () => {
    const tabs = buildAdminV3Tabs({
      scope: 'org',
      basePath: '/org/acme',
    });
    expect(tabs.map((t) => t.label)).toEqual(['Today', 'Bookings', 'Alerts', 'Work', 'You']);
    expect(tabs[2]?.href).toBe('/org/acme/alerts');
  });

  it('super-admin scope is Overview · Approvals · Orgs · Support · Console', () => {
    const tabs = buildAdminV3Tabs({
      scope: 'super-admin',
      basePath: '/admin',
    });
    expect(tabs.map((t) => t.label)).toEqual([
      'Overview',
      'Approvals',
      'Orgs',
      'Support',
      'Console',
    ]);
  });
});

describe('resolveAdminV3TabActiveKey', () => {
  it('maps property finance to work', () => {
    expect(resolveAdminV3TabActiveKey('/org/acme/property/solea/finance')).toBe('work');
  });

  it('maps org alerts to alerts', () => {
    expect(resolveAdminV3TabActiveKey('/org/acme/alerts')).toBe('alerts');
  });
});

describe('flattenNavigableNavItems', () => {
  it('returns href items from property nav', () => {
    const items = flattenNavigableNavItems(buildPropertyNavSections('acme', 'solea'));
    expect(items.length).toBeGreaterThan(3);
    expect(items.every((item) => item.href)).toBe(true);
  });
});

describe('legacy splitAdminBottomNav', () => {
  it('still builds a More tab for prefetch tests', () => {
    const { tabItems } = splitAdminBottomNav(buildPropertyNavSections('acme', 'solea'), {
      onMoreClick: () => undefined,
    });
    expect(tabItems.some((item) => item.key === 'more')).toBe(true);
  });
});

describe('legacy keys', () => {
  it('keeps deprecated overlay key symbols', () => {
    expect(ASSISTANT_TAB_KEY).toBe('assistant');
    expect(NOTIFICATIONS_TAB_KEY).toBe('notifications');
    expect(resolveBottomTabActiveKey('/x', ['/x'], true)).toBe('more');
  });
});
