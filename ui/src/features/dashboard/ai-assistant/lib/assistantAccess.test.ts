import { describe, expect, it } from 'vitest';

import {
  assistantUnavailableCopy,
  resolveAssistantOpenRequest,
  shouldPromptAssistantUpgrade,
} from '@/features/dashboard/ai-assistant/lib/assistantAccess';

const enabledSettings = {
  platformEnabled: true,
  enabled: true,
  disabledPropertyIds: [] as string[],
};

describe('shouldPromptAssistantUpgrade', () => {
  it('does not open while access is still loading', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: true,
        permissionAllowed: true,
        accessible: false,
      })
    ).toBe(false);
  });

  it('does not open when the member lacks assistant:view', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: false,
        permissionAllowed: false,
        accessible: false,
      })
    ).toBe(false);
  });

  it('opens when the plan or kill switch blocks a permitted member', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: false,
        permissionAllowed: true,
        accessible: false,
      })
    ).toBe(true);
  });

  it('does not open when the assistant is usable', () => {
    expect(
      shouldPromptAssistantUpgrade({
        accessPending: false,
        permissionAllowed: true,
        accessible: true,
      })
    ).toBe(false);
  });
});

describe('resolveAssistantOpenRequest', () => {
  it('waits while access is pending', () => {
    expect(
      resolveAssistantOpenRequest({
        accessPending: true,
        accessible: false,
        permissionAllowed: true,
        planAllowed: true,
        settings: undefined,
        settingsSettled: false,
      })
    ).toEqual({ kind: 'wait' });
  });

  it('opens when accessible', () => {
    expect(
      resolveAssistantOpenRequest({
        accessPending: false,
        accessible: true,
        permissionAllowed: true,
        planAllowed: true,
        settings: enabledSettings,
        settingsSettled: true,
      })
    ).toEqual({ kind: 'open' });
  });

  it('opens upgrade when the plan blocks', () => {
    expect(
      resolveAssistantOpenRequest({
        accessPending: false,
        accessible: false,
        permissionAllowed: true,
        planAllowed: false,
        settings: enabledSettings,
        settingsSettled: true,
      })
    ).toEqual({ kind: 'upgrade' });
  });

  it('shows maintenance when the platform kill switch is off', () => {
    expect(
      resolveAssistantOpenRequest({
        accessPending: false,
        accessible: false,
        permissionAllowed: true,
        planAllowed: true,
        settings: { ...enabledSettings, platformEnabled: false },
        settingsSettled: true,
      })
    ).toEqual({ kind: 'unavailable', reason: 'maintenance' });
  });

  it('shows maintenance when the org toggle is off', () => {
    expect(
      resolveAssistantOpenRequest({
        accessPending: false,
        accessible: false,
        permissionAllowed: true,
        planAllowed: true,
        settings: { ...enabledSettings, enabled: false },
        settingsSettled: true,
      })
    ).toEqual({ kind: 'unavailable', reason: 'maintenance' });
  });

  it('shows property when this listing is disabled', () => {
    expect(
      resolveAssistantOpenRequest({
        accessPending: false,
        accessible: false,
        permissionAllowed: true,
        planAllowed: true,
        settings: { ...enabledSettings, disabledPropertyIds: ['prop-1'] },
        settingsSettled: true,
        propertyId: 'prop-1',
      })
    ).toEqual({ kind: 'unavailable', reason: 'property' });
  });

  it('shows permission when the member lacks assistant:view', () => {
    expect(
      resolveAssistantOpenRequest({
        accessPending: false,
        accessible: false,
        permissionAllowed: false,
        planAllowed: true,
        settings: enabledSettings,
        settingsSettled: true,
      })
    ).toEqual({ kind: 'unavailable', reason: 'permission' });
  });
});

describe('assistantUnavailableCopy', () => {
  it('returns short production copy for each reason', () => {
    expect(assistantUnavailableCopy('maintenance').title).toBe('AI assistant unavailable');
    expect(assistantUnavailableCopy('property').description).toContain('this property');
    expect(assistantUnavailableCopy('permission').description).toContain('permission');
  });
});
