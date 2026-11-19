import type { AiDashboardAssistantOrgSettings } from '@/features/dashboard/ai-assistant/lib/aiAssistantApi';

/** Desktop Quick Access FAB diameter — matches `min-h` / `min-w` on AdminQuickAccessHub. */
export const AI_ASSISTANT_FAB_SIZE_PX = 52;

/**
 * Matches `AiAssistantLauncherButton` / Quick Access Assistant row mount rules —
 * assistant can show read-only when plan-gated but kill-switches are on.
 */
export function isAiAssistantFabVisible(
  accessible: boolean,
  settings: AiDashboardAssistantOrgSettings | undefined,
  planGateAllowed: boolean,
  permissionAllowed = true
): boolean {
  if (!permissionAllowed) return false;
  const killSwitchOff = Boolean(settings && (!settings.platformEnabled || !settings.enabled));
  if (!accessible && (killSwitchOff || planGateAllowed)) return false;
  return true;
}
