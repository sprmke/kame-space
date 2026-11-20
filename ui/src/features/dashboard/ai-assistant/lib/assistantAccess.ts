/** Whether Send / New chat should open the plan upgrade modal. */
export function shouldPromptAssistantUpgrade(input: {
  accessPending: boolean;
  permissionAllowed: boolean;
  accessible: boolean;
}): boolean {
  if (input.accessPending) return false;
  if (!input.permissionAllowed) return false;
  return !input.accessible;
}

export type AssistantUnavailableReason = 'maintenance' | 'property' | 'permission';

export type AssistantOpenOutcome =
  | { kind: 'wait' }
  | { kind: 'open' }
  | { kind: 'upgrade' }
  | { kind: 'unavailable'; reason: AssistantUnavailableReason };

type AssistantOpenSettings = {
  platformEnabled: boolean;
  enabled: boolean;
  disabledPropertyIds: string[];
};

/**
 * Decide what Help & Support (and other `openAiAssistant` callers) should do.
 * Wait until access is settled so a click is never silently dropped.
 */
export function resolveAssistantOpenRequest(input: {
  accessPending: boolean;
  accessible: boolean;
  permissionAllowed: boolean;
  planAllowed: boolean;
  settings: AssistantOpenSettings | undefined;
  /** True when the settings query finished (success or error). */
  settingsSettled: boolean;
  propertyId?: string | null;
}): AssistantOpenOutcome {
  if (input.accessPending) return { kind: 'wait' };
  if (input.accessible) return { kind: 'open' };
  if (!input.permissionAllowed) return { kind: 'unavailable', reason: 'permission' };

  const settings = input.settings;
  if (!settings) {
    return input.settingsSettled
      ? { kind: 'unavailable', reason: 'maintenance' }
      : { kind: 'wait' };
  }

  if (!settings.platformEnabled || !settings.enabled) {
    return { kind: 'unavailable', reason: 'maintenance' };
  }
  if (input.propertyId && settings.disabledPropertyIds.includes(input.propertyId)) {
    return { kind: 'unavailable', reason: 'property' };
  }
  if (!input.planAllowed) return { kind: 'upgrade' };

  return { kind: 'unavailable', reason: 'maintenance' };
}

export function assistantUnavailableCopy(reason: AssistantUnavailableReason): {
  title: string;
  description: string;
} {
  switch (reason) {
    case 'permission':
      return {
        title: 'AI assistant unavailable',
        description: 'You do not have permission to use the AI assistant.',
      };
    case 'property':
      return {
        title: 'AI assistant unavailable',
        description: 'AI assistant is not enabled for this property.',
      };
    case 'maintenance':
      return {
        title: 'AI assistant unavailable',
        description: 'AI assistant is turned off or under maintenance. Try again later.',
      };
  }
}
