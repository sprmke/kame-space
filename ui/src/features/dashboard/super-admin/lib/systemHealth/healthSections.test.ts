import { describe, expect, it } from 'vitest';

import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';
import {
  HEALTH_SECTIONS,
  healthSectionPath,
  parseHealthSection,
} from '@/features/dashboard/super-admin/lib/systemHealth/healthSections';

describe('HEALTH_SECTIONS', () => {
  it('lists unique ids with labels, overview first', () => {
    const ids = HEALTH_SECTIONS.map((section) => section.id);

    expect(ids[0]).toBe('overview');
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of HEALTH_SECTIONS) {
      expect(section.label.trim()).not.toBe('');
    }
  });
});

describe('parseHealthSection', () => {
  it('defaults to overview when the query param is missing', () => {
    expect(parseHealthSection(undefined)).toBe('overview');
    expect(parseHealthSection('')).toBe('overview');
  });

  it('accepts a known section', () => {
    expect(parseHealthSection('jobs')).toBe('jobs');
  });

  it('returns null for an unknown section so the page can 404', () => {
    expect(parseHealthSection('billing')).toBeNull();
  });
});

describe('healthSectionPath', () => {
  it('keeps overview at the base health route', () => {
    expect(healthSectionPath('overview')).toBe(superAdminPaths.health);
  });

  it('appends the section for every other tab', () => {
    expect(healthSectionPath('configuration')).toBe('/admin/health/configuration');
    expect(healthSectionPath('usage')).toBe('/admin/health/usage');
  });
});
