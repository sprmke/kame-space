import { describe, expect, it } from 'vitest';

import {
  auditActionLabel,
  auditTargetLabel,
} from '@/features/dashboard/super-admin/lib/superAdminAuditLabels';

describe('auditActionLabel', () => {
  it('maps known action keys to operator copy', () => {
    expect(auditActionLabel('pricing_plan_updated')).toBe('Pricing plan updated');
    expect(auditActionLabel('help_center.faq_updated')).toBe('FAQ updated');
  });

  it('humanizes an unknown key instead of exposing snake_case', () => {
    expect(auditActionLabel('new_thing.created')).toBe('New thing created');
  });
});

describe('auditTargetLabel', () => {
  it('maps known target types', () => {
    expect(auditTargetLabel('organization')).toBe('Organization');
    expect(auditTargetLabel('help_center_faq')).toBe('FAQ');
  });

  it('returns null when there is no target', () => {
    expect(auditTargetLabel(null)).toBeNull();
  });

  it('humanizes an unknown target type', () => {
    expect(auditTargetLabel('some_new_target')).toBe('Some new target');
  });
});
