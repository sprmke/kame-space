import { describe, expect, it } from 'vitest';

import {
  FEATURE_AVAILABILITY_CATALOG,
  FEATURE_AVAILABILITY_KEYS,
  FEATURE_AVAILABILITY_REASONS,
  FEATURE_AVAILABILITY_REASON_COPY,
  getFeatureAvailabilityAncestors,
  getFeatureAvailabilityCatalogEntry,
  getFeatureAvailabilityChildren,
  isFeatureAvailabilityKey,
  isFeatureAvailabilityReason,
} from '@/lib/featureAvailability/featureAvailabilityCatalog';

describe('feature availability catalog', () => {
  it('has one entry per declared key, with no duplicates', () => {
    const keys = FEATURE_AVAILABILITY_CATALOG.map((entry) => entry.key);
    expect(keys).toHaveLength(FEATURE_AVAILABILITY_KEYS.length);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...FEATURE_AVAILABILITY_KEYS].sort());
  });

  it('points every parent at a real key', () => {
    for (const entry of FEATURE_AVAILABILITY_CATALOG) {
      if (entry.parent === null) continue;
      expect(isFeatureAvailabilityKey(entry.parent)).toBe(true);
    }
  });

  it('never makes a key its own parent or a cycle', () => {
    for (const entry of FEATURE_AVAILABILITY_CATALOG) {
      expect(getFeatureAvailabilityAncestors(entry.key)).not.toContain(entry.key);
    }
  });

  it('gives every entry a label and a description', () => {
    for (const entry of FEATURE_AVAILABILITY_CATALOG) {
      expect(entry.label.trim()).not.toBe('');
      expect(entry.description.trim()).not.toBe('');
    }
  });

  it('builds ancestor chains from the child up', () => {
    expect(getFeatureAvailabilityAncestors('notifications.telegram.delivery')).toEqual([
      'notifications.telegram',
    ]);
    expect(getFeatureAvailabilityAncestors('inbox.meta')).toEqual([]);
  });

  it('lists direct children only', () => {
    expect(getFeatureAvailabilityChildren('inbox.meta')).toEqual([
      'inbox.meta.connect',
      'inbox.meta.reply',
      'inbox.meta.auto_reply',
      'inbox.meta.sync',
    ]);
    expect(getFeatureAvailabilityChildren('pricing.channel_sync')).toEqual([
      'pricing.channel_sync.import',
    ]);
  });

  it('looks up known keys and rejects unknown ones', () => {
    expect(getFeatureAvailabilityCatalogEntry('inbox.meta')?.module).toBe('inbox');
    expect(getFeatureAvailabilityCatalogEntry('inbox.nope')).toBeNull();
    expect(isFeatureAvailabilityKey('marketing.ai_studio')).toBe(true);
    expect(isFeatureAvailabilityKey('marketing.ai_studio.delete')).toBe(false);
  });

  it('describes every reason, and asks for a provider only when the copy needs one', () => {
    expect(Object.keys(FEATURE_AVAILABILITY_REASON_COPY).sort()).toEqual(
      [...FEATURE_AVAILABILITY_REASONS].sort()
    );
    for (const reason of FEATURE_AVAILABILITY_REASONS) {
      const copy = FEATURE_AVAILABILITY_REASON_COPY[reason];
      expect(copy.label.trim()).not.toBe('');
      if (copy.defaultMessage) {
        expect(copy.defaultMessage.includes('{provider}')).toBe(copy.requiresProvider);
      }
    }
  });

  it('narrows reason strings', () => {
    expect(isFeatureAvailabilityReason('maintenance')).toBe(true);
    expect(isFeatureAvailabilityReason('MAINTENANCE')).toBe(false);
    expect(isFeatureAvailabilityReason('deleted')).toBe(false);
  });
});
