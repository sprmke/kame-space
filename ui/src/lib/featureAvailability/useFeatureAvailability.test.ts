import { describe, expect, it } from 'vitest';

import type { FeatureAvailabilitySnapshot } from '@/lib/featureAvailability/featureAvailabilityApi';

const { selectFeatureAvailabilityEntry } = await import(
  '@/lib/featureAvailability/useFeatureAvailability'
);

function snapshot(
  entries: FeatureAvailabilitySnapshot['entries']
): FeatureAvailabilitySnapshot {
  return { serverNow: '2026-11-08T00:00:00Z', entries, serverSkewMs: 0 };
}

function entry(
  overrides: Partial<FeatureAvailabilitySnapshot['entries'][number]> = {}
): FeatureAvailabilitySnapshot['entries'][number] {
  return {
    key: 'inbox.meta',
    available: false,
    bypassed: false,
    reason: 'maintenance',
    message: '',
    expectedBackAt: null,
    source: 'self',
    showBanner: true,
    updatedAt: '2026-11-08T00:00:00Z',
    ...overrides,
  };
}

describe('selectFeatureAvailabilityEntry', () => {
  it('fails open while the snapshot is missing', () => {
    const view = selectFeatureAvailabilityEntry(undefined, 'inbox.meta');

    expect(view.available).toBe(true);
    expect(view.label).toBe('Facebook and Instagram chat');
    expect(view.showBanner).toBe(false);
    expect(view.tone).toBe('neutral');
  });

  it('fails open when the feature is not in the snapshot', () => {
    const view = selectFeatureAvailabilityEntry(snapshot([entry({ key: 'pricing.channel_sync' })]), 'inbox.meta');

    expect(view.available).toBe(true);
    expect(view.reason).toBeNull();
  });

  it('returns the server verdict and its custom message', () => {
    const view = selectFeatureAvailabilityEntry(
      snapshot([entry({ message: '  Migrating the inbox tonight.  ' })]),
      'inbox.meta'
    );

    expect(view).toMatchObject({
      available: false,
      reason: 'maintenance',
      message: 'Migrating the inbox tonight.',
      label: 'Under maintenance',
      tone: 'amber',
      showBanner: true,
    });
    expect(view.isLoading).toBe(false);
    expect(view.isFetching).toBe(false);
  });

  it('falls back to the reason copy when the server sends no message', () => {
    const view = selectFeatureAvailabilityEntry(snapshot([entry()]), 'inbox.meta');

    expect(view.message).toBe("We're working on this right now. It'll be back soon.");
  });

  it('names the provider from the blocking parent', () => {
    const view = selectFeatureAvailabilityEntry(
      snapshot([
        entry({
          key: 'inbox.meta.reply',
          reason: 'provider_issue',
          source: 'parent',
        }),
      ]),
      'inbox.meta.reply'
    );

    expect(view.message).toBe(
      "Meta is having problems. We'll turn this back on when it's fixed."
    );
  });

  it('ignores a reason the catalog does not know', () => {
    const view = selectFeatureAvailabilityEntry(
      snapshot([entry({ reason: 'deleted' })]),
      'inbox.meta'
    );

    expect(view.reason).toBeNull();
    expect(view.label).toBe('Unavailable');
  });

  it('shows an expected-back label only for a future time', () => {
    const future = selectFeatureAvailabilityEntry(
      snapshot([entry({ expectedBackAt: '2030-01-01T00:00:00Z' })]),
      'inbox.meta'
    );
    expect(future.expectedBackLabel).toBeTruthy();

    const past = selectFeatureAvailabilityEntry(
      snapshot([entry({ expectedBackAt: '2020-01-01T00:00:00Z' })]),
      'inbox.meta'
    );
    expect(past.expectedBackLabel).toBe('Taking longer than expected');
  });

  it('keeps the available flag when a super admin bypass is reported', () => {
    const view = selectFeatureAvailabilityEntry(
      snapshot([entry({ available: true, bypassed: true, reason: null })]),
      'inbox.meta'
    );

    expect(view.available).toBe(true);
    expect(view.bypassed).toBe(true);
  });
});
