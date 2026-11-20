import { describe, expect, it } from 'vitest';

import type { AiDashboardAssistantOrgSettings } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';
import {
  AI_ASSISTANT_FAB_SIZE_PX,
  isAiAssistantFabVisible,
} from '@/features/dashboard/ai-assistant/lib/assistantFabLayout';

function settings(
  partial: Pick<AiDashboardAssistantOrgSettings, 'platformEnabled' | 'enabled'>
): AiDashboardAssistantOrgSettings {
  return {
    organizationId: 'org',
    disabledPropertyIds: [],
    dailyMessageLimit: 0,
    monthlyMessageLimit: 0,
    dailyWriteActionLimit: 0,
    updatedBy: null,
    updatedAt: '',
    usage: null,
    ...partial,
  };
}

describe('isAiAssistantFabVisible', () => {
  it('hides when permission is denied', () => {
    expect(isAiAssistantFabVisible(true, undefined, true, false)).toBe(false);
  });

  it('hides when kill switches are off and access is false', () => {
    expect(isAiAssistantFabVisible(false, settings({ platformEnabled: false, enabled: true }), true)).toBe(
      false
    );
  });

  it('shows when accessible', () => {
    expect(isAiAssistantFabVisible(true, settings({ platformEnabled: true, enabled: true }), true)).toBe(
      true
    );
  });
});

describe('AI_ASSISTANT_FAB_SIZE_PX', () => {
  it('is 52', () => {
    expect(AI_ASSISTANT_FAB_SIZE_PX).toBe(52);
  });
});
