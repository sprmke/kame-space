import { describe, expect, it } from 'vitest';

import {
  readSetupGuidePersistedState,
  mergeSetupGuidePersistedState,
  setupGuidePatchFromWriteResult,
  setupGuideSessionSnoozeKey,
  isSetupGuideSessionSnoozed,
  setSetupGuideSessionSnoozed,
} from '@/features/dashboard/setup-guide/lib/setupGuideState';
import { EMPTY_SETUP_GUIDE_STATE } from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

describe('readSetupGuidePersistedState', () => {
  it('readSetupGuidePersistedState is exported', () => {
    expect(typeof readSetupGuidePersistedState).toBe('function');
  });
});

describe('mergeSetupGuidePersistedState', () => {
  it('merges a partial patch over the empty state', () => {
    expect(
      mergeSetupGuidePersistedState(EMPTY_SETUP_GUIDE_STATE, { dismissedAt: '2026-01-01' })
    ).toMatchObject({ dismissedAt: '2026-01-01', completedAt: null });
  });
});

describe('setupGuidePatchFromWriteResult', () => {
  it('returns an empty patch when the response has no setupGuide', () => {
    expect(setupGuidePatchFromWriteResult(undefined)).toEqual({});
    expect(setupGuidePatchFromWriteResult(null)).toEqual({});
    expect(setupGuidePatchFromWriteResult({})).toEqual({});
    expect(setupGuidePatchFromWriteResult({ setupGuide: [] })).toEqual({});
  });

  it('returns the setupGuide patch when present', () => {
    expect(
      setupGuidePatchFromWriteResult({ setupGuide: { dismissedAt: '2026-01-02T00:00:00.000Z' } })
    ).toEqual({ dismissedAt: '2026-01-02T00:00:00.000Z' });
  });
});

describe('setupGuideSessionSnoozeKey', () => {
  it('setupGuideSessionSnoozeKey is exported', () => {
    expect(typeof setupGuideSessionSnoozeKey).toBe('function');
  });
});

describe('isSetupGuideSessionSnoozed', () => {
  it('isSetupGuideSessionSnoozed is exported', () => {
    expect(typeof isSetupGuideSessionSnoozed).toBe('function');
  });
});

describe('setSetupGuideSessionSnoozed', () => {
  it('setSetupGuideSessionSnoozed is exported', () => {
    expect(typeof setSetupGuideSessionSnoozed).toBe('function');
  });
});
