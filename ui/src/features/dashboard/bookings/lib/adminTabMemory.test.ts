/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearAdminTabPath,
  recallAdminTabPath,
  rememberAdminTabPath,
} from '@/features/dashboard/bookings/lib/adminTabMemory';

describe('adminTabMemory', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('remembers and recalls a deep path per tab', () => {
    rememberAdminTabPath(
      'property',
      '/org/acme/property/solea',
      'work',
      '/org/acme/property/solea/finance'
    );
    expect(recallAdminTabPath('property', '/org/acme/property/solea', 'work')).toBe(
      '/org/acme/property/solea/finance'
    );
  });

  it('clears a remembered path', () => {
    rememberAdminTabPath(
      'property',
      '/org/acme/property/solea',
      'work',
      '/org/acme/property/solea/finance'
    );
    clearAdminTabPath('property', '/org/acme/property/solea', 'work');
    expect(recallAdminTabPath('property', '/org/acme/property/solea', 'work')).toBeNull();
  });
});

