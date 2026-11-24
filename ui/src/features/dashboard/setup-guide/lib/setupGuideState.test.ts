import { describe, expect, it } from 'vitest';

import type { SetupGuidePersistedState } from '@/features/dashboard/setup-guide/lib/setupGuideTypes';

import {
  readSetupGuidePersistedState,
  mergeSetupGuidePersistedState,
  setupGuideSessionSnoozeKey,
  isSetupGuideSessionSnoozed,
  setSetupGuideSessionSnoozed,
} from '@/features/dashboard/setup-guide/lib/setupGuideState';

describe('readSetupGuidePersistedState', () => {
  it('readSetupGuidePersistedState is exported', () => {
    expect(typeof readSetupGuidePersistedState).toBe('function');
  });
});

describe('mergeSetupGuidePersistedState', () => {
  it('mergeSetupGuidePersistedState is exported', () => {
    expect(typeof mergeSetupGuidePersistedState).toBe('function');
  });

  it('survives a success response with no setupGuide payload', () => {
    const current: SetupGuidePersistedState = {
      version: 1,
      dismissedAt: '2026-01-01T00:00:00.000Z',
      completedAt: null,
      lastStepId: 'listing',
      skippedSteps: [],
      reviewedSteps: [],
    };
    expect(mergeSetupGuidePersistedState(current, undefined)).toEqual(current);
    expect(mergeSetupGuidePersistedState(current, null)).toEqual(current);
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
