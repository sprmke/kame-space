import { describe, expect, it } from 'vitest';

import {
  buildOrgNavSections,
  buildPropertyNavSections,
  buildParkingNavSections,
} from '@/features/dashboard/bookings/lib/adminSidebarNav';
import { ADMIN_MODULE_LABEL } from '@/features/dashboard/bookings/lib/adminModuleLabels';

function sectionLabels(sections: ReturnType<typeof buildPropertyNavSections>) {
  return sections.map((section) => section.label);
}

function flatItemLabels(sections: ReturnType<typeof buildPropertyNavSections>) {
  return sections.flatMap((section) => section.items.map((item) => item.label));
}

describe('buildPropertyNavSections', () => {
  it('uses grouped section labels and property module order', () => {
    const sections = buildPropertyNavSections('acme', 'monaco');
    expect(sectionLabels(sections)).toEqual(['Operations', 'Guests', 'Growth', 'Manage']);
    expect(flatItemLabels(sections)).toEqual([
      'Dashboard',
      'Bookings',
      'Finance',
      'Maintenance',
      ADMIN_MODULE_LABEL.pricing,
      ADMIN_MODULE_LABEL.inbox,
      'Reviews',
      'Notifications',
      'Templates',
      'Analytics',
      'Marketing',
      'Public Pages',
      'Team',
      'Settings',
      'Help & Support',
    ]);
  });
});

describe('buildOrgNavSections', () => {
  it('uses grouped section labels and org module order', () => {
    const sections = buildOrgNavSections('acme');
    expect(sectionLabels(sections)).toEqual(['Overview', 'Listings', 'Organization']);
    expect(flatItemLabels(sections)).toEqual([
      'Dashboard',
      'Bookings',
      'Reviews',
      'Analytics',
      'Properties',
      'Parkings',
      'Team',
      'Plans & Billing',
      'Announcements',
      'Settings',
      'Help & Support',
    ]);
  });

  it('omits the Listings group when properties and parkings are hidden', () => {
    const sections = buildOrgNavSections('acme', {
      showProperties: false,
      showParkings: false,
    });
    expect(sectionLabels(sections)).toEqual(['Overview', 'Organization']);
  });
});

describe('buildParkingNavSections', () => {
  it('uses grouped section labels and parking module order', () => {
    const sections = buildParkingNavSections('acme', 'slot-1');
    expect(sectionLabels(sections)).toEqual(['Operations', 'Guests', 'Manage']);
    expect(flatItemLabels(sections)).toEqual([
      'Dashboard',
      'Bookings',
      'Finance',
      ADMIN_MODULE_LABEL.pricing,
      ADMIN_MODULE_LABEL.inbox,
      'Notifications',
      'Team',
      'Settings',
      'Help & Support',
    ]);
  });
});
