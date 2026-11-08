import { describe, expect, it } from 'vitest';

import { FEATURE_AVAILABILITY_CATALOG } from '@/lib/featureAvailability/featureAvailabilityCatalog';
import {
  resolveFeatureAvailability,
  type FeatureAvailabilityOverrideRow,
} from '@/lib/featureAvailability/resolveFeatureAvailability';

const NOW = new Date('2026-11-08T12:00:00Z');

function row(overrides: Partial<FeatureAvailabilityOverrideRow> = {}): FeatureAvailabilityOverrideRow {
  return {
    feature_key: 'inbox.meta',
    is_enabled: false,
    reason: 'maintenance',
    message: null,
    expected_back_at: null,
    auto_restore: false,
    show_banner: true,
    super_admin_bypass: false,
    ...overrides,
  };
}

function resolve(rows: FeatureAvailabilityOverrideRow[]) {
  return resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, NOW);
}

describe('resolveFeatureAvailability', () => {
  it('returns every catalog key, available when nothing overrides it', () => {
    const resolved = resolve([]);

    expect(resolved.size).toBe(FEATURE_AVAILABILITY_CATALOG.length);
    expect(resolved.get('inbox.meta')).toMatchObject({
      available: true,
      source: null,
      sourceKey: null,
      reason: null,
      overdue: false,
    });
  });

  it('turns a key off from its own row', () => {
    const resolved = resolve([row({ expected_back_at: '2026-11-09T00:00:00Z' })]);

    expect(resolved.get('inbox.meta')).toMatchObject({
      available: false,
      source: 'self',
      sourceKey: 'inbox.meta',
      reason: 'maintenance',
      showBanner: true,
    });
  });

  it('cascades a disabled parent onto its children', () => {
    const resolved = resolve([
      row({ feature_key: 'notifications.telegram', reason: 'provider_issue' }),
    ]);

    for (const child of [
      'notifications.telegram.settings',
      'notifications.telegram.delivery',
    ] as const) {
      expect(resolved.get(child)).toMatchObject({
        available: false,
        source: 'parent',
        sourceKey: 'notifications.telegram',
        reason: 'provider_issue',
      });
    }
  });

  it('leaves unrelated branches alone', () => {
    const resolved = resolve([row({ feature_key: 'inbox.meta' })]);

    expect(resolved.get('pricing.channel_sync')?.available).toBe(true);
    expect(resolved.get('marketing.ai_studio')?.available).toBe(true);
  });

  it('lets a disabled parent win over an explicitly enabled child', () => {
    const resolved = resolve([
      row({ feature_key: 'inbox.meta' }),
      row({ feature_key: 'inbox.meta.reply', is_enabled: true }),
    ]);

    expect(resolved.get('inbox.meta.reply')).toMatchObject({
      available: false,
      source: 'parent',
      sourceKey: 'inbox.meta',
    });
    expect(resolved.get('inbox.meta.connect')?.available).toBe(false);
  });

  it('auto-restores a row once its expected-back time has passed', () => {
    const resolved = resolve([
      row({
        auto_restore: true,
        expected_back_at: '2026-11-08T09:00:00Z',
      }),
    ]);

    expect(resolved.get('inbox.meta')).toMatchObject({
      available: true,
      restoredAutomatically: true,
    });
  });

  it('keeps an auto-restore row off until the expected-back time arrives', () => {
    const resolved = resolve([
      row({ auto_restore: true, expected_back_at: '2026-11-10T09:00:00Z' }),
    ]);

    expect(resolved.get('inbox.meta')).toMatchObject({ available: false, overdue: false });
  });

  it('flags a manual-off row whose expected-back time has passed as overdue', () => {
    const resolved = resolve([
      row({ auto_restore: false, expected_back_at: '2026-11-01T09:00:00Z' }),
    ]);

    expect(resolved.get('inbox.meta')).toMatchObject({ available: false, overdue: true });
  });

  it('drops an unknown reason instead of passing it through', () => {
    const resolved = resolve([row({ reason: 'deleted' })]);

    expect(resolved.get('inbox.meta')?.reason).toBeNull();
  });

  it('ignores rows for keys outside the catalog', () => {
    const resolved = resolve([row({ feature_key: 'inbox.meta.unknown' })]);

    expect(resolved.has('inbox.meta.unknown' as never)).toBe(false);
    expect(resolved.get('inbox.meta')?.available).toBe(true);
  });
});
