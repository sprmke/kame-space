import { describe, expect, it } from 'vitest';

import {
  flattenNavigableNavItems,
  resolveBottomTabActiveKey,
  splitAdminBottomNav,
} from '@/features/dashboard/bookings/lib/adminBottomNav';
import { buildOrgNavSections, buildPropertyNavSections } from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { MORE_TAB_KEY } from '@/components/mobile/BottomTabBar';

describe('flattenNavigableNavItems', () => {
  it('returns href items only', () => {
    const sections = buildOrgNavSections('acme');
    const items = flattenNavigableNavItems(sections);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => Boolean(item.href))).toBe(true);
  });
});

describe('splitAdminBottomNav', () => {
  it('uses route tabs plus More only (Quick Access is the FAB)', () => {
    const { tabItems, primaryHrefs } = splitAdminBottomNav(buildPropertyNavSections('acme', 'home'), {
      onMoreClick: () => {},
    });

    expect(primaryHrefs.length).toBeGreaterThan(0);
    expect(tabItems.at(-1)?.key).toBe(MORE_TAB_KEY);
    expect(tabItems.some((item) => item.key === 'tools')).toBe(false);
    expect(tabItems.some((item) => item.key === 'notifications')).toBe(false);
    expect(tabItems.some((item) => item.key === 'assistant')).toBe(false);
    expect(tabItems.filter((item) => item.href).length).toBe(primaryHrefs.length);
  });
});

describe('resolveBottomTabActiveKey', () => {
  it('prefers More, then overlay, then a primary href', () => {
    expect(resolveBottomTabActiveKey('/org/acme', ['/org/acme'], true, 'notifications')).toBe(
      MORE_TAB_KEY
    );
    expect(resolveBottomTabActiveKey('/org/acme', ['/org/acme'], false, 'notifications')).toBe(
      'notifications'
    );
    expect(resolveBottomTabActiveKey('/org/acme', ['/org/acme'], false, null)).toBe('/org/acme');
  });
});
